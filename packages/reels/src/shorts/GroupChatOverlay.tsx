import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

/**
 * Reusable Group Chat overlay for THE GROUP CHAT series.
 *
 * Episode-agnostic: all copy/senders/colours come from props. Episode data
 * provides messages; this component only times, stacks and styles them.
 * Deterministic — no Math.random.
 *
 * PRODUCTION PURITY: sender-name labels and debug layers are OFF by default
 * (`showSenders`, `debug`). V2 renders zero editor text. Bubbles match the
 * Blender physical cards exactly (white/navy + ticket-stub accent strip), so
 * the 2D -> 3D handoff feels continuous. ONE MESSAGE = ONE REPRESENTATION:
 * once a message exists physically, its 2D version must be unmounted by the
 * episode timeline (see group-chat-croatia-england GROUP_CHAT_SPEC_V2).
 */

export interface GroupChatMessage {
  id: string;
  kind: 'join' | 'message' | 'final';
  /** Display name, e.g. "EN player" / "HR supporter". */
  sender: string;
  /** Bubble side. Joins always centre. */
  side: 'left' | 'right' | 'center';
  text: string;
  /** Seconds from the overlay's zero. */
  at: number;
  /** Accent stub colour (episode palette). */
  color?: string;
}

export interface GroupChatOverlayProps {
  /** Tiny restrained header pill (group name). Omit after chat setup. */
  title?: string;
  messages: GroupChatMessage[];
  /** Max bubbles visible (older ones drop). */
  maxVisible?: number;
  /** Render sender-name labels above bubbles. Default false (production). */
  showSenders?: boolean;
  /** Render debug/draft layers. Default false. Never true in production. */
  debug?: boolean;
  /** Message ids with full hero emphasis; others render smaller/dimmer. */
  heroIds?: string[];
  /** Seconds after `at` when a join pill fades (default 1.1). */
  joinTtl?: number;
}

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const Bubble: React.FC<{ m: GroupChatMessage; hero: boolean; dim: boolean; showSender: boolean }> = ({ m, hero, dim, showSender }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const local = Math.max(0, t - m.at);
  const pop = spring({ frame: Math.floor(local * fps), fps, config: { damping: 24, stiffness: 420, mass: 0.8 } });
  const rise = interpolate(pop, [0, 1], [26, 0]);
  if (local <= 0) return null;

  if (m.kind === 'join') {
    return (
      <div
        key={m.id}
        style={{
          alignSelf: 'center',
          opacity: pop * 0.92,
          background: '#0a0f1eb8',
          border: '1px solid #ffffff22',
          borderRadius: 999,
          padding: '10px 26px',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 28,
          fontWeight: 600,
          color: '#d5dbe8',
          marginTop: 10,
          transform: `translateY(${rise}px)`,
        }}
      >
        {m.text}
      </div>
    );
  }

  if (m.kind === 'final') {
    return (
      <div
        key={m.id}
        style={{
          alignSelf: 'center',
          opacity: pop,
          marginTop: 18,
          background: '#ffffff',
          borderRadius: 18,
          padding: '30px 44px',
          textAlign: 'center',
          boxShadow: '0 18px 70px #000b',
          transform: `translateY(${rise}px) scale(${0.94 + 0.06 * pop})`,
          maxWidth: 860,
          overflow: 'hidden',
        }}
      >
        <div style={{ fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif", fontWeight: 600, fontSize: 64, letterSpacing: 3, color: '#101b31' }}>
          {m.text}
        </div>
        <div style={{ height: 8, background: m.color ?? '#c8102e', margin: '14px -44px -30px' }} />
      </div>
    );
  }

  const left = m.side === 'left';
  const scale = hero ? 1 : dim ? 0.9 : 0.96;
  const opacity = pop * (hero ? 1 : dim ? 0.84 : 0.95);
  return (
    <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: left ? 'flex-start' : 'flex-end', marginTop: 10, opacity, transform: `translateY(${rise}px) scale(${scale})`, transformOrigin: left ? 'left center' : 'right center' }}>
      <div
        style={{
          background: left ? '#ffffff' : '#1e3a8a',
          color: left ? '#101b31' : '#ffffff',
          borderRadius: 18,
          padding: hero ? '22px 36px' : '16px 28px',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: hero ? 52 : dim ? 42 : 46,
          fontWeight: 600,
          maxWidth: hero ? 780 : 640,
          boxShadow: '0 10px 34px #0008',
          overflow: 'hidden',
        }}
      >
        {showSender && m.kind === 'message' ? (
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: 2, opacity: 0.55, marginBottom: 6 }}>{m.sender.toUpperCase()}</div>
        ) : null}
        {m.text}
        {/* ticket-stub accent strip: the exact physical-card grammar */}
        <div style={{ height: 7, background: m.color ?? (left ? '#c8102e' : '#f8cc54'), margin: hero ? '12px -36px -22px' : '10px -28px -16px' }} />
      </div>
    </div>
  );
};

