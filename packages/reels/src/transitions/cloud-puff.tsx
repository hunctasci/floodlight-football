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
 *
 * Transformation polish (deterministic from progress): a tie flies away
 * early-mid and a football emerges late-mid — the office HNC character is
 * visibly becoming their football self inside the cloud. Pure SVG, no
 * wall clock, no randomness beyond the seeded puff layout.
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
  // Tie: arcs out top-left during expansion (progress 0.15..0.6).
  const tieK = Math.min(1, Math.max(0, (progress - 0.15) / 0.45));
  const tieX = 540 - tieK * 420;
  const tieY = 960 - tieK * 620 - Math.sin(tieK * Math.PI) * 120;
  const tieRot = tieK * 140;
  const tieOpacity = progress > 0.12 && progress < 0.75 ? 1 : 0;
  // Football: scales up from the cloud centre during hold/dissipation,
  // staying visible through full coverage so the reveal reads inside the cloud.
  const ballK = Math.min(1, Math.max(0, (progress - 0.45) / 0.4));
  const ballR = 40 + ballK * 90;
  const ballOpacity = progress > 0.4 ? 0.95 : 0;
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
      {tieOpacity > 0 ? (
        <g transform={`translate(${tieX} ${tieY}) rotate(${tieRot})`} opacity={tieOpacity}>
          <rect x={-22} y={-70} width={44} height={110} rx={8} fill="#b03030" stroke="#101b31" strokeWidth={6} />
          <polygon points="0,-92 26,-58 0,-44 -26,-58" fill="#b03030" stroke="#101b31" strokeWidth={6} />
        </g>
      ) : null}
      {ballOpacity > 0 ? (
        <g transform={`translate(540 960)`} opacity={ballOpacity}>
          <circle r={ballR} fill="#f7f3e9" stroke="#101b31" strokeWidth={10} />
          <polygon
            points={Array.from({ length: 5 })
              .map((_, i) => {
                const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
                return `${Math.cos(a) * ballR * 0.42},${Math.sin(a) * ballR * 0.42}`;
              })
              .join(' ')}
            fill="#1f3040"
          />
          {[0, 1, 2, 3, 4].map((i) => {
            const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
            return (
              <circle
                key={i}
                cx={Math.cos(a) * ballR * 0.78}
                cy={Math.sin(a) * ballR * 0.78}
                r={ballR * 0.16}
                fill="#1f3040"
              />
            );
          })}
        </g>
      ) : null}
    </svg>
  );
};
