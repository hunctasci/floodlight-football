import { GameRenderer } from '../../../apps/game/src/renderer';
import { resolveVideoSpec } from './schema';
import { compileVideo, evaluateFrame } from './timeline';
import { faceoffFrameToRenderInput } from './scenes/faceoff';

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
 * duration=4), then serves random-access frame renders to Playwright through
 * `window.__HNC_SOCIAL__.renderFrame(frame)`. No HUD, no menus, no controls,
 * no wall-clock scene state.
 */
function boot(): void {
  try {
    const q = new URLSearchParams(location.search);
    const compiled = compileVideo(resolveVideoSpec({
      scene: q.get('scene'),
      home: q.get('home'),
      away: q.get('away'),
      format: q.get('format'),
      seed: q.get('seed'),
      fps: q.get('fps'),
      duration: q.get('duration'),
    }));
    const stage = document.getElementById('stage');
    if (!stage) throw new Error('Missing #stage mount');
    const renderer = new GameRenderer(stage, {
      mode: 'social',
      width: compiled.width,
      height: compiled.height,
      pixelRatio: compiled.pixelRatio,
    });
    const renderFrame = (frame: number): Promise<void> => {
      const desc = evaluateFrame(compiled, frame);
      const input = faceoffFrameToRenderInput(desc, compiled.home, compiled.away);
      renderer.renderSocial(input.state, input.camera, input.clock, input.pose);
      // Resolve once the frame has been presented — no arbitrary sleeps on
      // the screenshot side; Playwright awaits this exact promise.
      return new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
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
