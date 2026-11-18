// STARSHARD — seeded random numbers. Every gameplay roll comes from one of these, so a
// screenshot scene with a fixed seed always plays out the same way. Nothing in the game
// logic uses Math.random; the only randomness is this stream.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  constructor(seed) {
    this.next = mulberry32(seed);
  }
  /** Float in [0, 1). */
  float() { return this.next(); }
  /** Float in [min, max). */
  range(min, max) { return min + (max - min) * this.next(); }
  /** Integer in [min, max] inclusive. */
  int(min, max) { return Math.floor(this.range(min, max + 1)); }
  /** One element of an array. */
  pick(array) { return array[Math.floor(this.next() * array.length)]; }
  /** Angle in [0, 2PI). */
  angle() { return this.next() * Math.PI * 2; }
  /** Fisher-Yates shuffle, in place. */
  shuffle(array) {
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = array[i]; array[i] = array[j]; array[j] = tmp;
    }
    return array;
  }
}
