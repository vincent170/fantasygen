// Models for the newer service, park and landmark buildings.
import { pick } from './util.js';
import { shell, cornice, quoins, chimney, porch, portico, awning, balcony, fence, bush, tree, path, hvac, smokestack } from './build_common.js';
import { SPECIAL_GEN, CIV, civic, signBoard, signCell, flagpole, bench } from './build_special.js';
import { car, CAR_COLS, lampPost, flowerBed, hedge, pool } from './build_props.js';

const W = (b) => b.A.white;
const glassCell = (A, c = '#8fc3d6', gl = 'teal') => A.wall({ m: 'glass', c, w: 'curtain', gl, fl: 'u' });
const lampDecal = (A) => A.decal('lamp', (c, S) => { c.fillStyle = '#ffe9a0'; c.fillRect(0, 0, S, S); }, (c, S) => { c.fillStyle = '#fff2b0'; c.fillRect(0, 0, S, S); });

// ---------------------------------------------------------------- deathcare
SPECIAL_GEN.cemetery = ({ b, rng, lw, ld, st }) => {
  const A = b.A, w = W(b);
  b.flatQuad(0.06, 0.06, lw - 0.06, ld - 0.06, 0.006, A.roof({ m: 'grass', c: '#5a8a46' }), '#ffffff', 3, 3);
  // cross paths
  b.flatQuad(lw / 2 - 0.05, 0.06, lw / 2 + 0.05, ld - 0.06, 0.01, w, '#b9b2a2'); b.flatQuad(0.06, ld / 2 - 0.05, lw - 0.06, ld / 2 + 0.05, 0.01, w, '#b9b2a2');
  // rows of headstones
  for (let qx = 0; qx < 2; qx++) for (let qz = 0; qz < 2; qz++) {
    const x0 = qx ? lw / 2 + 0.1 : 0.15, x1 = qx ? lw - 0.15 : lw / 2 - 0.1, z0 = qz ? ld / 2 + 0.1 : 0.15, z1 = qz ? ld - 0.15 : ld / 2 - 0.1;
    for (let z = z0; z < z1; z += 0.11) for (let x = x0; x < x1; x += 0.08) {
      const r = rng();
      if (r < 0.12) continue;
      if (r < 0.2) { b.box(x - 0.006, 0, z - 0.006, x + 0.006, 0.06, z + 0.006, w, '#d9d6cc', { rep: 0 }); b.box(x - 0.02, 0.035, z - 0.006, x + 0.02, 0.047, z + 0.006, w, '#d9d6cc', { rep: 0 }); }
      else b.box(x - 0.018, 0, z - 0.006, x + 0.018, 0.035 + rng() * 0.02, z + 0.006, w, pick(rng, ['#a9a7a0', '#8f8d86', '#c4c1b8', '#6f6d68']), { rep: 0, top: w });
    }
  }
  // chapel
  const cx = lw / 2, cz = ld / 2;
  const P = CIV[st] || CIV.georgian;
  shell(b, { rng, x0: cx - 0.16, x1: cx + 0.16, z0: cz - 0.2, z1: cz + 0.2, floors: 1, fh: 0.3, bayW: 0.15, m: 'stone', c: '#d8d2c2', trim: '#f4f1e7', upperWin: 'arch', door: { kind: 'door', color: '#3a2a1e' }, roof: { type: 'gable', ridge: 'z', rise: 0.2, m: 'slate', c: '#4b5360' }, lit: 0.3 });
  b.box(cx - 0.004, 0.5, cz + 0.17, cx + 0.004, 0.62, cz + 0.178, w, '#d9d6cc', { rep: 0 }); b.box(cx - 0.035, 0.57, cz + 0.17, cx + 0.035, 0.585, cz + 0.178, w, '#d9d6cc', { rep: 0 });
  for (const [x, z] of [[0.12, 0.12], [lw - 0.12, 0.12], [0.12, ld - 0.12], [lw - 0.12, ld - 0.12], [lw / 2 - 0.3, ld / 2 + 0.3]]) tree(b, x, z, 0.42, rng() < 0.6 ? 'pine' : 'round', '#2f5f30', rng);
  fence(b, 0.03, 0.03, lw - 0.03, 0.03, 0.06, '#26272a'); fence(b, 0.03, ld - 0.03, lw / 2 - 0.08, ld - 0.03, 0.06, '#26272a'); fence(b, lw / 2 + 0.08, ld - 0.03, lw - 0.03, ld - 0.03, 0.06, '#26272a');
  fence(b, 0.03, 0.03, 0.03, ld - 0.03, 0.06, '#26272a'); fence(b, lw - 0.03, 0.03, lw - 0.03, ld - 0.03, 0.06, '#26272a');
  return { floors: 1, h: 0.62 };
};
SPECIAL_GEN.crematorium = ({ b, rng, lw, ld, st }) => {
  const A = b.A;
  const r = { x0: 0.12, x1: lw - 0.12, z0: 0.12, z1: ld - 0.4 };
  const s = shell(b, { rng, ...r, floors: 1, fh: 0.36, bayW: 0.3, m: st === 'modern' ? 'conc' : 'stone', c: '#cfc9bb', trim: '#efe9da', upperWin: 'tall', door: { kind: 'door', color: '#3a2a1e' }, roof: { type: 'flat', parapet: 0.04, m: 'slate', c: '#59616b' }, lit: 0.3 });
  smokestack(b, r.x1 - 0.15, r.z0 + 0.15, 0, s.yTop + 0.35, 0.05, '#9a948a');
  portico(b, { x0: (r.x0 + r.x1) / 2 - 0.25, x1: (r.x0 + r.x1) / 2 + 0.25, z: r.z1, depth: 0.12, h: 0.36, cols: 4, color: '#efe9da' });
  flowerBed(b, rng, 0.15, ld - 0.18, lw / 2 - 0.12, ld - 0.08); flowerBed(b, rng, lw / 2 + 0.12, ld - 0.18, lw - 0.15, ld - 0.08);
  tree(b, 0.12, ld - 0.1, 0.36, 'pine', '#2f5f30', rng); tree(b, lw - 0.12, ld - 0.1, 0.36, 'pine', '#2f5f30', rng);
  return { floors: 1, h: s.yTop + 0.35 };
};

