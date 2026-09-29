import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { getAsset } from '../assets/registry';
import { upper } from '../graphics/case';
import { HNC_UI } from '../graphics/hnc-ui';
import { HNC_CHAT_SKIN } from '../worlds/phone/PhoneScene';
import type { PosterBlock, PosterDef } from './types';

/**
 * The typography layer of a poster (transparent background): the campaign
 * type system laid out as absolute blocks. Rendered by scripts/poster.ts and
 * composited over the plates.
 */
const STYLE: Record<string, React.CSSProperties> = {
  headline: { fontFamily: HNC_UI.headline, fontWeight: 800, fontStretch: 'condensed', fontSize: 120, lineHeight: 0.92, color: HNC_UI.cream, letterSpacing: '0.005em', textShadow: '0 6px 30px rgba(0,0,0,0.55)' },
  kicker: { fontFamily: HNC_UI.mono, fontWeight: 800, fontSize: 26, letterSpacing: '0.24em', color: HNC_UI.gold },
  cinema: { fontFamily: HNC_UI.cinema, fontSize: 46, letterSpacing: '0.24em', color: HNC_UI.cream, lineHeight: 1.3 },
  monument: { fontFamily: HNC_UI.cinema, fontSize: 200, letterSpacing: '0.04em', color: '#ffffff', lineHeight: 1, textShadow: '0 6px 50px rgba(70,0,0,0.5)' },
  dedication: { fontFamily: HNC_UI.cinema, fontSize: 40, letterSpacing: '0.26em', color: '#ffffff', lineHeight: 1.35 },
  horror: { fontFamily: HNC_UI.horror, fontStyle: 'italic', fontWeight: 700, fontSize: 104, lineHeight: 0.96, color: '#f3ece0', textShadow: '0 0 36px rgba(170,20,20,0.8), 4px 0 0 rgba(200,20,30,0.55)' },
  broadcast: { fontFamily: HNC_UI.broadcast, fontSize: 110, lineHeight: 0.92, color: '#ffffff' },
  typewriter: { fontFamily: HNC_UI.typewriter, fontSize: 40, color: HNC_UI.cream, letterSpacing: '0.04em' },
  impact: { fontFamily: HNC_UI.display, fontSize: 140, lineHeight: 0.95, color: HNC_UI.cream, textShadow: HNC_UI.hardShadow },
  label: { fontFamily: HNC_UI.mono, fontWeight: 700, fontSize: 20, letterSpacing: '0.2em', color: HNC_UI.muted },
};
const CAPS = new Set(['headline', 'kicker', 'cinema', 'horror', 'broadcast', 'impact', 'label', 'monument', 'dedication']);

