import React from 'react';
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { upper } from '../graphics/case';
import { HNC, type HncVariant } from './hncTheme';

/**
 * HNC editorial entry + outro for football-comedy shorts (THE GROUP CHAT).
 *
 * Retro soul, modern discipline: condensed display type, hard decisive moves
 * (snaps, drops, punches — never SaaS bounce, never VHS filter). Three
 * explorations: programme / scoreboard / ticket. The chat UI itself stays
 * contemporary — the contrast is intentional.
 */

const snap = (frame: number, a: number, b: number): number =>
  interpolate(frame, [a, b], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

const D = HNC.display;
const T = HNC.text;

/* ---------------------------------------------------------------- hook -- */

const Kicker: React.FC<{ at: number; text: string; color?: string }> = ({ at, text, color = HNC.gold }) => {
  const frame = useCurrentFrame();
  const k = snap(frame, at, at + 8);
  return (
    <div style={{ opacity: k, transform: `translateX(${(1 - k) * -40}px)`, fontFamily: T, fontWeight: 700, fontSize: HNC.type.kicker, letterSpacing: 12, color, textShadow: '0 2px 16px #000d' }}>
      {upper(text)}
    </div>
  );
};

const HeroWord: React.FC<{ at: number; text: string; from: 'left' | 'right'; color?: string; size?: number; dist?: number }> = ({ at, text, from, color = HNC.cream, size = 176, dist = 420 }) => {
  const frame = useCurrentFrame();
  const k = snap(frame, at, at + 12);
  const dx = (1 - k) * (from === 'left' ? -dist : dist);
  return (
    <div style={{ opacity: Math.min(1, k * 1.6), transform: `translateX(${dx}px)`, fontFamily: D, fontWeight: 600, fontSize: size, lineHeight: 0.94, letterSpacing: 3, color, textShadow: '0 6px 44px #000e' }}>
      {upper(text)}
    </div>
  );
};

const HookProgramme: React.FC = () => {
  const frame = useCurrentFrame();
  const rule = snap(frame, 26, 36);
  const prompt = snap(frame, 29, 39);
  const slab = (pad: number): React.CSSProperties => ({ background: HNC.navy, padding: `6px ${pad}px 10px`, boxShadow: '0 14px 44px #000b' });
  return (
    <div style={{ position: 'absolute', top: 210, left: 84, right: 72 }}>
      <Kicker at={2} text="The Group Chat" />
      <div style={{ marginTop: 18 }}>
        <span style={{ display: 'inline-block', opacity: snap(frame, 6, 12), ...slab(28) }}>
          <HeroWord at={6} text="Croatia" from="left" />
        </span>
      </div>
      <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 22, opacity: rule }}>
        <span style={{ fontFamily: T, fontWeight: 700, fontSize: HNC.type.connector, letterSpacing: 10, color: HNC.cream, textShadow: '0 2px 16px #000d' }}>OR</span>
        <span style={{ height: HNC.rule, width: 130 * rule, background: HNC.red }} />
      </div>
      <div style={{ marginTop: 14 }}>
        <span style={{ display: 'inline-block', opacity: snap(frame, 13, 21), ...slab(28) }}>
          <HeroWord at={13} text="England?" from="right" />
        </span>
      </div>
      <div style={{ marginTop: 30, opacity: prompt, transform: `translateX(${(1 - prompt) * -60}px)`, fontFamily: D, fontWeight: 600, fontSize: HNC.type.prompt, letterSpacing: 5, color: HNC.gold, textShadow: '0 4px 26px #000e' }}>
        {upper('Pick a side ↓')}
      </div>
    </div>
  );
};

const HookScoreboard: React.FC = () => {
  const frame = useCurrentFrame();
  const drop = snap(frame, 4, 18);
  const gold = snap(frame, 26, 36);
  return (
    <div style={{ position: 'absolute', top: 230, left: 48, right: 48, opacity: Math.min(1, drop * 1.5), transform: `translateY(${(1 - drop) * -760}px)` }}>
      <div style={{ background: HNC.board, borderRadius: 26, padding: '34px 44px 30px', boxShadow: '0 30px 80px #000c', border: '1px solid #f8efdb22' }}>
        <div style={{ fontFamily: T, fontWeight: 700, fontSize: 30, letterSpacing: 8, color: HNC.gold }}>{upper('HNC Social · Matchday 001')}</div>
        <div style={{ marginTop: 16, fontFamily: D, fontWeight: 600, fontSize: 168, lineHeight: 0.95, letterSpacing: 3, color: HNC.cream }}>CROATIA</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, margin: '14px 0' }}>
          <span style={{ height: HNC.rule, flex: 1, background: '#f8efdb2e' }} />
          <span style={{ fontFamily: T, fontWeight: 700, fontSize: 52, letterSpacing: 12, color: '#cfc8b8' }}>OR</span>
          <span style={{ height: HNC.rule, flex: 1, background: '#f8efdb2e' }} />
        </div>
        <div style={{ fontFamily: D, fontWeight: 600, fontSize: 168, lineHeight: 0.95, letterSpacing: 3, color: HNC.cream }}>ENGLAND?</div>
        <div style={{ marginTop: 22, background: HNC.gold, borderRadius: 12, padding: '14px 0', textAlign: 'center', fontFamily: D, fontWeight: 600, fontSize: 62, letterSpacing: 6, color: HNC.navy, opacity: gold, transform: `scale(${0.94 + 0.06 * gold})` }}>
          PICK A SIDE ↓
        </div>
      </div>
    </div>
  );
};

