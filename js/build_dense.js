// New zone archetypes: rowhouses (medium density), mixed-use, big commercial (stores, hotels, malls)
// and specialised industry (farming, forestry, ore, oil). Front of the lot is z = ld.
import { pick } from './util.js';
import { shell, cornice, quoins, chimney, porch, portico, dormer, awning, balcony, fence, tree, path, hvac, waterTank, smokestack, bush } from './build_common.js';
import { car, CAR_COLS, bayWindow, flatSolar, acUnit, dish, hedge, flowerBed, lampPost } from './build_props.js';
import { PAL, polyTower } from './build_zone.js';

const { COL, GEO, SOU, AMER, MOD } = PAL;

// ---------------------------------------------------------------- style kits shared by the generic generators
const KIT = {
  colonial: { mats: [['clap', COL.clap], ['brick', COL.brick]], upper: 'small', ground: 'sash', trim: '#f4f1e7', shut: COL.shut, roofM: 'shingle', roofC: COL.roof, roof: 'gable', doors: COL.shut, signs: ['#4a2f22', '#2a3b55', '#6b2b25', '#2f5a3d'], awn: ['#6b2b25', '#2f5a3d', '#2a3b55', '#8a6a3a'], fh: 0.27 },
  georgian: { mats: [['brick', GEO.brick], ['stone', GEO.stone]], upper: 'sash', ground: 'arch', trim: '#f2efe4', shut: null, roofM: 'slate', roofC: GEO.slate, roof: 'flat', doors: GEO.door, signs: ['#1f2f4a', '#24402d', '#6a1f1f', '#2a2a2c'], awn: ['#1f2f4a', '#6a1f1f', '#24402d'], fh: 0.28, cornice: true },
  southern: { mats: [['stucco', SOU.stucco], ['clap', SOU.clap]], upper: 'tall', ground: 'porchdoor', trim: '#fbf8ee', shut: SOU.shut, roofM: 'metal', roofC: SOU.roof, roof: 'hip', doors: SOU.shut, signs: ['#2c4a35', '#6a1f1f', '#1f2f4a', '#3a2a1e'], awn: ['#2c4a35', '#b8372f', '#d98b2b'], fh: 0.3, iron: true },
  american: { mats: [['brick', AMER.brick], ['stone', ['#8a6a55', '#7a5a48', '#9a7a62', '#6f5548']]], upper: 'sash', ground: 'sash', trim: '#efe9d8', shut: null, roofM: 'gravel', roofC: ['#5f5f5a'], roof: 'flat', doors: ['#2a3b55', '#7a2f2a', '#2f4a3a', '#3a2a1e'], signs: ['#2a3b55', '#7a2f2a', '#2f4a3a', '#a37a2c'], awn: ['#b8372f', '#2e6a47', '#2b4a7a', '#c9892b'], fh: 0.27, cornice: true, fireEscape: true },
  modern: { mats: [['conc', [...MOD.conc, ...MOD.white]], ['wood', MOD.wood]], upper: 'casement', ground: 'curtain', trim: '#d5d3cc', shut: null, roofM: 'gravel', roofC: ['#6e6e6a'], roof: 'flat', doors: ['#3c4146', '#2f3438'], signs: ['#e84a5f', '#2a9d8f', '#e9c46a', '#264653', '#f4a261'], awn: ['#3c4146', '#2a9d8f', '#e84a5f'], fh: 0.27, glass: true },
};
const kitOf = (st) => KIT[st] || KIT.georgian;
const mat = (rng, K) => { const [m, cs] = pick(rng, K.mats); return { m, c: pick(rng, cs) }; };
const roofFor = (K, rng, o = {}) => (K.roof === 'gable' ? { type: 'gable', ridge: o.ridge || 'x', rise: o.rise || 0.24, m: K.roofM, c: pick(rng, K.roofC) }
  : K.roof === 'hip' ? { type: 'hip', rise: o.rise || 0.18, m: K.roofM, c: pick(rng, K.roofC), ridgeInset: 0.1 }
    : { type: 'flat', parapet: o.parapet || 0.05, m: K.roofM, c: pick(rng, K.roofC) });

function signCell(A, text, bg, fg = '#ffffff') {
  return A.decal('txt:' + text + bg + fg, (ctx, S) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, S, S);
    ctx.save(); ctx.scale(1, 4);
    let fs = 13; ctx.font = `bold ${fs}px sans-serif`;
    while (ctx.measureText(text).width > S - 6 && fs > 5) { fs--; ctx.font = `bold ${fs}px sans-serif`; }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = fg; ctx.fillText(text, S / 2, S / 8);
    ctx.restore();
  }, (ctx, S) => {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, S, S);
    ctx.save(); ctx.scale(1, 4);
    let fs = 13; ctx.font = `bold ${fs}px sans-serif`;
    while (ctx.measureText(text).width > S - 6 && fs > 5) { fs--; ctx.font = `bold ${fs}px sans-serif`; }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = fg; ctx.fillText(text, S / 2, S / 8);
    ctx.restore();
  });
}
function sign(b, text, bg, cx, z, y, w, h, fg) { b.wall(cx - w / 2, z + 0.004, 0, 1, w, y, y + h, signCell(b.A, text, bg, fg), [1, 1, 1], 0, 0); }

