export { SOCIAL_FORMATS, DEFAULT_FORMAT, DEFAULT_SCENE, DEFAULT_SEED, DEFAULT_FPS, DEFAULT_DURATION, MIN_FPS, MAX_FPS, MIN_DURATION, MAX_DURATION, formatSize, type SocialFormatId } from './config';
export {
  SOCIAL_SCENES, SocialSpecError, compileSpec, parseDuration, parseFormat, parseFps, parseFrameIndex, parseScene, parseSeed,
  resolveSpec, resolveVideoSpec, frameTime, type RawFrameInput, type RawVideoInput, type ResolvedFrameSpec, type ResolvedVideoSpec,
  type SocialFrameSpec, type SocialSceneId, type SocialVideoSpec,
} from './schema';
export { faceoffCamera, faceoffCameraAt, type SocialLens } from './cameras/social-camera';
export { clamp01, lerp, smoothstep, easeInOut, segmentProgress } from './timeline/math';
export { compileVideo, evaluateFrame, frameFilename, type CompiledSocialVideo } from './timeline';
export {
  compileFaceoff, compileFaceoffTimeline, evaluateFaceoffFrame, faceoffFrameToRenderInput, seededRandom,
  type CompiledFaceoff, type FaceoffRenderInput, type FaceoffTimelineData, type SocialActorFrame, type SocialFrameDescription,
} from './scenes/faceoff';
export { renderFrameToPng, renderFramesToDir, clearFramePngs, type RenderedFrame, type RenderedSequence, type SequenceProgress } from './render/frame';
export { SocialRenderSession } from './render/session';
export { pngDimensions } from './render/png';
