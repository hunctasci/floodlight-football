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

/** Italy-rematch's short final punctuation: fixture, date, then the league name. */
export const ItalyRematchEndCard: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const fixture = spring({ frame: frame - 2, fps, config: { damping: 24, stiffness: 190, mass: 0.75 } });
  const date = interpolate(frame, [10, 17], [0, 1], clamp);
  const league = spring({ frame: frame - 32, fps, config: { damping: 22, stiffness: 170, mass: 0.7 } });
  return (
    <AbsoluteFill style={{ background: '#101b31', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -190, right: -230, width: 720, height: 720, borderRadius: 999, background: '#f5efe313', border: '2px solid #f5efe52a' }} />
      <div style={{ position: 'absolute', bottom: 248, left: 90, right: 90, height: 3, background: HNC_BRAND.colors.red, opacity: fixture }} />
      <div style={{ textAlign: 'center', color: '#f6f2e9', marginTop: -55 }}>
        <div style={{ fontFamily: DIARY_TYPE.display, fontWeight: 600, fontSize: 110, letterSpacing: 6, opacity: fixture, transform: `translateY(${interpolate(fixture, [0, 1], [28, 0])}px)` }}>ITALY</div>
        <div style={{ fontFamily: DIARY_TYPE.text, fontWeight: 600, fontSize: 30, letterSpacing: 11, margin: '14px 0', color: '#d7d1c5', opacity: fixture }}>VS</div>
        <div style={{ fontFamily: DIARY_TYPE.display, fontWeight: 600, fontSize: 110, letterSpacing: 3, opacity: fixture, transform: `translateY(${interpolate(fixture, [0, 1], [28, 0])}px)` }}>TÜRKİYE</div>
        <div style={{ fontFamily: DIARY_TYPE.text, fontWeight: 650, fontSize: 31, letterSpacing: 8, color: '#e0d9ca', marginTop: 42, opacity: date }}>5 OCTOBER</div>
        <div style={{ fontFamily: DIARY_TYPE.display, fontWeight: 600, fontSize: 72, letterSpacing: 12, color: '#f6f2e9', marginTop: 115, opacity: league, transform: `translateY(${interpolate(league, [0, 1], [16, 0])}px)` }}>HNC LEAGUE</div>
      </div>
    </AbsoluteFill>
  );
};

/**
 * The frame-0 hook: a native POV caption (white box, black semibold), the
 * format our best-performing reel opened on. Fully visible on the very first
 * frame — no entrance — because that frame is the thumbnail and the scroll-stop.
 */
export const HookBox: React.FC<{ text: string; sub?: string; top?: number }> = ({ text, sub, top = 380 }) => (
  <div style={{ position: 'absolute', top, left: 70, right: 70, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
    <div style={{ background: '#ffffff', color: '#111111', fontFamily: 'system-ui, -apple-system, sans-serif', fontWeight: 700, fontSize: 62, lineHeight: 1.16, padding: '18px 32px', borderRadius: 18, textAlign: 'center', boxShadow: '0 10px 40px #0007' }}>
      {text}
      {sub ? <div style={{ fontSize: 40, fontWeight: 600, color: '#555', marginTop: 8 }}>{sub}</div> : null}
    </div>
  </div>
);

/** Under the teaser message: the series line, small and late. */
export const NextEpisode: React.FC<{ frame: number; fps: number; line: string }> = ({ frame, fps, line }) => {
  const k = interpolate(frame, [fps * 1.2, fps * 1.5], [0, 1], clamp);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 520, textAlign: 'center', fontFamily: DIARY_TYPE.text, fontWeight: 600, fontSize: 30, letterSpacing: 9, color: '#cfcac0', opacity: k }}>{upper(line)}</div>
  );
};

/**
 * The documentary question, on screen (v4: there is no interviewer voice — viewers took her for the
 * partner). Native Reels Q&A: a red Q chip + the question in condensed caps, upper third.
 */
export const QuestionCard: React.FC<{ frame: number; fps: number; text: string; tr?: string; frames: number }> = ({ frame, fps, text, tr, frames }) => {
  const k = spring({ frame, fps, config: { damping: 20, stiffness: 220 } });
  const out = interpolate(frame, [frames - 8, frames], [1, 0], clamp);
  return (
    <div style={{ position: 'absolute', top: 300, left: 80, right: 80, display: 'flex', justifyContent: 'center', opacity: Math.min(1, k * 1.5) * out, transform: `translateY(${(1 - k) * 18}px)`, pointerEvents: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, background: '#0a0a0cd9', padding: '18px 26px', borderRadius: 14, maxWidth: 920 }}>
        <div style={{ fontFamily: DIARY_TYPE.display, fontWeight: 600, fontSize: 40, color: '#fff', background: HNC_BRAND.colors.red, borderRadius: 8, padding: '0 12px', lineHeight: '56px' }}>Q</div>
        <div style={{ paddingTop: 2 }}>
          <div style={{ fontFamily: DIARY_TYPE.display, fontWeight: 600, fontSize: 56, lineHeight: 1.0, letterSpacing: 1.5, color: '#f7f5ef' }}>{upper(text)}</div>
          {tr ? <div style={{ fontFamily: DIARY_TYPE.display, fontWeight: 500, fontSize: 40, lineHeight: 1.05, letterSpacing: 1.5, color: '#bdb8ad', marginTop: 8 }}>{upper(tr)}</div> : null}
        </div>
      </div>
    </div>
  );
};

/** Where we are in the 48 hours: day · time, top-left, small and documentary. */
export const TimeStamp: React.FC<{ frame: number; fps: number; text: string }> = ({ frame, fps, text }) => {
  const k = interpolate(frame, [0, 6, fps * 1.8, fps * 2.1], [0, 1, 1, 0], clamp);
  return (
    <div style={{ position: 'absolute', top: 210, left: 70, fontFamily: DIARY_TYPE.text, fontWeight: 650, fontSize: 32, letterSpacing: 6, color: '#fffdf6', textShadow: '0 2px 12px #000c', opacity: k, pointerEvents: 'none' }}>
      {upper(text)}
    </div>
  );
};
