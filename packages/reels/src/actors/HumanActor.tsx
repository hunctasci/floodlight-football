import React from 'react';
import {
  applyHncProceduralPose,
  applyHncWardrobe,
  createHncPlayerVisual,
  disposeHncPlayerVisual,
  type HncWardrobeId,
} from '@floodlight/hnc-visuals';
import { sampleAnimation } from '../animation/sample-animation';
import { countryColors } from '../football/data/countries';

export interface HumanActorPose {
  bob: number;
  lean: number;
  armLift: number;
  headYaw: number;
}

/**
 * HNC office character: the SAME canonical HNC body/head/face/proportion
 * language as the footballer, with wardrobe/material variants (shirt, tie,
 * trousers, jacket, badge). No realistic/Mixamo humans — the comedy comes
 * from the same character changing context/wardrobe.
 *
 * Thin R3F adapter: canonical geometry lives in @floodlight/hnc-visuals,
 * mounted via <primitive /> with useMemo lifecycle + disposal.
 */
export const HumanActor: React.FC<{
  frame: number;
  fps: number;
  animation?: string;
  primary?: string;
  skin?: string;
  female?: boolean;
  wardrobe?: HncWardrobeId | string;
  playerId?: number;
}> = ({ frame, fps, animation = 'idle', primary = '#2b4a6f', skin, female = false, wardrobe = 'office-worker', playerId = 0 }) => {
  void primary;
  void skin;
  void female;
  const visual = React.useMemo(
    () =>
      createHncPlayerVisual({
        id: playerId,
        number: 10,
        primary: '#e8e4da',
        secondary: '#23283b',
        keeper: false,
      }),
    // Identity only; wardrobe + pose applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  React.useMemo(() => {
    const w = (wardrobe as HncWardrobeId) ?? 'office-worker';
    try {
      applyHncWardrobe(visual, w);
    } catch {
      applyHncWardrobe(visual, 'office-worker');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visual, wardrobe]);

  React.useEffect(() => () => disposeHncPlayerVisual(visual), [visual]);

  const sampled = sampleAnimation(animation, frame, fps, 0);
  React.useMemo(() => {
    applyHncProceduralPose(visual, animation, sampled.localTime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visual, sampled.localTime, animation]);

  return (
    <group>
      <primitive object={visual.root} />
      <primitive object={visual.shadow} />
    </group>
  );
};

function wardrobeForCountry(country: string | undefined, variant: string | undefined): HncWardrobeId {
  if (variant === 'manager' || variant === 'boss') return 'manager';
  if (variant === 'formal') return 'office-worker-formal';
  if (variant === 'casual') return 'office-worker-casual';
  void country;
  return 'office-worker';
}

export const CountryWorker: React.FC<{
  frame: number;
  fps: number;
  animation?: string;
  country?: string;
  variant?: string;
}> = ({ frame, fps, animation, country, variant }) => {
  const c = country ? countryColors(country) : { primary: '#2b4a6f', secondary: '#fff' };
  void c;
  // Skin palette derives from a stable per-country index so the same HNC
  // character reads consistently across office → football transformation.
  const playerId = country ? [...country].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 4 : 0;
  return (
    <HumanActor
      frame={frame}
      fps={fps}
      animation={animation}
      wardrobe={wardrobeForCountry(country, variant)}
      playerId={playerId}
    />
  );
};

// Re-export for tests: office workers belong to the HNC character universe.
export const HNC_OFFICE_WARDROBES: HncWardrobeId[] = [
  'office-worker',
  'office-worker-formal',
  'office-worker-casual',
  'manager',
  'footballer',
  'goalkeeper',
];

export function isHncWardrobeId(v: string): v is HncWardrobeId {
  return (HNC_OFFICE_WARDROBES as string[]).includes(v);
}
