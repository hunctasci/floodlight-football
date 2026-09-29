import React from 'react';
import { Composition } from 'remotion';
import { CONTENT, compositionId } from './content';
import { ContentComposition, contentMetadata } from './render/ContentComposition';

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
