import React from 'react';
import { projectToScreen, type ScreenPoint } from '../camera/project';
import type { FxEvent, Shot } from '../engine/timeline/types';
import type { SubjectResolver } from '../engine/subjects';
import { useLayout } from '../render/layout';
import { random01 } from '../utils/rng';
import { MOMENT_ROLES, sampleFootballMoment } from '../worlds/football/choreography';
import { footballMoment, footballRoles, shotMomentTime } from '../worlds/football/football.world';
import type { Lens, Vec3 } from '../worlds/types';
import { CURRENT_WHITE, currentColor, rgba } from './current';

/**
 * Anime grammar, screen layer (THE CURRENT). Every module is a pure function
 * of (frame, event, lens): positions come from the choreography projected
 * through the shot camera, so the 2D layer sits on the 3D action without
 * touching the canonical world. World-layer filters (inversion, chroma,
 * slice) live in `animeWorldFilter` + `AnimeFilterDefs`.
 */

type Ctx = { shot: Shot; frame: number; fps: number; lens?: Lens; subject?: SubjectResolver; seed: number; e: FxEvent };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function subjectPoint(ctx: Ctx, W: number, H: number): ScreenPoint | undefined {
  const { lens, subject, e } = ctx;
  if (!lens || !subject) return undefined;
  const s = subject(e.on ?? 'ball');
  return s ? projectToScreen(lens, s.head, W, H) : undefined;
}

function colorOf(e: FxEvent, fallback = CURRENT_WHITE): string {
  return e.props?.color ? currentColor(String(e.props.color)) : fallback;
}

// --- impact frame + focus lines --------------------------------------------

/** Frames 1..3 after `at` invert the world into ink (see animeWorldFilter). */
export function impactInk(e: FxEvent, frame: number): boolean {
  const k = frame - e.start;
  return e.type === 'impact-frame' && k >= 1 && k <= Math.max(2, Math.round(3 * e.intensity));
}

const FocusLinesSvg: React.FC<{ cx: number; cy: number; ink: string; opacity: number; seed: number; key2: string; inner: number; count?: number }> = ({ cx, cy, ink, opacity, seed, key2, inner, count = 90 }) => {
  const { width: W, height: H } = useLayout();
  const R = Math.hypot(W, H);
  const wedges = Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2 + (random01(seed, `fl-a-${key2}-${i}`) - 0.5) * 0.06;
    const w = 0.004 + 0.012 * random01(seed, `fl-w-${key2}-${i}`);
    const r0 = inner * (0.85 + 0.6 * random01(seed, `fl-r-${key2}-${i}`));
    const p = (ang: number, r: number) => `${cx + Math.cos(ang) * r},${cy + Math.sin(ang) * r}`;
    return `M${p(a, r0)} L${p(a - w, R)} L${p(a + w, R)} Z`;
  });
  return (
    <svg width={W} height={H} style={{ position: 'absolute', inset: 0, opacity }}>
      <path d={wedges.join(' ')} fill={ink} />
    </svg>
  );
};

export const ImpactFrame: React.FC<Ctx> = (ctx) => {
  const { frame, e, seed } = ctx;
  const { width: W, height: H } = useLayout();
  const k = frame - e.start;
  const ink = Math.max(2, Math.round(3 * e.intensity));
  if (k < 0 || k > ink + 1) return null;
  const p = subjectPoint(ctx, W, H) ?? { x: W / 2, y: H * 0.45, visible: true, distance: 1 };
  if (k === 0) return <div style={{ position: 'absolute', inset: 0, background: '#ffffff', opacity: 0.92 }} />;
  // Ink frames: black focus lines on the inverted world; boils every frame.
  return <FocusLinesSvg cx={p.x} cy={p.y} ink={k <= ink ? '#000000' : '#ffffff'} opacity={k <= ink ? 0.9 : 0.5} seed={seed} key2={`${e.start}-${k}`} inner={W * 0.16} count={120} />;
};