// ---------------------------------------------------------------- communications
SPECIAL_GEN.post_office = ({ b, rng, lw, ld, st }) => {
  const { s, r } = civic(b, rng, st, lw, ld, { floors: 2, sign: 'POST OFFICE', signBg: '#b8322a', noPortico: st !== 'georgian' && st !== 'southern' });
  const A = b.A;
  b.box(r.x1 - 0.12, 0, ld - 0.1, r.x1 - 0.06, 0.08, ld - 0.06, A.white, '#b8322a', { rep: 0, top: A.white });
  b.box(0.15, 0.0, ld - 0.14, 0.33, 0.08, ld - 0.05, A.white, '#d9a62b', { rep: 0, top: A.white });
  flagpole(b, r.x0 + 0.05, ld - 0.06, 0.5);
  return { floors: 2, h: s.yRoof };
};
SPECIAL_GEN.post_sort = ({ b, rng, lw, ld }) => {
  const A = b.A;
  const r = { x0: 0.12, x1: lw - 0.12, z0: 0.12, z1: ld - 0.75 };
  const s = shell(b, { rng, ...r, floors: 1, fh: 0.42, bayW: 0.42, m: 'metal', c: '#d6d8da', trim: '#b8322a', upperWin: 'slit', groundWin: 'loading', groundExtra: { dc: '#b8322a' }, door: { kind: 'door', color: '#b8322a' }, roof: { type: 'flat', parapet: 0.03, m: 'metal', c: '#9aa0a6' }, lit: 0.4 });
  b.box(r.x0 - 0.005, s.yTop - 0.08, r.z1, r.x1 + 0.005, s.yTop - 0.04, r.z1 + 0.008, A.white, '#d9a62b', { rep: 0 });
  signBoard(b, 'MAIL HUB', '#b8322a', (r.x0 + r.x1) / 2, r.z1, s.yTop - 0.03, 0.6, 0.1);
  b.flatQuad(0.06, r.z1, lw - 0.06, ld - 0.04, 0.009, A.white, '#5f6061');
  for (let k = 0; k < 4; k++) { const x = 0.3 + k * 0.6; b.box(x, 0, r.z1 + 0.1, x + 0.12, 0.1, r.z1 + 0.42, A.white, k % 2 ? '#f2f2ee' : '#b8322a', { rep: 0, top: A.white }); }
  for (let k = 0; k < 4; k++) hvac(b, r.x0 + 0.2 + k * 0.5, r.z0 + 0.2, s.yRoof, 0.1);
  return { floors: 1, h: s.yRoof };
};
function lattice(b, x, z, h, base, top, col = '#9aa0a6') {
  const w = W(b);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const ax = x + sx * base, az = z + sz * base, tx = x + sx * top, tz = z + sz * top;
    b.grid([ax - 0.004, 0, az], [ax + 0.004, 0, az], [tx + 0.004, h, tz], [tx - 0.004, h, tz], 1, 1, w, col, [sz, 0, 0]);
    b.grid([ax + 0.004, 0, az], [ax - 0.004, 0, az], [tx - 0.004, h, tz], [tx + 0.004, h, tz], 1, 1, w, col, [-sz, 0, 0]);
  }
  for (let y = 0.1; y < h; y += 0.12) { const r = base + (top - base) * (y / h); b.box(x - r, y, z - r, x + r, y + 0.006, z + r, w, col, { rep: 0, noTop: false }); }
}
SPECIAL_GEN.cell_tower = ({ b }) => {
  const A = b.A, w = W(b);
  b.box(0.08, 0, 0.08, 0.92, 0.012, 0.92, w, '#9a948a', { rep: 0, top: w });
  lattice(b, 0.5, 0.5, 1.15, 0.12, 0.03);
  for (let k = 0; k < 3; k++) { const a = k * 2.09; b.box(0.5 + Math.cos(a) * 0.05 - 0.015, 0.95, 0.5 + Math.sin(a) * 0.05 - 0.015, 0.5 + Math.cos(a) * 0.05 + 0.015, 1.08, 0.5 + Math.sin(a) * 0.05 + 0.015, w, '#e8e8e8', { rep: 0, top: w }); }
  b.box(0.495, 1.15, 0.495, 0.505, 1.3, 0.505, w, '#c0392b', { rep: 0 });
  b.box(0.12, 0, 0.6, 0.35, 0.12, 0.85, w, '#c9ccd0', { rep: 0, top: w });
  return { floors: 1, h: 1.3 };
};
SPECIAL_GEN.telecom = ({ b, rng, lw, ld }) => {
  const A = b.A, w = W(b);
  const r = { x0: 0.12, x1: lw - 0.12, z0: 0.12, z1: ld - 0.3 };
  const s = shell(b, { rng, ...r, floors: 3, fh: 0.28, bayW: 0.3, m: 'glass', c: '#5a86a8', trim: '#d5d3cc', gl: 'blue', upperWin: 'curtain', groundWin: 'curtain', door: { kind: 'door', color: '#3c4146' }, roof: { type: 'flat', parapet: 0.03, m: 'gravel', c: '#6e6e6a' }, lit: 0.6 });
  for (const [x, z] of [[r.x0 + 0.2, r.z0 + 0.25], [r.x1 - 0.25, r.z0 + 0.3]]) { b.box(x - 0.005, s.yTop, z - 0.005, x + 0.005, s.yTop + 0.08, z + 0.005, w, '#888', { rep: 0 }); b.dome(x, z, 0.1, s.yTop + 0.06, 0.04, 10, 2, w, '#eeeeee'); }
  lattice(b, r.x1 - 0.2, r.z1 - 0.2, 0.9, 0.06, 0.02, '#c9ccd0');
  b.box(r.x1 - 0.205, 0.9, r.z1 - 0.205, r.x1 - 0.195, 1.05, r.z1 - 0.195, w, '#c0392b', { rep: 0 });
  signBoard(b, 'TELECOM', '#2a6fb5', lw / 2, r.z1, 0.62, 0.5, 0.08);
  return { floors: 3, h: s.yTop + 0.25 };
};

// ---------------------------------------------------------------- disaster response
SPECIAL_GEN.shelter = ({ b, rng, lw, ld }) => {
  const A = b.A, w = W(b);
  // earth-sheltered bunker with a grass roof
  b.box(0.15, 0, 0.15, lw - 0.15, 0.2, ld - 0.4, A.wall({ m: 'conc', c: '#a9a8a2', w: 'none' }), '#ffffff', { rep: 0.3, top: A.roof({ m: 'grass', c: '#5a8a46' }), topRep: 0.3 });
  b.grid([0.15, 0.2, ld - 0.4], [lw - 0.15, 0.2, ld - 0.4], [lw - 0.1, 0.0, ld - 0.25], [0.1, 0.0, ld - 0.25], 2, 1, A.roof({ m: 'grass', c: '#5a8a46' }), '#ffffff', [0, 1, 1]);
  b.box(lw / 2 - 0.15, 0, ld - 0.42, lw / 2 + 0.15, 0.16, ld - 0.2, A.wall({ m: 'conc', c: '#bdbbb4', w: 'loading', dc: '#e0a020', fl: 'g' }), '#ffffff', { rep: 0, top: A.white });
  signBoard(b, 'SHELTER', '#e0a020', lw / 2, ld - 0.2, 0.17, 0.32, 0.06, '#1e1e1e');
  for (const x of [0.4, lw - 0.4]) { b.cyl(x, 0.5, 0.03, 0.2, 0.32, 8, w, '#9a948a', {}); }
  b.cyl(lw - 0.2, ld - 0.15, 0.008, 0, 0.5, 5, w, '#888', {}); b.box(lw - 0.24, 0.45, ld - 0.19, lw - 0.16, 0.52, ld - 0.11, w, '#e0a020', { rep: 0, top: w });
  return { floors: 1, h: 0.4 };
};
SPECIAL_GEN.dru = ({ b, rng, lw, ld }) => {
  const A = b.A, w = W(b);
  const s = shell(b, { rng, x0: 0.1, x1: lw * 0.55, z0: 0.1, z1: ld - 0.25, floors: 1, fh: 0.42, bayW: 0.35, m: 'metal', c: '#d9a62b', trim: '#3c4146', upperWin: 'slit', groundWin: 'garage', groundExtra: { dc: '#3c4146' }, roof: { type: 'gable', ridge: 'x', rise: 0.12, m: 'metal', c: '#5a5f66' }, lit: 0.4 });
  signBoard(b, 'RESCUE', '#c0392b', lw * 0.33, ld - 0.25, 0.3, 0.4, 0.08);
  const hx = lw * 0.78, hz = ld * 0.45;
  b.box(hx - 0.35, 0.0, hz - 0.35, hx + 0.35, 0.03, hz + 0.35, A.helipad(), '#ffffff', { rep: 0, top: A.helipad() });
  // helicopter
  b.box(hx - 0.05, 0.03, hz - 0.12, hx + 0.05, 0.11, hz + 0.08, w, '#c0392b', { rep: 0, top: w });
  b.box(hx - 0.012, 0.07, hz + 0.08, hx + 0.012, 0.09, hz + 0.25, w, '#c0392b', { rep: 0, top: w });
  b.box(hx - 0.2, 0.125, hz - 0.01, hx + 0.2, 0.13, hz + 0.01, w, '#333', { rep: 0 }); b.box(hx - 0.01, 0.125, hz - 0.22, hx + 0.01, 0.13, hz + 0.18, w, '#333', { rep: 0 });
  b.box(hx - 0.004, 0.11, hz - 0.004, hx + 0.004, 0.125, hz + 0.004, w, '#333', { rep: 0 });
  for (let k = 0; k < 2; k++) b.box(0.2 + k * 0.4, 0, ld - 0.2, 0.5 + k * 0.4, 0.1, ld - 0.08, w, '#d9a62b', { rep: 0, top: w });
  return { floors: 1, h: s.yRoof };
};

