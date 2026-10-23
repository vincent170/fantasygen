// Mesh builder + geometry primitives used by all procedural models.
import * as THREE from '../lib/three.module.js';

const _c = new THREE.Color();
const colCache = new Map();
/** hex -> [r,g,b] in linear space */
export function lin(hex) {
  if (Array.isArray(hex)) return hex;
  if (typeof hex === 'number') return [hex, hex, hex];
  let v = colCache.get(hex);
  if (!v) { _c.set(hex); v = [_c.r, _c.g, _c.b]; colCache.set(hex, v); }
  return v;
}

export class MB {
  constructor(atlas) {
    this.A = atlas;
    this.pos = []; this.nor = []; this.uv = []; this.uv1 = []; this.col = []; this.idx = [];
    this.vc = 0;
    this.t = null;
    this.minY = 1e9; this.maxY = -1e9;
    this.smoke = [];
  }

  setT(ox, oy, oz, rot = 0) { this.t = { ox, oy, oz, c: Math.cos(rot), s: Math.sin(rot) }; return this; }
  clearT() { this.t = null; return this; }

  vert(x, y, z, nx, ny, nz, u, v, tint, e) {
    const t = this.t;
    if (t) {
      const X = x * t.c + z * t.s + t.ox, Z = -x * t.s + z * t.c + t.oz;
      const NX = nx * t.c + nz * t.s, NZ = -nx * t.s + nz * t.c;
      x = X; z = Z; nx = NX; nz = NZ; y += t.oy;
    }
    this.pos.push(x, y, z); this.nor.push(nx, ny, nz); this.uv.push(u, v);
    if (e) this.uv1.push(e[0], e[1]); else this.uv1.push(this.A.blackUV[0], this.A.blackUV[1]);
    this.col.push(tint[0], tint[1], tint[2]);
    if (y < this.minY) this.minY = y; if (y > this.maxY) this.maxY = y;
    return this.vc++;
  }

  /** quad a(BL) b(BR) c(TR) d(TL); optional out hint flips winding if needed */
  quad(a, b, c, d, cell, tint = [1, 1, 1], opt = {}) {
    tint = lin(tint);
    let ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    let vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    let l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    // second triangle for non-planar safety
    const [lu0, lu1, lv0, lv1] = opt.uv || [0, 1, 0, 1];
    let P = [a, b, c, d];
    let UV = [[lu0, lv1], [lu1, lv1], [lu1, lv0], [lu0, lv0]];
    if (opt.out) {
      const o = opt.out;
      if (nx * o[0] + ny * o[1] + nz * o[2] < 0) {
        P = [a, d, c, b]; UV = [UV[0], UV[3], UV[2], UV[1]];
        nx = -nx; ny = -ny; nz = -nz;
      }
    }
    if (opt.flat) { nx = 0; ny = 1; nz = 0; }
    const A = this.A, lit = !!opt.lit;
    const ids = P.map((p, q) => this.vert(p[0], p[1], p[2], nx, ny, nz, ...A.uv(cell, UV[q][0], UV[q][1]), tint, A.euv(cell, UV[q][0], UV[q][1], lit)));
    this.idx.push(ids[0], ids[1], ids[2], ids[0], ids[2], ids[3]);
  }

  tri(a, b, c, cell, tint = [1, 1, 1], opt = {}) {
    tint = lin(tint);
    let ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    let vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    let P = [a, b, c], UV = opt.uv || [[0, 1], [1, 1], [0.5, 0]];
    if (opt.out) {
      const o = opt.out;
      if (nx * o[0] + ny * o[1] + nz * o[2] < 0) { P = [a, c, b]; UV = [UV[0], UV[2], UV[1]]; nx = -nx; ny = -ny; nz = -nz; }
    }
    const A = this.A;
    const ids = P.map((p, k) => this.vert(p[0], p[1], p[2], nx, ny, nz, ...A.uv(cell, UV[k][0], UV[k][1]), tint, A.euv(cell, UV[k][0], UV[k][1], false)));
    this.idx.push(ids[0], ids[1], ids[2]);
  }

  /** bilinear grid of quads each with full cell UV (tiling) */
  grid(a, b, c, d, nu, nv, cell, tint, out) {
    nu = Math.max(1, nu | 0); nv = Math.max(1, nv | 0);
    const lerp3 = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
    for (let j = 0; j < nv; j++) {
      const t0 = j / nv, t1 = (j + 1) / nv;
      const l0 = lerp3(a, d, t0), l1 = lerp3(a, d, t1), r0 = lerp3(b, c, t0), r1 = lerp3(b, c, t1);
      for (let i = 0; i < nu; i++) {
        const s0 = i / nu, s1 = (i + 1) / nu;
        this.quad(lerp3(l0, r0, s0), lerp3(l0, r0, s1), lerp3(l1, r1, s1), lerp3(l1, r1, s0), cell, tint, { out });
      }
    }
  }

