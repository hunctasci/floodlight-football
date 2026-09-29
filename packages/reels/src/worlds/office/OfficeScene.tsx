import React from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { actorState } from '../../cast/state';
import { gazeTargets } from '../../cast/targets';
import type { ActorTrack, CastMember, Shot } from '../../engine/timeline/types';
import type { SceneProps } from '../../render/worlds';
import { CastActor } from '../../render/CastActor';
import { makeCanvasTexture, paintFlag } from '../../render/screens';
import { Screen } from '../../render/Screen';
import { countryColors } from '../../cast/countries';
import type { Vec3 } from '../types';
import { CEILING_LIGHT, DESKS, OFFICE, podSeats, POD_NAMES, type DeskSide } from './layout';
import { officeLightLevel } from './lighting';

/**
 * Office world renderer — HNC low-poly flat-shaded set (warm walls, carpet
 * tiles, fluorescent grid, windows onto a flat-colour skyline). Desks are
 * dressed from their owners' countries; background coworkers are HNC
 * characters typing at their pods and can all turn to stare.
 */

const FLAT = { flatShading: true, roughness: 0.92 } as const;
const C = {
  wall: '#e8e1d2',
  wainscot: '#d3c9b5',
  carpet: '#8c96a3',
  ceiling: '#efebe2',
  wood: '#b98b5b',
  metal: '#3a4350',
  chair: '#2b3446',
  monitor: '#1b2230',
  partition: '#5f6f80',
  frame: '#39424f',
};

function useTexture(w: number, h: number, paint: (c: CanvasRenderingContext2D) => void, key: string): THREE.CanvasTexture {
  const tex = React.useMemo(() => {
    const t = makeCanvasTexture(w, h);
    paint(t.ctx);
    t.tex.needsUpdate = true;
    return t.tex;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  React.useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

const Carpet: React.FC = () => {
  const tex = useTexture(512, 512, (c) => {
    c.fillStyle = C.carpet;
    c.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        c.fillStyle = (i + j) % 2 ? '#8792a0' : '#909aa7';
        c.fillRect(i * 128 + 2, j * 128 + 2, 124, 124);
      }
  }, 'carpet');
  React.useMemo(() => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
  }, [tex]);
  const { halfX, back, front } = OFFICE.room;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, (back + front) / 2]} receiveShadow>
      <planeGeometry args={[halfX * 2, front - back]} />
      <meshStandardMaterial map={tex} roughness={1} />
    </mesh>
  );
};

const Skyline: React.FC<{ w: number; h: number; position: [number, number, number] }> = ({ w, h, position }) => {
  const tex = useTexture(512, 300, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 300);
    g.addColorStop(0, '#9fd0ef');
    g.addColorStop(1, '#d9eef8');
    c.fillStyle = g;
    c.fillRect(0, 0, 512, 300);
    const blocks = [[0, 150, 70], [60, 110, 55], [110, 170, 80], [185, 95, 60], [240, 140, 90], [325, 80, 50], [370, 125, 75], [440, 160, 72]];
    for (const [x, top, bw] of blocks) {
      c.fillStyle = '#7fa6c4';
      c.fillRect(x, top, bw, 300 - top);
      c.fillStyle = '#9cbcd4';
      for (let y = top + 12; y < 290; y += 22) for (let wx = x + 8; wx < x + bw - 10; wx += 16) c.fillRect(wx, y, 8, 10);
    }
  }, 'skyline');
  return (
    <mesh position={position}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
};

