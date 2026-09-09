import { GameRenderer } from '../../../apps/game/src/renderer';
import { resolveSpec, SocialSpecError } from './schema';
import { compileFaceoff } from './scenes/faceoff';

declare global {
  interface Window {
    __HNC_SOCIAL_READY__?: boolean;
    __HNC_SOCIAL_ERROR__?: string;
  }
}

/**
 * Internal render harness (NOT a user-facing editor). Reads a machine-friendly
 * query string (?scene=faceoff&home=TR&away=GR&seed=42&format=reel), stages the
 * deterministic social scene with the real HNC renderer, then signals
 * readiness for the Playwright screenshot. No HUD, no menus, no controls.
 */
function boot(): void {
  try {
    const q = new URLSearchParams(location.search);
    const spec = resolveSpec({
      scene: q.get('scene'),
      home: q.get('home'),
      away: q.get('away'),
      format: q.get('format'),
      seed: q.get('seed'),
    });
    if (spec.scene !== 'faceoff') throw new SocialSpecError(`Unknown scene: ${spec.scene}`);
    const { state, camera } = compileFaceoff(spec);
    const stage = document.getElementById('stage');
    if (!stage) throw new Error('Missing #stage mount');
    const renderer = new GameRenderer(stage, {
      mode: 'social',
      width: spec.width,
      height: spec.height,
      pixelRatio: spec.pixelRatio,
    });
    renderer.renderSocial(state, camera);
    // Let the presented frame settle, then signal — no arbitrary sleeps on
    // the screenshot side; Playwright waits for this exact flag.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      window.__HNC_SOCIAL_READY__ = true;
    }));
  } catch (error) {
    window.__HNC_SOCIAL_ERROR__ = error instanceof Error ? error.message : String(error);
  }
}

boot();
