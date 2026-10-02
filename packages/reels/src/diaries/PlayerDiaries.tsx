import React from 'react';
import { AbsoluteFill, Audio, Img, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import type { ContentSpec } from '../engine/spec/types';
import { ContentComposition } from '../render/ContentComposition';
import { Captions, captionCues } from './Captions';
import { EndCard, HookBox, ItalyRematchEndCard, MatchCard, NextEpisode, QuestionCard, TimeStamp, TitleCard } from './cards';
import { ArchiveGate, lookFilter, Super, TVInRoom } from './Memory';
import { KineticOver, StatsOpener } from './Opener';
import { EPISODES, timeline, type Quality, type TimedShot } from './edit';
import { ScoreBug, scoreBugText } from './ScoreBug';
import { DIARY_TYPE, useDiaryFonts } from './type';

export interface PlayerDiariesProps {
  episode: string;
  quality: Quality;
  /** Review aid for the animatic: shot id + timecode. */
  review?: boolean;
  /** Burned-in speaker captions — on in the master since v3 (mouthless characters); false = clean. */
  captions?: boolean;
  /** Review renders may omit absent episode stems without generating any audio. */
  audio?: boolean;
  /** Delivery timebase; builders remain authored against edit.fps. */
  deliveryFps?: number;
}

const pad4 = (n: number): string => String(n).padStart(4, '0');

/** One Blender plate frame (frame-accurate image sequence). */
const Plate: React.FC<{ episode: string; quality: Quality; shot: TimedShot; local: number }> = ({ episode, quality, shot, local }) => (
  <Img
    src={staticFile(`generated/diaries/${episode}/${quality}/${shot.id}/${pad4(Math.min(shot.frames, local + 1))}.png`)}
    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
  />
);

/** Film grain over EVERY shot (Blender and Remotion alike): one picture language. */
const Grain: React.FC<{ frame: number }> = ({ frame }) => {
  const x = (frame * 137) % 512;
  const y = (frame * 251) % 512;
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url(${staticFile('generated/diaries/grain.png')})`,
        backgroundPosition: `${x}px ${y}px`,
        backgroundSize: '512px 512px',
        mixBlendMode: 'overlay',
        opacity: 0.22,
        pointerEvents: 'none',
      }}
    />
  );
};

const Shot: React.FC<{ episode: string; quality: Quality; shot: TimedShot; phones: Record<string, ContentSpec> }> = ({ episode, quality, shot, phones }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (shot.phone) {
    const spec = phones[shot.phone];
    if (!spec) throw new Error(`${shot.id}: no phone piece "${shot.phone}" in ${episode}`);
    return (
      <AbsoluteFill>
        <ContentComposition spec={spec} format="reel" />
        {shot.hook ? <HookBox text={shot.hook} sub={shot.hookTr} /> : null}
        {shot.phone === 'teaser' ? <NextEpisode frame={frame} fps={fps} line="Player Diaries · Episode 02" /> : null}
      </AbsoluteFill>
    );
  }
  const sc = shot.screen;
  if (sc?.type === 'title') return <TitleCard frame={frame} fps={fps} title={sc.title} kicker={sc.kicker} />;
  if (sc?.type === 'end') return <EndCard frame={frame} fps={fps} series={sc.series} />;
  if (shot.id === 'S16_SH01' && episode === 'italy-rematch') return <ItalyRematchEndCard frame={frame} fps={fps} />;
  if (sc?.type === 'tv') return <TVInRoom score={sc.score} frame={frame} />;
  if (sc?.type === 'opener') return <StatsOpener frame={frame} fps={fps} beats={sc.beats} />;
  if (shot.renderer !== 'remotion') {
    return (
      <AbsoluteFill style={{ background: '#000' }}>
        <AbsoluteFill style={lookFilter(shot.look, frame)}>
          <Plate episode={episode} quality={quality} shot={shot} local={frame} />
        </AbsoluteFill>
        {shot.look === 'archive' ? <ArchiveGate frame={frame} /> : null}
        {shot.kinetic ? <KineticOver frame={frame} fps={fps} {...shot.kinetic} /> : null}
        {sc?.type === 'match' ? <MatchCard frame={frame} fps={fps} home={sc.home} away={sc.away} line={sc.line} /> : null}
      </AbsoluteFill>
    );
  }
  if (shot.id === 'S01_SH01') return <AbsoluteFill style={{ background: '#000' }} />;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Plate episode={episode} quality={quality} shot={shot} local={frame} />
    </AbsoluteFill>
  );
};

const SuperLayer: React.FC<{ title: string; sub: string; side: 'left' | 'right'; color: string; frames: number }> = (p) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return <Super frame={frame} fps={fps} {...p} />;
};

const Stamp: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return <TimeStamp frame={frame} fps={fps} text={text} />;
};

const Question: React.FC<{ text: string; tr?: string; frames: number }> = ({ text, tr, frames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return <QuestionCard frame={frame} fps={fps} text={text} tr={tr} frames={frames} />;
};

/** Animatic review aid: shot id, renderer and timecode (top-left). */
const Review: React.FC<{ shots: TimedShot[] }> = ({ shots }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const shot = shots.find((s) => frame >= s.from && frame < s.from + s.frames)!;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', top: 70, left: 40, fontFamily: DIARY_TYPE.text, fontSize: 28, color: '#fff', background: '#000a', padding: '6px 12px', borderRadius: 6 }}>
        {shot.id} · {shot.renderer} · {(frame / fps).toFixed(2)}s
      </div>
    </AbsoluteFill>
  );
};

export const PlayerDiaries: React.FC<PlayerDiariesProps> = ({ episode, quality, review, captions = true, audio = true, deliveryFps }) => {
  useDiaryFonts();
  const frame = useCurrentFrame();
  const ep = EPISODES[episode];
  const fps = deliveryFps ?? ep.edit.fps;
  const { shots } = timeline(ep.edit, fps);
  const cues = React.useMemo(
    () => captionCues(shots, fps, new Map(ep.dialogue.lines.map((l) => [l.id, ep.subtitles === 'tr' && l.tr ? { ...l, text: l.tr } : l])), ep.voices),
    [shots, ep, fps],
  );
  const stem = (name: string) => staticFile(`generated/diaries/${episode}/audio/${name}.wav`);
  const bugText = ep.edit.scoreBug ? scoreBugText(shots, fps, ep.edit.scoreBug, frame) : null;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {shots.map((s) => (
        <Sequence key={s.id} from={s.from} durationInFrames={s.frames} name={s.id}>
          <Shot episode={episode} quality={quality} shot={s} phones={ep.phones} />
        </Sequence>
      ))}
      <Grain frame={frame} />
      {ep.edit.hook ? (
        <Sequence from={0} durationInFrames={Math.round(ep.edit.hook.dur * fps)} name="hook">
          <HookBox text={ep.edit.hook.text} sub={ep.edit.hook.tr} />
        </Sequence>
      ) : null}
      {bugText ? <ScoreBug text={bugText} /> : null}
      {shots.map((s) => (s.super ? (
        <Sequence key={`super-${s.id}`} from={s.from} durationInFrames={Math.min(s.frames, Math.round(2.4 * ep.edit.fps))} name={`super:${s.id}`}>
          <SuperLayer {...s.super} frames={Math.min(s.frames, Math.round(2.4 * ep.edit.fps))} />
        </Sequence>
      ) : null))}
      {shots.map((s) => (s.stamp ? (
        <Sequence key={`stamp-${s.id}`} from={s.from} durationInFrames={Math.round(2.2 * ep.edit.fps)} name={`stamp:${s.id}`}>
          <Stamp text={s.stamp} />
        </Sequence>
      ) : null))}
      {shots.flatMap((s) =>
        (s.cards ?? []).map((c, i) => {
          // a question may run over the next shots (montage): it is placed on the episode clock
          const frames = Math.round(c.dur * ep.edit.fps);
          return (
            <Sequence key={`card-${s.id}-${i}`} from={s.from + Math.round(c.at * ep.edit.fps)} durationInFrames={frames} name={`card:${s.id}`}>
              <Question text={c.text} tr={c.tr} frames={frames} />
            </Sequence>
          );
        }),
      )}
      {captions ? <Captions cues={cues} /> : null}
      {review ? <Review shots={shots} /> : null}
      {audio ? ['dialogue', 'sfx', 'ambience', 'music'].map((n) => (
        <Audio key={n} src={stem(n)} />
      )) : null}
    </AbsoluteFill>
  );
};

export const playerDiariesMetadata = ({ props }: { props: PlayerDiariesProps }) => {
  const ep = EPISODES[props.episode];
  const fps = props.deliveryFps ?? ep.edit.fps;
  return { durationInFrames: timeline(ep.edit, fps).total, fps, width: 1080, height: 1920 };
};
