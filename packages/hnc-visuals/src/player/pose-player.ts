import type { HncPlayerVisual } from './types.ts';

/**
 * Canonical HNC pose behaviour.
 *
 * Game poses are extracted verbatim from GameRenderer.render() + celebrate()
 * (run swing, kick snap, tackle lean, slide, fallen, dive, 3 celebration
 * moves). Office poses extend the same channels (bob / lean / armLift /
 * legSwing / armSpread / roll / spin / headYaw / sit) and stay deterministic
 * from absolute localTime — no accumulated state, no wall clock.
 */

export interface HncPoseChannels {
  bob: number;
  lean: number;
  armLift: number;
  headYaw: number;
  legSwing: number;
  armSpread: number;
  roll: number;
  spin: number;
  /** Extra root Y for jumps / knee-slides. */
  lift: number;
  /** Root pitch override (slide / fallen). Null = leave to caller. */
  pitch: number | null;
  /** Root roll override (dive / tackle). Null = leave to caller. */
  tilt: number | null;
}

export function neutralHncPose(): HncPoseChannels {
  return {
    bob: 0,
    lean: 0,
    armLift: 0,
    headYaw: 0,
    legSwing: 0,
    armSpread: 0,
    roll: 0,
    spin: 0,
    lift: 0,
    pitch: null,
    tilt: null,
  };
}

/** Game celebration move per player: 0 jump, 1 spin, 2 lean-back (keepers jump). */
export function hncCelebrationMove(playerIndex: number, keeper: boolean): 0 | 1 | 2 {
  return keeper ? 0 : ((playerIndex % 3) as 0 | 1 | 2);
}

/**
 * Game locomotion pose: run swing from speed + clock.
 * Verbatim: swing = run ? sin(clock*(8+speed*1.5)+i) * min(.85,.22+speed*.12) : 0
 */
export function hncGameLocomotion(clock: number, index: number, speed: number, action: string): HncPoseChannels {
  const pose = neutralHncPose();
  const run = action === 'run' || speed > 1;
  const swing = run
    ? Math.sin(clock * (8 + speed * 1.5) + index) * Math.min(0.85, 0.22 + speed * 0.12)
    : 0;
  pose.legSwing = swing;
  return pose;
}

/**
 * Game action overlay: kick / tackle / slide / fallen / dive.
 * Verbatim from the render loop. Returns root/limb overrides; the caller
 * applies them after locomotion (same order as the game).
 */
export function hncGameAction(
  action: 'idle' | 'run' | 'kick' | 'tackle' | 'dive' | 'slide' | 'fallen',
  actionTime: number,
  facingX = 0,
  facingZ = 1,
): { kickSnap: number; tackleTilt: number; slide: boolean; fallen: boolean; dive: boolean } {
  return {
    kickSnap: action === 'kick' ? -1.35 * Math.min(1, actionTime * 9) : 0,
    tackleTilt: action === 'tackle' ? 0.32 * Math.sin(Math.min(1, actionTime * 5)) : 0,
    slide: action === 'slide',
    fallen: action === 'fallen',
    dive: action === 'dive',
  };
}

/** Game celebration offsets (jump height / spin / lean-back), verbatim. */
export function hncGameCelebration(
  clock: number,
  index: number,
  keeper: boolean,
): { lift: number; pitch: number; armLiftL: number; armLiftR: number; spreadL: number; spreadR: number; spin: number } {
  const move = hncCelebrationMove(index, keeper);
  if (move === 0) {
    return {
      lift: Math.abs(Math.sin(clock * 7 + index * 1.3)) * 0.75,
      pitch: 0,
      armLiftL: -2.5,
      armLiftR: -2.5,
      spreadL: 0,
      spreadR: 0,
      spin: 0,
    };
  }
  if (move === 1) {
    return {
      lift: 0,
      pitch: 0,
      armLiftL: 0,
      armLiftR: 0,
      spreadL: 1.5,
      spreadR: -1.5,
      spin: (clock * 4.5 + index) % (Math.PI * 2),
    };
  }
  return {
    lift: Math.abs(Math.sin(clock * 5 + index)) * 0.18,
    pitch: -0.45,
    armLiftL: -2.2,
    armLiftR: -2.2,
    spreadL: 0,
    spreadR: 0,
    spin: 0,
  };
}

