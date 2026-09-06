import { z } from 'zod';

/** Guest device identity (uuid from the client, verified nowhere — see ADR-004). */
export const ClientIdSchema = z.string().min(8).max(64).regex(/^[0-9a-f-]+$/i);

/** 6-char room code, unambiguous alphabet (no 0/O/1/I). */
export const RoomCodeSchema = z.string().length(6).regex(/^[A-HJ-NP-Z2-9]{6}$/);

/** WebRTC SDP payload relayed verbatim between peers (size-capped). */
export const SdpSchema = z.object({
  type: z.enum(['offer', 'answer', 'pranswer']),
  sdp: z.string().min(1).max(16384),
});

const BaseSignal = z.object({ to: ClientIdSchema, payload: SdpSchema });

export const ClientMsgSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('create-room'), clientId: ClientIdSchema }),
  z.object({ t: z.literal('join-room'), code: RoomCodeSchema, clientId: ClientIdSchema }),
  z.object({ t: z.literal('leave-room') }),
  z.object({ t: z.literal('signal'), ...BaseSignal.shape }),
  z.object({ t: z.literal('ping') }),
]);

export const ServerMsgSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('room-created'), roomCode: RoomCodeSchema, matchToken: z.string().min(16) }),
  z.object({ t: z.literal('room-joined'), roomCode: RoomCodeSchema, peers: z.array(ClientIdSchema) }),
  z.object({ t: z.literal('peer-joined'), clientId: ClientIdSchema }),
  z.object({ t: z.literal('peer-left'), clientId: ClientIdSchema }),
  z.object({ t: z.literal('signaled'), from: ClientIdSchema, payload: SdpSchema }),
  z.object({ t: z.literal('pong') }),
  z.object({ t: z.literal('error'), message: z.string().min(1).max(256) }),
]);

export type ClientMsg = z.infer<typeof ClientMsgSchema>;
export type ServerMsg = z.infer<typeof ServerMsgSchema>;

/** Parse inbound WS JSON into a ClientMsg, or a human-readable error. */
export function parseClientMsg(data: unknown): { ok: true; msg: ClientMsg } | { ok: false; error: string } {
  let json: unknown = data;
  if (typeof data === 'string') {
    try { json = JSON.parse(data); } catch { return { ok: false, error: 'malformed JSON' }; }
  }
  const r = ClientMsgSchema.safeParse(json);
  return r.success ? { ok: true, msg: r.data } : { ok: false, error: 'invalid message' };
}

/** REST DTOs (rooms are ephemeral; leagues/results land in F4b). */
export const RoomInfoSchema = z.object({
  code: RoomCodeSchema,
  members: z.array(ClientIdSchema).max(2),
  createdAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().nonnegative(),
});
export type RoomInfo = z.infer<typeof RoomInfoSchema>;

export const HealthSchema = z.object({
  status: z.literal('ok'),
  uptimeSec: z.number().nonnegative(),
  redis: z.enum(['up', 'down', 'disabled']),
});
export type Health = z.infer<typeof HealthSchema>;
