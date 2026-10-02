import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { ShortCaptions, shortCues } from './Captions';
import { ShortCta } from './Cta';
import { ChatTakeover, GroupChatOverlay, type GroupChatMessage } from './GroupChatOverlay';
import { HncCta, HncHook } from './HncEntry';
import { ShortHook } from './Hook';
import { shortFrames, type ShortSpec } from './spec';
import { useDiaryFonts } from '../diaries/type';

/**
 * THE GROUP CHAT: CROATIA vs ENGLAND (episode 1).
 *
 * 14.4 s @ 60 fps, 1080x1920. Two polite fictional players, two supporters,
 * UI chat that becomes physical Blender cards. Episode data (messages,
 * palettes, plates) lives here; GroupChatOverlay stays reusable for future
 * country swaps without rebuilding the format.
 */

export const GROUP_CHAT_ID = 'group-chat-croatia-england';

export const GROUP_CHAT_SPEC: ShortSpec = {
  schema: 'hnc-short/1',
  id: GROUP_CHAT_ID,
  title: 'The Group Chat: Croatia vs England',
  fps: 60,
  width: 1080,
  height: 1920,
  hook: {
    headline: 'CROATIA OR ENGLAND?',
    subline: 'PICK BEFORE THE CHAT OPENS ↓',
    duration: 1.4,
    voice: {
      voiceId: 'HNC-NARRATOR-01',
      text: 'Croatia or England? Pick before the chat opens.',
      delivery: 'fast, playful, confident',
      at: 0.08,
      tempo: 1.4,
    },
  },
  scenes: [
    {
      id: 'polite-en',
      duration: 0.9,
      visual: { kind: 'plate', src: 'generated/shorts/group-chat-croatia-england/plates/02-polite-en.png' },
      voice: { voiceId: 'EN-PLAYER-01', text: 'Good luck.', delivery: 'dry, calm, softly', at: 0.8 },
    },
    {
      id: 'polite-hr',
      duration: 0.9,
      visual: { kind: 'plate', src: 'generated/shorts/group-chat-croatia-england/plates/02-polite-hr.png' },
      voice: { voiceId: 'HR-PLAYER-01', text: 'You too.', delivery: 'quick, dry, warm', at: 0.5, tempo: 1.35 },
    },
    {
      id: 'problem',
      duration: 1.3,
      visual: { kind: 'plate', src: 'generated/shorts/group-chat-croatia-england/plates/03-easy-win.png' },
      voice: { voiceId: 'EN-SUPPORTER-01', text: 'Easy win.', delivery: 'playful, fast, overconfident', at: 0.65 },
    },
    {
      id: 'answer',
      duration: 1.5,
      visual: { kind: 'plate', src: 'generated/shorts/group-chat-croatia-england/plates/04-screenshot.png' },
      voice: { voiceId: 'HR-SUPPORTER-01', text: 'Screenshot taken.', delivery: 'dry, understated, amused', at: 0.5 },
    },
    {
      id: 'meltdown',
      duration: 4.7,
      visual: { kind: 'plate', src: 'generated/shorts/group-chat-croatia-england/plates/05-chaos.png' },
    },
    {
      id: 'punchline',
      duration: 1.7,
      visual: { kind: 'plate', src: 'generated/shorts/group-chat-croatia-england/plates/06-final-message.png' },
    },
  ],
  cta: {
    headline: 'WHO TALKS TOO EARLY? ↓',
    subline: 'TAG THEM.',
    showUrl: true,
    duration: 2.0,
    voice: { voiceId: 'HNC-NARRATOR-01', text: 'Who talks too early?', delivery: 'fast, playful, confident', at: 0.05 },
  },
};

/**
 * Chat overlay window 1: polite -> answer (overlay zero = abs 1.4 s).
 * Shown over the Blender lounge plates; the meltdown lives in the windows
 * below so the UI never buries the physical cards it becomes.
 */
