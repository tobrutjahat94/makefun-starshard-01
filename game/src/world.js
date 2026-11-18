// STARSHARD — the world: state, the fixed-step update, collisions, waves and screen
// transitions. It knows nothing about the DOM: the live loop and the screenshot
// autopilot both drive it through the same `controls` snapshot, so a staged screenshot
// frame is a frame the real game can reach.
import { FIELD, STEP } from './config.js';
import { Rng } from './rng.js';
import { AudioEngine } from './audio.js';
import { createPlayer, stepPlayer, applyUpgrade } from './player.js';
import { firePlayerShot, fireEnemyShot, stepBullets } from './bullets.js';
import { createEnemy, stepEnemy } from './enemies.js';
import { createParticles, stepParticles, explosion, burst, floatText, thruster, addShake } from './particles.js';
import { dropLoot, stepPickups } from './pickups.js';
import { createDirector, startWave, stepDirector, totalWaves } from './waves.js';
import { drawOffer, autopilotPick } from './upgrades.js';
import { createBackground, SCREEN_TITLE, SCREEN_PLAY, SCREEN_UPGRADE, SCREEN_PAUSE, SCREEN_OVER, SCREEN_VICTORY } from './render.js';

export function createWorld(seed) {
  const rng = new Rng(seed);
  const world = {
    seed,
    rng,
    time: 0,
    screen: SCREEN_TITLE,
    player: createPlayer(),
    enemies: [],
    bullets: [],
    pickups: [],
    particles: createParticles(),
    director: createDirector(),
    offer: null,
    score: 0,
    best: loadBest(),
    kills: 0,
    shardsCollected: 0,
    shotsFired: 0,
    shotsHit: 0,
    stats: null,
    stars: 0,
    hitStop: 0,
    bg: createBackground(seed),
    audio: new AudioEngine(),
    muted: false,
  };
  return world;
}

function loadBest() {
  try {
    return Number(window.localStorage.getItem('starshard.best') || 0) || 0;
  } catch {
    return 0;
  }
}

function saveBest(world) {
  try {
    if (world.score > world.best) {
      world.best = world.score;
      window.localStorage.setItem('starshard.best', String(world.best));
    }
  } catch { /* best score is cosmetic */ }
}

/** Reset everything for a fresh run and open wave 1. */
export function startRun(world) {
  world.player = createPlayer();
  world.enemies = [];
  world.bullets = [];
  world.pickups = [];
  world.particles = createParticles();
  world.director = createDirector();
  world.offer = null;
  world.score = 0;
  world.kills = 0;
  world.shardsCollected = 0;
  world.shotsFired = 0;
  world.shotsHit = 0;
  world.stats = null;
  world.stars = 0;
  world.hitStop = 0;
  world.time = 0;
  startWave(world.director, 1, world.rng);
  world.screen = SCREEN_PLAY;
  world.audio.waveHorn();
}

function endRun(world, victory) {
  const accuracy = world.shotsFired > 0 ? world.shotsHit / world.shotsFired : 0;
  world.stats = {
    score: world.score,
    time: world.time,
    kills: world.kills,
    shards: world.shardsCollected,
    accuracy,
    wave: world.director.wave,
  };
  saveBest(world);
  if (victory) {
    const hullRatio = world.player.hull / world.player.maxHull;
    world.stars = 1 + (hullRatio > 0.5 ? 1 : 0) + (world.time < 720 ? 1 : 0);
    world.screen = SCREEN_VICTORY;
    world.audio.victory();
  } else {
    world.screen = SCREEN_OVER;
    world.audio.gameOver();
  }
}

function damageEnemy(world, enemy, damage, crit) {
  enemy.hp -= damage;
  enemy.flash = 0.12;
  world.shotsHit += 1;
  if (crit || damage >= 30) {
    floatText(world.particles, enemy.x, enemy.y - enemy.radius - 8, crit ? `CRIT ${Math.round(damage)}` : `${Math.round(damage)}`, crit ? '#ffe066' : '#ffffff');
  }
  if (enemy.hp > 0) {
    world.audio.hit();
    return;
  }
  killEnemy(world, enemy);
}

function killEnemy(world, enemy) {
  enemy.dead = true;
  world.kills += 1;
  world.score += enemy.score;
  const big = enemy.kind === 'brute' || enemy.kind === 'boss';
  explosion(world.particles, enemy.x, enemy.y, big);
  world.audio.explosion(big);
  dropLoot(world.pickups, enemy, world.rng);
  if (enemy.kind === 'brute') {
    // A brute splits into two drifters that scatter.
    for (let i = 0; i < 2; i += 1) {
      const d = createEnemy('drifter', enemy.x + (i === 0 ? -20 : 20), enemy.y, world.rng);
      d.vx = (i === 0 ? -120 : 120);
      world.enemies.push(d);
    }
  }
  if (enemy.kind === 'boss') {
    world.hitStop = 0.35;
    world.particles.flash = 1;
    addShake(world.particles, 18);
    endRun(world, true);
  } else if (big) {
    world.hitStop = Math.max(world.hitStop, 0.06);
  }
}

