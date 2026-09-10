import * as THREE from 'three';
import {
  HNC_KEEPER_COLOR,
  HNC_SKIN_PALETTE,
  type CreateHncPlayerOptions,
  type HncPlayerVisual,
} from './types.ts';
import { hncNumberTexture } from './number-texture.ts';

/**
 * SINGLE SOURCE OF TRUTH for the HNC character.
 *
 * Exact extraction of GameRenderer.makeAvatar() from
 * apps/game/src/renderer.ts — same dimensions, same materials, same part
 * layout, same palette behaviour. Do NOT "improve" proportions here; any
 * visual change here changes BOTH the game and the Reels by design.
 *
 * Geometry recap (metres):
 * - body: Cylinder(0.38, 0.48, 0.85, 6) @ y=1.02 (kit)
 * - stripe: Cylinder(0.425, 0.465, 0.2, 6) @ y=1.28 (trim)
 * - number: Plane(0.52, 0.52) @ (0, 1.04, -0.44), rotY=PI (back)
 * - head: Icosahedron(0.32, 1) @ y=1.7 (skin palette id%4)
 * - hair: Sphere(0.325, 8, 5, 0, 2PI, 0, PI*0.42) @ y=1.81 (#28283b)
 * - eyes: Sphere(0.035, 5, 4) @ (±0.11, 1.72, 0.3) (#182230)
 * - limbs: Cylinder(0.115, 0.13, 0.67, 5); legs trim, arms kit
 *   legL (-0.2, 0.38, 0), legR (0.2, 0.38, 0),
 *   armL (-0.48, 1.08, 0), armR (0.48, 1.08, 0)
 * - boots: Box(0.17, 0.12, 0.32) @ (0, -0.33, 0.07) child of each leg
 * - shorts: Cylinder(0.47, 0.4, 0.27, 6) @ y=0.68 (trim)
 * - shadow: Circle(0.52, 12) #153a20 opacity 0.28 (world-mounted, NOT in root)
 */
export function createHncPlayerVisual(opts: CreateHncPlayerOptions): HncPlayerVisual {
  const { id, number, primary, secondary, keeper = false } = opts;
  const root = new THREE.Group();
  const kit = new THREE.Color(keeper ? HNC_KEEPER_COLOR : primary);
  const trim = new THREE.Color(secondary);

  const bodyMat = new THREE.MeshStandardMaterial({
    color: keeper ? HNC_KEEPER_COLOR : kit,
    roughness: 0.85,
    flatShading: true,
  });
  const skin = new THREE.MeshStandardMaterial({
    color: HNC_SKIN_PALETTE[((id % 4) + 4) % 4],
    roughness: 1,
    flatShading: true,
  });
  const dark = new THREE.MeshStandardMaterial({ color: '#28283b', flatShading: true });
  const bootMat = new THREE.MeshStandardMaterial({ color: '#14141c', roughness: 0.6, flatShading: true });

  // NOTE: the game adds the shadow to the SCENE (world space) and moves it
  // separately each frame. We return it alongside root; callers add both.
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.52, 12),
    new THREE.MeshBasicMaterial({ color: '#153a20', transparent: true, opacity: 0.28 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.014;

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.48, 0.85, 6), bodyMat);
  body.position.y = 1.02;
  root.add(body);

  // Chest stripe in trim colour: team identity readable from the side stands.
  const stripe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.425, 0.465, 0.2, 6),
    new THREE.MeshStandardMaterial({ color: trim, roughness: 0.9, flatShading: true }),
  );
  stripe.position.y = 1.28;
  root.add(stripe);

  // Shirt number on the back, facing away from the direction of play.
  const numMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.52, 0.52),
    new THREE.MeshBasicMaterial({ map: hncNumberTexture(number) as THREE.Texture, transparent: true }),
  );
  numMesh.position.set(0, 1.04, -0.44);
  numMesh.rotation.y = Math.PI;
  root.add(numMesh);

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 1), skin);
  head.position.y = 1.7;
  root.add(head);

  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.325, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.42),
    dark,
  );
  hair.position.y = 1.81;
  root.add(hair);

  const eyeMat = new THREE.MeshBasicMaterial({ color: '#182230' });
  for (const ex of [-0.11, 0.11]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 5, 4), eyeMat);
    eye.position.set(ex, 1.72, 0.3);
    root.add(eye);
  }

  const limb = (mat: THREE.Material): THREE.Mesh =>
    new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.13, 0.67, 5), mat);
  const boot = (): THREE.Mesh => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.12, 0.32), bootMat);
    b.position.set(0, -0.33, 0.07);
    return b;
  };
  const trimMat = new THREE.MeshStandardMaterial({ color: trim, roughness: 0.9, flatShading: true });
  const legL = limb(trimMat);
  const legR = limb(trimMat);
  const armL = limb(bodyMat);
  const armR = limb(bodyMat);
  legL.position.set(-0.2, 0.38, 0);
  legR.position.set(0.2, 0.38, 0);
  armL.position.set(-0.48, 1.08, 0);
  armR.position.set(0.48, 1.08, 0);
  legL.add(boot());
  legR.add(boot());
  root.add(legL, legR, armL, armR);

  const shorts = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.4, 0.27, 6), trimMat);
  shorts.position.y = 0.68;
  root.add(shorts);

  // Preserved verbatim: the game sets castShadow on the Group (no-op for
  // Groups, but kept so behaviour never diverges by "cleanup").
  (root as unknown as { castShadow: boolean }).castShadow = true;

  return {
    root,
    body,
    head,
    legL,
    legR,
    armL,
    armR,
    shadow,
    kit,
    trim,
    keeper,
    kitParts: [body, armL, armR],
    trimParts: [legL, legR, shorts, stripe],
    extras: [],
  };
}

/**
 * Re-kit an existing visual (per-frame team colour updates in the game loop).
 * Mirrors GameRenderer.ensureAvatars() exactly.
 */
export function rekitHncPlayerVisual(visual: HncPlayerVisual, primary: string, secondary: string): void {
  const kit = visual.keeper ? HNC_KEEPER_COLOR : primary;
  for (const m of visual.kitParts) (m.material as THREE.MeshStandardMaterial).color.set(kit);
  for (const m of visual.trimParts) (m.material as THREE.MeshStandardMaterial).color.set(secondary);
  visual.kit.set(kit);
  visual.trim.set(secondary);
}

/** Dispose geometries/materials owned by one player visual (R3F unmount). */
export function disposeHncPlayerVisual(visual: HncPlayerVisual): void {
  visual.root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.geometry?.dispose?.();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose?.());
      else mat?.dispose?.();
    }
  });
  visual.shadow.geometry.dispose();
  (visual.shadow.material as THREE.Material).dispose();
}
