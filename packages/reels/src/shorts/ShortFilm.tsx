import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { ShortCaptions, shortCues } from './Captions';
import { ShortCta } from './Cta';
import { ShortHook } from './Hook';
import { shortDuration, shortFrames, type ShortSpec } from './spec';

export interface ShortFilmProps {
  spec: ShortSpec;
  /** Take lengths from the voice cache (voices.json) — drives caption timing. */
  voices?: Record<string, { seconds: number }>;
  /** Play assembled stems; review renders may mute. */
  audio?: boolean;
  /** Burn captions (default on). */
  captions?: boolean;
}

const padLines = (spec: ShortSpec): { id: string; at: number; speaker: string; text: string }[] => {
  const out: { id: string; at: number; speaker: string; text: string }[] = [];
  let t = 0;
  const hookAt = spec.hook.voice?.at ?? 0.08;
  if (spec.hook.voice) out.push({ id: `${spec.id}-hook`, at: t + hookAt, speaker: spec.hook.voice.voiceId, text: spec.hook.voice.text });
  t += spec.hook.duration;
  for (const s of spec.scenes) {
    if (s.voice) out.push({ id: `${spec.id}-${s.id}`, at: t + (s.voice.at ?? 0.05), speaker: s.voice.voiceId, text: s.voice.text });
    t += s.duration;
  }
  if (spec.cta.voice) out.push({ id: `${spec.id}-cta`, at: t + (spec.cta.voice.at ?? 0.05), speaker: spec.cta.voice.voiceId, text: spec.cta.voice.text });
  return out;
};

/** Placeholder HNC background (Remotion-side). Blender plates cover it when present. */
const Background: React.FC<{ color: string }> = ({ color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const glow = 0.5 + 0.08 * Math.sin(t * 2.2);
  return (
    <AbsoluteFill style={{ background: color, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: -200, right: -200, bottom: -560, height: 1150, borderRadius: '50%', background: 'radial-gradient(closest-side, #1f6b3acc, #1f6b3a22 60%, transparent)', opacity: glow }} />
      <div style={{ position: 'absolute', left: 540 - 320, top: 620, width: 640, height: 640, borderRadius: 999, background: 'radial-gradient(closest-side, #f8cc5430, transparent)', opacity: 0.8 }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 940, height: 3, background: '#f8efdb12' }} />
      <div style={{ position: 'absolute', left: 540 - 300, top: 880 - 300 + Math.sin(t * 1.4) * 8, width: 600, height: 600, borderRadius: 999, border: '3px solid #f8efdb14' }} />
    </AbsoluteFill>
  );
};

export const ShortFilm: React.FC<ShortFilmProps> = ({ spec, voices = {}, audio = true, captions = true }) => {
  const { fps } = useVideoConfig();
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
  const stem = (name: string) => staticFile(`generated/shorts/${spec.id}/audio/${name}.wav`);
  return (
    <AbsoluteFill style={{ background: '#0a0f1e' }}>
      {/* base + Blender plates (plates cover the base when configured) */}
      <Sequence from={0} durationInFrames={hookFrames + sceneRanges.reduce((n, r) => n + r.frames, 0) + ctaFrames} name="base">
        <Background color={spec.scenes[0]?.visual.kind === 'color' ? spec.scenes[0].visual.color : '#101b31'} />
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
      {spec.scenes.map((s) =>
        s.overlay ? (
          <Sequence key={`overlay-${s.id}`} from={sceneRanges.find((r) => r.scene.id === s.id)!.from} durationInFrames={sceneRanges.find((r) => r.scene.id === s.id)!.frames} name={`overlay:${s.id}`}>
            <ShortHook headline={s.overlay} />
          </Sequence>
        ) : null,
      )}
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

export const shortMetadata = ({ props }: { props: ShortFilmProps }) => ({
  durationInFrames: shortFrames(shortDuration(props.spec), props.spec.fps),
  fps: props.spec.fps,
  width: 1080,
  height: 1920,
});
