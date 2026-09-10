import test from 'node:test';
import assert from 'node:assert/strict';
import { FIELD } from '../../../apps/game/src/types.ts';
import { countryTeams } from '../../../apps/game/src/city-league/kits.ts';
import {
  compileVideo, evaluateFrame, type AttackGoalFrameDescription, type CompiledSocialVideo,
} from '../src/timeline.ts';
import { ATTACK_GOAL_BEATS } from '../src/scenes/attack-goal.ts';
import { attackGoalFrameToRenderInput } from '../src/scenes/attack-goal.ts';
import { resolveVideoSpec, SocialSpecError } from '../src/schema.ts';

const std = (extra: Record<string, unknown> = {}) =>
  compileVideo({ scene: 'attack-goal', home: 'TR', away: 'GR', seed: 42, fps: 30, ...extra });

function goalDesc(compiled: CompiledSocialVideo, frame: number): AttackGoalFrameDescription {
  const desc = evaluateFrame(compiled, frame);
  if (desc.scene !== 'attack-goal') throw new Error(`expected attack-goal, got ${desc.scene}`);
  return desc;
}

function actor(desc: AttackGoalFrameDescription, name: string): AttackGoalActorFrameOfDesc {
  const found = desc.actors.find((a) => a.name === name);
  assert.ok(found, `actor ${name} exists`);
  return found;
}

type AttackGoalActorFrameOfDesc = AttackGoalFrameDescription['actors'][number];

const dist2 = (a: { x: number; z: number }, b: { x: number; z: number }) =>
  Math.hypot(a.x - b.x, a.z - b.z);

test('attack-goal compilation defaults: 9.5s, 30fps, 285 frames, home central', () => {
  const spec = resolveVideoSpec({ scene: 'attack-goal', home: 'TR', away: 'GR' });
  assert.equal(spec.duration, 9.5);
  assert.equal(spec.fps, 30);
  assert.equal(spec.totalFrames, 285);
  assert.equal(spec.attackTeam, 'home');
  assert.equal(spec.attackStyle, 'central');
  // Faceoff keeps its own default.
  assert.equal(resolveVideoSpec({ scene: 'faceoff', home: 'TR', away: 'GR' }).duration, 4);
  // Explicit duration still overrides the scene default.
  assert.equal(resolveVideoSpec({ scene: 'attack-goal', home: 'TR', away: 'GR', duration: 4 }).totalFrames, 120);
});

test('attack semantic options validate cleanly', () => {
  assert.equal(resolveVideoSpec({ scene: 'attack-goal', home: 'TR', away: 'GR', attackTeam: 'away' }).attackTeam, 'away');
  assert.equal(resolveVideoSpec({ scene: 'attack-goal', home: 'TR', away: 'GR', attackStyle: 'wing' }).attackStyle, 'wing');
  assert.throws(
    () => resolveVideoSpec({ scene: 'attack-goal', home: 'TR', away: 'GR', attackTeam: 'left' }),
    /Unknown attack team: left \(supported: home, away\)/,
  );
  assert.throws(
    () => resolveVideoSpec({ scene: 'attack-goal', home: 'TR', away: 'GR', attackStyle: 'tiki-taka' }),
    /Unknown attack style: tiki-taka \(supported: central, wing, counter\)/,
  );
});

test('attack-goal stages 13 canonical actors: 3 attackers, 3 defenders, keeper, background', () => {
  const compiled = std();
  const input = attackGoalFrameToRenderInput(goalDesc(compiled, 0), 'TR', 'GR');
  assert.equal(input.state.players.length, 13);
  assert.deepEqual(input.state.teams, countryTeams('TR', 'GR'));
  const keepers = input.state.players.filter((p) => p.keeper);
  assert.equal(keepers.length, 1);
  assert.equal(keepers[0].team, 1);
  assert.equal(keepers[0].number, 1);
  const byName = new Map(input.state.players.map((p) => [p.name, p]));
  for (const [name, team] of [['Midfielder', 0], ['Winger', 0], ['Shooter', 0], ['Keeper', 1]] as const) {
    assert.equal(byName.get(name)?.team, team, `${name} wears the right shirt`);
  }
});

test('beat 1 (frame 0): ball at the midfielder\'s feet', () => {
  const desc = goalDesc(std(), 0);
  assert.ok(dist2(desc.ball, actor(desc, 'Midfielder')) < 1.5, 'ball starts with the midfielder');
});

test('beat 2 (frame 50): ball travelling between passer and receiver', () => {
  const compiled = std();
  const desc = goalDesc(compiled, 50);
  const release = goalDesc(compiled, 36).ball; // pass release moment (t=1.2)
  const recv = actor(goalDesc(compiled, 66), 'Winger'); // catch moment (t=2.2)
  assert.ok(desc.ball.x > release.x && desc.ball.x < recv.x, 'ball is mid-pass');
  assert.ok(dist2(desc.ball, release) > 1 && dist2(desc.ball, recv) > 1, 'ball is mid-pass, not at either end');
});

