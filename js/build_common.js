// Shared building toolkit: wall shell with facade/roof, plus porches, porticos, dormers, chimneys etc.
import { lin } from './kit.js';

const MAXB = 6;

/**
 * Build a rectangular masonry/timber body with facades and a roof.
 * o: {x0,z0,x1,z1,y0,floors,fh,bayW, m,c, trim, shutter, gl, upperWin, groundWin, groundExtra, sideWin, backWin,
 *     door:{kind,color,bay}, lit, tint, roof:{type,ridge,rise,m,c,ov,parapet,parapetCell}, rng, noSides}
 */
export function shell(b, o) {
  const A = b.A, rng = o.rng || Math.random;
  const { x0, z0, x1, z1, floors, fh } = o;
  const y0 = o.y0 || 0;
  const W = x1 - x0, D = z1 - z0;
  const tint = o.tint || [1, 1, 1];
  const bayW = o.bayW || 0.34;
  const litP = o.lit === undefined ? 0.5 : o.lit;
  const base = { m: o.m, c: o.c, wc: o.trim || '#f1eee4', sh: o.shutter || null, gl: o.gl || 'slate' };
  const wr = (win, fl, lit, extra) => A.wall(Object.assign({}, base, { w: win, fl, lit }, extra));
  const upper = o.upperWin || 'sash';
  const groundWin = o.groundWin || upper;
  const door = o.door;

  const nbFor = (len, isFront) => {
    let nb = Math.max(1, Math.round(len / bayW));
    if (isFront && door && door.bay !== 'left' && nb % 2 === 0) nb = len / (nb + 1) > 0.18 ? nb + 1 : Math.max(1, nb - 1);
    return Math.min(nb, o.maxBays || 24);
  };
  const doorIdx = (nb) => (door && door.bay === 'left' ? 0 : door && door.bay === 'right' ? nb - 1 : (nb - 1) >> 1);

  const jt = () => { const f = 1 + (rng() - 0.5) * 0.05; return [tint[0] * f, tint[1] * f, tint[2] * f]; };
  // front (+z)
  {
    const nb = nbFor(W, true);
    b.facade(x0, z1, 0, 1, W, y0, floors, fh, bayW, (f, i) => {
      const lit = rng() < litP;
      if (f === 0) {
        if (door && i === doorIdx(nb)) return { cell: wr(door.kind || 'door', 'g', lit, { dc: door.color }), tint: jt(), lit };
        return { cell: wr(groundWin, 'g', lit, o.groundExtra), tint: jt(), lit };
      }
      if (door && door.upper && i === doorIdx(nb) && f === 1) return { cell: wr(door.upper, 'u', lit), tint: jt(), lit };
      return { cell: wr(upper, 'u', lit, o.upperExtra), tint: jt(), lit };
    }, nb);
  }
  if (!o.noSides) {
    const side = o.sideWin || upper;
    const sideGround = o.sideGround || side;
    const sideFace = (Lx, Lz, nx, nz, len, win) => {
      const nb = nbFor(len, false);
      b.facade(Lx, Lz, nx, nz, len, y0, floors, fh, bayW, (f, i) => ({ cell: wr(f === 0 ? sideGround : win, f === 0 ? 'g' : 'u', false, f === 0 ? o.sideGroundExtra : null), tint: jt(), lit: rng() < litP }), nb);
    };
    sideFace(x1, z1, 1, 0, D, side);
    sideFace(x0, z0, -1, 0, D, side);
    sideFace(x1, z0, 0, -1, W, o.backWin || side);
  }

  // plinth
  if (o.plinth !== false) b.box(x0 - 0.012, y0 - 0.03, z0 - 0.012, x1 + 0.012, y0 + 0.04, z1 + 0.012, A.white, o.plinthTint || '#9a948a', { rep: 0, top: A.white });

  const yTop = y0 + floors * fh;
  let yRoof = yTop;
  const rf = o.roof;
  if (rf) {
    const roofCell = A.roof({ m: rf.m || 'shingle', c: rf.c || '#5a4f46' });
    const rt = rf.tint || [1, 1, 1];
    const ridge = rf.ridge || (W >= D ? 'x' : 'z');
    const gableCell = wr('plainw', 'u', rng() < litP, null);
    const ov = rf.ov === undefined ? 0.05 : rf.ov;
    if (rf.type === 'gable') {
      b.gable(x0, z0, x1, z1, yTop, rf.rise, ridge, roofCell, rt, gableCell, tint, ov);
      yRoof = yTop + rf.rise;
    } else if (rf.type === 'hip') {
      b.hipRoof(x0, z0, x1, z1, yTop, rf.rise, roofCell, rt, ov, rf.ridgeInset === undefined ? null : rf.ridgeInset);
      yRoof = yTop + rf.rise;
    } else if (rf.type === 'flat') {
      const ph = rf.parapet === undefined ? 0.05 : rf.parapet;
      b.flatQuad(x0, z0, x1, z1, yTop + (ph ? 0.01 : 0.005), roofCell, rt, Math.max(1, Math.round(W / 0.6)), Math.max(1, Math.round(D / 0.6)));
      if (ph > 0) parapet(b, x0, z0, x1, z1, yTop, ph, rf.parapetCell || wr('plain', 'u', false, null), rf.parapetTint || tint);
      yRoof = yTop + ph;
    } else if (rf.type === 'shed') {
      // single slope, high at back
      const hi = yTop + rf.rise;
      b.grid([x0 - ov, yTop, z1 + ov], [x1 + ov, yTop, z1 + ov], [x1 + ov, hi, z0 - ov], [x0 - ov, hi, z0 - ov], Math.max(1, Math.round(W / 0.5)), Math.max(1, Math.round(D / 0.32)), roofCell, rt, [0, 1, 0.3]);
      b.tri([x1, yTop, z1], [x1, yTop, z0], [x1, hi, z0], gableCell, tint, { out: [1, 0, 0], uv: [[0, 1], [1, 1], [1, 0]] });
      b.tri([x0, yTop, z0], [x0, yTop, z1], [x0, hi, z0], gableCell, tint, { out: [-1, 0, 0], uv: [[0, 1], [1, 1], [0, 0]] });
      b.quad([x1, yTop, z0], [x0, yTop, z0], [x0, hi, z0], [x1, hi, z0], gableCell, tint, { out: [0, 0, -1] });
      yRoof = hi;
    }
  }
  return { yTop, yRoof, W, D, wr, base };
}

