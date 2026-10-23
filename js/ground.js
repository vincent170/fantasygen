// Paints the terrain "macro" texture (8 px / tile) from heights, trees, zones and lots.
import * as THREE from '../lib/three.module.js';
import { Noise, clamp, lerp, smoothstep, hash2, mulberry32 } from './util.js';
import { ZONE_INFO, Z, isBuildZone } from './data.js';

export const LOT_KIND = { lawn: 1, pave: 2, dirt: 3, farm: 4, park: 5, sport: 6, plaza: 7, rock: 8 };

const mix3 = (a, b, t, out) => { out[0] = a[0] + (b[0] - a[0]) * t; out[1] = a[1] + (b[1] - a[1]) * t; out[2] = a[2] + (b[2] - a[2]) * t; };

const C = {
  grassA: [92, 136, 64], grassB: [116, 150, 76], dry: [150, 152, 84], forest: [58, 96, 48], floor: [84, 78, 52],
  sand: [222, 205, 160], wet: [182, 164, 120], rock: [128, 124, 114], rockD: [96, 92, 86], snow: [240, 244, 248],
  seaShallow: [120, 180, 170], seaMid: [40, 120, 140], seaDeep: [14, 52, 84], seabedSand: [196, 180, 132],
  lawn: [106, 152, 78], pave: [158, 154, 146], dirt: [148, 120, 84], plaza: [196, 186, 164], park: [92, 156, 74], sport: [78, 150, 66],
};

