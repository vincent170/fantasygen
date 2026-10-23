// Procedural zone buildings in 5 architectural styles: colonial, georgian, southern, american, modern.
// Local frame: lot spans x∈[0,lw], z∈[0,ld]; the street is at z = ld (front).
import { pick, weighted } from './util.js';
import { shell, parapet, cornice, quoins, chimney, chimneyPair, porch, portico, dormer, awning, balcony, fence, bush, tree, yard, path, hvac, waterTank, smokestack } from './build_common.js';

const rect = (lw, ld, sm = 0.1, fm = 0.2, bm = 0.08) => ({ x0: sm, x1: lw - sm, z0: bm, z1: ld - fm });
const ctr = (r) => (r.x0 + r.x1) / 2;

// ====================================================================== COLONIAL
const COL = {
  clap: ['#efe9d6', '#d8dfe2', '#b5483b', '#d9b66a', '#9db39c', '#a9b6c6', '#e9d9b0', '#f3efe2'],
  brick: ['#a5523b', '#94493a', '#a85e44', '#8f4a3b'],
  shut: ['#2f5a3d', '#2a3b55', '#222a2a', '#6b2b25'],
  roof: ['#6a5a4a', '#4a4a4f', '#7a5a3d', '#5a5048', '#5f6168'],
};

function colonialHouse({ b, rng, lw, ld, level }) {
  const A = b.A;
  const floors = level === 1 ? 1 : 2;
  const fh = 0.27;
  const wide = lw > 1;
  const bw = wide ? Math.min(lw - 0.34, 1.15 + (lw - 2) * 0.4) : 0.7;
  const bd = Math.min(ld - 0.34, ld === 1 ? 0.48 : 0.64);
  const x0 = (lw - bw) / 2 - (wide && level > 1 ? 0.16 : 0), x1 = x0 + bw;
  const z1 = ld - 0.2, z0 = z1 - bd;
  const m = level === 3 && rng() < 0.6 ? 'brick' : rng() < 0.82 ? 'clap' : 'brick';
  const c = m === 'clap' ? pick(rng, COL.clap) : pick(rng, COL.brick);
  const sh = pick(rng, COL.shut), roofC = pick(rng, COL.roof);
  const rise = floors === 1 ? 0.3 : 0.26;
  const s = shell(b, { rng, x0, z0, x1, z1, floors, fh, bayW: 0.3, m, c, trim: '#f4f1e7', shutter: sh, upperWin: 'small', door: { kind: 'door', color: sh }, roof: { type: 'gable', ridge: 'x', rise, m: 'shingle', c: roofC }, lit: 0.5 });
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  chimney(b, cx, cz, s.yTop, s.yRoof + 0.07, 0.09);
  if (floors === 1 && bw > 0.55) {
    for (const t of [0.28, 0.72]) dormer(b, x0 + bw * t, z1 - 0.06, s.yTop + rise * (0.06 / (bd / 2)), { m, c, trim: '#f4f1e7', rm: 'shingle', rc: roofC, lit: rng() < 0.5 });
  }
  porch(b, { x0: cx - 0.1, x1: cx + 0.1, z: z1, depth: 0.09, h: fh * 0.92, cols: 2, color: '#f4f1e7', roofType: 'gable', rise: 0.07, roofCell: A.roof({ m: 'shingle', c: roofC }) });
  if (wide && level > 1) {
    const wx0 = x1, wx1 = Math.min(lw - 0.08, x1 + 0.5);
    shell(b, { rng, x0: wx0, x1: wx1, z0: z0 + 0.06, z1: z1 - 0.04, floors: 1, fh, bayW: 0.3, m, c, trim: '#f4f1e7', shutter: sh, upperWin: 'small', plinth: true, roof: { type: 'gable', ridge: 'z', rise: 0.2, m: 'shingle', c: roofC }, lit: 0.4 });
  }
  if (level === 3) {
    // cupola on ridge
    b.box(cx - 0.045, s.yRoof, cz - 0.045, cx + 0.045, s.yRoof + 0.1, cz + 0.045, A.wall({ m: 'clap', c: '#f4f1e7', w: 'plainw' }), [1, 1, 1], { rep: 0, top: A.white });
    b.hipRoof(cx - 0.045, cz - 0.045, cx + 0.045, cz + 0.045, s.yRoof + 0.1, 0.07, A.roof({ m: 'copper', c: '#5e8a74' }), [1, 1, 1], 0.025);
    chimney(b, x0 + 0.1, cz, s.yTop, s.yRoof + 0.05, 0.08);
  }
  fence(b, 0.03, ld - 0.03, cx - 0.08, ld - 0.03, 0.06); fence(b, cx + 0.08, ld - 0.03, lw - 0.03, ld - 0.03, 0.06);
  path(b, cx, z1 + 0.09, ld - 0.03);
  yard(b, rng, lw, ld, { x0, x1: x1 + 0.5, z0, z1 }, { treeP: 0.5 });
  return { floors: floors + 0.4, h: s.yRoof };
}

function colonialApt({ b, rng, lw, ld, level }) {
  const A = b.A;
  const floors = 2 + level;
  const fh = 0.26;
  const units = Math.max(2, Math.round(lw * 1.4));
  const uw = (lw - 0.1) / units;
  const z1 = ld - 0.1, z0 = 0.1;
  let hmax = 0;
  const palette = rng() < 0.5 ? 'clap' : 'mix';
  const shut = pick(rng, COL.shut);
  for (let i = 0; i < units; i++) {
    const useBrick = palette === 'mix' ? rng() < 0.45 : false;
    const m = useBrick ? 'brick' : 'clap';
    const c = useBrick ? pick(rng, COL.brick) : pick(rng, COL.clap);
    const f = floors + (rng() < 0.3 ? 1 : 0) - (rng() < 0.15 ? 1 : 0);
    const x0 = 0.05 + i * uw, x1 = x0 + uw;
    const s = shell(b, { rng, x0, x1, z0, z1, floors: f, fh, bayW: 0.26, m, c, trim: '#f4f1e7', shutter: shut, upperWin: 'small', door: { kind: 'door', color: pick(rng, COL.shut) }, plinth: true, roof: { type: 'gable', ridge: 'z', rise: 0.2 + rng() * 0.08, m: 'shingle', c: pick(rng, COL.roof), ov: 0.02 }, lit: 0.55 });
    chimney(b, (x0 + x1) / 2, z0 + 0.15, s.yTop, s.yRoof + 0.06, 0.07);
    b.box((x0 + x1) / 2 - 0.06, 0, z1, (x0 + x1) / 2 + 0.06, 0.03, z1 + 0.05, A.white, '#aaa49a', { rep: 0, top: A.white });
    hmax = Math.max(hmax, s.yRoof);
  }
  path(b, lw / 2, z1 + 0.05, ld, 0.1, '#bdb6a5');
  if (level === 3) { tree(b, 0.1, ld - 0.07, 0.3, 'round', '#4a8a3e', rng); tree(b, lw - 0.1, ld - 0.07, 0.3, 'round', '#3f7a3a', rng); }
  return { floors, h: hmax };
}

function colonialShop({ b, rng, lw, ld, level }) {
  const A = b.A;
  const floors = level === 1 ? 1 : 2;
  const fh = 0.28;
  const r = rect(lw, ld, 0.07, 0.2, 0.08);
  const c = pick(rng, COL.clap), roofC = pick(rng, COL.roof);
  const sign = pick(rng, ['#4a2f22', '#2a3b55', '#6b2b25', '#2f5a3d']);
  const s = shell(b, { rng, ...r, floors, fh, bayW: 0.32, m: rng() < 0.7 ? 'clap' : 'brick', c: rng() < 0.7 ? c : pick(rng, COL.brick), trim: '#f4f1e7', shutter: pick(rng, COL.shut), groundWin: 'shop', groundExtra: { sg: sign }, upperWin: 'small', door: { kind: 'door', color: sign }, roof: { type: 'gable', ridge: 'x', rise: 0.28, m: 'shingle', c: roofC }, lit: 0.5 });
  chimney(b, r.x0 + 0.15, (r.z0 + r.z1) / 2, s.yTop, s.yRoof + 0.06);
  if (lw >= 2) chimney(b, r.x1 - 0.15, (r.z0 + r.z1) / 2, s.yTop, s.yRoof + 0.06);
  porch(b, { x0: r.x0 + 0.04, x1: r.x1 - 0.04, z: r.z1, depth: 0.12, h: fh * 0.9, round: false, rail: true, roofType: 'shed', color: '#f4f1e7', roofCell: A.roof({ m: 'shingle', c: roofC }) });
  // hanging sign
  b.box(r.x1 - 0.07, fh * 0.75, r.z1 + 0.02, r.x1 - 0.01, fh * 0.75 + 0.07, r.z1 + 0.035, A.decal('sign:' + sign, (ctx, S) => { ctx.fillStyle = sign; ctx.fillRect(0, 0, S, S); ctx.fillStyle = '#e8d49a'; ctx.fillRect(8, 8, S - 16, S - 16); ctx.fillStyle = sign; ctx.fillRect(14, 22, S - 28, 6); ctx.fillRect(14, 36, S - 28, 6); }), '#ffffff', { rep: 0, top: A.white });
  for (let i = 0; i < 2; i++) b.cyl(r.x0 + 0.1 + i * 0.1, ld - 0.07, 0.03, 0, 0.06, 7, A.white, '#7a5a3d', { cap: true });
  if (level === 3) {
    const cx = ctr(r);
    b.box(cx - 0.05, s.yRoof, (r.z0 + r.z1) / 2 - 0.05, cx + 0.05, s.yRoof + 0.1, (r.z0 + r.z1) / 2 + 0.05, A.wall({ m: 'clap', c: '#f4f1e7', w: 'plainw' }), [1, 1, 1], { rep: 0, top: A.white });
    b.hipRoof(cx - 0.05, (r.z0 + r.z1) / 2 - 0.05, cx + 0.05, (r.z0 + r.z1) / 2 + 0.05, s.yRoof + 0.1, 0.08, A.roof({ m: 'copper', c: '#5e8a74' }), [1, 1, 1], 0.025);
  }
  yard(b, rng, lw, ld, r, { n: 2, treeP: 0.2, keepClear: { x0: r.x0, x1: r.x1, z0: r.z1 } });
  return { floors: floors + 0.2, h: s.yRoof };
}

