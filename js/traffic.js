// Vehicles, pathfinding and congestion.
import * as THREE from '../lib/three.module.js';
import { MB, toGeometry } from './kit.js';
import { clamp, lerp, hash2, mulberry32, pick } from './util.js';
import { R, ROADS, BUILDINGS } from './data.js';
import { DX, DZ } from './world.js';
import { weatherFx } from './weather.js';
import { cimName } from './sim_ext.js';

const MAX = { car: 760, van: 120, truck: 80, bus: 60, police: 24, fire: 24, ambulance: 24, garbage: 24, train: 40, ped: 320, ship: 16, boat: 20, plane: 8 };
const PURPOSE = { work: '💼 Commuting to work', shop: '🛍️ Going shopping', leisure: '🌳 Out for some fun', freight: '📦 Delivering goods', home: '🏠 Heading home' };
const FLOW_W = 2.0; // each simulated car stands for this many real ones

class Heap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v;
    let i = k.length; k.push(key); v.push(val);
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
    k[i] = key; v[i] = val;
  }
  pop() {
    const k = this.k, v = this.v;
    const rv = v[0]; const lk = k.pop(), lv = v.pop();
    const n = k.length;
    if (n) {
      let i = 0;
      for (;;) {
        let c = i * 2 + 1; if (c >= n) break;
        if (c + 1 < n && k[c + 1] < k[c]) c++;
        if (k[c] >= lk) break;
        k[i] = k[c]; v[i] = v[c]; i = c;
      }
      k[i] = lk; v[i] = lv;
    }
    return rv;
  }
}

export class Traffic {
  constructor(G) {
    this.G = G; this.w = G.world; this.n = G.world.n;
    const N = this.n * this.n;
    this.map = new Float32Array(N);     // smoothed load 0..2
    this.cnt = new Uint16Array(N);
    this.vehicles = [];
    this.trains = [];
    this.stamp = new Uint32Array(N); this.cur = 0;
    this.gs = new Float32Array(N); this.came = new Int32Array(N);
    this.homes = []; this.jobs = []; this.shops = []; this.listsRev = -1;
    this.spawnAcc = 0; this.mapAcc = 0; this.garbageAcc = 0; this.busAcc = 0;
    this.rng = mulberry32(777);
    this.wK = 1;
    this.railRev = -1;
    this.meshes = {};
    this.built = false;
  }