export class GroundPainter {
  constructor(world, scale = 8) {
    this.w = world; this.S = scale; this.n = world.n; this.size = this.n * scale;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = this.size;
    this.ctx = this.canvas.getContext('2d');
    this.img = this.ctx.createImageData(this.size, this.size);
    this.px = this.img.data;
    for (let i = 3; i < this.px.length; i += 4) this.px[i] = 255;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = true;
    // value noise tables
    const T = 256;
    this.T = T;
    this.tbl = new Float32Array(T * T);
    const nz = new Noise(4242);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) this.tbl[y * T + x] = nz.fbm(x / 22, y / 22, 4);
    this.tbl2 = new Float32Array(T * T);
    const nz2 = new Noise(9191);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) this.tbl2[y * T + x] = nz2.fbm(x / 7, y / 7, 3);
    this.dirtyRect = null;
    this.detail = this.makeDetail();
  }

  makeDetail() {
    const S = 256;
    const c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d');
    const rnd = mulberry32(5);
    g.fillStyle = '#c4c4c4'; g.fillRect(0, 0, S, S);
    // soft blotches
    for (let i = 0; i < 160; i++) {
      const x = rnd() * S, y = rnd() * S, r = 6 + rnd() * 22;
      const v = 170 + rnd() * 50;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(${v},${v},${v},0.35)`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`);
      g.fillStyle = gr;
      for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { g.save(); g.translate(ox, oy); g.fillRect(x - r, y - r, r * 2, r * 2); g.restore(); }
    }
    // grass blades
    for (let i = 0; i < 5200; i++) {
      const x = rnd() * S, y = rnd() * S, l = 2 + rnd() * 5;
      const v = rnd() < 0.5 ? 140 + rnd() * 40 : 205 + rnd() * 50;
      g.strokeStyle = `rgba(${v},${v},${v},0.55)`; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 3, y - l); g.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    tex.colorSpace = THREE.NoColorSpace;
    return tex;
  }

  macro(wx, wz) {
    const T = this.T, f = (T - 1) / this.n;
    const u = clamp(wx * f, 0, T - 1.001), v = clamp(wz * f, 0, T - 1.001);
    const i = u | 0, j = v | 0, fu = u - i, fv = v - j, t = this.tbl;
    return lerp(lerp(t[j * T + i], t[j * T + i + 1], fu), lerp(t[(j + 1) * T + i], t[(j + 1) * T + i + 1], fu), fv);
  }
  macro2(wx, wz) {
    const T = this.T, f = (T - 1) / this.n * 2.5;
    const u = (wx * f) % (T - 1.001), v = (wz * f) % (T - 1.001);
    const i = u | 0, j = v | 0, fu = u - i, fv = v - j, t = this.tbl2;
    return lerp(lerp(t[j * T + i], t[j * T + i + 1], fu), lerp(t[(j + 1) * T + i], t[(j + 1) * T + i + 1], fu), fv);
  }

  forestAt(x, z) {
    // bilinear of tile forest values (centres)
    const w = this.w, n = this.n;
    const fx = x - 0.5, fz = z - 0.5;
    const i = Math.floor(fx), j = Math.floor(fz);
    const tx = fx - i, tz = fz - j;
    const g = (a, b) => { if (a < 0 || b < 0 || a >= n || b >= n) return 0; const v = w.tree[b * n + a]; return v === 2 ? 1 : v === 1 ? 0.6 : 0; };
    return lerp(lerp(g(i, j), g(i + 1, j), tx), lerp(g(i, j + 1), g(i + 1, j + 1), tx), tz);
  }

  paintAll() { this.paintRegion(0, 0, this.n - 1, this.n - 1); }

  paintRegion(x0, z0, x1, z1) {
    const w = this.w, n = this.n, S = this.size, s = this.S, px = this.px;
    x0 = clamp(x0, 0, n - 1); z0 = clamp(z0, 0, n - 1); x1 = clamp(x1, 0, n - 1); z1 = clamp(z1, 0, n - 1);
    const col = [0, 0, 0], tmp = [0, 0, 0], tmp2 = [0, 0, 0];
    for (let tz = z0; tz <= z1; tz++) for (let tx = x0; tx <= x1; tx++) {
      const ti = tz * n + tx;
      const hc = w.tileCorners(tx, tz);
      const lot = w.lot[ti], zone = w.zone[ti], hasPark = w.park[ti];
      const zc = isBuildZone(zone) ? ZONE_INFO[zone].color : null;
      const treeV = w.tree[ti];
      // neighbour park flags for paths
      const pN = tz > 0 && (w.park[ti - n] || w.lot[ti - n] === 5), pS = tz < n - 1 && (w.park[ti + n] || w.lot[ti + n] === 5);
      const pW = tx > 0 && (w.park[ti - 1] || w.lot[ti - 1] === 5), pE = tx < n - 1 && (w.park[ti + 1] || w.lot[ti + 1] === 5);
      const isPark = hasPark || lot === 5;
      for (let j = 0; j < s; j++) {
        const fz = (j + 0.5) / s;
        for (let i = 0; i < s; i++) {
          const fx = (i + 0.5) / s;
          const wx = tx + fx, wz = tz + fz;
          // height (bilinear) and slope
          const h = lerp(lerp(hc[0], hc[1], fx), lerp(hc[2], hc[3], fx), fz);
          const slope = Math.hypot(((hc[1] - hc[0]) + (hc[3] - hc[2])) * 0.5, ((hc[2] - hc[0]) + (hc[3] - hc[1])) * 0.5);
          const m1 = this.macro(wx, wz), m2 = this.macro2(wx, wz);
          const grain = hash2(tx * s + i, tz * s + j, 17);
          // ----- base land colour
          mix3(C.grassA, C.grassB, clamp(m1 * 1.6 - 0.2, 0, 1), col);
          mix3(col, C.dry, smoothstep(0.62, 0.8, m2) * 0.5, col);
          const light = 0.93 + (m2 - 0.5) * 0.22 + (grain - 0.5) * 0.05;
          // forest floor
          if (treeV) {
            const f = this.forestAt(wx, wz);
            mix3(col, C.forest, f * 0.85, col);
            if (f > 0.4 && grain < 0.12) mix3(col, C.floor, 0.6, col);
          }
          // rock / snow by slope & altitude
          const rockT = Math.max(smoothstep(0.45, 0.95, slope), smoothstep(3.4, 4.6, h));
          if (rockT > 0) { mix3(C.rock, C.rockD, clamp(m2 * 1.5 - 0.3, 0, 1), tmp); mix3(col, tmp, rockT, col); }
          if (h > 6.2) mix3(col, C.snow, smoothstep(6.2, 7.2, h), col);
          // sand along shores
          const sandT = 1 - smoothstep(0.1, 0.34 + (m2 - 0.5) * 0.2, h);
          if (sandT > 0) { mix3(col, C.sand, sandT, col); if (h < 0.1) mix3(col, C.wet, 0.55 * (1 - smoothstep(-0.05, 0.1, h)), col); }
          let r, g, b;
          if (h < 0.0) {
            // underwater
            const d = -h;
            mix3(C.seabedSand, C.seaShallow, smoothstep(0, 0.6, d), tmp);
            mix3(tmp, C.seaMid, smoothstep(0.4, 1.4, d), tmp);
            mix3(tmp, C.seaDeep, smoothstep(1.2, 2.8, d), tmp);
            // foam at the water line
            const foam = smoothstep(-0.16, -0.01, h) * (0.55 + 0.45 * Math.sin((wx + wz) * 9 + m2 * 12));
            mix3(tmp, [235, 245, 248], clamp(foam * 0.55, 0, 1), tmp);
            r = tmp[0]; g = tmp[1]; b = tmp[2];
          } else { r = col[0]; g = col[1]; b = col[2]; }
          let lt = light;
          // ----- tile-level overlays (only on dry land)
          if (h >= 0) {
            if (lot) {
              switch (lot) {
                case 1: mix3([r, g, b], C.lawn, 0.75, tmp); r = tmp[0]; g = tmp[1]; b = tmp[2]; lt *= 1.02; break;
                case 2: {
                  const jx = (fx * 2) % 1, jz = (fz * 2) % 1;
                  const joint = (jx < 0.04 || jz < 0.04) ? 0.9 : 1;
                  r = C.pave[0] * joint * (0.96 + grain * 0.06); g = C.pave[1] * joint * (0.96 + grain * 0.06); b = C.pave[2] * joint * (0.96 + grain * 0.06); lt = 1; break;
                }
                case 3: mix3([r, g, b], C.dirt, 0.9, tmp); r = tmp[0] * (0.92 + grain * 0.14); g = tmp[1] * (0.92 + grain * 0.14); b = tmp[2] * (0.92 + grain * 0.14); lt = 1; break;
                case 4: {
                  // field rows with different crops per tile
                  const hh = hash2(tx, tz, 3);
                  const crop = hh < 0.25 ? [212, 184, 84] : hh < 0.5 ? [112, 164, 62] : hh < 0.75 ? [122, 86, 52] : [150, 178, 70];
                  const along = hash2(tx >> 1, tz >> 1, 4) < 0.5;
                  const stripe = Math.floor((along ? wx : wz) * 14) % 2;
                  const k = stripe ? 0.82 : 1.05;
                  r = crop[0] * k * (0.96 + grain * 0.08); g = crop[1] * k * (0.96 + grain * 0.08); b = crop[2] * k * (0.96 + grain * 0.08); lt = 1; break;
                }
                case 6: mix3([r, g, b], C.sport, 0.9, tmp); r = tmp[0]; g = tmp[1]; b = tmp[2]; break;
                case 7: {
                  const jx = (fx * 4) % 1, jz = (fz * 4) % 1;
                  const joint = (jx < 0.06 || jz < 0.06) ? 0.88 : 1;
                  r = C.plaza[0] * joint; g = C.plaza[1] * joint; b = C.plaza[2] * joint; lt = 1; break;
                }
                case 8: mix3(C.rock, C.rockD, m2, tmp); r = tmp[0]; g = tmp[1]; b = tmp[2]; break;
                default: break;
              }
            }
            if (isPark) {
              mix3([r, g, b], C.park, 0.85, tmp); r = tmp[0]; g = tmp[1]; b = tmp[2]; lt *= 1.04;
              // flower dots and paths
              if (grain > 0.985) { r = 230; g = 200 + grain * 40; b = 120; }
              const dx = Math.abs(fx - 0.5), dz = Math.abs(fz - 0.5);
              const pathH = dz < 0.055 && ((pW && fx < 0.5) || (pE && fx >= 0.5) || (dx < 0.055));
              const pathV = dx < 0.055 && ((pN && fz < 0.5) || (pS && fz >= 0.5) || (dz < 0.055));
              if (pathH || pathV || (dx < 0.09 && dz < 0.09 && (pW || pE || pN || pS))) { r = 205 * (0.94 + grain * 0.08); g = 190 * (0.94 + grain * 0.08); b = 150 * (0.94 + grain * 0.08); lt = 1; }
            }
            if (zc && !lot) {
              // faint zone tint + dashed edge
              const e = Math.min(fx, 1 - fx, fz, 1 - fz);
              const a = e < 0.07 ? 0.38 : 0.13;
              r = lerp(r, zc[0], a); g = lerp(g, zc[1], a); b = lerp(b, zc[2], a);
            }
          }
          const o = ((tz * s + j) * S + (tx * s + i)) * 4;
          px[o] = clamp(r * lt, 0, 255); px[o + 1] = clamp(g * lt, 0, 255); px[o + 2] = clamp(b * lt, 0, 255);
        }
      }
    }
    // mark dirty
    const d = this.dirtyRect;
    if (!d) this.dirtyRect = { x0, z0, x1, z1 };
    else { d.x0 = Math.min(d.x0, x0); d.z0 = Math.min(d.z0, z0); d.x1 = Math.max(d.x1, x1); d.z1 = Math.max(d.z1, z1); }
  }

  upload() {
    const d = this.dirtyRect;
    if (!d) return;
    const s = this.S;
    this.ctx.putImageData(this.img, 0, 0, d.x0 * s, d.z0 * s, (d.x1 - d.x0 + 1) * s, (d.z1 - d.z0 + 1) * s);
    this.texture.needsUpdate = true;
    this.dirtyRect = null;
  }
}