export const FocusLines: React.FC<Ctx> = (ctx) => {
  const { frame, e, seed, fps } = ctx;
  const { width: W, height: H } = useLayout();
  const local = frame - e.start;
  const p = e.on || ctx.shot.world === 'football' ? subjectPoint(ctx, W, H) : undefined;
  const c = p?.visible ? p : { x: W / 2, y: H * 0.45 };
  const fade = Math.min(1, local / 4) * Math.min(1, (e.end - frame) / 5);
  const ink = e.props?.ink === 'black' ? '#05070c' : '#fff8ec';
  // Boil on twos (anime line boil), not every frame.
  const boil = Math.floor(local / 2);
  return <FocusLinesSvg cx={c.x} cy={c.y} ink={ink} opacity={0.55 * e.intensity * fade} seed={seed} key2={`${e.start}-${boil}`} inner={W * (0.2 + 0.05 * Math.sin(local / fps))} />;
};

// --- shockwave ------------------------------------------------------------------

export const Shockwave: React.FC<Ctx> = (ctx) => {
  const { frame, fps, e, lens, subject } = ctx;
  const { width: W, height: H } = useLayout();
  const k = frame - e.start;
  const life = Math.round(fps * 0.55 * (e.props?.life !== undefined ? Number(e.props.life) : 1));
  if (k < 0 || k > life || !lens || !subject) return null;
  const s = subject(e.on ?? 'ball');
  if (!s) return null;
  const u = k / life;
  const radius = Number(e.props?.radius ?? 6) * (1 - Math.pow(1 - u, 3));
  const color = colorOf(e);
  const ground = Number(e.props?.height ?? 0.05);
  const ring = (y: number) =>
    Array.from({ length: 64 }, (_, i) => {
      const a = (i / 64) * Math.PI * 2;
      return projectToScreen(lens, { x: s.pos.x + Math.cos(a) * radius, y, z: s.pos.z + Math.sin(a) * radius }, W, H);
    });
  const pts = ring(ground);
  if (pts.some((p) => !p.visible)) return null;
  const d = `M${pts.map((p) => `${p.x},${p.y}`).join(' L')} Z`;
  const fade = 1 - u;
  return (
    <svg width={W} height={H} style={{ position: 'absolute', inset: 0, mixBlendMode: 'screen' }}>
      <defs>
        <filter id={`sw-${e.start}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={10} />
        </filter>
      </defs>
      <path d={d} fill="none" stroke={color} strokeWidth={60 * fade + 6} opacity={0.55 * fade * e.intensity} filter={`url(#sw-${e.start})`} />
      <path d={d} fill="none" stroke={CURRENT_WHITE} strokeWidth={10 * fade + 2} opacity={0.9 * fade * e.intensity} />
    </svg>
  );
};

// --- plasma trail -----------------------------------------------------------------

export const PlasmaTrail: React.FC<Ctx> = (ctx) => {
  const { shot, frame, fps, e, lens, seed } = ctx;
  const { width: W, height: H } = useLayout();
  if (!lens || shot.world !== 'football') return null;
  const time = shotMomentTime(shot, frame, fps);
  const moment = footballMoment(shot.set);
  const length = Number(e.props?.length ?? 0.16);
  const N = 22;
  const from = e.props?.fromMoment !== undefined ? Number(e.props.fromMoment) : -Infinity;
  const raw = Array.from({ length: N }, (_, i) => time - (i / (N - 1)) * length).filter((t) => t >= from);
  const pts = raw.map((t) => projectToScreen(lens, sampleFootballMoment(moment, t).ball, W, H)).filter((p) => p.visible);
  if (pts.length < 2) return null;
  const head = pts[0];
  const r = Math.max(5, Math.min(60, 300 / Math.max(0.5, head.distance)));
  const color = colorOf(e);
  const fade = Math.min(1, (e.end - frame) / 6) * e.intensity;
  const path = `M${pts.map((p) => `${p.x},${p.y}`).join(' L')}`;
  const sparks = Array.from({ length: 14 }, (_, i) => {
    const q = pts[Math.min(pts.length - 1, Math.floor(random01(seed, `sp-i-${frame}-${i}`) * pts.length))];
    const a = random01(seed, `sp-a-${frame}-${i}`) * Math.PI * 2;
    const d = r * (1 + 2.5 * random01(seed, `sp-d-${frame}-${i}`));
    return { x: q.x + Math.cos(a) * d, y: q.y + Math.sin(a) * d, s: 2 + 5 * random01(seed, `sp-s-${frame}-${i}`) };
  });
  const id = `pt-${shot.id}-${e.start}`;
  return (
    <svg width={W} height={H} style={{ position: 'absolute', inset: 0, mixBlendMode: 'screen', opacity: fade }}>
      <defs>
        <filter id={id} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={r * 0.55} />
        </filter>
      </defs>
      <path d={path} fill="none" stroke={color} strokeWidth={r * 3.2} strokeLinecap="round" strokeLinejoin="round" opacity={0.75} filter={`url(#${id})`} />
      <path d={path} fill="none" stroke={color} strokeWidth={r * 1.4} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
      <path d={path} fill="none" stroke={CURRENT_WHITE} strokeWidth={r * 0.55} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={head.x} cy={head.y} r={r * 1.35} fill={color} opacity={0.6} filter={`url(#${id})`} />
      {sparks.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.s} fill={i % 3 ? color : CURRENT_WHITE} />
      ))}
    </svg>
  );
};

