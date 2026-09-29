import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HNC_REEL_TO_SOCIAL, hncPresetLens } from '@floodlight/hnc-visuals';
import { compileStory } from '../src/director/compile-story';
import { parseTemplateInput } from '../src/reel/schema';
import { validateProductionReel } from '../src/reel/validate';
import { frameAtMomentTime, momentTimeAt, remapInverse, remapProgress, TIME_RAMP_IDS } from '../src/animation/time-ramp';
import { HERO_ATTACK, sampleHeroAttack } from '../src/football/adapter/moments/hero-attack';
import { CAMERA_MOVE_IDS, evaluateCameraMove, DEFAULT_LENS_ANCHORS } from '../src/cameras/moves';
import { shotCameraPose } from '../src/cameras/shot-camera';
import { sampleShotChoreo, shotMomentTime } from '../src/reel/shot-clock';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const hero = () => compileStory(parseTemplateInput({ template: 'hnc-hero', home: 'TR', away: 'GR', seed: 42 }));

describe('hnc-hero template', () => {
  it('compiles to a clean 1080x1920 60fps ~12s reel', () => {
    const { spec, plan } = hero();
    assert.equal(spec.fps, 60);
    assert.equal(plan.width, 1080);
    assert.equal(plan.height, 1920);
    assert.equal(plan.totalFrames, 720);
    assert.deepEqual(validateProductionReel(spec, plan), []);
  });

  it('shots play one continuous moment timeline (clocks chain)', () => {
    const { plan } = hero();
    for (let i = 1; i < plan.shots.length; i++) {
      assert.equal(plan.shots[i - 1].momentClock!.to, plan.shots[i].momentClock!.from, plan.shots[i].id);
    }
    // Frame 0 of a shot and "frame N" of the previous one are the same instant.
    for (let i = 1; i < plan.shots.length; i++) {
      const a = plan.shots[i - 1];
      const b = plan.shots[i];
      assert.ok(Math.abs(shotMomentTime(a, b.startFrame, 60).time - shotMomentTime(b, b.startFrame, 60).time) < 1e-9);
    }
  });

  it('impact effects land on the choreography beats', () => {
    const { plan } = hero();
    const shot = plan.shots.find((s) => s.camera === 'striker-windup')!;
    const burst = shot.effects!.find((e) => e.type === 'impact-burst')!;
    const t = shotMomentTime(shot, shot.startFrame + burst.startFrame!, 60).time;
    // Within one (slow-motion) frame of ball contact.
    assert.ok(Math.abs(t - HERO_ATTACK.contact) < 0.02, `burst at moment ${t}`);
  });

  it('parses without fps and keeps rivalry templates at 30fps', () => {
    const { spec } = compileStory(parseTemplateInput({ template: 'country-rivalry', home: 'TR', away: 'GR', seed: 42, footballMoment: 'attack-goal' }));
    assert.equal(spec.fps, 30);
    for (const b of spec.beats) assert.equal(b.content?.momentClock, undefined);
  });
});

describe('time ramps', () => {
  it('are monotone with exact endpoints and invertible', () => {
    for (const id of TIME_RAMP_IDS) {
      assert.equal(remapProgress(id, 0), 0);
      assert.ok(Math.abs(remapProgress(id, 1) - 1) < 1e-12);
      let prev = -1;
      for (let u = 0; u <= 1.0001; u += 0.01) {
        const p = remapProgress(id, u);
        assert.ok(p >= prev - 1e-12, `${id} not monotone at ${u}`);
        prev = p;
        assert.ok(Math.abs(remapProgress(id, remapInverse(id, p)) - p) < 1e-6);
      }
    }
  });

  it('anticipation-snap slows the middle and snaps back', () => {
    const slope = (u: number) => (remapProgress('anticipation-snap', u + 0.01) - remapProgress('anticipation-snap', u)) / 0.01;
    assert.ok(slope(0.4) < 0.7, 'wind-up should run in slow motion');
    assert.ok(slope(0.85) > 1.2, 'contact should snap back above real time');
  });

  it('moment clock lands on `to` at the next shot boundary', () => {
    const clock = { from: 5.5, to: 6.5, length: 12, ramp: 'anticipation-snap' as const };
    assert.equal(momentTimeAt(clock, 0, 78), 5.5);
    assert.ok(Math.abs(momentTimeAt(clock, 78, 78) - 6.5) < 1e-12);
    const f = frameAtMomentTime(clock, 6.1, 78);
    assert.ok(Math.abs(momentTimeAt(clock, f, 78) - 6.1) < 0.02);
  });
});

