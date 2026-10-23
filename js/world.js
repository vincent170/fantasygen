// World data: heightmap + per-tile layers, terrain generation and terraforming.
import { MAP_N, Z, R, ROADS } from './data.js';
import { Noise, clamp, lerp, smoothstep, mulberry32, hash2 } from './util.js';

export const DX = [0, 1, 0, -1];   // N, E, S, W  (N = -z)
export const DZ = [-1, 0, 1, 0];
export const WATER_T = 0.05;       // avg corner height under which a tile counts as water
export const BRIDGE_Y = 0.42;

export class World {
  constructor(n = MAP_N) {
    this.n = n;
    this.vn = n + 1;
    this.h = new Float32Array(this.vn * this.vn);
    const t = n * n;
    this.water = new Uint8Array(t);
    this.tree = new Uint8Array(t);      // 0 none, 1 sparse forest, 2 dense forest
    this.road = new Uint8Array(t);
    this.zone = new Uint8Array(t);
    this.zstyle = new Uint8Array(t);
    this.bid = new Int32Array(t);       // building id occupying tile (0 = none)
    this.pylon = new Uint8Array(t);
    this.park = new Uint8Array(t);      // painted parkland
    this.lot = new Uint8Array(t);       // ground kind under buildings (see LOT_KIND)
    this.rev = 0;                       // bumped on any structural edit (roads/zones/buildings)
    this.buildings = new Map();
    this.nextId = 1;
    this.seed = 1;
    this.version = 0;                   // bumped on any structural change
    this.dirty = { terrain: null, roads: true, trees: true, ground: null };
    this.fill(1.0);
  }

  // ------------------------------------------------------------ indexing
  idx(x, z) { return z * this.n + x; }
  inb(x, z) { return x >= 0 && z >= 0 && x < this.n && z < this.n; }
  vi(i, j) { return j * this.vn + i; }
  H(i, j) { return this.h[clamp(j, 0, this.n) * this.vn + clamp(i, 0, this.n)]; }

  heightAt(x, z) {
    const n = this.n;
    x = clamp(x, 0, n - 1e-4); z = clamp(z, 0, n - 1e-4);
    const i = x | 0, j = z | 0, fx = x - i, fz = z - j;
    const h = this.h, vn = this.vn;
    const a = h[j * vn + i], b = h[j * vn + i + 1], c = h[(j + 1) * vn + i], d = h[(j + 1) * vn + i + 1];
    return lerp(lerp(a, b, fx), lerp(c, d, fx), fz);
  }

  tileCorners(x, z) {
    const h = this.h, vn = this.vn, i = x, j = z;
    return [h[j * vn + i], h[j * vn + i + 1], h[(j + 1) * vn + i], h[(j + 1) * vn + i + 1]];
  }
  tileAvg(x, z) { const c = this.tileCorners(x, z); return (c[0] + c[1] + c[2] + c[3]) * 0.25; }
  tileMin(x, z) { const c = this.tileCorners(x, z); return Math.min(c[0], c[1], c[2], c[3]); }
  tileMax(x, z) { const c = this.tileCorners(x, z); return Math.max(c[0], c[1], c[2], c[3]); }
  tileSlope(x, z) { const c = this.tileCorners(x, z); return Math.max(...c) - Math.min(...c); }

