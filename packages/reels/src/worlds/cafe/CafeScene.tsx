import React from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { gazeTargets } from '../../cast/targets';
import { CastActor } from '../../render/CastActor';
import { makeCanvasTexture } from '../../render/screens';
import type { SceneProps } from '../../render/worlds';
import { eventProgress, happened } from '../events';
import { Block, Cyl, Floor, Glow, Panel, Plant, Room, usePainted, Window, type TimeOfDay } from '../interior/kit';
import { CAFE, cupYaw } from './cafe.world';

/**
 * Café renderer: herringbone floor, green tile wall behind the counter, brass
 * pendants, warm dusk through a tall window, the espresso as a hero prop
 * (saucer, cup with handle, crema that can ripple).
 */
function paintHerringbone(c: CanvasRenderingContext2D, w: number, h: number): void {
  c.fillStyle = '#7a5538';
  c.fillRect(0, 0, w, h);
  const s = w / 8;
  for (let y = -1; y < 9; y++)
    for (let x = -1; x < 9; x++) {
      c.save();
      c.translate(x * s + s / 2, y * s + s / 2);
      c.rotate(((x + y) % 2 ? 1 : -1) * (Math.PI / 4));
      c.fillStyle = (x * 3 + y * 5) % 4 === 0 ? '#86603f' : (x + y) % 3 === 0 ? '#6f4c32' : '#7c5638';
      c.fillRect(-s * 0.7, -s * 0.18, s * 1.4, s * 0.36);
      c.restore();
    }
}

function paintTileWall(c: CanvasRenderingContext2D, w: number, h: number): void {
  c.fillStyle = '#1f4a3e';
  c.fillRect(0, 0, w, h);
  const bw = w / 10;
  const bh = h / 16;
  for (let r = 0; r < 16; r++)
    for (let i = 0; i < 10; i++) {
      c.fillStyle = (r * 7 + i * 3) % 5 === 0 ? '#27594b' : '#23513f';
      c.fillRect(i * bw + 2, r * bh + 2, bw - 4, bh - 4);
    }
}

/** Crema with a tiger-stripe swirl; concentric ripples when disturbed. */
function paintCrema(c: CanvasRenderingContext2D, s: number, ripple: number): void {
  const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, '#c98a4f');
  g.addColorStop(0.7, '#a86a36');
  g.addColorStop(1, '#5e3418');
  c.fillStyle = g;
  c.fillRect(0, 0, s, s);
  c.strokeStyle = 'rgba(240,200,150,0.35)';
  c.lineWidth = s * 0.02;
  for (let i = 0; i < 5; i++) {
    c.beginPath();
    c.arc(s / 2 + s * 0.05, s / 2, s * (0.1 + i * 0.07), 0.3 + i, 2.2 + i);
    c.stroke();
  }
  if (ripple > 0) {
    for (let i = 0; i < 4; i++) {
      const r = ((ripple * 1.6 + i * 0.22) % 1) * s * 0.5;
      c.strokeStyle = `rgba(255,236,205,${0.55 * (1 - r / (s * 0.5)) * Math.min(1, (1 - ripple) * 3)})`;
      c.lineWidth = s * 0.018;
      c.beginPath();
      c.arc(s / 2, s / 2, r, 0, Math.PI * 2);
      c.stroke();
    }
  }
}