describe('hero-attack choreography', () => {
  it('is deterministic and stays inside the canonical world', () => {
    for (let t = 0; t <= HERO_ATTACK.length; t += 0.05) {
      const a = sampleHeroAttack(t);
      assert.deepEqual(a, sampleHeroAttack(t));
      assert.ok(Math.abs(a.ball.x) < 50 && Math.abs(a.ball.z) < 30, `ball out at ${t}`);
      for (const actor of a.actors) {
        assert.ok(Math.abs(actor.x) < 50 && Math.abs(actor.z) < 30, `actor out at ${t}`);
        assert.ok(Number.isFinite(actor.facing));
        if (actor.pose) assert.ok(Number.isFinite(actor.pose.clock) && Number.isFinite(actor.pose.speed));
      }
    }
  });

  it('scores under the bar and between the posts', () => {
    const b = sampleHeroAttack(HERO_ATTACK.goalLine).ball;
    assert.ok(Math.abs(b.x - 46) < 1e-9);
    assert.ok(b.y + 0.25 < 2.8, 'ball clears under the crossbar');
    assert.ok(Math.abs(b.z) + 0.25 < 4.4, 'ball inside the posts');
    const net = sampleHeroAttack(HERO_ATTACK.netHit).ball;
    assert.ok(net.x > 46 && net.x < 48.2 + 0.01, 'ball stops at the back net');
  });

  it('strikes the ball it dribbled (contact spacing) and dives within game bounds', () => {
    const c = sampleHeroAttack(HERO_ATTACK.contact);
    const s = c.anchors!.hero;
    assert.ok(Math.hypot(c.ball.x - s.x, c.ball.z - s.z) < 0.6, 'ball at the boot on contact');
    const k0 = sampleHeroAttack(HERO_ATTACK.keeperDive).anchors!.keeper!;
    const k1 = sampleHeroAttack(HERO_ATTACK.keeperDive + 1).anchors!.keeper!;
    assert.ok(Math.abs(k1.z - k0.z) <= 2.4, 'engine bound: dive displacement <= 2.4m');
  });

  it('uses canonical game actions and celebrations', () => {
    const actions = new Set<string>();
    for (let t = 0; t <= HERO_ATTACK.length; t += 0.02) for (const a of sampleHeroAttack(t).actors) if (a.pose) actions.add(a.pose.action);
    for (const act of ['idle', 'run', 'kick', 'slide', 'dive']) assert.ok(actions.has(act), act);
    const celebrating = sampleHeroAttack(HERO_ATTACK.celebrate + 0.2).actors[0].pose!;
    assert.equal(celebrating.celebrating, true);
  });
});

