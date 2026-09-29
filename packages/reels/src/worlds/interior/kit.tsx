import React from 'react';
import * as THREE from 'three';
import { makeCanvasTexture } from '../../render/screens';

/**
 * Interior kit — shared set pieces for the indoor worlds (apartment,
 * breakroom, café, corridor): the HNC low-poly language (flat shading, chunky
 * proportions) with richer materials and practical light sources. Every piece
 * is parametric and deterministic; worlds compose them from their layout.
 */

export type V3t = [number, number, number];

export const FLAT = { flatShading: true } as const;

/** One flat-shaded box (the workhorse of every set). */
export const Block: React.FC<{
  size: V3t;
  pos: V3t;
  color: string;
  rot?: V3t;
  rough?: number;
  metal?: number;
  emissive?: string;
  emissiveIntensity?: number;
  shadow?: boolean;
  opacity?: number;
}> = ({ size, pos, color, rot, rough = 0.85, metal = 0, emissive, emissiveIntensity = 1, shadow = true, opacity }) => (
  <mesh position={pos} rotation={rot} castShadow={shadow} receiveShadow>
    <boxGeometry args={size} />
    <meshStandardMaterial color={color} roughness={rough} metalness={metal} emissive={emissive ?? '#000000'} emissiveIntensity={emissive ? emissiveIntensity : 0} transparent={opacity !== undefined} opacity={opacity ?? 1} {...FLAT} />
  </mesh>
);

export const Cyl: React.FC<{ r: [number, number]; h: number; pos: V3t; color: string; seg?: number; rot?: V3t; rough?: number; metal?: number; emissive?: string; shadow?: boolean }> = ({ r, h, pos, color, seg = 8, rot, rough = 0.8, metal = 0, emissive, shadow = true }) => (
  <mesh position={pos} rotation={rot} castShadow={shadow} receiveShadow>
    <cylinderGeometry args={[r[0], r[1], h, seg]} />
    <meshStandardMaterial color={color} roughness={rough} metalness={metal} emissive={emissive ?? '#000000'} emissiveIntensity={emissive ? 1 : 0} {...FLAT} />
  </mesh>
);

