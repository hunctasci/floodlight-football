import React from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { actorState } from '../../cast/state';
import { gazeTargets } from '../../cast/targets';
import { CastActor } from '../../render/CastActor';
import type { SceneProps } from '../../render/worlds';
import { HNC_UI } from '../../graphics/hnc-ui';
import { Block, CeilingLight, Cyl, Glow, Panel, paintSign, paintTiles, usePainted } from '../interior/kit';
import { CORRIDOR, CORRIDOR_LIGHTS, PILLARS } from './layout';

/**
 * Corridor renderer. Each section has its own materials and light colour;
 * only the three lights nearest the walker are real lights (cheap), the rest
 * are emissive fixtures. The mouth is an overexposed opening: the pitch as a
 * wall of light with the ghost of a stand and floodlights in it.
 */
const W = CORRIDOR.halfW;
const H = CORRIDOR.h;

const LIGHT_COLOR = { office: '#fff4df', service: '#cfe2ff', tunnel: '#ffd9a8', pitch: '#ffffff' } as const;

function paintBlock(c: CanvasRenderingContext2D, w: number, h: number): void {
  c.fillStyle = '#16233d';
  c.fillRect(0, 0, w, h);
  const bh = h / 8;
  const bw = w / 4;
  for (let r = 0; r < 8; r++)
    for (let i = -1; i < 5; i++) {
      c.fillStyle = (r + i) % 2 ? '#1b2a47' : '#18263f';
      c.fillRect(i * bw + (r % 2) * (bw / 2) + 3, r * bh + 3, bw - 6, bh - 6);
    }
}

