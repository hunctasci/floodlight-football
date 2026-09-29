import React from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { gazeTargets } from '../../cast/targets';
import { CastActor } from '../../render/CastActor';
import { Screen } from '../../render/Screen';
import type { SceneProps } from '../../render/worlds';
import { STUDIO } from './layout';
import { STUDIO_WORLD } from './studio.world';
import { eventProgress, smooth01 } from '../events';
import { makeCanvasTexture } from '../../render/screens';
import { countryFlag, countryName } from '../../cast/countries';
import { HNC_UI } from '../../graphics/hnc-ui';
import { upper } from '../../graphics/case';

type Row = { code: string; points: number };

/** The LED floor: a pitch with the World Table laid across it, rows lighting up one by one. */
function paintFloor(c: CanvasRenderingContext2D, w: number, h: number, rows: Row[], p: number): void {
  c.fillStyle = '#0a1628';
  c.fillRect(0, 0, w, h);
  for (let i = 0; i < 10; i++) {
    c.fillStyle = i % 2 ? '#15532d' : '#186233';
    c.globalAlpha = smooth01(p * 1.4);
    c.fillRect(0, (i * h) / 10, w, h / 10);
  }
  c.globalAlpha = smooth01(p * 1.4);
  c.strokeStyle = '#e8f5e9';
  c.lineWidth = 8;
  c.strokeRect(w * 0.04, h * 0.03, w * 0.92, h * 0.94);
  c.beginPath();
  c.moveTo(w * 0.04, h / 2);
  c.lineTo(w * 0.96, h / 2);
  c.stroke();
  c.beginPath();
  c.arc(w / 2, h / 2, w * 0.16, 0, Math.PI * 2);
  c.stroke();
  const rh = h * 0.115;
  rows.forEach((r, i) => {
    const k = smooth01(p * 2.2 - 0.6 - i * 0.18);
    if (k <= 0) return;
    const y = h * 0.34 + i * rh * 1.02;
    c.globalAlpha = k * 0.92;
    c.fillStyle = i === 0 ? HNC_UI.gold : '#101b31';
    c.fillRect(w * 0.1, y, w * 0.8, rh);
    c.globalAlpha = k;
    c.fillStyle = i === 0 ? HNC_UI.ink : HNC_UI.cream;
    c.font = `${rh * 0.6}px Impact, 'Arial Black', sans-serif`;
    c.textBaseline = 'middle';
    c.textAlign = 'left';
    c.fillText(`${String(i + 1).padStart(2, '0')}  ${countryFlag(r.code)} ${upper(countryName(r.code))}`, w * 0.14, y + rh / 2);
    c.textAlign = 'right';
    c.fillText(String(r.points), w * 0.86, y + rh / 2);
  });
  c.globalAlpha = 1;
}

const LedFloor: React.FC<{ rows: Row[]; p: number }> = ({ rows, p }) => {
  const { tex, ctx } = React.useMemo(() => makeCanvasTexture(1024, 1280), []);
  React.useEffect(() => () => tex.dispose(), [tex]);
  React.useMemo(() => {
    paintFloor(ctx, 1024, 1280, rows, p);
    tex.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, tex, Math.round(p * 120), JSON.stringify(rows)]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 2.1]}>
      <planeGeometry args={[6.4, 8]} />
      <meshBasicMaterial map={tex} toneMapped={false} transparent opacity={Math.min(1, 0.15 + p * 1.2)} />
    </mesh>
  );
};

/**
 * Studio renderer: dark navy set, gold/blue LED pillars, an anchor desk with
 * the HNC stripe, and a wall screen painted in-world (so anchors' heads
 * occlude it). Screen content: scene `set.screen`, switched per beat by a
 * `screen` graphic.
 */
const FLAT = { flatShading: true, roughness: 0.85 } as const;

