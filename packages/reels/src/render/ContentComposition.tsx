import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, type CalculateMetadataFunction } from 'remotion';
import { AudioTrack } from '../audio/AudioTrack';
import { compileContent } from '../engine/director/compile';
import type { FormatId } from '../engine/formats';
import type { ContentSpec } from '../engine/spec/types';
import { LayoutProvider } from './layout';
import { Overlay } from './Overlays';
import { ShotLayer } from './ShotLayer';
import { TransitionOverlay } from './Transitions';

export interface ContentProps extends Record<string, unknown> {
  spec: ContentSpec;
  format?: FormatId;
  /** Pre-rendered synth stem (public-relative), see scripts/render.ts. */
  sfx?: string;
}

/** Duration / fps / size come from the compiled timeline. */
export const contentMetadata: CalculateMetadataFunction<ContentProps> = ({ props }) => {
  const tl = compileContent(props.spec, { format: props.format });
  return { durationInFrames: tl.totalFrames, fps: tl.fps, width: tl.width, height: tl.height };
};

/**
 * Any ContentSpec, any format: ContentSpec → Timeline → one Sequence per
 * shot (extended through overlapping transitions), global overlays,
 * transition overlays, audio. Everything derives from the absolute frame.
 */
export const ContentComposition: React.FC<ContentProps> = ({ spec, format, sfx }) => {
  const tl = React.useMemo(() => compileContent(spec, { format }), [spec, format]);
  const frame = useCurrentFrame();
  const bound = React.useMemo(() => {
    const m = new Map<string, typeof tl.overlays>();
    for (const o of tl.overlays) if (o.shot) m.set(o.shot, [...(m.get(o.shot) ?? []), o]);
    return m;
  }, [tl]);
  const global = tl.overlays.filter((o) => !o.shot);
  return (
    <LayoutProvider format={tl.format}>
      <AbsoluteFill style={{ backgroundColor: '#0b1526' }}>
        {tl.shots.map((shot, i) => {
          const from = shot.enter?.overlap ? Math.min(shot.start, shot.enter.start) : shot.start;
          const to = shot.exit?.overlap ? Math.max(shot.start + shot.duration, shot.exit.end) : shot.start + shot.duration;
          return (
            <Sequence key={shot.id} from={from} durationInFrames={to - from} name={shot.id}>
              <ShotLayer tl={tl} shot={shot} prev={tl.shots[i - 1]} frame={frame} overlays={bound.get(shot.id) ?? []} />
            </Sequence>
          );
        })}
        {global.map((ev) => (
          <Overlay key={ev.id} ev={ev} tl={tl} frame={frame} />
        ))}
        {tl.shots.map((shot, i) =>
          shot.enter && i > 0 ? <TransitionOverlay key={`t-${shot.id}`} tl={tl} ev={shot.enter} out={tl.shots[i - 1]} into={shot} frame={frame} /> : null,
        )}
        <AudioTrack tl={tl} sfx={sfx} />
      </AbsoluteFill>
    </LayoutProvider>
  );
};
