import * as THREE from 'three';

/**
 * Canonical pitch: apron, grass, stripes, all markings.
 * Verbatim extraction of the pitch half of GameRenderer.buildWorld().
 */
export function createHncPitch(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'hnc-pitch';

  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 84),
    new THREE.MeshStandardMaterial({ color: '#2e7840', roughness: 1 }),
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -0.015;
  g.add(apron);

  const grass = new THREE.MeshStandardMaterial({ color: '#35a047', roughness: 1 });
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(94, 60), grass);
  pitch.rotation.x = -Math.PI / 2;
  pitch.receiveShadow = true;
  g.add(pitch);

  const stripeMat = new THREE.MeshBasicMaterial({ color: '#2c8340', transparent: true, opacity: 0.5 });
  for (let x = -40; x <= 40; x += 16) {
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(8, 58), stripeMat);
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(x, 0.006, 0);
    g.add(stripe);
  }

  const line = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const addLine = (x: number, z: number, sx: number, sz: number): void => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.025, sz), line);
    m.position.set(x, 0.026, z);
    g.add(m);
  };
  addLine(0, -29, 92, 0.16);
  addLine(0, 29, 92, 0.16);
  addLine(-46, 0, 0.16, 58);
  addLine(46, 0, 0.16, 58);
  addLine(0, 0, 0.12, 58);

  const circle = new THREE.Mesh(new THREE.RingGeometry(5.7, 5.87, 48), line);
  circle.rotation.x = -Math.PI / 2;
  circle.position.y = 0.028;
  g.add(circle);

  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.18, 12), line);
  dot.rotation.x = -Math.PI / 2;
  dot.position.y = 0.04;
  g.add(dot);

  for (const x of [-46, 46]) {
    const dir = Math.sign(x);
    // Penalty: 14 metres deep and 30 wide. Goal area: 5 deep and 14 wide.
    addLine(x - dir * 14, 0, 0.12, 30);
    addLine(x - dir * 7, -15, 14, 0.12);
    addLine(x - dir * 7, 15, 14, 0.12);
    addLine(x - dir * 5, 0, 0.12, 14);
    addLine(x - dir * 2.5, -7, 5, 0.12);
    addLine(x - dir * 2.5, 7, 5, 0.12);
    const spot = dot.clone();
    spot.position.set(x - dir * 11, 0.04, 0);
    g.add(spot);
    const points: THREE.Vector3[] = [];
    const start = x > 0 ? Math.PI / 2 : -Math.PI / 2;
    const end = x > 0 ? Math.PI * 1.5 : Math.PI / 2;
    for (let i = 0; i <= 24; i++) {
      const t = start + ((end - start) * i) / 24;
      points.push(new THREE.Vector3(x - dir * 11 + Math.cos(t) * 5.5, 0.045, Math.sin(t) * 5.5));
    }
    const arc = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: '#ffffff' }),
    );
    g.add(arc);
  }

  const centreDot = dot.clone();
  centreDot.position.set(0, 0.04, 0);
  g.add(centreDot);

  // Corner arcs: quarter-circles tucked into each corner flag.
  for (const cx of [-46, 46])
    for (const cz of [-29, 29]) {
      const pts: THREE.Vector3[] = [];
      const base = Math.atan2(-cz, -cx);
      for (let i = 0; i <= 10; i++) {
        const a = base - Math.PI / 4 + (i / 10) * (Math.PI / 2);
        pts.push(new THREE.Vector3(cx + Math.cos(a), 0.045, cz + Math.sin(a)));
      }
      g.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({ color: '#ffffff' }),
        ),
      );
    }

  return g;
}
