import React from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { HNC_RENDER_PROFILE } from '@floodlight/hnc-visuals';
import { HncDaylight } from '../../render/lights';
import { paintNationalFlag } from '../../render/flags';
import { HNC_UI } from '../../graphics/hnc-ui';
import type { FootballLightId } from './football.world';
import { mixHex } from '../../effects/current';

/**
 * Football atmosphere — everything AROUND the canonical stadium that makes a
 * night, a dawn or a horror film: sky dome, fog, light rig, floodlight halos,
 * HNC-owned pitch boards, a terrace tifo. The stadium, players and ball stay
 * canonical (hnc-visuals); this file only lights and dresses them.
 */

interface Preset {
  sky?: { top: string; horizon: string; bottom: string };
  fog: { color: string; near: number; far: number };
  hemi: { sky: string; ground: string; intensity: number };
  sun?: { pos: [number, number, number]; color: string; intensity: number };
  /** Floodlight key lights (index into FLOOD_HEADS) + halo strength. */
  floods: { heads: number[]; color: string; intensity: number; halo: number };
  /** Emissive level of the floodlight heads + LED boards (1 = game). */
  practicals: number;
  /** Soft fill from the camera side (keeps faces readable against a backlight). */
  fill?: { pos: [number, number, number]; color: string; intensity: number };
  /** Low practicals on the grass (horror under-lighting of faces near the goal / spot). */
  ground?: { pos: [number, number, number]; color: string; intensity: number }[];
}

/** Floodlight head positions (create-stands.ts pylons). */
export const FLOOD_HEADS: [number, number, number][] = [
  [58, 20.4, -38],
  [58, 20.4, 38],
  [-58, 20.4, -38],
  [-58, 20.4, 38],
];

export const FOOTBALL_LIGHTS: Record<Exclude<FootballLightId, 'day'>, Preset> = {
  night: {
    sky: { top: '#02050b', horizon: '#18294a', bottom: '#0b1422' },
    fog: { color: '#0d1829', near: 95, far: 250 },
    hemi: { sky: '#8ea7d4', ground: '#15301d', intensity: 0.85 },
    floods: { heads: [0, 3], color: '#eef3ff', intensity: 1.35, halo: 1 },
    practicals: 1,
  },
  dawn: {
    sky: { top: '#2b3a6e', horizon: '#ff6f4f', bottom: '#5a3434' },
    fog: { color: '#e98a6c', near: 80, far: 245 },
    hemi: { sky: '#ffd3bd', ground: '#33402f', intensity: 1.15 },
    sun: { pos: [-35, 10, -150], color: '#ffb07c', intensity: 2.6 },
    floods: { heads: [], color: '#fff1d8', intensity: 0, halo: 0 },
    practicals: 0.35,
  },
  horror: {
    sky: { top: '#000103', horizon: '#0b131d', bottom: '#030507' },
    fog: { color: '#081019', near: 16, far: 78 },
    hemi: { sky: '#6a82a6', ground: '#040806', intensity: 0.3 },
    floods: { heads: [0], color: '#cfe0ff', intensity: 1.55, halo: 0.8 },
    practicals: 0.25,
    fill: { pos: [-20, 9, 18], color: '#8aa0d0', intensity: 1.05 },
    ground: [
      { pos: [42.6, 0.35, 0.4], color: '#b9d2ff', intensity: 5 },
      { pos: [34.1, 0.35, 2.4], color: '#b9d2ff', intensity: 4 },
    ],
  },
};

/** Big back-side sphere with a vertical gradient (fog-free), camera-correct horizon. */
const SkyDome: React.FC<{ top: string; horizon: string; bottom: string; level: number }> = ({ top, horizon, bottom, level }) => {
  const geo = React.useMemo(() => {
    const g = new THREE.SphereGeometry(240, 32, 20);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const cTop = new THREE.Color(top);
    const cHor = new THREE.Color(horizon);
    const cBot = new THREE.Color(bottom);
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 240;
      if (y >= 0) c.copy(cHor).lerp(cTop, Math.pow(Math.min(1, y / 0.55), 0.7));
      else c.copy(cHor).lerp(cBot, Math.min(1, -y / 0.12));
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  }, [top, horizon, bottom]);
  React.useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo} renderOrder={-10}>
      <meshBasicMaterial vertexColors side={THREE.BackSide} fog={false} depthWrite={false} toneMapped={false} color={new THREE.Color(1, 1, 1).multiplyScalar(0.15 + 0.85 * level)} />
    </mesh>
  );
};

