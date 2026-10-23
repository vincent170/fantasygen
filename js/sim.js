// City simulation: growth, economy, utilities, services, happiness, laws, industries, events.
import { clamp, lerp, smoothstep, hash2, mulberry32, pick } from './util.js';
import { MAP_N, POP_CAP, Z, ZONE_INFO, LOTS, LOT_TYPES, ARCH_INFO, R, ROADS, BUILDINGS, INDUSTRIES, INDUSTRY_POLICIES, LAWS, MILESTONES, STYLES, isBuildZone, RES_ARCH, COM_ARCH, IND_ARCH, SPECIALIZATIONS, AREA_N } from './data.js';
import { SimExt } from './sim_ext.js';
import { DX, DZ } from './world.js';
import { LOT_KIND } from './ground.js';
import { weatherStep, weatherFx, heatingDemand } from './weather.js';

const DAY_INTERVAL = [Infinity, 2.2, 0.9, 0.38];
const BUDGET_KEYS = ['police', 'fire', 'health', 'edu', 'waste', 'transit', 'parks', 'comms'];
const CAT_BUDGET = { police: 'police', fire: 'fire', health: 'health', education: 'edu', waste: 'waste', transit: 'transit', parks: 'parks', landmarks: 'parks' };
const NO_ROAD_NEEDED = new Set(['pylon', 'wind', 'solar', 'lighthouse', 'monument', 'hydro']);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ZONE_LOT = { house: 'lawn', row: 'lawn', apt: 'pave', mixed: 'pave', shop: 'pave', store: 'pave', office: 'pave', factory: 'dirt', agri: 'farm', forest: 'dirt', ore: 'rock', oil: 'dirt' };

const EVENT_DEFS = [
  { id: 'heat', name: 'Heat wave', icon: '🥵', days: 20, minPop: 300, msg: 'A heat wave: air-conditioning pushes power demand up 25%.', fx: { power: 1.25 } },
  { id: 'drought', name: 'Drought', icon: '🏜️', days: 25, minPop: 300, msg: 'A drought cuts your water supply by 30%.', fx: { water: 0.7 } },
  { id: 'storm', name: 'Storm', icon: '⛈️', days: 4, minPop: 200, msg: 'A storm damages power lines — supply is down 40% for a few days.', fx: { powerSupply: 0.6 } },
  { id: 'festival', name: 'Harvest festival', icon: '🎪', days: 14, minPop: 500, good: true, msg: 'A festival brings tourists and good cheer!', fx: { tourism: 2, happy: 3 } },
  { id: 'epidemic', name: 'Epidemic', icon: '🤒', days: 20, minPop: 1500, needsBad: 'health', msg: 'An epidemic is spreading. Hospitals and clinics matter!', fx: { happy: -8, income: 0.9 } },
  { id: 'boom', name: 'Trade boom', icon: '📈', days: 30, minPop: 800, good: true, msg: 'A trade boom lifts commercial and industrial incomes by 15%.', fx: { income: 1.15 } },
];

export function defaultState(opts = {}) {
  const sandbox = opts.mode === 'sandbox';
  return {
    name: opts.name || 'Fairhaven', mode: sandbox ? 'sandbox' : 'career',
    money: sandbox ? 9999999 : 60000, day: 1, month: 3, year: 1, totalDays: 0, tod: 9.5, speed: 1, dayAcc: 0,
    pop: 0, workforce: 0, jobsTotal: 0, jobsC: 0, jobsI: 0, jobsS: 0, unemployment: 0, resCap: 0,
    demand: { r: 0.6, c: 0.1, i: 0.3, o: 0 }, tax: { r: 9, c: 9, i: 9, o: 9 },
    budget: { police: 100, fire: 100, health: 100, edu: 100, waste: 100, transit: 100, parks: 100, comms: 100 },
    laws: {}, policies: {}, style: 0,
    happy: 60, happyParts: [], health: 50, edu: 0, crime: 0, pollution: 0, noise: 0, traffic: 0, tourism: 0,
    power: { supply: 0, demand: 0 }, water: { supply: 0, demand: 0 }, sewage: { cap: 0, demand: 0 },
    waste: { cap: 0, prod: 0, backlog: 0 },
    fin: { income: {}, expense: {}, net: 0, inc: 0, exp: 0 },
    hist: [], log: [], milestone: 0, popPeak: 0, loan: 0, enforcement: 0.3, prisoners: 0, capReached: false,
    stats: { fires: 0, crimes: 0, solved: 0, births: 0 }, outside: false, seed: opts.seed || 1,
    unlocked: {}, advisorCool: {}, trips: 0, disasters: true, events: [],
    climate: opts.climate || 'temperate', weatherOn: true, weather: { type: 'clear', days: 3, snowCover: 0, temp: 12 },
    jobsO: 0, districts: [], lines: [], chirps: [], fees: { power: 100, water: 100 }, permits: sandbox ? 99 : 0, death: { backlog: 0, rate: 0, cap: 0 }, activeDisasters: [],
    transitRiders: 0, transitFares: 0, version: 2,
  };
}

export class Sim {
  constructor(G) {
    this.G = G;
    this.w = G.world;
    const N = this.w.n * this.w.n;
    this.maps = {
      police: new Float32Array(N), fire: new Float32Array(N), health: new Float32Array(N), edu: new Float32Array(N), waste: new Float32Array(N), transit: new Float32Array(N),
      death: new Float32Array(N), post: new Float32Array(N), tele: new Float32Array(N), shelter: new Float32Array(N), dru: new Float32Array(N),
      pollution: new Float32Array(N), noise: new Float32Array(N), crime: new Float32Array(N), landvalue: new Float32Array(N), happy: new Float32Array(N), park: new Float32Array(N),
    };
    this.pw = new Uint8Array(N); this.wt = new Uint8Array(N); this.sw = new Uint8Array(N);
    this.waterNear = new Float32Array(N); this.waterVer = -1;
    this.S = defaultState();
    this.law = {};
    this.cands = []; this.candRev = -1; this.candCount = 0;
    this.mapsDirty = true; this.mapsTimer = 0;
    this.accum = 0;
    this.rng = mulberry32(1234);
    this.pending = [];
  }

  reset(opts = {}) {
    this.S = defaultState(opts);
    this.w.buildings.clear(); this.w.bid.fill(0); this.w.lot.fill(0);
    this.w.nextId = 1; this.w.stops = new Map();
    this.rng = mulberry32((opts.seed || 1) * 7 + 3);
    // map areas: the four central areas are yours to start with (all of them in sandbox)
    const a = this.w.areas;
    a.fill(this.S.mode === 'sandbox' ? 1 : 0);
    for (const k of [5, 6, 9, 10]) a[k] = 1;
    this.w.dist.fill(0);
    this.dfx = {};
    this.mapsDirty = true; this.law = {}; this.recomputeLaws();
    this.log('Welcome to ' + this.S.name + '! Start by laying a road, then zone the land beside it.', 'info');
    this.log('Tip: power & water travel along roads. Build a power plant and a water pump, then connect them with roads.', 'tip');
    this.log('Tip: a highway enters your land from the map edge — connect your first road to it so people can move in.', 'tip');
    this.computeNetworks(); this.updateMaps(true);
  }

  // ------------------------------------------------------------ helpers
  log(msg, type = 'info') {
    const S = this.S;
    S.log.unshift({ t: S.totalDays, msg, type, date: this.dateStr() });
    if (S.log.length > 60) S.log.pop();
    if (this.G.ui && this.G.ui.onLog) this.G.ui.onLog(S.log[0]);
  }
  dateStr() { const S = this.S; return `${MONTHS[S.month]} ${S.day}, Year ${S.year}`; }
  sandbox() { return this.S.mode === 'sandbox'; }
  isUnlocked(def) { return this.sandbox() || (def.unlock || 0) <= this.S.popPeak; }
  canAfford(c) { return this.sandbox() || this.S.money >= c; }
  spend(c) { if (!this.sandbox()) this.S.money -= c; }
  budgetScale(cat) { const k = CAT_BUDGET[cat] || (BUDGET_KEYS.includes(cat) ? cat : null); return k ? (this.S.budget[k] || 100) / 100 : 1; }
  budgetOf(def) { const k = this.budgetKeyOf(def); return k ? (this.S.budget[k] || 100) / 100 : 1; }
  defOf(b) { return b.kind === 'zone' ? null : BUILDINGS[b.key]; }
  blist() { return this.w.buildings.values(); }
  touchWorld() { this.w.rev++; this.mapsDirty = true; }

  // ------------------------------------------------------------ roads
  roadCost(x, z, type) {
    const w = this.w;
    const cur = w.road[z * w.n + x];
    if (cur === type) return 0;
    const base = ROADS[type].cost * (w.water[z * w.n + x] ? 4 : 1);
    return cur ? Math.max(0, base - ROADS[cur].cost * 0.5) : base;
  }
  canRoad(x, z, type) {
    const w = this.w;
    if (!w.inb(x, z)) return false;
    const i = z * w.n + x;
    if (w.bid[i] || w.pylon[i]) return false;
    if (!this.ownsTile(x, z)) return false;
    const cur = w.road[i];
    if (cur && (cur === R.RAIL) !== (type === R.RAIL)) return false;
    if (type === R.RAIL && w.water[i]) { /* rail bridges allowed */ }
    if (!w.water[i] && w.tileSlope(x, z) > 1.6) return false;
    return true;
  }
  /** returns true if placed */
  placeRoad(x, z, type) {
    const w = this.w;
    if (!this.canRoad(x, z, type)) return false;
    const i = z * w.n + x;
    const cost = this.roadCost(x, z, type);
    if (!this.canAfford(cost)) return false;
    this.spend(cost);
    w.road[i] = type; w.tree[i] = 0; w.park[i] = 0; w.zone[i] = 0;
    if (type === R.RAIL || type === R.HIGHWAY || type === R.LANE) w.rdir[i] = 0;
    w.dirty.roads = true; w.dirty.trees = true;
    w.markGround(x - 1, z - 1, x + 1, z + 1);
    this.touchWorld();
    return true;
  }
  removeRoad(x, z) {
    const w = this.w, i = z * w.n + x;
    if (!w.road[i]) return false;
    w.road[i] = 0; w.rdir[i] = 0;
    // remove bus stop on this tile
    if (w.stops && w.stops.has(i)) this.removeBuilding(w.stops.get(i));
    w.dirty.roads = true;
    w.markGround(x - 1, z - 1, x + 1, z + 1);
    this.touchWorld();
    return true;
  }
  placePylon(x, z) {
    const w = this.w;
    if (!w.inb(x, z)) return false;
    const i = z * w.n + x;
    if (w.pylon[i] || w.road[i] || w.bid[i] || w.water[i] || !this.ownsTile(x, z)) return false;
    const c = BUILDINGS.pylon.cost;
    if (!this.canAfford(c)) return false;
    this.spend(c);
    w.pylon[i] = 1; w.tree[i] = 0; w.dirty.roads = true; w.dirty.trees = true;
    this.touchWorld();
    return true;
  }
  removePylon(x, z) {
    const w = this.w, i = z * w.n + x;
    if (!w.pylon[i]) return false;
    w.pylon[i] = 0; w.dirty.roads = true; this.touchWorld();
    return true;
  }