  // ------------------------------------------------------------ models
  buildModels(A, mat, scene) {
    const mk = (fn) => { const mb = new MB(A); fn(mb); return toGeometry(mb.build()); };
    const W = A.white;
    const body = (b, l, w, h, y = 0.025, col = '#ffffff') => b.box(-w / 2, y, -l / 2, w / 2, y + h, l / 2, W, col, { rep: 0, top: W });
    const wheels = (b, l, w, rad = 0.016) => { for (const sz of [-1, 1]) for (const sx of [-1, 1]) b.box(sx * (w / 2 - 0.003) - 0.007, 0, sz * l * 0.3 - rad, sx * (w / 2 - 0.003) + 0.007, rad * 2, sz * l * 0.3 + rad, W, '#1a1a1c', { rep: 0, top: W }); };
    const glass = '#2a3646';
    // light cells glow at night through the emissive map
    const HL = A.decal('headlight', (c, S) => { c.fillStyle = '#fff4cc'; c.fillRect(0, 0, S, S); }, (c, S) => { c.fillStyle = '#fff1c0'; c.fillRect(0, 0, S, S); });
    const TL = A.decal('taillight', (c, S) => { c.fillStyle = '#c0392b'; c.fillRect(0, 0, S, S); }, (c, S) => { c.fillStyle = '#ff2a1a'; c.fillRect(0, 0, S, S); });
    const BW = A.decal('buswin', (c, S) => { c.fillStyle = '#2a3646'; c.fillRect(0, 0, S, S); c.fillStyle = '#3a4a5c'; for (let x = 2; x < S; x += 12) c.fillRect(x, 4, 9, S - 8); }, (c, S) => { c.fillStyle = '#000'; c.fillRect(0, 0, S, S); c.fillStyle = '#d9c890'; for (let x = 2; x < S; x += 12) c.fillRect(x, 4, 9, S - 8); });
    const lights = (b, l, w, y = 0.04, h = 0.012) => {
      b.box(-w / 2 + 0.008, y, l / 2 - 0.002, -w / 2 + 0.026, y + h, l / 2 + 0.002, HL, '#ffffff', { rep: 0, top: HL });
      b.box(w / 2 - 0.026, y, l / 2 - 0.002, w / 2 - 0.008, y + h, l / 2 + 0.002, HL, '#ffffff', { rep: 0, top: HL });
      b.box(-w / 2 + 0.006, y, -l / 2 - 0.002, -w / 2 + 0.024, y + h, -l / 2 + 0.002, TL, '#ffffff', { rep: 0, top: TL });
      b.box(w / 2 - 0.024, y, -l / 2 - 0.002, w / 2 - 0.006, y + h, -l / 2 + 0.002, TL, '#ffffff', { rep: 0, top: TL });
    };
    const G = {};
    G.car = mk((b) => { body(b, 0.2, 0.09, 0.034); b.box(-0.04, 0.059, -0.055, 0.04, 0.085, 0.07, W, glass, { rep: 0, top: W }); b.box(-0.036, 0.085, -0.045, 0.036, 0.089, 0.06, W, '#ffffff', { rep: 0, top: W }); wheels(b, 0.2, 0.09); lights(b, 0.2, 0.09); });
    G.van = mk((b) => { body(b, 0.24, 0.1, 0.06); b.box(-0.045, 0.085, 0.03, 0.045, 0.1, 0.12, W, glass, { rep: 0, top: W }); wheels(b, 0.24, 0.1); lights(b, 0.24, 0.1); });
    G.truck = mk((b) => { b.box(-0.045, 0.03, 0.06, 0.045, 0.1, 0.14, W, '#d9d9d6', { rep: 0, top: W }); b.box(-0.04, 0.07, 0.125, 0.04, 0.095, 0.141, W, glass, { rep: 0 }); b.box(-0.05, 0.03, -0.17, 0.05, 0.12, 0.05, W, '#e8e6df', { rep: 0, top: W }); wheels(b, 0.34, 0.1); lights(b, 0.28, 0.09, 0.04); });
    G.bus = mk((b) => { body(b, 0.34, 0.1, 0.1, 0.025, '#ffffff'); b.box(-0.051, 0.07, -0.15, 0.051, 0.1, 0.15, BW, '#ffffff', { rep: 0.06 }); wheels(b, 0.34, 0.1, 0.018); b.box(-0.03, 0.125, -0.1, 0.03, 0.132, 0.1, W, '#e8e8e8', { rep: 0, top: W }); lights(b, 0.34, 0.1, 0.04); });
    G.police = mk((b) => { body(b, 0.2, 0.09, 0.034, 0.025, '#f4f4f4'); b.box(-0.0905, 0.03, -0.06, 0.0905, 0.05, 0.06, W, '#1c2b50', { rep: 0 }); b.box(-0.04, 0.059, -0.055, 0.04, 0.085, 0.07, W, glass, { rep: 0, top: W }); b.box(-0.03, 0.085, -0.02, -0.002, 0.098, 0.02, W, '#e53935', { rep: 0, top: W }); b.box(0.002, 0.085, -0.02, 0.03, 0.098, 0.02, W, '#2a62e8', { rep: 0, top: W }); wheels(b, 0.2, 0.09); });
    G.fire = mk((b) => { body(b, 0.34, 0.1, 0.08, 0.03, '#d3302a'); b.box(-0.04, 0.11, -0.13, 0.04, 0.125, 0.1, W, '#cfcfcf', { rep: 0, top: W }); b.box(-0.045, 0.08, 0.1, 0.045, 0.1, 0.17, W, glass, { rep: 0, top: W }); b.box(-0.05, 0.03, 0.12, 0.05, 0.11, 0.17, W, '#d3302a', { rep: 0, top: W }); wheels(b, 0.34, 0.1, 0.018); b.box(-0.02, 0.11, 0.1, 0.02, 0.118, 0.14, W, '#ffcf3a', { rep: 0, top: W }); });
    G.ambulance = mk((b) => { body(b, 0.26, 0.1, 0.075, 0.025, '#fbfbfb'); b.box(-0.0505, 0.05, -0.1, 0.0505, 0.06, 0.1, W, '#d33', { rep: 0 }); b.box(-0.045, 0.07, 0.07, 0.045, 0.095, 0.13, W, glass, { rep: 0, top: W }); b.box(-0.02, 0.1, -0.02, 0.02, 0.108, 0.02, W, '#e53935', { rep: 0, top: W }); wheels(b, 0.26, 0.1); });
    G.garbage = mk((b) => { body(b, 0.3, 0.1, 0.08, 0.03, '#3e8f4a'); b.box(-0.045, 0.08, 0.1, 0.045, 0.105, 0.15, W, glass, { rep: 0, top: W }); b.box(-0.052, 0.03, -0.14, 0.052, 0.12, 0.08, W, '#2f7a3a', { rep: 0, top: W }); wheels(b, 0.3, 0.1, 0.018); });
    G.ped = mk((b) => { b.box(-0.011, 0.012, -0.007, 0.011, 0.048, 0.007, W, '#ffffff', { rep: 0, top: W }); b.box(-0.008, 0.048, -0.008, 0.008, 0.064, 0.008, W, '#e6c3a0', { rep: 0, top: W }); b.box(-0.009, 0.0, -0.005, -0.002, 0.014, 0.005, W, '#2b2e38', { rep: 0 }); b.box(0.002, 0.0, -0.005, 0.009, 0.014, 0.005, W, '#2b2e38', { rep: 0 }); });
    G.ship = mk((b) => { b.box(-0.085, 0.0, -0.32, 0.085, 0.085, 0.2, W, '#2f3b52', { rep: 0, top: W }); b.box(-0.05, 0.0, 0.2, 0.05, 0.085, 0.3, W, '#2f3b52', { rep: 0, top: W }); b.box(-0.086, 0.03, -0.32, 0.086, 0.04, 0.2, W, '#c0392b', { rep: 0 }); const cols = ['#c0392b', '#2a6fb5', '#2d9a4a', '#d9a62b', '#e8e4d8']; for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) b.box(-0.075 + c * 0.078, 0.085, -0.22 + r * 0.115, -0.003 + c * 0.078, 0.14, -0.12 + r * 0.115, W, cols[(r * 2 + c) % 5], { rep: 0, top: W }); b.box(-0.07, 0.085, -0.31, 0.07, 0.19, -0.24, W, '#f2f0ea', { rep: 0, top: W }); b.box(-0.071, 0.14, -0.3, 0.071, 0.16, -0.25, W, glass, { rep: 0 }); });
    G.boat = mk((b) => { b.box(-0.035, 0.0, -0.1, 0.035, 0.04, 0.08, W, '#f0ece0', { rep: 0, top: W }); b.box(-0.02, 0.0, 0.08, 0.02, 0.04, 0.13, W, '#f0ece0', { rep: 0, top: W }); b.box(-0.03, 0.04, -0.07, 0.03, 0.085, -0.01, W, '#2a6fb5', { rep: 0, top: W }); b.box(-0.031, 0.055, -0.06, 0.031, 0.07, -0.02, W, glass, { rep: 0 }); b.box(-0.003, 0.085, -0.04, 0.003, 0.15, -0.034, W, '#555', { rep: 0 }); });
    G.plane = mk((b) => {
      b.box(-0.07, -0.06, -0.6, 0.07, 0.07, 0.62, W, '#f4f4f2', { rep: 0, top: W });
      b.box(-0.05, -0.04, 0.62, 0.05, 0.05, 0.72, W, '#2a3646', { rep: 0, top: W });
      b.box(-0.75, -0.01, -0.08, 0.75, 0.015, 0.14, W, '#e8e8e6', { rep: 0, top: W });
      b.box(-0.26, 0.0, -0.6, 0.26, 0.02, -0.48, W, '#e8e8e6', { rep: 0, top: W });
      b.box(-0.012, 0.02, -0.62, 0.012, 0.3, -0.45, W, '#c0392b', { rep: 0, top: W });
      for (const sx of [-0.35, 0.35]) b.box(sx - 0.035, -0.07, -0.02, sx + 0.035, -0.01, 0.16, W, '#b9bec2', { rep: 0, top: W });
      b.box(-0.071, 0.02, -0.5, 0.071, 0.04, 0.55, BW, '#ffffff', { rep: 0.1 });
      b.box(-0.75, 0.0, -0.09, -0.72, 0.02, -0.06, TL, '#ffffff', { rep: 0 }); b.box(0.72, 0.0, -0.09, 0.75, 0.02, -0.06, HL, '#ffffff', { rep: 0 });
    });
    G.train = mk((b) => { b.box(-0.07, 0.025, -0.22, 0.07, 0.15, 0.22, W, '#e8e6df', { rep: 0, top: W }); b.box(-0.0705, 0.07, -0.2, 0.0705, 0.11, 0.2, W, glass, { rep: 0 }); b.box(-0.0705, 0.04, -0.22, 0.0705, 0.06, 0.22, W, '#c0392b', { rep: 0 }); b.box(-0.06, 0.15, -0.2, 0.06, 0.16, 0.2, W, '#666', { rep: 0, top: W }); });
    for (const k of Object.keys(G)) {
      const m = new THREE.InstancedMesh(G[k], mat, MAX[k]);
      m.count = 0; m.castShadow = true; m.receiveShadow = false; m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.setColorAt(0, new THREE.Color(1, 1, 1));
      scene.add(m); this.meshes[k] = m;
    }
    this.built = true;
  }

  // ------------------------------------------------------------ pathfinding
  roadOK(i) { const t = this.w.road[i]; return t >= 1 && t <= 5; }

  astar(s, g, maxExp = 6000, ignoreLoad = false, truck = false) {
    const w = this.w, n = this.n;
    if (s < 0 || g < 0 || !this.roadOK(s) || !this.roadOK(g)) return null;
    if (s === g) return [s];
    const stamp = ++this.cur;
    const gs = this.gs, came = this.came, st = this.stamp;
    const heap = new Heap();
    gs[s] = 0; st[s] = stamp; came[s] = -1;
    const gx = g % n, gz = (g / n) | 0;
    heap.push(0, s);
    const closed = new Set();
    let exp = 0;
    while (heap.size && exp++ < maxExp) {
      const cur = heap.pop();
      if (cur === g) {
        const path = [];
        for (let c = g; c !== -1; c = came[c]) path.push(c);
        path.reverse();
        return path;
      }
      if (closed.has(cur)) continue;
      closed.add(cur);
      const x = cur % n, z = (cur / n) | 0;
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d], nz = z + DZ[d];
        if (nx < 0 || nz < 0 || nx >= n || nz >= n) continue;
        const ni = nz * n + nx;
        const t = w.road[ni];
        if (t < 1 || t > 5) continue;
        // one-way streets: never enter or leave a tile against its arrow
        const back = (d + 2) & 3;
        if ((w.rdir[ni] && w.rdir[ni] - 1 === back) || (w.rdir[cur] && w.rdir[cur] - 1 === back)) continue;
        let cost = 1 / ROADS[t].speed + (ignoreLoad ? 0 : this.map[ni] * 1.4);
        if (truck && w.dist[ni] && this.sim && this.sim.dVal(ni, 'trucks')) cost += 6;
        const ng = gs[cur] + cost;
        if (st[ni] !== stamp || ng < gs[ni]) {
          st[ni] = stamp; gs[ni] = ng; came[ni] = cur;
          heap.push(ng + (Math.abs(nx - gx) + Math.abs(nz - gz)) * 0.4, ni);
        }
      }
    }
    return null;
  }

  // ------------------------------------------------------------ lists
  refreshLists(sim) {
    const w = this.w;
    if (this.listsRev === w.rev && this.listsDay === sim.S.totalDays) return;
    this.listsRev = w.rev; this.listsDay = sim.S.totalDays;
    this.sim = sim;
    const homes = [], jobs = [], shops = [], factories = [], parks = [];
    for (const b of w.buildings.values()) {
      if (b.state !== 'ok' || b.noBid) continue;
      if (sim.accessOf(b) < 0) continue;
      if (b.kind === 'zone') {
        if ((b.arch === 'house' || b.arch === 'apt' || b.arch === 'row' || b.arch === 'mixed') && b.occ > 0) homes.push(b);
        if (b.arch === 'shop' || b.arch === 'office' || b.arch === 'store' || b.arch === 'mixed') { jobs.push(b); if (b.arch !== 'office') shops.push(b); }
        else if (b.arch === 'factory' || b.arch === 'agri' || b.arch === 'forest' || b.arch === 'ore' || b.arch === 'oil') { jobs.push(b); factories.push(b); }
      } else if (b.def) {
        if (b.def.jobs > 4) jobs.push(b);
        if (b.def.tourism || b.def.happy) parks.push(b);
      }
    }
    this.homes = homes; this.jobs = jobs; this.shops = shops; this.factories = factories; this.parks = parks;
  }

  // ------------------------------------------------------------ spawn
  addVehicle(type, path, o = {}) {
    if (!path || path.length < 1) return null;
    const m = this.meshes[type];
    const used = this.vehicles.filter((v) => v.type === type).length;
    if (used >= MAX[type] - 1) return null;
    const v = Object.assign({ type, path, k: 0, t: 0, speed: 1.6, off: 1, yaw: 0, x: 0, y: 0, z: 0, color: null, life: 0 }, o);
    v.color = v.color || new THREE.Color().setHSL(this.rng(), 0.45 + this.rng() * 0.35, 0.35 + this.rng() * 0.3);
    v.off = (v.off || 1);
    this.vehicles.push(v);
    return v;
  }

  spawnTrip(sim) {
    const S = sim.S;
    if (!this.homes.length || !this.jobs.length) return false;
    let home = this.homes[(this.rng() * this.homes.length) | 0];
    const r = this.rng();
    let dest, type = 'car';
    let purpose = 'work';
    if (r < 0.55) dest = this.jobs[(this.rng() * this.jobs.length) | 0];
    else if (r < 0.85 && this.shops.length) { dest = this.shops[(this.rng() * this.shops.length) | 0]; purpose = 'shop'; }
    else if (r < 0.93 && this.parks.length) { dest = this.parks[(this.rng() * this.parks.length) | 0]; purpose = 'leisure'; }
    else if (this.factories.length && this.shops.length) { const f = this.factories[(this.rng() * this.factories.length) | 0]; dest = this.shops[(this.rng() * this.shops.length) | 0]; type = this.rng() < 0.5 ? 'truck' : 'van'; return this.spawnBetween(sim, f, dest, type, 'freight'); }
    else dest = this.jobs[(this.rng() * this.jobs.length) | 0];
    if (!dest || dest === home) return false;
    if (S.tod > 15.5 && S.tod < 20 && purpose === 'work') { const t = home; home = dest; dest = t; purpose = 'home'; }
    // transit reduces cars near stops
    const nx = home.x + (home.w >> 1), nz = home.z + (home.d >> 1);
    const tr = sim.maps.transit[nz * this.n + nx];
    if (this.rng() < tr * 0.4 + (sim.law.cars ? -sim.law.cars : 0)) return false;
    return this.spawnBetween(sim, home, dest, type, purpose);
  }
  spawnBetween(sim, a, b, type, purpose = 'work') {
    const sa = sim.accessOf(a), sb = sim.accessOf(b);
    const path = this.astar(sa, sb, 5000, false, type === 'truck');
    if (!path || path.length < 3 || path.length > 160) return false;
    const speedMul = type === 'truck' ? 0.9 : 1;
    this.addVehicle(type, path, { speed: (1.5 + this.rng() * 0.6) * speedMul, off: 1, from: a.id, to: b.id, purpose });
    return true;
  }

  dispatchEmergency(kind, target) {
    const sim = this.G.sim;
    if (!sim || this.vehicles.length > 1500) return;
    const cov = kind === 'fire' ? 'fire' : kind === 'police' ? 'police' : 'health';
    let best = null, bd = 1e9;
    for (const b of this.w.buildings.values()) {
      if (b.state !== 'ok' || !b.def || b.def.cov !== cov) continue;
      const d = Math.abs(b.x - target.x) + Math.abs(b.z - target.z);
      if (d < bd) { bd = d; best = b; }
    }
    if (!best) return;
    const s = sim.accessOf(best), g = sim.accessOf(target);
    const path = this.astar(s, g, 8000, true);
    if (!path || path.length < 2) return;
    const type = kind === 'fire' ? 'fire' : kind === 'police' ? 'police' : 'ambulance';
    this.addVehicle(type, path, { speed: 3.2, em: true, state: 'go', wait: 2.8, home: path.slice().reverse(), color: new THREE.Color(1, 1, 1) });
  }

  // ------------------------------------------------------------ rails
  refreshRails(sim) {
    const w = this.w;
    if (this.railRev === w.rev) return;
    this.railRev = w.rev;
    this.trains = [];
    const stations = [];
    for (const b of w.buildings.values()) if (b.key === 'train_station' && b.state === 'ok') stations.push(b);
    if (stations.length < 2) return;
    const n = this.n;
    const railAdj = (b) => {
      for (let j = -1; j <= b.d; j++) for (let i = -1; i <= b.w; i++) {
        if ((i >= 0 && i < b.w) && (j >= 0 && j < b.d)) continue;
        if ((i < 0 || i >= b.w) && (j < 0 || j >= b.d)) continue;
        const x = b.x + i, z = b.z + j;
        if (w.inb(x, z) && w.road[z * n + x] === R.RAIL) return z * n + x;
      }
      return -1;
    };
    const rails = stations.map(railAdj);
    const used = new Set();
    for (let a = 0; a < stations.length; a++) for (let c = a + 1; c < stations.length; c++) {
      if (rails[a] < 0 || rails[c] < 0 || this.trains.length >= 4) continue;
      const path = this.railPath(rails[a], rails[c]);
      if (path && path.length > 3) this.trains.push({ path, pos: 0, dir: 1, speed: 2.3, wait: 0, cars: 4 });
    }
  }
  railPath(s, g) {
    const w = this.w, n = this.n;
    const prev = new Map(); prev.set(s, -1);
    const q = [s]; let h = 0;
    while (h < q.length) {
      const c = q[h++];
      if (c === g) { const path = []; for (let k = g; k !== -1; k = prev.get(k)) path.push(k); return path.reverse(); }
      const x = c % n, z = (c / n) | 0;
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d], nz = z + DZ[d];
        if (!w.inb(nx, nz)) continue;
        const ni = nz * n + nx;
        if (w.road[ni] !== R.RAIL || prev.has(ni)) continue;
        prev.set(ni, c); q.push(ni);
      }
    }
    return null;
  }

  // ------------------------------------------------------------ update
  update(dt, sim) {
    const S = sim.S, w = this.w, n = this.n;
    if (!this.built) return;
    const speedK = S.speed === 0 ? 0 : S.speed === 1 ? 1 : S.speed === 2 ? 2 : 3.5;
    const sdt = dt * speedK;
    this.wK = S.weatherOn === false ? 1 : weatherFx(S).traffic;
    this.refreshLists(sim);
    this.refreshRails(sim);
    // spawn
    const hour = S.tod;
    const rush = hour >= 6.5 && hour < 9.5 ? 1 : hour >= 16 && hour < 19 ? 1 : hour >= 9.5 && hour < 16 ? 0.7 : hour >= 19 && hour < 23 ? 0.45 : 0.15;
    const target = Math.min(MAX.car - 40, S.pop / 48 * rush * (1 - Math.max(0, -(sim.law.cars || 0))));
    let carCount = 0;
    for (const v of this.vehicles) if (v.type === 'car') carCount++;
    if (speedK > 0) {
      this.spawnAcc += dt * 14;
      let tries = 0;
      while (this.spawnAcc >= 1 && carCount < target && tries++ < 4) { this.spawnAcc -= 1; if (this.spawnTrip(sim)) carCount++; }
      if (this.spawnAcc > 3) this.spawnAcc = 0;
      // pedestrians
      const hourK = hour >= 7 && hour < 21 ? 1 : 0.12;
      const pedTarget = Math.min(MAX.ped - 20, S.pop / 75) * hourK;
      let pc = 0, shipN = 0, boatN = 0;
      for (const v of this.vehicles) { if (v.ped) pc++; else if (v.type === 'ship') shipN++; else if (v.type === 'boat') boatN++; }
      this.pedAcc = (this.pedAcc || 0) + dt * 6;
      let pt = 0;
      while (this.pedAcc >= 1 && pc < pedTarget && pt++ < 3) { this.pedAcc -= 1; if (this.spawnPed(sim)) pc++; }
      if (this.pedAcc > 3) this.pedAcc = 0;
      // ships and boats
      this.shipAcc = (this.shipAcc || 0) + sdt;
      if (this.shipAcc > 6) { this.shipAcc = 0; this.spawnShips(sim, shipN, boatN); }
      // service vehicles
      this.garbageAcc += sdt;
      if (this.garbageAcc > 9) { this.garbageAcc = 0; this.spawnGarbage(sim); }
      this.svcAcc = (this.svcAcc || 0) + sdt;
      if (this.svcAcc > 11) { this.svcAcc = 0; this.spawnService(sim, 'death', '#1c1c1e'); this.spawnService(sim, 'post', '#c0392b'); }
      this.maintainLines(sim);
      this.updatePlanes(sim, sdt);
    }
    // counts for load
    this.cnt.fill(0);
    for (const v of this.vehicles) { if (v.em || v.ped || v.water) continue; this.cnt[v.path[Math.min(v.k, v.path.length - 1)]]++; }
    // move
    for (let vi = this.vehicles.length - 1; vi >= 0; vi--) {
      const v = this.vehicles[vi];
      const p = v.path;
      let cur = p[Math.min(v.k, p.length - 1)];
      let sp;
      if (v.water) { if (!w.water[cur]) { v.gone = true; this.vehicles.splice(vi, 1); continue; } sp = v.speed * 0.6; }
      else {
        if (!this.roadOK(cur)) { v.gone = true; this.vehicles.splice(vi, 1); continue; }
        const rt = w.road[cur];
        if (v.ped) sp = v.speed;
        else {
          sp = v.speed * ROADS[rt].speed * 0.62 * this.wK;
          if (!v.em) {
            const load = this.cnt[cur] * FLOW_W / (ROADS[rt].cap * (w.rdir[cur] ? 1.6 : 1));
            sp *= clamp(1.2 - load * 0.95, 0.12, 1);
          }
        }
      }
      if (v.state === 'wait') { v.wait -= sdt; if (v.wait <= 0) { v.state = 'return'; v.path = v.home; v.k = 0; v.t = 0; } this.place(v); continue; }
      if (v.dwell > 0) { v.dwell -= sdt; this.place(v); continue; }
      v.t += sp * sdt;
      while (v.t >= 1) {
        v.t -= 1; v.k++;
        if (v.stopsAt && v.stopsAt.has(v.k)) { v.dwell = 1.1; v.t = 0; v.pax = Math.max(0, Math.min(60, (v.pax || 0) + ((this.rng() * 14) | 0) - 6)); }
        if (v.k >= p.length - 1) { break; }
      }
      if (v.k >= p.length - 1) {
        if (v.loop) { v.k = 0; v.t = 0; this.place(v); continue; }
        if (v.em && v.state === 'go') { v.state = 'wait'; v.k = p.length - 1; v.t = 0; this.place(v); continue; }
        v.gone = true; this.vehicles.splice(vi, 1); continue;
      }
      this.place(v);
    }
    // trains
    for (const tr of this.trains) {
      if (tr.wait > 0) { tr.wait -= sdt; continue; }
      tr.pos += tr.dir * tr.speed * sdt * 0.7;
      if (tr.pos >= tr.path.length - 1) { tr.pos = tr.path.length - 1; tr.dir = -1; tr.wait = 4; }
      if (tr.pos <= 0) { tr.pos = 0; tr.dir = 1; tr.wait = 4; }
    }
    // smoothed load map
    this.mapAcc += dt;
    if (this.mapAcc > 0.25) {
      this.mapAcc = 0;
      const m = this.map, c = this.cnt;
      for (let i = 0; i < m.length; i++) {
        const t = w.road[i];
        if (t >= 1 && t <= 5) m[i] = lerp(m[i], clamp(c[i] * FLOW_W / (ROADS[t].cap * (w.rdir[i] ? 1.6 : 1)), 0, 2), 0.12);
        else m[i] = 0;
      }
    }
    this.render();
  }

  spawnGarbage(sim) {
    const w = this.w;
    for (const b of w.buildings.values()) {
      if (b.state !== 'ok' || !b.def || b.def.cov !== 'waste' || !b.powered && b.key !== 'landfill') continue;
      if (this.rng() > 0.35 || !this.homes.length) continue;
      const dest = this.homes[(this.rng() * this.homes.length) | 0];
      const path = this.astar(sim.accessOf(b), sim.accessOf(dest), 5000);
      if (path && path.length > 3 && path.length < 120) this.addVehicle('garbage', path, { speed: 1.4, off: 1 });
    }
  }
  /** keep the right number of buses circulating on each bus line */
  maintainLines(sim) {
    const lines = (sim.S.lines || []).filter((l) => l.type === 'bus');
    const w = this.w;
    if (this.linesRev !== w.rev || this.linesSig !== lines.map((l) => l.id + ':' + l.stops.join(',') + ':' + l.vehicles).join('|')) {
      this.linesRev = w.rev;
      this.linesSig = lines.map((l) => l.id + ':' + l.stops.join(',') + ':' + l.vehicles).join('|');
      for (const l of lines) {
        l.route = null;
        if (l.stops.length < 2) continue;
        const route = [l.stops[0]], stopsAt = new Set([0]);
        let ok = true;
        for (let k = 0; k < l.stops.length; k++) {
          const a = l.stops[k], b = l.stops[(k + 1) % l.stops.length];
          const seg = this.astar(a, b, 8000, true);
          if (!seg) { ok = false; break; }
          for (let j = 1; j < seg.length; j++) route.push(seg[j]);
          stopsAt.add(route.length - 1);
        }
        l.routeOk = ok;
        if (ok) { l.route = route; l.stopsAt = stopsAt; }
      }
      // drop buses whose line changed
      this.vehicles = this.vehicles.filter((v) => { const keep = !v.lineId || lines.some((l) => l.id === v.lineId && l.route === v.path); if (!keep) v.gone = true; return keep; });
    }
    if (!sim.hasDepot()) { this.vehicles = this.vehicles.filter((v) => { if (v.lineId) v.gone = true; return !v.lineId; }); return; }
    for (const l of lines) {
      if (!l.route) continue;
      const have = this.vehicles.filter((v) => v.lineId === l.id);
      if (have.length > l.vehicles) { const extra = new Set(have.slice(l.vehicles)); for (const v of extra) v.gone = true; this.vehicles = this.vehicles.filter((v) => !extra.has(v)); }
      else if (have.length < l.vehicles && this.rng() < 0.08) {
        const start = Math.floor((have.length / l.vehicles) * l.route.length);
        const v = this.addVehicle('bus', l.route, { speed: 1.35, off: 1, loop: true, lineId: l.id, stopsAt: l.stopsAt, color: new THREE.Color(l.color), pax: 0 });
        if (v) v.k = Math.min(l.route.length - 2, start);
      }
    }
  }

  /** hearses (deathcare) and mail vans (post) visiting homes */
  spawnService(sim, cov, color) {
    for (const b of this.w.buildings.values()) {
      if (b.state !== 'ok' || !b.def || b.def.cov !== cov || !b.powered) continue;
      if (this.rng() > 0.45 || !this.homes.length) continue;
      const dest = this.homes[(this.rng() * this.homes.length) | 0];
      const path = this.astar(sim.accessOf(b), sim.accessOf(dest), 5000);
      if (path && path.length > 3 && path.length < 120) this.addVehicle('van', path, { speed: 1.3, off: 1, color: new THREE.Color(color), svc: cov === 'death' ? 'hearse' : 'mail', from: b.id, to: dest.id });
    }
  }

  // ------------------------------------------------------------ aircraft
  updatePlanes(sim, sdt) {
    this.planes = this.planes || [];
    let port = null;
    for (const b of this.w.buildings.values()) if (b.key === 'airport' && b.state === 'ok' && b.ginfo && b.ginfo.runwayW) { port = b; break; }
    if (!port) { this.planes.length = 0; return; }
    const [a, c] = port.ginfo.runwayW;
    this.planeAcc = (this.planeAcc || 0) + sdt;
    if (this.planeAcc > 14 && this.planes.length < 3) {
      this.planeAcc = 0;
      const landing = this.rng() < 0.5;
      this.planes.push({ t: 0, landing, a, c, color: new THREE.Color().setHSL(this.rng(), 0.1, 0.92), name: pick(this.rng, ['Skyline Air', 'Fair Winds', 'Coastal Jet', 'Royal Charter', 'Blue Heron']) + ' ' + (((this.rng() * 900) | 0) + 100) });
    }
    for (const p of this.planes) p.t += sdt / 26;
    this.planes = this.planes.filter((p) => p.t < 1);
  }
  planePose(p) {
    const [a, c] = [p.a, p.c];
    const dx = c[0] - a[0], dz = c[2] - a[2], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
    // takeoff: roll along the runway (0..0.35) then climb away; landing is the reverse
    const t = p.landing ? 1 - p.t : p.t;
    let s, y;
    if (t < 0.35) { const k = t / 0.35; s = L * k * k; y = a[1] + 0.12; }
    else { const k = (t - 0.35) / 0.65; s = L + k * 220; y = a[1] + 0.12 + k * k * 45 + k * 4; }
    const yaw = Math.atan2(ux, uz) + (p.landing ? 0 : 0);
    const pitch = t < 0.35 ? 0 : -0.18;
    return { x: a[0] + ux * s, y, z: a[2] + uz * s, yaw, pitch };
  }

  // ------------------------------------------------------------ picking citizens & vehicles
  pickVehicle(cx, cy, view) {
    const cam = view.camera, rect = view.canvas.getBoundingClientRect();
    const v3 = new THREE.Vector3();
    let best = null, bd = 16;
    for (const v of this.vehicles) {
      if (v.water && !v.lineId && v.type !== 'ship' && v.type !== 'boat') continue;
      v3.set(v.x, v.y + 0.04, v.z).project(cam);
      if (v3.z > 1) continue;
      const sx = rect.left + (v3.x * 0.5 + 0.5) * rect.width, sy = rect.top + (-v3.y * 0.5 + 0.5) * rect.height;
      const d = Math.hypot(sx - cx, sy - cy);
      if (d < bd) { bd = d; best = v; }
    }
    if (best && !best.cim) this.describe(best);
    return best;
  }
  describe(v) {
    const sim = this.G.sim, w = this.w;
    const nm = (id) => { const b = id && w.buildings.get(id); return b ? (this.G.ui ? this.G.ui.buildingName(b) : b.key || b.arch) : 'somewhere'; };
    const age = 18 + ((this.rng() * 60) | 0);
    if (v.ped) v.cim = { icon: '🚶', title: cimName(this.rng), sub: `${age} years old · pedestrian`, lines: [['Doing', pick(this.rng, ['Walking the dog 🐕', 'Window shopping', 'Heading to a café ☕', 'Out for a stroll', 'Jogging 🏃'])], ['Mood', pick(this.rng, ['😄 Cheerful', '🙂 Content', '😐 Fine', '😴 Tired'])]] };
    else if (v.lineId) { const l = (sim.S.lines || []).find((x) => x.id === v.lineId); v.cim = { icon: '🚌', title: l ? l.name : 'Bus', sub: `Driver: ${cimName(this.rng)}`, lines: [['Passengers', () => String(v.pax || 0)], ['Line riders', () => (l ? l.riders : 0) + '/month'], ['Stops', l ? String(l.stops.length) : '-']] }; }
    else if (v.svc) v.cim = { icon: v.svc === 'hearse' ? '⚱️' : '📮', title: v.svc === 'hearse' ? 'Hearse' : 'Mail van', sub: `Driver: ${cimName(this.rng)}`, lines: [['From', nm(v.from)], ['To', nm(v.to)]] };
    else if (v.em) v.cim = { icon: { fire: '🚒', police: '🚓', ambulance: '🚑', ship: '🚢', boat: '⛵' }[v.type] || '🚨', title: { fire: 'Fire engine', police: 'Police car', ambulance: 'Ambulance', ship: 'Cargo ship', boat: 'Fishing boat' }[v.type] || v.type, sub: v.type === 'ship' || v.type === 'boat' ? 'Crew of ' + (3 + ((this.rng() * 20) | 0)) : `Responding to an emergency`, lines: [] };
    else if (v.type === 'garbage') v.cim = { icon: '🚛', title: 'Garbage truck', sub: `Driver: ${cimName(this.rng)}`, lines: [['Load', ((this.rng() * 90) | 0) + '%']] };
    else v.cim = { icon: v.type === 'truck' ? '🚚' : v.type === 'van' ? '🚐' : '🚗', title: cimName(this.rng), sub: `${age} years old · ${pick(this.rng, ['teacher', 'nurse', 'baker', 'engineer', 'clerk', 'student', 'retiree', 'mechanic', 'artist', 'banker', 'farmer', 'chef', 'programmer', 'carpenter'])}`, lines: [['Trip', PURPOSE[v.purpose] || PURPOSE.work], ['From', nm(v.from)], ['To', nm(v.to)]] };
  }

  spawnPed(sim) {
    const w = this.w, n = this.n;
    const pool = this.shops.length && this.rng() < 0.5 ? this.shops : this.homes;
    if (!pool.length) return false;
    const b = pool[(this.rng() * pool.length) | 0];
    let cur = sim.accessOf(b);
    if (cur < 0 || !this.roadOK(cur) || w.road[cur] === R.HIGHWAY) return false;
    const path = [cur]; let prev = -1;
    const len = 6 + ((this.rng() * 10) | 0);
    for (let k = 0; k < len; k++) {
      const x = cur % n, z = (cur / n) | 0;
      const opts = [];
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d], nz = z + DZ[d];
        if (!w.inb(nx, nz)) continue;
        const ni = nz * n + nx, t = w.road[ni];
        if (t >= 1 && t <= 4 && ni !== prev) opts.push(ni);
      }
      if (!opts.length) break;
      const nx = opts[(this.rng() * opts.length) | 0];
      prev = cur; cur = nx; path.push(cur);
    }
    if (path.length < 3) return false;
    const col = new THREE.Color().setHSL(this.rng(), 0.4 + this.rng() * 0.4, 0.3 + this.rng() * 0.35);
    this.addVehicle('ped', path, { ped: true, speed: 0.26 + this.rng() * 0.14, side: this.rng() < 0.5 ? -1 : 1, color: col });
    return true;
  }

  waterRoute(start, minDist, toBorder) {
    const w = this.w, n = this.n;
    const prev = new Map([[start, -1]]), dist = new Map([[start, 0]]);
    const q = [start]; let h = 0;
    const order = [0, 1, 2, 3];
    while (h < q.length) {
      const c = q[h++];
      const d = dist.get(c), x = c % n, z = (c / n) | 0;
      if (d >= minDist && (!toBorder || x === 0 || z === 0 || x === n - 1 || z === n - 1)) {
        const path = []; for (let k = c; k !== -1; k = prev.get(k)) path.push(k);
        return path.reverse();
      }
      order.sort(() => this.rng() - 0.5);
      for (const dd of order) {
        const nx = x + DX[dd], nz = z + DZ[dd];
        if (!w.inb(nx, nz)) continue;
        const ni = nz * n + nx;
        if (prev.has(ni) || !w.water[ni] || w.tileAvg(nx, nz) > -0.2) continue;
        prev.set(ni, c); dist.set(ni, d + 1); q.push(ni);
      }
    }
    return null;
  }

  waterTileNear(b) {
    const w = this.w, n = this.n;
    for (let j = -2; j <= b.d + 1; j++) for (let i = -2; i <= b.w + 1; i++) {
      const x = b.x + i, z = b.z + j;
      if (w.inb(x, z) && w.water[z * n + x] && w.tileAvg(x, z) < -0.25) return z * n + x;
    }
    return -1;
  }

  spawnShips(sim, shipN, boatN) {
    const w = this.w;
    for (const b of w.buildings.values()) {
      if (b.state !== 'ok' || (b.key !== 'port' && b.key !== 'fishing')) continue;
      if (this.rng() > 0.55) continue;
      const wt = this.waterTileNear(b);
      if (wt < 0) continue;
      if (b.key === 'port' && shipN < 4) {
        const path = this.waterRoute(wt, 18, true);
        if (path && path.length > 6) this.addVehicle('ship', path.reverse(), { water: true, em: true, state: 'go', wait: 9, home: path.slice().reverse(), speed: 1.0, color: new THREE.Color(1, 1, 1) });
      } else if (b.key === 'fishing' && boatN < 5) {
        const path = this.waterRoute(wt, 7 + ((this.rng() * 6) | 0), false);
        if (path && path.length > 4) this.addVehicle('boat', path.slice().reverse(), { water: true, em: true, state: 'go', wait: 5, home: path, speed: 1.1, color: new THREE.Color(1, 1, 1) });
      }
    }
  }

  place(v) {
    const w = this.w, n = this.n, p = v.path;
    const k = Math.min(v.k, p.length - 1);
    const cur = p[k], prev = k > 0 ? p[k - 1] : cur, next = k < p.length - 1 ? p[k + 1] : cur;
    const cx = (cur % n) + 0.5, cz = ((cur / n) | 0) + 0.5;
    const mid = (a, b) => [((a % n) + (b % n)) / 2 + 0.5, (((a / n) | 0) + ((b / n) | 0)) / 2 + 0.5];
    const E = prev === cur ? [cx, cz] : mid(prev, cur), X = next === cur ? [cx, cz] : mid(cur, next);
    const t = clamp(v.t, 0, 1), u = 1 - t;
    const x = u * u * E[0] + 2 * u * t * cx + t * t * X[0], z = u * u * E[1] + 2 * u * t * cz + t * t * X[1];
    let dx = 2 * u * (cx - E[0]) + 2 * t * (X[0] - cx), dz = 2 * u * (cz - E[1]) + 2 * t * (X[1] - cz);
    const l = Math.hypot(dx, dz);
    if (l > 1e-4) { dx /= l; dz /= l; v.dx = dx; v.dz = dz; } else { dx = v.dx || 0; dz = v.dz || 1; }
    const rt = w.road[cur];
    let off;
    if (v.water) off = 0;
    else if (v.ped) off = Math.min(0.45, (rt ? ROADS[rt].width : 0.6) * 0.5 + 0.07) * v.side;
    else off = rt ? ROADS[rt].width * 0.2 : 0.15;
    v.x = x + (-dz) * off; v.z = z + dx * off;
    if (v.water) { const tm = (this.G.view ? this.G.view.time : 0); v.y = 0.015 + Math.sin(tm * 1.6 + v.path[0]) * 0.012; }
    else v.y = w.roadY(v.x, v.z) + 0.005;
    const target = Math.atan2(dx, dz);
    let dy = target - v.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
    v.yaw += dy * 0.35;
  }

  render() {
    const counts = {};
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), p3 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (const k in this.meshes) counts[k] = 0;
    const night = this.G.view ? this.G.view.nightK : 0;
    for (const v of this.vehicles) {
      const im = this.meshes[v.type];
      const c = counts[v.type]++;
      if (c >= MAX[v.type]) continue;
      q.setFromAxisAngle(up, v.yaw);
      p.set(v.x, v.y, v.z);
      m4.compose(p, q, s);
      im.setMatrixAt(c, m4);
      im.setColorAt(c, v.color);
    }
    // trains
    const tm = this.meshes.train;
    let tc = 0;
    const w = this.w, n = this.n;
    for (const tr of this.trains) {
      for (let c = 0; c < tr.cars; c++) {
        const pos = clamp(tr.pos - tr.dir * c * 0.5, 0, tr.path.length - 1.001);
        const i = Math.floor(pos), f = pos - i;
        const a = tr.path[i], b = tr.path[Math.min(i + 1, tr.path.length - 1)];
        const ax = (a % n) + 0.5, az = ((a / n) | 0) + 0.5, bx = (b % n) + 0.5, bz = ((b / n) | 0) + 0.5;
        const x = lerp(ax, bx, f), z = lerp(az, bz, f);
        const yaw = Math.atan2(bx - ax, bz - az);
        q.setFromAxisAngle(up, yaw); p.set(x, w.roadY(x, z) + 0.02, z);
        m4.compose(p, q, s); tm.setMatrixAt(tc, m4); tm.setColorAt(tc, new THREE.Color(1, 1, 1)); tc++;
      }
    }
    counts.train = tc;
    let pc = 0;
    const pm = this.meshes.plane;
    for (const p of this.planes || []) {
      const ps = this.planePose(p);
      const qy = new THREE.Quaternion().setFromAxisAngle(up, ps.yaw), qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), ps.pitch);
      q.copy(qy).multiply(qx); p3.set(ps.x, ps.y, ps.z);
      m4.compose(p3, q, s); pm.setMatrixAt(pc, m4); pm.setColorAt(pc, p.color); pc++;
    }
    counts.plane = pc;
    for (const k in this.meshes) {
      const im = this.meshes[k];
      im.count = Math.min(counts[k], MAX[k]);
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
  }

  reset() { for (const v of this.vehicles) v.gone = true; this.vehicles = []; this.trains = []; this.planes = []; this.map.fill(0); this.cnt.fill(0); this.listsRev = -1; this.railRev = -1; this.linesRev = -1; this.linesSig = ''; }
}
