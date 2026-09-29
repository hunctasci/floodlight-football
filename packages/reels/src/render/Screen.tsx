import React from 'react';
import * as THREE from 'three';
import { makeCanvasTexture, SCREEN_PAINTERS, type ScreenData } from './screens';

/**
 * An in-world screen: a plane with a canvas-painted texture (monitor, studio
 * wall). Repainted from the frame's data, so it animates deterministically
 * and is occluded like any mesh.
 */
export const Screen: React.FC<{
  content: string;
  data: ScreenData;
  width: number;
  height: number;
  position: [number, number, number];
  rotationY?: number;
  /** Texture resolution along the long edge. */
  resolution?: number;
}> = ({ content, data, width, height, position, rotationY = 0, resolution = 512 }) => {
  const w = resolution;
  const h = Math.round((resolution * height) / width);
  const { tex, ctx } = React.useMemo(() => makeCanvasTexture(w, h), [w, h]);
  React.useEffect(() => () => tex.dispose(), [tex]);
  React.useMemo(() => {
    (SCREEN_PAINTERS[content] ?? SCREEN_PAINTERS.off)(ctx, w, h, data);
    tex.needsUpdate = true;
  }, [ctx, tex, w, h, content, data.home, data.away, data.t, data.ticker]);
  return (
    <mesh position={position} rotation={[0, rotationY, 0]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={tex} toneMapped={false} side={THREE.FrontSide} />
    </mesh>
  );
};
