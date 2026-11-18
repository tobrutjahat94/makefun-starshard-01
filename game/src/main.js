// STARSHARD — entry point. Wires the canvas, the input and the animation loop to the
// world, and stages deterministic screenshot scenes when the URL carries ?shot=<scene>.
// Live play runs at a fixed 60 Hz step with an accumulator, so the game plays the same
// on any display; a shot renders one staged frame and reports window.__shotReady.
import { FIELD, STEP } from './config.js';
import { createWorld, stepWorld } from './world.js';
import { render } from './render.js';
import { stageShot } from './shots.js';
import { Input } from './input.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') ?? '7') || 7;

let world = createWorld(seed);
const input = new Input(canvas);
input.attach();

function fitCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

/** Canvas transform: uniform scale of the 960x600 field, letterboxed. */
function applyTransform() {
  const scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
  const offsetX = (canvas.width - FIELD.width * scale) / 2;
  const offsetY = (canvas.height - FIELD.height * scale) / 2;
  ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
  return { scale, offsetX, offsetY };
}

function renderFrame() {
  const { scale, offsetX, offsetY } = applyTransform();
  ctx.fillStyle = '#04060f';
  ctx.fillRect(-offsetX / scale, -offsetY / scale, canvas.width / scale, canvas.height / scale);
  render(ctx, world, world.time);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function buildControls() {
  const { scale, offsetX, offsetY } = applyTransform();
  const move = input.scripted
    ? { x: input.scripted.moveX, y: input.scripted.moveY }
    : input.moveVector();
  const aimX = input.scripted
    ? input.scripted.mouseX
    : (input.mouseX - offsetX) / scale;
  const aimY = input.scripted
    ? input.scripted.mouseY
    : (input.mouseY - offsetY) / scale;
  return {
    move,
    aimX,
    aimY,
    firing: input.scripted ? input.scripted.firing : input.mouseDown,
    dash: input.scripted ? input.scripted.dash : input.hit('Space') || input.hit('ShiftLeft') || input.hit('ShiftRight'),
    clicked: input.clicked(),
    clickX: (input.mouseX - offsetX) / scale,
    clickY: (input.mouseY - offsetY) / scale,
    keys: new Set(input.pressed),
  };
}

window.addEventListener('resize', fitCanvas);
fitCanvas();

if (shotName) {
  // Screenshot mode: stage one deterministic frame, draw it, report readiness.
  // The mouse cursor is hidden: headless Chrome paints it into the screenshot.
  canvas.style.cursor = 'none';
  try {
    world = stageShot(shotName, seed);
    renderFrame();
    window.__shotReady = true;
  } catch (error) {
    window.__shotError = String((error && error.stack) || error);
    renderFrame();
  }
} else {
  let last = performance.now();
  let acc = 0;
  window.__starshard = world;
  const frame = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (input.hit('KeyM')) {
      world.muted = !world.muted;
      world.audio.setMuted(world.muted);
    }
    acc += dt;
    let controls = buildControls();
    let first = true;
    while (acc >= STEP) {
      stepWorld(world, STEP, controls);
      if (first) {
        first = false;
        // Edge-triggered input (clicks, key presses) lives for one step only.
        controls = { ...controls, keys: new Set(), clicked: false, dash: false };
      }
      acc -= STEP;
    }
    renderFrame();
    input.endFrame();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