test('beat 4 (frame 140): ball at the shooter\'s feet, keeper set near goal', () => {
  const desc = goalDesc(std(), 140);
  assert.ok(dist2(desc.ball, actor(desc, 'Shooter')) < 1.2, 'shooter has settled the ball');
  const keeper = actor(desc, 'Keeper');
  assert.ok(Math.abs(keeper.x - 43.3) < 0.5 && Math.abs(keeper.z) < 4, 'keeper holds near the goal centre');
});

test('beat 5 (frame 170): ball flying at goal, keeper committed to the dive', () => {
  const desc = goalDesc(std(), 170);
  assert.ok(desc.ball.x > 38, `shot is past the shooter toward goal (x=${desc.ball.x.toFixed(1)})`);
  assert.ok(Math.abs(actor(desc, 'Keeper').lean) > 0.3, 'keeper is mid-dive');
  assert.ok(desc.effects.trailIntensity > 0.3, 'shot trail is live');
  assert.ok(desc.effects.fovPunch > 0.5, 'fov punch emphasises the strike');
});

test('beat 7 (frame 180): ball inside the goal', () => {
  const desc = goalDesc(std(), 180);
  assert.ok(desc.ball.x > FIELD.halfLength, 'ball crossed the goal line');
  assert.ok(Math.abs(desc.ball.z) < FIELD.goalHalfWidth, 'ball inside the posts');
  assert.ok(desc.ball.y < FIELD.goalHeight, 'ball under the bar');
});

test('beat 9 (frame 240): shooter celebration is active', () => {
  const desc = goalDesc(std(), 240); // seed 42 → variant 0, arms-up V
  const shooter = actor(desc, 'Shooter');
  assert.ok(
    (shooter.armLift > 1.5 && shooter.armSpread > 0.5) || Math.abs(shooter.spin) > 0.5 || shooter.lean > 0.3,
    `celebration pose active (armLift=${shooter.armLift.toFixed(2)} spread=${shooter.armSpread.toFixed(2)} spin=${shooter.spin.toFixed(2)} lean=${shooter.lean.toFixed(2)})`,
  );
});

test('goal validity: the shot crosses the line inside the frame of the goal', () => {
  const compiled = std();
  let crossed = -1;
  for (let f = 150; f <= 185; f++) {
    const prev = goalDesc(compiled, f - 1).ball;
    const cur = goalDesc(compiled, f).ball;
    if (prev.x <= FIELD.halfLength && cur.x > FIELD.halfLength) {
      crossed = f;
      assert.ok(Math.abs(cur.z) <= FIELD.goalHalfWidth, `crossing inside posts (z=${cur.z.toFixed(2)})`);
      assert.ok(cur.y <= FIELD.goalHeight, `crossing under the bar (y=${cur.y.toFixed(2)})`);
      break;
    }
  }
  assert.ok(crossed > 0, 'ball crosses the goal line during the shot/goal beats');
  assert.ok(crossed / 30 >= ATTACK_GOAL_BEATS.shotStart && crossed / 30 <= ATTACK_GOAL_BEATS.shotEnd + 0.05, `crossing at t=${(crossed / 30).toFixed(2)}s`);
});

test('keeper miss: the ball never comes within catching range on its way in', () => {
  const compiled = std();
  let min = Infinity;
  for (let f = 155; f <= 185; f++) {
    const desc = goalDesc(compiled, f);
    const keeper = actor(desc, 'Keeper');
    const d = Math.hypot(desc.ball.x - keeper.x, desc.ball.z - keeper.z, desc.ball.y - 1.0);
    if (d < min) min = d;
  }
  assert.ok(min > 0.75, `closest approach ${min.toFixed(2)}m — a clear miss, no body contact`);
});

test('continuity: no actor teleports between adjacent frames', () => {
  const compiled = std();
  for (let f = 0; f < 284; f++) {
    const a = goalDesc(compiled, f), b = goalDesc(compiled, f + 1);
    for (let i = 0; i < a.actors.length; i++) {
      const d = dist2(a.actors[i], b.actors[i]);
      assert.ok(d < 0.75, `frame ${f}→${f + 1} actor ${a.actors[i].name} moves ${d.toFixed(2)}m`);
    }
  }
});

test('continuity: ball never jumps outside the shot window', () => {
  const compiled = std();
  for (let f = 0; f < 284; f++) {
    if (f >= 155 && f < 180) continue; // the driven shot is meant to be fast
    const a = goalDesc(compiled, f).ball, b = goalDesc(compiled, f + 1).ball;
    const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    assert.ok(d < 0.9, `frame ${f}→${f + 1} ball moves ${d.toFixed(2)}m`);
  }
});

test('the shot itself is fast: over 1m per frame mid-flight', () => {
  const compiled = std();
  const a = goalDesc(compiled, 168).ball, b = goalDesc(compiled, 169).ball;
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) > 1.0, 'driven shot pace');
});

