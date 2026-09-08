import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), 'utf8');

function pngSize(buf: Buffer, path: string): [number, number] {
  assert.deepEqual([...buf.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${path} is a PNG`);
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}

test('manifest is valid and installable', () => {
  const m = JSON.parse(read('public/manifest.webmanifest'));
  for (const k of ['name', 'short_name', 'start_url', 'display', 'background_color', 'theme_color', 'icons']) {
    assert.ok(m[k], `manifest has ${k}`);
  }
  assert.ok(['fullscreen', 'standalone'].includes(m.display));
  const sizes = (m.icons as Array<{ src: string; sizes: string }>).map((i) => i.sizes);
  assert.ok(sizes.includes('192x192') && sizes.includes('512x512'));
  for (const i of m.icons as Array<{ src: string }>) {
    assert.ok(existsSync(new URL(`public${i.src}`, root)), `icon file exists: ${i.src}`);
  }
});

test('icons are real PNGs at the declared sizes', () => {
  for (const [file, size] of [['public/icons/icon-192.png', 192], ['public/icons/icon-512.png', 512]] as const) {
    const buf = readFileSync(new URL(file, root));
    const [w, h] = pngSize(buf, file);
    assert.equal(w, size); assert.equal(h, size);
    assert.ok(buf.length > 1000, `${file} is not a stub (${buf.length} bytes)`);
  }
});

test('service worker caches the app shell and versions itself', () => {
  const sw = read('public/sw.js');
  for (const token of ['install', 'activate', 'fetch', 'skipWaiting', 'clients.claim', '/manifest.webmanifest', '/index.html']) {
    assert.ok(sw.includes(token), `sw.js mentions ${token}`);
  }
  const v = sw.match(/hnc-league-v\d+/);
  assert.ok(v, 'sw.js has a versioned cache name for clean upgrades');
});

test('index.html wires manifest, icons and mobile viewport', () => {
  const html = read('index.html');
  for (const token of [
    'rel="manifest"', 'manifest.webmanifest', 'apple-touch-icon', 'icon-192.png',
    'viewport-fit=cover', 'user-scalable=no', 'mobile-web-app-capable',
    'apple-mobile-web-app-capable', 'theme-color',
  ]) {
    assert.ok(html.includes(token), `index.html contains ${token}`);
  }
});