// --- ground trail (crescent cut / undertow) --------------------------------------------

function roleActorAt(shot: Shot, castId: string, t: number): { x: number; z: number } | undefined {
  const moment = footballMoment(shot.set);
  const role = Object.entries(footballRoles(shot.set)).find(([, id]) => id === castId)?.[0] ?? castId;
  const i = (MOMENT_ROLES[moment] ?? []).indexOf(role);
  const a = sampleFootballMoment(moment, t).actors[i];
  return a ? { x: a.x, z: a.z } : undefined;
}

export const GroundTrail: React.FC<Ctx> = (ctx) => {
  const { shot, frame, fps, e, lens } = ctx;
  const { width: W, height: H } = useLayout();
  if (!lens || shot.world !== 'football' || !e.on) return null;
  const p = e.props ?? {};
  const t0 = Number(p.fromMoment ?? 0);
  const t1 = Number(p.toMoment ?? t0 + 1);
  const now = shotMomentTime(shot, frame, fps);
  const until = Math.min(now, t1);
  if (until <= t0) return null;
  const width = Number(p.width ?? 0.5);
  const height = Number(p.height ?? 0);
  const color = colorOf(e);
  const steps = 40;
  const path: { x: number; z: number; age: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = t0 + ((until - t0) * i) / steps;
    const a = roleActorAt(shot, e.on, t);
    if (a) path.push({ ...a, age: now - t });
  }
  if (path.length < 2) return null;
  const glowLife = Number(p.fade ?? 1.2);
  const side = (i: number, s: number, y: number): Vec3 => {
    const a = path[Math.max(0, i - 1)];
    const b = path[Math.min(path.length - 1, i + 1)];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const l = Math.hypot(dx, dz) || 1;
    // Taper at both ends of the stroke.
    const taper = Math.sin((Math.PI * i) / (path.length - 1)) * 0.8 + 0.2;
    return { x: path[i].x + (-dz / l) * width * 0.5 * s * taper, y, z: path[i].z + (dx / l) * width * 0.5 * s * taper };
  };
  const quads: { d: string; a: number }[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const age = path[i].age;
    const a = clamp01(1 - age / glowLife) * 0.85 + 0.15;
    const corners = height > 0
      ? [path[i], path[i + 1]].flatMap((q, j) => [{ x: q.x, y: 0.04, z: q.z }, { x: q.x, y: height * (0.6 + 0.4 * Math.sin(i * 0.7 + now * 12 + j)), z: q.z }])
      : [side(i, 1, 0.05), side(i + 1, 1, 0.05), side(i + 1, -1, 0.05), side(i, -1, 0.05)];
    const pr = corners.map((c) => projectToScreen(lens, c, W, H));
    if (pr.some((q) => !q.visible)) continue;
    const order = height > 0 ? [0, 1, 3, 2] : [0, 1, 2, 3];
    quads.push({ d: `M${order.map((k) => `${pr[k].x},${pr[k].y}`).join(' L')} Z`, a });
  }
  const fadeOut = Math.min(1, (e.end - frame) / 8) * e.intensity;
  const id = `gt-${shot.id}-${e.start}`;
  return (
    <svg width={W} height={H} style={{ position: 'absolute', inset: 0, mixBlendMode: 'screen', opacity: fadeOut }}>
      <defs>
        <filter id={id} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={14} />
        </filter>
        <linearGradient id={`${id}-v`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={CURRENT_WHITE} stopOpacity="1" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <g filter={`url(#${id})`}>
        {quads.map((q, i) => (
          <path key={`g${i}`} d={q.d} fill={color} opacity={q.a} />
        ))}
      </g>
      {quads.map((q, i) => (
        <path key={i} d={q.d} fill={height > 0 ? rgba(color, 0.55 * q.a) : CURRENT_WHITE} opacity={height > 0 ? 1 : 0.55 * q.a} />
      ))}
    </svg>
  );
};

// --- motes + light pulse -------------------------------------------------------------

export const Motes: React.FC<Ctx> = ({ frame, fps, e, seed }) => {
  const { width: W, height: H } = useLayout();
  const local = (frame - e.start) / fps;
  const fall = e.props?.fall === true;
  const color = colorOf(e, currentColor('TR'));
  const n = Math.round(46 * e.intensity);
  const fade = Math.min(1, local / 0.4) * Math.min(1, (e.end - frame) / 10);
  const dots = Array.from({ length: n }, (_, i) => {
    const sp = 60 + 140 * random01(seed, `mo-s-${i}`);
    const y0 = random01(seed, `mo-y-${i}`) * (H + 200);
    const y = fall ? ((y0 + local * sp) % (H + 200)) - 100 : H + 100 - ((y0 + local * sp) % (H + 200));
    const x = random01(seed, `mo-x-${i}`) * W + Math.sin(local * (0.8 + random01(seed, `mo-w-${i}`)) + i) * 30;
    const r = 2 + 7 * random01(seed, `mo-r-${i}`) ** 2;
    return { x, y, r, o: 0.35 + 0.65 * random01(seed, `mo-o-${i}`) };
  });
  return (
    <svg width={W} height={H} style={{ position: 'absolute', inset: 0, mixBlendMode: 'screen', opacity: fade }}>
      <defs>
        <radialGradient id={`mo-${e.start}`}>
          <stop offset="0" stopColor={CURRENT_WHITE} />
          <stop offset="0.35" stopColor={color} />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r * 2.4} fill={`url(#mo-${e.start})`} opacity={d.o} />
      ))}
    </svg>
  );
};

