import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { HNC_EXPORT_FIXTURES, buildHncExport, type HncExpected } from './interchange.ts';

/**
 * Runs inside headless Chromium (bundled by export.ts). The canonical number
 * and ball textures are painted with the browser Canvas API, exactly as in
 * the game — Node only has 1x1 fallbacks, which would silently lose them.
 */
export interface HncBrowserExport {
  assetId: string;
  purpose: string;
  sourceFactory: string;
  params: Record<string, string | number | boolean>;
  glbBase64: string;
  expected: HncExpected;
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

async function exportAll(): Promise<HncBrowserExport[]> {
  const exporter = new GLTFExporter();
  const out: HncBrowserExport[] = [];
  for (const fixture of HNC_EXPORT_FIXTURES) {
    const build = buildHncExport(fixture);
    // trs: separate translation/rotation/scale so Blender objects keep editable transforms.
    const glb = await exporter.parseAsync(build.root, { binary: true, trs: true, onlyVisible: true });
    out.push({
      assetId: fixture.assetId,
      purpose: fixture.purpose,
      sourceFactory: build.sourceFactory,
      params: build.params,
      glbBase64: toBase64(glb as ArrayBuffer),
      expected: build.expected,
    });
  }
  return out;
}

(globalThis as unknown as { hncExportAll: typeof exportAll }).hncExportAll = exportAll;