  isWater(x, z) { return !this.inb(x, z) ? true : this.water[z * this.n + x] === 1; }
  isShore(x, z) {
    if (this.isWater(x, z)) return false;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if ((dx || dz) && this.inb(x + dx, z + dz) && this.isWater(x + dx, z + dz)) return true;
    }
    return false;
  }
  isDeepShore(x, z) {
    // water within 2 tiles that is reasonably deep
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      const a = x + dx, b = z + dz;
      if (this.inb(a, b) && this.isWater(a, b) && this.tileAvg(a, b) < -0.6) return true;
    }
    return false;
  }

  roadAt(x, z) { return this.inb(x, z) ? this.road[z * this.n + x] : 0; }
  hasRoad(x, z) { const t = this.roadAt(x, z); return t >= 1 && t <= 5; }
  hasRail(x, z) { return this.roadAt(x, z) === R.RAIL; }

  /** bit mask of connected neighbours (N=1,E=2,S=4,W=8) for road/rail tile */
  roadMask(x, z) {
    const t = this.roadAt(x, z);
    if (!t) return 0;
    let m = 0;
    for (let d = 0; d < 4; d++) {
      const nt = this.roadAt(x + DX[d], z + DZ[d]);
      if (!nt) continue;
      if ((t === R.RAIL) === (nt === R.RAIL)) m |= 1 << d;
    }
    return m;
  }
  isBridge(x, z) { return this.inb(x, z) && this.road[z * this.n + x] > 0 && this.water[z * this.n + x] === 1; }

  /** height of road surface at a vertex (bridge-aware) */
  roadCornerY(i, j) {
    for (let dz = -1; dz <= 0; dz++) for (let dx = -1; dx <= 0; dx++) {
      const x = i + dx, z = j + dz;
      if (this.inb(x, z) && this.road[z * this.n + x] && this.water[z * this.n + x]) return BRIDGE_Y;
    }
    return Math.max(this.H(i, j), 0.06) + 0.012;
  }
  /** road surface height at world position */
  roadY(x, z) {
    const tx = clamp(Math.floor(x), 0, this.n - 1), tz = clamp(Math.floor(z), 0, this.n - 1);
    const fx = x - tx, fz = z - tz;
    const a = this.roadCornerY(tx, tz), b = this.roadCornerY(tx + 1, tz), c = this.roadCornerY(tx, tz + 1), d = this.roadCornerY(tx + 1, tz + 1);
    return lerp(lerp(a, b, fx), lerp(c, d, fx), fz);
  }

  /** is there a frontage road edge-adjacent to tile? returns facing dir (0..3) of road, or -1 */
  frontRoad(x, z) {
    for (let d = 0; d < 4; d++) {
      const t = this.roadAt(x + DX[d], z + DZ[d]);
      if (t >= 1 && t <= 4) return d;
    }
    return -1;
  }

  // ------------------------------------------------------------ fills
  fill(v) {
    this.h.fill(v);
    this.updateTiles(0, 0, this.n - 1, this.n - 1);
    this.markTerrain(0, 0, this.n - 1, this.n - 1);
  }

  markTerrain(x0, z0, x1, z1) {
    const d = this.dirty.terrain;
    if (!d) this.dirty.terrain = { x0, z0, x1, z1 };
    else { d.x0 = Math.min(d.x0, x0); d.z0 = Math.min(d.z0, z0); d.x1 = Math.max(d.x1, x1); d.z1 = Math.max(d.z1, z1); }
    this.version++;
  }
  markGround(x0, z0, x1, z1) {
    x0 = clamp(x0, 0, this.n - 1); z0 = clamp(z0, 0, this.n - 1); x1 = clamp(x1, 0, this.n - 1); z1 = clamp(z1, 0, this.n - 1);
    const d = this.dirty.ground;
    if (!d) this.dirty.ground = { x0, z0, x1, z1 };
    else { d.x0 = Math.min(d.x0, x0); d.z0 = Math.min(d.z0, z0); d.x1 = Math.max(d.x1, x1); d.z1 = Math.max(d.z1, z1); }
  }

  /** recompute water mask for a tile range (inclusive), strip trees from water */
  updateTiles(x0, z0, x1, z1) {
    x0 = clamp(x0, 0, this.n - 1); z0 = clamp(z0, 0, this.n - 1); x1 = clamp(x1, 0, this.n - 1); z1 = clamp(z1, 0, this.n - 1);
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const i = z * this.n + x;
      const w = this.tileAvg(x, z) < WATER_T ? 1 : 0;
      this.water[i] = w;
      if (w) { this.tree[i] = 0; if (this.zone[i] && !this.bid[i]) this.zone[i] = 0; this.park[i] = 0; }
    }
  }

  // ------------------------------------------------------------ placement checks
  buildable(x, z) {
    if (!this.inb(x, z)) return false;
    const i = z * this.n + x;
    if (this.water[i]) return false;
    const c = this.tileCorners(x, z);
    const mn = Math.min(...c), mx = Math.max(...c);
    return mn >= 0.0 && mx - mn <= 1.1 && (c[0] + c[1] + c[2] + c[3]) / 4 >= 0.12;
  }
  tileFree(x, z) {
    if (!this.inb(x, z)) return false;
    const i = z * this.n + x;
    return !this.bid[i] && !this.road[i] && !this.pylon[i];
  }
  vertexLocked(i, j) {
    for (let dz = -1; dz <= 0; dz++) for (let dx = -1; dx <= 0; dx++) {
      const x = i + dx, z = j + dz;
      if (this.inb(x, z) && this.bid[z * this.n + x]) return true;
    }
    return false;
  }

  /** Flatten footprint vertices to common height (called when a building is placed) */
  flattenFootprint(x, z, w, d, minH = 0.3) {
    let sum = 0, cnt = 0;
    for (let j = z; j <= z + d; j++) for (let i = x; i <= x + w; i++) { sum += this.H(i, j); cnt++; }
    const target = Math.max(minH, sum / cnt);
    for (let j = z; j <= z + d; j++) for (let i = x; i <= x + w; i++) this.h[this.vi(i, j)] = target;
    this.updateTiles(x - 1, z - 1, x + w, z + d);
    this.markTerrain(x - 1, z - 1, x + w, z + d);
    return target;
  }

  /** ground height used for a building footprint (after flatten) */
  footprintHeight(x, z, w, d) {
    let m = -1e9;
    for (let j = z; j <= z + d; j++) for (let i = x; i <= x + w; i++) m = Math.max(m, this.H(i, j));
    return m;
  }

  // ------------------------------------------------------------ terraforming brushes
  /**
   * mode: raise|lower|smooth|flatten|water|land
   */
  brush(mode, cx, cz, radius, amount, target = 0) {
    const r = radius;
    const i0 = Math.max(0, Math.floor(cx - r)), i1 = Math.min(this.n, Math.ceil(cx + r));
    const j0 = Math.max(0, Math.floor(cz - r)), j1 = Math.min(this.n, Math.ceil(cz + r));
    const copy = mode === 'smooth' ? this.h.slice() : null;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const d = Math.hypot(i - cx, j - cz);
      if (d > r) continue;
      if (this.vertexLocked(i, j)) continue;
      const t = 1 - d / r;
      const w = t * t * (3 - 2 * t);
      const k = this.vi(i, j);
      let h = this.h[k];
      switch (mode) {
        case 'raise': h += amount * w; break;
        case 'lower': h -= amount * w; break;
        case 'flatten': h = lerp(h, target, clamp(w * amount * 3, 0, 1)); break;
        case 'water': h = lerp(h, -1.8, clamp(w * amount * 1.5, 0, 1)); h = Math.min(h, this.h[k]); break;
        case 'land': h = lerp(h, 0.6, clamp(w * amount * 1.5, 0, 1)); h = Math.max(h, this.h[k]); break;
        case 'smooth': {
          let s = 0, c = 0;
          for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
            const ii = clamp(i + a, 0, this.n), jj = clamp(j + b, 0, this.n);
            s += copy[jj * this.vn + ii]; c++;
          }
          h = lerp(h, s / c, clamp(w * amount * 4, 0, 1));
          break;
        }
      }
      this.h[k] = clamp(h, -4, 9);
    }
    this.updateTiles(i0 - 1, j0 - 1, i1, j1);
    this.markTerrain(i0 - 1, j0 - 1, i1, j1);
    this.markGround(i0 - 1, j0 - 1, i1, j1);
  }

  paintTrees(cx, cz, radius, value, rng = Math.random) {
    const r = radius;
    for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if (!this.inb(x, z)) continue;
      if (Math.hypot(x + 0.5 - cx, z + 0.5 - cz) > r) continue;
      const i = z * this.n + x;
      if (value) {
        if (this.water[i] || this.road[i] || this.bid[i] || this.pylon[i] || this.zone[i] || this.park[i]) continue;
        if (!this.buildable(x, z)) continue;
        this.tree[i] = rng() < 0.5 ? 2 : 1;
      } else this.tree[i] = 0;
    }
    this.dirty.trees = true;
    this.markGround(cx - r - 1, cz - r - 1, cx + r + 1, cz + r + 1);
  }

  carveRiver(pts, width, depth = 1.7) {
    // pts: array of [x,z] in vertex coordinates
    const n = this.n;
    const wr = width * 1.9;
    let minI = n, minJ = n, maxI = 0, maxJ = 0;
    for (let s = 0; s < pts.length - 1; s++) {
      const [ax, az] = pts[s], [bx, bz] = pts[s + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const steps = Math.max(1, Math.ceil(len / 0.5));
      for (let k = 0; k <= steps; k++) {
        const px = lerp(ax, bx, k / steps), pz = lerp(az, bz, k / steps);
        const i0 = Math.max(0, Math.floor(px - wr)), i1 = Math.min(n, Math.ceil(px + wr));
        const j0 = Math.max(0, Math.floor(pz - wr)), j1 = Math.min(n, Math.ceil(pz + wr));
        minI = Math.min(minI, i0); minJ = Math.min(minJ, j0); maxI = Math.max(maxI, i1); maxJ = Math.max(maxJ, j1);
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          if (this.vertexLocked(i, j)) continue;
          const d = Math.hypot(i - px, j - pz);
          if (d > wr) continue;
          const f = smoothstep(wr, width * 0.35, d);
          const k2 = this.vi(i, j);
          const t = lerp(this.h[k2], -depth, f);
          if (t < this.h[k2]) this.h[k2] = t;
        }
      }
    }
    this.updateTiles(minI - 1, minJ - 1, maxI, maxJ);
    this.markTerrain(minI - 1, minJ - 1, maxI, maxJ);
    this.markGround(minI - 1, minJ - 1, maxI, maxJ);
    this.dirty.trees = true;
  }

  /** meandering river between two points -> list of points */
  riverPath(x0, z0, x1, z1, seed, meander = 1) {
    const noise = new Noise(seed);
    const len = Math.hypot(x1 - x0, z1 - z0);
    const segs = Math.max(2, Math.ceil(len / 2));
    const dx = (x1 - x0) / len, dz = (z1 - z0) / len;
    const px = -dz, pz = dx;
    const pts = [];
    for (let k = 0; k <= segs; k++) {
      const t = k / segs;
      const env = Math.sin(t * Math.PI) * 0.6 + 0.4;
      const off = (noise.fbm(t * 4 + 7.3, 3.1, 3) - 0.5) * 2 * len * 0.18 * meander * env;
      pts.push([x0 + dx * len * t + px * off, z0 + dz * len * t + pz * off]);
    }
    return pts;
  }

  // ------------------------------------------------------------ generation
  generate({ seed = 1, template = 'river', forest = 0.5 } = {}) {
    const n = this.n, vn = this.vn;
    this.seed = seed;
    const rng = mulberry32(seed);
    const nz = new Noise(seed), nz2 = new Noise(seed + 101), nz3 = new Noise(seed + 977);
    this.road.fill(0); this.zone.fill(0); this.bid.fill(0); this.tree.fill(0); this.pylon.fill(0); this.park.fill(0); this.lot.fill(0);
    this.zstyle.fill(0);
    this.buildings.clear(); this.nextId = 1;

    const rot = (rng() * 4) | 0;
    const flipU = rng() < 0.5;
    for (let j = 0; j < vn; j++) for (let i = 0; i < vn; i++) {
      let u = i / n, v = j / n;
      if (rot & 1) { const t = u; u = v; v = t; }
      if (flipU) u = 1 - u;
      const cx = u - 0.5, cy = v - 0.5;
      const rad = Math.hypot(cx, cy) * 2;       // 0 centre .. ~1.4 corner
      const detail = nz.fbm(u * 5, v * 5, 5);
      const broad = nz2.fbm(u * 2.2, v * 2.2, 4);
      let h = 1;
      switch (template) {
        case 'flat':
          h = 1.0; break;
        case 'plains':
          h = 0.9 + (broad - 0.5) * 1.6 + (detail - 0.5) * 0.5; break;
        case 'river':
          h = 1.0 + (broad - 0.5) * 2.2 + (detail - 0.5) * 0.7 + Math.pow(Math.abs(cx) * 2, 2.2) * 2.2; break;
        case 'coast': {
          const shoreLine = 0.34 + (nz3.fbm(v * 3.2, 1.7, 3) - 0.5) * 0.34;
          const d = (u - shoreLine) * 6;
          h = d < 0 ? -0.4 + d * 0.8 : Math.min(d * 0.6, 1.1) + (broad - 0.5) * 1.4 + (detail - 0.5) * 0.5;
          h = Math.max(h, -3.2);
          break;
        }
        case 'island': {
          const r = rad / 0.92;
          h = (1 - Math.pow(r, 1.9)) * 4.4 - 0.9 + (detail - 0.5) * 1.5 + (broad - 0.5) * 1.2;
          break;
        }
        case 'lakes': {
          h = 1.1 + (broad - 0.5) * 1.8 + (detail - 0.5) * 0.7;
          const lk = nz3.fbm(u * 3.1 + 4, v * 3.1 - 2, 3);
          if (lk < 0.42) h -= (0.42 - lk) * 14;
          break;
        }
        case 'highlands': {
          const m = Math.pow(nz2.fbm(u * 3, v * 3, 5), 1.6);
          h = 0.7 + m * 7.5 + (detail - 0.5) * 0.9;
          break;
        }
        case 'archipelago': {
          const a = nz.fbm(u * 4.2, v * 4.2, 5);
          h = (a - 0.54) * 11;
          h = Math.max(h, -3);
          break;
        }
        case 'delta': {
          const shoreLine = 0.22 + (nz3.fbm(v * 3.2, 1.7, 3) - 0.5) * 0.2;
          const d = (u - shoreLine) * 6;
          h = d < 0 ? -0.8 + d * 0.7 : Math.min(d * 0.5, 1.0) + (broad - 0.5) * 0.9 + (detail - 0.5) * 0.35;
          break;
        }
        default: h = 1;
      }
      // keep the middle buildable for inland templates
      if (template === 'river' || template === 'plains' || template === 'highlands' || template === 'lakes') {
        const m = 1 - smoothstep(0.15, 0.62, rad);
        h = lerp(h, 1.0 + (detail - 0.5) * 0.45, m * (template === 'highlands' ? 0.75 : 0.55));
      }
      this.h[j * vn + i] = clamp(h, -3.5, 8);
    }

    // rivers
    // (rivers use their own RNG stream so templates stay deterministic per seed)
    const addRiver = (x0, z0, x1, z1, w, meander = 1) => {
      const pts = this.riverPath(x0, z0, x1, z1, (rng() * 1e6) | 0, meander);
      this.carveRiver(pts, w, 1.8);
    };
    if (template === 'river') {
      const ax = n * (0.3 + rng() * 0.4);
      if (rng() < 0.5) addRiver(ax, -4, n * (0.3 + rng() * 0.4), n + 4, 2.6 + rng() * 1.4, 1.1);
      else addRiver(-4, ax, n + 4, n * (0.3 + rng() * 0.4), 2.6 + rng() * 1.4, 1.1);
      // tributary
      const px = n * (0.12 + rng() * 0.2), pz = n * (0.62 + rng() * 0.25);
      if (rng() < 0.7) addRiver(n * 0.5, n * 0.45, px, pz, 1.4 + rng(), 0.9);
    } else if (template === 'plains') {
      if (rng() < 0.6) addRiver(-4, n * (0.2 + rng() * 0.6), n + 4, n * (0.2 + rng() * 0.6), 1.7 + rng() * 0.8, 1.0);
    } else if (template === 'highlands') {
      addRiver(n * (0.25 + rng() * 0.5), -4, n * (0.25 + rng() * 0.5), n + 4, 1.8 + rng(), 0.8);
    } else if (template === 'delta') {
      // river from far side splitting toward sea (sea on low-u side in template space; approximated by scanning)
      let sx = n * 0.5, sz = n * 0.5;
      // find direction of the sea: lowest average height side
      const sides = [[0, n / 2], [n, n / 2], [n / 2, 0], [n / 2, n]];
      let best = 0, bestH = 1e9;
      sides.forEach((s, k) => { const hh = this.heightAt(clamp(s[0], 0, n - 1), clamp(s[1], 0, n - 1)); if (hh < bestH) { bestH = hh; best = k; } });
      const sea = sides[best], inland = sides[best ^ 1];
      const mainStart = [inland[0] + (rng() - 0.5) * 16, inland[1] + (rng() - 0.5) * 16];
      const mid = [lerp(inland[0], sea[0], 0.55), lerp(inland[1], sea[1], 0.55)];
      addRiver(mainStart[0], mainStart[1], mid[0], mid[1], 2.8, 1.0);
      for (let b = 0; b < 3; b++) {
        const end = [sea[0] + (rng() - 0.5) * 60 * (best < 2 ? 0 : 1) + (best < 2 ? 0 : 0), sea[1] + (rng() - 0.5) * 60 * (best < 2 ? 1 : 0)];
        addRiver(mid[0], mid[1], end[0], end[1], 1.6 + rng() * 0.8, 1.0);
      }
    }

    // deepen water so coasts drop away quickly (ports, bridges and ships need real depth)
    for (let k = 0; k < this.h.length; k++) if (this.h[k] < 0) this.h[k] = Math.max(-3.5, this.h[k] * 1.8);

    // gentle smoothing
    for (let pass = 0; pass < 2; pass++) {
      const copy = this.h.slice();
      for (let j = 1; j < n; j++) for (let i = 1; i < n; i++) {
        let s = 0;
        for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) s += copy[(j + b) * vn + i + a];
        this.h[j * vn + i] = lerp(copy[j * vn + i], s / 9, 0.6);
      }
    }
    this.updateTiles(0, 0, n - 1, n - 1);

    // forests
    const fnz = new Noise(seed + 31337);
    if (template === 'flat') forest = 0;
    const thresh = 0.74 - forest * 0.34;
    for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) {
      const i = z * n + x;
      if (this.water[i]) continue;
      const avg = this.tileAvg(x, z);
      if (avg < 0.35 || avg > 5.2) continue;
      const f = fnz.fbm(x * 0.075, z * 0.075, 4);
      if (f > thresh) this.tree[i] = f > thresh + 0.08 ? 2 : 1;
      else if (f > thresh - 0.06 && hash2(x, z, seed) < 0.25) this.tree[i] = 1;
    }
    this.dirty.trees = true;
    this.dirty.roads = true;
    this.markTerrain(0, 0, n - 1, n - 1);
    this.markGround(0, 0, n - 1, n - 1);
  }

  // ------------------------------------------------------------ (de)serialisation
  toJSON() {
    const b64 = (arr) => {
      let s = '';
      const u8 = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
      const CH = 0x8000;
      for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
      return btoa(s);
    };
    const hq = new Int16Array(this.h.length);
    for (let i = 0; i < hq.length; i++) hq[i] = Math.round(this.h[i] * 1000);
    return {
      n: this.n, seed: this.seed,
      h: b64(hq), tree: b64(this.tree), road: b64(this.road), zone: b64(this.zone),
      zstyle: b64(this.zstyle), pylon: b64(this.pylon), park: b64(this.park),
    };
  }
  fromJSON(o) {
    const un = (s, Type) => {
      const bin = atob(s);
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return new Type(u8.buffer);
    };
    const hq = un(o.h, Int16Array);
    for (let i = 0; i < this.h.length; i++) this.h[i] = hq[i] / 1000;
    this.tree.set(un(o.tree, Uint8Array)); this.road.set(un(o.road, Uint8Array));
    this.zone.set(un(o.zone, Uint8Array)); this.zstyle.set(un(o.zstyle, Uint8Array));
    this.pylon.set(un(o.pylon, Uint8Array)); this.park.set(un(o.park, Uint8Array));
    this.seed = o.seed || 1;
    this.bid.fill(0); this.lot.fill(0);
    this.buildings.clear();
    this.nextId = 1;
    this.updateTiles(0, 0, this.n - 1, this.n - 1);
    this.dirty.trees = true; this.dirty.roads = true;
    this.markTerrain(0, 0, this.n - 1, this.n - 1);
    this.markGround(0, 0, this.n - 1, this.n - 1);
  }
}
