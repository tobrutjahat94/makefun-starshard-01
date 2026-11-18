// STARSHARD — the between-wave upgrade draft. After every cleared wave (except the
// last) the player picks 1 of 3 cards. The offer is drawn from the pool without repeats
// in one draft, so every choice is a real fork in the build.
import { UPGRADES } from './config.js';

/** Draw 3 distinct upgrade cards from the pool. */
export function drawOffer(rng) {
  const pool = [...UPGRADES];
  rng.shuffle(pool);
  return pool.slice(0, 3);
}

/** Priority order the screenshot autopilot uses when it must pick a card itself. */
export const AUTOPILOT_PRIORITY = ['multishot', 'damage', 'rate', 'pierce', 'hull', 'crit', 'dash', 'regen', 'magnet', 'greed'];

export function autopilotPick(offer) {
  let best = offer[0];
  let bestRank = AUTOPILOT_PRIORITY.indexOf(best.id);
  for (const card of offer) {
    const rank = AUTOPILOT_PRIORITY.indexOf(card.id);
    if (rank !== -1 && (bestRank === -1 || rank < bestRank)) {
      best = card;
      bestRank = rank;
    }
  }
  return best;
}
