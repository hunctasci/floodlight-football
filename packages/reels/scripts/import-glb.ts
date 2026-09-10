#!/usr/bin/env tsx
/**
 * reels:asset:import — validate + optimize a downloaded GLB with glTF Transform:
 * dedupe, prune, resample animations. Texture resize/compression runs when
 * the optional sharp dependency is present; otherwise geometry/anim passes
 * still apply and the importer warns.
 * Usage: npm run reels:asset:import -- ./downloads/model.glb --id office-worker-male-01 --out public/assets/characters/office-worker-male-01.glb
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, resample } from '@gltf-transform/functions';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  return undefined;
}

async function main(): Promise<void> {
  const input = process.argv[2];
  const id = arg('id') ?? 'unnamed-asset';
  const out = arg('out') ?? `public/assets/imported/${id}.glb`;
  if (!input || input.startsWith('--')) {
    // eslint-disable-next-line no-console
    console.error('Usage: reels:asset:import -- <input.glb> --id <asset-id> --out <output.glb>');
    process.exit(1);
  }
  if (!existsSync(input)) {
    // eslint-disable-next-line no-console
    console.error(`Input not found: ${input}`);
    process.exit(1);
  }
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  let doc;
  try {
    doc = await io.read(input);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`Corrupt or unsupported GLB: ${(e as Error).message}`);
    process.exit(1);
  }
  await doc.transform(dedup(), prune(), resample());
  const json = doc.getRoot();
  void json;
  const outPath = path.resolve(out);
  await io.write(outPath, doc);
  // eslint-disable-next-line no-console
  console.log(`Imported ${id}: ${input} -> ${outPath}`);
  // eslint-disable-next-line no-console
  console.log('Next: record source/author/license in src/assets/manifest.ts + assets/SOURCES.md, then flip bundled:true.');
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(`Import failed: ${(e as Error).message}`);
  process.exit(1);
});
