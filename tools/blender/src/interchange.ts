import * as THREE from 'three';
import {
  HNC_SKIN_PALETTE,
  applyHncProportions,
  applyHncWardrobe,
  createHncBallVisual,
  createHncGoals,
  createHncPlayerVisual,
  type HncPlayerVisual,
  type HncProportionsId,
  type HncWardrobeId,
} from '@floodlight/hnc-visuals';
import { getCountry } from '../../../apps/game/src/city-league/countries.ts';

/**
 * HNC → GLB interchange layer (the ONLY place that adapts canonical
 * @floodlight/hnc-visuals objects for Blender).
 *
 * It never builds geometry: it calls the canonical factories, clones the
 * resulting THREE objects and only (a) names them, (b) drops vertex normals
 * on flat-shaded parts, (c) attaches provenance as glTF extras.
 *
 * Coordinate contract (see social/blender/README.md):
 *   HNC/Three: right-handed, Y-up, metres, characters face +Z, origin on the ground.
 *   GLB:       identical (glTF is Y-up, asset front = +Z) → NO transform is applied.
 *   Blender:   the glTF importer converts (x, y, z) → (x, -z, y); the character
 *              faces -Y (Blender "front"). No other code may rotate assets.
 *
 * Flat shading: glTF has no flatShading flag and GLTFExporter writes the
 * smooth vertex normals, so Blender would round off the low-poly look.
 * Omitting NORMAL is the glTF-spec way to request flat normals; Blender's
 * importer marks such faces sharp (io_scene_gltf2 mesh.py set_poly_smoothing).
 */

/**
 * `verification` assets are imported into the parity scene and checked by
 * `blender:verify`; `cast` assets are extra identities for plates, checked by
 * the same inspection when a plate imports them.
 */
export type HncExportPurpose = 'verification' | 'cast';

/**
 * A player fixture is one canonical build. Optional fields only change what
 * the canonical helpers already support: `look` = applyHncWardrobe(),
 * `proportions` = applyHncProportions(), `tag` = a unique Blender prefix for
 * people who are not a numbered player (family, supporters).
 */
export interface HncPlayerFixture {
  kind: 'player';
  assetId: string;
  country: string;
  number: number;
  id: number;
  keeper: boolean;
  purpose: HncExportPurpose;
  look?: HncWardrobeId;
  accent?: string;
  proportions?: HncProportionsId;
  tag?: string;
}

export type HncExportFixture =
  | HncPlayerFixture
  | { kind: 'ball'; assetId: string; purpose: HncExportPurpose }
  | { kind: 'goal'; assetId: string; purpose: HncExportPurpose };

