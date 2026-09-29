/**
 * Load a ContentSpec by registered id (src/content) or from a file path
 * (.json, or a .ts module whose default / first export is the spec).
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CONTENT } from '../../src/content';
import type { ContentSpec } from '../../src/engine/spec/types';

export async function loadContent(ref: string | undefined): Promise<ContentSpec> {
  if (!ref) throw new Error(`--content is required (registered: ${Object.keys(CONTENT).join(', ')}, or a .json/.ts path)`);
  if (CONTENT[ref]) return CONTENT[ref];
  const file = path.resolve(ref);
  if (!existsSync(file)) throw new Error(`Unknown content "${ref}" (registered: ${Object.keys(CONTENT).join(', ')})`);
  if (file.endsWith('.json')) return JSON.parse(readFileSync(file, 'utf8')) as ContentSpec;
  const mod = (await import(pathToFileURL(file).href)) as Record<string, unknown>;
  const spec = (mod.default ?? Object.values(mod)[0]) as ContentSpec | undefined;
  if (!spec?.scenes) throw new Error(`${ref} does not export a ContentSpec`);
  return spec;
}
