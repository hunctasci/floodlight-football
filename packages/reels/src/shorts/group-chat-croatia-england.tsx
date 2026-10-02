import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { ShortCaptions, shortCues } from './Captions';
import { ShortCta } from './Cta';
import { GroupChatOverlay, type GroupChatMessage } from './GroupChatOverlay';
import { ShortHook } from './Hook';
import { shortFrames, type ShortSpec } from './spec';

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
