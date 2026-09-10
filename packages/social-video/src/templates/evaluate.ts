import type { SocialLens } from '../cameras/social-camera';
import { parseFrameIndex } from '../schema';
import { evaluateAttackGoalFrame, type AttackGoalFrameDescription } from '../scenes/attack-goal';
import { evaluateFaceoffFrame } from '../scenes/faceoff';
import { evaluateOverlayFrame } from '../overlays/evaluate';
import type { OverlayFrameDescription } from '../overlays/types';
import { lerp, segmentProgress } from '../timeline/math';
import { sceneFrameToRenderInput, type SceneFrameDescription, type SocialRenderInput } from '../timeline';
import type { CompiledSegment, CompiledTemplate } from './types';

/**
 * Template frame evaluation: global frame → active segment → scene-local
 * frame → existing scene evaluators. Random-access and deterministic; each
 * scene keeps believing its own local clock (`localTime = globalTime -
 * segment.start`), so no scene timing is rewritten.
 */

export interface TemplateFrameResult {
  input: SocialRenderInput;
  overlays: OverlayFrameDescription;
}

/**
 * Active segment for a global time. Segments use [start, end) semantics;
 * the last segment also covers the exact timeline endpoint.
 */
export function segmentAtTime(tpl: CompiledTemplate, time: number): CompiledSegment {
  let active = tpl.segments[tpl.segments.length - 1];
  for (const seg of tpl.segments) {
    if (time >= seg.start) active = seg;
    else break;
  }
  return active;
}

/**
 * Scene-local frame for a global frame. Segment starts sit on exact frames
 * at the default rate, so Math.round recovers the bit-exact local integer;
 * other rates round to the nearest local frame (deterministic, ≤½ frame).
 */
export function templateLocalFrame(tpl: CompiledTemplate, seg: CompiledSegment, frame: number): number {
  const t = frame / tpl.fps;
  const base = seg.kind === 'outro' ? seg.localDuration : 0;
  return Math.round((base + t - seg.start) * tpl.fps);
}

/**
 * Outro continuation: the attack timeline keeps running past its 6s end
 * (celebration stays alive via time-driven breathing/crowd motion) while
 * the camera eases into a slow push. Pure function of outro-local time.
 */
function applyOutroPush(
  desc: AttackGoalFrameDescription,
  outroLocal: number,
  outroDuration: number,
): AttackGoalFrameDescription {
  const p = segmentProgress(outroLocal, 0, outroDuration);
  const cam: SocialLens = desc.camera;
  const pull = p * 0.12;
  return {
    ...desc,
    camera: {
      pos: {
        x: lerp(cam.pos.x, cam.look.x, pull),
        y: lerp(cam.pos.y, cam.look.y, pull),
        z: lerp(cam.pos.z, cam.look.z, pull),
      },
      look: { ...cam.look },
      fov: cam.fov - p * 2,
    },
  };
}

function evaluateSegmentScene(
  tpl: CompiledTemplate,
  seg: CompiledSegment,
  localFrame: number,
): SceneFrameDescription {
  if (seg.scene === 'attack-goal') {
    if (!seg.video.attackGoal) throw new Error('Missing attack-goal staging');
    return evaluateAttackGoalFrame({
      data: seg.video.attackGoal,
      home: tpl.home,
      away: tpl.away,
      seed: tpl.seed,
      frame: localFrame,
      fps: tpl.fps,
      duration: seg.localDuration,
    });
  }
  return evaluateFaceoffFrame({
    data: seg.video.faceoff,
    home: tpl.home,
    away: tpl.away,
    frame: localFrame,
    fps: tpl.fps,
    duration: seg.localDuration,
  });
}

/**
 * Evaluate one global template frame. Pure random-access function of
 * (compiled, frame): the outro boundary is continuous by construction
 * (outro local 6.0 === attack end state, push factor 0), the scene cut is a
 * deliberate hard broadcast cut.
 */
export function evaluateTemplateFrame(tpl: CompiledTemplate, frame: number): TemplateFrameResult {
  parseFrameIndex(frame, tpl.totalFrames, tpl.fps, tpl.duration);
  const seg = segmentAtTime(tpl, frame / tpl.fps);
  const localFrame = templateLocalFrame(tpl, seg, frame);
  let desc = evaluateSegmentScene(tpl, seg, localFrame);
  if (seg.kind === 'outro' && desc.scene === 'attack-goal') {
    desc = applyOutroPush(desc, frame / tpl.fps - seg.start, seg.duration);
  }
  return {
    input: sceneFrameToRenderInput(seg.video, desc),
    overlays: evaluateOverlayFrame(tpl.overlayPlan, frame, tpl.fps),
  };
}