const haloTexture = (() => {
  let tex: THREE.CanvasTexture | undefined;
  return (): THREE.CanvasTexture => {
    if (tex) return tex;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,252,240,1)');
    g.addColorStop(0.18, 'rgba(255,246,222,0.55)');
    g.addColorStop(0.5, 'rgba(210,225,255,0.12)');
    g.addColorStop(1, 'rgba(200,220,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };
})();

/** Additive halo sprites around lit floodlight heads (cheap bloom). */
const Halos: React.FC<{ heads: number[]; strength: number; tint?: string }> = ({ heads, strength, tint }) => {
  const mat = React.useMemo(() => new THREE.SpriteMaterial({ map: haloTexture(), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }), []);
  React.useEffect(() => () => mat.dispose(), [mat]);
  mat.opacity = Math.min(1, strength);
  mat.color.set(tint ? mixHex('#ffffff', tint, 0.6) : '#ffffff');
  if (strength <= 0.01) return null;
  return (
    <>
      {heads.map((h) => (
        <sprite key={h} material={mat} position={FLOOD_HEADS[h]} scale={[26, 26, 1]} />
      ))}
    </>
  );
};

/** Paints a tifo: the country's flag emblem laid over the terrace. */
function paintTifo(c: CanvasRenderingContext2D, w: number, h: number, code: string): void {
  if (code === 'TR') {
    // Crescent + star centred on a red field (tifo proportions, not the flag's).
    c.fillStyle = '#e30a17';
    c.fillRect(0, 0, w, h);
    const fw = h * 1.5;
    c.save();
    c.translate((w - fw) / 2 + fw * 0.08, 0);
    const tmp = document.createElement('canvas');
    tmp.width = Math.round(fw);
    tmp.height = h;
    paintNationalFlag(tmp.getContext('2d')!, tmp.width, h, 'TR');
    c.drawImage(tmp, 0, 0);
    c.restore();
    return;
  }
  if (!paintNationalFlag(c, w, h, code)) {
    c.fillStyle = HNC_UI.navy;
    c.fillRect(0, 0, w, h);
  }
}

/** A cloth tifo laid over the far-stand terraces (rows 0..7), gently breathing. */
export const Tifo: React.FC<{ code: string; t: number; level: number }> = ({ code, t, level }) => {
  const tex = React.useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 224;
    paintTifo(c.getContext('2d')!, 1024, 224, code);
    const tx = new THREE.CanvasTexture(c);
    tx.colorSpace = THREE.SRGBColorSpace;
    tx.anisotropy = 4;
    return tx;
  }, [code]);
  const geo = React.useMemo(() => new THREE.PlaneGeometry(46, 10.2, 46, 10), []);
  React.useEffect(() => () => {
    tex.dispose();
    geo.dispose();
  }, [tex, geo]);
  React.useMemo(() => {
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      pos.setZ(i, 0.16 * Math.sin(x * 0.5 + t * 1.6) * Math.cos(y * 0.7 + t * 1.1));
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }, [geo, t]);
  // Slope of the terraces: 8 rows x (0.55 rise, 1.1 depth).
  const tilt = Math.atan2(8 * 1.1, 8 * 0.55);
  return (
    <mesh geometry={geo} position={[0, 4.35, -35.9]} rotation={[-tilt, 0, 0]}>
      <meshStandardMaterial map={tex} roughness={0.95} side={THREE.DoubleSide} color={new THREE.Color(1, 1, 1).multiplyScalar(0.3 + 0.7 * level)} />
    </mesh>
  );
};

