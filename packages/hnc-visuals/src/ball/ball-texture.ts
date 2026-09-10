import * as THREE from 'three';

/**
 * Classic pentagon ball skin painted once onto a shared canvas texture.
 * Exact extraction from GameRenderer.ballTexture().
 */
let ballSkin: THREE.CanvasTexture | THREE.DataTexture | null = null;

export function hncBallTexture(): THREE.CanvasTexture | THREE.DataTexture {
  if (ballSkin) return ballSkin;
  if (typeof document === 'undefined') {
    const data = new Uint8Array([247, 243, 233, 255]);
    const tex = new THREE.DataTexture(data, 1, 1);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    ballSkin = tex;
    return tex;
  }
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#f7f3e9';
  ctx.fillRect(0, 0, 256, 128);
  const pentagon = (x: number, y: number, r: number): void => {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = '#1f3040';
    ctx.fill();
  };
  // Fixed spots read as a football from every broadcast angle.
  [
    [32, 32, 15],
    [96, 88, 16],
    [160, 30, 15],
    [224, 92, 16],
    [64, 104, 11],
    [192, 108, 11],
    [128, 60, 12],
    [0, 64, 12],
    [256, 64, 12],
  ].forEach(([x, y, r]) => pentagon(x, y, r));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  ballSkin = tex;
  return ballSkin;
}

/** Pentagon spot table (single source; texture + tests share it). */
export const HNC_BALL_PENTAGONS: ReadonlyArray<readonly [number, number, number]> = [
  [32, 32, 15],
  [96, 88, 16],
  [160, 30, 15],
  [224, 92, 16],
  [64, 104, 11],
  [192, 108, 11],
  [128, 60, 12],
  [0, 64, 12],
  [256, 64, 12],
];

/** Test hook: clear the cached skin. */
export function hncClearBallTextureCache(): void {
  ballSkin?.dispose?.();
  ballSkin = null;
}
