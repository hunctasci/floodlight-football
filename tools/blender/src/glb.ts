/**
 * Minimal GLB 2.0 reader (JSON + BIN chunks) — enough to verify exported
 * structure and pull embedded images without adding a glTF dependency.
 */
export interface GltfJson {
  asset: { version: string; generator?: string };
  scenes?: { nodes?: number[]; name?: string }[];
  nodes?: { name?: string; children?: number[]; mesh?: number; extras?: Record<string, unknown> }[];
  meshes?: { name?: string; primitives: { attributes: Record<string, number>; material?: number }[] }[];
  materials?: {
    name?: string;
    pbrMetallicRoughness?: {
      baseColorFactor?: number[];
      baseColorTexture?: { index: number };
      roughnessFactor?: number;
      metallicFactor?: number;
    };
    alphaMode?: string;
    extensions?: Record<string, unknown>;
  }[];
  textures?: { source?: number }[];
  images?: { bufferView?: number; mimeType?: string; uri?: string }[];
  bufferViews?: { buffer: number; byteOffset?: number; byteLength: number }[];
  extensionsUsed?: string[];
}

export interface Glb {
  json: GltfJson;
  bin: Buffer;
}

export function parseGlb(buf: Buffer): Glb {
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB (bad magic)');
  if (buf.readUInt32LE(4) !== 2) throw new Error(`unsupported GLB version ${buf.readUInt32LE(4)}`);
  if (buf.readUInt32LE(8) !== buf.length) throw new Error('GLB length header mismatch');
  let offset = 12;
  let json: GltfJson | null = null;
  let bin = Buffer.alloc(0);
  while (offset < buf.length) {
    const len = buf.readUInt32LE(offset);
    const type = buf.readUInt32LE(offset + 4);
    const data = buf.subarray(offset + 8, offset + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(data.toString('utf8')) as GltfJson;
    else if (type === 0x004e4942) bin = Buffer.from(data);
    offset += 8 + len;
  }
  if (!json) throw new Error('GLB has no JSON chunk');
  return { json, bin };
}

/** Bytes of an embedded image (bufferView-backed, as GLTFExporter writes in binary mode). */
export function glbImageBytes(glb: Glb, imageIndex: number): Buffer {
  const image = glb.json.images?.[imageIndex];
  if (!image || image.bufferView === undefined) throw new Error(`image ${imageIndex} is not embedded`);
  const view = glb.json.bufferViews![image.bufferView];
  const start = view.byteOffset ?? 0;
  return glb.bin.subarray(start, start + view.byteLength);
}

/** Width/height from a PNG IHDR chunk. */
export function pngSize(png: Buffer): { width: number; height: number } {
  if (png.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

/** Material name → embedded base-colour image index. */
export function materialImages(glb: Glb): { material: string; image: number }[] {
  const out: { material: string; image: number }[] = [];
  for (const m of glb.json.materials ?? []) {
    const tex = m.pbrMetallicRoughness?.baseColorTexture;
    const image = tex ? glb.json.textures?.[tex.index]?.source : undefined;
    if (image !== undefined) out.push({ material: m.name ?? '', image });
  }
  return out;
}