const Room: React.FC<{ level: number; clock: string }> = ({ level, clock }) => {
  const { halfX, back, front, ceiling } = OFFICE.room;
  const depth = front - back;
  const clockTex = useTexture(256, 256, (c) => {
    c.fillStyle = '#f7f3ea';
    c.beginPath();
    c.arc(128, 128, 124, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 12;
    c.strokeStyle = C.frame;
    c.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      c.fillStyle = C.frame;
      c.fillRect(128 + Math.sin(a) * 96 - 4, 128 - Math.cos(a) * 96 - 10, 8, 20);
    }
    const [hh, mm] = clock.split(':').map(Number);
    const hand = (angle: number, len: number, width: number) => {
      c.save();
      c.translate(128, 128);
      c.rotate(angle);
      c.fillStyle = '#1c2333';
      c.fillRect(-width / 2, -len, width, len + 12);
      c.restore();
    };
    hand((((hh % 12) + mm / 60) / 12) * Math.PI * 2, 58, 12);
    hand((mm / 60) * Math.PI * 2, 88, 8);
    c.fillStyle = '#e96137';
    c.beginPath();
    c.arc(128, 128, 10, 0, Math.PI * 2);
    c.fill();
  }, `clock-${clock}`);
  const boardTex = useTexture(512, 320, (c) => {
    c.fillStyle = '#fbfbf7';
    c.fillRect(0, 0, 512, 320);
    c.strokeStyle = '#2f7d4f';
    c.lineWidth = 5;
    c.strokeRect(40, 40, 432, 240);
    c.beginPath();
    c.moveTo(256, 40);
    c.lineTo(256, 280);
    c.stroke();
    c.beginPath();
    c.arc(256, 160, 40, 0, Math.PI * 2);
    c.stroke();
    c.font = 'bold 34px sans-serif';
    c.fillStyle = '#c0392b';
    for (const [x, y] of [[120, 110], [150, 210], [200, 160]]) c.fillText('X', x, y);
    c.fillStyle = '#1f4e9c';
    for (const [x, y] of [[330, 120], [350, 220], [400, 165]]) c.fillText('O', x, y);
    c.strokeStyle = '#c0392b';
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(215, 150);
    c.quadraticCurveTo(300, 90, 440, 150);
    c.stroke();
    c.font = 'bold 26px sans-serif';
    c.fillStyle = '#39424f';
    c.fillText('Q3 TARGETS', 40, 30);
  }, 'board');
  return (
    <group>
      <Carpet />
      {/* Ceiling + fluorescent grid (emissive boost = light level). */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, ceiling, (back + front) / 2]}>
        <planeGeometry args={[halfX * 2, depth]} />
        <meshStandardMaterial color={C.ceiling} {...FLAT} />
      </mesh>
      {OFFICE.panels.map(([x, z]) => (
        <group key={`${x}:${z}`} position={[x, ceiling - 0.02, z]}>
          <mesh>
            <boxGeometry args={[1.35, 0.04, 0.66]} />
            <meshStandardMaterial color="#c9ccd1" {...FLAT} />
          </mesh>
          <mesh position={[0, -0.025, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.2, 0.54]} />
            <meshBasicMaterial color={new THREE.Color('#fffbe8').multiplyScalar(0.55 + 0.45 * level)} />
          </mesh>
        </group>
      ))}
      {/* Back wall with windows onto the skyline. */}
      <mesh position={[0, ceiling / 2, back]}>
        <planeGeometry args={[halfX * 2, ceiling]} />
        <meshStandardMaterial color={C.wall} {...FLAT} />
      </mesh>
      {[-3.6, 0, 3.6].map((x) => (
        <group key={x} position={[x, 1.75, back + 0.02]}>
          <mesh>
            <boxGeometry args={[2.7, 1.6, 0.05]} />
            <meshStandardMaterial color={C.frame} {...FLAT} />
          </mesh>
          <Skyline w={2.5} h={1.4} position={[0, 0, 0.03]} />
          <mesh position={[0, 0, 0.05]}>
            <boxGeometry args={[0.06, 1.4, 0.02]} />
            <meshStandardMaterial color={C.frame} {...FLAT} />
          </mesh>
        </group>
      ))}
      <mesh position={[1.95, 2.3, back + 0.04]}>
        <circleGeometry args={[0.26, 20]} />
        <meshBasicMaterial map={clockTex} />
      </mesh>
      {/* Side + front walls, wainscot band. */}
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * halfX, ceiling / 2, (back + front) / 2]} rotation={[0, -sx * (Math.PI / 2), 0]}>
          <planeGeometry args={[depth, ceiling]} />
          <meshStandardMaterial color={C.wall} {...FLAT} />
        </mesh>
      ))}
      <mesh position={[0, ceiling / 2, front]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[halfX * 2, ceiling]} />
        <meshStandardMaterial color={C.wall} {...FLAT} />
      </mesh>
      {[-1, 1].map((sx) => (
        <mesh key={`w${sx}`} position={[sx * (halfX - 0.01), 0.45, (back + front) / 2]} rotation={[0, -sx * (Math.PI / 2), 0]}>
          <planeGeometry args={[depth, 0.9]} />
          <meshStandardMaterial color={C.wainscot} {...FLAT} />
        </mesh>
      ))}
      <mesh position={[0, 0.45, back + 0.01]}>
        <planeGeometry args={[halfX * 2, 0.9]} />
        <meshStandardMaterial color={C.wainscot} {...FLAT} />
      </mesh>
      {/* Whiteboard with a tactics sketch (right wall), door, plants, cooler. */}
      <mesh position={[halfX - 0.03, 1.7, 0.6]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[2.2, 1.35]} />
        <meshBasicMaterial map={boardTex} />
      </mesh>
      <mesh position={[halfX - 0.04, 1.05, -2.6]} rotation={[0, -Math.PI / 2, 0]}>
        <boxGeometry args={[1.0, 2.1, 0.06]} />
        <meshStandardMaterial color="#8a6a4a" {...FLAT} />
      </mesh>
      {[[-halfX + 0.5, back + 0.5], [halfX - 0.5, back + 0.5], [-halfX + 0.5, 3.6]].map(([x, z]) => (
        <group key={`${x}:${z}`} position={[x, 0, z]}>
          <mesh position={[0, 0.25, 0]}>
            <cylinderGeometry args={[0.24, 0.19, 0.5, 7]} />
            <meshStandardMaterial color="#e96137" {...FLAT} />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[Math.sin(i * 2.1) * 0.14, 0.72 + i * 0.26, Math.cos(i * 2.1) * 0.14]}>
              <icosahedronGeometry args={[0.3 - i * 0.05, 0]} />
              <meshStandardMaterial color={i % 2 ? '#58a861' : '#4a9656'} {...FLAT} />
            </mesh>
          ))}
        </group>
      ))}
      <group position={[-halfX + 0.45, 0, 1.4]}>
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[0.45, 1.0, 0.45]} />
          <meshStandardMaterial color="#e9edf1" {...FLAT} />
        </mesh>
        <mesh position={[0, 1.22, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.45, 8]} />
          <meshStandardMaterial color="#8fd0ef" transparent opacity={0.85} {...FLAT} />
        </mesh>
      </group>
    </group>
  );
};

