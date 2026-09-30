import React from 'react';
import { AbsoluteFill, Audio, Img, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { EndCard, MatchCard, TitleCard } from './cards';
import { EPISODES, timeline, type Quality, type TimedShot } from './edit';
import { DIARY_TYPE, useDiaryFonts } from './type';

export interface PlayerDiariesProps {
  episode: string;
  quality: Quality;
  /** Review aids for the animatic: shot ids, timecode and dialogue captions. */
  review?: boolean;
  /** Burned-in captions (a separate accessibility deliverable; the main reel ships clean + .srt). */
  captions?: boolean;
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

const Shot: React.FC<{ episode: string; quality: Quality; shot: TimedShot }> = ({ episode, quality, shot }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (shot.id === 'S01_SH01') return <AbsoluteFill style={{ background: '#000' }} />;
  if (shot.id === 'S01_SH03') return <TitleCard frame={frame} fps={fps} title="48 Hours Before Belgium" kicker="HNC Player Diaries · Episode 01" />;
  if (shot.id === 'S11_SH04') return <EndCard frame={frame} fps={fps} series="Player Diaries · Episode 01" />;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Plate episode={episode} quality={quality} shot={shot} local={frame} />
      {shot.id === 'S10_SH09' ? <MatchCard frame={frame} fps={fps} home="Belgium" away="Türkiye" line="Friday · 20:45" /> : null}
    </AbsoluteFill>
  );
};

const Review: React.FC<{ shots: TimedShot[]; lines: Map<string, { speaker: string; text: string }>; captionsOnly?: boolean }> = ({ shots, lines, captionsOnly }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const shot = shots.find((s) => frame >= s.from && frame < s.from + s.frames)!;
  const t = frame / fps;
  const active: string[] = [];
  for (const s of shots) {
    for (const d of s.dialogue ?? []) {
      const a = s.from / fps + d.at;
      if (t >= a && t < a + 1.6) active.push(lines.get(d.line)!.text);
    }
  }
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {!captionsOnly ? (
        <div style={{ position: 'absolute', top: 70, left: 40, fontFamily: DIARY_TYPE.text, fontSize: 28, color: '#fff', background: '#000a', padding: '6px 12px', borderRadius: 6 }}>
          {shot.id} · {shot.renderer} · {t.toFixed(2)}s
        </div>
      ) : null}
      {active.length ? (
        <div style={{ position: 'absolute', bottom: 420, left: 90, right: 90, textAlign: 'center' }}>
          <span style={{ fontFamily: DIARY_TYPE.text, fontWeight: 600, fontSize: 44, lineHeight: 1.35, color: '#fff', background: '#000b', padding: '8px 18px', borderRadius: 10, boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' }}>
            {active[active.length - 1]}
          </span>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

export const PlayerDiaries: React.FC<PlayerDiariesProps> = ({ episode, quality, review, captions }) => {
  useDiaryFonts();
  const frame = useCurrentFrame();
  const ep = EPISODES[episode];
  const { shots } = timeline(ep.edit);
  const lines = new Map(ep.dialogue.lines.map((l) => [l.id, l]));
  const stem = (name: string) => staticFile(`generated/diaries/${episode}/audio/${name}.wav`);
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {shots.map((s) => (
        <Sequence key={s.id} from={s.from} durationInFrames={s.frames} name={s.id}>
          <Shot episode={episode} quality={quality} shot={s} />
        </Sequence>
      ))}
      <Grain frame={frame} />
      {review || captions ? <Review shots={shots} lines={lines} captionsOnly={!review} /> : null}
      {['dialogue', 'sfx', 'ambience', 'music'].map((n) => (
        <Audio key={n} src={stem(n)} />
      ))}
    </AbsoluteFill>
  );
};

export const playerDiariesMetadata = ({ props }: { props: PlayerDiariesProps }) => {
  const ep = EPISODES[props.episode];
  return { durationInFrames: timeline(ep.edit).total, fps: ep.edit.fps, width: 1080, height: 1920 };
};
