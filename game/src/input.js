// Keyboard and mouse controls. Held keys steer the aircraft, the mouse
// wheel works the throttle, and dragging with the mouse held steers like a
// stick. One-shot actions (flaps, gear, pause) are queued for the loop.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_CAMERA = 8;
export const ACTION_FLAPS = 16;
export const ACTION_GEAR = 32;
export const ACTION_MUTE = 64;
export const ACTION_MENU = 128;
export const ACTION_FUEL_LOAD = 256;

export function createInput(canvas) {
  const keys = new Set();
  let queued = 0;
  let missionChoice = null;
  let clickPoint = null;
  let dragging = false;
  let dragX = 0;
  let dragY = 0;
  let wheelThrottle = 0;

  function onKeyDown(event) {
    const key = event.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) event.preventDefault();
    if (event.repeat) return;
    keys.add(key);
    if (key === 'enter') queued |= ACTION_CONFIRM;
    if (key === 'p') queued |= ACTION_PAUSE;
    if (key === 'escape') queued |= ACTION_MENU;
    if (key === 'r') queued |= ACTION_RESTART;
    if (key === 'c') queued |= ACTION_CAMERA;
    if (key === 'f') queued |= ACTION_FLAPS;
    if (key === 'g') queued |= ACTION_GEAR;
    if (key === 'm') queued |= ACTION_MUTE;
    if (key === 'l') queued |= ACTION_FUEL_LOAD;
    if (key >= '1' && key <= '7') missionChoice = Number(key) - 1;
  }

  function onKeyUp(event) {
    keys.delete(event.key.toLowerCase());
  }

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function onPointerDown(event) {
    dragging = true;
    const point = pointerPosition(event);
    dragX = point.x;
    dragY = point.y;
    clickPoint = point;
    queued |= ACTION_CONFIRM;
  }

  function onPointerMove(event) {
    if (!dragging) return;
    const point = pointerPosition(event);
    dragX = point.x;
    dragY = point.y;
  }

  function onPointerUp() {
    dragging = false;
  }

  function onWheel(event) {
    event.preventDefault();
    wheelThrottle += event.deltaY < 0 ? 0.08 : -0.08;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  return {
    controls() {
      let pitch = 0;
      let roll = 0;
      let yaw = 0;
      let throttle = 0;
      if (keys.has('arrowup')) pitch -= 1;
      if (keys.has('arrowdown')) pitch += 1;
      if (keys.has('arrowleft')) roll -= 1;
      if (keys.has('arrowright')) roll += 1;
      if (keys.has('a')) yaw -= 1;
      if (keys.has('d')) yaw += 1;
      if (keys.has('w')) throttle += 1;
      if (keys.has('s')) throttle -= 1;
      if (dragging && canvas.width > 0) {
        const centreX = canvas.width / 2;
        const centreY = canvas.height * 0.45;
        roll += Math.max(-1, Math.min(1, (dragX - centreX) / (canvas.width * 0.22)));
        pitch += Math.max(-1, Math.min(1, (dragY - centreY) / (canvas.height * 0.22)));
      }
      throttle += wheelThrottle * 4;
      wheelThrottle = 0;
      return {
        pitch: Math.max(-1, Math.min(1, pitch)),
        roll: Math.max(-1, Math.min(1, roll)),
        yaw,
        throttle: Math.max(-1, Math.min(1, throttle)),
        brake: keys.has('b') || keys.has(' '),
      };
    },
    takeActions() {
      const actions = queued;
      queued = 0;
      return actions;
    },
    takeMissionChoice() {
      const choice = missionChoice;
      missionChoice = null;
      return choice;
    },
    takeClick() {
      const point = clickPoint;
      clickPoint = null;
      return point;
    },
  };
}

export function neutralControls() {
  return { pitch: 0, roll: 0, yaw: 0, throttle: 0, brake: false };
}