const DeskFlag: React.FC<{ country: string; position: Vec3 }> = ({ country, position }) => {
  const tex = useTexture(96, 64, (c) => paintFlag(c, 96, 64, country), `flag-${country}`);
  return (
    <group position={[position.x, OFFICE.deskTop, position.z]}>
      <mesh position={[0, 0.012, 0]}>
        <cylinderGeometry args={[0.045, 0.05, 0.025, 8]} />
        <meshStandardMaterial color={C.metal} {...FLAT} />
      </mesh>
      <mesh position={[0, 0.14, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 0.26, 4]} />
        <meshStandardMaterial color="#c9ccd1" {...FLAT} />
      </mesh>
      {/* Two faces back to back so the flag reads correctly from both desks. */}
      {[0, Math.PI].map((r) => (
        <mesh key={r} position={[0.075, 0.2, r ? -0.002 : 0.002]} rotation={[0, r, 0]}>
          <planeGeometry args={[0.15, 0.1]} />
          <meshBasicMaterial map={tex} />
        </mesh>
      ))}
    </group>
  );
};

const Mug: React.FC<{ color: string; position: Vec3 }> = ({ color, position }) => (
  <group position={[position.x, OFFICE.deskTop, position.z]}>
    <mesh position={[0, 0.065, 0]}>
      <cylinderGeometry args={[0.055, 0.05, 0.13, 8]} />
      <meshStandardMaterial color={color} {...FLAT} />
    </mesh>
    <mesh position={[0.06, 0.07, 0]} rotation={[0, 0, Math.PI / 2]}>
      <torusGeometry args={[0.03, 0.012, 4, 8]} />
      <meshStandardMaterial color={color} {...FLAT} />
    </mesh>
  </group>
);

