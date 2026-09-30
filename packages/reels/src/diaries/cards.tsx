import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile } from 'remotion';
import { getAsset } from '../assets/registry';
import { HNC_BRAND } from '../graphics/branding';
import { upper } from '../graphics/case';
import { DIARY_TYPE } from './type';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/**
 * 48 HOURS BEFORE BELGIUM — the smash-cut title. Hard in on the crowd roar
 * (no fade), a floodlight flare sweeps across, the small series line sits
 * underneath. White condensed type on black: sports documentary, not promo.
 */
export const TitleCard: React.FC<{ frame: number; fps: number; title: string; kicker: string }> = ({ frame, fps, title, kicker }) => {
  const t = frame / fps;
  const flareX = interpolate(t, [0, 0.9], [-30, 130], clamp);
  const settle = spring({ frame, fps, config: { damping: 30, stiffness: 260, mass: 0.6 } });
  const words = upper(title).split(' ');
  return (
    <AbsoluteFill style={{ background: '#030304', alignItems: 'center', justifyContent: 'center' }}>
      <div
        style={{
          position: 'absolute',
          top: '38%',
          left: `${flareX}%`,
          width: 900,
          height: 160,
          transform: 'translate(-50%, -50%) rotate(-8deg)',
          background: 'radial-gradient(ellipse at center, #fffbe855 0%, #ffffff10 35%, transparent 70%)',
          filter: 'blur(8px)',
        }}
      />
      <div style={{ textAlign: 'center', transform: `scale(${interpolate(settle, [0, 1], [1.06, 1])})` }}>
        {[words.slice(0, 2).join(' '), words.slice(2).join(' ')].map((line, i) => (
          <div
            key={line}
            style={{
              fontFamily: DIARY_TYPE.display,
              fontWeight: 600,
              fontSize: i === 0 ? 132 : 150,
              letterSpacing: i === 0 ? 10 : 6,
              lineHeight: 1.0,
              color: '#f4f2ec',
            }}
          >
            {line}
          </div>
        ))}
        <div style={{ height: 3, width: 120, background: HNC_BRAND.colors.red, margin: '34px auto 26px' }} />
        <div style={{ fontFamily: DIARY_TYPE.text, fontWeight: 600, fontSize: 30, letterSpacing: 9, color: '#bdb9b0' }}>{upper(kicker)}</div>
      </div>
    </AbsoluteFill>
  );
};

/**
 * BELGIUM vs TÜRKİYE over the tunnel plate: HNC-original, no competition
 * marks — two nation names, a thin rule, the kickoff line. Turkish casing
 * through graphics/case.ts (TÜRKİYE keeps its dotted İ).
 */
export const MatchCard: React.FC<{ frame: number; fps: number; home: string; away: string; line: string }> = ({ frame, fps, home, away, line }) => {
  const k = (d: number) => spring({ frame: frame - d, fps, config: { damping: 22, stiffness: 190 } });
  const out = interpolate(frame, [fps * 0.95, fps * 1.1], [1, 0], clamp);
  const row = (text: string, i: number) => (
    <div
      style={{
        fontFamily: DIARY_TYPE.display,
        fontWeight: 600,
        fontSize: 128,
        letterSpacing: 8,
        color: '#f7f5ef',
        opacity: k(i * 5) * out,
        transform: `translateY(${interpolate(k(i * 5), [0, 1], [26, 0])}px)`,
        textShadow: '0 4px 40px #000c',
      }}
    >
      {upper(text)}
    </div>
  );
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(#0008, #0003 45%, #0008)' }}>
      <div style={{ textAlign: 'center', marginTop: -120 }}>
        {row(home, 0)}
        <div style={{ fontFamily: DIARY_TYPE.text, fontWeight: 500, fontSize: 34, letterSpacing: 10, color: '#d8d4ca', margin: '10px 0', opacity: k(3) * out }}>VS</div>
        {row(away, 1)}
        <div style={{ height: 3, width: 110 * k(8), background: HNC_BRAND.colors.red, margin: '30px auto 22px', opacity: out }} />
        <div style={{ fontFamily: DIARY_TYPE.text, fontWeight: 600, fontSize: 28, letterSpacing: 8, color: '#cfcac0', opacity: k(10) * out }}>{upper(line)}</div>
      </div>
    </AbsoluteFill>
  );
};

/** WHITE. HNC LEAGUE. The only full brand moment in the film. */
export const EndCard: React.FC<{ frame: number; fps: number; series: string }> = ({ frame, fps, series }) => {
  const badge = spring({ frame: frame - 6, fps, config: { damping: 16, stiffness: 120, mass: 0.9 } });
  const text = interpolate(frame, [18, 34], [0, 1], clamp);
  const logo = staticFile(`assets/${getAsset('hnc-logo').file}`);
  return (
    <AbsoluteFill style={{ background: '#fbfaf6', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', marginTop: -80 }}>
        <Img src={logo} style={{ width: 330, height: 330, opacity: badge, transform: `scale(${interpolate(badge, [0, 1], [0.92, 1])})` }} />
        <div style={{ fontFamily: DIARY_TYPE.display, fontWeight: 600, fontSize: 88, letterSpacing: 14, color: '#101b31', marginTop: 30, opacity: text }}>{HNC_BRAND.league}</div>
        <div style={{ fontFamily: DIARY_TYPE.text, fontWeight: 600, fontSize: 26, letterSpacing: 8, color: '#6b6a66', marginTop: 16, opacity: text }}>{upper(series)}</div>
      </div>
    </AbsoluteFill>
  );
};
