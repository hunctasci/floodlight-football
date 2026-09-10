import React, { Suspense } from 'react';
import { useGLTF } from '@react-three/drei';
import { getAsset, hasAsset } from '../assets/registry';
import { HumanActor } from './HumanActor';
import { HncFootballer } from './HncFootballer';
import type { ActorSpec } from '../reel/types';

/** Stable per-actor HNC identity (skin palette id) from the actor id. */
function hncPlayerIdFor(spec: ActorSpec): number {
  let h = 0;
  const s = `${spec.id}:${spec.country ?? ''}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 4;
}

function GLBModel({ assetId }: { assetId: string }) {
  const entry = getAsset(assetId);
  // Drei caches GLTFs; the same URL never reloads per frame.
  const gltf = useGLTF(`assets/${entry.file}`) as unknown as { scene: object };
  return <primitive object={gltf.scene} />;
}

/**
 * Semantic actor: stories pass actor ids + anchors + animation ids.
 * Both branches are thin adapters around the SAME canonical HNC character
 * (football kit vs office wardrobe) — never independent mesh recreations.
 * Licensed GLBs slot in via the manifest without touching story code.
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
        playerId={hncPlayerIdFor(spec)}
      />
    );
  } else {
    // Office workers are HNC characters in office wardrobes (same body/head/
    // face/proportions as the footballer). Wardrobe comes from spec.wardrobe
    // or spec.variant; model suffixes give cheap variety (01 = worker,
    // 02 = formal, female = casual, boss/manager = manager).
    const explicit = spec.wardrobe ?? spec.variant;
    let wardrobe = explicit ?? 'office-worker';
    if (!explicit) {
      if (spec.model.includes('female')) wardrobe = 'office-worker-casual';
      else if (spec.model.includes('02')) wardrobe = 'office-worker-formal';
      else if (spec.role === 'boss') wardrobe = 'manager';
    }
    fallback = (
      <HumanActor
        frame={frame}
        fps={fps}
        animation={anim}
        wardrobe={wardrobe}
        playerId={hncPlayerIdFor(spec)}
      />
    );
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
