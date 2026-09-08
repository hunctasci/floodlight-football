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
  // The grouped room code keeps its inner space (letterspaced display).
  assert.ok(css.includes('room-code'), 'room-code display rule exists');
});

// Mobile: 16px+ inputs stop iOS Safari auto-zoom on focus.
test('coarse-pointer inputs stay at readable sizes', () => {
  const coarse = css.slice(css.indexOf('@media(pointer:coarse)'));
  assert.ok(coarse.includes('font-size:16px'), 'mobile inputs use 16px+');
});

// Lobby waiting readout: spinner + ROOM→FRIEND/JOIN→LINK→READY stages.
test('waiting screens show a spinner and progress stages', () => {
  assert.ok(mainSrc.includes('waitSteps()'), 'host/joining panels render progress');
  assert.ok(mainSrc.includes('data-testid="wait-steps"'), 'steps are test-targetable');
  assert.ok(mainSrc.includes('data-testid="wait-spinner"'), 'spinner is test-targetable');
  assert.ok(css.includes('.waitspinner'), 'spinner styled');
  assert.ok(css.includes('@keyframes wwaitspin'), 'spinner animates without assets');
  assert.ok(css.includes('.wstep'), 'stage steps styled');
  assert.ok(css.includes('prefers-reduced-motion'), 'motion-sensitive users respected');
  // The step template once shipped a missing closing quote, which made the
  // parser swallow the invite textarea into a span (no usable invite field).
  assert.ok(
    mainSrc.includes(`' active' : ''}">`),
    'step spans close their class attribute before >',
  );
});

// The join-code field is a full, centered block — the narrow scorebox class is
// reserved for the 0-99 score inputs. The host code renders grouped (ABC DEF)
// with wide letterspacing for read-out.
test('join-code field is a centered block; host code displays grouped', () => {
  const codeTag = mainSrc.slice(mainSrc.indexOf('id="netcode"') - 60, mainSrc.indexOf('id="netcode"') + 40);
  assert.ok(!codeTag.includes('scorebox'), 'join code must not use scorebox');
  assert.ok(!codeTag.includes('style='), 'join code width comes from CSS, not inline styles');
  assert.ok(css.includes('#netcode'), 'join code has dedicated layout rules');
  assert.ok(css.includes('margin:8px auto') || css.includes('margin: 8px auto'), 'join code is horizontally centered');
  assert.ok(mainSrc.includes('formatRoomCode(roomCode)'), 'host code renders grouped');
  assert.ok(css.includes('room-code'), 'grouped code has display rules');
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

// Landscape-by-default on phones: kickoff asks for a landscape lock (PWA +
// supporting browsers), the title hub releases it, portrait matches show a
// non-blocking rotate nudge instead of forcing anything.
test('orientation lock is attempted on match, released on title', () => {
  assert.ok(mainSrc.includes("o.lock('landscape')"), 'kickoff requests landscape');
  assert.ok(mainSrc.includes('o.unlock()'), 'title hub releases the lock');
  assert.ok(mainSrc.includes('fitOrientation()'), 'orientation reconciled in the frame loop');
  assert.ok(mainSrc.includes('rotate-hint'), 'portrait nudge rendered in-match');
  assert.ok(css.includes('.rotate-hint'), 'nudge styled');
});

// Menus are fluid: vmin-based titles/padding, panels never exceed the
// viewport, no fixed-pixel title sizes that overflow small screens.
test('menus resize with the screen instead of overflowing', () => {
  assert.ok(!mainSrc.includes('style="font-size:'), 'no fixed-pixel title sizes');
  for (const cls of ['.txl', '.tlg', '.tmd', '.tsm']) {
    assert.ok(css.includes(cls), `${cls} fluid title variant exists`);
  }
  assert.ok(css.includes('max-height'), 'panel bounded by viewport height');
  assert.ok(css.includes('100dvh') || css.includes('100dvh'), 'dynamic viewport used');
  assert.ok(css.includes('safe-area-inset'), 'notches and home bars respected');
});