export function parapet(b, x0, z0, x1, z1, y, h, cell, tint, t = 0.025) {
  b.box(x0 - 0.005, y, z1 - t, x1 + 0.005, y + h, z1 + 0.005, cell, tint, { rep: 0.4, top: b.A.white, topTint: tint });
  b.box(x0 - 0.005, y, z0 - 0.005, x1 + 0.005, y + h, z0 + t, cell, tint, { rep: 0.4, top: b.A.white, topTint: tint });
  b.box(x0 - 0.005, y, z0 + t, x0 + t, y + h, z1 - t, cell, tint, { rep: 0.4, top: b.A.white, topTint: tint });
  b.box(x1 - t, y, z0 + t, x1 + 0.005, y + h, z1 - t, cell, tint, { rep: 0.4, top: b.A.white, topTint: tint });
}

export function cornice(b, x0, z0, x1, z1, y, h = 0.03, ov = 0.035, tint = '#efe9da') {
  const w = b.A.white;
  b.box(x0 - ov, y - h, z1 - 0.02, x1 + ov, y, z1 + ov, w, tint, { rep: 0, top: w });
  b.box(x0 - ov, y - h, z0 - ov, x1 + ov, y, z0 + 0.02, w, tint, { rep: 0, top: w });
  b.box(x0 - ov, y - h, z0 + 0.02, x0 + 0.02, y, z1 - 0.02, w, tint, { rep: 0, top: w });
  b.box(x1 - 0.02, y - h, z0 + 0.02, x1 + ov, y, z1 - 0.02, w, tint, { rep: 0, top: w });
}

