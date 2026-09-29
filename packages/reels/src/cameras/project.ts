import * as THREE from 'three';
import type { CameraPose } from './registry';

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
 * Project a world point through the shot camera to composition pixels, so
 * 2D effects (trails, impact bursts, flares) sit on the 3D action without
 * adding reel-only meshes to the canonical world. Pure: same pose + point
 * always yields the same pixel.
 */
export function projectToScreen(
  pose: CameraPose,
  point: { x: number; y: number; z: number },
  width: number,
  height: number,
): ScreenPoint {
  cam.fov = pose.fov;
  cam.aspect = width / height;
  cam.near = 0.1;
  cam.far = 280;
  cam.position.set(pose.pos[0], pose.pos[1], pose.pos[2]);
  cam.lookAt(pose.look[0], pose.look[1], pose.look[2]);
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
