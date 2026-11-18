// STARSHARD — deterministic screenshot scenes. Each scene plays the real rules forward
// from a fresh world with a fixed seed, steered by a simple autopilot (keep range, chase
// shards, dash out of trouble), so the frame is what a short game really looks like and
// the same seed always gives the same frame. A scene that cannot be reached by playing
// (the boss, the victory screen) is staged from a real, reachable state instead.
import { FIELD, STEP, SHOTS } from './config.js';
import { createWorld, stepWorld, autopilotUpgrade } from './world.js';
import { createEnemy } from './enemies.js';
import { createDirector, startWave, stepDirector } from './waves.js';
import { createShard } from './pickups.js';
import { burst, ring } from './particles.js';
import { SCREEN_PLAY, SCREEN_UPGRADE, SCREEN_OVER, SCREEN_VICTORY } from './render.js';

function idleControls() {
  return { move: { x: 0, y: 0 }, aimX: FIELD.width / 2, aimY: 200, firing: false, dash: false, clicked: false, clickX: 0, clickY: 0, keys: new Set() };
}

function startControls() {
  const controls = idleControls();
  controls.clicked = true;
  controls.clickX = FIELD.width / 2;
  controls.clickY = FIELD.height / 2;
  return controls;
}

/** The autopilot: aim at the nearest enemy, keep a fighting range, detour for shards. */
function autopilotControls(world) {
  const player = world.player;
  const enemies = world.enemies.filter((e) => !e.dead);
  let aimX = player.x;
  let aimY = player.y - 100;
  let moveX = 0;
  let moveY = 0;
  let dash = false;
  if (enemies.length > 0) {
    let nearest = null;
    let nd = Infinity;
    for (const enemy of enemies) {
      const d = Math.hypot(enemy.x - player.x, enemy.y - player.y);
      if (d < nd) { nd = d; nearest = enemy; }
    }
    aimX = nearest.x;
    aimY = nearest.y;
    if (nd < 110) {
      moveX = (player.x - nearest.x) / nd;
      moveY = (player.y - nearest.y) / nd;
      if (nd < 75 && player.dashTimer <= 0) dash = true;
    } else if (nd > 300) {
      moveX = (nearest.x - player.x) / nd;
      moveY = (nearest.y - player.y) / nd;
    } else {
      // Strafe around the target.
      const nx = (nearest.x - player.x) / nd;
      const ny = (nearest.y - player.y) / nd;
      moveX = -ny;
      moveY = nx;
    }
    // Detour for a close shard when nothing is breathing down our neck.
    let shard = null;
    let sd = 200;
    for (const pk of world.pickups) {
      const d = Math.hypot(pk.x - player.x, pk.y - player.y);
      if (d < sd) { sd = d; shard = pk; }
    }
    if (shard && nd > 160) {
      moveX = (shard.x - player.x) / sd;
      moveY = (shard.y - player.y) / sd;
    }
  }
  const len = Math.hypot(moveX, moveY);
  if (len > 1) { moveX /= len; moveY /= len; }
  return { move: { x: moveX, y: moveY }, aimX, aimY, firing: enemies.length > 0, dash, clicked: false, clickX: 0, clickY: 0, keys: new Set() };
}

/** Enemies actually on screen (inside the field), the only ones a screenshot can show. */
function visibleEnemies(world) {
  return world.enemies.filter((e) => !e.dead && e.x > 20 && e.x < FIELD.width - 20 && e.y > 20 && e.y < FIELD.height - 20).length;
}

/** Play forward from wave 1 until wave 4 is a busy fight. Falls back to a staged wave 4. */
function stagePlay(world) {
  stepWorld(world, STEP, startControls());
  const maxSteps = 150 * 60;
  for (let step = 0; step < maxSteps; step += 1) {
    if (world.screen === SCREEN_OVER) return stagePlayFallback(world.seed);
    if (world.screen === SCREEN_UPGRADE) { autopilotUpgrade(world); continue; }
    if (world.screen !== SCREEN_PLAY) break;
    if (world.director.wave >= 4 && visibleEnemies(world) >= 6) break;
    stepWorld(world, STEP, autopilotControls(world));
  }
  if (world.screen === SCREEN_OVER) return stagePlayFallback(world.seed);
  if (world.director.wave < 4 || visibleEnemies(world) < 6) {
    return stagePlayFallback(world.seed);
  }
  return world;
}

