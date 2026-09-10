import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { evaluateCamera } from '../cameras/registry';
import { resolveAnchor } from '../stages/registry';
import { Stage3D } from '../stages/Stage';
import { Actor } from '../actors/Actor';
import { Caption } from '../graphics/Caption';
import { Headline, Subheadline } from '../graphics/Headline';
import { Leaderboard } from '../graphics/Leaderboard';
import { Versus, GoalBanner } from '../graphics/Versus';
import { MemeText } from '../graphics/MemeText';
import { ChatBubble } from '../graphics/ChatBubble';
import { CTA } from '../graphics/CTA';
import { Brand } from '../graphics/Brand';
import { Transition } from '../transitions/Transition';
import { transitionCoverage } from '../transitions/registry';
import { sampleFootballMoment } from '../football/adapter/choreography';
import { Confetti, ImpactFlash, SpeedLines, Vignette } from '../effects/effects';
import { screenShakeOffset } from '../effects/presets';
import { AudioTrack } from '../audio/AudioTrack';
import type { ReelSpec, ShotSpec } from '../reel/types';
import { compileShotPlan } from '../reel/compile';

/** Deterministic camera: absolute frame -> pose, applied every render. */
const CameraUpdater: React.FC<{
  preset?: string;
  shotStart: number;
  duration: number;
  follow?: { x: number; z: number };
  globalFrame: number;
}> = ({ preset, shotStart, duration, follow, globalFrame }) => {
  const { camera } = useThree();
  const frame = globalFrame;
  const local = frame - shotStart;
  const base = evaluateCamera(preset ?? 'graphics-static', Math.max(0, local), Math.max(1, duration));
  // Ball-following information shots: keep the ball framed in portrait 9:16.
  // Pure function of the evaluated ball position — no per-frame state.
  const pose = follow && preset !== 'football-faceoff'
    ? {
        pos: [follow.x * 0.55, base.pos[1], base.pos[2]] as [number, number, number],
        look: [follow.x * 0.8, 1, follow.z * 0.4] as [number, number, number],
        fov: base.fov,
      }
    : base;
  const shakeShot = { x: 0, y: 0 };
  void shakeShot;
  React.useMemo(() => {
    camera.position.set(pose.pos[0], pose.pos[1], pose.pos[2]);
    camera.lookAt(new THREE.Vector3(pose.look[0], pose.look[1], pose.look[2]));
    if (camera instanceof THREE.PerspectiveCamera) {
      if (camera.fov !== pose.fov) {
        camera.fov = pose.fov;
        camera.updateProjectionMatrix();
      }
    }
  }, [camera, pose.pos, pose.look, pose.fov]);
  return null;
};

function OverlayLayer({ shot, frame }: { shot: ShotSpec; frame: number }) {
  return (
    <>
      {(shot.overlays ?? []).map((g, i) => {
        const start = shot.startFrame + (g.startFrame ?? 0);
        const dur = g.durationInFrames ?? shot.durationInFrames;
        const local = frame - start;
        if (local < 0 || local >= dur) return null;
        const key = `${shot.id}-g${i}`;
        switch (g.kind) {
          case 'headline':
            return <Headline key={key} text={g.text ?? ''} preset={g.preset} frame={frame} />;
          case 'subheadline':
            return <Subheadline key={key} text={g.text ?? ''} />;
          case 'caption':
            return <Caption key={key} text={g.text ?? ''} preset={g.preset ?? 'meme'} startFrame={start} durationInFrames={dur} frame={frame} />;
          case 'meme-text':
            return <MemeText key={key} text={g.text ?? ''} startFrame={start} durationInFrames={dur} frame={frame} />;
          case 'leaderboard': {
            const data = (g.data ?? {}) as { home?: string; away?: string; leader?: string };
            return <Leaderboard key={key} home={String(data.home ?? shot.home ?? 'TR')} away={String(data.away ?? shot.away ?? 'GR')} leader={data.leader ? String(data.leader) : undefined} />;
          }
          case 'versus': {
            const data = (g.data ?? {}) as { home?: string; away?: string };
            return <Versus key={key} home={String(data.home ?? shot.home ?? 'TR')} away={String(data.away ?? shot.away ?? 'GR')} />;
          }
          case 'goal-banner': {
            const data = (g.data ?? {}) as { home?: string };
            return <GoalBanner key={key} home={String(data.home ?? shot.home ?? 'TR')} />;
          }
          case 'cta':
            return <CTA key={key} headline={g.text} frame={frame} />;
          case 'brand':
            return <Brand key={key} />;
          case 'chat-bubble':
            return <ChatBubble key={key} text={g.text ?? ''} />;
          case 'flag':
          case 'badge':
            return <Caption key={key} text={g.text ?? ''} preset="subtitle" startFrame={start} durationInFrames={dur} frame={frame} />;
          default:
            return null;
        }
      })}
    </>
  );
}