const TicketShell: React.FC<{ children: React.ReactNode; top: number; punch: number }> = ({ children, top, punch }) => (
  <div style={{ position: 'absolute', top, left: 84, right: 84, opacity: Math.min(1, punch * 1.6), transform: `translateY(${(1 - punch) * 90}px) rotate(${-6 + 4 * punch}deg) scale(${1.12 - 0.12 * punch})` }}>
    <div style={{ position: 'relative', background: HNC.paper, borderRadius: 20, padding: '36px 40px 30px', boxShadow: '0 30px 80px #000d' }}>
      {/* perforation */}
      <div style={{ position: 'absolute', top: 24, bottom: 24, right: 150, width: 0, borderRight: '3px dashed #101b3144' }} />
      {/* stub */}
      <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 150, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ transform: 'rotate(90deg)', fontFamily: T, fontWeight: 700, fontSize: 26, letterSpacing: 6, color: HNC.muted, whiteSpace: 'nowrap' }}>001 · HR—EN</span>
      </div>
      <div style={{ marginRight: 150 }}>{children}</div>
    </div>
  </div>
);

const HookTicket: React.FC = () => {
  const frame = useCurrentFrame();
  const punch = snap(frame, 4, 14);
  const prompt = snap(frame, 18, 26);
  return (
    <TicketShell top={330} punch={punch}>
      <div style={{ fontFamily: T, fontWeight: 700, fontSize: 30, letterSpacing: 8, color: HNC.muted }}>{upper('HNC League · The Group Chat')}</div>
      <div style={{ marginTop: 10, fontFamily: D, fontWeight: 600, fontSize: 148, lineHeight: 0.94, letterSpacing: 2, color: HNC.ink }}>CROATIA</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, margin: '8px 0' }}>
        <span style={{ fontFamily: D, fontWeight: 600, fontSize: 56, letterSpacing: 8, color: HNC.red }}>OR</span>
        <span style={{ height: HNC.rule, width: 110, background: HNC.red }} />
      </div>
      <div style={{ fontFamily: D, fontWeight: 600, fontSize: 148, lineHeight: 0.94, letterSpacing: 2, color: HNC.ink }}>ENGLAND?</div>
      <div style={{ marginTop: 18, opacity: prompt, fontFamily: D, fontWeight: 600, fontSize: 60, letterSpacing: 5, color: HNC.navy }}>
        {upper('Pick a side ↓')}
      </div>
    </TicketShell>
  );
};

export const HncHook: React.FC<{ variant: HncVariant }> = ({ variant }) =>
  variant === 'programme' ? <HookProgramme /> : variant === 'scoreboard' ? <HookScoreboard /> : <HookTicket />;

/* ----------------------------------------------------------------- CTA -- */

const CtaProgramme: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  void fps;
  const page = snap(frame, 10, 26);
  const tag = snap(frame, 50, 60);
  const url = snap(frame, 62, 72);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, transform: `translateY(${(1 - page) * 780}px)` }}>
      <div style={{ background: HNC.paper, borderRadius: '28px 28px 0 0', padding: '44px 72px 90px', boxShadow: '0 -30px 80px #000c' }}>
        <div style={{ fontFamily: T, fontWeight: 700, fontSize: 30, letterSpacing: 8, color: HNC.muted }}>{upper('Full time · The Group Chat · Ep 001')}</div>
        <div style={{ marginTop: 12, fontFamily: D, fontWeight: 600, fontSize: 118, lineHeight: 0.96, letterSpacing: 2, color: HNC.ink }}>
          WHO TALKS
          <br />
          BEFORE KICKOFF?
        </div>
        <div style={{ height: HNC.rule, width: 130, background: HNC.red, margin: '20px 0' }} />
        <div style={{ display: 'inline-block', opacity: tag, background: HNC.navy, color: HNC.cream, borderRadius: 999, padding: '16px 52px', fontFamily: D, fontWeight: 600, fontSize: 58, letterSpacing: 5 }}>
          {upper('Tag them ↓')}
        </div>
        <div style={{ marginTop: 18, opacity: url, fontFamily: T, fontWeight: 700, fontSize: 30, letterSpacing: 7, color: HNC.muted }}>{upper('hncleague.com')}</div>
      </div>
    </div>
  );
};

