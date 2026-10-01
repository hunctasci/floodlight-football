import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { upper } from '../graphics/case';
import { DIARY_TYPE } from './type';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export interface TVScore {
  home: string;
  away: string;
  hs: number;
  as: number;
  /** Match clock on the scoreboard ("88'"). */
  clock: string;
  /** Place · date line ("Brussels · 19.06.2000"). */
  line: string;
  /** Era of the TV picture: CRT (2000) or a flat panel (2010). */
  era?: 'crt' | 'hd';
}

/**
 * A remembered broadcast: an original HNC scoreboard over a soft, distant pitch —
 * how the kids saw these nights. No competition marks, no real broadcast package.
 * Used full-frame (TV inserts) and as the still on the living-room TVs (diaries-ui).
 */
export const TVScoreboard: React.FC<{ score: TVScore; frame?: number }> = ({ score, frame = 0 }) => {
  const crt = (score.era ?? 'crt') === 'crt';
  const roll = (frame * 3) % 1920;
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 55%, #3d7f45 0%, #1f4a28 55%, #0c1f12 100%)', overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 90px, transparent 90px 180px)' }} />
      <div style={{ position: 'absolute', top: 820, left: 0, right: 0, height: 6, background: '#ffffff55' }} />
      <div style={{ position: 'absolute', top: 260, left: 70, display: 'flex', alignItems: 'stretch', fontFamily: DIARY_TYPE.display, fontWeight: 600, boxShadow: '0 10px 40px #0008' }}>
        <div style={{ background: '#101b31', color: '#f8efdb', fontSize: 64, padding: '10px 26px', letterSpacing: 3 }}>{upper(score.home)}</div>
        <div style={{ background: '#f8efdb', color: '#101b31', fontSize: 64, padding: '10px 26px', letterSpacing: 4 }}>
          {score.hs}–{score.as}
        </div>
        <div style={{ background: '#101b31', color: '#f8efdb', fontSize: 64, padding: '10px 26px', letterSpacing: 3 }}>{upper(score.away)}</div>
        <div style={{ background: '#e30a17', color: '#fff', fontSize: 52, padding: '16px 20px', fontFamily: DIARY_TYPE.text, fontWeight: 700 }}>{score.clock}</div>
      </div>
      <div style={{ position: 'absolute', top: 372, left: 70, fontFamily: DIARY_TYPE.text, fontWeight: 600, fontSize: 34, letterSpacing: 6, color: '#f8efdbcc' }}>{upper(score.line)}</div>
      {crt ? (
        <>
          <AbsoluteFill style={{ background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.22) 0 3px, transparent 3px 6px)', mixBlendMode: 'multiply' }} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: roll - 200, height: 200, background: 'linear-gradient(transparent, rgba(255,255,255,0.06), transparent)' }} />
          <AbsoluteFill style={{ boxShadow: 'inset 0 0 260px 80px #000c' }} />
        </>
      ) : (
        <AbsoluteFill style={{ boxShadow: 'inset 0 0 160px 30px #0008' }} />
      )}
    </AbsoluteFill>
  );
};

/** Documentary lower third: who is speaking, the first time we meet them. */
export const Super: React.FC<{ frame: number; fps: number; title: string; sub: string; side: 'left' | 'right'; color: string; frames: number }> = ({ frame, fps, title, sub, side, color, frames }) => {
  const k = interpolate(frame, [0, 10], [0, 1], clamp) * interpolate(frame, [frames - 10, frames], [1, 0], clamp);
  return (
    <div style={{ position: 'absolute', bottom: 560, [side]: 70, textAlign: side, opacity: k, transform: `translateX(${(1 - k) * (side === 'left' ? -24 : 24)}px)`, pointerEvents: 'none' }}>
      <div style={{ display: 'inline-block', height: 4, width: 64, background: color, marginBottom: 12 }} />
      <div style={{ fontFamily: DIARY_TYPE.display, fontWeight: 600, fontSize: 56, letterSpacing: 4, color: '#f7f5ef', textShadow: '0 2px 16px #000c' }}>{upper(title)}</div>
      <div style={{ fontFamily: DIARY_TYPE.text, fontWeight: 600, fontSize: 28, letterSpacing: 6, color: '#d8d4ca', textShadow: '0 2px 12px #000c' }}>{upper(sub)}</div>
    </div>
  );
};

/**
 * Period looks applied in the edit over a plate (one picture language for every source):
 * `archive` = a 1950s newsreel (sepia, 4:3 gate, flicker, dust); `memory` = the warm, soft video of 2000.
 */
export const lookFilter = (look: string | undefined, frame: number): React.CSSProperties => {
  if (look === 'archive') return { filter: `sepia(0.9) contrast(1.15) brightness(${0.92 + 0.06 * Math.sin(frame * 1.7) * Math.sin(frame * 0.53)}) saturate(0.6) blur(0.6px)` };
  if (look === 'memory') return { filter: 'saturate(0.82) contrast(0.94) brightness(1.03) sepia(0.18) blur(0.4px)' };
  return {};
};

/** The 4:3 newsreel gate + dust for `archive` shots. */
export const ArchiveGate: React.FC<{ frame: number }> = ({ frame }) => {
  const dust = Array.from({ length: 6 }, (_, i) => {
    const s = Math.sin(frame * 12.9898 + i * 78.233) * 43758.5453;
    const r = s - Math.floor(s);
    return { x: 80 + r * 920, y: 560 + ((r * 7919) % 1) * 800, w: 1 + (i % 3), h: 20 + r * 160, o: r > 0.55 ? 0.5 : 0 };
  });
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {/* 4:3 picture centred in the vertical frame */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 555, background: '#050505' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 555, background: '#050505' }} />
      {dust.map((d, i) => (
        <div key={i} style={{ position: 'absolute', left: d.x, top: d.y, width: d.w, height: d.h, background: '#f3ead2', opacity: d.o }} />
      ))}
    </AbsoluteFill>
  );
};

/** Full-frame TV insert: the 4:3 broadcast glowing in a dark room, as it is remembered. */
export const TVInRoom: React.FC<{ score: TVScore; frame: number }> = ({ score, frame }) => {
  const w = 1000;
  const k = w / 1440;
  const flick = 0.92 + 0.08 * Math.sin(frame * 0.9) * Math.sin(frame * 0.37);
  return (
    // a slow push toward the screen (~6% over 5 s): the memory draws you in, nothing holds still
    <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 46%, #1b2433 0%, #07090d 58%, #020203 100%)', alignItems: 'center', justifyContent: 'center', transform: `scale(${1 + 0.0004 * frame})` }}>
      <div style={{ position: 'absolute', width: w + 140, height: 1080 * k + 140, borderRadius: 60, background: '#16171a', boxShadow: `0 0 ${220 * flick}px ${60 * flick}px rgba(150,185,255,0.18)` }} />
      <div style={{ position: 'relative', width: w, height: 1080 * k, borderRadius: (score.era ?? 'crt') === 'crt' ? 46 : 8, overflow: 'hidden', opacity: flick }}>
        <div style={{ width: 1440, height: 1080, transform: `scale(${k})`, transformOrigin: '0 0' }}>
          <TVScoreboard score={score} frame={frame} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