/** TR #9 = the recurring cast member "Emre"; GR #4 Nikos and GR #1 Petros (keeper) star in plates. */
export const HNC_EXPORT_FIXTURES: readonly HncExportFixture[] = [
  { kind: 'player', assetId: 'hnc-player-tr-09', country: 'TR', number: 9, id: 9, keeper: false, purpose: 'verification' },
  { kind: 'ball', assetId: 'hnc-ball', purpose: 'verification' },
  { kind: 'player', assetId: 'hnc-player-gr-04', country: 'GR', number: 4, id: 4, keeper: false, purpose: 'cast' },
  { kind: 'player', assetId: 'hnc-player-gr-01-keeper', country: 'GR', number: 1, id: 1, keeper: true, purpose: 'cast' },
  { kind: 'goal', assetId: 'hnc-goal', purpose: 'cast' },
  // HNC Player Diaries (social/player-diaries/CAST.md): TR #9 off the pitch + his world.
  // Same person as hnc-player-tr-09 (id 9 → skin 1); only the wardrobe changes.
  { kind: 'player', assetId: 'hnc-player-tr-09--tee', country: 'TR', number: 9, id: 9, keeper: false, purpose: 'cast', look: 'tee', accent: '#e4ded2' },
  { kind: 'player', assetId: 'hnc-player-tr-09--hoodie', country: 'TR', number: 9, id: 9, keeper: false, purpose: 'cast', look: 'hoodie', accent: '#2c313b' },
  { kind: 'player', assetId: 'hnc-player-tr-09--interview', country: 'TR', number: 9, id: 9, keeper: false, purpose: 'cast', look: 'tee', accent: '#2a2d33' },
  { kind: 'player', assetId: 'hnc-player-tr-09--travel', country: 'TR', number: 9, id: 9, keeper: false, purpose: 'cast', look: 'hoodie', accent: '#b3121b' },
  { kind: 'player', assetId: 'hnc-player-tr-01-keeper', country: 'TR', number: 1, id: 1, keeper: true, purpose: 'cast' },
  // TR-FAMILY-CHILD-01 shares #9's skin (id 5 → skin 1); child proportions. Wears Dad's #9 from the evening on.
  { kind: 'player', assetId: 'hnc-family-tr-child-01--tee', country: 'TR', number: 9, id: 5, keeper: false, purpose: 'cast', look: 'tee', accent: '#f0b429', proportions: 'child', tag: 'TRCH' },
  { kind: 'player', assetId: 'hnc-family-tr-child-01--kit', country: 'TR', number: 9, id: 5, keeper: false, purpose: 'cast', look: 'replica', proportions: 'child', tag: 'TRCH' },
  // TR-FAMILY-PARTNER-01 (id 6 → skin 2).
  { kind: 'player', assetId: 'hnc-family-tr-partner-01', country: 'TR', number: 6, id: 6, keeper: false, purpose: 'cast', look: 'tee-bun', accent: '#6f8f7a', tag: 'TRPT' },
  // TR-SUPPORTER-ELDER-01, the bakery regular (id 12 → skin 0).
  { kind: 'player', assetId: 'hnc-supporter-tr-elder-01', country: 'TR', number: 12, id: 12, keeper: false, purpose: 'cast', look: 'elder', tag: 'TREL' },
  // Matchday crowd: one TR and one BE supporter build, instanced by the set.
  { kind: 'player', assetId: 'hnc-fan-tr', country: 'TR', number: 2, id: 3, keeper: false, purpose: 'cast', look: 'fan', tag: 'TRFN' },
  { kind: 'player', assetId: 'hnc-fan-be', country: 'BE', number: 2, id: 2, keeper: false, purpose: 'cast', look: 'fan', tag: 'BEFN' },
  // Player Diaries "One Goal Between Us": BE #4 (the campaign's Lucas), and both rivals as kids in 2000.
  { kind: 'player', assetId: 'hnc-player-be-04', country: 'BE', number: 4, id: 4, keeper: false, purpose: 'cast' },
  { kind: 'player', assetId: 'hnc-player-be-04--interview', country: 'BE', number: 4, id: 4, keeper: false, purpose: 'cast', look: 'tee', accent: '#1d2433' },
  // Same identities (id 9 / id 4 → same skin) at child proportions, in replica shirts: TR #9 aged 4, BE #4 aged 6.
  { kind: 'player', assetId: 'hnc-player-tr-09--kid', country: 'TR', number: 9, id: 9, keeper: false, purpose: 'cast', look: 'replica', proportions: 'child', tag: 'TR9K' },
  { kind: 'player', assetId: 'hnc-player-be-04--kid', country: 'BE', number: 4, id: 4, keeper: false, purpose: 'cast', look: 'replica', proportions: 'child', tag: 'BE4K' },
  // TR #9's late father in 2000 (id 17 → skin 1, his son's), a fan's replica + scarf; BE #4's mum (id 10 → skin 2).
  { kind: 'player', assetId: 'hnc-family-tr-father-01', country: 'TR', number: 9, id: 17, keeper: false, purpose: 'cast', look: 'fan', tag: 'TRFA' },
  { kind: 'player', assetId: 'hnc-family-be-mum-01', country: 'BE', number: 2, id: 10, keeper: false, purpose: 'cast', look: 'tee-bun', accent: '#c9a227', tag: 'BEMU' },
  // The 1957 newsreel: two players of the era who are neither of our rivals (their own numbers, their own faces).
  { kind: 'player', assetId: 'hnc-player-tr-10', country: 'TR', number: 10, id: 10, keeper: false, purpose: 'cast' },
  { kind: 'player', assetId: 'hnc-player-be-10', country: 'BE', number: 10, id: 10, keeper: false, purpose: 'cast' },
  // HNC Player Diaries Italy rematch: original fictional Italy #8 midfielder.
  // Uses the shared IT country palette and canonical player factory; no official marks.
  { kind: 'player', assetId: 'hnc-player-it-08', country: 'IT', number: 8, id: 8, keeper: false, purpose: 'cast' },
];

