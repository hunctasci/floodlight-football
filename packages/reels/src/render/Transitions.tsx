import React from 'react';
import { applyEasing } from '../animation/easing';
import { projectToScreen } from '../camera/project';
import { shotLens } from '../camera/evaluate';
import type { Shot, Timeline, TransitionEvent } from '../engine/timeline/types';
import { CloudPuff } from '../transitions/cloud-puff';
import { transitionProgress } from '../transitions/registry';
import { random01 } from '../utils/rng';
import { getWorld } from '../worlds/registry';
import { useLayout } from './layout';

type Rect = { x: number; y: number; w: number; h: number };

/** Cloud-puff coverage: full by 45%, hold to 65%, dissipate (cut at 50%). */
function cloudCoverage(t: number): number {
  if (t < 0.45) return applyEasing('ease-out', t / 0.45);
  if (t < 0.65) return 1;
  return 1 - applyEasing('ease-in', (t - 0.65) / 0.35);
}

/** Screen rect of a surface in a shot at a frame (2D rect or projected 3D quad bounds). */
export function surfaceRect(tl: Timeline, shot: Shot, id: string, frame: number, width: number, height: number): Rect | undefined {
  const world = getWorld(shot.world);
  if (world.kind === '2d') return world.surfaceRect?.(id, shot, frame, height);
  const s = world.surfaces[id];
  if (!s) return undefined;
  const lens = shotLens(tl, shot, frame);
  const cx = Math.cos(s.yaw);
  const sx = Math.sin(s.yaw);
  const corners = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([u, v]) => projectToScreen(lens, { x: s.center.x + (cx * u * s.width) / 2, y: s.center.y + (v * s.height) / 2, z: s.center.z - (sx * u * s.width) / 2 }, width, height));
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

/**
 * Zoom-through geometry at progress e: the outgoing layer scales uniformly
 * about the surface until the surface COVERS the frame; the surface's growing
 * screen rect is where the incoming shot shows.
 */
function zoomRect(r: Rect, e: number, width: number, height: number): { s: number; tx: number; ty: number; rect: Rect } {
  const sEnd = Math.max(width / r.w, height / r.h);
  const s = 1 + (sEnd - 1) * e;
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const tx = (width / 2 - cx) * e;
  const ty = (height / 2 - cy) * e;
  const w = r.w * s;
  const h = r.h * s;
  return { s, tx, ty, rect: { x: cx + tx - w / 2, y: cy + ty - h / 2, w, h } };
}

export interface LayerStyle {
  /** Screen-space wrapper (clipping). */
  outer: React.CSSProperties;
  /** Transformed content. */
  inner: React.CSSProperties;
}

/**
 * CSS for a shot layer inside an overlapping transition (zoom-through, wipe)
 * and the whip-pan motion blur.
 */
export function layerStyle(tl: Timeline, shot: Shot, prev: Shot | undefined, frame: number, width: number, height: number): LayerStyle {
  const outer: React.CSSProperties = {};
  const inner: React.CSSProperties = {};
  const ex = shot.exit;
  const en = shot.enter;
  const whip = [ex, en].find((e) => e?.type === 'whip-pan' && frame >= e.start && frame < e.end);
  if (whip) {
    const k = 1 - Math.abs(frame - whip.cut + 0.5) / ((whip.end - whip.start) / 2);
    inner.filter = `blur(${Math.max(0, k) * 26}px)`;
  }
  if (ex?.type === 'zoom-through' && frame >= ex.start) {
    const r = surfaceRect(tl, shot, ex.from ?? 'screen', ex.cut - 1, width, height);
    if (r) {
      const z = zoomRect(r, applyEasing('ease-in', transitionProgress(frame, ex.start, ex.end)), width, height);
      inner.transformOrigin = `${r.x + r.w / 2}px ${r.y + r.h / 2}px`;
      inner.transform = `translate(${z.tx}px, ${z.ty}px) scale(${z.s})`;
    }
  }
  if (en?.type === 'zoom-through' && prev && frame < en.end) {
    const r = surfaceRect(tl, prev, en.from ?? 'screen', en.cut - 1, width, height);
    if (r) {
      const e = applyEasing('ease-in', transitionProgress(frame, en.start, en.end));
      const { rect } = zoomRect(r, e, width, height);
      // Incoming picture covers the growing rect at its own aspect, ending at identity.
      const k0 = Math.max(r.w / width, r.h / height);
      const k = k0 + (1 - k0) * e;
      const cx = rect.x + rect.w / 2;
      const cy = rect.y + rect.h / 2;
      inner.transformOrigin = '0 0';
      inner.transform = `translate(${cx - (width * k) / 2}px, ${cy - (height * k) / 2}px) scale(${k})`;
      const top = Math.max(0, rect.y);
      const left = Math.max(0, rect.x);
      const bottom = Math.max(0, height - (rect.y + rect.h));
      const right = Math.max(0, width - (rect.x + rect.w));
      outer.clipPath = `inset(${top}px ${right}px ${bottom}px ${left}px round ${Math.round(40 * (1 - e))}px)`;
      outer.opacity = Math.min(1, 0.35 + 2.2 * transitionProgress(frame, en.start, en.end));
    }
  }
  if (en?.type === 'wipe' && frame < en.end) {
    const edge = wipeEdge(en, frame, width);
    outer.clipPath = en.direction === 'right' ? `inset(0 0 0 ${width - edge}px)` : `inset(0 ${width - edge}px 0 0)`;
  }
  return { outer, inner };
}

