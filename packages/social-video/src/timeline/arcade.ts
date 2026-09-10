import { lerp, lerpAngleShortest, smoothstep } from './math';

/**
 * Exaggerated arcade-football primitives for social scenes. Everything is a
 * pure function of time/progress — never incremental state — so any frame
 * renders random-access. Scenes own WHEN (beats), this module owns HOW the
 * ball flies and bodies react. Nothing here knows teams, seeds or cameras.
 */

export interface Vec3 { x: number; y: number; z: number }
export interface Vec2 { x: number; z: number }

/** Smooth blend between two points over [t0, t1] (seconds). Pure. */
export function blendPoint(a: Vec2, b: Vec2, t: number, t0: number, t1: number): Vec2 {
  const p = smoothstep((t - t0) / Math.max(1e-6, t1 - t0));
  return { x: lerp(a.x, b.x, p), z: lerp(a.z, b.z, p) };
}

/**
 * Freeze timeline time over [start, start + len) (seconds): returns the
 * effective action time plus whether the frame sits inside the deliberate
 * hold. Composable (apply outermost hold last). Monotonic by construction.
 */
export function applyHold(t: number, start: number, len: number): { te: number; inHold: boolean } {
  if (len <= 0) return { te: t, inHold: false };
  if (t < start) return { te: t, inHold: false };
  if (t < start + len) return { te: start, inHold: true };
  return { te: t - len, inHold: false };
}

/**
 * Semantic time-warp presets for dramatic actions. `preSlow` stretches the
 * run-up (tension), `hold` freezes contact frames (impact emphasis).
 * Applied to a LOCAL action clock by the scene — global beats never shift.
 */
export interface WarpPreset { preSlow: number; hold: number }
export const WARP_PRESETS = {
  /** Real-time: no warp, no hold. */
  normal: { preSlow: 0, hold: 0 },
  /** Slow-breath run-up + 3-frame contact hold at 60fps. */
  dramatic: { preSlow: 0.35, hold: 0.05 },
  /** Extra-hype: longer breath, 4-frame hold at 60fps. */
  hyper: { preSlow: 0.5, hold: 0.07 },
} as const satisfies Record<string, WarpPreset>;

/**
 * Whipped cross: fast, mostly flat ball with lateral bend (swerving around
 * the defence) and a modest apex. `bend` displaces the flight sideways
 * (perpendicular to the line, metres, signed); `apex` lifts it (higher arcs
 * read better in vertical video). `p` is 0..1 progress.
 */
export function whippedCross(from: Vec3, to: Vec3, p: number, apex = 3.2, bend = 2.5): Vec3 {
  const c = Math.min(1, Math.max(0, p));
  const dx = to.x - from.x, dz = to.z - from.z;
  const len = Math.hypot(dx, dz) || 1;
  // Unit perpendicular (screen-left of travel): the swerve axis.
  const px = -dz / len, pz = dx / len;
  const swerve = Math.sin(c * Math.PI) * bend;
  return {
    x: lerp(from.x, to.x, c) + px * swerve,
    y: lerp(from.y, to.y, c) + Math.sin(c * Math.PI) * apex,
    z: lerp(from.z, to.z, c) + pz * swerve,
  };
}

/**
 * Lofted cross: higher symmetric arc between two spots (back-post floater).
 */
export function loftedCross(from: Vec3, to: Vec3, p: number, apex = 4.5): Vec3 {
  const c = Math.min(1, Math.max(0, p));
  return {
    x: lerp(from.x, to.x, c),
    y: lerp(from.y, to.y, c) + Math.sin(c * Math.PI) * apex,
    z: lerp(from.z, to.z, c),
  };
}

/**
 * Power header redirect: short violent flight from the contact point to the
 * target with a slight rise. Reads instantly as a header, not a pass.
 */
export function headerShot(contact: Vec3, target: Vec3, p: number, apex = 0.7): Vec3 {
  const c = Math.min(1, Math.max(0, p));
  return {
    x: lerp(contact.x, target.x, c),
    y: lerp(contact.y, target.y, c) + Math.sin(c * Math.PI) * apex,
    z: lerp(contact.z, target.z, c),
  };
}