export const GROUP_CHAT_THREAD: GroupChatMessage[] = [
  { id: 'm1', kind: 'message', sender: 'EN player', side: 'right', text: 'good luck 🤝', at: 0.2, color: '#1b2a5e' },
  { id: 'm2', kind: 'message', sender: 'HR player', side: 'left', text: 'you too 🤝', at: 1.1, color: '#c8102e' },
  { id: 'j1', kind: 'join', sender: '', side: 'center', text: 'EN-SUPPORTER-01 joined the chat', at: 1.95 },
  { id: 'm3', kind: 'message', sender: 'EN supporter', side: 'right', text: 'easy win.', at: 2.35, color: '#1b2a5e' },
  { id: 'j2', kind: 'join', sender: '', side: 'center', text: 'HR-SUPPORTER-01 joined the chat', at: 3.25 },
  { id: 'm4', kind: 'message', sender: 'HR supporter', side: 'left', text: 'screenshot taken.', at: 3.7, color: '#c8102e' },
];

/**
 * Chat overlay window 2: the meltdown ignites as UI (overlay zero = abs 6.0 s,
 * the meltdown plate start), then the UI cuts out and the same messages
 * continue as PHYSICAL Blender cards for the rest of the meltdown. That
 * UI -> physical handoff is the series' signature transition.
 */
export const GROUP_CHAT_MELTDOWN_UI: GroupChatMessage[] = [
  { id: 'm5', kind: 'message', sender: 'EN supporter', side: 'right', text: '👀', at: 0.2, color: '#1b2a5e' },
  { id: 'm6', kind: 'message', sender: 'EN supporter', side: 'right', text: 'DELETE THAT', at: 0.7, color: '#1b2a5e' },
  { id: 'm7', kind: 'message', sender: 'HR supporter', side: 'left', text: "WE'LL COME BACK TO THIS", at: 1.2, color: '#c8102e' },
  { id: 'm8', kind: 'message', sender: 'EN player', side: 'right', text: 'admin please mute him', at: 1.7, color: '#1b2a5e' },
];

/** Chat overlay window 2: clean punchline foreground (overlay zero = abs 10.7 s). */
export const GROUP_CHAT_FINAL: GroupChatMessage[] = [
  { id: 'fin', kind: 'final', sender: '', side: 'center', text: 'SEE YOU AFTER FULL TIME.', at: 0.35 },
];

const CHAT_TITLE = 'MATCHDAY GROUP 🏆 · HR–EN';

