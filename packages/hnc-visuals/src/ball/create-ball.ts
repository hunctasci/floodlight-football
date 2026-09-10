import * as THREE from 'three';
import { hncBallTexture } from './ball-texture.ts';

/** Canonical FIELD ball radius (apps/game/src/types.ts FIELD.ballRadius). */
export const HNC_BALL_RADIUS = 0.25;

export interface HncBallVisual {
  /** Group containing the leather (position this to move the ball). */
  root: THREE.Group;
  leather: THREE.Mesh;
  /** World-mounted contact shadow (position separately, like the game). */
  shadow: THREE.Mesh;
}

/**
 * SINGLE SOURCE OF TRUTH for the HNC ball.
 * Sphere(FIELD.ballRadius=0.25, 16, 12) + pentagon texture + roughness 0.55
 * + castShadow leather + Circle(0.31) #183d24 opacity-0.34 shadow.
 */
export function createHncBallVisual(): HncBallVisual {
  const root = new THREE.Group();
  const leather = new THREE.Mesh(
    new THREE.SphereGeometry(HNC_BALL_RADIUS, 16, 12),
    new THREE.MeshStandardMaterial({
      map: hncBallTexture() as THREE.Texture,
      roughness: 0.55,
      flatShading: false,
    }),
  );
  leather.castShadow = true;
  root.add(leather);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.31, 16),
    new THREE.MeshBasicMaterial({ color: '#183d24', transparent: true, opacity: 0.34 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.012;

  return { root, leather, shadow };
}

/** Roll the ball like the game loop (rotation from velocity, shadow scale). */
export function updateHncBallVisual(
  visual: HncBallVisual,
  x: number,
  y: number,
  z: number,
  vx: number,
  vz: number,
  dt: number,
): void {
  visual.root.position.set(x, Math.max(HNC_BALL_RADIUS, y), z);
  visual.root.rotation.x += vz * dt * 2;
  visual.root.rotation.z -= vx * dt * 2;
  visual.shadow.position.set(x, 0.015, z);
  visual.shadow.scale.setScalar(1 + Math.min(1, y) * 0.45);
}

export function disposeHncBallVisual(visual: HncBallVisual): void {
  visual.leather.geometry.dispose();
  (visual.leather.material as THREE.Material).dispose();
  visual.shadow.geometry.dispose();
  (visual.shadow.material as THREE.Material).dispose();
}
