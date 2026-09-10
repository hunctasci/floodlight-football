import React from 'react';

export const GenericStage: React.FC = () => (
  <group>
    <color attach="background" args={['#101b31']} />
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[20, 20]} />
      <meshStandardMaterial color="#1c2c4a" />
    </mesh>
  </group>
);
