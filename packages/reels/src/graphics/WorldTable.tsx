import React from 'react';
import { interpolate, spring } from 'remotion';
import { HNC_UI, SAFE } from './hnc-ui';
import { countryFlag, countryName } from '../football/data/countries';

export interface WorldTableRow {
  code: string;
  points: number;
}

const ROW_H = 104;

/**
 * League beat: the game's weekly WORLD TABLE (menu-views.ts / menu.css
 * .league-preview + .mini-standings: THE WEEKLY RACE eyebrow, Impact title,
 * rank / flag / country / points rows, YOU tag, +3 WIN key) with the hero
 * nation climbing one place after the win. Rows are illustrative promo
 * values, not live standings. Global-frame anchored.
 */
export const WorldTable: React.FC<{
  frame: number;
  fps: number;
  rows: WorldTableRow[];
  hero: string;
  gain: number;
  enterAt: number;
  climbAt: number;
  exitAt?: number;
  lines: [string, string];
}> = ({ frame, fps, rows, hero, gain, enterAt, climbAt, exitAt, lines }) => {
  const since = frame - enterAt;
  if (since < 0) return null;
  // Lift away before the end card so the cut never pops a panel.
  const out = exitAt === undefined ? 0 : interpolate(frame, [exitAt - 10, exitAt], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const line = (i: number) => spring({ frame: since - i * 5, fps, config: { damping: 18, stiffness: 170 } });
  const panel = spring({ frame: since - 10, fps, config: { damping: 17, stiffness: 150 } });
  const climb = spring({ frame: frame - climbAt, fps, config: { damping: 14, stiffness: 140 } });
  const heroIdx = rows.findIndex((r) => r.code === hero);
  const points = (r: WorldTableRow) =>
    r.code === hero ? Math.round(r.points + gain * interpolate(frame - climbAt, [0, 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })) : r.points;
  // Final order after the win (points desc, stable).
  const finalOrder = rows
    .map((r, i) => ({ r, i, p: r.code === hero ? r.points + gain : r.points }))
    .sort((a, b) => b.p - a.p || a.i - b.i)
    .map((x) => x.i);
  const slotOf = (i: number) => {
    const to = finalOrder.indexOf(i);
    return i + (to - i) * climb;
  };
  const chip = frame >= climbAt ? spring({ frame: frame - climbAt - 4, fps, config: { damping: 10, stiffness: 220 } }) : 0;

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: 1 - out, transform: `translateY(${-out * 120}px)` }}>
      <div style={{ position: 'absolute', top: SAFE.top + 70, left: SAFE.left + 30, right: SAFE.left + 30 }}>
        {lines.map((l, i) => (
          <div key={l} style={{ overflow: 'hidden' }}>
            <div
              style={{
                fontFamily: HNC_UI.display,
                fontSize: 150,
                lineHeight: 1.0,
                letterSpacing: '-0.015em',
                color: i === 1 ? HNC_UI.gold : HNC_UI.cream,
                textShadow: HNC_UI.hardShadow,
                transform: `translateY(${(1 - line(i)) * 110}%)`,
              }}
            >
              {l}
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          position: 'absolute',
          top: 760,
          left: SAFE.left + 30,
          right: SAFE.left + 30,
          background: `${HNC_UI.ink}f5`,
          border: `2px solid ${HNC_UI.line}`,
          borderTop: `8px solid ${HNC_UI.gold}`,
          boxShadow: '16px 16px 0 #0005',
          padding: '34px 40px 30px',
          transform: `translateY(${(1 - panel) * 260}px)`,
          opacity: Math.min(1, panel * 1.6),
          color: HNC_UI.cream,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: HNC_UI.mono, fontSize: 22, letterSpacing: '0.15em', color: HNC_UI.gold }}>THE WEEKLY RACE</div>
            <div style={{ fontFamily: HNC_UI.display, fontSize: 66, letterSpacing: '0.02em', marginTop: 6 }}>WORLD TABLE</div>
          </div>
          <div style={{ border: `2px solid ${HNC_UI.line}`, padding: '12px 16px', fontFamily: HNC_UI.mono, fontSize: 20, letterSpacing: '0.04em', color: HNC_UI.muted }}>
            WEEKLY SEASON
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: HNC_UI.mono, fontSize: 19, letterSpacing: '0.08em', color: HNC_UI.muted, marginTop: 22 }}>
          <span>COUNTRY</span>
          <span>POINTS</span>
        </div>
        <div style={{ position: 'relative', height: rows.length * ROW_H, marginTop: 10 }}>
          {rows.map((r, i) => {
            const isHero = i === heroIdx;
            const slot = slotOf(i);
            const rowIn = spring({ frame: since - 16 - i * 3, fps, config: { damping: 18, stiffness: 190 } });
            const rank = String(Math.round(slot) + 1).padStart(2, '0');
            return (
              <div
                key={r.code}
                style={{
                  position: 'absolute',
                  left: -12,
                  right: -12,
                  top: slot * ROW_H,
                  height: ROW_H,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 22,
                  padding: '0 12px',
                  borderTop: isHero ? `2px solid ${HNC_UI.gold}66` : `2px solid ${HNC_UI.line}`,
                  borderBottom: isHero ? `2px solid ${HNC_UI.gold}66` : undefined,
                  background: isHero ? `${HNC_UI.gold}14` : 'transparent',
                  zIndex: isHero ? 2 : 1,
                  opacity: rowIn,
                  transform: `translateX(${(1 - rowIn) * 60}px)`,
                }}
              >
                <div style={{ minWidth: 46, fontFamily: HNC_UI.mono, fontSize: 28, color: isHero ? HNC_UI.gold : HNC_UI.muted }}>{rank}</div>
                <div style={{ fontSize: 56, lineHeight: 1 }}>{countryFlag(r.code)}</div>
                <div style={{ flex: 1, fontFamily: HNC_UI.body, fontWeight: 600, fontSize: 38, whiteSpace: 'nowrap' }}>
                  {countryName(r.code)}
                  {isHero ? (
                    <span style={{ marginLeft: 14, background: HNC_UI.gold, color: HNC_UI.ink, fontFamily: HNC_UI.mono, fontWeight: 800, fontSize: 18, padding: '2px 8px', verticalAlign: 'middle' }}>YOU</span>
                  ) : null}
                </div>
                {isHero && chip > 0 ? (
                  <div style={{ fontFamily: HNC_UI.mono, fontWeight: 800, fontSize: 26, color: HNC_UI.ink, background: HNC_UI.gold, padding: '4px 10px', transform: `scale(${chip})` }}>+{gain}</div>
                ) : null}
                <div style={{ fontWeight: 900, fontFamily: HNC_UI.mono, fontSize: 44, minWidth: 150, textAlign: 'right' }}>
                  {points(r)}
                  <span style={{ fontSize: 18, fontWeight: 400, color: HNC_UI.muted, marginLeft: 8 }}>PTS</span>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 30, marginTop: 24, fontFamily: HNC_UI.mono, fontSize: 19, color: HNC_UI.muted }}>
          <span><b style={{ color: HNC_UI.gold, fontSize: 26 }}>+3</b> WIN</span>
          <span><b style={{ color: HNC_UI.gold, fontSize: 26 }}>+1</b> DRAW</span>
          <span>ONE SHARED RANK</span>
        </div>
      </div>
    </div>
  );
};
