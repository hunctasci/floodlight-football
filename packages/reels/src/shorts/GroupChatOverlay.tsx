import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

/**
 * Reusable Group Chat overlay for THE GROUP CHAT series.
 *
 * Episode-agnostic: all copy/senders/colours come from props. Episode data
 * provides messages; this component only times, stacks and styles them.
 * Supports join notifications, messages (either side), emoji, and a clean
 * final foreground card. Deterministic — no Math.random.
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
  /** Accent dot colour for the sender (episode palette). */
  color?: string;
}

export interface GroupChatOverlayProps {
  /** Header pill (e.g. group name). Omitted for clean foreground cards. */
  title?: string;
  messages: GroupChatMessage[];
  /** Max bubbles visible (older ones fade). */
  maxVisible?: number;
}

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const Bubble: React.FC<{ m: GroupChatMessage; index: number }> = ({ m, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const local = Math.max(0, t - m.at);
  const pop = spring({ frame: Math.floor(local * fps), fps, config: { damping: 18, stiffness: 320, mass: 0.7 } });
  const rise = interpolate(pop, [0, 1], [26, 0]);
  if (local <= 0) return null;

  if (m.kind === 'join') {
    return (
      <div
        key={m.id}
        style={{
          alignSelf: 'center',
          opacity: pop,
          background: '#ffffff14',
          border: '1px solid #ffffff22',
          borderRadius: 999,
          padding: '10px 26px',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 30,
          fontWeight: 600,
          color: '#cfd6e4',
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
          borderRadius: 26,
          padding: '30px 44px',
          textAlign: 'center',
          boxShadow: '0 18px 70px #000b',
          transform: `translateY(${rise}px) scale(${0.92 + 0.08 * pop})`,
          maxWidth: 860,
        }}
      >
        <div style={{ fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif", fontWeight: 600, fontSize: 64, letterSpacing: 3, color: '#101b31' }}>
          {m.text}
        </div>
      </div>
    );
  }

  const left = m.side === 'left';
  return (
    <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: left ? 'flex-start' : 'flex-end', marginTop: 10, opacity: pop, transform: `translateY(${rise}px)` }}>
      <div style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: 26, fontWeight: 600, color: '#9aa3b8', marginBottom: 4, paddingLeft: left ? 8 : 0, paddingRight: left ? 0 : 8 }}>
        <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 7, background: m.color ?? (left ? '#c8102e' : '#1b2a5e'), marginRight: 8 }} />
        {m.sender}
      </div>
      <div
        style={{
          background: left ? '#ffffff' : '#1e3a8a',
          color: left ? '#101b31' : '#ffffff',
          borderRadius: 26,
          borderTopLeftRadius: left ? 8 : 26,
          borderTopRightRadius: left ? 26 : 8,
          padding: '20px 32px',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 44,
          fontWeight: 600,
          maxWidth: 760,
          boxShadow: '0 10px 34px #0008',
        }}
      >
        {m.text}
      </div>
    </div>
  );
};

export const GroupChatOverlay: React.FC<GroupChatOverlayProps> = ({ title, messages, maxVisible = 6 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const visible = messages.filter((m) => t >= m.at).slice(-maxVisible);
  const enter = interpolate(frame, [0, Math.min(12, fps * 0.25)], [0, 1], clamp);
  void enter;
  void frame;
  return (
    <div style={{ position: 'absolute', left: 90, right: 90, top: 640, display: 'flex', flexDirection: 'column', pointerEvents: 'none' }}>
      {title ? (
        <div
          style={{
            alignSelf: 'center',
            background: '#0a0f1ecc',
            border: '1px solid #ffffff1e',
            borderRadius: 20,
            padding: '14px 30px',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: 2,
            color: '#f8efdb',
            marginBottom: 12,
          }}
        >
          {title}
        </div>
      ) : null}
      {visible.map((m, i) => (
        <Bubble key={m.id} m={m} index={i} />
      ))}
    </div>
  );
};
