// STARSHARD — the wave director. Each wave is a trickle queue from the table in
// config.js: enemies arrive a few at a time so the pressure ramps instead of dumping.
// Wave 10 trades the queue for the Warden. A wave ends when the queue is empty and
// nothing hostile is left alive.
import { WAVES } from './config.js';
import { createBoss, createEnemy, spawnPoint } from './enemies.js';

export function createDirector() {
  return {
    wave: 0,
    queue: [],
    spawnTimer: 0,
    spawnEvery: 1,
    bannerTimer: 0,
    bannerText: '',
    bossSpawned: false,
    intermission: 0,
  };
}

/** Start wave `n` (1-based). Builds the queue and raises the banner. */
export function startWave(director, n, rng) {
  const def = WAVES[n - 1];
  director.wave = n;
  director.queue = [];
  for (const kind of ['drifter', 'spitter', 'dasher', 'brute']) {
    for (let i = 0; i < (def[kind] ?? 0); i += 1) director.queue.push(kind);
  }
  rng.shuffle(director.queue);
  for (let i = 0; i < (def.elite ?? 0); i += 1) director.queue.push('ELITE:' + rng.pick(['drifter', 'spitter', 'dasher', 'brute']));
  director.spawnEvery = def.spawnEvery;
  director.spawnTimer = 0.6;
  director.bossSpawned = false;
  director.bannerTimer = 2.2;
  director.bannerText = `WAVE ${n} — ${def.name}`;
}

/**
 * Step the director. Spawns from the queue, spawns the boss on wave 10, and reports
 * `waveClear` when the wave is done. `spawn` is called with (kind, x, y, elite).
 */
export function stepDirector(director, dt, enemies, player, rng, spawn) {
  director.bannerTimer = Math.max(0, director.bannerTimer - dt);
  const def = WAVES[director.wave - 1];
  if (!def) return { waveClear: false };

  if (def.boss && !director.bossSpawned) {
    director.bossSpawned = true;
    const boss = createBoss(player.x, 110);
    enemies.push(boss);
    return { waveClear: false, bossSpawned: true };
  }

  if (director.queue.length > 0) {
    director.spawnTimer -= dt;
    if (director.spawnTimer <= 0) {
      director.spawnTimer = director.spawnEvery * rng.range(0.8, 1.25);
      const entry = director.queue.shift();
      const elite = entry.startsWith('ELITE:');
      const kind = elite ? entry.slice(6) : entry;
      const point = spawnPoint(rng, player);
      spawn(kind, point.x, point.y, elite);
    }
  }

  const hostileLeft = director.queue.length > 0 || enemies.some((e) => !e.dead);
  return { waveClear: !hostileLeft };
}

export function waveName(n) {
  return WAVES[n - 1] ? WAVES[n - 1].name : '';
}

export function totalWaves() {
  return WAVES.length;
}
