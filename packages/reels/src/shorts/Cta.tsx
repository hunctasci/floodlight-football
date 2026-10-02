import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { HNC_BRAND } from '../graphics/branding';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/**
 * Reusable short-form CTA — ~0.8–1.5 s. Configurable per reel, HNC branding
 * subtle (URL as visual, never a spoken ad). Supports the three launch lines:
 * "WHO ARE YOU SENDING THIS TO?", "PICK YOUR SIDE", "WHAT SHOULD VAR CHECK NEXT?".
 */
export const ShortCta: React.FC<{ headline: string; subline?: string; showUrl?: boolean }> = ({ headline, subline, showUrl = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 17, stiffness: 200, mass: 0.8 } });
  const fade = interpolate(frame, [0, Math.min(10, fps * 0.2)], [0, 1], clamp);
  const t = frame / fps;
  const pulse = 1 + 0.02 * Math.sin(t * Math.PI * 2 * 1.6);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, opacity: fade, pointerEvents: 'none' }}>
      <div
        style={{
          transform: `translateY(${interpolate(pop, [0, 1], [36, 0])}px) scale(${pop * pulse})`,
          background: HNC_BRAND.colors.navy,
          border: `3px solid ${HNC_BRAND.colors.gold}`,
          borderRadius: 999,
          padding: '22px 56px',
          fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif",
          fontWeight: 600,
          fontSize: 62,
          letterSpacing: 4,
          color: '#fff',
          textAlign: 'center',
          boxShadow: '0 14px 44px #000a',
          maxWidth: 920,
        }}
      >
        {headline}
      </div>
      {subline ? (
        <div style={{ fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 600, fontSize: 34, color: '#f8efdb', textShadow: '0 2px 14px #000c', opacity: pop }}>
          {subline}
        </div>
      ) : null}
      {showUrl ? (
        <div style={{ fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 600, fontSize: 30, letterSpacing: 6, color: '#f8efdb99', opacity: pop }}>
          HNCLEAGUE.COM
        </div>
      ) : null}
    </div>
  );
};