// ====================================================================== ROWHOUSES (medium density)
function rowHouses({ b, rng, lw, ld, level, st }) {
  const A = b.A, K = kitOf(st);
  const uw = st === 'american' ? 0.36 : st === 'modern' ? 0.42 : 0.33;
  const n = Math.max(2, Math.round((lw - 0.08) / uw));
  const w = (lw - 0.08) / n;
  const depth = ld > 1 ? 0.95 : 0.6;
  const z1 = ld - (st === 'american' ? 0.2 : 0.15), z0 = Math.max(0.06, z1 - depth);
  const base = 1 + level;
  let hmax = 0;
  const uniform = st === 'georgian' || st === 'american';
  const terr = mat(rng, K);
  const roofC = pick(rng, K.roofC);
  for (let i = 0; i < n; i++) {
    const x0 = 0.04 + i * w, x1 = x0 + w, cx = (x0 + x1) / 2;
    const mm = uniform ? terr : mat(rng, K);
    const c = st === 'southern' || st === 'colonial' ? pick(rng, mm.m === 'clap' ? [...SOU.clap, ...COL.clap] : SOU.stucco) : mm.c;
    const floors = base + (uniform ? 0 : (rng() < 0.25 ? 1 : 0));
    const doorCol = pick(rng, K.doors);
    let roof;
    if (st === 'colonial') roof = { type: 'gable', ridge: 'x', rise: 0.2, m: 'shingle', c: pick(rng, COL.roof), ov: 0.01 };
    else if (st === 'southern') roof = { type: 'flat', parapet: 0.08, m: 'gravel', c: '#6a6a64' };
    else if (st === 'modern') roof = { type: 'flat', parapet: 0.03, m: rng() < 0.4 ? 'grass' : 'gravel', c: '#5a9a46' };
    else roof = { type: 'flat', parapet: 0.05, m: 'gravel', c: '#5f5f5a' };
    const s = shell(b, { rng, x0, x1, z0, z1, floors, fh: K.fh, bayW: w / 2, maxBays: 2, m: mm.m, c, trim: K.trim, shutter: K.shut ? pick(rng, K.shut) : null, gl: st === 'modern' ? pick(rng, MOD.glass) : undefined, upperWin: K.upper, groundWin: K.upper, door: { kind: 'door', color: doorCol, bay: i % 2 ? 'right' : 'left' }, roof, lit: 0.55, noSides: i > 0 && i < n - 1 });
    hmax = Math.max(hmax, s.yRoof);
    if (K.cornice) cornice(b, x0, z0, x1, z1, s.yTop, 0.03, 0.02, st === 'american' ? '#d8cfb8' : '#efe9da');
    const dx = i % 2 ? x1 - w * 0.25 : x0 + w * 0.25;
    if (st === 'american') {
      // brownstone stoop + full-height bay
      for (let k = 0; k < 4; k++) b.box(dx - 0.05, 0, z1 + k * 0.025, dx + 0.05, 0.13 - k * 0.03, z1 + 0.03 + k * 0.025, A.white, '#7a6050', { rep: 0, top: A.white });
      b.box(dx - 0.055, 0.13, z1, dx - 0.05, 0.2, z1 + 0.1, A.white, '#26272a', { rep: 0 }); b.box(dx + 0.05, 0.13, z1, dx + 0.055, 0.2, z1 + 0.1, A.white, '#26272a', { rep: 0 });
      if (level >= 2) bayWindow(b, i % 2 ? x0 + w * 0.3 : x1 - w * 0.3, z1, K.fh, w * 0.42, K.fh * (floors - 1) - 0.04, 0.06, A.wall({ m: mm.m, c, w: 'sash', wc: K.trim, fl: 'u', lit: rng() < 0.5 }), A.roof({ m: 'metal', c: '#5a5f66' }), '#d8cfb8');
    } else if (st === 'georgian') {
      b.box(dx - 0.05, 0, z1, dx + 0.05, 0.05, z1 + 0.07, A.white, '#b8b2a5', { rep: 0, top: A.white });
      b.box(x0 + 0.01, 0.06, z1 + 0.11, x1 - 0.01, 0.12, z1 + 0.12, A.white, '#26272a', { rep: 0 });
      if (level >= 2) balcony(b, x0 + 0.03, x1 - 0.03, z1, K.fh + 0.01, 0.05, { color: '#26272a', slab: '#d8d0bc' });
      chimney(b, x0 + 0.02, (z0 + z1) / 2, s.yTop, s.yTop + 0.16, 0.09, terr.c);
    } else if (st === 'southern') {
      for (let f = 1; f < floors; f++) balcony(b, x0 + 0.02, x1 - 0.02, z1, f * K.fh + 0.01, 0.1, { color: '#26272a', slab: '#8f8a80' });
      for (const px of [x0 + 0.03, x1 - 0.03]) b.box(px - 0.005, 0, z1 + 0.09, px + 0.005, K.fh, z1 + 0.1, A.white, '#26272a', { rep: 0 });
      if (rng() < 0.5) flowerBed(b, rng, x0 + 0.04, z1 + 0.11, x1 - 0.04, z1 + 0.14);
    } else if (st === 'colonial') {
      b.box(dx - 0.05, 0, z1, dx + 0.05, 0.03, z1 + 0.06, A.white, '#aaa49a', { rep: 0, top: A.white });
      chimney(b, cx, (z0 + z1) / 2 - 0.05, s.yTop, s.yRoof + 0.05, 0.07);
      if (level >= 2) dormer(b, cx, z1 - 0.05, s.yTop + 0.2 * (0.07 / (depth / 2)), { m: 'clap', c, trim: K.trim, rm: 'shingle', rc: pick(rng, COL.roof), w: 0.1, h: 0.1, lit: rng() < 0.5 });
    } else {
      // modern: cantilevered upper boxes and glass balconies
      if (i % 2 === 0) b.box(x0 + 0.02, K.fh, z1, x1 - 0.02, K.fh + 0.02, z1 + 0.09, A.white, '#3c4146', { rep: 0, top: A.white });
      for (let f = 1; f < floors; f++) b.box(x0 + 0.03, f * K.fh, z1 + 0.06, x1 - 0.03, f * K.fh + 0.09, z1 + 0.07, A.wall({ m: 'glass', c: '#a8c8d6', w: 'none' }), '#ffffff', { rep: 0 });
      if (rng() < 0.5) flatSolar(b, x0 + 0.04, z0 + 0.06, x1 - 0.04, z0 + 0.22, s.yRoof);
    }
    path(b, dx, z1 + 0.05, ld - 0.01, 0.07, '#bdb6a5');
  }
  if (st !== 'american' && ld - z1 > 0.08) { for (let i = 0; i < n; i++) { const x0 = 0.04 + i * w; bush(b, x0 + (i % 2 ? 0.06 : w - 0.06), ld - 0.06, 0.03, '#4a7a3a'); } }
  // back gardens
  if (ld > 1) for (let i = 0; i < n; i++) { const x0 = 0.04 + i * w; if (rng() < 0.6) tree(b, x0 + w / 2, z0 * 0.5 + 0.02, 0.24 + rng() * 0.1, 'round', '#4a8a3e', rng); fence(b, x0, 0.03, x0, z0, 0.05, '#c8c0aa'); }
  return { floors: base + 0.3, h: hmax };
}

