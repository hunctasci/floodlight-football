import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { CameraPose } from '../cameras/registry';
import { shotCameraPose } from '../cameras/shot-camera';
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
import { shotMomentTime } from '../reel/shot-clock';
import { Confetti, ImpactFlash, SpeedLines, Vignette } from '../effects/effects';
import { BallTrail, Cinebars, ImpactBurst, LightsOn, StadiumGrade } from '../effects/cinematic';
import { Eyebrow } from '../graphics/Eyebrow';
import { Scoreboard } from '../graphics/Scoreboard';
import { GoalCall } from '../graphics/GoalCall';
import { WorldTable, type WorldTableRow } from '../graphics/WorldTable';
import { BrandReveal } from '../graphics/BrandReveal';
import { screenShakeOffset } from '../effects/presets';
import { AudioTrack } from '../audio/AudioTrack';
import type { ReelSpec, ShotSpec } from '../reel/types';
import { compileShotPlan } from '../reel/compile';

/** Applies the shot camera pose (computed once per frame in ShotView). */
const CameraUpdater: React.FC<{ pose: CameraPose }> = ({ pose }) => {
  const { camera } = useThree();
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

function OverlayLayer({ shot, frame, fps }: { shot: ShotSpec; frame: number; fps: number }) {
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
          // Trailer graphics: timing anchored to GLOBAL frames in `data`, so
          // they stay continuous when the same element spans several shots.
          case 'eyebrow': {
            const d = (g.data ?? {}) as { at?: number; exitAt?: number };
            return <Eyebrow key={key} frame={frame} text={g.text ?? ''} at={d.at ?? start} exitAt={d.exitAt ?? start + dur} />;
          }
          case 'scoreboard': {
            const d = (g.data ?? {}) as { before?: [number, number]; after?: [number, number]; clock?: string; enterAt?: number; flipAt?: number };
            return (
              <Scoreboard key={key} frame={frame} fps={fps} home={shot.home ?? 'TR'} away={shot.away ?? 'GR'} before={d.before ?? [0, 0]} after={d.after} clock={d.clock ?? ''} enterAt={d.enterAt} flipAt={d.flipAt} />
            );
          }
          case 'goal-call': {
            const d = (g.data ?? {}) as { at?: number; exitAt?: number; sub?: string };
            return <GoalCall key={key} frame={frame} fps={fps} text={g.text ?? 'GOAL!'} sub={d.sub} at={d.at ?? start} exitAt={d.exitAt ?? start + dur} />;
          }
          case 'world-table': {
            const d = (g.data ?? {}) as { rows?: WorldTableRow[]; hero?: string; gain?: number; enterAt?: number; climbAt?: number; exitAt?: number; lines?: [string, string] };
            return (
              <WorldTable key={key} frame={frame} fps={fps} rows={d.rows ?? []} hero={d.hero ?? shot.home ?? 'TR'} gain={d.gain ?? 3} enterAt={d.enterAt ?? start} climbAt={d.climbAt ?? start + 30} exitAt={d.exitAt} lines={d.lines ?? ['YOUR COUNTRY.', 'YOUR LEAGUE.']} />
            );
          }
          case 'brand-reveal': {
            const d = (g.data ?? {}) as { at?: number; words?: string[]; site?: string; footer?: string };
            return <BrandReveal key={key} frame={frame} fps={fps} at={d.at ?? start} words={d.words ?? ['PLAY.', 'WIN.', 'CLIMB.']} site={d.site ?? 'hncleague.com'} footer={d.footer} />;
          }
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

  // One camera pose per frame: drives the 3D rig AND projected 2D effects.
  const pose = shotCameraPose(shot, frame, fps, spec.seed);
  // Clocked shots play a window of one continuous moment timeline.
  const clock = shot.momentClock ? shotMomentTime(shot, frame, fps) : undefined;
  const effectOf = (type: string) => (shot.effects ?? []).find((e) => e.type === type);
  const inWindow = (e: { startFrame?: number; durationInFrames?: number } | undefined) =>
    !!e && local >= (e.startFrame ?? 0) && local < (e.startFrame ?? 0) + (e.durationInFrames ?? shot.durationInFrames);
  const lights = effectOf('lights-on');
  const bars = effectOf('cinebars');
  const trail = effectOf('ball-trail');
  const burst = effectOf('impact-burst');
  const grade = effectOf('stadium-grade');

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
      <ThreeCanvas
        width={width}
        height={height}
        dpr={1}
        shadows
        gl={{
          antialias: true,
          outputColorSpace: THREE.SRGBColorSpace,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.12,
        }}
        camera={{ fov: 50, near: 0.1, far: 280, position: [0, 16, 30] }}
      >
        {/* Canonical HNC daylight (matches GameRenderer exactly). The old
            `linear flat` + ambient 0.9 / hemi 1.1 / dir 1.6 setup disabled
            sRGB + tone mapping and washed out the Reel vs the game. */}
        <hemisphereLight args={['#e8f6ff', '#2f6b35', 2.35]} />
        <directionalLight
          position={[-25, 42, 18]}
          intensity={2.4}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-60}
          shadow-camera-right={60}
          shadow-camera-top={45}
          shadow-camera-bottom={-45}
        />
        <CameraUpdater pose={pose} />
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
            momentTime={clock?.time}
            momentLength={clock?.length}
          />
          {actorEls}
        </group>
      </ThreeCanvas>
      {/* Cinematic layer: in-world projections, then frame grades. */}
      {trail && inWindow(trail) ? <BallTrail shot={shot} frame={frame} fps={fps} pose={pose} intensity={trail.intensity ?? 1} /> : null}
      {burst ? <ImpactBurst shot={shot} at={shot.startFrame + (burst.startFrame ?? 0)} frame={frame} fps={fps} pose={pose} intensity={burst.intensity ?? 1} /> : null}
      {grade && inWindow(grade) ? <StadiumGrade local={local - (grade.startFrame ?? 0)} fps={fps} intensity={grade.intensity ?? 1} /> : null}
      {bars && inWindow(bars) ? <Cinebars local={local - (bars.startFrame ?? 0)} durationInFrames={bars.durationInFrames ?? shot.durationInFrames} fps={fps} /> : null}
      {lights && inWindow(lights) ? <LightsOn local={local - (lights.startFrame ?? 0)} durationInFrames={lights.durationInFrames ?? shot.durationInFrames} /> : null}
      {/* 2D overlays */}
      <OverlayLayer shot={shot} frame={frame} fps={fps} />
      {showSpeed ? <SpeedLines frame={frame} /> : null}
      {showConfetti ? <Confetti seed={spec.seed} frame={frame} /> : null}
      {showVignette ? <Vignette /> : null}
      {/* Legacy: impact flash on the first 6 frames of payoff shots. Clocked
          shots cut mid-action (and the hook opens in darkness), so they place
          impacts explicitly with impact-burst instead. */}
      {shot.footballMoment && !shot.momentClock && local < 6 && local >= 0 ? <ImpactFlash progress={local / 6} /> : null}
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
export const ReelComposition: React.FC<{ spec: ReelSpec; sfx?: string }> = ({ spec, sfx }) => {
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
      <AudioTrack cues={allCues} fps={spec.fps} totalFrames={plan.totalFrames} music={spec.audio?.music} musicVolume={spec.audio?.musicVolume ?? 0.25} sfx={sfx} />
    </AbsoluteFill>
  );
};

/** Helper for RemotionRoot: does the outgoing shot fully cover at swap time? */
export function shotCoversAtSwap(shot: ShotSpec): boolean {
  const t = shot.transitionOut;
  if (!t) return false;
  return transitionCoverage(t.type, Math.floor(t.durationInFrames * 0.5), t.durationInFrames) >= 0.95;
}