export interface HncExpectedMaterial {
  name: string;
  /** Linear-RGB base colour as written to glTF baseColorFactor. */
  baseColorLinear: [number, number, number];
  /** The canonical sRGB hex authored in hnc-visuals / country colours. */
  baseColorHex: string;
  roughness: number | null;
  metalness: number | null;
  unlit: boolean;
  transparent: boolean;
  flatShading: boolean;
  map: { width: number; height: number } | null;
}

export interface HncExpectedNode {
  name: string;
  parent: string | null;
  /** Canonical handle / role this node came from (e.g. `legL`, `hair`). */
  part: string;
  mesh: boolean;
  material: string | null;
  vertices: number;
  triangles: number;
  hasNormals: boolean;
  /** Triangles whose vertex normals differ from the face normal (Blender marks exactly these smooth). */
  smoothTriangles?: number;
  /** Line segments (goal nets: glTF LINES primitives). */
  lines?: number;
  /** World-space origin in HNC/glTF coordinates (Y-up). */
  worldPosition: [number, number, number];
  /** World-space AABB in HNC/glTF coordinates (Y-up). */
  worldMin: [number, number, number] | null;
  worldMax: [number, number, number] | null;
  /** Share of triangles facing away from the part's vertex centroid (1 for convex parts; tori are lower). */
  outward?: number;
  /** Local scale in HNC/glTF axes (non-unit only for re-proportioned characters, e.g. the child). */
  scale: [number, number, number];
}

export interface HncExpected {
  root: string;
  nodes: HncExpectedNode[];
  materials: HncExpectedMaterial[];
  /** Whole-asset world AABB in HNC/glTF coordinates. */
  boundsMin: [number, number, number];
  boundsMax: [number, number, number];
}

export interface HncExportBuild {
  root: THREE.Object3D;
  params: Record<string, string | number | boolean>;
  sourceFactory: string;
  expected: HncExpected;
}

type Role = { name: string; part: string };

/** Two-digit player tag, e.g. TR + 9 → "TR09" (unique Blender names per player). */
export function playerTag(country: string, number: number): string {
  return `${country}${String(number).padStart(2, '0')}`;
}

/**
 * Semantic names for the canonical handles. Blender's .L/.R means the
 * character's ANATOMICAL side; the character faces +Z, so its left is +X.
 * The canonical `legL`/`armL` sit at -X (viewer's left from the front) and
 * are therefore anatomical RIGHT. `part` keeps the canonical handle name.
 */
