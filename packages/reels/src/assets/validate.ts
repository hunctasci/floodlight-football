import { ASSET_MANIFEST } from './manifest';

export interface AssetValidationIssue {
  level: 'error' | 'warn';
  message: string;
}

/** Manifest-level checks: duplicate ids, missing files, license metadata. Pure. */
export function validateAssetManifest(): AssetValidationIssue[] {
  const issues: AssetValidationIssue[] = [];
  const seen = new Set<string>();
  for (const entry of ASSET_MANIFEST) {
    if (seen.has(entry.id)) {
      issues.push({ level: 'error', message: `Duplicate asset id: ${entry.id}` });
    }
    seen.add(entry.id);
    if (!entry.file || entry.file.length === 0) {
      issues.push({ level: 'error', message: `Asset ${entry.id} has no file.` });
    }
    if (entry.file.includes('..')) {
      issues.push({ level: 'error', message: `Asset ${entry.id} file must be package-relative (no ..).` });
    }
    if (!entry.bundled && !entry.proceduralFallback && entry.type !== 'animation') {
      issues.push({ level: 'warn', message: `Asset ${entry.id} is unbundled with no procedural fallback.` });
    }
    if (entry.bundled && !entry.license) {
      issues.push({ level: 'warn', message: `Bundled asset ${entry.id} is missing license metadata.` });
    }
  }
  return issues;
}
