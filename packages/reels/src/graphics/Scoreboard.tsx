import React from 'react';
import { interpolate, spring } from 'remotion';
import { HNC_UI } from './hnc-ui';
import { useLayout } from '../render/layout';

/**
 * The in-game HUD scoreboard (style.css .scoreboard: cream box, navy border,
 * gold offset shadow, Impact score cell, orange clock) at portrait scale.
 * All timing is global-frame anchored so the board stays continuous across
 * shot cuts: it drops in once (`enterAt`) and flips the score at `flipAt`.
 */
export const Scoreboard: React.FC<{
  frame: number;
  fps: number;
  home: string;
  away: string;
  before: [number, number];
  after?: [number, number];
  clock: string;
  enterAt?: number;
  flipAt?: number;
}> = ({ frame, fps, home, away, before, after, clock, enterAt, flipAt }) => {
  const { safe: SAFE } = useLayout();
  const enter = enterAt === undefined ? 1 : spring({ frame: frame - enterAt, fps, config: { damping: 16, stiffness: 180 } });
  const flipped = after !== undefined && flipAt !== undefined && frame >= flipAt;
  const score = flipped ? after! : before;
  const since = flipAt === undefined ? -1 : frame - flipAt;
  const pop = since >= 0 ? 1 + 0.35 * Math.exp(-since / 5) * Math.cos(since / 2.2) : 1;
  const flash = since >= 0 ? interpolate(since, [0, 14], [1, 0], { extrapolateRight: 'clamp' }) : 0;
  const club: React.CSSProperties = {
    padding: '18px 26px',
    minWidth: 150,
    textAlign: 'center',
    fontWeight: 900,
    fontFamily: HNC_UI.mono,
    fontSize: 38,
    letterSpacing: '0.04em',
  };
  return (
    <div
      style={{
        position: 'absolute',
        top: SAFE.top + 20,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        transform: `translateY(${(1 - enter) * -220}px)`,
        opacity: Math.min(1, enter * 1.5),
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          background: HNC_UI.cream,
          color: HNC_UI.navy,
          border: `8px solid ${HNC_UI.navy}`,
          boxShadow: `8px 8px 0 ${HNC_UI.gold}`,
          whiteSpace: 'nowrap',
        }}
      >
        <div style={club}>{home}</div>
        <div
          style={{
            fontFamily: HNC_UI.display,
            fontSize: 56,
            padding: '6px 24px',
            background: flash > 0 ? `color-mix(in srgb, ${HNC_UI.cream} ${Math.round(flash * 100)}%, ${HNC_UI.gold})` : HNC_UI.gold,
            display: 'flex',
            alignItems: 'center',
            transform: `scale(${pop})`,
          }}
        >
          {score[0]} – {score[1]}
        </div>
        <div style={club}>{away}</div>
        <div
          style={{
            fontFamily: HNC_UI.mono,
            fontSize: 26,
            padding: '0 18px',
            minWidth: 130,
            background: HNC_UI.orange,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {clock}
        </div>
      </div>
    </div>
  );
};
