export { SOCIAL_FORMATS, DEFAULT_FORMAT, DEFAULT_SCENE, DEFAULT_SEED, formatSize, type SocialFormatId } from './config';
export {
  SOCIAL_SCENES, SocialSpecError, compileSpec, parseFormat, parseScene, parseSeed,
  resolveSpec, type RawFrameInput, type ResolvedFrameSpec, type SocialFrameSpec, type SocialSceneId,
} from './schema';
export { faceoffCamera, type SocialLens } from './cameras/social-camera';
export { compileFaceoff, seededRandom, type CompiledFaceoff } from './scenes/faceoff';
export { renderFrameToPng, pngDimensions, type RenderedFrame } from './render/frame';