// ====================================================================== MIXED USE (shops below, flats above)
function mixedUse({ b, rng, lw, ld, level, st }) {
  const A = b.A, K = kitOf(st);
  const floors = [3, 5, 7][level - 1] + ((rng() * 2) | 0);
  const r = { x0: 0.05, x1: lw - 0.05, z0: 0.08, z1: ld - 0.2 };
  const mm = mat(rng, K);
  const sg = pick(rng, K.signs);
  const fh = K.fh;
  // ground floor shops
  const g = shell(b, { rng, ...r, floors: 1, fh: fh * 1.15, bayW: 0.3, m: mm.m === 'clap' ? 'stucco' : mm.m, c: st === 'modern' ? '#3c4146' : mm.c, trim: K.trim, gl: st === 'modern' ? pick(rng, MOD.glass) : undefined, upperWin: 'shop', groundWin: 'shop', groundExtra: { sg }, door: { kind: 'door', color: sg }, roof: null, lit: 0.7 });
  const y1 = fh * 1.15;
  const upTop = floors - 1;
  let s;
  if (level === 3 && lw >= 2) {
    // podium + setback tower
    const lower = Math.max(2, Math.round(upTop * 0.55));
    const s1 = shell(b, { rng, ...r, y0: y1, floors: lower, fh, bayW: 0.28, m: mm.m, c: mm.c, trim: K.trim, shutter: K.shut ? pick(rng, K.shut) : null, gl: st === 'modern' ? pick(rng, MOD.glass) : undefined, upperWin: st === 'modern' ? 'curtain' : K.upper, plinth: false, roof: { type: 'flat', parapet: 0.03, m: 'gravel', c: '#6a6a64' }, lit: 0.55 });
    if (K.cornice) cornice(b, r.x0, r.z0, r.x1, r.z1, s1.yTop, 0.035, 0.03);
    const ins = 0.16;
    s = shell(b, { rng, x0: r.x0 + ins, x1: r.x1 - ins, z0: r.z0 + ins, z1: r.z1 - ins * 0.6, y0: s1.yTop, floors: upTop - lower, fh, bayW: 0.28, m: mm.m, c: mm.c, trim: K.trim, gl: st === 'modern' ? pick(rng, MOD.glass) : undefined, upperWin: st === 'modern' ? 'curtain' : K.upper, plinth: false, roof: roofFor(K, rng, { parapet: 0.06 }), lit: 0.55 });
    b.flatQuad(r.x0 + 0.04, r.z1 - ins * 0.6 + 0.02, r.x1 - 0.04, r.z1 - 0.02, s1.yTop + 0.012, A.roof({ m: 'grass', c: '#5a9a46' }), '#ffffff');
    for (let k = 0; k < 3; k++) bush(b, r.x0 + 0.2 + k * (r.x1 - r.x0 - 0.4) / 2, r.z1 - 0.06, 0.03, '#4a8a3e', s1.yTop + 0.01);
  } else {
    s = shell(b, { rng, ...r, y0: y1, floors: upTop, fh, bayW: 0.28, m: mm.m, c: mm.c, trim: K.trim, shutter: K.shut ? pick(rng, K.shut) : null, gl: st === 'modern' ? pick(rng, MOD.glass) : undefined, upperWin: K.upper, plinth: false, roof: roofFor(K, rng), lit: 0.55 });
    if (K.cornice) cornice(b, r.x0, r.z0, r.x1, r.z1, s.yTop, 0.04, 0.035);
  }
  awning(b, r.x0 + 0.02, r.x1 - 0.02, r.z1, y1 * 0.85, 0.1, pick(rng, K.awn));
  b.box(r.x0 - 0.01, y1 - 0.02, r.z1, r.x1 + 0.01, y1 + 0.01, r.z1 + 0.02, A.white, K.trim, { rep: 0, top: A.white });
  if (K.iron) for (let f = 0; f < Math.min(upTop, 3); f++) balcony(b, r.x0 + 0.04, r.x1 - 0.04, r.z1, y1 + f * fh + 0.01, 0.1, { color: '#26272a', slab: '#8f8a80' });
  else if (st === 'modern') for (let f = 0; f < upTop; f += 1) b.box(r.x0 + 0.06, y1 + f * fh, r.z1, r.x1 - 0.06, y1 + f * fh + 0.02, r.z1 + 0.07, A.white, '#cfcdc6', { rep: 0, top: A.white });
  else if (K.fireEscape) for (let f = 0; f < upTop; f++) { b.box(r.x1 - 0.32, y1 + f * fh, r.z1, r.x1 - 0.08, y1 + f * fh + 0.012, r.z1 + 0.06, A.white, '#26272a', { rep: 0, top: A.white }); b.box(r.x1 - 0.32, y1 + f * fh, r.z1 + 0.055, r.x1 - 0.08, y1 + f * fh + 0.06, r.z1 + 0.06, A.white, '#26272a', { rep: 0 }); }
  hvac(b, r.x0 + 0.12, r.z0 + 0.1, s.yRoof); if (rng() < 0.5) dish(b, r.x1 - 0.15, s.yRoof, r.z0 + 0.15);
  if (st === 'american' && level >= 2) waterTank(b, r.x1 - 0.2, r.z0 + 0.22, s.yRoof, 0.07);
  // café tables on the pavement
  for (let k = 0; k < Math.round(lw * 1.5); k++) { const tx = r.x0 + 0.12 + k * 0.32; if (tx > r.x1 - 0.1) break; b.cyl(tx, ld - 0.08, 0.025, 0.035, 0.04, 8, A.white, '#f2f2f0', { cap: true }); b.cyl(tx, ld - 0.08, 0.004, 0, 0.035, 4, A.white, '#333', {}); }
  if (rng() < 0.6) lampPost(b, lw - 0.05, ld - 0.04);
  return { floors, h: s.yRoof };
}

