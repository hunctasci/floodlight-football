export type TeamId = 0 | 1;
export type Phase = 'kickoff' | 'playing' | 'goal' | 'throwin' | 'corner' | 'goalkick' | 'halftime' | 'fulltime';
export interface Vec { x: number; z: number }
export interface Team { name: string; short: string; color: string; secondary: string; city: string }
export const TEAMS: Team[] = [
  { name: 'London Lions', short: 'LON', color: '#ffc438', secondary: '#182747', city: 'LONDON' },
  { name: 'Milan Reds', short: 'MIL', color: '#ef4054', secondary: '#f6eee2', city: 'MILAN' },
  { name: 'Madrid Sol', short: 'SOL', color: '#f5f0da', secondary: '#7456ca', city: 'MADRID' },
  { name: 'Istanbul Bosphorus', short: 'IST', color: '#29d8d0', secondary: '#173d63', city: 'ISTANBUL' }
];
export const FIELD = { halfLength: 46, halfWidth: 29, goalHalfWidth: 4.4, goalHeight: 2.8, ballRadius: 0.25, penaltyLength: 14, penaltyHalfWidth: 15 };
export interface Player extends Vec {
  id: number; team: TeamId; number: number; name: string; keeper: boolean;
  vx: number; vz: number; facingX: number; facingZ: number; homeX: number; homeZ: number;
  stamina: number; action: 'idle' | 'run' | 'kick' | 'tackle' | 'dive' | 'slide' | 'fallen'; actionTime: number;
  cooldown: number; think: number; aiState: string;
}
export interface Ball extends Vec { y: number; vx: number; vy: number; vz: number; spin: number; owner: number | null; lastTouch: TeamId; lock: number; lastKicker: number | null; flight: 'roll' | 'pass' | 'through' | 'cross' | 'shot' }
export interface Restart { team: TeamId; taker: number; x: number; z: number; wait: number }
export interface MatchStats { shots: [number, number]; saves: [number, number]; passes: [number, number]; tackles: [number, number]; possession: [number, number] }
export interface MatchState {
  players: Player[]; ball: Ball; teams: [Team, Team]; humanTeam: TeamId; controlled: number;
  /** Second human (online peer). Null = AI controls that team, as in local play. */
  remoteTeam: TeamId | null; peerControlled: number; peerTarget: number | null;
  phase: Phase; phaseTime: number; half: 1 | 2; elapsed: number; halfDuration: number;
  score: [number, number]; attack: [number, number]; restart: Restart | null; paused: boolean;
  message: string; messageTime: number; charge: number; targetPlayer: number | null; time: number; stats: MatchStats;
}
export interface InputFrame { x: number; z: number; sprint: boolean; pass: boolean; through: boolean; cross: boolean; shootPressed: boolean; shootHeld: boolean; shootReleased: boolean; switchPlayer: boolean }
export const EMPTY_INPUT: InputFrame = { x: 0, z: 0, sprint: false, pass: false, through: false, cross: false, shootPressed: false, shootHeld: false, shootReleased: false, switchPlayer: false };
export type GameEvent = { type: 'kick' | 'shot' | 'tackle' | 'save' | 'post' | 'goal' | 'whistle' | 'restart'; team?: TeamId; power?: number; slide?: boolean };
