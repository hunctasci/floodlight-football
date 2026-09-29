import React from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { createHncBallVisual, disposeHncBallVisual } from '@floodlight/hnc-visuals';
import { countryColors } from '../../cast/countries';
import { gazeTargets } from '../../cast/targets';
import { CastActor } from '../../render/CastActor';
import { Screen } from '../../render/Screen';
import { screenAt } from '../../render/screen-switch';
import { makeCanvasTexture, SCREEN_PAINTERS } from '../../render/screens';
import type { SceneProps } from '../../render/worlds';
import { Block, Cyl, Floor, Glow, Panel, paintPlanks, Plant, Room, usePainted, Window } from '../interior/kit';
import { APT } from './layout';
import { ballState, phoneAwake, remoteDown, roomShift, scarfPacked } from './state';

/**
 * Apartment renderer: warm lamp pool, TV glow, city through the window, a
 * dark hallway. The ball is the canonical HNC ball (hnc-visuals). A
 * `room-shift` fades the lamp and pushes cold floodlight through the window.
 */
const C = { wall: '#c9c1b4', ceiling: '#d6d0c6', sofa: '#3c4a5c', wood: '#8a6446', unit: '#262b33', rug: '#7a3a36' };

const Ball: React.FC<{ pos: { x: number; y: number; z: number }; spin: number }> = ({ pos, spin }) => {
  const ball = React.useMemo(() => createHncBallVisual(), []);
  React.useEffect(() => () => disposeHncBallVisual(ball), [ball]);
  ball.root.position.set(pos.x, pos.y, pos.z);
  // Rolling toward +x/+z: rotate about the axis perpendicular to travel.
  const dir = Math.atan2(APT.ballTo.x - APT.ballFrom.x, APT.ballTo.z - APT.ballFrom.z);
  ball.root.rotation.set(Math.cos(dir) * spin, 0, -Math.sin(dir) * spin);
  ball.shadow.position.set(pos.x, 0.012, pos.z);
  return (
    <>
      <primitive object={ball.root} />
      <primitive object={ball.shadow} />
    </>
  );
};

