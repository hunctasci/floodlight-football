import React from 'react';
import { ReelComposition } from './ReelComposition';
import { compileCountryRivalry } from '../reel/compile';

export const CountryRivalry: React.FC<{
  home?: string;
  away?: string;
  seed?: number;
  footballMoment?: string;
  headline?: string;
  cta?: string;
}> = ({ home = 'TR', away = 'GR', seed = 42, footballMoment = 'attack-goal', headline, cta }) => {
  const spec = React.useMemo(
    () =>
      compileCountryRivalry({
        template: 'country-rivalry',
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