function colonialOffice({ b, rng, lw, ld, level }) {
  const A = b.A;
  const floors = [4, 6, 9][level - 1] + ((rng() * 2) | 0);
  const fh = 0.26;
  const r = rect(lw, ld, 0.1, 0.22, 0.1);
  const brick = pick(rng, COL.brick);
  const s = shell(b, { rng, ...r, floors, fh, bayW: 0.3, m: 'brick', c: brick, trim: '#f4f1e7', upperWin: 'sash', door: { kind: 'door', color: '#2a3b55' }, roof: { type: 'hip', rise: 0.2, m: 'slate', c: '#4a4a4f', ridgeInset: 0.1 }, lit: 0.55, plinthTint: '#8a8478' });
  quoins(b, r.x0, r.z0, r.x1, r.z1, 0, s.yTop, '#e8e2d0');
  cornice(b, r.x0, r.z0, r.x1, r.z1, s.yTop, 0.035, 0.03);
  const cx = ctr(r);
  portico(b, { x0: cx - 0.17, x1: cx + 0.17, z: r.z1, depth: 0.12, h: fh * 1.1, cols: 3, pediment: true, color: '#f4f1e7' });
  // clock tower
  const tz = (r.z0 + r.z1) / 2, tw = 0.2;
  const tbase = s.yRoof - 0.05, th = 0.28 + level * 0.08;
  b.box(cx - tw / 2, tbase, tz - tw / 2, cx + tw / 2, tbase + th, tz + tw / 2, A.wall({ m: 'brick', c: brick, w: 'arch', wc: '#f4f1e7', fl: 'u' }), [1, 1, 1], { rep: 0.3, top: A.white });
  b.wall(cx - 0.07, tz + tw / 2 + 0.003, 0, 1, 0.14, tbase + th * 0.45, tbase + th * 0.45 + 0.14, A.clock(), [1, 1, 1], 0, 0);
  b.hipRoof(cx - tw / 2, tz - tw / 2, cx + tw / 2, tz + tw / 2, tbase + th, 0.22, A.roof({ m: 'copper', c: '#5e8a74' }), [1, 1, 1], 0.025, 0);
  chimney(b, r.x0 + 0.12, tz, s.yTop, s.yRoof + 0.05); chimney(b, r.x1 - 0.12, tz, s.yTop, s.yRoof + 0.05);
  yard(b, rng, lw, ld, r, { n: 2, keepClear: { x0: r.x0, x1: r.x1, z0: r.z1 } });
  return { floors, h: tbase + th + 0.22 };
}

function colonialFactory({ b, rng, lw, ld, level }) {
  const A = b.A;
  const floors = level === 1 ? 2 : 3;
  const fh = 0.3;
  const r = rect(lw, ld, 0.08, 0.2, 0.1);
  const m = rng() < 0.6 ? 'clap' : 'brick';
  const c = m === 'clap' ? pick(rng, ['#9a7a55', '#7e6a55', '#b5483b', '#8a8a82']) : pick(rng, COL.brick);
  const s = shell(b, { rng, ...r, floors, fh, bayW: 0.34, m, c, trim: '#efe6d2', upperWin: 'small', groundWin: 'small', door: { kind: 'garage', color: '#5a4630', bay: 'right' }, roof: { type: 'gable', ridge: 'x', rise: 0.3, m: 'shingle', c: '#5b4a3c' }, lit: 0.35 });
  smokestack(b, r.x1 - 0.12, r.z0 + 0.12, 0, s.yRoof + 0.2 + level * 0.1, 0.06);
  if (level >= 2) smokestack(b, r.x0 + 0.12, r.z0 + 0.12, 0, s.yRoof + 0.1, 0.05);
  // waterwheel decal on right wall
  const wh = A.decal('wheel', (ctx, S) => { ctx.fillStyle = '#4a7a8a'; ctx.fillRect(0, 0, S, S); ctx.strokeStyle = '#5a4026'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(S / 2, S / 2, S * 0.4, 0, 7); ctx.stroke(); ctx.lineWidth = 3; for (let a = 0; a < 8; a++) { ctx.beginPath(); ctx.moveTo(S / 2, S / 2); ctx.lineTo(S / 2 + Math.cos(a * 0.785) * S * 0.42, S / 2 + Math.sin(a * 0.785) * S * 0.42); ctx.stroke(); } ctx.fillStyle = '#3a2a18'; ctx.beginPath(); ctx.arc(S / 2, S / 2, 5, 0, 7); ctx.fill(); });
  b.wall(r.x1 + 0.01, r.z1 - 0.12, 1, 0, 0.3, 0, 0.3, wh, [1, 1, 1], 0, 0);
  b.box(r.x1, 0, r.z1 - 0.14, r.x1 + 0.05, 0.02, r.z1 - 0.1, A.white, '#777', { rep: 0 });
  if (level === 3) { b.cyl(r.x0 + 0.08, r.z1 + 0.08, 0.07, 0, 0.35, 10, A.white, '#aaa9a0', { r1: 0.07 }); }
  // cart / barrels
  for (let i = 0; i < 3; i++) b.cyl(r.x0 + 0.1 + i * 0.07, ld - 0.08, 0.025, 0, 0.05, 6, A.white, '#7a5a3d');
  return { floors, h: s.yRoof };
}

// ====================================================================== GEORGIAN
const GEO = {
  brick: ['#a4472f', '#9c5a3c', '#b5683f', '#8a3e2c', '#a9553a'],
  slate: ['#4b5360', '#59616b', '#3f444d'],
  door: ['#1f2f4a', '#24402d', '#6a1f1f', '#1e1e1e'],
  stone: ['#d9d2c0', '#cfc8b4', '#e0d9c6'],
};

function georgianHouse({ b, rng, lw, ld, level }) {
  const A = b.A;
  const brick = pick(rng, GEO.brick), roofC = pick(rng, GEO.slate), dc = pick(rng, GEO.door);
  const fh = 0.28;
  if (lw === 1 && level < 3) {
    // narrow townhouse
    const floors = level === 1 ? 3 : 4;
    const r = { x0: 0.14, x1: 0.86, z0: 0.12, z1: ld - 0.2 };
    const s = shell(b, { rng, ...r, floors, fh, bayW: 0.3, m: 'brick', c: brick, trim: '#f2efe4', upperWin: 'sash', door: { kind: 'door', color: dc }, roof: { type: 'flat', parapet: 0.07, m: 'gravel', c: '#5f5f5a' }, lit: 0.5 });
    cornice(b, r.x0, r.z0, r.x1, r.z1, s.yTop, 0.03, 0.025);
    chimneyPair(b, 0.5, (r.z0 + r.z1) / 2, s.yTop, s.yTop + 0.18, 0.12, brick);
    // stoop with iron railing
    b.box(0.4, 0, r.z1, 0.6, 0.06, r.z1 + 0.1, A.white, '#b8b2a5', { rep: 0, top: A.white });
    b.box(0.38, 0.06, r.z1 + 0.09, 0.62, 0.15, r.z1 + 0.1, A.white, '#26272a', { rep: 0 });
    path(b, 0.5, r.z1 + 0.1, ld - 0.02, 0.08);
    fence(b, 0.1, ld - 0.04, 0.4, ld - 0.04, 0.05, '#2a2a2c'); fence(b, 0.6, ld - 0.04, 0.9, ld - 0.04, 0.05, '#2a2a2c');
    return { floors, h: s.yRoof };
  }
  // Palladian house
  const wide = lw >= 2;
  const floors = level === 1 ? 2 : 3;
  const cw = wide ? 0.95 + (level - 1) * 0.15 : 0.7;
  const x0 = (lw - cw) / 2, x1 = x0 + cw;
  const z1 = ld - 0.26, z0 = Math.max(0.1, z1 - (ld >= 2 ? 0.8 : 0.5));
  const s = shell(b, { rng, x0, x1, z0, z1, floors, fh, bayW: 0.3, m: 'brick', c: brick, trim: '#f2efe4', upperWin: 'sash', door: { kind: 'door', color: dc }, roof: { type: 'hip', rise: 0.22, m: 'slate', c: roofC, ridgeInset: 0.12 }, lit: 0.5 });
  quoins(b, x0, z0, x1, z1, 0, s.yTop);
  cornice(b, x0, z0, x1, z1, s.yTop, 0.032, 0.03);
  const cx = (x0 + x1) / 2;
  portico(b, { x0: cx - 0.14, x1: cx + 0.14, z: z1, depth: 0.11, h: fh * 1.05, cols: level > 1 ? 4 : 2, pediment: true, color: '#f2efe4', roofCell: A.roof({ m: 'slate', c: roofC }) });
  chimneyPair(b, x0 + 0.1, (z0 + z1) / 2, s.yTop, s.yRoof + 0.08, 0, brick);
  chimneyPair(b, x1 - 0.1, (z0 + z1) / 2, s.yTop, s.yRoof + 0.08, 0, brick);
  if (level === 3 && wide) {
    for (const side of [-1, 1]) {
      const wx0 = side < 0 ? Math.max(0.05, x0 - 0.38) : x1, wx1 = side < 0 ? x0 : Math.min(lw - 0.05, x1 + 0.38);
      shell(b, { rng, x0: wx0, x1: wx1, z0: z0 + 0.06, z1: z1 - 0.04, floors: 2, fh, bayW: 0.3, m: 'brick', c: brick, trim: '#f2efe4', upperWin: 'sash', roof: { type: 'hip', rise: 0.14, m: 'slate', c: roofC }, lit: 0.45, plinth: true });
    }
    b.dome((x0 + x1) / 2, (z0 + z1) / 2, 0.07, s.yRoof, 0.08, 10, 3, A.roof({ m: 'copper', c: '#5e8a74' }), [1, 1, 1]);
  }
  fence(b, 0.04, ld - 0.04, cx - 0.1, ld - 0.04, 0.05, '#2a2a2c'); fence(b, cx + 0.1, ld - 0.04, lw - 0.04, ld - 0.04, 0.05, '#2a2a2c');
  path(b, cx, z1 + 0.11, ld - 0.03, 0.09);
  yard(b, rng, lw, ld, { x0: x0 - 0.4, x1: x1 + 0.4, z0, z1 }, { treeP: 0.5 });
  return { floors, h: s.yRoof };
}

function georgianApt({ b, rng, lw, ld, level }) {
  const A = b.A;
  const floors = 3 + level;
  const fh = 0.27;
  const brick = pick(rng, GEO.brick), roofC = pick(rng, GEO.slate), dc = pick(rng, GEO.door);
  const r = { x0: 0.06, x1: lw - 0.06, z0: 0.08, z1: ld - 0.14 };
  const common = { rng, x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1, fh, bayW: 0.3, trim: '#f2efe4', lit: 0.55 };
  // rusticated ground floor
  shell(b, { ...common, floors: 1, m: 'stone', c: pick(rng, GEO.stone), upperWin: 'arch', door: { kind: 'door', color: dc }, roof: null, noSides: false });
  const s = shell(b, { ...common, y0: fh, floors: floors - 1, m: 'brick', c: brick, upperWin: 'sash', plinth: false, roof: { type: 'hip', rise: 0.2, m: 'slate', c: roofC, ridgeInset: 0.1 } });
  cornice(b, r.x0, r.z0, r.x1, r.z1, s.yTop, 0.03, 0.028);
  b.box(r.x0 - 0.01, fh - 0.015, r.z0 - 0.01, r.x1 + 0.01, fh + 0.01, r.z1 + 0.012, A.white, '#e6e0d0', { rep: 0, top: A.white });
  const nCh = Math.max(2, Math.round(lw * 2));
  for (let i = 0; i < nCh; i++) chimney(b, r.x0 + 0.18 + ((r.x1 - r.x0 - 0.36) * i) / (nCh - 1), (r.z0 + r.z1) / 2, s.yTop, s.yRoof + 0.07, 0.07, brick);
  // dormers
  const nD = Math.round(lw * 1.5);
  for (let i = 0; i < nD; i++) dormer(b, r.x0 + 0.25 + ((r.x1 - r.x0 - 0.5) * i) / Math.max(1, nD - 1), r.z1 - 0.07, s.yTop + 0.2 * (0.07 / ((r.z1 - r.z0) / 2)), { m: 'brick', c: brick, win: 'sash', rm: 'slate', rc: roofC, lit: rng() < 0.5 });
  if (level >= 2) {
    const cx = (r.x0 + r.x1) / 2;
    portico(b, { x0: cx - 0.2, x1: cx + 0.2, z: r.z1, depth: 0.1, h: fh * 1.1, cols: 4, color: '#f2efe4', roofCell: A.roof({ m: 'slate', c: roofC }) });
  }
  for (let i = 0; i < Math.round(lw * 1.6); i++) b.box(r.x0 + 0.1 + i * 0.32, 0, r.z1, r.x0 + 0.22 + i * 0.32, 0.06, r.z1 + 0.08, A.white, '#b8b2a5', { rep: 0, top: A.white });
  fence(b, 0.04, ld - 0.03, lw - 0.04, ld - 0.03, 0.05, '#2a2a2c');
  return { floors, h: s.yRoof };
}

