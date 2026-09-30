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