// ====================================================================== BIG COMMERCIAL: stores, hotels, malls
function bigStore({ b, rng, lw, ld, level, st }) {
  const A = b.A, K = kitOf(st);
  const kind = level === 1 ? pick(rng, ['market', 'dept']) : level === 2 ? pick(rng, ['hotel', 'dept', 'cinema']) : (lw >= 3 && ld >= 3 ? pick(rng, ['mall', 'tower']) : 'tower');
  const mm = mat(rng, K);
  const sg = pick(rng, K.signs);
  if (kind === 'market') {
    // supermarket with a car park out front
    const r = { x0: 0.08, x1: lw - 0.08, z0: 0.08, z1: Math.max(0.6, ld * 0.55) };
    const s = shell(b, { rng, ...r, floors: 1, fh: 0.36, bayW: 0.4, m: st === 'modern' ? 'conc' : mm.m, c: mm.c, trim: K.trim, gl: 'blue', upperWin: 'curtain', groundWin: 'curtain', door: { kind: 'door', color: '#3c4146' }, roof: { type: 'flat', parapet: 0.08, m: 'metal', c: '#8a9096' }, lit: 0.7 });
    b.box(r.x0 + 0.1, 0.3, r.z1, r.x1 - 0.1, 0.33, r.z1 + 0.12, A.white, sg, { rep: 0, top: A.white });
    sign(b, pick(rng, ['MARKET', 'GROCER', 'FOODS', 'SUPERMART']), sg, (r.x0 + r.x1) / 2, r.z1, 0.38, Math.min(0.9, lw * 0.4), 0.12);
    b.flatQuad(0.05, r.z1 + 0.02, lw - 0.05, ld - 0.03, 0.009, A.white, '#4f5154');
    for (let row = 0; row < 2; row++) for (let k = 0; k < Math.floor((lw - 0.2) / 0.13); k++) {
      const x = 0.15 + k * 0.13, z = r.z1 + 0.2 + row * 0.26;
      if (z > ld - 0.1) continue;
      b.box(x - 0.002, 0.009, z - 0.1, x + 0.002, 0.011, z + 0.1, A.white, '#e8e8e8', { rep: 0 });
      if (rng() < 0.6) car(b, x + 0.065, z, true, pick(rng, CAR_COLS));
    }
    hvac(b, r.x0 + 0.2, r.z0 + 0.15, s.yRoof); hvac(b, r.x0 + 0.4, r.z0 + 0.15, s.yRoof);
    for (let k = 0; k < 3; k++) lampPost(b, 0.3 + k * (lw - 0.6) / 2, r.z1 + 0.33, 0.16);
    return { floors: 1.5, h: s.yRoof + 0.1 };
  }
  if (kind === 'dept' || kind === 'cinema') {
    const floors = (level === 1 ? 3 : 4) + ((rng() * 2) | 0);
    const r = { x0: 0.06, x1: lw - 0.06, z0: 0.08, z1: ld - 0.22 };
    const s = shell(b, { rng, ...r, floors, fh: 0.3, bayW: 0.3, m: mm.m, c: mm.c, trim: K.trim, gl: st === 'modern' ? pick(rng, MOD.glass) : undefined, upperWin: st === 'modern' ? 'ribbon' : st === 'american' ? 'deco' : K.upper, groundWin: 'shop', groundExtra: { sg }, door: { kind: 'door', color: sg }, roof: { type: 'flat', parapet: 0.06, m: 'gravel', c: '#6a6a64' }, lit: 0.65 });
    if (K.cornice || st === 'colonial') cornice(b, r.x0, r.z0, r.x1, r.z1, s.yTop, 0.05, 0.04);
    if (st === 'georgian' || st === 'american') quoins(b, r.x0, r.z0, r.x1, r.z1, 0, s.yTop, '#e8e2d0');
    b.box(r.x0, 0.27, r.z1, r.x1, 0.3, r.z1 + 0.16, A.white, st === 'modern' ? '#3c4146' : '#2b2b2e', { rep: 0, top: A.white });
    if (kind === 'cinema') {
      // marquee + vertical blade sign
      b.box(r.x0 + 0.2, 0.3, r.z1, r.x1 - 0.2, 0.42, r.z1 + 0.14, signCell(A, 'NOW SHOWING', '#1e1e1e', '#ffd34d'), '#ffffff', { rep: 0, top: A.white });
      b.box((r.x0 + r.x1) / 2 - 0.03, 0.45, r.z1 + 0.02, (r.x0 + r.x1) / 2 + 0.03, s.yTop + 0.25, r.z1 + 0.1, signCell(A, 'CINEMA', '#b3262e', '#fff3c0'), '#ffffff', { rep: 0, top: A.white });
    } else sign(b, pick(rng, ['EMPORIUM', 'BAZAAR', 'DEPT STORE', 'OUTFITTERS', 'MERCANTILE']), sg, (r.x0 + r.x1) / 2, r.z1, s.yTop - 0.18, Math.min(0.9, lw * 0.4), 0.11);
    hvac(b, r.x0 + 0.15, r.z0 + 0.12, s.yRoof); if (level >= 2) hvac(b, r.x1 - 0.25, r.z0 + 0.12, s.yRoof, 0.1);
    for (let k = 0; k < 2; k++) tree(b, r.x0 + 0.08 + k * (r.x1 - r.x0 - 0.16), ld - 0.07, 0.3, 'round', '#4a8a3e', rng);
    return { floors, h: s.yRoof + (kind === 'cinema' ? 0.25 : 0) };
  }
  if (kind === 'hotel') {
    const floors = 6 + ((rng() * 3) | 0);
    const r = { x0: 0.1, x1: lw - 0.1, z0: 0.1, z1: ld - 0.3 };
    const s = shell(b, { rng, ...r, floors, fh: 0.26, bayW: 0.26, m: mm.m, c: mm.c, trim: K.trim, shutter: K.shut ? pick(rng, K.shut) : null, gl: st === 'modern' ? pick(rng, MOD.glass) : undefined, upperWin: st === 'modern' ? 'curtain' : K.upper, groundWin: 'arch', door: { kind: 'door', color: '#3a2a1e' }, roof: st === 'georgian' || st === 'colonial' ? null : roofFor(K, rng, { parapet: 0.05 }), lit: 0.6 });
    if (st === 'georgian' || st === 'colonial') b.mansard(r.x0, r.z0, r.x1, r.z1, s.yTop, 0.22, 0.07, A.roof({ m: 'slate', c: pick(rng, GEO.slate) }), [1, 1, 1], A.roof({ m: 'metal', c: '#5a5f66' }));
    if (K.cornice) cornice(b, r.x0, r.z0, r.x1, r.z1, s.yTop, 0.04, 0.035);
    // porte-cochère + rooftop sign
    const cx = (r.x0 + r.x1) / 2;
    b.box(cx - 0.25, 0.24, r.z1, cx + 0.25, 0.27, r.z1 + 0.24, A.white, '#3a2a1e', { rep: 0, top: A.white });
    for (const px of [cx - 0.23, cx + 0.23]) b.box(px - 0.012, 0, r.z1 + 0.21, px + 0.012, 0.24, r.z1 + 0.235, A.white, '#d9b34a', { rep: 0 });
    sign(b, 'HOTEL', '#7a1f2a', cx, r.z1, s.yTop - 0.12, 0.3, 0.1, '#ffe6a0');
    b.flatQuad(cx - 0.3, r.z1, cx + 0.3, ld - 0.02, 0.009, A.white, '#9a948a');
    if (rng() < 0.6) car(b, cx + 0.1, r.z1 + 0.15, false, pick(rng, ['#1e1e1e', '#f2f2ee']));
    for (const px of [r.x0 + 0.05, r.x1 - 0.05]) tree(b, px, ld - 0.08, 0.32, 'round', '#4a8a3e', rng);
    return { floors, h: s.yTop + 0.25 };
  }
  if (kind === 'mall') {
    const r = { x0: 0.15, x1: lw - 0.15, z0: 0.15, z1: ld - 0.9 };
    const s = shell(b, { rng, ...r, floors: 2, fh: 0.38, bayW: 0.5, m: st === 'modern' ? 'conc' : mm.m, c: st === 'modern' ? '#d8d6cf' : mm.c, trim: K.trim, gl: 'teal', upperWin: 'ribbon', groundWin: 'curtain', door: { kind: 'door', color: '#3c4146' }, roof: { type: 'flat', parapet: 0.06, m: 'metal', c: '#9aa0a6' }, lit: 0.7 });
    // glass atrium + entrance
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    const glass = A.wall({ m: 'glass', c: '#9ad0c4', w: 'curtain', gl: 'teal', fl: 'u' });
    b.box(cx - 0.4, s.yTop, cz - 0.3, cx + 0.4, s.yTop + 0.2, cz + 0.3, glass, '#ffffff', { rep: 0.25, top: A.white });
    b.gable(cx - 0.4, cz - 0.3, cx + 0.4, cz + 0.3, s.yTop + 0.2, 0.18, 'x', glass, '#ffffff', glass, '#ffffff', 0.01, 0.25);
    b.box(cx - 0.3, 0, r.z1, cx + 0.3, 0.6, r.z1 + 0.1, glass, '#ffffff', { rep: 0.25, top: A.white });
    sign(b, 'GALLERIA', sg, cx, r.z1 + 0.1, 0.62, 0.6, 0.13);
    // parking with rows of cars
    b.flatQuad(0.06, r.z1 + 0.1, lw - 0.06, ld - 0.04, 0.009, A.white, '#4f5154');
    for (let row = 0; row < 3; row++) for (let k = 0; k < Math.floor((lw - 0.3) / 0.13); k++) {
      const x = 0.2 + k * 0.13, z = r.z1 + 0.3 + row * 0.22;
      if (z > ld - 0.12) continue;
      if (rng() < 0.65) car(b, x, z, true, pick(rng, CAR_COLS));
    }
    for (let k = 0; k < 4; k++) lampPost(b, 0.4 + k * (lw - 0.8) / 3, r.z1 + 0.2, 0.18);
    for (let k = 0; k < 6; k++) hvac(b, r.x0 + 0.2 + k * 0.3, r.z0 + 0.2, s.yRoof, 0.1);
    return { floors: 3, h: s.yTop + 0.38 };
  }
  // hotel / office-hotel tower with podium
  const r = { x0: 0.1, x1: lw - 0.1, z0: 0.1, z1: ld - 0.25 };
  const pod = shell(b, { rng, ...r, floors: 2, fh: 0.3, bayW: 0.35, m: mm.m === 'wood' ? 'conc' : mm.m, c: mm.c, trim: K.trim, gl: 'teal', upperWin: 'shop', groundWin: 'shop', groundExtra: { sg }, door: { kind: 'door', color: sg }, roof: { type: 'flat', parapet: 0.04, m: 'gravel', c: '#6a6a64' }, lit: 0.7 });
  const floors = 11 + ((rng() * 5) | 0);
  const ins = 0.22;
  const tr = { x0: r.x0 + ins, x1: r.x1 - ins, z0: r.z0 + ins * 0.7, z1: r.z1 - ins };
  let top;
  if (st === 'modern') {
    const gl = pick(rng, MOD.glass);
    const cellFn = () => ({ cell: A.wall({ m: 'glass', c: MOD.glassC[gl], w: 'curtain', gl, fl: 'u' }), tint: [1, 1, 1], lit: rng() < 0.6 });
    top = polyTower(b, (tr.x0 + tr.x1) / 2, (tr.z0 + tr.z1) / 2, Math.min(tr.x1 - tr.x0, tr.z1 - tr.z0) * 0.55, 10, pod.yTop, floors, 0.24, cellFn);
  } else {
    const t = shell(b, { rng, ...tr, y0: pod.yTop, floors, fh: 0.24, bayW: 0.26, m: mm.m === 'wood' ? 'conc' : mm.m, c: mm.c, trim: K.trim, upperWin: st === 'american' ? 'deco' : K.upper, plinth: false, roof: { type: 'flat', parapet: 0.04, m: 'gravel', c: '#6a6a64' }, lit: 0.6 });
    top = t.yTop;
    if (K.cornice) cornice(b, tr.x0, tr.z0, tr.x1, tr.z1, top, 0.04, 0.035);
    if (st === 'american' || st === 'georgian') { b.pyramid((tr.x0 + tr.x1) / 2, (tr.z0 + tr.z1) / 2, 0.16, top, top + 0.3, 4, A.roof({ m: 'copper', c: '#6a8a7a' }), [1, 1, 1], Math.PI / 4); top += 0.3; }
    else if (st === 'southern' || st === 'colonial') { b.dome((tr.x0 + tr.x1) / 2, (tr.z0 + tr.z1) / 2, 0.14, top, 0.16, 10, 3, A.roof({ m: 'copper', c: '#5e8a74' }), [1, 1, 1]); top += 0.16; }
  }
  sign(b, 'GRAND HOTEL', '#1f2f4a', (r.x0 + r.x1) / 2, r.z1, 0.62, 0.6, 0.1, '#ffe6a0');
  b.box(r.x0 + 0.1, 0.27, r.z1, r.x1 - 0.1, 0.3, r.z1 + 0.18, A.white, '#2b2b2e', { rep: 0, top: A.white });
  b.flatQuad(r.x0 + 0.06, r.z1 - 0.3, r.x0 + 0.38, r.z1 - 0.06, pod.yTop + 0.012, A.roof({ m: 'water', c: '#3fb3d6' }), '#ffffff');
  b.cyl((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, 0.006, top, top + 0.35, 4, A.white, '#c9c9c9', {});
  return { floors: floors + 2, h: top + 0.35 };
}

// ====================================================================== SPECIALISED INDUSTRY
const CROPS = { wheat: ['#d9b85a', '#c9a64a'], corn: ['#7aa83a', '#5f8a2a'], cotton: ['#efe9dc', '#7aa05a'], veg: ['#5a9a3a', '#7a5a3a'], lavender: ['#9a7ac8', '#6a8a4a'], hay: ['#c9b06a', '#a89050'] };
function cropCell(A, kind) {
  const [a, c] = CROPS[kind];
  return A.decal('crop:' + kind, (ctx, S) => {
    ctx.fillStyle = '#6b5236'; ctx.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 8) { ctx.fillStyle = a; ctx.fillRect(0, y + 1, S, 5); ctx.fillStyle = c; ctx.fillRect(0, y + 1, S, 1); }
  });
}
function barn(b, rng, x, z, w, d, h) {
  const A = b.A;
  const red = pick(rng, ['#a63d32', '#8e3a2e', '#b04a36', '#7a6a5a']);
  const wall = A.wall({ m: 'wood', c: red, w: 'none' });
  b.box(x, 0, z, x + w, h, z + d, wall, '#ffffff', { rep: 0.2, top: A.white });
  b.gambrel(x, z, x + w, z + d, h, h * 0.75, A.roof({ m: 'metal', c: pick(rng, ['#6a6f75', '#4a4a4e', '#8a9099']) }), [1, 1, 1], wall, [1, 1, 1], 0.03);
  b.box(x + w * 0.35, 0, z + d, x + w * 0.65, h * 0.85, z + d + 0.003, A.decal('barndoor', (c2, S) => { c2.fillStyle = '#f2efe6'; c2.fillRect(0, 0, S, S); c2.fillStyle = '#8e3a2e'; c2.fillRect(5, 5, S - 10, S - 10); c2.strokeStyle = '#f2efe6'; c2.lineWidth = 4; c2.beginPath(); c2.moveTo(5, 5); c2.lineTo(S - 5, S - 5); c2.moveTo(S - 5, 5); c2.lineTo(5, S - 5); c2.stroke(); }), '#ffffff', { rep: 0 });
}
function silo(b, x, z, r, h, col = '#c9ccd0') {
  b.cyl(x, z, r, 0, h, 12, b.A.white, col, { cap: false });
  b.dome(x, z, r, h, r * 0.7, 12, 3, b.A.white, '#9aa0a6');
}

