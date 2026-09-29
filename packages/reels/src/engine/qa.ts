/**
 * Framing + motion QA on a compiled Timeline — no browser. Camera, subjects
 * and cast are pure functions of the frame, so every frame can be checked:
 *
 *   framing   primary subject (camera `on`) stays in frame; lens never inside
 *             a body; subject not cropped to a sliver at the frame edge
 *   motion    camera position / aim jumps inside a shot (outside transitions),
 *             subject screen jumps, impossible cast / player speeds
 *   pacing    very short or very long shots
 *
 * The first-generation office reel shipped exactly these bugs (lens inside a
 * torso, empty reaction shot) — this linter catches them before rendering.
 */
import { shotLens } from '../camera/evaluate';
import { projectToScreen } from '../camera/project';
import { getWorld } from '../worlds/registry';
import type { Lens } from '../worlds/types';
import { subjectsAt } from './subjects';
import type { Shot, Timeline } from './timeline/types';

export interface QaIssue {
  level: 'error' | 'warn';
  shot: string;
  frame: number;
  message: string;
}

const angle = (a: Lens, b: Lens): number => {
  const d = (l: Lens) => {
    const x = l.look.x - l.pos.x;
    const y = l.look.y - l.pos.y;
    const z = l.look.z - l.pos.z;
    const n = Math.hypot(x, y, z) || 1;
    return [x / n, y / n, z / n];
  };
  const [p, q] = [d(a), d(b)];
  return Math.acos(Math.min(1, Math.max(-1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2])));
};

function inTransition(shot: Shot, frame: number): boolean {
  return [shot.enter, shot.exit].some((t) => t && t.type !== 'cut' && frame >= t.start - 1 && frame <= t.end);
}

export function qaTimeline(tl: Timeline): QaIssue[] {
  const out: QaIssue[] = [];
  const { width: W, height: H, fps } = tl;
  for (const shot of tl.shots) {
    const world = getWorld(shot.world);
    const secs = shot.duration / fps;
    if (secs < 0.25) out.push({ level: 'warn', shot: shot.id, frame: shot.start, message: `${secs.toFixed(2)}s shot barely registers` });
    if (world.kind !== '3d') continue;
    let prev: Lens | undefined;
    let prevScreen: { x: number; y: number } | undefined;
    let camSteps: number[] = [];
    let warnedEdge = false;
    for (let f = shot.start; f < shot.start + shot.duration; f++) {
      const lens = shotLens(tl, shot, f);
      const subject = subjectsAt(tl, shot, f);
      // Lens inside any body.
      for (const id of [...Object.keys(tl.cast), ...shot.actors.map((a) => a.cast)]) {
        const s = subject(id);
        if (!s || s.kind !== 'actor') continue;
        const d = Math.hypot(lens.pos.x - s.head.x, lens.pos.y - s.head.y, lens.pos.z - s.head.z);
        const body = Math.hypot(lens.pos.x - s.pos.x, lens.pos.z - s.pos.z);
        if (d < 0.42 || (body < 0.5 && lens.pos.y < s.head.y + 0.3)) {
          out.push({ level: 'error', shot: shot.id, frame: f, message: `lens inside "${id}" (${d.toFixed(2)} m from the head)` });
          f = shot.start + shot.duration; // one report per shot
          break;
        }
      }
      // Primary subject framing.
      // Over-shoulder / two-shot frame the far subject; the near one is edge dressing.
      const primaryId = shot.camera.lens === 'over-shoulder' || shot.camera.lens === 'two-shot' ? shot.camera.at : shot.camera.on;
      const on = primaryId ? subject(primaryId) : undefined;
      // An insert frames a DETAIL of its subject (a screen corner): its centre may sit outside.
      if (on && primaryId && shot.camera.lens !== 'insert' && !(shot.camera.move.some((m) => m.startsWith('tilt-')))) {
        const p = projectToScreen(lens, on.head, W, H);
        const mid = f === shot.start + Math.floor(shot.duration / 2);
        if (!p.visible || p.x < -0.05 * W || p.x > 1.05 * W || p.y < -0.05 * H || p.y > 1.05 * H) {
          if (mid) out.push({ level: 'error', shot: shot.id, frame: f, message: `subject "${primaryId}" is out of frame at mid-shot` });
        } else if (!warnedEdge && (p.x < 0.08 * W || p.x > 0.92 * W) && on.kind === 'actor') {
          out.push({ level: 'warn', shot: shot.id, frame: f, message: `subject "${primaryId}" crowds the frame edge` });
          warnedEdge = true;
        }
        if (prevScreen && !inTransition(shot, f) && Math.hypot(p.x - prevScreen.x, p.y - prevScreen.y) > 0.12 * H) {
          out.push({ level: 'warn', shot: shot.id, frame: f, message: `subject "${primaryId}" jumps ${Math.round(Math.hypot(p.x - prevScreen.x, p.y - prevScreen.y))} px in one frame` });
        }
        prevScreen = { x: p.x, y: p.y };
      }
      // Camera continuity.
      if (prev && !inTransition(shot, f)) {
        const step = Math.hypot(lens.pos.x - prev.pos.x, lens.pos.y - prev.pos.y, lens.pos.z - prev.pos.z);
        // A jump is a discontinuity (a step far larger than the last one), not
        // speed: a designed crane can legitimately cover 28 m/s.
        const last = camSteps[camSteps.length - 1] ?? step;
        camSteps.push(step);
        const aim = angle(prev, lens);
        const shaking = shot.fx.some((e) => (e.type === 'impact-shake' || e.type === 'zoom-punch') && f >= e.start && f < e.start + fps / 3);
        if (!shaking && step > 0.3 && step > 4 * Math.max(last, 0.02)) out.push({ level: 'error', shot: shot.id, frame: f, message: `camera jumps ${step.toFixed(2)} m in one frame` });
        if (aim * fps > 6 && !shaking) {
          out.push({ level: 'warn', shot: shot.id, frame: f, message: `camera aim snaps ${((aim * 180) / Math.PI).toFixed(1)}° in one frame` });
        }
      }
      prev = lens;
    }
    // Cast speed (tracks) — impossible walking / sliding.
    for (const track of shot.actors) {
      for (let f = shot.start + 1; f < shot.start + shot.duration; f++) {
        const a = subjectsAt(tl, shot, f - 1)(track.cast);
        const b = subjectsAt(tl, shot, f)(track.cast);
        if (!a || !b) continue;
        const v = Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z) * fps;
        if (v > 6) {
          out.push({ level: 'error', shot: shot.id, frame: f, message: `"${track.cast}" moves at ${v.toFixed(1)} m/s` });
          break;
        }
      }
    }
    // Football cast: elite sprint peaks ~12 m/s.
    if (world.castSubjects) {
      for (const id of Object.keys(tl.cast)) {
        for (let f = shot.start + 1; f < shot.start + shot.duration; f++) {
          const a = subjectsAt(tl, shot, f - 1)(id);
          const b = subjectsAt(tl, shot, f)(id);
          if (!a || !b || a.kind !== 'actor') continue;
          const v = Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z) * fps;
          if (v > 12) {
            out.push({ level: 'warn', shot: shot.id, frame: f, message: `"${id}" runs at ${v.toFixed(1)} m/s (> elite sprint)` });
            break;
          }
        }
      }
    }
    camSteps = [];
  }
  return out;
}