const Block: React.FC<{ b: PosterBlock; W: number }> = ({ b, W }) => {
  switch (b.kind) {
    case 'text': {
      const w = b.w ?? W - 140;
      const x = b.x ?? (W - w) / 2;
      const txt = CAPS.has(b.style) ? upper(b.text, b.lang) : b.text;
      return (
        <div lang={b.lang} style={{ position: 'absolute', left: x, top: b.y, width: w, textAlign: b.align ?? 'center', whiteSpace: 'pre-line', ...STYLE[b.style], ...(b.size ? { fontSize: b.size } : {}), ...(b.color ? { color: b.color } : {}) }}>
          {txt.split('\n').map((line, i, all) => (
            <div key={i} style={b.style === 'headline' && all.length > 1 && i === all.length - 1 && !b.color ? { color: HNC_UI.gold } : undefined}>{line}</div>
          ))}
        </div>
      );
    }
    case 'rule':
      return <div style={{ position: 'absolute', left: b.x, top: b.y, width: b.w, height: b.h, background: b.color }} />;
    case 'lockup': {
      const s = b.scale ?? 1;
      const ink = b.tone === 'dark' ? HNC_UI.navy : HNC_UI.cream;
      const align = b.align ?? 'center';
      return (
        <div style={{ position: 'absolute', left: 0, right: 0, top: b.y, display: 'flex', flexDirection: 'column', alignItems: align === 'center' ? 'center' : align === 'left' ? 'flex-start' : 'flex-end', padding: '0 70px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 * s, ...(b.plate ? { background: 'rgba(8,16,30,0.82)', padding: `${10 * s}px ${26 * s}px ${10 * s}px ${14 * s}px`, borderRadius: 60 * s } : {}) }}>
            <Img src={staticFile(`assets/${getAsset('hnc-logo').file}`)} style={{ width: 74 * s, height: 74 * s }} />
            <div style={{ fontFamily: HNC_UI.display, fontSize: 48 * s, color: ink, letterSpacing: '0.02em' }}>
              HNC <span style={{ color: HNC_UI.gold }}>LEAGUE</span>
            </div>
          </div>
          {b.line ? <div style={{ marginTop: 10 * s, fontFamily: HNC_UI.mono, fontWeight: 800, fontSize: 18 * s, letterSpacing: '0.22em', color: ink, opacity: 0.85 }}>{b.line}</div> : null}
        </div>
      );
    }
    case 'bubble': {
      const size = b.size ?? 64;
      return (
        <div style={{ position: 'absolute', left: b.x, top: b.y, background: HNC_CHAT_SKIN.mine, color: HNC_CHAT_SKIN.mineText, fontFamily: HNC_CHAT_SKIN.font, fontWeight: 800, fontSize: size, padding: `${size * 0.32}px ${size * 0.55}px`, borderRadius: size * 0.7, borderBottomRightRadius: size * 0.18, boxShadow: '0 18px 50px rgba(0,0,0,0.5)' }}>
          {b.text}
        </div>
      );
    }
    case 'breaking':
      return (
        <div style={{ position: 'absolute', left: 0, right: 0, top: b.y }}>
          <div style={{ display: 'inline-block', marginLeft: 56, background: '#c8102e', color: '#fff', fontFamily: HNC_UI.display, fontSize: 72, padding: '8px 30px', transform: 'skewX(-8deg)', boxShadow: '8px 8px 0 #101b31' }}>● {upper(b.label)}</div>
          <div style={{ margin: '12px 56px 0', background: HNC_UI.cream, color: HNC_UI.ink, fontFamily: HNC_UI.display, fontSize: 64, lineHeight: 1.02, padding: '16px 26px', borderLeft: `14px solid ${HNC_UI.gold}`, boxShadow: '10px 10px 0 #101b31' }}>{upper(b.headline)}</div>
        </div>
      );
    case 'bug':
      return (
        <div style={{ position: 'absolute', top: 56, right: 56, display: 'flex', gap: 10, alignItems: 'center', fontFamily: HNC_UI.mono, fontWeight: 900, fontSize: 24 }}>
          <span style={{ background: '#c8102e', color: '#fff', padding: '6px 12px' }}>● LIVE</span>
          <span style={{ background: HNC_UI.navy, color: HNC_UI.cream, padding: '6px 12px' }}>{b.text}</span>
        </div>
      );
    case 'billing':
      return (
        <div style={{ position: 'absolute', left: 70, right: 70, top: b.y, textAlign: 'center', fontFamily: HNC_UI.broadcast, fontSize: 22, letterSpacing: '0.12em', lineHeight: 1.35, color: 'rgba(243,236,224,0.75)' }}>
          {b.lines.map((l, i) => (
            <div key={i}>{upper(l)}</div>
          ))}
        </div>
      );
    default:
      return null;
  }
};

export const PosterType: React.FC<{ poster: PosterDef }> = ({ poster }) => {
  const W = poster.width ?? 1080;
  return (
    <AbsoluteFill style={{ background: 'transparent' }}>
      {poster.blocks.map((b, i) => (
        <Block key={i} b={b} W={W} />
      ))}
    </AbsoluteFill>
  );
};
