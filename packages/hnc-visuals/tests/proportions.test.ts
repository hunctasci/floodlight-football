import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { applyHncProportions, applyHncWardrobe, createHncPlayerVisual } from '../src/index.ts';

const make = () => createHncPlayerVisual({ id: 5, number: 9, primary: '#e30a17', secondary: '#ffffff' });
const box = (o: THREE.Object3D) => {
  o.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(o);
};

describe('HNC proportions (Player Diaries family)', () => {
  it('adult is a no-op: the canonical layout is untouched', () => {
    const a = make();
    const before = box(a.root);
    applyHncProportions(a, 'adult');
    assert.deepEqual(box(a.root), before);
  });

  it('child reads as a child: shorter, relatively bigger head, boots on the ground', () => {
    const c = make();
    applyHncProportions(c, 'child');
    const all = box(c.root);
    const head = box(c.head);
    const body = box(c.body);
    const height = all.max.y - all.min.y;
    assert.ok(height > 1.1 && height < 1.45, `child height ${height.toFixed(2)} m`);
    assert.ok(Math.abs(all.min.y) < 0.03, `feet on the ground (min y ${all.min.y.toFixed(3)})`);
    const headW = head.max.x - head.min.x;
    const bodyW = body.max.x - body.min.x;
    assert.ok(headW / bodyW > 0.8, `child head/body width ${(headW / bodyW).toFixed(2)} (adult ≈ 0.67)`);
    assert.ok(head.min.y < body.max.y, 'the head still sinks into the torso (no floating head)');
  });
});

describe('Player Diaries wardrobe pieces', () => {
  it('elder: grey hair, cap, moustache, scarf — named extras, reversible', () => {
    const v = make();
    applyHncWardrobe(v, 'elder', { primary: '#e30a17', secondary: '#ffffff' });
    const names = v.extras.map((e) => e.name).sort();
    for (const n of ['cap', 'cap-brim', 'moustache', 'scarf', 'jacket']) assert.ok(names.includes(n), `${n} present`);
    const hair = v.head.children.find((c) => !v.eyes?.includes(c as THREE.Mesh)) as THREE.Mesh;
    assert.equal(`#${(hair.material as THREE.MeshStandardMaterial).color.getHexString()}`, '#b9b5ad');
    applyHncWardrobe(v, 'footballer', { primary: '#e30a17', secondary: '#ffffff' });
    assert.equal(v.extras.length, 0);
    assert.equal(`#${(hair.material as THREE.MeshStandardMaterial).color.getHexString()}`, '#28283b');
  });

  it('replica keeps the back number and the stripe in the kit trim', () => {
    const v = make();
    applyHncWardrobe(v, 'replica', { primary: '#e30a17', secondary: '#ffffff' });
    const stripe = v.trimParts[3];
    assert.equal(stripe.visible, true);
    assert.equal(`#${(stripe.material as THREE.MeshStandardMaterial).color.getHexString()}`, '#ffffff');
    const number = v.root.children.find((c) => (c as THREE.Mesh).geometry?.type === 'PlaneGeometry')!;
    assert.equal(number.visible, true);
  });
});
