/** Agent-facing docs stay truthful: the AGENTS.md example and JSON specs validate. */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateContent } from '../src/engine/director/validate';
import type { ContentSpec } from '../src/engine/spec/types';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const errors = (s: ContentSpec) => validateContent(s).filter((i) => i.level === 'error');

describe('docs', () => {
  it('the AGENTS.md example spec is valid', () => {
    const md = readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
    const json = /```json\n([\s\S]*?)```/.exec(md)![1];
    assert.deepEqual(errors(JSON.parse(json) as ContentSpec), []);
  });
  it('every JSON spec in specs/ is valid', () => {
    for (const f of readdirSync(path.join(root, 'specs')).filter((x) => x.endsWith('.json'))) {
      assert.deepEqual(errors(JSON.parse(readFileSync(path.join(root, 'specs', f), 'utf8')) as ContentSpec), [], f);
    }
  });
});
