/**
 * The shot camera at an absolute frame — ONE function for the 3D rig, the
 * projected 2D layer (trails, pinned text), transitions and QA.
 *
 * lens (generic subject lens | world lens) → `to` blend → moves → impact fx
 * → transition offsets (whip) → format fit (keep the 9:16 horizontal FOV).
 */
import { applyEasing, isEasingId } from '../animation/easing';
import { impactShake, zoomPunch } from '../effects/presets';
import { fitVerticalFov } from '../engine/formats';
import { smoothedSubjectsAt, type SubjectResolver } from '../engine/subjects';
import type { CameraIntent, Shot, Timeline } from '../engine/timeline/types';
import { transitionCamera } from '../transitions/camera';
import { getWorld } from '../worlds/registry';
import type { Lens } from '../worlds/types';
import { GENERIC_LENSES } from './lenses';
import { applyMoves } from './moves';
import { mixLens } from './vec';
import { projectToScreen } from './project';

type TL = Pick<Timeline, 'cast' | 'fps' | 'seed' | 'width' | 'height'>;

function baseLens(tl: TL, shot: Shot, intent: Omit<CameraIntent, 'to'>, frame: number, subject: SubjectResolver): Lens {
  const builder = GENERIC_LENSES[intent.lens];
  const side = intent.side === 'right' ? -1 : 1;
  if (builder) {
    const on = intent.on ? subject(intent.on) : undefined;
    const at = intent.at ? subject(intent.at) : undefined;
    if (intent.on && !on) throw new Error(`Camera subject "${intent.on}" not found in shot ${shot.id}`);
    if (intent.at && !at) throw new Error(`Camera subject "${intent.at}" not found in shot ${shot.id}`);
    return builder({ on, at, side });
  }
  const world = getWorld(shot.world);
  const l = world.lens?.(intent.lens, { shot, frame, fps: tl.fps, subject });
  if (!l) throw new Error(`Unknown lens "${intent.lens}" for world "${shot.world}"`);
  return l;
}

/** Lens before format fit (QA uses it with its own aspect). */
export function shotLensRaw(tl: TL, shot: Shot, frameIn: number): Lens {
  const frame = shot.freeze !== undefined && frameIn >= shot.freeze ? shot.freeze : frameIn;
  const subject = smoothedSubjectsAt(tl, shot, frame);
  const local = frame - shot.start;
  const u = Math.min(1, Math.max(0, local / Math.max(1, shot.duration)));
  const intent = shot.camera;
  let lens = baseLens(tl, shot, intent, frame, subject);
  if (intent.to) {
    const w = applyEasing(isEasingId(intent.ease) ? intent.ease : 'ease-in-out', u);
    lens = mixLens(lens, baseLens(tl, shot, intent.to, frame, subject), w);
  }
  lens = applyMoves(lens, intent.move, {
    u,
    t: Math.max(0, local / tl.fps),
    amount: intent.amount,
    ease: intent.ease,
    seed: tl.seed,
    key: shot.id,
    subject,
  });
  for (const e of shot.fx) {
    const since = frame - e.start;
    if (since < 0 || frame >= e.end) continue;
    if (e.type === 'impact-shake') {
      const s = impactShake(since, tl.fps, e.intensity, tl.seed);
      lens = { ...lens, pos: { x: lens.pos.x + s.x, y: lens.pos.y + s.y, z: lens.pos.z + s.z }, look: { x: lens.look.x + s.x, y: lens.look.y + s.y, z: lens.look.z + s.z } };
    } else if (e.type === 'zoom-punch') {
      lens = { ...lens, fov: lens.fov + zoomPunch(since, tl.fps, e.intensity) };
    }
  }
  return transitionCamera(lens, shot, frameIn);
}

/**
 * Format fit. Lenses are composed for 9:16; a plain centre crop to 4:5 / 1:1
 * slices heads. Keep the horizontal FOV (crop) and re-aim vertically: with a
 * primary actor, their head lands at ~40% from the top of the crop; otherwise
 * the window slides up by the 9:16 eye-line rule. Lenses stacking two
 * subjects vertically (macro with an owner behind) keep more of their height.
 */
export function shotLens(tl: TL, shot: Shot, frame: number): Lens {
  const l = shotLensRaw(tl, shot, frame);
  const aspect = tl.width / tl.height;
  if (aspect <= 9 / 16 + 1e-6) return l;
  const cropFov = fitVerticalFov(l.fov, aspect);
  const tall = shot.camera.lens === 'macro' && !!shot.camera.at;
  const fov = tall ? cropFov + (l.fov - cropFov) * 0.6 : cropFov;
  const dist = Math.hypot(l.look.x - l.pos.x, l.look.y - l.pos.y, l.look.z - l.pos.z);
  const frameH = 2 * dist * Math.tan((fov * Math.PI) / 360);
  const primary = shot.camera.lens === 'over-shoulder' || shot.camera.lens === 'two-shot' ? shot.camera.at : shot.camera.on;
  const s = primary && !tall ? smoothedSubjectsAt(tl, shot, shot.freeze !== undefined && frame >= shot.freeze ? shot.freeze : frame)(primary) : undefined;
  let raise: number;
  if (s?.kind === 'actor') {
    const p = projectToScreen({ ...l, fov }, s.head, tl.width, tl.height);
    // Aiming up moves the picture down: bring the head centre to 40% of the crop.
    raise = p.visible ? Math.max(-0.25, Math.min(0.35, 0.4 - p.y / tl.height)) * frameH : 0;
  } else {
    const k = Math.tan((fov * Math.PI) / 360) / Math.tan((l.fov * Math.PI) / 360);
    raise = dist * Math.tan((l.fov * Math.PI) / 360) * 2 * 0.15 * (1 - k);
  }
  return { pos: l.pos, look: { x: l.look.x, y: l.look.y + raise, z: l.look.z }, fov };
}
