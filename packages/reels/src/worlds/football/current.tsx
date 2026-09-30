import React from 'react';
import * as THREE from 'three';
import { HNC_PITCH, hncFanSection, type HncCrowdBase, type HncPlayerVisual } from '@floodlight/hnc-visuals';
import { rgb01 } from '../../effects/current';
import { random01 } from '../../utils/rng';

/**
 * THE CURRENT — world-side VFX for the football world (anime tribute).
 *
 *   AuraShell    inverted-hull shells around a canonical player's own meshes
 *                (additive fresnel + rising noise) plus rising motes
 *   CurrentLines the canonical pitch markings carry a flowing glow front
 *   CrowdCurrent thousands of lights in one end, pulsing on the beat
 *
 * Presentation only: shells share the canonical geometry (never new body
 * parts), lines follow HNC_PITCH, lights sit on the canonical crowd spots.
 * Everything is a pure function of the time passed in.
 */

const noiseGlsl = /* glsl */ `
  float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float noise(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
`;

function auraMaterial(): THREE.ShaderMaterial {
  const m = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color('#ffffff') }, uTime: { value: 0 }, uLevel: { value: 0 }, uLayer: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vec4 mv = viewMatrix * w;
        vV = normalize(-mv.xyz);
        vN = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uTime; uniform float uLevel; uniform float uLayer;
      varying vec3 vN; varying vec3 vV; varying vec3 vW;
      ${noiseGlsl}
      void main() {
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.4);
        float n = noise(vec3(vW.x * 3.1, vW.y * 2.3 - uTime * (3.2 + uLayer * 1.6), vW.z * 3.1 + uLayer * 7.0));
        float flame = smoothstep(0.28, 0.85, n * 0.85 + f * 0.45);
        // Mostly silhouette: the hull's own face-on area stays faint so the kit reads through.
        float a = uLevel * (0.06 + 1.05 * f * f) * flame * (uLayer > 0.5 ? 0.6 : 0.8);
        vec3 col = mix(uColor, vec3(1.0), 0.18 + 0.3 * flame * (1.0 - uLayer));
        gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.BackSide,
  });
  m.toneMapped = false;
  return m;
}

/** Radial sprite (motes, crowd lights). */
const dotTexture = (() => {
  let tex: THREE.CanvasTexture | undefined;
  return (): THREE.CanvasTexture => {
    if (tex) return tex;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.25, 'rgba(255,255,255,0.8)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
    tex = new THREE.CanvasTexture(c);
    return tex;
  };
})();

interface Shell {
  materials: THREE.ShaderMaterial[];
  meshes: THREE.Mesh[];
}

/** Two shell layers per canonical mesh (eyes and the number decal excluded). */
function buildShell(v: HncPlayerVisual): Shell {
  const skip = new Set<THREE.Object3D>(v.eyes ?? []);
  const inner = auraMaterial();
  const outer = auraMaterial();
  outer.uniforms.uLayer.value = 1;
  const meshes: THREE.Mesh[] = [];
  const sources: THREE.Mesh[] = [];
  v.root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && !skip.has(m) && m.geometry.type !== 'PlaneGeometry' && m.geometry.attributes.normal) sources.push(m);
  });
  for (const src of sources) {
    src.geometry.computeBoundingBox();
    const c = src.geometry.boundingBox!.getCenter(new THREE.Vector3());
    for (const [mat, s] of [[inner, 1.1], [outer, 1.3]] as const) {
      const shell = new THREE.Mesh(src.geometry, mat);
      shell.name = 'aura-shell';
      shell.scale.setScalar(s);
      shell.position.copy(c).multiplyScalar(1 - s);
      shell.castShadow = false;
      shell.receiveShadow = false;
      shell.renderOrder = 5;
      shell.visible = false;
      src.add(shell);
      meshes.push(shell);
    }
  }
  return { materials: [inner, outer], meshes };
}

const MOTES = 70;

