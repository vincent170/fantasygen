// Small props that make lots feel lived in: cars, driveways, mailboxes, bins, gardens, pools, sheds, play sets…
// Local lot frame: x∈[0,lw], z∈[0,ld], street at z = ld.
import { pick } from './util.js';
import { tree, bush, fence } from './build_common.js';

export const CAR_COLS = ['#b8322a', '#2a4a7a', '#e8e6df', '#2b2e33', '#7f8c8d', '#d9a62b', '#2d6a4f', '#5b3a29', '#9aa4ae', '#8e2b2b', '#f2f2ee', '#3c5a8a'];
const FLOWERS = ['#e84a5f', '#f4d35e', '#9b5de5', '#ff9f1c', '#f15bb5', '#ffffff', '#ef476f'];

/** parked car; along = length runs along z */
export function car(b, x, z, along, color) {
  const W = b.A.white;
  const L = 0.19, Wd = 0.085;
  const hx = along ? Wd / 2 : L / 2, hz = along ? L / 2 : Wd / 2;
  b.box(x - hx, 0.014, z - hz, x + hx, 0.046, z + hz, W, color, { rep: 0, top: W });
  const cx = along ? Wd / 2 - 0.009 : L * 0.27, cz = along ? L * 0.27 : Wd / 2 - 0.009;
  b.box(x - cx, 0.046, z - cz, x + cx, 0.073, z + cz, W, '#2a3646', { rep: 0, top: W, topTint: color });
  for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) {
    const wx = along ? x + s1 * (hx - 0.004) : x + s2 * L * 0.3, wz = along ? z + s2 * L * 0.3 : z + s1 * (hz - 0.004);
    b.box(wx - 0.008, 0, wz - 0.008, wx + 0.008, 0.024, wz + 0.008, W, '#1b1b1d', { rep: 0, top: W });
  }
}

export function driveway(b, x0, x1, z0, z1, tint = '#8a8b8d') { b.flatQuad(x0, z0, x1, z1, 0.009, b.A.white, tint); }

export function mailbox(b, x, z, color = '#2a3b55') {
  const W = b.A.white;
  b.box(x - 0.004, 0, z - 0.004, x + 0.004, 0.06, z + 0.004, W, '#5b4330', { rep: 0, top: W });
  b.box(x - 0.012, 0.06, z - 0.018, x + 0.012, 0.082, z + 0.018, W, color, { rep: 0, top: W });
}

export function bins(b, x, z) {
  const W = b.A.white;
  b.box(x, 0, z, x + 0.03, 0.045, z + 0.03, W, '#3e6b3e', { rep: 0, top: W });
  b.box(x + 0.035, 0, z, x + 0.065, 0.045, z + 0.03, W, '#4a5560', { rep: 0, top: W });
}

export function hedge(b, x0, z0, x1, z1, h = 0.05, col = '#3d6e37') {
  b.box(x0, 0, z0, x1, h, z1, b.A.roof({ m: 'grass', c: col }), '#ffffff', { rep: 0.12, top: b.A.roof({ m: 'grass', c: col }) });
}

export function flowerBed(b, rng, x0, z0, x1, z1) {
  const W = b.A.white;
  b.box(x0, 0, z0, x1, 0.014, z1, W, '#5a4330', { rep: 0, top: W });
  const n = Math.max(2, Math.round((x1 - x0) / 0.05));
  for (let i = 0; i < n; i++) {
    const x = x0 + ((x1 - x0) * (i + 0.5)) / n, z = (z0 + z1) / 2 + (rng() - 0.5) * (z1 - z0) * 0.4;
    b.dome(x, z, 0.016, 0.012, 0.02, 5, 1, W, pick(rng, FLOWERS));
  }
}

export function pool(b, x0, z0, x1, z1) {
  const A = b.A;
  b.flatQuad(x0 - 0.03, z0 - 0.03, x1 + 0.03, z1 + 0.03, 0.008, A.white, '#ddd6c6');
  b.flatQuad(x0, z0, x1, z1, 0.012, A.roof({ m: 'water', c: '#3fb3d6' }), '#ffffff');
  b.box(x1 - 0.02, 0.012, z0 + 0.02, x1 - 0.005, 0.05, z0 + 0.035, A.white, '#c8c8c8', { rep: 0 });
}

export function shed(b, rng, x, z, w = 0.14, d = 0.11) {
  const A = b.A;
  const c = pick(rng, ['#9a6b45', '#c9c2ae', '#6b8a5a', '#a63d32', '#d9d2bd']);
  const wall = A.wall({ m: 'wood', c, w: 'none' });
  b.box(x, 0, z, x + w, 0.08, z + d, wall, '#ffffff', { rep: 0.2, top: A.white });
  b.gable(x, z, x + w, z + d, 0.08, 0.045, 'x', A.roof({ m: 'shingle', c: '#4a4a4e' }), [1, 1, 1], wall, [1, 1, 1], 0.012);
  b.box(x + w * 0.35, 0, z + d, x + w * 0.65, 0.065, z + d + 0.002, A.white, '#4a3424', { rep: 0 });
}

