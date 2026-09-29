import React from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { gazeTargets } from '../../cast/targets';
import { CastActor } from '../../render/CastActor';
import { paintNationalFlag } from '../../render/flags';
import type { SceneProps } from '../../render/worlds';
import { Block, Cyl, Glow, paintTiles, Floor, usePainted } from '../interior/kit';
import { dawnLevel, ROOF } from './rooftop.world';

/**
 * Rooftop renderer. The sky dome's vertex colours are re-mixed from the blue
 * hour to a red sunrise by the dawn level; the city is layered flat
 * silhouettes (original, no landmarks) with a few windows still lit; the flag
 * is a waving cloth (travelling waves from the hoist) with the geometric
 * national flag texture.
 */
const mix = (a: string, b: string, k: number) => new THREE.Color(a).lerp(new THREE.Color(b), k);

const Sky: React.FC<{ dawn: number }> = ({ dawn }) => {
  const geo = React.useMemo(() => {
    const g = new THREE.SphereGeometry(260, 36, 24);
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3));
    return g;
  }, []);
  React.useEffect(() => () => geo.dispose(), [geo]);
  React.useMemo(() => {
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const col = geo.attributes.color as THREE.BufferAttribute;
    const top = mix('#161c36', '#2f2a57', dawn);
    const mid = mix('#3a4166', '#b8475a', dawn);
    const hor = mix('#6a6378', '#ff7b4d', dawn);
    const sunDir = new THREE.Vector3(-12, 6, -150).normalize();
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
      const y = v.y;
      if (y > 0.25) c.copy(mid).lerp(top, Math.min(1, (y - 0.25) / 0.6));
      else c.copy(hor).lerp(mid, Math.max(0, y) / 0.25);
      // Sun glow toward the rising sun, stronger as dawn breaks.
      const d = Math.max(0, v.dot(sunDir));
      c.lerp(new THREE.Color('#ffd09a'), Math.pow(d, 18) * (0.2 + 0.7 * dawn));
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
  }, [geo, Math.round(dawn * 60)]);
  return (
    <mesh geometry={geo} renderOrder={-10}>
      <meshBasicMaterial vertexColors side={THREE.BackSide} fog={false} depthWrite={false} toneMapped={false} />
    </mesh>
  );
};

/** One silhouette layer of the city (seeded blocks + a few lit windows). */
const Skyline: React.FC<{ z: number; width: number; base: number; height: number; color: string; seed: number; lit: number; bridge?: boolean }> = ({ z, width, base, height, color, seed, lit, bridge }) => {
  const tex = usePainted(1024, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    let r = seed * 7919 + 13;
    const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    c.fillStyle = color;
    let x = 0;
    while (x < w) {
      const bw = 18 + rnd() * 60;
      const bh = h * (0.25 + rnd() * 0.6);
      c.fillRect(x, h - bh, bw, bh);
      if (rnd() < 0.2) c.fillRect(x + bw * 0.4, h - bh - 14, 4, 14);
      for (let wy = h - bh + 8; wy < h - 6; wy += 11)
        for (let wx = x + 4; wx < x + bw - 5; wx += 9) {
          if (rnd() < 0.05 * lit) {
            c.fillStyle = '#ffd89a';
            c.fillRect(wx, wy, 3, 4);
            c.fillStyle = color;
          }
        }
      x += bw + rnd() * 6;
    }
    if (bridge) {
      // A long suspension bridge across the strait: two towers, the deck, the cables.
      c.strokeStyle = color;
      c.fillStyle = color;
      const deckY = h * 0.78;
      c.fillRect(w * 0.18, deckY, w * 0.64, 5);
      for (const tx of [0.33, 0.67]) c.fillRect(w * tx - 4, h * 0.38, 8, deckY - h * 0.38 + 5);
      c.lineWidth = 2.5;
      c.beginPath();
      c.moveTo(w * 0.18, deckY);
      c.quadraticCurveTo(w * 0.255, h * 0.62, w * 0.33, h * 0.38);
      c.quadraticCurveTo(w * 0.5, h * 0.72, w * 0.67, h * 0.38);
      c.quadraticCurveTo(w * 0.745, h * 0.62, w * 0.82, deckY);
      c.stroke();
    }
  }, `sky-${seed}-${color}-${lit}-${bridge ? 1 : 0}`);
  return (
    <mesh position={[0, base + height / 2, z]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={tex} transparent fog={false} toneMapped={false} depthWrite={false} />
    </mesh>
  );
};

