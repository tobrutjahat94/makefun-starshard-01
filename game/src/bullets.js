// STARSHARD — projectiles, both ways. Player bolts fly straight and can pierce; enemy
// bolts are slower orbs. A bullet dies on its first hit unless it has pierce left, and
// remembers what it already hit so one bolt never damages the same enemy twice.
export function createBullet(x, y, vx, vy, { damage, radius = 4, friendly = true, pierce = 0, crit = false, color = null }) {
  return {
    x, y, vx, vy, damage, radius, friendly, pierce, crit, color,
    life: 2.2, dead: false, hitSet: new Set(),
  };
}

/** Fan of player bolts from the ship's nose, spread across `projectiles` barrels. */
export function firePlayerShot(bullets, player, rng) {
  const count = player.projectiles;
  const spreadStep = 0.13;
  for (let i = 0; i < count; i += 1) {
    const offset = (i - (count - 1) / 2) * spreadStep;
    const angle = player.angle + offset;
    const crit = rng.float() < player.critChance;
    const noseX = player.x + Math.cos(player.angle) * (player.radius + 6);
    const noseY = player.y + Math.sin(player.angle) * (player.radius + 6);
    bullets.push(createBullet(noseX, noseY, Math.cos(angle) * player.bulletSpeed, Math.sin(angle) * player.bulletSpeed, {
      damage: player.damage * (crit ? 2 : 1),
      radius: PLAYER_RADIUS(player),
      friendly: true,
      pierce: player.pierce,
      crit,
    }));
  }
}

function PLAYER_RADIUS(player) {
  return player.projectiles >= 3 ? 5 : 4;
}

export function fireEnemyShot(bullets, x, y, angle, speed, damage) {
  bullets.push(createBullet(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, {
    damage, radius: 6, friendly: false, pierce: 0, color: '#ff8ab0',
  }));
}

export function stepBullets(bullets, dt, field) {
  for (const bullet of bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    if (bullet.life <= 0 || bullet.x < -20 || bullet.x > field.width + 20 || bullet.y < -20 || bullet.y > field.height + 20) {
      bullet.dead = true;
    }
  }
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    if (bullets[i].dead) bullets.splice(i, 1);
  }
}