function hurtPlayer(world, damage) {
  const player = world.player;
  if (!player.alive || player.iframes > 0) return;
  player.hull -= damage;
  player.iframes = 0.5;
  world.particles.flash = 0.6;
  addShake(world.particles, 10);
  burst(world.particles, player.x, player.y, { count: 10, color: '#ff5d6c', speed: 200, life: 0.5, size: 3 });
  world.audio.hurt();
  if (player.hull <= 0) {
    player.hull = 0;
    player.alive = false;
    explosion(world.particles, player.x, player.y, true);
    world.audio.explosion(true);
    endRun(world, false);
  }
}

function collide(world) {
  const { player, enemies, bullets } = world;
  // Player bullets vs enemies.
  for (const bullet of bullets) {
    if (!bullet.friendly || bullet.dead) continue;
    for (const enemy of enemies) {
      if (enemy.dead || bullet.hitSet.has(enemy.id)) continue;
      const d = Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y);
      if (d < enemy.radius + bullet.radius) {
        bullet.hitSet.add(enemy.id);
        damageEnemy(world, enemy, bullet.damage, bullet.crit);
        if (bullet.pierce > 0) bullet.pierce -= 1;
        else { bullet.dead = true; break; }
      }
    }
  }
  if (!player.alive) return;
  // Enemy bullets vs player.
  for (const bullet of bullets) {
    if (bullet.friendly || bullet.dead) continue;
    const d = Math.hypot(player.x - bullet.x, player.y - bullet.y);
    if (d < player.radius + bullet.radius) {
      bullet.dead = true;
      hurtPlayer(world, bullet.damage);
      if (!player.alive) return;
    }
  }
  // Contact with enemies.
  for (const enemy of enemies) {
    if (enemy.dead) continue;
    enemy.touchCd = Math.max(0, (enemy.touchCd || 0) - STEP);
    const d = Math.hypot(player.x - enemy.x, player.y - enemy.y);
    if (d < enemy.radius + player.radius - 2 && (enemy.touchCd || 0) <= 0 && player.iframes <= 0) {
      enemy.touchCd = 0.7;
      // Shove both apart so one touch does not chain into the next frame.
      const push = 260;
      const nx = (player.x - enemy.x) / (d || 1);
      const ny = (player.y - enemy.y) / (d || 1);
      player.vx += nx * push;
      player.vy += ny * push;
      enemy.vx -= nx * 120;
      enemy.vy -= ny * 120;
      hurtPlayer(world, enemy.damage);
      if (!player.alive) return;
    }
  }
}

function stepPlay(world, dt, controls) {
  const { player, rng } = world;
  world.time += dt;

  // Player.
  const firing = controls.firing;
  stepPlayer(player, dt, controls.move, controls.aimX, controls.aimY, firing, controls.dash, (p) => {
    firePlayerShot(world.bullets, p, rng);
    world.shotsFired += p.projectiles;
    world.audio.shoot();
    if (p.thrust > 0.1) thruster(world.particles, p.x, p.y, p.angle);
  });
  if (player.thrust > 0.1 && Math.random() < 0.6) {
    thruster(world.particles, player.x, player.y, player.angle);
  }

  // Enemies.
  const events = { shots: [], spawnEscorts: 0, phaseChange: 0 };
  for (const enemy of world.enemies) {
    stepEnemy(enemy, dt, player, rng, events);
  }
  for (const shot of events.shots) {
    fireEnemyShot(world.bullets, shot.x, shot.y, shot.angle, shot.speed, shot.damage);
  }
  if (events.spawnEscorts > 0) {
    const boss = world.enemies.find((e) => e.kind === 'boss' && !e.dead);
    if (boss) {
      for (let i = 0; i < events.spawnEscorts; i += 1) {
        world.enemies.push(createEnemy('drifter', boss.x + rng.range(-80, 80), boss.y + rng.range(-80, 80), rng));
      }
    }
  }
  if (events.phaseChange > 0) {
    world.director.bannerText = `THE WARDEN — PHASE ${events.phaseChange}`;
    world.director.bannerTimer = 2;
    world.audio.bossRoar();
  }
  world.enemies = world.enemies.filter((e) => !e.dead);

  // Bullets, pickups, collisions.
  stepBullets(world.bullets, dt, FIELD);
  collide(world);
  if (world.screen !== SCREEN_PLAY) return;
  world.score += stepPickups(world.pickups, dt, player, (kind) => {
    if (kind === 'shard') {
      world.shardsCollected += 1;
      world.audio.pickup();
      burst(world.particles, player.x, player.y - 10, { count: 4, color: '#ffc85e', speed: 90, life: 0.35, size: 2 });
    } else {
      world.audio.upgrade();
      floatText(world.particles, player.x, player.y - 20, '+25 HULL', '#7dff9e');
    }
  });

  // Wave director.
  const result = stepDirector(world.director, dt, world.enemies, player, rng, (kind, x, y, elite) => {
    world.enemies.push(createEnemy(kind, x, y, rng, elite));
  });
  if (result.bossSpawned) {
    world.audio.bossRoar();
    world.director.bannerText = 'THE WARDEN';
    world.director.bannerTimer = 2.4;
    addShake(world.particles, 12);
  }
  if (result.waveClear) {
    if (world.director.wave >= totalWaves()) {
      endRun(world, true);
      return;
    }
    world.offer = drawOffer(rng);
    world.screen = SCREEN_UPGRADE;
    world.audio.upgrade();
    return;
  }

  world.audio.musicTick(dt);
}

