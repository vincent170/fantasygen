// Extra house designs per style (Cape Cod, saltbox, gambrel, shotgun, bungalow, ranch, A-frame…).
// They are mixed in with the original designs so streets of the same style stay varied.
import { pick } from './util.js';
import { shell, cornice, quoins, chimney, chimneyPair, porch, portico, dormer, balcony, fence, tree, path } from './build_common.js';
import { dressLot, bayWindow, slopeSolar, flatSolar, dish, car, pool, CAR_COLS } from './build_props.js';
import { ZONE_GEN, PAL } from './build_zone.js';

const { COL, GEO, SOU, AMER, MOD } = PAL;
const PASTEL = ['#f4c7c3', '#c9e4de', '#f7e1a0', '#cfd8f0', '#e9c8e8', '#bfe3c0', '#f6d5b0', '#d0e8f2'];
const roofY = (yTop, rise, halfD, inset) => yTop + rise * (inset / halfD);

// ====================================================================== COLONIAL
function capeCod({ b, rng, lw, ld, level }) {
  const A = b.A;
  const wide = lw > 1;
  const bw = wide ? 1.0 : 0.66, bd = ld > 1 ? 0.6 : 0.46;
  const x0 = wide ? 0.14 : (lw - bw) / 2, x1 = x0 + bw;
  const z1 = ld - 0.24, z0 = z1 - bd;
  const c = pick(rng, ['#f3efe2', '#d8dfe2', '#c4b9a4', '#e9e3d4', '#b5c4c9', '#a7a7a1']);
  const m = rng() < 0.35 ? 'wood' : 'clap';
  const sh = pick(rng, COL.shut), rc = pick(rng, COL.roof);
  const rise = 0.34;
  const s = shell(b, { rng, x0, z0, x1, z1, floors: 1, fh: 0.27, bayW: 0.24, m, c: m === 'wood' ? pick(rng, ['#8f7a62', '#a69580', '#7d6d5d']) : c, trim: '#f7f5ee', shutter: sh, upperWin: 'small', door: { kind: 'door', color: pick(rng, ['#7a2f2a', '#2a3b55', '#2f5a3d', '#d9b34a']) }, roof: { type: 'gable', ridge: 'x', rise, m: 'shingle', c: rc }, lit: 0.5 });
  const nd = wide ? 3 : 2;
  for (let i = 0; i < nd; i++) dormer(b, x0 + bw * (i + 1) / (nd + 1), z1 - 0.07, roofY(s.yTop, rise, bd / 2 + 0.05, 0.12), { m: 'clap', c: '#f7f5ee', trim: '#f7f5ee', rm: 'shingle', rc, lit: rng() < 0.5, w: 0.11, h: 0.11 });
  chimney(b, (x0 + x1) / 2, (z0 + z1) / 2, s.yTop, s.yRoof + 0.06, 0.09);
  if (wide && level >= 2) {
    // breezeway + garage wing
    shell(b, { rng, x0: x1, x1: Math.min(lw - 0.05, x1 + 0.12), z0: z0 + 0.12, z1: z1 - 0.1, floors: 1, fh: 0.22, bayW: 0.2, m, c, trim: '#f7f5ee', upperWin: 'small', roof: { type: 'gable', ridge: 'x', rise: 0.1, m: 'shingle', c: rc }, lit: 0.3 });
  }
  path(b, (x0 + x1) / 2, z1 + 0.01, ld - 0.02, 0.07, '#b9b2a2');
  fence(b, 0.03, ld - 0.03, (x0 + x1) / 2 - 0.06, ld - 0.03, 0.055); fence(b, (x0 + x1) / 2 + 0.06, ld - 0.03, lw - 0.03, ld - 0.03, 0.055);
  dressLot(b, rng, lw, ld, { x0, x1, z0, z1 }, { level, mailbox: false, front: 'beds' });
  return { floors: 1.5, h: s.yRoof + 0.1 };
}

function saltbox({ b, rng, lw, ld, level }) {
  const A = b.A, w = A.white;
  const wide = lw > 1;
  const bw = wide ? 1.05 : 0.7, bd = ld > 1 ? 0.66 : 0.5;
  const x0 = (lw - bw) / 2, x1 = x0 + bw;
  const z1 = ld - 0.22, z0 = z1 - bd;
  const fh = 0.26;
  const c = pick(rng, ['#7a3a30', '#8d8370', '#6e6658', '#a39a8a', '#4f4a44', '#efe9d6']);
  const sh = pick(rng, COL.shut), rc = pick(rng, ['#4a4440', '#5a5048', '#3e3a37']);
  const trim = '#efe6d2';
  // full-height front half, single-storey lean-to at the back under one long roof
  const zr = z1 - bd * 0.42, rise = 0.24;
  shell(b, { rng, x0, z0, x1, z1, floors: 1, fh, bayW: 0.26, m: 'clap', c, trim, shutter: sh, upperWin: 'small', door: { kind: 'door', color: '#3a2a20' }, roof: null, noSides: false, lit: 0.45 });
  shell(b, { rng, x0, z0: zr, x1, z1, y0: fh, floors: 1, fh, bayW: 0.26, m: 'clap', c, trim, shutter: sh, upperWin: 'small', roof: null, noSides: true, plinth: false, lit: 0.45 });
  const roofCell = A.roof({ m: 'shingle', c: rc }), ov = 0.04;
  const yT = 2 * fh, yR = yT + rise;
  b.grid([x0 - ov, yT, z1 + ov], [x1 + ov, yT, z1 + ov], [x1 + ov, yR, zr], [x0 - ov, yR, zr], 3, 2, roofCell, [1, 1, 1], [0, 1, 1]);
  b.grid([x1 + ov, fh - 0.02, z0 - ov], [x0 - ov, fh - 0.02, z0 - ov], [x0 - ov, yR, zr], [x1 + ov, yR, zr], 3, 3, roofCell, [1, 1, 1], [0, 1, -1]);
  const gc = A.wall({ m: 'clap', c, w: 'none' });
  for (const [x, sx] of [[x0, -1], [x1, 1]]) {
    b.quad([x, fh, z1], [x, yT, z1], [x, yR, zr], [x, fh, z0], gc, [1, 1, 1], { out: [sx, 0, 0] });
    b.tri([x, fh, z0], [x, yR, zr], [x, fh - 0.02, z0], gc, [1, 1, 1], { out: [sx, 0, 0] });
  }
  chimney(b, (x0 + x1) / 2, zr, yT, yR + 0.1, 0.11, '#7a4a3a');
  path(b, (x0 + x1) / 2, z1, ld - 0.02, 0.07, '#a39b8a');
  dressLot(b, rng, lw, ld, { x0, x1, z0, z1 }, { level, front: 'lawn', fence: rng() < 0.4, fenceTint: '#e8e2d0' });
  return { floors: 1.8, h: yR + 0.1 };
}