function agriLot({ b, rng, lw, ld, level }) {
  const A = b.A;
  const crop = pick(rng, Object.keys(CROPS));
  const cell = cropCell(A, crop);
  const fz1 = ld - 0.06;
  b.flatQuad(0.04, 0.04, lw * 0.62, fz1, 0.012, cell, '#ffffff', Math.max(1, Math.round(lw * 2)), Math.max(1, Math.round(ld * 2)));
  if (level >= 2 && lw >= 2) {
    // greenhouses
    const glass = A.wall({ m: 'glass', c: '#cfe8e0', w: 'curtain', gl: 'green', fl: 'u' });
    for (let k = 0; k < 2; k++) { const gx = lw * 0.66, gz = 0.12 + k * 0.38; b.box(gx, 0, gz, lw - 0.08, 0.12, gz + 0.3, glass, '#ffffff', { rep: 0.2, top: A.white }); b.gable(gx, gz, lw - 0.08, gz + 0.3, 0.12, 0.07, 'x', glass, '#ffffff', glass, '#ffffff', 0.005); }
  } else {
    b.flatQuad(lw * 0.64, 0.04, lw - 0.04, ld * 0.5, 0.012, cropCell(A, crop === 'hay' ? 'wheat' : 'hay'), '#ffffff');
  }
  const bx = lw * 0.66, bz = ld - 0.5;
  barn(b, rng, bx, bz, Math.min(0.38, lw * 0.3), 0.3, 0.18);
  silo(b, Math.min(lw - 0.1, bx + Math.min(0.38, lw * 0.3) + 0.08), bz + 0.1, 0.07, level >= 3 ? 0.55 : 0.38);
  if (level >= 3) { silo(b, Math.min(lw - 0.1, bx + Math.min(0.38, lw * 0.3) + 0.08), bz + 0.27, 0.07, 0.5); shell(b, { rng, x0: 0.1, x1: lw * 0.5, z0: ld - 0.45, z1: ld - 0.12, floors: 1, fh: 0.3, bayW: 0.4, m: 'metal', c: '#c9ccd0', trim: '#8a9096', upperWin: 'slit', groundWin: 'loading', roof: { type: 'gable', ridge: 'x', rise: 0.08, m: 'metal', c: '#7a8088' }, lit: 0.3 }); }
  // tractor + hay bales
  const tx = 0.2 + rng() * (lw * 0.4), tz = 0.2 + rng() * (ld - 0.4);
  b.box(tx, 0.02, tz, tx + 0.08, 0.06, tz + 0.05, A.white, pick(rng, ['#2d8a3a', '#c0392b', '#2a62a8']), { rep: 0, top: A.white });
  b.box(tx + 0.045, 0.06, tz + 0.005, tx + 0.075, 0.09, tz + 0.045, A.white, '#2a3646', { rep: 0, top: A.white });
  for (let k = 0; k < 4; k++) b.cyl(lw * 0.6 + k * 0.06, ld - 0.08, 0.025, 0, 0.04, 8, A.white, '#d9c06a', {});
  fence(b, 0.03, ld - 0.03, lw - 0.03, ld - 0.03, 0.05, '#c8b89a');
  return { floors: 1, h: level >= 3 ? 0.62 : 0.45 };
}

