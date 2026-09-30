import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import * as THREE from 'three';
import { createHncPlayerVisual, HNC_BALL_RADIUS, HNC_SKIN_PALETTE } from '@floodlight/hnc-visuals';
import { HNC_EXPORT_FIXTURES, buildHncBallExport, buildHncPlayerExport } from '../src/interchange.ts';
import { glbImageBytes, materialImages, parseGlb, pngSize } from '../src/glb.ts';
import { CANONICAL_SOURCES, MANIFEST, REPO_ROOT } from '../src/paths.ts';

const tr9 = HNC_EXPORT_FIXTURES.find((f) => f.kind === 'player')!;
if (tr9.kind !== 'player') throw new Error('fixture');

const meshes = (root: THREE.Object3D): THREE.Mesh[] => {
  const out: THREE.Mesh[] = [];
  root.traverse((o) => (o as THREE.Mesh).isMesh && out.push(o as THREE.Mesh));
  return out;
};

describe('blender interchange: canonical TR #9 export clone', () => {
  const build = buildHncPlayerExport(tr9);
  const canonical = createHncPlayerVisual({ id: 9, number: 9, primary: '#e30a17', secondary: '#ffffff' });

  it('has stable semantic names in the canonical hierarchy', () => {
    const names: Record<string, string | null> = {};
    build.root.traverse((o) => (names[o.name] = o.parent?.name ?? null));
    assert.deepEqual(names, {
      HNC_Player_TR_09: null,
      'TR09.Body': 'HNC_Player_TR_09',
      'TR09.ChestStripe': 'HNC_Player_TR_09',
      'TR09.ShirtNumber': 'HNC_Player_TR_09',
      'TR09.Head': 'HNC_Player_TR_09',
      'TR09.Hair': 'TR09.Head',
      'TR09.Eye.R': 'TR09.Head',
      'TR09.Eye.L': 'TR09.Head',
      'TR09.Leg.R': 'HNC_Player_TR_09',
      'TR09.Boot.R': 'TR09.Leg.R',
      'TR09.Leg.L': 'HNC_Player_TR_09',
      'TR09.Boot.L': 'TR09.Leg.L',
      'TR09.Arm.R': 'HNC_Player_TR_09',
      'TR09.Arm.L': 'HNC_Player_TR_09',
      'TR09.Shorts': 'HNC_Player_TR_09',
    });
  });

  it('uses anatomical sides: .L is the character\'s left (+X, it faces +Z)', () => {
    const byName = (n: string) => build.root.getObjectByName(n)!;
    assert.ok(byName('TR09.Leg.L').position.x > 0 && byName('TR09.Arm.L').position.x > 0);
    assert.equal(byName('TR09.Leg.R').userData.hncPart, 'legL');
    assert.ok(byName('TR09.Eye.L').position.z > 0, 'eyes face +Z');
    assert.ok(byName('TR09.ShirtNumber').position.z < 0, 'number on the back');
  });

  it('reuses canonical geometry and transforms exactly (nothing re-authored)', () => {
    const src = meshes(canonical.root);
    const out = meshes(build.root);
    assert.equal(out.length, 14);
    src.forEach((m, i) => {
      assert.equal(out[i].geometry.type, m.geometry.type);
      assert.deepEqual((out[i].geometry as THREE.CylinderGeometry).parameters, (m.geometry as THREE.CylinderGeometry).parameters);
      assert.deepEqual(out[i].position.toArray(), m.position.toArray());
      assert.deepEqual(out[i].quaternion.toArray(), m.quaternion.toArray());
      assert.deepEqual(
        Array.from(out[i].geometry.attributes.position.array),
        Array.from(m.geometry.attributes.position.array),
      );
    });
  });

  it('drops normals only on flat-shaded parts and never mutates the canonical visual', () => {
    for (const m of meshes(build.root)) {
      const flat = !!(m.material as THREE.MeshStandardMaterial).flatShading;
      assert.equal(!!m.geometry.attributes.normal, !flat, m.name);
    }
    for (const m of meshes(canonical.root)) assert.ok(m.geometry.attributes.normal, 'canonical keeps normals');
    // A second build from fresh canonical objects is identical (deterministic).
    assert.deepEqual(buildHncPlayerExport(tr9).expected, build.expected);
  });

  it('preserves material separation, sharing and canonical colours', () => {
    const mat = (n: string) => (build.root.getObjectByName(n) as THREE.Mesh).material as THREE.MeshStandardMaterial;
    assert.equal(mat('TR09.Body'), mat('TR09.Arm.L'), 'kit shared by body + arms');
    assert.equal(mat('TR09.Leg.L'), mat('TR09.Shorts'), 'trim shared by legs + shorts');
    assert.notEqual(mat('TR09.ChestStripe'), mat('TR09.Shorts'), 'stripe keeps its own material');
    const hex = Object.fromEntries(build.expected.materials.map((m) => [m.name, m.baseColorHex]));
    assert.deepEqual(hex, {
      HNC_Kit_TR: '#e30a17',
      HNC_TrimStripe_TR: '#ffffff',
      HNC_Number_09: '#ffffff',
      HNC_Skin_1: HNC_SKIN_PALETTE[9 % 4],
      HNC_Hair: '#28283b',
      HNC_Eye: '#182230',
      HNC_Trim_TR: '#ffffff',
      HNC_Boot: '#14141c',
    });
    assert.notEqual(mat('TR09.Body'), (canonical.body.material as THREE.Material), 'materials are export clones');
    assert.equal(build.root.userData.keeper, false);
    assert.equal(build.root.userData.hncFactory, 'createHncPlayerVisual');
  });
});

