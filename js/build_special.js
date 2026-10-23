// Models for services, utilities, parks, landmarks and special industries.
import { pick } from './util.js';
import { shell, parapet, cornice, quoins, chimney, porch, portico, dormer, awning, balcony, fence, bush, tree, yard, path, hvac, waterTank, smokestack } from './build_common.js';
import { polyTower } from './build_zone.js';

// ---------------------------------------------------------------- style palettes for civic buildings
const CIV = {
  colonial: { m: 'clap', cs: ['#efe9d6', '#e9d9b0', '#d8dfe2'], roofM: 'shingle', roofC: '#5a5048', win: 'small', trim: '#f4f1e7', shutter: '#2f5a3d', roof: 'gable', fh: 0.28 },
  georgian: { m: 'brick', cs: ['#a4472f', '#9c5a3c', '#a9553a'], roofM: 'slate', roofC: '#4b5360', win: 'sash', trim: '#f2efe4', shutter: null, roof: 'hip', fh: 0.3 },
  southern: { m: 'clap', cs: ['#f4f1e8', '#efe2bd', '#f6f2e6'], roofM: 'metal', roofC: '#8a9099', win: 'tall', trim: '#fbf8ee', shutter: '#2c4a35', roof: 'hip', fh: 0.32 },
  american: { m: 'brick', cs: ['#8e4733', '#9a5035', '#a35c3f'], roofM: 'gravel', roofC: '#5f5f5a', win: 'sash', trim: '#efe9d8', shutter: null, roof: 'flat', fh: 0.3 },
  modern: { m: 'conc', cs: ['#d8d6cf', '#f1f0ea', '#cfcdc6'], roofM: 'gravel', roofC: '#6e6e6a', win: 'ribbon', trim: '#d5d3cc', shutter: null, roof: 'flat', fh: 0.3 },
};

function signCell(A, text, bg, fg = '#ffffff') {
  return A.decal('txt:' + text + bg + fg, (ctx, S) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(0, 0, S, 1); ctx.fillRect(0, S - 1, S, 1);
    ctx.save(); ctx.scale(1, 4);
    let fs = 13; ctx.font = `bold ${fs}px sans-serif`;
    while (ctx.measureText(text).width > S - 6 && fs > 5) { fs--; ctx.font = `bold ${fs}px sans-serif`; }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = fg;
    ctx.fillText(text, S / 2, S / 8);
    ctx.restore();
  });
}
function signBoard(b, text, bg, cx, z, y, w = 0.3, h = 0.075, fg) {
  b.wall(cx - w / 2, z + 0.004, 0, 1, w, y, y + h, signCell(b.A, text, bg, fg), [1, 1, 1], 0, 0);
}
function flagpole(b, x, z, h = 0.6) {
  const w = b.A.white;
  b.cyl(x, z, 0.006, 0, h, 5, w, '#d8d8d8', { cap: false });
  b.box(x, h - 0.1, z, x + 0.12, h - 0.03, z + 0.004, w, '#c0392b', { rep: 0 });
  b.box(x, h - 0.075, z, x + 0.05, h - 0.03, z + 0.005, w, '#2b4a7a', { rep: 0 });
}
function bench(b, x, z, w = 0.1) { const A = b.A.white; b.box(x, 0.02, z, x + w, 0.04, z + 0.03, A, '#7a5a3d', { rep: 0, top: A }); b.box(x, 0.0, z, x + 0.01, 0.02, z + 0.03, A, '#333', { rep: 0 }); b.box(x + w - 0.01, 0, z, x + w, 0.02, z + 0.03, A, '#333', { rep: 0 }); }
function crate(b, x, y, z, s, color) { b.box(x, y, z, x + s, y + s * 0.8, z + s, b.A.white, color, { rep: 0, top: b.A.white }); }
function copperDome(b, cx, cz, y, r, h = r * 0.9) { b.dome(cx, cz, r, y, h, 12, 4, b.A.roof({ m: 'copper', c: '#5e8a74' }), [1, 1, 1]); }

/** styled civic block. returns {s, r, P} */
function civic(b, rng, st, lw, ld, o = {}) {
  const A = b.A, P = CIV[st];
  const r = o.r || { x0: 0.08, x1: lw - 0.08, z0: 0.1, z1: ld - 0.25 };
  const floors = o.floors || 2;
  const c = o.c || pick(rng, P.cs);
  const roofType = o.roofType || P.roof;
  const s = shell(b, {
    rng, ...r, floors, fh: o.fh || P.fh, bayW: 0.32, m: o.m || P.m, c, trim: P.trim, shutter: o.noShutter ? null : P.shutter, upperWin: o.win || P.win, groundWin: o.groundWin || o.win || P.win,
    door: { kind: 'door', color: o.doorColor || '#2a3b55' },
    roof: roofType === 'gable' ? { type: 'gable', ridge: 'x', rise: 0.26, m: P.roofM, c: P.roofC } : roofType === 'hip' ? { type: 'hip', rise: 0.2, m: P.roofM, c: P.roofC, ridgeInset: o.ridgeInset === undefined ? 0.12 : o.ridgeInset } : { type: 'flat', parapet: 0.04, m: P.roofM, c: P.roofC },
    lit: 0.5,
  });
  const cx = (r.x0 + r.x1) / 2;
  if (!o.noPortico) {
    if (st === 'georgian' || st === 'southern') portico(b, { x0: cx - 0.2, x1: cx + 0.2, z: r.z1, depth: 0.12, h: (o.fh || P.fh) * 1.1, cols: 4, color: P.trim, roofCell: A.roof({ m: P.roofM, c: P.roofC }) });
    else if (st === 'colonial') porch(b, { x0: cx - 0.1, x1: cx + 0.1, z: r.z1, depth: 0.09, h: (o.fh || P.fh) * 0.92, cols: 2, color: P.trim, roofType: 'gable', rise: 0.07, roofCell: A.roof({ m: P.roofM, c: P.roofC }) });
    else if (st === 'american') { b.box(cx - 0.15, 0, r.z1, cx + 0.15, 0.06, r.z1 + 0.1, A.white, '#aaa49a', { rep: 0, top: A.white }); flagpole(b, r.x1 + 0.05, ld - 0.08); }
    else { b.box(cx - 0.2, (o.fh || P.fh) * 0.9, r.z1, cx + 0.2, (o.fh || P.fh) * 0.9 + 0.025, r.z1 + 0.16, A.white, '#3c4146', { rep: 0, top: A.white }); flagpole(b, r.x1 + 0.05, ld - 0.08); }
  }
  if (o.cupola) {
    const tz = (r.z0 + r.z1) / 2;
    b.box(cx - 0.06, s.yRoof, tz - 0.06, cx + 0.06, s.yRoof + 0.12, tz + 0.06, A.wall({ m: P.m, c: P.trim, w: 'arch', wc: P.trim, fl: 'u' }), [1, 1, 1], { rep: 0.12, top: A.white });
    b.hipRoof(cx - 0.06, tz - 0.06, cx + 0.06, tz + 0.06, s.yRoof + 0.12, 0.12, A.roof({ m: 'copper', c: '#5e8a74' }), [1, 1, 1], 0.025, 0);
  }
  if (o.sign) signBoard(b, o.sign, o.signBg || '#2a3b55', cx, r.z1, (o.fh || P.fh) * 1.05, 0.34, 0.07);
  return { s, r, P };
}

// ---------------------------------------------------------------- generators
export const SPECIAL_GEN = {};

// ---- education
SPECIAL_GEN.school_el = ({ b, rng, lw, ld, st }) => {
  const { s, r } = civic(b, rng, st, lw, ld, { floors: 2, cupola: true, sign: 'SCHOOL', signBg: '#2b5a8a' });
  // playground
  b.box(0.1, 0, ld - 0.1, 0.5, 0.008, ld - 0.02, b.A.white, '#8a8a90', { rep: 0 });
  b.box(0.14, 0.0, ld - 0.17, 0.15, 0.1, ld - 0.16, b.A.white, '#c0392b', { rep: 0 }); b.box(0.3, 0.0, ld - 0.17, 0.31, 0.1, ld - 0.16, b.A.white, '#c0392b', { rep: 0 }); b.box(0.14, 0.095, ld - 0.17, 0.31, 0.105, ld - 0.16, b.A.white, '#c0392b', { rep: 0 });
  tree(b, lw - 0.12, ld - 0.1, 0.34, 'round', '#4a8a3e', rng);
  return { floors: 2, h: s.yRoof + 0.2 };
};
SPECIAL_GEN.school_hi = ({ b, rng, lw, ld, st }) => {
  const { s, r } = civic(b, rng, st, lw, ld, { floors: 3, cupola: true, sign: 'HIGH SCHOOL', signBg: '#2b5a8a' });
  // sports field
  b.flatQuad(lw * 0.55, ld - 0.5, lw - 0.1, ld - 0.04, 0.01, b.A.roof({ m: 'grass', c: '#4d9a3f' }), '#ffffff');
  b.box(lw * 0.55, 0.011, ld - 0.5, lw - 0.1, 0.012, ld - 0.495, b.A.white, '#ffffff', { rep: 0 });
  return { floors: 3, h: s.yRoof + 0.2 };
};
SPECIAL_GEN.library = ({ b, rng, lw, ld, st }) => {
  const { s, r } = civic(b, rng, st, lw, ld, { floors: 2, sign: 'LIBRARY', signBg: '#6b4a2a', ridgeInset: 0.2 });
  copperDome(b, lw / 2, (r.z0 + r.z1) / 2, s.yRoof - 0.02, 0.09);
  tree(b, 0.1, ld - 0.1, 0.34, 'round', '#4a8a3e', rng);
  return { floors: 2, h: s.yRoof + 0.2 };
};
SPECIAL_GEN.university = ({ b, rng, lw, ld, st }) => {
  const A = b.A, P = CIV[st];
  const c = pick(rng, P.cs);
  // main hall at back, two wings, quad in the middle
  const mk = (x0, x1, z0, z1, f, tw) => shell(b, { rng, x0, x1, z0, z1, floors: f, fh: 0.3, bayW: 0.32, m: P.m, c, trim: P.trim, upperWin: P.win, groundWin: P.win, door: tw ? { kind: 'door', color: '#2a3b55' } : undefined, roof: P.roof === 'flat' ? { type: 'flat', parapet: 0.04, m: P.roofM, c: P.roofC } : { type: P.roof, ridge: 'x', rise: 0.22, m: P.roofM, c: P.roofC, ridgeInset: 0.1 }, lit: 0.5 });
  const s = mk(0.2, lw - 0.2, 0.15, 0.9, 3, true);
  mk(0.1, 0.8, 1.2, ld - 0.5, 2, false); mk(lw - 0.8, lw - 0.1, 1.2, ld - 0.5, 2, false);
  const cx = lw / 2;
  b.box(cx - 0.12, s.yRoof - 0.02, 0.32, cx + 0.12, s.yRoof + 0.5, 0.56, A.wall({ m: P.m, c, w: 'arch', wc: P.trim, fl: 'u' }), [1, 1, 1], { rep: 0.2, top: A.white });
  b.hipRoof(cx - 0.12, 0.32, cx + 0.12, 0.56, s.yRoof + 0.5, 0.25, A.roof({ m: 'copper', c: '#5e8a74' }), [1, 1, 1], 0.03, 0);
  for (let i = 0; i < 4; i++) tree(b, 0.9 + i * ((lw - 1.8) / 3), 2.0, 0.34, 'round', '#4a8a3e', rng);
  if (st === 'georgian' || st === 'southern') portico(b, { x0: cx - 0.3, x1: cx + 0.3, z: 0.9, depth: 0.14, h: 0.34, cols: 6, color: P.trim });
  b.flatQuad(cx - 0.1, 0.95, cx + 0.1, ld, 0.01, A.white, '#cfc8b4');
  return { floors: 3, h: s.yRoof + 0.75 };
};