function forestLot({ b, rng, lw, ld, level }) {
  const A = b.A;
  b.flatQuad(0.04, 0.04, lw - 0.04, ld - 0.04, 0.01, A.white, '#7a6248');
  const mill = shell(b, { rng, x0: 0.1, x1: lw * 0.55, z0: 0.12, z1: ld * 0.55, floors: 1, fh: 0.32, bayW: 0.4, m: 'wood', c: pick(rng, ['#8a6a48', '#7a5a3a', '#9c7a52']), trim: '#c8b89a', upperWin: 'slit', groundWin: 'loading', roof: { type: 'gable', ridge: 'x', rise: 0.12, m: 'metal', c: '#7a8088' }, lit: 0.3 });
  // log piles
  const wood = A.wall({ m: 'wood', c: '#8a6a48', w: 'none' });
  for (let p = 0; p < 2 + level; p++) {
    const x = lw * 0.6 + (p % 2) * 0.22, z = 0.15 + Math.floor(p / 2) * 0.3;
    if (x + 0.2 > lw - 0.04 || z + 0.18 > ld - 0.1) continue;
    for (let k = 0; k < 3; k++) for (let j = 0; j < 3 - k; j++) b.box(x, k * 0.03, z + j * 0.035 + k * 0.017, x + 0.2, k * 0.03 + 0.03, z + j * 0.035 + k * 0.017 + 0.032, A.white, pick(rng, ['#9a7a52', '#8a6a48', '#a88660']), { rep: 0, top: wood });
  }
  // sawdust heap + conveyor
  b.pyramid(lw * 0.3, ld * 0.75, 0.14, 0, 0.14, 8, A.white, '#c9a66a', 0.3, true);
  b.box(lw * 0.3 - 0.015, 0.05, ld * 0.55, lw * 0.3 + 0.015, 0.2, ld * 0.75, A.white, '#5a5f66', { rep: 0 });
  if (level >= 3) smokestack(b, lw * 0.15, 0.25, 0, mill.yRoof + 0.4, 0.05, '#7a7a76');
  // logging truck
  const tz = ld - 0.15;
  b.box(0.15, 0.02, tz - 0.04, 0.24, 0.08, tz + 0.04, A.white, '#c0392b', { rep: 0, top: A.white });
  for (let k = 0; k < 3; k++) b.box(0.25, 0.04 + k * 0.025, tz - 0.035, 0.5, 0.065 + k * 0.025, tz + 0.035, A.white, '#9a7a52', { rep: 0, top: wood });
  for (let k = 0; k < 3; k++) tree(b, lw - 0.1, 0.15 + k * 0.3, 0.4, 'pine', '#2f6b3a', rng);
  return { floors: 1, h: mill.yRoof + (level >= 3 ? 0.4 : 0) };
}

