import React from 'react';
import { AbsoluteFill, interpolate, spring } from 'remotion';
import { upper } from '../graphics/case';
import { DIARY_TYPE } from './type';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export interface OpenerBeat {
  /** Seconds from the start of the shot. */
  at: number;
  en: string;
  tr: string;
  /** big = a number that slams; title = the last beat, holds. */
  kind?: 'big' | 'title';
}

/**
 * The scroll-stopper: kinetic stat cards, English over Turkish, slamming in on the
 * edit's sub-hits — the 69-year record in five beats, ending on the title. Frame 0 is
 * already a full card (no fade-in): the first frame is the thumbnail and the hook.
 */
export const StatsOpener: React.FC<{ frame: number; fps: number; beats: OpenerBeat[] }> = ({ frame, fps, beats }) => {
  const t = frame / fps;
  const i = Math.max(0, beats.findIndex((b, k) => t >= b.at && (k === beats.length - 1 || t < beats[k + 1].at)));
  const b = beats[i];
  const local = Math.max(0, frame - Math.round(b.at * fps));
  const slam = i === 0 ? 1 : spring({ frame: local, fps, config: { damping: 14, stiffness: 320, mass: 0.6 } });
  const scale = interpolate(slam, [0, 1], [1.35, 1]);
  const title = b.kind === 'title';
  const flare = interpolate(local, [0, 0.6 * fps], [-40, 140], clamp);
  return (
    <AbsoluteFill style={{ background: '#040405', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '40%', left: `${flare}%`, width: 1100, height: 220, transform: 'translate(-50%, -50%) rotate(-9deg)', background: 'radial-gradient(ellipse at center, #fff6dc44 0%, #ffffff0d 40%, transparent 72%)', filter: 'blur(10px)' }} />
      {/* the two flags' colours bleeding in from the sides: the rivalry in one frame */}
      <div style={{ position: 'absolute', left: -220, top: 0, bottom: 0, width: 420, background: 'radial-gradient(ellipse at left, #e30a1733, transparent 70%)' }} />
      <div style={{ position: 'absolute', right: -220, top: 0, bottom: 0, width: 420, background: 'radial-gradient(ellipse at right, #f4c20d2e, transparent 70%)' }} />
      <div style={{ textAlign: 'center', transform: `scale(${scale})`, opacity: Math.min(1, slam * 1.4), padding: '0 60px' }}>
        {/* one line per beat: long beats (the flags + score) shrink to fit the 9:16 width */}
        <div style={{ fontFamily: DIARY_TYPE.display, fontWeight: 600, fontSize: title ? 128 : b.kind === 'big' ? ([...b.en].length > 9 ? 170 : 230) : 150, lineHeight: 0.95, letterSpacing: title ? 6 : 4, color: '#f7f5ef', whiteSpace: title ? 'normal' : 'nowrap' }}>{upper(b.en)}</div>
        <div style={{ height: 4, width: 140, margin: '30px auto 26px', background: 'linear-gradient(90deg, #e30a17 50%, #f4c20d 50%)' }} />
        <div style={{ fontFamily: DIARY_TYPE.display, fontWeight: 500, fontSize: title ? 74 : 84, letterSpacing: 5, color: '#c9c4b8' }}>{upper(b.tr)}</div>
        {title ? <div style={{ fontFamily: DIARY_TYPE.text, fontWeight: 600, fontSize: 28, letterSpacing: 9, color: '#8f8b82', marginTop: 34 }}>HNC PLAYER DIARIES · EPISODE 01</div> : null}
      </div>
    </AbsoluteFill>
  );
};

/** One kinetic beat over a football plate: slams in on the cut, a scrim keeps it legible. */
export const KineticOver: React.FC<{ frame: number; fps: number; en: string; tr: string; sub?: string }> = ({ frame, fps, en, tr, sub }) => {
  const slam = frame === 0 ? 1 : spring({ frame, fps, config: { damping: 14, stiffness: 320, mass: 0.6 } });
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', background: 'linear-gradient(transparent 22%, #000a 42%, #000a 62%, transparent 82%)' }}>
      <div style={{ textAlign: 'center', transform: `scale(${interpolate(slam, [0, 1], [1.3, 1])})`, opacity: Math.min(1, slam * 1.4), padding: '0 50px' }}>
        <div style={{ fontFamily: DIARY_TYPE.display, fontWeight: 600, fontSize: [...en].length > 16 ? 104 : 140, lineHeight: 0.98, letterSpacing: 4, color: '#f7f5ef', textShadow: '0 6px 40px #000c' }}>{upper(en)}</div>
        <div style={{ height: 4, width: 140, margin: '24px auto 20px', background: 'linear-gradient(90deg, #e30a17 50%, #f4c20d 50%)' }} />
        <div style={{ fontFamily: DIARY_TYPE.display, fontWeight: 500, fontSize: [...tr].length > 22 ? 58 : 72, letterSpacing: 4, color: '#dcd7cb', textShadow: '0 4px 30px #000c' }}>{upper(tr)}</div>
        {sub ? <div style={{ fontFamily: DIARY_TYPE.text, fontWeight: 650, fontSize: 32, letterSpacing: 8, color: '#f4c20d', marginTop: 26 }}>{upper(sub)}</div> : null}
      </div>
    </AbsoluteFill>
  );
};
