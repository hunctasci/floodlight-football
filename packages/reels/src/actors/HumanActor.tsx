import React from 'react';
import { proceduralPose, sampleAnimation } from '../animation/sample-animation';
import { countryColors } from '../football/data/countries';

export interface HumanActorPose {
  bob: number;
  lean: number;
  armLift: number;
  headYaw: number;
}

/**
 * Procedural low-poly office human. Deterministic pose from absolute frame;
 * GLB characters will replace this mesh without changing story code.
 */
export const HumanActor: React.FC<{
  frame: number;
  fps: number;
  animation?: string;
  primary?: string;
  skin?: string;
  female?: boolean;
}> = ({ frame, fps, animation = 'idle', primary = '#2b4a6f', skin = '#e8b08a', female = false }) => {
  const sampled = sampleAnimation(animation, frame, fps, 0);
  const pose = proceduralPose(animation, sampled.localTime);
  const armSpread = animation === 'celebrate' || animation === 'goal-celebration' ? 0.9 : 0.12;
  return (
    <group position={[0, pose.bob, 0]} rotation={[pose.lean, 0, 0]}>
      {/* legs */}
      <mesh position={[-0.14, 0.42, 0]}>
        <cylinderGeometry args={[0.09, 0.11, 0.84, 6]} />
        <meshStandardMaterial color="#23283b" roughness={0.9} />
      </mesh>
      <mesh position={[0.14, 0.42, 0]}>
        <cylinderGeometry args={[0.09, 0.11, 0.84, 6]} />
        <meshStandardMaterial color="#23283b" roughness={0.9} />
      </mesh>
      {/* torso */}
      <mesh position={[0, 1.05, 0]}>
        <cylinderGeometry args={[0.3, 0.36, 0.75, 8]} />
        <meshStandardMaterial color={primary} roughness={0.85} />
      </mesh>
      {/* arms */}
      <mesh position={[-0.4, 1.1, 0]} rotation={[ -pose.armLift, 0, armSpread]}>
        <cylinderGeometry args={[0.08, 0.09, 0.62, 6]} />
        <meshStandardMaterial color={primary} roughness={0.85} />
      </mesh>
      <mesh position={[0.4, 1.1, 0]} rotation={[-pose.armLift, 0, -armSpread]}>
        <cylinderGeometry args={[0.08, 0.09, 0.62, 6]} />
        <meshStandardMaterial color={primary} roughness={0.85} />
      </mesh>
      {/* head */}
      <group position={[0, 1.68, 0]} rotation={[0, pose.headYaw, 0]}>
        <mesh>
          <icosahedronGeometry args={[0.26, 1]} />
          <meshStandardMaterial color={skin} roughness={1} flatShading />
        </mesh>
        <mesh position={[0, 0.12, -0.05]}>
          <sphereGeometry args={[0.265, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.45]} />
          <meshStandardMaterial color={female ? '#5a3418' : '#28283b'} roughness={1} />
        </mesh>
      </group>
      {/* country badge */}
      <mesh position={[0, 1.18, 0.3]}>
        <planeGeometry args={[0.22, 0.14]} />
        <meshBasicMaterial color={primary} />
      </mesh>
    </group>
  );
};

export const CountryWorker: React.FC<{ frame: number; fps: number; animation?: string; country?: string; variant?: string }> = ({
  frame,
  fps,
  animation,
  country,
  variant,
}) => {
  const c = country ? countryColors(country) : { primary: '#2b4a6f', secondary: '#fff' };
  const female = (variant ?? '').includes('female') || country === undefined ? false : variant === 'female';
  const skin = country === 'NG' || country === 'GH' ? '#7a4a2e' : '#e8b08a';
  return <HumanActor frame={frame} fps={fps} animation={animation} primary={c.primary} skin={skin} female={female} />;
};
