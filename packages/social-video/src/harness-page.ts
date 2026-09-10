import { GameRenderer } from '../../../apps/game/src/renderer';
import { resolveVideoSpec } from './schema';
import { compileVideo, evaluateFrame, evaluateOverlays, sceneFrameToRenderInput } from './timeline';
import { compileTemplate } from './templates/compile';
import { evaluateTemplateFrame } from './templates/evaluate';
import { compileTrailer } from './trailers/compile';
import { evaluateTrailerFrame } from './trailers/evaluate';
import './overlays/styles.css';
import { OVERLAY_ROOT_ID, ensureBrandLogoReady, ensureOverlayAssets, renderOverlays } from './overlays/render-dom';

declare global {
  interface Window {
    __HNC_SOCIAL_READY__?: boolean;
    __HNC_SOCIAL_ERROR__?: string;
    __HNC_SOCIAL__?: {
      ready: boolean;
      /** Render one timeline frame by index. Pure timeline evaluation —
       *  page lifetime never advances the scene. Resolves once presented. */
      renderFrame: (frame: number) => Promise<void>;
    };
  }
}

/**
 * Internal render harness (NOT a user-facing editor). Loads one compiled
 * video spec (?scene=faceoff&home=TR&away=GR&seed=42&format=reel&fps=30&
 * duration=4&headline=...&cta=...&overlays=default) or a production template
 * (?template=country-rivalry-reel&home=TR&...), then serves random-access
 * frame renders to Playwright through
 * `window.__HNC_SOCIAL__.renderFrame(frame)`: Three.js frame + deterministic
 * HTML/CSS overlay layers, screenshotted as one 1080×1920 composition.
 * No HUD, no menus, no controls, no wall-clock scene state. Copy travels in
 * the query string via URLSearchParams (safe for spaces/Unicode/emoji).
 */
function boot(): void {
  try {
    const q = new URLSearchParams(location.search);
    const trailerParam = q.get('trailer');
    const specInput = {
      scene: q.get('scene'),
      template: q.get('template'),
      trailer: q.get('trailer'),
      home: q.get('home'),
      away: q.get('away'),
      format: q.get('format'),
      seed: q.get('seed'),
      fps: q.get('fps'),
      duration: q.get('duration'),
      attackTeam: q.get('attackTeam'),
      attackStyle: q.get('attackStyle'),
      headline: q.get('headline'),
      secondary: q.get('secondary'),
      cta: q.get('cta'),
      overlays: q.get('overlays'),
    };
    const trailerInput = trailerParam ? {
      trailer: q.get('trailer'),
      countries: q.get('countries'),
      format: q.get('format'),
      seed: q.get('seed'),
      fps: q.get('fps'),
      attackTeam: q.get('attackTeam'),
      attackStyle: q.get('attackStyle'),
      overlays: q.get('overlays'),
    } : null;
    const trl = trailerInput ? compileTrailer(trailerInput) : null;
    const resolved = trl === null ? resolveVideoSpec(specInput) : null;
    const tpl = trl === null && resolved!.template !== undefined ? compileTemplate(specInput) : null;
    const compiled = trl === null && tpl === null ? compileVideo(specInput) : null;
    const width = trl?.width ?? tpl?.width ?? compiled!.width;
    const height = trl?.height ?? tpl?.height ?? compiled!.height;
    const pixelRatio = trl?.pixelRatio ?? tpl?.pixelRatio ?? compiled!.pixelRatio;
    const stage = document.getElementById('stage');
    if (!stage) throw new Error('Missing #stage mount');
    const overlayHost = document.getElementById(OVERLAY_ROOT_ID);
    if (!overlayHost) throw new Error(`Missing #${OVERLAY_ROOT_ID} mount`);
    const renderer = new GameRenderer(stage, {
      mode: 'social',
      width,
      height,
      pixelRatio,
    });
    // Brand logo validates once at startup (decodes + pixel-checks) so
    // branded frames never resolve with a half-loaded or empty image.
    // Failure falls back to the styled-text lockup (same overlay timing).
    const assetsReady = ensureOverlayAssets().catch(() => false);
    let assetsDone = false;
    void assetsReady.then(() => {
      assetsDone = true;
    });
    const renderFrame = (frame: number): Promise<void> => {
      if (trl !== null) {
        const result = evaluateTrailerFrame(trl, frame);
        renderer.renderSocial(
          result.input.state, result.input.camera, result.input.clock, result.input.pose, result.input.effects, result.input.crowd,
        );
        renderOverlays(result.overlays, overlayHost);
      } else if (tpl !== null) {
        const result = evaluateTemplateFrame(tpl, frame);
        renderer.renderSocial(
          result.input.state, result.input.camera, result.input.clock, result.input.pose, result.input.effects, result.input.crowd,
        );
        renderOverlays(result.overlays, overlayHost);
      } else {
        const desc = evaluateFrame(compiled!, frame);
        const input = sceneFrameToRenderInput(compiled!, desc);
        renderer.renderSocial(input.state, input.camera, input.clock, input.pose, input.effects, input.crowd);
        renderOverlays(evaluateOverlays(compiled!, frame), overlayHost);
      }
      // Resolve once the frame has been presented — no arbitrary sleeps on
      // the screenshot side; Playwright awaits this exact promise.
      return new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (!assetsDone && overlayHost.querySelector('img')) {
            // Logo still decoding: wait for this frame's brand image, then
            // present on the next paint — still fully deterministic.
            void ensureBrandLogoReady(overlayHost).then(() => {
              requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
            });
          } else {
            resolve();
          }
        }));
      });
    };
    window.__HNC_SOCIAL__ = { ready: true, renderFrame };
    window.__HNC_SOCIAL_READY__ = true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    window.__HNC_SOCIAL_ERROR__ = message;
    window.__HNC_SOCIAL__ = {
      ready: false,
      renderFrame: () => Promise.reject(new Error(message)),
    };
  }
}

boot();
