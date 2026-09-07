import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '..', 'src', 'style.css'), 'utf8');
const mainSrc = readFileSync(join(here, '..', 'src', 'main.ts'), 'utf8');

// Uppercase is enforced at the display layer (values/logic untouched).
test('arcade uppercase covers menus, panels and touch controls', () => {
  for (const sel of ['.menu-item', '.eyebrow', '.title', '.subtitle', '.hint', '.tbtn']) {
    assert.ok(css.includes(sel), `stylesheet mentions ${sel}`);
  }
  const upperBlock = css.slice(css.indexOf('ARCADE LOOK'));
  assert.ok(upperBlock.includes('text-transform:uppercase'), 'uppercase enforced in display layer');
});

// Code/score inputs render consistently and never resize the layout.
test('inputs are non-resizable with visible focus and code letterspacing', () => {
  assert.ok(css.includes('resize:none'), 'no resize handles on inputs');
  assert.ok(css.includes(':focus'), 'visible focus style exists');
  assert.ok(css.includes('.scorebox'), 'score boxes styled');
  // The shareable invite URL keeps its natural casing (origin is lowercase).
  assert.ok(css.includes('#invitelink'), 'invite link exempted from uppercasing');
});

// Mobile: 16px+ inputs stop iOS Safari auto-zoom on focus.
test('coarse-pointer inputs stay at readable sizes', () => {
  const coarse = css.slice(css.indexOf('@media(pointer:coarse)'));
  assert.ok(coarse.includes('font-size:16px'), 'mobile inputs use 16px+');
});

// Mobile keyboards must not autocorrect room/league codes; scores get digits.
test('code inputs disable autocorrect, scores request numeric entry', () => {
  for (const id of ['id="netcode"', 'id="lgcode"']) {
    // Attributes follow the id within the same tag — slice forward to </textarea>.
    const start = mainSrc.indexOf(id);
    const tag = mainSrc.slice(start, mainSrc.indexOf('</textarea>', start));
    assert.ok(tag.includes('autocapitalize="characters"'), `${id} forces caps keyboard`);
    assert.ok(tag.includes('autocomplete="off"'), `${id} disables autocomplete`);
    assert.ok(tag.includes('autocorrect="off"'), `${id} disables autocorrect`);
    assert.ok(tag.includes('spellcheck="false"'), `${id} disables spellcheck`);
  }
  for (const id of ['id="scoreH"', 'id="scoreA"']) {
    const start = mainSrc.indexOf(id);
    const tag = mainSrc.slice(start, mainSrc.indexOf('</textarea>', start));
    assert.ok(tag.includes('inputmode="numeric"'), `${id} requests numeric keyboard`);
  }
});
