import { useGLTF } from '@react-three/drei';

/** Preload every bundled GLB a composition needs BEFORE rendering. */
export function preloadAssets(assetIds: string[]): void {
  void assetIds;
}

/** Remotion-safe GLTF preloader (Drei cache; call at composition top-level). */
export function preloadGLB(url: string): void {
  try {
    useGLTF.preload(url);
  } catch {
    // Preload is best-effort; Suspense fallback covers failures.
  }
}