// ---- health
function medical(b, rng, st, lw, ld, floors, label, big) {
  const A = b.A, P = CIV[st];
  const { s, r } = civic(b, rng, st, lw, ld, { floors, c: '#f1efe8', m: st === 'modern' ? 'conc' : 'stucco', win: st === 'modern' ? 'ribbon' : 'casement', roofType: big || st === 'modern' ? 'flat' : P.roof, noShutter: true, sign: label, signBg: '#b3262e', doorColor: '#b3262e', noPortico: true });
  const cx = (r.x0 + r.x1) / 2;
  // red cross
  b.wall(cx + 0.12, r.z1 + 0.003, 0, 1, 0.14, floors * 0.3 - 0.2, floors * 0.3 - 0.06, A.decal('cross', (ctx, S) => { ctx.fillStyle = '#f7f7f4'; ctx.fillRect(0, 0, S, S); ctx.fillStyle = '#d13a3a'; ctx.fillRect(S * 0.38, S * 0.1, S * 0.24, S * 0.8); ctx.fillRect(S * 0.1, S * 0.38, S * 0.8, S * 0.24); }), [1, 1, 1], 0, 0);
  b.box(cx - 0.2, 0.22, r.z1, cx + 0.2, 0.245, r.z1 + 0.18, A.white, '#d9d9d3', { rep: 0, top: A.white });
  b.box(cx - 0.2, 0.0, r.z1 + 0.16, cx - 0.185, 0.22, r.z1 + 0.175, A.white, '#d9d9d3', { rep: 0 }); b.box(cx + 0.185, 0.0, r.z1 + 0.16, cx + 0.2, 0.22, r.z1 + 0.175, A.white, '#d9d9d3', { rep: 0 });
  return { s, r };
}
SPECIAL_GEN.clinic = ({ b, rng, lw, ld, st }) => {
  const { s } = medical(b, rng, st, lw, ld, 2, 'CLINIC', false);
  tree(b, 0.1, ld - 0.08, 0.3, 'round', '#4a8a3e', rng);
  return { floors: 2, h: s.yRoof };
};
SPECIAL_GEN.hospital = ({ b, rng, lw, ld, st }) => {
  const A = b.A;
  const { s, r } = medical(b, rng, st, lw, ld, 4, 'HOSPITAL', true);
  // wings
  shell(b, { rng, x0: 0.05, x1: 0.55, z0: 0.2, z1: ld - 0.7, floors: 3, fh: 0.3, bayW: 0.3, m: 'stucco', c: '#e9e7de', trim: '#f4f4ee', upperWin: 'casement', roof: { type: 'flat', parapet: 0.03, m: 'gravel', c: '#6e6e6a' }, lit: 0.5 });
  shell(b, { rng, x0: lw - 0.55, x1: lw - 0.05, z0: 0.2, z1: ld - 0.7, floors: 3, fh: 0.3, bayW: 0.3, m: 'stucco', c: '#e9e7de', trim: '#f4f4ee', upperWin: 'casement', roof: { type: 'flat', parapet: 0.03, m: 'gravel', c: '#6e6e6a' }, lit: 0.5 });
  // helipad
  const hx = lw / 2, hz = (r.z0 + r.z1) / 2;
  b.box(hx - 0.2, s.yTop + 0.01, hz - 0.2, hx + 0.2, s.yTop + 0.03, hz + 0.2, A.helipad(), '#ffffff', { rep: 0, top: A.helipad() });
  // ambulances
  for (let i = 0; i < 2; i++) b.box(0.25 + i * 0.16, 0.0, ld - 0.14, 0.37 + i * 0.16, 0.08, ld - 0.04, A.white, '#f4f4f0', { rep: 0, top: A.white });
  tree(b, 0.1, ld - 0.1, 0.3, 'round', '#4a8a3e', rng); tree(b, lw - 0.1, ld - 0.1, 0.3, 'round', '#4a8a3e', rng);
  return { floors: 4, h: s.yTop + 0.1 };
};

// ---- police
function policeBase(b, rng, st, lw, ld, floors, label) {
  const A = b.A;
  const { s, r, P } = civic(b, rng, st, lw, ld, { floors, c: st === 'modern' ? '#c9d1d9' : undefined, sign: label, signBg: '#1f3a6b', doorColor: '#1f3a6b' });
  const cx = (r.x0 + r.x1) / 2;
  // blue stripe + light
  b.box(r.x0 - 0.005, floors * (P.fh) - 0.05, r.z1, r.x1 + 0.005, floors * P.fh - 0.02, r.z1 + 0.006, A.white, '#1f4ba8', { rep: 0 });
  b.box(cx - 0.025, s.yTop + 0.0, (r.z0 + r.z1) / 2 - 0.025, cx + 0.025, s.yTop + 0.06, (r.z0 + r.z1) / 2 + 0.025, A.white, '#d33', { rep: 0, top: A.white });
  // parked cars
  for (let i = 0; i < 2; i++) { b.box(r.x0 + 0.05 + i * 0.16, 0.0, ld - 0.12, r.x0 + 0.17 + i * 0.16, 0.05, ld - 0.04, A.white, '#1f2d4a', { rep: 0, top: A.white }); b.box(r.x0 + 0.07 + i * 0.16, 0.05, ld - 0.115, r.x0 + 0.15 + i * 0.16, 0.075, ld - 0.06, A.white, '#dfe7f0', { rep: 0, top: A.white }); }
  return { s, r, P };
}
SPECIAL_GEN.police_st = ({ b, rng, lw, ld, st }) => { const { s } = policeBase(b, rng, st, lw, ld, 2, 'POLICE'); return { floors: 2, h: s.yRoof }; };
SPECIAL_GEN.police_hq = ({ b, rng, lw, ld, st }) => {
  const A = b.A;
  const { s, r } = policeBase(b, rng, st, lw, ld, 4, 'POLICE HQ');
  b.cyl(lw / 2 + 0.3, (r.z0 + r.z1) / 2, 0.006, s.yTop, s.yTop + 0.5, 4, A.white, '#cfcfcf', {});
  b.box(lw / 2 - 0.45, s.yTop + 0.01, (r.z0 + r.z1) / 2 - 0.15, lw / 2 - 0.15, s.yTop + 0.03, (r.z0 + r.z1) / 2 + 0.15, A.helipad(), '#ffffff', { rep: 0, top: A.helipad() });
  return { floors: 4, h: s.yTop + 0.5 };
};
SPECIAL_GEN.courthouse = ({ b, rng, lw, ld, st }) => {
  const A = b.A;
  const P = CIV[st === 'modern' || st === 'american' ? 'georgian' : st];
  const r = { x0: 0.1, x1: lw - 0.1, z0: 0.1, z1: ld - 0.28 };
  const c = '#e5dfcf';
  const s = shell(b, { rng, ...r, floors: 2, fh: 0.34, bayW: 0.3, m: 'stone', c, trim: '#f4f1e7', upperWin: 'arch', groundWin: 'arch', door: { kind: 'door', color: '#2a3b55' }, roof: { type: 'flat', parapet: 0.06, m: 'slate', c: '#59616b' }, lit: 0.5 });
  portico(b, { x0: r.x0 + 0.12, x1: r.x1 - 0.12, z: r.z1, depth: 0.2, h: 0.62, cols: 6, color: '#f4f1e7', r: 0.026 });
  copperDome(b, lw / 2, (r.z0 + r.z1) / 2, s.yTop + 0.06, 0.2, 0.22);
  b.cyl(lw / 2, (r.z0 + r.z1) / 2, 0.01, s.yTop + 0.28, s.yTop + 0.4, 5, A.white, '#d9b34a', {});
  return { floors: 2.5, h: s.yTop + 0.4 };
};
SPECIAL_GEN.prison = ({ b, rng, lw, ld, st }) => {
  const A = b.A;
  const wall = A.wall({ m: 'conc', c: '#a9a8a2', w: 'none' });
  b.box(0.05, 0, 0.05, lw - 0.05, 0.22, 0.12, wall, '#fff', { rep: 0.4, top: A.white }); b.box(0.05, 0, ld - 0.5, lw - 0.05, 0.22, ld - 0.43, wall, '#fff', { rep: 0.4, top: A.white });
  b.box(0.05, 0, 0.12, 0.12, 0.22, ld - 0.5, wall, '#fff', { rep: 0.4, top: A.white }); b.box(lw - 0.12, 0, 0.12, lw - 0.05, 0.22, ld - 0.5, wall, '#fff', { rep: 0.4, top: A.white });
  for (const [x, z] of [[0.05, 0.05], [lw - 0.17, 0.05], [0.05, ld - 0.55], [lw - 0.17, ld - 0.55]]) { b.box(x, 0, z, x + 0.12, 0.38, z + 0.12, wall, '#fff', { rep: 0.3, top: A.white }); b.box(x - 0.02, 0.38, z - 0.02, x + 0.14, 0.44, z + 0.14, A.white, '#6d7076', { rep: 0, top: A.white }); }
  shell(b, { rng, x0: 0.3, x1: lw - 0.3, z0: 0.3, z1: 0.8, floors: 3, fh: 0.24, bayW: 0.26, m: 'conc', c: '#bdbbb3', trim: '#999', upperWin: 'slit', roof: { type: 'flat', parapet: 0.02, m: 'gravel', c: '#666' }, lit: 0.2 });
  shell(b, { rng, x0: 0.3, x1: 0.8, z0: 0.9, z1: ld - 0.8, floors: 3, fh: 0.24, bayW: 0.26, m: 'conc', c: '#bdbbb3', trim: '#999', upperWin: 'slit', roof: { type: 'flat', parapet: 0.02, m: 'gravel', c: '#666' }, lit: 0.2 });
  shell(b, { rng, x0: lw - 0.8, x1: lw - 0.3, z0: 0.9, z1: ld - 0.8, floors: 3, fh: 0.24, bayW: 0.26, m: 'conc', c: '#bdbbb3', trim: '#999', upperWin: 'slit', roof: { type: 'flat', parapet: 0.02, m: 'gravel', c: '#666' }, lit: 0.2 });
  shell(b, { rng, x0: lw / 2 - 0.3, x1: lw / 2 + 0.3, z0: ld - 0.42, z1: ld - 0.1, floors: 2, fh: 0.25, bayW: 0.3, m: 'brick', c: '#8a6a58', trim: '#ddd', upperWin: 'casement', door: { kind: 'door', color: '#444' }, roof: { type: 'flat', parapet: 0.03, m: 'gravel', c: '#666' }, lit: 0.4 });
  return { floors: 3, h: 0.7 };
};