function dutchColonial({ b, rng, lw, ld, level }) {
  const A = b.A;
  const wide = lw > 1;
  const bw = wide ? 1.1 : 0.72, bd = ld > 1 ? 0.64 : 0.5;
  const x0 = (lw - bw) / 2 - (wide ? 0.1 : 0), x1 = x0 + bw;
  const z1 = ld - 0.24, z0 = z1 - bd;
  const c = pick(rng, ['#e9d9b0', '#c8b48c', '#d8dfe2', '#f3efe2', '#a5523b']);
  const m = c === '#a5523b' ? 'brick' : rng() < 0.4 ? 'stone' : 'clap';
  const rc = pick(rng, COL.roof), sh = pick(rng, COL.shut);
  const s = shell(b, { rng, x0, z0, x1, z1, floors: 1, fh: 0.28, bayW: 0.26, m, c: m === 'stone' ? '#cfc6b0' : c, trim: '#f4f1e7', shutter: sh, upperWin: 'sash', door: { kind: 'door', color: sh }, roof: null, lit: 0.5 });
  const rise = 0.36;
  b.gambrel(x0, z0, x1, z1, s.yTop, rise, A.roof({ m: 'shingle', c: rc }), [1, 1, 1], A.wall({ m: 'clap', c: m === 'clap' ? c : '#f1ebdc', w: 'small', wc: '#f4f1e7', sh, fl: 'u' }), [1, 1, 1], 0.05);
  // long shed dormer across the front of the gambrel
  const dx0 = x0 + 0.1, dx1 = x1 - 0.1, dz = z1 - bd * 0.17 + 0.01;
  b.wall(dx0, dz, 0, 1, dx1 - dx0, s.yTop + 0.06, s.yTop + 0.2, A.wall({ m: 'clap', c: '#f1ebdc', w: 'small', wc: '#f4f1e7', fl: 'u', lit: rng() < 0.5 }), [1, 1, 1], 0.2, 0);
  b.box(dx0 - 0.02, s.yTop + 0.2, dz - 0.12, dx1 + 0.02, s.yTop + 0.215, dz + 0.02, A.white, '#f4f1e7', { rep: 0, top: A.roof({ m: 'shingle', c: rc }) });
  porch(b, { x0: (x0 + x1) / 2 - 0.12, x1: (x0 + x1) / 2 + 0.12, z: z1, depth: 0.09, h: 0.25, cols: 2, color: '#f4f1e7', roofType: 'gable', rise: 0.07, roofCell: A.roof({ m: 'shingle', c: rc }) });
  chimney(b, x0 + 0.1, (z0 + z1) / 2, s.yTop, s.yTop + rise + 0.08, 0.08);
  if (wide) shell(b, { rng, x0: x1, x1: Math.min(lw - 0.04, x1 + 0.34), z0: z0 + 0.1, z1: z1 - 0.06, floors: 1, fh: 0.24, bayW: 0.3, m, c: m === 'stone' ? '#cfc6b0' : c, trim: '#f4f1e7', upperWin: 'garage', groundWin: 'garage', roof: { type: 'gable', ridge: 'x', rise: 0.12, m: 'shingle', c: rc }, lit: 0 });
  path(b, (x0 + x1) / 2, z1 + 0.09, ld - 0.02, 0.07);
  dressLot(b, rng, lw, ld, { x0, x1: wide ? Math.min(lw - 0.04, x1 + 0.34) : x1, z0, z1 }, { level, drive: wide ? 'right' : 'auto', front: pick(rng, ['beds', 'hedge']) });
  return { floors: 2, h: s.yTop + rise + 0.1 };
}

function garrison({ b, rng, lw, ld, level }) {
  const A = b.A;
  const wide = lw > 1;
  const bw = wide ? 1.0 : 0.7, bd = ld > 1 ? 0.6 : 0.46;
  const x0 = (lw - bw) / 2, x1 = x0 + bw;
  const z1 = ld - 0.26, z0 = z1 - bd;
  const c = pick(rng, COL.clap), sh = pick(rng, COL.shut), rc = pick(rng, COL.roof);
  const fh = 0.27, ov = 0.045;
  shell(b, { rng, x0, z0, x1, z1, floors: 1, fh, bayW: 0.28, m: 'clap', c, trim: '#f4f1e7', shutter: sh, upperWin: 'sash', door: { kind: 'door', color: sh }, roof: null, lit: 0.5 });
  const s = shell(b, { rng, x0: x0 - 0.01, z0, x1: x1 + 0.01, z1: z1 + ov, y0: fh, floors: 1, fh, bayW: 0.28, m: 'clap', c, trim: '#f4f1e7', shutter: sh, upperWin: 'sash', plinth: false, roof: { type: 'gable', ridge: 'x', rise: 0.25, m: 'shingle', c: rc }, lit: 0.5 });
  // carved pendants under the overhang
  for (const x of [x0 + 0.02, x1 - 0.02]) b.box(x - 0.012, fh - 0.04, z1 + ov - 0.02, x + 0.012, fh, z1 + ov, A.white, '#5a4a3a', { rep: 0, top: A.white });
  b.box(x0 - 0.01, fh - 0.012, z1, x1 + 0.01, fh, z1 + ov, A.white, '#f4f1e7', { rep: 0, top: A.white });
  chimneyPair(b, (x0 + x1) / 2, (z0 + z1) / 2, s.yTop, s.yRoof + 0.07, 0.12, '#8a4b38');
  path(b, (x0 + x1) / 2, z1 + 0.01, ld - 0.02, 0.07);
  dressLot(b, rng, lw, ld, { x0, x1, z0, z1: z1 + ov }, { level, front: 'beds', fence: level >= 3, fenceTint: '#f2efe6' });
  return { floors: 2.1, h: s.yRoof + 0.1 };
}

// ====================================================================== GEORGIAN
function thatchCottage({ b, rng, lw, ld, level }) {
  const A = b.A;
  const bw = lw > 1 ? 0.95 : 0.64, bd = ld > 1 ? 0.5 : 0.42;
  const x0 = (lw - bw) / 2, x1 = x0 + bw;
  const z1 = ld - 0.26, z0 = z1 - bd;
  const c = pick(rng, ['#f2ece0', '#efe3c4', '#e8dcc8', '#f6f1e6']);
  const s = shell(b, { rng, x0, z0, x1, z1, floors: 1, fh: 0.25, bayW: 0.24, m: 'stucco', c, trim: '#f8f6ef', upperWin: 'small', door: { kind: 'door', color: pick(rng, ['#2f5a3d', '#6a1f1f', '#2a3b55']) }, roof: { type: 'gable', ridge: 'x', rise: 0.36, m: 'thatch', c: pick(rng, ['#b8955a', '#a8874e', '#c4a265']), ov: 0.07 }, lit: 0.5 });
  for (const t of [0.3, 0.7]) dormer(b, x0 + bw * t, z1 - 0.05, roofY(s.yTop, 0.36, bd / 2 + 0.07, 0.12), { m: 'stucco', c, trim: '#f8f6ef', rm: 'thatch', rc: '#b8955a', w: 0.1, h: 0.09, lit: rng() < 0.4 });
  chimney(b, x1 - 0.06, (z0 + z1) / 2, s.yTop, s.yRoof + 0.08, 0.09, '#9a6a4a');
  // rose arch over the gate and a cottage garden
  const cx = (x0 + x1) / 2;
  b.box(cx - 0.06, 0, ld - 0.05, cx - 0.05, 0.12, ld - 0.04, A.white, '#5a4330', { rep: 0 }); b.box(cx + 0.05, 0, ld - 0.05, cx + 0.06, 0.12, ld - 0.04, A.white, '#5a4330', { rep: 0 });
  b.box(cx - 0.065, 0.11, ld - 0.06, cx + 0.065, 0.135, ld - 0.03, A.roof({ m: 'grass', c: '#4a7a3a' }), '#ffffff', { rep: 0, top: A.roof({ m: 'grass', c: '#4a7a3a' }) });
  path(b, cx, z1, ld - 0.02, 0.06, '#c9bfa9');
  dressLot(b, rng, lw, ld, { x0, x1, z0, z1 }, { level, drive: false, front: 'beds', mailbox: false, extras: 2, greens: ['#4a7a3a', '#5a8a46', '#3a6a35'] });
  const g = '#3d6e37';
  b.box(0.03, 0, ld - 0.05, cx - 0.07, 0.05, ld - 0.02, A.roof({ m: 'grass', c: g }), '#ffffff', { rep: 0.12, top: A.roof({ m: 'grass', c: g }) });
  b.box(cx + 0.07, 0, ld - 0.05, lw - 0.03, 0.05, ld - 0.02, A.roof({ m: 'grass', c: g }), '#ffffff', { rep: 0.12, top: A.roof({ m: 'grass', c: g }) });
  return { floors: 1.4, h: s.yRoof + 0.1 };
}

