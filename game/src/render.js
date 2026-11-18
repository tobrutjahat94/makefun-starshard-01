// STARSHARD — everything the player sees. The background is a seeded starfield over a
// pre-rendered nebula; the HUD, the title, upgrade, pause, game-over and victory screens
// are all drawn on the same canvas, so a screenshot always shows the real game.
import { COLORS, FIELD } from './config.js';
import { Rng } from './rng.js';
import { waveName } from './waves.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_OVER = 'over';
export const SCREEN_VICTORY = 'victory';

export function createBackground(seed) {
  const rng = new Rng(seed);
  const stars = [];
  for (let layer = 0; layer < 3; layer += 1) {
    const count = layer === 0 ? 60 : layer === 1 ? 45 : 28;
    for (let i = 0; i < count; i += 1) {
      stars.push({
        x: rng.range(0, FIELD.width),
        y: rng.range(0, FIELD.height),
        size: layer === 0 ? 1 : layer === 1 ? 1.6 : 2.4,
        layer,
        twinkle: rng.range(0, Math.PI * 2),
      });
    }
  }
  // Nebula, rendered once into an offscreen canvas.
  const nebula = document.createElement('canvas');
  nebula.width = FIELD.width;
  nebula.height = FIELD.height;
  const nctx = nebula.getContext('2d');
  const blobs = [
    { x: 180, y: 140, r: 260, color: COLORS.nebulaA },
    { x: 780, y: 420, r: 300, color: COLORS.nebulaB },
    { x: 620, y: 90, r: 180, color: 'rgba(60, 200, 220, 0.10)' },
  ];
  for (const blob of blobs) {
    const grad = nctx.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, blob.r);
    grad.addColorStop(0, blob.color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    nctx.fillStyle = grad;
    nctx.fillRect(blob.x - blob.r, blob.y - blob.r, blob.r * 2, blob.r * 2);
  }
  return { stars, nebula };
}