/**
 * Apply the full game pose to a canonical visual (used by BOTH the live
 * renderer and the Reel adapter). Mirrors the render-loop order:
 * locomotion → kick/tackle/slide/fallen/dive → celebration.
 */
export function applyHncGamePose(
  visual: HncPlayerVisual,
  args: {
    clock: number;
    index: number;
    speed: number;
    action: 'idle' | 'run' | 'kick' | 'tackle' | 'dive' | 'slide' | 'fallen';
    actionTime: number;
    facingX: number;
    facingZ: number;
    celebrating: boolean;
  },
): void {
  const { clock, index, speed, action, actionTime, facingX, facingZ, celebrating } = args;
  const loco = hncGameLocomotion(clock, index, speed, action);
  visual.legL.rotation.x = loco.legSwing;
  visual.legR.rotation.x = -loco.legSwing;
  visual.armL.rotation.x = -loco.legSwing * 0.72;
  visual.armR.rotation.x = loco.legSwing * 0.72;
  visual.armL.rotation.z = 0;
  visual.armR.rotation.z = 0;
  visual.root.rotation.set(0, Math.atan2(facingX, facingZ), 0);
  visual.root.position.y = 0;

  if (action === 'kick') visual.legR.rotation.x = -1.35 * Math.min(1, actionTime * 9);
  if (action === 'tackle') visual.root.rotation.z = 0.32 * Math.sin(Math.min(1, actionTime * 5));
  if (action === 'slide') {
    visual.root.rotation.x = -0.95 * Math.min(1, actionTime * 4.5);
    visual.root.position.y = 0.13;
    visual.legR.rotation.x = -1.25;
    visual.legL.rotation.x = -0.4;
    visual.armL.rotation.x = 0.9;
    visual.armR.rotation.x = -0.9;
  }
  if (action === 'fallen') {
    const rise = 1 - Math.min(1, actionTime / 0.75);
    visual.root.rotation.x = -1.4 * (1 - rise * rise);
    visual.root.position.y = 0.09 * (1 - rise);
    visual.legL.rotation.x = visual.legR.rotation.x = visual.armL.rotation.x = visual.armR.rotation.x = -0.25;
  }
  if (action === 'dive') {
    visual.root.rotation.z = facingZ * 0.95;
    visual.root.rotation.x = -facingX * 0.55;
    visual.root.position.y = 0.26;
  } else if (action !== 'slide' && action !== 'fallen') {
    visual.root.position.y = 0;
  }

  if (celebrating) {
    const c = hncGameCelebration(clock, index, visual.keeper);
    visual.legL.rotation.x = 0;
    visual.legR.rotation.x = 0;
    if (c.spin !== 0) visual.root.rotation.y += c.spin;
    else visual.root.rotation.x = c.pitch;
    visual.root.position.y = c.lift;
    if (c.spreadL !== 0 || c.spreadR !== 0) {
      visual.armL.rotation.x = 0;
      visual.armR.rotation.x = 0;
      visual.armL.rotation.z = c.spreadL;
      visual.armR.rotation.z = c.spreadR;
    } else {
      visual.armL.rotation.x = c.armLiftL;
      visual.armR.rotation.x = c.armLiftR;
    }
  }
}

/**
 * Social / timeline micro-pose (renderSocial parity): final values only.
 * Mirrors GameRenderer.renderSocial() exactly.
 */
export interface HncSocialPose {
  bob: number;
  lean: number;
  armLift: number;
  legSwing?: number;
  armSpread?: number;
  roll?: number;
  spin?: number;
}

