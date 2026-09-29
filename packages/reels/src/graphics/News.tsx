import React from 'react';
import { interpolate, spring } from 'remotion';
import { countryFlag, countryName } from '../cast/countries';
import { useLayout } from '../render/layout';
import { upper } from './case';
import { HNC_UI } from './hnc-ui';

/**
 * Sports-news parody package in the HNC UI language (navy / cream / gold,
 * Impact display, mono labels) with one broadcast red for BREAKING.
 * Global-frame timing: `at` = entrance, `end` = exit.
 */
const RED = '#c8102e';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
type Timed = { frame: number; fps: number; at: number; end: number };

const exitK = (frame: number, end: number) => interpolate(frame, [end - 8, end], [1, 0], clamp);

export const BreakingBanner: React.FC<Timed & { label: string; headline: string; level?: number }> = ({ frame, fps, at, end, label, headline, level = 1 }) => {
  const { safe } = useLayout();
  const since = frame - at;
  if (since < 0) return null;
  // Escalation: level 2 shudders and pulses; level 3 adds a flashing red frame and a BREAKING strip.
  const shake = level >= 2 ? Math.sin(since * 1.9) * (level >= 3 ? 6 : 3) : 0;
  const slab = spring({ frame: since, fps, config: { damping: 14, stiffness: 260 } });
  const bar = spring({ frame: since - 6, fps, config: { damping: 16, stiffness: 200 } });
  const pulse = 0.85 + 0.15 * Math.sin(since * 0.5);
  const out = exitK(frame, end);
  const flash = level >= 3 ? (Math.floor(since / 6) % 2 ? 0.9 : 0.35) : 0;
  return (
    <>
    {level >= 3 ? (
      <>
        <div style={{ position: 'absolute', inset: 0, boxShadow: `inset 0 0 0 26px rgba(200,16,46,${flash}), inset 0 0 160px rgba(200,16,46,${flash * 0.6})`, opacity: out }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: safe.top - 40, height: 70, background: RED, overflow: 'hidden', opacity: out, display: 'flex', alignItems: 'center' }}>
          <div style={{ whiteSpace: 'nowrap', fontFamily: HNC_UI.display, fontSize: 52, color: '#fff', transform: `translateX(${-((since * 9) % 560)}px)`, letterSpacing: '0.06em' }}>
            {Array.from({ length: 8 }, () => 'BREAKING  ●  ').join('')}
          </div>
        </div>
      </>
    ) : null}
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: safe.bottom + 150, opacity: out, transform: `translate(${shake}px, ${shake * 0.4}px)` }}>
      <div style={{ display: 'inline-flex', marginLeft: safe.left - 10, transform: `translateX(${(1 - slab) * -700}px) skewX(-8deg)` }}>
        <div style={{ background: RED, color: '#fff', fontFamily: HNC_UI.display, fontSize: 76 + (level - 1) * 14, padding: '10px 34px', letterSpacing: '0.04em', boxShadow: '8px 8px 0 #101b31', filter: level >= 2 ? `brightness(${1 + 0.25 * Math.max(0, Math.sin(since * 0.9))})` : undefined }}>
          <span style={{ opacity: pulse }}>●</span> {label}
        </div>
      </div>
      <div
        style={{
          margin: `12px ${safe.right - 40}px 0 ${safe.left - 10}px`,
          background: HNC_UI.cream,
          color: HNC_UI.ink,
          fontFamily: HNC_UI.display,
          fontSize: 60,
          lineHeight: 1.04,
          padding: '18px 28px',
          borderLeft: `14px solid ${HNC_UI.gold}`,
          boxShadow: '10px 10px 0 #101b31',
          transform: `translateX(${(1 - bar) * 900}px)`,
          textTransform: 'uppercase',
        }}
      >
        {upper(headline)}
      </div>
    </div>
    </>
  );
};

export const LowerThird: React.FC<Timed & { name: string; country: string; role: string }> = ({ frame, fps, at, end, name, country, role }) => {
  const { safe } = useLayout();
  const since = frame - at;
  if (since < 0) return null;
  const s = spring({ frame: since, fps, config: { damping: 16, stiffness: 220 } });
  const s2 = spring({ frame: since - 5, fps, config: { damping: 16, stiffness: 220 } });
  return (
    <div style={{ position: 'absolute', left: safe.left - 10, bottom: safe.bottom + 170, opacity: exitK(frame, end) }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: HNC_UI.navy, padding: '14px 26px', borderTop: `6px solid ${HNC_UI.gold}`, boxShadow: '8px 8px 0 #0008', transform: `translateX(${(1 - s) * -800}px)` }}>
        <span style={{ fontSize: 58 }}>{countryFlag(country)}</span>
        <span style={{ fontFamily: HNC_UI.display, fontSize: 64, color: HNC_UI.cream, letterSpacing: '0.02em' }}>{upper(name)}</span>
      </div>
      <div style={{ display: 'inline-block', marginTop: 8, background: HNC_UI.gold, color: HNC_UI.ink, fontFamily: HNC_UI.mono, fontWeight: 900, fontSize: 28, padding: '8px 18px', letterSpacing: '0.08em', transform: `translateX(${(1 - s2) * -800}px)` }}>
        {upper(role)}
      </div>
    </div>
  );
};