export function swingset(b, x, z) {
  const W = b.A.white, c = '#c0392b';
  for (const dx of [0, 0.2]) {
    b.box(x + dx - 0.004, 0, z - 0.03, x + dx + 0.004, 0.12, z - 0.022, W, c, { rep: 0 });
    b.box(x + dx - 0.004, 0, z + 0.022, x + dx + 0.004, 0.12, z + 0.03, W, c, { rep: 0 });
  }
  b.box(x - 0.004, 0.115, z - 0.006, x + 0.204, 0.125, z + 0.006, W, c, { rep: 0, top: W });
  for (const sx of [0.06, 0.13]) b.box(x + sx, 0.035, z - 0.008, x + sx + 0.03, 0.04, z + 0.008, W, '#2a2a2a', { rep: 0, top: W });
}

export function trampoline(b, x, z) {
  const W = b.A.white;
  b.cyl(x, z, 0.075, 0.035, 0.042, 12, W, '#2a62a8', { cap: false });
  b.cyl(x, z, 0.068, 0.04, 0.041, 12, W, '#1b1b1d', { cap: true });
}

export function picnic(b, x, z) {
  const W = b.A.white;
  b.box(x, 0.032, z, x + 0.09, 0.038, z + 0.05, W, '#8a6a45', { rep: 0, top: W });
  b.box(x, 0.018, z - 0.02, x + 0.09, 0.022, z - 0.008, W, '#8a6a45', { rep: 0, top: W });
  b.box(x, 0.018, z + 0.058, x + 0.09, 0.022, z + 0.07, W, '#8a6a45', { rep: 0, top: W });
  b.box(x + 0.04, 0, z + 0.02, x + 0.05, 0.032, z + 0.03, W, '#6a4a30', { rep: 0 });
}

export function clothesline(b, x, z, len = 0.2) {
  const W = b.A.white;
  b.box(x, 0, z, x + 0.006, 0.08, z + 0.006, W, '#888', { rep: 0 }); b.box(x + len, 0, z, x + len + 0.006, 0.08, z + 0.006, W, '#888', { rep: 0 });
  b.box(x, 0.077, z + 0.002, x + len, 0.079, z + 0.004, W, '#eee', { rep: 0 });
  const cols = ['#e84a5f', '#ffffff', '#3a79c0', '#f4d35e'];
  for (let i = 0; i < 4; i++) b.box(x + 0.03 + i * 0.045, 0.045, z + 0.0025, x + 0.06 + i * 0.045, 0.077, z + 0.0035, W, cols[i], { rep: 0 });
}

export function dish(b, x, y, z) {
  const W = b.A.white;
  b.box(x - 0.003, y, z - 0.003, x + 0.003, y + 0.03, z + 0.003, W, '#999', { rep: 0 });
  b.dome(x, z, 0.022, y + 0.026, 0.01, 7, 1, W, '#e8e8e8');
}

export function acUnit(b, x, y, z, s = 0.04) {
  b.box(x, y, z, x + s, y + s * 0.7, z + s, b.A.white, '#b9bec2', { rep: 0, top: b.A.white });
}

export function lampPost(b, x, z, h = 0.14) {
  const A = b.A;
  const lamp = A.decal('lamp', (c, S) => { c.fillStyle = '#ffe9a0'; c.fillRect(0, 0, S, S); }, (c, S) => { c.fillStyle = '#fff2b0'; c.fillRect(0, 0, S, S); });
  b.cyl(x, z, 0.005, 0, h, 5, A.white, '#2b2e33', { cap: false });
  b.box(x - 0.012, h, z - 0.012, x + 0.012, h + 0.022, z + 0.012, lamp, '#ffffff', { rep: 0, top: A.white });
}

/** solar panels laid on a gable slope running along x. eave (zE,yE) → ridge (zR,yR) */
export function slopeSolar(b, x0, x1, zE, yE, zR, yR) {
  const cell = b.A.roof({ m: 'solar', c: '#16233a' });
  const t0 = 0.18, t1 = 0.78, off = 0.008;
  const za = zE + (zR - zE) * t0, ya = yE + (yR - yE) * t0 + off, zb = zE + (zR - zE) * t1, yb = yE + (yR - yE) * t1 + off;
  b.grid([x0, ya, za], [x1, ya, za], [x1, yb, zb], [x0, yb, zb], Math.max(1, Math.round((x1 - x0) / 0.12)), 2, cell, [1, 1, 1], [0, 1, Math.sign(zE - zR)]);
}