/** Canvas texture that repaints only when `key` changes. */
export function usePainted(w: number, h: number, paint: (c: CanvasRenderingContext2D, w: number, h: number) => void, key: string, repeat?: [number, number]): THREE.CanvasTexture {
  const tex = React.useMemo(() => {
    const t = makeCanvasTexture(w, h);
    paint(t.ctx, w, h);
    t.tex.needsUpdate = true;
    if (repeat) {
      t.tex.wrapS = t.tex.wrapT = THREE.RepeatWrapping;
      t.tex.repeat.set(repeat[0], repeat[1]);
    }
    return t.tex;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  React.useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

/** A textured plane (posters, signs, floors, window views). */
export const Panel: React.FC<{ w: number; h: number; pos: V3t; rot?: V3t; map: THREE.Texture; basic?: boolean; rough?: number; color?: string; opacity?: number }> = ({ w, h, pos, rot, map, basic, rough = 0.9, color = '#ffffff', opacity }) => (
  <mesh position={pos} rotation={rot} receiveShadow={!basic}>
    <planeGeometry args={[w, h]} />
    {basic ? (
      <meshBasicMaterial map={map} toneMapped={false} color={color} transparent={opacity !== undefined} opacity={opacity ?? 1} />
    ) : (
      <meshStandardMaterial map={map} roughness={rough} color={color} transparent={opacity !== undefined} opacity={opacity ?? 1} />
    )}
  </mesh>
);

export type TimeOfDay = 'day' | 'night' | 'dawn' | 'dusk';

/** City beyond a window: layered blocks, lit windows at night, sky by time of day. */
export function paintCityView(c: CanvasRenderingContext2D, w: number, h: number, tod: TimeOfDay, seed = 1): void {
  const sky: Record<TimeOfDay, [string, string]> = {
    day: ['#8fc7ec', '#d7ecf7'],
    night: ['#050a16', '#1a2a47'],
    dawn: ['#3b4c86', '#ff8a5e'],
    dusk: ['#27365f', '#f08c5a'],
  };
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, sky[tod][0]);
  g.addColorStop(1, sky[tod][1]);
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  let r = seed * 9301 + 49297;
  const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  const layers = tod === 'day' ? ['#9bb9cf', '#7d9db8'] : tod === 'night' ? ['#0e1729', '#0a1120'] : ['#5b4a6c', '#3d3552'];
  layers.forEach((col, li) => {
    let x = -10;
    while (x < w) {
      const bw = w * (0.07 + rnd() * 0.1);
      const top = h * (0.28 + li * 0.14 + rnd() * 0.3);
      c.fillStyle = col;
      c.fillRect(x, top, bw, h - top);
      for (let y = top + 10; y < h - 6; y += 16)
        for (let wx = x + 6; wx < x + bw - 8; wx += 12) {
          const on = rnd();
          if (tod === 'day') c.fillStyle = on < 0.5 ? '#b8d0e2' : '#a4c0d6';
          else c.fillStyle = on < (tod === 'night' ? 0.28 : 0.12) ? (on < 0.08 ? '#ffe7a8' : '#f3c46e') : 'rgba(0,0,0,0)';
          c.fillRect(wx, y, 6, 8);
        }
      x += bw + w * 0.01;
    }
  });
  if (tod === 'night') {
    c.fillStyle = '#f4f1e6';
    c.beginPath();
    c.arc(w * 0.78, h * 0.18, h * 0.05, 0, Math.PI * 2);
    c.fill();
  }
}

/**
 * A window: frame, city view (emissive at night so it glows), optional
 * venetian blinds (0 open .. 1 closed, animated by the world).
 */
export const Window: React.FC<{ pos: V3t; rotY?: number; w: number; h: number; tod: TimeOfDay; blinds?: number; frame?: string; seed?: number }> = ({ pos, rotY = 0, w, h, tod, blinds = 0, frame = '#39424f', seed = 1 }) => {
  const view = usePainted(512, Math.round((512 * h) / w), (c, cw, ch) => paintCityView(c, cw, ch, tod, seed), `city-${tod}-${seed}-${w}-${h}`);
  const slats = Math.round(h / 0.09);
  const drop = h * Math.min(1, blinds * 1.4);
  const tilt = Math.max(0, (blinds - 0.7) / 0.3);
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      <Block size={[w + 0.14, h + 0.14, 0.06]} pos={[0, 0, -0.03]} color={frame} shadow={false} />
      <Panel w={w} h={h} pos={[0, 0, 0.005]} map={view} basic color={tod === 'day' ? '#ffffff' : '#dfe6ff'} />
      <Block size={[0.05, h, 0.03]} pos={[0, 0, 0.02]} color={frame} shadow={false} />
      {blinds > 0.001
        ? Array.from({ length: slats }, (_, i) => {
            const y = h / 2 - (i + 0.5) * (h / slats);
            if (h / 2 - y > drop) return null;
            return <Block key={i} size={[w + 0.06, 0.07, 0.012]} pos={[0, y, 0.06]} rot={[-0.9 + 0.9 * tilt, 0, 0]} color="#e6e2d8" rough={0.6} shadow={false} />;
          })
        : null}
      <Block size={[w + 0.24, 0.05, 0.14]} pos={[0, -h / 2 - 0.05, 0.05]} color="#ece6da" shadow={false} />
    </group>
  );
};

/** Ceiling light panel / tube: emissive by `level`, optional cold/warm tint. */
export const CeilingLight: React.FC<{ pos: V3t; w: number; d: number; level: number; color?: string }> = ({ pos, w, d, level, color = '#fff8e6' }) => (
  <group position={pos}>
    <Block size={[w + 0.08, 0.05, d + 0.08]} pos={[0, 0.01, 0]} color="#c9ccd1" shadow={false} />
    <mesh position={[0, -0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <planeGeometry args={[w, d]} />
      <meshBasicMaterial color={new THREE.Color(color).multiplyScalar(0.25 + 0.75 * Math.min(2.2, level))} toneMapped={false} />
    </mesh>
  </group>
);

export const Plant: React.FC<{ pos: V3t; s?: number; pot?: string }> = ({ pos, s = 1, pot = '#e96137' }) => (
  <group position={pos} scale={s}>
    <Cyl r={[0.22, 0.17]} h={0.42} pos={[0, 0.21, 0]} color={pot} seg={7} />
    {[0, 1, 2, 3].map((i) => (
      <mesh key={i} position={[Math.sin(i * 1.9) * 0.13, 0.6 + i * 0.2, Math.cos(i * 1.9) * 0.13]} castShadow>
        <icosahedronGeometry args={[0.27 - i * 0.04, 0]} />
        <meshStandardMaterial color={i % 2 ? '#5aa864' : '#478f52'} roughness={0.9} {...FLAT} />
      </mesh>
    ))}
  </group>
);

/** A soft practical glow (lamp shade, screen spill): additive sprite, fog-free. */
export const Glow: React.FC<{ pos: V3t; size: number; color: string; strength: number }> = ({ pos, size, color, strength }) => {
  const tex = usePainted(128, 128, (c) => {
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
  }, 'glow');
  if (strength <= 0.01) return null;
  return (
    <sprite position={pos} scale={[size, size, 1]}>
      <spriteMaterial map={tex} color={color} opacity={Math.min(1, strength)} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} transparent toneMapped={false} />
    </sprite>
  );
};

/** Floor with a painted tile / plank pattern. */
export function paintTiles(c: CanvasRenderingContext2D, w: number, h: number, a: string, b: string, n = 4): void {
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      c.fillStyle = (i + j) % 2 ? a : b;
      c.fillRect((i * w) / n, (j * h) / n, w / n, h / n);
    }
  c.strokeStyle = 'rgba(0,0,0,0.12)';
  c.lineWidth = 2;
  for (let i = 0; i <= n; i++) {
    c.beginPath();
    c.moveTo((i * w) / n, 0);
    c.lineTo((i * w) / n, h);
    c.stroke();
    c.beginPath();
    c.moveTo(0, (i * h) / n);
    c.lineTo(w, (i * h) / n);
    c.stroke();
  }
}

export function paintPlanks(c: CanvasRenderingContext2D, w: number, h: number, base: string, seed = 3): void {
  c.fillStyle = base;
  c.fillRect(0, 0, w, h);
  let r = seed;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  const rows = 8;
  for (let i = 0; i < rows; i++) {
    const y = (i * h) / rows;
    let x = -rnd() * w * 0.4;
    while (x < w) {
      const len = w * (0.3 + rnd() * 0.35);
      c.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${0.03 + rnd() * 0.05})`;
      c.fillRect(x, y, len, h / rows);
      c.fillStyle = 'rgba(0,0,0,0.18)';
      c.fillRect(x, y, 2, h / rows);
      x += len;
    }
    c.fillStyle = 'rgba(0,0,0,0.2)';
    c.fillRect(0, y, w, 2);
  }
}

export const Floor: React.FC<{ w: number; d: number; center?: [number, number]; paint: (c: CanvasRenderingContext2D, w: number, h: number) => void; paintKey: string; repeat?: number; rough?: number }> = ({ w, d, center = [0, 0], paint, paintKey, repeat = 3, rough = 0.8 }) => {
  const tex = usePainted(512, 512, paint, paintKey, [repeat, (repeat * d) / w]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[center[0], 0, center[1]]} receiveShadow>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial map={tex} roughness={rough} />
    </mesh>
  );
};

/** Four walls + ceiling of a box room; `open` removes the wall toward the camera (+z). */
export const Room: React.FC<{ x: [number, number]; z: [number, number]; h: number; wall: string; ceiling: string; trim?: string; open?: ('front' | 'back' | 'left' | 'right')[] }> = ({ x, z, h, wall, ceiling, trim, open = [] }) => {
  const W = x[1] - x[0];
  const D = z[1] - z[0];
  const cx = (x[0] + x[1]) / 2;
  const cz = (z[0] + z[1]) / 2;
  const mat = <meshStandardMaterial color={wall} roughness={0.95} {...FLAT} />;
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[cx, h, cz]}>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color={ceiling} roughness={1} {...FLAT} />
      </mesh>
      {!open.includes('back') ? (
        <mesh position={[cx, h / 2, z[0]]} receiveShadow>
          <planeGeometry args={[W, h]} />
          {mat}
        </mesh>
      ) : null}
      {!open.includes('front') ? (
        <mesh position={[cx, h / 2, z[1]]} rotation={[0, Math.PI, 0]} receiveShadow>
          <planeGeometry args={[W, h]} />
          {mat}
        </mesh>
      ) : null}
      {!open.includes('left') ? (
        <mesh position={[x[0], h / 2, cz]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
          <planeGeometry args={[D, h]} />
          {mat}
        </mesh>
      ) : null}
      {!open.includes('right') ? (
        <mesh position={[x[1], h / 2, cz]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
          <planeGeometry args={[D, h]} />
          {mat}
        </mesh>
      ) : null}
      {trim ? (
        <>
          {!open.includes('back') ? <Block size={[W, 0.12, 0.03]} pos={[cx, 0.06, z[0] + 0.015]} color={trim} shadow={false} /> : null}
          {!open.includes('left') ? <Block size={[0.03, 0.12, D]} pos={[x[0] + 0.015, 0.06, cz]} color={trim} shadow={false} /> : null}
          {!open.includes('right') ? <Block size={[0.03, 0.12, D]} pos={[x[1] - 0.015, 0.06, cz]} color={trim} shadow={false} /> : null}
        </>
      ) : null}
    </group>
  );
};

/** Painted wall sign / poster (harmless office signage, framed art). */
export function paintSign(c: CanvasRenderingContext2D, w: number, h: number, lines: string[], bg = '#fbfbf7', ink = '#23283b', accent = '#e96137'): void {
  c.fillStyle = bg;
  c.fillRect(0, 0, w, h);
  c.fillStyle = accent;
  c.fillRect(0, 0, w, h * 0.08);
  c.fillStyle = ink;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const size = Math.min(h / (lines.length + 1.5), w / 11);
  c.font = `bold ${size}px system-ui, sans-serif`;
  lines.forEach((l, i) => c.fillText(l, w / 2, h * 0.14 + (i + 1) * ((h * 0.86) / (lines.length + 1))));
}