/** The phone lying face-up; its screen wakes with the HNC push. */
const Phone: React.FC<{ awake: boolean; t: number; line?: string }> = ({ awake, t, line }) => {
  const { tex, ctx } = React.useMemo(() => makeCanvasTexture(256, 512), []);
  React.useEffect(() => () => tex.dispose(), [tex]);
  React.useMemo(() => {
    if (awake) SCREEN_PAINTERS['phone-lock'](ctx, 256, 512, { home: 'TR', away: 'GR', t, ticker: line });
    else {
      ctx.fillStyle = '#07090d';
      ctx.fillRect(0, 0, 256, 512);
    }
    tex.needsUpdate = true;
  }, [awake, ctx, tex, t, line]);
  const p = APT.phone;
  return (
    <group position={[p.x, p.y, p.z]} rotation={[0, 0.35, 0]}>
      <Block size={[0.09, 0.012, 0.18]} pos={[0, 0, 0]} color="#101218" rough={0.3} metal={0.3} />
      <mesh position={[0, 0.0065, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.082, 0.17]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      {awake ? <Glow pos={[0, 0.05, 0]} size={0.35} color="#cfe0ff" strength={0.3} /> : null}
    </group>
  );
};

export const ApartmentScene: React.FC<SceneProps> = ({ shot, frame, fps, timeline, lens }) => {
  const scene = useThree((s) => s.scene);
  React.useMemo(() => {
    scene.background = new THREE.Color('#07090e');
    scene.fog = null;
  }, [scene]);
  const t = frame / fps;
  const shift = roomShift(timeline, shot, frame);
  const tv = screenAt(timeline, shot, frame, 'tv', String(shot.set.tv ?? 'tv-slate'));
  const tvOn = tv !== 'black' && tv !== 'off';
  const ball = ballState(timeline, shot, frame);
  const awake = phoneAwake(timeline, shot, frame);
  const packed = scarfPacked(timeline, shot, frame);
  const remote = remoteDown(timeline, shot, frame);
  const target = gazeTargets(shot, frame, fps, lens, timeline);
  const home = Object.values(timeline.cast)[0]?.country ?? 'TR';
  const scarf = countryColors(home);
  const planks = (c: CanvasRenderingContext2D, w: number, h: number) => paintPlanks(c, w, h, '#6e4f39', 5);
  const poster = usePainted(256, 360, (c, w, h) => {
    c.fillStyle = '#10213a';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#f8efdb';
    c.lineWidth = 6;
    c.strokeRect(18, 18, w - 36, h - 36);
    c.beginPath();
    c.arc(w / 2, h * 0.55, w * 0.22, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.moveTo(18, h * 0.55);
    c.lineTo(w - 18, h * 0.55);
    c.stroke();
  }, 'apt-poster');
  const lamp = 1 - 0.75 * shift;
  const [x0, x1] = APT.room.x;
  const [z0, z1] = APT.room.z;

  return (
    <group>
      <hemisphereLight args={['#8ea0c4', '#2a2420', 0.8 + 0.5 * shift]} />
      {/* Soft cool fill from the TV wall side (city glow / standby light). */}
      <directionalLight position={[0.5, 2.4, -6]} color="#a9bbdc" intensity={1.25 * (1 - 0.5 * shift)} />
      {/* Warm lamp pool. */}
      <pointLight position={[APT.lamp.x, APT.lamp.y, APT.lamp.z]} color="#ffc98a" intensity={4.2 * lamp} distance={7} decay={1.4} castShadow shadow-mapSize={[1024, 1024]} />
      {/* TV spill (cool) while it is on. */}
      {tvOn ? <pointLight position={[APT.tv.center.x, APT.tv.center.y, APT.tv.center.z + 0.6]} color="#9ec0ff" intensity={1.6} distance={5} decay={1.6} /> : null}
      {/* City / floodlight through the window. */}
      <directionalLight position={[9, 4, -1.5]} color={shift > 0 ? '#eef4ff' : '#6f86b8'} intensity={0.35 + 2.6 * shift} castShadow={shift > 0.05} shadow-mapSize={[1024, 1024]} shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={4} shadow-camera-bottom={-4} />
      {awake ? <pointLight position={[APT.phone.x, APT.phone.y + 0.3, APT.phone.z]} color="#cfe0ff" intensity={0.35} distance={1.4} decay={1.8} /> : null}

      <Room x={APT.room.x} z={APT.room.z} h={APT.room.h} wall={C.wall} ceiling={C.ceiling} trim="#e4ddd0" open={['front']} />
      <Floor w={x1 - x0} d={z1 - z0} center={[(x0 + x1) / 2, (z0 + z1) / 2]} paint={planks} paintKey="apt-planks" repeat={2} rough={0.6} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[APT.table.x - 0.2, 0.006, APT.table.z + 0.2]} receiveShadow>
        <planeGeometry args={[2.4, 1.7]} />
        <meshStandardMaterial color={C.rug} roughness={1} />
      </mesh>

      {/* TV wall: unit, TV, shelf, poster. */}
      <Block size={[2.4, 0.46, 0.42]} pos={[APT.tv.center.x, 0.23, z0 + 0.22]} color={C.unit} rough={0.5} />
      <Block size={[APT.tv.width + 0.06, APT.tv.height + 0.06, 0.05]} pos={[APT.tv.center.x, APT.tv.center.y, z0 + 0.035]} color="#0b0c10" rough={0.3} metal={0.3} />
      <Screen content={tv} data={{ home, away: 'GR', t }} width={APT.tv.width} height={APT.tv.height} position={[APT.tv.center.x, APT.tv.center.y, APT.tv.center.z]} resolution={640} />
      {tvOn ? <Glow pos={[APT.tv.center.x, APT.tv.center.y, APT.tv.center.z + 0.2]} size={2.4} color="#8fb6ff" strength={0.3} /> : null}
      <Block size={[0.9, 0.04, 0.26]} pos={[-1.9, 1.45, z0 + 0.13]} color={C.wood} />
      {[-2.2, -2.05, -1.95, -1.82].map((x, i) => (
        <Block key={x} size={[0.08, 0.26 + (i % 2) * 0.05, 0.2]} pos={[x, 1.6 + (i % 2) * 0.025, z0 + 0.13]} color={['#b03a2e', '#e8e1d2', '#2b4a6f', '#d9a441'][i]} shadow={false} />
      ))}
      <Panel w={0.62} h={0.86} pos={[-1.9, 2.1, z0 + 0.012]} map={poster} />
      <Plant pos={[2.7, 0, z0 + 0.5]} s={0.95} />

      {/* Sofa, coffee table, remote, phone, lamp. */}
      <group position={[APT.sofa.x, 0, APT.sofa.z]}>
        <Block size={[APT.sofa.w, 0.42, 0.9]} pos={[0, 0.25, 0]} color={C.sofa} rough={0.95} />
        <Block size={[APT.sofa.w, 0.6, 0.24]} pos={[0, 0.62, 0.36]} color={C.sofa} rough={0.95} />
        {[-1, 1].map((s) => (
          <Block key={s} size={[0.22, 0.55, 0.9]} pos={[s * (APT.sofa.w / 2 - 0.11), 0.38, 0]} color="#34414f" rough={0.95} />
        ))}
      </group>
      <Block size={[APT.table.w, 0.05, APT.table.d]} pos={[APT.table.x, APT.table.top - 0.025, APT.table.z]} color={C.wood} rough={0.5} />
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Block key={`${sx}${sz}`} size={[0.05, APT.table.top - 0.05, 0.05]} pos={[APT.table.x + sx * 0.48, (APT.table.top - 0.05) / 2, APT.table.z + sz * 0.24]} color="#3a2c22" />))}
      {remote ? <Block size={[0.05, 0.02, 0.17]} pos={[APT.remote.x, APT.remote.y, APT.remote.z]} rot={[0, -0.4, 0]} color="#1d212b" rough={0.5} /> : null}
      <Phone awake={awake} t={t} line={typeof shot.set.notification === 'string' ? shot.set.notification : undefined} />
      <group position={[APT.lamp.x, 0, APT.lamp.z]}>
        <Cyl r={[0.16, 0.18]} h={0.03} pos={[0, 0.015, 0]} color="#2a2d33" metal={0.5} />
        <Cyl r={[0.02, 0.02]} h={1.45} pos={[0, 0.74, 0]} color="#2a2d33" metal={0.5} />
        <Cyl r={[0.16, 0.26]} h={0.34} pos={[0, 1.62, 0]} color="#f2dcb7" emissive={lamp > 0.3 ? '#ffcf8e' : undefined} />
      </group>
      <Glow pos={[APT.lamp.x, APT.lamp.y, APT.lamp.z]} size={1.6} color="#ffc98a" strength={0.55 * lamp} />

      {/* The moving box; the folded scarf appears inside once packed. */}
      <group position={[APT.box.x, 0, APT.box.z]} rotation={[0, 0.3, 0]}>
        <Block size={[0.62, 0.4, 0.46]} pos={[0, 0.2, 0]} color="#b98f5e" rough={1} />
        <Block size={[0.62, 0.02, 0.2]} pos={[0, 0.41, -0.3]} rot={[-0.9, 0, 0]} color="#a67f51" rough={1} />
        {packed ? (
          <>
            <Block size={[0.4, 0.06, 0.26]} pos={[0, 0.4, 0]} color={scarf.primary} />
            <Block size={[0.4, 0.04, 0.26]} pos={[0, 0.45, 0]} color={scarf.secondary === '#ffffff' ? '#f3ede0' : scarf.secondary} />
          </>
        ) : null}
      </group>

      {/* Window + curtains; floodlight glow pours in on the shift. */}
      <Window pos={[x1 - 0.02, APT.window.y, APT.window.z]} rotY={-Math.PI / 2} w={APT.window.w} h={APT.window.h} tod="night" seed={9} />
      {[-1, 1].map((s) => (
        <Block key={s} size={[0.06, 2.3, 0.34]} pos={[x1 - 0.1, 1.3, APT.window.z + s * (APT.window.w / 2 + 0.2)]} color="#5b3a3a" rough={1} />
      ))}
      {shift > 0.01 ? <Glow pos={[x1 - 0.3, APT.window.y, APT.window.z]} size={4.5} color="#f4f8ff" strength={1.1 * shift} /> : null}

      {/* Dark hallway on the left wall. */}
      <Block size={[0.05, APT.hall.h, APT.hall.w]} pos={[x0 + 0.01, APT.hall.h / 2, APT.hall.z]} color="#050608" shadow={false} />
      <Block size={[0.05, 0.08, APT.hall.w + 0.1]} pos={[x0 + 0.03, APT.hall.h + 0.04, APT.hall.z]} color="#e4ddd0" shadow={false} />

      {ball.visible ? <Ball pos={ball.pos} spin={ball.spin} /> : null}
      {ball.visible && shot.set.ballGlow ? (
        <>
          <Glow pos={[ball.pos.x, 0.08, ball.pos.z]} size={1.4} color="#fff2cf" strength={0.45} />
          <pointLight position={[ball.pos.x, 0.35, ball.pos.z - 0.35]} color="#fff0d0" intensity={0.9} distance={1.6} decay={1.8} />
        </>
      ) : null}
      {shot.actors.map((track) => (
        <CastActor key={track.cast} shot={shot} track={track} member={timeline.cast[track.cast]} frame={frame} fps={fps} target={target} shadowColor="#141210" />
      ))}
    </group>
  );
};
