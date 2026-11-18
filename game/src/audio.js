// STARSHARD — synthesized sound. No audio files: every effect is a small WebAudio patch
// (oscillator sweeps and filtered noise), and the music is a slow bass pulse with a pad.
// Everything is guarded: in a headless screenshot run, or before the first user gesture,
// the context does not exist and every call is a silent no-op.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicTimer = 0;
    this.musicStep = 0;
  }

  /** Create the context. Call from a user gesture (click / key) in live play. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  setMuted(muted) { this.muted = muted; }

  /** Short oscillator blip that slides from `from` Hz to `to` Hz. */
  tone({ type = 'square', from = 440, to = 220, dur = 0.12, vol = 0.2, when = 0 }) {
    if (!this.ctx || this.muted) return;
    try {
      const t0 = this.ctx.currentTime + when;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(from, t0);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain).connect(this.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch { /* audio is cosmetic; never let it break the game */ }
  }

  /** Filtered noise burst — explosions, dashes, impacts. */
  noise({ dur = 0.3, vol = 0.3, freq = 800, when = 0 }) {
    if (!this.ctx || this.muted) return;
    try {
      const t0 = this.ctx.currentTime + when;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = freq;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      source.connect(filter).connect(gain).connect(this.master);
      source.start(t0);
    } catch { /* cosmetic */ }
  }

  shoot() { this.tone({ type: 'square', from: 880, to: 320, dur: 0.07, vol: 0.08 }); }
  enemyShoot() { this.tone({ type: 'sawtooth', from: 300, to: 140, dur: 0.12, vol: 0.06 }); }
  hit() { this.tone({ type: 'triangle', from: 220, to: 90, dur: 0.08, vol: 0.14 }); }
  explosion(big = false) {
    this.noise({ dur: big ? 0.6 : 0.3, vol: big ? 0.5 : 0.28, freq: big ? 500 : 900 });
    this.tone({ type: 'sine', from: big ? 120 : 160, to: 40, dur: big ? 0.5 : 0.25, vol: 0.35 });
  }
  pickup() { this.tone({ type: 'sine', from: 660, to: 990, dur: 0.09, vol: 0.12 }); }
  dash() { this.noise({ dur: 0.18, vol: 0.16, freq: 2400 }); }
  hurt() {
    this.tone({ type: 'sawtooth', from: 160, to: 60, dur: 0.25, vol: 0.25 });
    this.noise({ dur: 0.2, vol: 0.2, freq: 600 });
  }
  waveHorn() {
    this.tone({ type: 'sawtooth', from: 110, to: 110, dur: 0.5, vol: 0.12 });
    this.tone({ type: 'sawtooth', from: 165, to: 165, dur: 0.5, vol: 0.1, when: 0.02 });
    this.tone({ type: 'sawtooth', from: 220, to: 220, dur: 0.5, vol: 0.08, when: 0.04 });
  }
  bossRoar() {
    this.tone({ type: 'sawtooth', from: 80, to: 240, dur: 0.7, vol: 0.22 });
    this.tone({ type: 'sawtooth', from: 82, to: 245, dur: 0.7, vol: 0.22, when: 0.03 });
    this.noise({ dur: 0.7, vol: 0.2, freq: 400 });
  }
  click() { this.tone({ type: 'sine', from: 520, to: 700, dur: 0.05, vol: 0.1 }); }
  upgrade() {
    this.tone({ type: 'sine', from: 523, to: 523, dur: 0.12, vol: 0.14 });
    this.tone({ type: 'sine', from: 659, to: 659, dur: 0.12, vol: 0.14, when: 0.09 });
    this.tone({ type: 'sine', from: 784, to: 784, dur: 0.2, vol: 0.14, when: 0.18 });
  }
  victory() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone({ type: 'triangle', from: f, to: f, dur: 0.35, vol: 0.16, when: i * 0.14 }));
  }
  gameOver() {
    [392, 330, 262, 196].forEach((f, i) => this.tone({ type: 'triangle', from: f, to: f * 0.94, dur: 0.4, vol: 0.15, when: i * 0.18 }));
  }

  /** One bar of the bass pulse; called from the game loop while playing. */
  musicTick(dt) {
    if (!this.ctx || this.muted) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    this.musicTimer = 0.5;
    const bass = [55, 55, 65.4, 49][this.musicStep % 4];
    this.tone({ type: 'triangle', from: bass, to: bass, dur: 0.42, vol: 0.07 });
    if (this.musicStep % 8 === 4) this.tone({ type: 'sine', from: bass * 4, to: bass * 4, dur: 0.9, vol: 0.03 });
    this.musicStep += 1;
  }
}
