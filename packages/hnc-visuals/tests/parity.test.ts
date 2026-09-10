import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  HNC_KEEPER_COLOR,
  HNC_SKIN_PALETTE,
  createHncPlayerVisual,
  rekitHncPlayerVisual,
  hncNumberTexture,
  hncProceduralPose,
  applyHncWardrobe,
  HNC_BALL_RADIUS,
  createHncBallVisual,
  hncBallTexture,
  HNC_RENDER_PROFILE,
  createHncStadium,
  createHncPitch,
  createHncGoals,
  FAR_STAND_ROWS,
  END_STAND_ROWS,
  farStandFanY,
  farStandFanZ,
  endStandFanY,
  isStandAisle,
  hncPresetLens,
  hncFaceoffCameraAt,
  HNC_REEL_TO_SOCIAL,
} from '../src/index.ts';

describe('hnc-visuals: canonical player (game extraction)', () => {
  it('TR outfield #9 has exact game geometry', () => {
    const v = createHncPlayerVisual({ id: 9, number: 9, primary: '#ff0000', secondary: '#ffffff' });
    const body = v.body.geometry as THREE.CylinderGeometry;
    assert.equal(body.parameters.radiusTop, 0.38);
    assert.equal(body.parameters.radiusBottom, 0.48);
    assert.equal(body.parameters.height, 0.85);
    assert.equal(body.parameters.radialSegments, 6);
    assert.equal(v.body.position.y, 1.02);
    // Stripe: Cylinder(0.425, 0.465, 0.2, 6) @ y=1.28.
    const stripe = v.trimParts[3];
    const sg = stripe.geometry as THREE.CylinderGeometry;
    assert.equal(sg.parameters.radiusTop, 0.425);
    assert.equal(sg.parameters.radiusBottom, 0.465);
    assert.equal(sg.parameters.height, 0.2);
    assert.equal(stripe.position.y, 1.28);
    // Shorts: Cylinder(0.47, 0.4, 0.27, 6) @ y=0.68.
    const shorts = v.trimParts[2];
    const shg = shorts.geometry as THREE.CylinderGeometry;
    assert.equal(shg.parameters.radiusTop, 0.47);
    assert.equal(shg.parameters.radiusBottom, 0.4);
    assert.equal(shg.parameters.height, 0.27);
    assert.equal(shorts.position.y, 0.68);
    // Head: Icosahedron(0.32, 1) @ y=1.7; hair sphere cap; eyes at (±0.11,1.72,0.3).
    assert.equal((v.head.geometry as THREE.IcosahedronGeometry).parameters.radius, 0.32);
    assert.equal(v.head.position.y, 1.7);
    // Limbs: Cylinder(0.115, 0.13, 0.67, 5) at game positions.
    for (const [leg, x] of [[v.legL, -0.2], [v.legR, 0.2]] as const) {
      const lg = leg.geometry as THREE.CylinderGeometry;
      assert.equal(lg.parameters.radiusTop, 0.115);
      assert.equal(lg.parameters.radiusBottom, 0.13);
      assert.equal(lg.parameters.height, 0.67);
      assert.equal(leg.position.x, x);
      assert.equal(leg.position.y, 0.38);
      // Boots: Box(0.17, 0.12, 0.32) @ (0,-0.33,0.07) child of leg.
      const boot = leg.children[0] as THREE.Mesh;
      const bg = boot.geometry as THREE.BoxGeometry;
      assert.equal(bg.parameters.width, 0.17);
      assert.equal(bg.parameters.height, 0.12);
      assert.equal(bg.parameters.depth, 0.32);
      assert.deepEqual(boot.position.toArray(), [0, -0.33, 0.07]);
    }
    assert.deepEqual(v.armL.position.toArray(), [-0.48, 1.08, 0]);
    assert.deepEqual(v.armR.position.toArray(), [0.48, 1.08, 0]);
    // Shadow: Circle(0.52) #153a20 opacity 0.28, world-mounted (not in root).
    assert.equal((v.shadow.geometry as THREE.CircleGeometry).parameters.radius, 0.52);
    assert.equal((v.shadow.material as THREE.MeshBasicMaterial).opacity, 0.28);
    assert.equal(v.root.children.includes(v.shadow), false);
  });

  it('skin palette is id % 4, keeper colour fixed, number on back', () => {
    for (let id = 0; id < 8; id++) {
      const v = createHncPlayerVisual({ id, number: 7, primary: '#00ff00', secondary: '#000000' });
      const expected = HNC_SKIN_PALETTE[((id % 4) + 4) % 4];
      assert.equal(
        `#${(v.head.material as THREE.MeshStandardMaterial).color.getHexString()}`,
        expected,
      );
    }
    const keeper = createHncPlayerVisual({ id: 0, number: 1, primary: '#00ff00', secondary: '#000', keeper: true });
    assert.equal(`#${(keeper.body.material as THREE.MeshStandardMaterial).color.getHexString()}`, HNC_KEEPER_COLOR);
    // Number plane: Plane(0.52,0.52) @ (0,1.04,-0.44) rotY=PI.
    const tr = createHncPlayerVisual({ id: 0, number: 9, primary: '#fff', secondary: '#000' });
    const num = tr.root.children.find(
      (c) => (c as THREE.Mesh).isMesh && (c as THREE.Mesh).geometry.type === 'PlaneGeometry',
    ) as THREE.Mesh;
    assert.ok(num);
    assert.deepEqual(num.position.toArray(), [0, 1.04, -0.44]);
    assert.equal(Math.round(num.rotation.y * 1000), Math.round(Math.PI * 1000));
  });

  it('rekit mirrors ensureAvatars (keeper stays purple)', () => {
    const v = createHncPlayerVisual({ id: 1, number: 7, primary: '#111111', secondary: '#222222', keeper: true });
    rekitHncPlayerVisual(v, '#ff0000', '#00ff00');
    assert.equal(`#${(v.body.material as THREE.MeshStandardMaterial).color.getHexString()}`, HNC_KEEPER_COLOR);
    assert.equal(`#${(v.trimParts[0].material as THREE.MeshStandardMaterial).color.getHexString()}`, '#00ff00');
  });

  it('number textures are cached per shirt number', () => {
    const a = hncNumberTexture(9);
    const b = hncNumberTexture(9);
    assert.equal(a, b);
  });

  it('office wardrobes preserve HNC proportions, hide kit markings', () => {
    const v = createHncPlayerVisual({ id: 0, number: 10, primary: '#fff', secondary: '#000' });
    const bodyBefore = (v.body.geometry as THREE.CylinderGeometry).parameters.height;
    applyHncWardrobe(v, 'office-worker');
    assert.equal((v.body.geometry as THREE.CylinderGeometry).parameters.height, bodyBefore);
    assert.equal((v.head.geometry as THREE.IcosahedronGeometry).parameters.radius, 0.32);
    // Stripe + number hidden for office.
    assert.equal(v.trimParts[3].visible, false);
    assert.ok(v.extras.length >= 2); // tie + badge
    // Football wardrobe restores markings.
    applyHncWardrobe(v, 'footballer', { primary: '#fff', secondary: '#000' });
    assert.equal(v.trimParts[3].visible, true);
  });

  it('procedural poses are deterministic from absolute localTime', () => {
    assert.deepEqual(hncProceduralPose('side-eye', 1.0), hncProceduralPose('side-eye', 1.0));
    assert.notDeepEqual(hncProceduralPose('side-eye', 0.1), hncProceduralPose('side-eye', 0.9));
    // Office ids exist and differ from idle.
    for (const id of ['office-idle', 'sitting', 'typing', 'pointing', 'smug-celebrate', 'angry', 'shrug', 'coffee-drink', 'stand-up']) {
      assert.ok(hncProceduralPose(id, 0.5));
    }
  });
});