/**
 * High rebound after a bar/post/save impact: steep up-back parabola peaking
 * at `apexY`, landing at `land`. `p` is 0..1 across the whole rebound.
 */
export function skyRebound(contact: Vec3, land: Vec3, p: number, apexY: number): Vec3 {
  const c = Math.min(1, Math.max(0, p));
  const topY = Math.max(contact.y, land.y, apexY);
  // Asymmetric parabola: fast rise, hanging fall.
  const y = c < 0.45
    ? lerp(contact.y, topY, smoothstep(c / 0.45))
    : lerp(topY, land.y, (c - 0.45) / 0.55);
  return { x: lerp(contact.x, land.x, c), y, z: lerp(contact.z, land.z, c) };
}

/**
 * Parried ball: short deflection from the save point to a nearby landing
 * spot with a small hop. Pure deterministic arc.
 */
export function parryDeflect(contact: Vec3, land: Vec3, p: number, lift = 0.8): Vec3 {
  const c = Math.min(1, Math.max(0, p));
  return {
    x: lerp(contact.x, land.x, c),
    y: lerp(contact.y, land.y, c) + Math.sin(c * Math.PI) * lift,
    z: lerp(contact.z, land.z, c),
  };
}

/** Parabolic leap height for a jump of `height` metres at progress 0..1. */
export function jumpY(p: number, height: number): number {
  const c = Math.min(1, Math.max(0, p));
  return 4 * height * c * (1 - c);
}

/** Partial pose deltas scenes merge into their actor frames (all additive). */
export interface ArcadePose {
  bob: number;
  lean: number;
  armLift: number;
  armSpread: number;
  legSwing: number;
  roll: number;
  spin: number;
}

const NEUTRAL_POSE: ArcadePose = { bob: 0, lean: 0, armLift: 0, armSpread: 0, legSwing: 0, roll: 0, spin: 0 };

/**
 * Keeper airborne dive pose at progress 0..1 (launch → flight → land).
 * `dirZ` tips the body toward the dive side (world frame); arms spread wide
 * mid-flight, then the body grounds out beaten.
 */
export function keeperDivePose(p: number, dirZ: number, landP = 0): ArcadePose {
  const airP = Math.min(1, Math.max(0, p)) * (1 - landP);
  return {
    ...NEUTRAL_POSE,
    bob: 0.3 * airP + 0.05 * landP,
    lean: -dirZ * (0.9 * airP + 0.4 * landP),
    armSpread: 1.4 * airP + 0.3 * landP,
  };
}

/** Keeper despair kneel (post-goal collapse): sinks and folds. */
export function keeperKneelPose(p: number): ArcadePose {
  const c = smoothstep(p);
  return { ...NEUTRAL_POSE, bob: -0.42 * c, lean: 0.5 * c, armLift: 0.3 * c, armSpread: 0.5 * c };
}

/** Hands-on-head disbelief (conceded / missed sitter). */
export function handsOnHeadPose(p: number): ArcadePose {
  const c = smoothstep(p);
  return { ...NEUTRAL_POSE, bob: -0.12 * c, lean: 0.25 * c, armLift: 2.4 * c, armSpread: 0.5 * c };
}

/** Arms-up celebration V (reads from frontal cameras too). */
export function armsUpPose(p: number, hopHz = 7, hopAmp = 0.5): ArcadePose {
  const c = smoothstep(p);
  return {
    ...NEUTRAL_POSE,
    bob: Math.abs(Math.sin(p * hopHz * Math.PI)) * hopAmp * c,
    armLift: 2.0 * c,
    armSpread: 0.9 * c,
  };
}

/** Diving-header launch pose: full-stretch horizontal effort. */
export function divingHeaderPose(p: number): ArcadePose {
  const c = Math.min(1, Math.max(0, p));
  return {
    ...NEUTRAL_POSE,
    bob: jumpY(c, 0.9),
    lean: 1.1 * Math.sin(c * Math.PI),
    armLift: 0.6 * c,
    armSpread: 1.2 * Math.sin(c * Math.PI),
    legSwing: -0.8 * c,
  };
}

