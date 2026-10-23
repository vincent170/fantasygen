// Small shared helpers: RNG, noise, math, naming.

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2(x, y, s = 0) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function strSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export class Noise {
  constructor(seed = 1) { this.seed = seed | 0; }
  _v(ix, iy) { return hash2(ix, iy, this.seed); }
  n2(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
    const v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    const a = this._v(ix, iy), b = this._v(ix + 1, iy);
    const c = this._v(ix, iy + 1), d = this._v(ix + 1, iy + 1);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  }
  fbm(x, y, oct = 4, lac = 2, gain = 0.5) {
    let amp = 1, f = 1, sum = 0, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += this.n2(x * f, y * f) * amp;
      norm += amp; amp *= gain; f *= lac;
    }
    return sum / norm;
  }
}

const NAME_A = ['Ash', 'Elder', 'Silver', 'Raven', 'Gold', 'Stone', 'Mist', 'Oak', 'Wind', 'Brook', 'Thorn', 'Lark',
  'Crown', 'Hollow', 'Willow', 'Amber', 'Iron', 'Moon', 'Sun', 'Fair', 'Heron', 'Cedar', 'Briar', 'Harbor', 'Copper',
  'Dawn', 'Ember', 'Fox', 'Glen', 'Lantern'];
const NAME_B = ['haven', 'ford', 'wick', 'ton', 'bridge', 'port', 'vale', 'mere', 'stead', 'field', 'gate', 'hollow',
  'shire', 'crest', 'burgh', 'minster', 'worth', 'bury', 'moor', 'reach'];
export function cityName(rng = Math.random) {
  return NAME_A[(rng() * NAME_A.length) | 0] + NAME_B[(rng() * NAME_B.length) | 0];
}

export const fmtMoney = (v) => {
  const s = v < 0 ? '-' : '';
  v = Math.abs(Math.round(v));
  return s + '$' + v.toLocaleString('en-US');
};
export const fmtNum = (v) => Math.round(v).toLocaleString('en-US');

export function hex2rgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgb2hex(r, g, b) {
  const c = (v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}
export function shade(hex, f) {
  const [r, g, b] = hex2rgb(hex);
  return rgb2hex(r * f, g * f, b * f);
}
export function mix(h1, h2, t) {
  const a = hex2rgb(h1), b = hex2rgb(h2);
  return rgb2hex(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t));
}

export function pick(rng, arr) { return arr[(rng() * arr.length) | 0]; }
export function weighted(rng, items) {
  // items: [[value, weight], ...]
  let tot = 0;
  for (const it of items) tot += it[1];
  let r = rng() * tot;
  for (const it of items) { r -= it[1]; if (r <= 0) return it[0]; }
  return items[items.length - 1][0];
}