/** HNC-owned pitch-side boards (campaign-safe: no third-party marks). */
export function paintHncBoard(slot: number): THREE.Material {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = HNC_UI.navy;
  ctx.fillRect(0, 0, 1024, 128);
  ctx.fillStyle = HNC_UI.gold;
  ctx.fillRect(0, 118, 1024, 10);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  if (slot % 2 === 0) {
    ctx.font = "82px Impact, 'Arial Black', sans-serif";
    ctx.fillStyle = HNC_UI.cream;
    ctx.fillText('HNC', 400, 64);
    ctx.fillStyle = HNC_UI.gold;
    ctx.fillText('LEAGUE', 610, 64);
  } else {
    ctx.font = "bold 64px ui-monospace, Menlo, monospace";
    ctx.fillStyle = HNC_UI.gold;
    ctx.fillText('hncleague.com', 512, 62);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return new THREE.MeshBasicMaterial({ map: tex });
}

/**
 * Lights + sky for a preset at a light level (lights-out / lights-up events
 * scale everything). `day` is the canonical game rig verbatim.
 */
export const FootballLighting: React.FC<{ preset: FootballLightId; level: number; stagger: number[]; tint?: string }> = ({ preset, level, stagger, tint }) => {
  const scene = useThree((s) => s.scene);
  const p = preset === 'day' ? undefined : FOOTBALL_LIGHTS[preset];
  React.useMemo(() => {
    if (!p) {
      scene.background = new THREE.Color(HNC_RENDER_PROFILE.background);
      scene.fog = new THREE.Fog(HNC_RENDER_PROFILE.fogColor, HNC_RENDER_PROFILE.fogNear, HNC_RENDER_PROFILE.fogFar);
    } else {
      scene.background = new THREE.Color(p.sky?.bottom ?? p.fog.color);
      scene.fog = new THREE.Fog(p.fog.color, p.fog.near, p.fog.far);
    }
  }, [scene, p]);
  if (!p) return <HncDaylight />;
  const headLevel = (h: number) => Math.max(0, Math.min(1, stagger[h] ?? level));
  // `floodTint`: the floodlights carry a nation's Current (keeps half the white for readable faces).
  const floodColor = tint ? mixHex(p.floods.color, tint, 0.5) : p.floods.color;
  return (
    <>
      {p.sky ? <SkyDome {...p.sky} level={level} /> : null}
      <hemisphereLight args={[p.hemi.sky, p.hemi.ground, p.hemi.intensity * (0.08 + 0.92 * level)]} />
      {p.sun ? (
        <directionalLight position={p.sun.pos} color={p.sun.color} intensity={p.sun.intensity * level} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-60} shadow-camera-right={60} shadow-camera-top={45} shadow-camera-bottom={-45} shadow-camera-far={400} />
      ) : null}
      {p.ground?.map((g) => <pointLight key={g.pos.join(',')} position={g.pos} color={g.color} intensity={g.intensity * level} distance={6} decay={1.6} />)}
      {p.fill ? <directionalLight position={p.fill.pos} color={p.fill.color} intensity={p.fill.intensity * level} /> : null}
      {p.floods.heads.map((h, i) => (
        <directionalLight
          key={h}
          position={FLOOD_HEADS[h]}
          color={floodColor}
          intensity={p.floods.intensity * headLevel(h)}
          castShadow={i === 0}
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-60}
          shadow-camera-right={60}
          shadow-camera-top={45}
          shadow-camera-bottom={-45}
          shadow-camera-far={200}
        />
      ))}
      {p.floods.heads.map((h) => (
        <Halos key={`halo-${h}`} heads={[h]} strength={p.floods.halo * headLevel(h)} tint={tint} />
      ))}
    </>
  );
};

/** Emissive level of practicals (heads + boards) for a preset/level. */
export function practicalLevel(preset: FootballLightId, level: number): number {
  return preset === 'day' ? 1 : FOOTBALL_LIGHTS[preset].practicals * level;
}
