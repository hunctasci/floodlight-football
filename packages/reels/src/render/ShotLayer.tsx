import React from 'react';
import { AbsoluteFill } from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { HNC_RENDER_PROFILE } from '@floodlight/hnc-visuals';
import { shotLens } from '../camera/evaluate';
import { subjectsAt } from '../engine/subjects';
import type { OverlayEvent, Shot, Timeline } from '../engine/timeline/types';
import { getWorld } from '../worlds/registry';
import type { Lens } from '../worlds/types';
import { useLayout } from './layout';
import { Overlay } from './Overlays';
import { ShotFx, worldFilter } from './ShotFx';
import { layerStyle } from './Transitions';
import { SCENES_2D, SCENES_3D } from './worlds';

/** Applies the shot lens to the R3F camera (one pose per frame). */
const CameraRig: React.FC<{ lens: Lens }> = ({ lens }) => {
  const camera = useThree((s) => s.camera);
  React.useMemo(() => {
    camera.position.set(lens.pos.x, lens.pos.y, lens.pos.z);
    camera.lookAt(new THREE.Vector3(lens.look.x, lens.look.y, lens.look.z));
    if (camera instanceof THREE.PerspectiveCamera && camera.fov !== lens.fov) {
      camera.fov = lens.fov;
      camera.updateProjectionMatrix();
    }
  }, [camera, lens.pos.x, lens.pos.y, lens.pos.z, lens.look.x, lens.look.y, lens.look.z, lens.fov]);
  return null;
};

/**
 * One shot: its world (3D canvas or 2D scene) through its camera, its screen
 * effects and its bound overlays — wrapped in the transition layer styles
 * (zoom-through, wipe, whip blur). `frame` is the ABSOLUTE frame.
 */
export const ShotLayer: React.FC<{ tl: Timeline; shot: Shot; prev?: Shot; frame: number; overlays: OverlayEvent[] }> = ({ tl, shot, prev, frame, overlays }) => {
  const { width, height } = useLayout();
  const world = getWorld(shot.world);
  // Frozen beats hold the world (not the graphics).
  const wf = shot.freeze !== undefined && frame >= shot.freeze ? shot.freeze : frame;
  const lens = world.kind === '3d' ? shotLens(tl, shot, frame) : undefined;
  const subject = world.kind === '3d' ? subjectsAt(tl, shot, wf) : undefined;
  const { outer, inner } = layerStyle(tl, shot, prev, frame, width, height);
  const Scene3D = SCENES_3D[shot.world];
  const Scene2D = SCENES_2D[shot.world];
  return (
    <AbsoluteFill style={outer}>
      <AbsoluteFill style={inner}>
        <AbsoluteFill style={{ filter: worldFilter(shot, frame) }}>
        {lens && Scene3D ? (
          <ThreeCanvas
            width={width}
            height={height}
            dpr={1}
            shadows
            gl={{ antialias: true, outputColorSpace: THREE.SRGBColorSpace, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: HNC_RENDER_PROFILE.toneMappingExposure }}
            camera={{ fov: 50, near: 0.1, far: 280, position: [0, 16, 30] }}
          >
            <CameraRig lens={lens} />
            <Scene3D shot={shot} frame={wf} fps={tl.fps} timeline={tl} lens={lens} />
          </ThreeCanvas>
        ) : Scene2D ? (
          <Scene2D shot={shot} frame={wf} fps={tl.fps} timeline={tl} />
        ) : null}
        </AbsoluteFill>
        <ShotFx shot={shot} frame={frame} fps={tl.fps} lens={lens} seed={tl.seed} />
        {overlays.map((ev) => (
          // Shot-bound overlays stay with the layer through an overlapping exit.
          <Overlay key={ev.id} ev={shot.exit?.overlap && ev.end >= shot.start + shot.duration ? { ...ev, end: Math.max(ev.end, shot.exit.end) } : ev} tl={tl} frame={frame} lens={lens} subject={subject} />
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
