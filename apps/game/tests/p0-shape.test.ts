import test from 'node:test';
import assert from 'node:assert/strict';
import { MatchEngine } from '../src/engine.ts';
import { EMPTY_INPUT, FIELD, type TeamId } from '../src/types.ts';

const DT = 1 / 60;
function step(g: MatchEngine, input = {}, peer = {}) {
  g.update(DT, { ...EMPTY_INPUT, ...input }, { ...EMPTY_INPUT, ...peer });
  g.events.splice(0);
}
function midfield(seed = 7) {
  const g = new MatchEngine(0, 180, seed);
  const s = g.state;
  s.phase = 'playing'; s.phaseTime = 0; s.restart = null; s.paused = false;
  // Stable midfield possession for team 0 around (-6, 0).
  for (const p of s.players) {
    p.vx = p.vz = 0; p.cooldown = 0; p.think = 100; p.touchIn = 0;
    if (p.team === 0 && !p.keeper) { p.x = -14 + (p.id % 5) * 4; p.z = -12 + (p.id % 4) * 8; }
    else if (!p.keeper) { p.x = 6 + (p.id % 5) * 4; p.z = -12 + (p.id % 4) * 8; }
  }
  const carrier = s.players.find((q) => q.team === 0 && !q.keeper)!;
  s.controlled = carrier.id;
  carrier.x = -6; carrier.z = 0; carrier.facingX = 1; carrier.facingZ = 0;
  Object.assign(s.ball, {
    x: -5.3, y: FIELD.ballRadius, z: 0, vx: 0, vy: 0, vz: 0,
    owner: carrier.id, lastTouch: 0, lock: 0, lastKicker: null, flight: 'roll',
  });
  return { g, s, carrier };
}

test('P0.6 stable possession offers 3+ options across lanes and depths', () => {
  const { g, s, carrier } = midfield(7);
  for (let i = 0; i < 30; i++) step(g, {});
  const mates = s.players.filter((q) => q.team === 0 && !q.keeper && q.id !== carrier.id);
  const options = mates.filter((q) => {
    const dx = q.x - carrier.x, dz = q.z - carrier.z, d = Math.hypot(dx, dz);
    if (d < 4 || d > 25) return false;
    let open = 99;
    for (const f of s.players.filter((p) => p.team === 1 && !p.keeper)) open = Math.min(open, Math.hypot(q.x - f.x, q.z - f.z));
    return open > 2;
  });
  assert.ok(options.length >= 3, `at least 3 useful options (got ${options.length})`);
  const lanes = new Set(options.map((q) => Math.sign(q.z - carrier.z)));
  const depths = new Set(options.map((q) => (q.x > carrier.x + 2 ? 'fwd' : q.x < carrier.x - 2 ? 'back' : 'level')));
  assert.ok(lanes.size >= 2, 'options span distinct lanes');
  assert.ok(depths.size >= 2, 'options span distinct depths');
});

test('P0.6 at most one AI directly pressures the carrier', () => {
  const { g, s } = midfield(8);
  let worst = 0;
  for (let i = 0; i < 180; i++) {
    step(g, {});
    const press = s.players.filter((p) => p.team === 1 && !p.keeper
      && (p.aiState === 'CHASE') && Math.hypot(p.x - s.ball.x, p.z - s.ball.z) < 6).length;
    worst = Math.max(worst, press);
  }
  assert.ok(worst <= 1, `never gang-press (worst ${worst})`);
});

test('P0.6 human pressing counts: no AI doubles up beside him', () => {
  const { g, s } = midfield(9);
  // Human takes a defender and runs at the carrier's team... flip: team 1 owns.
  const foe = s.players.find((q) => q.team === 1 && !q.keeper)!;
  foe.x = -6; foe.z = 0;
  Object.assign(s.ball, { x: -5.3, z: 0, owner: foe.id });
  const human = s.players.find((q) => q.team === 0 && !q.keeper && q.id !== s.controlled)!;
  human.x = -3; human.z = 1; human.vx = human.vz = 0;
  s.controlled = human.id;
  for (let i = 0; i < 60; i++) step(g, { x: -1, z: 0 });
  const aiChase = s.players.filter((p) => p.team === 0 && !p.keeper && p.id !== human.id
    && p.aiState === 'CHASE' && Math.hypot(p.x - s.ball.x, p.z - s.ball.z) < 6).length;
  assert.equal(aiChase, 0, 'AI holds shape while the human presses');
});

test('P0.6 presser identity is stable, not oscillating', () => {
  const { g, s } = midfield(10);
  const seen: (number | null)[] = [];
  let last: number | null = null, changes = 0;
  for (let i = 0; i < 120; i++) {
    step(g, {});
    const snap = (g.snapshot().roles[1] as { presser: number | null }).presser;
    seen.push(snap);
    if (snap !== last) { changes++; last = snap; }
  }
  assert.ok(changes <= 3, `presser stable over 2s (${changes} changes)`);
  void s;
});

