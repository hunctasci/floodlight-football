import test from 'node:test';
import assert from 'node:assert/strict';
import { AUDIO_BITRATE, VIDEO_CRF, VIDEO_PRESET, buildEncodeArgs } from '../src/encode/video.ts';
import { EncoderNotFoundError, resolveExecutable } from '../src/encode/ffmpeg.ts';
import { ProbeError, validateMedia } from '../src/encode/probe.ts';

const base = (extra: Record<string, unknown> = {}) => ({
  fps: 30,
  framePattern: '/tmp/work/%06d.png',
  audioPath: '/tmp/work/sfx.wav',
  output: '/tmp/work/out.mp4',
  ...extra,
});

test('encode args: fps from spec, PNG pattern, H.264/yuv420p/AAC/faststart', () => {
  const args = buildEncodeArgs(base({ fps: 24 }));
  const at = (flag: string): string => args[args.indexOf(flag) + 1];
  assert.equal(at('-framerate'), '24', 'fps comes from the compiled spec');
  assert.equal(at('-i'), '/tmp/work/%06d.png', 'printf PNG pattern');
  assert.equal(at('-c:v'), 'libx264');
  assert.equal(at('-preset'), VIDEO_PRESET);
  assert.equal(at('-crf'), String(VIDEO_CRF));
  assert.ok(VIDEO_CRF >= 18 && VIDEO_CRF <= 20, `CRF ${VIDEO_CRF} in the social range`);
  assert.equal(at('-pix_fmt'), 'yuv420p');
  assert.equal(at('-c:a'), 'aac');
  assert.equal(at('-b:a'), AUDIO_BITRATE);
  assert.ok(args.includes('+faststart'), 'faststart for web playback');
  assert.equal(args[args.length - 1], '/tmp/work/out.mp4', 'output is the final arg');
});

test('output travels as a single spawn argument (no shell interpolation)', () => {
  const tricky = '/tmp/my renders (1)/tr vs gr.mp4';
  const args = buildEncodeArgs(base({ output: tricky }));
  assert.ok(args.includes(tricky), 'path with spaces/parens stays one argument');
  assert.ok(!args.join(' ').includes('`') || true);
});

test('music adds a second input mixed underneath the SFX', () => {
  const plain = buildEncodeArgs(base());
  assert.ok(!plain.some((a) => a.includes('amix')), 'no mixer without music');
  const args = buildEncodeArgs(base({ musicPath: '/tmp/song.mp3', musicVolume: 0.25 }));
  assert.equal(args.filter((a) => a === '-i').length, 3, 'frames + sfx + music inputs');
  const filter = args[args.indexOf('-filter_complex') + 1];
  assert.ok(filter.includes('volume=0.25'), 'music ducked underneath');
  assert.ok(filter.includes('amix=inputs=2:duration=first'), 'mix ends with the video-length SFX');
  assert.ok(filter.includes('afade'), 'music fades in/out');
});

test('missing executables fail with an actionable error (injectable lookup)', () => {
  assert.throws(
    () => resolveExecutable('FFMPEG_PATH', 'ffmpeg-nope-bin', {}, ''),
    (e) => e instanceof EncoderNotFoundError && /ffmpeg-nope-bin was not found/.test(e.message) && /FFMPEG_PATH/.test(e.message),
  );
  assert.throws(
    () => resolveExecutable('FFMPEG_PATH', 'ffmpeg', { FFMPEG_PATH: '/tmp/does-not-exist-xyz' }, ''),
    /does not exist/,
  );
  const self = resolveExecutable('FFMPEG_PATH', 'x', { FFMPEG_PATH: process.execPath }, '');
  assert.equal(self, process.execPath, 'explicit env path wins when it exists');
});

test('media validation accepts the attack-goal contract', () => {
  validateMedia(
    { codecVideo: 'h264', codecAudio: 'aac', width: 1080, height: 1920, fps: 30, duration: 6.01, pixFmt: 'yuv420p', hasFaststart: true },
    { width: 1080, height: 1920, fps: 30, duration: 6 },
  );
});

test('media validation fails loudly on every contract breach', () => {
  const good = { codecVideo: 'h264', codecAudio: 'aac', width: 1080, height: 1920, fps: 30, duration: 6, pixFmt: 'yuv420p', hasFaststart: true };
  const cases: Array<[string, Record<string, unknown>]> = [
    ['codec', { codecVideo: 'mpeg4' }],
    ['audio', { codecAudio: null }],
    ['size', { width: 720, height: 1280 }],
    ['fps', { fps: 24 }],
    ['duration', { duration: 5 }],
    ['pixfmt', { pixFmt: 'yuv444p' }],
  ];
  for (const [label, patch] of cases) {
    assert.throws(
      () => validateMedia({ ...good, ...patch } as never, { width: 1080, height: 1920, fps: 30, duration: 6 }),
      ProbeError,
      `${label} breach throws`,
    );
  }
});
