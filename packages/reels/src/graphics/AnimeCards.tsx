import React from 'react';
import { interpolate } from 'remotion';
import { countryFlag, countryName } from '../cast/countries';
import { CURRENT_WHITE, currentColor, rgba } from '../effects/current';
import { useLayout } from '../render/layout';
import { upper } from './case';
import { HNC_UI } from './hnc-ui';

/**
 * THE CURRENT — anime-opening type (reusable for any HNC nation):
 *   TechniqueCard  a move name slams in behind one slash (TECHNIQUE eyebrow,
 *                  country chip, huge italic name with a coloured ghost)
 *   CharacterCard  character intro: name, nation · number, their Current
 * Both are global-frame anchored and exit before `end`.
 */

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export const TechniqueCard: React.FC<{
  frame: number;
  fps: number;
  at: number;
  end: number;
  name: string;
  country: string;
  owner?: string;
  kicker?: string;
  place?: 'top' | 'center' | 'bottom';
}> = ({ frame, fps, at, end, name, country, owner, kicker = 'TECHNIQUE', place = 'center' }) => {
  const { width: W, height: H, safe } = useLayout();
  const k = (frame - at) * (60 / fps);
  if (k < 0 || frame >= end) return null;
  const color = currentColor(country);
  const slash = interpolate(k, [0, 7], [0, 1], clamp);
  const settle = interpolate(k, [0, 5, 12], [1.35, 0.96, 1], clamp);
  const out = interpolate(frame, [end - 6, end], [0, 1], clamp);
  const ghost = interpolate(k, [0, 4, 16], [26, 14, 6], clamp);
  // Two-word names stack (CRESCENT / CUT); size from the longest line (~0.66 em per Futura bold italic cap).
  const lines = name.includes(' ') && name.length > 9 ? name.split(' ') : [name];
  const longest = Math.max(...lines.map((l) => l.length));
  const size = Math.min(190, (W - 190) / Math.max(4, longest * 0.66));
  const top = place === 'top' ? safe.top + 40 : place === 'bottom' ? H - safe.bottom - 150 - size * 0.95 * lines.length : H * 0.36;
  const reveal = `polygon(0 0, ${slash * 118}% 0, ${slash * 118 - 18}% 100%, 0 100%)`;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top, opacity: 1 - out, transform: `translateX(${out * 60}px)` }}>
      {/* the slash itself: a bright bar that crosses once */}
      <div style={{ position: 'absolute', left: -40, width: W + 80, top: size * 0.45, height: 10, background: `linear-gradient(90deg, transparent, ${color} 30%, ${CURRENT_WHITE} 50%, ${color} 70%, transparent)`, transform: `translateX(${(slash - 1) * W}px) skewX(-30deg)`, opacity: 1 - interpolate(k, [6, 14], [0, 1], clamp) }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, paddingLeft: 84, marginBottom: 6, opacity: interpolate(k, [3, 8], [0, 1], clamp) }}>
        <span style={{ fontSize: 46 }}>{countryFlag(country)}</span>
        <span style={{ fontFamily: HNC_UI.mono, fontSize: 30, letterSpacing: '0.42em', color: CURRENT_WHITE }}>{upper(kicker)}</span>
        <span style={{ height: 4, width: 160, background: color }} />
      </div>
      <div style={{ position: 'relative', clipPath: reveal, transform: `scale(${settle}) skewX(-9deg)`, transformOrigin: '20% 50%', paddingLeft: 70 }}>
        <div style={{ position: 'absolute', left: 70 + ghost, top: 0, fontFamily: HNC_UI.headline, fontWeight: 900, fontStyle: 'italic', fontSize: size, lineHeight: 0.95, color: rgba(color, 0.75), whiteSpace: 'pre' }}>{upper(lines.join('\n'))}</div>
        <div style={{ position: 'relative', fontFamily: HNC_UI.headline, fontWeight: 900, fontStyle: 'italic', fontSize: size, lineHeight: 0.95, color: CURRENT_WHITE, whiteSpace: 'pre', textShadow: `0 0 28px ${rgba(color, 0.9)}, 0 0 70px ${rgba(color, 0.6)}, 6px 6px 0 ${HNC_UI.ink}` }}>{upper(lines.join('\n'))}</div>
      </div>
      {owner ? (
        <div style={{ paddingLeft: 96, marginTop: 14, fontFamily: HNC_UI.broadcast, fontSize: 40, letterSpacing: '0.18em', color: HNC_UI.cream, opacity: interpolate(k, [8, 14], [0, 1], clamp) }}>{upper(owner)}</div>
      ) : null}
    </div>
  );
};

export const CharacterCard: React.FC<{
  frame: number;
  fps: number;
  at: number;
  end: number;
  name: string;
  country: string;
  number: number;
  current: string;
  side?: 'left' | 'right';
}> = ({ frame, fps, at, end, name, country, number, current, side = 'left' }) => {
  const { width: W, height: H, safe } = useLayout();
  const k = (frame - at) * (60 / fps);
  if (k < 0 || frame >= end) return null;
  const color = currentColor(country);
  const out = interpolate(frame, [end - 6, end], [0, 1], clamp);
  const bar = interpolate(k, [0, 10], [0, 1], clamp);
  const rise = (d: number) => interpolate(k, [d, d + 9], [1, 0], clamp);
  const align = side === 'left' ? 'flex-start' : 'flex-end';
  const pad = side === 'left' ? { paddingLeft: safe.left + 10 } : { paddingRight: safe.right + 10 };
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: H - safe.bottom - 470, display: 'flex', flexDirection: 'column', alignItems: align, ...pad, opacity: 1 - out }}>
      <div style={{ overflow: 'hidden' }}>
        <div style={{ fontFamily: HNC_UI.mono, fontSize: 28, letterSpacing: '0.4em', color, transform: `translateY(${rise(2) * 40}px)` }}>{upper(current)}</div>
      </div>
      <div style={{ overflow: 'hidden', marginTop: 4 }}>
        <div style={{ fontFamily: HNC_UI.headline, fontWeight: 900, fontSize: 200, lineHeight: 0.92, color: CURRENT_WHITE, textShadow: `0 0 40px ${rgba(color, 0.55)}, 6px 6px 0 ${HNC_UI.ink}`, transform: `translateY(${rise(0) * 200}px)` }}>{upper(name)}</div>
      </div>
      <div style={{ height: 8, width: 560 * bar, background: `linear-gradient(90deg, ${color}, ${CURRENT_WHITE})`, margin: '14px 0 16px', boxShadow: `0 0 24px ${rgba(color, 0.9)}` }} />
      <div style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontFamily: HNC_UI.broadcast, fontSize: 54, letterSpacing: '0.12em', color: HNC_UI.cream, transform: `translateY(${rise(5) * 70}px)` }}>
          <span style={{ fontSize: 50 }}>{countryFlag(country)}</span>
          <span>{upper(countryName(country))}</span>
          <span style={{ color }}>·</span>
          <span>№{number}</span>
        </div>
      </div>
    </div>
  );
};