const Background: React.FC<{ color: string }> = ({ color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const glow = 0.5 + 0.08 * Math.sin(t * 2.2);
  return (
    <AbsoluteFill style={{ background: color, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: -200, right: -200, bottom: -560, height: 1150, borderRadius: '50%', background: 'radial-gradient(closest-side, #1f6b3acc, #1f6b3a22 60%, transparent)', opacity: glow }} />
      <div style={{ position: 'absolute', left: 540 - 320, top: 620, width: 640, height: 640, borderRadius: 999, background: 'radial-gradient(closest-side, #f8cc5430, transparent)', opacity: 0.8 }} />
    </AbsoluteFill>
  );
};

export interface GroupChatFilmProps {
  spec?: ShortSpec;
  voices?: Record<string, { seconds: number }>;
  audio?: boolean;
  captions?: boolean;
}

const padLines = (spec: ShortSpec) => {
  const out: { id: string; at: number; speaker: string; text: string }[] = [];
  let t = 0;
  if (spec.hook.voice) out.push({ id: `${spec.id}-hook`, at: t + (spec.hook.voice.at ?? 0.08), speaker: spec.hook.voice.voiceId, text: spec.hook.voice.text });
  t += spec.hook.duration;
  for (const s of spec.scenes) {
    if (s.voice) out.push({ id: `${spec.id}-${s.id}`, at: t + (s.voice.at ?? 0.05), speaker: s.voice.voiceId, text: s.voice.text });
    t += s.duration;
  }
  if (spec.cta.voice) out.push({ id: `${spec.id}-cta`, at: t + (spec.cta.voice.at ?? 0.05), speaker: spec.cta.voice.voiceId, text: spec.cta.voice.text });
  return out;
};

export const GroupChatFilm: React.FC<GroupChatFilmProps> = ({ spec = GROUP_CHAT_SPEC, voices = {}, audio = true, captions = true }) => {
  const lines = React.useMemo(() => padLines(spec), [spec]);
  const cues = React.useMemo(() => shortCues(lines, voices), [lines, voices]);
  const hookFrames = shortFrames(spec.hook.duration, spec.fps);
  let from = hookFrames;
  const sceneRanges = spec.scenes.map((s) => {
    const frames = shortFrames(s.duration, spec.fps);
    const r = { from, frames, scene: s };
    from += frames;
    return r;
  });
  const ctaFrames = shortFrames(spec.cta.duration, spec.fps);
  const ctaFrom = from;
  const total = hookFrames + sceneRanges.reduce((n, r) => n + r.frames, 0) + ctaFrames;
  const stem = (name: string) => staticFile(`generated/shorts/${spec.id}/audio/${name}.wav`);
  const range = (id: string): number => sceneRanges.find((r) => r.scene.id === id)!.from;
  // Thread UI: polite-en start -> meltdown start. Meltdown UI: first 2 s of the
  // meltdown plate (UI -> physical handoff), then physical cards alone.
  const threadFrom = range('polite-en');
  const threadFrames = range('meltdown') - threadFrom;
  const meltdownUiFrom = range('meltdown');
  const meltdownUiFrames = shortFrames(2.0, spec.fps);
  const punch = sceneRanges.find((r) => r.scene.id === 'punchline')!;
  const punchPlate = punch.scene.visual.kind === 'plate' ? punch.scene.visual.src : null;
  return (
    <AbsoluteFill style={{ background: '#0a0f1e' }}>
      <Sequence from={0} durationInFrames={total} name="base">
        <Background color="#101b31" />
      </Sequence>
      {sceneRanges.map((r) =>
        r.scene.visual.kind === 'plate' ? (
          <Sequence key={r.scene.id} from={r.from} durationInFrames={r.frames} name={r.scene.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={staticFile(r.scene.visual.src)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          </Sequence>
        ) : null,
      )}
      <Sequence from={0} durationInFrames={hookFrames} name="hook">
        <ShortHook headline={spec.hook.headline} subline={spec.hook.subline} />
      </Sequence>
      <Sequence from={threadFrom} durationInFrames={threadFrames} name="chat-thread">
        <GroupChatOverlay title={CHAT_TITLE} messages={GROUP_CHAT_THREAD} maxVisible={6} />
      </Sequence>
      <Sequence from={meltdownUiFrom} durationInFrames={meltdownUiFrames} name="chat-meltdown-ui">
        <GroupChatOverlay title={CHAT_TITLE} messages={GROUP_CHAT_MELTDOWN_UI} maxVisible={5} />
      </Sequence>
      <Sequence from={punch.from} durationInFrames={punch.frames} name="chat-final">
        <GroupChatOverlay messages={GROUP_CHAT_FINAL} maxVisible={2} />
      </Sequence>
      {/* CTA holds the punchline plate underneath (dimmed) so the cut never drops to flat colour. */}
      {punchPlate ? (
        <Sequence from={ctaFrom} durationInFrames={ctaFrames} name="cta-plate">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={staticFile(punchPlate)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.45 }} />
          <div style={{ position: 'absolute', inset: 0, background: '#0a0f1e99' }} />
        </Sequence>
      ) : null}
      <Sequence from={ctaFrom} durationInFrames={ctaFrames} name="cta">
        <ShortCta headline={spec.cta.headline} subline={spec.cta.subline} showUrl={spec.cta.showUrl} />
      </Sequence>
      {captions ? <ShortCaptions cues={cues} /> : null}
      {audio
        ? (['voice', 'sfx', 'music', 'room'] as const).map((n) => (
            <Audio key={n} src={stem(n)} />
          ))
        : null}
    </AbsoluteFill>
  );
};

export const groupChatMetadata = ({ props }: { props: GroupChatFilmProps }) => {
  const spec = props.spec ?? GROUP_CHAT_SPEC;
  const total = spec.hook.duration + spec.scenes.reduce((n, s) => n + s.duration, 0) + spec.cta.duration;
  return { durationInFrames: shortFrames(total, spec.fps), fps: spec.fps, width: 1080, height: 1920 };
};

/* ================================================================ V2 == */

export const GROUP_CHAT_V2_ID = 'group-chat-croatia-england-v2';
const V2_PLATE = (name: string) => `generated/shorts/${GROUP_CHAT_V2_ID}/plates-v2/${name}.png`;

/**
 * THE GROUP CHAT V2: same story, professional execution. 13.1 s @ 60 fps.
 *
 * Ownership (ONE MESSAGE = ONE REPRESENTATION): polite lines live ONLY as
 * physical cards (no 2D bubbles); joins live ONLY as UI pills; the meltdown
 * ignites as clean UI then hands off via ChatTakeover to physical cards;
 * the punchline lives ONLY physically; the CTA ticket flips out of that
 * card space. No sender labels, no debug layers, no duplicated captions.
 */
export const GROUP_CHAT_SPEC_V2: ShortSpec = {
  schema: 'hnc-short/1',
  id: GROUP_CHAT_V2_ID,
  title: 'The Group Chat: Croatia vs England (V2)',
  fps: 60,
  width: 1080,
  height: 1920,
  hook: {
    headline: 'CROATIA OR ENGLAND?',
    subline: 'PICK A SIDE ↓',
    duration: 1.1,
    voice: {
      voiceId: 'HNC-NARRATOR-01',
      text: 'Croatia or England? Pick a side.',
      say: 'Cro-ay-sha! Or England? Pick a side.',
      delivery: 'fast, playful, confident',
      at: 0.05,
      tempo: 1.55,
    },
  },
  scenes: [
    {
      id: 'polite-en',
      duration: 0.8,
      visual: { kind: 'plate', src: V2_PLATE('02-polite-en') },
      voice: { voiceId: 'EN-PLAYER-01', text: 'Good luck.', delivery: 'dry, calm, softly', at: 0.12 },
    },
    {
      id: 'polite-hr',
      duration: 0.9,
      visual: { kind: 'plate', src: V2_PLATE('02-polite-hr') },
      voice: { voiceId: 'HR-PLAYER-01', text: 'You too.', delivery: 'quick, dry, warm', at: 0.08, tempo: 1.35 },
    },
    {
      id: 'problem',
      duration: 1.0,
      visual: { kind: 'plate', src: V2_PLATE('03-easy-win') },
      voice: { voiceId: 'EN-SUPPORTER-01', text: 'Easy win.', delivery: 'playful, fast, overconfident', at: 0.35 },
    },
    {
      id: 'answer',
      duration: 1.0,
      visual: { kind: 'plate', src: V2_PLATE('04-screenshot') },
      voice: { voiceId: 'HR-SUPPORTER-01', text: 'Screenshot taken.', delivery: 'dry, understated, amused', at: 0.3 },
    },
    {
      id: 'meltdown',
      duration: 1.3,
      visual: { kind: 'plate', src: V2_PLATE('03-easy-win') },
    },
    {
      id: 'takeover',
      duration: 0.3,
      visual: { kind: 'plate', src: V2_PLATE('03-easy-win') },
    },
    {
      id: 'chaos-a',
      duration: 0.35,
      visual: { kind: 'plate', src: V2_PLATE('05-takeover-physical') },
    },
    {
      id: 'chaos-a-pile',
      duration: 0.65,
      visual: { kind: 'plate', src: V2_PLATE('05-chaos-a') },
    },
    {
      id: 'chaos-b',
      duration: 0.8,
      visual: { kind: 'plate', src: V2_PLATE('05-chaos-b') },
    },
    {
      id: 'chaos-c',
      duration: 0.8,
      visual: { kind: 'plate', src: V2_PLATE('05-chaos-c') },
    },
    {
      id: 'chaos-d',
      duration: 0.7,
      visual: { kind: 'plate', src: V2_PLATE('05-chaos-d') },
    },
    {
      id: 'overwhelm',
      duration: 0.7,
      visual: { kind: 'plate', src: V2_PLATE('05-overwhelm') },
    },
    {
      id: 'breath',
      duration: 0.2,
      visual: { kind: 'plate', src: V2_PLATE('06-final-message') },
    },
    {
      id: 'punchline',
      duration: 1.0,
      visual: { kind: 'plate', src: V2_PLATE('06-final-message') },
    },
  ],
  cta: {
    headline: 'WHO TALKS BEFORE KICKOFF?',
    subline: 'TAG THEM ↓',
    showUrl: true,
    duration: 1.5,
    voice: { voiceId: 'HNC-NARRATOR-01', text: 'Who talks before kickoff?', delivery: 'fast, playful, confident', at: 0.05 },
  },
};

export type GroupChatV2Representation = 'ui' | 'takeover' | 'physical';

export interface GroupChatV2RepresentationWindow {
  messageId: string;
  kind: GroupChatV2Representation;
  from: number;
  to: number;
}

/**
 * Absolute ownership windows for every message that crosses media. Endpoints
 * are half-open, so DELETE THAT changes representation on one exact frame
 * boundary instead of existing twice during the handoff.
 */
export const GROUP_CHAT_V2_REPRESENTATION_WINDOWS: readonly GroupChatV2RepresentationWindow[] = [
  { messageId: 'good-luck', kind: 'ui', from: 1.1, to: 1.9 },
  { messageId: 'you-too', kind: 'ui', from: 1.9, to: 2.8 },
  { messageId: 'easy-win', kind: 'ui', from: 2.8, to: 3.8 },
  { messageId: 'screenshot-taken', kind: 'ui', from: 3.8, to: 4.8 },
  { messageId: 'delete-that', kind: 'ui', from: 5.15, to: 6.1 },
  { messageId: 'delete-that', kind: 'takeover', from: 6.1, to: 6.4 },
  { messageId: 'delete-that', kind: 'physical', from: 6.4, to: 10.4 },
  { messageId: 'come-back', kind: 'ui', from: 5.45, to: 6.1 },
  { messageId: 'come-back', kind: 'physical', from: 8.2, to: 10.4 },
] as const;

export const groupChatV2RepresentationAt = (messageId: string, seconds: number): GroupChatV2Representation | null =>
  GROUP_CHAT_V2_REPRESENTATION_WINDOWS.find((window) => window.messageId === messageId && seconds >= window.from && seconds < window.to)?.kind ?? null;

/** The polite conversation is deliberately clean 2D UI over card-free plates. */
const V2_THREAD: GroupChatMessage[] = [
  { id: 'good-luck', kind: 'message', sender: '', side: 'right', text: 'good luck.', at: 0.08, color: '#1b2a5e' },
  { id: 'you-too', kind: 'message', sender: '', side: 'left', text: 'you too.', at: 0.88, color: '#e30a17' },
  { id: 'join-en', kind: 'join', sender: '', side: 'center', text: 'EN SUPPORTER JOINED', at: 1.72 },
  { id: 'easy-win', kind: 'message', sender: '', side: 'right', text: 'easy win.', at: 2.05, color: '#1b2a5e' },
  { id: 'join-hr', kind: 'join', sender: '', side: 'center', text: 'HR SUPPORTER JOINED', at: 2.72 },
  { id: 'screenshot-taken', kind: 'message', sender: '', side: 'left', text: 'screenshot taken.', at: 3.0, color: '#e30a17' },
];

/** Meltdown UI: two readable messages only, no glyph-dependent emoji or debug labels. */
const V2_MELTDOWN: GroupChatMessage[] = [
  { id: 'm-take', kind: 'message', sender: '', side: 'right', text: 'DELETE THAT', at: 0.35, color: '#1b2a5e' },
  { id: 'm-back', kind: 'message', sender: '', side: 'left', text: "WE'LL COME BACK TO THIS", at: 0.65, color: '#c8102e' },
];

interface Cam { s0: number; s1: number; x0: number; x1: number; vibe?: 'vibrate' | 'handheld' }

/** Cinematic progression: locked polite -> push-in -> handheld chaos -> stable punchline. */
const V2_CAM: Record<string, Cam> = {
  hook: { s0: 1.1, s1: 1.16, x0: 0, x1: 0, vibe: 'vibrate' },
  'polite-en': { s0: 1.0, s1: 1.03, x0: 30, x1: 30 },
  'polite-hr': { s0: 1.0, s1: 1.03, x0: -30, x1: -30 },
  problem: { s0: 1.0, s1: 1.04, x0: 10, x1: 10 },
  answer: { s0: 1.0, s1: 1.03, x0: -10, x1: -12 },
  meltdown: { s0: 1.07, s1: 1.12, x0: -40, x1: -40, vibe: 'handheld' },
  takeover: { s0: 1.12, s1: 1.3, x0: -40, x1: -40 },
  'chaos-a': { s0: 2.0, s1: 1.0, x0: 0, x1: 0 },
  'chaos-a-pile': { s0: 1.0, s1: 1.06, x0: 0, x1: 10, vibe: 'handheld' },
  'chaos-b': { s0: 1.12, s1: 1.16, x0: 0, x1: -10, vibe: 'handheld' },
  'chaos-c': { s0: 1.08, s1: 1.14, x0: 10, x1: 0, vibe: 'handheld' },
  'chaos-d': { s0: 1.05, s1: 1.08, x0: -60, x1: -60, vibe: 'handheld' },
  overwhelm: { s0: 1.18, s1: 1.24, x0: 0, x1: 0 },
  breath: { s0: 1.05, s1: 1.05, x0: 0, x1: 0 },
  punchline: { s0: 1.05, s1: 1.05, x0: 0, x1: 0 },
  cta: { s0: 1.05, s1: 1.08, x0: 0, x1: 0 },
};

const PlateShot: React.FC<{ src: string; cam: Cam; dim?: number }> = ({ src, cam, dim = 0 }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const k = durationInFrames > 1 ? frame / (durationInFrames - 1) : 1;
  const e = 1 - Math.pow(1 - k, 3);
  let x = cam.x0 + (cam.x1 - cam.x0) * e;
  let y = 0;
  let rot = 0;
  if (cam.vibe === 'vibrate' && t < 0.45) {
    x += Math.sin(t * 2 * Math.PI * 28) * 7 * (1 - t / 0.45);
  } else if (cam.vibe === 'handheld') {
    x += Math.sin(t * 2 * Math.PI * 0.6) * 8;
    y += Math.cos(t * 2 * Math.PI * 0.43) * 6;
    rot = Math.sin(t * 2 * Math.PI * 0.5) * 0.15;
  }
  const s = cam.s0 + (cam.s1 - cam.s0) * e;
  return (
    <div style={{ position: 'absolute', inset: -60, transform: `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${s})` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={staticFile(src)} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: dim > 0 ? `brightness(${1 - dim})` : undefined }} />
      {dim > 0 ? <div style={{ position: 'absolute', inset: 0, background: `rgba(10,15,30,${dim * 0.55})` }} /> : null}
    </div>
  );
};

export interface GroupChatFilmV2Props extends GroupChatFilmProps {
  variant?: 'programme' | 'scoreboard' | 'ticket';
}

export const GroupChatFilmV2: React.FC<GroupChatFilmV2Props> = ({ spec = GROUP_CHAT_SPEC_V2, voices = {}, audio = true, captions = true, variant = 'programme' }) => {
  useDiaryFonts();
  const lines = React.useMemo(() => padLines(spec), [spec]);
  const cues = React.useMemo(() => shortCues(lines, voices), [lines, voices]);
  const hookFrames = shortFrames(spec.hook.duration, spec.fps);
  let from = hookFrames;
  const sceneRanges = spec.scenes.map((s) => {
    const frames = shortFrames(s.duration, spec.fps);
    const r = { from, frames, scene: s };
    from += frames;
    return r;
  });
  const ctaFrames = shortFrames(spec.cta.duration, spec.fps);
  const ctaFrom = from;
  const total = hookFrames + sceneRanges.reduce((n, r) => n + r.frames, 0) + ctaFrames;
  const stem = (name: string) => staticFile(`generated/shorts/${spec.id}/audio/${name}.wav`);
  const range = (id: string) => sceneRanges.find((r) => r.scene.id === id)!;
  const plateOf = (id: string): string => {
    const v = range(id).scene.visual;
    return v.kind === 'plate' ? v.src : '';
  };
  const hookPlate = V2_PLATE('01-hook');
  const excludeOnScreenCopy = lines.map((line) => line.id);
  return (
    <AbsoluteFill style={{ background: '#0a0f1e' }}>
      <Sequence from={0} durationInFrames={total} name="base">
        <Background color="#101b31" />
      </Sequence>
      {/* hook rides the vibrating phone close-up: movement at frame 0 */}
      <Sequence from={0} durationInFrames={hookFrames} name="hook">
        <PlateShot src={hookPlate} cam={V2_CAM.hook} />
        <HncHook variant={variant === 'scoreboard' ? 'scoreboard' : 'programme'} />
      </Sequence>
      {sceneRanges.map((r) =>
        r.scene.id === 'takeover' ? (
          <Sequence key={r.scene.id} from={r.from} durationInFrames={r.frames} name={r.scene.id}>
            <PlateShot src={plateOf('takeover')} cam={V2_CAM.takeover} dim={0.35} />
            <ChatTakeover text="DELETE THAT" side="right" color="#1b2a5e" />
          </Sequence>
        ) : (
          <Sequence key={r.scene.id} from={r.from} durationInFrames={r.frames} name={r.scene.id}>
            <PlateShot src={plateOf(r.scene.id)} cam={V2_CAM[r.scene.id] ?? { s0: 1, s1: 1, x0: 0, x1: 0 }} dim={r.scene.id === 'meltdown' ? 0.3 : 0} />
          </Sequence>
        ),
      )}
      {/* Modern chat UI owns the polite exchange. The underlying plates are card-free. */}
      <Sequence from={range('polite-en').from} durationInFrames={range('answer').from + range('answer').frames - range('polite-en').from} name="chat-thread">
        <GroupChatOverlay messages={V2_THREAD} maxVisible={2} heroIds={['good-luck', 'you-too', 'easy-win', 'screenshot-taken']} />
      </Sequence>
      <Sequence from={range('meltdown').from} durationInFrames={range('meltdown').frames} name="chat-meltdown-ui">
        <GroupChatOverlay messages={V2_MELTDOWN} maxVisible={3} heroIds={['m-take']} />
      </Sequence>
      {/* CTA emerges from the punchline card world (dimmed final plate). */}
      <Sequence from={ctaFrom} durationInFrames={ctaFrames} name="cta-plate">
        <PlateShot src={plateOf('punchline')} cam={V2_CAM.cta} />
        <div style={{ position: 'absolute', inset: 0, background: '#0a0f1eb8' }} />
        <HncCta variant="ticket" />
      </Sequence>
      {captions ? <ShortCaptions cues={cues} excludeIds={excludeOnScreenCopy} /> : null}
      {audio ? <Audio src={stem('audio-mix-v2')} /> : null}
    </AbsoluteFill>
  );
};

export const groupChatV2Metadata = ({ props }: { props: GroupChatFilmV2Props }) => {
  const spec = props.spec ?? GROUP_CHAT_SPEC_V2;
  const total = spec.hook.duration + spec.scenes.reduce((n, s) => n + s.duration, 0) + spec.cta.duration;
  return { durationInFrames: shortFrames(total, spec.fps), fps: spec.fps, width: 1080, height: 1920 };
};