function drawBackground(ctx, bg, time) {
  const grad = ctx.createLinearGradient(0, 0, 0, FIELD.height);
  grad.addColorStop(0, COLORS.bgTop);
  grad.addColorStop(1, COLORS.bgBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.drawImage(bg.nebula, 0, 0);
  for (const star of bg.stars) {
    const drift = time * (2 + star.layer * 4);
    const y = (star.y + drift) % FIELD.height;
    const alpha = 0.35 + 0.4 * Math.abs(Math.sin(time * 1.5 + star.twinkle));
    ctx.globalAlpha = alpha * (0.5 + star.layer * 0.25);
    ctx.fillStyle = '#cfe4ff';
    ctx.fillRect(star.x, y, star.size, star.size);
  }
  ctx.globalAlpha = 1;
}

function drawShip(ctx, x, y, angle, scale, color, thrust, time) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle + Math.PI / 2);
  ctx.scale(scale, scale);
  // Thruster flame.
  if (thrust > 0.1) {
    const flick = 10 + Math.sin(time * 40) * 3 + thrust * 8;
    ctx.fillStyle = 'rgba(120, 210, 255, 0.85)';
    ctx.beginPath();
    ctx.moveTo(-4, 12);
    ctx.lineTo(0, 12 + flick);
    ctx.lineTo(4, 12);
    ctx.closePath();
    ctx.fill();
  }
  // Hull: a swept dart.
  const hullGrad = ctx.createLinearGradient(0, -16, 0, 14);
  hullGrad.addColorStop(0, '#e8fdff');
  hullGrad.addColorStop(0.45, color);
  hullGrad.addColorStop(1, '#0e5f7a');
  ctx.fillStyle = hullGrad;
  ctx.beginPath();
  ctx.moveTo(0, -17);
  ctx.lineTo(11, 10);
  ctx.lineTo(5, 6);
  ctx.lineTo(0, 11);
  ctx.lineTo(-5, 6);
  ctx.lineTo(-11, 10);
  ctx.closePath();
  ctx.fill();
  // Cockpit.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(0, -4, 2.6, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEnemyShape(ctx, enemy, time) {
  const { x, y, radius: r, kind, angle } = enemy;
  ctx.save();
  ctx.translate(x, y);
  const flash = enemy.flash > 0;
  const color = flash ? '#ffffff' : enemyColor(kind);
  // Spawn-in scale.
  const appear = Math.min(1, enemy.spawnT / 0.25);
  ctx.scale(appear, appear);
  if (enemy.elite) {
    ctx.strokeStyle = COLORS.elite;
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(time * 6);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r + 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (kind === 'drifter') {
    ctx.rotate(angle);
    ctx.moveTo(r, 0);
    ctx.lineTo(-r * 0.8, r * 0.75);
    ctx.lineTo(-r * 0.4, 0);
    ctx.lineTo(-r * 0.8, -r * 0.75);
    ctx.closePath();
  } else if (kind === 'spitter') {
    ctx.rotate(angle);
    ctx.moveTo(r, 0);
    ctx.lineTo(0, r * 0.8);
    ctx.lineTo(-r, 0);
    ctx.lineTo(0, -r * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(r * 0.35, 0, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'dasher') {
    ctx.rotate(angle);
    if (enemy.telegraph > 0) {
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 30);
    }
    ctx.moveTo(r * 1.2, 0);
    ctx.lineTo(-r * 0.7, r * 0.8);
    ctx.lineTo(-r * 0.2, 0);
    ctx.lineTo(-r * 0.7, -r * 0.8);
    ctx.closePath();
  } else if (kind === 'brute') {
    ctx.rotate(time * 0.5);
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  // Health bar for hurt enemies and brutes.
  if (enemy.hp < enemy.maxHp && enemy.kind !== 'drifter') {
    const w = r * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x - w / 2, y - r - 12, w, 4);
    ctx.fillStyle = COLORS.danger;
    ctx.fillRect(x - w / 2, y - r - 12, w * Math.max(0, enemy.hp / enemy.maxHp), 4);
  }
}

function enemyColor(kind) {
  if (kind === 'drifter') return COLORS.drifter;
  if (kind === 'spitter') return COLORS.spitter;
  if (kind === 'dasher') return COLORS.dasher;
  if (kind === 'brute') return COLORS.brute;
  return COLORS.boss;
}

function drawBoss(ctx, boss, time) {
  const { x, y, radius: r } = boss;
  ctx.save();
  ctx.translate(x, y);
  const appear = Math.min(1, boss.spawnT / 0.4);
  ctx.scale(appear, appear);
  // Rotating outer ring.
  ctx.strokeStyle = 'rgba(255, 61, 129, 0.7)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, r + 10, time * 0.8, time * 0.8 + Math.PI * 1.5);
  ctx.stroke();
  // Hull: layered plates.
  ctx.rotate(boss.angle + Math.PI / 2);
  const grad = ctx.createLinearGradient(0, -r, 0, r);
  grad.addColorStop(0, boss.flash > 0 ? '#ffffff' : '#3a0d24');
  grad.addColorStop(0.5, boss.flash > 0 ? '#ffffff' : '#7a1440');
  grad.addColorStop(1, boss.flash > 0 ? '#ffffff' : '#2a0818');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(r * 0.75, -r * 0.3);
  ctx.lineTo(r * 0.9, r * 0.5);
  ctx.lineTo(r * 0.4, r * 0.85);
  ctx.lineTo(-r * 0.4, r * 0.85);
  ctx.lineTo(-r * 0.9, r * 0.5);
  ctx.lineTo(-r * 0.75, -r * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Glowing core, pulsing with phase.
  const pulse = 0.7 + 0.3 * Math.sin(time * (4 + boss.phase * 2));
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.42);
  core.addColorStop(0, '#ffffff');
  core.addColorStop(0.4, `rgba(255, 93, 162, ${pulse})`);
  core.addColorStop(1, 'rgba(255, 61, 129, 0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPickups(ctx, pickups, time) {
  for (const pk of pickups) {
    const bob = Math.sin(pk.bob) * 2;
    const blink = pk.life < 3 ? (Math.sin(time * 12) > 0 ? 1 : 0.35) : 1;
    ctx.save();
    ctx.globalAlpha = blink;
    ctx.translate(pk.x, pk.y + bob);
    if (pk.kind === 'shard') {
      ctx.rotate(time * 2 + pk.bob);
      ctx.fillStyle = COLORS.shard;
      ctx.shadowColor = COLORS.shard;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(4, 0);
      ctx.lineTo(0, 7);
      ctx.lineTo(-4, 0);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = COLORS.shardCore;
      ctx.beginPath();
      ctx.arc(0, 0, 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#7dff9e';
      ctx.shadowColor = '#7dff9e';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(0, 7);
      ctx.bezierCurveTo(-11, -2, -6, -10, 0, -4);
      ctx.bezierCurveTo(6, -10, 11, -2, 0, 7);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }
}

function drawBullets(ctx, bullets) {
  for (const b of bullets) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(Math.atan2(b.vy, b.vx));
    if (b.friendly) {
      ctx.fillStyle = b.crit ? '#ffe066' : COLORS.bullet;
      ctx.shadowColor = COLORS.bullet;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.ellipse(0, 0, b.radius + 5, b.radius * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = b.color || '#ff8ab0';
      ctx.shadowColor = '#ff5da2';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, b.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawParticles(ctx, p) {
  for (const pt of p.list) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const ring of p.rings) {
    ctx.globalAlpha = Math.max(0, ring.life / ring.maxLife) * 0.8;
    ctx.strokeStyle = ring.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif';
  for (const t of p.texts) {
    ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}

function bar(ctx, x, y, w, h, ratio, color, bg = 'rgba(0,0,0,0.55)') {
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, ratio)), h);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function drawHud(ctx, state) {
  const { player, score, best, director, enemies, time } = state;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  // Hull.
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('HULL', 16, 22);
  const hullRatio = player.hull / player.maxHull;
  bar(ctx, 16, 28, 180, 12, hullRatio, hullRatio > 0.5 ? '#5ff2ff' : hullRatio > 0.25 ? '#ffc85e' : COLORS.danger);
  ctx.fillStyle = COLORS.dim;
  ctx.font = '11px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`${Math.ceil(player.hull)} / ${player.maxHull}`, 202, 38);
  // Dash pips.
  const dashReady = player.dashTimer <= 0;
  ctx.fillStyle = dashReady ? '#5ff2ff' : 'rgba(95,242,255,0.3)';
  ctx.beginPath();
  ctx.arc(24, 56, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.dim;
  ctx.fillText(dashReady ? 'DASH READY  [SPACE]' : 'DASH…', 36, 60);
  // Wave, centre.
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 15px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`WAVE ${director.wave} / 10 — ${waveName(director.wave)}`, FIELD.width / 2, 24);
  const hostiles = enemies.filter((e) => !e.dead).length + director.queue.length;
  ctx.fillStyle = COLORS.dim;
  ctx.font = '12px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(hostiles > 0 ? `${hostiles} hostiles remain` : 'Sector clear', FIELD.width / 2, 42);
  // Boss bar.
  const boss = enemies.find((e) => e.kind === 'boss' && !e.dead);
  if (boss) {
    ctx.fillStyle = '#ff5da2';
    ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('THE WARDEN', FIELD.width / 2, 62);
    bar(ctx, FIELD.width / 2 - 160, 68, 320, 10, boss.hp / boss.maxHp, COLORS.boss);
  }
  // Score, right.
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`${score.toLocaleString('en-US')} pts`, FIELD.width - 16, 24);
  ctx.fillStyle = COLORS.dim;
  ctx.font = '12px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`BEST ${Math.max(best, score).toLocaleString('en-US')}   ◆ ${state.shardsCollected}`, FIELD.width - 16, 42);
  // Weapon line, bottom-left.
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.dim;
  ctx.font = '12px "Segoe UI", system-ui, sans-serif';
  const weapon = `DMG ${Math.round(player.damage)}  ·  RATE ${(1 / player.fireInterval).toFixed(1)}/s  ·  SHOTS ${player.projectiles}${player.pierce > 0 ? `  ·  PIERCE ${player.pierce}` : ''}${player.critChance > 0.05 ? `  ·  CRIT ${Math.round(player.critChance * 100)}%` : ''}`;
  ctx.fillText(weapon, 16, FIELD.height - 14);
  // Wave banner.
  if (director.bannerTimer > 0) {
    const alpha = Math.min(1, director.bannerTimer / 0.5);
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 34px "Segoe UI", system-ui, sans-serif';
    ctx.shadowColor = '#5ff2ff';
    ctx.shadowBlur = 18;
    ctx.fillText(director.bannerText, FIELD.width / 2, FIELD.height / 2 - 60);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
  // Low-hull vignette.
  if (hullRatio <= 0.25 && player.alive) {
    const pulse = 0.12 + 0.08 * Math.sin(time * 6);
    const vg = ctx.createRadialGradient(FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.35, FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.75);
    vg.addColorStop(0, 'rgba(255,40,60,0)');
    vg.addColorStop(1, `rgba(255,40,60,${pulse})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }
  void time;
}

function dim(ctx, alpha = 0.62) {
  ctx.fillStyle = `rgba(3, 6, 16, ${alpha})`;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(10, 17, 42, 0.92)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = COLORS.cardEdge;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5);
}

function drawTitle(ctx, state, time) {
  const { best } = state;
  // A lone ship drifting under the logo.
  drawShip(ctx, FIELD.width / 2, 400, -Math.PI / 2 + Math.sin(time * 0.5) * 0.15, 2.2, COLORS.player, 0.7, time);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 64px "Segoe UI", system-ui, sans-serif';
  ctx.shadowColor = '#5ff2ff';
  ctx.shadowBlur = 26;
  ctx.fillText('STARSHARD', FIELD.width / 2, 150);
  ctx.shadowBlur = 0;
  ctx.fillStyle = COLORS.shard;
  ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('S A L V A G E   T H E   S H A R D S  ·  B R E A K   T H E   W A R D E N', FIELD.width / 2, 182);
  ctx.fillStyle = COLORS.dim;
  ctx.font = '15px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('10 waves. One boss. One ship. How long can you hold the belt?', FIELD.width / 2, 214);
  // Launch prompt, pulsing.
  const pulse = 0.65 + 0.35 * Math.sin(time * 3);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('— CLICK TO LAUNCH —', FIELD.width / 2, 500);
  ctx.globalAlpha = 1;
  ctx.fillStyle = COLORS.dim;
  ctx.font = '13px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('WASD move  ·  Mouse aim  ·  Hold click to fire  ·  SPACE dash  ·  P pause  ·  M mute', FIELD.width / 2, 536);
  if (best > 0) {
    ctx.fillStyle = COLORS.shard;
    ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`BEST  ${best.toLocaleString('en-US')} pts`, FIELD.width / 2, 566);
  }
}

const GLYPHS = {
  bolt: (ctx, x, y) => { ctx.beginPath(); ctx.moveTo(x + 2, y - 12); ctx.lineTo(x - 6, y + 2); ctx.lineTo(x - 1, y + 2); ctx.lineTo(x - 3, y + 12); ctx.lineTo(x + 6, y - 2); ctx.lineTo(x + 1, y - 2); ctx.closePath(); ctx.fill(); },
  cycle: (ctx, x, y) => { ctx.beginPath(); ctx.arc(x, y, 9, 0.4, Math.PI * 1.7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + 9, y - 6); ctx.lineTo(x + 12, y + 2); ctx.lineTo(x + 3, y + 1); ctx.closePath(); ctx.fill(); },
  split: (ctx, x, y) => { for (const dx of [-8, 0, 8]) { ctx.beginPath(); ctx.moveTo(x + dx, y - 10); ctx.lineTo(x + dx + 3, y + 8); ctx.lineTo(x + dx - 3, y + 8); ctx.closePath(); ctx.fill(); } },
  shield: (ctx, x, y) => { ctx.beginPath(); ctx.moveTo(x, y - 11); ctx.lineTo(x + 9, y - 6); ctx.lineTo(x + 9, y + 3); ctx.quadraticCurveTo(x + 9, y + 10, x, y + 12); ctx.quadraticCurveTo(x - 9, y + 10, x - 9, y + 3); ctx.lineTo(x - 9, y - 6); ctx.closePath(); ctx.fill(); },
  dash: (ctx, x, y) => { for (let i = 0; i < 3; i += 1) { ctx.fillRect(x - 10 + i * 7, y - 8 + i * 5, 12 - i * 2, 3); } },
  magnet: (ctx, x, y) => { ctx.beginPath(); ctx.arc(x, y, 10, Math.PI, 0); ctx.stroke(); ctx.fillRect(x - 11, y - 2, 5, 8); ctx.fillRect(x + 6, y - 2, 5, 8); },
  pierce: (ctx, x, y) => { ctx.beginPath(); ctx.moveTo(x - 11, y + 8); ctx.lineTo(x + 11, y - 8); ctx.lineWidth = 3; ctx.stroke(); ctx.beginPath(); ctx.arc(x + 6, y - 5, 4, 0, Math.PI * 2); ctx.fill(); },
  crit: (ctx, x, y) => { ctx.beginPath(); ctx.moveTo(x, y - 11); ctx.lineTo(x + 3, y - 3); ctx.lineTo(x + 11, y - 3); ctx.lineTo(x + 5, y + 2); ctx.lineTo(x + 8, y + 10); ctx.lineTo(x, y + 5); ctx.lineTo(x - 8, y + 10); ctx.lineTo(x - 5, y + 2); ctx.lineTo(x - 11, y - 3); ctx.lineTo(x - 3, y - 3); ctx.closePath(); ctx.fill(); },
  regen: (ctx, x, y) => { ctx.beginPath(); ctx.moveTo(x, y - 11); ctx.lineTo(x + 10, y + 8); ctx.lineTo(x - 10, y + 8); ctx.closePath(); ctx.fill(); ctx.fillRect(x - 2, y - 2, 4, 10); },
  greed: (ctx, x, y) => { ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillRect(-7, -7, 14, 14); ctx.restore(); },
};

function drawUpgrade(ctx, state) {
  dim(ctx, 0.55);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 30px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`WAVE ${state.director.wave} CLEARED`, FIELD.width / 2, 110);
  ctx.fillStyle = COLORS.shard;
  ctx.font = '15px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('Choose one upgrade — the belt does not wait.', FIELD.width / 2, 140);
  const cards = state.offer;
  if (!cards) return;
  const cardW = 220;
  const cardH = 190;
  const gap = 26;
  const total = cards.length * cardW + (cards.length - 1) * gap;
  const startX = (FIELD.width - total) / 2;
  const y = 190;
  cards.forEach((card, i) => {
    const x = startX + i * (cardW + gap);
    panel(ctx, x, y, cardW, cardH);
    ctx.fillStyle = COLORS.shard;
    ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`[ ${i + 1} ]`, x + cardW / 2, y + 30);
    // Glyph.
    ctx.save();
    ctx.translate(x + cardW / 2, y + 72);
    ctx.fillStyle = COLORS.player;
    ctx.strokeStyle = COLORS.player;
    ctx.lineWidth = 2.5;
    (GLYPHS[card.glyph] || GLYPHS.bolt)(ctx, 0, 0);
    ctx.restore();
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 17px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(card.name, x + cardW / 2, y + 118);
    ctx.fillStyle = COLORS.dim;
    ctx.font = '13px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(card.desc, x + cardW / 2, y + 144);
  });
  ctx.fillStyle = COLORS.dim;
  ctx.font = '13px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('Click a card, or press 1 / 2 / 3', FIELD.width / 2, y + cardH + 36);
}

function drawPause(ctx) {
  dim(ctx, 0.6);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 40px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('PAUSED', FIELD.width / 2, FIELD.height / 2 - 8);
  ctx.fillStyle = COLORS.dim;
  ctx.font = '15px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('Press P or click to resume', FIELD.width / 2, FIELD.height / 2 + 26);
}

function drawStats(ctx, state, y0) {
  const s = state.stats;
  const rows = [
    ['SCORE', s.score.toLocaleString('en-US')],
    ['TIME', formatTime(s.time)],
    ['KILLS', String(s.kills)],
    ['SHARDS', String(s.shards)],
    ['ACCURACY', `${Math.round(s.accuracy * 100)}%`],
    ['WAVE REACHED', String(s.wave)],
  ];
  ctx.font = '15px "Segoe UI", system-ui, sans-serif';
  rows.forEach(([label, value], i) => {
    const y = y0 + i * 28;
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.dim;
    ctx.fillText(label, FIELD.width / 2 - 12, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.text;
    ctx.fillText(value, FIELD.width / 2 + 12, y);
  });
  return y0 + rows.length * 28;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function drawOver(ctx, state, time) {
  dim(ctx, 0.66);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.danger;
  ctx.font = 'bold 44px "Segoe UI", system-ui, sans-serif';
  ctx.shadowColor = COLORS.danger;
  ctx.shadowBlur = 20;
  ctx.fillText('SIGNAL LOST', FIELD.width / 2, 130);
  ctx.shadowBlur = 0;
  ctx.fillStyle = COLORS.dim;
  ctx.font = '15px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`The belt claims another skiff on wave ${state.stats.wave}.`, FIELD.width / 2, 162);
  const endY = drawStats(ctx, state, 210);
  const pulse = 0.65 + 0.35 * Math.sin(time * 3);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('— CLICK TO RETRY —', FIELD.width / 2, endY + 48);
  ctx.globalAlpha = 1;
}

function drawVictory(ctx, state, time) {
  dim(ctx, 0.6);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.shard;
  ctx.font = 'bold 40px "Segoe UI", system-ui, sans-serif';
  ctx.shadowColor = COLORS.shard;
  ctx.shadowBlur = 22;
  ctx.fillText('THE WARDEN FALLS', FIELD.width / 2, 108);
  ctx.shadowBlur = 0;
  ctx.fillStyle = COLORS.dim;
  ctx.font = '15px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('The belt is yours. The jump drive sings again.', FIELD.width / 2, 138);
  // Stars earned: 1 for the win, +1 for hull above half, +1 for under 12 minutes.
  const stars = state.stars ?? 3;
  for (let i = 0; i < 3; i += 1) {
    const x = FIELD.width / 2 + (i - 1) * 64;
    const y = 190;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = i < stars ? COLORS.shard : 'rgba(255,255,255,0.15)';
    ctx.shadowColor = i < stars ? COLORS.shard : 'transparent';
    ctx.shadowBlur = i < stars ? 14 : 0;
    ctx.beginPath();
    for (let k = 0; k < 10; k += 1) {
      const r = k % 2 === 0 ? 24 : 10;
      const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
      if (k === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  const endY = drawStats(ctx, state, 250);
  const pulse = 0.65 + 0.35 * Math.sin(time * 3);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('— CLICK TO PLAY AGAIN —', FIELD.width / 2, endY + 48);
  ctx.globalAlpha = 1;
}

/** Draw one frame. `state.screen` picks the overlay; the world draws under all of them. */
export function render(ctx, state, time) {
  ctx.save();
  const shake = state.particles.shake;
  if (shake > 0.2) {
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  }
  drawBackground(ctx, state.bg, time);
  drawPickups(ctx, state.pickups, time);
  for (const enemy of state.enemies) {
    if (enemy.dead) continue;
    if (enemy.kind === 'boss') drawBoss(ctx, enemy, time);
    else drawEnemyShape(ctx, enemy, time);
  }
  drawBullets(ctx, state.bullets);
  if (state.player.alive && state.screen !== SCREEN_TITLE) {
    drawShip(ctx, state.player.x, state.player.y, state.player.angle, 1, COLORS.player, state.player.thrust, time);
  }
  drawParticles(ctx, state.particles);
  ctx.restore();

  if (state.screen === SCREEN_TITLE) {
    dim(ctx, 0.35);
    drawTitle(ctx, state, time);
  } else if (state.screen === SCREEN_PLAY) {
    drawHud(ctx, state);
  } else if (state.screen === SCREEN_UPGRADE) {
    drawHud(ctx, state);
    drawUpgrade(ctx, state);
  } else if (state.screen === SCREEN_PAUSE) {
    drawHud(ctx, state);
    drawPause(ctx);
  } else if (state.screen === SCREEN_OVER) {
    drawOver(ctx, state, time);
  } else if (state.screen === SCREEN_VICTORY) {
    drawVictory(ctx, state, time);
  }
}