export function applyHncSocialPose(
  visual: HncPlayerVisual,
  x: number,
  z: number,
  facingX: number,
  facingZ: number,
  pose: HncSocialPose,
): void {
  const swing = pose.legSwing ?? 0;
  const spread = pose.armSpread ?? 0;
  visual.root.position.set(x, pose.bob, z);
  visual.root.rotation.set(-pose.lean, Math.atan2(facingX, facingZ) + (pose.spin ?? 0), pose.roll ?? 0);
  visual.legL.rotation.x = swing;
  visual.legR.rotation.x = -swing;
  visual.armL.rotation.x = -pose.armLift - swing * 0.5;
  visual.armR.rotation.x = -pose.armLift + swing * 0.5;
  visual.armL.rotation.z = spread;
  visual.armR.rotation.z = -spread;
  visual.shadow.position.set(x, 0.015, z);
  visual.shadow.scale.setScalar(1);
}

// ---------------------------------------------------------------------------
// Deterministic procedural poses for Reels (game-compatible HNC language).
// All functions of absolute localTime — no accumulated state.
// ---------------------------------------------------------------------------

export type HncAnimationId =
  | 'idle'
  | 'typing'
  | 'sitting-idle'
  | 'stand'
  | 'stand-up'
  | 'walk'
  | 'run'
  | 'dribble'
  | 'kick'
  | 'tackle'
  | 'goal-celebration'
  | 'celebrate'
  | 'side-eye'
  | 'angry'
  | 'point'
  | 'facepalm'
  | 'shrug'
  | 'office-idle'
  | 'sitting'
  | 'typing-loop'
  | 'pointing'
  | 'smug-celebrate'
  | 'coffee-drink'
  | 'stand-up-office';

/** Backwards-compatible channel shape used by the old reels proceduralPose. */
export interface HncProceduralPose {
  bob: number;
  lean: number;
  armLift: number;
  headYaw: number;
  legSwing: number;
  armSpread: number;
}

/**
 * Deterministic HNC procedural pose. Game-adjacent ids (run/kick/celebrate)
 * reuse game swing amplitudes; office ids extend the same chunky language
 * (lean/bob/armLift/headYaw only — proportions never change).
 */
