import * as THREE from 'three';

/**
 * Canonical goals + nets. Verbatim extraction of GameRenderer.buildGoals().
 * Back, roof and two sides only: the goal mouth remains physically and
 * visually open.
 */
export function createHncGoals(): THREE.Group[] {
  const postMat = new THREE.MeshStandardMaterial({ color: '#fffef4', roughness: 0.4 });
  const netMat = new THREE.LineBasicMaterial({ color: '#f2f7f2', transparent: true, opacity: 0.6 });
  const out: THREE.Group[] = [];
  for (const x of [-46, 46]) {
    const g = new THREE.Group();
    const d = x < 0 ? -1 : 1;
    const post = new THREE.CylinderGeometry(0.12, 0.12, 2.8, 10);
    for (const z of [-4.4, 4.4]) {
      const p = new THREE.Mesh(post, postMat);
      p.position.set(x, 1.4, z);
      p.castShadow = true;
      g.add(p);
    }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 9.0, 10), postMat);
    bar.rotation.x = Math.PI / 2;
    bar.position.set(x, 2.8, 0);
    bar.castShadow = true;
    g.add(bar);
    const lines: THREE.Vector3[] = [];
    const back = x + d * 2.2;
    for (let z = -4.4; z <= 4.401; z += 0.55) {
      lines.push(new THREE.Vector3(back, 0, z), new THREE.Vector3(back, 2.8, z));
    }
    for (let y = 0; y <= 2.801; y += 0.4) {
      lines.push(new THREE.Vector3(back, y, -4.4), new THREE.Vector3(back, y, 4.4));
      for (const z of [-4.4, 4.4]) lines.push(new THREE.Vector3(x, y, z), new THREE.Vector3(back, y, z));
    }
    for (let z = -4.4; z <= 4.401; z += 0.55)
      lines.push(new THREE.Vector3(x, 2.8, z), new THREE.Vector3(back, 2.8, z));
    const net = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lines), netMat);
    net.name = 'net';
    g.add(net);
    g.userData.side = x;
    out.push(g);
  }
  return out;
}