test('P0.6 keeper catch opens two separated short outlets within ~1.5s', () => {
  const g = new MatchEngine(0, 180, 21);
  const s = g.state;
  s.phase = 'playing'; s.phaseTime = 0; s.restart = null; s.paused = false;
  for (const p of s.players) { p.vx = p.vz = 0; p.cooldown = 0; p.think = 100; }
  const k = s.players.find((p) => p.team === 0 && p.keeper)!;
  k.x = k.homeX; k.z = 0; k.vx = k.vz = 0; k.cooldown = 0;
  Object.assign(s.ball, {
    x: k.x + 0.5, z: 0, y: FIELD.ballRadius, vx: 0, vy: 0, vz: 0,
    owner: k.id, lastTouch: 0, lock: 0, lastKicker: null, flight: 'roll',
  });
  for (const p of s.players) if (p.team === 1 && !p.keeper) { p.x = 10; p.z = 15; p.think = 100; }
  // Track max per-tick teleport of the keeper's outfielders (no beaming).
  let maxStep = 0;
  const prev = new Map<number, { x: number; z: number }>();
  for (let i = 0; i < 90; i++) {
    for (const p of s.players) {
      const q = prev.get(p.id);
      if (q) maxStep = Math.max(maxStep, Math.hypot(p.x - q.x, p.z - q.z));
      prev.set(p.id, { x: p.x, z: p.z });
    }
    step(g, {});
  }
  assert.ok(maxStep < 1.0, `no teleporting into shape (max step ${maxStep.toFixed(2)}m)`);
  const outlets = s.players.filter((p) => p.team === 0 && !p.keeper
    && Math.hypot(p.x - k.x, p.z - k.z) > 7 && Math.hypot(p.x - k.x, p.z - k.z) < 17
    && (p.x - k.x) * s.attack[0] > 2);
  assert.ok(outlets.length >= 2, `two short outlets open (got ${outlets.length})`);
  const spread = Math.abs(outlets[0].z - outlets[1].z);
  assert.ok(spread >= 6, `outlets separated across lanes (${spread.toFixed(1)}m)`);
});

test('P0.6 one lane camper does not kill the distribution', () => {
  const g = new MatchEngine(0, 180, 22);
  const s = g.state;
  s.phase = 'playing'; s.phaseTime = 0; s.restart = null; s.paused = false;
  for (const p of s.players) { p.vx = p.vz = 0; p.cooldown = 0; p.think = 100; }
  const k = s.players.find((p) => p.team === 0 && p.keeper)!;
  k.x = k.homeX; k.z = 0; k.vx = k.vz = 0; k.cooldown = 0;
  Object.assign(s.ball, {
    x: k.x + 0.5, z: 0, y: FIELD.ballRadius, vx: 0, vy: 0, vz: 0,
    owner: k.id, lastTouch: 0, lock: 0, lastKicker: null, flight: 'roll',
  });
  // One camper parks on the keeper's toes; the rest hold shape far away.
  const camper = s.players.find((p) => p.team === 1 && !p.keeper)!;
  camper.x = k.x + 3; camper.z = 0; camper.vx = camper.vz = 0; camper.think = 100;
  for (const p of s.players) if (p.team === 1 && !p.keeper && p.id !== camper.id) { p.x = 20; p.z = 20; p.think = 100; }
  for (let i = 0; i < 240; i++) step(g, {});
  const owner = s.ball.owner !== null ? s.players[s.ball.owner] : null;
  assert.ok(owner && owner.team === 0 && !owner.keeper, 'distribution reaches a teammate despite the camper');
});

test('P0.6 shape works symmetrically for both sides', () => {
  for (const side of [0, 1] as TeamId[]) {
    const g = new MatchEngine(0, 180, 30 + side);
    const s = g.state;
    s.phase = 'playing'; s.phaseTime = 0; s.restart = null; s.paused = false;
    for (const p of s.players) { p.vx = p.vz = 0; p.cooldown = 0; p.think = 100; }
    const carrier = s.players.filter((p) => p.team === side && !p.keeper)[3];
    carrier.x = side === 0 ? -6 : 6; carrier.z = 0;
    Object.assign(s.ball, {
      x: carrier.x + (side === 0 ? 0.7 : -0.7), y: FIELD.ballRadius, z: 0, vx: 0, vy: 0, vz: 0,
      owner: carrier.id, lastTouch: side, lock: 0, lastKicker: null, flight: 'roll',
    });
    for (let i = 0; i < 60; i++) step(g, {});
    const def = (1 - side) as TeamId;
    const press = s.players.filter((p) => p.team === def && !p.keeper
      && p.aiState === 'CHASE' && Math.hypot(p.x - s.ball.x, p.z - s.ball.z) < 7).length;
    assert.ok(press <= 1, `side ${side}: single presser (got ${press})`);
  }
});