  // ------------------------------------------------------------ zoning
  paintZone(x, z, zone, style) {
    const w = this.w;
    if (!w.inb(x, z)) return false;
    const i = z * w.n + x;
    if (w.road[i] || w.bid[i] || w.water[i] || w.pylon[i]) return false;
    if (zone && (!w.buildable(x, z) || !this.ownsTile(x, z))) return false;
    if (zone === Z.PARK) return this.paintPark(x, z);
    if (w.zone[i] === zone && w.zstyle[i] === style) return false;
    if (zone && !w.zone[i]) { const c = 2; if (!this.canAfford(c)) return false; this.spend(c); }
    w.zone[i] = zone; w.zstyle[i] = style;
    if (zone) { w.tree[i] = zone ? 0 : w.tree[i]; w.park[i] = 0; w.dirty.trees = true; }
    w.markGround(x, z, x, z);
    this.touchWorld();
    return true;
  }
  paintPark(x, z) {
    const w = this.w, i = z * w.n + x;
    if (w.park[i] || !w.buildable(x, z) || w.road[i] || w.bid[i] || !this.ownsTile(x, z)) return false;
    if (!this.canAfford(4)) return false;
    this.spend(4);
    w.park[i] = 1; w.zone[i] = 0; w.tree[i] = 0; w.dirty.trees = true;
    w.markGround(x, z, x, z);
    this.touchWorld();
    return true;
  }
  clearPark(x, z) {
    const w = this.w, i = z * w.n + x;
    if (!w.park[i]) return false;
    w.park[i] = 0; w.dirty.trees = true; w.markGround(x, z, x, z); this.touchWorld(); return true;
  }

  // ------------------------------------------------------------ building placement
  footprint(def, facing) { return (facing === 1 || facing === 3) ? [def.d, def.w] : [def.w, def.d]; }

  /** validate placing special building `key` with top-left tile (x,z) */
  canPlace(key, x, z, facing = 2) {
    const w = this.w, def = BUILDINGS[key];
    if (!def) return { ok: false, reason: 'Unknown' };
    if (!this.isUnlocked(def)) return { ok: false, reason: `Unlocks at ${def.unlock} population` };
    if (!this.canAfford(def.cost)) return { ok: false, reason: 'Not enough money' };
    if (def.civic !== undefined && key === 'townhall') { for (const b of this.blist()) if (b.key === 'townhall') return { ok: false, reason: 'You already have a Town Hall' }; }
    if (key === 'capitol') { for (const b of this.blist()) if (b.key === 'capitol') return { ok: false, reason: 'Only one Capitol' }; }
    if (key === 'pylon') return { ok: true };
    const [fw, fd] = this.footprint(def, facing);
    if (def.place === 'road') {
      if (!w.inb(x, z)) return { ok: false, reason: 'Out of bounds' };
      if (!this.ownsTile(x, z)) return { ok: false, reason: 'You don\'t own this land' };
      const t = w.road[z * w.n + x];
      if (t < 2 || t > 4 || w.water[z * w.n + x]) return { ok: false, reason: 'Place on a paved street or avenue' };
      if (w.stops && w.stops.has(z * w.n + x)) return { ok: false, reason: 'Already a stop here' };
      return { ok: true };
    }
    let shore = false, adjRail = false, adjRoad = false;
    for (let j = -1; j <= fd; j++) for (let i = -1; i <= fw; i++) {
      const tx = x + i, tz = z + j;
      const inside = i >= 0 && j >= 0 && i < fw && j < fd;
      if (inside) {
        if (!w.inb(tx, tz)) return { ok: false, reason: 'Out of bounds' };
        const idx = tz * w.n + tx;
        if (!this.ownsTile(tx, tz)) return { ok: false, reason: 'You don\'t own this land (buy it under Areas)' };
        if (w.road[idx] || w.bid[idx] || w.pylon[idx]) return { ok: false, reason: 'Tile is occupied' };
        if (w.water[idx]) return { ok: false, reason: 'Cannot build on water' };
        if (!w.buildable(tx, tz)) return { ok: false, reason: 'Terrain too steep or too low' };
      } else if (w.inb(tx, tz)) {
        const idx = tz * w.n + tx;
        if (w.water[idx]) shore = true;
        const corner = (i < 0 && j < 0) || (i >= fw && j < 0) || (i < 0 && j >= fd) || (i >= fw && j >= fd);
        if (!corner && w.road[idx] === R.RAIL) adjRail = true;
        if (!corner && w.road[idx] >= 1 && w.road[idx] <= 5) adjRoad = true;
      }
    }
    if (def.place === 'shore' && !shore) return { ok: false, reason: 'Must be built on the water\'s edge' };
    if (!adjRoad && !NO_ROAD_NEEDED.has(key)) return { ok: false, reason: 'Needs road access — place it next to a road' };
    if (def.place === 'rail' && !adjRail) return { ok: false, reason: 'Must be built beside a railway' };
    if (key === 'port' && !this.deepShoreNear(x, z, fw, fd)) return { ok: false, reason: 'Needs deep water at the shore' };
    if (key === 'lumber' && this.countTiles(x, z, fw, fd, 8, (i) => this.w.tree[i] > 0) < 12) return { ok: false, reason: 'Needs 12+ forest tiles within 8 tiles' };
    if (key === 'quarry') { let c = 0; for (let tz = z - 6; tz < z + fd + 6; tz++) for (let tx = x - 6; tx < x + fw + 6; tx++) if (w.inb(tx, tz) && w.tileAvg(tx, tz) > 2.2) c++; if (c < 8) return { ok: false, reason: 'Needs hills nearby (8+ tiles above 2.2 m)' }; }
    if (key === 'refinery') { let ok = false; for (const b of this.blist()) if (b.key === 'port') ok = true; if (!ok) return { ok: false, reason: 'Needs a Port in the city' }; }
    if (key === 'tech') { let ok = false; for (const b of this.blist()) if (b.key === 'university') ok = true; if (!ok) return { ok: false, reason: 'Needs a University' }; }
    if (key === 'farm') { let low = 0; for (let tz = z; tz < z + fd; tz++) for (let tx = x; tx < x + fw; tx++) if (w.tileAvg(tx, tz) < 0.4) low++; if (low > 4) return { ok: false, reason: 'Needs solid grassland, not beach' }; }
    if (key === 'resort') { let nice = 0; for (let tz = z - 4; tz < z + fd + 4; tz++) for (let tx = x - 4; tx < x + fw + 4; tx++) if (w.inb(tx, tz) && (w.water[tz * w.n + tx] || w.park[tz * w.n + tx])) nice++; if (nice < 6) return { ok: false, reason: 'Needs water or parkland nearby' }; }
    if (key === 'airport') { for (const b of this.blist()) if (b.key === 'airport') return { ok: false, reason: 'Only one airport' }; }
    if (def.cat === 'landmarks' && ['cathedral', 'opera', 'arch', 'observatory', 'capitol'].includes(key)) { for (const b of this.blist()) if (b.key === key) return { ok: false, reason: 'Unique building: already built' }; }
    return { ok: true, adjRoad };
  }
  countTiles(x, z, fw, fd, r, fn) {
    const w = this.w; let c = 0;
    for (let tz = z - r; tz < z + fd + r; tz++) for (let tx = x - r; tx < x + fw + r; tx++) if (w.inb(tx, tz) && fn(tz * w.n + tx)) c++;
    return c;
  }
  deepShoreNear(x, z, fw, fd) {
    const w = this.w;
    for (let tz = z - 4; tz < z + fd + 4; tz++) for (let tx = x - 4; tx < x + fw + 4; tx++) if (w.inb(tx, tz) && w.water[tz * w.n + tx] && w.tileAvg(tx, tz) < -0.55) return true;
    return false;
  }
  bestFacing(x, z, fw, fd, pref = 2) {
    const w = this.w;
    // prefer a side that touches a street
    const sides = [[2, 0, fd, fw, 1], [0, 0, -1, fw, 1], [1, fw, 0, fd, 0], [3, -1, 0, fd, 0]];
    let best = -1, bc = 0;
    for (const [f, ox, oz, len, horiz] of sides) {
      let c = 0;
      for (let k = 0; k < len; k++) {
        const tx = horiz ? x + k : x + ox, tz = horiz ? z + oz : z + k;
        const t = w.roadAt(tx, tz);
        if (t >= 1 && t <= 4) c++;
      }
      if (c > bc || (c === bc && f === pref && c > 0)) { bc = c; best = f; }
    }
    return best >= 0 ? best : pref;
  }

  lotFootprint(lot, facing) { return (facing === 1 || facing === 3) ? [lot.ld, lot.lw] : [lot.lw, lot.ld]; }
  canPlaceLot(lot, x, z, facing) {
    const w = this.w;
    if (!this.isUnlocked(lot)) return { ok: false, reason: `Unlocks at ${lot.unlock} population` };
    if (!this.canAfford(lot.cost)) return { ok: false, reason: 'Not enough money' };
    const [fw, fd] = this.lotFootprint(lot, facing);
    let road = false;
    for (let j = -1; j <= fd; j++) for (let i = -1; i <= fw; i++) {
      const tx = x + i, tz = z + j;
      const inside = i >= 0 && j >= 0 && i < fw && j < fd;
      if (inside) {
        if (!w.inb(tx, tz)) return { ok: false, reason: 'Out of bounds' };
        const idx = tz * w.n + tx;
        if (!this.ownsTile(tx, tz)) return { ok: false, reason: 'You don\'t own this land' };
        if (w.road[idx] || w.bid[idx] || w.pylon[idx]) return { ok: false, reason: 'Tile is occupied' };
        if (w.water[idx]) return { ok: false, reason: 'Cannot build on water' };
        if (!w.buildable(tx, tz)) return { ok: false, reason: 'Terrain too steep or too low' };
      } else if (w.inb(tx, tz) && !(((i < 0 || i >= fw) && (j < 0 || j >= fd))) && w.roadAt(tx, tz) >= 1 && w.roadAt(tx, tz) <= 4) road = true;
    }
    if (!road) return { ok: false, reason: 'Needs road frontage' };
    return { ok: true };
  }
  placeLot(lot, x, z, facing, style) {
    const chk = this.canPlaceLot(lot, x, z, facing);
    if (!chk.ok) return chk;
    this.spend(lot.cost);
    const [fw, fd] = this.lotFootprint(lot, facing);
    const zone = lot.zone || Z.RL;
    const b = this.addBuilding({ kind: 'zone', arch: lot.arch, zone, style: style === 5 ? (this.rng() * 5) | 0 : style, level: lot.level, lw: lot.lw, ld: lot.ld, x, z, w: fw, d: fd, facing, timer: 4 + lot.level });
    this.candRev = -1;
    return { ok: true, b };
  }

  /** create a building record and register it */
  addBuilding(o, opts = {}) {
    const w = this.w;
    const b = Object.assign({
      id: w.nextId++, state: 'construct', timer: 5, age: 0, occ: 0, workers: 0, cap: 0, jobs: 0, powered: false, watered: false, sewered: true,
      level: 1, health: 100, fire: 0, abandon: 0, seed: (this.rng() * 1e9) | 0, rnd: 0, eff: 1, rev: 0, acc: -1,
    }, o);
    b.rnd = hash2(b.id, 99);
    b.def = b.kind === 'zone' ? null : BUILDINGS[b.key];
    if (!b.noBid) {
      w.flattenFootprint(b.x, b.z, b.w, b.d, 0.3);
      b.y0 = w.footprintHeight(b.x, b.z, b.w, b.d);
      const lotName = b.kind === 'zone' ? ZONE_LOT[b.arch] : (b.def.ground || 'pave');
      const lk = LOT_KIND[lotName] || 2;
      for (let j = 0; j < b.d; j++) for (let i = 0; i < b.w; i++) {
        const idx = (b.z + j) * w.n + b.x + i;
        w.bid[idx] = b.id; w.lot[idx] = lk; w.tree[idx] = 0; w.park[idx] = 0;
        if (b.kind !== 'zone') w.zone[idx] = 0;
      }
      w.dirty.trees = true;
      w.markGround(b.x - 1, b.z - 1, b.x + b.w, b.z + b.d);
    } else {
      b.y0 = w.roadY(b.x + 0.5, b.z + 0.5);
      if (!w.stops) w.stops = new Map();
      w.stops.set(b.z * w.n + b.x, b);
    }
    if (opts.instant) { b.state = 'ok'; b.timer = 0; }
    if (b.kind === 'special') b.timer = opts.instant ? 0 : Math.max(2, Math.round(2 + (b.def.cost / 6000)));
    w.buildings.set(b.id, b);
    this.touchWorld();
    if (b.state === 'ok') this.finishBuilding(b, true);
    else if (this.G.view) this.G.view.syncBuilding(b, true);
    return b;
  }

