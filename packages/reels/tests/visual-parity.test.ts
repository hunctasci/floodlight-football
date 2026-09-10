import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import {
  HNC_BALL_RADIUS,
  HNC_RENDER_PROFILE,
  HNC_REEL_TO_SOCIAL,
  createHncBallVisual,
  createHncPlayerVisual,
  createHncStadium,
  hncPresetLens,
} from '@floodlight/hnc-visuals';
import { countryColors } from '../src/football/data/countries';
import { sampleFootballMoment } from '../src/football/adapter/choreography';
import { evaluateCamera, getCameraPreset } from '../src/cameras/registry';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p: string): string => readFileSync(path.join(root, p), 'utf8');

describe('reel visual parity: no duplicate implementations', () => {
  it('HncFootballer is a thin adapter (no mesh geometry JSX)', () => {
    const src = read('src/actors/HncFootballer.tsx');
    assert.ok(src.includes('@floodlight/hnc-visuals'), 'must import canonical visuals');
    assert.ok(src.includes('<primitive'), 'must mount via <primitive object>');
    assert.ok(src.includes('createHncPlayerVisual'), 'must use the canonical factory');
    for (const banned of ['cylinderGeometry', 'icosahedronGeometry', 'sphereGeometry', 'boxGeometry', 'planeGeometry']) {
      assert.ok(!src.includes(banned), `must not contain ${banned}`);
    }
  });

  it('HumanActor uses the HNC character universe (wardrobe, not generic human)', () => {
    const src = read('src/actors/HumanActor.tsx');
    assert.ok(src.includes('@floodlight/hnc-visuals'), 'must import canonical visuals');
    assert.ok(src.includes('applyHncWardrobe'), 'must use wardrobe variants');
    assert.ok(src.includes('<primitive'), 'must mount via <primitive object>');
    for (const banned of ['cylinderGeometry', 'icosahedronGeometry']) {
      assert.ok(!src.includes(banned), `must not recreate ${banned}`);
    }
    // Wardrobe variants share the HNC language.
    assert.ok(src.includes('office-worker'));
    assert.ok(src.includes('manager'));
  });

  it('FootballStage mounts canonical stadium/ball/players (no recreated world)', () => {
    const src = read('src/stages/football/FootballStage.tsx');
    assert.ok(src.includes('createHncStadium'), 'must mount canonical stadium');
    assert.ok(src.includes('createHncBallVisual'), 'must mount canonical ball');
    assert.ok(src.includes('createHncPlayerVisual'), 'must mount canonical players');
    for (const banned of ['planeGeometry args={[94, 60]}', 'cylinderGeometry args={[0.12, 0.12, 2.8', 'sphereGeometry args={[0.35']) {
      assert.ok(!src.includes(banned), `must not recreate world geometry: ${banned}`);
    }
  });

  it('ReelComposition uses the canonical render profile (no linear flat)', () => {
    const src = read('src/compositions/ReelComposition.tsx');
    assert.ok(!/<ThreeCanvas[^>]*\blinear\b/.test(src), 'must not pass `linear` to ThreeCanvas (disables sRGB)');
    assert.ok(!/<ThreeCanvas[^>]*\bflat\b/.test(src), 'must not pass `flat` to ThreeCanvas (disables tone mapping)');
    assert.ok(src.includes('ACESFilmicToneMapping'), 'must use canonical tone mapping');
    assert.ok(src.includes('SRGBColorSpace'), 'must use canonical color space');
    assert.ok(src.includes('2.35'), 'must use canonical hemi intensity');
    assert.ok(src.includes('2.4'), 'must use canonical sun intensity');
    assert.ok(src.includes('1.12'), 'must use canonical exposure');
  });

  it('football cameras derive from proven social lenses', () => {
    const src = read('src/cameras/registry.ts');
    assert.ok(src.includes('@floodlight/hnc-visuals'), 'must derive from canonical cameras');
    assert.ok(src.includes('hncReelCameraBase') || src.includes('hncPresetLens'), 'must use proven lens math');
    // Required semantic IDs still exposed (callers never see coordinates).
    for (const id of ['football-faceoff', 'football-broadcast', 'football-goal', 'ball-follow', 'keeper-close', 'celebration-close', 'ball-near-lens', 'reaction-crowd']) {
      assert.ok(getCameraPreset(id), `missing camera preset ${id}`);
    }
  });
});

describe('reel visual parity: canonical fixtures', () => {
  it('TR #9 / GR #7 / keeper share game geometry via the same factory', () => {
    const tr = createHncPlayerVisual({ id: 9, number: 9, primary: countryColors('TR').primary, secondary: countryColors('TR').secondary });
    const gr = createHncPlayerVisual({ id: 7, number: 7, primary: countryColors('GR').primary, secondary: countryColors('GR').secondary });
    const keeper = createHncPlayerVisual({ id: 1, number: 1, primary: '#fff', secondary: '#000', keeper: true });
    for (const v of [tr, gr, keeper]) {
      assert.equal((v.body.geometry as THREE.CylinderGeometry).parameters.radialSegments, 6);
      assert.equal((v.shadow.geometry as THREE.CircleGeometry).parameters.radius, 0.52);
    }
    assert.equal(`#${(keeper.body.material as THREE.MeshStandardMaterial).color.getHexString()}`, '#6b64d9');
  });

  it('reel ball is the game ball (radius 0.25, not generic 0.35)', () => {
    assert.equal(HNC_BALL_RADIUS, 0.25);
    const ball = createHncBallVisual();
    assert.equal((ball.leather.geometry as THREE.SphereGeometry).parameters.radius, 0.25);
  });

  it('reel stadium is the game stadium (midfield / box / goal / stand fixtures)', () => {
    const stadium = createHncStadium();
    assert.equal(stadium.goals.length, 2);
    assert.equal(stadium.boards.length, 16);
    assert.ok(stadium.crowdBase.length > 500);
  });

  it('reel lighting matches HNC daylight', () => {
    assert.equal(HNC_RENDER_PROFILE.toneMappingExposure, 1.12);
    assert.equal(HNC_RENDER_PROFILE.background, '#7fb6e0');
  });

  it('every football moment choreographs inside the canonical world', () => {
    for (const moment of ['faceoff', 'attack-goal', 'crossbar-chaos', 'keeper-disaster', 'cross-header-goal']) {
      const choreo = sampleFootballMoment(moment, 2.0, 6.3, true);
      assert.ok(Math.abs(choreo.ball.x) < 50, `${moment} ball out of world`);
      for (const a of choreo.actors) {
        assert.ok(Math.abs(a.x) < 52, `${moment} actor out of world`);
      }
    }
  });

  it('reel football cameras evaluate to finite portrait lenses', () => {
    for (const id of ['football-broadcast', 'football-goal', 'football-faceoff', 'ball-follow', 'keeper-close', 'celebration-close', 'ball-near-lens', 'reaction-crowd']) {
      const pose = evaluateCamera(id, 10, 60);
      const vals = [...pose.pos, ...pose.look, pose.fov];
      assert.ok(vals.every(Number.isFinite), id);
    }
    // Canonical mapping covers the required IDs.
    for (const id of ['football-broadcast', 'ball-follow', 'keeper-close', 'celebration-close', 'ball-near-lens', 'reaction-crowd']) {
      assert.ok(HNC_REEL_TO_SOCIAL[id], `missing canonical mapping for ${id}`);
      const lens = hncPresetLens(HNC_REEL_TO_SOCIAL[id], { ball: { x: 5, y: 0.25, z: -2 } });
      assert.ok(Number.isFinite(lens.fov));
    }
  });
});
