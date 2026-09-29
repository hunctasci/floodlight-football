import React from 'react';
import { interpolate, spring } from 'remotion';
import { useLayout } from '../render/layout';
import { HNC_UI } from './hnc-ui';

/**
 * On-screen typography. Each style owns its entrance/exit motion so text
 * participates in the beat (words punch in on the cut, stamps slam, pinned
 * labels ride on a subject) instead of sitting there like a slide.
 */
export interface TextProps {
  text: string;
  style: string;
  frame: number;
  fps: number;
  start: number;
  end: number;
  /** Pixel anchor (pinned text) — overrides placement. */
  pin?: { x: number; y: number };
  place?: string;
  words?: boolean;
}

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

function placeY(place: string | undefined, style: string, height: number, safe: { top: number; bottom: number }): { top?: number; bottom?: number } {
  const p = place ?? (style === 'caption' || style === 'subtitle' ? 'bottom' : style === 'impact' || style === 'stamp' ? 'center' : 'top');
  if (p === 'top') return { top: safe.top + 20 };
  if (p === 'upper') return { top: height * 0.3 };
  if (p === 'center') return { top: height * 0.42 };
  if (p === 'lower') return { top: height * 0.6 };
  return { bottom: safe.bottom + 30 };
}

const WordPop: React.FC<{ text: string; frame: number; fps: number; delay?: number; color?: (i: number, n: number) => string }> = ({ text, frame, fps, delay = 3, color }) => {
  const words = text.split(/\s+/);
  return (
    <>
      {words.map((w, i) => {
        const s = spring({ frame: frame - i * delay, fps, config: { damping: 12, stiffness: 260, mass: 0.6 } });
        return (
          <span key={i} style={{ display: 'inline-block', marginRight: '0.24em', opacity: Math.min(1, s * 3), transform: `scale(${interpolate(s, [0, 1], [1.5, 1])}) translateY(${(1 - s) * 18}px)`, color: color?.(i, words.length) }}>
            {w}
          </span>
        );
      })}
    </>
  );
};

export const Text: React.FC<TextProps> = ({ text, style, frame, fps, start, end, pin, place, words }) => {
  const { width, height, safe } = useLayout();
  const local = frame - start;
  if (local < 0 || frame >= end) return null;
  const out = interpolate(frame, [end - 5, end], [1, 0], clamp);
  const inS = spring({ frame: local, fps, config: { damping: 15, stiffness: 210 } });
  const pos: React.CSSProperties = pin
    ? { position: 'absolute', left: 0, top: pin.y, width, display: 'flex', justifyContent: 'center', transform: `translateX(${pin.x - width / 2}px) translateY(-100%)` }
    : { position: 'absolute', left: safe.left, right: safe.right, ...placeY(place, style, height, safe), display: 'flex', justifyContent: 'center' };

  let body: React.ReactNode;
  switch (style) {
    case 'hook':
      body = (
        <div style={{ fontFamily: HNC_UI.display, fontSize: 104, lineHeight: 1.0, letterSpacing: '0.005em', color: HNC_UI.cream, textShadow: HNC_UI.hardShadow, textAlign: 'center', textTransform: 'uppercase' }}>
          <WordPop text={text} frame={local} fps={fps} color={(i, n) => (i === n - 1 ? HNC_UI.gold : HNC_UI.cream)} />
        </div>
      );
      break;
    case 'pov':
      // Native-app caption: white strip, black semibold text.
      body = (
        <div style={{ background: '#ffffff', color: '#111111', fontFamily: 'system-ui, -apple-system, sans-serif', fontWeight: 700, fontSize: 62, lineHeight: 1.16, padding: '18px 32px', borderRadius: 18, textAlign: 'center', maxWidth: 940, transform: `scale(${interpolate(inS, [0, 1], [0.92, 1])})`, opacity: Math.min(1, inS * 2) }}>
          {words ? <WordPop text={text} frame={local} fps={fps} delay={2} /> : text}
        </div>
      );
      break;
    case 'caption':
      body = (
        <div style={{ fontFamily: HNC_UI.display, fontSize: 84, lineHeight: 1.02, color: '#ffffff', WebkitTextStroke: '3px #0b0f17', textShadow: '0 6px 0 #0b0f17', textAlign: 'center', textTransform: 'uppercase', transform: `scale(${interpolate(inS, [0, 1], [0.7, 1])})` }}>
          {words ? <WordPop text={text} frame={local} fps={fps} /> : text}
        </div>
      );
      break;
    case 'kicker':
      body = (
        <div style={{ fontFamily: HNC_UI.mono, fontWeight: 800, fontSize: 30, letterSpacing: '0.2em', color: HNC_UI.gold, textShadow: '3px 3px 0 #101b31', transform: `translateY(${(1 - inS) * 20}px)`, opacity: inS }}>
          {text.toUpperCase()}
        </div>
      );
      break;
    case 'impact': {
      const s = spring({ frame: local, fps, config: { damping: 10, stiffness: 320, mass: 0.7 } });
      const shake = local < 8 ? Math.sin(local * 2.7) * (8 - local) * 1.4 : 0;
      body = (
        <div style={{ fontFamily: HNC_UI.display, fontSize: 200, lineHeight: 0.95, color: HNC_UI.gold, textShadow: '9px 9px 0 #101b31', textAlign: 'center', transform: `translateX(${shake}px) scale(${interpolate(s, [0, 1], [2.2, 1])})`, opacity: Math.min(1, s * 3) }}>
          {text.toUpperCase()}
        </div>
      );
      break;
    }
    case 'stamp': {
      const s = spring({ frame: local, fps, config: { damping: 13, stiffness: 400, mass: 0.8 } });
      body = (
        <div style={{ fontFamily: HNC_UI.display, fontSize: 132, lineHeight: 1, color: HNC_UI.gold, border: `12px solid ${HNC_UI.gold}`, padding: '14px 36px', background: 'rgba(16,27,49,0.55)', transform: `rotate(-9deg) scale(${interpolate(s, [0, 1], [2.6, 1])})`, opacity: Math.min(1, s * 2.5), textShadow: '6px 6px 0 #101b31', boxShadow: '10px 10px 0 #101b31' }}>
          {text.toUpperCase()}
        </div>
      );
      break;
    }
    case 'label':
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: inS, transform: `translateY(${(1 - inS) * 16}px)` }}>
          <div style={{ background: HNC_UI.gold, color: HNC_UI.ink, fontFamily: HNC_UI.mono, fontWeight: 900, fontSize: 42, padding: '10px 20px', boxShadow: '6px 6px 0 #101b31' }}>{text}</div>
          <div style={{ width: 4, height: 46, background: HNC_UI.gold }} />
        </div>
      );
      break;
    case 'whisper':
      body = <div style={{ fontFamily: 'system-ui, sans-serif', fontStyle: 'italic', fontWeight: 700, fontSize: 56, color: HNC_UI.cream, textShadow: '0 3px 12px #000c, 2px 2px 0 #101b31', opacity: inS }}>{text}</div>;
      break;
    case 'subtitle':
    default:
      body = <div style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 600, fontSize: 54, color: '#ffffff', background: 'rgba(0,0,0,0.62)', padding: '12px 26px', borderRadius: 10, textAlign: 'center', maxWidth: 900 }}>{text}</div>;
      break;
  }
  return <div style={{ ...pos, opacity: out }}>{body}</div>;
};