function regencyVilla({ b, rng, lw, ld, level }) {
  const A = b.A;
  const wide = lw > 1;
  const bw = wide ? 1.05 : 0.7, bd = ld > 1 ? 0.62 : 0.48;
  const x0 = (lw - bw) / 2, x1 = x0 + bw;
  const z1 = ld - 0.3, z0 = Math.max(0.08, z1 - bd);
  const floors = level >= 3 ? 3 : 2, fh = 0.28;
  const c = pick(rng, ['#f2ead8', '#efe6cf', '#e8e2d6', '#f4efe4', '#e6dcc3']);
  const roofC = pick(rng, GEO.slate);
  const s = shell(b, { rng, x0, z0, x1, z1, floors, fh, bayW: 0.26, m: 'stucco', c, trim: '#fbf9f2', upperWin: 'tall', door: { kind: 'door', color: pick(rng, GEO.door) }, roof: { type: 'hip', rise: 0.14, m: 'slate', c: roofC, ridgeInset: 0.1, ov: 0.07 }, lit: 0.5 });
  cornice(b, x0, z0, x1, z1, s.yTop, 0.035, 0.05, '#fbf9f2');
  const cx = (x0 + x1) / 2;
  // bow windows either side of the porch
  const bowCell = A.wall({ m: 'stucco', c, w: 'tall', wc: '#fbf9f2', fl: 'u', lit: rng() < 0.5 });
  if (wide) for (const bx of [x0 + 0.2, x1 - 0.2]) bayWindow(b, bx, z1, 0.03, 0.22, fh * 2 - 0.06, 0.07, bowCell, A.roof({ m: 'copper', c: '#5e8a74' }), '#fbf9f2');
  porch(b, { x0: cx - 0.1, x1: cx + 0.1, z: z1, depth: 0.1, h: fh * 0.95, cols: 2, round: true, color: '#fbf9f2', roofType: 'flat', roofColor: '#fbf9f2', roofCell: A.roof({ m: 'copper', c: '#5e8a74' }) });
  balcony(b, x0 + 0.05, x1 - 0.05, z1, fh + 0.02, 0.06, { color: '#26272a', slab: '#e8e2d0' });
  chimneyPair(b, x0 + 0.08, (z0 + z1) / 2, s.yTop, s.yRoof + 0.06, 0, '#d8cfbf');
  chimneyPair(b, x1 - 0.08, (z0 + z1) / 2, s.yTop, s.yRoof + 0.06, 0, '#d8cfbf');
  path(b, cx, z1 + 0.1, ld - 0.02, 0.09, '#d8d0bc');
  fence(b, 0.04, ld - 0.04, cx - 0.1, ld - 0.04, 0.06, '#2a2a2c'); fence(b, cx + 0.1, ld - 0.04, lw - 0.04, ld - 0.04, 0.06, '#2a2a2c');
  dressLot(b, rng, lw, ld, { x0, x1, z0, z1: z1 + 0.08 }, { level, front: 'hedge', mailbox: false, pool: level >= 3 && ld > 1 });
  return { floors: floors + 0.2, h: s.yRoof + 0.1 };
}

function semiPair({ b, rng, lw, ld, level }) {
  // two mirrored brick houses sharing a party wall
  const A = b.A;
  const bw = lw > 1 ? 1.2 : 0.8, bd = ld > 1 ? 0.56 : 0.44;
  const x0 = (lw - bw) / 2, x1 = x0 + bw, xm = (x0 + x1) / 2;
  const z1 = ld - 0.24, z0 = z1 - bd;
  const brick = pick(rng, GEO.brick), rc = pick(rng, GEO.slate);
  const floors = level >= 2 ? 3 : 2, fh = 0.27;
  const s = shell(b, { rng, x0, z0, x1, z1, floors, fh, bayW: 0.2, m: 'brick', c: brick, trim: '#f2efe4', upperWin: 'sash', door: null, roof: { type: 'hip', rise: 0.2, m: 'slate', c: rc, ridgeInset: 0.15 }, lit: 0.5 });
  cornice(b, x0, z0, x1, z1, s.yTop, 0.028, 0.025);
  for (const [dx, col] of [[x0 + 0.1, pick(rng, GEO.door)], [x1 - 0.18, pick(rng, GEO.door)]]) {
    b.wall(dx, z1 + 0.002, 0, 1, 0.08, 0, 0.21, A.wall({ m: 'brick', c: brick, w: 'door', dc: col, wc: '#f2efe4', fl: 'g' }), [1, 1, 1], 0, 0);
    b.box(dx - 0.01, 0, z1, dx + 0.09, 0.03, z1 + 0.06, A.white, '#b8b2a5', { rep: 0, top: A.white });
  }
  b.box(xm - 0.006, 0, z1, xm + 0.006, s.yTop, z1 + 0.01, A.white, '#e8e2d0', { rep: 0 });
  chimney(b, xm, (z0 + z1) / 2, s.yTop, s.yRoof + 0.1, 0.12, brick);
  for (const px of [x0 + 0.14, x1 - 0.14]) path(b, px, z1 + 0.06, ld - 0.02, 0.06);
  fence(b, 0.04, ld - 0.04, lw - 0.04, ld - 0.04, 0.05, '#2a2a2c');
  b.box(xm - 0.004, 0, z1, xm + 0.004, 0.06, ld - 0.04, A.white, '#2a2a2c', { rep: 0 });
  dressLot(b, rng, lw, ld, { x0, x1, z0, z1: z1 + 0.06 }, { level, drive: false, mailbox: false, front: 'beds' });
  return { floors: floors + 0.1, h: s.yRoof + 0.1 };
}