describe('hnc-visuals: ball single source', () => {
  it('uses FIELD ball radius 0.25 with pentagon texture + shadow', () => {
    assert.equal(HNC_BALL_RADIUS, 0.25);
    const ball = createHncBallVisual();
    assert.equal((ball.leather.geometry as THREE.SphereGeometry).parameters.radius, 0.25);
    assert.equal((ball.leather.geometry as THREE.SphereGeometry).parameters.widthSegments, 16);
    assert.equal((ball.leather.material as THREE.MeshStandardMaterial).roughness, 0.55);
    assert.ok((ball.leather.material as THREE.MeshStandardMaterial).map);
    assert.equal((ball.shadow.geometry as THREE.CircleGeometry).parameters.radius, 0.31);
    assert.equal((ball.shadow.material as THREE.MeshBasicMaterial).opacity, 0.34);
    assert.ok(hncBallTexture());
  });
});

describe('hnc-visuals: stadium single source', () => {
  it('pitch has apron + stripes + complete markings', () => {
    const pitch = createHncPitch();
    // Apron 120x84 + pitch 94x60 + 6 stripes + lines + circle + dots + boxes + arcs.
    assert.ok(pitch.children.length > 20);
    const apron = pitch.children[0] as THREE.Mesh;
    assert.equal((apron.geometry as THREE.PlaneGeometry).parameters.width, 120);
    assert.equal((apron.geometry as THREE.PlaneGeometry).parameters.height, 84);
  });

  it('goals: posts + bar + open mouth + named nets', () => {
    const goals = createHncGoals();
    assert.equal(goals.length, 2);
    for (const goal of goals) {
      const net = goal.getObjectByName('net');
      assert.ok(net);
      assert.ok([46, -46].includes(goal.userData.side));
    }
  });

  it('stadium: far stand + end terraces + roof + rails + floodlights + boards', () => {
    const stadium = createHncStadium();
    assert.equal(stadium.goals.length, 2);
    assert.equal(stadium.goalNets.length, 2);
    assert.equal(stadium.boards.length, 16);
    assert.ok(stadium.crowdBase.length > 500);
    assert.equal(FAR_STAND_ROWS, 8);
    assert.equal(END_STAND_ROWS, 5);
    // Fans stand ON steps: base = terrace top + 0.36.
    assert.ok(Math.abs(farStandFanY(0) - (1.3 + 0.36)) < 1e-9);
    assert.ok(Math.abs(farStandFanZ(3) - (-31.9 - 3 * 1.1)) < 1e-9);
    assert.ok(Math.abs(endStandFanY(2) - (1.3 + 2 * 0.55 + 0.36)) < 1e-9);
    assert.equal(isStandAisle(0), true);
    assert.equal(isStandAisle(10), false);
  });
});