export function quoins(b, x0, z0, x1, z1, y0, y1, tint = '#e8e2d0') {
  const w = b.A.white;
  let k = 0;
  for (let y = y0 + 0.04; y < y1 - 0.05; y += 0.075, k++) {
    const e = k % 2 ? 0.07 : 0.05;
    for (const [cx, cz, sx, sz] of [[x0, z1, 1, -1], [x1, z1, -1, -1], [x0, z0, 1, 1], [x1, z0, -1, 1]]) {
      const ax = Math.min(cx, cx + sx * e), bx = Math.max(cx, cx + sx * e);
      const az = Math.min(cz, cz + sz * e), bz = Math.max(cz, cz + sz * e);
      b.box(ax - (sx > 0 ? 0.008 : 0), y, az - (sz > 0 ? 0.008 : 0), bx + (sx < 0 ? 0.008 : 0), y + 0.06, bz + (sz < 0 ? 0.008 : 0), w, tint, { rep: 0, top: w });
    }
  }
}

export function chimney(b, cx, cz, yBase, yTop, size = 0.075, brick = '#8a4b38') {
  const A = b.A;
  const cell = A.wall({ m: 'brick', c: brick, w: 'none' });
  b.box(cx - size / 2, yBase, cz - size / 2, cx + size / 2, yTop, cz + size / 2, cell, [1, 1, 1], { rep: 0.2, top: A.white, topTint: '#3b2f2a' });
  b.box(cx - size / 2 - 0.012, yTop - 0.012, cz - size / 2 - 0.012, cx + size / 2 + 0.012, yTop + 0.018, cz + size / 2 + 0.012, A.white, '#cfc9bb', { rep: 0, top: A.white });
}

export function chimneyPair(b, cx, cz, yBase, yTop, gap, brick) {
  chimney(b, cx - gap, cz, yBase, yTop, 0.07, brick);
  chimney(b, cx + gap, cz, yBase, yTop, 0.07, brick);
}

/** Porch / veranda / portico along a front wall.  z = front wall z. Returns y of roof. */
export function porch(b, o) {
  const A = b.A, w = A.white;
  const { x0, x1, z, depth, h } = o;
  const col = o.color || '#f3f0e6';
  const y0 = o.y0 || 0;
  const roofCell = o.roofCell || A.roof({ m: 'shingle', c: '#5a4f46' });
  // floor
  b.box(x0, y0, z, x1, y0 + 0.05, z + depth, w, o.floorTint || '#b9a98d', { rep: 0, top: w });
  const n = o.cols || Math.max(2, Math.round((x1 - x0) / 0.3) + 1);
  const r = o.round ? 0.016 : 0.014;
  for (let i = 0; i < n; i++) {
    const cx = x0 + 0.02 + ((x1 - x0 - 0.04) * i) / (n - 1);
    const zc = z + depth - 0.025;
    if (o.round) b.cyl(cx, zc, r, y0 + 0.05, y0 + h, 8, w, col, { cap: false });
    else b.box(cx - 0.014, y0 + 0.05, zc - 0.014, cx + 0.014, y0 + h, zc + 0.014, w, col, { rep: 0, top: w });
    if (o.round) b.box(cx - 0.024, y0 + h - 0.014, zc - 0.024, cx + 0.024, y0 + h, zc + 0.024, w, col, { rep: 0, top: w });
  }
  if (o.rail) {
    const rc = o.railColor || col;
    b.box(x0, y0 + 0.13, z + depth - 0.03, x1, y0 + 0.145, z + depth - 0.015, w, rc, { rep: 0, top: w });
    if (!o.iron) b.box(x0, y0 + 0.07, z + depth - 0.03, x1, y0 + 0.08, z + depth - 0.015, w, rc, { rep: 0, top: w });
    else {
      const bal = Math.max(2, Math.round((x1 - x0) / 0.04));
      for (let i = 0; i <= bal; i++) { const bx = x0 + ((x1 - x0) * i) / bal; b.box(bx - 0.004, y0 + 0.05, z + depth - 0.026, bx + 0.004, y0 + 0.13, z + depth - 0.018, w, rc, { rep: 0, top: w }); }
    }
  }
  // roof
  const yr = y0 + h;
  if (o.roofType === 'gable') {
    b.gable(x0 - 0.02, z, x1 + 0.02, z + depth + 0.03, yr, o.rise || 0.12, 'z', roofCell, o.roofTint || [1, 1, 1], w, col, 0.0);
  } else if (o.roofType === 'flat') {
    b.box(x0 - 0.02, yr, z, x1 + 0.02, yr + 0.03, z + depth + 0.03, w, o.roofColor || col, { rep: 0, top: roofCell, topTint: o.roofTint || [1, 1, 1], topRep: 0.4 });
  } else {
    // shed slope
    b.grid([x0 - 0.02, yr, z + depth + 0.04], [x1 + 0.02, yr, z + depth + 0.04], [x1 + 0.02, yr + 0.09, z], [x0 - 0.02, yr + 0.09, z],
      Math.max(1, Math.round((x1 - x0) / 0.5)), 1, roofCell, o.roofTint || [1, 1, 1], [0, 1, 1]);
    b.tri([x1 + 0.02, yr, z + depth + 0.04], [x1 + 0.02, yr + 0.09, z], [x1 + 0.02, yr, z], w, col, { out: [1, 0, 0] });
    b.tri([x0 - 0.02, yr, z + depth + 0.04], [x0 - 0.02, yr + 0.09, z], [x0 - 0.02, yr, z], w, col, { out: [-1, 0, 0] });
  }
  // steps
  if (o.steps !== false) b.box((x0 + x1) / 2 - 0.07, y0, z + depth, (x0 + x1) / 2 + 0.07, y0 + 0.03, z + depth + 0.05, w, '#b8b2a5', { rep: 0, top: w });
}