// ====================================================================== SOUTHERN
function shotgun({ b, rng, lw, ld, level }) {
  const A = b.A;
  const double = lw > 1 || rng() < 0.5;
  const bw = double ? 0.62 : 0.4, bd = ld > 1 ? 0.95 : 0.62;
  const x0 = (lw - bw) / 2, x1 = x0 + bw;
  const z1 = ld - 0.2, z0 = Math.max(0.06, z1 - bd);
  const c = pick(rng, PASTEL), trim = '#fbf8ee', sh = pick(rng, ['#2c4a35', '#1f3a4a', '#6a1f1f', '#3a2a5a']);
  const s = shell(b, { rng, x0, z0, x1, z1, floors: 1, fh: 0.32, bayW: double ? 0.15 : 0.13, m: 'clap', c, trim, shutter: sh, upperWin: 'tall', door: { kind: 'porchdoor', color: sh, bay: double ? 'left' : 'right' }, roof: { type: 'gable', ridge: 'z', rise: 0.2, m: 'metal', c: pick(rng, SOU.roof), ov: 0.04 }, lit: 0.5 });
  // gingerbread porch under a hipped hood
  porch(b, { x0: x0 - 0.01, x1: x1 + 0.01, z: z1, depth: 0.13, h: 0.3, round: false, rail: true, iron: false, roofType: 'shed', color: trim, roofCell: A.roof({ m: 'metal', c: '#8a9099' }) });
  for (let i = 0; i < 4; i++) b.box(x0 + 0.02 + i * (bw - 0.04) / 3 - 0.02, 0.27, z1 + 0.11, x0 + 0.02 + i * (bw - 0.04) / 3 + 0.02, 0.3, z1 + 0.115, A.white, trim, { rep: 0 });
  b.box(x0 + 0.06, -0.01, z1 + 0.13, x0 + 0.18, 0.03, z1 + 0.18, A.white, '#b8b2a5', { rep: 0, top: A.white });
  dressLot(b, rng, lw, ld, { x0, x1, z0, z1: z1 + 0.13 }, { level, front: 'lawn', drive: lw > 1 ? 'auto' : false, greens: ['#477a3f', '#3f6f3a', '#5a9a46'] });
  return { floors: 1.2, h: s.yRoof + 0.05 };
}

function creoleCottage({ b, rng, lw, ld, level }) {
  const A = b.A;
  const bw = lw > 1 ? 1.1 : 0.74, bd = ld > 1 ? 0.56 : 0.42;
  const x0 = (lw - bw) / 2, x1 = x0 + bw;
  const z1 = ld - 0.32, z0 = z1 - bd;
  const c = pick(rng, [...SOU.stucco, ...PASTEL]), sh = pick(rng, SOU.shut), rc = pick(rng, SOU.roof);
  const fh = 0.32;
  shell(b, { rng, x0, z0, x1, z1, floors: 1, fh, bayW: 0.22, m: 'stucco', c, trim: '#fbf8ee', shutter: sh, upperWin: 'porchdoor', groundWin: 'porchdoor', door: { kind: 'porchdoor', color: sh }, roof: null, lit: 0.5 });
  // steep side-gabled roof that sweeps out over a front gallery
  const ov = 0.04, gal = 0.16, yT = fh, rise = 0.36, zm = (z0 + z1) / 2;
  const roofCell = A.roof({ m: rc === '#8c4036' ? 'tile' : 'metal', c: rc });
  b.grid([x0 - ov, yT - 0.03, z1 + gal + ov], [x1 + ov, yT - 0.03, z1 + gal + ov], [x1 + ov, yT + rise, zm], [x0 - ov, yT + rise, zm], 3, 3, roofCell, [1, 1, 1], [0, 1, 1]);
  b.grid([x1 + ov, yT, z0 - ov], [x0 - ov, yT, z0 - ov], [x0 - ov, yT + rise, zm], [x1 + ov, yT + rise, zm], 3, 3, roofCell, [1, 1, 1], [0, 1, -1]);
  const gc = A.wall({ m: 'stucco', c, w: 'none' });
  for (const [x, sx] of [[x0, -1], [x1, 1]]) b.tri([x, yT, z1], [x, yT, z0], [x, yT + rise, zm], gc, [1, 1, 1], { out: [sx, 0, 0] });
  b.box(x0 - 0.01, -0.01, z1, x1 + 0.01, 0.04, z1 + gal, A.white, '#b9a98d', { rep: 0, top: A.white });
  const n = Math.max(4, Math.round(bw / 0.2) + 1);
  for (let i = 0; i < n; i++) { const px = x0 + 0.02 + ((bw - 0.04) * i) / (n - 1); b.box(px - 0.01, 0.04, z1 + gal - 0.03, px + 0.01, yT - 0.02, z1 + gal - 0.01, A.white, '#fbf8ee', { rep: 0, top: A.white }); }
  for (const t of [0.3, 0.7]) dormer(b, x0 + bw * t, z1 - 0.02, yT + rise * ((z1 + gal + ov - (z1 - 0.02)) / (z1 + gal + ov - zm)) - 0.03, { m: 'clap', c: '#fbf8ee', trim: '#fbf8ee', rm: 'metal', rc, w: 0.1, h: 0.1, lit: rng() < 0.4 });
  chimney(b, x0 + 0.08, zm, yT, yT + rise + 0.06, 0.08, '#8a4b38');
  dressLot(b, rng, lw, ld, { x0, x1, z0, z1: z1 + gal }, { level, front: 'beds', greens: ['#477a3f', '#3f6f3a', '#5a9a46'] });
  return { floors: 1.6, h: yT + rise + 0.06 };
}

function raisedCottage({ b, rng, lw, ld, level }) {
  const A = b.A;
  const bw = lw > 1 ? 1.15 : 0.74, bd = ld > 1 ? 0.62 : 0.46;
  const x0 = (lw - bw) / 2, x1 = x0 + bw;
  const z1 = ld - 0.34, z0 = z1 - bd;
  const y0 = 0.14, fh = 0.3, floors = level >= 3 ? 2 : 1;
  const c = pick(rng, ['#f4f1e8', '#bfd8df', '#efe2bd', '#f6f2e6', '#d6e2cf']), sh = pick(rng, SOU.shut), rc = pick(rng, SOU.roof);
  // piers + lattice skirt
  b.box(x0, 0, z0, x1, y0, z1, A.decal('lattice', (c2, S) => { c2.fillStyle = '#5a5248'; c2.fillRect(0, 0, S, S); c2.strokeStyle = '#efe9da'; c2.lineWidth = 3; for (let k = -S; k < S * 2; k += 12) { c2.beginPath(); c2.moveTo(k, 0); c2.lineTo(k + S, S); c2.stroke(); c2.beginPath(); c2.moveTo(k + S, 0); c2.lineTo(k, S); c2.stroke(); } }), '#ffffff', { rep: 0.2, top: A.white });
  const s = shell(b, { rng, x0, z0, x1, z1, y0, floors, fh, bayW: 0.26, m: 'clap', c, trim: '#fbf8ee', shutter: sh, upperWin: 'tall', door: { kind: 'porchdoor', color: sh }, roof: { type: 'hip', rise: 0.22, m: 'metal', c: rc, ridgeInset: 0.12, ov: 0.08 }, lit: 0.5, plinth: false });
  // wraparound porch at the raised floor level
  b.box(x0 - 0.12, y0 - 0.02, z0 + 0.1, x1 + 0.12, y0 + 0.02, z1 + 0.16, A.white, '#c9b89a', { rep: 0, top: A.white });
  const posts = [];
  for (let i = 0; i <= 5; i++) posts.push([x0 - 0.1 + (bw + 0.2) * i / 5, z1 + 0.14]);
  for (const sx of [x0 - 0.1, x1 + 0.1]) for (let i = 0; i < 3; i++) posts.push([sx, z0 + 0.12 + i * (z1 - z0) / 3]);
  for (const [px, pz] of posts) b.box(px - 0.012, 0, pz - 0.012, px + 0.012, y0 + fh, pz + 0.012, A.white, '#fbf8ee', { rep: 0, top: A.white });
  b.box(x0 - 0.13, y0 + fh, z0 + 0.09, x1 + 0.13, y0 + fh + 0.025, z1 + 0.17, A.white, '#fbf8ee', { rep: 0, top: A.roof({ m: 'metal', c: rc }) });
  b.box(x0 - 0.1, y0 + 0.1, z1 + 0.13, x1 + 0.1, y0 + 0.115, z1 + 0.145, A.white, '#fbf8ee', { rep: 0 });
  // broad front stairs
  const cx = (x0 + x1) / 2;
  for (let k = 0; k < 4; k++) b.box(cx - 0.12, 0, z1 + 0.16 + k * 0.03, cx + 0.12, y0 - k * 0.035, z1 + 0.19 + k * 0.03, A.white, '#d8d0bc', { rep: 0, top: A.white });
  dressLot(b, rng, lw, ld, { x0: x0 - 0.13, x1: x1 + 0.13, z0, z1: z1 + 0.3 }, { level, front: 'lawn', greens: ['#477a3f', '#3f6f3a', '#5a9a46'] });
  if (ld > 1) tree(b, 0.14, ld - 0.14, 0.5, 'round', '#3f6f3a', rng);
  return { floors: floors + 0.4, h: s.yRoof + 0.05 };
}

