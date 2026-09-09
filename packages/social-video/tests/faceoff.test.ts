import test from 'node:test';
import assert from 'node:assert/strict';
import { countryTeams } from '../../../apps/game/src/city-league/kits.ts';
import { resolveSpec } from '../src/schema.ts';
import { compileFaceoff } from '../src/scenes/faceoff.ts';
import { faceoffCamera } from '../src/cameras/social-camera.ts';

const spec = () => resolveSpec({ scene: 'faceoff', home: 'TR', away: 'GR', seed: 42 });

test('faceoff uses the canonical game kits (no duplicated colours)', () => {
  const [homeTeam, awayTeam] = countryTeams('TR', 'GR');
  const { state } = compileFaceoff(spec());
  assert.deepEqual(state.teams, [homeTeam, awayTeam]);
  assert.equal(state.teams[0].color, '#e30a17');
  assert.equal(state.teams[1].color, '#0d5eaf');
});

test('faceoff stages two idle outfielders around the ball', () => {
  const { state } = compileFaceoff(spec());
  assert.equal(state.players.length, 2);
  for (const p of state.players) {
    assert.equal(p.keeper, false);
    assert.equal(p.action, 'idle');
    assert.equal(p.vx, 0);
    assert.equal(p.vz, 0);
  }
  assert.equal(state.players[0].team, 0);
  assert.equal(state.players[1].team, 1);
  // Opposed across the centre spot: home left/front, away right/back.
  assert.ok(state.players[0].x < 0 && state.players[1].x > 0);
  assert.equal(state.ball.x, 0);
  assert.equal(state.ball.z, 0);
  assert.equal(state.ball.owner, null);
});

test('faceoff players face each other', () => {
  const { state } = compileFaceoff(spec());
  const [home, away] = state.players;
  const hx = away.x - home.x, hz = away.z - home.z;
  const dot = home.facingX * hx + home.facingZ * hz;
  assert.ok(dot > 0, 'home faces away');
  const back = away.facingX * hx + away.facingZ * hz;
  assert.ok(back < 0, 'away faces home');
});

test('faceoff camera is a genuine portrait composition', () => {
  const cam = faceoffCamera();
  assert.ok(cam.fov >= 40 && cam.fov <= 65, `fov=${cam.fov}`);
  assert.ok(cam.pos.y >= 2 && cam.pos.y <= 6, `low-ish camera, y=${cam.pos.y}`);
  // On the near touchline looking toward the far stand (crowd in background).
  assert.ok(cam.pos.z > 5, `z=${cam.pos.z}`);
  assert.ok(cam.look.z < cam.pos.z, 'looking up-pitch');
  assert.ok(cam.look.y < cam.pos.y, 'looking slightly down with headroom above');
});

test('compile is deterministic per seed and varies across seeds', () => {
  const a = compileFaceoff(spec());
  const b = compileFaceoff(spec());
  assert.deepEqual(a, b);
  const other = compileFaceoff(resolveSpec({ scene: 'faceoff', home: 'TR', away: 'GR', seed: 7 }));
  assert.notDeepEqual(
    [other.state.players[0].x, other.state.players[0].z],
    [a.state.players[0].x, a.state.players[0].z],
  );
});