export function playerRoles(v: HncPlayerVisual, tag: string): Map<THREE.Object3D, Role> {
  const hair = v.head.children.find((c) => !v.eyes?.includes(c as THREE.Mesh));
  const numberMesh = v.root.children.find(
    (c) => (c as THREE.Mesh).isMesh && (c as THREE.Mesh).geometry.type === 'PlaneGeometry',
  );
  const [shorts, stripe] = [v.trimParts[2], v.trimParts[3]];
  const entries: [THREE.Object3D | undefined, string, string][] = [
    [v.root, `HNC_Player_${tag.slice(0, 2)}_${tag.slice(2)}`, 'root'],
    [v.body, 'Body', 'body'],
    [stripe, 'ChestStripe', 'stripe'],
    [numberMesh, 'ShirtNumber', 'number'],
    [v.head, 'Head', 'head'],
    [hair, 'Hair', 'hair'],
    [v.eyes?.[0], 'Eye.R', 'eyes[0]'],
    [v.eyes?.[1], 'Eye.L', 'eyes[1]'],
    [v.legL, 'Leg.R', 'legL'],
    [v.legR, 'Leg.L', 'legR'],
    [v.legL.children[0], 'Boot.R', 'legL.boot'],
    [v.legR.children[0], 'Boot.L', 'legR.boot'],
    [v.armL, 'Arm.R', 'armL'],
    [v.armR, 'Arm.L', 'armR'],
    [shorts, 'Shorts', 'shorts'],
  ];
  const roles = new Map<THREE.Object3D, Role>();
  for (const [obj, name, part] of entries) {
    if (!obj) throw new Error(`hnc-visuals structure changed: missing ${part} — update interchange roles`);
    roles.set(obj, { name: part === 'root' ? name : `${tag}.${name}`, part });
  }
  // Wardrobe accessories (applyHncWardrobe names them); scarf pieces etc. ride on root or head.
  v.extras.forEach((e, i) => {
    const handle = e.name || `extra${i}`;
    roles.set(e, { name: `${tag}.Wear.${handle}`, part: `extras.${handle}` });
  });
  let count = 0;
  v.root.traverse(() => count++);
  if (count !== roles.size) {
    throw new Error(`hnc-visuals player has ${count} nodes but ${roles.size} are named — update interchange roles`);
  }
  return roles;
}

/** Material names keyed by the canonical material instance. */
function playerMaterialNames(v: HncPlayerVisual, country: string, number: number, skinIndex: number, look?: string): Map<THREE.Material, string> {
  const mat = (o: THREE.Object3D | undefined): THREE.Material => (o as THREE.Mesh).material as THREE.Material;
  const hair = v.head.children.find((c) => !v.eyes?.includes(c as THREE.Mesh));
  const numberMesh = v.root.children.find((c) => (c as THREE.Mesh).geometry?.type === 'PlaneGeometry');
  // Recoloured wardrobe materials carry the look so two looks never share a name.
  const w = look && look !== 'footballer' ? `--${look}` : '';
  const names = new Map<THREE.Material, string>([
    [mat(v.body), `HNC_Kit_${v.keeper ? 'Keeper' : country}${w}`],
    [mat(v.trimParts[3]), `HNC_TrimStripe_${country}${w}`],
    [mat(v.legL), `HNC_Trim_${country}${w}`],
    [mat(v.head), `HNC_Skin_${skinIndex}`],
    [mat(hair), `HNC_Hair${w}`],
    [mat(v.legL.children[0]), 'HNC_Boot'],
    [mat(v.eyes?.[0]), 'HNC_Eye'],
    [mat(numberMesh), `HNC_Number_${String(number).padStart(2, '0')}`],
  ]);
  v.extras.forEach((e, i) => {
    e.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m && !names.has(m)) names.set(m, `HNC_Wear_${e.name || `extra${i}`}${w}`);
    });
  });
  return names;
}

/**
 * Deep-clone a canonical tree for export: names from `roles`, one material
 * clone per canonical material (sharing preserved, e.g. body + arms), and
 * geometry clones with NORMAL removed for flat-shaded materials. The
 * canonical objects are never mutated.
 */