function dogtrot({ b, rng, lw, ld, level }) {
  const A = b.A;
  const bw = lw > 1 ? 1.1 : 0.8, bd = ld > 1 ? 0.5 : 0.4;
  const x0 = (lw - bw) / 2, x1 = x0 + bw, xm = (x0 + x1) / 2;
  const z1 = ld - 0.3, z0 = z1 - bd;
  const c = pick(rng, ['#9c7a52', '#8a6a48', '#b08d62', '#efe2bd']);
  const rc = pick(rng, ['#8a9099', '#7a7f86', '#9aa2a8']);
  const fh = 0.28, gap = bw * 0.22;
  for (const [a, z] of [[x0, xm - gap / 2], [xm + gap / 2, x1]]) shell(b, { rng, x0: a, x1: z, z0, z1, floors: 1, fh, bayW: 0.2, m: 'wood', c, trim: '#e8dcc0', upperWin: 'small', door: { kind: 'door', color: '#4a3424' }, roof: null, lit: 0.4 });
  b.box(xm - gap / 2, 0, z0, xm + gap / 2, 0.035, z1, A.white, '#9a8466', { rep: 0, top: A.white });
  b.gable(x0, z0, x1, z1 + 0.14, fh, 0.24, 'x', A.roof({ m: 'metal', c: rc }), [1, 1, 1], A.wall({ m: 'wood', c, w: 'none' }), [1, 1, 1], 0.05);
  b.box(x0, 0, z1, x1, 0.035, z1 + 0.14, A.white, '#9a8466', { rep: 0, top: A.white });
  for (let i = 0; i < 5; i++) { const px = x0 + 0.02 + (bw - 0.04) * i / 4; b.box(px - 0.01, 0.035, z1 + 0.12, px + 0.01, fh, z1 + 0.14, A.white, '#7a5a3d', { rep: 0, top: A.white }); }
  chimney(b, x0 + 0.06, (z0 + z1) / 2, 0, fh + 0.32, 0.09, '#8a7a6a'); chimney(b, x1 - 0.06, (z0 + z1) / 2, 0, fh + 0.32, 0.09, '#8a7a6a');
  // rocking chairs on the porch
  for (const px of [x0 + 0.15, x1 - 0.2]) b.box(px, 0.035, z1 + 0.04, px + 0.04, 0.08, z1 + 0.08, A.white, '#6a4a30', { rep: 0, top: A.white });
  dressLot(b, rng, lw, ld, { x0, x1, z0, z1: z1 + 0.14 }, { level, front: 'lawn', drive: 'auto', greens: ['#477a3f', '#3f6f3a', '#6a8a3a'] });
  return { floors: 1.2, h: fh + 0.32 };
}

// ====================================================================== AMERICAN
function bungalow({ b, rng, lw, ld, level }) {
  const A = b.A;
  const bw = lw > 1 ? 0.8 : 0.62, bd = ld > 1 ? 0.7 : 0.5;
  const x0 = lw > 1 ? 0.14 : (lw - bw) / 2, x1 = x0 + bw;
  const z1 = ld - 0.3, z0 = Math.max(0.08, z1 - bd);
  const c = pick(rng, ['#8a9a6a', '#a07a52', '#c9a75a', '#6f8a8a', '#9a5a45', '#b9b29a', '#7a6a5a']);
  const trim = pick(rng, ['#f2ead8', '#e8dcc0', '#3d3328']);
  const rc = pick(rng, AMER.roof);
  const s = shell(b, { rng, x0, z0, x1, z1, floors: 1, fh: 0.27, bayW: 0.22, m: rng() < 0.6 ? 'wood' : 'clap', c, trim, upperWin: 'casement', door: { kind: 'door', color: pick(rng, ['#7a3a20', '#3a5a3a', '#5a3a2a']) }, roof: { type: 'gable', ridge: 'z', rise: 0.2, m: 'shingle', c: rc, ov: 0.08 }, lit: 0.5 });
  // full-width porch with tapered columns on stone piers
  const pd = 0.18;
  b.box(x0 - 0.02, 0, z1, x1 + 0.02, 0.04, z1 + pd, A.white, '#a89a86', { rep: 0, top: A.white });
  for (const px of [x0 + 0.02, x1 - 0.02]) {
    b.box(px - 0.03, 0.04, z1 + pd - 0.06, px + 0.03, 0.12, z1 + pd, A.wall({ m: 'stone', c: '#8a8070', w: 'none' }), '#ffffff', { rep: 0.1, top: A.white });
    b.cyl(px, z1 + pd - 0.03, 0.022, 0.12, 0.27, 4, A.white, trim, { r1: 0.014, cap: false });
  }
  b.gable(x0 - 0.04, z1, x1 + 0.04, z1 + pd + 0.04, 0.27, 0.13, 'z', A.roof({ m: 'shingle', c: rc }), [1, 1, 1], A.wall({ m: 'wood', c: trim, w: 'none' }), [1, 1, 1], 0.03);
  chimney(b, x0 + 0.02, (z0 + z1) / 2, 0, s.yRoof + 0.02, 0.08, '#7a4a3a');
  if (lw > 1) {
    const gx0 = x1 + 0.1, gx1 = Math.min(lw - 0.05, gx0 + 0.36);
    shell(b, { rng, x0: gx0, x1: gx1, z0: z0 + 0.15, z1: z1 - 0.05, floors: 1, fh: 0.23, bayW: 0.33, m: 'wood', c, trim, upperWin: 'garage', groundWin: 'garage', roof: { type: 'gable', ridge: 'z', rise: 0.12, m: 'shingle', c: rc }, lit: 0 });
    b.flatQuad(gx0 + 0.03, z1 - 0.05, gx1 - 0.03, ld, 0.009, A.white, '#8a8b8d');
    if (rng() < 0.7) car(b, (gx0 + gx1) / 2, z1 + 0.12, true, pick(rng, CAR_COLS));
  }
  path(b, (x0 + x1) / 2, z1 + pd, ld - 0.02, 0.07, '#a89a86');
  dressLot(b, rng, lw, ld, { x0, x1: lw > 1 ? lw - 0.04 : x1, z0, z1: z1 + pd }, { level, drive: lw > 1 ? false : 'auto', front: pick(rng, ['beds', 'lawn']) });
  return { floors: 1.3, h: s.yRoof + 0.05 };
}