// ---- fire
function fireBase(b, rng, st, lw, ld, floors, label, tall) {
  const A = b.A;
  const brick = st === 'modern' ? '#c4c8cc' : '#a1382c';
  const r = { x0: 0.08, x1: lw - 0.08, z0: 0.1, z1: ld - 0.25 };
  const P = CIV[st];
  const s = shell(b, { rng, ...r, floors, fh: 0.3, bayW: 0.42, m: st === 'modern' ? 'conc' : 'brick', c: brick, trim: '#f1eee4', upperWin: P.win === 'ribbon' ? 'ribbon' : 'sash', groundWin: 'garage', groundExtra: { dc: '#d33a2c' }, door: { kind: 'garage', color: '#d33a2c', bay: 'left' }, roof: P.roof === 'gable' || P.roof === 'hip' ? { type: 'hip', rise: 0.16, m: P.roofM, c: P.roofC, ridgeInset: 0.12 } : { type: 'flat', parapet: 0.05, m: 'gravel', c: '#5f5f5a' }, lit: 0.4 });
  signBoard(b, label, '#b3262e', lw / 2, r.z1, floors * 0.3 + 0.0, 0.34, 0.07);
  // hose tower
  const tx = r.x1 - 0.14, tz = (r.z0 + r.z1) / 2;
  const th = floors * 0.3 + (tall ? 0.8 : 0.3);
  b.box(tx - 0.1, 0, tz - 0.1, tx + 0.1, th, tz + 0.1, A.wall({ m: st === 'modern' ? 'conc' : 'brick', c: brick, w: 'arch', wc: '#f1eee4', fl: 'u' }), [1, 1, 1], { rep: 0.2, top: A.white });
  b.hipRoof(tx - 0.1, tz - 0.1, tx + 0.1, tz + 0.1, th, 0.14, A.roof({ m: 'slate', c: '#3f444d' }), [1, 1, 1], 0.025, 0);
  b.flatQuad(0.03, r.z1 + 0.0, lw - 0.03, ld - 0.02, 0.008, A.white, '#6f7073');
  // parked engines
  for (let i = 0; i < 1 + (lw > 2 ? 1 : 0); i++) { b.box(r.x0 + 0.05 + i * 0.3, 0.0, ld - 0.14, r.x0 + 0.33 + i * 0.3, 0.07, ld - 0.04, A.white, '#d33a2c', { rep: 0, top: A.white }); b.box(r.x0 + 0.05 + i * 0.3, 0.07, ld - 0.14, r.x0 + 0.12 + i * 0.3, 0.1, ld - 0.04, A.white, '#e8e0d0', { rep: 0, top: A.white }); }
  return { s, r, th };
}
SPECIAL_GEN.fire_st = ({ b, rng, lw, ld, st }) => { const { s, th } = fireBase(b, rng, st, lw, ld, 2, 'FIRE', false); return { floors: 2, h: th }; };
SPECIAL_GEN.fire_hq = ({ b, rng, lw, ld, st }) => { const { s, th } = fireBase(b, rng, st, lw, ld, 3, 'FIRE HQ', true); return { floors: 3, h: th + 0.2 }; };

// ---- waste
SPECIAL_GEN.landfill = ({ b, rng, lw, ld }) => {
  const A = b.A;
  // mound
  b.pyramid(lw * 0.5, ld * 0.45, 1.05, 0.0, 0.5, 9, A.roof({ m: 'grass', c: '#6f6a4a' }), '#8c8566', 0.2, true);
  b.pyramid(lw * 0.3, ld * 0.4, 0.5, 0.0, 0.32, 8, A.roof({ m: 'grass', c: '#5d5a3d' }), '#9a9370', 0.5, true);
  fence(b, 0.03, 0.03, lw - 0.03, 0.03, 0.08, '#8a8a82'); fence(b, 0.03, ld - 0.03, lw - 0.03, ld - 0.03, 0.08, '#8a8a82');
  fence(b, 0.03, 0.03, 0.03, ld - 0.03, 0.08, '#8a8a82'); fence(b, lw - 0.03, 0.03, lw - 0.03, ld - 0.03, 0.08, '#8a8a82');
  shell(b, { rng, x0: lw - 0.7, x1: lw - 0.15, z0: ld - 0.7, z1: ld - 0.3, floors: 1, fh: 0.25, bayW: 0.3, m: 'metal', c: '#6d8a9a', trim: '#ddd', upperWin: 'casement', roof: { type: 'gable', ridge: 'x', rise: 0.1, m: 'metal', c: '#4a5a66' }, lit: 0.2 });
  for (let i = 0; i < 4; i++) b.box(0.3 + i * 0.12, 0.0, ld - 0.25, 0.4 + i * 0.12, 0.06, ld - 0.15, A.white, '#d9d9d6', { rep: 0, top: A.white });
  return { floors: 1, h: 0.5 };
};
SPECIAL_GEN.incinerator = ({ b, rng, lw, ld }) => {
  const A = b.A;
  const s = shell(b, { rng, x0: 0.1, x1: lw - 0.1, z0: 0.1, z1: ld - 0.45, floors: 2, fh: 0.34, bayW: 0.4, m: 'brick', c: '#7a5a4a', trim: '#ddd', upperWin: 'slit', groundWin: 'slit', door: { kind: 'loading', color: '#c0782a', bay: 'right' }, roof: { type: 'flat', parapet: 0.03, m: 'metal', c: '#7d848a' }, lit: 0.3 });
  smokestack(b, 0.4, 0.4, 0, 1.0, 0.085, '#8b4a38'); smokestack(b, 0.75, 0.4, 0, 0.85, 0.07, '#8b4a38');
  b.cyl(lw - 0.4, 0.4, 0.14, s.yTop, s.yTop + 0.24, 10, A.white, '#9aa0a4', {});
  b.box(0.1, 0, ld - 0.4, lw - 0.1, 0.02, ld - 0.05, A.white, '#6f7073', { rep: 0 });
  for (let i = 0; i < 3; i++) b.box(0.2 + i * 0.25, 0.02, ld - 0.3, 0.38 + i * 0.25, 0.1, ld - 0.12, A.white, '#c2882c', { rep: 0, top: A.white });
  return { floors: 2, h: 1.0 };
};
SPECIAL_GEN.recycling = ({ b, rng, lw, ld }) => {
  const A = b.A;
  const s = shell(b, { rng, x0: 0.1, x1: lw - 0.1, z0: 0.1, z1: ld - 0.4, floors: 1, fh: 0.42, bayW: 0.4, m: 'metal', c: '#4f9a5a', trim: '#e8f0e8', upperWin: 'slit', groundWin: 'slit', door: { kind: 'loading', color: '#2d6a3a', bay: 'right' }, roof: { type: 'gable', ridge: 'x', rise: 0.12, m: 'solar', c: '#16233a' }, lit: 0.3 });
  for (const [i, col] of [[0, '#2a6fb5'], [1, '#2d9a4a'], [2, '#d9a62b'], [3, '#c0392b']]) b.box(0.15 + i * 0.22, 0, ld - 0.3, 0.33 + i * 0.22, 0.12, ld - 0.14, A.white, col, { rep: 0, top: A.white });
  b.cyl(lw - 0.2, 0.25, 0.05, 0.0, 0.5, 8, A.white, '#9aa0a4', {});
  return { floors: 1, h: 0.5 };
};

