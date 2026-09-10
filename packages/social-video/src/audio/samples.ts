import { readFileSync } from 'node:fs';

/**
 * Minimal deterministic WAV decoder + cache for real crowd/stadium samples.
 *
 * Runtime crowd assets are standardized ahead of time (48 kHz stereo 16-bit
 * PCM — see assets/audio/SOURCES.md), so the hot path is a straight PCM16
 * read. The decoder still accepts 8/16/24/32-bit PCM and 32/64-bit float,
 * mono or multi-channel, at any sample rate (linear resample fallback), so a
 * mis-standardized drop-in fails loudly in tests instead of silently.
 *
 * No randomness, no wall clocks: same file bytes → same float samples.
 */

export interface DecodedSample {
  sampleRate: number;
  channels: number;
  left: Float32Array;
  right: Float32Array;
}

function readAscii(view: DataView, offset: number, length: number): string {
  let s = '';
  for (let i = 0; i < length; i++) s += String.fromCharCode(view.getUint8(offset + i));
  return s;
}

/** Decode a complete WAV file buffer to normalized float stereo. */
export function decodeWav(data: Buffer | Uint8Array): DecodedSample {
  const bytes = data instanceof Buffer
    ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
    : data;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 44) throw new Error('decodeWav: file too short for a WAV header');
  if (readAscii(view, 0, 4) !== 'RIFF' || readAscii(view, 8, 4) !== 'WAVE') {
    throw new Error('decodeWav: not a RIFF/WAVE file');
  }
  let audioFormat = -1;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let dataOffset = -1;
  let dataLength = 0;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = readAscii(view, offset, 4);
    const size = view.getUint32(offset + 4, true);
    if (id === 'fmt ') {
      audioFormat = view.getUint16(offset + 8, true);
      channels = view.getUint16(offset + 10, true);
      sampleRate = view.getUint32(offset + 12, true);
      bitsPerSample = view.getUint16(offset + 22, true);
    } else if (id === 'data') {
      dataOffset = offset + 8;
      dataLength = size;
    }
    offset += 8 + size + (size % 2);
  }
  if (audioFormat !== 1 && audioFormat !== 3) {
    throw new Error(`decodeWav: unsupported audio format ${audioFormat} (want PCM 1 or float 3)`);
  }
  if (channels < 1) throw new Error('decodeWav: fmt chunk missing or channel count invalid');
  if (sampleRate <= 0) throw new Error('decodeWav: fmt chunk missing or sample rate invalid');
  if (![8, 16, 24, 32].includes(bitsPerSample)) {
    throw new Error(`decodeWav: unsupported bit depth ${bitsPerSample}`);
  }
  if (dataOffset < 0) throw new Error('decodeWav: data chunk missing');
  const bytesPerSample = bitsPerSample / 8;
  const frameCount = Math.floor(Math.min(dataLength, bytes.length - dataOffset) / (bytesPerSample * channels));
  if (frameCount <= 0) throw new Error('decodeWav: data chunk is empty');
  const left = new Float32Array(frameCount);
  const right = new Float32Array(frameCount);
  const readChannel = (frame: number, ch: number): number => {
    const at = dataOffset + (frame * channels + ch) * bytesPerSample;
    if (audioFormat === 3) {
      if (bitsPerSample === 32) return view.getFloat32(at, true);
      return view.getFloat64(at, true);
    }
    if (bitsPerSample === 8) return (view.getUint8(at) - 128) / 128;
    if (bitsPerSample === 16) return view.getInt16(at, true) / 32768;
    if (bitsPerSample === 24) {
      const b0 = view.getUint8(at);
      const b1 = view.getUint8(at + 1);
      const b2 = view.getInt8(at + 2);
      return (b2 * 65536 + b1 * 256 + b0) / 8388608;
    }
    return view.getInt32(at, true) / 2147483648;
  };
  for (let f = 0; f < frameCount; f++) {
    left[f] = readChannel(f, 0);
    right[f] = channels > 1 ? readChannel(f, 1) : left[f];
  }
  return { sampleRate, channels, left, right };
}

/** Linear resample to a target rate (fallback path; runtime assets match). */
export function resampleLinear(channel: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return channel;
  const outLen = Math.max(1, Math.round((channel.length * toRate) / fromRate));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = (i * channel.length) / outLen;
    const i0 = Math.floor(pos);
    const i1 = Math.min(channel.length - 1, i0 + 1);
    const frac = pos - i0;
    out[i] = channel[i0] * (1 - frac) + channel[i1] * frac;
  }
  return out;
}

const cache = new Map<string, DecodedSample>();

/**
 * Load (and cache) a crowd sample at an absolute path, resampled to
 * `targetRate` when necessary. Throws with the path in the message when the
 * file is missing or undecodable — callers convert that into an explicit
 * procedural fallback + warning, never silent substitution.
 */
export function loadCrowdSample(absPath: string, targetRate = 48000): DecodedSample {
  const key = `${absPath}@${targetRate}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let raw: Buffer;
  try {
    raw = readFileSync(absPath);
  } catch {
    throw new Error(`crowd asset not found on disk: ${absPath}`);
  }
  let decoded: DecodedSample;
  try {
    decoded = decodeWav(raw);
  } catch (error) {
    throw new Error(`crowd asset undecodable (${absPath}): ${error instanceof Error ? error.message : String(error)}`);
  }
  const sample: DecodedSample = decoded.sampleRate === targetRate
    ? decoded
    : {
      sampleRate: targetRate,
      channels: decoded.channels,
      left: resampleLinear(decoded.left, decoded.sampleRate, targetRate),
      right: resampleLinear(decoded.right, decoded.sampleRate, targetRate),
    };
  cache.set(key, sample);
  return sample;
}

/** Test hook: drop cached samples so fallback paths can be re-exercised. */
export function clearSampleCache(): void {
  cache.clear();
}
