import type { BotAssignment } from '../city-league/bot-match';
export interface MatchAssignment {
  roomCode: string; role: 'host' | 'guest'; peerId: string; opponentCountry: string;
}
export interface QueueReply extends Partial<MatchAssignment> {
  kind?: 'bot'; bot?: BotAssignment; ticket?: string; status: 'queued' | 'matched' | 'cancelled' | 'expired'; waiting?: number;
}
export async function queueRequest(action: 'join' | 'poll' | 'cancel', data: Record<string, unknown>): Promise<QueueReply> {
  const response = await fetch(`/api/matchmaking/${action}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data), signal: AbortSignal.timeout(10000), keepalive: action === 'cancel',
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? 'Matchmaking is unavailable. Please try again.');
  return body;
}
