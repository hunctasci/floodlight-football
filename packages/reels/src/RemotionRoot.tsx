import React from 'react';
import { Composition } from 'remotion';
import { CONTENT, compositionId } from './content';
import { ContentComposition, contentMetadata } from './render/ContentComposition';
import { PosterType } from './posters/PosterType';
import type { PosterDef } from './posters/types';
import { PlayerDiaries, playerDiariesMetadata, type PlayerDiariesProps } from './diaries/PlayerDiaries';
import { DiariesMumLinksUI, DiariesPhoneUI } from './diaries/PhoneUI';
import { TVScoreboard, type TVScore } from './diaries/Memory';

/**
 * One composition per registered piece (Studio browsing) plus `Content`,
 * which renders any spec passed as props. Duration / fps / size come from
 * the compiled timeline (calculateMetadata), so props pick the format.
 */
export const RemotionRoot: React.FC = () => (
  <>
    {Object.values(CONTENT).map((spec) => (
      <Composition
        key={spec.id}
        id={compositionId(spec.id)}
        component={ContentComposition}
        defaultProps={{ spec, format: spec.formats?.[0] ?? 'reel' }}
        calculateMetadata={contentMetadata}
        durationInFrames={1}
        fps={spec.fps ?? 30}
        width={1080}
        height={1920}
      />
    ))}
    <Composition
      id="PosterType"
      component={PosterType}
      defaultProps={{ poster: { id: 'empty', plates: [], blocks: [], alt: '' } as PosterDef }}
      calculateMetadata={({ props }: { props: { poster: PosterDef } }) => ({ width: props.poster.width ?? 1080, height: props.poster.height ?? 1350 })}
      durationInFrames={1}
      fps={30}
      width={1080}
      height={1350}
    />
    <Composition
      id="PlayerDiaries"
      component={PlayerDiaries}
      defaultProps={{ episode: 'ep01', quality: 'animatic', review: true } as PlayerDiariesProps}
      calculateMetadata={playerDiariesMetadata}
      durationInFrames={1}
      fps={60}
      width={1080}
      height={1920}
    />
    <Composition id="DiariesPhoneUI" component={DiariesPhoneUI} durationInFrames={1} fps={60} width={1080} height={2340} />
    <Composition id="DiariesMumLinksUI" component={DiariesMumLinksUI} durationInFrames={1} fps={60} width={1080} height={2340} />
    {/* 4:3 TV picture for the living-room sets (rivals episode) */}
    <Composition
      id="DiariesTVUI"
      component={TVScoreboard as React.FC<{ score: TVScore }>}
      defaultProps={{ score: { home: 'Belgium', away: 'Türkiye', hs: 0, as: 2, clock: "88'", line: 'Brussels · 19.06.2000' } as TVScore }}
      durationInFrames={1}
      fps={60}
      width={1440}
      height={1080}
    />
    <Composition
      id="Content"
      component={ContentComposition}
      defaultProps={{ spec: Object.values(CONTENT)[0], format: 'reel' }}
      calculateMetadata={contentMetadata}
      durationInFrames={1}
      fps={30}
      width={1080}
      height={1920}
    />
  </>
);