  // ------------------------------------------------------------ primitives
  /**
   * Vertical wall segment. L = left start point [x,z] seen from outside, n = outward normal [nx,nz].
   */
  wall(Lx, Lz, nx, nz, len, y0, y1, cell, tint = [1, 1, 1], rep = 0.4, repV = rep) {
    const rx = nz, rz = -nx;
    const a = [Lx, y0, Lz], b = [Lx + rx * len, y0, Lz + rz * len], c = [b[0], y1, b[2]], d = [Lx, y1, Lz];
    const nu = rep ? Math.max(1, Math.round(len / rep)) : 1;
    const nv = repV ? Math.max(1, Math.round((y1 - y0) / repV)) : 1;
    this.grid(a, b, c, d, nu, nv, cell, tint, [nx, 0, nz]);
  }

  /** Facade with per-bay cells. cellFn(floor, bay, nBays, nFloors) -> {cell, tint?} */
  facade(Lx, Lz, nx, nz, len, y0, floors, fh, bayW, cellFn, nBaysOverride) {
    const rx = nz, rz = -nx;
    const nb = nBaysOverride || Math.max(1, Math.round(len / bayW));
    const bw = len / nb;
    for (let f = 0; f < floors; f++) {
      const ya = y0 + f * fh, yb = ya + fh;
      for (let i = 0; i < nb; i++) {
        const r = cellFn(f, i, nb, floors);
        const xa = Lx + rx * bw * i, za = Lz + rz * bw * i;
        const xb = xa + rx * bw, zb = za + rz * bw;
        this.quad([xa, ya, za], [xb, ya, zb], [xb, yb, zb], [xa, yb, za], r.cell, r.tint || [1, 1, 1], { out: [nx, 0, nz], lit: r.lit });
      }
    }
    return nb;
  }

