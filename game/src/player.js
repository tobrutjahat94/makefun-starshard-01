// STARSHARD — the salvage skiff. Movement with acceleration and friction, a dash with
// i-frames, and one evolving weapon: upgrades change its damage, rate, projectile count,
// pierce and crit, so the same ship plays differently every run.
import { FIELD, PLAYER } from './config.js';

export function createPlayer() {
  return {
    x: FIELD.width / 2,
    y: FIELD.height / 2 + 120,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    radius: PLAYER.radius,
    hull: PLAYER.maxHull,
    maxHull: PLAYER.maxHull,
    alive: true,
    // Weapon stats (upgrades mutate these).
    damage: PLAYER.bulletDamage,
    fireInterval: PLAYER.fireCooldownBase,
    projectiles: 1,
    pierce: 0,
    bulletSpeed: PLAYER.bulletSpeed,
    critChance: PLAYER.critChance,
    regen: 0,
    magnetMult: 1,
    shardMult: 1,
    // Dash state.
    dashCooldown: PLAYER.dashCooldown,
    dashTimeLeft: 0,
    dashX: 0,
    dashY: 0,
    dashTimer: 0,
    iframes: 0,
    fireTimer: 0,
    thrust: 0,
  };
}

/** Apply one upgrade card to the player. Returns nothing; the card's text describes it. */
export function applyUpgrade(player, id) {
  switch (id) {
    case 'damage': player.damage *= 1.25; break;
    case 'rate': player.fireInterval *= 0.8; break;
    case 'multishot': player.projectiles += 1; break;
    case 'hull':
      player.maxHull += 30;
      player.hull = Math.min(player.maxHull, player.hull + 30);
      break;
    case 'dash': player.dashCooldown *= 0.7; break;
    case 'magnet': player.magnetMult *= 1.6; break;
    case 'pierce': player.pierce += 1; break;
    case 'crit': player.critChance += 0.1; break;
    case 'regen': player.regen += 0.6; break;
    case 'greed': player.shardMult *= 1.5; break;
    default: break;
  }
}

/**
 * Step the player for `dt` seconds. `move` is a normalised {x, y} vector, `aimX/aimY` the
 * aim point in field coordinates, `firing` whether the trigger is held, `dash` whether a
 * dash was requested this step. Emits bullets through `fire` when the cooldown allows.
 */
export function stepPlayer(player, dt, move, aimX, aimY, firing, dash, fire) {
  if (!player.alive) return;
  player.iframes = Math.max(0, player.iframes - dt);
  player.dashTimer = Math.max(0, player.dashTimer - dt);
  player.fireTimer -= dt;
  if (player.regen > 0) player.hull = Math.min(player.maxHull, player.hull + player.regen * dt);

  player.angle = Math.atan2(aimY - player.y, aimX - player.x);

  if (player.dashTimeLeft > 0) {
    player.dashTimeLeft -= dt;
    player.vx = player.dashX * PLAYER.dashSpeed;
    player.vy = player.dashY * PLAYER.dashSpeed;
  } else {
    if (dash && player.dashTimer <= 0 && (move.x !== 0 || move.y !== 0)) {
      const len = Math.hypot(move.x, move.y) || 1;
      player.dashX = move.x / len;
      player.dashY = move.y / len;
      player.dashTimeLeft = PLAYER.dashTime;
      player.dashTimer = player.dashCooldown;
      player.iframes = Math.max(player.iframes, PLAYER.dashIframes);
      player.vx = player.dashX * PLAYER.dashSpeed;
      player.vy = player.dashY * PLAYER.dashSpeed;
    } else {
      player.vx += move.x * PLAYER.accel * dt;
      player.vy += move.y * PLAYER.accel * dt;
      const damp = Math.exp(-PLAYER.friction * dt);
      player.vx *= damp;
      player.vy *= damp;
      const speed = Math.hypot(player.vx, player.vy);
      if (speed > PLAYER.speed) {
        player.vx = (player.vx / speed) * PLAYER.speed;
        player.vy = (player.vy / speed) * PLAYER.speed;
      }
    }
  }

  player.x = Math.min(FIELD.width - player.radius, Math.max(player.radius, player.x + player.vx * dt));
  player.y = Math.min(FIELD.height - player.radius, Math.max(player.radius, player.y + player.vy * dt));
  player.thrust = Math.min(1, Math.hypot(player.vx, player.vy) / PLAYER.speed);

  if (firing && player.fireTimer <= 0) {
    player.fireTimer = player.fireInterval;
    fire(player);
  }
}
