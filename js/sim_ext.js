// Simulation systems layered onto Sim: districts & policies, map areas, natural resources,
// public transport lines, deathcare, disasters and the Chirper feed.
import { clamp, lerp, pick, mulberry32 } from './util.js';
import { BUILDINGS, DISTRICT_COLORS, DISTRICT_POLICIES, SPECIALIZATIONS, AREA_N, AREA_SIZE, areaPrice, R, POP_CAP, MILESTONES } from './data.js';
import { DX, DZ } from './world.js';

const DISTRICT_NAMES = ['Old Town', 'Harborside', 'Riverside', 'Hillcrest', 'Market Quarter', 'Elm Park', 'Northgate', 'Southbank', 'Westfield', 'Eastbrook', 'Mill District', 'Kingsway', 'Brightwater', 'Oak Hollow', 'Chapel Hill', 'Foundry Row', 'Lantern Square', 'Cedar Heights'];
const LINE_COLORS = ['#e53935', '#1e88e5', '#43a047', '#fb8c00', '#8e24aa', '#00acc1', '#fdd835', '#6d4c41', '#d81b60', '#3949ab'];
const FIRST = ['Ava', 'Ben', 'Cleo', 'Dan', 'Eli', 'Fay', 'Gus', 'Hana', 'Ivy', 'Jack', 'Kit', 'Lola', 'Max', 'Nia', 'Owen', 'Pia', 'Quinn', 'Rosa', 'Sam', 'Tess', 'Uma', 'Vic', 'Wren', 'Xan', 'Yara', 'Zed', 'Mabel', 'Otis', 'June', 'Rufus', 'Hattie', 'Silas', 'Clara', 'Amos', 'Della', 'Ezra'];
const LAST = ['Smith', 'Baker', 'Hale', 'Moreau', 'Okafor', 'Ng', 'Rossi', 'Kowalski', 'Brennan', 'Delgado', 'Fischer', 'Ivers', 'Larsen', 'Mbeki', 'Patel', 'Quigley', 'Sato', 'Thorne', 'Varga', 'Whitlock', 'Ashby', 'Caldwell', 'Pemberton', 'Beaumont'];
export function cimName(rng) { return pick(rng, FIRST) + ' ' + pick(rng, LAST); }

export const DISASTERS = {
  meteor: { name: 'Meteor strike', icon: '☄️', minPop: 2000 },
  tornado: { name: 'Tornado', icon: '🌪️', minPop: 1500 },
  earthquake: { name: 'Earthquake', icon: '🌋', minPop: 3000 },
  forestfire: { name: 'Forest fire', icon: '🔥', minPop: 600 },
};

