import type { ChoreoActor, ChoreoPose } from '../../../../packages/reels/src/worlds/football/choreography.ts';
import type { PlateSpec } from '../pose-track.ts';

/**
 * Blender plates of "HNC: The Current" (packages/reels/src/content/the-current.ts).
 * Frame counts = the plate beat's duration at 60 fps. Match plates sample the
 * SAME `meridian` choreography the Remotion shots around them use (charge
 * hands over to the `leap` beat at moment 8.9; legend follows `hush` at 10.3).
 * Portraits are hand-directed poses on the canonical rig channels only.
 */

const smooth = (v: number): number => {
  const c = Math.min(1, Math.max(0, v));
  return c * c * (3 - 2 * c);
};
const seg = (t: number, a: number, b: number): number => Math.min(1, Math.max(0, (t - a) / (b - a)));
const idle = (t: number, p: Partial<ChoreoPose>): ChoreoPose => ({ action: 'idle', actionTime: 0, speed: 0, clock: t, ...p });
const at = (team: ChoreoActor['team'], number: number, facing: number, pose: ChoreoPose): ChoreoActor => ({ team, x: 0, z: 0, facing, number, pose });

const EMRE = { country: 'TR', number: 9 } as const;
const NIKOS = { country: 'GR', number: 4 } as const;
const PETROS = { country: 'GR', number: 1, keeper: true } as const;

export const THE_CURRENT_PLATES: PlateSpec[] = [
  {
    id: 'current-eye',
    frames: 96,
    builder: 'current_eye',
    actors: [
      {
        ...EMRE,
        // Eyes shut, head bowed; on beat 3 (0.8 s) the eyes snap open and the head lifts.
        actor: (t) =>
          at('home', 9, -0.12, idle(t, {
            eyeOpen: t < 0.8 ? 0.12 : 1.35 - 0.25 * smooth(seg(t, 0.84, 1.3)),
            headPitch: 0.16 - 0.2 * smooth(seg(t, 0.72, 1.0)),
            headYaw: -0.06 + 0.04 * smooth(seg(t, 0.8, 1.4)),
            crouch: 0.05,
          })),
      },
    ],
  },
  {
    id: 'current-chalk',
    frames: 96,
    builder: 'current_chalk',
    moment: 'meridian',
    clock: { from: 0.3, to: 0.9 },
    ball: true,
    actors: [
      { ...EMRE, roleIndex: 0 },
      { ...NIKOS, roleIndex: 1 },
    ],
  },
  {
    id: 'current-emre',
    frames: 96,
    builder: 'current_portrait',
    look: { color: 'TR', side: 'left' },
    actors: [{ ...EMRE, actor: (t) => at('home', 9, 0.18, idle(t, { crouch: 0.12 + 0.05 * Math.sin(t * 3), airplane: 0.14, headPitch: 0.3 - 0.3 * smooth(seg(t, 0.15, 0.7)) })) }],
  },
  {
    id: 'current-nikos',
    frames: 96,
    builder: 'current_portrait',
    look: { color: 'GR', side: 'right' },
    actors: [{ ...NIKOS, actor: (t) => at('away', 4, -0.2, idle(t, { crouch: 0.1 + 0.05 * Math.sin(t * 3 + 1), airplane: 0.1, headPitch: 0.28 - 0.28 * smooth(seg(t, 0.15, 0.7)), headYaw: 0.05 })) }],
  },
  {
    id: 'current-petros',
    frames: 96,
    builder: 'current_portrait',
    look: { color: 'GR', side: 'left', keeper: true },
    actors: [{ ...PETROS, actor: (t) => at('keeper-away', 1, 0.1, idle(t, { crouch: 0.45, airplane: 0.4, headPitch: 0.35 - 0.35 * smooth(seg(t, 0.2, 0.8)) })) }],
  },
  {
    id: 'current-charge',
    frames: 192,
    builder: 'current_charge',
    props: ['hnc-goal'],
    moment: 'meridian',
    clock: { from: 7.8, to: 8.9 },
    ball: true,
    actors: [
      { ...EMRE, roleIndex: 0 },
      { ...NIKOS, roleIndex: 1 },
      { ...PETROS, roleIndex: 2 },
    ],
  },
  {
    id: 'current-legend',
    frames: 120,
    builder: 'current_legend',
    props: ['hnc-goal'],
    moment: 'meridian',
    clock: { from: 10.3, to: 10.9 },
    ball: true,
    actors: [
      { ...EMRE, roleIndex: 0 },
      { ...NIKOS, roleIndex: 1 },
      { ...PETROS, roleIndex: 2 },
    ],
  },
];