export const StudioScene: React.FC<SceneProps> = ({ shot, frame, fps, timeline, lens }) => {
  const scene = useThree((s) => s.scene);
  React.useMemo(() => {
    scene.background = new THREE.Color('#081220');
    scene.fog = new THREE.Fog('#081220', 9, 22);
  }, [scene]);
  const castIds = Object.keys(timeline.cast);
  const code = (id: unknown, i: number) => timeline.cast[String(id ?? castIds[i])]?.country ?? 'TR';
  const home = code(shot.set.home, 0);
  const away = code(shot.set.away, 1);
  // Latest `screen` graphic in this scene that has started wins.
  const switches = timeline.overlays.filter((o) => o.type === 'screen' && o.id.startsWith(`${shot.scene}/`) && o.start <= frame).sort((a, b) => a.start - b.start);
  const content = String(switches[switches.length - 1]?.props.content ?? shot.set.screen ?? 'hnc-news');
  const t = frame / fps;
  const target = gazeTargets(shot, frame, fps, lens, timeline);
  const glow = 0.75 + 0.25 * Math.sin(t * 2.2);
  const s = STUDIO.screen;
  const floorEv = eventProgress(timeline, shot, 'floor-table', frame);
  const floorP = floorEv ? smooth01(floorEv.p) : shot.set.floor === 'table' ? 1 : 0;
  const floorRows = (shot.set.rows as Row[] | undefined) ?? [];
  return (
    <group>
      {floorP > 0 ? <LedFloor rows={floorRows} p={floorP} /> : null}
      <hemisphereLight args={['#a9c2e6', '#141824', 1.1]} />
      <directionalLight position={[1.2, 4.2, 6.5]} color="#fff2df" intensity={2.1} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={6} shadow-camera-bottom={-6} />
      <directionalLight position={[0, 3.2, -5]} color="#6fa8ff" intensity={0.9} />
      <pointLight position={[0, 2.3, -1.6]} color="#f7bf30" intensity={1.4} distance={4.5} decay={1.6} />
      {/* Floor with a gold ring under the desk. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[14, 12]} />
        <meshStandardMaterial color="#0f1a2b" roughness={0.38} metalness={0.15} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, -0.2]}>
        <ringGeometry args={[2.25, 2.35, 48]} />
        <meshBasicMaterial color="#f7bf30" toneMapped={false} />
      </mesh>
      {/* Back wall + wall screen with bezel. */}
      <mesh position={[0, 2.2, STUDIO.backZ]}>
        <planeGeometry args={[12, 4.4]} />
        <meshStandardMaterial color="#0d1b2e" {...FLAT} />
      </mesh>
      <mesh position={[s.center.x, s.center.y, s.center.z - 0.04]}>
        <boxGeometry args={[s.width + 0.16, s.height + 0.16, 0.06]} />
        <meshStandardMaterial color="#1a2436" {...FLAT} />
      </mesh>
      <Screen content={content} data={{ home, away, t }} width={s.width} height={s.height} position={[s.center.x, s.center.y, s.center.z]} resolution={1024} />
      {/* LED pillars. */}
      {STUDIO.pillarsX.map((x, i) => (
        <group key={x} position={[x, 0, STUDIO.backZ + 0.5]}>
          <mesh position={[0, 1.9, 0]}>
            <boxGeometry args={[0.7, 3.8, 0.5]} />
            <meshStandardMaterial color="#12203a" {...FLAT} />
          </mesh>
          <mesh position={[0, 1.9, 0.26]}>
            <boxGeometry args={[0.12, 3.4, 0.02]} />
            <meshBasicMaterial color={new THREE.Color(i ? '#4f9dff' : '#f7bf30').multiplyScalar(glow)} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {/* Anchor desk: top, HNC-striped front panel. */}
      <mesh position={[0, STUDIO.deskTop - 0.03, STUDIO.deskZ]} castShadow receiveShadow>
        <boxGeometry args={[STUDIO.deskW, 0.06, STUDIO.deskD]} />
        <meshStandardMaterial color="#e9e4d8" roughness={0.5} />
      </mesh>
      <mesh position={[0, (STUDIO.deskTop - 0.06) / 2, STUDIO.deskZ + STUDIO.deskD / 2 - 0.04]}>
        <boxGeometry args={[STUDIO.deskW - 0.1, STUDIO.deskTop - 0.06, 0.06]} />
        <meshStandardMaterial color="#101b31" {...FLAT} />
      </mesh>
      <mesh position={[0, 0.52, STUDIO.deskZ + STUDIO.deskD / 2 - 0.005]}>
        <boxGeometry args={[STUDIO.deskW - 0.1, 0.08, 0.01]} />
        <meshBasicMaterial color="#f7bf30" toneMapped={false} />
      </mesh>
      <Screen content="hnc-logo" data={{ home, away, t }} width={0.9} height={0.24} position={[0, 0.33, STUDIO.deskZ + STUDIO.deskD / 2 + 0.001]} resolution={384} />
      {/* Anchor chairs (tall backs read on camera). */}
      {[-1, 1].map((sx) => (
        <group key={sx} position={[sx * STUDIO.anchorX, 0, STUDIO.anchorZ - 0.36]}>
          <mesh position={[0, 0.46, 0.3]}>
            <boxGeometry args={[0.6, 0.08, 0.55]} />
            <meshStandardMaterial color="#1c2536" {...FLAT} />
          </mesh>
          <mesh position={[0, 1.05, 0.04]}>
            <boxGeometry args={[0.62, 1.05, 0.1]} />
            <meshStandardMaterial color="#1c2536" {...FLAT} />
          </mesh>
        </group>
      ))}
      {/* Desk mugs (country colours of whoever sits nearest). */}
      {(['mug-left', 'mug-right'] as const).map((id, i) => {
        const p = STUDIO_WORLD.props[id].pos;
        const owner = shot.actors.find((a) => a.mark === (i ? 'anchor-right' : 'anchor-left'));
        const holding = owner?.hold === 'mug';
        if (holding) return null;
        return (
          <mesh key={id} position={[p.x, STUDIO.deskTop + 0.065, p.z]}>
            <cylinderGeometry args={[0.055, 0.05, 0.13, 8]} />
            <meshStandardMaterial color="#f3ede0" {...FLAT} />
          </mesh>
        );
      })}
      {shot.actors.map((track) => (
        <CastActor key={track.cast} shot={shot} track={track} member={timeline.cast[track.cast]} frame={frame} fps={fps} target={target} shadowColor="#05080f" />
      ))}
    </group>
  );
};
