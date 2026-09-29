import React from 'react';
import { ThreeCanvas } from '@remotion/three';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { applyHncBodyPose, applyHncWardrobe, createHncPlayerVisual, disposeHncPlayerVisual, neutralHncBodyPose } from '@floodlight/hnc-visuals';
import { countryColors } from '../cast/countries';
import { getLook } from '../cast/looks';
import type { CastMember } from '../engine/timeline/types';

/**
 * A head-and-shoulders portrait of a cast member (chat avatars, lower
 * thirds): the canonical HNC character in their look, rendered in a tiny
 * canvas, so avatars ARE the characters.
 */
const Bust: React.FC<{ member: CastMember; look: string; t: number }> = ({ member, look, t }) => {
  const kit = countryColors(member.country);
  const l = getLook(look);
  const visual = React.useMemo(() => createHncPlayerVisual({ id: member.number, number: member.number, primary: kit.primary, secondary: kit.secondary, keeper: !!l.keeper }), [member.number, kit.primary, kit.secondary, l.keeper]);
  React.useEffect(() => () => disposeHncPlayerVisual(visual), [visual]);
  React.useMemo(() => applyHncWardrobe(visual, l.wardrobe, { primary: kit.primary, secondary: kit.secondary, accent: member.accent }), [visual, l.wardrobe, kit.primary, kit.secondary, member.accent]);
  applyHncBodyPose(visual, { ...neutralHncBodyPose(), headYaw: 0.28 + Math.sin(t * 1.3) * 0.05, headPitch: -0.04, y: Math.sin(t * 2.2) * 0.01 });
  return <primitive object={visual.root} />;
};

export const HncPortrait: React.FC<{ member: CastMember; look: string; size: number; background: string; t: number }> = ({ member, look, size, background, t }) => (
  <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', background, flexShrink: 0 }}>
    <ThreeCanvas width={size} height={size} dpr={1} gl={{ antialias: true, alpha: true, outputColorSpace: THREE.SRGBColorSpace, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.12 }} camera={{ fov: 26, near: 0.1, far: 20, position: [0.42, 1.62, 1.75] }}>
      <hemisphereLight args={['#fff8ee', '#5a5a66', 2.2]} />
      <directionalLight position={[2, 3, 4]} intensity={1.8} />
      <PortraitCamera />
      <Bust member={member} look={look} t={t} />
    </ThreeCanvas>
  </div>
);

/** Aim the portrait lens at the face (head centre 1.7, shoulders in frame). */
const PortraitCamera: React.FC = () => {
  const camera = useThree((s) => s.camera);
  React.useMemo(() => camera.lookAt(0, 1.52, 0), [camera]);
  return null;
};
