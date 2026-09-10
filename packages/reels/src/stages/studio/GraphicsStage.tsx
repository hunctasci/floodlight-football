import React from 'react';

export const StudioBackdrop: React.FC = () => (
  <group>
    <color attach="background" args={['#0b1526']} />
    <mesh position={[0, 1.5, -4]}>
      <planeGeometry args={[12, 7]} />
      <meshStandardMaterial color="#16233d" roughness={1} />
    </mesh>
    <mesh position={[0, 1.5, -3.9]}>
      <planeGeometry args={[8, 1.2]} />
      <meshBasicMaterial color="#f8cc54" />
    </mesh>
  </group>
);