/** A real wave-4 fight, staged directly: the same state the director builds, entered at once. */
function stagePlayFallback(seed) {
  const world = createWorld(seed);
  stepWorld(world, STEP, startControls());
  world.director = createDirector();
  startWave(world.director, 4, world.rng);
  // Keep the HUD honest: only a few hostiles still queued behind the ones on screen.
  world.director.queue = world.director.queue.slice(0, 6);
  world.score = 2450;
  world.kills = 57;
  world.shardsCollected = 96;
  world.time = 158;
  world.player.x = 380;
  world.player.y = 320;
  world.player.hull = 82;
  const spots = [
    [650, 180, 'drifter'], [720, 320, 'spitter'], [560, 140, 'dasher'], [780, 220, 'drifter'],
    [420, 180, 'brute'], [680, 420, 'drifter'], [520, 380, 'spitter'], [760, 120, 'dasher'],
  ];
  for (const [x, y, kind] of spots) {
    world.enemies.push(createEnemy(kind, x, y, world.rng));
  }
  for (let i = 0; i < 6; i += 1) {
    world.pickups.push(createShard(380 + world.rng.range(-90, 90), 320 + world.rng.range(-70, 70), world.rng, 1));
  }
  // Let it breathe for 1.5 s so bullets are flying and particles are mid-burst.
  for (let i = 0; i < 90; i += 1) {
    if (world.screen === SCREEN_UPGRADE) autopilotUpgrade(world);
    if (world.screen !== SCREEN_PLAY) break;
    stepWorld(world, STEP, autopilotControls(world));
  }
  // The wave banner has served its purpose; a clean frame shows the fight, not the title.
  world.director.bannerTimer = 0;
  for (const enemy of world.enemies) enemy.flash = 0;
  return world;
}

/** Wave 10: the Warden at 62% hull, escorts around it, six seconds into the fight. */
function stageBoss(world) {
  stepWorld(world, STEP, startControls());
  world.director = createDirector();
  startWave(world.director, 10, world.rng);
  stepDirector(world.director, 0.7, world.enemies, world.player, world.rng, (kind, x, y, elite) => {
    world.enemies.push(createEnemy(kind, x, y, world.rng, elite));
  });
  const boss = world.enemies.find((e) => e.kind === 'boss');
  if (!boss) throw new Error('boss did not spawn while staging the boss shot');
  boss.hp = Math.round(boss.maxHp * 0.62);
  world.player.hull = 78;
  world.player.x = FIELD.width / 2;
  world.player.y = 430;
  world.score = 9860;
  world.kills = 243;
  world.shardsCollected = 312;
  world.time = 482;
  const escorts = [
    [300, 200, 'drifter'], [660, 180, 'spitter'], [700, 380, 'dasher'], [260, 360, 'drifter'],
    [760, 300, 'spitter'], [200, 300, 'dasher'],
  ];
  for (const [x, y, kind] of escorts) {
    world.enemies.push(createEnemy(kind, x, y, world.rng));
  }
  // Four seconds in: the boss has fired twice, escorts are still alive, hull still high.
  for (let i = 0; i < 4 * 60; i += 1) {
    if (world.screen !== SCREEN_PLAY) break;
    stepWorld(world, STEP, autopilotControls(world));
  }
  // Freeze the hit-flash: the Warden reads as the Warden, not a white hexagon.
  for (const enemy of world.enemies) enemy.flash = 0;
  return world;
}

/** The victory screen with a representative winning run's stats. */
function stageVictory(world) {
  world.screen = SCREEN_VICTORY;
  world.stats = { score: 12480, time: 581, kills: 312, shards: 486, accuracy: 0.61, wave: 10 };
  world.score = 12480;
  world.stars = 3;
  world.time = 2;
  world.player.hull = 64;
  world.player.x = FIELD.width / 2;
  world.player.y = 540;
  for (let i = 0; i < 5; i += 1) {
    const x = 200 + world.rng.range(0, 560);
    const y = 140 + world.rng.range(0, 280);
    burst(world.particles, x, y, { count: 16, color: world.rng.pick(['#ffc85e', '#5ff2ff', '#ff5da2']), speed: 220, life: 0.8, size: 3 });
    ring(world.particles, x, y, '#ffc85e');
  }
  return world;
}

/**
 * Stage the named scene (title, play, boss or victory; anything else is title) and
 * return the world to draw over it.
 */
export function stageShot(name, seed) {
  const world = createWorld(seed);
  if (name === 'play') return stagePlay(world);
  if (name === 'boss') return stageBoss(world);
  if (name === 'victory') return stageVictory(world);
  world.time = SHOTS.title;
  return world;
}