// ---------------------------------------------------------------- transit
SPECIAL_GEN.metro = ({ b }) => {
  const A = b.A, w = W(b);
  b.box(0.1, 0, 0.1, 0.9, 0.012, 0.9, w, '#c9c1af', { rep: 0, top: w });
  // stairs going down + glass canopy
  b.box(0.3, -0.002, 0.25, 0.7, 0.014, 0.75, w, '#3a3d42', { rep: 0, top: w });
  for (let k = 0; k < 5; k++) b.box(0.33, 0.004, 0.3 + k * 0.08, 0.67, 0.016, 0.34 + k * 0.08, w, '#8a8478', { rep: 0, top: w });
  const g = glassCell(A, '#a8d0e0');
  b.box(0.28, 0.0, 0.22, 0.3, 0.2, 0.78, g, '#ffffff', { rep: 0, top: w }); b.box(0.7, 0.0, 0.22, 0.72, 0.2, 0.78, g, '#ffffff', { rep: 0, top: w });
  b.grid([0.26, 0.22, 0.8], [0.74, 0.22, 0.8], [0.74, 0.26, 0.2], [0.26, 0.26, 0.2], 2, 2, g, '#ffffff', [0, 1, 0.2]);
  const msign = A.decal('metroM', (c, S) => { c.fillStyle = '#c0392b'; c.beginPath(); c.arc(S / 2, S / 2, S * 0.45, 0, 7); c.fill(); c.fillStyle = '#fff'; c.font = `bold ${S * 0.6}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('M', S / 2, S / 2 + 2); }, (c, S) => { c.fillStyle = '#ff5a40'; c.beginPath(); c.arc(S / 2, S / 2, S * 0.45, 0, 7); c.fill(); c.fillStyle = '#fff'; c.font = `bold ${S * 0.6}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('M', S / 2, S / 2 + 2); });
  b.cyl(0.85, 0.85, 0.008, 0, 0.32, 5, w, '#3a3d42', {});
  b.box(0.79, 0.3, 0.845, 0.91, 0.42, 0.855, msign, '#ffffff', { rep: 0, top: w });
  return { floors: 1, h: 0.42 };
};
SPECIAL_GEN.cargo_rail = ({ b, rng, lw, ld }) => {
  const A = b.A, w = W(b);
  const s = shell(b, { rng, x0: 0.15, x1: lw * 0.45, z0: ld - 0.9, z1: ld - 0.2, floors: 1, fh: 0.38, bayW: 0.4, m: 'metal', c: '#9aa6ae', trim: '#2a6fb5', upperWin: 'slit', groundWin: 'loading', door: { kind: 'door', color: '#2a6fb5' }, roof: { type: 'gable', ridge: 'x', rise: 0.1, m: 'metal', c: '#6d747a' }, lit: 0.3 });
  b.flatQuad(lw * 0.47, 0.1, lw - 0.08, ld - 0.1, 0.009, w, '#6f7073');
  const cols = ['#c0392b', '#2a6fb5', '#2d9a4a', '#d9a62b', '#e8e4d8', '#7a4a8a'];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { if (rng() < 0.2) continue; const x = lw * 0.5 + c * 0.42, z = 0.25 + r * 0.42, h = 0.09 * (1 + ((rng() * 2) | 0)); b.box(x, 0, z, x + 0.36, h, z + 0.14, w, pick(rng, cols), { rep: 0, top: w }); }
  // gantry crane
  const gx0 = lw * 0.48, gx1 = lw - 0.06;
  for (const z of [0.12, ld - 0.4]) { b.box(gx0, 0, z, gx0 + 0.04, 0.55, z + 0.04, w, '#e0a020', { rep: 0 }); b.box(gx1 - 0.04, 0, z, gx1, 0.55, z + 0.04, w, '#e0a020', { rep: 0 }); }
  b.box(gx0, 0.55, 0.12, gx1, 0.6, 0.16, w, '#e0a020', { rep: 0, top: w }); b.box(gx0, 0.55, ld - 0.4, gx1, 0.6, ld - 0.36, w, '#e0a020', { rep: 0, top: w });
  return { floors: 1, h: 0.6 };
};
SPECIAL_GEN.airport = ({ b, rng, lw, ld }) => {
  const A = b.A, w = W(b);
  // runway along x at the back, apron & terminal at the front
  const runway = A.decal('runway', (c, S) => { c.fillStyle = '#3a3c40'; c.fillRect(0, 0, S, S); c.fillStyle = '#e8e8e2'; c.fillRect(S * 0.1, S / 2 - 2, S * 0.35, 4); c.fillRect(S * 0.6, S / 2 - 2, S * 0.3, 4); c.fillRect(0, 3, S, 2); c.fillRect(0, S - 5, S, 2); });
  b.flatQuad(0.1, 0.25, lw - 0.1, 1.15, 0.012, runway, '#ffffff', Math.round(lw * 2), 1);
  b.flatQuad(0.1, 1.15, lw - 0.1, 1.3, 0.011, w, '#4a4c50');
  b.flatQuad(0.6, 1.3, lw - 0.6, ld - 1.3, 0.011, w, '#55575b');
  for (let k = 0; k < 10; k++) { const x = 0.3 + k * (lw - 0.6) / 9; b.box(x - 0.012, 0.012, 0.2, x + 0.012, 0.02, 0.23, lampDecal(A), '#ffffff', { rep: 0, top: lampDecal(A) }); b.box(x - 0.012, 0.012, 1.17, x + 0.012, 0.02, 1.2, lampDecal(A), '#ffffff', { rep: 0, top: lampDecal(A) }); }
  // terminal
  const tz0 = ld - 1.25, tz1 = ld - 0.45;
  const s = shell(b, { rng, x0: 1.2, x1: lw - 1.5, z0: tz0, z1: tz1, floors: 2, fh: 0.34, bayW: 0.45, m: 'glass', c: '#7fa6b8', trim: '#d5d3cc', gl: 'teal', upperWin: 'curtain', groundWin: 'curtain', door: { kind: 'door', color: '#3c4146' }, roof: { type: 'flat', parapet: 0.02, m: 'metal', c: '#c9ccd0' }, lit: 0.7 });
  b.grid([1.15, s.yTop + 0.02, tz1 + 0.12], [lw - 1.45, s.yTop + 0.02, tz1 + 0.12], [lw - 1.45, s.yTop + 0.16, (tz0 + tz1) / 2], [1.15, s.yTop + 0.16, (tz0 + tz1) / 2], 6, 1, A.roof({ m: 'metal', c: '#dfe2e5' }), '#ffffff', [0, 1, 1]);
  b.grid([lw - 1.45, s.yTop + 0.02, tz0 - 0.08], [1.15, s.yTop + 0.02, tz0 - 0.08], [1.15, s.yTop + 0.16, (tz0 + tz1) / 2], [lw - 1.45, s.yTop + 0.16, (tz0 + tz1) / 2], 6, 1, A.roof({ m: 'metal', c: '#dfe2e5' }), '#ffffff', [0, 1, -1]);
  signBoard(b, 'AIRPORT', '#1f3a6b', lw / 2 - 0.1, tz1, s.yTop - 0.12, 0.8, 0.1);
  // jet bridges
  for (let k = 0; k < 3; k++) { const x = 1.6 + k * 1.2; b.box(x, 0.18, tz0 - 0.4, x + 0.08, 0.26, tz0, w, '#c9ccd0', { rep: 0, top: w }); }
  // control tower
  const cx = lw - 0.9, cz = ld - 1.2;
  b.cyl(cx, cz, 0.1, 0, 1.1, 10, A.wall({ m: 'conc', c: '#d8d6cf', w: 'none' }), '#ffffff', { r1: 0.08, cap: false });
  b.cyl(cx, cz, 0.18, 1.1, 1.28, 10, glassCell(A, '#5a8aa0', 'dark'), '#ffffff', { r1: 0.2, cap: false });
  b.cyl(cx, cz, 0.21, 1.28, 1.32, 10, w, '#3c4146', { cap: true });
  b.box(cx - 0.005, 1.32, cz - 0.005, cx + 0.005, 1.5, cz + 0.005, w, '#c0392b', { rep: 0 });
  // hangar
  b.box(0.2, 0, ld - 1.25, 1.0, 0.36, ld - 0.5, A.wall({ m: 'metal', c: '#9aa6ae', w: 'none' }), '#ffffff', { rep: 0.3, top: A.white });
  b.dome(0.6, ld - 0.875, 0.42, 0.36, 0.14, 12, 2, A.roof({ m: 'metal', c: '#8a9096' }), '#ffffff');
  // parked planes on the apron
  for (let k = 0; k < 3; k++) {
    const px = 1.6 + k * 1.2 + 0.04, pz = tz0 - 0.65;
    b.box(px - 0.04, 0.05, pz - 0.32, px + 0.04, 0.13, pz + 0.3, w, '#f4f4f2', { rep: 0, top: w });
    b.box(px - 0.38, 0.08, pz - 0.05, px + 0.38, 0.095, pz + 0.07, w, '#e8e8e6', { rep: 0, top: w });
    b.box(px - 0.13, 0.12, pz - 0.31, px + 0.13, 0.13, pz - 0.24, w, '#e8e8e6', { rep: 0, top: w });
    b.box(px - 0.006, 0.12, pz - 0.32, px + 0.006, 0.27, pz - 0.22, w, pick(rng, ['#c0392b', '#2a6fb5', '#2d9a4a']), { rep: 0 });
  }
  b.flatQuad(0.2, ld - 0.42, lw - 0.2, ld - 0.04, 0.009, w, '#5f6061');
  for (let k = 0; k < 14; k++) if (rng() < 0.6) car(b, 0.4 + k * 0.5, ld - 0.22, true, pick(rng, CAR_COLS));
  return { floors: 2, h: 1.5, runway: [[0.3, 0.06, 0.7], [lw - 0.3, 0.06, 0.7]] };
};

