import test from 'node:test';
import assert from 'node:assert/strict';
import { MatchEngine } from '../src/engine.ts';
import { SimulationClock, TICK_DT, MAX_CATCH_UP } from '../src/game/clock.ts';
import { EMPTY_INPUT, type InputFrame } from '../src/types.ts';
import { LoopbackTransport } from '../src/net/transport.ts';
import { NetDriver } from '../src/net/driver.ts';
import { checkVersions, localVersions } from '../src/net/signal.ts';

const DT = TICK_DT;

function playingSandbox(seed: number): MatchEngine {
  const g = new MatchEngine(0, 180, seed);
  g.setRemoteTeam(1);
  const s = g.state;
  s.phase = 'playing'; s.phaseTime = 0; s.restart = null; s.paused = false;
  return g;
}

/** Deterministic open-play driver: pure function of TICK index. */
function driveTick(tick: number): { input: InputFrame; peer: InputFrame } {
  return {
    input: {
      ...EMPTY_INPUT,
      x: tick % 120 < 60 ? 1 : -0.6, z: tick % 90 < 45 ? 0.3 : -0.3,
      sprint: tick % 3 === 0, pass: tick % 200 === 60,
      shootPressed: tick % 260 === 200, shootHeld: tick % 260 >= 200 && tick % 260 < 210,
      shootReleased: tick % 260 === 210, switchPlayer: tick % 120 === 90,
    },
    peer: {
      ...EMPTY_INPUT,
      x: tick % 100 < 50 ? -1 : 0.5, z: tick % 80 < 40 ? -0.2 : 0.2,
      sprint: tick % 4 === 0, pass: tick % 180 === 40,
      switchPlayer: tick % 140 === 70,
    },
  };
}

function runAtRenderRate(seed: number, fps: number, simSeconds: number): { ticks: number; hash: number } {
  const g = playingSandbox(seed);
  const clock = new SimulationClock();
  const wantTicks = Math.round(simSeconds / DT);
  let tick = 0;
  let guard = 0;
  // Render loop at `fps`, feeding elapsed render time into the match clock,
  // running until the exact tick count is reached.
  while (tick < wantTicks && guard++ < wantTicks * 10) {
    const due = clock.push(1 / fps);
    let first = true;
    for (let n = 0; n < due && tick < wantTicks; n++) {
      const d = driveTick(tick);
      // One physical edge per render frame: only the first catch-up tick sees edges.
      // All drive edges sit on even ticks, which are always frame-first, so the
      // tick-indexed input stream is identical at every render cadence.
      const strip = (f: InputFrame): InputFrame => first ? f : {
        ...f, pass: false, passReleased: false, shootPressed: false, shootReleased: false, switchPlayer: false,
      };
      g.update(DT, strip(d.input), strip(d.peer));
      g.events.splice(0);
      first = false;
      tick++;
    }
  }
  return { ticks: tick, hash: g.hash() };
}

for (const fps of [30, 60, 120, 144]) {
  test(`P0.1 render pacing: ${fps} Hz renders 10 real seconds as ~600 ticks`, () => {
    const { ticks } = runAtRenderRate(4242, fps, 10);
    assert.ok(Math.abs(ticks - 600) <= 4, `${fps}Hz produced ${ticks} ticks, want ~600`);
  });
}

test('P0.1 identical tick-indexed inputs hash equal at any render rate', () => {
  const hashes = [30, 60, 120, 144].map((fps) => runAtRenderRate(9182, fps, 5).hash);
  for (const h of hashes) assert.equal(h, hashes[0], 'render cadence never changes sim state');
});

test('P0.1 catch-up capped per frame; deep debt rebases instead of avalanching', () => {
  const clock = new SimulationClock();
  assert.equal(clock.push(5), MAX_CATCH_UP, 'a 5s stall steps at most 4 ticks');
  assert.equal(clock.push(0), 0, 'debt was rebased, not queued');
  assert.ok(clock.debt < 0.26, 'no unbounded debt retained');
  const c2 = new SimulationClock();
  assert.equal(c2.push(1 / 60), 1, 'normal frames step exactly once');
});

test('P0.1 online runs at sim speed on any render cadence (loopback)', () => {
  // Held-state stream varies per tick; different cadences sample it at
  // different frames, so cross-cadence runs need not be bit-identical —
  // they must advance at the same *speed*. Bit-identity is guaranteed by
  // exchanging the staged bytes (see mixed-cadence sync below).
  const held = (tick: number, flip: boolean): InputFrame => ({
    ...EMPTY_INPUT, x: flip ? -1 : 1, z: 0, sprint: tick % 3 === 0,
  });
  const run = (fps: number) => {
    const [ta, tb] = LoopbackTransport.pair();
    const host = new NetDriver(ta, { host: true, duration: 60 });
    const guest = new NetDriver(tb, { host: false, duration: 60 });
    ta.open(); tb.open();
    host.setReady(); guest.setReady();
    const frames = Math.round(6 * fps);
    for (let f = 0; f < frames; f++) {
      const t = host.session!.tick;
      const kick = (drv: NetDriver): Partial<InputFrame> => {
        const r = drv.session!.engine.state.restart;
        if (!r) return {};
        return r.team === drv.myTeam ? { pass: true, x: drv.myTeam === 0 ? 1 : -1, z: 0 } : {};
      };
      host.frame({ ...held(t, false), ...kick(host) }, 1 / fps);
      guest.frame({ ...held(t, true), ...kick(guest) }, 1 / fps);
    }
    const out = { tick: host.session!.tick, hash: host.session!.hash() };
    host.close(); guest.close();
    return out;
  };
  for (const fps of [30, 60, 120]) {
    const { tick } = run(fps);
    assert.ok(Math.abs(tick - 360) <= 6, `${fps}Hz online ticked ${tick}, want ~360`);
  }
});

