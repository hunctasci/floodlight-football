import React from 'react';

/**
 * Procedural office: desks, chairs, monitors, mugs, lighting.
 * Exposes semantic anchors (desk-left, desk-right, ...); stories never
 * position actors by hand. Swappable for `office-modern-01` GLB later.
 */
export const OfficeSet: React.FC = () => (
  <group>
    {/* floor + walls */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[14, 12]} />
      <meshStandardMaterial color="#b9c2cc" roughness={1} />
    </mesh>
    <mesh position={[0, 2.2, -4.4]}>
      <planeGeometry args={[14, 4.4]} />
      <meshStandardMaterial color="#e8e4da" roughness={1} />
    </mesh>
    <mesh position={[0, 3.4, -4.38]}>
      <planeGeometry args={[6, 1.6]} />
      <meshStandardMaterial color="#9fc4dd" roughness={0.4} />
    </mesh>
    {/* desks */}
    {[-2.0, 2.0].map((x) => (
      <group key={x} position={[x, 0, 0]}>
        <mesh position={[0, 0.72, 0]}>
          <boxGeometry args={[2.2, 0.08, 1.1]} />
          <meshStandardMaterial color="#8a6a45" roughness={0.8} />
        </mesh>
        {[-0.95, 0.95].map((lx) => (
          <mesh key={lx} position={[lx, 0.36, 0]}>
            <boxGeometry args={[0.08, 0.72, 1.0]} />
            <meshStandardMaterial color="#5c5c66" roughness={0.8} />
          </mesh>
        ))}
        {/* monitor */}
        <mesh position={[0, 1.15, -0.3]}>
          <boxGeometry args={[0.9, 0.55, 0.06]} />
          <meshStandardMaterial color="#1c2333" roughness={0.5} />
        </mesh>
        <mesh position={[0, 1.15, -0.26]}>
          <planeGeometry args={[0.8, 0.45]} />
          <meshBasicMaterial color={x < 0 ? '#e30a17' : '#0d5eaf'} />
        </mesh>
        <mesh position={[0, 0.85, -0.3]}>
          <cylinderGeometry args={[0.05, 0.16, 0.25, 8]} />
          <meshStandardMaterial color="#333" />
        </mesh>
        {/* laptop */}
        <mesh position={[0.55, 0.79, 0.25]} rotation={[-0.2, 0.3, 0]}>
          <boxGeometry args={[0.42, 0.28, 0.03]} />
          <meshStandardMaterial color="#2a3140" />
        </mesh>
        {/* mug */}
        <mesh position={[-0.6, 0.84, 0.2]}>
          <cylinderGeometry args={[0.06, 0.05, 0.14, 10]} />
          <meshStandardMaterial color={x < 0 ? '#e30a17' : '#ffffff'} />
        </mesh>
        {/* chair */}
        <group position={[0, 0, 0.95]}>
          <mesh position={[0, 0.45, 0]}>
            <boxGeometry args={[0.55, 0.08, 0.55]} />
            <meshStandardMaterial color="#2c3547" />
          </mesh>
          <mesh position={[0, 0.85, -0.26]}>
            <boxGeometry args={[0.55, 0.7, 0.08]} />
            <meshStandardMaterial color="#2c3547" />
          </mesh>
          <mesh position={[0, 0.22, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.45, 8]} />
            <meshStandardMaterial color="#555" />
          </mesh>
        </group>
      </group>
    ))}
    {/* coffee machine corner */}
    <group position={[4.2, 0, -2.0]}>
      <mesh position={[0, 0.7, 0]}>
        <boxGeometry args={[0.9, 1.4, 0.7]} />
        <meshStandardMaterial color="#39424f" roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.1, 0.36]}>
        <planeGeometry args={[0.5, 0.3]} />
        <meshBasicMaterial color="#7fd4ff" />
      </mesh>
    </group>
    {/* meeting table (tucked to the side so the two-shot stays readable) */}
    <group position={[-4.1, 0, 2.4]} rotation={[0, 0.5, 0]}>
      <mesh position={[0, 0.7, 0]}>
        <boxGeometry args={[2.2, 0.08, 1.1]} />
        <meshStandardMaterial color="#a8895c" />
      </mesh>
    </group>
    {/* ceiling lights */}
    {[[-2, 3.4, 0], [2, 3.4, 0]].map(([x, y, z], i) => (
      <mesh key={i} position={[x, y, z]}>
        <boxGeometry args={[1.6, 0.08, 0.6]} />
        <meshBasicMaterial color="#fffbe8" />
      </mesh>
    ))}
  </group>
);
