import { Input, BlobSource } from 'mediabunny';

/**
 * Browser/Node media inspection via Mediabunny (metadata, duration, tracks).
 * Used for trimming/cropping workflows and background-video ingestion;
 * the Remotion timeline remains the single source of truth for editing.
 */
export interface MediaProbe {
  duration: number;
  hasVideo: boolean;
  hasAudio: boolean;
  width?: number;
  height?: number;
}

export async function probeMedia(blob: Blob): Promise<MediaProbe> {
  const input = new Input({ formats: undefined as never, source: new BlobSource(blob) });
  const duration = await input.computeDuration();
  const tracks = await input.getTracks();
  const video = tracks.find((t) => t.type === 'video');
  const audio = tracks.find((t) => t.type === 'audio');
  return {
    duration,
    hasVideo: Boolean(video),
    hasAudio: Boolean(audio),
    width: video && 'width' in video ? Number((video as { width?: number }).width) : undefined,
    height: video && 'height' in video ? Number((video as { height?: number }).height) : undefined,
  };
}