export const LightPulse: React.FC<Ctx> = ({ frame, fps, e }) => {
  const bpm = Number(e.props?.bpm ?? 150);
  const beat = (((frame - e.start) / fps) * bpm) / 60;
  const k = Math.pow(1 - (beat % 1), 4) * e.intensity * Math.min(1, (e.end - frame) / 8);
  const color = colorOf(e, currentColor('TR'));
  return <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% -10%, ${rgba(color, 0.75 * k)} 0%, ${rgba(color, 0.2 * k)} 40%, transparent 70%)`, mixBlendMode: 'screen' }} />;
};

// --- slice (MERIDIAN) ----------------------------------------------------------------------

/** Screen seam of the slice: the ball's flight line (moment `fromMoment` → `toMoment`). */
function sliceLine(shot: Shot, frame: number, fps: number, e: FxEvent, lens: Lens, W: number, H: number): { a: ScreenPoint; b: ScreenPoint } | undefined {
  if (shot.world !== 'football') return undefined;
  const moment = footballMoment(shot.set);
  const a = projectToScreen(lens, sampleFootballMoment(moment, Number(e.props?.fromMoment ?? 0)).ball, W, H);
  const b = projectToScreen(lens, sampleFootballMoment(moment, Number(e.props?.toMoment ?? 0)).ball, W, H);
  return a.visible && b.visible ? { a, b } : undefined;
}

function sliceAmount(e: FxEvent, frame: number, fps: number): number {
  const k = frame - e.start;
  const open = clamp01(k / 5);
  const heal = clamp01((e.end - frame) / Math.round(fps * 0.35));
  return Math.pow(open, 0.5) * heal * e.intensity;
}

/** Light seam + edge glow along the slice. */
export const SliceSeam: React.FC<Ctx> = ({ shot, frame, fps, e, lens }) => {
  const { width: W, height: H } = useLayout();
  if (!lens) return null;
  const line = sliceLine(shot, frame, fps, e, lens, W, H);
  if (!line) return null;
  const k = sliceAmount(e, frame, fps);
  if (k <= 0) return null;
  const color = colorOf(e);
  const dx = line.b.x - line.a.x;
  const dy = line.b.y - line.a.y;
  const l = Math.hypot(dx, dy) || 1;
  // Extend the seam across the whole frame.
  const x1 = line.a.x - (dx / l) * 3000;
  const y1 = line.a.y - (dy / l) * 3000;
  const x2 = line.a.x + (dx / l) * 3000;
  const y2 = line.a.y + (dy / l) * 3000;
  const id = `sl-${shot.id}-${e.start}`;
  return (
    <svg width={W} height={H} style={{ position: 'absolute', inset: 0, mixBlendMode: 'screen' }}>
      <defs>
        <filter id={id} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation={18} />
        </filter>
      </defs>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={70 * k} filter={`url(#${id})`} opacity={0.9} />
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={CURRENT_WHITE} strokeWidth={7 * k + 1} />
    </svg>
  );
};