/** Aura + motes on one canonical player. `level` 0 hides it. */
export const AuraShell: React.FC<{ visual: HncPlayerVisual; level: number; color: string; time: number; seed: number; darkness?: number }> = ({ visual, level, color, time, seed, darkness = 0 }) => {
  const shell = React.useMemo(() => buildShell(visual), [visual]);
  React.useEffect(
    () => () => {
      shell.meshes.forEach((m) => m.parent?.remove(m));
      shell.materials.forEach((m) => m.dispose());
    },
    [shell],
  );
  const motes = React.useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MOTES * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MOTES * 3), 3));
    const m = new THREE.PointsMaterial({ size: 0.075, map: dotTexture(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
    m.toneMapped = false;
    return new THREE.Points(g, m);
  }, []);
  React.useEffect(() => () => {
    motes.geometry.dispose();
    (motes.material as THREE.Material).dispose();
  }, [motes]);
  const [r, g, b] = rgb01(color);
  shell.meshes.forEach((m) => (m.visible = level > 0.001));
  for (const m of shell.materials) {
    m.uniforms.uColor.value.setRGB(r, g, b);
    m.uniforms.uTime.value = time;
    m.uniforms.uLevel.value = level;
  }
  // Motes rise around the player's root (world space), density with level.
  const pos = motes.geometry.attributes.position as THREE.BufferAttribute;
  const col = motes.geometry.attributes.color as THREE.BufferAttribute;
  const root = visual.root.position;
  for (let i = 0; i < MOTES; i++) {
    const a = random01(seed, `mote-a-${i}`) * Math.PI * 2;
    const rad = 0.3 + 0.55 * random01(seed, `mote-r-${i}`);
    const speed = 0.5 + 0.9 * random01(seed, `mote-s-${i}`);
    const life = 2.3;
    const y = (time * speed + random01(seed, `mote-p-${i}`) * life) % life;
    const on = i / MOTES < level ? 1 : 0;
    const fade = on * Math.sin((Math.PI * y) / life);
    const swirl = a + time * 0.6;
    pos.setXYZ(i, root.x + Math.cos(swirl) * rad, root.y + 0.1 + y, root.z + Math.sin(swirl) * rad);
    col.setXYZ(i, (r * 0.7 + 0.3) * fade, (g * 0.7 + 0.3) * fade, (b * 0.7 + 0.3) * fade);
  }
  pos.needsUpdate = true;
  col.needsUpdate = true;
  if (level <= 0.001) return null;
  // The Current lights its owner: a small key in front of the face (reads in a blackout).
  const ry = visual.root.rotation.y;
  return (
    <>
      <primitive object={motes} />
      <pointLight position={[root.x + Math.sin(ry) * 0.9, root.y + 1.5, root.z + Math.cos(ry) * 0.9]} color={color} intensity={level * 7 * (0.08 + 0.92 * darkness)} distance={4} decay={2} />
    </>
  );
};

// --- Current lines -------------------------------------------------------------

type P2 = [number, number];

/** The canonical markings as polylines (HNC_PITCH; mirrors create-pitch.ts). */
function pitchPolylines(): P2[][] {
  const P = HNC_PITCH;
  const L = P.halfLength;
  const W = P.halfWidth;
  const lines: P2[][] = [
    [[-L, -W], [L, -W]],
    [[-L, W], [L, W]],
    [[-L, -W], [-L, W]],
    [[L, -W], [L, W]],
    [[0, -W], [0, W]],
  ];
  const circle: P2[] = [];
  for (let i = 0; i <= 48; i++) circle.push([Math.cos((i / 48) * Math.PI * 2) * 5.78, Math.sin((i / 48) * Math.PI * 2) * 5.78]);
  lines.push(circle);
  for (const s of [-1, 1]) {
    const x = s * L;
    const box = x - s * P.penaltyLength;
    const area = x - s * P.goalAreaLength;
    lines.push([[x, -P.penaltyHalfWidth], [box, -P.penaltyHalfWidth], [box, P.penaltyHalfWidth], [x, P.penaltyHalfWidth]]);
    lines.push([[x, -P.goalAreaHalfWidth], [area, -P.goalAreaHalfWidth], [area, P.goalAreaHalfWidth], [x, P.goalAreaHalfWidth]]);
    const arc: P2[] = [];
    const start = s > 0 ? Math.PI / 2 : -Math.PI / 2;
    for (let i = 0; i <= 24; i++) {
      const t = start + (Math.PI * i) / 24;
      arc.push([x - s * P.penaltySpotDist + Math.cos(t) * P.arcRadius, Math.sin(t) * P.arcRadius]);
    }
    lines.push(arc);
  }
  return lines;
}