function ranch({ b, rng, lw, ld, level }) {
  const A = b.A;
  const wide = lw > 1;
  const bw = wide ? 1.55 : 0.8, bd = ld > 1 ? 0.55 : 0.42;
  const x0 = (lw - bw) / 2, x1 = x0 + bw;
  const z1 = ld - 0.3, z0 = z1 - bd;
  const brick = rng() < 0.5;
  const c = brick ? pick(rng, ['#9a5a45', '#b07a5a', '#8e6a55', '#c4a690']) : pick(rng, ['#d9d0bc', '#bcc8cc', '#e8dfc8', '#a9b8a2']);
  const rc = pick(rng, AMER.roof);
  const gw = wide ? 0.42 : 0;
  const s = shell(b, { rng, x0, z0, x1: x1 - gw, z1, floors: 1, fh: 0.24, bayW: 0.24, m: brick ? 'brick' : 'clap', c, trim: '#f6f3ea', shutter: rng() < 0.5 ? pick(rng, ['#2f4a3a', '#3a3a42', '#7a2f2a']) : null, upperWin: 'casement', door: { kind: 'door', color: pick(rng, ['#7a2f2a', '#2a3b55', '#d9b34a']) }, roof: { type: 'hip', rise: 0.13, m: 'shingle', c: rc, ridgeInset: 0.2, ov: 0.07 }, lit: 0.5 });
  if (wide) {
    shell(b, { rng, x0: x1 - gw, x1, z0: z0 + 0.04, z1: z1 + 0.04, floors: 1, fh: 0.24, bayW: 0.21, m: 'clap', c: brick ? '#e8dfc8' : c, trim: '#f6f3ea', upperWin: 'garage', groundWin: 'garage', roof: { type: 'hip', rise: 0.12, m: 'shingle', c: rc, ridgeInset: 0.12, ov: 0.07 }, lit: 0 });
    b.flatQuad(x1 - gw + 0.03, z1 + 0.04, x1 - 0.03, ld, 0.009, A.white, '#8a8b8d');
    if (rng() < 0.8) car(b, x1 - gw * 0.5, z1 + 0.18, true, pick(rng, CAR_COLS));
  }
  // picture window and planters
  b.box(x0 + 0.15, 0.06, z1, x0 + 0.42, 0.2, z1 + 0.012, A.wall({ m: 'plain', c: '#5d7089', w: 'curtain', gl: 'slate', fl: 'u' }), '#fff', { rep: 0, top: A.white });
  if (rng() < 0.6) dish(b, x0 + 0.2, s.yRoof - 0.06, (z0 + z1) / 2);
  if (rng() < 0.4) slopeSolar(b, x0 + 0.25, x1 - gw - 0.2, z1 + 0.07, s.yTop, (z0 + z1) / 2, s.yRoof);
  dressLot(b, rng, lw, ld, { x0, x1, z0, z1: z1 + 0.04 }, { level, drive: wide ? false : 'auto', front: pick(rng, ['beds', 'lawn', 'hedge']) });
  return { floors: 1.1, h: s.yRoof };
}

function foursquare({ b, rng, lw, ld, level }) {
  const A = b.A;
  const bw = lw > 1 ? 0.78 : 0.66, bd = ld > 1 ? 0.66 : 0.5;
  const x0 = lw > 1 ? 0.2 : (lw - bw) / 2, x1 = x0 + bw;
  const z1 = ld - 0.32, z0 = Math.max(0.08, z1 - bd);
  const c = pick(rng, AMER.siding), rc = pick(rng, AMER.roof);
  const s = shell(b, { rng, x0, z0, x1, z1, floors: 2, fh: 0.27, bayW: 0.33, m: rng() < 0.3 ? 'brick' : 'clap', c: rng() < 0.3 ? pick(rng, AMER.brick) : c, trim: '#f6f3ea', upperWin: 'sash', door: { kind: 'door', color: pick(rng, ['#7a2f2a', '#2a3b55', '#3a2a1e']), bay: 'left' }, roof: { type: 'hip', rise: 0.24, m: 'shingle', c: rc, ov: 0.07 }, lit: 0.5 });
  dormer(b, (x0 + x1) / 2, z1 - 0.04, roofY(s.yTop, 0.24, bd / 2 + 0.07, 0.11), { m: 'clap', c, trim: '#f6f3ea', rm: 'shingle', rc, w: 0.14, h: 0.12, lit: rng() < 0.5 });
  porch(b, { x0: x0 - 0.01, x1: x1 + 0.01, z: z1, depth: 0.16, h: 0.26, round: false, rail: true, roofType: 'shed', color: '#f6f3ea', roofCell: A.roof({ m: 'shingle', c: rc }) });
  chimney(b, x1 - 0.1, (z0 + z1) / 2, s.yTop, s.yRoof + 0.08, 0.08, pick(rng, AMER.brick));
  dressLot(b, rng, lw, ld, { x0, x1, z0, z1: z1 + 0.16 }, { level, front: pick(rng, ['beds', 'lawn']), drive: lw > 1 ? 'right' : 'auto' });
  return { floors: 2.2, h: s.yRoof + 0.05 };
}

function secondEmpire({ b, rng, lw, ld, level }) {
  const A = b.A;
  const bw = lw > 1 ? 0.95 : 0.66, bd = ld > 1 ? 0.7 : 0.5;
  const x0 = (lw - bw) / 2, x1 = x0 + bw;
  const z1 = ld - 0.32, z0 = Math.max(0.08, z1 - bd);
  const [pc, tc] = pick(rng, AMER.paint);
  const s = shell(b, { rng, x0, z0, x1, z1, floors: 2, fh: 0.29, bayW: 0.26, m: rng() < 0.5 ? 'brick' : 'clap', c: rng() < 0.5 ? pick(rng, AMER.brick) : pc, trim: tc, upperWin: 'arch', groundWin: 'tall', door: { kind: 'door', color: '#3a2a1e' }, roof: null, lit: 0.5 });
  cornice(b, x0, z0, x1, z1, s.yTop, 0.04, 0.045, tc);
  const mh = 0.24, roofC = A.roof({ m: 'slate', c: pick(rng, ['#4b4b55', '#5a4a5a', '#3f4f4a']) });
  b.mansard(x0, z0, x1, z1, s.yTop, mh, 0.06, roofC, [1, 1, 1], A.roof({ m: 'metal', c: '#5a5f66' }));
  const nd = lw > 1 ? 3 : 2;
  for (let i = 0; i < nd; i++) {
    const dx = x0 + bw * (i + 1) / (nd + 1);
    b.wall(dx - 0.05, z1 - 0.022, 0, 1, 0.1, s.yTop + 0.04, s.yTop + 0.17, A.wall({ m: 'plain', c: tc, w: 'arch', wc: tc, fl: 'u', lit: rng() < 0.5 }), [1, 1, 1], 0, 0);
    b.box(dx - 0.06, s.yTop + 0.17, z1 - 0.04, dx + 0.06, s.yTop + 0.19, z1 - 0.01, A.white, tc, { rep: 0, top: A.white });
  }
  // iron cresting
  b.box(x0 + 0.06, s.yTop + mh, z0 + 0.06, x1 - 0.06, s.yTop + mh + 0.03, z0 + 0.065, A.white, '#26272a', { rep: 0 });
  b.box(x0 + 0.06, s.yTop + mh, z1 - 0.065, x1 - 0.06, s.yTop + mh + 0.03, z1 - 0.06, A.white, '#26272a', { rep: 0 });
  porch(b, { x0: (x0 + x1) / 2 - 0.13, x1: (x0 + x1) / 2 + 0.13, z: z1, depth: 0.12, h: 0.27, cols: 2, round: true, color: tc, roofType: 'flat', roofColor: tc, roofCell: A.roof({ m: 'metal', c: '#5a5f66' }) });
  bayWindow(b, x0 + 0.14, z1, 0.03, 0.16, 0.5, 0.06, A.wall({ m: 'clap', c: pc, w: 'tall', wc: tc, fl: 'u', lit: rng() < 0.5 }), roofC, tc);
  fence(b, 0.03, ld - 0.03, lw - 0.03, ld - 0.03, 0.06, '#26272a');
  dressLot(b, rng, lw, ld, { x0, x1, z0, z1: z1 + 0.12 }, { level, front: 'beds', mailbox: false, pool: ld > 1 && rng() < 0.3 });
  return { floors: 2.6, h: s.yTop + mh + 0.05 };
}

