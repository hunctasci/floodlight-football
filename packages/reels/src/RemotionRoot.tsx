import React from 'react';
import { Composition } from 'remotion';
import { ReelComposition } from './compositions/ReelComposition';
import { OfficeRivalry } from './compositions/OfficeRivalry';
import { CountryRivalry } from './compositions/CountryRivalry';
import { compileCountryRivalry, compileOfficeRivalry } from './reel/compile';

const officeSpec = compileOfficeRivalry({
  template: 'office-rivalry',
  home: 'TR',
  away: 'GR',
  seed: 42,
  fps: 30,
  footballMoment: 'crossbar-chaos',
});

const countrySpec = compileCountryRivalry({
  template: 'country-rivalry',
  home: 'TR',
  away: 'GR',
  seed: 42,
  fps: 30,
  footballMoment: 'attack-goal',
});

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="OfficeRivalry"
      component={OfficeRivalry}
      durationInFrames={Math.round(16 * 30)}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{ home: 'TR', away: 'GR', seed: 42, footballMoment: 'crossbar-chaos' }}
    />
    <Composition
      id="CountryRivalry"
      component={CountryRivalry}
      durationInFrames={Math.round(15.5 * 30)}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{ home: 'TR', away: 'GR', seed: 42, footballMoment: 'attack-goal' }}
    />
    <Composition
      id="Reel"
      component={ReelComposition}
      durationInFrames={Math.round(officeSpec.durationInSeconds * officeSpec.fps)}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{ spec: officeSpec }}
    />
    <Composition
      id="CountryReel"
      component={ReelComposition}
      durationInFrames={Math.round(countrySpec.durationInSeconds * countrySpec.fps)}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{ spec: countrySpec }}
    />
  </>
);