const ShotView: React.FC<{ shot: ShotSpec; spec: ReelSpec; fps: number; width: number; height: number; globalFrame: number }> = ({
  shot,
  spec,
  fps,
  width,
  height,
  globalFrame,
}) => {
  const frame = globalFrame;
  const local = frame - shot.startFrame;
  const shakeEffect = (shot.effects ?? []).find((e) => e.type === 'screen-shake');
  const shake = shakeEffect
    ? screenShakeOffset(frame, shakeEffect.intensity ?? 0.6, spec.seed)
    : { x: 0, y: 0 };
  const showConfetti = (shot.effects ?? []).some((e) => e.type === 'confetti');
  const showSpeed = (shot.effects ?? []).some((e) => e.type === 'speed-lines');
  const showVignette = (shot.effects ?? []).some((e) => e.type === 'vignette');

  // Football information shots track the evaluated ball (deterministic).
  let follow: { x: number; z: number } | undefined;
  if (shot.footballMoment && (shot.camera ?? '').startsWith('football')) {
    const t = Math.min(
      shot.durationInFrames / fps,
      Math.max(0, (frame - shot.startFrame) / fps),
    );
    try {
      const choreo = sampleFootballMoment(
        shot.footballMoment,
        t,
        shot.durationInFrames / fps,
        shot.attackingTeam !== 'away',
      );
      follow = { x: choreo.ball.x, z: choreo.ball.z };
    } catch {
      follow = undefined;
    }
  }

  const actorEls = (shot.actors ?? []).map((a, i) => {
    const actorSpec = (spec.cast ?? []).find((c) => c.id === a.actor);
    if (!actorSpec) return null;
    let pos: [number, number, number] = [0, 0, 0];
    let rotY = 0;
    try {
      const anchor = resolveAnchor(shot.stage, a.anchor ?? actorSpec.anchor ?? 'center');
      pos = anchor.pos;
      rotY = anchor.rotY ?? 0;
    } catch {
      pos = [0, 0, 0];
    }
    return <Actor key={i} spec={actorSpec} frame={frame} fps={fps} animation={a.animation} position={pos} rotationY={rotY} />;
  });

  // Transition overlays (out transitions render on top of this shot).
  const transOut = shot.transitionOut;

  return (
    <AbsoluteFill>
      <ThreeCanvas width={width} height={height} linear flat dpr={1} gl={{ antialias: true }}>
        <ambientLight intensity={0.9} />
        <hemisphereLight args={['#e8f6ff', '#2f6b35', 1.1]} />
        <directionalLight position={[-25, 42, 18]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} />
        <CameraUpdater preset={shot.camera} shotStart={shot.startFrame} duration={shot.durationInFrames} follow={follow} globalFrame={frame} />
        <group position={[shake.x * 4, shake.y * 4, 0]}>
          <Stage3D
            stageId={shot.stage}
            frame={frame}
            fps={fps}
            moment={shot.footballMoment}
            home={shot.home}
            away={shot.away}
            attackingTeam={shot.attackingTeam}
            shotStartFrame={shot.startFrame}
            durationInFrames={shot.durationInFrames}
          />
          {actorEls}
        </group>
      </ThreeCanvas>
      {/* 2D overlays */}
      <OverlayLayer shot={shot} frame={frame} />
      {showSpeed ? <SpeedLines frame={frame} /> : null}
      {showConfetti ? <Confetti seed={spec.seed} frame={frame} /> : null}
      {showVignette ? <Vignette /> : null}
      {/* impact flash on football clang/goal (first 6 frames of payoff shots) */}
      {shot.footballMoment && local < 6 && local >= 0 ? <ImpactFlash progress={local / 6} /> : null}
      {transOut ? (
        <Transition
          type={transOut.type}
          startFrame={shot.startFrame + shot.durationInFrames - transOut.durationInFrames}
          durationInFrames={transOut.durationInFrames}
          intensity={transOut.intensity ?? 1}
          seed={spec.seed}
          frame={frame}
        />
      ) : null}
      {shot.transitionIn ? (
        <Transition
          type={shot.transitionIn.type}
          startFrame={shot.startFrame}
          durationInFrames={shot.transitionIn.durationInFrames}
          intensity={shot.transitionIn.intensity ?? 1}
          seed={spec.seed}
          frame={frame}
        />
      ) : null}
    </AbsoluteFill>
  );
};

/**
 * Generic Reel composition: ReelSpec -> ShotPlan -> Remotion Sequences.
 * All animation derives from absolute frame; no wall clocks, no useState loops.
 */
export const ReelComposition: React.FC<{ spec: ReelSpec }> = ({ spec }) => {
  const { fps: compFps, width, height } = useVideoConfig();
  void compFps;
  const globalFrame = useCurrentFrame();
  const plan = compileShotPlan(spec);
  const allCues = plan.shots.flatMap((s) =>
    (s.audio ?? []).map((c) => ({ ...c, startFrame: c.startFrame + s.startFrame })),
  );
  return (
    <AbsoluteFill style={{ backgroundColor: '#0b1526' }}>
      {plan.shots.map((shot) => (
        <Sequence key={shot.id} from={shot.startFrame} durationInFrames={shot.durationInFrames} name={shot.id}>
          <ShotView shot={shot} spec={spec} fps={spec.fps} width={width} height={height} globalFrame={globalFrame} />
        </Sequence>
      ))}
      {/* Global caption track */}
      {(spec.captions?.cues ?? []).map((c, i) => (
        <Caption key={`cap-${i}`} text={c.text} preset={c.preset ?? spec.captions?.preset} startFrame={c.startFrame} durationInFrames={c.durationInFrames} />
      ))}
      <AudioTrack cues={allCues} fps={spec.fps} totalFrames={plan.totalFrames} music={spec.audio?.music} musicVolume={spec.audio?.musicVolume ?? 0.25} />
    </AbsoluteFill>
  );
};

/** Helper for RemotionRoot: does the outgoing shot fully cover at swap time? */
export function shotCoversAtSwap(shot: ShotSpec): boolean {
  const t = shot.transitionOut;
  if (!t) return false;
  return transitionCoverage(t.type, Math.floor(t.durationInFrames * 0.5), t.durationInFrames) >= 0.95;
}
