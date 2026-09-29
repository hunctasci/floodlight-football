import React from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { gazeTargets } from '../../cast/targets';
import { countryFlag } from '../../cast/countries';
import { CastActor } from '../../render/CastActor';
import { makeCanvasTexture } from '../../render/screens';
import type { SceneProps } from '../../render/worlds';
import { HNC_CHAT_SKIN } from '../phone/PhoneScene';
import { Block, Glow } from '../interior/kit';
import { STAGE } from './stage.world';

/**
 * Stage renderer: a seamless cyclorama (curved floor-to-wall), soft top
 * light, and the giant phone — body, bezel, and a canvas-painted chat in the
 * HNC skin whose light spills onto the floor and the people stepping out.
 */
const TONES = { navy: ['#0b1526', '#16284a'], red: ['#5a0a10', '#a3121c'], gold: ['#6b4a0e', '#c48a16'] } as const;

function paintChat(c: CanvasRenderingContext2D, w: number, h: number, msgs: { mine: boolean; say: string; name: string }[], title: string): void {
  const S = HNC_CHAT_SKIN;
  c.fillStyle = S.bg;
  c.fillRect(0, 0, w, h);
  c.fillStyle = S.bar;
  c.fillRect(0, 0, w, h * 0.11);
  c.fillStyle = S.text;
  c.font = `700 ${h * 0.03}px 'Avenir Next', system-ui, sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(title, w / 2, h * 0.07);
  c.font = `600 ${h * 0.018}px system-ui, sans-serif`;
  c.fillText('23:47', w / 2, h * 0.025);
  let y = h * 0.86;
  const fs = h * 0.034;
  for (let i = msgs.length - 1; i >= 0 && y > h * 0.14; i--) {
    const m = msgs[i];
    c.font = `${m.mine ? 700 : 500} ${fs}px 'Avenir Next', system-ui, sans-serif`;
    const tw = c.measureText(m.say).width;
    const bw = tw + fs * 1.3;
    const bh = fs * 1.9 + (m.mine ? 0 : fs * 0.8);
    y -= bh;
    const x = m.mine ? w - bw - w * 0.05 : w * 0.05;
    c.fillStyle = m.mine ? S.mine : S.bubble;
    c.beginPath();
    c.roundRect(x, y, bw, bh, fs * 0.7);
    c.fill();
    if (!m.mine) {
      c.fillStyle = '#ff9f43';
      c.font = `700 ${fs * 0.62}px system-ui, sans-serif`;
      c.textAlign = 'left';
      c.fillText(m.name, x + fs * 0.65, y + fs * 0.62);
    }
    c.fillStyle = m.mine ? S.mineText : S.text;
    c.font = `${m.mine ? 700 : 500} ${fs}px 'Avenir Next', system-ui, sans-serif`;
    c.textAlign = 'left';
    c.fillText(m.say, x + fs * 0.65, y + bh - fs * 0.92);
    y -= fs * 0.5;
  }
  c.fillStyle = S.bar;
  c.fillRect(0, h * 0.9, w, h * 0.1);
  c.fillStyle = S.muted;
  c.beginPath();
  c.roundRect(w * 0.06, h * 0.92, w * 0.88, h * 0.05, h * 0.025);
  c.fill();
}

export const StageScene: React.FC<SceneProps> = ({ shot, frame, fps, timeline, lens }) => {
  const scene = useThree((s) => s.scene);
  const tone = TONES[(String(shot.set.tone ?? 'navy') as keyof typeof TONES)] ?? TONES.navy;
  React.useMemo(() => {
    scene.background = new THREE.Color(tone[0]);
    scene.fog = new THREE.Fog(tone[0], 14, 40);
  }, [scene, tone]);
  const target = gazeTargets(shot, frame, fps, lens, timeline);
  const me = String(shot.set.me ?? Object.keys(timeline.cast)[0]);
  const chat = ((shot.set.chat as { from: string; say: string }[] | undefined) ?? []).map((m) => {
    const c = timeline.cast[m.from];
    return { mine: m.from === me, say: m.say, name: c ? `${c.name} ${countryFlag(c.country)}` : m.from };
  });
  const title = String(shot.set.title ?? 'chat');
  const key = JSON.stringify(chat) + title;
  const { tex, ctx } = React.useMemo(() => makeCanvasTexture(540, 1080), []);
  React.useEffect(() => () => tex.dispose(), [tex]);
  React.useMemo(() => {
    paintChat(ctx, 540, 1080, chat, title);
    tex.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, tex, key]);
  // Cyclorama: floor + a big curved backdrop.
  const cyc = React.useMemo(() => new THREE.CylinderGeometry(22, 22, 30, 48, 1, true, Math.PI * 0.6, Math.PI * 0.8), []);
  React.useEffect(() => () => cyc.dispose(), [cyc]);
  const P = STAGE.phone;
  const sw = P.w - STAGE.screenInset * 2;
  const sh = P.h - STAGE.screenInset * 2.4;
  return (
    <group>
      <hemisphereLight args={[tone[1], '#05070b', 0.9]} />
      <directionalLight position={[4, 9, 7]} color="#fff4e6" intensity={1.4} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={8} shadow-camera-bottom={-2} />
      <pointLight position={[0, 2.4, 1.2]} color="#ffd98a" intensity={3.2} distance={6} decay={1.5} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color={tone[0]} roughness={0.35} metalness={0.25} />
      </mesh>
      <mesh geometry={cyc} position={[0, 15, -6]}>
        <meshStandardMaterial color={tone[1]} roughness={0.9} side={THREE.BackSide} />
      </mesh>
      {/* The giant phone: body, bezel, screen (emissive), camera pill. */}
      <Block size={[P.w, P.h, P.d]} pos={[0, P.h / 2, -P.d / 2]} color="#0d0f14" rough={0.25} metal={0.5} />
      <Block size={[P.w + 0.04, P.h + 0.04, 0.05]} pos={[0, P.h / 2, -P.d + 0.02]} color="#3a3f48" rough={0.3} metal={0.8} />
      <mesh position={[0, P.h / 2, 0.002]}>
        <planeGeometry args={[sw, sh]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      <Block size={[0.5, 0.1, 0.02]} pos={[0, P.h - 0.18, 0.01]} color="#000000" shadow={false} />
      <Glow pos={[0, P.h / 2, 0.3]} size={6.5} color="#ffd98a" strength={0.22} />
      {shot.actors.map((track) => (
        <CastActor key={track.cast} shot={shot} track={track} member={timeline.cast[track.cast]} frame={frame} fps={fps} target={target} shadowColor="#020306" />
      ))}
    </group>
  );
};