/** Waving cloth flag on the pole: hoist at the pole, waves travel toward the fly. */
const Flag: React.FC<{ code: string; t: number; dawn: number }> = ({ code, t, dawn }) => {
  const tex = React.useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 1200;
    c.height = 800;
    paintNationalFlag(c.getContext('2d')!, 1200, 800, code);
    const tx = new THREE.CanvasTexture(c);
    tx.colorSpace = THREE.SRGBColorSpace;
    tx.anisotropy = 8;
    return tx;
  }, [code]);
  const geo = React.useMemo(() => new THREE.PlaneGeometry(ROOF.flag.w, ROOF.flag.h, 40, 16), []);
  React.useEffect(() => () => {
    tex.dispose();
    geo.dispose();
  }, [tex, geo]);
  React.useMemo(() => {
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const u = (pos.getX(i) + ROOF.flag.w / 2) / ROOF.flag.w;
      const y = pos.getY(i);
      const amp = 0.28 * u;
      pos.setZ(i, amp * Math.sin(u * 7 - t * 5.2) + 0.08 * u * Math.sin(y * 2.1 + t * 3.1));
      pos.setY(i, y - 0.12 * u * u);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }, [geo, t]);
  return (
    <group position={[ROOF.pole.x, 0, ROOF.pole.z]}>
      <Cyl r={[0.05, 0.07]} h={ROOF.poleH + 0.3} pos={[0, (ROOF.poleH + 0.3) / 2, 0]} color="#c9ccd1" metal={0.7} rough={0.3} />
      <mesh position={[0, ROOF.poleH + 0.34, 0]}>
        <sphereGeometry args={[0.09, 10, 8]} />
        <meshStandardMaterial color="#d9a441" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh geometry={geo} position={[ROOF.flag.w / 2 + 0.05, ROOF.poleH - ROOF.flag.h / 2, 0]} castShadow>
        <meshStandardMaterial map={tex} side={THREE.DoubleSide} roughness={0.85} emissive="#ffffff" emissiveMap={tex} emissiveIntensity={0.08 + 0.1 * dawn} />
      </mesh>
    </group>
  );
};

export const RooftopScene: React.FC<SceneProps> = ({ shot, frame, fps, timeline, lens }) => {
  const scene = useThree((s) => s.scene);
  const dawn = dawnLevel(timeline, shot, frame);
  React.useMemo(() => {
    scene.background = new THREE.Color('#2a2440');
    scene.fog = new THREE.Fog(mix('#4a4c68', '#d96a5a', dawn).getStyle(), 30, 240);
  }, [scene, Math.round(dawn * 40)]);
  const t = frame / fps;
  const target = gazeTargets(shot, frame, fps, lens, timeline);
  const code = String(shot.set.flag ?? 'TR');
  const tiles = (c: CanvasRenderingContext2D, w: number, h: number) => paintTiles(c, w, h, '#8e8a86', '#96928c', 5);
  const sunY = 2 + 9 * dawn;
  return (
    <group>
      <Sky dawn={dawn} />
      <hemisphereLight args={[mix('#7d86b0', '#ffb39a', dawn).getStyle(), '#3a302c', 0.9 + 0.5 * dawn]} />
      {/* The sun low over the city behind the flag: a warm backlight / rim. */}
      <directionalLight position={[-12, sunY, -40]} color={mix('#c9a8b8', '#ffab70', dawn).getStyle()} intensity={0.6 + 2.4 * dawn} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={9} shadow-camera-bottom={-3} shadow-camera-far={120} />
      {/* Soft front fill from the sky behind the camera. */}
      <directionalLight position={[4, 6, 12]} color="#a9b2d6" intensity={0.55} />
      <Glow pos={[-18, sunY * 2.2, -150]} size={34 + 20 * dawn} color="#ffd6a0" strength={0.25 + 0.6 * dawn} />
      <mesh position={[-18, sunY * 2.2 - 3 + 4 * dawn, -151]}>
        <circleGeometry args={[5, 32]} />
        <meshBasicMaterial color={mix('#ff9d6a', '#fff0d0', dawn)} fog={false} toneMapped={false} transparent opacity={0.25 + 0.75 * dawn} />
      </mesh>

      {/* City: far hills, the strait with its bridge, near blocks. */}
      <Skyline z={-190} width={520} base={-6} height={40} color={mix('#4b4466', '#7a4a5c', dawn).getStyle()} seed={3} lit={0} />
      <Skyline z={-140} width={380} base={-12} height={30} color={mix('#3a3656', '#5d3a4e', dawn).getStyle()} seed={5} lit={0.4} bridge />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -9, -120]}>
        <planeGeometry args={[600, 80]} />
        <meshBasicMaterial color={mix('#39405e', '#c36a5e', dawn)} fog={false} toneMapped={false} />
      </mesh>
      <Skyline z={-70} width={220} base={-22} height={28} color={mix('#2a2842', '#3e2638', dawn).getStyle()} seed={8} lit={1} />
      <Skyline z={-38} width={130} base={-27} height={26} color={mix('#211f33', '#2c1c2a', dawn).getStyle()} seed={11} lit={1.4} />

      {/* Terrace: floor, parapet, railing, a planter. */}
      <Floor w={10} d={9} center={[0, 0.5]} paint={tiles} paintKey="roof-tiles" repeat={3} rough={0.85} />
      <Block size={[10, 1.0, 0.3]} pos={[0, 0.5, ROOF.parapetZ]} color="#a8a19a" rough={0.9} />
      <Block size={[10, 0.06, 0.4]} pos={[0, 1.03, ROOF.parapetZ]} color="#bfb8b0" rough={0.8} />
      {Array.from({ length: 12 }, (_, i) => (
        <Cyl key={i} r={[0.018, 0.018]} h={0.55} pos={[-4.6 + i * 0.84, 1.33, ROOF.parapetZ]} color="#2a2d33" metal={0.6} shadow={false} />
      ))}
      <Block size={[10, 0.04, 0.05]} pos={[0, 1.6, ROOF.parapetZ]} color="#2a2d33" metal={0.6} shadow={false} />
      <Block size={[1.2, 0.45, 0.5]} pos={[3.0, 0.23, -1.5]} color="#6b5a4d" />
      <Flag code={code} t={t} dawn={dawn} />

      {shot.actors.map((track) => (
        <CastActor key={track.cast} shot={shot} track={track} member={timeline.cast[track.cast]} frame={frame} fps={fps} target={target} shadowColor="#2a2220" />
      ))}
    </group>
  );
};