/** Classical portico w/ pediment: x range, z = wall, depth */
export function portico(b, o) {
  const A = b.A, w = A.white;
  const { x0, x1, z, depth, h } = o;
  const col = o.color || '#f1eee3';
  const y0 = o.y0 || 0;
  b.box(x0 - 0.02, y0, z, x1 + 0.02, y0 + 0.05, z + depth + 0.04, w, '#b8b2a5', { rep: 0, top: w });
  b.box(x0 - 0.05, y0, z + depth + 0.04, x1 + 0.05, y0 + 0.025, z + depth + 0.09, w, '#b8b2a5', { rep: 0, top: w });
  const n = o.cols || 4;
  const rc = o.r || 0.022;
  for (let i = 0; i < n; i++) {
    const cx = x0 + 0.03 + ((x1 - x0 - 0.06) * i) / (n - 1);
    b.cyl(cx, z + depth - 0.01, rc, y0 + 0.05, y0 + h - 0.025, 10, w, col, { cap: false });
    b.box(cx - rc * 1.4, y0 + 0.05, z + depth - 0.01 - rc * 1.4, cx + rc * 1.4, y0 + 0.065, z + depth - 0.01 + rc * 1.4, w, col, { rep: 0, top: w });
    b.box(cx - rc * 1.5, y0 + h - 0.04, z + depth - 0.01 - rc * 1.5, cx + rc * 1.5, y0 + h - 0.015, z + depth - 0.01 + rc * 1.5, w, col, { rep: 0, top: w });
  }
  // entablature
  b.box(x0 - 0.02, y0 + h - 0.025, z, x1 + 0.02, y0 + h + 0.02, z + depth + 0.02, w, col, { rep: 0, top: w });
  if (o.pediment !== false) {
    const rise = o.rise || (x1 - x0) * 0.17;
    const gc = A.wall({ m: 'plain', c: col, w: 'none' });
    b.gable(x0 - 0.02, z, x1 + 0.02, z + depth + 0.02, y0 + h + 0.02, rise, 'z', o.roofCell || A.roof({ m: 'slate', c: '#59616b' }), [1, 1, 1], gc, col, 0.0);
  }
  if (o.steps !== false) {
    for (let k = 0; k < 3; k++) b.box(x0 + 0.04 - k * 0.012, y0 - k * 0.012 * 0, z + depth + 0.04 + k * 0.025, x1 - 0.04 + k * 0.012, y0 + 0.02 - k * 0.0, z + depth + 0.065 + k * 0.025, w, '#aaa49a', { rep: 0, top: w });
  }
}

