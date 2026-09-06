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
  // The joiner learns the room's matchToken too: both peers prove it in the
  // WebRTC handshake, so a stray peer can never land in someone's session.
  z.object({ t: z.literal('room-joined'), roomCode: RoomCodeSchema, peers: z.array(ClientIdSchema), matchToken: z.string().min(16) }),
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

/* ---------------- F4b leagues (REST DTOs) ---------------- */

/** League lifecycle: lobby (gathering players) → active (fixtures live) → done. */
export const LeagueStatusSchema = z.enum(['lobby', 'active', 'done']);
export type LeagueStatus = z.infer<typeof LeagueStatusSchema>;

/** Fixture lifecycle: pending → confirmed (both sides agree / creator ruling), or disputed. */
export const FixtureStatusSchema = z.enum(['pending', 'confirmed', 'disputed']);
export type FixtureStatus = z.infer<typeof FixtureStatusSchema>;

/** Reuse the voice-chat-friendly alphabet for league join codes. */
export const LeagueCodeSchema = RoomCodeSchema;

export const MemberSchema = z.object({
  clientId: ClientIdSchema,
  displayName: z.string().min(1).max(24),
  joinedAt: z.number().int().nonnegative(),
});
export type Member = z.infer<typeof MemberSchema>;

export const FixtureSchema = z.object({
  id: z.string().uuid(),
  round: z.number().int().min(1),
  homeClientId: ClientIdSchema,
  awayClientId: ClientIdSchema,
  status: FixtureStatusSchema,
  homeScore: z.number().int().min(0).max(99).nullable(),
  awayScore: z.number().int().min(0).max(99).nullable(),
});
export type Fixture = z.infer<typeof FixtureSchema>;

export const StandingsRowSchema = z.object({
  clientId: ClientIdSchema,
  displayName: z.string().min(1).max(24),
  played: z.number().int().nonnegative(),
  won: z.number().int().nonnegative(),
  drawn: z.number().int().nonnegative(),
  lost: z.number().int().nonnegative(),
  goalsFor: z.number().int().nonnegative(),
  goalsAgainst: z.number().int().nonnegative(),
  points: z.number().int().nonnegative(),
});
export type StandingsRow = z.infer<typeof StandingsRowSchema>;

export const LeagueSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(48),
  code: LeagueCodeSchema,
  status: LeagueStatusSchema,
  createdBy: ClientIdSchema,
  createdAt: z.number().int().nonnegative(),
  members: z.array(MemberSchema),
  fixtures: z.array(FixtureSchema),
  standings: z.array(StandingsRowSchema),
});
export type League = z.infer<typeof LeagueSchema>;

const DisplayName = z.string().trim().min(1).max(24);

export const CreateLeagueSchema = z.object({
  name: z.string().trim().min(1).max(48),
  clientId: ClientIdSchema,
  displayName: DisplayName,
});
export type CreateLeague = z.infer<typeof CreateLeagueSchema>;

export const JoinLeagueSchema = z.object({
  code: LeagueCodeSchema,
  clientId: ClientIdSchema,
  displayName: DisplayName,
});
export type JoinLeague = z.infer<typeof JoinLeagueSchema>;

export const StartLeagueSchema = z.object({ clientId: ClientIdSchema });
export type StartLeague = z.infer<typeof StartLeagueSchema>;

const Score = z.number().int().min(0).max(99);

export const SubmitResultSchema = z.object({
  clientId: ClientIdSchema,
  homeScore: Score,
  awayScore: Score,
  /** 256-bit room token proving a real match happened (ADR-004); audited, not verified. */
  matchToken: z.string().min(16).max(128),
});
export type SubmitResult = z.infer<typeof SubmitResultSchema>;

export const ResolveResultSchema = z.object({
  clientId: ClientIdSchema,
  homeScore: Score,
  awayScore: Score,
});
export type ResolveResult = z.infer<typeof ResolveResultSchema>;
