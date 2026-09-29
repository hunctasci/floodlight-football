import * as THREE from 'three';
import type { Lens, Vec3 } from '../worlds/types';

export interface ScreenPoint {
  x: number;
  y: number;
  /** In front of the lens and inside the frustum depth range. */
  visible: boolean;
  /** Distance from the lens (metres). */
  distance: number;
}

const cam = new THREE.PerspectiveCamera();
const v = new THREE.Vector3();

/**
 * Project a world point through a lens to composition pixels, so 2D layers
 * (trails, bursts, pinned text, blooms, screen insets) sit on the 3D action
 * without adding meshes to the canonical world. Pure for a given lens.
 * `lens.fov` must already be format-fitted (camera/evaluate shotLens).
 */
export function projectToScreen(lens: Lens, point: Vec3, width: number, height: number): ScreenPoint {
  cam.fov = lens.fov;
  cam.aspect = width / height;
  cam.near = 0.05;
  cam.far = 280;
  cam.position.set(lens.pos.x, lens.pos.y, lens.pos.z);
  cam.lookAt(lens.look.x, lens.look.y, lens.look.z);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  v.set(point.x, point.y, point.z);
  const distance = v.distanceTo(cam.position);
  v.project(cam);
  return {
    x: (v.x * 0.5 + 0.5) * width,
    y: (-v.y * 0.5 + 0.5) * height,
    visible: v.z > -1 && v.z < 1,
    distance,
  };
}