export function flatSolar(b, x0, z0, x1, z1, y) {
  const cell = b.A.roof({ m: 'solar', c: '#16233a' });
  b.box(x0, y, z0, x1, y + 0.012, z1, b.A.white, '#5a6068', { rep: 0, top: cell, topRep: 0.12 });
}

/** a bay window projecting from a front wall at z */
export function bayWindow(b, cx, z, y0, w, h, d, wallCell, roofCell, trim = '#f2efe6') {
  const A = b.A;
  const x0 = cx - w / 2, x1 = cx + w / 2;
  b.box(x0, y0, z, x1, y0 + h, z + d, wallCell, '#ffffff', { rep: 0, top: A.white });
  b.box(x0 - 0.01, y0 + h, z - 0.005, x1 + 0.01, y0 + h + 0.018, z + d + 0.012, A.white, trim, { rep: 0, top: roofCell });
  b.box(x0 - 0.008, y0 - 0.012, z, x1 + 0.008, y0, z + d + 0.008, A.white, trim, { rep: 0, top: A.white });
}

/**
 * Dress a residential lot. house = footprint rect {x0,x1,z0,z1}; returns nothing.
 * o: {level, drive:'auto'|'left'|'right'|false, carColor, pool, fenceTint, greens, front:'lawn'|'hedge'|'beds', pathX}
 */