describe('blender interchange: canonical ball export clone', () => {
  const build = buildHncBallExport({ kind: 'ball', assetId: 'hnc-ball' });
  it('keeps radius, segments, smooth normals and the leather material', () => {
    const leather = build.root.getObjectByName('HNC_Ball.Leather') as THREE.Mesh;
    assert.deepEqual((leather.geometry as THREE.SphereGeometry).parameters, {
      radius: HNC_BALL_RADIUS, widthSegments: 16, heightSegments: 12,
      phiStart: 0, phiLength: Math.PI * 2, thetaStart: 0, thetaLength: Math.PI,
    });
    assert.ok(leather.geometry.attributes.normal, 'ball is smooth-shaded in HNC');
    assert.equal((leather.material as THREE.MeshStandardMaterial).roughness, 0.55);
    assert.deepEqual(build.expected.boundsMax, [0.25, 0.25, 0.25]);
  });
});

// Generated-asset checks: only meaningful after `npm run blender:export`.
describe('blender interchange: generated GLBs match the manifest', { skip: !existsSync(MANIFEST) && 'run blender:export first' }, () => {
  const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : { assets: [], sources: [] };
  const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');

  it('canonical sources are unchanged since export (no drift)', () => {
    assert.deepEqual(manifest.sources.map((s: { path: string }) => s.path), [...CANONICAL_SOURCES]);
    for (const s of manifest.sources) {
      assert.equal(sha(readFileSync(path.join(REPO_ROOT, s.path))), s.sha256, `${s.path} changed — rerun blender:export`);
    }
  });

  it('GLBs carry names, materials and real (non-fallback) textures', () => {
    for (const a of manifest.assets) {
      const bytes = readFileSync(path.join(REPO_ROOT, a.glb));
      assert.equal(sha(bytes), a.sha256, `${a.glb} hash`);
      const glb = parseGlb(bytes);
      const nodeNames = glb.json.nodes!.map((n) => n.name);
      for (const n of a.expected.nodes) assert.ok(nodeNames.includes(n.name), `${a.assetId}: node ${n.name}`);
      const matNames = glb.json.materials!.map((m) => m.name);
      assert.deepEqual([...matNames].sort(), a.expected.materials.map((m: { name: string }) => m.name).sort());
      for (const { material, image } of materialImages(glb)) {
        const size = pngSize(glbImageBytes(glb, image));
        const want = a.expected.materials.find((m: { name: string }) => m.name === material).map;
        assert.deepEqual(size, want, `${material} texture is the baked canvas, not the 1x1 Node fallback`);
      }
      // Flat parts ship without NORMAL; smooth/unlit parts keep it.
      for (const node of glb.json.nodes!) {
        if (node.mesh === undefined) continue;
        const want = a.expected.nodes.find((n: { name: string }) => n.name === node.name);
        const prim = glb.json.meshes![node.mesh].primitives[0];
        assert.equal('NORMAL' in prim.attributes, want.hasNormals, `${node.name} normals`);
      }
    }
  });
});
