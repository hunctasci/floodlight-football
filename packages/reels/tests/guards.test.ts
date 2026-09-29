/** Architecture guards: determinism and single-source HNC visuals. */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
const code = (file: string) => readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('guards', () => {
  it('no Math.random / Date.now in engine or render source', () => {
    for (const file of walk(path.join(root, 'src'))) {
      assert.ok(!code(file).includes('Math.random('), `${file} uses Math.random`);
      assert.ok(!code(file).includes('Date.now('), `${file} uses Date.now`);
    }
  });
  it('character / ball / stadium adapters author no geometry of their own', () => {
    for (const f of ['src/render/CastActor.tsx', 'src/render/HncPortrait.tsx', 'src/worlds/football/FootballScene.tsx']) {
      const src = code(path.join(root, f));
      assert.ok(!/<(cylinder|icosahedron|sphere|box)Geometry/.test(src), `${f} recreates HNC geometry`);
      assert.ok(src.includes('createHncPlayerVisual') || src.includes('createHncStadium'), `${f} must mount canonical visuals`);
    }
  });
  it('every 3D shot uses the canonical tone mapping + exposure', () => {
    const src = code(path.join(root, 'src/render/ShotLayer.tsx'));
    assert.ok(src.includes('ACESFilmicToneMapping') && src.includes('HNC_RENDER_PROFILE.toneMappingExposure'));
  });
  it('the engine core stays React-free (Node-evaluable for QA)', () => {
    for (const dir of ['src/engine', 'src/camera', 'src/cast', 'src/transitions']) {
      for (const file of walk(path.join(root, dir))) {
        if (file.endsWith('.tsx')) continue;
        assert.ok(!/from 'react'|from 'remotion'/.test(code(file)), `${file} imports React/Remotion`);
      }
    }
  });
});