function wipeEdge(ev: TransitionEvent, frame: number, width: number): number {
  const p = applyEasing('ease-in-out', transitionProgress(frame, ev.start, ev.end));
  return -width * 0.25 + p * width * 1.5;
}

/** Full-frame transition overlay above both shots. */
export const TransitionOverlay: React.FC<{ tl: Timeline; ev: TransitionEvent; out: Shot; into: Shot; frame: number }> = ({ tl, ev, out, into, frame }) => {
  const { width, height } = useLayout();
  if (frame < ev.start || frame >= ev.end) return null;
  const p = transitionProgress(frame, ev.start, ev.end);
  const half = Math.max(1, (ev.end - ev.start) / 2);
  const peak = Math.max(0, 1 - Math.abs(frame - ev.cut + 0.5) / half);
  switch (ev.type) {
    case 'flash':
      return <div style={{ position: 'absolute', inset: 0, background: '#fffbef', opacity: Math.pow(peak, 1.4) }} />;
    case 'dip':
      return <div style={{ position: 'absolute', inset: 0, background: '#03060c', opacity: Math.pow(peak, 0.8) }} />;
    case 'light-bloom': {
      // Blow out from the outgoing light, resolve from the incoming one.
      const before = frame < ev.cut;
      const shot = before ? out : into;
      const light = before ? ev.from : ev.to;
      const e = before ? applyEasing('ease-in', transitionProgress(frame, ev.start, ev.cut)) : 1 - applyEasing('ease-out', transitionProgress(frame, ev.cut, ev.end));
      const src = light ? getWorld(shot.world).lights[light] : undefined;
      const q = src ? projectToScreen(shotLens(tl, shot, frame), src, width, height) : { x: width / 2, y: height * 0.3, visible: true, distance: 1 };
      const x = Math.min(width * 1.2, Math.max(-width * 0.2, q.x));
      const y = Math.min(height * 1.2, Math.max(-height * 0.2, q.y));
      const r = (0.12 + 1.5 * e) * Math.hypot(width, height);
      return (
        <>
          <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at ${x}px ${y}px, rgba(255,252,238,${0.35 + 0.65 * e}) 0px, rgba(255,246,214,${0.55 * e}) ${r * 0.35}px, rgba(255,240,200,0) ${r}px)`, mixBlendMode: 'screen' }} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: y - 10, height: 20, background: `linear-gradient(90deg, rgba(255,245,210,0), rgba(255,248,225,${0.8 * e}), rgba(255,245,210,0))`, filter: 'blur(6px)' }} />
          <div style={{ position: 'absolute', inset: 0, background: '#fffcf0', opacity: Math.pow(e, 2.2) }} />
        </>
      );
    }
    case 'whip-pan': {
      const lines = Array.from({ length: 16 }, (_, i) => ({ y: random01(tl.seed, `whip-y-${ev.cut}-${i}`) * height, h: 6 + random01(tl.seed, `whip-h-${ev.cut}-${i}`) * 26 }));
      return (
        <div style={{ position: 'absolute', inset: 0, opacity: peak * 0.8 }}>
          {lines.map((l, i) => (
            <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: l.y, height: l.h, background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.55), rgba(255,255,255,0))', filter: 'blur(3px)' }} />
          ))}
        </div>
      );
    }
    case 'cloud-puff':
      return <CloudPuff progress={cloudCoverage(p)} seed={tl.seed} />;
    case 'glitch': {
      const n = 9;
      return (
        <div style={{ position: 'absolute', inset: 0, opacity: peak }}>
          {Array.from({ length: n }, (_, i) => {
            const y = random01(tl.seed, `gl-y-${frame}-${i}`) * height;
            const h = 10 + random01(tl.seed, `gl-h-${frame}-${i}`) * 90;
            const dx = (random01(tl.seed, `gl-x-${frame}-${i}`) - 0.5) * 160;
            return <div key={i} style={{ position: 'absolute', left: dx, right: -dx, top: y, height: h, background: i % 3 === 0 ? '#00e5ffaa' : i % 3 === 1 ? '#ff2d6faa' : '#ffffff66', mixBlendMode: 'screen' }} />;
          })}
        </div>
      );
    }
    case 'wipe': {
      const edge = wipeEdge(ev, frame, width);
      const x = ev.direction === 'right' ? width - edge : edge;
      return <div style={{ position: 'absolute', top: -40, bottom: -40, left: x - width * 0.18, width: width * 0.36, background: 'linear-gradient(90deg, rgba(10,14,22,0), #0a0e16 30%, #0a0e16 70%, rgba(10,14,22,0))', filter: 'blur(18px)' }} />;
    }
    default:
      return null;
  }
};
