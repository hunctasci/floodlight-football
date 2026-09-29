/**
 * Action library — what a cast member DOES, as pure pose functions of the
 * seconds since the action started. Poses drive the canonical HNC rig
 * (applyHncBodyPose): same joints the game animates, head group + eyes on
 * top. Each action also says how a `lookAt` target is followed (eyes only for
 * a side-eye, head for a notice, body for a point) and whether it changes
 * posture (stand-up leaves the character standing).
 *
 * Motion design: every expressive action has anticipation → action → settle
 * built in, so a beat that only says `do: 'slam-desk'` already reads.
 */
import { neutralHncBodyPose, type HncBodyPose } from '@floodlight/hnc-visuals';

export interface ActionDef {
  summary: string;
  /** How much of a look target the eyes / head / body follow (0..1). */
  gaze: { eyes: number; head: number; body: number };
  /** Posture after this action (undefined = keep). */
  posture?: 'sit' | 'stand';
  /** Seconds for the pose to settle (blend into the next action). */
  blend?: number;
  /** Walk cycle legs (moves). */
  locomotion?: boolean;
  pose: (t: number, sit: number) => Partial<HncBodyPose>;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const ramp = (t: number, a: number, b: number): number => clamp01((t - a) / (b - a));
const smooth = (x: number): number => {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
};
const easeOut = (x: number): number => 1 - Math.pow(1 - clamp01(x), 3);
const breathe = (t: number, k = 1): number => Math.sin(t * 2.2) * 0.012 * k;

/** Hands hovering over a keyboard (seated) or resting at the waist (standing). */
const hands = (sit: number, lift = 0.95): Partial<HncBodyPose> => ({
  armLX: -lift * sit - 0.1 * (1 - sit),
  armRX: -lift * sit - 0.1 * (1 - sit),
  armLZ: 0.12,
  armRZ: -0.12,
});

const HEAD = { eyes: 0.8, head: 0.85, body: 0 };
const BODY = { eyes: 0.8, head: 0.8, body: 0.45 };
const NONE = { eyes: 0, head: 0, body: 0 };

export const ACTIONS: Record<string, ActionDef> = {
  idle: {
    summary: 'Breathing idle (posture kept)',
    gaze: HEAD,
    pose: (t, sit) => ({ y: breathe(t), ...hands(sit, 0.5) }),
  },
  freeze: {
    summary: 'Dead still (comedic freeze)',
    gaze: HEAD,
    pose: (_t, sit) => hands(sit, 0.9),
  },
  typing: {
    summary: 'Seated typing loop, eyes on the monitor',
    gaze: { eyes: 0.6, head: 0.15, body: 0 },
    pose: (t, sit) => ({
      y: Math.sin(t * 9) * 0.006,
      pitch: 0.08,
      headPitch: 0.1,
      armLX: -0.98 * sit - 0.2 + Math.sin(t * 15) * 0.07,
      armRX: -0.98 * sit - 0.2 + Math.sin(t * 15 + 2.1) * 0.07,
    }),
  },
  notice: {
    summary: 'Hands freeze, head snaps to the target, eyes widen',
    gaze: { eyes: 1, head: 0.9, body: 0 },
    blend: 0.1,
    pose: (t, sit) => ({
      pitch: -0.06 * easeOut(t / 0.15),
      eyeOpen: 1 + 0.35 * (1 - ramp(t, 0.15, 0.9)),
      ...hands(sit, 0.9),
    }),
  },
  'side-eye': {
    summary: 'Slow suspicious side-eye: eyes slide, head barely follows',
    gaze: { eyes: 1, head: 0.28, body: 0 },
    blend: 0.45,
    pose: (t, sit) => ({ eyeOpen: 1 - 0.4 * smooth(t / 0.6), headPitch: 0.06, ...hands(sit, 0.92) }),
  },
  glare: {
    summary: 'Chin down, squint, lean in toward the target',
    gaze: { eyes: 1, head: 1, body: 0.15 },
    blend: 0.3,
    pose: (t, sit) => ({ pitch: 0.14 * smooth(t / 0.5), headPitch: 0.16, eyeOpen: 0.42, y: breathe(t, 0.6), ...hands(sit, 0.55) }),
  },
  'stare-down': {
    summary: 'Standing faceoff stare: chest out, fists by the hips',
    gaze: { eyes: 1, head: 1, body: 0.3 },
    blend: 0.3,
    pose: (t) => ({ pitch: -0.05, headPitch: 0.1, eyeOpen: 0.5, y: breathe(t), armLX: 0.05, armRX: 0.05, armLZ: 0.38, armRZ: -0.38 }),
  },
  'stand-up': {
    summary: 'Push off the desk and rise (anticipation lean, then up)',
    gaze: HEAD,
    posture: 'stand',
    blend: 0.05,
    pose: (t) => {
      const up = smooth(ramp(t, 0.12, 0.6));
      const lean = Math.sin(Math.PI * ramp(t, 0, 0.5)) * 0.32;
      return { sit: 1 - up, pitch: lean, armLX: -0.7 * (1 - up), armRX: -0.7 * (1 - up), armLZ: 0.2, armRZ: -0.2 };
    },
  },
  'sit-down': {
    summary: 'Drop back into the chair',
    gaze: HEAD,
    posture: 'sit',
    pose: (t) => ({ sit: smooth(ramp(t, 0, 0.45)), pitch: Math.sin(Math.PI * ramp(t, 0, 0.45)) * 0.18, ...hands(1, 0.5) }),
  },
  'slam-desk': {
    summary: 'Wind up and slam both palms down (impact at 0.28s)',
    gaze: HEAD,
    blend: 0.08,
    pose: (t) => {
      const lift = smooth(ramp(t, 0, 0.18));
      const slam = easeOut(ramp(t, 0.18, 0.28));
      const arm = -2.1 * lift + (2.1 - 0.95) * slam;
      return { pitch: 0.28 * slam - 0.08 * lift * (1 - slam), headPitch: 0.1 * slam, eyeOpen: 0.5, armLX: arm, armRX: arm, armLZ: 0.15, armRZ: -0.15, y: -0.03 * slam };
    },
  },
  point: {
    summary: 'Point at the target (body turns into it)',
    gaze: BODY,
    blend: 0.12,
    pose: (t, sit) => ({ ...hands(sit, 0.5), armRX: -1.5 * easeOut(t / 0.2), armRZ: 0, pitch: 0.06, headPitch: 0.04 }),
  },
  cheer: {
    summary: 'Arms up, bouncing',
    gaze: HEAD,
    pose: (t) => ({ armLX: -2.6, armRX: -2.6, armLZ: 0.2, armRZ: -0.2, y: Math.abs(Math.sin(t * 9)) * 0.14, headPitch: -0.15, eyeOpen: 1.2 }),
  },
  facepalm: {
    summary: 'Hand to face, head drops, slow shake',
    gaze: NONE,
    blend: 0.2,
    pose: (t, sit) => ({ ...hands(sit, 0.4), armRX: -2.3 * easeOut(t / 0.3), armRZ: 0.42, headPitch: 0.32, headRoll: Math.sin(t * 6) * 0.06, pitch: 0.12, y: -0.02, eyeOpen: 0.3 }),
  },
  shrug: {
    summary: 'Palms out shrug',
    gaze: HEAD,
    pose: (t) => {
      const k = Math.sin(Math.PI * ramp(t, 0, 0.7));
      return { armLX: -0.45, armRX: -0.45, armLZ: 0.2 + 0.55 * k, armRZ: -0.2 - 0.55 * k, headRoll: 0.16 * k, y: 0.03 * k };
    },
  },
  sip: {
    summary: 'Smug sip from the mug in hand',
    gaze: HEAD,
    pose: (t, sit) => {
      const lift = smooth(ramp(t, 0, 0.35)) * (1 - smooth(ramp(t, 1.0, 1.35)));
      return { ...hands(sit, 0.5), armRX: -0.6 - 1.45 * lift, armRZ: -0.05, headPitch: 0.18 * lift - 0.08, eyeOpen: 1 - 0.45 * lift };
    },
  },
  smug: {
    summary: 'Lean back, chin up, arms folded',
    gaze: { eyes: 1, head: 0.5, body: 0 },
    blend: 0.3,
    pose: (t) => ({ pitch: -0.12, headPitch: -0.12, eyeOpen: 0.62, armLX: -1.25, armLZ: -0.55, armRX: -1.25, armRZ: 0.55, y: breathe(t) }),
  },
  gasp: {
    summary: 'Recoil: lean back, eyes wide, hands up',
    gaze: HEAD,
    blend: 0.06,
    pose: (t, sit) => {
      const k = easeOut(t / 0.12);
      return { pitch: -0.18 * k, eyeOpen: 1 + 0.6 * k, armLX: -0.5 * sit - 0.6 * k, armRX: -0.5 * sit - 0.6 * k, armLZ: 0.3 * k, armRZ: -0.3 * k };
    },
  },
  deflate: {
    summary: 'Slump: shoulders drop, head hangs',
    gaze: NONE,
    blend: 0.5,
    pose: (t, sit) => ({ pitch: 0.24 * smooth(t / 0.8), headPitch: 0.34 * smooth(t / 0.8), eyeOpen: 0.55, y: -0.05, ...hands(sit, 0.3) }),
  },
  talk: {
    summary: 'Presenting to camera: head bobs, one hand gestures',
    gaze: { eyes: 1, head: 0.7, body: 0 },
    pose: (t, sit) => ({
      headPitch: Math.sin(t * 5.2) * 0.05,
      headYaw: Math.sin(t * 1.4) * 0.1,
      ...hands(sit, 0.7),
      armRX: -0.85 + Math.sin(t * 3.3) * 0.28,
      armRZ: -0.25 + Math.sin(t * 2.1) * 0.12,
    }),
  },
  present: {
    summary: 'Open-arm gesture toward the side',
    gaze: HEAD,
    pose: (t, sit) => ({ ...hands(sit, 0.6), armLX: -0.7, armLZ: 0.9 * easeOut(t / 0.3), headYaw: 0.1 }),
  },
  nod: {
    summary: 'Knowing nod',
    gaze: HEAD,
    pose: (t, sit) => ({ ...hands(sit, 0.6), headPitch: Math.sin(Math.min(1, t / 0.7) * Math.PI * 3) * 0.14 }),
  },
  'head-shake': {
    summary: 'Disbelieving head shake',
    gaze: NONE,
    pose: (t, sit) => ({ ...hands(sit, 0.6), headYaw: Math.sin(t * 11) * 0.28 * (1 - ramp(t, 0.5, 1.1)), eyeOpen: 0.6 }),
  },
  'look-around': {
    summary: 'Confused scan left and right',
    gaze: NONE,
    pose: (t, sit) => ({ ...hands(sit, 0.4), headYaw: Math.sin(t * 2.4) * 0.8, gazeX: Math.sin(t * 2.4 + 0.3) * 0.7, eyeOpen: 1.2 }),
  },
  'phone-look': {
    summary: 'Staring down at the phone in hand',
    gaze: NONE,
    pose: (t, sit) => ({ ...hands(sit, 0.5), armRX: -1.65, armRZ: 0.25, headPitch: 0.42, gazeY: -0.6, y: breathe(t) }),
  },
  'phone-gasp': {
    summary: 'Phone in hand, jolts upright, eyes wide',
    gaze: NONE,
    blend: 0.05,
    pose: (t, sit) => {
      const k = easeOut(t / 0.1);
      return { ...hands(sit, 0.5), armRX: -1.65 - 0.2 * k, armRZ: 0.25, headPitch: 0.42 - 0.2 * k, gazeY: -0.6, pitch: -0.12 * k, eyeOpen: 1 + 0.6 * k };
    },
  },
  walk: {
    summary: 'Walk cycle (used while moving between marks)',
    gaze: HEAD,
    locomotion: true,
    pose: (t) => {
      const s = Math.sin(t * 7.5);
      return { legLX: s * 0.45, legRX: -s * 0.45, armLX: -s * 0.35, armRX: s * 0.35, y: Math.abs(Math.cos(t * 7.5)) * 0.035, pitch: 0.05 };
    },
  },
  storm: {
    summary: 'Fast angry walk (moves)',
    gaze: NONE,
    locomotion: true,
    pose: (t) => {
      const s = Math.sin(t * 10);
      return { legLX: s * 0.6, legRX: -s * 0.6, armLX: -s * 0.5, armRX: s * 0.5, y: Math.abs(Math.cos(t * 10)) * 0.05, pitch: 0.16, headPitch: 0.15, eyeOpen: 0.45 };
    },
  },
  // --- Campaign acting (autumn 2026) ---------------------------------------
  'reach-left': {
    summary: 'Reach forward with the left hand (counter / table height) and hold there',
    gaze: { eyes: 1, head: 0.8, body: 0 },
    blend: 0.12,
    pose: (t) => {
      const k = easeOut(t / 0.35);
      return { armLX: -1.35 * k, armLZ: 0.12 + 0.25 * k, armRX: -0.1, armRZ: -0.12, pitch: 0.14 * k, headPitch: 0.2 * k };
    },
  },
  'reach-right': {
    summary: 'Reach forward with the right hand (counter / table height) and hold there',
    gaze: { eyes: 1, head: 0.8, body: 0 },
    blend: 0.12,
    pose: (t) => {
      const k = easeOut(t / 0.35);
      return { armRX: -1.35 * k, armRZ: -0.12 - 0.25 * k, armLX: -0.1, armLZ: 0.12, pitch: 0.14 * k, headPitch: 0.2 * k };
    },
  },
  'pull-left': {
    summary: 'Left hand drags something toward the body (slow, sneaky)',
    gaze: { eyes: 1, head: 0.6, body: 0 },
    blend: 0.1,
    pose: (t) => {
      const k = smooth(t / 0.7);
      return { armLX: -1.35 + 0.45 * k, armLZ: 0.37 - 0.2 * k, armRX: -0.1, armRZ: -0.12, pitch: 0.14 - 0.08 * k, headPitch: 0.2 - 0.12 * k, eyeOpen: 0.7 };
    },
  },
  'pull-right': {
    summary: 'Right hand drags something toward the body (slow, sneaky)',
    gaze: { eyes: 1, head: 0.6, body: 0 },
    blend: 0.1,
    pose: (t) => {
      const k = smooth(t / 0.7);
      return { armRX: -1.35 + 0.45 * k, armRZ: -0.37 + 0.2 * k, armLX: -0.1, armLZ: 0.12, pitch: 0.14 - 0.08 * k, headPitch: 0.2 - 0.12 * k, eyeOpen: 0.7 };
    },
  },
  knuckles: {
    summary: 'Hands together at the chest, cracks the knuckles (two pops)',
    gaze: HEAD,
    blend: 0.15,
    pose: (t) => {
      const pop = Math.max(0, Math.sin(Math.PI * ramp(t, 0.25, 0.4))) + Math.max(0, Math.sin(Math.PI * ramp(t, 0.55, 0.7)));
      return { armLX: -1.45, armRX: -1.45, armLZ: 0.62, armRZ: -0.62, y: -0.015 * pop, pitch: 0.04 * pop, headPitch: 0.05, eyeOpen: 0.55 };
    },
  },
  'adjust-tie': {
    summary: 'Right hand up to the knot, straightens the tie, chin lifts',
    gaze: HEAD,
    blend: 0.15,
    pose: (t) => {
      const up = smooth(ramp(t, 0, 0.25)) * (1 - smooth(ramp(t, 0.8, 1.1)));
      return { armRX: -0.1 - 1.9 * up, armRZ: -0.12 + 0.62 * up, headPitch: -0.1 * up + Math.sin(t * 14) * 0.02 * up, headRoll: 0.05 * up, eyeOpen: 0.6 };
    },
  },
  'pull-cord': {
    summary: 'Standing: reaches up and pulls a cord down (blinds)',
    gaze: { eyes: 0.8, head: 0.5, body: 0 },
    pose: (t) => {
      const up = smooth(t / 0.25);
      const pull = smooth(ramp(t, 0.25, 0.9));
      return { armRX: -2.6 * up + 1.1 * pull, armRZ: -0.08, headPitch: -0.3 * up + 0.2 * pull };
    },
  },
  place: {
    summary: 'Puts something down in front (both hands forward and low)',
    gaze: { eyes: 1, head: 0.7, body: 0 },
    pose: (t) => {
      const k = Math.sin(Math.PI * ramp(t, 0, 0.9));
      return { armLX: -0.9 * k, armRX: -0.9 * k, pitch: 0.28 * k, headPitch: 0.3 * k };
    },
  },
  fold: {
    summary: 'Folding something at the waist (a scarf), head down',
    gaze: NONE,
    pose: (t) => ({ armLX: -1.0, armRX: -1.0, armLZ: 0.3 + 0.18 * Math.sin(t * 3.2), armRZ: -0.3 - 0.18 * Math.sin(t * 3.2), headPitch: 0.34, pitch: 0.08, y: breathe(t) }),
  },
  'look-up': {
    summary: 'Tilts the head up (at the lights, a sign, the sky)',
    gaze: { eyes: 1, head: 0.4, body: 0 },
    blend: 0.3,
    pose: (t, sit) => ({ ...hands(sit, 0.4), headPitch: -0.42 * smooth(t / 0.5), eyeOpen: 1.15 }),
  },
  'lean-in': {
    summary: 'Leans into the monitor, eyes wide (secretly watching)',
    gaze: { eyes: 1, head: 0.5, body: 0 },
    blend: 0.25,
    pose: (t, sit) => ({ ...hands(sit, 0.95), pitch: 0.22 * smooth(t / 0.4), headPitch: 0.04, eyeOpen: 1.25, y: breathe(t, 0.5) }),
  },
  earbud: {
    summary: 'One hand pressed to an earbud, head tilted, listening hard',
    gaze: { eyes: 0.7, head: 0.3, body: 0 },
    blend: 0.2,
    pose: (t, sit) => ({ ...hands(sit, 0.9), armLX: -2.25, armLZ: -0.62, headRoll: -0.14, headPitch: 0.06, eyeOpen: 0.85 + 0.25 * Math.max(0, Math.sin(t * 2.3)) }),
  },
  'fake-type': {
    summary: 'Suspiciously productive typing (fast, upright, eyes fixed)',
    gaze: { eyes: 0.6, head: 0.1, body: 0 },
    blend: 0.06,
    pose: (t, sit) => ({ y: Math.sin(t * 16) * 0.008, pitch: 0.02, headPitch: 0.02, eyeOpen: 1.3, armLX: -0.98 * sit - 0.22 + Math.sin(t * 30) * 0.09, armRX: -0.98 * sit - 0.22 + Math.sin(t * 30 + 2.1) * 0.09 }),
  },
  exhale: {
    summary: 'Relieved exhale: shoulders rise, then drop and slump a little',
    gaze: NONE,
    blend: 0.2,
    pose: (t, sit) => {
      const inhale = Math.sin(Math.PI * ramp(t, 0, 0.35));
      const out = smooth(ramp(t, 0.35, 0.9));
      return { ...hands(sit, 0.8 - 0.35 * out), y: 0.03 * inhale - 0.04 * out, pitch: -0.05 * inhale + 0.12 * out, headPitch: -0.12 * inhale + 0.18 * out, eyeOpen: 1 - 0.45 * out };
    },
  },
  stroll: {
    summary: 'Slow authority walk, hands clasped behind the back (moves)',
    gaze: HEAD,
    locomotion: true,
    pose: (t) => {
      const s = Math.sin(t * 5.2);
      return { legLX: s * 0.32, legRX: -s * 0.32, armLX: 0.42, armRX: 0.42, armLZ: -0.2, armRZ: 0.2, y: Math.abs(Math.cos(t * 5.2)) * 0.02, pitch: -0.04, headYaw: Math.sin(t * 0.9) * 0.35 };
    },
  },
  'walk-slow': {
    summary: 'Unhurried walk (moves)',
    gaze: HEAD,
    locomotion: true,
    pose: (t) => {
      const s = Math.sin(t * 5.6);
      return { legLX: s * 0.36, legRX: -s * 0.36, armLX: -s * 0.2, armRX: s * 0.2, y: Math.abs(Math.cos(t * 5.6)) * 0.025, pitch: 0.03 };
    },
  },
  fiddle: {
    summary: 'Seated: right hand turning a small cup on its saucer',
    gaze: { eyes: 1, head: 0.7, body: 0 },
    blend: 0.2,
    pose: (t, sit) => ({ ...hands(sit, 0.4), armRX: -1.05 + Math.sin(t * 5) * 0.05, armRZ: -0.02 + Math.cos(t * 5) * 0.07, headPitch: 0.28, pitch: 0.1 }),
  },
  breath: {
    summary: 'One deliberate breath: chest rises, eyes close, settles',
    gaze: HEAD,
    blend: 0.3,
    pose: (t) => {
      const k = Math.sin(Math.PI * ramp(t, 0, 1.4));
      return { y: 0.035 * k, pitch: -0.06 * k, headPitch: -0.1 * k, eyeOpen: 1 - 0.85 * smooth(ramp(t, 0.2, 0.55)) * (1 - smooth(ramp(t, 1.0, 1.3))), armLZ: 0.12 + 0.06 * k, armRZ: -0.12 - 0.06 * k };
    },
  },
  proud: {
    summary: 'Standing tall, chin slightly up, completely still',
    gaze: HEAD,
    blend: 0.4,
    pose: (t) => ({ pitch: -0.04, headPitch: -0.1, y: breathe(t, 0.4), armLZ: 0.08, armRZ: -0.08 }),
  },
  papers: {
    summary: 'Seated anchor squares a stack of papers on the desk',
    gaze: { eyes: 0.6, head: 0.4, body: 0 },
    pose: (t) => {
      const tap = Math.max(0, Math.sin(t * 9)) * (1 - ramp(t, 0.6, 0.8));
      return { armLX: -1.1 + 0.15 * tap, armRX: -1.1 + 0.15 * tap, armLZ: 0.35, armRZ: -0.35, headPitch: 0.22, pitch: 0.05 };
    },
  },
  nervous: {
    summary: 'Uneasy idle: quick blinks, small glances, shallow breathing',
    gaze: HEAD,
    pose: (t, sit) => {
      const b = [0.4, 1.3, 1.7, 2.9].some((x) => t - x >= 0 && t - x < 0.1) ? 0.15 : 1;
      return { ...hands(sit, 0.3), eyeOpen: b, headYaw: Math.sin(t * 1.9) * 0.12, y: Math.sin(t * 4) * 0.01 };
    },
  },
};

export const ACTION_IDS = Object.keys(ACTIONS);

export function getAction(id: string): ActionDef {
  const a = ACTIONS[id];
  if (!a) throw new Error(`Unknown action "${id}"`);
  return a;
}

/** Full pose for an action at seconds `t` in posture `sit` (0..1). */
export function actionPose(id: string, t: number, sit: number): HncBodyPose {
  const base = neutralHncBodyPose();
  const p = getAction(id).pose(Math.max(0, t), sit);
  return { ...base, sit, ...p };
}