/** SVG filter defs for the world layer of one shot (chroma split, slice displacement). */
export const AnimeFilterDefs: React.FC<{ shot: Shot; frame: number; fps: number; lens?: Lens }> = ({ shot, frame, fps, lens }) => {
  const { width: W, height: H } = useLayout();
  const chroma = shot.fx.find((e) => e.type === 'chroma' && frame >= e.start && frame < e.end);
  const slice = shot.fx.find((e) => e.type === 'slice' && frame >= e.start && frame < e.end);
  if (!chroma && !slice) return null;
  const cd = chroma ? 22 * chroma.intensity * Math.exp(-((frame - chroma.start) / fps) * 5) : 0;
  let map: string | undefined;
  let scale = 0;
  if (slice && lens) {
    const line = sliceLine(shot, frame, fps, slice, lens, W, H);
    const k = sliceAmount(slice, frame, fps);
    if (line && k > 0) {
      const dx = line.b.x - line.a.x;
      const dy = line.b.y - line.a.y;
      const l = Math.hypot(dx, dy) || 1;
      const ux = dx / l;
      const uy = dy / l;
      // Two half-planes around the seam; each shifts along the seam in opposite directions.
      const far = 4000;
      const A = [line.a.x - ux * far, line.a.y - uy * far];
      const B = [line.a.x + ux * far, line.a.y + uy * far];
      const nx = -uy * far;
      const ny = ux * far;
      const half = (s: number) => `${A[0]},${A[1]} ${B[0]},${B[1]} ${B[0] + nx * s},${B[1] + ny * s} ${A[0] + nx * s},${A[1] + ny * s}`;
      const ch = (v: number) => Math.round(128 + 127 * v);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="rgb(128,128,128)"/><polygon points="${half(1)}" fill="rgb(${ch(ux)},${ch(uy)},128)"/><polygon points="${half(-1)}" fill="rgb(${ch(-ux)},${ch(-uy)},128)"/></svg>`;
      map = `data:image/svg+xml;base64,${typeof btoa === 'function' ? btoa(svg) : Buffer.from(svg).toString('base64')}`;
      scale = 2 * 38 * k;
    }
  }
  return (
    <svg width={0} height={0} style={{ position: 'absolute' }}>
      <defs>
        {chroma ? (
          <filter id={`chroma-${shot.id}`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
            <feOffset in="r" dx={cd} dy={0} result="ro" />
            <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" result="gb" />
            <feOffset in="gb" dx={-cd * 0.6} dy={0} result="gbo" />
            <feBlend in="ro" in2="gbo" mode="screen" />
          </filter>
        ) : null}
        {map ? (
          <filter id={`slice-${shot.id}`} x="0" y="0" width="100%" height="100%" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feImage href={map} x={0} y={0} width={W} height={H} result="map" preserveAspectRatio="none" />
            <feDisplacementMap in="SourceGraphic" in2="map" scale={scale} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        ) : null}
      </defs>
    </svg>
  );
};

/** CSS filter chain the anime effects put on the world layer at a frame. */
export function animeWorldFilter(shot: Shot, frame: number): string[] {
  const out: string[] = [];
  const on = (type: string) => shot.fx.find((e) => e.type === type && frame >= e.start && frame < e.end);
  if (on('slice')) out.push(`url(#slice-${shot.id})`);
  if (on('chroma')) out.push(`url(#chroma-${shot.id})`);
  if (shot.fx.some((e) => impactInk(e, frame))) out.push('grayscale(1) contrast(3.2) brightness(1.2) invert(1)');
  return out;
}