export function dormer(b, cx, zFront, yRoofAtFront, o) {
  const A = b.A, w = A.white;
  const ww = o.w || 0.13, hh = o.h || 0.13, dd = o.d || 0.13;
  const wallCell = A.wall({ m: o.m, c: o.c, w: o.win || 'small', wc: o.trim || '#f1eee4', sh: null, gl: o.gl || 'slate', fl: 'u', lit: o.lit });
  const side = A.wall({ m: o.m, c: o.c, w: 'none' });
  b.wall(cx - ww / 2, zFront, 0, 1, ww, yRoofAtFront, yRoofAtFront + hh, wallCell, [1, 1, 1], 0);
  b.wall(cx + ww / 2, zFront, 1, 0, dd, yRoofAtFront, yRoofAtFront + hh, side, [1, 1, 1], 0.2);
  b.wall(cx - ww / 2, zFront - dd, -1, 0, dd, yRoofAtFront, yRoofAtFront + hh, side, [1, 1, 1], 0.2);
  b.gable(cx - ww / 2, zFront - dd, cx + ww / 2, zFront, yRoofAtFront + hh, ww * 0.45, 'z', A.roof({ m: o.rm || 'shingle', c: o.rc || '#5a4f46' }), [1, 1, 1], null, null, 0.025);
}

export function awning(b, x0, x1, z, y, depth, color, drop = 0.05) {
  const A = b.A;
  const cell = A.decal('awning:' + color, (ctx, S) => {
    ctx.fillStyle = color; ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    for (let x = 0; x < S; x += 16) ctx.fillRect(x, 0, 8, S);
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(0, S - 5, S, 5);
  });
  b.grid([x0, y - drop, z + depth], [x1, y - drop, z + depth], [x1, y, z], [x0, y, z], Math.max(1, Math.round((x1 - x0) / 0.28)), 1, cell, [1, 1, 1], [0, 0.6, 1]);
}

export function balcony(b, x0, x1, z, y, depth, o = {}) {
  const w = b.A.white, col = o.color || '#2b2b2e';
  b.box(x0, y, z, x1, y + 0.025, z + depth, w, o.slab || '#9a948a', { rep: 0, top: w });
  const rail = (ax, az, bx, bz) => b.box(Math.min(ax, bx) - 0.004, y + 0.025, Math.min(az, bz) - 0.004, Math.max(ax, bx) + 0.004, y + 0.115, Math.max(az, bz) + 0.004, w, col, { rep: 0, top: w });
  b.box(x0, y + 0.1, z + depth - 0.008, x1, y + 0.112, z + depth, w, col, { rep: 0, top: w });
  const n = Math.max(2, Math.round((x1 - x0) / 0.035));
  for (let i = 0; i <= n; i++) { const bx = x0 + ((x1 - x0) * i) / n; b.box(bx - 0.003, y + 0.025, z + depth - 0.008, bx + 0.003, y + 0.1, z + depth, w, col, { rep: 0, top: w }); }
}

export function fence(b, x0, z0, x1, z1, h = 0.07, tint = '#f2efe6') {
  const A = b.A;
  const cell = A.decal('picket', (ctx, S) => {
    ctx.fillStyle = '#a9aaa2'; ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = '#ffffff';
    for (let x = 2; x < S; x += 8) ctx.fillRect(x, 4, 5, S - 4);
    ctx.fillRect(0, 14, S, 4); ctx.fillRect(0, S - 20, S, 4);
  });
  const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
  if (len < 0.01) return;
  // two-sided: one wall from (x0,z0) to (x1,z1) and its mirror; wall() runs along (nz, -nx)
  const nx = -dz / len, nz = dx / len;
  b.wall(x0, z0, nx, nz, len, 0, h, cell, tint, 0.16, 0);
  b.wall(x1, z1, -nx, -nz, len, 0, h, cell, tint, 0.16, 0);
}

