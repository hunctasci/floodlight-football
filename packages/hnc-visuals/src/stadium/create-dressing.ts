import * as THREE from 'three';

function headlessFlagTexture(): THREE.DataTexture {
  const data = new Uint8Array([16, 27, 49, 255]);
  const tex = new THREE.DataTexture(data, 1, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Flat retro supporter flag texture: team colour, cream border, navy-cut
 * label. Verbatim extraction from GameRenderer.flagTexture().
 */
export function hncFlagTexture(label: string, bg: string): THREE.CanvasTexture | THREE.DataTexture {
  if (typeof document === 'undefined') return headlessFlagTexture();
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = '#f8efdb';
  ctx.lineWidth = 10;
  ctx.strokeRect(6, 6, 244, 116);
  let size = 44;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const font = (s: number): string => `bold ${s}px Impact, 'Arial Black', sans-serif`;
  ctx.font = font(size);
  while (ctx.measureText(label).width > 200 && size > 18) {
    size -= 4;
    ctx.font = font(size);
  }
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#101b31';
  ctx.strokeText(label, 128, 66);
  ctx.fillStyle = '#f8efdb';
  ctx.fillText(label, 128, 66);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface HncDressingResult {
  group: THREE.Group;
  key: string;
  sectionL: THREE.Mesh;
  sectionR: THREE.Mesh;
  flags: THREE.Mesh[];
}

/**
 * Social-only stand dressing: two team-colour section banners + three flat
 * supporter flags. Verbatim geometry from ensureSocialDressing().
 */
export function createHncDressing(home: { name: string; color: string }, away: { name: string; color: string }): HncDressingResult {
  const group = new THREE.Group();
  group.name = 'hnc-dressing';
  const key = `${home.color}|${away.color}|${home.name}|${away.name}`;
  const sectionGeo = new THREE.PlaneGeometry(52, 0.36);
  const sectionL = new THREE.Mesh(sectionGeo, new THREE.MeshBasicMaterial({ color: home.color }));
  sectionL.position.set(-26, 1.32, -31.33);
  const sectionR = new THREE.Mesh(sectionGeo, new THREE.MeshBasicMaterial({ color: away.color }));
  sectionR.position.set(26, 1.32, -31.33);
  group.add(sectionL, sectionR);

  const flagGeo = new THREE.PlaneGeometry(4, 1.8);
  const defs = [
    { label: home.name.toUpperCase(), bg: home.color, x: -30 },
    { label: 'HNC LEAGUE', bg: '#101b31', x: 0 },
    { label: away.name.toUpperCase(), bg: away.color, x: 30 },
  ];
  const flags = defs.map((d, i) => {
    const f = new THREE.Mesh(
      flagGeo,
      new THREE.MeshBasicMaterial({ map: hncFlagTexture(d.label, d.bg) as THREE.Texture, side: THREE.DoubleSide }),
    );
    f.position.set(d.x, 4.9, -37.0);
    f.userData.baseY = 4.9;
    f.userData.phase = i * 2.1;
    group.add(f);
    return f;
  });
  return { group, key, sectionL, sectionR, flags };
}

/** Deterministic flag bob (social eruptions). Verbatim from applySocialCrowd(). */
export function hncUpdateDressingFlags(flags: THREE.Mesh[], time: number, intensity: number): void {
  const k = 0.4 + 0.6 * Math.min(1, Math.max(0, intensity));
  for (const f of flags) {
    const ph = f.userData.phase as number;
    f.position.y = (f.userData.baseY as number) + Math.sin(time * 2.4 + ph) * 0.14 * k;
    f.rotation.z = Math.sin(time * 2.0 + ph * 0.8) * 0.05 * k;
  }
}