function cloneForExport(
  src: THREE.Object3D,
  roles: Map<THREE.Object3D, Role>,
  materialNames: Map<THREE.Material, string>,
): THREE.Object3D {
  const materialClones = new Map<THREE.Material, THREE.Material>();
  const exportMaterial = (m: THREE.Material): THREE.Material => {
    let c = materialClones.get(m);
    if (!c) {
      c = m.clone();
      c.name = materialNames.get(m) ?? m.name;
      c.userData = { hncMaterial: c.name };
      materialClones.set(m, c);
    }
    return c;
  };
  const visit = (o: THREE.Object3D): THREE.Object3D => {
    const role = roles.get(o);
    if (!role) throw new Error(`unnamed canonical node (${o.type}) — update interchange roles`);
    let out: THREE.Object3D;
    const mesh = o as THREE.Mesh;
    const line = o as THREE.LineSegments;
    if (mesh.isMesh) {
      const material = mesh.material as THREE.Material & { flatShading?: boolean };
      const geometry = mesh.geometry.clone();
      if (material.flatShading) geometry.deleteAttribute('normal');
      out = new THREE.Mesh(geometry, exportMaterial(material));
    } else if (line.isLineSegments) {
      // Goal nets are line primitives (glTF LINES); Blender gives them thickness at render time.
      out = new THREE.LineSegments(line.geometry.clone(), exportMaterial(line.material as THREE.Material));
    } else {
      out = new THREE.Group();
    }
    out.name = role.name;
    out.position.copy(o.position);
    out.quaternion.copy(o.quaternion);
    out.scale.copy(o.scale);
    out.visible = o.visible;
    out.userData = { hncPart: role.part };
    // Hidden canonical parts (office looks hide the stripe/number) are not exported (GLTFExporter onlyVisible).
    for (const child of o.children) if (child.visible) out.add(visit(child));
    return out;
  };
  return visit(src);
}

const round = (n: number): number => Math.round(n * 1e6) / 1e6;

/** Triangles with any vertex normal off the face normal (> ~0.06°): the ones a glTF importer shades smooth. */
function countSmoothTriangles(g: THREE.BufferGeometry): number {
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const idx = g.index;
  const count = idx ? idx.count : pos.count;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const face = new THREE.Vector3();
  const n = new THREE.Vector3();
  let smooth = 0;
  for (let t = 0; t < count; t += 3) {
    const ids = [0, 1, 2].map((k) => (idx ? idx.getX(t + k) : t + k));
    a.fromBufferAttribute(pos, ids[0]);
    b.fromBufferAttribute(pos, ids[1]);
    c.fromBufferAttribute(pos, ids[2]);
    face.subVectors(c, b).cross(a.clone().sub(b)).normalize();
    if (ids.some((i) => n.fromBufferAttribute(nor, i).normalize().dot(face) < 0.999999)) smooth++;
  }
  return smooth;
}
const vec = (v: THREE.Vector3): [number, number, number] => [round(v.x), round(v.y), round(v.z)];

/** Same metric as inspect_parity._outward_fraction (flipped-normal check), in local space. */
function outwardFraction(g: THREE.BufferGeometry): number {
  const pos = g.attributes.position;
  const idx = g.index;
  const count = idx ? idx.count : pos.count;
  // Centroid of the unique vertex positions (Blender merges nothing: merge_vertices=False keeps glTF vertices).
  const centre = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) centre.add(new THREE.Vector3().fromBufferAttribute(pos, i));
  centre.divideScalar(Math.max(1, pos.count));
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  let good = 0;
  let tris = 0;
  for (let t = 0; t < count; t += 3) {
    const ids = [0, 1, 2].map((k) => (idx ? idx.getX(t + k) : t + k));
    a.fromBufferAttribute(pos, ids[0]);
    b.fromBufferAttribute(pos, ids[1]);
    c.fromBufferAttribute(pos, ids[2]);
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    if (n.lengthSq() < 1e-20) continue;
    const mid = a.clone().add(b).add(c).divideScalar(3);
    if (mid.sub(centre).dot(n) > 0) good++;
    tris++;
  }
  return round(good / Math.max(1, tris));
}

