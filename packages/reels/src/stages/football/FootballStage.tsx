import React from 'react';
import { HncFootballer } from '../../actors/HncFootballer';
import { sampleFootballMoment } from '../../football/adapter/choreography';
import { countryColors } from '../../football/data/countries';

/**
 * Procedural HNC stadium: pitch, goals, terraces, instanced crowd, floodlights.
 * Preserves HNC identity (kit colours, ad boards, banners) without importing
 * the live game renderer.
 */
export const FootballScene3D: React.FC<{
  frame: number;
  fps: number;
  moment: string;
  home: string;
  away: string;
  attackingTeam?: 'home' | 'away';
  shotStartFrame: number;
  durationInFrames: number;
}> = ({ frame, fps, moment, home, away, attackingTeam = 'home', shotStartFrame, durationInFrames }) => {
  const localFrame = frame - shotStartFrame;
  const time = Math.min(durationInFrames / fps, Math.max(0, localFrame / fps));
  const duration = durationInFrames / fps;
  const choreo = sampleFootballMoment(moment, time, duration, attackingTeam === 'home');
  const hColors = countryColors(home);
  const aColors = countryColors(away);

  return (
    <group>
      {/* sky */}
      <color attach="background" args={['#7fb6e0']} />
      {/* pitch */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[94, 60]} />
        <meshStandardMaterial color="#35a047" roughness={1} />
      </mesh>
      {[-40, -24, -8, 8, 24, 40].map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.006, 0]}>
          <planeGeometry args={[8, 58]} />
          <meshBasicMaterial color="#2c8340" transparent opacity={0.5} />
        </mesh>
      ))}
      {/* lines */}
      <mesh position={[0, 0.026, -29]}>
        <boxGeometry args={[92, 0.025, 0.16]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0, 0.026, 29]}>
        <boxGeometry args={[92, 0.025, 0.16]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      {/* goals */}
      {[-46, 46].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          {[-4.4, 4.4].map((z) => (
            <mesh key={z} position={[0, 1.4, z]}>
              <cylinderGeometry args={[0.12, 0.12, 2.8, 8]} />
              <meshStandardMaterial color="#fffef4" roughness={0.4} />
            </mesh>
          ))}
          <mesh position={[0, 2.8, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.12, 0.12, 9.0, 8]} />
            <meshStandardMaterial color="#fffef4" roughness={0.4} />
          </mesh>
        </group>
      ))}
      {/* far stand terrace + crowd */}
      <mesh position={[0, 0.55, -31.3]}>
        <boxGeometry args={[104, 1.1, 0.6]} />
        <meshStandardMaterial color="#2c4d63" roughness={1} flatShading />
      </mesh>
      {Array.from({ length: 8 }).map((_, r) => (
        <mesh key={r} position={[0, 1.3 + r * 0.55 - 0.2, -32.0 - r * 1.1]}>
          <boxGeometry args={[104, 0.4, 1.3]} />
          <meshStandardMaterial color={r % 2 ? '#3d647e' : '#2c4d63'} roughness={1} flatShading />
        </mesh>
      ))}
      {/* team section banners */}
      <mesh position={[-26, 1.32, -31.0]}>
        <planeGeometry args={[52, 0.36]} />
        <meshBasicMaterial color={hColors.primary} />
      </mesh>
      <mesh position={[26, 1.32, -31.0]}>
        <planeGeometry args={[52, 0.36]} />
        <meshBasicMaterial color={aColors.primary} />
      </mesh>
      {/* crowd mosaic: deterministic wave from absolute frame */}
      {Array.from({ length: 120 }).map((_, i) => {
        const x = -48 + (i % 40) * 2.45;
        const r = Math.floor(i / 40) % 8;
        const wave = Math.sin(frame * 0.12 + i * 0.7) * 0.12 * choreo.crowdIntensity;
        const home2 = x < 0;
        return (
          <mesh key={i} position={[x, 1.66 + r * 0.55 + Math.max(0, wave), -31.9 - r * 1.1]}>
            <boxGeometry args={[1.05, 0.72, 0.55]} />
            <meshBasicMaterial color={i % 5 === 0 ? (home2 ? hColors.primary : aColors.primary) : ['#f8cc54', '#ec5a61', '#5fcddd', '#f3ede0'][i % 4]} />
          </mesh>
        );
      })}
      {/* ad boards */}
      {[-30.3, 30.3].map((z) => (
        <mesh key={z} position={[0, 0.6, z]}>
          <boxGeometry args={[80, 1.15, 0.18]} />
          <meshBasicMaterial color="#101b31" />
        </mesh>
      ))}
      {/* ball */}
      <group position={[choreo.ball.x, Math.max(0.25, choreo.ball.y), choreo.ball.z]}>
        <mesh castShadow>
          <sphereGeometry args={[0.35, 16, 12]} />
          <meshStandardMaterial color="#f7f3e9" roughness={0.55} />
        </mesh>
      </group>
      {/* players */}
      {choreo.actors.map((a: { team: string; x: number; z: number; facing: number; celebrate?: boolean; despair?: boolean; run?: boolean; dive?: number }, i: number) => {
        const country = a.team === 'home' || a.team === 'keeper-home' ? home : away;
        const keeper = a.team.startsWith('keeper');
        return (
          <group key={i} position={[a.x, 0, a.z]} rotation={[0, a.facing, 0]}>
            <HncFootballer
              frame={frame}
              fps={fps}
              country={country}
              number={(i % 11) + 1}
              keeper={keeper}
              animation={a.run ? 'run' : 'idle'}
              celebrate={a.celebrate}
            />
            {a.despair ? (
              <group position={[0, 2.6, 0]} rotation={[0, -a.facing, 0]}>
                <mesh>
                  <planeGeometry args={[1.4, 0.5]} />
                  <meshBasicMaterial color="#101b31" transparent opacity={0.85} />
                </mesh>
              </group>
            ) : null}
          </group>
        );
      })}
      {/* floodlights */}
      {[[-58, -38], [58, -38], [-58, 38], [58, 38]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 10, 0]}>
            <cylinderGeometry args={[0.35, 0.5, 20, 6]} />
            <meshStandardMaterial color="#3a4350" flatShading />
          </mesh>
          <mesh position={[0, 20.4, 0]}>
            <boxGeometry args={[3.4, 1.6, 0.6]} />
            <meshBasicMaterial color="#fffbe8" />
          </mesh>
        </group>
      ))}
    </group>
  );
};
