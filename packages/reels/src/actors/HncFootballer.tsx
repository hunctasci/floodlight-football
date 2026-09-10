import React from 'react';
import { countryColors } from '../football/data/countries';
import { proceduralPose, sampleAnimation } from '../animation/sample-animation';

/**
 * Procedural HNC footballer: chunky low-poly avatar in canonical country kits.
 * Preserves HNC identity (kit colours, trim stripe, number) without coupling
 * the Reel Factory to the live game renderer.
 */
export const HncFootballer: React.FC<{
  frame: number;
  fps: number;
  country: string;
  number?: number;
  keeper?: boolean;
  animation?: string;
  celebrate?: boolean;
}> = ({ frame, fps, country, number = 9, keeper = false, animation = 'idle', celebrate = false }) => {
  const kit = countryColors(country);
  const shirt = keeper ? '#6b64d9' : kit.primary;
  const trim = kit.secondary;
  const sampled = sampleAnimation(celebrate ? 'goal-celebration' : animation, frame, fps, 0);
  const pose = proceduralPose(celebrate ? 'goal-celebration' : animation, sampled.localTime);
  const runSwing = animation === 'run' || animation === 'dribble' ? Math.sin(sampled.localTime * 10) * 0.6 : 0;
  return (
    <group position={[0, pose.bob + (celebrate ? Math.abs(Math.sin(sampled.localTime * 7)) * 0.3 : 0), 0]} rotation={[-pose.lean, 0, 0]}>
      <mesh position={[-0.16, 0.38, 0]} rotation={[runSwing, 0, 0]}>
        <cylinderGeometry args={[0.11, 0.12, 0.7, 5]} />
        <meshStandardMaterial color={trim} roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0.16, 0.38, 0]} rotation={[-runSwing, 0, 0]}>
        <cylinderGeometry args={[0.11, 0.12, 0.7, 5]} />
        <meshStandardMaterial color={trim} roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0, 1.02, 0]}>
        <cylinderGeometry args={[0.36, 0.44, 0.85, 6]} />
        <meshStandardMaterial color={shirt} roughness={0.85} flatShading />
      </mesh>
      <mesh position={[0, 1.26, 0]}>
        <cylinderGeometry args={[0.4, 0.43, 0.18, 6]} />
        <meshStandardMaterial color={trim} roughness={0.9} flatShading />
      </mesh>
      <mesh position={[-0.46, 1.08, 0]} rotation={[-pose.armLift - runSwing * 0.5, 0, celebrate ? 1.4 : 0.15]}>
        <cylinderGeometry args={[0.1, 0.11, 0.64, 5]} />
        <meshStandardMaterial color={shirt} roughness={0.85} flatShading />
      </mesh>
      <mesh position={[0.46, 1.08, 0]} rotation={[-pose.armLift + runSwing * 0.5, 0, celebrate ? -1.4 : -0.15]}>
        <cylinderGeometry args={[0.1, 0.11, 0.64, 5]} />
        <meshStandardMaterial color={shirt} roughness={0.85} flatShading />
      </mesh>
      <mesh position={[0, 1.7, 0]}>
        <icosahedronGeometry args={[0.3, 1]} />
        <meshStandardMaterial color="#e8b08a" roughness={1} flatShading />
      </mesh>
      <mesh position={[0, 1.05, -0.42]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[0.4, 0.4]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
      </mesh>
    </group>
  );
};
