import React from 'react';
import { Img, interpolate, spring, staticFile } from 'remotion';
import { getAsset } from '../assets/registry';
import { HNC_UI, SAFE } from './hnc-ui';

/**
 * End card: the real HNC League badge (asset `hnc-logo`, single-sourced from
 * the game's icon) lands with a floodlight glint, the three-word promise
 * punches in on a beat each, then the site in the game's gold CTA button.
 * The last ~1.2s holds still so the URL registers.
 */
export const BrandReveal: React.FC<{
  frame: number;
  fps: number;
  at: number;
  words: string[];
  site: string;
  footer?: string;
}> = ({ frame, fps, at, words, site, footer }) => {
  const since = frame - at;
  if (since < 0) return null;
  const badge = spring({ frame: since, fps, config: { damping: 12, stiffness: 150, mass: 0.9 } });
  const glintX = interpolate(since, [14, 40], [-120, 220], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const wordAt = (i: number) => 18 + i * 9;
  const button = spring({ frame: since - wordAt(words.length) - 2, fps, config: { damping: 15, stiffness: 170 } });
  const footerIn = interpolate(since, [wordAt(words.length) + 10, wordAt(words.length) + 24], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const logo = staticFile(`assets/${getAsset('hnc-logo').file}`);
  const size = 470;
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: SAFE.top + 40 }}>
      <div
        style={{
          width: size,
          height: size,
          position: 'relative',
          transform: `scale(${interpolate(badge, [0, 1], [0.55, 1])}) rotate(${interpolate(badge, [0, 1], [-8, 0])}deg)`,
          opacity: Math.min(1, badge * 2),
          filter: 'drop-shadow(0 18px 30px #000a)',
        }}
      >
        <Img src={logo} style={{ width: size, height: size }} />
        {/* Glint clipped to the circular badge (floodlight sweep). */}
        <div style={{ position: 'absolute', inset: size * 0.08, borderRadius: '50%', overflow: 'hidden', mixBlendMode: 'screen' }}>
          <div
            style={{
              position: 'absolute',
              top: '-20%',
              bottom: '-20%',
              width: '34%',
              left: `${glintX}%`,
              transform: 'skewX(-18deg)',
              background: 'linear-gradient(90deg, transparent, #fff6d855, #ffffffaa, #fff6d855, transparent)',
            }}
          />
        </div>
      </div>
      <div style={{ marginTop: 34, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {words.map((w, i) => {
          const s = spring({ frame: since - wordAt(i), fps, config: { damping: 11, stiffness: 240, mass: 0.7 } });
          const last = i === words.length - 1;
          return (
            <div
              key={w}
              style={{
                fontFamily: HNC_UI.display,
                fontSize: 132,
                lineHeight: 1.0,
                letterSpacing: '0.01em',
                color: last ? HNC_UI.gold : HNC_UI.cream,
                textShadow: HNC_UI.hardShadow,
                opacity: Math.min(1, s * 2),
                transform: `scale(${interpolate(s, [0, 1], [1.7, 1])})`,
              }}
            >
              {w}
            </div>
          );
        })}
      </div>
      <div
        style={{
          marginTop: 40,
          background: HNC_UI.gold,
          color: HNC_UI.ink,
          fontFamily: HNC_UI.mono,
          fontWeight: 900,
          fontSize: 44,
          padding: '24px 40px',
          display: 'flex',
          gap: 34,
          alignItems: 'center',
          boxShadow: '12px 12px 0 #0006',
          transform: `translateY(${(1 - button) * 90}px)`,
          opacity: Math.min(1, button * 1.8),
        }}
      >
        <span>{site}</span>
        <span style={{ fontSize: 50, lineHeight: 1 }}>→</span>
      </div>
      {footer ? (
        <div style={{ marginTop: 34, fontFamily: HNC_UI.mono, fontSize: 22, letterSpacing: '0.12em', color: HNC_UI.muted, opacity: footerIn }}>
          {footer}
        </div>
      ) : null}
    </div>
  );
};