// ---------------------------------------------------------------- parks
SPECIAL_GEN.plaza = ({ b, rng, lw, ld }) => {
  const A = b.A, w = W(b);
  b.box(0.06, 0, 0.06, lw - 0.06, 0.015, ld - 0.06, A.roof({ m: 'tile', c: '#bfb39b' }), '#ffffff', { rep: 0, top: A.roof({ m: 'tile', c: '#c9bea8' }), topRep: 0.3 });
  for (const [x, z] of [[0.3, 0.3], [lw - 0.3, 0.3], [0.3, ld - 0.3], [lw - 0.3, ld - 0.3]]) { b.box(x - 0.1, 0.015, z - 0.1, x + 0.1, 0.07, z + 0.1, w, '#9a948a', { rep: 0, top: A.roof({ m: 'grass', c: '#4a7a3a' }) }); tree(b, x, z, 0.36, 'round', '#4a8a3e', rng); }
  b.cyl(lw / 2, ld / 2, 0.16, 0.015, 0.06, 14, w, '#cfc8b4', { cap: false });
  b.cyl(lw / 2, ld / 2, 0.15, 0.055, 0.058, 14, A.roof({ m: 'water', c: '#4aa3c8' }), '#ffffff', { cap: true });
  b.cyl(lw / 2, ld / 2, 0.02, 0.015, 0.16, 6, w, '#cfc8b4', {});
  bench(b, lw / 2 - 0.35, ld / 2 - 0.02); bench(b, lw / 2 + 0.25, ld / 2 - 0.02);
  lampPost(b, 0.12, ld / 2); lampPost(b, lw - 0.12, ld / 2);
  return { floors: 1, h: 0.4, fountain: [lw / 2, 0.16, ld / 2] };
};
SPECIAL_GEN.dog_park = ({ b, rng, lw, ld }) => {
  const A = b.A, w = W(b);
  b.flatQuad(0.06, 0.06, lw - 0.06, ld - 0.06, 0.006, A.roof({ m: 'grass', c: '#6a9a4a' }), '#ffffff', 2, 2);
  fence(b, 0.06, 0.06, lw - 0.06, 0.06, 0.07, '#9aa0a6'); fence(b, 0.06, ld - 0.06, lw - 0.06, ld - 0.06, 0.07, '#9aa0a6');
  fence(b, 0.06, 0.06, 0.06, ld - 0.06, 0.07, '#9aa0a6'); fence(b, lw - 0.06, 0.06, lw - 0.06, ld - 0.06, 0.07, '#9aa0a6');
  // agility jumps + tunnel
  for (let k = 0; k < 3; k++) { const x = 0.4 + k * 0.4; b.box(x, 0, 0.5, x + 0.008, 0.06, 0.508, w, '#e0a020', { rep: 0 }); b.box(x + 0.15, 0, 0.5, x + 0.158, 0.06, 0.508, w, '#e0a020', { rep: 0 }); b.box(x, 0.045, 0.5, x + 0.158, 0.05, 0.508, w, '#c0392b', { rep: 0 }); }
  b.box(1.0, 0, 1.25, 1.4, 0.07, 1.35, w, '#2a62a8', { rep: 0, top: w });
  // dogs
  for (let k = 0; k < 4; k++) { const x = 0.3 + rng() * (lw - 0.6), z = 0.3 + rng() * (ld - 0.6), c = pick(rng, ['#8a5a30', '#f2e6cc', '#2b2b2b', '#c9a060']); b.box(x, 0.012, z, x + 0.045, 0.035, z + 0.016, w, c, { rep: 0, top: w }); b.box(x + 0.04, 0.03, z, x + 0.058, 0.048, z + 0.016, w, c, { rep: 0, top: w }); }
  bench(b, 0.2, ld - 0.25); tree(b, lw - 0.25, ld - 0.25, 0.4, 'round', '#4a8a3e', rng); tree(b, 0.25, 0.25, 0.38, 'round', '#5a9a46', rng);
  return { floors: 1, h: 0.4 };
};
SPECIAL_GEN.skate_park = ({ b, rng, lw, ld }) => {
  const A = b.A, w = W(b);
  b.box(0.06, 0, 0.06, lw - 0.06, 0.01, ld - 0.06, w, '#b9b8b2', { rep: 0, top: w });
  const conc = '#c9c8c2';
  // quarter pipes and a funbox
  b.grid([0.15, 0.01, 0.6], [lw - 0.15, 0.01, 0.6], [lw - 0.15, 0.16, 0.2], [0.15, 0.16, 0.2], 3, 2, w, conc, [0, 1, 1]);
  b.box(0.15, 0.01, 0.1, lw - 0.15, 0.16, 0.2, w, conc, { rep: 0, top: w });
  b.grid([lw - 0.15, 0.01, ld - 0.6], [0.15, 0.01, ld - 0.6], [0.15, 0.12, ld - 0.25], [lw - 0.15, 0.12, ld - 0.25], 3, 1, w, conc, [0, 1, -1]);
  b.box(0.15, 0.01, ld - 0.25, lw - 0.15, 0.12, ld - 0.12, w, conc, { rep: 0, top: w });
  b.box(lw / 2 - 0.2, 0.01, ld / 2 - 0.12, lw / 2 + 0.2, 0.07, ld / 2 + 0.12, w, '#a9a8a2', { rep: 0, top: w });
  b.box(lw / 2 - 0.3, 0.06, ld / 2 + 0.2, lw / 2 + 0.3, 0.07, ld / 2 + 0.21, w, '#333', { rep: 0, top: w });
  // graffiti wall
  b.box(lw - 0.12, 0, 0.7, lw - 0.08, 0.16, ld - 0.7, A.decal('graffiti', (c, S) => { c.fillStyle = '#9a9a96'; c.fillRect(0, 0, S, S); const cs = ['#e84a5f', '#2a9d8f', '#f4d35e', '#9b5de5']; for (let k = 0; k < 7; k++) { c.fillStyle = cs[k % 4]; c.beginPath(); c.arc(8 + k * 8, 20 + (k % 3) * 12, 9, 0, 7); c.fill(); } }), '#ffffff', { rep: 0, top: w });
  return { floors: 1, h: 0.2 };
};
SPECIAL_GEN.pond_park = ({ b, rng, lw, ld }) => {
  const A = b.A, w = W(b);
  b.flatQuad(0.05, 0.05, lw - 0.05, ld - 0.05, 0.006, A.roof({ m: 'grass', c: '#5a9a46' }), '#ffffff', 3, 3);
  // irregular pond as a fan of quads
  const cx = lw * 0.45, cz = ld * 0.45, R = 0.85;
  const water = A.white;
  for (let k = 0; k < 24; k++) {
    const a0 = (k / 24) * Math.PI * 2, a1 = ((k + 1) / 24) * Math.PI * 2;
    const r0 = R * (0.86 + 0.1 * Math.sin(a0 * 2 + 1) + 0.04 * Math.sin(a0 * 5)), r1 = R * (0.86 + 0.1 * Math.sin(a1 * 2 + 1) + 0.04 * Math.sin(a1 * 5));
    b.tri([cx, 0.012, cz], [cx + Math.cos(a1) * r1, 0.012, cz + Math.sin(a1) * r1], [cx + Math.cos(a0) * r0, 0.012, cz + Math.sin(a0) * r0], water, '#3f8fb0', { out: [0, 1, 0] });
    b.tri([cx + Math.cos(a0) * r0, 0.01, cz + Math.sin(a0) * r0], [cx + Math.cos(a1) * r1, 0.01, cz + Math.sin(a1) * r1], [cx + Math.cos(a1) * (r1 + 0.05), 0.01, cz + Math.sin(a1) * (r1 + 0.05)], w, '#b9a98d', { out: [0, 1, 0] });
  }
  // ducks
  for (let k = 0; k < 5; k++) { const a = rng() * 6.28, r = rng() * 0.5; b.box(cx + Math.cos(a) * r, 0.012, cz + Math.sin(a) * r, cx + Math.cos(a) * r + 0.025, 0.026, cz + Math.sin(a) * r + 0.014, w, k ? '#f2f2ee' : '#5a7a3a', { rep: 0, top: w }); }
  // gazebo
  const gx = lw - 0.45, gz = ld - 0.45;
  b.cyl(gx, gz, 0.2, 0, 0.03, 6, w, '#d8d0bc', { cap: true });
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; b.cyl(gx + Math.cos(a) * 0.17, gz + Math.sin(a) * 0.17, 0.008, 0.03, 0.22, 4, w, '#f4f1e7', { cap: false }); }
  b.pyramid(gx, gz, 0.24, 0.22, 0.36, 6, A.roof({ m: 'copper', c: '#5e8a74' }), '#ffffff', 0, false);
  b.flatQuad(gx - 0.04, gz - 0.9, gx + 0.04, gz - 0.2, 0.009, w, '#c9bfa9');
  for (const [x, z] of [[0.25, ld - 0.3], [lw - 0.3, 0.3], [0.3, 0.25], [lw * 0.5, ld - 0.15]]) tree(b, x, z, 0.4 + rng() * 0.15, rng() < 0.3 ? 'pine' : 'round', pick(rng, ['#3f7a3a', '#4a8a3e', '#5a9a46']), rng);
  bench(b, cx - 0.1, cz + R + 0.1); bench(b, cx + 0.4, cz - R - 0.05);
  return { floors: 1, h: 0.4 };
};
SPECIAL_GEN.zoo = ({ b, rng, lw, ld }) => {
  const A = b.A, w = W(b);
  b.flatQuad(0.05, 0.05, lw - 0.05, ld - 0.05, 0.006, A.roof({ m: 'grass', c: '#6a9a4a' }), '#ffffff', 4, 4);
  b.flatQuad(lw / 2 - 0.08, 0.05, lw / 2 + 0.08, ld - 0.05, 0.01, w, '#c9bfa9'); b.flatQuad(0.05, ld / 2 - 0.08, lw - 0.05, ld / 2 + 0.08, 0.01, w, '#c9bfa9');
  const pens = [[0.12, 0.12, lw / 2 - 0.15, ld / 2 - 0.15, '#c9a66a'], [lw / 2 + 0.15, 0.12, lw - 0.12, ld / 2 - 0.15, '#8a9a5a'], [0.12, ld / 2 + 0.15, lw / 2 - 0.15, ld - 0.4, '#9a8a6a'], [lw / 2 + 0.15, ld / 2 + 0.15, lw - 0.12, ld - 0.4, '#6a9a6a']];
  pens.forEach(([x0, z0, x1, z1, g], k) => {
    b.flatQuad(x0, z0, x1, z1, 0.009, w, g);
    fence(b, x0, z0, x1, z0, 0.06, '#7a5a3d'); fence(b, x0, z1, x1, z1, 0.06, '#7a5a3d'); fence(b, x0, z0, x0, z1, 0.06, '#7a5a3d'); fence(b, x1, z0, x1, z1, 0.06, '#7a5a3d');
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    if (k === 0) { for (let i = 0; i < 2; i++) { const x = cx - 0.2 + i * 0.4; b.box(x, 0.06, cz, x + 0.1, 0.12, cz + 0.05, w, '#d9b85a', { rep: 0, top: w }); b.box(x + 0.08, 0.1, cz + 0.01, x + 0.1, 0.32, cz + 0.035, w, '#d9b85a', { rep: 0, top: w }); for (const lx of [x, x + 0.08]) b.box(lx, 0, cz + 0.01, lx + 0.015, 0.06, cz + 0.035, w, '#c9a64a', { rep: 0 }); } }
    else if (k === 1) { for (let i = 0; i < 2; i++) { const x = cx - 0.25 + i * 0.35; b.box(x, 0.03, cz, x + 0.16, 0.13, cz + 0.09, w, '#8a8a8e', { rep: 0, top: w }); b.box(x + 0.15, 0.06, cz + 0.02, x + 0.2, 0.14, cz + 0.07, w, '#8a8a8e', { rep: 0, top: w }); } b.flatQuad(cx + 0.1, z0 + 0.06, x1 - 0.06, z0 + 0.3, 0.012, A.roof({ m: 'water', c: '#4a9ab8' }), '#ffffff'); }
    else if (k === 2) { for (let i = 0; i < 3; i++) { const x = cx - 0.3 + i * 0.25; b.box(x, 0.02, cz, x + 0.08, 0.06, cz + 0.035, w, '#c9a060', { rep: 0, top: w }); b.box(x + 0.065, 0.045, cz - 0.005, x + 0.095, 0.08, cz + 0.04, w, '#8a5a30', { rep: 0, top: w }); } b.pyramid(cx + 0.2, cz + 0.15, 0.15, 0, 0.12, 6, w, '#9a8a6a', 0.3, true); }
    else { b.box(cx - 0.1, 0, cz - 0.1, cx + 0.1, 0.1, cz + 0.1, A.wall({ m: 'wood', c: '#8a6a48', w: 'none' }), '#ffffff', { rep: 0.2, top: A.roof({ m: 'thatch', c: '#b8955a' }) }); for (let i = 0; i < 3; i++) tree(b, x0 + 0.15 + i * 0.25, z1 - 0.12, 0.35, 'round', '#3f7a3a', rng); }
  });
  // entrance gate + visitor centre
  shell(b, { rng, x0: lw / 2 - 0.5, x1: lw / 2 + 0.5, z0: ld - 0.36, z1: ld - 0.12, floors: 1, fh: 0.26, bayW: 0.3, m: 'wood', c: '#9c7a52', trim: '#e8dcc0', upperWin: 'casement', door: { kind: 'door', color: '#3a5a3a' }, roof: { type: 'gable', ridge: 'x', rise: 0.14, m: 'thatch', c: '#b8955a' }, lit: 0.5 });
  signBoard(b, 'CITY ZOO', '#2d6a3a', lw / 2, ld - 0.12, 0.27, 0.5, 0.08);
  for (const [x, z] of [[0.15, ld - 0.2], [lw - 0.15, ld - 0.2]]) tree(b, x, z, 0.45, 'round', '#3f7a3a', rng);
  return { floors: 1, h: 0.45 };
};
SPECIAL_GEN.amusement = ({ b, rng, lw, ld }) => {
  const A = b.A, w = W(b);
  b.box(0.05, 0, 0.05, lw - 0.05, 0.012, ld - 0.05, w, '#c9bea8', { rep: 0, top: w });
  // ferris wheel support (the wheel itself is animated separately)
  const fx = 1.0, fz = 1.0, fr = 0.75, fy = fr + 0.12;
  // A-frame legs either side of the wheel (double-sided so they read from every angle)
  for (const dz of [-0.11, 0.11]) for (const sx of [-1, 1]) {
    const z = fz + dz, a = [fx + sx * 0.36, 0, z], b2 = [fx + sx * 0.3, 0, z], c = [fx + sx * 0.02, fy, z], d = [fx + sx * 0.05, fy, z];
    b.quad(a, b2, c, d, w, '#cfd3d6', { out: [0, 0, 1] }); b.quad(d, c, b2, a, w, '#cfd3d6', { out: [0, 0, -1] });
  }
  b.box(fx - 0.33, 0, fz - 0.13, fx + 0.33, 0.03, fz + 0.13, w, '#9aa0a6', { rep: 0, top: w });
  b.box(fx - 0.01, fy - 0.01, fz - 0.1, fx + 0.01, fy + 0.01, fz + 0.1, w, '#bbb', { rep: 0 });
  // carousel
  const cx = lw - 0.9, cz = 0.9;
  b.cyl(cx, cz, 0.36, 0, 0.04, 16, w, '#e8d8b0', { cap: true });
  for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; b.cyl(cx + Math.cos(a) * 0.3, cz + Math.sin(a) * 0.3, 0.008, 0.04, 0.24, 4, w, '#d9b34a', { cap: false }); b.box(cx + Math.cos(a) * 0.3 - 0.02, 0.08, cz + Math.sin(a) * 0.3 - 0.01, cx + Math.cos(a) * 0.3 + 0.02, 0.11, cz + Math.sin(a) * 0.3 + 0.01, w, pick(rng, ['#f2f2ee', '#c0392b', '#2a62a8', '#d9a62b']), { rep: 0, top: w }); }
  const stripe = A.decal('carousel', (c, S) => { for (let k = 0; k < 8; k++) { c.fillStyle = k % 2 ? '#c0392b' : '#f4efe0'; c.fillRect(k * S / 8, 0, S / 8, S); } });
  b.pyramid(cx, cz, 0.42, 0.24, 0.42, 16, stripe, '#ffffff', 0, false);
  b.cyl(cx, cz, 0.012, 0.42, 0.5, 4, w, '#d9b34a', {});
  // roller coaster: a loop of track on stilts
  const pts = [];
  for (let k = 0; k <= 40; k++) { const t = k / 40 * Math.PI * 2; pts.push([lw / 2 + Math.cos(t) * (lw * 0.38), ld - 1.0 + Math.sin(t) * 0.55, 0.25 + 0.25 * Math.sin(t * 2) ** 2]); }
  for (let k = 0; k < 40; k++) {
    const [x0, z0, y0] = pts[k], [x1, z1, y1] = pts[k + 1];
    const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz), nx = -dz / l * 0.03, nz = dx / l * 0.03;
    b.quad([x0 - nx, y0, z0 - nz], [x1 - nx, y1, z1 - nz], [x1 + nx, y1, z1 + nz], [x0 + nx, y0, z0 + nz], w, '#c0392b', { out: [0, 1, 0] });
    b.quad([x0 + nx, y0 - 0.015, z0 + nz], [x1 + nx, y1 - 0.015, z1 + nz], [x1 - nx, y1 - 0.015, z1 - nz], [x0 - nx, y0 - 0.015, z0 - nz], w, '#8a2a20', { out: [0, -1, 0] });
    if (k % 3 === 0) b.box(x0 - 0.006, 0, z0 - 0.006, x0 + 0.006, y0, z0 + 0.006, w, '#e8e8e6', { rep: 0 });
  }
  // stalls
  for (let k = 0; k < 4; k++) { const x = 0.3 + k * 0.35, z = ld - 0.3; b.box(x, 0, z, x + 0.22, 0.12, z + 0.15, w, '#f4efe0', { rep: 0, top: w }); awning(b, x, x + 0.22, z + 0.15, 0.13, 0.06, pick(rng, ['#c0392b', '#2a62a8', '#2d9a4a', '#d9a62b'])); }
  for (let k = 0; k < 4; k++) lampPost(b, 0.2 + k * (lw - 0.4) / 3, ld / 2, 0.16);
  return { floors: 1, h: fy + fr, wheel: [fx, fy, fz, fr] };
};