function georgianShop({ b, rng, lw, ld, level }) {
  const A = b.A;
  const floors = level === 1 ? 2 : 3;
  const fh = 0.28;
  const brick = pick(rng, GEO.brick), roofC = pick(rng, GEO.slate);
  const r = rect(lw, ld, 0.06, 0.18, 0.08);
  const sign = pick(rng, ['#1f2f4a', '#24402d', '#6a1f1f', '#2a2a2c', '#4a3a22']);
  const s = shell(b, { rng, ...r, floors, fh, bayW: 0.32, m: 'brick', c: brick, trim: '#f2efe4', groundWin: 'shop', groundExtra: { sg: sign, aw: null }, upperWin: 'sash', door: { kind: 'door', color: sign }, roof: { type: 'hip', rise: 0.2, m: 'slate', c: roofC, ridgeInset: 0.08 }, lit: 0.55 });
  cornice(b, r.x0, r.z0, r.x1, r.z1, s.yTop, 0.03, 0.025);
  chimneyPair(b, (r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, s.yTop, s.yRoof + 0.07, 0.12, brick);
  if (level >= 2) quoins(b, r.x0, r.z0, r.x1, r.z1, 0, s.yTop);
  awning(b, r.x0 + 0.04, r.x1 - 0.04, r.z1, fh * 0.9, 0.1, pick(rng, ['#1f2f4a', '#6a1f1f', '#24402d']));
  yard(b, rng, lw, ld, r, { n: 1, treeP: 0.3, keepClear: { x0: r.x0, x1: r.x1, z0: r.z1 } });
  return { floors, h: s.yRoof };
}

function georgianOffice({ b, rng, lw, ld, level }) {
  const A = b.A;
  const floors = [3, 5, 7][level - 1] + ((rng() * 2) | 0);
  const fh = 0.28;
  const stone = rng() < 0.55;
  const brick = pick(rng, GEO.brick), roofC = pick(rng, GEO.slate);
  const r = rect(lw, ld, 0.08, 0.2, 0.1);
  const s = shell(b, { rng, ...r, floors, fh, bayW: 0.3, m: stone ? 'stone' : 'brick', c: stone ? pick(rng, GEO.stone) : brick, trim: '#f2efe4', upperWin: 'sash', groundWin: 'arch', door: { kind: 'door', color: '#1f2f4a' }, roof: { type: 'hip', rise: 0.16, m: 'slate', c: roofC, ridgeInset: 0.2 }, lit: 0.55 });
  cornice(b, r.x0, r.z0, r.x1, r.z1, s.yTop, 0.04, 0.035);
  const cx = ctr(r), tz = (r.z0 + r.z1) / 2;
  portico(b, { x0: cx - 0.26, x1: cx + 0.26, z: r.z1, depth: 0.14, h: fh * 1.5, cols: 6, color: '#f2efe4', roofCell: A.roof({ m: 'slate', c: roofC }) });
  // central drum + dome
  const dr = Math.min(0.2, (r.x1 - r.x0) * 0.2);
  b.cyl(cx, tz, dr, s.yRoof - 0.1, s.yRoof + 0.14, 12, A.wall({ m: 'stone', c: '#e0d9c6', w: 'arch', wc: '#f2efe4', fl: 'u' }), [1, 1, 1], { uRep: 6, cap: false });
  b.dome(cx, tz, dr * 1.05, s.yRoof + 0.14, dr * 0.9, 12, 4, A.roof({ m: 'copper', c: '#5e8a74' }), [1, 1, 1]);
  b.cyl(cx, tz, 0.012, s.yRoof + 0.14 + dr * 0.9, s.yRoof + 0.14 + dr * 0.9 + 0.1, 5, A.white, '#d9b34a', { cap: true });
  if (level === 3) {
    for (const sx of [r.x0 + 0.1, r.x1 - 0.1]) { b.box(sx - 0.06, s.yRoof - 0.06, tz - 0.06, sx + 0.06, s.yRoof + 0.2, tz + 0.06, A.wall({ m: 'brick', c: brick, w: 'sash', wc: '#f2efe4', fl: 'u' }), [1, 1, 1], { rep: 0.2, top: A.white }); b.hipRoof(sx - 0.06, tz - 0.06, sx + 0.06, tz + 0.06, s.yRoof + 0.2, 0.12, A.roof({ m: 'slate', c: roofC }), [1, 1, 1], 0.02, 0); }
  }
  fence(b, 0.04, ld - 0.04, lw - 0.04, ld - 0.04, 0.05, '#2a2a2c');
  return { floors, h: s.yRoof + 0.3 };
}

function georgianFactory({ b, rng, lw, ld, level }) {
  const A = b.A;
  const floors = level + 2;
  const fh = 0.27;
  const brick = pick(rng, GEO.brick);
  const r = rect(lw, ld, 0.06, 0.18, 0.1);
  const s = shell(b, { rng, ...r, floors, fh, bayW: 0.26, m: 'brick', c: brick, trim: '#e8e2d0', upperWin: 'arch', groundWin: 'arch', door: { kind: 'garage', color: '#5a4630', bay: 'right' }, roof: { type: 'gable', ridge: 'x', rise: 0.22, m: 'slate', c: '#4b5360' }, lit: 0.4 });
  const cx = ctr(r), tz = r.z1 - 0.01;
  // stair tower with cupola
  b.box(cx - 0.1, 0, tz - 0.0, cx + 0.1, s.yTop + 0.18, tz + 0.1, A.wall({ m: 'brick', c: brick, w: 'arch', wc: '#e8e2d0', fl: 'u' }), [1, 1, 1], { rep: 0.26, top: A.white });
  b.hipRoof(cx - 0.1, tz, cx + 0.1, tz + 0.1, s.yTop + 0.18, 0.12, A.roof({ m: 'slate', c: '#4b5360' }), [1, 1, 1], 0.03, 0);
  smokestack(b, r.x1 - 0.1, r.z0 + 0.12, 0, s.yRoof + 0.3 + level * 0.12, 0.065, brick);
  if (level >= 2) smokestack(b, r.x0 + 0.1, r.z0 + 0.12, 0, s.yRoof + 0.2, 0.05, brick);
  return { floors, h: s.yRoof + 0.3 };
}

// ====================================================================== SOUTHERN
const SOU = {
  clap: ['#f4f1e8', '#efe2bd', '#f0dc9a', '#bfd8df', '#ecc9c0', '#f6f2e6'],
  stucco: ['#e8c4a0', '#efd9a8', '#d9b8c0', '#c9d6b8', '#f0c9a0', '#e5c07b'],
  shut: ['#2c4a35', '#2a2a2c', '#3b4a38', '#1f3a4a'],
  roof: ['#8a9099', '#8c4036', '#5f5f62', '#7a7f86'],
};

function southernHouse({ b, rng, lw, ld, level }) {
  const A = b.A;
  const c = pick(rng, SOU.clap), sh = pick(rng, SOU.shut), roofC = pick(rng, SOU.roof);
  const roofM = roofC === '#5f5f62' ? 'shingle' : 'metal';
  const fh = 0.3;
  if (level === 1) {
    const x0 = lw > 1 ? 0.25 : 0.16, x1 = lw > 1 ? 1.2 : 0.84;
    const z1 = ld - 0.3, z0 = z1 - (ld > 1 ? 0.8 : 0.46);
    const s = shell(b, { rng, x0, x1, z0, z1, floors: 1, fh, bayW: 0.3, m: 'clap', c, trim: '#fbf8ee', shutter: sh, upperWin: 'tall', door: { kind: 'porchdoor', color: sh }, roof: { type: 'gable', ridge: lw > 1 ? 'x' : 'z', rise: 0.26, m: roofM, c: roofC }, lit: 0.5 });
    porch(b, { x0: x0 - 0.02, x1: x1 + 0.02, z: z1, depth: 0.16, h: fh * 0.95, round: true, rail: true, roofType: 'shed', color: '#fbf8ee', roofCell: A.roof({ m: roofM, c: roofC }) });
    chimney(b, x0 + 0.15, (z0 + z1) / 2, s.yTop, s.yRoof + 0.05);
    path(b, (x0 + x1) / 2, z1 + 0.16, ld - 0.02, 0.07);
    yard(b, rng, lw, ld, { x0, x1, z0, z1 }, { treeP: 0.6 });
    return { floors: 1.2, h: s.yRoof };
  }
  if (level === 2) {
    const wd = lw > 1 ? 1.3 : 0.76;
    const x0 = (lw - wd) / 2, x1 = x0 + wd;
    const z1 = ld - 0.32, z0 = z1 - (ld > 1 ? 0.8 : 0.5);
    const s = shell(b, { rng, x0, x1, z0, z1, floors: 2, fh, bayW: 0.3, m: 'clap', c, trim: '#fbf8ee', shutter: sh, upperWin: 'tall', door: { kind: 'porchdoor', color: sh }, roof: { type: 'hip', rise: 0.24, m: roofM, c: roofC, ridgeInset: 0.1 }, lit: 0.5 });
    porch(b, { x0: x0 - 0.02, x1: x1 + 0.02, z: z1, depth: 0.2, h: fh * 2 * 0.97, round: true, rail: false, roofType: 'flat', color: '#fbf8ee', roofColor: '#fbf8ee', roofCell: A.roof({ m: roofM, c: roofC }), steps: true });
    b.box(x0 - 0.02, fh - 0.01, z1 - 0.01, x1 + 0.02, fh + 0.03, z1 + 0.2, A.white, '#fbf8ee', { rep: 0, top: A.white });
    balcony(b, x0, x1, z1, fh + 0.03, 0.2, { color: '#fbf8ee' });
    chimneyPair(b, (x0 + x1) / 2, (z0 + z1) / 2, s.yTop, s.yRoof + 0.07, 0.15);
    path(b, (x0 + x1) / 2, z1 + 0.2, ld - 0.02, 0.08);
    yard(b, rng, lw, ld, { x0, x1, z0, z1 }, { treeP: 0.65 });
    return { floors: 2.1, h: s.yRoof };
  }
  // antebellum mansion
  const wd = lw > 1 ? 1.45 : 0.82;
  const x0 = (lw - wd) / 2, x1 = x0 + wd;
  const z1 = ld - 0.34, z0 = Math.max(0.1, z1 - (ld > 1 ? 0.85 : 0.5));
  const mc = '#fbf8ee';
  const s = shell(b, { rng, x0, x1, z0, z1, floors: 2, fh: 0.31, bayW: 0.3, m: 'clap', c: mc, trim: '#fbf8ee', shutter: sh, upperWin: 'tall', door: { kind: 'porchdoor', color: sh }, roof: { type: 'hip', rise: 0.22, m: roofM === 'metal' ? 'metal' : 'slate', c: roofC, ridgeInset: 0.16 }, lit: 0.5 });
  const cx = (x0 + x1) / 2;
  portico(b, { x0: x0 + 0.04, x1: x1 - 0.04, z: z1, depth: 0.22, h: 0.62, cols: wd > 1 ? 6 : 4, r: 0.026, color: mc, roofCell: A.roof({ m: roofM, c: roofC }) });
  b.box(x0 + 0.04, 0.3, z1, x1 - 0.04, 0.33, z1 + 0.22, A.white, '#fbf8ee', { rep: 0, top: A.white });
  chimneyPair(b, x0 + 0.12, (z0 + z1) / 2, s.yTop, s.yRoof + 0.07, 0, '#8a4b38');
  chimneyPair(b, x1 - 0.12, (z0 + z1) / 2, s.yTop, s.yRoof + 0.07, 0, '#8a4b38');
  b.box(cx - 0.05, s.yRoof, (z0 + z1) / 2 - 0.05, cx + 0.05, s.yRoof + 0.1, (z0 + z1) / 2 + 0.05, A.wall({ m: 'clap', c: mc, w: 'tall', wc: mc, sh: sh, fl: 'u' }), [1, 1, 1], { rep: 0.1, top: A.white });
  b.hipRoof(cx - 0.05, (z0 + z1) / 2 - 0.05, cx + 0.05, (z0 + z1) / 2 + 0.05, s.yRoof + 0.1, 0.08, A.roof({ m: 'copper', c: '#5e8a74' }), [1, 1, 1], 0.02, 0);
  if (lw > 1) for (const side of [-1, 1]) {
    const wx0 = side < 0 ? Math.max(0.04, x0 - 0.3) : x1, wx1 = side < 0 ? x0 : Math.min(lw - 0.04, x1 + 0.3);
    if (wx1 - wx0 > 0.12) shell(b, { rng, x0: wx0, x1: wx1, z0: z0 + 0.1, z1: z1 - 0.1, floors: 1, fh: 0.31, bayW: 0.3, m: 'clap', c: mc, trim: mc, shutter: sh, upperWin: 'tall', roof: { type: 'gable', ridge: 'x', rise: 0.14, m: roofM, c: roofC }, lit: 0.4 });
  }
  path(b, cx, z1 + 0.26, ld - 0.02, 0.1, '#d0c8b4');
  fence(b, 0.03, ld - 0.03, cx - 0.1, ld - 0.03, 0.06); fence(b, cx + 0.1, ld - 0.03, lw - 0.03, ld - 0.03, 0.06);
  // live oaks
  tree(b, 0.14, ld - 0.14, 0.52, 'round', '#3f6f3a', rng); tree(b, lw - 0.14, ld - 0.14, 0.5, 'round', '#477a3f', rng);
  return { floors: 2.5, h: s.yRoof + 0.18 };
}

function southernApt({ b, rng, lw, ld, level }) {
  const A = b.A;
  const floors = 2 + level + ((rng() * 2) | 0);
  const fh = 0.3;
  const c = pick(rng, SOU.stucco), sh = pick(rng, SOU.shut), roofC = pick(rng, SOU.roof);
  const r = { x0: 0.06, x1: lw - 0.06, z0: 0.08, z1: ld - 0.2 };
  const s = shell(b, { rng, ...r, floors, fh, bayW: 0.3, m: 'stucco', c, trim: '#fbf8ee', shutter: sh, upperWin: 'tall', groundWin: 'arch', door: { kind: 'door', color: sh }, roof: { type: rng() < 0.5 ? 'hip' : 'flat', rise: 0.18, parapet: 0.08, m: roofC === '#8c4036' ? 'tile' : 'gravel', c: roofC === '#8c4036' ? '#a8503e' : '#6a6a64', ridgeInset: 0.15 }, lit: 0.55 });
  cornice(b, r.x0, r.z0, r.x1, r.z1, s.yTop, 0.03, 0.03);
  // cast-iron balconies on each upper floor
  for (let f = 1; f < floors; f++) balcony(b, r.x0 + 0.05, r.x1 - 0.05, r.z1, f * fh + 0.01, 0.15, { color: '#26272a', slab: '#8f8a80' });
  // gallery posts to ground
  const nP = Math.max(3, Math.round(lw * 4));
  for (let i = 0; i < nP; i++) { const px = r.x0 + 0.06 + ((r.x1 - r.x0 - 0.12) * i) / (nP - 1); b.box(px - 0.006, 0, r.z1 + 0.14, px + 0.006, fh + 0.01, r.z1 + 0.155, A.white, '#26272a', { rep: 0, top: A.white }); }
  if (level === 3) {
    // courtyard wing and cupola
    const cx = ctr(r);
    b.box(cx - 0.07, s.yRoof, (r.z0 + r.z1) / 2 - 0.07, cx + 0.07, s.yRoof + 0.12, (r.z0 + r.z1) / 2 + 0.07, A.wall({ m: 'stucco', c, w: 'arch', wc: '#fbf8ee', fl: 'u' }), [1, 1, 1], { rep: 0.1, top: A.white });
    b.dome(cx, (r.z0 + r.z1) / 2, 0.085, s.yRoof + 0.12, 0.09, 10, 3, A.roof({ m: 'copper', c: '#5e8a74' }), [1, 1, 1]);
  }
  hvac(b, r.x0 + 0.15, r.z0 + 0.1, s.yRoof - 0.01);
  tree(b, 0.1, ld - 0.08, 0.34, 'round', '#477a3f', rng); tree(b, lw - 0.1, ld - 0.08, 0.34, 'round', '#3f6f3a', rng);
  return { floors, h: s.yRoof };
}

function southernShop({ b, rng, lw, ld, level }) {
  const A = b.A;
  const floors = level === 1 ? 1 : level === 2 ? 2 : 3;
  const fh = 0.3;
  const wood = rng() < 0.6;
  const c = wood ? pick(rng, SOU.clap) : pick(rng, SOU.stucco);
  const sign = pick(rng, ['#2c4a35', '#6a1f1f', '#1f2f4a', '#3a2a1e']);
  const r = rect(lw, ld, 0.06, 0.2, 0.08);
  const roofC = pick(rng, SOU.roof);
  const s = shell(b, { rng, ...r, floors, fh, bayW: 0.32, m: wood ? 'clap' : 'stucco', c, trim: '#fbf8ee', shutter: pick(rng, SOU.shut), groundWin: 'shop', groundExtra: { sg: sign }, upperWin: 'tall', door: { kind: 'porchdoor', color: sign }, roof: floors === 1 ? { type: 'flat', parapet: 0.16, m: 'gravel', c: '#6a6a64', parapetCell: A.wall({ m: wood ? 'clap' : 'stucco', c, w: 'none' }) } : { type: 'hip', rise: 0.2, m: 'metal', c: roofC, ridgeInset: 0.1 }, lit: 0.5 });
  porch(b, { x0: r.x0, x1: r.x1, z: r.z1, depth: 0.17, h: fh * 0.92, round: false, rail: floors === 1, roofType: floors === 1 ? 'shed' : 'flat', color: '#fbf8ee', roofColor: '#fbf8ee', roofCell: A.roof({ m: 'metal', c: roofC }), steps: true });
  if (floors > 1) balcony(b, r.x0, r.x1, r.z1, fh + 0.03, 0.17, { color: '#fbf8ee', slab: '#e8e2d0' });
  b.box(r.x1 - 0.12, 0.0, r.z1 + 0.13, r.x1 - 0.04, 0.07, r.z1 + 0.19, A.white, '#7a5a3d', { rep: 0, top: A.white });
  yard(b, rng, lw, ld, r, { n: 1, treeP: 0.8, keepClear: { x0: r.x0, x1: r.x1, z0: r.z1 } });
  return { floors, h: s.yRoof };
}

function southernOffice({ b, rng, lw, ld, level }) {
  const A = b.A;
  const floors = [3, 5, 7][level - 1] + ((rng() * 2) | 0);
  const fh = 0.3;
  const c = pick(rng, SOU.stucco), roofC = pick(rng, SOU.roof);
  const r = rect(lw, ld, 0.08, 0.34, 0.1);
  const s = shell(b, { rng, ...r, floors, fh, bayW: 0.3, m: rng() < 0.5 ? 'stucco' : 'clap', c: rng() < 0.5 ? c : '#f4f1e8', trim: '#fbf8ee', shutter: pick(rng, SOU.shut), upperWin: 'tall', groundWin: 'arch', door: { kind: 'door', color: '#2c4a35' }, roof: { type: 'hip', rise: 0.2, m: 'metal', c: roofC, ridgeInset: 0.2 }, lit: 0.55 });
  cornice(b, r.x0, r.z0, r.x1, r.z1, s.yTop, 0.035, 0.03);
  const gal = Math.min(floors, 3);
  porch(b, { x0: r.x0 - 0.02, x1: r.x1 + 0.02, z: r.z1, depth: 0.22, h: gal * fh * 0.98, round: true, cols: Math.max(4, Math.round(lw * 4)), rail: false, roofType: 'flat', color: '#fbf8ee', roofColor: '#fbf8ee', roofCell: A.roof({ m: 'metal', c: roofC }) });
  for (let f = 1; f < gal; f++) balcony(b, r.x0 - 0.02, r.x1 + 0.02, r.z1, f * fh + 0.03, 0.22, { color: '#fbf8ee', slab: '#e8e2d0' });
  const cx = ctr(r), tz = (r.z0 + r.z1) / 2;
  b.box(cx - 0.09, s.yRoof, tz - 0.09, cx + 0.09, s.yRoof + 0.16, tz + 0.09, A.wall({ m: 'clap', c: '#fbf8ee', w: 'arch', wc: '#fbf8ee', fl: 'u' }), [1, 1, 1], { rep: 0.12, top: A.white });
  b.hipRoof(cx - 0.09, tz - 0.09, cx + 0.09, tz + 0.09, s.yRoof + 0.16, 0.16, A.roof({ m: 'copper', c: '#5e8a74' }), [1, 1, 1], 0.03, 0);
  tree(b, 0.12, ld - 0.1, 0.5, 'round', '#3f6f3a', rng); tree(b, lw - 0.12, ld - 0.1, 0.46, 'round', '#477a3f', rng);
  return { floors, h: s.yRoof + 0.3 };
}

function southernFactory({ b, rng, lw, ld, level }) {
  const A = b.A;
  const floors = level === 1 ? 1 : 2;
  const fh = 0.38;
  const r = rect(lw, ld, 0.06, 0.2, 0.1);
  const c = pick(rng, ['#b8b4a8', '#9aa0a0', '#a89a82', '#8f9a94']);
  const s = shell(b, { rng, ...r, floors, fh, bayW: 0.36, m: 'metal', c, trim: '#d8d4c8', upperWin: 'slit', groundWin: 'slit', door: { kind: 'loading', color: '#8a3e2c', bay: 'right' }, roof: { type: 'gable', ridge: 'x', rise: 0.16, m: 'metal', c: pick(rng, ['#8c4036', '#8a9099', '#6e757c']) }, lit: 0.3 });
  smokestack(b, r.x1 - 0.1, r.z0 + 0.14, 0, s.yRoof + 0.25 + level * 0.12, 0.06, '#8a4b38');
  // loading platform
  b.box(r.x0, 0, r.z1, r.x1, 0.07, r.z1 + 0.1, A.white, '#b2a68e', { rep: 0, top: A.white });
  // cotton bales
  for (let i = 0; i < 6; i++) b.box(0.12 + i * 0.1 % (lw - 0.2), 0.07, r.z1 + 0.03, 0.2 + i * 0.1 % (lw - 0.2), 0.12, r.z1 + 0.08, A.white, '#ece6d4', { rep: 0, top: A.white });
  if (level >= 2) { b.cyl(r.x0 + 0.12, r.z0 + 0.14, 0.09, 0, 0.42, 10, A.white, '#9aa0a0', { r1: 0.09 }); b.cyl(r.x0 + 0.34, r.z0 + 0.14, 0.09, 0, 0.42, 10, A.white, '#9aa0a0', { r1: 0.09 }); }
  return { floors: floors + 0.5, h: s.yRoof };
}

// ====================================================================== AMERICAN
const AMER = {
  siding: ['#cfe0e8', '#e8d9a8', '#b7c9a0', '#d9a8a0', '#c8513f', '#7d95b0', '#eeeeee', '#e0c8a0'],
  paint: [['#c0575a', '#f1e6b8'], ['#4c7aa8', '#f0e8d0'], ['#6a8f5a', '#f3ead0'], ['#8a5a8f', '#f1e6c8'], ['#d9a441', '#3d5a6b']],
  brick: ['#8e4733', '#9a5035', '#7a3d30', '#a35c3f'],
  roof: ['#4a4a4e', '#5a4a40', '#3b4a3b', '#6a4a3a'],
};

function americanHouse({ b, rng, lw, ld, level }) {
  const A = b.A;
  const roofC = pick(rng, AMER.roof);
  const fh = 0.27;
  const garage = lw > 1;
  const c = pick(rng, AMER.siding);
  if (level === 3) {
    // Victorian "painted lady"
    const [pc, tc] = pick(rng, AMER.paint);
    const bw = lw > 1 ? 1.0 : 0.66;
    const x0 = lw > 1 ? 0.28 : 0.17, x1 = x0 + bw;
    const z1 = ld - 0.26, z0 = Math.max(0.1, z1 - (ld > 1 ? 0.78 : 0.46));
    const s = shell(b, { rng, x0, x1, z0, z1, floors: 2, fh: 0.28, bayW: 0.28, m: 'clap', c: pc, trim: tc, shutter: null, upperWin: 'sash', door: { kind: 'door', color: tc, bay: 'right' }, roof: { type: 'gable', ridge: 'x', rise: 0.26, m: 'shingle', c: roofC }, lit: 0.5 });
    // cross gable at front
    b.gable(x0 + 0.04, z1 - 0.18, x0 + bw * 0.45, z1 + 0.06, s.yTop - 0.02, 0.2, 'z', A.roof({ m: 'shingle', c: roofC }), [1, 1, 1], A.wall({ m: 'clap', c: tc, w: 'plainw' }), [1, 1, 1], 0.02);
    b.box(x0 + 0.04, 0, z1 - 0.18, x0 + bw * 0.45, 0.56, z1 + 0.06, A.wall({ m: 'clap', c: pc, w: 'sash', wc: tc, fl: 'u' }), [1, 1, 1], { rep: 0.3, top: A.white, noTop: false });
    // turret
    const tx = x1 - 0.02, tz = z1 - 0.02;
    b.cyl(tx, tz, 0.1, 0, 0.62, 10, A.wall({ m: 'clap', c: pc, w: 'sash', wc: tc, fl: 'u' }), [1, 1, 1], { uRep: 5, cap: false });
    b.pyramid(tx, tz, 0.13, 0.62, 0.95, 10, A.roof({ m: 'slate', c: '#4b4b55' }), [1, 1, 1], 0, true);
    b.cyl(tx, tz, 0.006, 0.95, 1.05, 4, A.white, '#d9b34a', {});
    porch(b, { x0: x0 - 0.02, x1: x1 - 0.1, z: z1, depth: 0.14, h: 0.24, round: false, rail: true, roofType: 'shed', color: tc, railColor: tc, roofCell: A.roof({ m: 'shingle', c: roofC }) });
    chimney(b, x0 + 0.15, (z0 + z1) / 2, s.yTop, s.yRoof + 0.08);
    path(b, x1 - 0.2, z1 + 0.14, ld - 0.02, 0.07);
    fence(b, 0.03, ld - 0.03, lw - 0.03, ld - 0.03, 0.05, tc);
    yard(b, rng, lw, ld, { x0, x1, z0, z1 }, { treeP: 0.5 });
    return { floors: 2.6, h: 1.05 };
  }
  const floors = level === 1 ? 1 : 2;
  const bw = garage ? 0.95 : 0.66;
  const x0 = garage ? 0.12 : 0.17, x1 = x0 + bw;
  const z1 = ld - 0.24, z0 = Math.max(0.1, z1 - (ld > 1 ? 0.7 : 0.46));
  const useBrick = rng() < 0.2;
  const s = shell(b, { rng, x0, z0, x1, z1, floors, fh, bayW: 0.3, m: useBrick ? 'brick' : 'clap', c: useBrick ? pick(rng, AMER.brick) : c, trim: '#f6f3ea', shutter: rng() < 0.5 ? pick(rng, ['#2f4a3a', '#3a3a42', '#7a2f2a']) : null, upperWin: 'sash', door: { kind: 'door', color: pick(rng, ['#7a2f2a', '#2f4a3a', '#2a3b55']), bay: garage ? 'right' : 'center' }, roof: { type: 'gable', ridge: level === 1 && !garage ? 'z' : 'x', rise: 0.22, m: 'shingle', c: roofC }, lit: 0.5 });
  const cx = (x0 + x1) / 2;
  if (floors === 2) dormer(b, x0 + bw * 0.5, z1 - 0.05, s.yTop + 0.22 * (0.05 / ((z1 - z0) / 2)), { m: 'clap', c, trim: '#f6f3ea', rm: 'shingle', rc: roofC, lit: rng() < 0.5 });
  chimney(b, x1 - 0.14, (z0 + z1) / 2, s.yTop, s.yRoof + 0.07, 0.075, pick(rng, AMER.brick));
  porch(b, { x0: x0 + 0.04, x1: x0 + Math.min(0.5, bw * 0.7), z: z1, depth: 0.12, h: fh * 0.92, round: false, rail: true, roofType: 'shed', color: '#f6f3ea', roofCell: A.roof({ m: 'shingle', c: roofC }) });
  if (garage) {
    const gx0 = x1, gx1 = Math.min(lw - 0.06, x1 + 0.42);
    shell(b, { rng, x0: gx0, x1: gx1, z0: z0 + 0.1, z1: z1 + 0.04, floors: 1, fh: 0.25, bayW: 0.4, m: 'clap', c, trim: '#f6f3ea', upperWin: 'garage', groundWin: 'garage', roof: { type: 'gable', ridge: 'z', rise: 0.1, m: 'shingle', c: roofC }, lit: 0 });
    b.flatQuad(gx0 + 0.02, z1 + 0.04, gx1 - 0.02, ld, 0.01, A.white, '#7e7f82');
  }
  path(b, x0 + 0.2, z1 + 0.12, ld - 0.02, 0.06);
  yard(b, rng, lw, ld, { x0, x1: x1 + 0.45, z0, z1 }, { treeP: 0.45 });
  return { floors: floors + 0.3, h: s.yRoof };
}

function americanApt({ b, rng, lw, ld, level }) {
  const A = b.A;
  const brick = pick(rng, AMER.brick);
  const fh = 0.26;
  if (level === 3) {
    // Art Deco tower with setbacks
    const floors = 11 + ((rng() * 4) | 0);
    const stone = pick(rng, ['#d8cfb8', '#c9c1ad', '#cfc8b6']);
    const tiers = [[0.06, 0.06, 0.55], [0.18, 0.18, 0.8], [0.3, 0.3, 1]];
    let y = 0, topH = 0;
    const r0 = { x0: 0.06, x1: lw - 0.06, z0: 0.08, z1: ld - 0.14 };
    const tierFloors = [Math.round(floors * 0.55), Math.round(floors * 0.25), floors - Math.round(floors * 0.55) - Math.round(floors * 0.25)];
    for (let t = 0; t < 3; t++) {
      const ins = t * 0.18;
      const rr = { x0: r0.x0 + ins, x1: r0.x1 - ins, z0: r0.z0 + ins * 0.8, z1: r0.z1 - ins * 0.8 };
      const f = Math.max(1, tierFloors[t]);
      const s = shell(b, { rng, ...rr, y0: y, floors: f, fh, bayW: 0.3, m: 'brick', c: t === 0 ? brick : stone, trim: '#e8e2d0', upperWin: 'deco', groundWin: t === 0 ? 'arch' : 'deco', door: t === 0 ? { kind: 'door', color: '#2a3b55' } : undefined, plinth: t === 0, roof: { type: 'flat', parapet: 0.04, m: 'gravel', c: '#6a6a64' }, lit: 0.6, tint: [1, 1, 1] });
      cornice(b, rr.x0, rr.z0, rr.x1, rr.z1, s.yTop, 0.03, 0.02, '#e8e2d0');
      y = s.yTop; topH = y;
    }
    const cx = (r0.x0 + r0.x1) / 2, cz = (r0.z0 + r0.z1) / 2;
    b.pyramid(cx, cz, 0.14, topH, topH + 0.28, 4, A.roof({ m: 'copper', c: '#6a8a7a' }), [1, 1, 1], Math.PI / 4);
    b.cyl(cx, cz, 0.008, topH + 0.28, topH + 0.5, 4, A.white, '#c9c9c9', {});
    return { floors, h: topH + 0.5 };
  }
  const floors = level === 1 ? 4 : 6;
  const r = { x0: 0.06, x1: lw - 0.06, z0: 0.08, z1: ld - 0.14 };
  const s = shell(b, { rng, ...r, floors, fh, bayW: 0.3, m: 'brick', c: brick, trim: '#efe9d8', upperWin: 'sash', door: { kind: 'door', color: pick(rng, ['#2a3b55', '#2f4a3a', '#7a2f2a']) }, roof: { type: 'flat', parapet: 0.05, m: 'gravel', c: '#5f5f5a' }, lit: 0.55 });
  cornice(b, r.x0, r.z0, r.x1, r.z1, s.yTop, 0.045, 0.04, '#d8cfb8');
  quoins(b, r.x0, r.z0, r.x1, r.z1, 0, s.yTop, '#d8cfb8');
  // stoop & fire escape
  const cx = ctr(r);
  b.box(cx - 0.1, 0, r.z1, cx + 0.1, 0.07, r.z1 + 0.12, A.white, '#a9a496', { rep: 0, top: A.white });
  for (let f = 1; f < floors; f++) {
    b.box(r.x0 + 0.12, f * fh, r.z1, r.x0 + 0.38, f * fh + 0.012, r.z1 + 0.07, A.white, '#26272a', { rep: 0, top: A.white });
    b.box(r.x0 + 0.12, f * fh, r.z1 + 0.065, r.x0 + 0.38, f * fh + 0.06, r.z1 + 0.07, A.white, '#26272a', { rep: 0 });
  }
  hvac(b, r.x1 - 0.2, r.z0 + 0.1, s.yTop + 0.05);
  if (level === 2) waterTank(b, r.x0 + 0.2, r.z0 + 0.2, s.yTop + 0.05, 0.07);
  tree(b, 0.1, ld - 0.07, 0.3, 'round', '#4a8a3e', rng);
  return { floors, h: s.yRoof + 0.25 };
}

function americanShop({ b, rng, lw, ld, level }) {
  const A = b.A;
  const floors = level === 1 ? 1 : 2;
  const fh = 0.3;
  const brick = rng() < 0.65;
  const c = brick ? pick(rng, AMER.brick) : pick(rng, AMER.siding);
  const r = { x0: 0.03, x1: lw - 0.03, z0: 0.08, z1: ld - 0.2 };
  const sign = pick(rng, ['#2a3b55', '#7a2f2a', '#2f4a3a', '#3a2a1e', '#a37a2c']);
  const awC = pick(rng, ['#b8372f', '#2e6a47', '#2b4a7a', '#c9892b']);
  const s = shell(b, { rng, ...r, floors, fh, bayW: 0.33, m: brick ? 'brick' : 'clap', c, trim: '#f6f3ea', groundWin: 'shop', groundExtra: { sg: sign }, upperWin: 'sash', door: { kind: 'door', color: sign }, roof: { type: 'flat', parapet: 0.14 + level * 0.03, m: 'gravel', c: '#5f5f5a', parapetCell: A.wall({ m: brick ? 'brick' : 'clap', c, w: 'none' }) }, lit: 0.55 });
  cornice(b, r.x0, r.z0, r.x1, r.z1, s.yTop + 0.15, 0.04, 0.03, '#efe9d8');
  awning(b, r.x0 + 0.02, r.x1 - 0.02, r.z1, fh * 0.92, 0.12, awC);
  // sign board on parapet
  b.wall(r.x0 + 0.1, r.z1 + 0.012, 0, 1, Math.min(0.5, (r.x1 - r.x0) - 0.2), s.yTop + 0.01, s.yTop + 0.13, A.decal('sign:' + sign, (ctx, S) => { ctx.fillStyle = sign; ctx.fillRect(0, 0, S, S); ctx.fillStyle = '#f2e6bd'; ctx.fillRect(6, 14, S - 12, 8); ctx.fillRect(14, 30, S - 28, 6); ctx.fillRect(10, 44, S - 20, 6); }), [1, 1, 1], 0, 0);
  if (level === 3) {
    // corner pylon sign
    b.box(lw - 0.12, 0, ld - 0.1, lw - 0.1, 0.5, ld - 0.08, A.white, '#444', { rep: 0 });
    b.box(lw - 0.2, 0.4, ld - 0.115, lw - 0.02, 0.55, ld - 0.075, A.decal('pylon', (ctx, S) => { ctx.fillStyle = '#c0392b'; ctx.fillRect(0, 0, S, S); ctx.fillStyle = '#fff'; ctx.fillRect(8, 20, S - 16, 8); ctx.fillRect(8, 36, S - 30, 6); }), '#fff', { rep: 0, top: A.white });
  }
  b.flatQuad(0.05, r.z1 + 0.12, lw - 0.05, ld - 0.01, 0.008, A.white, '#7e7f82');
  hvac(b, r.x0 + 0.2, r.z0 + 0.1, s.yTop + 0.01);
  return { floors, h: s.yTop + 0.2 };
}

function americanOffice({ b, rng, lw, ld, level }) {
  const A = b.A;
  const brick = pick(rng, AMER.brick);
  const fh = 0.26;
  const r0 = { x0: 0.08, x1: lw - 0.08, z0: 0.1, z1: ld - 0.18 };
  if (level === 1) {
    const s = shell(b, { rng, ...r0, floors: 4, fh, bayW: 0.3, m: 'brick', c: brick, trim: '#efe9d8', upperWin: 'sash', groundWin: 'shop', groundExtra: { sg: '#2a3b55' }, door: { kind: 'door', color: '#2a3b55' }, roof: { type: 'flat', parapet: 0.07, m: 'gravel', c: '#5f5f5a' }, lit: 0.55 });
    cornice(b, r0.x0, r0.z0, r0.x1, r0.z1, s.yTop, 0.045, 0.04, '#d8cfb8');
    awning(b, r0.x0 + 0.04, r0.x1 - 0.04, r0.z1, fh * 0.92, 0.1, '#2b4a7a');
    waterTank(b, r0.x0 + 0.2, r0.z0 + 0.2, s.yTop + 0.07, 0.07);
    return { floors: 4, h: s.yRoof + 0.3 };
  }
  // stepped art-deco / limestone skyscraper
  const floors = level === 2 ? 8 + ((rng() * 3) | 0) : 15 + ((rng() * 6) | 0);
  const stone = pick(rng, ['#d8cfb8', '#c9c1ad', '#cfc8b6', '#b9b2a0']);
  const tiers = floors > 12 ? 3 : 2;
  const fl = tiers === 3 ? [Math.round(floors * 0.5), Math.round(floors * 0.28)] : [Math.round(floors * 0.65)];
  fl.push(floors - fl.reduce((a, c) => a + c, 0));
  let y = 0;
  let last = r0;
  for (let t = 0; t < tiers; t++) {
    const ins = t * (level === 3 ? 0.16 : 0.12);
    const rr = { x0: r0.x0 + ins, x1: r0.x1 - ins, z0: r0.z0 + ins * 0.7, z1: r0.z1 - ins * 0.7 };
    const s = shell(b, { rng, ...rr, y0: y, floors: Math.max(1, fl[t]), fh, bayW: 0.28, m: level === 3 ? 'stone' : 'stone', c: stone, trim: '#e8e2d0', upperWin: 'deco', groundWin: t === 0 ? 'arch' : 'deco', door: t === 0 ? { kind: 'door', color: '#2a3b55' } : undefined, plinth: t === 0, roof: { type: 'flat', parapet: 0.04, m: 'gravel', c: '#6a6a64' }, lit: 0.6 });
    cornice(b, rr.x0, rr.z0, rr.x1, rr.z1, s.yTop, 0.03, 0.02, '#efe9d8');
    y = s.yTop; last = rr;
  }
  const cx = (last.x0 + last.x1) / 2, cz = (last.z0 + last.z1) / 2;
  if (level === 3) {
    b.pyramid(cx, cz, 0.13, y, y + 0.26, 4, A.roof({ m: 'copper', c: '#6a8a7a' }), [1, 1, 1], Math.PI / 4);
    b.cyl(cx, cz, 0.008, y + 0.26, y + 0.55, 4, A.white, '#c9c9c9', {});
  } else {
    waterTank(b, cx - 0.1, cz, y + 0.04, 0.06);
  }
  awning(b, r0.x0 + 0.05, r0.x1 - 0.05, r0.z1, fh * 0.9, 0.1, '#7a2f2a');
  return { floors, h: y + 0.55 };
}

function americanFactory({ b, rng, lw, ld, level }) {
  const A = b.A;
  const fh = 0.34;
  const floors = level === 3 ? 2 : 1;
  const r = rect(lw, ld, 0.05, 0.22, 0.08);
  const brick = pick(rng, AMER.brick);
  const s = shell(b, { rng, ...r, floors, fh, bayW: 0.3, m: 'brick', c: brick, trim: '#d8d2c2', upperWin: 'slit', groundWin: 'sash', door: { kind: 'loading', color: '#8a8f94', bay: 'right' }, roof: null, lit: 0.3 });
  // sawtooth roof
  const roofCell = A.roof({ m: 'metal', c: '#7a8088' });
  const glass = A.wall({ m: 'plain', c: '#5d7089', w: 'curtain', gl: 'blue', fl: 'u' });
  const teeth = Math.max(2, Math.round((r.x1 - r.x0) / 0.36));
  const tw = (r.x1 - r.x0) / teeth, rise = 0.14;
  for (let i = 0; i < teeth; i++) {
    const xa = r.x0 + i * tw, xb = xa + tw;
    b.grid([xa, s.yTop, r.z1], [xa, s.yTop, r.z0], [xb, s.yTop + rise, r.z0], [xb, s.yTop + rise, r.z1], Math.max(1, Math.round((r.z1 - r.z0) / 0.5)), 1, roofCell, [1, 1, 1], [-0.3, 1, 0]);
    b.quad([xb, s.yTop, r.z1], [xb, s.yTop, r.z0], [xb, s.yTop + rise, r.z0], [xb, s.yTop + rise, r.z1], glass, [1, 1, 1], { out: [1, 0, 0] });
  }
  b.tri([r.x0, s.yTop, r.z1], [r.x0, s.yTop, r.z0], [r.x0 + 0.0, s.yTop, r.z0], A.white, [1, 1, 1], {});
  smokestack(b, r.x1 - 0.12, r.z0 + 0.12, 0, s.yTop + 0.5 + level * 0.12, 0.065, brick);
  waterTank(b, r.x0 + 0.2, r.z0 + 0.2, s.yTop + 0.1, 0.08);
  b.flatQuad(0.03, r.z1 + 0.02, lw - 0.03, ld - 0.02, 0.008, A.white, '#6f7073');
  if (level >= 2) { for (let i = 0; i < 2; i++) b.cyl(r.x0 + 0.1 + i * 0.2, r.z1 + 0.12, 0.07, 0, 0.36, 10, A.white, '#b9b8b0', { r1: 0.07 }); }
  return { floors: floors + 0.5, h: s.yTop + 0.7 };
}

// ====================================================================== MODERN
const MOD = {
  conc: ['#cfcdc6', '#bdbbb4', '#d8d6cf'],
  white: ['#f1f0ea', '#e9e8e2'],
  wood: ['#a67c52', '#8d6a45', '#b58c5d'],
  dark: ['#3c4146', '#4a4f55', '#2f3438'],
  glass: ['teal', 'blue', 'green', 'dark'],
  glassC: { teal: '#5aa4ba', blue: '#6d90b5', green: '#5f9a8e', dark: '#4a5566' },
};

function modernHouse({ b, rng, lw, ld, level }) {
  const A = b.A;
  const fh = 0.26;
  const base = pick(rng, [...MOD.white, ...MOD.conc]);
  const accent = rng() < 0.5 ? pick(rng, MOD.wood) : pick(rng, MOD.dark);
  const glass = pick(rng, MOD.glass);
  const wd = lw > 1 ? 1.2 : 0.7;
  const x0 = (lw - wd) / 2, x1 = x0 + wd;
  const z1 = ld - 0.22, z0 = Math.max(0.1, z1 - (ld > 1 ? 0.75 : 0.5));
  const mk = (xa, xb, za, zb, y0, fl, m, c, win, roofSolar) => shell(b, { rng, x0: xa, x1: xb, z0: za, z1: zb, y0, floors: fl, fh, bayW: 0.42, m, c, trim: '#d5d3cc', gl: glass, upperWin: win, groundWin: win === 'ribbon' ? 'casement' : win, roof: { type: 'flat', parapet: 0.025, m: roofSolar ? 'solar' : 'gravel', c: '#6e6e6a' }, plinth: y0 === 0, plinthTint: '#6a6a66', lit: 0.5 });
  if (level === 1) {
    const s = mk(x0, x1, z0, z1, 0, 1, 'conc', base, 'ribbon', false);
    const s2 = mk(x0 + 0.1, x0 + wd * 0.55, z0 + 0.04, z1 - 0.14, s.yTop + 0.03, 1, 'wood', accent, 'ribbon', true);
    b.box(x1 - 0.2, 0, z1 - 0.1, x1, 0.02, z1 + 0.14, A.white, '#7e7f82', { rep: 0 });
    // door slab
    b.box(x0 + wd * 0.62, 0, z1 + 0.001, x0 + wd * 0.62 + 0.1, 0.19, z1 + 0.006, A.white, '#c0392b', { rep: 0 });
    b.flatQuad(x0 + wd * 0.5, z1, x0 + wd * 0.5 + 0.12, ld - 0.02, 0.01, A.white, '#aaa9a2');
    b.box(x0 + wd * 0.3, s.yTop - 0.04, z1, x0 + wd * 0.55, s.yTop, z1 + 0.14, A.white, '#3c4146', { rep: 0, top: A.white });
    yard(b, rng, lw, ld, { x0, x1, z0, z1 }, { treeP: 0.4, greens: ['#5a9a46', '#6aa84f'] });
    return { floors: 1.8, h: s2.yRoof };
  }
  if (level === 2) {
    const s = mk(x0, x1, z0, z1, 0, 1, 'conc', base, 'ribbon', false);
    const s2 = mk(x0 - 0.06, x1 - 0.2, z0 + 0.02, z1 + 0.1, s.yTop + 0.03, 1, 'wood', accent, 'curtain', false);
    b.cyl(x0 - 0.02, z1 + 0.08, 0.012, 0, s.yTop + 0.03, 6, A.white, '#3c4146', {});
    balcony(b, x1 - 0.2, x1, z1 - 0.12, s.yTop + 0.03, 0.12, { color: '#8fb4c4', slab: '#cfcdc6' });
    const s3 = mk(x0 + 0.1, x0 + 0.6, z0 + 0.15, z1 - 0.2, s2.yTop + 0.03, 1, 'plain', '#f1f0ea', 'ribbon', true);
    b.flatQuad(x1 - 0.25, z1 + 0.02, x1 - 0.02, ld - 0.02, 0.01, A.white, '#7e7f82');
    yard(b, rng, lw, ld, { x0, x1, z0, z1 }, { treeP: 0.35, greens: ['#5a9a46', '#6aa84f'] });
    return { floors: 2.3, h: s3.yRoof };
  }
  // glass villa with pool
  const s = mk(x0, x1, z0, z1, 0, 1, 'conc', base, 'curtain', false);
  const s2 = mk(x0 + 0.05, x1 - 0.35, z0 + 0.05, z1 - 0.1, s.yTop + 0.03, 1, 'conc', MOD.white[0], 'ribbon', false);
  const s3 = mk(x1 - 0.55, x1 - 0.05, z0 + 0.05, z1 + 0.06, s.yTop + 0.03, 1, 'wood', accent, 'curtain', false);
  b.box(x0 + 0.1, s2.yTop - 0.02, z0 + 0.12, x1 - 0.4, s2.yTop + 0.04, z1 - 0.15, A.white, '#3c4146', { rep: 0, top: A.roof({ m: 'solar', c: '#16233a' }), topRep: 0.3 });
  // pool
  const pz0 = Math.max(0.05, ld - 0.58), pz1 = ld - 0.28;
  b.flatQuad(0.12, ld - 0.5, 0.52, ld - 0.14, 0.014, A.roof({ m: 'water', c: '#3fa9c9' }), '#ffffff');
  b.flatQuad(0.08, ld - 0.54, 0.56, ld - 0.1, 0.008, A.white, '#d8d3c6');
  yard(b, rng, lw, ld, { x0, x1, z0, z1 }, { treeP: 0.5, greens: ['#5a9a46', '#6aa84f', '#3f7a3a'] });
  return { floors: 2.6, h: s3.yRoof };
}

function modernApt({ b, rng, lw, ld, level }) {
  const A = b.A;
  const fh = level === 3 ? 0.24 : 0.26;
  const floors = level === 1 ? 4 : level === 2 ? 7 + ((rng() * 2) | 0) : 14 + ((rng() * 4) | 0);
  const glass = pick(rng, MOD.glass);
  const base = pick(rng, [...MOD.white, ...MOD.conc]);
  const r = { x0: 0.08, x1: lw - 0.08, z0: 0.1, z1: ld - 0.16 };
  if (level < 3) {
    const s = shell(b, { rng, ...r, floors, fh, bayW: 0.34, m: 'conc', c: base, trim: '#d5d3cc', gl: glass, upperWin: 'casement', groundWin: 'curtain', door: { kind: 'door', color: '#3c4146' }, roof: { type: 'flat', parapet: 0.04, m: 'gravel', c: '#6e6e6a' }, lit: 0.55 });
    for (let f = 1; f < floors; f++) balcony(b, r.x0 + 0.04, r.x1 - 0.04, r.z1, f * fh, 0.09, { color: '#a8c8d6', slab: '#cfcdc6' });
    b.box(r.x0, 0.2, r.z1, r.x1, 0.23, r.z1 + 0.12, A.white, '#3c4146', { rep: 0, top: A.white });
    hvac(b, r.x0 + 0.1, r.z0 + 0.1, s.yTop + 0.04);
    b.box(r.x1 - 0.4, s.yTop + 0.04, r.z0 + 0.1, r.x1 - 0.1, s.yTop + 0.05, r.z0 + 0.4, A.roof({ m: 'solar', c: '#16233a' }), '#ffffff', { rep: 0, top: A.roof({ m: 'solar', c: '#16233a' }) });
    tree(b, 0.1, ld - 0.07, 0.3, 'round', '#5a9a46', rng);
    return { floors, h: s.yRoof };
  }
  // stepped tower
  let y = 0;
  const tiers = 3;
  const per = [Math.round(floors * 0.5), Math.round(floors * 0.3)];
  per.push(floors - per[0] - per[1]);
  let rr = r;
  for (let t = 0; t < tiers; t++) {
    const ins = t * 0.17;
    rr = { x0: r.x0 + ins, x1: r.x1 - ins, z0: r.z0 + ins * 0.6, z1: r.z1 - ins * 0.6 };
    const s = shell(b, { rng, ...rr, y0: y, floors: Math.max(1, per[t]), fh, bayW: 0.3, m: 'glass', c: MOD.glassC[glass], trim: '#d5d3cc', gl: glass, upperWin: 'curtain', groundWin: t === 0 ? 'curtain' : 'curtain', door: t === 0 ? { kind: 'door', color: '#3c4146' } : undefined, plinth: t === 0, roof: { type: 'flat', parapet: 0.03, m: 'gravel', c: '#6e6e6a' }, lit: 0.6 });
    if (t < tiers - 1) {
      // terrace garden
      b.flatQuad(r.x0 + ins + 0.02, rr.z1 + 0.0, r.x1 - ins - 0.02, rr.z1 + 0.0, s.yTop + 0.04, A.white, '#5a9a46');
      b.flatQuad(rr.x0 + 0.02, rr.z1 - 0.05, rr.x1 - 0.02, rr.z1 + 0.08, s.yTop + 0.012, A.roof({ m: 'grass', c: '#5a9a46' }), '#ffffff');
    }
    y = s.yTop;
  }
  b.cyl((rr.x0 + rr.x1) / 2, (rr.z0 + rr.z1) / 2, 0.006, y, y + 0.35, 4, A.white, '#c9c9c9', {});
  return { floors, h: y + 0.35 };
}

function modernShop({ b, rng, lw, ld, level }) {
  const A = b.A;
  const floors = level === 3 ? 2 : level;
  const fh = 0.32;
  const glass = pick(rng, MOD.glass);
  const base = pick(rng, [...MOD.white, ...MOD.dark, ...MOD.conc]);
  const r = { x0: 0.05, x1: lw - 0.05, z0: 0.08, z1: ld - 0.24 };
  const s = shell(b, { rng, ...r, floors, fh, bayW: 0.4, m: 'conc', c: base, trim: '#e0ded6', gl: glass, upperWin: 'ribbon', groundWin: 'curtain', groundExtra: { c: MOD.glassC[glass] }, door: { kind: 'door', color: '#3c4146' }, roof: { type: 'flat', parapet: 0.03, m: 'gravel', c: '#6e6e6a' }, lit: 0.6 });
  b.box(r.x0 - 0.02, floors * fh - 0.04, r.z1, r.x1 + 0.02, floors * fh, r.z1 + 0.18, A.white, '#3c4146', { rep: 0, top: A.white });
  const sign = pick(rng, ['#e84a5f', '#2a9d8f', '#e9c46a', '#264653', '#f4a261']);
  b.box(r.x0 + 0.1, s.yTop + 0.03, r.z1 - 0.02, r.x0 + 0.1 + Math.min(0.5, lw * 0.4), s.yTop + 0.15, r.z1 + 0.01, A.decal('msign:' + sign, (ctx, S) => { ctx.fillStyle = sign; ctx.fillRect(0, 0, S, S); ctx.fillStyle = '#fff'; ctx.fillRect(8, 22, S - 16, 8); ctx.fillRect(8, 38, S - 30, 5); }), '#fff', { rep: 0, top: A.white });
  b.flatQuad(0.03, r.z1 + 0.18, lw - 0.03, ld - 0.02, 0.008, A.white, '#707173');
  for (let i = 0; i < Math.round(lw * 3); i++) b.box(0.1 + i * 0.3, 0.008, r.z1 + 0.22, 0.102 + i * 0.3, 0.009, ld - 0.04, A.white, '#e8e8e8', { rep: 0 });
  hvac(b, r.x1 - 0.2, r.z0 + 0.1, s.yTop + 0.03);
  if (level === 3) b.box(r.x0 + 0.2, s.yTop + 0.03, r.z0 + 0.2, r.x0 + 0.5, s.yTop + 0.12, r.z0 + 0.4, A.wall({ m: 'glass', c: MOD.glassC[glass], w: 'curtain', gl: glass, fl: 'u' }), '#fff', { rep: 0.2, top: A.white });
  tree(b, lw - 0.08, ld - 0.08, 0.3, 'round', '#5a9a46', rng);
  return { floors, h: s.yTop + 0.15 };
}

function polyTower(b, cx, cz, rad, sides, y0, floors, fh, cellFn, tint = [1, 1, 1]) {
  const eg = (2 * rad * Math.sin(Math.PI / sides));
  for (let i = 0; i < sides; i++) {
    const a0 = (i / sides) * Math.PI * 2, a1 = ((i + 1) / sides) * Math.PI * 2;
    // outward normal at mid-angle
    const am = (a0 + a1) / 2;
    const nx = Math.cos(am), nz = Math.sin(am);
    // left start point as seen from outside: right vector = (nz, -nx); so left is the point at angle a1 (going clockwise) -> compute
    const p0 = [cx + Math.cos(a0) * rad, cz + Math.sin(a0) * rad], p1 = [cx + Math.cos(a1) * rad, cz + Math.sin(a1) * rad];
    // right = (nz,-nx): moving from p1 to p0 should align with right
    const dx = p0[0] - p1[0], dz = p0[1] - p1[1];
    const dot = dx * nz + dz * -nx;
    const L = dot > 0 ? p1 : p0;
    b.facade(L[0], L[1], nx, nz, eg, y0, floors, fh, 0.3, cellFn, 1);
  }
  // roof disc
  const n = sides;
  const top = y0 + floors * fh;
  const ctrv = b.vert(cx, top, cz, 0, 1, 0, ...b.A.uv(b.A.white, 0.5, 0.5), [0.45, 0.45, 0.45]);
  const ring = [];
  for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; ring.push(b.vert(cx + Math.cos(a) * rad, top, cz + Math.sin(a) * rad, 0, 1, 0, ...b.A.uv(b.A.white, 0.5, 0.5), [0.45, 0.45, 0.45])); }
  for (let i = 0; i < n; i++) b.idx.push(ctrv, ring[i + 1], ring[i]);
  return top;
}