function oreLot({ b, rng, lw, ld, level }) {
  const A = b.A;
  b.flatQuad(0.04, 0.04, lw - 0.04, ld - 0.04, 0.01, A.white, '#8a7e70');
  // open pit terraces
  for (let k = 0; k < 3; k++) b.box(0.1 + k * 0.08, -0.002, 0.1 + k * 0.06, lw * 0.55 - k * 0.08, 0.004 + (2 - k) * 0.002, ld * 0.6 - k * 0.06, A.white, ['#7a6e60', '#6a5e52', '#5a5048'][k], { rep: 0, top: A.white });
  // headframe
  const hx = lw * 0.72, hz = ld * 0.35, hh = 0.55 + level * 0.12;
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(hx + dx * 0.07 - 0.008, 0, hz + dz * 0.07 - 0.008, hx + dx * 0.04 + 0.008, hh, hz + dz * 0.04 + 0.008, A.white, '#5a5f66', { rep: 0 });
  b.box(hx - 0.06, hh, hz - 0.06, hx + 0.06, hh + 0.02, hz + 0.06, A.white, '#4a4f55', { rep: 0, top: A.white });
  b.cyl(hx, hz - 0.02, 0.05, hh + 0.02, hh + 0.025, 10, A.white, '#c0392b', { cap: true });
  shell(b, { rng, x0: lw * 0.6, x1: lw - 0.06, z0: ld * 0.55, z1: ld - 0.12, floors: 2, fh: 0.24, bayW: 0.35, m: 'metal', c: '#9aa0a6', trim: '#6a6f75', upperWin: 'slit', groundWin: 'loading', roof: { type: 'flat', parapet: 0.02, m: 'metal', c: '#7a8088' }, lit: 0.3 });
  // ore heaps + conveyor
  for (let k = 0; k < 2; k++) b.pyramid(0.25 + k * 0.3, ld - 0.25, 0.14, 0, 0.16, 7, A.white, pick(rng, ['#6a5a4a', '#8a6a4a', '#5a5a5a']), 0.3, true);
  b.grid([lw * 0.55, 0.22, hz - 0.02], [lw * 0.55, 0.22, hz + 0.02], [0.3, 0.02, ld - 0.25 + 0.02], [0.3, 0.02, ld - 0.25 - 0.02], 1, 1, A.white, '#3a3d42', [0, 1, 0]);
  if (level >= 2) smokestack(b, lw - 0.15, ld * 0.6, 0.48, 1.0, 0.04, '#7a7a76');
  // haul truck
  b.box(0.2, 0.02, 0.15, 0.36, 0.09, 0.25, A.white, '#d9a62b', { rep: 0, top: A.white });
  return { floors: 1.5, h: hh + 0.1 };
}