const Espresso: React.FC<{ yaw: number; ripple: number; visible: boolean }> = ({ yaw, ripple, visible }) => {
  const { tex, ctx } = React.useMemo(() => makeCanvasTexture(256, 256), []);
  React.useEffect(() => () => tex.dispose(), [tex]);
  React.useMemo(() => {
    paintCrema(ctx, 256, ripple);
    tex.needsUpdate = true;
  }, [ctx, tex, ripple]);
  const p = CAFE.cup;
  return (
    <group position={[p.x, CAFE.table.top, p.z]}>
      {/* Saucer. */}
      <Cyl r={[0.105, 0.085]} h={0.018} pos={[0, 0.012, 0]} color="#dcd6cc" rough={0.45} seg={20} />
      {visible ? (
        <group rotation={[0, yaw, 0]} position={[0, 0.021, 0]}>
          <Cyl r={[0.052, 0.036]} h={0.07} pos={[0, 0.035, 0]} color="#e2ddd3" rough={0.4} seg={18} />
          <mesh position={[0, 0.0712, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.046, 24]} />
            <meshStandardMaterial map={tex} roughness={0.35} />
          </mesh>
          <mesh position={[0.058, 0.04, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <torusGeometry args={[0.017, 0.006, 6, 12]} />
            <meshStandardMaterial color="#f7f4ee" roughness={0.2} />
          </mesh>
          {/* A gold rim mark so the spin reads from above. */}
          <mesh position={[-0.049, 0.0714, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.006, 8]} />
            <meshBasicMaterial color="#d9a441" />
          </mesh>
        </group>
      ) : null}
      {/* Spoon on the saucer. */}
      <Block size={[0.012, 0.004, 0.09]} pos={[0.07, 0.024, 0.03]} rot={[0, 0.6, 0]} color="#c9ccd1" metal={0.8} rough={0.25} shadow={false} />
    </group>
  );
};

export const CafeScene: React.FC<SceneProps> = ({ shot, frame, fps, timeline, lens }) => {
  const scene = useThree((s) => s.scene);
  React.useMemo(() => {
    scene.background = new THREE.Color('#130d0a');
    scene.fog = null;
  }, [scene]);
  const tod = (['day', 'dusk', 'night'].includes(String(shot.set.tod)) ? shot.set.tod : 'dusk') as TimeOfDay;
  const yaw = cupYaw(timeline, shot, frame, fps);
  const rip = eventProgress(timeline, shot, 'ripple', frame);
  const taken = happened(timeline, shot, 'espresso-take', frame);
  const target = gazeTargets(shot, frame, fps, lens, timeline);
  const tile = usePainted(512, 512, paintTileWall, 'cafe-tile', [3, 1]);
  const menu = usePainted(256, 320, (c, w, h) => {
    c.fillStyle = '#141414';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#efe6d4';
    c.font = 'bold 30px Georgia, serif';
    c.textAlign = 'center';
    c.fillText('KAHVE', w / 2, 50);
    c.font = '20px Georgia, serif';
    ['espresso ........ 90', 'türk kahvesi ... 80', 'filtre ............ 95', 'cortado ......... 110'].forEach((l, i) => c.fillText(l, w / 2, 110 + i * 42));
  }, 'cafe-menu');
  const [x0, x1] = CAFE.room.x;
  const [z0, z1] = CAFE.room.z;
  const t = CAFE.table;
  return (
    <group>
      <hemisphereLight args={['#ffe2c4', '#2a1d16', 0.75]} />
      {/* Dusk through the window: warm key from the left. */}
      <directionalLight position={[-9, 3.2, -0.2]} color="#ffb47a" intensity={2.1} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-4} shadow-camera-right={4} shadow-camera-top={4} shadow-camera-bottom={-4} shadow-bias={-0.0004} />
      {CAFE.pendants.map((p, i) => (
        <pointLight key={i} position={[p.x, p.y - 0.25, p.z]} color="#ffcf94" intensity={i === 0 ? 1.3 : 1.6} distance={4.2} decay={1.6} />
      ))}
      <Room x={CAFE.room.x} z={CAFE.room.z} h={CAFE.room.h} wall="#d8c6ae" ceiling="#3a2a20" trim="#5a3f2d" />
      <Floor w={x1 - x0} d={z1 - z0} center={[(x0 + x1) / 2, (z0 + z1) / 2]} paint={paintHerringbone} paintKey="cafe-floor" repeat={3} rough={0.55} />
      <Panel w={x1 - x0} h={CAFE.room.h} pos={[(x0 + x1) / 2, CAFE.room.h / 2, z1 - 0.01]} rot={[0, Math.PI, 0]} map={tile} rough={0.4} />
      <Window pos={[x0 + 0.02, CAFE.window.y, CAFE.window.z]} rotY={Math.PI / 2} w={CAFE.window.w} h={CAFE.window.h} tod={tod} seed={12} frame="#2b211b" />
      <Glow pos={[x0 + 0.2, CAFE.window.y, CAFE.window.z]} size={3.4} color="#ffc08a" strength={0.35} />

      {/* Window table (marble) and chairs. */}
      <Cyl r={[t.r, t.r]} h={0.035} pos={[t.x, t.top - 0.018, t.z]} color="#23201f" rough={0.25} metal={0.1} seg={28} />
      <Cyl r={[0.035, 0.05]} h={t.top - 0.04} pos={[t.x, (t.top - 0.04) / 2, t.z]} color="#2b2b2b" metal={0.6} rough={0.35} />
      <Cyl r={[0.24, 0.24]} h={0.02} pos={[t.x, 0.01, t.z]} color="#2b2b2b" metal={0.6} seg={16} />
      <group position={[t.x, 0, t.z + 1.08]}>
        <Block size={[0.5, 0.05, 0.48]} pos={[0, 0.46, 0]} color="#3b2a1f" />
        <Block size={[0.5, 0.55, 0.05]} pos={[0, 0.76, 0.24]} color="#3b2a1f" />
      </group>
      <Espresso yaw={yaw} ripple={rip && rip.p < 1 ? rip.p : 0} visible={!taken} />

      {/* Counter, machine, shelves, menu board, pendants. */}
      <Block size={[CAFE.counter.x[1] - CAFE.counter.x[0], CAFE.counter.top, 0.7]} pos={[(CAFE.counter.x[0] + CAFE.counter.x[1]) / 2, CAFE.counter.top / 2, CAFE.counter.z]} color="#5a3f2d" rough={0.6} />
      <Block size={[CAFE.counter.x[1] - CAFE.counter.x[0] + 0.1, 0.05, 0.78]} pos={[(CAFE.counter.x[0] + CAFE.counter.x[1]) / 2, CAFE.counter.top + 0.025, CAFE.counter.z]} color="#e8e2d8" rough={0.25} />
      <Block size={[0.7, 0.45, 0.45]} pos={[1.9, CAFE.counter.top + 0.28, CAFE.counter.z + 0.05]} color="#b8bcc2" metal={0.8} rough={0.25} />
      <Block size={[0.72, 0.06, 0.47]} pos={[1.9, CAFE.counter.top + 0.53, CAFE.counter.z + 0.05]} color="#2b2b2b" />
      {[1.3, 1.85].map((y) => (
        <Block key={y} size={[3.2, 0.04, 0.26]} pos={[1.1, y + 0.6, z1 - 0.14]} color="#3b2a1f" />
      ))}
      {Array.from({ length: 9 }, (_, i) => (
        <Cyl key={i} r={[0.045, 0.035]} h={0.08} pos={[-0.3 + i * 0.32, 1.94, z1 - 0.14]} color={i % 3 ? '#f4f0e8' : '#d9a441'} seg={10} />
      ))}
      <Panel w={0.62} h={0.78} pos={[-0.55, 2.2, z1 - 0.03]} rot={[0, Math.PI, 0]} map={menu} />
      {CAFE.pendants.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]}>
          <Cyl r={[0.006, 0.006]} h={CAFE.room.h - p.y} pos={[0, (CAFE.room.h + p.y) / 2, 0]} color="#1a1a1a" shadow={false} />
          <Cyl r={[0.06, 0.2]} h={0.18} pos={[0, p.y, 0]} color="#b7863f" metal={0.7} rough={0.3} shadow={false} />
          <Glow pos={[p.x * 0, p.y - 0.12, 0]} size={0.8} color="#ffcf94" strength={0.65} />
        </group>
      ))}
      <Plant pos={[x0 + 0.45, 0, 2.6]} s={1.2} pot="#2b2b2b" />
      <Plant pos={[x1 - 0.5, 0, -2.6]} s={1.0} pot="#b7863f" />
      {/* Another small table in the room (depth). */}
      <Cyl r={[0.34, 0.34]} h={0.03} pos={[1.2, 0.73, -2.1]} color="#ebe6de" rough={0.2} seg={24} />
      <Cyl r={[0.03, 0.045]} h={0.7} pos={[1.2, 0.36, -2.1]} color="#2b2b2b" metal={0.6} />

      {shot.actors.map((track) => (
        <CastActor key={track.cast} shot={shot} track={track} member={timeline.cast[track.cast]} frame={frame} fps={fps} target={target} shadowColor="#1a120d" />
      ))}
    </group>
  );
};
