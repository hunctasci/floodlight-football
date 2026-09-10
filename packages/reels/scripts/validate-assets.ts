#!/usr/bin/env tsx
/** reels:asset:validate — manifest checks + bundled-file existence. */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASSET_MANIFEST } from '../src/assets/manifest';
import { validateAssetManifest } from '../src/assets/validate';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let failed = false;
for (const issue of validateAssetManifest()) {
  // eslint-disable-next-line no-console
  console.log(`[${issue.level}] ${issue.message}`);
  if (issue.level === 'error') failed = true;
}
for (const entry of ASSET_MANIFEST) {
  if (!entry.bundled) continue;
  const full = path.join(root, 'public/assets', entry.file);
  if (!existsSync(full)) {
    // eslint-disable-next-line no-console
    console.log(`[error] Bundled asset missing on disk: ${entry.id} -> ${full}`);
    failed = true;
  }
}
// eslint-disable-next-line no-console
console.log(failed ? 'ASSET VALIDATION FAILED' : `OK: ${ASSET_MANIFEST.length} manifest entries`);
process.exit(failed ? 1 : 0);
