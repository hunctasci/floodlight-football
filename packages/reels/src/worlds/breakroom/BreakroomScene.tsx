import React from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { createHncBallVisual, disposeHncBallVisual } from '@floodlight/hnc-visuals';
import { gazeTargets } from '../../cast/targets';
import { CastActor } from '../../render/CastActor';
import { Screen } from '../../render/Screen';
import { screenAt } from '../../render/screen-switch';
import type { SceneProps } from '../../render/worlds';
import { officeLightLevel } from '../office/lighting';
import { Block, CeilingLight, Cyl, Floor, Glow, Panel, paintSign, paintTiles, Plant, Room, usePainted, Window, type TimeOfDay } from '../interior/kit';
import { BREAK } from './layout';
import { blindsState, cupState } from './state';

/**
 * Breakroom renderer: warm office kitchen, teal cabinets under a dark
 * counter, white subway-tile backsplash, a black-and-chrome machine with a
 * live LCD, fluorescent tubes that can flicker (and flash the cast into their
 * kits), a window with blinds, a dark doorway to the hall.
 */
const C = {
  wall: '#e9e3d6',
  ceiling: '#f1ede4',
  cabinet: '#4d7b78',
  counter: '#2d3139',
  machine: '#1a1e26',
  chrome: '#c7cbd1',
  fridge: '#e6e8ea',
  trim: '#c8bfae',
};

const Backsplash: React.FC = () => {
  const tex = usePainted(512, 256, (c, w, h) => {
    c.fillStyle = '#d8d6d0';
    c.fillRect(0, 0, w, h);
    const bw = w / 8;
    const bh = h / 8;
    for (let r = 0; r < 8; r++)
      for (let i = -1; i < 9; i++) {
        c.fillStyle = (r + i) % 3 === 0 ? '#f7f5f0' : '#f2f0ea';
        c.fillRect(i * bw + (r % 2) * (bw / 2) + 2, r * bh + 2, bw - 4, bh - 4);
      }
  }, 'subway');
  return <Panel w={BREAK.counterX * 2} h={0.62} pos={[0, BREAK.counterTop + 0.31, BREAK.room.z[0] + 0.01]} map={tex} rough={0.35} />;
};

/** The machine: body, chrome trim, group head, drip tray, LCD, steam when brewing. */
const Machine: React.FC<{ display: string; t: number; data: { home: string; away: string; t: number }; brew: number; broken: boolean }> = ({ display, data, brew, broken }) => {
  const m = BREAK.machine;
  const y0 = BREAK.counterTop;
  const front = m.z + m.d / 2;
  const ball = React.useMemo(() => (broken ? createHncBallVisual() : undefined), [broken]);
  React.useEffect(() => () => {
    if (ball) disposeHncBallVisual(ball);
  }, [ball]);
  React.useMemo(() => {
    if (!ball) return;
    ball.root.position.set(m.x + 0.08, y0 + 0.5, front - 0.02);
    ball.root.rotation.set(0.4, 0.7, 0.2);
    ball.root.scale.setScalar(0.95);
  }, [ball, m.x, y0, front]);
  return (
    <group>
      <Block size={[m.w, m.h, m.d]} pos={[m.x, y0 + m.h / 2, m.z]} color={C.machine} rough={0.35} metal={0.25} rot={broken ? [0, 0, 0.05] : undefined} />
      <Block size={[m.w + 0.02, 0.05, m.d + 0.02]} pos={[m.x, y0 + m.h, m.z]} color={C.chrome} rough={0.25} metal={0.8} />
      <Block size={[m.w * 0.8, 0.03, 0.2]} pos={[m.x, y0 + 0.03, front + 0.06]} color={C.chrome} rough={0.3} metal={0.8} />
      <Cyl r={[0.06, 0.07]} h={0.1} pos={[m.x, y0 + 0.33, front - 0.04]} color={C.chrome} metal={0.8} rough={0.25} />
      <Block size={[BREAK.display.width + 0.04, BREAK.display.height + 0.04, 0.02]} pos={[BREAK.display.center.x, BREAK.display.center.y, front - 0.005]} color="#0a0d12" shadow={false} />
      <Screen content={display} data={data} width={BREAK.display.width} height={BREAK.display.height} position={[BREAK.display.center.x, BREAK.display.center.y, front + 0.006]} resolution={256} />
      <Glow pos={[BREAK.display.center.x, BREAK.display.center.y, front + 0.03]} size={0.3} color={display === 'machine-ready' ? '#7dffa0' : '#ff6a4f'} strength={0.2} />
      {brew > 0 ? [0, 1, 2].map((i) => <Glow key={i} pos={[m.x + 0.05 * Math.sin(i * 2 + brew * 9), y0 + m.h + 0.15 + ((brew * 0.9 + i * 0.33) % 1) * 0.5, m.z + 0.1]} size={0.35 + 0.2 * i} color="#f4f4f4" strength={0.28 * brew} />) : null}
      {ball ? (
        <>
          <primitive object={ball.root} />
          {[0, 1, 2].map((i) => <Glow key={i} pos={[m.x - 0.1 + i * 0.1, y0 + m.h + 0.2 + i * 0.18, m.z]} size={0.5 + 0.25 * i} color="#9aa0a8" strength={0.35} />)}
        </>
      ) : null}
    </group>
  );
};