// ---- power
SPECIAL_GEN.wind = ({ b }) => {
  const A = b.A;
  b.cyl(0.5, 0.5, 0.035, 0, 1.05, 8, A.white, '#ebebea', { r1: 0.02, cap: false });
  b.box(0.45, 1.03, 0.4, 0.55, 1.1, 0.6, A.white, '#d8d8d6', { rep: 0, top: A.white });
  return { floors: 1, h: 1.1, rotor: [0.5, 1.07, 0.62] };
};
SPECIAL_GEN.coal = ({ b, rng, lw, ld }) => {
  const A = b.A;
  shell(b, { rng, x0: 0.2, x1: 2.1, z0: 0.2, z1: 1.2, floors: 2, fh: 0.42, bayW: 0.5, m: 'metal', c: '#8f979c', trim: '#ccc', upperWin: 'slit', groundWin: 'slit', roof: { type: 'flat', parapet: 0.03, m: 'metal', c: '#6d747a' }, lit: 0.3 });
  for (const x of [2.7, 3.3]) { b.cyl(x, 0.65, 0.34, 0, 0.5, 14, A.wall({ m: 'conc', c: '#bfbdb6', w: 'none' }), '#fff', { r1: 0.26, cap: false, uRep: 3 }); b.cyl(x, 0.65, 0.26, 0.5, 0.95, 14, A.wall({ m: 'conc', c: '#c9c7c0', w: 'none' }), '#fff', { r1: 0.31, cap: false, uRep: 3 }); }
  smokestack(b, 0.5, 0.6, 0.8, 1.55, 0.07, '#8f8a82'); b.cyl(0.5, 0.6, 0.07, 0, 0.8, 10, A.white, '#8f8a82', { r1: 0.07, cap: false });
  smokestack(b, 1.0, 0.6, 0.8, 1.45, 0.06, '#8f8a82'); b.cyl(1.0, 0.6, 0.06, 0, 0.8, 10, A.white, '#8f8a82', { r1: 0.06, cap: false });
  // coal heap + conveyor
  b.pyramid(1.0, 2.2, 0.55, 0, 0.22, 8, A.white, '#2a2a2d', 0.2, true);
  b.box(1.0, 0.2, 1.2, 1.08, 0.24, 2.0, A.white, '#4a4d52', { rep: 0 });
  for (let i = 0; i < 3; i++) b.box(2.5 + i * 0.26, 0, 2.0 - i * 0.05, 2.7 + i * 0.26, 0.16, 2.4, A.white, '#d9a62b', { rep: 0, top: A.white });
  return { floors: 2, h: 1.6, smoke: [[0.5, 1.6, 0.6], [1.0, 1.5, 0.6], [2.7, 0.95, 0.65], [3.3, 0.95, 0.65]] };
};
SPECIAL_GEN.solar = ({ b }) => {
  const A = b.A;
  const cell = A.roof({ m: 'solar', c: '#16233a' });
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
    const x = 0.12 + c * 0.7, z = 0.14 + r * 0.9;
    b.grid([x, 0.14, z + 0.6], [x + 0.58, 0.14, z + 0.6], [x + 0.58, 0.3, z], [x, 0.3, z], 4, 2, cell, [1, 1, 1], [0, 1, 0.6]);
    b.box(x + 0.05, 0, z + 0.3, x + 0.07, 0.2, z + 0.34, A.white, '#7d7d7d', { rep: 0 }); b.box(x + 0.5, 0, z + 0.3, x + 0.52, 0.2, z + 0.34, A.white, '#7d7d7d', { rep: 0 });
  }
  b.box(2.5, 0, 2.5, 2.9, 0.18, 2.9, A.white, '#c6c9cc', { rep: 0, top: A.white });
  return { floors: 1, h: 0.3 };
};
SPECIAL_GEN.hydro = ({ b, rng, lw, ld }) => {
  const A = b.A;
  b.box(0.0, 0, 0.55, lw, 0.45, 0.95, A.wall({ m: 'conc', c: '#b7b5ae', w: 'none' }), '#fff', { rep: 0.4, top: A.white });
  for (let i = 0; i < 4; i++) b.box(0.25 + i * 0.65, 0.2, 0.95, 0.5 + i * 0.65, 0.4, 1.0, A.white, '#7d8a90', { rep: 0 });
  shell(b, { rng, x0: 0.2, x1: 1.4, z0: 1.0, z1: 1.85, floors: 1, fh: 0.4, bayW: 0.4, m: 'conc', c: '#c7c5be', trim: '#e0e0e0', upperWin: 'ribbon', door: { kind: 'door', color: '#2a6fb5' }, roof: { type: 'flat', parapet: 0.03, m: 'gravel', c: '#666' }, lit: 0.3 });
  for (let i = 0; i < 2; i++) b.cyl(1.9 + i * 0.5, 1.4, 0.05, 0, 0.5, 8, A.white, '#8a8a90', {});
  return { floors: 1, h: 0.5 };
};
export const PYLON = ({ b }) => {
  const A = b.A;
  const w = A.white, col = '#6c7479';
  b.cyl(0.5, 0.5, 0.012, 0, 0.5, 5, w, col, { r1: 0.006, cap: false });
  b.box(0.3, 0.42, 0.495, 0.7, 0.43, 0.505, w, col, { rep: 0 });
  b.box(0.35, 0.34, 0.495, 0.65, 0.35, 0.505, w, col, { rep: 0 });
  return { floors: 1, h: 0.5 };
};

// ---- water
SPECIAL_GEN.pump = ({ b, rng }) => {
  const A = b.A;
  shell(b, { rng, x0: 0.2, x1: 0.8, z0: 0.2, z1: 0.8, floors: 1, fh: 0.28, bayW: 0.3, m: 'brick', c: '#8a6a58', trim: '#ddd', upperWin: 'casement', roof: { type: 'hip', rise: 0.14, m: 'metal', c: '#4a6a8a' }, lit: 0.3 });
  b.cyl(0.85, 0.15, 0.06, 0, 0.26, 8, A.white, '#3a79c0', {});
  return { floors: 1, h: 0.4 };
};
SPECIAL_GEN.well = ({ b, rng, lw, ld }) => {
  const A = b.A;
  shell(b, { rng, x0: 0.15, x1: 0.85, z0: ld - 0.85, z1: ld - 0.25, floors: 1, fh: 0.28, bayW: 0.3, m: 'brick', c: '#8a6a58', trim: '#ddd', upperWin: 'casement', roof: { type: 'gable', ridge: 'x', rise: 0.12, m: 'metal', c: '#4a6a8a' }, lit: 0.3 });
  waterTank(b, 1.4, 0.7, 0.0, 0.2, '#4a86c4');
  return { floors: 1, h: 1.2 };
};
SPECIAL_GEN.sewage = ({ b, rng, lw, ld }) => {
  const A = b.A;
  for (const [x, z] of [[0.6, 0.6], [1.6, 0.6], [2.4, 0.6]]) { b.cyl(x, z, 0.38, 0, 0.1, 16, A.wall({ m: 'conc', c: '#b9b7b0', w: 'none' }), '#fff', { cap: false }); b.cyl(x, z, 0.35, 0.095, 0.1, 16, A.roof({ m: 'water', c: '#5a7f5a' }), '#fff', { cap: true }); }
  shell(b, { rng, x0: 0.2, x1: 1.5, z0: 1.4, z1: 2.2, floors: 1, fh: 0.36, bayW: 0.4, m: 'conc', c: '#c7c5be', trim: '#e0e0e0', upperWin: 'ribbon', door: { kind: 'door', color: '#2a6fb5' }, roof: { type: 'flat', parapet: 0.03, m: 'gravel', c: '#666' }, lit: 0.3 });
  b.cyl(2.3, 1.8, 0.28, 0, 0.5, 12, A.white, '#9aa6ae', { r1: 0.28 });
  return { floors: 1, h: 0.5 };
};

// ---- civic
SPECIAL_GEN.townhall = ({ b, rng, lw, ld, st }) => {
  const A = b.A, P = CIV[st];
  const { s, r } = civic(b, rng, st, lw, ld, { floors: 3, sign: 'TOWN HALL', signBg: '#4a3a22', ridgeInset: 0.3 });
  const cx = (r.x0 + r.x1) / 2, tz = (r.z0 + r.z1) / 2;
  const tw = 0.2;
  const th = s.yRoof + 0.45;
  b.box(cx - tw / 2, s.yRoof - 0.05, tz - tw / 2, cx + tw / 2, th, tz + tw / 2, A.wall({ m: P.m, c: P.cs[0], w: 'arch', wc: P.trim, fl: 'u' }), [1, 1, 1], { rep: 0.2, top: A.white });
  b.wall(cx - 0.06, tz + tw / 2 + 0.003, 0, 1, 0.12, th - 0.25, th - 0.13, A.clock(), [1, 1, 1], 0, 0);
  b.hipRoof(cx - tw / 2, tz - tw / 2, cx + tw / 2, tz + tw / 2, th, 0.3, A.roof({ m: 'copper', c: '#5e8a74' }), [1, 1, 1], 0.03, 0);
  flagpole(b, lw - 0.15, ld - 0.1, 0.7);
  return { floors: 3, h: th + 0.3 };
};

// ---- transit
SPECIAL_GEN.bus_depot = ({ b, rng, lw, ld }) => {
  const A = b.A;
  shell(b, { rng, x0: 0.1, x1: lw - 0.1, z0: 0.1, z1: ld - 0.5, floors: 1, fh: 0.4, bayW: 0.5, m: 'metal', c: '#c9d3d9', trim: '#2b8a9a', upperWin: 'slit', groundWin: 'loading', groundExtra: { dc: '#2b8a9a' }, roof: { type: 'gable', ridge: 'x', rise: 0.1, m: 'metal', c: '#5a6a72' }, lit: 0.2 });
  for (let i = 0; i < 3; i++) { b.box(0.15 + i * 0.5, 0.0, ld - 0.4, 0.55 + i * 0.5, 0.17, ld - 0.14, A.white, '#2b8a9a', { rep: 0, top: A.white }); b.box(0.17 + i * 0.5, 0.1, ld - 0.4, 0.53 + i * 0.5, 0.14, ld - 0.395, A.white, '#cfe8ef', { rep: 0 }); }
  return { floors: 1, h: 0.5 };
};
SPECIAL_GEN.train_station = ({ b, rng, lw, ld, st }) => {
  const A = b.A, P = CIV[st];
  // building on the street side; platform with canopy behind
  const s = shell(b, { rng, x0: 0.15, x1: lw - 0.15, z0: ld - 1.0, z1: ld - 0.2, floors: 2, fh: 0.3, bayW: 0.34, m: P.m === 'conc' ? 'conc' : 'brick', c: st === 'modern' ? '#dcdad3' : '#9c4a36', trim: P.trim, upperWin: P.win, groundWin: 'arch', door: { kind: 'door', color: '#2a3b55' }, roof: P.roof === 'flat' ? { type: 'flat', parapet: 0.04, m: 'gravel', c: '#666' } : { type: 'hip', rise: 0.18, m: P.roofM, c: P.roofC, ridgeInset: 0.14 }, lit: 0.5 });
  signBoard(b, 'STATION', '#1f3a6b', lw / 2, ld - 0.2, 0.62, 0.4, 0.08);
  b.box(0.1, 0, 0.1, lw - 0.1, 0.1, ld - 1.1, A.white, '#aaa79d', { rep: 0, top: A.white });
  for (let i = 0; i < 4; i++) b.cyl(0.3 + i * ((lw - 0.6) / 3), 0.5, 0.02, 0.1, 0.42, 6, A.white, '#3a3d42', { cap: false });
  b.box(0.1, 0.42, 0.25, lw - 0.1, 0.46, 0.75, A.white, '#c9c7c0', { rep: 0, top: A.roof({ m: 'metal', c: '#8a9096' }) });
  return { floors: 2, h: s.yRoof };
};

