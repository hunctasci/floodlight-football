import test from 'node:test';
import assert from 'node:assert/strict';
import { AD_H, AD_W, FIELD_ADS, adForSlot, paintAd } from '../src/render/ads';

// Boards-only sponsor rotation: LinkedIn + GitHub, alternating slots.
test('field ads carry the owner LinkedIn + GitHub identities', () => {
  assert.equal(FIELD_ADS.length, 2);
  const li = FIELD_ADS[0];
  assert.equal(li.id, 'linkedin');
  assert.ok(li.url.includes('linkedin.com/in/hunctasci'));
  assert.equal(li.handle, '/in/hunctasci');
  const gh = FIELD_ADS[1];
  assert.equal(gh.id, 'github');
  assert.ok(gh.url.includes('github.com/hunctasci'));
  assert.equal(gh.handle, '@hunctasci');
  for (const ad of FIELD_ADS) {
    assert.ok(ad.title.length > 0 && ad.cta.length > 0);
    assert.match(ad.base, /^#[0-9A-Fa-f]{6}$/);
  }
});

test('board slots alternate LinkedIn / GitHub', () => {
  assert.equal(adForSlot(0).id, 'linkedin');
  assert.equal(adForSlot(1).id, 'github');
  assert.equal(adForSlot(2).id, 'linkedin');
  assert.equal(adForSlot(7).id, 'github');
});

test('board texture is 8:1 for the 9.6m x 1.15m mesh', () => {
  assert.equal(AD_W, 1024);
  assert.equal(AD_H, 128);
});

// Headless painter smoke test: fake 2D context records calls, no DOM needed.
test('paintAd fills the brand base and labels the CTA', () => {
  for (const ad of FIELD_ADS) {
    const calls: string[] = [];
    const texts: string[] = [];
    const fake = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      font: '',
      textAlign: '',
      textBaseline: '',
      fillRect: (...a: unknown[]) => calls.push(`fillRect ${a.join(',')}:${String(fake.fillStyle)}`),
      strokeRect: () => calls.push('strokeRect'),
      beginPath: () => calls.push('begin'),
      closePath: () => calls.push('close'),
      moveTo: () => calls.push('move'),
      lineTo: () => calls.push('line'),
      arc: () => calls.push('arc'),
      arcTo: () => calls.push('arcTo'),
      stroke: () => calls.push(`stroke:${String(fake.strokeStyle)}`),
      fill: () => calls.push(`fill:${String(fake.fillStyle)}`),
      fillText: (t: string) => texts.push(t),
      measureText: (t: string) => ({ width: t.length * 18 }),
    };
    paintAd(fake as unknown as CanvasRenderingContext2D, ad, AD_W, AD_H);
    assert.ok(
      calls.some((c) => c.includes(`fillRect 0,0,${AD_W},${AD_H}:${ad.base}`)),
      `${ad.id} paints its brand base first`,
    );
    assert.ok(texts.some((t) => t.includes(ad.title)), `${ad.id} paints its title`);
    assert.ok(texts.some((t) => t.includes(ad.handle)), `${ad.id} paints its handle`);
    assert.ok(texts.includes(ad.cta), `${ad.id} paints its CTA chip`);
  }
});