test('P0.1 mixed-cadence peers stay bit-identical (30Hz host + 120Hz guest)', () => {
  const [ta, tb] = LoopbackTransport.pair();
  const host = new NetDriver(ta, { host: true, duration: 60 });
  const guest = new NetDriver(tb, { host: false, duration: 60 });
  ta.open(); tb.open();
  host.setReady(); guest.setReady();
  // 6 sim-seconds: host pumps 30Hz frames, guest 120Hz frames, interleaved.
  for (let f = 0; f < 720; f++) {
    const t = host.session!.tick;
    const kick = (drv: NetDriver): Partial<InputFrame> => {
      const r = drv.session!.engine.state.restart;
      if (!r) return {};
      return r.team === drv.myTeam ? { pass: true, x: drv.myTeam === 0 ? 1 : -1, z: 0 } : {};
    };
    if (f % 4 === 0) host.frame({ ...EMPTY_INPUT, x: 1, ...kick(host) }, 4 / 120);
    guest.frame({ ...EMPTY_INPUT, x: -1, ...kick(guest) }, 1 / 120);
  }
  // Drain in-flight inputs until both ends quiesce at the same tick.
  for (let f = 0; f < 120; f++) {
    if (f % 4 === 0) host.frame({ ...EMPTY_INPUT }, 4 / 120);
    guest.frame({ ...EMPTY_INPUT }, 1 / 120);
    if (host.session!.tick === guest.session!.tick && host.session!.tick >= 360) break;
  }
  assert.equal(host.session!.tick, guest.session!.tick, 'peers agree on tick');
  assert.equal(host.session!.hash(), guest.session!.hash(), 'peers agree on state');
  assert.equal(host.session!.desyncs, 0);
  host.close(); guest.close();
});

test('P0.1 events are exact-once across multi-tick catch-up pumps', () => {
  const [ta, tb] = LoopbackTransport.pair();
  const host = new NetDriver(ta, { host: true, duration: 60 });
  const guest = new NetDriver(tb, { host: false, duration: 60 });
  ta.open(); tb.open();
  host.setReady(); guest.setReady();
  // Force several ticks per pump by feeding large elapsed slices.
  for (let f = 0; f < 120; f++) {
    host.frame({ ...EMPTY_INPUT }, 1 / 30);
    guest.frame({ ...EMPTY_INPUT }, 1 / 30);
  }
  const drained = host.session!.drainEvents();
  assert.equal(host.session!.drainEvents().length, 0, 'drain consumes exactly once');
  // Every goal/whistle the engine produced over those ticks is present once.
  const engineGoals = drained.filter((e) => e.type === 'goal').length;
  assert.ok(engineGoals <= host.session!.engine.state.score[0] + host.session!.engine.state.score[1],
    'no duplicated goal events');
  host.close(); guest.close();
});

test('P0.1 version negotiation fails gracefully on mismatch', () => {
  assert.equal(checkVersions(localVersions()), null, 'matching versions pass');
  assert.ok(checkVersions({ ...localVersions(), sim: 999 }) !== null, 'sim mismatch caught');
  assert.ok(checkVersions({ ...localVersions(), input: 999 }) !== null, 'input mismatch caught');
  assert.ok(checkVersions({ ...localVersions(), tune: 'other' }) !== null, 'tuning mismatch caught');
});

test('P0.1 snapshot continuation covers tick + action state', () => {
  const a = playingSandbox(77);
  for (let f = 0; f < 150; f++) {
    const d = driveTick(f);
    a.update(DT, d.input, d.peer);
    a.events.splice(0);
  }
  const snap = a.snapshot();
  const ref = playingSandbox(77);
  for (let f = 0; f < 300; f++) {
    const d = driveTick(f);
    ref.update(DT, d.input, d.peer);
    ref.events.splice(0);
  }
  const resumed = new MatchEngine(0, 999, 12345);
  resumed.restore(snap);
  assert.equal(resumed.tick, 150, 'tick index survives the snapshot');
  for (let f = 150; f < 300; f++) {
    const d = driveTick(f);
    resumed.update(DT, d.input, d.peer);
    resumed.events.splice(0);
  }
  assert.equal(resumed.hash(), ref.hash(), 'restored continuation deterministic');
});