/** Power-header contact pose: neck snap + tucked arms, planted. */
export function powerHeaderPose(p: number): ArcadePose {
  const snap = Math.sin(Math.min(1, Math.max(0, p)) * Math.PI);
  return { ...NEUTRAL_POSE, bob: jumpY(p, 0.55), lean: 0.35 * snap, armLift: -0.4, armSpread: 0.4 };
}

// ---------------------------------------------------------------------------
// Shared staged-actor frame (same visual fields as the attack-goal scene).
// ---------------------------------------------------------------------------

/** One staged hero/background actor at a timeline instant. */
export interface ArcadeActorFrame {
  id: number;
  team: number;
  number: number;
  name: string;
  keeper: boolean;
  x: number;
  z: number;
  facingX: number;
  facingZ: number;
  bob: number;
  lean: number;
  armLift: number;
  legSwing: number;
  armSpread: number;
  roll: number;
  spin: number;
}

/** Normalized facing from `a` toward `b`. */
export function arcadeFacing(a: Vec2, b: Vec2): { facingX: number; facingZ: number } {
  const dx = b.x - a.x, dz = b.z - a.z;
  const len = Math.hypot(dx, dz) || 1;
  return { facingX: dx / len, facingZ: dz / len };
}

/** Base actor with breathing bob, facing a focus point. */
export function arcadeBaseActor(
  id: number, team: number, number: number, name: string, keeper: boolean,
  pos: Vec2, focus: Vec2, phase: number, time: number,
): ArcadeActorFrame {
  const f = arcadeFacing(pos, focus);
  return {
    id, team, number, name, keeper,
    x: pos.x, z: pos.z, facingX: f.facingX, facingZ: f.facingZ,
    bob: Math.sin((time / 1.7) * Math.PI * 2 + phase) * 0.02,
    lean: 0, armLift: 0, legSwing: 0, armSpread: 0, roll: 0, spin: 0,
  };
}

/** Stride oscillation for running actors (chunky retro run cycle). */
export function arcadeStride(time: number, phase: number): number {
  return Math.sin((time / 0.45) * Math.PI * 2 + phase) * 0.55;
}

/** Smooth on/off window: 1 inside [on, off], eased edges. */
export function arcadeMoveWindow(time: number, on: number, off: number, edge = 0.2): number {
  if (time <= on || time >= off) return 0;
  const rise = Math.min(1, (time - on) / edge);
  const fall = Math.min(1, (off - time) / edge);
  return Math.min(rise, fall);
}

/** Merge an arcade pose onto an actor frame (additive, pure). */
export function applyArcadePose(a: ArcadeActorFrame, p: ArcadePose): ArcadeActorFrame {
  return {
    ...a,
    bob: a.bob + p.bob,
    lean: a.lean + p.lean,
    armLift: a.armLift + p.armLift,
    armSpread: a.armSpread + p.armSpread,
    legSwing: a.legSwing + p.legSwing,
    roll: a.roll + p.roll,
    spin: a.spin + p.spin,
  };
}

/**
 * Angle-domain focus blend: rotate the facing from `from` to `to` along the
 * shortest arc over [t0, t1]. Use this (not point lerps) whenever the focus
 * path passes within a metre or two of the observer — e.g. a striker meeting
 * a cross, a receiver taking a touch — where point interpolation whips the
 * facing through 1/r sensitivity. Bearings are measured from the fixed
 * reference position `ref` (typically the actor's position at window start):
 * measuring from the live position reintroduces the same whip as the actor
 * runs over the frozen anchor. The small parallax drift this causes is
 * invisible; the turn itself spreads over the whole window. Pure.
 */
export function angleBlendFocus(
  ref: Vec2, from: Vec2, to: Vec2, t: number, t0: number, t1: number,
): { facingX: number; facingZ: number } {
  const a0 = Math.atan2(from.x - ref.x, from.z - ref.z);
  const a1 = Math.atan2(to.x - ref.x, to.z - ref.z);
  const a = lerpAngleShortest(a0, a1, smoothstep((t - t0) / Math.max(1e-6, t1 - t0)));
  return { facingX: Math.sin(a), facingZ: Math.cos(a) };
}
