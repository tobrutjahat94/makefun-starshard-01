// STARSHARD — the void-drones and the Warden. Four enemy kinds, each with one readable
// behaviour (chase / shoot from range / telegraphed lunge / slow tank that splits), elites
// that scale one kind up, and a three-phase boss that ends the run on wave 10.
import { ELITE_MULT, ENEMY, FIELD } from './config.js';

let nextId = 1;

export function createEnemy(kind, x, y, rng, elite = false) {
  const base = ENEMY[kind];
  const mult = elite ? ELITE_MULT.hp : 1;
  return {
    id: nextId,
    kind,
    x, y,
    vx: 0, vy: 0,
    hp: base.hp * mult,
    maxHp: base.hp * mult,
    radius: base.radius * (elite ? ELITE_MULT.size : 1),
    speed: base.speed * (elite ? ELITE_MULT.speed : 1),
    damage: base.damage,
    score: base.score * (elite ? ELITE_MULT.score : 1),
    shards: base.shards,
    elite,
    angle: rng.angle(),
    fireTimer: rng.range(1, base.fireEvery ?? 2),
    lungeTimer: rng.range(1.2, 2.4),
    lunging: 0,
    telegraph: 0,
    flash: 0,
    spawnT: 0,
    dead: false,
    splitDone: false,
  };
}

export function createBoss(x, y) {
  const base = ENEMY.boss;
  return {
    id: nextId,
    kind: 'boss',
    x, y,
    vx: 0, vy: 0,
    hp: base.hp,
    maxHp: base.hp,
    radius: base.radius,
    speed: base.speed,
    damage: base.damage,
    score: base.score,
    shards: base.shards,
    elite: false,
    angle: -Math.PI / 2,
    fireTimer: 2.0,
    spiralTimer: 0,
    spawnTimer: 5,
    chargeTimer: 6,
    charging: 0,
    telegraph: 0,
    phase: 1,
    flash: 0,
    spawnT: 0,
    dead: false,
  };
}

/** Pick a spawn point just outside the field, away from the player. */
export function spawnPoint(rng, player) {
  for (let tries = 0; tries < 12; tries += 1) {
    const side = rng.int(0, 3);
    const margin = 30;
    let x; let y;
    if (side === 0) { x = rng.range(0, FIELD.width); y = -margin; }
    else if (side === 1) { x = FIELD.width + margin; y = rng.range(0, FIELD.height); }
    else if (side === 2) { x = rng.range(0, FIELD.width); y = FIELD.height + margin; }
    else { x = -margin; y = rng.range(0, FIELD.height); }
    if (Math.hypot(x - player.x, y - player.y) > 240) return { x, y };
  }
  return { x: FIELD.width / 2, y: -30 };
}

function steerToward(enemy, tx, ty, speed, dt) {
  const dx = tx - enemy.x;
  const dy = ty - enemy.y;
  const dist = Math.hypot(dx, dy) || 1;
  const want = Math.min(speed, dist * 3);
  enemy.vx += ((dx / dist) * want - enemy.vx) * Math.min(1, 4 * dt);
  enemy.vy += ((dy / dist) * want - enemy.vy) * Math.min(1, 4 * dt);
}

/**
 * Step one enemy. `events` collects what the game must react to: enemy bullets to fire,
 * splits to spawn, and nothing else — this module never touches the world directly.
 */