// ---------------------------------------------------------------- landmarks
SPECIAL_GEN.cathedral = ({ b, rng, lw, ld, st }) => {
  const A = b.A, w = W(b);
  if (st === 'southern') {
    // Spanish mission style
    const r = { x0: 0.35, x1: lw - 0.35, z0: 0.2, z1: ld - 0.7 };
    const s = shell(b, { rng, ...r, floors: 1, fh: 0.6, bayW: 0.35, m: 'stucco', c: '#f2e6cc', trim: '#fbf8ee', upperWin: 'arch', door: { kind: 'door', color: '#5a3a20' }, roof: { type: 'gable', ridge: 'z', rise: 0.3, m: 'tile', c: '#b0503a' }, lit: 0.4 });
    for (const tx of [0.3, lw - 0.3]) { b.box(tx - 0.2, 0, ld - 0.75, tx + 0.2, 1.0, ld - 0.35, A.wall({ m: 'stucco', c: '#f2e6cc', w: 'arch', wc: '#fbf8ee', fl: 'u' }), '#ffffff', { rep: 0.25, top: w }); b.box(tx - 0.16, 1.0, ld - 0.71, tx + 0.16, 1.2, ld - 0.39, A.wall({ m: 'stucco', c: '#f2e6cc', w: 'arch', wc: '#2a2a2a', fl: 'u' }), '#ffffff', { rep: 0, top: w }); b.dome(tx, ld - 0.55, 0.17, 1.2, 0.17, 10, 3, A.roof({ m: 'tile', c: '#b0503a' }), '#ffffff'); }
    b.box(0.5, 0, ld - 0.4, lw - 0.5, 0.9, ld - 0.35, A.wall({ m: 'stucco', c: '#f2e6cc', w: 'none' }), '#ffffff', { rep: 0.3, top: w });
    b.gable(0.5, ld - 0.42, lw - 0.5, ld - 0.33, 0.9, 0.2, 'x', A.roof({ m: 'stucco', c: '#f2e6cc' }), '#ffffff', A.wall({ m: 'stucco', c: '#f2e6cc', w: 'none' }), '#ffffff', 0);
    return { floors: 2, h: 1.4 };
  }
  if (st === 'modern') {
    const r = { x0: 0.25, x1: lw - 0.25, z0: 0.2, z1: ld - 0.4 };
    b.gable(r.x0, r.z0, r.x1, r.z1, 0.02, 1.2, 'z', A.roof({ m: 'metal', c: '#dfe2e5' }), '#ffffff', glassCell(A, '#c9a0d0', 'warm'), '#ffffff', 0.04);
    b.cyl(lw / 2, ld - 0.25, 0.04, 0, 1.6, 6, w, '#e8e8e6', { r1: 0.01 });
    b.box(lw / 2 - 0.12, 1.25, ld - 0.255, lw / 2 + 0.12, 1.29, ld - 0.245, w, '#e8e8e6', { rep: 0 });
    return { floors: 2, h: 1.6 };
  }
  // gothic stone cathedral with twin spires
  const stone = st === 'georgian' ? '#cfc6b0' : st === 'colonial' ? '#d8d2c2' : '#b9b2a2';
  const nave = { x0: 0.6, x1: lw - 0.6, z0: 0.25, z1: ld - 0.8 };
  const s = shell(b, { rng, ...nave, floors: 1, fh: 0.75, bayW: 0.3, m: 'stone', c: stone, trim: '#e8e2d0', upperWin: 'arch', gl: 'warm', roof: { type: 'gable', ridge: 'z', rise: 0.5, m: 'slate', c: '#4b5360' }, lit: 0.6 });
  // transept + aisles
  shell(b, { rng, x0: 0.15, x1: lw - 0.15, z0: 0.9, z1: 1.5, floors: 1, fh: 0.7, bayW: 0.3, m: 'stone', c: stone, trim: '#e8e2d0', upperWin: 'arch', gl: 'warm', roof: { type: 'gable', ridge: 'x', rise: 0.45, m: 'slate', c: '#4b5360' }, lit: 0.5 });
  for (const sx of [0.25, lw - 0.6]) shell(b, { rng, x0: sx, x1: sx + 0.35, z0: 1.55, z1: ld - 0.85, floors: 1, fh: 0.42, bayW: 0.3, m: 'stone', c: stone, trim: '#e8e2d0', upperWin: 'arch', gl: 'warm', roof: { type: 'shed', rise: 0.15, m: 'slate', c: '#4b5360' }, lit: 0.4, noSides: false });
  // buttresses
  for (let z = 1.6; z < ld - 0.9; z += 0.35) for (const x of [0.22, lw - 0.28]) b.box(x, 0, z, x + 0.06, 0.5, z + 0.06, A.wall({ m: 'stone', c: stone, w: 'none' }), '#ffffff', { rep: 0.2, top: w });
  // west front towers + spires
  const rose = A.decal('rosewin', (c, S) => { c.fillStyle = stone; c.fillRect(0, 0, S, S); c.fillStyle = '#3a2a5a'; c.beginPath(); c.arc(S / 2, S / 2, S * 0.42, 0, 7); c.fill(); const cs = ['#c0392b', '#2a62a8', '#d9a62b', '#2d9a4a']; for (let k = 0; k < 12; k++) { c.fillStyle = cs[k % 4]; c.beginPath(); c.moveTo(S / 2, S / 2); c.arc(S / 2, S / 2, S * 0.38, k * 0.52, k * 0.52 + 0.35); c.fill(); } c.fillStyle = '#d9a62b'; c.beginPath(); c.arc(S / 2, S / 2, 5, 0, 7); c.fill(); }, (c, S) => { c.fillStyle = '#000'; c.fillRect(0, 0, S, S); c.fillStyle = '#ffcf80'; c.beginPath(); c.arc(S / 2, S / 2, S * 0.38, 0, 7); c.fill(); });
  b.wall(lw / 2 - 0.2, ld - 0.8 + 0.004, 0, 1, 0.4, 0.4, 0.8, rose, [1, 1, 1], 0, 0);
  for (const tx of [nave.x0 - 0.05, nave.x1 + 0.05]) {
    b.box(tx - 0.22, 0, ld - 0.8, tx + 0.22, 1.3, ld - 0.36, A.wall({ m: 'stone', c: stone, w: 'arch', gl: 'warm', wc: '#e8e2d0', fl: 'u' }), '#ffffff', { rep: 0.3, top: w });
    for (const [px, pz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) b.pyramid(tx + px, ld - 0.58 + pz, 0.04, 1.3, 1.45, 4, w, stone, Math.PI / 4);
    b.pyramid(tx, ld - 0.58, 0.18, 1.3, 2.3, 8, A.roof({ m: 'slate', c: '#4b5360' }), '#ffffff', Math.PI / 8);
    b.cyl(tx, ld - 0.58, 0.006, 2.3, 2.42, 4, w, '#d9b34a', {});
  }
  b.box(lw / 2 - 0.14, 0, ld - 0.36, lw / 2 + 0.14, 0.4, ld - 0.33, A.wall({ m: 'stone', c: stone, w: 'door', dc: '#3a2a1e', fl: 'g' }), '#ffffff', { rep: 0, top: w });
  for (const [x, z] of [[0.15, ld - 0.15], [lw - 0.15, ld - 0.15]]) tree(b, x, z, 0.45, 'round', '#4a8a3e', rng);
  return { floors: 3, h: 2.42 };
};
SPECIAL_GEN.opera = ({ b, rng, lw, ld, st }) => {
  const A = b.A, w = W(b);
  if (st === 'modern') {
    b.box(0.2, 0, 0.2, lw - 0.2, 0.2, ld - 0.3, A.wall({ m: 'conc', c: '#d8cfc0', w: 'curtain', gl: 'warm', fl: 'g' }), '#ffffff', { rep: 0.3, top: w });
    // sail shells
    for (let k = 0; k < 3; k++) { const x = 0.7 + k * 1.1, z = ld / 2; b.dome(x, z, 0.55 - k * 0.08, 0.2, 0.9 - k * 0.15, 12, 4, A.roof({ m: 'tile', c: '#f4f2ec' }), '#ffffff'); }
    return { floors: 2, h: 1.1 };
  }
  const r = { x0: 0.2, x1: lw - 0.2, z0: 0.2, z1: ld - 0.55 };
  const stone = st === 'georgian' ? '#e5dfcf' : st === 'american' ? '#d8cfb8' : '#efe9da';
  const s = shell(b, { rng, ...r, floors: 2, fh: 0.42, bayW: 0.33, m: 'stone', c: stone, trim: '#fbf8ee', upperWin: 'arch', groundWin: 'arch', door: { kind: 'door', color: '#5a1f2a' }, roof: { type: 'flat', parapet: 0.08, m: 'slate', c: '#59616b' }, lit: 0.6 });
  cornice(b, r.x0, r.z0, r.x1, r.z1, s.yTop, 0.05, 0.05);
  portico(b, { x0: r.x0 + 0.5, x1: r.x1 - 0.5, z: r.z1, depth: 0.28, h: 0.84, cols: 8, color: '#fbf8ee', r: 0.03 });
  b.dome(lw / 2, (r.z0 + r.z1) / 2 - 0.1, 0.5, s.yTop + 0.08, 0.38, 16, 4, A.roof({ m: 'copper', c: '#5e8a74' }), '#ffffff');
  b.cyl(lw / 2, (r.z0 + r.z1) / 2 - 0.1, 0.5, s.yTop, s.yTop + 0.08, 16, w, stone, { cap: false });
  for (const x of [r.x0 + 0.2, r.x1 - 0.2]) { b.box(x - 0.08, s.yTop, r.z1 - 0.2, x + 0.08, s.yTop + 0.25, r.z1 - 0.04, w, '#d9b34a', { rep: 0, top: w }); }
  for (let k = 0; k < 5; k++) lampPost(b, 0.3 + k * (lw - 0.6) / 4, ld - 0.08, 0.18);
  return { floors: 2.5, h: s.yTop + 0.46 };
};
SPECIAL_GEN.arch = ({ b, lw, ld }) => {
  const A = b.A, w = W(b);
  const stone = A.wall({ m: 'stone', c: '#e5dfcf', w: 'none' });
  const x0 = 0.25, x1 = lw - 0.25, z0 = 0.3, z1 = 0.7;
  b.box(x0, 0, z0, x0 + 0.4, 0.75, z1, stone, '#ffffff', { rep: 0.2, top: w });
  b.box(x1 - 0.4, 0, z0, x1, 0.75, z1, stone, '#ffffff', { rep: 0.2, top: w });
  b.box(x0, 0.75, z0, x1, 1.05, z1, stone, '#ffffff', { rep: 0.2, top: w });
  // arch curve
  const cx = lw / 2, r = (x1 - x0) / 2 - 0.4;
  for (let k = 0; k < 10; k++) { const a0 = Math.PI * k / 10, a1 = Math.PI * (k + 1) / 10; b.quad([cx - Math.cos(a0) * r, 0.5 + Math.sin(a0) * r * 0.7, z1], [cx - Math.cos(a1) * r, 0.5 + Math.sin(a1) * r * 0.7, z1], [cx - Math.cos(a1) * r, 0.75, z1], [cx - Math.cos(a0) * r, 0.75, z1], stone, '#ffffff', { out: [0, 0, 1] }); b.quad([cx - Math.cos(a1) * r, 0.5 + Math.sin(a1) * r * 0.7, z0], [cx - Math.cos(a0) * r, 0.5 + Math.sin(a0) * r * 0.7, z0], [cx - Math.cos(a0) * r, 0.75, z0], [cx - Math.cos(a1) * r, 0.75, z0], stone, '#ffffff', { out: [0, 0, -1] }); }
  b.box(x0 - 0.03, 1.05, z0 - 0.03, x1 + 0.03, 1.1, z1 + 0.03, w, '#d8d0bc', { rep: 0, top: w });
  // quadriga on top
  b.box(cx - 0.15, 1.1, 0.45, cx + 0.15, 1.2, 0.55, w, '#5e8a74', { rep: 0, top: w });
  b.box(cx - 0.03, 1.2, 0.47, cx + 0.03, 1.32, 0.53, w, '#5e8a74', { rep: 0, top: w });
  return { floors: 2, h: 1.32 };
};
SPECIAL_GEN.observatory = ({ b, rng, lw, ld }) => {
  const A = b.A, w = W(b);
  const s = shell(b, { rng, x0: 0.15, x1: lw - 0.15, z0: 0.3, z1: ld - 0.3, floors: 1, fh: 0.36, bayW: 0.3, m: 'stone', c: '#e5dfcf', trim: '#fbf8ee', upperWin: 'arch', door: { kind: 'door', color: '#2a3b55' }, roof: { type: 'flat', parapet: 0.04, m: 'slate', c: '#59616b' }, lit: 0.4 });
  b.cyl(lw / 2, ld / 2, 0.45, s.yTop, s.yTop + 0.2, 16, A.wall({ m: 'stone', c: '#e5dfcf', w: 'none' }), '#ffffff', { cap: false });
  b.dome(lw / 2, ld / 2, 0.47, s.yTop + 0.2, 0.45, 16, 5, A.roof({ m: 'metal', c: '#c9ccd0' }), '#ffffff');
  b.box(lw / 2 - 0.05, s.yTop + 0.25, ld / 2 - 0.02, lw / 2 + 0.05, s.yTop + 0.66, ld / 2 + 0.44, w, '#2a2d33', { rep: 0, top: w });
  b.cyl(lw / 2, ld / 2 + 0.2, 0.04, s.yTop + 0.3, s.yTop + 0.75, 8, w, '#e8e8e6', { r1: 0.05 });
  return { floors: 1.5, h: s.yTop + 0.75 };
};
