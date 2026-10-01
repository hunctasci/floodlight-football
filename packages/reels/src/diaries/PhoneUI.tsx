import React from 'react';
import { AbsoluteFill } from 'remotion';
import { WorldTable } from '../graphics/WorldTable';
import { DIARY_TYPE, useDiaryFonts } from './type';

/**
 * The phone screen in the interview inserts: the game's World Table (the
 * canonical graphic), rendered as a still that Blender maps onto the phone
 * (hybrid shot S09_SH08). Illustrative standings, and it says so.
 */
export const DiariesPhoneUI: React.FC = () => {
  useDiaryFonts();
  return (
    <AbsoluteFill style={{ background: '#0b1526' }}>
      <div style={{ position: 'absolute', top: 36, left: 60, right: 60, display: 'flex', justifyContent: 'space-between', fontFamily: DIARY_TYPE.text, fontWeight: 600, fontSize: 38, color: '#e8eef2' }}>
        <span>23:14</span>
        <span>●●●● 5G ▮</span>
      </div>
      <div style={{ position: 'absolute', inset: 0, transform: 'translateY(40px)' }}>
        <WorldTable
          frame={600}
          fps={60}
          rows={[{ code: 'BR', points: 44 }, { code: 'TR', points: 41 }, { code: 'BE', points: 41 }, { code: 'DE', points: 38 }, { code: 'JP', points: 35 }]}
          hero="TR"
          gain={0}
          enterAt={0}
          climbAt={100000}
          lines={['FRIDAY.', 'AWAY IN BELGIUM.']}
          tag=""
          note="ILLUSTRATIVE STANDINGS"
        />
      </div>
    </AbsoluteFill>
  );
};

/**
 * S04_SH04 (hybrid): the dash phone's lock screen as it lights up — Mum has sent "all of it".
 * Fictional sources only (HNC Sports); Turkish contact name as in the S00 chat.
 */
export const DiariesMumLinksUI: React.FC = () => {
  useDiaryFonts();
  const links = [
    ['is türkiye’s #9 ready for belgium?', 'hncsports.tv'],
    ['5 things #9 must do on friday', 'hncsports.tv'],
    ['“he looks tired” — the panel', 'hncsports.tv'],
  ];
  return (
    <AbsoluteFill style={{ background: 'linear-gradient(170deg, #1d2a44, #0b1220 60%)', fontFamily: DIARY_TYPE.text, color: '#f2f2f7' }}>
      <div style={{ position: 'absolute', top: 210, left: 0, right: 0, textAlign: 'center', fontSize: 64, fontWeight: 500, opacity: 0.9 }}>Wednesday 30 September</div>
      <div style={{ position: 'absolute', top: 280, left: 0, right: 0, textAlign: 'center', fontSize: 300, fontWeight: 600, letterSpacing: -6 }}>09:12</div>
      <div style={{ position: 'absolute', top: 760, left: 50, right: 50, display: 'flex', flexDirection: 'column', gap: 26 }}>
        {links.map(([title, site], i) => (
          <div key={title} style={{ background: 'rgba(242,242,247,0.9)', color: '#111', borderRadius: 44, padding: '30px 40px', boxShadow: '0 12px 40px #0006', transform: `scale(${1 - i * 0.015})` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 40, color: '#555' }}>
              <span style={{ fontWeight: 700, color: '#111' }}>Annem 🇹🇷</span>
              <span>now</span>
            </div>
            <div style={{ fontSize: 50, marginTop: 8 }}>🔗 {title}</div>
            <div style={{ fontSize: 36, color: '#666', marginTop: 4 }}>{site}</div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