/** Ribbon geometry (core + glow widths) over every marking, subdivided every ~0.5 m. */
function ribbonGeometry(width: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  const across: number[] = [];
  for (const line of pitchPolylines()) {
    const pts: P2[] = [];
    for (let i = 0; i < line.length - 1; i++) {
      const [a, b] = [line[i], line[i + 1]];
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.5));
      for (let k = 0; k < n; k++) pts.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
    }
    pts.push(line[line.length - 1]);
    const base = pos.length / 3;
    pts.forEach((p, i) => {
      const q = pts[Math.min(pts.length - 1, i + 1)];
      const o = pts[Math.max(0, i - 1)];
      const dx = q[0] - o[0];
      const dz = q[1] - o[1];
      const l = Math.hypot(dx, dz) || 1;
      const nx = (-dz / l) * width * 0.5;
      const nz = (dx / l) * width * 0.5;
      pos.push(p[0] + nx, 0.07, p[1] + nz, p[0] - nx, 0.07, p[1] - nz);
      across.push(1, -1);
      if (i < pts.length - 1) idx.push(base + i * 2, base + i * 2 + 1, base + i * 2 + 2, base + i * 2 + 1, base + i * 2 + 3, base + i * 2 + 2);
    });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('across', new THREE.Float32BufferAttribute(across, 1));
  g.setIndex(idx);
  return g;
}

export interface CurrentSources {
  /** Home current flows in from the +x end (the home fans' end). */
  home: boolean;
  away: boolean;
  /** Optional point source (x, z) instead of the ends (home colour). */
  point?: { x: number; z: number };
}