export function bush(b, x, z, s, color = '#3f7a3a', y = 0) {
  b.dome(x, z, s, y, s * 0.85, 7, 2, b.A.white, color);
}

export function tree(b, x, z, h, kind, color, rng) {
  const A = b.A, w = A.white;
  const tr = h * 0.045;
  b.cyl(x, z, tr, 0, h * 0.5, 5, w, '#5b4330', { r1: tr * 0.7, cap: false });
  if (kind === 'pine') {
    b.pyramid(x, z, h * 0.26, h * 0.18, h, 7, w, color, 0, true);
    b.pyramid(x, z, h * 0.2, h * 0.5, h * 1.05, 7, w, color, 0.3, true);
  } else {
    b.dome(x, z, h * 0.32, h * 0.4, h * 0.45, 7, 3, w, color);
  }
}

/** a few shrubs/trees in the yard avoiding the footprint rect */
export function yard(b, rng, lw, ld, avoid, o = {}) {
  const greens = o.greens || ['#4a8a3e', '#3f7a3a', '#5a9a46', '#3a6f35'];
  const n = o.n === undefined ? 2 + ((rng() * 3) | 0) : o.n;
  for (let i = 0; i < n; i++) {
    const x = 0.1 + rng() * (lw - 0.2), z = 0.08 + rng() * (ld - 0.16);
    if (x > avoid.x0 - 0.04 && x < avoid.x1 + 0.04 && z > avoid.z0 - 0.04 && z < avoid.z1 + 0.04) continue;
    if (o.keepClear && x > o.keepClear.x0 && x < o.keepClear.x1 && z > o.keepClear.z0) continue;
    const g = greens[(rng() * greens.length) | 0];
    if (rng() < (o.treeP === undefined ? 0.45 : o.treeP)) tree(b, x, z, 0.28 + rng() * 0.18, o.pine ? 'pine' : 'round', g, rng);
    else bush(b, x, z, 0.04 + rng() * 0.04, g);
  }
}

/** simple stone path from door centre to lot edge */
export function path(b, cx, zFrom, zTo, w = 0.07, tint = '#c9c1af') {
  b.flatQuad(cx - w / 2, zFrom, cx + w / 2, zTo, 0.012, b.A.white, tint);
}

export function hvac(b, x, z, y, s = 0.07, tint = '#aeb4b8') {
  b.box(x, y, z, x + s, y + s * 0.6, z + s, b.A.white, tint, { rep: 0, top: b.A.white });
}

/** rooftop water tank on legs */
export function waterTank(b, x, z, y, r = 0.08, tint = '#6b4a35') {
  const w = b.A.white;
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(x + dx * r * 0.7 - 0.006, y, z + dz * r * 0.7 - 0.006, x + dx * r * 0.7 + 0.006, y + r * 1.1, z + dz * r * 0.7 + 0.006, w, '#3a3a3a', { rep: 0, top: w });
  b.cyl(x, z, r, y + r * 1.1, y + r * 2.5, 10, w, tint, { r1: r, cap: true });
  b.pyramid(x, z, r * 1.1, y + r * 2.5, y + r * 3.1, 10, w, '#3d3d40', 0, false);
}

export function smokestack(b, x, z, y0, y1, r, brick = '#8b4a38', banded = true) {
  const A = b.A;
  const cell = A.wall({ m: 'brick', c: brick, w: 'none' });
  b.cyl(x, z, r, y0, y1, 10, cell, [1, 1, 1], { r1: r * 0.72, cap: false, uRep: 3 });
  b.cyl(x, z, r * 0.78, y1 - 0.001, y1 + 0.03, 10, A.white, '#2f2f30', { r1: r * 0.74, cap: false });
  if (banded) b.cyl(x, z, r * 0.8, y1 - 0.06, y1 - 0.03, 10, A.white, '#d9d4c8', { cap: false });
  if (b.smoke) b.smoke.push([x, y1 + 0.05, z]);
}