const CtaScoreboard: React.FC = () => {
  const frame = useCurrentFrame();
  const drop = snap(frame, 10, 26);
  const tag = snap(frame, 50, 60);
  const url = snap(frame, 62, 72);
  return (
    <div style={{ position: 'absolute', top: 640, left: 48, right: 48, opacity: Math.min(1, drop * 1.5), transform: `translateY(${(1 - drop) * -560}px)` }}>
      <div style={{ background: HNC.board, borderRadius: 26, padding: '40px 44px', textAlign: 'center', boxShadow: '0 30px 80px #000c', border: '1px solid #f8efdb22' }}>
        <div style={{ fontFamily: T, fontWeight: 700, fontSize: 30, letterSpacing: 8, color: HNC.gold }}>{upper('Full time · Group chat')}</div>
        <div style={{ marginTop: 14, fontFamily: D, fontWeight: 600, fontSize: 116, lineHeight: 0.96, letterSpacing: 2, color: HNC.cream }}>
          WHO TALKS
          <br />
          BEFORE KICKOFF?
        </div>
        <div style={{ marginTop: 22, opacity: tag, display: 'inline-block', background: HNC.gold, color: HNC.navy, borderRadius: 999, padding: '14px 56px', fontFamily: D, fontWeight: 600, fontSize: 58, letterSpacing: 5 }}>
          {upper('Tag them ↓')}
        </div>
        <div style={{ marginTop: 16, opacity: url, fontFamily: T, fontWeight: 700, fontSize: 28, letterSpacing: 7, color: '#f8efdb99' }}>{upper('hncleague.com')}</div>
      </div>
    </div>
  );
};

const CtaTicket: React.FC = () => {
  const frame = useCurrentFrame();
  // A literal two-sided object: the front recreates the physical punchline
  // card and hides the baked plate beneath it; the reverse is the HNC ticket.
  const turn = interpolate(frame, [6, 28], [0, 180], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) });
  const expand = snap(frame, 8, 30);
  const l1 = snap(frame, 28, 36);
  const l2 = snap(frame, 36, 44);
  const tag = snap(frame, 46, 56);
  const url = snap(frame, 56, 66);
  return (
    <div style={{ position: 'absolute', inset: 0, perspective: 1500 }}>
      <div
        style={{
          position: 'absolute',
          top: interpolate(expand, [0, 1], [700, 575]),
          left: interpolate(expand, [0, 1], [150, 70]),
          right: interpolate(expand, [0, 1], [150, 70]),
          height: interpolate(expand, [0, 1], [300, 590]),
          transformStyle: 'preserve-3d',
          transform: `rotateX(${turn}deg)`,
        }}
      >
        <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', background: HNC.paper, borderRadius: 16, overflow: 'hidden', boxShadow: '0 30px 80px #000d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontFamily: D, fontWeight: 500, fontSize: 64, letterSpacing: 3, color: HNC.ink }}>SEE YOU AFTER FULL TIME.</div>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 18, background: HNC.red }} />
        </div>
        <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateX(180deg)', background: HNC.paper, borderRadius: 16, padding: '42px 42px 34px', boxShadow: '0 30px 80px #000d', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 28, bottom: 28, right: 155, width: 0, borderRight: '3px dashed #101b3144' }} />
          <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 155, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ transform: 'rotate(90deg)', fontFamily: T, fontWeight: 700, fontSize: 26, letterSpacing: 6, color: HNC.red, whiteSpace: 'nowrap' }}>HNC · 001</span>
          </div>
          <div style={{ marginRight: 155 }}>
            <div style={{ fontFamily: T, fontWeight: 700, fontSize: 28, letterSpacing: 7, color: HNC.muted }}>{upper('The Group Chat · Full time')}</div>
            <div style={{ marginTop: 10, opacity: l1, fontFamily: D, fontWeight: 600, fontSize: 112, lineHeight: 0.9, letterSpacing: 2, color: HNC.ink }}>
              WHO TALKS
              <br />
              <span style={{ opacity: l2 }}>BEFORE KICKOFF?</span>
            </div>
            <div style={{ width: 120, height: HNC.rule, marginTop: 20, background: HNC.red }} />
            <div style={{ marginTop: 18, opacity: tag, display: 'inline-block', background: HNC.navy, color: HNC.cream, borderRadius: 999, padding: '12px 44px', fontFamily: D, fontWeight: 600, fontSize: 54, letterSpacing: 5 }}>
              {upper('Tag them ↓')}
            </div>
            <div style={{ marginTop: 14, opacity: url, fontFamily: T, fontWeight: 700, fontSize: 27, letterSpacing: 6, color: HNC.muted, whiteSpace: 'nowrap' }}>{upper('hncleague.com')}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const HncCta: React.FC<{ variant: HncVariant }> = ({ variant }) =>
  variant === 'programme' ? <CtaProgramme /> : variant === 'scoreboard' ? <CtaScoreboard /> : <CtaTicket />;
