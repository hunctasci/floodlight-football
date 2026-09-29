import React from 'react';
import { interpolate } from 'remotion';
import { BallTrail, Cinebars, ImpactBurst, LightsOn, StadiumGrade } from '../effects/cinematic';
import type { FxEvent, Shot } from '../engine/timeline/types';
import { HNC_UI } from '../graphics/hnc-ui';
import { random01 } from '../utils/rng';
import type { Lens } from '../worlds/types';
import { useLayout } from './layout';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const ORDER = ['ball-trail', 'impact-burst', 'speed-lines', 'confetti', 'rival-grade', 'freeze-grade', 'vignette', 'shade-top', 'shade-bottom', 'stadium-grade', 'cinebars', 'lights-on', 'flash'];

/** CSS filter for the world layer from active grade effects (never touches graphics). */
export function worldFilter(shot: Shot, frame: number): string | undefined {
  const freeze = shot.fx.some((e) => e.type === 'freeze-grade' && frame >= e.start && frame < e.end);
  return freeze ? 'saturate(0.3) contrast(1.12) brightness(1.04)' : undefined;
}

/** Screen-layer effects of one shot (camera + world effects live elsewhere). */
export const ShotFx: React.FC<{ shot: Shot; frame: number; fps: number; lens?: Lens; seed: number }> = ({ shot, frame, fps, lens, seed }) => {
  const { width, height } = useLayout();
  const active = (e: FxEvent) => frame >= e.start && frame < e.end;
  const els: React.ReactNode[] = [];
  // Fixed layer order regardless of spec order: projections, grades, bars, lights.
  const ordered = [...shot.fx].sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type) || a.start - b.start);
  for (const e of ordered) {
    const key = `${e.type}-${e.start}`;
    const local = frame - e.start;
    const dur = e.end - e.start;
    if (lens && e.type === 'ball-trail' && active(e) && shot.world === 'football') els.push(<BallTrail key={key} shot={shot} frame={frame} fps={fps} lens={lens} intensity={e.intensity} />);
    if (lens && e.type === 'impact-burst') els.push(<ImpactBurst key={key} shot={shot} at={e.start} frame={frame} fps={fps} lens={lens} intensity={e.intensity} />);
    if (!active(e)) continue;
    switch (e.type) {
      case 'stadium-grade':
        els.push(<StadiumGrade key={key} local={local} fps={fps} intensity={e.intensity} />);
        break;
      case 'cinebars':
        els.push(<Cinebars key={key} local={local} durationInFrames={dur} fps={fps} />);
        break;
      case 'lights-on':
        els.push(<LightsOn key={key} local={local} durationInFrames={dur} />);
        break;
      case 'flash':
        els.push(<div key={key} style={{ position: 'absolute', inset: 0, background: '#fffbef', opacity: interpolate(local, [0, Math.round(fps * 0.25)], [0.85 * e.intensity, 0], clamp) }} />);
        break;
      case 'shade-top':
      case 'shade-bottom': {
        // A dark gradient behind type over a bright plate (legibility, not a look).
        const k = interpolate(local, [0, Math.round(fps * 0.3)], [0, e.intensity], clamp);
        const dir = e.type === 'shade-top' ? 'to bottom' : 'to top';
        els.push(<div key={key} style={{ position: 'absolute', inset: 0, background: `linear-gradient(${dir}, rgba(4,8,16,${0.82 * k}) 0%, rgba(4,8,16,${0.55 * k}) 26%, rgba(4,8,16,0) 48%)` }} />);
        break;
      }
      case 'vignette':
        els.push(<div key={key} style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 45%, transparent 50%, rgba(3,8,16,${0.55 * e.intensity}) 100%)` }} />);
        break;
      case 'rival-grade': {
        const k = interpolate(local, [0, Math.round(fps * 0.3)], [0, e.intensity], clamp);
        els.push(
          <React.Fragment key={key}>
            <div style={{ position: 'absolute', inset: 0, background: '#1d3a6b', mixBlendMode: 'multiply', opacity: 0.32 * k }} />
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 42%, transparent 38%, rgba(2,6,14,0.8) 100%)', opacity: k }} />
          </React.Fragment>,
        );
        break;
      }
      case 'freeze-grade':
        // The desaturation itself is a filter on the world layer (worldFilter).
        els.push(<div key={key} style={{ position: 'absolute', inset: 22, border: `8px solid ${HNC_UI.cream}`, opacity: 0.9 }} />);
        break;
      case 'speed-lines': {
        const lines = Array.from({ length: 22 }, (_, i) => {
          const a = random01(seed, `speed-${e.start}-${i}`) * Math.PI * 2;
          const len = 0.25 + 0.35 * random01(seed, `speed-len-${e.start}-${i}`);
          const drift = ((local * 0.09 + i * 0.37) % 1) * 0.1;
          return { a, r0: 0.32 + drift, r1: 0.32 + drift + len };
        });
        const R = Math.hypot(width, height) / 2;
        els.push(
          <svg key={key} width={width} height={height} style={{ position: 'absolute', inset: 0, opacity: 0.55 * e.intensity }}>
            {lines.map((l, i) => (
              <line key={i} x1={width / 2 + Math.cos(l.a) * R * l.r0} y1={height * 0.45 + Math.sin(l.a) * R * l.r0} x2={width / 2 + Math.cos(l.a) * R * l.r1} y2={height * 0.45 + Math.sin(l.a) * R * l.r1} stroke={HNC_UI.cream} strokeWidth={7} strokeLinecap="round" />
            ))}
          </svg>,
        );
        break;
      }
      case 'confetti': {
        const pieces = Array.from({ length: 70 }, (_, i) => {
          const x = random01(seed, `conf-x-${i}`) * width;
          const y = ((local * (5 + (i % 5)) + random01(seed, `conf-y-${i}`) * height) % (height + 200)) - 100;
          return { x, y, c: [HNC_UI.gold, '#e30a17', '#5fcddd', HNC_UI.cream, '#7ee08a'][i % 5], r: (i * 37 + local * 4) % 360 };
        });
        els.push(
          <svg key={key} width={width} height={height} style={{ position: 'absolute', inset: 0 }}>
            {pieces.map((p, i) => (
              <rect key={i} x={p.x} y={p.y} width={18} height={26} fill={p.c} transform={`rotate(${p.r} ${p.x} ${p.y})`} />
            ))}
          </svg>,
        );
        break;
      }
      default:
        break;
    }
  }
  return <>{els}</>;
};