// ---- parks
SPECIAL_GEN.fountain = ({ b }) => {
  const A = b.A;
  b.cyl(0.5, 0.5, 0.3, 0, 0.07, 16, A.white, '#cfc8b4', { cap: false });
  b.cyl(0.5, 0.5, 0.3, 0.07, 0.075, 16, A.roof({ m: 'water', c: '#4aa3c8' }), '#fff', { cap: true });
  b.cyl(0.5, 0.5, 0.045, 0.0, 0.2, 8, A.white, '#cfc8b4', { r1: 0.03, cap: false });
  b.cyl(0.5, 0.5, 0.1, 0.18, 0.2, 12, A.white, '#cfc8b4', { cap: true });
  b.pyramid(0.5, 0.5, 0.012, 0.2, 0.36, 5, A.white, '#bfe6f5', 0, true);
  bench(b, 0.12, 0.85); bench(b, 0.7, 0.85);
  return { floors: 1, h: 0.4, fountain: [0.5, 0.2, 0.5] };
};
SPECIAL_GEN.playground = ({ b, rng, lw, ld }) => {
  const A = b.A;
  b.box(0.1, 0.0, 0.1, lw - 0.1, 0.012, ld - 0.1, A.white, '#d9c9a0', { rep: 0 });
  // slide & climbing frame
  b.box(0.3, 0.0, 0.3, 0.5, 0.2, 0.5, A.white, '#d6453a', { rep: 0, top: A.white });
  b.grid([0.5, 0.2, 0.3], [0.5, 0.2, 0.5], [0.8, 0.02, 0.5], [0.8, 0.02, 0.3], 1, 1, A.white, '#f2c14e', [0, 1, 0]);
  // swings
  for (const x of [1.2, 1.6]) b.box(x, 0.0, 1.4, x + 0.015, 0.22, 1.415, A.white, '#3a79c0', { rep: 0 });
  b.box(1.2, 0.21, 1.4, 1.62, 0.225, 1.415, A.white, '#3a79c0', { rep: 0 });
  b.box(1.35, 0.06, 1.405, 1.4, 0.065, 1.45, A.white, '#222', { rep: 0 }); b.box(1.45, 0.06, 1.405, 1.5, 0.065, 1.45, A.white, '#222', { rep: 0 });
  // seesaw + bench
  b.box(0.3, 0.04, 1.4, 0.8, 0.055, 1.46, A.white, '#d98b2b', { rep: 0, top: A.white });
  bench(b, 1.4, 0.2); tree(b, 0.15, 1.7, 0.4, 'round', '#4a8a3e', rng); tree(b, 1.8, 0.2, 0.4, 'round', '#5a9a46', rng);
  return { floors: 1, h: 0.4 };
};
SPECIAL_GEN.sports = ({ b, rng, lw, ld }) => {
  const A = b.A;
  b.flatQuad(0.08, 0.08, lw - 0.08, ld - 0.08, 0.012, A.roof({ m: 'grass', c: '#4d9a3f' }), '#ffffff', 3, 2);
  const ln = (x0, z0, x1, z1) => b.box(x0, 0.013, z0, x1, 0.0145, z1, A.white, '#ffffff', { rep: 0 });
  ln(0.15, 0.15, lw - 0.15, 0.165); ln(0.15, ld - 0.165, lw - 0.15, ld - 0.15); ln(0.15, 0.15, 0.165, ld - 0.15); ln(lw - 0.165, 0.15, lw - 0.15, ld - 0.15); ln(lw / 2 - 0.008, 0.15, lw / 2 + 0.008, ld - 0.15);
  for (const x of [0.12, lw - 0.12]) { b.box(x - 0.01, 0, ld / 2 - 0.08, x, 0.14, ld / 2 - 0.07, A.white, '#fafafa', { rep: 0 }); b.box(x - 0.01, 0, ld / 2 + 0.07, x, 0.14, ld / 2 + 0.08, A.white, '#fafafa', { rep: 0 }); b.box(x - 0.01, 0.13, ld / 2 - 0.08, x, 0.14, ld / 2 + 0.08, A.white, '#fafafa', { rep: 0 }); }
  b.box(0.3, 0, ld - 0.07, lw - 0.3, 0.07, ld - 0.02, A.white, '#7e8a92', { rep: 0, top: A.white });
  return { floors: 1, h: 0.15 };
};
SPECIAL_GEN.square = ({ b, rng, lw, ld, st }) => {
  const A = b.A;
  b.box(0.08, 0, 0.08, lw - 0.08, 0.02, ld - 0.08, A.white, '#cfc7b3', { rep: 0, top: A.white });
  // monument
  const cx = lw / 2, cz = ld / 2;
  b.box(cx - 0.18, 0.02, cz - 0.18, cx + 0.18, 0.08, cz + 0.18, A.white, '#bdb6a4', { rep: 0, top: A.white });
  b.box(cx - 0.1, 0.08, cz - 0.1, cx + 0.1, 0.16, cz + 0.1, A.white, '#cfc8b4', { rep: 0, top: A.white });
  if (st === 'modern') b.pyramid(cx, cz, 0.07, 0.16, 0.8, 4, A.white, '#d6dadd', Math.PI / 4);
  else { b.cyl(cx, cz, 0.04, 0.16, 0.5, 6, A.white, '#cfc8b4', { r1: 0.025, cap: false }); b.dome(cx, cz, 0.05, 0.5, 0.06, 8, 3, A.white, '#7a8a84'); b.cyl(cx, cz, 0.012, 0.56, 0.7, 5, A.white, '#7a8a84', {}); }
  for (const [x, z] of [[0.3, 0.25], [lw - 0.3, 0.25], [0.3, ld - 0.25], [lw - 0.3, ld - 0.25]]) tree(b, x, z, 0.36, 'round', '#4a8a3e', rng);
  bench(b, cx - 0.5, cz + 0.4); bench(b, cx + 0.4, cz + 0.4); bench(b, cx - 0.5, cz - 0.4); bench(b, cx + 0.4, cz - 0.4);
  return { floors: 1, h: 0.8 };
};
SPECIAL_GEN.garden = ({ b, rng, lw, ld }) => {
  const A = b.A;
  // glasshouse
  const gx0 = lw / 2 - 0.5, gx1 = lw / 2 + 0.5, gz0 = 0.2, gz1 = 1.0;
  const glass = A.wall({ m: 'glass', c: '#9ad0c4', w: 'curtain', gl: 'green', fl: 'u' });
  b.box(gx0, 0, gz0, gx1, 0.3, gz1, glass, '#fff', { rep: 0.2, top: A.white, noTop: false });
  b.gable(gx0, gz0, gx1, gz1, 0.3, 0.2, 'x', glass, '#fff', glass, '#fff', 0.01, 0.2);
  b.dome(lw / 2, (gz0 + gz1) / 2, 0.25, 0.3, 0.3, 10, 3, glass, '#fff');
  // flower beds
  const cols = ['#e84a5f', '#f4d35e', '#9b5de5', '#ff9f1c', '#f15bb5'];
  for (let i = 0; i < 6; i++) { const x = 0.2 + (i % 3) * ((lw - 0.6) / 2), z = 1.4 + Math.floor(i / 3) * 0.55; b.box(x, 0.0, z, x + 0.45, 0.03, z + 0.3, A.white, cols[i % cols.length], { rep: 0, top: A.white }); }
  tree(b, 0.15, 0.3, 0.45, 'round', '#4a8a3e', rng); tree(b, lw - 0.15, 0.3, 0.45, 'round', '#5a9a46', rng);
  return { floors: 1, h: 0.6 };
};

