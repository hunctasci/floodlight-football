import React, { Suspense } from 'react';
import { useGLTF } from '@react-three/drei';
import { getAsset, hasAsset } from '../assets/registry';
import { HumanActor } from './HumanActor';
import { HncFootballer } from './HncFootballer';
import type { ActorSpec } from '../reel/types';

function GLBModel({ assetId }: { assetId: string }) {
  const entry = getAsset(assetId);
  // Drei caches GLTFs; the same URL never reloads per frame.
  const gltf = useGLTF(`assets/${entry.file}`) as unknown as { scene: object };
  return <primitive object={gltf.scene} />;
}

/**
 * Semantic actor: stories pass actor ids + anchors + animation ids.
 * Procedural fallback renders today; licensed GLBs slot in via the manifest
 * without touching story code.
 */
export const Actor: React.FC<{
  spec: ActorSpec;
  frame: number;
  fps: number;
  animation?: string;
  position?: [number, number, number];
  rotationY?: number;
}> = ({ spec, frame, fps, animation, position = [0, 0, 0], rotationY = 0 }) => {
  const anim = animation ?? spec.animation ?? 'idle';
  const useGLB = hasAsset(spec.model) && getAsset(spec.model).bundled;
  let fallback: React.ReactNode;
  if (spec.model === 'hnc-footballer' || spec.role === 'footballer' || spec.role === 'goalkeeper') {
    fallback = (
      <HncFootballer
        frame={frame}
        fps={fps}
        country={spec.country ?? 'TR'}
        keeper={spec.role === 'goalkeeper'}
        animation={anim}
      />
    );
  } else {
    fallback = <HumanActor frame={frame} fps={fps} animation={anim} primary="#2b4a6f" />;
  }
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {useGLB ? (
        <Suspense fallback={fallback}>
          <GLBModel assetId={spec.model} />
        </Suspense>
      ) : (
        fallback
      )}
    </group>
  );
};