/** Machine-readable description of an export tree (what Blender must reproduce). */
export function describeExport(root: THREE.Object3D): HncExpected {
  root.updateMatrixWorld(true);
  const nodes: HncExpectedNode[] = [];
  const materials = new Map<string, HncExpectedMaterial>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    let worldMin: HncExpectedNode['worldMin'] = null;
    let worldMax: HncExpectedNode['worldMax'] = null;
    let material: string | null = null;
    let vertices = 0;
    let triangles = 0;
    let hasNormals = false;
    let smoothTriangles: number | undefined;
    let lines: number | undefined;
    let outward: number | undefined;
    const line = o as THREE.LineSegments;
    if (line.isLineSegments) {
      const g = line.geometry;
      g.computeBoundingBox();
      const box = g.boundingBox!.clone().applyMatrix4(line.matrixWorld);
      worldMin = vec(box.min);
      worldMax = vec(box.max);
      vertices = g.attributes.position.count;
      lines = (g.index ? g.index.count : vertices) / 2;
      const lm = line.material as THREE.LineBasicMaterial;
      material = lm.name;
      if (!materials.has(lm.name)) {
        materials.set(lm.name, {
          name: lm.name,
          baseColorLinear: [round(lm.color.r), round(lm.color.g), round(lm.color.b)],
          baseColorHex: `#${lm.color.getHexString()}`,
          roughness: null,
          metalness: null,
          // GLTFExporter writes line materials as plain PBR (unlit is only emitted for MeshBasicMaterial).
          unlit: false,
          transparent: lm.transparent,
          flatShading: false,
          map: null,
        });
      }
    }
    if (mesh.isMesh) {
      const g = mesh.geometry;
      // Tight world bounds (transformed vertices), matching what Blender measures on rotated parts.
      const box = new THREE.Box3();
      const p = new THREE.Vector3();
      for (let i = 0; i < g.attributes.position.count; i++) box.expandByPoint(p.fromBufferAttribute(g.attributes.position, i).applyMatrix4(mesh.matrixWorld));
      worldMin = vec(box.min);
      worldMax = vec(box.max);
      outward = outwardFraction(g);
      vertices = g.attributes.position.count;
      triangles = (g.index ? g.index.count : vertices) / 3;
      hasNormals = !!g.attributes.normal;
      if (hasNormals) smoothTriangles = countSmoothTriangles(g);
      const m = mesh.material as THREE.MeshStandardMaterial & THREE.MeshBasicMaterial;
      material = m.name;
      if (!materials.has(m.name)) {
        const img = m.map?.image as { width?: number; height?: number } | undefined;
        materials.set(m.name, {
          name: m.name,
          baseColorLinear: [round(m.color.r), round(m.color.g), round(m.color.b)],
          baseColorHex: `#${m.color.getHexString()}`,
          roughness: m.isMeshStandardMaterial ? m.roughness : null,
          metalness: m.isMeshStandardMaterial ? m.metalness : null,
          unlit: !!m.isMeshBasicMaterial,
          transparent: m.transparent,
          flatShading: !!m.flatShading,
          map: img?.width && img.height ? { width: img.width, height: img.height } : null,
        });
      }
    }
    nodes.push({
      name: o.name,
      parent: o === root ? null : (o.parent?.name ?? null),
      part: String(o.userData.hncPart ?? ''),
      mesh: !!mesh.isMesh,
      ...(lines !== undefined ? { lines } : {}),
      ...(smoothTriangles !== undefined ? { smoothTriangles } : {}),
      ...(outward !== undefined ? { outward } : {}),
      material,
      vertices,
      triangles,
      hasNormals,
      worldPosition: vec(new THREE.Vector3().setFromMatrixPosition(o.matrixWorld)),
      worldMin,
      worldMax,
      scale: vec(o.scale),
    });
  });
  const bounds = new THREE.Box3();
  for (const n of nodes) {
    if (n.worldMin && n.worldMax) {
      bounds.expandByPoint(new THREE.Vector3(...n.worldMin));
      bounds.expandByPoint(new THREE.Vector3(...n.worldMax));
    }
  }
  return {
    root: root.name,
    nodes,
    materials: [...materials.values()],
    boundsMin: vec(bounds.min),
    boundsMax: vec(bounds.max),
  };
}