// ---- landmarks
SPECIAL_GEN.church = ({ b, rng, lw, ld, st }) => {
  const A = b.A;
  const P = CIV[st];
  const nave = { x0: 0.15, x1: lw - 0.15, z0: 0.15, z1: ld - 0.55 };
  const stone = st === 'american';
  const c = st === 'georgian' ? '#a4472f' : st === 'american' ? '#b9b4a6' : st === 'modern' ? '#e9e6dd' : '#f4f1e7';
  const s = shell(b, { rng, ...nave, floors: 1, fh: 0.5, bayW: 0.35, m: stone ? 'stone' : st === 'georgian' ? 'brick' : st === 'modern' ? 'conc' : 'clap', c, trim: '#fbf8ee', upperWin: 'arch', groundWin: 'arch', roof: st === 'modern' ? { type: 'shed', rise: 0.3, m: 'metal', c: '#8a9096' } : { type: 'gable', ridge: 'z', rise: 0.28, m: P.roofM === 'gravel' ? 'slate' : P.roofM, c: P.roofC === '#5f5f5a' ? '#4b5360' : P.roofC }, lit: 0.5 });
  // tower at the front
  const tw = 0.3, tx = lw / 2, tz0 = ld - 0.58, tz1 = ld - 0.28;
  b.box(tx - tw / 2, 0, tz0, tx + tw / 2, 0.72, tz1, A.wall({ m: stone ? 'stone' : st === 'georgian' ? 'brick' : 'clap', c, w: 'arch', wc: '#fbf8ee', fl: 'u' }), [1, 1, 1], { rep: 0.3, top: A.white });
  b.box(tx - 0.06, 0.0, tz1, tx + 0.06, 0.2, tz1 + 0.012, A.white, '#3a2a1e', { rep: 0 });
  if (st === 'modern') { b.pyramid(tx, (tz0 + tz1) / 2, 0.1, 0.72, 1.2, 4, A.white, '#d6dadd', Math.PI / 4); }
  else { b.pyramid(tx, (tz0 + tz1) / 2, tw * 0.72, 0.72, 1.35, 8, A.roof({ m: stone ? 'slate' : 'shingle', c: stone ? '#4b5360' : '#e4e0d4' }), '#ffffff', Math.PI / 8); b.cyl(tx, (tz0 + tz1) / 2, 0.006, 1.35, 1.5, 4, A.white, '#d9b34a', {}); b.box(tx - 0.03, 1.42, (tz0 + tz1) / 2 - 0.004, tx + 0.03, 1.44, (tz0 + tz1) / 2 + 0.004, A.white, '#d9b34a', { rep: 0 }); }
  tree(b, 0.12, ld - 0.12, 0.4, 'round', '#4a8a3e', rng); tree(b, lw - 0.12, ld - 0.12, 0.4, 'round', '#4a8a3e', rng);
  return { floors: 1.5, h: 1.5 };
};
SPECIAL_GEN.monument = ({ b, rng, st }) => {
  const A = b.A;
  b.box(0.2, 0, 0.2, 0.8, 0.05, 0.8, A.white, '#bdb6a4', { rep: 0, top: A.white });
  b.box(0.3, 0.05, 0.3, 0.7, 0.14, 0.7, A.white, '#cfc8b4', { rep: 0, top: A.white });
  if (st === 'modern') { b.pyramid(0.5, 0.5, 0.1, 0.14, 1.1, 4, A.white, '#cfd5d9', Math.PI / 4); }
  else if (st === 'american' || st === 'georgian') { b.pyramid(0.5, 0.5, 0.09, 0.14, 1.0, 4, A.wall({ m: 'stone', c: '#e6e0cf', w: 'none' }), '#ffffff', Math.PI / 4); }
  else { b.cyl(0.5, 0.5, 0.06, 0.14, 0.52, 8, A.white, '#cfc8b4', { r1: 0.04, cap: false }); b.cyl(0.5, 0.5, 0.03, 0.52, 0.8, 6, A.white, '#7a8a84', { r1: 0.025 }); b.dome(0.5, 0.5, 0.04, 0.8, 0.05, 6, 2, A.white, '#7a8a84'); }
  for (const [x, z] of [[0.15, 0.15], [0.85, 0.15], [0.15, 0.85], [0.85, 0.85]]) bush(b, x, z, 0.06, '#3f7a3a');
  return { floors: 1, h: 1.1 };
};
SPECIAL_GEN.lighthouse = ({ b }) => {
  const A = b.A;
  const stripeA = A.decal('lhs', (ctx, S) => { ctx.fillStyle = '#f4f1e7'; ctx.fillRect(0, 0, S, S); ctx.fillStyle = '#c0392b'; ctx.fillRect(0, S * 0.25, S, S * 0.25); ctx.fillRect(0, S * 0.75, S, S * 0.25); });
  b.cyl(0.5, 0.5, 0.2, 0, 0.12, 12, A.white, '#9a948a', { cap: false });
  b.cyl(0.5, 0.5, 0.17, 0.12, 1.2, 14, stripeA, [1, 1, 1], { r1: 0.1, cap: false });
  b.cyl(0.5, 0.5, 0.14, 1.2, 1.25, 14, A.white, '#222', { cap: true });
  b.cyl(0.5, 0.5, 0.08, 1.25, 1.42, 10, A.decal('lamp', (c, S) => { c.fillStyle = '#ffe9a0'; c.fillRect(0, 0, S, S); }, (c, S) => { c.fillStyle = '#fff2b0'; c.fillRect(0, 0, S, S); }), [1, 1, 1], { cap: false });
  b.pyramid(0.5, 0.5, 0.1, 1.42, 1.58, 10, A.white, '#c0392b', 0, true);
  return { floors: 1, h: 1.6 };
};
SPECIAL_GEN.museum = ({ b, rng, lw, ld, st }) => {
  const A = b.A;
  const r = { x0: 0.1, x1: lw - 0.1, z0: 0.12, z1: ld - 0.3 };
  const s = shell(b, { rng, ...r, floors: 2, fh: 0.4, bayW: 0.36, m: st === 'modern' ? 'glass' : 'stone', c: st === 'modern' ? '#6aa0b8' : '#e5dfcf', trim: '#f4f1e7', upperWin: st === 'modern' ? 'curtain' : 'arch', groundWin: st === 'modern' ? 'curtain' : 'arch', door: { kind: 'door', color: '#2a3b55' }, roof: { type: 'flat', parapet: 0.06, m: 'slate', c: '#59616b' }, lit: 0.5 });
  if (st !== 'modern') { portico(b, { x0: r.x0 + 0.25, x1: r.x1 - 0.25, z: r.z1, depth: 0.22, h: 0.8, cols: 6, color: '#f4f1e7', r: 0.026 }); copperDome(b, lw / 2, (r.z0 + r.z1) / 2, s.yTop + 0.06, 0.28, 0.3); }
  else { b.box(0.4, s.yTop, r.z0 + 0.2, lw - 0.4, s.yTop + 0.3, r.z1 - 0.2, A.wall({ m: 'glass', c: '#6aa0b8', w: 'curtain', gl: 'teal', fl: 'u' }), '#fff', { rep: 0.3, top: A.white }); }
  for (const x of [0.25, lw - 0.25]) b.box(x - 0.06, 0, ld - 0.2, x + 0.06, 0.12, ld - 0.08, A.white, '#9a948a', { rep: 0, top: A.white });
  return { floors: 2, h: s.yTop + 0.45 };
};
SPECIAL_GEN.stadium = ({ b, rng, lw, ld }) => {
  const A = b.A;
  const cx = lw / 2, cz = ld / 2;
  // pitch
  b.flatQuad(cx - 1.0, cz - 0.55, cx + 1.0, cz + 0.55, 0.02, A.roof({ m: 'grass', c: '#4d9a3f' }), '#fff', 4, 2);
  const stand = A.wall({ m: 'conc', c: '#c4c2bb', w: 'ribbon', gl: 'dark', fl: 'u' });
  // four stands
  b.box(0.2, 0, 0.2, lw - 0.2, 0.62, 0.7, stand, '#fff', { rep: 0.3, top: A.white });
  b.box(0.2, 0, ld - 0.7, lw - 0.2, 0.62, ld - 0.2, stand, '#fff', { rep: 0.3, top: A.white });
  b.box(0.2, 0, 0.7, 0.7, 0.62, ld - 0.7, stand, '#fff', { rep: 0.3, top: A.white });
  b.box(lw - 0.7, 0, 0.7, lw - 0.2, 0.62, ld - 0.7, stand, '#fff', { rep: 0.3, top: A.white });
  // roof rim
  b.box(0.1, 0.6, 0.1, lw - 0.1, 0.66, 0.4, A.white, '#d8d8d4', { rep: 0, top: A.white }); b.box(0.1, 0.6, ld - 0.4, lw - 0.1, 0.66, ld - 0.1, A.white, '#d8d8d4', { rep: 0, top: A.white });
  for (const [x, z] of [[0.15, 0.15], [lw - 0.15, 0.15], [0.15, ld - 0.15], [lw - 0.15, ld - 0.15]]) { b.cyl(x, z, 0.02, 0, 1.1, 5, A.white, '#c9c9c9', {}); b.box(x - 0.08, 1.08, z - 0.05, x + 0.08, 1.14, z + 0.05, A.white, '#fff6c8', { rep: 0, top: A.white }); }
  return { floors: 2, h: 1.1 };
};
SPECIAL_GEN.capitol = ({ b, rng, lw, ld, st }) => {
  const A = b.A;
  const r = { x0: 0.12, x1: lw - 0.12, z0: 0.35, z1: ld - 0.6 };
  const s = shell(b, { rng, ...r, floors: 3, fh: 0.4, bayW: 0.36, m: 'stone', c: '#ece6d6', trim: '#fbf8ee', upperWin: 'arch', groundWin: 'arch', door: { kind: 'door', color: '#2a3b55' }, roof: { type: 'flat', parapet: 0.06, m: 'slate', c: '#59616b' }, lit: 0.5 });
  portico(b, { x0: r.x0 + 0.5, x1: r.x1 - 0.5, z: r.z1, depth: 0.3, h: 0.82, cols: 8, color: '#fbf8ee', r: 0.03 });
  const cx = lw / 2, cz = (r.z0 + r.z1) / 2;
  b.cyl(cx, cz, 0.42, s.yTop + 0.05, s.yTop + 0.45, 16, A.wall({ m: 'stone', c: '#ece6d6', w: 'arch', wc: '#fbf8ee', fl: 'u' }), [1, 1, 1], { uRep: 8, cap: false });
  b.dome(cx, cz, 0.46, s.yTop + 0.45, 0.5, 16, 5, A.wall({ m: 'plain', c: '#f4efe0', w: 'none' }), '#ffffff');
  b.cyl(cx, cz, 0.1, s.yTop + 0.95, s.yTop + 1.1, 8, A.white, '#f4efe0', { r1: 0.07 });
  b.pyramid(cx, cz, 0.07, s.yTop + 1.1, s.yTop + 1.35, 8, A.white, '#d9b34a', 0, true);
  for (const x of [r.x0 + 0.15, r.x1 - 0.15]) b.hipRoof(x - 0.15, r.z0 + 0.05, x + 0.15, r.z0 + 0.4, s.yTop, 0.14, A.roof({ m: 'slate', c: '#59616b' }), [1, 1, 1], 0.03);
  flagpole(b, 0.2, ld - 0.15, 0.9); flagpole(b, lw - 0.35, ld - 0.15, 0.9);
  return { floors: 3, h: s.yTop + 1.35 };
};

