import React from 'react';
import { interpolate, spring } from 'remotion';
import { countryFlag } from '../../cast/countries';
import type { OverlayEvent } from '../../engine/timeline/types';
import { HNC_UI } from '../../graphics/hnc-ui';
import { HncPortrait } from '../../render/HncPortrait';
import { useLayout } from '../../render/layout';
import type { SceneProps } from '../../render/worlds';

/**
 * phone — a native-feeling group chat (dark mode), screen-recording style.
 * The thread is every `chat` / `typing` / `system-note` graphic of the scene
 * that has started: messages pop in and push the thread up; avatars are the
 * cast's HNC characters.
 */
const DEFAULT_UI = {
  bg: '#0b0b0f',
  bar: '#16161c',
  bubble: '#26262e',
  mine: '#2f7ff6',
  mineText: '#f2f2f7',
  text: '#f2f2f7',
  muted: '#8e8e98',
  font: '-apple-system, system-ui, sans-serif',
};
/** An original HNC-flavoured messenger skin (not any real app): navy night, gold own bubbles. */
export const HNC_CHAT_SKIN = {
  bg: '#0a1220',
  bar: '#101b31',
  bubble: '#1c2b44',
  mine: '#f7bf30',
  mineText: '#101b31',
  text: '#f8efdb',
  muted: '#8ea0b8',
  font: "'Avenir Next', system-ui, sans-serif",
};
const NAME_COLORS = ['#ff9f43', '#5fcddd', '#7ee08a', '#f78fb3'];
// Sized for a phone feed, not a real phone: legible at thumbnail scale.
const FONT = 60;
const LINE = 74;
const MAX_W = 740;

/** Rough wrap estimate (deterministic, no DOM measuring). */
function lines(text: string): number {
  const perLine = Math.floor(MAX_W / (FONT * 0.52));
  return Math.max(1, text.split('\n').reduce((n, l) => n + Math.max(1, Math.ceil([...l].length / perLine)), 0));
}

function itemHeight(ev: OverlayEvent, mine: boolean): number {
  if (ev.type === 'system-note') return 100;
  if (ev.type === 'typing') return 118;
  const text = String(ev.props.say ?? '');
  const body = lines(text) * LINE + 48 + (mine ? 0 : 46) + (ev.props.reply ? 104 : 0) + (ev.props.image ? 380 : 0);
  return body + 22;
}

const Attachment: React.FC<{ kind: string; home: string; away: string }> = ({ kind, home, away }) => (
  <div style={{ width: 520, height: 340, borderRadius: 22, overflow: 'hidden', marginBottom: 12, background: 'linear-gradient(160deg, #2f8f47, #1f5a33)', position: 'relative', fontFamily: HNC_UI.display }}>
    <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 60px, transparent 60px 120px)' }} />
    <div style={{ position: 'absolute', top: 24, left: 0, right: 0, textAlign: 'center', fontSize: 96, color: HNC_UI.gold, textShadow: HNC_UI.hardShadow }}>{kind === 'table' ? 'WORLD TABLE' : 'GOAL!'}</div>
    <div style={{ position: 'absolute', bottom: 70, left: 0, right: 0, textAlign: 'center', fontSize: 64, color: HNC_UI.cream, textShadow: HNC_UI.hardShadow }}>
      {countryFlag(home)} 1-0 {countryFlag(away)}
    </div>
    <div style={{ position: 'absolute', bottom: 18, left: 24, fontFamily: HNC_UI.mono, fontSize: 24, color: HNC_UI.cream, opacity: 0.8 }}>▶ 0:07 · replay.mp4</div>
  </div>
);

