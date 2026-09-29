import React from 'react';
import { useVideoConfig } from 'remotion';
import { ReelComposition } from './ReelComposition';
import { compileHncHero } from '../reel/compile';

/**
 * HNC League hero trailer. Compiled at the composition's own fps (60).
 * `sfx` is the procedural SFX stem the render script synthesizes first
 * (absent in Studio unless generated — crowd audio still plays).
 */
export const HncHeroReel: React.FC<{ home?: string; away?: string; seed?: number; sfx?: string }> = ({ home = 'TR', away = 'GR', seed = 42, sfx }) => {
  const { fps } = useVideoConfig();
  const spec = React.useMemo(
    () => compileHncHero({ template: 'hnc-hero', home, away, seed, fps: fps as 30 | 60 }),
    [home, away, seed, fps],
  );
  return <ReelComposition spec={spec} sfx={sfx} />;
};