const Cup: React.FC<{ pos: { x: number; y: number; z: number }; roll: number }> = ({ pos, roll }) => (
  <group position={[pos.x, pos.y, pos.z]} rotation={[roll, 0, roll * 0.3]}>
    <Cyl r={[0.062, 0.05]} h={0.2} pos={[0, 0, 0]} color="#b89572" rough={0.9} />
    <Cyl r={[0.064, 0.056]} h={0.08} pos={[0, -0.01, 0]} color="#e9e1d2" rough={0.9} />
    <Cyl r={[0.066, 0.066]} h={0.02} pos={[0, 0.105, 0]} color="#e8e4dc" rough={0.6} />
  </group>
);

export const BreakroomScene: React.FC<SceneProps> = ({ shot, frame, fps, timeline, lens }) => {
  const scene = useThree((s) => s.scene);
  React.useMemo(() => {
    scene.background = new THREE.Color('#1a1d22');
    scene.fog = null;
  }, [scene]);
  const set = shot.set;
  const t = frame / fps;
  const level = officeLightLevel(shot, frame, fps, timeline.seed);
  const tod = (['day', 'dusk', 'night'].includes(String(set.tod)) ? set.tod : 'day') as TimeOfDay;
  const cup = cupState(timeline, shot, frame, fps);
  const blinds = blindsState(timeline, shot, frame);
  const castList = Object.values(timeline.cast);
  const data = { home: castList[0]?.country ?? 'TR', away: castList[1]?.country ?? 'BE', t };
  const display = screenAt(timeline, shot, frame, 'machine-display', String(set.display ?? 'machine-ready'));
  const brewEv = shot.fx.find((e) => e.type === 'machine-brew' && frame >= e.start && frame < e.end);
  const brew = brewEv ? Math.sin(Math.PI * ((frame - brewEv.start) / Math.max(1, brewEv.end - brewEv.start))) : 0;
  const cleared = set.cleared === true;
  const broken = set.broken === true;
  const flickerLook = typeof set.flickerLook === 'string' ? set.flickerLook : undefined;
  const flashing = flickerLook && shot.fx.some((e) => e.type === 'lights-flicker' && frame >= e.start && frame < e.end) && level < 0.55;
  const sign = Array.isArray(set.sign) ? (set.sign as string[]) : ['PLEASE WASH', 'YOUR MUG ♥'];
  const signTex = usePainted(256, 320, (c, w, h) => paintSign(c, w, h, sign), `sign-${sign.join('|')}`);
  const target = gazeTargets(shot, frame, fps, lens, timeline);
  const [x0, x1] = BREAK.room.x;
  const [z0, z1] = BREAK.room.z;
  const lit = Math.max(0.12, level);

  return (
    <group>
      <hemisphereLight args={['#fff6e8', '#6b6458', 1.35 * lit]} />
      <directionalLight position={[3.5, 5.5, 5]} color="#fff1dc" intensity={1.25 * lit} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={6} shadow-camera-bottom={-6} shadow-bias={-0.0004} />
      {/* Window daylight from the right, cut by the blinds. */}
      <directionalLight position={[9, 3.2, -1]} color={tod === 'day' ? '#dcecff' : '#ffb98a'} intensity={(tod === 'night' ? 0.1 : 0.9) * (1 - 0.8 * blinds)} />
      {BREAK.tubes.map((p, i) => (
        <pointLight key={i} position={[p.x, p.y - 0.25, p.z]} intensity={(i === 0 ? 1.5 : 1.3) * level} distance={4.5} decay={1.7} color="#f6f7ff" />
      ))}
      <Room x={BREAK.room.x} z={BREAK.room.z} h={BREAK.room.h} wall={C.wall} ceiling={C.ceiling} trim={C.trim} open={['front']} />
      <Floor w={x1 - x0} d={z1 - z0} center={[(x0 + x1) / 2, (z0 + z1) / 2]} paint={(c, w, h) => paintTiles(c, w, h, '#cfccc4', '#d9d6ce', 4)} paintKey="break-floor" repeat={4} rough={0.55} />
      {BREAK.tubes.map((p, i) => (
        <CeilingLight key={i} pos={[p.x, p.y, p.z]} w={1.3} d={0.22} level={level} color="#f3f7ff" />
      ))}
      {/* Counter run: base cabinets, top, backsplash, wall cabinets. */}
      <Block size={[BREAK.counterX * 2, BREAK.counterTop - 0.06, 0.6]} pos={[0, (BREAK.counterTop - 0.06) / 2, z0 + 0.32]} color={C.cabinet} rough={0.7} />
      {[-2.1, -1.3, -0.5, 0.5, 1.3, 2.1].map((x) => (
        <Block key={x} size={[0.02, 0.5, 0.012]} pos={[x + 0.3, 0.55, z0 + 0.625]} color="#c7cbd1" metal={0.7} rough={0.3} shadow={false} />
      ))}
      <Block size={[BREAK.counterX * 2 + 0.06, 0.06, 0.68]} pos={[0, BREAK.counterTop - 0.03, z0 + 0.33]} color={C.counter} rough={0.3} metal={0.1} />
      <Backsplash />
      {[-1.6, 1.6].map((x) => (
        <Block key={x} size={[1.9, 0.68, 0.36]} pos={[x, 1.98, z0 + 0.18]} color={C.cabinet} rough={0.7} />
      ))}
      <Block size={[1.3, 0.04, 0.3]} pos={[0, 1.86, z0 + 0.15]} color="#b98b5b" />
      {!cleared ? (
        <>
          {[-0.45, -0.25, 0.25, 0.45].map((x, i) => (
            <Cyl key={x} r={[0.05, 0.045]} h={0.11} pos={[x, 1.935, z0 + 0.15]} color={['#e96137', '#f3ede0', '#5fcddd', '#f7bf30'][i]} />
          ))}
          <Plant pos={[-2.25, BREAK.counterTop, z0 + 0.34]} s={0.62} pot="#f3ede0" />
          <Cyl r={[0.1, 0.1]} h={0.26} pos={[1.9, BREAK.counterTop + 0.13, z0 + 0.35]} color="#bfe3f0" rough={0.1} />
          <Block size={[0.34, 0.24, 0.24]} pos={[1.1, BREAK.counterTop + 0.12, z0 + 0.3]} color="#c9ccd1" metal={0.5} rough={0.35} />
        </>
      ) : null}
      <Machine display={display} t={t} data={data} brew={brew} broken={broken} />
      {cup.visible ? <Cup pos={cup.pos} roll={cup.roll} /> : null}
      {/* Fridge, notice board, water cooler. */}
      <Block size={[0.82, 1.9, 0.72]} pos={[-3.55, 0.95, z0 + 0.4]} color={C.fridge} rough={0.35} metal={0.15} />
      <Block size={[0.03, 0.5, 0.04]} pos={[-3.2, 1.25, z0 + 0.78]} color="#9aa0a8" metal={0.7} />
      <Block size={[0.03, 1.1, 0.8]} pos={[x0 + 0.02, 1.6, -1.4]} color="#b98b5b" />
      <Panel w={0.36} h={0.45} pos={[x0 + 0.04, 1.65, -1.4]} rot={[0, Math.PI / 2, 0]} map={signTex} />
      <Block size={[0.3, 0.3, 0.02]} pos={[x0 + 0.04, 1.62, -1.0]} rot={[0, Math.PI / 2, 0.08]} color="#f7e27a" shadow={false} />
      {/* Window with blinds on the right wall. */}
      <Window pos={[x1 - 0.02, BREAK.window.y, BREAK.window.z]} rotY={-Math.PI / 2} w={BREAK.window.w} h={BREAK.window.h} tod={tod} blinds={blinds} seed={4} />
      {/* Doorway to a dark hall on the left wall. */}
      <Block size={[0.04, BREAK.door.h + 0.1, BREAK.door.w + 0.16]} pos={[x0 + 0.02, (BREAK.door.h + 0.1) / 2, BREAK.door.z]} color="#8a6a4a" />
      <Block size={[0.05, BREAK.door.h, BREAK.door.w]} pos={[x0 + 0.01, BREAK.door.h / 2, BREAK.door.z]} color="#23262c" shadow={false} />
      {/* Small round table + stools (background). */}
      <Cyl r={[0.45, 0.45]} h={0.04} pos={[-2.2, 0.74, 0.9]} color="#f3ede0" rough={0.4} seg={14} />
      <Cyl r={[0.04, 0.05]} h={0.72} pos={[-2.2, 0.36, 0.9]} color="#3a4350" metal={0.6} />
      <Plant pos={[x1 - 0.5, 0, 2.6]} s={1.05} />
      {shot.actors.map((track) => (
        <CastActor key={track.cast} shot={shot} track={track} member={timeline.cast[track.cast]} frame={frame} fps={fps} target={target} shadowColor="#34322e" lookOverride={flashing ? flickerLook : undefined} />
      ))}
    </group>
  );
};
