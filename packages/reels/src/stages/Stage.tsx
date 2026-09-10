import React from 'react';
import { OfficeSet } from './office/OfficeStage';
import { FootballScene3D } from './football/FootballStage';

export const GenericThreeStage: React.FC<{ frame: number; seed?: number }> = ({ frame }) => (
  <group>
    <mesh position={[0, 0, 0]}>
      <boxGeometry args={[4, 0.2, 4]} />
      <meshStandardMaterial color="#22314d" />
    </mesh>
    <mesh position={[0, 1 + Math.sin(frame * 0.05) * 0.2, 0]}>
      <icosahedronGeometry args={[0.8, 1]} />
      <meshStandardMaterial color="#f8cc54" flatShading />
    </mesh>
  </group>
);

export const GraphicsStage3D: React.FC = () => (
  <group>
    <color attach="background" args={['#0b1526']} />
    <mesh position={[0, 2, -6]}>
      <planeGeometry args={[16, 9]} />
      <meshBasicMaterial color="#101b31" />
    </mesh>
  </group>
);

export const Stage3D: React.FC<{
  stageId: string;
  frame: number;
  fps: number;
  moment?: string;
  home?: string;
  away?: string;
  attackingTeam?: 'home' | 'away';
  shotStartFrame?: number;
  durationInFrames?: number;
}> = ({ stageId, frame, fps, moment, home = 'TR', away = 'GR', attackingTeam, shotStartFrame = 0, durationInFrames = 60 }) => {
  if (stageId === 'office') return <OfficeSet />;
  if (stageId === 'stadium') {
    return (
      <FootballScene3D
        frame={frame}
        fps={fps}
        moment={moment ?? 'attack-goal'}
        home={home}
        away={away}
        attackingTeam={attackingTeam}
        shotStartFrame={shotStartFrame}
        durationInFrames={durationInFrames}
      />
    );
  }
  if (stageId === 'graphics') return <GraphicsStage3D />;
  return <GenericThreeStage frame={frame} />;
};