/**
 * One fixed step. `controls` is a plain snapshot:
 * { move:{x,y}, aimX, aimY, firing, dash, clicked, clickX, clickY, keys:Set<string> }
 * Clicks and keys are consumed by the screen that is showing.
 */
export function stepWorld(world, dt, controls) {
  if (world.hitStop > 0) {
    world.hitStop -= dt;
    stepParticles(world.particles, dt);
    return;
  }
  stepParticles(world.particles, dt);

  switch (world.screen) {
    case SCREEN_TITLE: {
      world.time += dt;
      if (controls.clicked || controls.keys.has('Enter') || controls.keys.has('Space')) {
        world.audio.unlock();
        world.audio.click();
        startRun(world);
      }
      break;
    }
    case SCREEN_PLAY: {
      if (controls.keys.has('KeyP') || controls.keys.has('Escape')) {
        world.screen = SCREEN_PAUSE;
        break;
      }
      stepPlay(world, dt, controls);
      break;
    }
    case SCREEN_UPGRADE: {
      world.time += dt;
      let picked = -1;
      if (controls.keys.has('Digit1')) picked = 0;
      else if (controls.keys.has('Digit2')) picked = 1;
      else if (controls.keys.has('Digit3')) picked = 2;
      else if (controls.clicked) picked = upgradeCardAt(world, controls.clickX, controls.clickY);
      if (picked >= 0 && world.offer && world.offer[picked]) {
        applyUpgrade(world.player, world.offer[picked].id);
        world.audio.upgrade();
        world.offer = null;
        startWave(world.director, world.director.wave + 1, world.rng);
        world.screen = SCREEN_PLAY;
        world.audio.waveHorn();
      }
      break;
    }
    case SCREEN_PAUSE: {
      if (controls.clicked || controls.keys.has('KeyP') || controls.keys.has('Escape')) {
        world.screen = SCREEN_PLAY;
      }
      break;
    }
    case SCREEN_OVER: {
      world.time += dt;
      if (controls.clicked || controls.keys.has('Enter')) {
        world.audio.click();
        startRun(world);
      }
      break;
    }
    case SCREEN_VICTORY: {
      world.time += dt;
      if (controls.clicked || controls.keys.has('Enter')) {
        world.audio.click();
        world.screen = SCREEN_TITLE;
        world.player = createPlayer();
        world.enemies = [];
        world.bullets = [];
        world.pickups = [];
      }
      break;
    }
    default:
      break;
  }
}

/** Which upgrade card (if any) sits under a click in field coordinates. */
export function upgradeCardAt(world, x, y) {
  if (!world.offer) return -1;
  const cardW = 220;
  const cardH = 190;
  const gap = 26;
  const total = world.offer.length * cardW + (world.offer.length - 1) * gap;
  const startX = (FIELD.width - total) / 2;
  const cardY = 190;
  for (let i = 0; i < world.offer.length; i += 1) {
    const cx = startX + i * (cardW + gap);
    if (x >= cx && x <= cx + cardW && y >= cardY && y <= cardY + cardH) return i;
  }
  return -1;
}

/** The autopilot's pick when a draft must resolve itself (screenshot staging). */
export function autopilotUpgrade(world) {
  if (!world.offer) return;
  const card = autopilotPick(world.offer);
  applyUpgrade(world.player, card.id);
  world.offer = null;
  startWave(world.director, world.director.wave + 1, world.rng);
  world.screen = SCREEN_PLAY;
}
