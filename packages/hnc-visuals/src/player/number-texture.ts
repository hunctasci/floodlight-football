import * as THREE from 'three';

/**
 * Shared white-on-transparent shirt numbers 1..11 (one small canvas each).
 * Exact extraction from apps/game/src/renderer.ts numberTexture().
 *
 * Works headless: when `document` is unavailable (Node tests) a 1x1 white
 * DataTexture is returned so geometry/material tests stay meaningful.
 * Browser / Remotion always takes the canvas path (identical output).
 */
const numberTextures = new Map<number, THREE.CanvasTexture | THREE.DataTexture>();

export function hncNumberTexture(n: number): THREE.CanvasTexture | THREE.DataTexture {
  const cached = numberTextures.get(n);
  if (cached) return cached;
  if (typeof document === 'undefined') {
    const data = new Uint8Array([255, 255, 255, 255]);
    const tex = new THREE.DataTexture(data, 1, 1);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    numberTextures.set(n, tex);
    return tex;
  }
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.font = 'bold 44px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#182230';
  ctx.strokeText(String(n), 32, 34);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(String(n), 32, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  numberTextures.set(n, tex);
  return tex;
}

/** Test hook: how many number textures are cached. */
export function hncNumberTextureCacheSize(): number {
  return numberTextures.size;
}

/** Test hook: clear the cache (isolated structural tests). */
export function hncClearNumberTextureCache(): void {
  for (const tex of numberTextures.values()) tex.dispose();
  numberTextures.clear();
}
