import * as THREE from 'three';
import { createHncPitch } from './create-pitch.ts';
import { createHncGoals } from './create-goals.ts';
import { createHncStands, type AdBoardPainter } from './create-stands.ts';
import { createHncCrowd, type HncCrowdBase } from './create-crowd.ts';

export interface HncStadium {
  group: THREE.Group;
  pitch: THREE.Group;
  goals: THREE.Group[];
  goalNets: THREE.Group[];
  stands: THREE.Group;
  boards: THREE.Mesh[];
  crowd: THREE.Group;
  crowdMeshes: THREE.InstancedMesh[];
  crowdBase: HncCrowdBase[];
}

/**
 * ONE canonical HNC stadium: pitch + goals + stands + crowd.
 * Replaces the duplicated JSX recreation in the Reel Factory AND the inline
 * buildWorld()/buildStands() in the game (which now delegates here).
 *
 * No per-frame work: build once, mount, reuse. Dispose via disposeHncStadium().
 */
export function createHncStadium(paintBoard?: AdBoardPainter): HncStadium {
  const group = new THREE.Group();
  group.name = 'hnc-stadium';

  const pitch = createHncPitch();
  group.add(pitch);

  const goals = createHncGoals();
  for (const goal of goals) group.add(goal);

  const stands = createHncStands(paintBoard);
  group.add(stands.group);

  const crowd = createHncCrowd();
  group.add(crowd.group);

  return {
    group,
    pitch,
    goals,
    goalNets: goals,
    stands: stands.group,
    boards: stands.boards,
    crowd: crowd.group,
    crowdMeshes: crowd.meshes,
    crowdBase: crowd.base,
  };
}

export function disposeHncStadium(stadium: HncStadium): void {
  stadium.group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if ((mesh as THREE.Mesh).isMesh) {
      (mesh as THREE.Mesh).geometry?.dispose?.();
      const mat = (mesh as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose?.());
      else mat?.dispose?.();
    }
    const inst = obj as THREE.InstancedMesh;
    if ((inst as THREE.InstancedMesh).isInstancedMesh) {
      (inst as THREE.InstancedMesh).geometry?.dispose?.();
      const mat = (inst as THREE.InstancedMesh).material as THREE.Material | undefined;
      mat?.dispose?.();
      (inst as THREE.InstancedMesh).dispose?.();
    }
    const line = obj as THREE.Line;
    if ((line as THREE.Line).isLine) {
      (line as THREE.Line).geometry?.dispose?.();
      const mat = (line as THREE.Line).material as THREE.Material | undefined;
      mat?.dispose?.();
    }
  });
}