function splitLevel({ b, rng, lw, ld, level }) {
  const A = b.A;
  const bw = lw > 1 ? 1.2 : 0.76, bd = ld > 1 ? 0.55 : 0.44;
  const x0 = (lw - bw) / 2, x1 = x0 + bw, xs = x0 + bw * 0.45;
  const z1 = ld - 0.3, z0 = z1 - bd;
  const c = pick(rng, ['#d9d0bc', '#bcc8cc', '#c9b8a0', '#a9b8a2', '#e8dfc8']), c2 = pick(rng, AMER.brick);
  const rc = pick(rng, AMER.roof);
  const a = shell(b, { rng, x0, z0, x1: xs, z1, floors: 1, fh: 0.24, bayW: 0.22, m: 'brick', c: c2, trim: '#f6f3ea', upperWin: 'casement', door: { kind: 'garage', color: '#e8e4d8' }, roof: null, lit: 0.4 });
  shell(b, { rng, x0, z0, x1: xs, z1, y0: 0.24, floors: 1, fh: 0.24, bayW: 0.22, m: 'clap', c, trim: '#f6f3ea', upperWin: 'casement', plinth: false, roof: { type: 'gable', ridge: 'x', rise: 0.14, m: 'shingle', c: rc, ov: 0.06 }, lit: 0.5 });
  const s = shell(b, { rng, x0: xs, z0: z0 + 0.04, x1, z1: z1 - 0.02, y0: 0.12, floors: 1, fh: 0.25, bayW: 0.22, m: 'clap', c, trim: '#f6f3ea', upperWin: 'casement', door: { kind: 'door', color: '#7a2f2a' }, plinth: true, roof: { type: 'gable', ridge: 'x', rise: 0.12, m: 'shingle', c: rc, ov: 0.06 }, lit: 0.5 });
  b.box(xs + 0.06, 0, z1 - 0.02, xs + 0.18, 0.12, z1 + 0.06, A.white, '#b8b2a5', { rep: 0, top: A.white });
  b.flatQuad(x0 + 0.04, z1, xs - 0.04, ld, 0.009, A.white, '#8a8b8d');
  if (rng() < 0.7) car(b, (x0 + xs) / 2, z1 + 0.13, true, pick(rng, CAR_COLS));
  dressLot(b, rng, lw, ld, { x0, x1, z0, z1: z1 + 0.06 }, { level, drive: false, front: 'beds' });
  return { floors: 1.8, h: Math.max(0.62, s.yRoof) };
}

// ====================================================================== MODERN
function aFrame({ b, rng, lw, ld, level }) {
  const A = b.A;
  const bw = lw > 1 ? 0.62 : 0.52, bd = ld > 1 ? 0.7 : 0.5;
  const x0 = (lw - bw) / 2, x1 = x0 + bw;
  const z1 = ld - 0.28, z0 = z1 - bd;
  const wood = pick(rng, MOD.wood), rc = pick(rng, ['#2f3438', '#4a4f55', '#7a3a2a']);
  const h = 0.62;
  b.gable(x0, z0, x1, z1, 0.02, h, 'z', A.roof({ m: 'metal', c: rc }), [1, 1, 1], null, null, 0.04);
  const glass = A.wall({ m: 'glass', c: '#7fa6b8', w: 'curtain', gl: 'teal', fl: 'u', lit: rng() < 0.6 });
  const xm = (x0 + x1) / 2;
  // glazed front gable over a wood base strip
  b.tri([x0 + 0.03, 0.08, z1 - 0.02], [x1 - 0.03, 0.08, z1 - 0.02], [xm, h - 0.06, z1 - 0.02], glass, [1, 1, 1], { out: [0, 0, 1] });
  b.box(x0 + 0.02, 0, z1 - 0.03, x1 - 0.02, 0.08, z1 - 0.015, A.wall({ m: 'wood', c: wood, w: 'none' }), '#fff', { rep: 0.2, top: A.white });
  b.tri([x1, 0.02, z0], [x0, 0.02, z0], [xm, h, z0], A.wall({ m: 'wood', c: wood, w: 'none' }), [1, 1, 1], { out: [0, 0, -1] });
  // deck
  b.box(x0 - 0.06, 0, z1, x1 + 0.06, 0.04, z1 + 0.16, A.wall({ m: 'wood', c: wood, w: 'none' }), '#fff', { rep: 0.2, top: A.wall({ m: 'wood', c: wood, w: 'none' }) });
  b.box(x0 - 0.06, 0.04, z1 + 0.15, x1 + 0.06, 0.1, z1 + 0.16, A.white, '#3c4146', { rep: 0 });
  chimney(b, x0 + 0.12, (z0 + z1) / 2, 0, h * 0.9, 0.06, '#5a5f66');
  dressLot(b, rng, lw, ld, { x0: x0 - 0.06, x1: x1 + 0.06, z0, z1: z1 + 0.16 }, { level, front: 'lawn', greens: ['#3a6f35', '#2f5f30', '#4a7a3a'] });
  return { floors: 1.4, h };
}