export const PhoneScene: React.FC<SceneProps> = ({ shot, frame, fps, timeline }) => {
  const { width, height } = useLayout();
  const set = shot.set;
  const UI = set.skin === 'hnc' ? HNC_CHAT_SKIN : DEFAULT_UI;
  const me = String(set.me ?? Object.keys(timeline.cast)[0]);
  const members = ((set.members as string[] | undefined) ?? Object.keys(timeline.cast)).filter((id) => timeline.cast[id]);
  // One thread can span several phone scenes (`set.thread`), so the chat
  // resumes where it left off after a cutaway.
  const thread = String(set.thread ?? shot.scene);
  const scenes = new Set(timeline.shots.filter((s) => s.world === 'phone' && String(s.set.thread ?? s.scene) === thread).map((s) => s.scene));
  const items = timeline.overlays
    .filter((o) => (o.type === 'chat' || o.type === 'typing' || o.type === 'system-note') && scenes.has(o.id.split('/')[0]) && o.start <= frame && (o.type !== 'typing' || frame < o.end))
    .sort((a, b) => a.start - b.start);
  const colorOf = (id: string) => NAME_COLORS[Math.max(0, members.indexOf(id)) % NAME_COLORS.length];
  const look = (id: string) => (timeline.cast[id]?.look || 'hoodie');
  const inputH = 150;
  const headerH = 250;
  const bottom = height - inputH - 24;
  // History messages are already in the thread on the first frame (no pop-in).
  const pops = items.map((ev) => (ev.props.history ? 1 : spring({ frame: frame - ev.start, fps, config: { damping: 15, stiffness: 230, mass: 0.7 } })));
  // Newer items push older ones up by their (animated) height.
  const offsets = items.map((_, i) => items.slice(i + 1).reduce((acc, ev, j) => acc + itemHeight(ev, String(ev.props.from) === me) * pops[i + 1 + j], 0));
  const t = frame / fps;
  const home = timeline.cast[me]?.country ?? 'TR';
  const rival = members.find((m) => m !== me);
  const away = rival ? timeline.cast[rival].country : 'GR';

  return (
    <div style={{ position: 'absolute', inset: 0, background: UI.bg, fontFamily: UI.font, color: UI.text, overflow: 'hidden' }}>
      {/* Thread */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: headerH, bottom: height - bottom, overflow: 'hidden' }}>
        {items.map((ev, i) => {
          const from = String(ev.props.from ?? '');
          const mine = from === me;
          const h = itemHeight(ev, mine);
          const y = bottom - headerH - offsets[i] - h * pops[i];
          const s = pops[i];
          if (ev.type === 'system-note') {
            return (
              <div key={ev.id} style={{ position: 'absolute', top: y, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: s }}>
                <div style={{ background: '#1d1d24', color: UI.muted, fontSize: 40, padding: '14px 32px', borderRadius: 34 }}>{String(ev.props.say ?? '')}</div>
              </div>
            );
          }
          const member = timeline.cast[from];
          const bubble =
            ev.type === 'typing' ? (
              <div style={{ background: UI.bubble, borderRadius: 40, padding: '30px 34px', display: 'flex', gap: 14 }}>
                {[0, 1, 2].map((d) => (
                  <div key={d} style={{ width: 20, height: 20, borderRadius: 10, background: UI.muted, opacity: 0.35 + 0.65 * Math.max(0, Math.sin(t * 7 - d * 0.9)) }} />
                ))}
              </div>
            ) : (
              <div style={{ background: mine ? UI.mine : UI.bubble, color: mine ? UI.mineText : UI.text, fontWeight: mine && set.skin === 'hnc' ? 700 : 400, borderRadius: 40, borderBottomRightRadius: mine ? 12 : 40, borderBottomLeftRadius: mine ? 40 : 12, padding: '20px 32px', maxWidth: MAX_W + 64, fontSize: FONT, lineHeight: `${LINE}px` }}>
                {!mine ? <div style={{ fontSize: 36, fontWeight: 700, color: colorOf(from), marginBottom: 4, lineHeight: '42px' }}>{member?.name ?? from} {member ? countryFlag(member.country) : ''}</div> : null}
                {ev.props.reply ? <div style={{ borderLeft: `6px solid ${mine ? '#fff9' : colorOf(from)}`, padding: '6px 16px', marginBottom: 10, fontSize: 40, lineHeight: '50px', opacity: 0.8, background: '#0003', borderRadius: 10 }}>{String(ev.props.reply)}</div> : null}
                {ev.props.image ? <Attachment kind={String(ev.props.image)} home={home} away={away} /> : null}
                {String(ev.props.say ?? '')}
              </div>
            );
          return (
            <div key={ev.id} style={{ position: 'absolute', top: y, left: 36, right: 36, display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 18, opacity: Math.min(1, s * 1.6), transform: `scale(${interpolate(s, [0, 1], [0.7, 1])})`, transformOrigin: mine ? '100% 100%' : '0% 100%' }}>
              {!mine && member ? <HncPortrait member={member} look={look(from)} size={112} background={colorOf(from)} t={t} /> : null}
              {bubble}
            </div>
          );
        })}
      </div>
      {/* Header */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: headerH, background: UI.bar, borderBottom: '1px solid #2a2a33' }}>
        <div style={{ position: 'absolute', top: 30, left: 52, right: 52, display: 'flex', justifyContent: 'space-between', fontSize: 34, fontWeight: 600 }}>
          <span>{String(set.time ?? '23:47')}</span>
          <span style={{ letterSpacing: 4 }}>▂▄▆ 5G ▮▮▮</span>
        </div>
        <div style={{ position: 'absolute', top: 104, left: 40, right: 40, display: 'flex', alignItems: 'center', gap: 22 }}>
          <span style={{ fontSize: 64, color: UI.mine, marginRight: 4 }}>‹</span>
          <div style={{ display: 'flex' }}>
            {members.slice(0, 3).map((id, i) => (
              <div key={id} style={{ marginLeft: i ? -30 : 0, border: `4px solid ${UI.bar}`, borderRadius: '50%' }}>
                <HncPortrait member={timeline.cast[id]} look={look(id)} size={96} background={colorOf(id)} t={t + i} />
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 44, fontWeight: 700 }}>{String(set.title ?? 'group chat')}</div>
            <div style={{ fontSize: 30, color: UI.muted }}>{members.map((m) => timeline.cast[m]?.name).join(', ')}</div>
          </div>
        </div>
      </div>
      {/* Input bar */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: inputH, background: UI.bar, display: 'flex', alignItems: 'center', gap: 22, padding: '0 36px' }}>
        <div style={{ fontSize: 56, color: UI.muted }}>＋</div>
        <div style={{ flex: 1, height: 86, borderRadius: 43, border: '2px solid #33333d', display: 'flex', alignItems: 'center', padding: '0 30px', fontSize: 38, color: UI.muted }}>Message</div>
      </div>
      <div style={{ position: 'absolute', left: width / 2 - 140, bottom: 14, width: 280, height: 10, borderRadius: 5, background: '#ffffffcc' }} />
    </div>
  );
};