export function dressLot(b, rng, lw, ld, house, o = {}) {
  const level = o.level || 1;
  const used = [house];
  const free = (r) => r.x0 >= 0.02 && r.z0 >= 0.02 && r.x1 <= lw - 0.02 && r.z1 <= ld - 0.02 && !used.some((u) => r.x0 < u.x1 + 0.01 && r.x1 > u.x0 - 0.01 && r.z0 < u.z1 + 0.01 && r.z1 > u.z0 - 0.01);
  const take = (r) => { if (!free(r)) return false; used.push(r); return true; };
  // driveway on the wider side
  const left = house.x0, right = lw - house.x1;
  let drive = o.drive === undefined ? 'auto' : o.drive;
  if (drive === 'auto') drive = right >= 0.16 ? 'right' : left >= 0.16 ? 'left' : (ld - house.z1 >= 0.3 ? 'front' : false);
  if (drive === 'right' || drive === 'left') {
    const x0 = drive === 'right' ? house.x1 + 0.02 : Math.max(0.02, house.x0 - 0.14), x1 = x0 + 0.12;
    const zEnd = Math.max(0.1, house.z1 - 0.25);
    driveway(b, x0, x1, zEnd, ld, o.driveTint);
    used.push({ x0, x1, z0: zEnd, z1: ld });
    if (rng() < 0.75) car(b, (x0 + x1) / 2, Math.min(ld - 0.13, house.z1 + 0.02), true, o.carColor || pick(rng, CAR_COLS));
    if (level >= 2 && rng() < 0.35 && house.z1 - zEnd > 0.18) car(b, (x0 + x1) / 2, zEnd + 0.11, true, pick(rng, CAR_COLS));
  } else if (drive === 'front') {
    const x0 = house.x1 - 0.14, x1 = house.x1 - 0.02;
    driveway(b, x0, x1, house.z1, ld, o.driveTint);
    used.push({ x0, x1, z0: house.z1, z1: ld });
    if (rng() < 0.6) car(b, (x0 + x1) / 2, (house.z1 + ld) / 2, true, pick(rng, CAR_COLS));
  }
  // mailbox & bins
  const px = o.pathX === undefined ? (house.x0 + house.x1) / 2 : o.pathX;
  if (o.mailbox !== false && ld - house.z1 > 0.08) mailbox(b, Math.min(lw - 0.04, px + 0.07), ld - 0.035, pick(rng, ['#2a3b55', '#1e1e1e', '#7a2f2a', '#2f4a3a']));
  if (rng() < 0.7) { const bx = drive === 'left' ? house.x1 + 0.02 : house.x0 - 0.08, bz = house.z0 + 0.03; if (take({ x0: bx, x1: bx + 0.065, z0: bz, z1: bz + 0.03 })) bins(b, bx, bz); }
  // front garden
  const fy = ld - house.z1;
  const front = o.front || pick(rng, ['lawn', 'beds', 'beds', 'hedge']);
  if (fy > 0.1 && front === 'beds') {
    const bx0 = house.x0 + 0.02, bx1 = Math.min(house.x1 - 0.02, px - 0.05);
    if (bx1 - bx0 > 0.08) flowerBed(b, rng, bx0, house.z1 + 0.01, bx1, house.z1 + 0.045);
    const cx0 = px + 0.05, cx1 = house.x1 - 0.02;
    if (cx1 - cx0 > 0.08 && drive !== 'front') flowerBed(b, rng, cx0, house.z1 + 0.01, cx1, house.z1 + 0.045);
  } else if (fy > 0.12 && front === 'hedge') {
    const g = pick(rng, ['#3d6e37', '#4a7a3a', '#2f5f30']);
    if (px - 0.06 > 0.06) hedge(b, 0.03, ld - 0.05, px - 0.06, ld - 0.02, 0.045, g);
    const hx0 = px + 0.06, hx1 = drive === 'right' ? house.x1 : lw - 0.03;
    if (hx1 - hx0 > 0.05) hedge(b, hx0, ld - 0.05, hx1, ld - 0.02, 0.045, g);
  }
  // back & side yard features
  const n = o.extras === undefined ? 1 + ((rng() * (level + 1)) | 0) : o.extras;
  const kinds = ['tree', 'tree', 'shed', 'swing', 'trampoline', 'picnic', 'clothes', 'bed', 'bush'];
  if (o.pool || (level >= 3 && rng() < 0.55)) kinds.unshift('pool');
  // candidate areas: back yard first, then the side yards
  const areas = [
    { x0: 0.04, x1: lw - 0.04, z0: 0.04, z1: house.z0 - 0.02 },
    { x0: 0.04, x1: house.x0 - 0.02, z0: 0.04, z1: ld - 0.14 },
    { x0: house.x1 + 0.02, x1: lw - 0.04, z0: 0.04, z1: ld - 0.14 },
  ].filter((a) => a.x1 - a.x0 > 0.08 && a.z1 - a.z0 > 0.06);
  const totA = areas.reduce((s, a) => s + (a.x1 - a.x0) * (a.z1 - a.z0), 0);
  for (let k = 0; k < n + 2 && areas.length; k++) {
    const kind = k === 0 && kinds[0] === 'pool' ? 'pool' : pick(rng, kinds);
    for (let tries = 0; tries < 6; tries++) {
      let r = rng() * totA, a = areas[0];
      for (const c of areas) { r -= (c.x1 - c.x0) * (c.z1 - c.z0); if (r <= 0) { a = c; break; } }
      const x = a.x0 + rng() * (a.x1 - a.x0), z = a.z0 + rng() * (a.z1 - a.z0);
      if (kind === 'pool') { const r = { x0: x, x1: x + 0.3, z0: z, z1: z + 0.16 }; if (take({ x0: r.x0 - 0.04, x1: r.x1 + 0.04, z0: r.z0 - 0.04, z1: r.z1 + 0.04 })) { pool(b, r.x0, r.z0, r.x1, r.z1); break; } }
      else if (kind === 'shed') { if (take({ x0: x, x1: x + 0.15, z0: z, z1: z + 0.13 })) { shed(b, rng, x, z); break; } }
      else if (kind === 'swing') { if (take({ x0: x - 0.01, x1: x + 0.22, z0: z - 0.04, z1: z + 0.04 })) { swingset(b, x, z); break; } }
      else if (kind === 'trampoline') { if (take({ x0: x - 0.08, x1: x + 0.08, z0: z - 0.08, z1: z + 0.08 })) { trampoline(b, x, z); break; } }
      else if (kind === 'picnic') { if (take({ x0: x, x1: x + 0.1, z0: z - 0.03, z1: z + 0.08 })) { picnic(b, x, z); break; } }
      else if (kind === 'clothes') { if (take({ x0: x, x1: x + 0.21, z0: z - 0.01, z1: z + 0.02 })) { clothesline(b, x, z); break; } }
      else if (kind === 'bed') { if (take({ x0: x, x1: x + 0.14, z0: z, z1: z + 0.05 })) { flowerBed(b, rng, x, z, x + 0.14, z + 0.05); break; } }
      else if (kind === 'bush') { if (take({ x0: x - 0.05, x1: x + 0.05, z0: z - 0.05, z1: z + 0.05 })) { bush(b, x, z, 0.035 + rng() * 0.03, pick(rng, o.greens || ['#3f7a3a', '#4a8a3e', '#5a9a46'])); break; } }
      else { if (take({ x0: x - 0.06, x1: x + 0.06, z0: z - 0.06, z1: z + 0.06 })) { tree(b, x, z, 0.26 + rng() * 0.2, rng() < 0.2 ? 'pine' : 'round', pick(rng, o.greens || ['#3f7a3a', '#4a8a3e', '#5a9a46', '#3a6f35']), rng); break; } }
    }
  }
  if (o.fence) {
    const t = o.fenceTint || '#f2efe6';
    fence(b, 0.03, 0.03, lw - 0.03, 0.03, 0.06, t);
    fence(b, 0.03, 0.03, 0.03, ld - 0.08, 0.06, t); fence(b, lw - 0.03, 0.03, lw - 0.03, ld - 0.08, 0.06, t);
  }
}