/** Build the export clone of one canonical player (no geometry authored here). */
export function buildHncPlayerExport(f: Omit<HncPlayerFixture, 'purpose'>): HncExportBuild {
  const country = getCountry(f.country);
  if (!country) throw new Error(`Unknown HNC country code: ${f.country}`);
  const { primary, secondary } = country.colors;
  // Same call the game (renderer.ts) and Reels (CastActor) make.
  const visual = createHncPlayerVisual({ id: f.id, number: f.number, primary, secondary, keeper: f.keeper });
  if (f.proportions) applyHncProportions(visual, f.proportions);
  if (f.look) applyHncWardrobe(visual, f.look, { primary, secondary, accent: f.accent });
  const skinIndex = ((f.id % 4) + 4) % 4;
  const tag = f.tag ?? playerTag(f.country, f.number);
  const root = cloneForExport(
    visual.root,
    playerRoles(visual, tag),
    playerMaterialNames(visual, f.country, f.number, skinIndex, f.look),
  );
  const params = {
    country: f.country,
    number: f.number,
    id: f.id,
    keeper: f.keeper,
    primary,
    secondary,
    skin: HNC_SKIN_PALETTE[skinIndex],
    skinIndex,
    // Only non-default builds carry these, so the verification assets stay byte-identical.
    ...(f.look ? { look: f.look } : {}),
    ...(f.proportions ? { proportions: f.proportions } : {}),
    ...(f.accent ? { accent: f.accent } : {}),
  };
  root.userData = { ...root.userData, hncAsset: f.assetId, hncFactory: 'createHncPlayerVisual', ...params };
  return { root, params, sourceFactory: 'createHncPlayerVisual', expected: describeExport(root) };
}

/** Build the export clone of the canonical ball. */
export function buildHncBallExport(f: Omit<Extract<HncExportFixture, { kind: 'ball' }>, 'purpose'>): HncExportBuild {
  const visual = createHncBallVisual();
  const roles = new Map<THREE.Object3D, Role>([
    [visual.root, { name: 'HNC_Ball', part: 'root' }],
    [visual.leather, { name: 'HNC_Ball.Leather', part: 'leather' }],
  ]);
  const root = cloneForExport(
    visual.root,
    roles,
    new Map([[visual.leather.material as THREE.Material, 'HNC_Ball_Leather']]),
  );
  // Canonical ball origin is its centre; the game lifts the root by the radius.
  const params = { radius: (visual.leather.geometry as THREE.SphereGeometry).parameters.radius };
  root.userData = { ...root.userData, hncAsset: f.assetId, hncFactory: 'createHncBallVisual', ...params };
  return { root, params, sourceFactory: 'createHncBallVisual', expected: describeExport(root) };
}

/** Build the export clone of the canonical goal Emre attacks (+x); world-placed like the game. */
export function buildHncGoalExport(f: Omit<Extract<HncExportFixture, { kind: 'goal' }>, 'purpose'>): HncExportBuild {
  const goal = createHncGoals().find((g) => g.userData.side > 0)!;
  const [postA, postB, bar, net] = goal.children;
  if (!net || (net as THREE.LineSegments).isLineSegments !== true) throw new Error('hnc-visuals goal structure changed — update interchange roles');
  const roles = new Map<THREE.Object3D, Role>([
    [goal, { name: 'HNC_Goal', part: 'root' }],
    [postA, { name: 'HNC_Goal.Post.R', part: 'post[-z]' }],
    [postB, { name: 'HNC_Goal.Post.L', part: 'post[+z]' }],
    [bar, { name: 'HNC_Goal.Bar', part: 'bar' }],
    [net, { name: 'HNC_Goal.Net', part: 'net' }],
  ]);
  const materials = new Map<THREE.Material, string>([
    [(postA as THREE.Mesh).material as THREE.Material, 'HNC_GoalFrame'],
    [(net as THREE.LineSegments).material as THREE.Material, 'HNC_Net'],
  ]);
  const root = cloneForExport(goal, roles, materials);
  const params = { side: 46 };
  root.userData = { ...root.userData, hncAsset: f.assetId, hncFactory: 'createHncGoals', ...params };
  return { root, params, sourceFactory: 'createHncGoals', expected: describeExport(root) };
}

export function buildHncExport(f: HncExportFixture): HncExportBuild {
  return f.kind === 'player' ? buildHncPlayerExport(f) : f.kind === 'ball' ? buildHncBallExport(f) : buildHncGoalExport(f);
}
