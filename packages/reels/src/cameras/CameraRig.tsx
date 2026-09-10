import { useCurrentFrame } from 'remotion';
import { evaluateCamera } from './registry';

export function useCameraPose(
  presetId: string | undefined,
  shotStartFrame: number,
  durationInFrames: number,
  globalFrame?: number,
) {
  const hookFrame = useCurrentFrame();
  const frame = globalFrame ?? hookFrame;
  const local = frame - shotStartFrame;
  if (!presetId) {
    return { pos: [0, 1.6, 5] as [number, number, number], look: [0, 1.2, 0] as [number, number, number], fov: 40, localFrame: local };
  }
  const pose = evaluateCamera(presetId, local, durationInFrames);
  return { ...pose, localFrame: local };
}