/** One desk + monitor + keyboard + chair, facing its seat (side s). */
const Desk: React.FC<{
  origin: [number, number];
  s: DeskSide;
  owner?: CastMember;
  ownerSit: number;
  clues: boolean;
  screen: string;
  screenData: { home: string; away: string; t: number };
}> = ({ origin, s, owner, ownerSit, clues, screen, screenData }) => {
  const [ox, oz] = origin;
  const z = (v: number) => oz + s * v;
  const chairZ = z(OFFICE.seatZ + 0.02 + (1 - ownerSit) * 0.32);
  const props = { flag: { x: ox - 0.6 * s, y: 0, z: z(0.6) }, mug: { x: ox + 0.56 * s, y: 0, z: z(0.62) } };
  const mugColor = owner && clues ? countryColors(owner.country).primary : '#f3ede0';
  return (
    <group>
      <mesh position={[ox, OFFICE.deskTop - 0.02, z(OFFICE.deskZ)]} castShadow receiveShadow>
        <boxGeometry args={[OFFICE.deskW, 0.04, OFFICE.deskD]} />
        <meshStandardMaterial color={C.wood} {...FLAT} />
      </mesh>
      {[-1, 1].map((lx) => (
        <mesh key={lx} position={[ox + lx * (OFFICE.deskW / 2 - 0.05), (OFFICE.deskTop - 0.04) / 2, z(OFFICE.deskZ)]}>
          <boxGeometry args={[0.05, OFFICE.deskTop - 0.04, OFFICE.deskD - 0.08]} />
          <meshStandardMaterial color={C.metal} {...FLAT} />
        </mesh>
      ))}
      {/* Modesty panel on the far edge hides legs from the other side. */}
      <mesh position={[ox, 0.45, z(OFFICE.deskZ - OFFICE.deskD / 2 + 0.03)]}>
        <boxGeometry args={[OFFICE.deskW - 0.12, 0.5, 0.03]} />
        <meshStandardMaterial color={C.metal} {...FLAT} />
      </mesh>
      {/* Monitor faces its seat. */}
      <group position={[ox, 0, z(OFFICE.monitorZ)]} rotation={[0, s > 0 ? 0 : Math.PI, 0]}>
        <mesh position={[0, OFFICE.monitorY, 0]}>
          <boxGeometry args={[OFFICE.monitorW, OFFICE.monitorH, 0.04]} />
          <meshStandardMaterial color={C.monitor} {...FLAT} />
        </mesh>
        <mesh position={[0, OFFICE.deskTop + 0.1, -0.02]}>
          <boxGeometry args={[0.05, 0.2, 0.04]} />
          <meshStandardMaterial color={C.monitor} {...FLAT} />
        </mesh>
        <Screen content={screen} data={screenData} width={OFFICE.monitorW - 0.06} height={OFFICE.monitorH - 0.06} position={[0, OFFICE.monitorY, 0.022]} resolution={320} />
      </group>
      <mesh position={[ox, OFFICE.deskTop + 0.012, z(0.6)]}>
        <boxGeometry args={[0.42, 0.02, 0.14]} />
        <meshStandardMaterial color="#2a3140" {...FLAT} />
      </mesh>
      {owner && clues ? <DeskFlag country={owner.country} position={props.flag} /> : null}
      <Mug color={mugColor} position={props.mug} />
      {/* Chair rolls back when its owner stands. */}
      <group position={[ox, 0, chairZ]} rotation={[0, s > 0 ? 0 : Math.PI, 0]}>
        <mesh position={[0, OFFICE.seatTop - 0.04, 0.05]}>
          <boxGeometry args={[0.58, 0.08, 0.55]} />
          <meshStandardMaterial color={C.chair} {...FLAT} />
        </mesh>
        <mesh position={[0, 0.92, 0.33]}>
          <boxGeometry args={[0.56, 0.72, 0.08]} />
          <meshStandardMaterial color={C.chair} {...FLAT} />
        </mesh>
        <mesh position={[0, 0.22, 0.05]}>
          <cylinderGeometry args={[0.04, 0.04, 0.4, 6]} />
          <meshStandardMaterial color={C.metal} {...FLAT} />
        </mesh>
        <mesh position={[0, 0.04, 0.05]}>
          <cylinderGeometry args={[0.3, 0.3, 0.04, 5]} />
          <meshStandardMaterial color={C.metal} {...FLAT} />
        </mesh>
      </group>
    </group>
  );
};

const EXTRA_LOOKS = ['office-casual', 'office', 'office-formal', 'office', 'office-casual', 'office-formal'];
const EXTRA_ACCENTS = ['#5b6b8c', '#7a5c8c', '#4f7f73', '#8c6b4f', '#6b7f4f', '#8c4f5b'];
const EXTRA_NUMBERS = [2, 7, 5, 8, 11, 3];

