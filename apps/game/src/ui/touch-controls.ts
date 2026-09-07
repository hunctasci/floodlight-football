import { releaseStick, setShootAim, setStick, touchDown, touchUp, TOUCH_BUTTONS, type TouchState } from '../input/touch';

const STICK_R = 56;

export interface TouchControls {
  touchLayer: HTMLDivElement | null;
  stickZone: HTMLElement | null;
  stickNub: HTMLElement | null;
  menuPad: HTMLElement | null;
  matchPad: HTMLElement | null;
  updateVisibility(screen: string): void;
}

function bindHold(touch: TouchState, onEnable: () => void, el: Element, code: string) {
  const start = (e: Event) => {
    e.preventDefault();
    touchDown(touch, code);
    onEnable();
  };
  const end = (e: Event) => {
    e.preventDefault();
    touchUp(touch, code);
  };
  el.addEventListener('touchstart', start, { passive: false });
  el.addEventListener('touchend', end);
  el.addEventListener('touchcancel', end);
}

/**
 * Touch-control DOM (mobile): joystick + buttons emit the same key codes as
 * the keyboard so the sim sees one unified namespace. Moved verbatim from
 * main.ts — application orchestration (screen state, pause, audio) stays in
 * main.ts via the onEnable callback.
 */
export function setupTouchControls(
  app: HTMLElement,
  touch: TouchState,
  isTouchDevice: boolean,
  onEnable: () => void,
): TouchControls {
  let touchLayer: HTMLDivElement | null = null;
  let stickZone: HTMLElement | null = null;
  let stickNub: HTMLElement | null = null;
  let menuPad: HTMLElement | null = null;
  let matchPad: HTMLElement | null = null;

  if (isTouchDevice) {
    touchLayer = document.createElement('div');
    touchLayer.className = 'touch';
    touchLayer.id = 'touch';
    touchLayer.innerHTML = `
    <div class="stick-zone"><div class="stick-base"><div class="stick-nub"></div></div></div>
    <div class="match-pad">
      <button class="tbtn tswitch" data-code="KeyQ">SWITCH</button>
      <button class="tbtn tpass" data-code="KeyS">PASS</button>
      <button class="tbtn tshoot" data-code="KeyK">SHOOT</button>
    </div>
    <div class="menu-pad">
      <button class="tbtn mup" data-code="ArrowUp">▲</button>
      <button class="tbtn mleft" data-code="ArrowLeft">◀</button>
      <button class="tbtn mok" data-code="Enter">OK</button>
      <button class="tbtn mright" data-code="ArrowRight">▶</button>
      <button class="tbtn mdown" data-code="ArrowDown">▼</button>
      <button class="tbtn mback" data-code="Escape">BACK</button>
    </div>`;
    app.append(touchLayer);
    stickZone = touchLayer.querySelector('.stick-zone') as HTMLElement;
    stickNub = touchLayer.querySelector('.stick-nub') as HTMLElement;
    menuPad = touchLayer.querySelector('.menu-pad') as HTMLElement;
    matchPad = touchLayer.querySelector('.match-pad') as HTMLElement;
    touchLayer
      .querySelectorAll('button[data-code]')
      .forEach((b) => bindHold(touch, onEnable, b, (b as HTMLElement).dataset.code!));
    // SHOOT drag-aim: sliding the finger on SHOOT moves the reticle; the
    // release fires with that placement (same sim semantics as mouse drag).
    const shootBtn = touchLayer.querySelector(`button[data-code="${TOUCH_BUTTONS.shoot}"]`);
    if (shootBtn) {
      let aimId: number | null = null, ax = 0, ay = 0;
      shootBtn.addEventListener('touchstart', (e: Event) => {
        const t = (e as TouchEvent).changedTouches[0];
        aimId = t.identifier; ax = t.clientX; ay = t.clientY;
      }, { passive: true });
      shootBtn.addEventListener('touchmove', (e: Event) => {
        for (const t of Array.from((e as TouchEvent).changedTouches)) {
          if (t.identifier === aimId) setShootAim(touch, t.clientX - ax, t.clientY - ay);
        }
      }, { passive: true });
      const aimEnd = (e: Event) => {
        for (const t of Array.from((e as TouchEvent).changedTouches)) {
          if (t.identifier === aimId) aimId = null;
        }
      };
      shootBtn.addEventListener('touchend', aimEnd);
      shootBtn.addEventListener('touchcancel', aimEnd);
    }
    let stickId: number | null = null;
    let anchorX = 0;
    let anchorY = 0;
    stickZone.addEventListener(
      'touchstart',
      (e: Event) => {
        e.preventDefault();
        const t = (e as TouchEvent).changedTouches[0];
        stickId = t.identifier;
        anchorX = t.clientX;
        anchorY = t.clientY;
        onEnable();
      },
      { passive: false },
    );
    stickZone.addEventListener(
      'touchmove',
      (e: Event) => {
        e.preventDefault();
        for (const t of Array.from((e as TouchEvent).changedTouches)) {
          if (t.identifier === stickId) {
            const dx = (t.clientX - anchorX) / STICK_R;
            const dz = (t.clientY - anchorY) / STICK_R;
            setStick(touch, dx, dz);
            const n = Math.hypot(dx, dz);
            const cl = n > 1 ? 1 / n : 1;
            stickNub!.style.transform = `translate(${(dx * cl * 34).toFixed(1)}px,${(dz * cl * 34).toFixed(1)}px)`;
          }
        }
      },
      { passive: false },
    );
    const zoneEnd = (e: Event) => {
      for (const t of Array.from((e as TouchEvent).changedTouches)) {
        if (t.identifier === stickId) {
          stickId = null;
          releaseStick(touch);
          stickNub!.style.transform = '';
        }
      }
    };
    stickZone.addEventListener('touchend', zoneEnd);
    stickZone.addEventListener('touchcancel', zoneEnd);
  }

  return {
    touchLayer,
    stickZone,
    stickNub,
    menuPad,
    matchPad,
    updateVisibility(screen: string) {
      if (!touchLayer || !menuPad || !matchPad || !stickZone) return;
      const inMatch = screen === 'match';
      matchPad.classList.toggle('hidden', !inMatch);
      stickZone.classList.toggle('hidden', !inMatch);
      menuPad.classList.toggle('hidden', inMatch);
    },
  };
}