function oilLot({ b, rng, lw, ld, level }) {
  const A = b.A;
  b.flatQuad(0.04, 0.04, lw - 0.04, ld - 0.04, 0.01, A.white, '#8a8478');
  const pump = (x, z) => {
    b.box(x - 0.06, 0, z - 0.03, x + 0.06, 0.02, z + 0.03, A.white, '#5a5f66', { rep: 0, top: A.white });
    b.box(x - 0.008, 0.02, z - 0.025, x + 0.008, 0.12, z - 0.015, A.white, '#3a3d42', { rep: 0 }); b.box(x - 0.008, 0.02, z + 0.015, x + 0.008, 0.12, z + 0.025, A.white, '#3a3d42', { rep: 0 });
    b.box(x - 0.09, 0.12, z - 0.01, x + 0.07, 0.14, z + 0.01, A.white, '#d9a62b', { rep: 0, top: A.white });
    b.box(x - 0.11, 0.08, z - 0.012, x - 0.08, 0.16, z + 0.012, A.white, '#d9a62b', { rep: 0, top: A.white });
    b.box(x + 0.05, 0.03, z - 0.02, x + 0.08, 0.1, z + 0.02, A.white, '#3a3d42', { rep: 0, top: A.white });
  };
  const n = 1 + level + (lw > 2 ? 1 : 0);
  for (let k = 0; k < n; k++) pump(0.2 + (k % 2) * (lw * 0.45), 0.2 + Math.floor(k / 2) * 0.4);
  // storage tanks + pipes
  for (let k = 0; k < (level >= 2 ? 2 : 1); k++) { const tx = lw - 0.2 - k * 0.28, tz = ld - 0.3; b.cyl(tx, tz, 0.12, 0, 0.18, 14, A.white, '#e8e6df', { cap: true }); b.cyl(tx, tz, 0.125, 0.12, 0.13, 14, A.white, '#c0392b', { cap: false }); }
  b.box(0.2, 0.03, ld - 0.32, lw - 0.3, 0.045, ld - 0.31, A.white, '#7a7f86', { rep: 0 });
  if (level >= 3) { b.cyl(lw * 0.45, ld * 0.6, 0.05, 0, 0.75, 10, A.white, '#c9ccd0', {}); b.cyl(lw * 0.3, ld * 0.6, 0.04, 0, 0.6, 10, A.white, '#c9ccd0', {}); b.cyl(0.15, ld - 0.15, 0.012, 0, 0.6, 6, A.white, '#888', {}); if (b.smoke) b.smoke.push([0.15, 0.62, ld - 0.15]); }
  return { floors: 1, h: level >= 3 ? 0.75 : 0.25, flare: level >= 3 ? [0.15, 0.62, ld - 0.15] : null };
}

export const DENSE_GEN = { row: rowHouses, mixed: mixedUse, store: bigStore };
export const SPEC_GEN = { agri: agriLot, forest: forestLot, ore: oreLot, oil: oilLot };
