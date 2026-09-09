import { releaseStick, setShootAim, setStick, touchDown, touchUp, TOUCH_BUTTONS, type TouchState } from '../input/touch';

const STICK_R = 56;

export interface TouchControls {
  touchLayer: HTMLDivElement | null;
  stickZone: HTMLElement | null;
  stickNub: HTMLElement | null;
  matchPad: HTMLElement | null;
  updateVisibility(screen: string): void;
  /** Swap the action-button labels between offense and defense (arcade). */
  updateOffense(offense: boolean): void;
}

function bindHold(touch: TouchState, onEnable: () => void, el: Element, code: string) {
  let pointer: number | null = null;
  let ax = 0, ay = 0;
  el.addEventListener('pointerdown', (event) => {
    const e = event as PointerEvent;
    if (pointer !== null || e.button !== 0) return;
    e.preventDefault();
    pointer = e.pointerId; ax = e.clientX; ay = e.clientY;
    el.setPointerCapture(pointer);
    touchDown(touch, code);
    el.classList.add('held');
    onEnable();
  });
  el.addEventListener('pointermove', (event) => {
    const e = event as PointerEvent;
    if (e.pointerId === pointer && code === TOUCH_BUTTONS.shoot) {
      setShootAim(touch, e.clientX - ax, e.clientY - ay);
    }
  });
  const end = (event: Event) => {
    const e = event as PointerEvent;
    if (e.pointerId !== pointer) return;
    pointer = null;
    touchUp(touch, code);
    el.classList.remove('held');
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('lostpointercapture', end);
}

/**
 * Arcade button labels per phase, DOM-free so headless tests can pin them.
 * Three big buttons (PASS / LONG / SHOOT) plus a mini SWITCH for manual
 * override — auto-switch otherwise follows the closest player. Codes match
 * the keyboard cluster: KeyS = pass, KeyA = long, KeyK = shoot, KeyQ = switch.
 */
export function touchButtonLabels(offense: boolean): {
  pass: { main: string; sub: string };
  long: { main: string; sub: string };
  shoot: { main: string; sub: string };
} {
  return offense
    ? {
        pass: { main: 'PASS', sub: 'X' },
        long: { main: 'LONG', sub: '□' },
        shoot: { main: 'SHOOT', sub: '○' },
      }
    : {
        pass: { main: 'TACKLE', sub: 'X' },
        long: { main: 'SLIDE', sub: '□' },
        shoot: { main: 'TACKLE', sub: '○' },
      };
}

function labelHTML(l: { main: string; sub: string }): string {
  return `${l.main}<small>${l.sub}</small>`;
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
  let matchPad: HTMLElement | null = null;

  if (isTouchDevice) {
    touchLayer = document.createElement('div');
    touchLayer.className = 'touch';
    touchLayer.id = 'touch';
    // Arcade match pad only: stick + 3 big buttons + mini SWITCH.
    // Menus are tap-native (every menu item handles click directly), so the
    // old on-screen D-pad (menu-pad) is gone — no redundant nav buttons.
    touchLayer.innerHTML = `
    <div class="stick-zone"><div class="stick-base"><div class="stick-nub"></div></div></div>
    <div class="match-pad">
      <button class="tbtn match-pause" data-code="Escape" aria-label="Pause match">PAUSE</button>
      <button class="tbtn tswitch" data-code="KeyQ">SWITCH</button>
      <button class="tbtn tlong" data-code="KeyA">LONG<small>□</small></button>
      <button class="tbtn tpass" data-code="KeyS">PASS<small>X</small></button>
      <button class="tbtn tshoot" data-code="KeyK">SHOOT<small>○</small></button>
    </div>`;
    app.append(touchLayer);
    stickZone = touchLayer.querySelector('.stick-zone') as HTMLElement;
    stickNub = touchLayer.querySelector('.stick-nub') as HTMLElement;
    matchPad = touchLayer.querySelector('.match-pad') as HTMLElement;
    touchLayer
      .querySelectorAll('button[data-code]')
      .forEach((b) => bindHold(touch, onEnable, b, (b as HTMLElement).dataset.code!));
    let stickId: number | null = null;
    let anchorX = 0;
    let anchorY = 0;
    stickZone.addEventListener('pointerdown', (e: PointerEvent) => {
      if (stickId !== null || e.button !== 0) return;
      e.preventDefault();
      stickId = e.pointerId;
      stickZone!.setPointerCapture(stickId);
      anchorX = e.clientX; anchorY = e.clientY;
      onEnable();
    });
    stickZone.addEventListener('pointermove', (e: PointerEvent) => {
      if (e.pointerId !== stickId) return;
      const dx = (e.clientX - anchorX) / STICK_R;
      const dz = (e.clientY - anchorY) / STICK_R;
      setStick(touch, dx, dz);
      const cl = 1 / Math.max(1, Math.hypot(dx, dz));
      stickNub!.style.transform = `translate(${dx * cl * 34}px,${dz * cl * 34}px)`;
    });
    const zoneEnd = (e: PointerEvent) => {
      if (e.pointerId !== stickId) return;
      stickId = null;
      releaseStick(touch);
      stickNub!.style.transform = '';
    };
    stickZone.addEventListener('pointerup', zoneEnd);
    stickZone.addEventListener('pointercancel', zoneEnd);
    stickZone.addEventListener('lostpointercapture', zoneEnd);
  }

  // Last applied phase: labels only touch the DOM on change, never per frame.
  let lastOffense: boolean | null = null;
  const applyLabels = (offense: boolean) => {
    if (!touchLayer || lastOffense === offense) return;
    lastOffense = offense;
    const L = touchButtonLabels(offense);
    const set = (code: string, html: string) => {
      const b = touchLayer.querySelector(`button[data-code="${code}"]`);
      if (b) b.innerHTML = html;
    };
    set(TOUCH_BUTTONS.pass, labelHTML(L.pass));
    set(TOUCH_BUTTONS.long, labelHTML(L.long));
    set(TOUCH_BUTTONS.shoot, labelHTML(L.shoot));
  };

  return {
    touchLayer,
    stickZone,
    stickNub,
    matchPad,
    updateVisibility(screen: string) {
      if (!touchLayer || !matchPad || !stickZone) return;
      const inMatch = screen === 'match';
      matchPad.classList.toggle('hidden', !inMatch);
      stickZone.classList.toggle('hidden', !inMatch);
    },
    updateOffense(offense: boolean) {
      applyLabels(offense);
    },
  };
}
