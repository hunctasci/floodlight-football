import React from 'react';
import { ReelComposition } from './ReelComposition';
import { compileOfficeRivalry } from '../reel/compile';

export const OfficeRivalry: React.FC<{
  home?: string;
  away?: string;
  seed?: number;
  footballMoment?: string;
  headline?: string;
  cta?: string;
}> = ({ home = 'TR', away = 'GR', seed = 42, footballMoment = 'crossbar-chaos', headline, cta }) => {
  const spec = React.useMemo(
    () =>
      compileOfficeRivalry({
        template: 'office-rivalry',
        home,
        away,
        seed,
        fps: 30,
        footballMoment,
        headline,
        cta,
      }),
    [home, away, seed, footballMoment, headline, cta],
  );
  return <ReelComposition spec={spec} />;
};
