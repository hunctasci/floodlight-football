import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { impactShake, zoomPunch } from '../../effects/presets';
import type { SceneProps } from '../../render/worlds';
import { plateFile } from './plate.world';

/**
 * Shows the Blender plate frame for this shot-local frame. Camera impacts
 * (`impact-shake`, `zoom-punch`) become a transform on the picture so plates
 * react to hits like the 3D worlds do; everything else is baked in Blender.
 */
export const PlateScene: React.FC<SceneProps> = ({ shot, frame, fps, timeline }) => {
  const local = frame - shot.start;
  let scale = 1;
  let dx = 0;
  let dy = 0;
  for (const e of shot.fx) {
    const since = frame - e.start;
    if (since < 0) continue;
    if (e.type === 'zoom-punch') scale *= 1 - zoomPunch(since, fps, e.intensity) / 90;
    if (e.type === 'impact-shake') {
      const s = impactShake(since, fps, e.intensity, timeline.seed);
      dx += s.x * 520;
      dy += s.y * 520;
    }
  }
  return (
    <AbsoluteFill style={{ backgroundColor: '#03060c', overflow: 'hidden' }}>
      <Img src={staticFile(plateFile(shot.set, local))} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `translate(${dx}px, ${dy}px) scale(${scale * (dx || dy ? 1.03 : 1)})` }} />
    </AbsoluteFill>
  );
};
