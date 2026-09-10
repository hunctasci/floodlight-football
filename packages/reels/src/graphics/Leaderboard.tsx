import React from 'react';
import { countryColors, countryFlag, countryName } from '../football/data/countries';

/** HNC leaderboard card: Greece above Türkiye etc. Semantic props only. */
export const Leaderboard: React.FC<{ home: string; away: string; leader?: string }> = ({ home, away, leader }) => {
  const rows = [leader === home ? home : away, leader === home ? away : home];
  // Default demo points: leader 3pts clear (story-readable, not live data).
  const points = leader ? [12, 9] : [9, 9];
  return (
    <div style={{ position: 'absolute', right: 60, top: 640, width: 460, backgroundColor: 'rgba(10,18,35,0.92)', borderRadius: 18, border: '3px solid #f8cc54', overflow: 'hidden' }}>
      <div style={{ backgroundColor: '#f8cc54', color: '#101b31', fontWeight: 900, fontSize: 30, padding: '10px 18px', letterSpacing: 1 }}>HNC LEAGUE</div>
      {rows.map((code, i) => {
        const c = countryColors(code);
        return (
          <div key={code} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', backgroundColor: i === 0 ? 'rgba(248,204,84,0.16)' : 'transparent' }}>
            <div style={{ fontSize: 30, fontWeight: 900, color: '#8fa0b8', width: 40 }}>{i + 1}</div>
            <div style={{ fontSize: 44 }}>{countryFlag(code)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#fff' }}>{countryName(code).toUpperCase()}</div>
              <div style={{ height: 8, borderRadius: 4, backgroundColor: '#22314d', marginTop: 6 }}>
                <div style={{ width: `${70 - i * 18}%`, height: '100%', borderRadius: 4, backgroundColor: c.primary }} />
              </div>
            </div>
            <div style={{ fontSize: 34, fontWeight: 900, color: '#f8cc54' }}>{points[i]}</div>
          </div>
        );
      })}
    </div>
  );
};
