/**
 * Node-only (render script + tests): render a plan's procedural cues into
 * one WAV stem. Never import from compositions — it pulls in the offline
 * synth, which uses Node Buffers.
 */
import { encodeWav, renderAudioSamples } from '../../../social-video/src/audio/render';
import { AUDIO_SAMPLE_RATE } from '../../../social-video/src/audio/compile';
import { compileSfxEvents } from './sfx';
import type { ShotPlan } from '../reel/types';

/**
 * Stem peak (-3 dBFS). The game's synth levels suit its quiet arcade mix;
 * against real stadium recordings they vanish, so cue volumes set the
 * balance and this sets the absolute level.
 */
const STEM_PEAK = 0.708;

export function renderSfxStem(plan: ShotPlan, seed: number): Buffer {
  const samples = renderAudioSamples(
    { sampleRate: AUDIO_SAMPLE_RATE, duration: plan.totalFrames / plan.fps, events: compileSfxEvents(plan) },
    seed,
  );
  let peak = 0;
  for (const v of samples) peak = Math.max(peak, Math.abs(v));
  if (peak > 0) {
    const g = STEM_PEAK / peak;
    for (let i = 0; i < samples.length; i++) samples[i] *= g;
  }
  return encodeWav(samples, AUDIO_SAMPLE_RATE);
}