export function hncProceduralPose(animationId: string, localTime: number): HncProceduralPose {
  const t = localTime;
  const base = { legSwing: 0, armSpread: 0.12 };
  switch (animationId) {
    case 'typing':
    case 'typing-loop':
      return { bob: Math.sin(t * 9) * 0.015, lean: 0.12, armLift: 0.9 + Math.sin(t * 9) * 0.06, headYaw: 0, ...base };
    case 'sitting':
    case 'sitting-idle':
      return { bob: Math.sin(t * 2.0) * 0.012, lean: 0.1, armLift: 0.55, headYaw: 0, ...base };
    case 'office-idle':
      return { bob: Math.sin(t * 2.2) * 0.02, lean: 0.03, armLift: 0.1, headYaw: 0, ...base };
    case 'stand-up':
    case 'stand-up-office': {
      const k = Math.min(1, t / 0.8);
      return { bob: k * 0.25, lean: 0.18 * (1 - k), armLift: 0.15, headYaw: 0, ...base };
    }
    case 'celebrate':
    case 'smug-celebrate':
    case 'goal-celebration': {
      const k = Math.min(1, t / 0.5);
      return {
        bob: Math.abs(Math.sin(t * 8)) * 0.12 * k,
        lean: -0.08,
        armLift: 2.4 * k,
        headYaw: 0,
        legSwing: 0,
        armSpread: 0.9,
      };
    }
    case 'side-eye': {
      const k = Math.min(1, t / 0.7);
      return { bob: 0, lean: 0.06 * k, armLift: 0.1, headYaw: 0.65 * k, ...base };
    }
    case 'angry':
      return { bob: Math.sin(t * 12) * 0.02, lean: 0.22, armLift: 0.5, headYaw: 0.15, ...base };
    case 'point':
    case 'pointing':
      return { bob: 0, lean: 0.1, armLift: 1.4, headYaw: 0.2, ...base };
    case 'facepalm':
      return { bob: -0.03, lean: 0.18, armLift: 2.2, headYaw: -0.3, ...base };
    case 'shrug':
      return { bob: Math.sin(Math.min(1, t / 0.8) * Math.PI) * 0.04, lean: -0.05, armLift: 0.7, headYaw: 0, legSwing: 0, armSpread: 0.55 };
    case 'coffee-drink': {
      const k = Math.sin(Math.min(1, t / 1.2) * Math.PI);
      return { bob: 0, lean: -0.06 * k, armLift: 1.1 * k + 0.1, headYaw: -0.1 * k, ...base };
    }
    case 'run':
    case 'dribble':
      return { bob: Math.abs(Math.sin(t * 10)) * 0.05, lean: 0.12, armLift: 0.3, headYaw: 0, legSwing: Math.sin(t * 10) * 0.6, armSpread: 0.12 };
    case 'walk':
      return { bob: Math.abs(Math.sin(t * 7)) * 0.03, lean: 0.06, armLift: 0.2, headYaw: 0, legSwing: Math.sin(t * 7) * 0.35, armSpread: 0.12 };
    case 'kick': {
      const k = Math.sin(Math.min(1, t / 0.6) * Math.PI);
      return { bob: 0.05 * k, lean: 0.15 * k, armLift: 0.4, headYaw: 0, legSwing: -0.9 * k, armSpread: 0.12 };
    }
    case 'tackle': {
      const k = Math.sin(Math.min(1, t / 0.7) * Math.PI);
      return { bob: 0, lean: 0.1 * k, armLift: 0.5, headYaw: 0, legSwing: 0.5 * k, armSpread: 0.3 };
    }
    case 'stand':
      return { bob: Math.sin(t * 2.2) * 0.015, lean: 0.02, armLift: 0.08, headYaw: 0, ...base };
    case 'idle':
    default:
      return { bob: Math.sin(t * 2.2) * 0.02, lean: 0.02, armLift: 0.08, headYaw: 0, ...base };
  }
}

/**
 * Apply a procedural (reel) pose to a canonical visual. Deterministic from
 * absolute localTime via hncProceduralPose(). Head yaw drives the head mesh;
 * sitting lowers the root to chair height.
 */
export function applyHncProceduralPose(visual: HncPlayerVisual, animationId: string, localTime: number): void {
  const pose = hncProceduralPose(animationId, localTime);
  const sitting = animationId === 'sitting' || animationId === 'sitting-idle' || animationId === 'typing' || animationId === 'typing-loop';
  visual.root.position.y = pose.bob + (sitting ? -0.35 : 0);
  visual.root.rotation.set(pose.lean, 0, 0);
  const swing = pose.legSwing;
  if (animationId === 'run' || animationId === 'dribble' || animationId === 'walk') {
    visual.legL.rotation.x = swing;
    visual.legR.rotation.x = -swing;
    visual.armL.rotation.x = -pose.armLift - swing * 0.5;
    visual.armR.rotation.x = -pose.armLift + swing * 0.5;
  } else if (animationId === 'kick') {
    visual.legR.rotation.x = swing;
    visual.armL.rotation.x = -pose.armLift;
    visual.armR.rotation.x = -pose.armLift;
  } else {
    visual.legL.rotation.x = 0;
    visual.legR.rotation.x = 0;
    visual.armL.rotation.x = -pose.armLift;
    visual.armR.rotation.x = -pose.armLift;
    visual.armL.rotation.z = pose.armSpread;
    visual.armR.rotation.z = -pose.armSpread;
  }
  visual.head.rotation.y = pose.headYaw;
}