export const SimExt = {
  // ================================================================ budgets
  budgetKeyOf(def) {
    if (!def) return null;
    if (def.cov === 'death') return 'health';
    if (def.cov === 'post' || def.cov === 'tele') return 'comms';
    if (def.cov === 'shelter' || def.cov === 'dru') return 'fire';
    return { police: 'police', fire: 'fire', health: 'health', education: 'edu', waste: 'waste', transit: 'transit', parks: 'parks', landmarks: 'parks' }[def.cat] || null;
  },

  // ================================================================ map areas
  ownsTile(x, z) { return this.sandbox() || this.w.owned(x, z); },
  ownedCount() { let c = 0; for (const a of this.w.areas) if (a) c++; return c; },
  areaBuyable(k) {
    const w = this.w;
    if (w.areas[k]) return false;
    const ax = k % AREA_N, az = (k / AREA_N) | 0;
    for (let d = 0; d < 4; d++) { const x = ax + DX[d], z = az + DZ[d]; if (x >= 0 && z >= 0 && x < AREA_N && z < AREA_N && w.areas[z * AREA_N + x]) return true; }
    return false;
  },
  areaCost() { return areaPrice(this.ownedCount()); },
  buyArea(k) {
    const S = this.S;
    if (!this.areaBuyable(k)) return { ok: false, reason: 'Must border land you own' };
    if (!this.sandbox() && (S.permits || 0) <= 0) return { ok: false, reason: 'Reach the next milestone to unlock another area' };
    const c = this.areaCost();
    if (!this.canAfford(c)) return { ok: false, reason: 'Not enough money' };
    this.spend(c);
    if (!this.sandbox()) S.permits--;
    this.w.areas[k] = 1;
    this.w.markGround(0, 0, this.w.n - 1, this.w.n - 1);
    this.touchWorld();
    this.log(`🗺️ New land purchased for $${c.toLocaleString()}.`, 'good');
    this.chirp('New land! Can\'t wait to see what gets built out there. 🏗️', 'good');
    return { ok: true };
  },

  // ================================================================ natural resources
  resourceAt(i, kind) {
    const w = this.w;
    if (kind === 'forest') {
      const n = w.n, x = i % n, z = (i / n) | 0;
      let c = 0;
      for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) { const a = x + dx, b = z + dz; if (w.inb(a, b) && w.tree[b * n + a]) c++; }
      return Math.min(255, c * 9);
    }
    return w[kind] ? w[kind][i] : 0;
  },
  /** ore & oil are used up slowly by the buildings sitting on them */
  depleteResources() {
    const w = this.w, n = w.n;
    for (const b of this.blist()) {
      if (b.state !== 'ok' || b.kind !== 'zone' || (b.arch !== 'ore' && b.arch !== 'oil')) continue;
      const arr = w[b.arch];
      let left = 0;
      for (let j = 0; j < b.d; j++) for (let k = 0; k < b.w; k++) {
        const i = (b.z + j) * n + b.x + k;
        if (arr[i] > 0 && this.rng() < 0.12) arr[i] = Math.max(0, arr[i] - 1);
        left += arr[i];
      }
      b.resLeft = left / (b.w * b.d * 255);
      if (left === 0 && !b.depletedWarn) { b.depletedWarn = true; this.log(`${b.arch === 'ore' ? '⛏️ A mine' : '🛢️ An oil field'} has run dry.`, 'warn'); }
    }
  },

  // ================================================================ districts
  newDistrict(name) {
    const S = this.S;
    S.districts = S.districts || [];
    let id = 1; while (S.districts.some((d) => d.id === id) && id < 250) id++;
    const used = new Set(S.districts.map((d) => d.name));
    const nm = name || DISTRICT_NAMES.find((x) => !used.has(x)) || ('District ' + id);
    const d = { id, name: nm, color: DISTRICT_COLORS[(id - 1) % DISTRICT_COLORS.length], policies: {} };
    S.districts.push(d);
    return d;
  },
  districtById(id) { return (this.S.districts || []).find((d) => d.id === id) || null; },
  removeDistrict(id) {
    const S = this.S, w = this.w;
    S.districts = (S.districts || []).filter((d) => d.id !== id);
    for (let i = 0; i < w.dist.length; i++) if (w.dist[i] === id) w.dist[i] = 0;
    this.recomputeDistrictFx(); this.touchWorld();
  },
  paintDistrict(x, z, id) {
    const w = this.w;
    if (!w.inb(x, z)) return false;
    const i = z * w.n + x;
    if (w.dist[i] === id) return false;
    w.dist[i] = id;
    return true;
  },
  recomputeDistrictFx() {
    this.dfx = {};
    for (const d of this.S.districts || []) {
      const fx = {};
      for (const pid in d.policies) {
        if (!d.policies[pid]) continue;
        const P = DISTRICT_POLICIES[pid]; if (!P) continue;
        if (P.spec) fx.spec = P.spec;
        for (const k in P.fx || {}) fx[k] = (fx[k] || 0) + P.fx[k];
        if (P.fx && P.fx.maxLevel) fx.maxLevel = Math.min(fx.maxLevel || 9, P.fx.maxLevel);
      }
      this.dfx[d.id] = fx;
    }
  },
  /** sum of district-policy effect `key` at tile index i */
  dVal(i, key) {
    const id = this.w.dist[i];
    if (!id || !this.dfx) return 0;
    const fx = this.dfx[id];
    return fx ? fx[key] || 0 : 0;
  },
  districtOfBuilding(b) { return this.w.dist[(b.z + (b.d >> 1)) * this.w.n + b.x + (b.w >> 1)]; },
  districtStats(id) {
    const st = { pop: 0, jobs: 0, workers: 0, happy: 0, hn: 0, buildings: 0, lv: 0 };
    const n = this.w.n;
    for (const b of this.blist()) {
      if (b.state !== 'ok' || this.districtOfBuilding(b) !== id) continue;
      st.buildings++;
      const i = (b.z + (b.d >> 1)) * n + b.x + (b.w >> 1);
      if (b.occ) { st.pop += b.occ; st.happy += this.maps.happy[i] * b.occ; st.hn += b.occ; }
      st.jobs += b.jobs || 0; st.workers += b.workers || 0; st.lv += this.maps.landvalue[i];
    }
    st.happy = st.hn ? st.happy / st.hn : 0; st.lv = st.buildings ? st.lv / st.buildings : 0;
    return st;
  },
  districtPolicyCost() {
    let c = 0;
    const counts = {};
    for (const b of this.blist()) { if (b.state !== 'ok') continue; const id = this.districtOfBuilding(b); if (id) counts[id] = (counts[id] || 0) + 1; }
    for (const d of this.S.districts || []) for (const pid in d.policies) if (d.policies[pid] && DISTRICT_POLICIES[pid]) c += DISTRICT_POLICIES[pid].cost * (counts[d.id] || 0);
    return c;
  },

  // ================================================================ public transport lines
  newLine(type) {
    const S = this.S;
    S.lines = S.lines || [];
    let id = 1; while (S.lines.some((l) => l.id === id)) id++;
    const same = S.lines.filter((l) => l.type === type).length;
    const line = { id, type, name: (type === 'metro' ? 'Metro ' : 'Bus ') + (same + 1), color: LINE_COLORS[(id - 1) % LINE_COLORS.length], stops: [], vehicles: type === 'metro' ? 2 : 2, riders: 0, active: true };
    S.lines.push(line);
    return line;
  },
  removeLine(id) { this.S.lines = (this.S.lines || []).filter((l) => l.id !== id); this.mapsDirty = true; if (this.G.traffic) this.G.traffic.linesRev = -1; },
  /** stop key: bus stops by tile index, metro stations by building id */
  lineStopValid(line, key) {
    if (line.type === 'bus') return this.w.stops && this.w.stops.has(key);
    const b = this.w.buildings.get(key); return !!(b && b.key === 'metro');
  },
  stopPos(line, key) {
    const n = this.w.n;
    if (line.type === 'bus') return { x: key % n, z: (key / n) | 0 };
    const b = this.w.buildings.get(key); return b ? { x: b.x, z: b.z } : null;
  },
  cleanLines() {
    for (const l of this.S.lines || []) l.stops = l.stops.filter((k) => this.lineStopValid(l, k));
  },
  hasDepot() { for (const b of this.blist()) if (b.key === 'bus_depot' && b.state === 'ok') return true; return false; },
  /** monthly ridership & fares; also stamps transit coverage for served stops */
  transitStep() {
    const S = this.S, n = this.w.n, m = this.maps;
    this.cleanLines();
    const depot = this.hasDepot();
    let fares = 0, riders = 0;
    for (const l of S.lines || []) {
      l.ok = l.stops.length >= 2 && (l.type === 'metro' || depot);
      if (!l.ok) { l.riders = 0; continue; }
      let demand = 0;
      for (const k of l.stops) {
        const p = this.stopPos(l, k); if (!p) continue;
        const r = l.type === 'metro' ? 9 : 6;
        for (const b of this.blist()) {
          if (b.state !== 'ok' || !b.occ) continue;
          const dx = b.x - p.x, dz = b.z - p.z;
          if (dx * dx + dz * dz < r * r) demand += b.occ;
        }
      }
      const cap = l.vehicles * (l.type === 'metro' ? 900 : 240) * (0.6 + 0.4 * this.budgetScale('transit'));
      l.riders = Math.round(Math.min(cap, demand * 0.18 * (1 + S.traffic * 0.4)));
      riders += l.riders;
      fares += l.riders * (l.type === 'metro' ? 2.4 : 1.6);
    }
    S.transitRiders = riders;
    S.transitFares = this.law.cars ? fares * 0.15 : fares;
  },
  /** coverage contribution of line stops (called from updateMaps) */
  stampLineCoverage(stamp) {
    const depot = this.hasDepot();
    for (const l of this.S.lines || []) {
      if (l.stops.length < 2 || (l.type === 'bus' && !depot)) continue;
      const bud = 0.55 + 0.45 * this.budgetScale('transit');
      for (const k of l.stops) { const p = this.stopPos(l, k); if (p) stamp(this.maps.transit, p.x + 0.5, p.z + 0.5, l.type === 'metro' ? 14 : 9, bud, 0.55); }
    }
  },
  lineUpkeep() {
    let c = 0;
    for (const l of this.S.lines || []) if (l.stops.length >= 2) c += l.vehicles * (l.type === 'metro' ? 260 : 70);
    return c * this.budgetScale('transit');
  },

  // ================================================================ deathcare
  deathStep() {
    const S = this.S;
    const D = S.death || (S.death = { backlog: 0, rate: 0, cap: 0, buried: 0 });
    const rate = S.pop * 0.0004 * (1.5 - S.health * 0.7);
    let cap = 0;
    for (const b of this.blist()) {
      if (b.state !== 'ok' || !b.def || b.def.cov !== 'death' || !b.powered) continue;
      if (b.key === 'cemetery') { b.fill = b.fill || 0; if (b.fill >= b.def.storage) continue; }
      const c = b.def.cap / 30 * (0.6 + 0.4 * this.budgetScale('health'));
      cap += c;
      if (b.key === 'cemetery') b.fill += Math.min(c, rate);
    }
    D.rate = rate; D.cap = cap;
    D.backlog = clamp(D.backlog + rate - cap, 0, 5000);
    if (D.backlog > 40) this.advisorWarn('death', '🪦 The deceased are piling up in homes. Build a cemetery or crematorium.');
  },
  advisorWarn(id, msg) {
    const S = this.S;
    if (S.advisorCool[id] && S.totalDays - S.advisorCool[id] < 90) return;
    S.advisorCool[id] = S.totalDays; this.log(msg, 'warn');
  },

  // ================================================================ chirper
  chirp(msg, mood = 'info') {
    const S = this.S;
    const name = cimName(this.rng);
    S.chirps = S.chirps || [];
    const c = { name, handle: '@' + name.split(' ')[0].toLowerCase() + (((this.rng() * 90) | 0) + 10), msg, mood, date: this.dateStr(), t: S.totalDays, avatar: pick(this.rng, ['🙂', '😄', '😎', '🤓', '😊', '🧐', '😺', '🤠', '👩', '👨', '👵', '👴', '🧑‍🎨', '👩‍🔧', '👨‍🍳']) };
    S.chirps.unshift(c);
    if (S.chirps.length > 40) S.chirps.pop();
    if (this.G.ui && this.G.ui.onChirp) this.G.ui.onChirp(c);
  },
  chirpStep() {
    const S = this.S;
    if (S.pop < 20 || this.rng() > 0.09) return;
    const lines = [];
    const W = S.weather || {};
    if (S.happy > 75) lines.push(['Honestly the best city I\'ve ever lived in. ❤️', 'good'], ['Walked past the park this morning — so lovely here!', 'good']);
    if (S.happy < 40) lines.push(['Is anyone at City Hall listening?? 😤', 'bad'], ['Thinking about moving away tbh.', 'bad']);
    if (S.traffic > 0.7) lines.push(['Stuck in traffic AGAIN. We need more lanes or a metro! 🚗🚗🚗', 'bad'], ['45 minutes to go three blocks. Love that for me.', 'bad']);
    if (S.crime > 35) lines.push(['Another break-in on my street. More police please 🚓', 'bad']);
    if (S.pollution > 30) lines.push(['The air smells like a factory. Coughing all day 😷', 'bad']);
    if (S.unemployment > 0.12) lines.push(['Day 40 of job hunting. Anyone hiring? 📄', 'bad']);
    if (S.edu > 0.6) lines.push(['Just graduated! 🎓 Proud of this city\'s schools.', 'good']);
    if (W.type === 'rain' || W.type === 'storm') lines.push(['Rain rain go away ☔', 'info'], ['Perfect weather for staying in with a book 📚', 'info']);
    if (W.type === 'snow') lines.push(['SNOW DAY!! ⛄❄️', 'good'], ['Who plowed my street? Nobody, that\'s who. 🥶', 'bad']);
    if (W.type === 'clear' && S.month >= 5 && S.month <= 7) lines.push(['Beach weather! ☀️🏖️', 'good']);
    if (S.month === 9) lines.push(['The leaves are turning! 🍁 Autumn here is gorgeous.', 'good']);
    if (S.tourism > 2) lines.push(['So many tourists downtown today 📸', 'info']);
    if ((S.death && S.death.backlog > 30)) lines.push(['Grandpa has been… waiting… for a hearse for a week. 😟', 'bad']);
    if (S.transitRiders > 200) lines.push(['Love taking the bus to work. Read a whole novel this month 🚌', 'good']);
    lines.push(['Grabbing coffee downtown ☕', 'info'], ['Nice day for a walk.', 'info'], [`${S.name} is growing so fast! 🏗️`, 'good']);
    const [msg, mood] = pick(this.rng, lines);
    this.chirp(msg, mood);
  },

  // ================================================================ milestones with rewards
  milestoneReward(m) {
    const S = this.S;
    if (!this.sandbox() && m.reward) S.money += m.reward;
    S.permits = (S.permits || 0) + (m.areas || 0);
  },

  // ================================================================ disasters
  disasterStep() {
    const S = this.S;
    if (S.disasters === false || S.pop < 600) return;
    if (this.rng() > 1 / 420) return;
    const opts = Object.keys(DISASTERS).filter((k) => S.pop >= DISASTERS[k].minPop);
    if (!opts.length) return;
    this.triggerDisaster(pick(this.rng, opts));
  },
  /** pick a target near the city: a random building */
  disasterTarget() {
    const arr = Array.from(this.blist()).filter((b) => b.state === 'ok' && !b.noBid);
    if (!arr.length) return { x: this.w.n / 2, z: this.w.n / 2 };
    const b = arr[(this.rng() * arr.length) | 0];
    return { x: b.x + b.w / 2 + (this.rng() - 0.5) * 6, z: b.z + b.d / 2 + (this.rng() - 0.5) * 6 };
  },
  triggerDisaster(kind, x, z) {
    const S = this.S;
    if (x === undefined) { const t = kind === 'forestfire' ? this.forestTarget() : this.disasterTarget(); if (!t) return false; x = t.x; z = t.z; }
    const D = DISASTERS[kind];
    S.activeDisasters = S.activeDisasters || [];
    S.stats.disasters = (S.stats.disasters || 0) + 1;
    if (kind === 'meteor') {
      S.activeDisasters.push({ kind, x, z, t: 0, impact: 3.0, r: 3.2 });
      this.log(`☄️ A meteor is heading for the city! Impact imminent.`, 'bad');
    } else if (kind === 'tornado') {
      const a = this.rng() * Math.PI * 2;
      S.activeDisasters.push({ kind, x: x - Math.cos(a) * 18, z: z - Math.sin(a) * 18, vx: Math.cos(a) * 1.6, vz: Math.sin(a) * 1.6, t: 0, life: 24, r: 1.6 });
      this.log(`🌪️ Tornado warning! Take shelter!`, 'bad');
    } else if (kind === 'earthquake') {
      S.activeDisasters.push({ kind, x, z, t: 0, life: 4, r: 18 });
      this.log(`🌋 Earthquake! Buildings are shaking.`, 'bad');
    } else if (kind === 'forestfire') {
      S.activeDisasters.push({ kind, x, z, t: 0, life: 40, front: [[Math.floor(x), Math.floor(z)]] });
      this.log(`🔥 A forest fire has broken out!`, 'bad');
    }
    this.chirp(pick(this.rng, ['OMG is this really happening?! 😱', 'Everyone stay safe out there 🙏', 'Sirens everywhere. Scary night.']), 'bad');
    if (this.G.view && this.G.view.onDisaster) this.G.view.onDisaster(S.activeDisasters[S.activeDisasters.length - 1]);
    return true;
  },
  forestTarget() {
    const w = this.w, n = w.n;
    for (let k = 0; k < 200; k++) { const x = (this.rng() * n) | 0, z = (this.rng() * n) | 0; if (w.tree[z * n + x] === 2) return { x, z }; }
    for (let k = 0; k < 400; k++) { const x = (this.rng() * n) | 0, z = (this.rng() * n) | 0; if (w.tree[z * n + x]) return { x, z }; }
    return null;
  },
  /** destroy buildings in a radius; casualties reduced by shelter coverage */
  damageArea(x, z, r, chance = 1, cause = 'disaster') {
    const S = this.S, n = this.w.n;
    let lost = 0, hit = 0;
    for (const b of Array.from(this.blist())) {
      if (b.noBid || b.state === 'ruin') continue;
      const cx = b.x + b.w / 2, cz = b.z + b.d / 2;
      const d = Math.hypot(cx - x, cz - z);
      if (d > r + Math.max(b.w, b.d) * 0.4) continue;
      if (this.rng() > chance * (1 - d / (r + 2) * 0.5)) continue;
      const i = (b.z + (b.d >> 1)) * n + b.x + (b.w >> 1);
      const shelter = this.maps.shelter ? this.maps.shelter[i] : 0;
      lost += Math.round((b.occ || 0) * 0.5 * (1 - shelter * 0.85));
      hit++;
      this.ruin(b);
    }
    if (lost) { S.pop = Math.max(0, S.pop - lost); S.stats.casualties = (S.stats.casualties || 0) + lost; }
    return { hit, lost };
  },
  ruin(b) {
    if (b.state === 'burning' && this.G.view) this.G.view.setFire(b, false);
    const dru = this.maps.dru ? this.maps.dru[(b.z + (b.d >> 1)) * this.w.n + b.x + (b.w >> 1)] : 0;
    b.state = 'ruin'; b.timer = Math.round(30 * (1 - dru * 0.75)) + 4; b.occ = 0; b.workers = 0; b.tintMul = [0.22, 0.2, 0.19];
    if (this.G.view) { this.G.view.markChunk(b); this.G.view.dust(b, 1.4, [0.5, 0.46, 0.4]); }
  },
  /** per-frame disaster animation & effects (real time, scaled by game speed) */
  disasterUpdate(dt) {
    const S = this.S;
    if (!S.activeDisasters || !S.activeDisasters.length) return;
    const sp = [0, 1, 2, 3.5][S.speed] || 0;
    const sdt = dt * sp;
    const w = this.w, n = w.n;
    for (const d of S.activeDisasters) {
      d.t += sdt;
      if (d.kind === 'meteor') {
        if (!d.done && d.t >= d.impact) {
          d.done = true;
          const res = this.damageArea(d.x, d.z, d.r, 1);
          // crater
          w.brush('lower', d.x, d.z, d.r * 0.9, 0.9);
          for (let k = 0; k < 40; k++) { const a = this.rng() * 6.28, r = this.rng() * d.r; const tx = Math.floor(d.x + Math.cos(a) * r), tz = Math.floor(d.z + Math.sin(a) * r); if (w.inb(tx, tz)) { w.tree[tz * n + tx] = 0; } }
          w.dirty.trees = true; this.touchWorld();
          this.log(`☄️ Meteor impact! ${res.hit} buildings destroyed${res.lost ? `, ${res.lost} casualties` : ''}.`, 'bad');
          if (this.G.view) this.G.view.impact(d.x, d.z, d.r);
        }
        d.dead = d.t > d.impact + 2;
      } else if (d.kind === 'tornado') {
        d.x += d.vx * sdt; d.z += d.vz * sdt;
        d.vx += (this.rng() - 0.5) * 0.4 * sdt; d.vz += (this.rng() - 0.5) * 0.4 * sdt;
        d.acc = (d.acc || 0) + sdt;
        if (d.acc > 0.5) { d.acc = 0; this.damageArea(d.x, d.z, d.r, 0.35); const tx = Math.floor(d.x), tz = Math.floor(d.z); for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (w.inb(tx + dx, tz + dz)) w.tree[(tz + dz) * n + tx + dx] = 0; w.dirty.trees = true; }
        d.dead = d.t > d.life || d.x < -20 || d.z < -20 || d.x > n + 20 || d.z > n + 20;
      } else if (d.kind === 'earthquake') {
        d.acc = (d.acc || 0) + sdt;
        if (d.acc > 0.6) { d.acc = 0; for (let k = 0; k < 3; k++) { const a = this.rng() * 6.28, r = this.rng() * d.r; this.damageArea(d.x + Math.cos(a) * r, d.z + Math.sin(a) * r, 0.8, 0.5); } }
        d.dead = d.t > d.life;
        if (this.G.view) this.G.view.shake = Math.max(this.G.view.shake || 0, d.dead ? 0 : 0.35);
      } else if (d.kind === 'forestfire') {
        d.acc = (d.acc || 0) + sdt;
        if (d.acc > 0.35 && d.front.length) {
          d.acc = 0;
          const rain = S.weather && (S.weather.type === 'rain' || S.weather.type === 'storm' || S.weather.type === 'snow');
          const next = [];
          for (const [x, z] of d.front) {
            const i = z * n + x;
            if (!w.inb(x, z)) continue;
            if (w.tree[i]) { w.tree[i] = 0; w.dirty.trees = true; if (this.G.view) this.G.view.burnTile(x, z); }
            for (let k = 0; k < 4; k++) {
              const a = x + DX[k], b = z + DZ[k];
              if (!w.inb(a, b)) continue;
              const j = b * n + a;
              if (w.tree[j] && this.rng() < (rain ? 0.25 : 0.62)) next.push([a, b]);
              else if (w.bid[j] && this.rng() < 0.05) { const bb = w.buildings.get(w.bid[j]); if (bb && bb.state === 'ok') this.ignite(bb); }
            }
          }
          let x0 = n, z0 = n, x1 = 0, z1 = 0;
          for (const [x, z] of d.front) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
          if (d.front.length) w.markGround(x0 - 1, z0 - 1, x1 + 1, z1 + 1);
          d.front = next.slice(0, 160);
        }
        d.dead = d.t > d.life || !d.front.length;
      }
    }
    const before = S.activeDisasters.length;
    S.activeDisasters = S.activeDisasters.filter((d) => !d.dead);
    if (before && !S.activeDisasters.length && this.G.view) this.G.view.shake = 0;
  },
};