function modernOffice({ b, rng, lw, ld, level }) {
  const A = b.A;
  const fh = level === 3 ? 0.24 : 0.26;
  const floors = [5, 10, 20][level - 1] + ((rng() * 3) | 0);
  const glass = pick(rng, MOD.glass);
  const gc = MOD.glassC[glass];
  const r = { x0: 0.08, x1: lw - 0.08, z0: 0.1, z1: ld - 0.16 };
  const style = level === 1 ? 'box' : pick(rng, ['box', 'round', 'twin', 'step']);
  const lit = 0.6;
  const cellFn = (f, i, nb, nf) => ({ cell: A.wall({ m: 'glass', c: f === 0 ? '#9aa4aa' : gc, w: 'curtain', gl: glass, fl: f === 0 ? 'g' : 'u' }), tint: [1, 1, 1], lit: rng() < lit });
  let h = 0;
  if (style === 'round' && lw >= 2) {
    const cx = lw / 2, cz = (r.z0 + r.z1) / 2, rad = Math.min(lw, ld) * 0.38;
    h = polyTower(b, cx, cz, rad, 12, 0, floors, fh, cellFn);
    b.cyl(cx, cz, rad * 0.4, h, h + 0.15, 8, A.white, '#7f8a90', { cap: true });
    b.cyl(cx, cz, 0.006, h + 0.15, h + 0.45, 4, A.white, '#c9c9c9', {});
  } else if (style === 'twin' && lw >= 3) {
    const w2 = (r.x1 - r.x0) * 0.4;
    const a = shell(b, { rng, x0: r.x0, x1: r.x0 + w2, z0: r.z0, z1: r.z1, floors, fh, bayW: 0.3, m: 'glass', c: gc, gl: glass, upperWin: 'curtain', door: { kind: 'door', color: '#3c4146' }, roof: { type: 'flat', parapet: 0.03, m: 'gravel', c: '#6e6e6a' }, lit });
    const f2 = Math.max(3, Math.round(floors * 0.75));
    const c2 = shell(b, { rng, x0: r.x1 - w2, x1: r.x1, z0: r.z0, z1: r.z1, floors: f2, fh, bayW: 0.3, m: 'glass', c: gc, gl: glass, upperWin: 'curtain', roof: { type: 'flat', parapet: 0.03, m: 'gravel', c: '#6e6e6a' }, lit });
    // skybridge
    b.box(r.x0 + w2, f2 * fh * 0.6, (r.z0 + r.z1) / 2 - 0.05, r.x1 - w2, f2 * fh * 0.6 + 0.1, (r.z0 + r.z1) / 2 + 0.05, A.wall({ m: 'glass', c: gc, w: 'ribbon', gl: glass }), '#fff', { rep: 0.3, top: A.white });
    // podium
    shell(b, { rng, x0: r.x0 - 0.02, x1: r.x1 + 0.02, z0: r.z0 - 0.02, z1: r.z1 + 0.08, floors: 2, fh: 0.3, bayW: 0.4, m: 'conc', c: '#cfcdc6', gl: glass, upperWin: 'ribbon', groundWin: 'curtain', roof: { type: 'flat', parapet: 0.03, m: 'gravel', c: '#6e6e6a' }, lit, plinth: false, noSides: false });
    h = a.yRoof;
    b.cyl(r.x0 + w2 / 2, (r.z0 + r.z1) / 2, 0.006, h, h + 0.4, 4, A.white, '#c9c9c9', {});
  } else if (style === 'step' || (style === 'round' && lw < 2)) {
    const f1 = Math.round(floors * 0.6);
    const s = shell(b, { rng, ...r, floors: f1, fh, bayW: 0.3, m: 'glass', c: gc, gl: glass, upperWin: 'curtain', groundWin: 'curtain', door: { kind: 'door', color: '#3c4146' }, roof: { type: 'flat', parapet: 0.03, m: 'gravel', c: '#6e6e6a' }, lit });
    const ins = 0.18;
    const s2 = shell(b, { rng, x0: r.x0 + ins, x1: r.x1 - ins, z0: r.z0 + ins * 0.6, z1: r.z1 - ins * 0.6, y0: s.yTop, floors: floors - f1, fh, bayW: 0.3, m: 'glass', c: gc, gl: glass, upperWin: 'curtain', plinth: false, roof: { type: 'flat', parapet: 0.03, m: 'gravel', c: '#6e6e6a' }, lit });
    h = s2.yTop;
    b.cyl(lw / 2, (r.z0 + r.z1) / 2, 0.006, h, h + 0.4, 4, A.white, '#c9c9c9', {});
  } else {
    const s = shell(b, { rng, ...r, floors, fh, bayW: 0.3, m: 'glass', c: gc, gl: glass, upperWin: 'curtain', groundWin: 'curtain', door: { kind: 'door', color: '#3c4146' }, roof: { type: 'flat', parapet: 0.03, m: 'gravel', c: '#6e6e6a' }, lit });
    h = s.yTop;
    if (level >= 2) { b.box(r.x0 + 0.15, h + 0.03, r.z0 + 0.15, r.x1 - 0.15, h + 0.13, r.z1 - 0.15, A.wall({ m: 'conc', c: '#bdbbb4', w: 'ribbon', gl: glass, fl: 'u' }), '#fff', { rep: 0.3, top: A.white }); h += 0.13; }
    b.cyl(lw / 2, (r.z0 + r.z1) / 2, 0.006, h, h + (level === 3 ? 0.5 : 0.25), 4, A.white, '#c9c9c9', {});
  }
  b.flatQuad(0.03, r.z1 + 0.0, lw - 0.03, ld - 0.02, 0.008, A.white, '#8d8e8f');
  tree(b, 0.1, ld - 0.07, 0.3, 'round', '#5a9a46', rng); tree(b, lw - 0.1, ld - 0.07, 0.3, 'round', '#6aa84f', rng);
  return { floors, h: h + 0.3 };
}