test('determinism: same spec, separately compiled, identical at every beat', () => {
  const a = std(), b = std();
  for (const frame of [0, 50, 140, 168, 180, 240, 284]) {
    assert.deepEqual(evaluateFrame(a, frame), evaluateFrame(b, frame));
  }
});

test('random-access: frame 180 is independent of evaluation order', () => {
  const compiled = std();
  const direct = evaluateFrame(compiled, 180);
  for (const f of [0, 10, 60, 140, 240, 284, 40, 20]) evaluateFrame(compiled, f);
  assert.deepEqual(evaluateFrame(compiled, 180), direct);
});

test('seed variation: 42 vs 43 differ in style, agree on meaning', () => {
  const a = std(), b = std({ seed: 43 });
  assert.notDeepEqual(a.attackGoal, b.attackGoal);
  assert.notDeepEqual(evaluateFrame(a, 60), evaluateFrame(b, 60));
  for (const compiled of [a, b]) {
    assert.equal(compiled.home, 'TR');
    assert.equal(compiled.away, 'GR');
    assert.equal(compiled.attackTeam, 'home');
    assert.equal(compiled.fps, 30);
    assert.equal(compiled.duration, 9.5);
    assert.equal(compiled.totalFrames, 285);
    // Both seeds still score through the same mouth.
    let scored = false;
    for (let f = 155; f <= 185; f++) {
      const ball = goalDesc(compiled, f).ball;
      if (ball.x > FIELD.halfLength && Math.abs(ball.z) < FIELD.goalHalfWidth && ball.y < FIELD.goalHeight) {
        scored = true;
        break;
      }
    }
    assert.ok(scored, 'every seed scores');
  }
  // Seed picks the celebration: 42 → arms-up V, 43 → spin.
  const armsUp = actor(goalDesc(a, 240), 'Shooter');
  assert.ok(armsUp.armLift > 1.5 && armsUp.armSpread > 0.5, 'seed 42 celebrates arms-up');
  assert.ok(Math.abs(actor(goalDesc(b, 240), 'Shooter').spin) > 0.5, 'seed 43 celebrates with a spin');
});

test('away attack mirrors the choreography onto the far goal', () => {
  const compiled = std({ attackTeam: 'away' });
  assert.equal(compiled.attackTeam, 'away');
  const desc = goalDesc(compiled, 180);
  assert.ok(desc.ball.x < -FIELD.halfLength, 'ball crosses the far goal line');
  assert.ok(Math.abs(desc.ball.z) < FIELD.goalHalfWidth && desc.ball.y < FIELD.goalHeight, 'through the mouth');
  assert.equal(actor(desc, 'Shooter').team, 1, 'away shooter wears away colours');
  assert.equal(actor(desc, 'Keeper').team, 0, 'home keeper defends');
});

test('wing and counter styles compile and score', () => {
  for (const style of ['wing', 'counter'] as const) {
    const compiled = std({ attackStyle: style });
    assert.equal(compiled.totalFrames, 285);
    let scored = false;
    for (let f = 155; f <= 185; f++) {
      const ball = goalDesc(compiled, f).ball;
      if (ball.x > FIELD.halfLength && Math.abs(ball.z) < FIELD.goalHalfWidth && ball.y < FIELD.goalHeight) {
        scored = true;
        break;
      }
    }
    assert.ok(scored, `${style} scores`);
  }
});

test('actors stay on the pitch with normalized facing', () => {
  const compiled = std();
  for (const frame of [0, 60, 168, 240]) {
    const desc = goalDesc(compiled, frame);
    for (const a of desc.actors) {
      assert.ok(Math.abs(a.x) <= 46 && Math.abs(a.z) <= 29, `${a.name} on pitch at frame ${frame}`);
      assert.ok(Math.abs(Math.hypot(a.facingX, a.facingZ) - 1) < 1e-9, `${a.name} facing normalized`);
    }
  }
});

test('camera cuts between beats but flows within them', () => {
  const compiled = std();
  const jump = (f: number, g: number) => {
    const a = goalDesc(compiled, f).camera.pos, b = goalDesc(compiled, g).camera.pos;
    return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  };
  assert.ok(jump(65, 67) > 2, 'hard cut into the tracking medium at 2.2s');
  assert.ok(jump(60, 61) < 0.5, 'smooth tracking inside the establish beat');
  for (const frame of [0, 168, 240, 284]) {
    const cam = goalDesc(compiled, frame).camera;
    assert.ok(cam.fov >= 40 && cam.fov <= 65, `sane fov at frame ${frame}`);
  }
});

test('out-of-range and foreign-scene frames fail clearly', () => {
  const compiled = std();
  assert.throws(() => evaluateFrame(compiled, 285), /Invalid frame: 285/);
  assert.throws(() => evaluateFrame(compiled, -1), /Invalid frame: -1/);
});
