import React from 'react';
import * as THREE from 'three';
import {
  applyHncBodyPose,
  applyHncWardrobe,
  createHncPlayerVisual,
  disposeHncPlayerVisual,
  setHncHeldProp,
  type HncHeldProp,
} from '@floodlight/hnc-visuals';
import { actorState } from '../cast/state';
import { getLook } from '../cast/looks';
import { countryColors } from '../cast/countries';
import type { ActorTrack, CastMember, Shot } from '../engine/timeline/types';
import type { Vec3 } from '../worlds/types';
import { isValidCountryCode } from '../cast/countries';
import { paintFlag } from './screens';

/** ID badge printed with the wearer's national flag (office country clue). */
function flagBadge(country: string): THREE.CanvasTexture | undefined {
  if (!isValidCountryCode(country) || typeof document === 'undefined') return undefined;
  const c = document.createElement('canvas');
  c.width = 132;
  c.height = 84;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#f3ede0';
  ctx.fillRect(0, 0, 132, 84);
  ctx.save();
  ctx.beginPath();
  ctx.rect(6, 6, 120, 72);
  ctx.clip();
  paintFlag(ctx, 132, 84, country);
  ctx.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Thin adapter: the canonical HNC character (hnc-visuals) in the cast
 * member's look, posed from cast/state.ts. Identity (skin = number % 4, back
 * number, kit colours) comes from the cast member, so the same person reads
 * the same in every world. No geometry is authored here.
 */
export const CastActor: React.FC<{
  shot: Shot;
  track: ActorTrack;
  member: CastMember;
  frame: number;
  fps: number;
  target: (id: string) => Vec3 | undefined;
  shadowColor?: string;
  /** Render in another look this frame (world effects: a flicker reveals the kit). */
  lookOverride?: string;
}> = ({ shot, track, member, frame, fps, target, shadowColor, lookOverride }) => {
  const look = getLook(lookOverride ?? track.look);
  const badge = React.useMemo(() => flagBadge(member.country), [member.country]);
  React.useEffect(() => () => badge?.dispose(), [badge]);
  const kit = countryColors(member.country);
  const visual = React.useMemo(
    () => createHncPlayerVisual({ id: member.number, number: member.number, primary: kit.primary, secondary: kit.secondary, keeper: !!look.keeper }),
    // Identity only; wardrobe + pose are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [member.number, member.country, look.keeper],
  );
  React.useEffect(() => () => disposeHncPlayerVisual(visual), [visual]);
  React.useMemo(() => {
    applyHncWardrobe(visual, look.wardrobe, { primary: kit.primary, secondary: kit.secondary, accent: member.accent, badgeMap: badge });
  }, [visual, look.wardrobe, kit.primary, kit.secondary, member.accent, badge]);
  React.useMemo(() => {
    setHncHeldProp(visual, (track.hold as HncHeldProp | undefined) ?? null, kit.primary);
  }, [visual, track.hold, kit.primary]);
  React.useMemo(() => {
    if (shadowColor) (visual.shadow.material as THREE.MeshBasicMaterial).color.set(shadowColor);
  }, [visual, shadowColor]);

  const st = actorState(shot, track, frame, fps, target);
  applyHncBodyPose(visual, st.pose);
  visual.shadow.position.set(st.pos.x, 0.012, st.pos.z);
  return (
    <>
      <group position={[st.pos.x, 0, st.pos.z]} rotation={[0, st.facing, 0]}>
        <primitive object={visual.root} />
      </group>
      <primitive object={visual.shadow} />
    </>
  );
};