  placeSpecial(key, x, z, facing, style) {
    if (key === 'pylon') return { ok: this.placePylon(x, z) };
    const chk = this.canPlace(key, x, z, facing);
    if (!chk.ok) return { ok: false, reason: chk.reason };
    const def = BUILDINGS[key];
    this.spend(def.cost);
    const [fw, fd] = this.footprint(def, facing);
    const b = this.addBuilding({
      kind: 'special', key, style: def.styled ? (style === 5 ? (this.rng() * 5) | 0 : style) : 0, level: 1,
      lw: def.w, ld: def.d, x, z, w: fw, d: fd, facing, noBid: def.place === 'road',
      free: false,
    });
    this.log(`${def.name} under construction.`, 'build');
    return { ok: true, b };
  }

  removeBuilding(b, opts = {}) {
    const w = this.w;
    if (!w.buildings.has(b.id)) return;
    if (!b.noBid) {
      for (let j = 0; j < b.d; j++) for (let i = 0; i < b.w; i++) {
        const idx = (b.z + j) * w.n + b.x + i;
        if (w.bid[idx] === b.id) { w.bid[idx] = 0; w.lot[idx] = 0; }
      }
      w.markGround(b.x - 1, b.z - 1, b.x + b.w, b.z + b.d);
      w.dirty.trees = true;
    } else if (w.stops) w.stops.delete(b.z * w.n + b.x);
    w.buildings.delete(b.id);
    if (this.G.view) { this.G.view.dust(b, 1); this.G.view.removeBuilding(b); this.G.view.setFire(b, false); }
    this.touchWorld();
  }

  bulldozeBuilding(b) {
    if (b.kind === 'special' && b.def && !this.sandbox()) this.S.money += Math.round(b.def.cost * 0.4);
    this.removeBuilding(b);
  }

  finishBuilding(b, silent) {
    b.state = 'ok'; b.timer = 0;
    this.touchWorld();
    if (this.G.view) { this.G.view.syncBuilding(b, true); if (!silent) this.G.view.dust(b, 0.9, [0.82, 0.8, 0.74]); }
    this.assignCapacity(b);
    this.markAccess(b);
  }

  assignCapacity(b) {
    const info = b.ginfo || {};
    if (b.kind === 'zone') {
      const A = ARCH_INFO[b.arch] || ARCH_INFO.house;
      const floors = b.floors || info.floors || 2;
      b.floors = floors;
      const fl = A.res && A.jobs ? Math.max(1, floors - 1) : floors;
      if (A.res) b.cap = Math.max(2, Math.round(b.lw * b.ld * fl * A.res * (b.level === 3 ? 1.1 : 1)));
      if (A.jobs) b.jobs = Math.max(2, Math.round(b.lw * b.ld * (A.res ? 1 : floors) * A.jobs * 0.55 * (IND_ARCH.has(b.arch) && b.arch !== 'factory' ? 1.6 : 1)));
    } else if (b.def) {
      b.jobs = b.def.jobs || 0;
      b.cap = b.def.cap || 0;
    }
  }

  markAccess(b) { b.acc = -1; }