describe('hnc-visuals: render profile single source', () => {
  it('matches the game renderer exactly', () => {
    assert.equal(HNC_RENDER_PROFILE.outputColorSpace, THREE.SRGBColorSpace);
    assert.equal(HNC_RENDER_PROFILE.toneMapping, THREE.ACESFilmicToneMapping);
    assert.equal(HNC_RENDER_PROFILE.toneMappingExposure, 1.12);
    assert.equal(HNC_RENDER_PROFILE.background, '#7fb6e0');
    assert.equal(HNC_RENDER_PROFILE.fogColor, '#7fb6e0');
    assert.equal(HNC_RENDER_PROFILE.fogNear, 160);
    assert.equal(HNC_RENDER_PROFILE.fogFar, 260);
    assert.equal(HNC_RENDER_PROFILE.shadowMapType, THREE.PCFShadowMap);
    assert.equal(HNC_RENDER_PROFILE.hemiSky, '#e8f6ff');
    assert.equal(HNC_RENDER_PROFILE.hemiGround, '#2f6b35');
    assert.equal(HNC_RENDER_PROFILE.hemiIntensity, 2.35);
    assert.equal(HNC_RENDER_PROFILE.sunColor, '#fff1cb');
    assert.equal(HNC_RENDER_PROFILE.sunIntensity, 2.4);
    assert.deepEqual([...HNC_RENDER_PROFILE.sunPosition], [-25, 42, 18]);
  });
});

describe('hnc-visuals: camera parity', () => {
  it('reel IDs map to proven social presets with finite lenses', () => {
    for (const id of Object.keys(HNC_REEL_TO_SOCIAL)) {
      const lens = hncPresetLens(HNC_REEL_TO_SOCIAL[id], { ball: { x: 0, y: 0.25, z: 0 } });
      const vals = [lens.pos.x, lens.pos.y, lens.pos.z, lens.look.x, lens.look.y, lens.look.z, lens.fov];
      assert.ok(vals.every(Number.isFinite), id);
    }
  });

  it('faceoff dolly is deterministic in time', () => {
    const a = hncFaceoffCameraAt(1.0, 4.0, 0.2);
    const b = hncFaceoffCameraAt(1.0, 4.0, 0.2);
    assert.deepEqual(a, b);
    assert.notDeepEqual(hncFaceoffCameraAt(0, 4.0), hncFaceoffCameraAt(4.0, 4.0));
  });
});