export const Ticker: React.FC<Timed & { items: string[] }> = ({ frame, fps, at, end, items }) => {
  const { width, safe } = useLayout();
  const since = frame - at;
  if (since < 0) return null;
  const s = spring({ frame: since, fps, config: { damping: 18, stiffness: 180 } });
  const text = items.map((i) => `${i}   ◆   `).join('');
  // Starts part-way in so the first item reads inside a ~1.5s beat.
  const speed = 9; // px / frame at 30fps
  const x = width * 0.12 - (since * speed * 30) / fps;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: safe.bottom + 60, height: 70, display: 'flex', transform: `translateY(${(1 - s) * 90}px)`, opacity: exitK(frame, end) }}>
      <div style={{ background: HNC_UI.gold, color: HNC_UI.ink, fontFamily: HNC_UI.display, fontSize: 40, padding: '0 22px', display: 'flex', alignItems: 'center', zIndex: 2 }}>HNC</div>
      <div style={{ flex: 1, background: HNC_UI.ink, overflow: 'hidden', position: 'relative', borderTop: `3px solid ${HNC_UI.gold}` }}>
        <div style={{ position: 'absolute', top: 12, left: x, whiteSpace: 'nowrap', fontFamily: HNC_UI.mono, fontWeight: 800, fontSize: 36, color: HNC_UI.cream, letterSpacing: '0.04em' }}>
          {text}
          {text}
        </div>
      </div>
    </div>
  );
};

export const LiveBug: React.FC<Timed & { channel: string }> = ({ frame, fps, at, end, channel }) => {
  const { safe } = useLayout();
  const since = frame - at;
  if (since < 0) return null;
  const s = spring({ frame: since, fps, config: { damping: 18, stiffness: 200 } });
  const blink = Math.floor((since / fps) * 2) % 2 === 0 ? 1 : 0.35;
  return (
    <div style={{ position: 'absolute', top: safe.top - 20, right: safe.right - 40, display: 'flex', gap: 10, opacity: s * exitK(frame, end) }}>
      <div style={{ background: RED, color: '#fff', fontFamily: HNC_UI.mono, fontWeight: 900, fontSize: 28, padding: '8px 14px', letterSpacing: '0.1em' }}>
        <span style={{ opacity: blink }}>●</span> LIVE
      </div>
      <div style={{ background: HNC_UI.navy, color: HNC_UI.gold, fontFamily: HNC_UI.mono, fontWeight: 900, fontSize: 28, padding: '8px 14px', letterSpacing: '0.1em', border: `2px solid ${HNC_UI.gold}` }}>{channel}</div>
    </div>
  );
};

export const Versus: React.FC<Timed & { home: string; away: string }> = ({ frame, fps, at, end, home, away }) => {
  const { safe } = useLayout();
  const since = frame - at;
  if (since < 0) return null;
  const l = spring({ frame: since, fps, config: { damping: 13, stiffness: 240 } });
  const r = spring({ frame: since - 3, fps, config: { damping: 13, stiffness: 240 } });
  const vs = spring({ frame: since - 8, fps, config: { damping: 9, stiffness: 320, mass: 0.6 } });
  const side = (code: string, k: number, dir: number) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', transform: `translateX(${(1 - k) * dir * 600}px)` }}>
      <div style={{ fontSize: 190, lineHeight: 1, filter: 'drop-shadow(8px 8px 0 #101b31)' }}>{countryFlag(code)}</div>
      <div style={{ fontFamily: HNC_UI.display, fontSize: 64, color: HNC_UI.cream, textShadow: HNC_UI.hardShadow }}>{upper(countryName(code))}</div>
    </div>
  );
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: safe.top + 10, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 34, opacity: exitK(frame, end) }}>
      {side(home, l, -1)}
      <div style={{ fontFamily: HNC_UI.display, fontSize: 150, color: HNC_UI.gold, textShadow: HNC_UI.hardShadow, transform: `scale(${interpolate(vs, [0, 1], [2.4, 1])}) rotate(-6deg)`, opacity: Math.min(1, vs * 2) }}>VS</div>
      {side(away, r, 1)}
    </div>
  );
};

export const Timestamp: React.FC<Timed & { day: string; time: string }> = ({ frame, fps, at, end, day, time }) => {
  const { safe } = useLayout();
  const since = frame - at;
  if (since < 0) return null;
  const s = spring({ frame: since, fps, config: { damping: 16, stiffness: 220 } });
  const blink = Math.floor((since / fps) * 2) % 2 === 0;
  const [hh, mm] = time.split(':');
  return (
    <div style={{ position: 'absolute', left: safe.left, top: safe.top + 10, opacity: s * exitK(frame, end), transform: `translateY(${(1 - s) * -30}px)` }}>
      <div style={{ fontFamily: HNC_UI.mono, fontWeight: 900, fontSize: 30, letterSpacing: '0.22em', color: HNC_UI.gold, textShadow: '3px 3px 0 #101b31' }}>{day.toUpperCase()}</div>
      <div style={{ fontFamily: HNC_UI.display, fontSize: 150, lineHeight: 0.95, color: HNC_UI.cream, textShadow: HNC_UI.hardShadow }}>
        {hh}
        <span style={{ opacity: blink ? 1 : 0.2 }}>:</span>
        {mm}
      </div>
    </div>
  );
};
