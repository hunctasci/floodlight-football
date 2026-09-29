import { HNC_REEL_TO_SOCIAL, hncPresetLens, type HncLens } from '@floodlight/hnc-visuals';
import { evaluateCamera, type CameraPose } from './registry';
import { DEFAULT_LENS_ANCHORS, cameraMoveLag, evaluateCameraMove, isCameraMoveId, type LensAnchors } from './moves';
import { impactShake, zoomPunch } from '../effects/presets';
import { sampleShotChoreo, sampleShotChoreoAt, shotMomentTime } from '../reel/shot-clock';
import type { ChoreoFrame } from '../football/adapter/choreography';
import type { ShotSpec } from '../reel/types';

const toPose = (l: HncLens): CameraPose => ({
  pos: [l.pos.x, l.pos.y, l.pos.z],
  look: [l.look.x, l.look.y, l.look.z],
  fov: l.fov,
});

function anchorsFrom(c: ChoreoFrame | undefined): LensAnchors {
  if (!c) return DEFAULT_LENS_ANCHORS;
  const ground = { x: c.ball.x, z: c.ball.z };
  return {
    ball: c.ball,
    hero: c.anchors?.hero ?? ground,
    rival: c.anchors?.rival ?? ground,
    keeper: c.anchors?.keeper ?? DEFAULT_LENS_ANCHORS.keeper,
  };
}

/** Legacy follow rule: football-family presets track the live ball. */
function legacyFollows(shot: ShotSpec): boolean {
  const c = shot.camera;
  return (
    !!shot.footballMoment &&
    (c === undefined || c.includes('football') || c.includes('ball') || c.includes('keeper') || c.includes('celebration') || c.includes('reaction'))
  );
}

/**
 * Deterministic shot camera at an absolute frame. Single source for BOTH the
 * 3D rig and 2D overlays that project world points (trails, bursts), so they
 * never drift apart.
 */
export function shotCameraPose(shot: ShotSpec, frame: number, fps: number, seed: number): CameraPose {
  const local = frame - shot.startFrame;
  const id = shot.camera ?? 'graphics-static';
  let pose: CameraPose;
  if (isCameraMoveId(id)) {
    // Anchored move: anchors sampled `lag` seconds behind the action.
    const { time } = shotMomentTime(shot, frame, fps);
    const choreo = sampleShotChoreoAt(shot, time - cameraMoveLag(id), fps);
    pose = toPose(evaluateCameraMove(id, local / Math.max(1, shot.durationInFrames), anchorsFrom(choreo)));
  } else {
    // Legacy path (unchanged): proven social lens at the live ball, except
    // football-faceoff which keeps its Catmull-Rom dolly.
    const follow = legacyFollows(shot) ? sampleShotChoreo(shot, frame, fps)?.ball : undefined;
    if (follow && id !== 'football-faceoff' && HNC_REEL_TO_SOCIAL[id]) {
      pose = toPose(hncPresetLens(HNC_REEL_TO_SOCIAL[id], { ball: follow }));
    } else {
      pose = evaluateCamera(id, Math.max(0, local), Math.max(1, shot.durationInFrames));
    }
  }
  return applyCameraEffects(pose, shot, local, fps, seed);
}

/** Camera-space impact effects: decaying shake + zoom punch. */
function applyCameraEffects(pose: CameraPose, shot: ShotSpec, local: number, fps: number, seed: number): CameraPose {
  let { pos, look, fov } = pose;
  for (const e of shot.effects ?? []) {
    const since = local - (e.startFrame ?? 0);
    if (since < 0 || since >= (e.durationInFrames ?? shot.durationInFrames)) continue;
    if (e.type === 'impact-shake') {
      const s = impactShake(since, fps, e.intensity ?? 1, seed);
      pos = [pos[0] + s.x, pos[1] + s.y, pos[2] + s.z];
      look = [look[0] + s.x, look[1] + s.y, look[2] + s.z];
    } else if (e.type === 'zoom-punch') {
      fov += zoomPunch(since, fps, e.intensity ?? 1);
    }
  }
  return { pos, look, fov };
}
