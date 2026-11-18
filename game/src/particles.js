// STARSHARD — particles, shockwaves and floating text. Purely visual, but they carry the
// game's feel: explosions, thruster trails, shard sparkles, damage numbers and the hit-stop
// flash that sells a big kill. Capped so a crowded fight never allocates without bound.
export const MAX_PARTICLES = 420;

export function createParticles() {
  return { list: [], rings: [], texts: [], shake: 0, flash: 0 };
}

export function burst(p, x, y, { count = 14, color = '#ffd27a', speed = 220, life = 0.6, size = 3 }) {
  for (let i = 0; i < count; i += 1) {
    if (p.list.length >= MAX_PARTICLES) return;
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.3 + Math.random() * 0.7);
    p.list.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: life * (0.5 + Math.random() * 0.5),
      maxLife: life,
      size: size * (0.6 + Math.random() * 0.8),
      color,
      drag: 2.2,
    });
  }
}

export function explosion(p, x, y, big = false) {
  burst(p, x, y, { count: big ? 42 : 18, color: '#ffb347', speed: big ? 380 : 260, life: big ? 0.9 : 0.6, size: big ? 4 : 3 });
  burst(p, x, y, { count: big ? 20 : 8, color: '#ff5d6c', speed: big ? 260 : 170, life: 0.8, size: 4 });
  burst(p, x, y, { count: 8, color: '#ffffff', speed: 140, life: 0.35, size: 2 });
  ring(p, x, y, big ? '#ffb347' : '#ffd27a');
  addShake(p, big ? 14 : 7);
}

export function ring(p, x, y, color = '#8fd8ff') {
  p.rings.push({ x, y, r: 6, maxR: 64, life: 0.45, maxLife: 0.45, color });
}

export function floatText(p, x, y, text, color = '#eaf2ff') {
  p.texts.push({ x, y, text, color, life: 0.9, maxLife: 0.9 });
}

export function thruster(p, x, y, angle) {
  if (p.list.length >= MAX_PARTICLES) return;
  const back = angle + Math.PI;
  p.list.push({
    x: x + Math.cos(back) * 14 + (Math.random() - 0.5) * 4,
    y: y + Math.sin(back) * 14 + (Math.random() - 0.5) * 4,
    vx: Math.cos(back) * 120 + (Math.random() - 0.5) * 40,
    vy: Math.sin(back) * 120 + (Math.random() - 0.5) * 40,
    life: 0.3, maxLife: 0.3, size: 2.5, color: '#6fd8ff', drag: 1,
  });
}

export function addShake(p, amount) {
  p.shake = Math.min(18, p.shake + amount);
}

export function stepParticles(p, dt) {
  for (let i = p.list.length - 1; i >= 0; i -= 1) {
    const pt = p.list[i];
    pt.life -= dt;
    if (pt.life <= 0) { p.list.splice(i, 1); continue; }
    const damp = Math.exp(-pt.drag * dt);
    pt.vx *= damp;
    pt.vy *= damp;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
  }
  for (let i = p.rings.length - 1; i >= 0; i -= 1) {
    const r = p.rings[i];
    r.life -= dt;
    r.r += (r.maxR - r.r) * Math.min(1, 8 * dt);
    if (r.life <= 0) p.rings.splice(i, 1);
  }
  for (let i = p.texts.length - 1; i >= 0; i -= 1) {
    const t = p.texts[i];
    t.life -= dt;
    t.y -= 34 * dt;
    if (t.life <= 0) p.texts.splice(i, 1);
  }
  p.shake = Math.max(0, p.shake - 40 * dt);
  p.flash = Math.max(0, p.flash - 3 * dt);
}
