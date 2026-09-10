import * as THREE from 'three';
import {
  END_STAND_ROWS,
  FAR_STAND_ROWS,
  endStandTerraceTop,
  farStandTerraceTop,
} from './constants.ts';

/**
 * Canonical stands: fascia, terraces, roof, rails, end terraces, floodlight
 * pylons, ad boards. Verbatim extraction of GameRenderer.buildStands()
 * (minus crowd + dressing, which live in create-crowd / create-dressing).
 *
 * Ad boards need canvas textures: pass paintAdBoard(slot) or accept the
 * default plain-navy boards headless (Node tests). Browser callers should
 * pass the game's LinkedIn/GitHub painter for full parity.
 */
export type AdBoardPainter = (slot: number) => THREE.Material;

function defaultBoardMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color: '#101b31' });
}

export interface HncStandsResult {
  group: THREE.Group;
  /** Board meshes in build order (tests can verify count/placement). */
  boards: THREE.Mesh[];
}

export function createHncStands(paintBoard?: AdBoardPainter): HncStandsResult {
  const g = new THREE.Group();
  g.name = 'hnc-stands';
  const concrete = new THREE.MeshStandardMaterial({ color: '#2c4d63', roughness: 1, flatShading: true });
  const concreteLight = new THREE.MeshStandardMaterial({ color: '#3d647e', roughness: 1, flatShading: true });
  const railMat = new THREE.MeshStandardMaterial({ color: '#dfe9f2', roughness: 0.6, flatShading: true });

  // Only the far stand + low end terraces are built: every camera preset
  // sits on +z looking toward -z, so a near-side stand would stand between
  // the camera and the near touchline and hide players in low angles.
  const fascia = new THREE.Mesh(new THREE.BoxGeometry(104, 1.1, 0.6), concrete);
  fascia.position.set(0, 0.55, -31.3);
  g.add(fascia);

  for (let r = 0; r < FAR_STAND_ROWS; r++) {
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(104, 0.4, 1.3),
      r % 2 === 0 ? concrete : concreteLight,
    );
    step.position.set(0, farStandTerraceTop(r) - 0.2, -32.0 - r * 1.1);
    g.add(step);
  }

  // Roof lip shading the top rows (lowered to match the new top row ~5.5m).
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(106, 0.5, 10),
    new THREE.MeshStandardMaterial({ color: '#1d3346', roughness: 1, flatShading: true }),
  );
  roof.position.set(0, 7.2, -35.5);
  g.add(roof);

  // Front + mid railings: two thin bars, no posts (keeps draw calls flat).
  for (const [ry, rz] of [[1.9, -31.4], [3.6, -34.7]] as const) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(104, 0.07, 0.07), railMat);
    rail.position.set(0, ry, rz);
    g.add(rail);
  }

  // Low end terraces behind each goal (5 rows).
  for (const side of [1, -1] as const) {
    const endFascia = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.1, 60), concrete);
    endFascia.position.set(side * 50.3, 0.55, 0);
    g.add(endFascia);
    for (let r = 0; r < END_STAND_ROWS; r++) {
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(1.3, 0.4, 60),
        r % 2 === 0 ? concrete : concreteLight,
      );
      step.position.set(side * (51.0 + r * 1.1), endStandTerraceTop(r) - 0.2, 0);
      g.add(step);
    }
  }

  // Floodlight pylons in the four corners: emissive heads, no real lights.
  const poleMat = new THREE.MeshStandardMaterial({ color: '#3a4350', roughness: 0.8, flatShading: true });
  const headMat = new THREE.MeshBasicMaterial({ color: '#fffbe8' });
  for (const px of [-58, 58])
    for (const pz of [-38, 38]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 20, 6), poleMat);
      pole.position.set(px, 10, pz);
      g.add(pole);
      const head = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.6, 0.6), headMat);
      head.position.set(px, 20.4, pz);
      head.lookAt(0, 0, 0);
      g.add(head);
    }

  // Pitch-side sponsor boards (9.6m x 1.15m, alternating slots).
  const boards: THREE.Mesh[] = [];
  for (const z of [-30.3, 30.3])
    for (let x = -40, i = 0; x < 40; x += 10, i++) {
      const mat = paintBoard ? paintBoard(i % 2) : defaultBoardMaterial();
      const b = new THREE.Mesh(new THREE.BoxGeometry(9.6, 1.15, 0.18), mat);
      b.position.set(x, 0.6, z);
      if (z < 0) b.rotation.y = Math.PI;
      g.add(b);
      boards.push(b);
    }

  return { group: g, boards };
}
