import React from 'react';
import { randomRange } from '../utils/rng';

export interface PuffSpec {
  x: number;
  y: number;
  r: number;
  delay: number;
  shade: string;
}

/**
 * Deterministic cartoon cloud layout for the hero cloud-puff transition.
 * Positions derive from (seed, key) — same seed always puffs the same way.
 */
export function cloudLayout(seed: number, key: string, count: number, w: number, h: number): PuffSpec[] {
  const out: PuffSpec[] = [];
  for (let i = 0; i < count; i++) {
    const x = randomRange(seed, `${key}-x-${i}`, w * 0.08, w * 0.92);
    const y = randomRange(seed, `${key}-y-${i}`, h * 0.18, h * 0.82);
    const r = randomRange(seed, `${key}-r-${i}`, Math.min(w, h) * 0.09, Math.min(w, h) * 0.2);
    const delay = randomRange(seed, `${key}-d-${i}`, 0, 0.12);
    const shades = ['#ffffff', '#fdf6e3', '#f3ead2', '#ffffff', '#faf3df'];
    const shade = shades[Math.floor(randomRange(seed, `${key}-s-${i}`, 0, shades.length)) % shades.length];
    out.push({ x, y, r, delay, shade });
  }
  return out;
}

function CloudSvg({ x, y, r, fill }: { x: number; y: number; r: number; fill: string }) {
  return (
    <g transform={`translate(${x} ${y})`} fill={fill} stroke="#101b31" strokeWidth={r * 0.07}>
      <ellipse cx={-r * 0.7} cy={r * 0.15} rx={r * 0.62} ry={r * 0.5} />
      <ellipse cx={0} cy={-r * 0.25} rx={r * 0.8} ry={r * 0.66} />
      <ellipse cx={r * 0.7} cy={r * 0.15} rx={r * 0.6} ry={r * 0.48} />
      <ellipse cx={0} cy={r * 0.3} rx={r * 0.95} ry={r * 0.5} />
    </g>
  );
}

/**
 * Hero comedic cloud-puff overlay. progress 0..1 is COVERAGE (from
 * transitionCoverage): 0 = clear, 1 = fully covered. The registry already
 * encodes expansion (0->1), hold (=1) and dissipation (1->0), so this
 * component maps coverage directly to puff scale/opacity: big and opaque
 * at 1, gone at 0. Fully covers 1080x1920 near midpoint so the stage
 * swap is invisible.
 */
export const CloudPuff: React.FC<{ progress: number; seed: number; id?: string }> = ({ progress, seed, id = 'cloud' }) => {
  if (progress <= 0.01) return null;
  const W = 1080;
  const H = 1920;
  const puffs = cloudLayout(seed, id, 16, W, H);
  const eased = 1 - Math.pow(1 - Math.min(1, progress * 1.5), 3);
  const scaleOf = (p: PuffSpec) => 0.25 + eased * 1.25 + p.delay;
  const opacity = Math.min(1, progress * 4);
  const covered = progress > 0.4;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, opacity }}>
      {covered ? <rect x={0} y={0} width={W} height={H} fill="#fdf6e3" /> : null}
      {puffs.map((p, i) => (
        <g key={i} transform={`translate(${p.x} ${p.y}) scale(${scaleOf(p)}) translate(${-p.x} ${-p.y})`}>
          <CloudSvg x={p.x} y={p.y} r={p.r} fill={p.shade} />
        </g>
      ))}
      {progress > 0.25 && progress < 0.9 ? (
        <g stroke="#101b31" strokeWidth={10} strokeLinecap="round" opacity={0.9}>
          {puffs.slice(0, 8).map((p, i) => {
            const a = (i / 8) * Math.PI * 2;
            return <line key={i} x1={540 + Math.cos(a) * 120} y1={960 + Math.sin(a) * 120} x2={540 + Math.cos(a) * 260} y2={960 + Math.sin(a) * 260} />;
          })}
        </g>
      ) : null}
    </svg>
  );
};
