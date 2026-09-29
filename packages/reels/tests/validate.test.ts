import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CONTENT } from '../src/content';
import { validateContent } from '../src/engine/director/validate';
import type { ContentSpec } from '../src/engine/spec/types';

const base = (): ContentSpec => JSON.parse(JSON.stringify(CONTENT['office-rivalry'])) as ContentSpec;
const errors = (s: ContentSpec) => validateContent(s).filter((i) => i.level === 'error');

describe('validation', () => {
  it('every registered piece validates without errors', () => {
    for (const spec of Object.values(CONTENT)) assert.deepEqual(errors(spec), [], spec.id);
  });
  it('unknown vocabulary is an error with a did-you-mean', () => {
    const s = base();
    s.scenes[0].beats[2].camera = 'clsoe:hero';
    (s.scenes[0].beats[2].cast!.hero.do as { do: string }[])[0].do = 'side-eyes';
    s.scenes[0].beats[1].sound = ['tension-rsie'];
    const msgs = errors(s).map((e) => e.message).join('\n');
    assert.match(msgs, /unknown lens .*"clsoe".*did you mean "close"/);
    assert.match(msgs, /unknown action "side-eyes".*did you mean "side-eye"/);
    assert.match(msgs, /unknown sound cue "tension-rsie".*did you mean "tension-rise"/);
  });
  it('subjects, marks, countries and transitions are checked', () => {
    const s = base();
    s.cast.hero.country = 'XX';
    s.scenes[0].beats[0].cast!.hero.at = 'desk-z';
    s.scenes[0].beats[1].camera = 'macro:desk-q-flag';
    s.scenes[1].enter = { type: 'light-bloom', from: 'ceiling-light' };
    const msgs = errors(s).map((e) => `${e.path}: ${e.message}`).join('\n');
    assert.match(msgs, /country "XX"/);
    assert.match(msgs, /unknown mark in office "desk-z"/);
    assert.match(msgs, /unknown subject "desk-q-flag"/);
    assert.match(msgs, /light-bloom needs "to"/);
  });
  it('timing errors surface from compile with the beat', () => {
    const s = base();
    s.scenes[1].beats[2].fx = [{ type: 'impact-burst', at: 'moment:nowhere' }];
    assert.match(errors(s).map((e) => e.message).join('\n'), /Unknown moment beat/);
  });
  it('creative lint warns on slow hooks, unreadable text and missing brand', () => {
    const s = base();
    s.scenes[0].beats[0].duration = 3;
    s.scenes[0].beats[0].text = [{ say: 'this caption has far too many words to read in the time it is on screen', style: 'pov' }];
    s.scenes = s.scenes.slice(0, 3);
    delete s.keyArt;
    const warns = validateContent(s).filter((i) => i.level === 'warn').map((w) => w.message).join('\n');
    assert.match(warns, /hook runs/);
    assert.match(warns, /hard to read/);
    assert.match(warns, /no HNC brand moment/);
  });
});