function skillion({ b, rng, lw, ld, level }) {
  const A = b.A;
  const bw = lw > 1 ? 1.1 : 0.74, bd = ld > 1 ? 0.62 : 0.46;
  const x0 = (lw - bw) / 2, x1 = x0 + bw, xs = x0 + bw * 0.55;
  const z1 = ld - 0.26, z0 = z1 - bd;
  const base = pick(rng, [...MOD.white, ...MOD.conc]), wood = pick(rng, MOD.wood), glass = pick(rng, MOD.glass);
  const floors = level >= 2 ? 2 : 1;
  const mk = (xa, xb, za, zb, fl, m, c, rise, win) => shell(b, { rng, x0: xa, x1: xb, z0: za, z1: zb, floors: fl, fh: 0.26, bayW: 0.3, m, c, trim: '#d5d3cc', gl: glass, upperWin: win, groundWin: win, door: xa === x0 ? { kind: 'door', color: '#3c4146' } : undefined, roof: { type: 'shed', rise, m: 'metal', c: '#4a4f55', ov: 0.04 }, lit: 0.5 });
  const a = mk(x0, xs, z0, z1, floors, 'conc', base, 0.14, 'ribbon');
  const c2 = mk(xs, x1, z0 + 0.06, z1 - 0.06, 1, 'wood', wood, 0.1, 'curtain');
  if (rng() < 0.6) flatSolar(b, xs + 0.06, z0 + 0.1, x1 - 0.06, z0 + 0.25, c2.yRoof + 0.01);
  b.box(xs - 0.02, 0, z1, xs + 0.2, 0.012, z1 + 0.18, A.wall({ m: 'wood', c: wood, w: 'none' }), '#fff', { rep: 0.2, top: A.wall({ m: 'wood', c: wood, w: 'none' }) });
  dressLot(b, rng, lw, ld, { x0, x1, z0, z1: z1 + 0.18 }, { level, front: pick(rng, ['lawn', 'beds']), greens: ['#5a9a46', '#6aa84f', '#3f7a3a'] });
  return { floors: floors + 0.3, h: a.yRoof };
}

function cantilever({ b, rng, lw, ld, level }) {
  const A = b.A;
  const bw = lw > 1 ? 1.05 : 0.72, bd = ld > 1 ? 0.58 : 0.42;
  const x0 = (lw - bw) / 2, x1 = x0 + bw;
  const z1 = ld - 0.32, z0 = z1 - bd;
  const glass = pick(rng, MOD.glass), base = pick(rng, MOD.dark), top = pick(rng, [...MOD.white, ...MOD.wood]);
  shell(b, { rng, x0, z0, x1: x0 + bw * 0.62, z1, floors: 1, fh: 0.26, bayW: 0.42, m: 'glass', c: MOD.glassC[glass], trim: '#3c4146', gl: glass, upperWin: 'curtain', groundWin: 'curtain', door: { kind: 'door', color: '#3c4146' }, roof: { type: 'flat', parapet: 0.0, m: 'gravel', c: '#6e6e6a' }, lit: 0.6 });
  const s = shell(b, { rng, x0: x0 + 0.08, z0: z0 - 0.02, x1, z1: z1 + 0.14, y0: 0.27, floors: 1, fh: 0.27, bayW: 0.42, m: MOD.wood.includes(top) ? 'wood' : 'conc', c: top, trim: '#3c4146', gl: glass, upperWin: 'ribbon', plinth: false, roof: { type: 'flat', parapet: 0.02, m: rng() < 0.5 ? 'grass' : 'gravel', c: '#5a9a46' }, lit: 0.55 });
  b.box(x0 + 0.08, 0.255, z0 - 0.02, x1, 0.27, z1 + 0.14, A.white, base, { rep: 0, top: A.white, bottom: true });
  b.cyl(x1 - 0.04, z1 + 0.1, 0.012, 0, 0.27, 6, A.white, '#3c4146', {});
  b.flatQuad(x0 + bw * 0.62 + 0.02, z0, x1 - 0.02, ld, 0.009, A.white, '#7e7f82');
  if (rng() < 0.8) car(b, x0 + bw * 0.8, z1 - 0.05, true, pick(rng, ['#2b2e33', '#e8e6df', '#7f8c8d', '#c0392b']));
  dressLot(b, rng, lw, ld, { x0, x1, z0: z0 - 0.02, z1: z1 + 0.14 }, { level, drive: false, front: 'lawn', pool: level >= 3, greens: ['#5a9a46', '#6aa84f'] });
  return { floors: 2.2, h: s.yRoof };
}

function courtyardHouse({ b, rng, lw, ld, level }) {
  const A = b.A;
  if (lw < 2 || ld < 2) return cantilever({ b, rng, lw, ld, level });
  const glass = pick(rng, MOD.glass), base = pick(rng, MOD.white), wood = pick(rng, MOD.wood);
  const x0 = 0.18, x1 = lw - 0.18, z0 = 0.2, z1 = ld - 0.4;
  const mk = (xa, xb, za, zb, m, c) => shell(b, { rng, x0: xa, x1: xb, z0: za, z1: zb, floors: 1, fh: 0.27, bayW: 0.45, m, c, trim: '#d5d3cc', gl: glass, upperWin: 'curtain', groundWin: 'curtain', door: undefined, roof: { type: 'flat', parapet: 0.03, m: 'grass', c: '#5a9a46' }, lit: 0.55 });
  mk(x0, x1, z0, z0 + 0.4, 'conc', base);
  mk(x0, x0 + 0.4, z0 + 0.4, z1, 'wood', wood);
  const s = mk(x1 - 0.5, x1, z0 + 0.4, z1, 'conc', base);
  b.wall(x1 - 0.32, z1 + 0.002, 0, 1, 0.1, 0, 0.22, A.wall({ m: 'conc', c: base, w: 'door', dc: '#3c4146', fl: 'g' }), [1, 1, 1], 0, 0);
  pool(b, x0 + 0.5, z0 + 0.5, x1 - 0.6, z1 - 0.1);
  for (const [tx, tz] of [[x0 + 0.5, z1 - 0.02], [x1 - 0.62, z0 + 0.48]]) tree(b, tx, tz, 0.3, 'round', '#5a9a46', rng);
  flatSolar(b, x0 + 0.1, z0 + 0.06, x0 + 0.6, z0 + 0.3, s.yRoof + 0.005);
  dressLot(b, rng, lw, ld, { x0, x1, z0, z1 }, { level, drive: 'front', front: 'lawn', extras: 0 });
  return { floors: 2.4, h: s.yRoof };
}


// ====================================================================== install as variants
// [generator, weight, minLevel, maxLevel]
const VARIANTS = {
  colonial: [[capeCod, 1.4, 1, 2], [saltbox, 1.1, 1, 3], [dutchColonial, 1, 2, 3], [garrison, 0.9, 2, 3]],
  georgian: [[thatchCottage, 1.1, 1, 1], [regencyVilla, 1.2, 2, 3], [semiPair, 1.1, 1, 2]],
  southern: [[shotgun, 1.4, 1, 1], [creoleCottage, 1.2, 1, 2], [raisedCottage, 1.1, 2, 3], [dogtrot, 0.8, 1, 2]],
  american: [[bungalow, 1.3, 1, 2], [ranch, 1.2, 1, 2], [foursquare, 1.1, 2, 2], [secondEmpire, 1.1, 3, 3], [splitLevel, 0.9, 2, 2]],
  modern: [[aFrame, 0.9, 1, 1], [skillion, 1.3, 1, 2], [cantilever, 1.2, 2, 3], [courtyardHouse, 1, 3, 3]],
};

for (const st in VARIANTS) {
  const orig = ZONE_GEN[st].house;
  const list = [[orig, 1.1, 1, 3], ...VARIANTS[st]];
  ZONE_GEN[st].house = (args) => {
    const opts = list.filter((v) => args.level >= v[2] && args.level <= v[3]);
    let tot = 0; for (const v of opts) tot += v[1];
    let r = args.rng() * tot;
    for (const v of opts) { r -= v[1]; if (r <= 0) return v[0](args); }
    return opts[0][0](args);
  };
}

export const HOUSE_VARIANTS = VARIANTS;