function modernFactory({ b, rng, lw, ld, level }) {
  const A = b.A;
  const fh = 0.36;
  const floors = level === 3 ? 2 : 1;
  const r = rect(lw, ld, 0.05, 0.28, 0.08);
  const base = pick(rng, ['#d5d8da', '#b8c0c6', '#9aa6ae', '#e5e2d6']);
  const stripe = pick(rng, ['#2a6fb5', '#c0392b', '#2a9d8f', '#e08a1e']);
  const s = shell(b, { rng, ...r, floors, fh, bayW: 0.4, m: 'metal', c: base, trim: stripe, upperWin: 'slit', groundWin: 'slit', door: { kind: 'loading', color: stripe, bay: 'right' }, roof: { type: 'flat', parapet: 0.02, m: 'metal', c: '#8a9096' }, lit: 0.3 });
  b.box(r.x0 - 0.005, s.yTop - 0.07, r.z1, r.x1 + 0.005, s.yTop - 0.04, r.z1 + 0.008, A.white, stripe, { rep: 0 });
  hvac(b, r.x0 + 0.15, r.z0 + 0.1, s.yTop + 0.02, 0.1); hvac(b, r.x0 + 0.35, r.z0 + 0.1, s.yTop + 0.02, 0.1);
  if (level >= 2) for (let i = 0; i < 3; i++) b.cyl(r.x1 - 0.12 - i * 0.2, r.z0 + 0.12, 0.07, 0, 0.44, 10, A.white, '#d8dadb', { r1: 0.07 });
  // truck bays
  b.flatQuad(0.03, r.z1 + 0.0, lw - 0.03, ld - 0.02, 0.008, A.white, '#5f6061');
  if (level === 3) { b.cyl(r.x0 + 0.15, r.z0 + 0.25, 0.05, s.yTop, s.yTop + 0.4, 8, A.white, '#bfc3c5', { r1: 0.04 }); }
  // trailers
  b.box(0.12, 0.0, r.z1 + 0.05, 0.38, 0.09, r.z1 + 0.12, A.white, '#e8e8e8', { rep: 0, top: A.white });
  return { floors: floors + 0.3, h: s.yTop + 0.1 };
}

export const ZONE_GEN = {
  colonial: { house: colonialHouse, apt: colonialApt, shop: colonialShop, office: colonialOffice, factory: colonialFactory },
  georgian: { house: georgianHouse, apt: georgianApt, shop: georgianShop, office: georgianOffice, factory: georgianFactory },
  southern: { house: southernHouse, apt: southernApt, shop: southernShop, office: southernOffice, factory: southernFactory },
  american: { house: americanHouse, apt: americanApt, shop: americanShop, office: americanOffice, factory: americanFactory },
  modern: { house: modernHouse, apt: modernApt, shop: modernShop, office: modernOffice, factory: modernFactory },
};

export { polyTower };
export const PAL = { COL, GEO, SOU, AMER, MOD };
