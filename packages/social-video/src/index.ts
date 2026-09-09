export { SOCIAL_FORMATS, DEFAULT_FORMAT, DEFAULT_SCENE, DEFAULT_SEED, DEFAULT_FPS, DEFAULT_DURATION, SCENE_DEFAULT_DURATION, MIN_FPS, MAX_FPS, MIN_DURATION, MAX_DURATION, formatSize, type SocialFormatId } from './config';
export {
  SOCIAL_SCENES, ATTACK_TEAMS, ATTACK_STYLES, SocialSpecError, compileSpec, parseAttackStyle, parseAttackTeam, parseDuration, parseFormat, parseFps, parseFrameIndex, parseScene, parseSeed,
  resolveSpec, resolveVideoSpec, frameTime, type AttackStyle, type AttackTeam, type RawFrameInput, type RawVideoInput, type ResolvedFrameSpec, type ResolvedVideoSpec,
  type SocialFrameSpec, type SocialSceneId, type SocialVideoSpec,
} from './schema';
export { faceoffCamera, faceoffCameraAt, type SocialLens } from './cameras/social-camera';
export { clamp01, lerp, smoothstep, easeInOut, segmentProgress } from './timeline/math';
export { evaluateTrack, facingBetween, groundPass, loftedPass, shotArc, type ActorKeyframe, type Vec2, type Vec3 } from './timeline/tracks';
export { compileVideo, evaluateFrame, frameFilename, sceneFrameToRenderInput, type CompiledSocialVideo, type SceneFrameDescription, type SocialRenderInput } from './timeline';
export {
  compileFaceoff, compileFaceoffTimeline, evaluateFaceoffFrame, faceoffFrameToRenderInput, seededRandom,
  type CompiledFaceoff, type FaceoffRenderInput, type FaceoffTimelineData, type SocialActorFrame, type SocialFrameDescription,
} from './scenes/faceoff';
export {
  ATTACK_GOAL_BEATS, GOAL_X, compileAttackGoalTimeline, evaluateAttackGoalFrame, attackGoalFrameToRenderInput,
  type AttackGoalActorFrame, type AttackGoalEffects, type AttackGoalFrameDescription, type AttackGoalRenderInput, type AttackGoalTimelineData,
} from './scenes/attack-goal';
export { renderFrameToPng, renderFramesToDir, clearFramePngs, type RenderedFrame, type RenderedSequence, type SequenceProgress } from './render/frame';
export { SocialRenderSession } from './render/session';
export { pngDimensions } from './render/png';
