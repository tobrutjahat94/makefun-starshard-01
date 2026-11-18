// STARSHARD — tuning constants. One place for every number that shapes how the game
// feels, so a balance pass touches this file and nothing else.
export const FIELD = { width: 960, height: 600 };
export const STEP = 1 / 60;

export const COLORS = {
  bgTop: '#070d24',
  bgBottom: '#04060f',
  nebulaA: 'rgba(64, 90, 220, 0.20)',
  nebulaB: 'rgba(170, 60, 180, 0.14)',
  player: '#5ff2ff',
  playerCore: '#e8fdff',
  bullet: '#bff6ff',
  shard: '#ffc85e',
  shardCore: '#fff3c4',
  drifter: '#ff5da2',
  spitter: '#b78cff',
  dasher: '#ff9a3d',
  brute: '#ff4d5e',
  boss: '#ff3d81',
  elite: '#ffe066',
  text: '#eaf2ff',
  dim: '#8fa3c8',
  danger: '#ff5d6c',
  card: '#101a3a',
  cardEdge: '#2b3f7a',
};

export const PLAYER = {
  radius: 13,
  speed: 250,
  accel: 2600,
  friction: 6.5,
  maxHull: 100,
  dashSpeed: 920,
  dashTime: 0.16,
  dashCooldown: 1.6,
  dashIframes: 0.28,
  pickupRadius: 54,
  fireCooldownBase: 1 / 7,
  bulletSpeed: 640,
  bulletDamage: 12,
  bulletRadius: 4,
  critChance: 0.05,
  critMult: 2,
};

export const ENEMY = {
  drifter: { hp: 18, speed: 96, radius: 14, damage: 10, score: 10, shards: [1, 2] },
  spitter: { hp: 26, speed: 72, radius: 15, damage: 8, score: 15, shards: [2, 3], keepRange: 270, fireEvery: 2.3, bulletSpeed: 230 },
  dasher: { hp: 16, speed: 84, radius: 13, damage: 12, score: 15, shards: [1, 2], telegraph: 0.55, lungeSpeed: 540, lungeEvery: 2.6 },
  brute: { hp: 95, speed: 46, radius: 26, damage: 18, score: 30, shards: [3, 5] },
  boss: { hp: 1500, speed: 52, radius: 54, damage: 25, score: 1000, shards: [20, 20] },
};

export const ELITE_MULT = { hp: 2.3, size: 1.35, score: 3, speed: 1.05 };

// Wave table: what each wave throws at the player. Counts are the trickle queue;
// the director spawns them over the wave, a few at a time, so the pressure ramps.
export const WAVES = [
  { drifter: 8, spitter: 0, dasher: 0, brute: 0, elite: 0, spawnEvery: 1.15, name: 'FIRST CONTACT' },
  { drifter: 12, spitter: 3, dasher: 0, brute: 0, elite: 0, spawnEvery: 1.05, name: 'THEY SHOOT BACK' },
  { drifter: 12, spitter: 5, dasher: 4, brute: 0, elite: 0, spawnEvery: 0.95, name: 'CROSSFIRE' },
  { drifter: 16, spitter: 6, dasher: 6, brute: 1, elite: 1, spawnEvery: 0.9, name: 'HEAVY METAL' },
  { drifter: 18, spitter: 8, dasher: 8, brute: 2, elite: 1, spawnEvery: 0.85, name: 'THE SWARM THICKENS' },
  { drifter: 20, spitter: 10, dasher: 10, brute: 3, elite: 2, spawnEvery: 0.8, name: 'NO QUIET SECTOR' },
  { drifter: 22, spitter: 12, dasher: 12, brute: 4, elite: 2, spawnEvery: 0.75, name: 'SIEGE' },
  { drifter: 24, spitter: 14, dasher: 14, brute: 5, elite: 3, spawnEvery: 0.7, name: 'THE TIDE TURNS' },
  { drifter: 26, spitter: 16, dasher: 16, brute: 6, elite: 3, spawnEvery: 0.65, name: 'LAST LIGHT' },
  { drifter: 0, spitter: 0, dasher: 0, brute: 0, elite: 0, spawnEvery: 1.0, name: 'THE WARDEN', boss: true },
];

export const UPGRADES = [
  { id: 'damage', name: 'Overcharged Coils', desc: '+25% bullet damage', glyph: 'bolt' },
  { id: 'rate', name: 'Rapid Cycler', desc: '+20% fire rate', glyph: 'cycle' },
  { id: 'multishot', name: 'Split Barrel', desc: '+1 projectile per shot', glyph: 'split' },
  { id: 'hull', name: 'Reinforced Hull', desc: '+30 max hull, repair 30', glyph: 'shield' },
  { id: 'dash', name: 'Ion Thrusters', desc: 'Dash recharges 30% faster', glyph: 'dash' },
  { id: 'magnet', name: 'Tractor Web', desc: '+60% shard pickup range', glyph: 'magnet' },
  { id: 'pierce', name: 'Piercing Rounds', desc: 'Bullets pierce +1 enemy', glyph: 'pierce' },
  { id: 'crit', name: 'Deadly Calibration', desc: '+10% critical chance (x2 dmg)', glyph: 'crit' },
  { id: 'regen', name: 'Nanoweave', desc: 'Regenerate 0.6 hull / second', glyph: 'regen' },
  { id: 'greed', name: 'Shard Siphon', desc: 'Shards are worth +50% score', glyph: 'greed' },
];

export const SCORE = { shard: 5, killMult: 1 };
export const SHOTS = { title: 5, play: 26, boss: 6 };