// ---- special industries
SPECIAL_GEN.farm = ({ b, rng, lw, ld, st }) => {
  const A = b.A;
  const P = CIV[st];
  const barnCol = st === 'modern' ? '#c9d3d9' : st === 'georgian' ? '#8a5a3a' : '#a8372c';
  // farmhouse (style-flavoured)
  const house = shell(b, { rng, x0: 0.15, x1: 0.95, z0: 0.15, z1: 0.75, floors: 2, fh: 0.27, bayW: 0.3, m: st === 'georgian' ? 'brick' : st === 'modern' ? 'conc' : 'clap', c: st === 'georgian' ? '#a4472f' : st === 'modern' ? '#efeee8' : pick(rng, ['#f4f1e8', '#efe2bd', '#d8dfe2']), trim: '#fbf8ee', shutter: P.shutter, upperWin: st === 'modern' ? 'casement' : 'sash', door: { kind: 'door', color: '#6a2a2a' }, roof: st === 'modern' ? { type: 'flat', parapet: 0.03, m: 'gravel', c: '#666' } : { type: 'gable', ridge: 'x', rise: 0.24, m: P.roofM === 'gravel' ? 'shingle' : P.roofM, c: P.roofC === '#5f5f5a' ? '#5a5048' : P.roofC }, lit: 0.5 });
  if (st === 'southern') porch(b, { x0: 0.13, x1: 0.97, z: 0.75, depth: 0.16, h: 0.52, round: true, rail: true, roofType: 'flat', color: '#fbf8ee', roofCell: A.roof({ m: 'metal', c: '#8a9099' }) });
  // barn
  const barn = shell(b, { rng, x0: 1.4, x1: 2.4, z0: 0.15, z1: 0.9, floors: 1, fh: 0.5, bayW: 0.5, m: st === 'modern' ? 'metal' : 'wood', c: barnCol, trim: '#f4f1e7', upperWin: 'plainw', groundWin: 'garage', groundExtra: { dc: '#f4f1e7' }, door: { kind: 'garage', color: '#f4f1e7' }, roof: { type: st === 'modern' ? 'gable' : 'gable', ridge: 'x', rise: 0.3, m: 'metal', c: '#6e757c' }, lit: 0 });
  // silos
  for (let i = 0; i < 2; i++) { b.cyl(2.7 + i * 0.3, 0.35, 0.13, 0, 0.8, 12, A.wall({ m: 'metal', c: '#c9cfd2', w: 'none' }), '#fff', { cap: false }); b.dome(2.7 + i * 0.3, 0.35, 0.13, 0.8, 0.1, 10, 3, A.white, '#aab0b4'); }
  // haystacks
  for (let i = 0; i < 3; i++) b.cyl(1.5 + i * 0.35, 1.3, 0.1, 0, 0.14, 8, A.roof({ m: 'thatch', c: '#d9b35a' }), '#fff', { r1: 0.06, cap: true });
  // wind pump / fence
  fence(b, 0.1, 1.0, 3.2, 1.0, 0.06, '#e8e3d3');
  tree(b, 1.2, 0.95, 0.45, 'round', '#4a8a3e', rng); tree(b, 0.1, 0.95, 0.4, 'round', '#5a9a46', rng);
  return { floors: 2, h: 0.9 };
};
SPECIAL_GEN.lumber = ({ b, rng, lw, ld }) => {
  const A = b.A;
  const s = shell(b, { rng, x0: 0.2, x1: 1.8, z0: 0.2, z1: 1.1, floors: 1, fh: 0.5, bayW: 0.5, m: 'wood', c: '#9a7a55', trim: '#d9cfae', upperWin: 'slit', groundWin: 'loading', groundExtra: { dc: '#6d4a2a' }, roof: { type: 'gable', ridge: 'x', rise: 0.2, m: 'metal', c: '#7a6a5a' }, lit: 0.2 });
  smokestack(b, 1.6, 0.35, 0, 0.9, 0.06, '#7a5a4a');
  // log piles
  for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) b.cyl(0.3 + i * 0.1, 1.9 + r * 0.0, 0.05, 0.03 + r * 0.07, 0.03 + r * 0.07 + 0.001, 6, A.white, '#7a5a3a', {});
  for (let i = 0; i < 6; i++) b.box(0.25 + i * 0.12, 0.0, 1.6, 0.34 + i * 0.12, 0.06, 2.5, A.white, '#7a5a3a', { rep: 0, top: A.white });
  b.box(2.1, 0, 0.5, 2.8, 0.2, 0.8, A.white, '#c9a15a', { rep: 0, top: A.white });
  b.box(2.0, 0.2, 0.6, 2.9, 0.26, 0.7, A.white, '#5a5d62', { rep: 0 });
  return { floors: 1, h: 0.9 };
};
SPECIAL_GEN.fishing = ({ b, rng, lw, ld }) => {
  const A = b.A;
  // building on land (front side is +z but water is anywhere around: pier extends toward front)
  shell(b, { rng, x0: 0.15, x1: 1.5, z0: 0.15, z1: 0.85, floors: 1, fh: 0.4, bayW: 0.4, m: 'clap', c: '#6d8aa6', trim: '#f4f1e7', upperWin: 'casement', groundWin: 'shop', groundExtra: { sg: '#2a3b55' }, door: { kind: 'door', color: '#2a3b55' }, roof: { type: 'gable', ridge: 'x', rise: 0.2, m: 'metal', c: '#7a8a96' }, lit: 0.4 });
  b.box(0.1, 0.0, 0.9, lw - 0.1, 0.07, 1.1, A.white, '#7a6a52', { rep: 0, top: A.white });
  for (let i = 0; i < 5; i++) b.cyl(0.2 + i * 0.5, 1.05, 0.02, -0.15, 0.07, 5, A.white, '#4a3a28', { cap: false });
  // boat
  b.box(1.9, 0.0, 1.35, 2.5, 0.07, 1.6, A.white, '#c0392b', { rep: 0, top: A.white });
  b.box(2.05, 0.07, 1.4, 2.25, 0.2, 1.55, A.white, '#f4f1e7', { rep: 0, top: A.white });
  b.cyl(2.2, 1.48, 0.008, 0.07, 0.4, 4, A.white, '#444', {});
  for (let i = 0; i < 3; i++) crate(b, 0.3 + i * 0.12, 0.07, 0.95, 0.1, '#e8d9a8');
  return { floors: 1, h: 0.4 };
};
SPECIAL_GEN.quarry = ({ b, rng, lw, ld }) => {
  const A = b.A;
  // stepped pit walls
  const rock = A.wall({ m: 'stone', c: '#8d8a82', w: 'none' });
  for (let i = 0; i < 3; i++) b.box(0.2 + i * 0.35, 0, 0.2 + i * 0.3, lw - 0.2 - i * 0.35, 0.0 + 0.12 * (3 - i), ld - 0.8 - i * 0.2, rock, '#fff', { rep: 0.3, top: A.roof({ m: 'gravel', c: '#9a968a' }), topRep: 0.4 });
  // crusher plant
  shell(b, { rng, x0: lw - 1.5, x1: lw - 0.3, z0: ld - 0.9, z1: ld - 0.2, floors: 1, fh: 0.5, bayW: 0.5, m: 'metal', c: '#c9a84a', trim: '#ddd', upperWin: 'slit', groundWin: 'slit', roof: { type: 'flat', parapet: 0.03, m: 'metal', c: '#7d848a' }, lit: 0.2 });
  b.box(lw - 2.3, 0.1, ld - 0.6, lw - 1.5, 0.25, ld - 0.5, A.white, '#4a4d52', { rep: 0 });
  b.pyramid(lw - 2.6, ld - 0.5, 0.35, 0, 0.3, 7, A.white, '#9a968a', 0.3, true);
  b.pyramid(0.7, ld - 0.5, 0.3, 0, 0.25, 7, A.white, '#7f7c74', 0.1, true);
  for (let i = 0; i < 2; i++) { b.box(0.3 + i * 0.3, 0.0, ld - 0.4, 0.55 + i * 0.3, 0.14, ld - 0.2, A.white, '#e0a82a', { rep: 0, top: A.white }); }
  return { floors: 1, h: 0.6, smoke: [] };
};
SPECIAL_GEN.port = ({ b, rng, lw, ld }) => {
  const A = b.A;
  b.box(0.05, 0.0, 0.05, lw - 0.05, 0.1, ld - 0.05, A.white, '#8d8c86', { rep: 0, top: A.white });
  // containers
  const cols = ['#c0392b', '#2a6fb5', '#2d9a4a', '#d9a62b', '#8a5a9f', '#e8e4d8', '#e67e22'];
  const box = A.wall({ m: 'metal', c: '#ffffff', w: 'none' });
  for (let r = 0; r < 3; r++) for (let i = 0; i < 10; i++) {
    const h = 1 + ((rng() * 3) | 0);
    for (let k = 0; k < h; k++) b.box(0.3 + i * 0.28, 0.1 + k * 0.1, 0.35 + r * 0.22, 0.3 + i * 0.28 + 0.26, 0.2 + k * 0.1, 0.35 + r * 0.22 + 0.19, box, cols[(rng() * cols.length) | 0], { rep: 0.1, top: box });
  }
  // gantry cranes at the front (water side is +z)
  for (let i = 0; i < 2; i++) {
    const x = 1.0 + i * 1.8;
    for (const dx of [0, 0.5]) for (const dz of [0, 0.3]) b.box(x + dx - 0.015, 0.1, ld - 0.8 + dz - 0.015, x + dx + 0.015, 0.75, ld - 0.8 + dz + 0.015, A.white, '#e07a1f', { rep: 0 });
    b.box(x - 0.05, 0.75, ld - 0.85, x + 0.55, 0.8, ld - 0.45, A.white, '#e07a1f', { rep: 0, top: A.white });
    b.box(x + 0.2, 0.78, ld - 0.5, x + 0.3, 0.84, ld + 0.35, A.white, '#d96a14', { rep: 0, top: A.white });
  }
  shell(b, { rng, x0: lw - 1.1, x1: lw - 0.2, z0: 0.2, z1: 0.85, floors: 1, fh: 0.5, bayW: 0.5, m: 'metal', c: '#c8ccce', trim: '#2a6fb5', upperWin: 'slit', groundWin: 'loading', roof: { type: 'flat', parapet: 0.03, m: 'metal', c: '#8a9096' }, lit: 0.2 });
  return { floors: 1, h: 0.9 };
};
SPECIAL_GEN.distillery = ({ b, rng, lw, ld, st }) => {
  const A = b.A;
  const P = CIV[st === 'modern' ? 'american' : st];
  const s = shell(b, { rng, x0: 0.15, x1: lw - 0.15, z0: 0.15, z1: ld - 0.55, floors: 2, fh: 0.32, bayW: 0.34, m: 'brick', c: '#8e4733', trim: '#efe9d8', upperWin: P.win === 'ribbon' ? 'sash' : P.win, groundWin: 'arch', door: { kind: 'garage', color: '#4a3a22', bay: 'right' }, roof: { type: 'gable', ridge: 'x', rise: 0.22, m: 'metal', c: '#7d4a3a' }, lit: 0.4 });
  // copper stills
  for (let i = 0; i < 2; i++) { b.cyl(0.5 + i * 0.5, ld - 0.3, 0.1, 0, 0.28, 10, A.roof({ m: 'copper', c: '#b86f3a' }), '#fff', { r1: 0.1, cap: false }); b.dome(0.5 + i * 0.5, ld - 0.3, 0.1, 0.28, 0.12, 10, 3, A.roof({ m: 'copper', c: '#b86f3a' }), '#fff'); b.cyl(0.5 + i * 0.5, ld - 0.3, 0.02, 0.4, 0.6, 5, A.white, '#b86f3a', {}); }
  for (let i = 0; i < 6; i++) b.cyl(lw - 0.7 + (i % 3) * 0.2, ld - 0.4 + Math.floor(i / 3) * 0.2, 0.07, 0, 0.12, 8, A.white, '#7a5a3a', {});
  smokestack(b, lw - 0.3, 0.3, 0, s.yRoof + 0.3, 0.05, '#8e4733');
  return { floors: 2, h: s.yRoof + 0.3 };
};
SPECIAL_GEN.textile = ({ b, rng, lw, ld, st }) => {
  const A = b.A;
  const brick = st === 'georgian' ? '#a4472f' : '#8e4733';
  const r = { x0: 0.12, x1: lw - 0.12, z0: 0.12, z1: ld - 0.4 };
  const s = shell(b, { rng, ...r, floors: 3, fh: 0.3, bayW: 0.28, m: 'brick', c: brick, trim: '#efe9d8', upperWin: 'arch', groundWin: 'arch', door: { kind: 'garage', color: '#4a3a22', bay: 'right' }, roof: { type: 'gable', ridge: 'x', rise: 0.22, m: 'slate', c: '#4b5360' }, lit: 0.45 });
  b.box(lw / 2 - 0.14, 0, r.z1, lw / 2 + 0.14, s.yTop + 0.15, r.z1 + 0.1, A.wall({ m: 'brick', c: brick, w: 'arch', wc: '#efe9d8', fl: 'u' }), [1, 1, 1], { rep: 0.26, top: A.white });
  b.hipRoof(lw / 2 - 0.14, r.z1, lw / 2 + 0.14, r.z1 + 0.1, s.yTop + 0.15, 0.1, A.roof({ m: 'slate', c: '#4b5360' }), [1, 1, 1], 0.03, 0);
  smokestack(b, lw - 0.3, 0.3, 0, s.yRoof + 0.55, 0.07, brick);
  for (let i = 0; i < 4; i++) b.box(0.2 + i * 0.2, 0.0, ld - 0.3, 0.35 + i * 0.2, 0.1, ld - 0.15, A.white, i % 2 ? '#f4f1e7' : '#b5483b', { rep: 0, top: A.white });
  return { floors: 3, h: s.yRoof + 0.55 };
};
SPECIAL_GEN.refinery = ({ b, rng, lw, ld }) => {
  const A = b.A;
  // tank farm
  for (let i = 0; i < 6; i++) { const x = 0.5 + (i % 3) * 0.7, z = 2.9 + Math.floor(i / 3) * 0.55; b.cyl(x, z, 0.26, 0, 0.3, 14, A.wall({ m: 'metal', c: '#dcdfe0', w: 'none' }), '#fff', { cap: true, capCell: A.white, capTint: '#cfd3d4' }); }
  // distillation columns
  for (let i = 0; i < 4; i++) { b.cyl(2.7 + i * 0.28, 0.6, 0.075, 0, 1.0 + (i % 2) * 0.3, 10, A.wall({ m: 'metal', c: '#aeb4b8', w: 'none' }), '#fff', { cap: true }); }
  b.box(2.5, 0.35, 0.95, 3.8, 0.4, 1.0, A.white, '#7d848a', { rep: 0 });
  // flare stack
  b.cyl(0.3, 0.4, 0.015, 0, 1.6, 5, A.white, '#8a8f93', { r1: 0.01, cap: false });
  shell(b, { rng, x0: 0.3, x1: 1.8, z0: 1.0, z1: 2.0, floors: 1, fh: 0.45, bayW: 0.5, m: 'metal', c: '#9aa6ae', trim: '#ddd', upperWin: 'slit', roof: { type: 'flat', parapet: 0.03, m: 'metal', c: '#7d848a' }, lit: 0.2 });
  b.box(1.9, 0.1, 1.2, 3.8, 0.15, 1.28, A.white, '#c0392b', { rep: 0 });
  return { floors: 1, h: 1.6, smoke: [[0.3, 1.65, 0.4], [2.7, 1.45, 0.6], [3.26, 1.2, 0.6]], flare: [0.3, 1.62, 0.4] };
};
SPECIAL_GEN.tech = ({ b, rng, lw, ld }) => {
  const A = b.A;
  const glass = A.wall({ m: 'glass', c: '#5aa4ba', w: 'curtain', gl: 'teal', fl: 'u' });
  // main curved atrium building made from a polygon tower + wings
  const mk = (x0, x1, z0, z1, f) => shell(b, { rng, x0, x1, z0, z1, floors: f, fh: 0.28, bayW: 0.32, m: 'glass', c: '#5aa4ba', gl: 'teal', upperWin: 'curtain', groundWin: 'curtain', door: { kind: 'door', color: '#3c4146' }, roof: { type: 'flat', parapet: 0.025, m: 'solar', c: '#16233a' }, lit: 0.6, plinthTint: '#6a6a66' });
  mk(0.3, 1.9, 0.25, 1.0, 4); mk(2.1, 3.7, 0.25, 1.0, 3); mk(0.3, 1.0, 1.2, 2.4, 3);
  const cyc = polyTower(b, 2.9, 2.0, 0.55, 14, 0, 4, 0.28, (f, i, nb, nf) => ({ cell: A.wall({ m: 'glass', c: '#5aa4ba', w: 'curtain', gl: 'teal', fl: 'u' }), tint: [1, 1, 1], lit: rng() < 0.6 }));
  b.dome(2.9, 2.0, 0.5, cyc, 0.25, 14, 3, A.wall({ m: 'glass', c: '#7ab8cc', w: 'curtain', gl: 'blue' }), '#fff');
  b.flatQuad(1.2, 1.3, 2.2, 2.4, 0.012, A.roof({ m: 'grass', c: '#5a9a46' }), '#fff', 3, 3);
  for (let i = 0; i < 5; i++) tree(b, 1.3 + (i % 3) * 0.4, 1.5 + Math.floor(i / 3) * 0.6, 0.3, 'round', '#5a9a46', rng);
  b.cyl(1.0, 0.2, 0.006, 0.95, 1.4, 4, A.white, '#c9c9c9', {});
  return { floors: 4, h: 1.4 };
};
SPECIAL_GEN.resort = ({ b, rng, lw, ld, st }) => {
  const A = b.A;
  const s = shell(b, { rng, x0: 0.12, x1: lw - 0.12, z0: 0.12, z1: 1.0, floors: 4, fh: 0.28, bayW: 0.3, m: 'stucco', c: pick(rng, ['#f4d7c9', '#f7e9c8', '#d9eef2']), trim: '#ffffff', upperWin: 'tall', groundWin: 'arch', door: { kind: 'door', color: '#2a6fb5' }, roof: { type: 'flat', parapet: 0.05, m: 'tile', c: '#c0603f' }, lit: 0.55 });
  for (let f = 1; f < 4; f++) balcony(b, 0.2, lw - 0.2, 1.0, f * 0.28, 0.12, { color: '#ffffff', slab: '#f1ece0' });
  // pool and palms
  b.flatQuad(0.3, 1.45, lw - 0.6, ld - 0.35, 0.014, A.roof({ m: 'water', c: '#3fb0d0' }), '#fff');
  b.box(0.25, 0.0, 1.4, lw - 0.55, 0.01, ld - 0.3, A.white, '#efe6cf', { rep: 0, top: A.white });
  for (const [x, z] of [[0.2, 1.3], [lw - 0.3, 1.5], [0.25, ld - 0.2], [lw - 0.35, ld - 0.25]]) { b.cyl(x, z, 0.018, 0, 0.4, 5, A.white, '#7a5a3a', { r1: 0.012, cap: false }); b.dome(x, z, 0.14, 0.38, 0.1, 7, 2, A.white, '#3f9a4a'); }
  for (let i = 0; i < 5; i++) { b.box(0.45 + i * 0.28, 0.0, 1.32, 0.6 + i * 0.28, 0.06, 1.4, A.white, i % 2 ? '#f08a5d' : '#ffffff', { rep: 0, top: A.white }); }
  return { floors: 4, h: s.yTop + 0.1 };
};
SPECIAL_GEN.casino = ({ b, rng, lw, ld }) => {
  const A = b.A;
  const neonDraw = (ctx, S, em) => {
    ctx.fillStyle = em ? '#000' : '#1a1030'; ctx.fillRect(0, 0, S, S);
    const cols = ['#ff2d95', '#00e5ff', '#ffe600', '#7cff00'];
    for (let i = 0; i < 6; i++) { ctx.fillStyle = cols[i % 4]; ctx.fillRect(4, 6 + i * 10, S - 8, em ? 5 : 4); }
    if (!em) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; for (let i = 0; i < 6; i++) ctx.fillRect(4, 6 + i * 10, S - 8, 1); }
  };
  const neon = A.decal('neon', (c, S) => neonDraw(c, S, false), (c, S) => neonDraw(c, S, true));
  const base = shell(b, { rng, x0: 0.1, x1: lw - 0.1, z0: 0.3, z1: ld - 0.5, floors: 2, fh: 0.34, bayW: 0.4, m: 'glass', c: '#8a6ab0', gl: 'dark', upperWin: 'ribbon', groundWin: 'curtain', door: { kind: 'door', color: '#ffd23a' }, roof: { type: 'flat', parapet: 0.04, m: 'gravel', c: '#555' }, lit: 0.9 });
  const tw = shell(b, { rng, x0: 0.5, x1: lw - 0.5, z0: 0.5, z1: ld - 0.9, y0: base.yTop, floors: 8, fh: 0.28, bayW: 0.34, m: 'glass', c: '#6a8ab0', gl: 'blue', upperWin: 'curtain', plinth: false, roof: { type: 'flat', parapet: 0.03, m: 'gravel', c: '#555' }, lit: 0.8 });
  b.box(0.2, 0.28, ld - 0.5, lw - 0.2, 0.58, ld - 0.46, neon, '#fff', { rep: 0, top: A.white });
  b.cyl(lw / 2, 1.0, 0.012, tw.yTop, tw.yTop + 0.4, 4, A.white, '#c9c9c9', {});
  b.flatQuad(0.05, ld - 0.45, lw - 0.05, ld - 0.02, 0.01, A.white, '#7d7d86');
  return { floors: 10, h: tw.yTop + 0.4 };
};