  // ------------------------------------------------------------ networks (power / water / sewage)
  computeNetworks() {
    const w = this.w, n = w.n;
    this.pw.fill(0); this.wt.fill(0); this.sw.fill(0);
    const isRoad = (i) => { const t = w.road[i]; return t >= 1 && t <= 5; };
    const srcP = [], srcW = [], srcS = [];
    for (const b of this.blist()) {
      if (!b.def || b.state === 'construct' || b.state === 'ruin') continue;
      if (b.def.power > 0) srcP.push(b);
      if (b.def.water) srcW.push(b);
      if (b.def.sewage) srcS.push(b);
    }
    const q = new Int32Array(n * n);
    const bfs = (sources, arr, pylons) => {
      let qh = 0, qt = 0;
      const mark = (i) => { if (!arr[i]) { arr[i] = 1; q[qt++] = i; } };
      for (const b of sources) {
        for (let j = -1; j <= b.d; j++) for (let i = -1; i <= b.w; i++) {
          if ((i >= 0 && i < b.w) && (j >= 0 && j < b.d)) continue;
          const x = b.x + i, z = b.z + j;
          if (!w.inb(x, z)) continue;
          const idx = z * n + x;
          if (isRoad(idx)) mark(idx);
          if (pylons && w.pylon[idx]) mark(idx);
        }
        if (pylons) for (let j = -3; j < b.d + 3; j++) for (let i = -3; i < b.w + 3; i++) {
          const x = b.x + i, z = b.z + j;
          if (w.inb(x, z) && w.pylon[z * n + x]) mark(z * n + x);
        }
      }
      while (qh < qt) {
        const i = q[qh++];
        const x = i % n, z = (i / n) | 0;
        for (let d = 0; d < 4; d++) {
          const nx = x + DX[d], nz = z + DZ[d];
          if (!w.inb(nx, nz)) continue;
          const ni = nz * n + nx;
          if (isRoad(ni)) mark(ni);
          else if (pylons && w.pylon[ni]) mark(ni);
        }
        if (pylons && w.pylon[i]) {
          for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
            const nx = x + dx, nz = z + dz;
            if (w.inb(nx, nz) && w.pylon[nz * n + nx]) mark(nz * n + nx);
          }
        }
      }
    };
    bfs(srcP, this.pw, true);
    bfs(srcW, this.wt, false);
    bfs(srcS, this.sw, false);
    this.netRev = w.rev;
  }

  connected(b, arr) {
    const w = this.w, n = w.n;
    for (let j = -1; j <= b.d; j++) for (let i = -1; i <= b.w; i++) {
      if ((i >= 0 && i < b.w) && (j >= 0 && j < b.d)) continue;
      if ((i < 0 || i >= b.w) && (j < 0 || j >= b.d)) continue;
      const x = b.x + i, z = b.z + j;
      if (w.inb(x, z) && arr[z * n + x]) return true;
    }
    return false;
  }

  // ------------------------------------------------------------ law effects
  recomputeLaws() {
    const S = this.S;
    const eff = 0.35 + 0.65 * S.enforcement;
    const fx = {};
    for (const id in S.laws) {
      if (!S.laws[id]) continue;
      const L = LAWS[id]; if (!L) continue;
      for (const k in L.fx) fx[k] = (fx[k] || 0) + L.fx[k] * (k === 'noCut' ? 1 : eff);
    }
    // policies
    this.law = fx;
    this.lawEff = eff;
  }
  lawVal(k) { return this.law[k] || 0; }
  evMul(k) { let m = 1; for (const e of this.S.events || []) if (e.fx[k] !== undefined && k !== 'tourism' && k !== 'happy') m *= e.fx[k]; return m; }
  evSum(k) { let m = 0; for (const e of this.S.events || []) if (e.fx[k] !== undefined) m += e.fx[k]; return m; }
  eventStep() {
    const S = this.S;
    S.events = (S.events || []).filter((e) => e.until > S.totalDays);
    if (S.disasters === false || S.pop < 200 || this.rng() > 1 / 75) return;
    const def = EVENT_DEFS[(this.rng() * EVENT_DEFS.length) | 0];
    if (S.pop < def.minPop || S.events.some((e) => e.id === def.id)) return;
    if (def.needsBad === 'health' && S.health > 0.4) return;
    S.events.push({ id: def.id, name: def.name, icon: def.icon, until: S.totalDays + def.days, fx: def.fx });
    this.log(`${def.icon} ${def.msg}`, def.good ? 'good' : 'warn');
  }

  // ------------------------------------------------------------ time
  update(dt) {
    const S = this.S;
    if (S.speed > 0) {
      this.accum += dt;
      const iv = DAY_INTERVAL[S.speed];
      let guard = 0;
      while (this.accum >= iv && guard++ < 4) { this.accum -= iv; this.dayStep(); }
    }
    // construction progress is day based; coverage maps refresh occasionally
    this.mapsTimer -= dt;
    if (this.mapsDirty && this.mapsTimer <= 0) { this.mapsTimer = 0.8; this.updateMaps(); }
    this.disasterUpdate(dt);
    if (this.G.world.rev !== this.netRev && this.mapsTimer <= 0.4) this.computeNetworks();
  }

  // ------------------------------------------------------------ daily step
  dayStep() {
    const S = this.S, w = this.w;
    S.totalDays++;
    S.day++;
    if (S.day > 30) { S.day = 1; S.month++; if (S.month > 11) { S.month = 0; S.year++; } this.monthStep(); }
    if (w.rev !== this.netRev) this.computeNetworks();
    this.progressBuildings();
    this.updateUtilities();
    this.updateEconomyStats();
    this.updateDemand();
    this.growth();
    if (S.weatherOn !== false) weatherStep(S, this.rng); else if (S.weather) { S.weather.type = 'clear'; S.weather.snowCover = 0; }
    this.events();
    this.eventStep();
    this.industryStep();
    this.deathStep();
    if (S.totalDays % 5 === 0) this.depleteResources();
    this.disasterStep();
    this.chirpStep();
    this.applyFinance();
    this.checkMilestones();
    if (S.totalDays % 3 === 0) this.updateMaps(true);
  }

  progressBuildings() {
    for (const b of Array.from(this.w.buildings.values())) {
      b.age++;
      if (b.state === 'construct') {
        if (--b.timer <= 0) this.finishBuilding(b);
      } else if (b.state === 'ruin') {
        if (--b.timer <= 0) this.removeBuilding(b);
      } else if (b.state === 'abandoned') {
        if (--b.timer <= 0) { this.removeBuilding(b); }
      }
    }
  }

  updateUtilities() {
    const S = this.S;
    let psup = 0, pdem = 0, wsup = 0, wdem = 0, ssup = 0;
    const day = Math.max(0, Math.sin(((S.tod - 6) / 12) * Math.PI));
    const wfx = weatherFx(S);
    const wind = (0.55 + 0.45 * (0.5 + 0.5 * Math.sin(S.totalDays * 0.37 + 1.3))) * wfx.wind;
    const list = [];
    for (const b of this.blist()) {
      if (b.state !== 'ok') continue;
      const d = b.def;
      if (d) {
        if (d.power > 0 && this.connected(b, this.pw)) { let p = d.power; if (b.key === 'wind') p *= wind; if (b.key === 'solar') p *= clamp(day * 1.2, 0, 1) * wfx.solar; psup += p; }
        if (d.water && this.connected(b, this.wt)) wsup += d.water;
        if (d.sewage && this.connected(b, this.sw)) ssup += d.sewage;
        b.cPw = this.connected(b, this.pw) || d.power > 0; b.cWt = this.connected(b, this.wt) || !!d.water;
      } else { b.cPw = this.connected(b, this.pw); b.cWt = this.connected(b, this.wt); }
      b.cSw = this.connected(b, this.sw);
      const A = b.kind === 'zone' ? ARCH_INFO[b.arch] : null;
      let pd, wd;
      if (A) { pd = b.occ * A.power + (A.jobs ? b.jobs * A.power : 0); wd = (A.res ? b.occ * A.water : 0) + (A.jobs ? b.workers * A.water : 0); }
      else { pd = 0.02 + (b.jobs || 0) * 0.004 + (b.def && (b.def.industry ? 0.15 : 0.03)); wd = (b.jobs || 0) * 0.8 + 2; if (b.def && b.def.power > 0) { pd = 0; } }
      b._pd = pd; b._wd = wd;
      if (b.cPw) pdem += pd;
      if (b.cWt) wdem += wd;
      list.push(b);
    }
    psup *= this.evMul('powerSupply'); pdem *= this.evMul('power') * heatingDemand(S); wsup *= this.evMul('water');
    S.power.supply = psup; S.power.demand = pdem;
    S.water.supply = wsup; S.water.demand = wdem;
    S.sewage.cap = ssup; S.sewage.demand = wdem * 0.85;
    const pr = pdem > 0 ? Math.min(1, psup / pdem) : 1;
    const wr = wdem > 0 ? Math.min(1, wsup / wdem) : 1;
    this.pRatio = pr; this.wRatio = wr;
    this.sRatio = S.sewage.demand > 0 ? Math.min(1, ssup / S.sewage.demand) : 1;
    for (const b of list) {
      const d = b.def;
      const needP = !d || d.jobs > 0 || d.cov || d.industry;
      const needW = !d || d.jobs > 0 || d.industry;
      b.powered = (d && d.power > 0) ? true : needP ? (b.cPw && b.rnd <= pr + 1e-6) : true;
      b.watered = (d && d.water) ? true : needW ? (b.cWt && b.rnd <= wr + 1e-6) : true;
      b.sewered = b.cSw;
    }
  }

  updateEconomyStats() {
    const S = this.S;
    let pop = 0, resCap = 0, jobsC = 0, jobsI = 0, jobsS = 0, jobsO = 0, skilled = 0, tour = 0;
    for (const b of this.blist()) {
      if (b.state !== 'ok') { continue; }
      if (b.kind === 'zone') {
        if (RES_ARCH.has(b.arch)) { pop += b.occ; resCap += b.cap; }
        if (IND_ARCH.has(b.arch)) jobsI += b.jobs;
        else if (b.arch === 'office') { jobsO += b.jobs; skilled += b.jobs; }
        else if (b.jobs) jobsC += b.jobs;
        if (b.arch === 'store' && b.level >= 2) tour += 0.08 * b.level;
      } else if (b.def) {
        if (b.def.industry) jobsI += b.def.jobs || 0; else jobsS += b.def.jobs || 0;
        if (b.key === 'tech') skilled += b.def.jobs;
        if (b.def.tourism) tour += b.def.tourism;
      }
    }
    S.pop = Math.min(pop, POP_CAP);
    S.popPeak = Math.max(S.popPeak || 0, S.pop);
    S.resCap = resCap; S.jobsC = jobsC; S.jobsI = jobsI; S.jobsS = jobsS; S.jobsO = jobsO;
    S.jobsTotal = jobsC + jobsI + jobsS + jobsO;
    S.workforce = S.pop * 0.58;
    S.unemployment = S.workforce > 5 ? clamp(1 - Math.min(1, S.jobsTotal / S.workforce), 0, 1) : 0;
    this.jobFill = S.jobsTotal > 0 ? Math.min(1, S.workforce / S.jobsTotal) : 0;
    // education share
    let eduNum = 0;
    const m = this.maps.edu, h = this.maps.health;
    let hNum = 0;
    const n = this.w.n;
    for (const b of this.blist()) {
      if (b.state !== 'ok' || b.kind !== 'zone' || !RES_ARCH.has(b.arch)) continue;
      const i = (b.z + (b.d >> 1)) * n + b.x + (b.w >> 1);
      eduNum += b.occ * clamp(m[i] + this.dVal(i, 'edu'), 0, 1); hNum += b.occ * h[i];
    }
    const eduCap = this.eduCapRatio || 1, hCapR = this.healthCapRatio || 1;
    S.edu = S.pop > 0 ? clamp(eduNum / S.pop * eduCap + this.lawVal('edu'), 0, 1) : 0;
    S.health = S.pop > 0 ? clamp(hNum / S.pop * hCapR + this.lawVal('health') + (this.S.waste.backlog > 800 ? -0.12 : 0) - this.S.pollution / 300, 0, 1) : 0.5;
    const skilledWorkers = S.workforce * (S.edu * 0.85 + 0.08);
    this.skillFill = skilled > 0 ? clamp(skilledWorkers / skilled, 0.15, 1) : 1;
    // tourism
    let sceneryBonus = 0;
    for (const b of this.blist()) if (b.state === 'ok' && b.kind === 'zone' && (b.style === 0 || b.style === 1) && b.level >= 2) sceneryBonus += 0.01;
    S.tourism = Math.max(0, weatherFx(S).tourism * (tour * (1 + this.lawVal('tourism') + (S.policies.tourboard ? 0.3 : 0)) + Math.min(1.5, sceneryBonus * (1 + this.lawVal('landValue') * 3))) * (this.S.happy > 55 ? 1 : 0.6) + this.evSum('tourism'));
    // job fill applied
    for (const b of this.blist()) {
      if (b.state !== 'ok') continue;
      if (b.jobs) b.workers = Math.round(b.jobs * this.jobFill * (b.powered ? 1 : 0.2));
    }
    // outside connection
    let out = false;
    for (let k = 0; k < n && !out; k++) {
      const edgeIdx = [k, (n - 1) * n + k, k * n, k * n + n - 1];
      for (const e of edgeIdx) if (this.w.road[e] === R.HIGHWAY || this.w.road[e] === R.RAIL) out = true;
    }
    for (const b of this.blist()) if ((b.key === 'port' || b.key === 'airport') && b.state === 'ok') out = true;
    S.outside = out;
    S.airport = false; S.cargoRail = 0;
    for (const b of this.blist()) { if (b.state !== 'ok') continue; if (b.key === 'airport') S.airport = true; if (b.key === 'cargo_rail') S.cargoRail++; }
  }

  attractOf(hp) {
    const S = this.S;
    return clamp(0.55 + (hp - 45) * 0.014 - S.unemployment * 1.2 + this.lawVal('growth'), 0, 1);
  }

  updateDemand() {
    const S = this.S;
    const pop = S.pop;
    const happy = S.happy;
    const taxPenalty = (rate) => (rate - 9) * 0.05;
    const fill = S.resCap > 0 ? pop / S.resCap : 0;
    const attract = this.attractOf(happy);
    const jobsBal = (S.jobsTotal - S.workforce) / (S.jobsTotal + 60);
    let r = 0.12 + jobsBal * 0.8 + (happy - 50) * 0.01 - taxPenalty(S.tax.r) + this.lawVal('growth') + (fill / Math.max(0.25, attract) - 0.92) * 2.2;
    if (S.resCap < 40) r = Math.max(r, 0.7);
    const ctarget = pop * 0.17 + 12 + S.tourism * 40 + (S.airport ? pop * 0.02 : 0);
    let c = (ctarget - S.jobsC) / (ctarget + 30) * 1.15 - taxPenalty(S.tax.c) - (S.pop > 30 ? 0 : 0.8) - (S.outside ? 0 : 0.04);
    const otarget = pop * 0.1 * (0.35 + S.edu) + 8 + (this.teleAvg || 0) * pop * 0.03;
    let o = (otarget - S.jobsO) / (otarget + 30) * 1.1 - taxPenalty(S.tax.o === undefined ? 9 : S.tax.o) - (S.pop > 500 ? 0 : 0.6);
    const itarget = pop * 0.17 + 14 + (S.outside ? pop * 0.04 : 0) + (S.unemployment > 0.1 ? 40 : 0) + S.cargoRail * pop * 0.015;
    let i = (itarget - S.jobsI) / (itarget + 30) * 1.1 - taxPenalty(S.tax.i) + (S.policies.freetrade ? 0.12 : 0) + 0.08;
    if (S.pop < 15) { c = Math.min(c, 0.0); i = Math.min(i, 0.4); o = Math.min(o, 0); }
    if (S.pop >= POP_CAP) r = Math.min(r, -0.5);
    const e = 0.25;
    S.demand.r = lerp(S.demand.r, clamp(r, -1, 1), e);
    S.demand.c = lerp(S.demand.c, clamp(c, -1, 1), e);
    S.demand.i = lerp(S.demand.i, clamp(i, -1, 1), e);
    S.demand.o = lerp(S.demand.o || 0, clamp(o, -1, 1), e);
  }

  // ------------------------------------------------------------ growth
  rebuildCandidates() {
    const w = this.w, n = w.n;
    const c = [];
    for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) {
      const i = z * n + x;
      const zt = w.zone[i];
      if (!isBuildZone(zt) || w.bid[i] || w.road[i]) continue;
      const f = w.frontRoad(x, z);
      if (f < 0) continue;
      c.push(i);
    }
    this.cands = c; this.candRev = w.rev;
  }

  growth() {
    const S = this.S, w = this.w;
    if (this.candRev !== w.rev) this.rebuildCandidates();
    if (!this.cands.length) return;
    const nAttempt = 1 + Math.floor(S.pop / 350);
    const cats = [['R', S.demand.r], ['C', S.demand.c], ['O', S.demand.o || 0], ['I', S.demand.i]];
    const popRoom = S.resCap < POP_CAP * 1.08;
    for (const [cat, dem] of cats) {
      if (dem < 0.04) continue;
      if (cat === 'R' && !popRoom) continue;
      const tries = Math.max(1, Math.ceil(dem * nAttempt * 2.2));
      for (let k = 0; k < tries; k++) {
        if (this.rng() > 0.35 + dem) continue;
        this.trySpawn(cat);
      }
    }
    // upgrades and abandonment
    for (const b of this.blist()) {
      if (b.kind !== 'zone' || b.state !== 'ok') continue;
      const i = (b.z + (b.d >> 1)) * w.n + b.x + (b.w >> 1);
      // occupancy dynamics
      this.occupancy(b, i);
      // abandonment
      const bad = !b.powered || !b.watered || this.maps.happy[i] < 8 || ((b.arch === 'ore' || b.arch === 'oil') && b.resLeft === 0);
      if (bad && b.age > 6) b.abandon++; else b.abandon = Math.max(0, b.abandon - 2);
      if (b.abandon > 14) { this.abandon(b); continue; }
      if (b.level < 3 && b.age > 18 && this.rng() < 0.03 && b.level < (this.dVal(i, 'maxLevel') || 3)) this.tryUpgrade(b, i);
    }
  }

  occupancy(b, i) {
    const S = this.S;
    if (RES_ARCH.has(b.arch)) {
      let attract = this.attractOf(this.maps.happy[i]);
      if (!b.powered || !b.watered) attract = Math.min(attract, 0.15);
      if (S.pop >= POP_CAP) attract = Math.min(attract, b.occ / Math.max(1, b.cap));
      const target = b.cap * attract * (S.jobsTotal > 0 || S.pop < 25 ? 1 : 0.5);
      if (b.occ < target) {
        let add = Math.max(1, Math.round(b.cap * 0.12));
        add = Math.min(add, Math.round(target - b.occ), POP_CAP - S.pop - 0);
        if (add > 0) { b.occ += add; S.pop += add; }
      } else if (b.occ > target + 1) {
        const rem = Math.max(1, Math.round(b.cap * 0.05));
        b.occ = Math.max(0, b.occ - rem);
      }
    }
  }

  abandon(b) {
    b.state = 'abandoned'; b.timer = 25; b.occ = 0; b.workers = 0;
    b.tintMul = [0.45, 0.43, 0.42];
    if (this.G.view) this.G.view.markChunk(b);
    if (this.rng() < 0.4) this.log('A building was abandoned. Check power, water and happiness.', 'warn');
  }

  tryUpgrade(b, i) {
    const S = this.S, m = this.maps;
    if (!b.powered || !b.watered) return;
    const lv = m.landvalue[i];
    let ok = false;
    if (b.level === 1) ok = lv >= 30 && (IND_ARCH.has(b.arch) || m.edu[i] > 0.05 || S.pop < 400) && (IND_ARCH.has(b.arch) ? true : m.police[i] > 0.04 || S.pop < 300);
    else ok = lv >= 48 && m.edu[i] > 0.22 && m.health[i] > 0.15 && m.police[i] > 0.15 && (RES_ARCH.has(b.arch) || S.pop > 2500);
    if (IND_ARCH.has(b.arch) && b.level >= 2) ok = ok && S.pop > 3500 && this.skillFill > 0.5;
    if (b.arch === 'office' && b.level >= 2) ok = ok && m.tele[i] > 0.1;
    if (!ok) return;
    const dem = RES_ARCH.has(b.arch) ? S.demand.r : IND_ARCH.has(b.arch) ? S.demand.i : b.arch === 'office' ? (S.demand.o || 0) : S.demand.c;
    if (dem < 0.02 && b.level >= 2) return;
    if (S.pop >= POP_CAP && RES_ARCH.has(b.arch)) return;
    if (this.law.growth < -0.05 && this.rng() < 0.5) return;
    const occ = b.occ;
    b.level++; b.state = 'construct'; b.timer = 4 + b.level; b.occ = Math.round(occ * 0.5);
    b.seed = (this.rng() * 1e9) | 0;
    if (this.G.view) this.G.view.syncBuilding(b, true);
    if (RES_ARCH.has(b.arch)) this.S.pop = Math.max(0, this.S.pop - (occ - b.occ));
  }

  /** why a building isn't levelling up (for the info panel) */
  upgradeNeeds(b) {
    const S = this.S, m = this.maps, n = this.w.n;
    if (b.kind !== 'zone' || b.level >= 3) return [];
    const i = (b.z + (b.d >> 1)) * n + b.x + (b.w >> 1);
    const out = [];
    const cap = this.dVal(i, 'maxLevel'); if (cap && b.level >= cap) out.push('District High-Rise Ban');
    if (!b.powered) out.push('power'); if (!b.watered) out.push('water');
    const lvNeed = b.level === 1 ? 30 : 48;
    if (m.landvalue[i] < lvNeed) out.push(`land value ${Math.round(m.landvalue[i])}/${lvNeed}`);
    if (b.level === 1) { if (!IND_ARCH.has(b.arch) && m.edu[i] <= 0.05 && S.pop >= 400) out.push('schools'); if (!IND_ARCH.has(b.arch) && m.police[i] <= 0.04 && S.pop >= 300) out.push('police'); }
    else { if (m.edu[i] <= 0.22) out.push('education'); if (m.health[i] <= 0.15) out.push('healthcare'); if (m.police[i] <= 0.15) out.push('police'); if (b.arch === 'office' && m.tele[i] <= 0.1) out.push('telecom'); }
    return out;
  }

  trySpawn(cat) {
    const w = this.w, S = this.S, n = w.n;
    const idx = this.cands[(this.rng() * this.cands.length) | 0];
    const x = idx % n, z = (idx / n) | 0;
    if (w.bid[idx] || w.road[idx]) return false;
    const zt = w.zone[idx];
    const zi = ZONE_INFO[zt];
    if (!zi || zi.cat !== cat || !zi.arch) return false;
    let arch = zi.arch;
    // district specialisation / small-business policy
    const spec = this.dfx && w.dist[idx] && this.dfx[w.dist[idx]] ? this.dfx[w.dist[idx]].spec : null;
    if (arch === 'factory' && spec) {
      const rv = this.resourceAt(idx, SPECIALIZATIONS[spec].res);
      if (rv > 40) arch = spec;
    }
    if (arch === 'store' && this.dVal(idx, 'smallbiz')) arch = 'shop';
    // power & water access: a connected conductor must be nearby (so buildings only appear where services reach)
    const f = w.frontRoad(x, z);
    if (f < 0) return false;
    const rx = x + DX[f], rz = z + DZ[f];
    const ri = rz * n + rx;
    if (!this.pw[ri] || !this.wt[ri]) return false;
    const style0 = w.zstyle[idx];
    // choose lot size
    const lots = LOTS[arch];
    let tot = 0; for (const l of lots) tot += l[1];
    let r = this.rng() * tot, lot = lots[0][0];
    for (const l of lots) { r -= l[1]; if (r <= 0) { lot = l[0]; break; } }
    // try preferred then smaller lots
    const tryLots = [lot, ...lots.map((l) => l[0]).filter((l) => l[0] * l[1] < lot[0] * lot[1]).reverse()];
    // lot starting at idx, extend away from the road; along-road direction random
    const back = [-DX[f], -DZ[f]];
    const along = (f === 0 || f === 2) ? [1, 0] : [0, 1];
    const sgn = this.rng() < 0.5 ? 1 : -1;
    for (const [lw, ld] of tryLots) {
      let ok = true;
      const tiles = [];
      for (let a = 0; a < lw && ok; a++) for (let d = 0; d < ld && ok; d++) {
        const tx = x + along[0] * sgn * a + back[0] * d, tz = z + along[1] * sgn * a + back[1] * d;
        if (!w.inb(tx, tz)) { ok = false; break; }
        const ti = tz * n + tx;
        if (w.zone[ti] !== zt || w.bid[ti] || w.road[ti] || w.pylon[ti] || !w.buildable(tx, tz)) { ok = false; break; }
        const zs = w.zstyle[ti];
        if (zs !== style0) { ok = false; break; }
        tiles.push([tx, tz]);
      }
      if (!ok) continue;
      let minx = 1e9, minz = 1e9, maxx = -1, maxz = -1;
      for (const [tx, tz] of tiles) { minx = Math.min(minx, tx); minz = Math.min(minz, tz); maxx = Math.max(maxx, tx); maxz = Math.max(maxz, tz); }
      const level = (cat === 'R' ? this.maps.landvalue[idx] > 50 : this.maps.landvalue[idx] > 55) && this.rng() < 0.3 && !(this.dVal(idx, 'maxLevel') === 1) ? 2 : 1;
      const style = style0 === 5 ? (this.rng() * 5) | 0 : style0;
      this.addBuilding({ kind: 'zone', arch, zone: zt, style, level, lw, ld, x: minx, z: minz, w: maxx - minx + 1, d: maxz - minz + 1, facing: f, timer: 4 + level });
      this.candRev = -1;
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------ maps (services coverage, pollution, crime, land value, happiness)
  updateMaps(force) {
    const w = this.w, n = w.n, N = n * n, S = this.S, m = this.maps;
    this.mapsDirty = false;
    if (this.netRev !== w.rev) this.computeNetworks();
    const clear = (a) => a.fill(0);
    for (const k of ['police', 'fire', 'health', 'edu', 'waste', 'transit', 'pollution', 'noise', 'park', 'death', 'post', 'tele', 'shelter', 'dru']) clear(m[k]);
    this.recomputeDistrictFx();
    // capacities for ratios
    let eduCap = 0, healthCap = 0, wasteCap = 0, wasteProd = 0, policeN = 0;
    let prisonCap = 0;
    const bud = (cat) => 0.55 + 0.45 * this.budgetScale(cat);
    const stamp = (map, cx, cz, r, strength, pow = 1.0) => {
      const r2 = r * r;
      const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(n - 1, Math.ceil(cx + r));
      const z0 = Math.max(0, Math.floor(cz - r)), z1 = Math.min(n - 1, Math.ceil(cz + r));
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx, dz = z + 0.5 - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 > r2) continue;
        const v = strength * Math.pow(1 - Math.sqrt(d2) / r, pow);
        const i = z * n + x;
        if (v > map[i]) map[i] = v;
      }
    };
    const add = (map, cx, cz, r, strength, pow = 2) => {
      const r2 = r * r;
      const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(n - 1, Math.ceil(cx + r));
      const z0 = Math.max(0, Math.floor(cz - r)), z1 = Math.min(n - 1, Math.ceil(cz + r));
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx, dz = z + 0.5 - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 > r2) continue;
        map[z * n + x] += strength * Math.pow(1 - Math.sqrt(d2) / r, pow);
      }
    };
    const lineStops = new Set();
    for (const l of S.lines || []) if (l.stops.length >= 2) for (const k of l.stops) lineStops.add(l.type === 'bus' ? 'b' + k : 'm' + k);
    for (const b of this.blist()) {
      if (b.state !== 'ok' || !b.def) continue;
      const d = b.def;
      const cx = b.x + b.w / 2, cz = b.z + b.d / 2;
      if (d.cov && d.radius && (b.powered || b.key === 'bus_stop')) {
        // transit stops only cover when a line serves them
        if (b.key === 'bus_stop' || b.key === 'metro') { const k = b.key === 'bus_stop' ? 'b' + (b.z * n + b.x) : 'm' + b.id; if (!lineStops.has(k)) continue; }
        const bf = 0.55 + 0.45 * this.budgetOf(d);
        stamp(m[d.cov], cx, cz, d.radius, bf, 0.55);
        if (d.cov === 'edu') eduCap += d.cap * bf;
        if (d.cov === 'health') healthCap += d.cap * bf;
        if (d.cov === 'waste') { wasteCap += d.cap * bf; }
        if (d.cov === 'police') policeN++;
        if (d.prison) prisonCap += d.prison;
      }
      if (d.pollute) add(m.pollution, cx, cz, 5 + d.pollute * 2.2, d.pollute * 22 * (1 + this.lawVal('pollution')) * (S.policies.deepmine && b.key === 'quarry' ? 1.5 : 1) * (S.policies.organic && b.key === 'farm' ? 0 : 1), 1.5);
      if (d.noise) add(m.noise, cx, cz, 5 + d.noise * 3, d.noise * 28 * (1 + this.lawVal('noise')), 1.5);
      if (d.radius && (d.happy || d.lv)) { stamp(m.park, cx, cz, d.radius, d.happy || 3, 1); }
    }
    // zone buildings: industry pollution/noise
    const IP = { factory: [0.8, 0.6, 0.5, 0.3], agri: [0.15, 0.05, 0.2, 0.05], forest: [0.5, 0.2, 0.6, 0.2], ore: [1.2, 0.5, 0.9, 0.3], oil: [1.3, 0.5, 0.6, 0.2] };
    for (const b of this.blist()) {
      if (b.kind !== 'zone' || b.state !== 'ok') continue;
      const cx = b.x + b.w / 2, cz = b.z + b.d / 2;
      const ip = IP[b.arch];
      if (ip) {
        add(m.pollution, cx, cz, 6 + b.level * 2, (ip[0] + b.level * ip[1]) * 22 * (1 + this.lawVal('pollution')), 1.5);
        add(m.noise, cx, cz, 5 + b.level, (ip[2] + b.level * ip[3]) * 24 * (1 + this.lawVal('noise')), 1.5);
      } else if (b.arch === 'office' && b.level === 3) add(m.noise, cx, cz, 3, 6, 1);
      else if (b.arch === 'shop' || b.arch === 'mixed') add(m.noise, cx, cz, 3, 5, 1);
      else if (b.arch === 'store') add(m.noise, cx, cz, 4, 8, 1);
    }
    this.stampLineCoverage(stamp);
    // parks painted + traffic
    const traffic = this.G.traffic ? this.G.traffic.map : null;
    let trSum = 0, trN = 0;
    for (let i = 0; i < N; i++) {
      if (w.park[i]) { const x = i % n, z = (i / n) | 0; stamp(m.park, x + 0.5, z + 0.5, 4, 2.2, 1); }
      const t = w.road[i];
      if (t >= 1 && t <= 5) {
        const tv = traffic ? traffic[i] : 0;
        if (tv > 0.05) { const x = i % n, z = (i / n) | 0; if (tv > 0.3) { add(m.noise, x + 0.5, z + 0.5, 3, tv * 14 * (1 + this.lawVal('noise')), 1.5); add(m.pollution, x + 0.5, z + 0.5, 3, tv * 9 * (1 + this.lawVal('pollution')), 1.5); } trSum += tv; trN++; }
        if (t === R.HIGHWAY) { const x = i % n, z = (i / n) | 0; add(m.noise, x + 0.5, z + 0.5, 3, 10, 1); }
      }
    }
    S.traffic = trN ? clamp(trSum / trN, 0, 2) : 0;
    // trees & parks soften pollution; district policies scale it
    for (let i = 0; i < N; i++) {
      if (w.tree[i] || w.park[i]) { m.pollution[i] *= 0.65; m.noise[i] *= 0.75; }
      if (w.dist[i]) { m.pollution[i] *= 1 + this.dVal(i, 'pollution'); m.noise[i] *= 1 + this.dVal(i, 'noise'); }
      m.pollution[i] = Math.min(100, m.pollution[i]); m.noise[i] = Math.min(100, m.noise[i]);
    }
    // capacity ratios
    const pop = Math.max(1, S.pop);
    this.eduCapRatio = clamp(eduCap / (pop * 0.22 + 1), 0, 1) ;
    this.healthCapRatio = clamp(healthCap / (pop * 0.3 + 1), 0, 1);
    // waste production
    for (const b of this.blist()) { if (b.state !== 'ok') continue; const A = b.kind === 'zone' ? ARCH_INFO[b.arch] : null; const dw = 1 + this.dVal((b.z + (b.d >> 1)) * n + b.x + (b.w >> 1), 'waste'); wasteProd += (A ? (b.occ + b.workers) * A.waste * (1 + b.level * 0.15) : (b.jobs || 0) * 0.02) * dw; }
    wasteProd *= (1 + this.lawVal('waste'));
    S.waste.cap = wasteCap; S.waste.prod = wasteProd;
    this.wasteRatio = wasteProd > 0 ? clamp(wasteCap / wasteProd, 0, 1) : 1;
    // apply capacity ratio to coverage maps
    for (let i = 0; i < N; i++) {
      m.edu[i] *= Math.max(0.25, this.eduCapRatio) * (this.eduCapRatio > 0 ? 1 : 0);
      m.health[i] *= Math.max(0.3, this.healthCapRatio) * (this.healthCapRatio > 0 ? 1 : 0);
      m.waste[i] *= Math.max(0.25, this.wasteRatio);
    }
    // enforcement
    let polAvg = 0, cnt = 0;
    for (let i = 0; i < N; i++) { const z = w.zone[i] || w.bid[i]; if (z) { polAvg += m.police[i]; cnt++; } }
    polAvg = cnt ? polAvg / cnt : 0;
    let bonus = 0;
    for (const b of this.blist()) if (b.state === 'ok' && b.def && b.def.enforce) bonus += b.def.enforce;
    S.enforcement = clamp(polAvg * 1.3 * (0.6 + 0.4 * this.budgetScale('police')) + bonus * 0.5, 0, 1);
    this.recomputeLaws();
    // water near (cached per terrain version)
    if (this.waterVer !== w.version) { this.computeWaterNear(); this.waterVer = w.version; }
    // land value
    const lv = m.landvalue;
    const heritageBonus = this.lawVal('landValue');
    for (let i = 0; i < N; i++) lv[i] = 28 + this.waterNear[i] * 12 + (w.tree[i] ? 3 : 0) + m.tele[i] * 4 + m.post[i] * 2 + this.dVal(i, 'landValue');
    for (const b of this.blist()) {
      if (b.state !== 'ok') continue;
      if (b.def && b.def.lv) add(lv, b.x + b.w / 2, b.z + b.d / 2, b.def.radius || 10, b.def.lv * 100, 1);
      if (b.def && b.def.tourism) add(lv, b.x + b.w / 2, b.z + b.d / 2, 8, b.def.tourism * 8, 1);
      if (b.kind === 'zone' && b.level >= 2 && b.arch !== 'factory') add(lv, b.x + b.w / 2, b.z + b.d / 2, 4, 2.5 * b.level, 1);
      if (b.kind === 'zone' && heritageBonus && (b.style === 0 || b.style === 1)) add(lv, b.x + b.w / 2, b.z + b.d / 2, 3, heritageBonus * 60, 1);
    }
    for (let i = 0; i < N; i++) {
      const rt = w.road[i];
      if (rt === R.AVENUE) { const x = i % n, z = (i / n) | 0; add(lv, x + 0.5, z + 0.5, 2, 3, 1); }
      if (rt === R.BOULEVARD) { const x = i % n, z = (i / n) | 0; add(lv, x + 0.5, z + 0.5, 3, 7, 1); }
    }
    // crime
    const cr = m.crime;
    const unemp = S.unemployment;
    const crimeMul = 1 + this.lawVal('crime');
    let casino = 0; for (const b of this.blist()) if (b.key === 'casino' && b.state === 'ok') casino += 1;
    for (let i = 0; i < N; i++) {
      const base = (14 + (100 - lv[i]) * 0.34 + unemp * 38) * crimeMul * (1 + this.dVal(i, 'crime'));
      cr[i] = clamp(base * (1 - m.police[i] * 0.85), 0, 100);
    }
    for (const b of this.blist()) if (b.state === 'ok' && b.def && b.def.crime) add(cr, b.x + b.w / 2, b.z + b.d / 2, 8, b.def.crime * 12 * (1 - 0.6 * m.police[(b.z) * n + b.x]), 1);
    for (let i = 0; i < N; i++) { cr[i] = clamp(cr[i], 0, 100); lv[i] = clamp(lv[i] - m.pollution[i] * 0.35 - m.noise[i] * 0.18 - cr[i] * 0.15 + m.police[i] * 6 + m.fire[i] * 3 + m.health[i] * 5 + m.edu[i] * 6 + m.transit[i] * 4, 0, 100); }
    // averages used by demand/finance
    let ts = 0, ps = 0, rc2 = 0;
    for (const b of this.blist()) { if (b.state !== 'ok' || b.kind !== 'zone') continue; const i = (b.z + (b.d >> 1)) * n + b.x + (b.w >> 1); ts += m.tele[i]; ps += m.post[i]; rc2++; }
    this.teleAvg = rc2 ? ts / rc2 : 0; this.postAvg = rc2 ? ps / rc2 : 0;
    // happiness (tile + city)
    this.computeHappiness();
    // stats
    let crAvg = 0, plAvg = 0, nzAvg = 0, rc = 0;
    for (const b of this.blist()) {
      if (b.state !== 'ok' || b.kind !== 'zone' || !RES_ARCH.has(b.arch)) continue;
      const i = (b.z + (b.d >> 1)) * n + b.x + (b.w >> 1);
      crAvg += cr[i] * b.occ; plAvg += m.pollution[i] * b.occ; nzAvg += m.noise[i] * b.occ; rc += b.occ;
    }
    S.crime = rc ? crAvg / rc : 0; S.pollution = rc ? plAvg / rc : 0; S.noise = rc ? nzAvg / rc : 0;
    this.G.overlayDirty = true;
  }

  computeWaterNear() {
    const w = this.w, n = w.n, out = this.waterNear;
    out.fill(0);
    const R_ = 6;
    for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) {
      if (!w.water[z * n + x]) continue;
      // only shore-adjacent water tiles matter (cuts work)
      let edge = false;
      for (let d = 0; d < 4; d++) { const nx = x + DX[d], nz = z + DZ[d]; if (w.inb(nx, nz) && !w.water[nz * n + nx]) edge = true; }
      if (!edge) continue;
      for (let dz = -R_; dz <= R_; dz++) for (let dx = -R_; dx <= R_; dx++) {
        const nx = x + dx, nz = z + dz;
        if (!w.inb(nx, nz)) continue;
        const v = 1 - Math.hypot(dx, dz) / R_;
        if (v > out[nz * n + nx]) out[nz * n + nx] = v;
      }
    }
  }

  computeHappiness() {
    const w = this.w, n = w.n, N = n * n, S = this.S, m = this.maps;
    const parts = [];
    const taxAvg = (S.tax.r * 2 + S.tax.c + S.tax.i) / 4;
    const gTax = -(taxAvg - 9) * 1.5;
    const gJobs = S.pop > 30 ? (0.12 - S.unemployment) * 60 : 0;
    const gPower = (1 - (this.pRatio === undefined ? 1 : this.pRatio)) * -25;
    const gWater = (1 - (this.wRatio === undefined ? 1 : this.wRatio)) * -25;
    const sizeK = clamp(S.pop / 400, 0.12, 1);          // small villages are forgiving about missing services
    const gSew = S.sewage.demand > 0 ? (1 - Math.min(1, S.sewage.cap / S.sewage.demand)) * -10 * sizeK : 0;
    const gTraffic = -Math.max(0, S.traffic - 0.35) * 14;
    const gLaw = this.lawVal('happy') + this.evSum('happy') + weatherFx(S).happy;
    const gWaste = -(1 - (this.wasteRatio === undefined ? 1 : this.wasteRatio)) * 8 * sizeK - Math.min(10, S.waste.backlog / 150) * sizeK;
    const gHeritage = S.tourism * 1.5;
    const gDeath = -Math.min(10, (S.death ? S.death.backlog : 0) / 8) * sizeK;
    const fees = S.fees || { power: 100, water: 100 };
    const gFees = -((fees.power - 100) + (fees.water - 100)) * 0.035;
    const gAll = gTax + gJobs + gPower + gWater + gSew + gTraffic + gLaw + gWaste + gDeath + gFees + Math.min(4, gHeritage);
    const hp = m.happy;
    for (let i = 0; i < N; i++) {
      let v = 52 + gAll + m.police[i] * 8 + m.fire[i] * 6 + m.health[i] * 11 + m.edu[i] * 7 + m.waste[i] * 3 + Math.min(14, m.park[i] * 1.6) + m.post[i] * 2 + m.tele[i] * 2 + m.transit[i] * 2 + (w.dist[i] ? this.dVal(i, 'happy') : 0) + (S.pop > 400 ? m.death[i] * 2 : 0)
        - m.pollution[i] * 0.2 - m.noise[i] * 0.1 - m.crime[i] * 0.1 * sizeK - m.crime[i] * 0.04 + (m.landvalue[i] - 40) * 0.08 + this.waterNear[i] * 3;
      hp[i] = clamp(v, 0, 100);
    }
    // city average weighted by residents
    let sum = 0, pop = 0;
    let hs = 0, es = 0, ps = 0, fs = 0, ws = 0;
    for (const b of this.blist()) {
      if (b.state !== 'ok' || b.kind !== 'zone' || !RES_ARCH.has(b.arch)) continue;
      const i = (b.z + (b.d >> 1)) * n + b.x + (b.w >> 1);
      sum += hp[i] * b.occ; pop += b.occ;
      hs += m.health[i] * b.occ; es += m.edu[i] * b.occ; ps += m.police[i] * b.occ; fs += m.fire[i] * b.occ; ws += m.waste[i] * b.occ;
    }
    const prev = S.happy;
    S.happy = pop > 0 ? lerp(prev, sum / pop, 0.35) : 62;
    const avg = (v) => pop ? v / pop : 0;
    S.happyParts = [
      ['Health care', avg(hs) * 11], ['Education', avg(es) * 7], ['Police', avg(ps) * 8], ['Fire safety', avg(fs) * 6], ['Waste', gWaste + avg(ws) * 3],
      ['Parks & scenery', Math.min(14, this.avgPark())], ['Taxes & fees', gTax + gFees], ['Jobs', gJobs], ['Power & water', gPower + gWater + gSew], ['Traffic', gTraffic],
      ['Pollution', -S.pollution * 0.2], ['Noise', -S.noise * 0.1], ['Crime', -S.crime * (0.1 * sizeK + 0.04)], ['Laws & weather', gLaw],
      ['Deathcare', gDeath], ['Post & telecom', (this.postAvg || 0) * 2 + (this.teleAvg || 0) * 2],
    ];
  }
  avgPark() {
    const m = this.maps, w = this.w, n = w.n; let s = 0, c = 0;
    for (const b of this.blist()) { if (b.state === 'ok' && b.kind === 'zone' && b.occ > 0 && RES_ARCH.has(b.arch)) { s += m.park[(b.z + (b.d >> 1)) * n + b.x + (b.w >> 1)] * 1.6; c++; } }
    return c ? s / c : 0;
  }

  // ------------------------------------------------------------ events: fire, crime, waste
  events() {
    const S = this.S, w = this.w, m = this.maps, n = w.n;
    // waste backlog
    const wasteNet = S.waste.prod - S.waste.cap;
    S.waste.backlog = clamp(S.waste.backlog + wasteNet * 0.6, 0, 6000);
    // landfill filling
    for (const b of this.blist()) {
      if (b.state === 'ok' && b.key === 'landfill') {
        b.fill = (b.fill || 0) + Math.min(b.def.cap, S.waste.prod / Math.max(1, S.waste.cap) * b.def.cap) * 0.6;
        if (b.fill > b.def.storage && !b.full) { b.full = true; this.log('A landfill is full! Build another waste facility.', 'warn'); }
      }
    }
    // fires
    const fireMul = 1 + this.lawVal('fire');
    const wfx = weatherFx(S);
    for (const b of this.blist()) {
      if (b.state === 'burning') { this.fireTick(b); continue; }
      if (b.state !== 'ok' || b.noBid || S.disasters === false) continue;
      const i = (b.z + (b.d >> 1)) * n + b.x + (b.w >> 1);
      let base = b.kind === 'zone' ? (IND_ARCH.has(b.arch) ? 0.00032 : 0.00009) : 0.00006 + (b.def && b.def.fire ? 0.0003 * b.def.fire : 0);
      if (IND_ARCH.has(b.arch)) base *= (1 + this.lawVal('fireInd'));
      base *= 1 + this.dVal(i, 'fire');
      if (!b.powered && b.kind === 'zone') base *= 0.2;
      const p = base * fireMul * wfx.fire * (1 - m.fire[i] * 0.72) * clamp(S.pop / 1500, 0.15, 1);
      if (this.rng() < p) this.ignite(b);
    }
    // crime events
    const crimeRate = S.crime / 100;
    if (S.pop > 120 && S.disasters !== false && this.rng() < crimeRate * S.pop * 0.0004 + 0.02) this.crimeEvent();
    // jail capacity
    // random positive/negative advisor
    if (S.totalDays % 10 === 0) this.advise();
  }

  ignite(b) {
    b.state = 'burning'; b.timer = 6 + ((this.rng() * 6) | 0); b.fireT = 0;
    b.tintMul = [1.2, 0.6, 0.45];
    this.S.stats.fires++;
    if (this.G.view) { this.G.view.markChunk(b); this.G.view.setFire(b, true, Math.min(2, 0.6 + b.w * b.d / 8)); }
    const def = b.def; const name = def ? def.name : (IND_ARCH.has(b.arch) ? 'A factory' : RES_ARCH.has(b.arch) ? 'A home' : 'A business');
    this.log(`🔥 ${name} is on fire!`, 'bad');
    if (this.G.traffic) this.G.traffic.dispatchEmergency('fire', b);
  }
  fireTick(b) {
    const m = this.maps, w = this.w, n = w.n;
    const i = (b.z + (b.d >> 1)) * n + b.x + (b.w >> 1);
    const cov = m.fire[i];
    b.timer--;
    const extinguish = cov > 0.12 && this.rng() < 0.35 + cov * 0.5;
    if (extinguish) {
      b.state = 'construct'; b.timer = 4; b.tintMul = null; b.fire = 0; b.occ = Math.round(b.occ * 0.6);
      if (this.G.view) { this.G.view.setFire(b, false); this.G.view.syncBuilding(b, true); }
      return;
    }
    // spread: rare and only to close neighbours, so fires stay local (subcritical: ~0.4 new fires per blaze)
    if (this.rng() < 0.05 * (1 - cov * 0.7)) {
      const cand = [];
      for (const o of this.blist()) {
        if (o === b || o.state !== 'ok' || o.noBid) continue;
        const gx = Math.max(b.x - (o.x + o.w), o.x - (b.x + b.w)), gz = Math.max(b.z - (o.z + o.d), o.z - (b.z + b.d));
        if (gx <= 1 && gz <= 1) cand.push(o);
      }
      if (cand.length) this.ignite(cand[(this.rng() * cand.length) | 0]);
    }
    if (b.timer <= 0) {
      b.state = 'ruin'; b.timer = 14; b.occ = 0; b.workers = 0; b.tintMul = [0.16, 0.15, 0.15];
      if (this.G.view) { this.G.view.setFire(b, false); this.G.view.markChunk(b); }
      this.log('A building burned to the ground.', 'bad');
    }
  }

  crimeEvent() {
    const S = this.S;
    const arr = Array.from(this.blist()).filter((b) => b.state === 'ok' && b.kind === 'zone');
    if (!arr.length) return;
    const b = arr[(this.rng() * arr.length) | 0];
    const n = this.w.n;
    const i = (b.z + (b.d >> 1)) * n + b.x + (b.w >> 1);
    S.stats.crimes++;
    const caught = this.rng() < this.maps.police[i] * 0.85 + 0.05;
    if (caught) { S.stats.solved++; if (this.G.traffic) this.G.traffic.dispatchEmergency('police', b); S.prisoners = Math.min(this.prisonCapacity(), S.prisoners + 1); }
    else { if (!this.sandbox()) S.money -= 40 + this.rng() * 80; if (this.rng() < 0.2) this.log('A robbery went unsolved. More police needed.', 'warn'); }
    // fines
  }
  prisonCapacity() { let c = 0; for (const b of this.blist()) if (b.state === 'ok' && b.def && b.def.prison) c += b.def.prison; return c; }

  // ------------------------------------------------------------ special industries
  industryStep() {
    const S = this.S, w = this.w;
    let portBoost = 0, farmCount = 0;
    for (const b of this.blist()) { if (b.state !== 'ok') continue; if (b.key === 'port') portBoost += 0.15; if (b.key === 'farm') farmCount++; }
    portBoost = Math.min(0.45, portBoost);
    for (const b of this.blist()) {
      if (b.state !== 'ok' || !b.def || !b.def.industry) continue;
      const d = b.def;
      let eff = (b.powered ? 1 : 0.15) * (b.watered || b.key === 'farm' ? 1 : 0.7);
      eff *= 0.55 + 0.45 * (this.jobFill || 0);
      // access
      if (this.accessOf(b) < 0) eff *= 0.5;
      let mult = 1 + portBoost * (b.key !== 'port' ? 1 : 0);
      if (b.key === 'distillery' || b.key === 'textile') mult += farmCount > 0 ? 0.25 : -0.15;
      if (b.key === 'refinery') { let hp = false; for (const o of this.blist()) if (o.key === 'port' && o.state === 'ok') hp = true; if (!hp) eff *= 0.2; }
      if (b.key === 'tech') eff *= this.skillFill * (0.5 + 0.5 * S.edu);
      if (b.key === 'resort') eff *= 0.55 + 0.45 * clamp(S.happy / 70, 0, 1) + 0.0;
      if (b.key === 'casino') mult += this.lawVal('casino');
      if (b.key === 'lumber') {
        const forest = this.treesAround(b, 8);
        if (forest <= 0) eff *= 0.1;
        else if (this.rng() < 0.05 && !this.lawVal('noCut') && !S.policies.sustainable) this.cutTree(b, 8);
        else if (S.policies.sustainable && this.rng() < 0.04) this.plantTree(b, 8);
      }
      for (const pid in S.policies) {
        if (!S.policies[pid]) continue;
        const pol = INDUSTRY_POLICIES[pid];
        if (!pol) continue;
        if (pol.ind === b.key || (pid === 'tourboard' && (b.key === 'casino' || d.tourism)) || (pid === 'crafthub' && b.key === 'textile')) mult += pol.mult;
      }
      mult *= 1 + this.lawVal('incomeInd') * 0.0;
      b.eff = eff;
      b.rev = d.revenue * eff * Math.max(0.1, mult) * (S.tax.i / 9) ** 0.5;
    }
  }
  accessOf(b) {
    const w = this.w;
    if (b.acc >= 0 && b.accRev === w.rev) return b.acc;
    let found = -1;
    outer: for (let j = -1; j <= b.d; j++) for (let i = -1; i <= b.w; i++) {
      if ((i >= 0 && i < b.w) && (j >= 0 && j < b.d)) continue;
      if ((i < 0 || i >= b.w) && (j < 0 || j >= b.d)) continue;
      const x = b.x + i, z = b.z + j;
      const t = w.roadAt(x, z);
      if (t >= 1 && t <= 5) { found = z * w.n + x; break outer; }
    }
    b.acc = found; b.accRev = w.rev;
    return found;
  }
  treesAround(b, r) {
    const w = this.w; let c = 0;
    for (let z = b.z - r; z < b.z + b.d + r; z++) for (let x = b.x - r; x < b.x + b.w + r; x++) if (w.inb(x, z) && w.tree[z * w.n + x]) c++;
    return c;
  }
  cutTree(b, r) {
    const w = this.w;
    for (let k = 0; k < 20; k++) {
      const x = b.x - r + ((this.rng() * (b.w + 2 * r)) | 0), z = b.z - r + ((this.rng() * (b.d + 2 * r)) | 0);
      if (w.inb(x, z) && w.tree[z * w.n + x]) { w.tree[z * w.n + x] = w.tree[z * w.n + x] === 2 ? 1 : 0; w.dirty.trees = true; w.markGround(x, z, x, z); return; }
    }
  }
  plantTree(b, r) {
    const w = this.w;
    for (let k = 0; k < 20; k++) {
      const x = b.x - r + ((this.rng() * (b.w + 2 * r)) | 0), z = b.z - r + ((this.rng() * (b.d + 2 * r)) | 0);
      if (w.inb(x, z) && w.tileFree(x, z) && !w.zone[z * w.n + x] && !w.water[z * w.n + x] && w.buildable(x, z)) { w.tree[z * w.n + x] = 1; w.dirty.trees = true; w.markGround(x, z, x, z); return; }
    }
  }

  // ------------------------------------------------------------ finance
  computeFinance() {
    const S = this.S, w = this.w, n = w.n;
    const inc = { Residential: 0, Commercial: 0, Office: 0, Industrial: 0, 'Special industries': 0, Tourism: 0, 'Fines & fees': 0, Recycling: 0, Transit: 0 };
    const exp = { Roads: 0, Services: 0, Utilities: 0, Parks: 0, 'Public transport': 0, Laws: 0, 'District policies': 0, Industries: 0, Loan: 0 };
    const hFactor = clamp(0.55 + S.happy / 120, 0.5, 1.1);
    const lvlW = [0, 0.8, 1.15, 1.7];
    const taxR = S.tax.r / 9, taxC = S.tax.c / 9, taxI = S.tax.i / 9, taxO = (S.tax.o === undefined ? 9 : S.tax.o) / 9;
    const IND_MUL = { factory: 1, agri: 0.9, forest: 1.05, ore: 1.25, oil: 1.6 };
    const n2 = n, m = this.maps;
    let busStops = 0;
    for (const b of this.blist()) {
      if (b.state !== 'ok') continue;
      if (b.kind === 'zone') {
        const ti = (b.z + (b.d >> 1)) * n2 + b.x + (b.w >> 1);
        const traffic = 1 - Math.max(0, S.traffic - 0.5) * 0.15;
        if (RES_ARCH.has(b.arch)) inc.Residential += b.occ * 4.2 * lvlW[b.level] * taxR * hFactor * (1 + this.lawVal('incomeRes'));
        if (IND_ARCH.has(b.arch)) {
          const res = (b.arch === 'ore' || b.arch === 'oil') && b.resLeft === 0 ? 0.2 : 1;
          inc.Industrial += b.workers * 5.6 * lvlW[b.level] * (IND_MUL[b.arch] || 1) * taxI * res * (b.powered ? 1 : 0.3) * (1 + this.lawVal('incomeInd') + this.dVal(ti, 'incomeInd')) * (1 + S.cargoRail * 0.06) * (this.dVal(ti, 'trucks') ? 0.92 : 1);
        } else if (b.arch === 'office') {
          inc.Office += b.workers * 6.8 * lvlW[b.level] * taxO * (b.powered ? 1 : 0.3) * Math.max(0.5, this.skillFill) * (1 + m.tele[ti] * 0.12 + this.dVal(ti, 'incomeOff')) * (S.outside ? 1.06 : 1) * traffic;
        } else if (b.jobs) {
          const small = b.arch === 'shop' && this.dVal(ti, 'smallbiz') ? 1.15 : 1;
          inc.Commercial += b.workers * 6.2 * lvlW[b.level] * taxC * small * (b.powered ? 1 : 0.3) * (1 + this.lawVal('incomeCom') + this.dVal(ti, 'incomeCom')) * (1 + S.tourism * 0.04 + m.post[ti] * 0.05) * (S.outside ? 1.08 : 1) * (S.airport ? 1.05 : 1) * traffic;
        }
      } else if (b.def) {
        const d = b.def;
        if (d.industry) inc['Special industries'] += b.rev || 0;
        const budget = this.budgetOf(d);
        const up = d.upkeep * (b.powered || d.power ? 1 : 0.6);
        if (d.cat === 'power' || d.cat === 'water') exp.Utilities += up;
        else if (d.industry) exp.Industries += up;
        else if (d.cat === 'parks' || d.cat === 'landmarks') exp.Parks += up * budget;
        else if (d.cat === 'transit') exp['Public transport'] += up * budget;
        else exp.Services += up * budget;
        if (d.income) inc.Recycling += d.income * (this.wasteRatio > 0 ? 1 : 0);
        if (d.tourism && !d.industry) inc.Tourism += d.tourism * 220 * (1 + this.lawVal('tourism'));
        if (d.fines) inc['Fines & fees'] += 150 * S.enforcement;
        if (d.cat === 'transit' && d.cov) busStops++;
      }
    }
    let roadUp = 0, parkTiles = 0;
    for (let i = 0; i < n * n; i++) { const t = w.road[i]; if (t) roadUp += ROADS[t].upkeep; if (w.park[i]) parkTiles++; if (w.pylon[i]) roadUp += 0.2; }
    exp.Roads = roadUp;
    exp.Parks += parkTiles * 0.35 * this.budgetScale('parks');
    let lawCost = 0;
    for (const id in S.laws) if (S.laws[id]) lawCost += LAWS[id].cost;
    exp.Laws = lawCost;
    for (const id in S.policies) if (S.policies[id] && INDUSTRY_POLICIES[id]) exp.Industries += INDUSTRY_POLICIES[id].cost * 0.5;
    inc['Fines & fees'] += S.pop * 0.12 * this.lawVal('fines') * S.enforcement;
    const evInc = this.evMul('income'); if (evInc !== 1) { inc.Commercial *= evInc; inc.Industrial *= evInc; inc['Special industries'] *= evInc; }
    inc.Transit = (S.transitFares || 0) + (S.airport ? 600 + S.pop * 0.05 : 0);
    const fees = S.fees || { power: 100, water: 100 };
    inc['Utility fees'] = (Math.min(S.power.demand, S.power.supply) * 30 * fees.power + Math.min(S.water.demand, S.water.supply) * 0.15 * fees.water) / 100;
    exp['Public transport'] += this.lineUpkeep();
    exp['District policies'] = this.districtPolicyCost();
    exp.Loan = S.loan * 0.012;
    const mul = 1 + this.lawVal('expenses');
    for (const k in exp) exp[k] *= mul;
    const ti = Object.values(inc).reduce((a, c) => a + c, 0), te = Object.values(exp).reduce((a, c) => a + c, 0);
    S.fin = { income: inc, expense: exp, inc: ti, exp: te, net: ti - te };
  }
  applyFinance() {
    const S = this.S;
    this.computeFinance();
    if (this.sandbox()) { S.money = 9999999; return; }
    S.money += S.fin.net / 30;
    if (S.money < -20000 && !this._bankruptWarned) { this._bankruptWarned = true; this.log('⚠️ The city is deep in debt! Raise taxes or cut spending.', 'bad'); }
    if (S.money > 0) this._bankruptWarned = false;
  }

  takeLoan(amt) { const S = this.S; if (S.loan + amt > 200000) return false; S.loan += amt; S.money += amt; this.log(`Took a loan of $${amt.toLocaleString()}.`, 'info'); return true; }
  repayLoan(amt) { const S = this.S; amt = Math.min(amt, S.loan, Math.max(0, S.money)); if (amt <= 0) return false; S.loan -= amt; S.money -= amt; return true; }

  monthStep() {
    const S = this.S;
    this.transitStep();
    S.hist.push({ y: S.year, m: S.month, pop: S.pop, money: Math.round(S.money), happy: Math.round(S.happy), net: Math.round(S.fin.net), inc: Math.round(S.fin.inc), exp: Math.round(S.fin.exp), jobs: S.jobsTotal, unemp: S.unemployment, crime: S.crime, pollution: S.pollution, edu: S.edu });
    if (S.hist.length > 240) S.hist.shift();
    if (S.month === 0 && this.G.ui && this.G.ui.autosave) this.G.ui.autosave();
    if (S.pop >= POP_CAP && !S.capReached) { S.capReached = true; this.log('🎉 Your city has reached the population cap of 25,000! It is now a Grand City.', 'good'); }
  }

  advise() {
    const S = this.S;
    const warn = (id, msg, type = 'warn') => {
      if (S.advisorCool[id] && S.totalDays - S.advisorCool[id] < 90) return;
      S.advisorCount = S.advisorCount || {};
      if ((S.advisorCount[id] || 0) >= (type === 'tip' ? 2 : 5)) return;
      S.advisorCount[id] = (S.advisorCount[id] || 0) + 1;
      S.advisorCool[id] = S.totalDays; this.log(msg, type);
    };
    if (S.pop < 20 && S.totalDays > 12) {
      let zoned = 0; for (let i = 0; i < this.w.zone.length; i++) if (isBuildZone(this.w.zone[i])) { zoned++; break; }
      if (zoned && !(S.power.supply > 0)) warn('np', '⚡ Zones need power and water before buildings appear. Build a Wind Turbine or Coal Plant, a Water Pump, and connect them to your roads.', 'tip');
      else if (zoned && !(S.water.supply > 0)) warn('nw', '💧 Build a Water Pump on the shore (or a Water Tower) and connect it by road.', 'tip');
      else if (zoned) warn('nr', '🛣️ Zoned land must touch a road that is connected to your power and water.', 'tip');
    }
    if (S.pop > 20) {
      if (this.pRatio < 0.95) warn('power', '⚡ Power shortage! Build more power plants.');
      if (this.wRatio < 0.95) warn('water', '💧 Water shortage! Add pumps or towers.');
      if (S.sewage.demand > 0 && S.sewage.cap < S.sewage.demand * 0.8) warn('sewage', '🚽 Sewage is overflowing into the rivers — build a treatment plant.');
      if (S.unemployment > 0.18) warn('unemp', '📉 High unemployment. Zone more commercial and industrial land.');
      if (S.jobsTotal > S.workforce * 1.3 && S.pop > 100) warn('workers', '🧑‍🔧 There are more jobs than workers — zone more housing.');
      if (S.crime > 38) warn('crime', '🚨 Crime is high. Build police stations.');
      if (S.traffic > 0.8) warn('traffic', '🚗 Traffic is gridlocked. Upgrade roads or add bus stops.');
      if (this.wasteRatio < 0.8) warn('waste', '🗑️ Garbage is piling up. Build more waste facilities.');
      if (S.health < 0.25 && S.pop > 300) warn('health', '🏥 Citizens are unhealthy. Build clinics and hospitals.');
      if (S.edu < 0.2 && S.pop > 400) warn('edu', '🏫 Few citizens are educated. Build schools.');
      if (!S.outside && S.pop > 800) warn('outside', '🛣️ Connect a highway or railway to the map edge (or build a port) to boost trade.', 'tip');
      if (S.fin.net < 0 && !this.sandbox() && S.pop > 100) warn('budget', '💸 The budget is running a deficit.');
      if (S.happy < 40) warn('happy', '😠 Citizens are unhappy. Check the happiness breakdown.');
      if (S.pop > 900 && (S.demand.o || 0) > 0.3) warn('office', '🏙️ Businesses want office space. Zone some Office land.', 'tip');
      if ((S.permits || 0) > 0 && !this.sandbox()) warn('permit', '🗺️ You can buy a new map area! Open Areas in the toolbar.', 'tip');
      if (S.pop > 1500 && S.traffic > 0.6 && !(S.lines || []).length) warn('lines', '🚌 Traffic is heavy. Create bus or metro lines (Transport → Line tools).', 'tip');
    }
  }

  checkMilestones() {
    const S = this.S;
    while (S.milestone + 1 < MILESTONES.length && S.popPeak >= MILESTONES[S.milestone + 1].pop) {
      S.milestone++;
      const m = MILESTONES[S.milestone];
      this.milestoneReward(m);
      this.log(`🏆 Milestone: ${m.name}! ${m.note}${m.reward && !this.sandbox() ? ` Reward: $${m.reward.toLocaleString()}.` : ''}${m.areas ? ` +${m.areas} land permit${m.areas > 1 ? 's' : ''}.` : ''}`, 'good');
      this.chirp(`We're officially a ${m.name}! 🎉`, 'good');
      if (this.G.ui && this.G.ui.onMilestone) this.G.ui.onMilestone(m);
    }
  }

  // ------------------------------------------------------------ queries
  tileInfo(x, z) {
    const w = this.w, n = w.n;
    if (!w.inb(x, z)) return null;
    const i = z * n + x, m = this.maps;
    return { x, z, h: w.tileAvg(x, z), water: !!w.water[i], road: w.road[i], zone: w.zone[i], bid: w.bid[i], tree: w.tree[i], park: w.park[i], pylon: w.pylon[i],
      lv: m.landvalue[i], pollution: m.pollution[i], noise: m.noise[i], crime: m.crime[i], happy: m.happy[i], police: m.police[i], fire: m.fire[i], health: m.health[i], edu: m.edu[i], power: this.pw[i], waterNet: this.wt[i] };
  }

  // ------------------------------------------------------------ save / load
  serialize() {
    const w = this.w;
    const S = JSON.parse(JSON.stringify(this.S, (k, v) => (v instanceof Map ? undefined : v)));
    const blds = [];
    for (const b of this.blist()) blds.push({ id: b.id, kind: b.kind, arch: b.arch, key: b.key, zone: b.zone, style: b.style, level: b.level, lw: b.lw, ld: b.ld, x: b.x, z: b.z, w: b.w, d: b.d, facing: b.facing, seed: b.seed, state: b.state === 'burning' ? 'ok' : b.state, timer: b.timer, occ: b.occ, age: b.age, noBid: b.noBid, fill: b.fill });
    S.activeDisasters = [];
    return { v: 2, S, world: w.toJSON(), blds };
  }
  load(data) {
    const w = this.w;
    const def = defaultState({ mode: data.S && data.S.mode });
    this.S = Object.assign(def, data.S);
    for (const k of ['tax', 'budget', 'demand']) this.S[k] = Object.assign({}, def[k], data.S[k] || {});
    this.S.activeDisasters = [];
    w.fromJSON(data.world);
    if (!data.world.areas) w.areas.fill(1);           // older saves: everything already owned
    const idMap = new Map();
    w.stops = new Map();
    if (this.G.view) { for (const c of this.G.view.chunks) { c.set.clear(); } }
    for (const o of data.blds) {
      const st = o.state, occ = o.occ, timer = o.timer, age = o.age, fill = o.fill;
      const rec = Object.assign({}, o); delete rec.state; delete rec.timer; delete rec.occ; delete rec.age; delete rec.fill; delete rec.id;
      // v1 saves: offices lived in the Commercial High zone; move them to the new Office zone
      if ((data.v || 1) < 2 && rec.kind === 'zone' && rec.arch === 'office') rec.zone = 9;
      const b = this.addBuilding(rec, { instant: st !== 'construct' });
      if (o.id) idMap.set(o.id, b.id);
      if ((data.v || 1) < 2 && rec.kind === 'zone' && rec.arch === 'office') for (let j = 0; j < b.d; j++) for (let i = 0; i < b.w; i++) w.zone[(b.z + j) * w.n + b.x + i] = 9;
      if (st === 'construct') b.timer = Math.max(1, timer || 2);
      else if (st !== 'ok') {
        b.state = st; b.timer = timer || 10;
        b.tintMul = st === 'abandoned' ? [0.45, 0.43, 0.42] : [0.16, 0.15, 0.15];
        if (this.G.view) this.G.view.markChunk(b);
      }
      b.occ = occ || 0; b.age = age || 0; if (fill) b.fill = fill;
    }
    // metro lines refer to station building ids, which change on reload
    for (const l of this.S.lines || []) if (l.type === 'metro') l.stops = l.stops.map((k) => idMap.get(k) || k);
    this.recomputeLaws(); this.recomputeDistrictFx();
    this.computeNetworks(); this.updateUtilities(); this.updateEconomyStats(); this.updateMaps(true); this.candRev = -1;
    this.accum = 0;
  }
}

Object.assign(Sim.prototype, SimExt);