function linesMaterial(glow: boolean): THREE.ShaderMaterial {
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uHome: { value: new THREE.Color() },
      uAway: { value: new THREE.Color() },
      uFront: { value: 0 },
      uLevel: { value: 0 },
      uTime: { value: 0 },
      uMode: { value: 0 },
      uPoint: { value: new THREE.Vector2() },
      uGlow: { value: glow ? 1 : 0 },
    },
    vertexShader: /* glsl */ `
      attribute float across; varying float vAcross; varying vec2 vXZ;
      void main() { vAcross = across; vXZ = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uHome; uniform vec3 uAway; uniform float uFront; uniform float uLevel; uniform float uTime; uniform float uMode; uniform vec2 uPoint; uniform float uGlow;
      varying float vAcross; varying vec2 vXZ;
      void main() {
        // uMode 0: both ends meet at halfway; 1: home only from +x; 2: away only from -x; 3: from a point.
        bool homeSide = uMode == 1.0 || uMode == 3.0 || (uMode == 0.0 && vXZ.x >= 0.0);
        float d = uMode == 3.0 ? distance(vXZ, uPoint) : (homeSide ? 46.0 - vXZ.x : vXZ.x + 46.0);
        float behind = uFront - d;
        if (behind < 0.0) discard;
        float head = exp(-pow(behind / 1.6, 2.0));
        float tail = 0.32 + 0.68 * exp(-behind / 9.0);
        float flicker = 0.82 + 0.18 * sin(uTime * 37.0 + d * 1.7);
        // smoothstep needs edge0 < edge1 (reversed edges are undefined in GLSL).
        float edge = uGlow > 0.5 ? pow(1.0 - abs(vAcross), 1.6) : 1.0 - smoothstep(0.35, 1.0, abs(vAcross));
        float meet = uMode == 0.0 ? exp(-pow(vXZ.x / 0.9, 2.0)) * smoothstep(40.0, 46.0, uFront) * 2.2 : 0.0;
        float a = uLevel * edge * (tail * flicker + head * 1.8 + meet) * (uGlow > 0.5 ? 0.6 : 1.0);
        vec3 c = homeSide ? uHome : uAway;
        c = mix(c, vec3(1.0), clamp(head * 0.55 + meet * 0.4, 0.0, 1.0) * (1.0 - uGlow * 0.6));
        // AdditiveBlending multiplies by alpha itself: output straight colour.
        gl_FragColor = vec4(c, clamp(a, 0.0, 1.0));
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    // Ribbon winding depends on each marking's direction: draw both faces.
    side: THREE.DoubleSide,
  });
  m.toneMapped = false;
  return m;
}

/** Glowing Current flowing along the canonical pitch markings. */
export const CurrentLines: React.FC<{ level: number; front: number; time: number; sources: CurrentSources; home: string; away: string }> = ({ level, front, time, sources, home, away }) => {
  const parts = React.useMemo(() => {
    const core = new THREE.Mesh(ribbonGeometry(0.55), linesMaterial(false));
    const glow = new THREE.Mesh(ribbonGeometry(3.2), linesMaterial(true));
    core.renderOrder = 4;
    glow.renderOrder = 3;
    return [core, glow];
  }, []);
  React.useEffect(() => () => parts.forEach((p) => {
    p.geometry.dispose();
    (p.material as THREE.Material).dispose();
  }), [parts]);
  const mode = sources.point ? 3 : sources.home && sources.away ? 0 : sources.home ? 1 : 2;
  for (const p of parts) {
    const u = (p.material as THREE.ShaderMaterial).uniforms;
    u.uHome.value.setRGB(...rgb01(home));
    u.uAway.value.setRGB(...rgb01(away));
    u.uFront.value = front;
    u.uLevel.value = level;
    u.uTime.value = time;
    u.uMode.value = mode;
    if (sources.point) u.uPoint.value.set(sources.point.x, sources.point.z);
  }
  if (level <= 0.001) return null;
  return (
    <>
      {parts.map((p, i) => (
        <primitive key={i} object={p} />
      ))}
    </>
  );
};

// --- Crowd current ----------------------------------------------------------------

/** One light per canonical fan of a section (0: x<0, 1: x>0), pulsing on the beat. */
export const CrowdCurrent: React.FC<{ base: HncCrowdBase[]; section: 0 | 1; level: number; color: string; time: number; bpm: number; seed: number }> = ({ base, section, level, color, time, bpm, seed }) => {
  const fans = React.useMemo(() => base.filter((b) => hncFanSection(b.x) === section), [base, section]);
  const points = React.useMemo(() => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(fans.length * 3);
    fans.forEach((b, i) => p.set([b.x + (random01(seed, `cc-x-${i}`) - 0.5) * 0.5, b.y + 0.45, b.z + (random01(seed, `cc-z-${i}`) - 0.5) * 0.3], i * 3));
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(fans.length * 3), 3));
    const m = new THREE.PointsMaterial({ size: 1.5, map: dotTexture(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, fog: false });
    m.toneMapped = false;
    return new THREE.Points(g, m);
  }, [fans, seed]);
  React.useEffect(() => () => {
    points.geometry.dispose();
    (points.material as THREE.Material).dispose();
  }, [points]);
  if (level <= 0.001) return null;
  const [r, g, b] = rgb01(color);
  const beat = (time * bpm) / 60;
  const pulse = 0.62 + 0.38 * Math.pow(1 - (beat % 1), 3);
  const col = points.geometry.attributes.color as THREE.BufferAttribute;
  fans.forEach((_, i) => {
    // Lights come on in a wave from the front rows, then twinkle.
    const on = Math.min(1, Math.max(0, level * 1.6 - random01(seed, `cc-on-${i}`) * 0.6));
    const tw = 0.75 + 0.25 * Math.sin(time * (2 + 3 * random01(seed, `cc-t-${i}`)) + i);
    const k = on * tw * pulse;
    col.setXYZ(i, r * k * 1.4, g * k * 1.4, b * k * 1.4);
  });
  col.needsUpdate = true;
  return <primitive object={points} />;
};