/** Background coworkers: typing, turning to stare on `coworkers-look`. */
function extraTracks(shot: Shot, taken: Set<string>, count: number): { track: ActorTrack; member: CastMember }[] {
  const seats = Object.keys(podSeats()).filter((m) => !taken.has(m)).slice(0, count);
  const look = shot.fx.find((e) => e.type === 'coworkers-look');
  return seats.map((mark, i) => ({
    member: { id: `extra-${i}`, country: 'XX', number: EXTRA_NUMBERS[i], name: '', accent: EXTRA_ACCENTS[i], look: EXTRA_LOOKS[i] },
    track: {
      cast: `extra-${i}`,
      mark,
      look: EXTRA_LOOKS[i],
      keys: [{ frame: -1000 - i * 7, action: 'typing' }, ...(look ? [{ frame: look.start + i * 3, action: 'notice', lookAt: 'pod-centre' }] : [])],
    },
  }));
}

export const OfficeScene: React.FC<SceneProps> = ({ shot, frame, fps, timeline, lens }) => {
  const scene = useThree((s) => s.scene);
  React.useMemo(() => {
    scene.background = new THREE.Color(C.wall);
    scene.fog = null;
  }, [scene]);
  const level = officeLightLevel(shot, frame, fps, timeline.seed);
  const set = shot.set;
  const clues = set.clues !== false;
  const screens = (set.screens ?? {}) as Record<string, string>;
  const castList = Object.values(timeline.cast);
  const screenData = { home: castList[0]?.country ?? 'TR', away: castList[1]?.country ?? 'GR', t: frame / fps };

  const target = gazeTargets(shot, frame, fps, lens);
  const deskOwner = (mark: string) => {
    const t = shot.actors.find((a) => a.mark === mark);
    return t ? { member: timeline.cast[t.cast], sit: actorState(shot, t, frame, fps).pose.sit } : undefined;
  };
  const taken = new Set(shot.actors.map((a) => a.mark));
  const extras = extraTracks(shot, taken, typeof set.extras === 'number' ? set.extras : 5);

  return (
    <group>
      <hemisphereLight args={['#fffaf0', '#6f6a60', 1.75 * level]} />
      <directionalLight position={[3.5, 6.5, 7]} color="#fff4e2" intensity={1.8 * level} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={8} shadow-camera-bottom={-8} />
      <directionalLight position={[-2, 4, -9]} color="#dbeaff" intensity={0.55 * Math.min(1.4, level)} />
      <pointLight position={[CEILING_LIGHT.x, CEILING_LIGHT.y - 0.3, CEILING_LIGHT.z]} intensity={2.2 * level} distance={5} decay={1.6} color="#fff6dc" />
      <Room level={level} clock={typeof set.clock === 'string' ? set.clock : '09:03'} />
      {(Object.keys(DESKS) as ('desk-a' | 'desk-b')[]).map((mark) => {
        const o = deskOwner(mark);
        return (
          <Desk key={mark} origin={[0, 0]} s={DESKS[mark]} owner={o?.member} ownerSit={o?.sit ?? 1} clues={clues} screen={screens[`${mark}-monitor`] ?? 'spreadsheet'} screenData={screenData} />
        );
      })}
      {OFFICE.pods.map(([px, pz], i) =>
        ([1, -1] as DeskSide[]).map((s) => {
          const mark = `${POD_NAMES[i]}-${s > 0 ? 'a' : 'b'}`;
          const o = deskOwner(mark);
          return <Desk key={mark} origin={[px, pz]} s={s} owner={o?.member} ownerSit={o?.sit ?? 1} clues={clues} screen="spreadsheet" screenData={screenData} />;
        }),
      )}
      {/* Low fabric dividers on the background pods (depth + office read). */}
      {OFFICE.pods.map(([px, pz]) => (
        <mesh key={`p${px}:${pz}`} position={[px, OFFICE.deskTop + 0.24, pz]}>
          <boxGeometry args={[OFFICE.deskW, 0.48, 0.04]} />
          <meshStandardMaterial color={C.partition} {...FLAT} />
        </mesh>
      ))}
      {shot.actors.map((track) => (
        <CastActor key={track.cast} shot={shot} track={track} member={timeline.cast[track.cast]} frame={frame} fps={fps} target={target} shadowColor="#20242c" />
      ))}
      {extras.map(({ track, member }) => (
        <CastActor key={track.cast} shot={shot} track={track} member={member} frame={frame} fps={fps} target={target} shadowColor="#20242c" />
      ))}
    </group>
  );
};