export const GroupChatOverlay: React.FC<GroupChatOverlayProps> = ({ title, messages, maxVisible = 3, showSenders = false, debug = false, heroIds = [], joinTtl = 1.1 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  if (debug) {
    // Debug path is intentionally loud so it can never pass QA unnoticed.
    throw new Error('GroupChatOverlay debug=true is never allowed in production renders');
  }
  // Joins live in the top safe area (over the wall, never over a face);
  // message bubbles stack lower-middle. The two zones never collide.
  const joins = messages.filter((m) => m.kind === 'join' && t >= m.at && t - m.at <= joinTtl);
  const bubbles = messages.filter((m) => m.kind !== 'join' && t >= m.at).slice(-maxVisible);
  void frame;
  return (
    <>
      <div style={{ position: 'absolute', left: 90, right: 90, top: 170, display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none' }}>
        {joins.map((m) => (
          <Bubble key={m.id} m={m} hero dim={false} showSender={false} />
        ))}
      </div>
      <div style={{ position: 'absolute', left: 90, right: 90, top: 600, display: 'flex', flexDirection: 'column', pointerEvents: 'none' }}>
        {title ? (
          <div
            style={{
              position: 'absolute',
              top: -450,
              alignSelf: 'center',
              background: '#0a0f1eb8',
              border: '1px solid #ffffff1a',
              borderRadius: 999,
              padding: '10px 24px',
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: 3,
              color: '#e8ddc8',
            }}
          >
            {title}
          </div>
        ) : null}
        {bubbles.map((m) => (
          <Bubble key={m.id} m={m} hero={heroIds.length === 0 || heroIds.includes(m.id)} dim={heroIds.length > 0 && !heroIds.includes(m.id)} showSender={showSenders} />
        ))}
      </div>
    </>
  );
};

/**
 * Signature 2D -> 3D transition: the hero Remotion message flies toward the
 * camera and fills the frame; the episode cuts to the Blender physical card
 * continuing the same motion, and the Remotion instance unmounts.
 */
export const ChatTakeover: React.FC<{ text: string; side: 'left' | 'right'; color?: string }> = ({ text, side, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = interpolate(frame / fps, [0, 0.3], [0, 1], { ...clamp, easing: (x: number) => 1 - Math.pow(1 - x, 3) });
  const left = side === 'left';
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <div
        style={{
          background: left ? '#ffffff' : '#1e3a8a',
          color: left ? '#101b31' : '#ffffff',
          borderRadius: 18,
          padding: '26px 44px',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 54,
          fontWeight: 700,
          boxShadow: '0 20px 80px #000c',
          transform: `scale(${1 + k * 4.2})`,
          opacity: 1,
          overflow: 'hidden',
          maxWidth: 900,
          textAlign: 'center',
        }}
      >
        {text}
        <div style={{ height: 9, background: color ?? (left ? '#c8102e' : '#f8cc54'), margin: '14px -44px -26px' }} />
      </div>
    </div>
  );
};
