/** Autumn 2026 campaign: contracts the ten pieces rely on. */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compileContent } from '../src/engine/director/compile';
import { validateContent } from '../src/engine/director/validate';
import { qaTimeline } from '../src/engine/qa';
import { resolveCastSpec } from '../src/cast/people';
import { upper } from '../src/graphics/case';
import { countryTeams } from '../../../apps/game/src/city-league/kits';
import { CAMPAIGN } from '../src/content/autumn-2026/campaign';
import { POSTERS } from '../src/content/autumn-2026/posters';
import { sampleFootballMoment } from '../src/worlds/football/choreography';
import { FREE_KICK } from '../src/worlds/football/free-kick';
import { MIDNIGHT } from '../src/worlds/football/midnight-penalty';
import { cupFloorFrame, cupState } from '../src/worlds/breakroom/state';
import { COFFEE_MACHINE } from '../src/content/autumn-2026/02-coffee-machine';

describe('autumn 2026 campaign', () => {
  it('has ten vertical 60 fps masters of 8–16 s, each with a poster and alt text', () => {
    assert.equal(CAMPAIGN.length, 10);
    for (const item of CAMPAIGN) {
      const tl = compileContent(item.reel, { format: 'reel' });
      assert.equal(tl.width, 1080);
      assert.equal(tl.height, 1920);
      assert.equal(tl.fps, 60, item.dir);
      const secs = tl.totalFrames / tl.fps;
      assert.ok(secs >= 8 && secs <= 16, `${item.dir} runs ${secs}s`);
      assert.deepEqual(validateContent(item.reel).filter((i) => i.level === 'error'), [], item.dir);
      assert.deepEqual(qaTimeline(tl).filter((q) => q.level === 'error'), [], item.dir);
      const poster = POSTERS[item.poster];
      assert.ok(poster, `${item.dir} has a poster`);
      assert.ok(poster.alt.length > 60, `${item.dir} poster alt text`);
    }
  });
  it('recurring people keep one identity everywhere', () => {
    const emre = resolveCastSpec({ person: 'emre', look: 'kit' });
    assert.equal(emre.country, 'TR');
    assert.equal(emre.number, 9);
    assert.equal(emre.look, 'kit');
    for (const item of CAMPAIGN) {
      for (const c of Object.values(item.reel.cast)) if (c.person === 'emre') assert.equal(resolveCastSpec(c).number, 9);
    }
  });
  it('uppercases Turkish correctly and English as English', () => {
    assert.equal(upper('Italy vs Türkiye'), 'ITALY VS TÜRKİYE');
    assert.equal(upper('cumhuriyet', 'tr'), 'CUMHURİYET');
  });
  it('football kits follow the game clash rule (both red → away changes)', () => {
    const [tr, be] = countryTeams('TR', 'BE');
    assert.notEqual(be.color, '#ef3340');
    const [be2, tr2] = countryTeams('BE', 'TR');
    assert.equal(be2.color, '#ef3340');
    assert.notEqual(tr2.color, tr.color);
  });
  it('free kick: the ball waits on the spot (spinning) and flies under the bar into the net', () => {
    const before = sampleFootballMoment('free-kick', FREE_KICK.contact - 0.1);
    assert.ok(before.ballSpin, 'spins before the kick');
    const line = sampleFootballMoment('free-kick', FREE_KICK.goalLine);
    assert.ok(line.ball.y < 2.8 - 0.25 && Math.abs(line.ball.z) < 4.4, 'inside the canonical goal frame');
  });
  it('midnight penalty: while it is dark the keeper moves beside the striker, ball in hand', () => {
    const after = sampleFootballMoment('midnight-penalty', MIDNIGHT.swap + 0.5);
    const [striker, keeper] = after.actors;
    assert.ok(Math.hypot(striker.x - keeper.x, striker.z - keeper.z) < 1.6);
    assert.ok(after.ball.y > 0.8, 'ball held at the chest');
  });
  it('the dropped cup free-falls to the floor on the frame the match cut lands', () => {
    const tl = compileContent(COFFEE_MACHINE);
    const shot = tl.shots.find((s) => s.fx.some((e) => e.type === 'cup-tip'))!;
    const tip = shot.fx.find((e) => e.type === 'cup-tip')!;
    const land = cupFloorFrame(tl.fps, tip.start);
    const pitch = tl.shots.find((s) => s.scene === 'pitch')!;
    assert.ok(Math.abs(land - pitch.start) <= 2, `cup lands at ${land}, cut at ${pitch.start}`);
    assert.ok(cupState(tl, shot, land + 1, tl.fps).onFloor);
  });
});
