// STARSHARD — pickups. Enemies drop starshards (score, and the run's currency of
// progress) and, rarely, hull cells. Shards drift toward the player inside the pickup
// radius, so a kill always pays off if you fly through the wreck.
import { FIELD, SCORE } from './config.js';

export function createShard(x, y, rng, value = 1) {
  const a = rng.angle();
  const v = rng.range(30, 90);
  return {
    kind: 'shard',
    x, y,
    vx: Math.cos(a) * v,
    vy: Math.sin(a) * v,
    value,
    radius: 7,
    life: 14,
    dead: false,
    bob: rng.range(0, Math.PI * 2),
  };
}

export function createHeart(x, y, rng) {
  return {
    kind: 'heart',
    x, y,
    vx: 0, vy: 0,
    value: 25,
    radius: 10,
    life: 14,
    dead: false,
    bob: rng.range(0, Math.PI * 2),
  };
}

export function dropLoot(pickups, enemy, rng) {
  const [min, max] = enemy.shards;
  const count = rng.int(min, max);
  for (let i = 0; i < count; i += 1) {
    pickups.push(createShard(enemy.x + rng.range(-14, 14), enemy.y + rng.range(-14, 14), rng, 1));
  }
  if (enemy.elite && rng.float() < 0.3) {
    pickups.push(createHeart(enemy.x, enemy.y, rng));
  } else if (enemy.kind === 'brute' && rng.float() < 0.12) {
    pickups.push(createHeart(enemy.x, enemy.y, rng));
  }
}

/** Magnet pull + collection. Returns the score gained this step. */
export function stepPickups(pickups, dt, player, onCollect) {
  let gained = 0;
  for (const pk of pickups) {
    pk.life -= dt;
    pk.bob += dt * 4;
    if (pk.life <= 0) { pk.dead = true; continue; }
    const dx = player.x - pk.x;
    const dy = player.y - pk.y;
    const dist = Math.hypot(dx, dy) || 1;
    const radius = 54 * player.magnetMult;
    if (dist < radius) {
      const pull = 620 * (1 - dist / (radius * 1.6));
      pk.vx += (dx / dist) * pull * dt * 4;
      pk.vy += (dy / dist) * pull * dt * 4;
    } else {
      pk.vx *= Math.exp(-2 * dt);
      pk.vy *= Math.exp(-2 * dt);
    }
    pk.x = Math.min(FIELD.width - 8, Math.max(8, pk.x + pk.vx * dt));
    pk.y = Math.min(FIELD.height - 8, Math.max(8, pk.y + pk.vy * dt));
    if (dist < player.radius + pk.radius + 4) {
      pk.dead = true;
      if (pk.kind === 'shard') {
        gained += Math.round(SCORE.shard * pk.value * player.shardMult);
        onCollect('shard', pk);
      } else {
        player.hull = Math.min(player.maxHull, player.hull + pk.value);
        onCollect('heart', pk);
      }
    }
  }
  for (let i = pickups.length - 1; i >= 0; i -= 1) {
    if (pickups[i].dead) pickups.splice(i, 1);
  }
  return gained;
}
