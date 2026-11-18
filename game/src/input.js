// STARSHARD — keyboard and mouse state. The game reads this, never the DOM events
// directly, so the screenshot autopilot can drive the same interface with scripted input.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;
    this.canvas = canvas;
    this.enabled = true;
  }

  attach() {
    window.addEventListener('keydown', (event) => {
      if (!this.enabled) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
      if (!event.repeat) this.pressed.add(event.code);
      this.keys.add(event.code);
    });
    window.addEventListener('keyup', (event) => this.keys.delete(event.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouseDown = false; });
    this.canvas.addEventListener('mousemove', (event) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = (event.clientX - rect.left) * (this.canvas.width / rect.width);
      this.mouseY = (event.clientY - rect.top) * (this.canvas.height / rect.height);
    });
    this.canvas.addEventListener('mousedown', (event) => {
      if (event.button === 0) { this.mouseDown = true; this.mouseClicked = true; }
    });
    window.addEventListener('mouseup', (event) => {
      if (event.button === 0) this.mouseDown = false;
    });
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  down(code) { return this.keys.has(code); }
  /** True only on the frame the key went down; cleared by endFrame(). */
  hit(code) { return this.pressed.has(code); }
  clicked() { return this.mouseClicked; }

  /** Movement vector from WASD / arrows, normalised. */
  moveVector() {
    let x = 0; let y = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyW') || this.down('ArrowUp')) y -= 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
    return { x, y };
  }

  /** Scripted input for the screenshot autopilot: same shape as live input. */
  setScripted({ moveX = 0, moveY = 0, mouseX = 0, mouseY = 0, firing = false, dash = false }) {
    this.scripted = { moveX, moveY, mouseX, mouseY, firing, dash };
  }
  clearScripted() { this.scripted = null; }

  /** Called once per rendered frame: edge-triggered state lives one frame only. */
  endFrame() {
    this.pressed.clear();
    this.mouseClicked = false;
  }
}
