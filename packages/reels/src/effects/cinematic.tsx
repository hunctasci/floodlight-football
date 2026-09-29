import React from 'react';
import { interpolate } from 'remotion';
import { projectToScreen } from '../camera/project';
import { HNC_UI } from '../graphics/hnc-ui';
import type { Shot } from '../engine/timeline/types';
import { useLayout } from '../render/layout';
import { sampleFootballMoment } from '../worlds/football/choreography';
import { footballMoment, shotMomentTime } from '../worlds/football/football.world';
import type { Lens } from '../worlds/types';

/**
 * Trailer-grade 2D layer. Everything here either covers the frame (grades,
 * bars, lights) or is projected from choreography through the shot camera
 * (trails, bursts) — the canonical 3D world stays untouched.
 * All functions of (frame, fps, props).
 */

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/**
 * Floodlight banks clunking on: black -> bank 1 (left beam) -> bank 2
 * (right beam) -> full with a bloom pop. Each bank flickers once, like a
 * real stadium bank striking.
 */
export const LightsOn: React.FC<{ local: number; durationInFrames: number }> = ({ local, durationInFrames: d }) => {
  const b1 = Math.round(d * 0.16);
  const b2 = Math.round(d * 0.36);
  const full = Math.round(d * 0.56);
  const strike = (at: number, from: number, to: number): number | undefined => {
    if (local < at) return undefined;
    const k = local - at;
    if (k === 0) return Math.min(from, to) * 0.4; // strike flash
    if (k === 1) return from; // flicker off
    return to;
  };
  const darkness = strike(full, 0.3, 0) ?? strike(b2, 0.62, 0.3) ?? strike(b1, 1, 0.62) ?? 1;
  const bloom = local >= full ? interpolate(local - full, [0, 10], [0.35, 0], clamp) : 0;
  const beam = (at: number) => (local >= at ? interpolate(local, [at, at + 3, full + 10, full + 26], [0, 0.85, 0.85, 0], clamp) : 0);
  const beamStyle = (side: 'left' | 'right', o: number): React.CSSProperties => ({
    position: 'absolute',
    inset: 0,
    opacity: o,
    mixBlendMode: 'screen',
    filter: 'blur(26px)',
    background: `linear-gradient(${side === 'left' ? 155 : 205}deg, #fff6d8cc 0%, #fff1cb55 22%, transparent 55%)`,
    clipPath: side === 'left' ? 'polygon(0 0, 34% 0, 78% 100%, 18% 100%)' : 'polygon(66% 0, 100% 0, 82% 100%, 22% 100%)',
  });
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: '#03060c', opacity: darkness }} />
      <div style={beamStyle('left', beam(b1))} />
      <div style={beamStyle('right', beam(b2))} />
      {bloom > 0 ? <div style={{ position: 'absolute', inset: 0, background: '#fff8e6', opacity: bloom }} /> : null}
    </>
  );
};

/** The game's cinematic bars (style.css .cinebar, 7vh): ease in, snap out. */
export const Cinebars: React.FC<{ local: number; durationInFrames: number; fps: number }> = ({ local, durationInFrames, fps }) => {
  const { height: H } = useLayout();
  const inFrames = Math.round(0.45 * fps);
  // Linear over 0.45s mirrors the CSS `transition: height .45s`.
  const h = Math.round(H * 0.07) * interpolate(local, [0, inFrames, durationInFrames - 4, durationInFrames], [0, 1, 1, 0], clamp);
  if (h <= 0) return null;
  return (
    <>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: h, background: '#000' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: h, background: '#000' }} />
    </>
  );
};

/**
 * In-world ball trail: the ball's own recent path (sampled from the moment
 * clock) projected through the current lens, tapering to nothing. Only
 * renders where the ball actually moves fast on screen.
 */
export const BallTrail: React.FC<{ shot: Shot; frame: number; fps: number; lens: Lens; intensity?: number }> = ({ shot, frame, fps, lens, intensity = 1 }) => {
  const { width: W, height: H } = useLayout();
  const time = shotMomentTime(shot, frame, fps);
  const moment = footballMoment(shot.set);
  const N = 12;
  const pts = Array.from({ length: N }, (_, i) => projectToScreen(lens, sampleFootballMoment(moment, time - i * 0.012).ball, W, H)).filter((p) => p.visible);
  if (pts.length < 2) return null;
  const head = pts[0];
  const radius = Math.max(4, Math.min(40, 260 / Math.max(0.5, head.distance)));
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0 }}>
      {pts.slice(1).map((p, i) => {
        const q = pts[i];
        const k = 1 - i / (pts.length - 1);
        return (
          <line
            key={i}
            x1={q.x}
            y1={q.y}
            x2={p.x}
            y2={p.y}
            stroke={HNC_UI.cream}
            strokeWidth={radius * 1.5 * k}
            strokeLinecap="round"
            opacity={0.55 * k * intensity}
          />
        );
      })}
    </svg>
  );
};

/**
 * Contact burst at the ball's position on the effect's first frame: 2-frame
 * flash, expanding ring and radial strikes in cream/gold, ~10 frames.
 */
export const ImpactBurst: React.FC<{ shot: Shot; at: number; frame: number; fps: number; lens: Lens; intensity?: number }> = ({ shot, at, frame, fps, lens, intensity = 1 }) => {
  const { width: W, height: H } = useLayout();
  const k = frame - at;
  const life = Math.round(fps / 6);
  if (k < 0 || k > life) return null;
  // Football: burst at the ball at impact; elsewhere at the frame centre.
  const p = shot.world === 'football'
    ? projectToScreen(lens, sampleFootballMoment(footballMoment(shot.set), shotMomentTime(shot, at, fps)).ball, W, H)
    : { x: W / 2, y: H * 0.45, visible: true, distance: 1 };
  const u = k / life;
  const r0 = 40 + 320 * (1 - Math.pow(1 - u, 3));
  const fade = 1 - u;
  const flash = k < 2 ? 0.4 * intensity : 0;
  const rays = 14;
  return (
    <>
      {flash > 0 ? <div style={{ position: 'absolute', inset: 0, background: '#fffbef', opacity: flash }} /> : null}
      {p.visible ? (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, opacity: fade * intensity }}>
          <circle cx={p.x} cy={p.y} r={r0 * 0.55} fill="none" stroke={HNC_UI.cream} strokeWidth={14 * fade + 2} />
          {Array.from({ length: rays }, (_, i) => {
            const a = (i / rays) * Math.PI * 2 + 0.2;
            const inner = r0 * 0.7;
            const outer = r0 * (1.05 + (i % 2) * 0.35);
            return (
              <line
                key={i}
                x1={p.x + Math.cos(a) * inner}
                y1={p.y + Math.sin(a) * inner}
                x2={p.x + Math.cos(a) * outer}
                y2={p.y + Math.sin(a) * outer}
                stroke={i % 2 ? HNC_UI.gold : HNC_UI.cream}
                strokeWidth={10 * fade + 2}
                strokeLinecap="round"
              />
            );
          })}
        </svg>
      ) : null}
    </>
  );
};

/** The game's menu backdrop over the live stadium (league / end card plates). */
export const StadiumGrade: React.FC<{ local: number; fps: number; intensity?: number }> = ({ local, fps, intensity = 1 }) => {
  const o = interpolate(local, [0, Math.round(fps * 0.4)], [0, intensity], clamp);
  return <div style={{ position: 'absolute', inset: 0, background: HNC_UI.menuBackdrop, opacity: o }} />;
};