function paintConcrete(c: CanvasRenderingContext2D, w: number, h: number): void {
  c.fillStyle = '#8d9096';
  c.fillRect(0, 0, w, h);
  let r = 7;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 900; i++) {
    c.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${0.03 + rnd() * 0.05})`;
    c.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 6, 2 + rnd() * 6);
  }
  c.fillStyle = 'rgba(0,0,0,0.15)';
  c.fillRect(0, h * 0.5 - 1, w, 2);
}

/** The pitch seen from inside the tunnel: light, a stand, floodlights, all blown out. */
function paintPitchView(c: CanvasRenderingContext2D, w: number, h: number): void {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#fefcf4');
  g.addColorStop(0.55, '#f4f7ee');
  g.addColorStop(0.62, '#cfeccd');
  g.addColorStop(1, '#8fd49a');
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(40,60,80,0.18)';
  c.beginPath();
  c.moveTo(0, h * 0.58);
  c.lineTo(w, h * 0.5);
  c.lineTo(w, h * 0.6);
  c.lineTo(0, h * 0.62);
  c.fill();
  for (const x of [0.12, 0.88]) {
    c.fillStyle = 'rgba(40,60,80,0.2)';
    c.fillRect(w * x - 3, h * 0.12, 6, h * 0.42);
    c.fillStyle = '#ffffff';
    c.fillRect(w * x - 26, h * 0.1, 52, 16);
  }
}

/** Spot from the pitch up the tunnel (target parented so its matrix updates). */
const MouthLight: React.FC<{ intensity: number }> = ({ intensity }) => {
  const light = React.useMemo(() => {
    const l = new THREE.SpotLight('#fff6e6', 1, 34, 0.55, 0.8, 1.5);
    l.position.set(0, 2.2, CORRIDOR.mouthZ - 3);
    l.castShadow = true;
    l.shadow.mapSize.set(1024, 1024);
    l.target.position.set(0, 0.5, CORRIDOR.mouthZ + 8);
    l.add(l.target);
    l.target.position.set(0, -1.7, 11);
    return l;
  }, []);
  light.intensity = intensity;
  return <primitive object={light} />;
};

export const CorridorScene: React.FC<SceneProps> = ({ shot, frame, fps, timeline, lens }) => {
  const scene = useThree((s) => s.scene);
  React.useMemo(() => {
    scene.background = new THREE.Color('#05070b');
    scene.fog = new THREE.Fog('#06080d', 7, 26);
  }, [scene]);
  const target = gazeTargets(shot, frame, fps, lens, timeline);
  const glow = typeof shot.set.glow === 'number' ? (shot.set.glow as number) : 1;
  const walker = shot.actors[0];
  const wz = walker ? actorState(shot, walker, frame, fps).pos.z : 0;
  const nearest = [...CORRIDOR_LIGHTS].filter((l) => l.on).sort((a, b) => Math.abs(a.pos.z - wz) - Math.abs(b.pos.z - wz)).slice(0, 3);
  // A phone in hand lights the face from below (practical).
  const ws = walker ? actorState(shot, walker, frame, fps) : undefined;
  const phoneGlow = ws && walker?.hold === 'phone' ? { x: ws.pos.x + Math.sin(ws.facing) * 0.55, y: 1.5, z: ws.pos.z + Math.cos(ws.facing) * 0.55 } : undefined;
  // The mouth's light grows as you approach it.
  const approach = Math.min(1, Math.max(0, (-8 - wz) / 15));

  const carpet = usePainted(512, 512, (c, w, h) => paintTiles(c, w, h, '#5d5a66', '#65626e', 6), 'corr-carpet', [1, 4]);
  const officeWall = usePainted(256, 256, (c, w, h) => {
    c.fillStyle = '#d7d0c2';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#c3bba9';
    c.fillRect(0, h * 0.62, w, h * 0.38);
  }, 'corr-office-wall');
  const concrete = usePainted(512, 512, paintConcrete, 'corr-concrete', [3, 1]);
  const block = usePainted(512, 512, paintBlock, 'corr-block', [5, 1]);
  const words = usePainted(1024, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = HNC_UI.cream;
    c.font = `${h * 0.36}px Impact, 'Arial Black', sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('YOUR COUNTRY.', w / 2, h * 0.3);
    c.fillStyle = HNC_UI.gold;
    c.fillText('YOUR LEAGUE.', w / 2, h * 0.72);
  }, 'corr-words');
  const banner = usePainted(512, 128, (c, w, h) => {
    c.fillStyle = HNC_UI.navy;
    c.fillRect(0, 0, w, h);
    c.fillStyle = HNC_UI.gold;
    c.fillRect(0, h - 10, w, 10);
    c.font = `${h * 0.55}px Impact, 'Arial Black', sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = HNC_UI.cream;
    c.fillText('HNC LEAGUE', w / 2, h * 0.5);
  }, 'corr-banner');
  const exitSign = usePainted(256, 96, (c, w, h) => paintSign(c, w, h, ['EXIT →'], '#1f8f4e', '#ffffff', '#1f8f4e'), 'corr-exit');
  const pitchSign = usePainted(256, 96, (c, w, h) => paintSign(c, w, h, ['PITCH ↑'], '#f7bf30', '#101b31', '#f7bf30'), 'corr-pitch');
  const pitchView = usePainted(512, 512, paintPitchView, 'corr-pitch-view');

  const seg = (z0: number, z1: number) => ({ len: z0 - z1, mid: (z0 + z1) / 2 });
  const o = seg(CORRIDOR.office[0], CORRIDOR.office[1]);
  const sv = seg(CORRIDOR.service[0], CORRIDOR.service[1]);
  const tn = seg(CORRIDOR.tunnel[0], CORRIDOR.mouthZ);

  return (
    <group>
      <hemisphereLight args={['#9aa8c2', '#1a1a20', 0.45]} />
      {nearest.map((l) => (
        <pointLight key={l.pos.z} position={[l.pos.x, l.pos.y - 0.3, l.pos.z]} color={LIGHT_COLOR[l.section]} intensity={l.section === 'tunnel' ? 2.4 : 2.0} distance={6.5} decay={1.6} />
      ))}
      {/* Light pouring in from the mouth (grows as the walker approaches). */}
      <MouthLight intensity={(3 + 7 * approach) * glow} />
      {phoneGlow ? <pointLight position={[phoneGlow.x, phoneGlow.y, phoneGlow.z]} color="#bcd4ff" intensity={1.1} distance={1.6} decay={1.8} /> : null}

      {/* Office section: carpet, warm walls, doors, tubes (one dead). */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, o.mid]} receiveShadow>
        <planeGeometry args={[W * 2, o.len]} />
        <meshStandardMaterial map={carpet} roughness={1} />
      </mesh>
      {[-1, 1].map((sx) => (
        <Panel key={sx} w={o.len} h={H} pos={[sx * W, H / 2, o.mid]} rot={[0, -sx * (Math.PI / 2), 0]} map={officeWall} />
      ))}
      {[10.2, 7.4, 4.2].map((z, i) => (
        <group key={z}>
          <Block size={[0.06, 2.1, 0.95]} pos={[(i % 2 ? 1 : -1) * (W - 0.03), 1.05, z]} color="#7c5f45" rough={0.7} />
          <Block size={[0.04, 0.05, 0.14]} pos={[(i % 2 ? 1 : -1) * (W - 0.07), 1.0, z + 0.34]} color="#c7cbd1" metal={0.7} rough={0.3} shadow={false} />
        </group>
      ))}
      <Panel w={0.52} h={0.2} pos={[0, H - 0.25, 2.25]} map={exitSign} basic />
      {CORRIDOR_LIGHTS.filter((l) => l.section === 'office').map((l) => (
        <CeilingLight key={l.pos.z} pos={[l.pos.x, l.pos.y, l.pos.z]} w={0.3} d={1.2} level={l.on ? 1 : 0.05} />
      ))}

      {/* Service section: concrete, pipes, bulkhead lights. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, sv.mid]} receiveShadow>
        <planeGeometry args={[W * 2, sv.len]} />
        <meshStandardMaterial map={concrete} roughness={0.8} color="#9a9ca2" />
      </mesh>
      {[-1, 1].map((sx) => (
        <Panel key={sx} w={sv.len} h={H} pos={[sx * W, H / 2, sv.mid]} rot={[0, -sx * (Math.PI / 2), 0]} map={concrete} />
      ))}
      {[0.25, 0.45].map((dx, i) => (
        <Cyl key={dx} r={[0.06 + i * 0.03, 0.06 + i * 0.03]} h={sv.len} pos={[W - dx, H - 0.22 - i * 0.1, sv.mid]} rot={[Math.PI / 2, 0, 0]} color={i ? '#6f7a86' : '#9aa3ad'} metal={0.5} rough={0.4} />
      ))}
      {CORRIDOR_LIGHTS.filter((l) => l.section === 'service').map((l) => (
        <Block key={l.pos.z} size={[0.4, 0.08, 0.22]} pos={[l.pos.x, l.pos.y, l.pos.z]} color="#dfe9ff" emissive="#dfe9ff" emissiveIntensity={1.4} shadow={false} />
      ))}

      {/* Tunnel: painted block walls, rubber matting, HNC banners, the words. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, tn.mid]} receiveShadow>
        <planeGeometry args={[W * 2, tn.len]} />
        <meshStandardMaterial color="#20252e" roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, tn.mid]} receiveShadow>
        <planeGeometry args={[1.3, tn.len]} />
        <meshStandardMaterial color="#2e3442" roughness={1} />
      </mesh>
      {[-1, 1].map((sx) => (
        <Panel key={sx} w={tn.len} h={H} pos={[sx * W, H / 2, tn.mid]} rot={[0, -sx * (Math.PI / 2), 0]} map={block} />
      ))}
      {[-1, 1].map((sx) => (
        <Block key={`stripe${sx}`} size={[0.02, 0.08, tn.len]} pos={[sx * (W - 0.02), 1.05, tn.mid]} color={HNC_UI.gold} emissive={HNC_UI.gold} emissiveIntensity={0.25} shadow={false} />
      ))}
      <Panel w={2.6} h={0.65} pos={[-W + 0.03, 1.7, -12.8]} rot={[0, Math.PI / 2, 0]} map={words} basic opacity={0.92} />
      {[-9.5, -18.5].map((z, i) => (
        <Panel key={z} w={1.6} h={0.4} pos={[(i % 2 ? -1 : 1) * (W - 0.03), 2.15, z]} rot={[0, (i % 2 ? 1 : -1) * (Math.PI / 2), 0]} map={banner} basic />
      ))}
      <Panel w={0.52} h={0.2} pos={[0, H - 0.25, -21.8]} map={pitchSign} basic />
      {CORRIDOR_LIGHTS.filter((l) => l.section === 'tunnel').map((l) => (
        <group key={l.pos.z}>
          <Cyl r={[0.12, 0.16]} h={0.14} pos={[l.pos.x, l.pos.y, l.pos.z]} color="#2a2f38" metal={0.4} />
          <Glow pos={[l.pos.x, l.pos.y - 0.12, l.pos.z]} size={0.8} color="#ffd9a8" strength={0.7} />
        </group>
      ))}

      {/* Ceilings. */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, H, (CORRIDOR.office[0] + CORRIDOR.mouthZ) / 2]}>
        <planeGeometry args={[W * 2, CORRIDOR.office[0] - CORRIDOR.mouthZ]} />
        <meshStandardMaterial color="#2a2d33" roughness={1} />
      </mesh>
      {/* Pillars at the section changes (the cuts hide behind them). */}
      {PILLARS.map((z) =>
        [-1, 1].map((sx) => <Block key={`${z}:${sx}`} size={[0.34, H, 0.5]} pos={[sx * (W - 0.12), H / 2, z]} color="#3a3f48" rough={0.8} />),
      )}
      {/* Back wall behind the start. */}
      <Block size={[W * 2, H, 0.1]} pos={[0, H / 2, CORRIDOR.office[0] + 0.05]} color="#bdb6a8" />

      {/* The mouth: frame, and the pitch as a wall of light. */}
      <Block size={[0.5, H, 0.4]} pos={[-W - 0.05, H / 2, CORRIDOR.mouthZ]} color="#101520" />
      <Block size={[0.5, H, 0.4]} pos={[W + 0.05, H / 2, CORRIDOR.mouthZ]} color="#101520" />
      <Panel w={10} h={6} pos={[0, 2.2, CORRIDOR.pitchZ]} map={pitchView} basic color={new THREE.Color(1, 1, 1).multiplyScalar(0.9 + 0.3 * glow).getStyle()} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, (CORRIDOR.mouthZ + CORRIDOR.pitchZ) / 2]}>
        <planeGeometry args={[10, CORRIDOR.mouthZ - CORRIDOR.pitchZ]} />
        <meshBasicMaterial color="#b9ecc0" toneMapped={false} />
      </mesh>
      <Glow pos={[0, 1.6, CORRIDOR.mouthZ - 4.5]} size={7} color="#fffaf0" strength={(0.45 + 0.35 * approach) * glow} />

      {shot.actors.map((track) => (
        <CastActor key={track.cast} shot={shot} track={track} member={timeline.cast[track.cast]} frame={frame} fps={fps} target={target} shadowColor="#07080b" />
      ))}
    </group>
  );
};
