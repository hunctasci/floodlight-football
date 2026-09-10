import React from 'react';
import * as THREE from 'three';
import { countryColors } from '../football/data/countries';
import {
  applyHncProceduralPose,
  createHncPlayerVisual,
  disposeHncPlayerVisual,
} from '@floodlight/hnc-visuals';
import { sampleAnimation } from '../animation/sample-animation';

/**
 * Thin R3F adapter around the canonical HNC player visual.
 *
 * The geometry/materials live in @floodlight/hnc-visuals (extracted verbatim
 * from the game). This component only: creates the visual with useMemo,
 * applies the deterministic reel pose each frame, mounts via <primitive />,
 * and disposes on unmount. It MUST NOT contain cylinder/head/limb/shorts/
 * hair/eye/boot JSX — any such duplication is a parity bug.
 */
export const HncFootballer: React.FC<{
  frame: number;
  fps: number;
  country: string;
  number?: number;
  keeper?: boolean;
  animation?: string;
  celebrate?: boolean;
  playerId?: number;
}> = ({ frame, fps, country, number = 9, keeper = false, animation = 'idle', celebrate = false, playerId = 0 }) => {
  const kit = countryColors(country);
  const visual = React.useMemo(
    () =>
      createHncPlayerVisual({
        id: playerId !== 0 ? playerId : number,
        number,
        primary: kit.primary,
        secondary: kit.secondary,
        keeper,
      }),
    // Kit colours + identity only; pose is applied imperatively below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [country, number, keeper],
  );

  // Re-kit if the country prop changes without remount (cheap, no rebuild).
  React.useMemo(() => {
    const shirt = keeper ? '#6b64d9' : kit.primary;
    for (const m of visual.kitParts)
      (m.material as THREE.MeshStandardMaterial).color.set(shirt);
    for (const m of visual.trimParts)
      (m.material as THREE.MeshStandardMaterial).color.set(kit.secondary);
  }, [visual, kit.primary, kit.secondary, keeper]);

  React.useEffect(() => () => disposeHncPlayerVisual(visual), [visual]);

  const sampled = sampleAnimation(celebrate ? 'goal-celebration' : animation, frame, fps, 0);
  // Imperative pose: same canonical channels as the game, driven by absolute
  // Remotion frame (no accumulated state). useMemo runs during render, which
  // is where Remotion evaluates frames (no useFrame loop in stills).
  React.useMemo(() => {
    applyHncProceduralPose(visual, celebrate ? 'goal-celebration' : animation, sampled.localTime);
    if (celebrate) {
      visual.root.position.y += Math.abs(Math.sin(sampled.localTime * 7)) * 0.3;
      visual.armL.rotation.z = 1.4;
      visual.armR.rotation.z = -1.4;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visual, sampled.localTime, animation, celebrate]);

  return (
    <group>
      <primitive object={visual.root} />
      <primitive object={visual.shadow} />
    </group>
  );
};