describe('hero cameras', () => {
  it('every anchored move evaluates to finite lenses', () => {
    for (const id of CAMERA_MOVE_IDS) {
      for (const u of [0, 0.5, 1]) {
        const l = evaluateCameraMove(id, u, DEFAULT_LENS_ANCHORS);
        assert.ok([l.pos.x, l.pos.y, l.pos.z, l.look.x, l.look.y, l.look.z, l.fov].every(Number.isFinite), `${id}@${u}`);
      }
    }
  });

  it('designed continuous handovers have no camera jump', () => {
    const { plan, spec } = hero();
    const byCam = (c: string) => plan.shots.findIndex((s) => s.camera === c);
    // Continuous by design; the other boundaries are motivated cuts.
    const handovers = ['faceoff-depth-push', 'runner-burst', 'striker-windup', 'crane-out', 'stadium-drift'].map(byCam);
    for (const i of handovers) {
      const prev = plan.shots[i - 1];
      const next = plan.shots[i];
      const a = shotCameraPose(prev, next.startFrame, spec.fps, spec.seed);
      const b = shotCameraPose(next, next.startFrame, spec.fps, spec.seed);
      const jump = Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1], a.pos[2] - b.pos[2]);
      assert.ok(jump < 0.05, `${prev.id} -> ${next.id} camera jumps ${jump.toFixed(3)}m`);
    }
  });

  it('camera never enters the end-stand terrace behind the attacked goal', () => {
    const { plan, spec } = hero();
    for (const shot of plan.shots) {
      for (let f = shot.startFrame; f < shot.startFrame + shot.durationInFrames; f += 3) {
        const p = shotCameraPose(shot, f, spec.fps, spec.seed);
        assert.ok(p.pos[0] < 50.45, `${shot.id}@${f} inside the end stand`);
        assert.ok(p.pos[1] > 0.3, `${shot.id}@${f} below the grass`);
      }
    }
  });

  it('legacy football shots keep the proven ball-anchored lens', () => {
    const { plan } = compileStory(parseTemplateInput({ template: 'country-rivalry', home: 'TR', away: 'GR', seed: 42, footballMoment: 'attack-goal' }));
    const payoff = plan.shots.find((s) => s.camera === 'football-broadcast')!;
    const frame = payoff.startFrame + 40;
    const ball = sampleShotChoreo(payoff, frame, 30)!.ball;
    const lens = hncPresetLens(HNC_REEL_TO_SOCIAL['football-broadcast'], { ball });
    assert.deepEqual(shotCameraPose(payoff, frame, 30, 42), {
      pos: [lens.pos.x, lens.pos.y, lens.pos.z],
      look: [lens.look.x, lens.look.y, lens.look.z],
      fov: lens.fov,
    });
  });
});

describe('determinism guard', () => {
  it('no Math.random / Date.now in reel source', () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((f) => {
        const p = path.join(dir, f);
        return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
      });
    for (const file of walk(path.join(root, 'src'))) {
      // Code only: comments may legitimately warn against these APIs.
      const src = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      assert.ok(!src.includes('Math.random('), `${file} uses Math.random`);
      assert.ok(!src.includes('Date.now('), `${file} uses Date.now`);
    }
  });
});

describe('hero SFX stem', () => {
  it('synthesizes procedural cues on the beats, deterministically; legacy stays opt-out', async () => {
    const { compileSfxEvents } = await import('../src/audio/sfx');
    const { renderSfxStem } = await import('../src/audio/sfx-stem');
    const { spec, plan } = hero();
    assert.equal(spec.audio?.sfxStem, true);
    const events = compileSfxEvents(plan);
    const shotShot = plan.shots.find((s) => s.camera === 'striker-windup')!;
    const burst = shotShot.effects!.find((e) => e.type === 'impact-burst')!;
    const contactSec = (shotShot.startFrame + burst.startFrame!) / plan.fps;
    assert.ok(events.some((e) => e.type === 'shot' && Math.abs(e.time - contactSec) < 1 / 60), 'shot SFX on contact');
    assert.ok(events.some((e) => e.type === 'goal'), 'game goal SFX');
    assert.ok(events.some((e) => e.type === 'sting'), 'brand sting');
    assert.ok(renderSfxStem(plan, spec.seed).equals(renderSfxStem(plan, spec.seed)), 'byte-identical stem');
    const legacy = compileStory(parseTemplateInput({ template: 'country-rivalry', home: 'TR', away: 'GR', seed: 42, footballMoment: 'attack-goal' }));
    assert.ok(!legacy.spec.audio?.sfxStem, 'existing templates unchanged');
  });
});
