export { SOCIAL_FORMATS, DEFAULT_FORMAT, DEFAULT_SCENE, DEFAULT_SEED, DEFAULT_FPS, DEFAULT_DURATION, SCENE_DEFAULT_DURATION, MIN_FPS, MAX_FPS, MIN_DURATION, MAX_DURATION, formatSize, type SocialFormatId } from './config';
export {
  SOCIAL_SCENES, SOCIAL_TEMPLATES, ATTACK_TEAMS, ATTACK_STYLES, OVERLAY_MODES, HEADLINE_MAX, SECONDARY_MAX, CTA_MAX, SocialSpecError, compileSpec, parseAttackStyle, parseAttackTeam, parseDuration, parseFormat, parseFps, parseFrameIndex, parseScene, parseTemplate, parseTrailer, parseTrailerCountries, parseSeed, parseOverlays, parseHeadline, parseSecondary, parseCta,
  resolveSpec, resolveVideoSpec, resolveTrailerSpec, frameTime, type AttackStyle, type AttackTeam, type OverlayMode, type RawFrameInput, type RawVideoInput, type RawTrailerInput, type ResolvedFrameSpec, type ResolvedVideoSpec, type ResolvedTrailerSpec,
  type SocialFrameSpec, type SocialSceneId, type SocialVideoSpec, type TemplateId, type TrailerId,
} from './schema';
export { faceoffCamera, faceoffCameraAt, type SocialLens } from './cameras/social-camera';
export { clamp01, lerp, smoothstep, easeInOut, segmentProgress } from './timeline/math';
export { evaluateTrack, facingBetween, groundPass, loftedPass, shotArc, type ActorKeyframe, type Vec2, type Vec3 } from './timeline/tracks';
export { compileVideo, evaluateFrame, evaluateOverlays, frameFilename, sceneFrameToRenderInput, type CompiledSocialVideo, type SceneFrameDescription, type SocialRenderInput } from './timeline';
export {
  compileFaceoff, compileFaceoffTimeline, evaluateFaceoffFrame, faceoffFrameToRenderInput, seededRandom,
  type CompiledFaceoff, type FaceoffRenderInput, type FaceoffTimelineData, type SocialActorFrame, type SocialFrameDescription,
} from './scenes/faceoff';
export {
  ATTACK_GOAL_BEATS, GOAL_X, compileAttackGoalTimeline, evaluateAttackGoalFrame, attackGoalFrameToRenderInput,
  type AttackGoalActorFrame, type AttackGoalEffects, type AttackGoalFrameDescription, type AttackGoalRenderInput, type AttackGoalTimelineData,
} from './scenes/attack-goal';
export { renderFrameToPng, renderFramesToDir, clearFramePngs, type RenderedFrame, type RenderedSequence, type SequenceProgress } from './render/frame';
export { compileOverlayPlan } from './overlays/compile';
export { evaluateOverlayFrame, fadeInOut, slideIn, punchScale } from './overlays/evaluate';
export { BRAND_DOMAIN, DEFAULT_ATTACK_HEADLINE, DEFAULT_CTA, DEFAULT_FACEOFF_HEADLINE, attackGoalOverlayPlan, faceoffOverlayPlan, goalText } from './overlays/presets';
export type { EvaluatedOverlay, OverlayFrameDescription, OverlayKind, OverlayPlanEntry, SocialCopy, VersusPayload } from './overlays/types';
export { AUDIO_SAMPLE_RATE, compileAudioPlan } from './audio/compile';
export { encodeWav, renderAudioSamples, renderAudioToWav } from './audio/render';
export type { AudioEvent, AudioEventType, CompiledAudio } from './audio/types';
export { EncoderNotFoundError, resolveExecutable, resolveFfmpeg, resolveFfprobe } from './encode/ffmpeg';
export { AUDIO_BITRATE, VIDEO_CRF, VIDEO_PRESET, buildEncodeArgs, runFfmpeg, type SpawnResult, type VideoEncodeInput } from './encode/video';
export { hasFaststart, probeMedia, validateMedia, ProbeError, type ExpectedMedia, type ProbedMedia } from './encode/probe';
export { SocialRenderSession } from './render/session';
export { pngDimensions } from './render/png';
export { compileTemplate, type TemplateCompileOverrides } from './templates/compile';
export { evaluateTemplateFrame, segmentAtTime, templateLocalFrame, type TemplateFrameResult } from './templates/evaluate';
export { compileTemplateAudio, type TemplateAudioInput } from './templates/audio';
export { countryRivalryDuration, countryRivalrySegments, shiftOverlayPlan, templateDuration, templateTableDuration, type TemplateSegmentDef } from './templates/presets';
export type { CompiledSegment, CompiledTemplate, TemplateSegmentKind } from './templates/types';
export { renderTemplateFrameToPng, renderTemplateFramesToDir } from './render/frame';
export { compileTrailer, compileTrailerFromResolved, trailerOverlayPlan } from './trailers/compile';
export { evaluateTrailerFrame, trailerLocalFrame, trailerLocalTime, trailerSegmentAtTime, type TrailerFrameResult } from './trailers/evaluate';
export { compileTrailerAudio, trailerEventTime } from './trailers/audio';
export { worldLeagueHeroShots, trailerDuration, WORLD_LEAGUE_HERO_DURATION, WORLD_LEAGUE_HERO_FPS } from './trailers/presets';
export type { CompiledTrailer, CompiledTrailerSegment, TrailerShotDef, TrailerShotPurpose, TrailerSourceScene } from './trailers/types';
