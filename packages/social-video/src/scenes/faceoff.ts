import type { MatchState, Player, TeamId } from '../../../../apps/game/src/types';
import { countryTeams } from '../../../../apps/game/src/city-league/kits';
import type { ResolvedFrameSpec } from '../schema';
import { faceoffCamera, type SocialLens } from '../cameras/social-camera';

export interface CompiledFaceoff {
  state: MatchState;
  camera: SocialLens;
}

/** Deterministic PRNG (mulberry32): all variation derives from the spec seed. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function faceoffPlayer(
  id: number, team: TeamId, x: number, z: number, fx: number, fz: number, number: number,
): Player {
  const len = Math.hypot(fx, fz) || 1;
  return {
    id, team, number, name: team === 0 ? 'Home' : 'Away', keeper: false,
    x, z, vx: 0, vz: 0, facingX: fx / len, facingZ: fz / len,
    homeX: x, homeZ: z, stamina: 1, action: 'idle', actionTime: 0,
    cooldown: 0, think: 0, aiState: 'POSE', touchIn: 0,
  };
}

/**
 * Compile the `faceoff` scene: two HNC-style outfielders staged around the
 * centre spot in their canonical country kits, facing each other over the
 * ball. Staged cinematic pose — not gameplay. Pure function of the spec.
 */
export function compileFaceoff(spec: ResolvedFrameSpec): CompiledFaceoff {
  const rand = seededRandom(spec.seed);
  // Subtle staged variation (±12cm): seeds differ, composition never breaks.
  const jx = () => (rand() - 0.5) * 0.24;
  const jz = () => (rand() - 0.5) * 0.24;
  const [homeTeam, awayTeam] = countryTeams(spec.home, spec.away);

  const hx = -1.7 + jx(), hz = 0.9 + jz();
  const ax = 1.7 + jx(), az = -0.9 + jz();
  // Each player faces the other — derived from the staged positions so the
  // stare-down always connects regardless of seed jitter.
  const home = faceoffPlayer(0, 0, hx, hz, ax - hx, az - hz, 10);
  const away = faceoffPlayer(1, 1, ax, az, hx - ax, hz - az, 7);

  const state: MatchState = {
    players: [home, away],
    ball: { x: 0, z: 0, y: 0.25, vx: 0, vy: 0, vz: 0, spin: 0, owner: null, lastTouch: 0, lock: 0, lastKicker: null, flight: 'roll' },
    teams: [homeTeam, awayTeam],
    humanTeam: 0, controlled: 0, remoteTeam: null, peerControlled: -1, peerTarget: null,
    phase: 'playing', phaseTime: 0, half: 1, elapsed: 0, halfDuration: 60,
    score: [0, 0], attack: [1, -1], restart: null, paused: false,
    message: '', messageTime: 0, charge: 0, targetPlayer: null, time: 0,
    stats: { shots: [0, 0], saves: [0, 0], passes: [0, 0], tackles: [0, 0], possession: [0, 0] },
  };
  return { state, camera: faceoffCamera() };
}