  /** axis-aligned box. sides use `cell`; top uses topCell. */
  box(x0, y0, z0, x1, y1, z1, cell, tint = [1, 1, 1], o = {}) {
    const rep = o.rep === undefined ? 0.4 : o.rep;
    const topCell = o.top || cell, topTint = o.topTint || tint;
    this.wall(x0, z1, 0, 1, x1 - x0, y0, y1, cell, tint, rep);      // +z (front)
    this.wall(x1, z0, 0, -1, x1 - x0, y0, y1, cell, tint, rep);     // -z
    this.wall(x1, z1, 1, 0, z1 - z0, y0, y1, cell, tint, rep);      // +x
    this.wall(x0, z0, -1, 0, z1 - z0, y0, y1, cell, tint, rep);     // -x
    if (o.noTop !== false) {
      const nu = o.topRep ? Math.max(1, Math.round((x1 - x0) / o.topRep)) : 1;
      const nv = o.topRep ? Math.max(1, Math.round((z1 - z0) / o.topRep)) : 1;
      this.grid([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], nu, nv, topCell, topTint, [0, 1, 0]);
    }
    if (o.bottom) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], cell, tint, { out: [0, -1, 0] });
  }

  /** gable roof. ridge along 'x' or 'z'. eaves at y, rises by rise. */
  gable(x0, z0, x1, z1, y, rise, ridge, roofCell, tint, gableCell, gableTint, ov = 0.06, rep = 0.32) {
    const X0 = x0 - ov, X1 = x1 + ov, Z0 = z0 - ov, Z1 = z1 + ov;
    const gt = gableTint || tint;
    if (ridge === 'x') {
      const zm = (z0 + z1) / 2, yr = y + rise;
      const slope = Math.hypot((Z1 - zm), rise);
      const nu = Math.max(1, Math.round((X1 - X0) / 0.5)), nv = Math.max(1, Math.round(slope / rep));
      // front slope (+z)
      this.grid([X0, y, Z1], [X1, y, Z1], [X1, yr, zm], [X0, yr, zm], nu, nv, roofCell, tint, [0, 1, 1]);
      this.grid([X1, y, Z0], [X0, y, Z0], [X0, yr, zm], [X1, yr, zm], nu, nv, roofCell, tint, [0, 1, -1]);
      if (gableCell) {
        this.tri([x0, y, z1], [x0, y, z0], [x0, yr, zm], gableCell, gt, { out: [-1, 0, 0], uv: [[0, 1], [1, 1], [0.5, 0]] });
        this.tri([x1, y, z0], [x1, y, z1], [x1, yr, zm], gableCell, gt, { out: [1, 0, 0], uv: [[0, 1], [1, 1], [0.5, 0]] });
      }
    } else {
      const xm = (x0 + x1) / 2, yr = y + rise;
      const slope = Math.hypot((X1 - xm), rise);
      const nu = Math.max(1, Math.round((Z1 - Z0) / 0.5)), nv = Math.max(1, Math.round(slope / rep));
      this.grid([X1, y, Z1], [X1, y, Z0], [xm, yr, Z0], [xm, yr, Z1], nu, nv, roofCell, tint, [1, 1, 0]);
      this.grid([X0, y, Z0], [X0, y, Z1], [xm, yr, Z1], [xm, yr, Z0], nu, nv, roofCell, tint, [-1, 1, 0]);
      if (gableCell) {
        this.tri([x0, y, z1], [x1, y, z1], [xm, yr, z1], gableCell, gt, { out: [0, 0, 1], uv: [[0, 1], [1, 1], [0.5, 0]] });
        this.tri([x1, y, z0], [x0, y, z0], [xm, yr, z0], gableCell, gt, { out: [0, 0, -1], uv: [[0, 1], [1, 1], [0.5, 0]] });
      }
    }
  }

  /** proper hip roof builder (4 faces) */
  hipRoof(x0, z0, x1, z1, y, rise, roofCell, tint, ov = 0.06, ridgeInset = null) {
    const X0 = x0 - ov, X1 = x1 + ov, Z0 = z0 - ov, Z1 = z1 + ov;
    const w = X1 - X0, d = Z1 - Z0, yr = y + rise;
    const cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2;
    const half = Math.min(w, d) / 2;
    const ins = ridgeInset === null ? half : Math.min(half, ridgeInset);
    let ra, rb;
    if (w >= d) { ra = [X0 + ins, yr, cz]; rb = [X1 - ins, yr, cz]; }
    else { ra = [cx, yr, Z0 + ins]; rb = [cx, yr, Z1 - ins]; }
    const c00 = [X0, y, Z0], c10 = [X1, y, Z0], c11 = [X1, y, Z1], c01 = [X0, y, Z1];
    // faces: front (z1), back (z0), left (x0), right (x1)
    const f = (p, q, r, s, out) => {
      if (Math.abs(r[0] - s[0]) + Math.abs(r[2] - s[2]) < 1e-5) this.tri(p, q, r, roofCell, tint, { out, uv: [[0, 1], [1, 1], [0.5, 0]] });
      else this.grid(p, q, r, s, Math.max(1, Math.round(Math.hypot(q[0] - p[0], q[2] - p[2]) / 0.5)), Math.max(1, Math.round(Math.hypot(s[0] - p[0], s[1] - p[1], s[2] - p[2]) / 0.32)), roofCell, tint, out);
    };
    if (w >= d) {
      f(c01, c11, rb, ra, [0, 1, 1]);
      f(c10, c00, ra, rb, [0, 1, -1]);
      f(c00, c01, ra, ra, [-1, 1, 0]);
      f(c11, c10, rb, rb, [1, 1, 0]);
    } else {
      f(c01, c11, rb, rb, [0, 1, 1]);
      f(c10, c00, ra, ra, [0, 1, -1]);
      f(c00, c01, rb, ra, [-1, 1, 0]);
      f(c11, c10, ra, rb, [1, 1, 0]);
    }
  }

  /** pyramid / cone with n sides */
  pyramid(cx, cz, r, y0, y1, sides, cell, tint, rot = Math.PI / 4, smooth = false) {
    tint = lin(tint);
    const top = this.vert(cx, y1, cz, 0, 1, 0, ...this.A.uv(cell, 0.5, 0), tint);
    const ring = [];
    for (let i = 0; i <= sides; i++) {
      const a = rot + (i / sides) * Math.PI * 2;
      const px = cx + Math.cos(a) * r, pz = cz + Math.sin(a) * r;
      const nrm = [Math.cos(a), r / Math.max(0.01, y1 - y0) * 0.5, Math.sin(a)];
      const l = Math.hypot(...nrm);
      ring.push([px, pz, nrm[0] / l, nrm[1] / l, nrm[2] / l, i / sides]);
    }
    const idx = [];
    for (let i = 0; i < sides; i++) {
      const p = ring[i], q = ring[i + 1];
      let nx, ny, nz;
      if (smooth) { nx = p[2]; ny = p[3]; nz = p[4]; }
      else {
        const mx = (p[2] + q[2]) / 2, my = (p[3] + q[3]) / 2, mz = (p[4] + q[4]) / 2, l = Math.hypot(mx, my, mz);
        nx = mx / l; ny = my / l; nz = mz / l;
      }
      const a = this.vert(p[0], y0, p[1], nx, ny, nz, ...this.A.uv(cell, p[5] % 1, 1), tint);
      const b = this.vert(q[0], y0, q[1], smooth ? q[2] : nx, smooth ? q[3] : ny, smooth ? q[4] : nz, ...this.A.uv(cell, (p[5] + 1 / sides) % 1 || 1, 1), tint);
      const t = this.vert(cx, y1, cz, nx, ny, nz, ...this.A.uv(cell, 0.5, 0), tint);
      // winding so that normal points outwards (counter-clockwise from outside)
      this.idx.push(a, t, b);
    }
  }

  /** vertical cylinder / tapered. smooth normals. */
  cyl(cx, cz, r, y0, y1, sides, cell, tint, o = {}) {
    tint = lin(tint);
    const r1 = o.r1 === undefined ? r : o.r1;
    const A = this.A;
    const slope = (r - r1) / Math.max(0.001, y1 - y0);
    const rows = [];
    for (let i = 0; i <= sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      const c = Math.cos(a), s = Math.sin(a);
      const l = Math.hypot(1, slope);
      const u = (o.uRep || 1) * i / sides;
      const b0 = this.vert(cx + c * r, y0, cz + s * r, c / l, slope / l, s / l, ...A.uv(cell, u % 1 || (i === sides ? 1 : 0), 1), tint, cell.glow ? A.uv(cell, u % 1 || (i === sides ? 1 : 0), 1) : undefined);
      const t0 = this.vert(cx + c * r1, y1, cz + s * r1, c / l, slope / l, s / l, ...A.uv(cell, u % 1 || (i === sides ? 1 : 0), 0), tint, cell.glow ? A.uv(cell, u % 1 || (i === sides ? 1 : 0), 0) : undefined);
      rows.push([b0, t0]);
    }
    for (let i = 0; i < sides; i++) {
      const [a0, a1] = rows[i], [b0, b1] = rows[i + 1];
            this.idx.push(a0, b1, b0, a0, a1, b1);
    }
    if (o.cap !== false && r1 > 0.001) {
      const ct = this.vert(cx, y1, cz, 0, 1, 0, ...A.uv(o.capCell || cell, 0.5, 0.5), lin(o.capTint || tint));
      const ring = [];
      for (let i = 0; i <= sides; i++) {
        const a = (i / sides) * Math.PI * 2;
        ring.push(this.vert(cx + Math.cos(a) * r1, y1, cz + Math.sin(a) * r1, 0, 1, 0, ...A.uv(o.capCell || cell, 0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5), lin(o.capTint || tint)));
      }
      for (let i = 0; i < sides; i++) this.idx.push(ct, ring[i + 1], ring[i]);
    }
  }

  /** hemisphere dome */
  dome(cx, cz, r, y, h, sides, rings, cell, tint) {
    tint = lin(tint);
    const A = this.A;
    const grid = [];
    for (let j = 0; j <= rings; j++) {
      const phi = (j / rings) * Math.PI / 2;
      const rr = Math.cos(phi) * r, yy = y + Math.sin(phi) * h;
      const row = [];
      for (let i = 0; i <= sides; i++) {
        const a = (i / sides) * Math.PI * 2;
        const nx = Math.cos(a) * Math.cos(phi), nz = Math.sin(a) * Math.cos(phi), ny = Math.sin(phi) * (r / h);
        const l = Math.hypot(nx, ny, nz);
        row.push(this.vert(cx + Math.cos(a) * rr, yy, cz + Math.sin(a) * rr, nx / l, ny / l, nz / l, ...A.uv(cell, i / sides, 1 - j / rings), tint));
      }
      grid.push(row);
    }
    for (let j = 0; j < rings; j++) for (let i = 0; i < sides; i++) {
      const a = grid[j][i], b = grid[j][i + 1], c = grid[j + 1][i + 1], d = grid[j + 1][i];
      this.idx.push(a, c, b, a, d, c);
    }
  }

  /** flat horizontal quad (e.g. paving) */
  flatQuad(x0, z0, x1, z1, y, cell, tint, nu = 1, nv = 1) {
    this.grid([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], nu, nv, cell, tint, [0, 1, 0]);
  }

  // ------------------------------------------------------------ output
  build() {
    return {
      pos: new Float32Array(this.pos), nor: new Float32Array(this.nor), uv: new Float32Array(this.uv), uv1: new Float32Array(this.uv1),
      col: new Float32Array(this.col), idx: new Uint32Array(this.idx),
      minY: this.minY, maxY: this.maxY,
    };
  }
}

export function toGeometry(g) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(g.pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(g.nor, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(g.uv, 2));
  geo.setAttribute('uv1', new THREE.BufferAttribute(g.uv1, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(g.col, 3));
  geo.setIndex(new THREE.BufferAttribute(g.idx, 1));
  geo.computeBoundingSphere();
  return geo;
}