export function stepEnemy(enemy, dt, player, rng, events) {
  if (enemy.dead) return;
  enemy.flash = Math.max(0, enemy.flash - dt);
  enemy.spawnT += dt;
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const dist = Math.hypot(dx, dy) || 1;

  if (enemy.kind === 'drifter') {
    steerToward(enemy, player.x, player.y, enemy.speed, dt);
    enemy.angle = Math.atan2(enemy.vy, enemy.vx);
  } else if (enemy.kind === 'spitter') {
    const keep = ENEMY.spitter.keepRange;
    if (dist > keep + 40) steerToward(enemy, player.x, player.y, enemy.speed, dt);
    else if (dist < keep - 60) steerToward(enemy, player.x - dx, player.y - dy, enemy.speed, dt);
    else { enemy.vx *= Math.exp(-2 * dt); enemy.vy *= Math.exp(-2 * dt); }
    enemy.angle = Math.atan2(dy, dx);
    enemy.fireTimer -= dt;
    if (enemy.fireTimer <= 0 && dist < 520) {
      enemy.fireTimer = ENEMY.spitter.fireEvery * rng.range(0.85, 1.2);
      events.shots.push({ x: enemy.x, y: enemy.y, angle: Math.atan2(dy, dx), speed: ENEMY.spitter.bulletSpeed, damage: enemy.damage });
    }
  } else if (enemy.kind === 'dasher') {
    if (enemy.lunging > 0) {
      enemy.lunging -= dt;
    } else if (enemy.telegraph > 0) {
      enemy.telegraph -= dt;
      enemy.vx *= Math.exp(-6 * dt);
      enemy.vy *= Math.exp(-6 * dt);
      if (enemy.telegraph <= 0) {
        enemy.lunging = 0.42;
        enemy.vx = (dx / dist) * ENEMY.dasher.lungeSpeed;
        enemy.vy = (dy / dist) * ENEMY.dasher.lungeSpeed;
      }
    } else {
      steerToward(enemy, player.x, player.y, enemy.speed, dt);
      enemy.angle = Math.atan2(enemy.vy, enemy.vx);
      enemy.lungeTimer -= dt;
      if (enemy.lungeTimer <= 0 && dist < 320) {
        enemy.telegraph = ENEMY.dasher.telegraph;
        enemy.lungeTimer = ENEMY.dasher.lungeEvery * rng.range(0.9, 1.2);
      }
    }
  } else if (enemy.kind === 'brute') {
    steerToward(enemy, player.x, player.y, enemy.speed, dt);
    enemy.angle = Math.atan2(enemy.vy, enemy.vx);
  } else if (enemy.kind === 'boss') {
    stepBoss(enemy, dt, player, rng, events, dist, dx, dy);
  }

  enemy.x += enemy.vx * dt;
  enemy.y += enemy.vy * dt;
  // Soft walls: enemies drift back in instead of leaving the field.
  if (enemy.x < -60) enemy.x = -60;
  if (enemy.x > FIELD.width + 60) enemy.x = FIELD.width + 60;
  if (enemy.y < -60) enemy.y = -60;
  if (enemy.y > FIELD.height + 60) enemy.y = FIELD.height + 60;
  // Spitters hold range, so once they have had time to enter, keep them inside the
  // arena where bullets can reach them: no wave stalls on an unreachable spitter.
  if (enemy.kind === 'spitter' && enemy.spawnT > 1.5) {
    enemy.x = Math.min(FIELD.width - 20, Math.max(20, enemy.x));
    enemy.y = Math.min(FIELD.height - 20, Math.max(20, enemy.y));
  }
}

function stepBoss(boss, dt, player, rng, events, dist, dx, dy) {
  const ratio = boss.hp / boss.maxHp;
  const nextPhase = ratio <= 0.33 ? 3 : ratio <= 0.66 ? 2 : 1;
  if (nextPhase !== boss.phase) {
    boss.phase = nextPhase;
    events.phaseChange = nextPhase;
    boss.fireTimer = Math.min(boss.fireTimer, 0.8);
  }
  boss.angle = Math.atan2(dy, dx);

  if (boss.charging > 0) {
    boss.charging -= dt;
    if (boss.charging <= 0) {
      boss.vx = (dx / dist) * 460;
      boss.vy = (dy / dist) * 460;
    }
  } else if (boss.telegraph > 0) {
    boss.telegraph -= dt;
    boss.vx *= Math.exp(-4 * dt);
    boss.vy *= Math.exp(-4 * dt);
    if (boss.telegraph <= 0) boss.charging = 0.5;
  } else {
    // Slow orbit around the player, never sitting still.
    const orbit = boss.phase === 3 ? 0.55 : 0.35;
    const tx = player.x + Math.cos(boss.angle + Math.PI / 2) * 300;
    const ty = player.y + Math.sin(boss.angle + Math.PI / 2) * 300;
    steerToward(boss, tx, ty, boss.speed * (1 + orbit * 0.4), dt);
    boss.chargeTimer -= dt;
    if (boss.phase === 3 && boss.chargeTimer <= 0 && dist < 520) {
      boss.telegraph = 0.6;
      boss.chargeTimer = 6.5;
    }
  }

  // Radial burst, the boss's signature.
  boss.fireTimer -= dt;
  if (boss.fireTimer <= 0) {
    boss.fireTimer = boss.phase === 3 ? 1.35 : boss.phase === 2 ? 1.8 : 2.2;
    const count = boss.phase === 1 ? 10 : 14;
    const baseAngle = rng.angle();
    for (let i = 0; i < count; i += 1) {
      events.shots.push({ x: boss.x, y: boss.y, angle: baseAngle + (i / count) * Math.PI * 2, speed: 170, damage: 10 });
    }
    // Aimed three-spread on top of the ring.
    for (let k = -1; k <= 1; k += 1) {
      events.shots.push({ x: boss.x, y: boss.y, angle: Math.atan2(dy, dx) + k * 0.18, speed: 260, damage: 12 });
    }
  }

  // Spiral streams from phase 2 up.
  if (boss.phase >= 2) {
    boss.spiralTimer -= dt;
    if (boss.spiralTimer <= 0) {
      boss.spiralTimer = boss.phase === 3 ? 0.13 : 0.2;
      const a = boss.spiralTimer * 0 + (boss.spawnT * 2.4);
      events.shots.push({ x: boss.x, y: boss.y, angle: a, speed: 200, damage: 9 });
      events.shots.push({ x: boss.x, y: boss.y, angle: a + Math.PI, speed: 200, damage: 9 });
    }
  }

  // Spawn escorts from phase 2 up.
  if (boss.phase >= 2) {
    boss.spawnTimer -= dt;
    if (boss.spawnTimer <= 0) {
      boss.spawnTimer = 7;
      events.spawnEscorts = 2;
    }
  }
}
