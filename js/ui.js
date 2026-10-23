// DOM user interface.
import { clamp, fmtMoney, fmtNum, cityName, mulberry32 } from './util.js';
import { World } from './world.js';
import {
  STYLES, ZONE_INFO, Z, ROADS, BUILDINGS, INDUSTRIES, INDUSTRY_POLICIES, LAWS, CATEGORIES, TERRAIN_TOOLS, OVERLAYS, MILESTONES, POP_CAP, ARCH_INFO, R, LOT_TYPES,
} from './data.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const TEMPLATES = [
  { id: 'coast', name: 'Coastal Bay', desc: 'Sea on one side, rolling shore' },
  { id: 'river', name: 'River Valley', desc: 'Fertile land split by a river' },
  { id: 'island', name: 'Island', desc: 'Surrounded by sea' },
  { id: 'lakes', name: 'Lakeland', desc: 'Lakes among green meadows' },
  { id: 'delta', name: 'River Delta', desc: 'A river fanning into the sea' },
  { id: 'highlands', name: 'Highlands', desc: 'Hills, mines and a mountain river' },
  { id: 'archipelago', name: 'Archipelago', desc: 'Scattered islands — bridges ahead' },
  { id: 'plains', name: 'Open Plains', desc: 'Gentle grassland' },
  { id: 'flat', name: 'Blank Canvas', desc: 'Flat land — sculpt it yourself' },
];

const ARCH_NAMES = {
  house: ['Cottage', 'House', 'Mansion'], apt: ['Rowhouses', 'Apartments', 'Residential Tower'],
  shop: ['Shop', 'Store', 'Emporium'], office: ['Counting House', 'Office Block', 'Skyscraper'], factory: ['Workshop', 'Factory', 'Industrial Plant'],
};

const FX_LABEL = {
  crime: ['Crime', -1], happy: ['Happiness', 1], incomeCom: ['Commerce income', 1], incomeInd: ['Industry income', 1], incomeRes: ['Tax income', 1], traffic: ['Traffic speed', 1],
  fines: ['Fine income', 1], accidents: ['Accidents', -1], health: ['Health', 1], waste: ['Waste', -1], pollution: ['Pollution', -1], noise: ['Noise', -1], fire: ['Fire risk', -1],
  growth: ['Growth', 1], edu: ['Education', 1], tourism: ['Tourism', 1], landValue: ['Land value', 1], fireInd: ['Industrial fires', -1], cars: ['Car trips', -1], casino: ['Casino income', 1],
  expenses: ['Expenses', -1], noCut: ['Protects forests', 1],
};

export class UI {
  constructor(G) {
    this.G = G;
    this.root = document.getElementById('ui');
    this.cat = null;
    this.activeOverlay = 'none';
    this.autoOverlay = null;
    this.manualOverlay = false;
    this.tipEl = null;
    this.snd = { on: true, ctx: null };
    this.settings = { quality: 'high', cycle: 'auto', sound: true, autosave: true };
    this.refreshT = 0; this.ovT = 0;
    this.modal = null;
    this.loadSettings();
  }

  loadSettings() {
    try { const s = JSON.parse(localStorage.getItem('fcb-settings') || 'null'); if (s) Object.assign(this.settings, s); } catch (_) { }
  }
  saveSettings() { try { localStorage.setItem('fcb-settings', JSON.stringify(this.settings)); } catch (_) { } }

  // ================================================================ init
  init() {
    this.root.innerHTML = `
      <div id="hud-top"></div>
      <div id="news"></div>
      <div id="legend" class="hidden"></div>
      <div id="minimap" class="panel"><canvas id="mm" width="256" height="256"></canvas></div>
      <div id="info" class="panel hidden"></div>
      <div id="dock">
        <div id="stylebar" class="panel hidden"></div>
        <div id="brushbar" class="panel hidden"></div>
        <div id="subbar" class="panel hidden"></div>
        <div id="toolbar" class="panel"></div>
      </div>
      <div id="tip" class="tip hidden"></div>
      <div id="toasts"></div>
      <div id="modal-layer" class="hidden"></div>
      <div id="start" class="hidden"></div>
      <div id="loading"><div class="load-box"><div class="load-title">Fantasy City Builder</div><div class="load-bar"><div id="load-fill"></div></div><div id="load-msg">Preparing the realm…</div></div></div>`;
    this.tipEl = $('#tip');
    this.buildHUD();
    this.buildToolbar();
    this.applySettings();
    document.addEventListener('keydown', (e) => this.onKey(e));
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.autosave(); });
    window.addEventListener('beforeunload', () => this.autosave());
    document.addEventListener('pointerdown', () => this.ensureAudio(), { once: true });
    document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('button'); if (b) b.blur(); });
    this.bindMinimap();
  }

  // ================================================================ minimap
  bindMinimap() {
    const cv = $('#mm');
    this.mmImg = cv.getContext('2d').createImageData(256, 256);
    const go = (e) => {
      const r = cv.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * this.G.world.n, z = ((e.clientY - r.top) / r.height) * this.G.world.n;
      this.G.cam.focus(clamp(x, 0, this.G.world.n), clamp(z, 0, this.G.world.n));
    };
    let down = false;
    cv.addEventListener('pointerdown', (e) => { down = true; cv.setPointerCapture(e.pointerId); go(e); e.stopPropagation(); });
    cv.addEventListener('pointermove', (e) => { if (down) go(e); });
    cv.addEventListener('pointerup', () => { down = false; });
    this.mmT = 0;
  }
  updateMinimap(dt) {
    this.mmT -= dt;
    if (this.mmT > 0 || !this.G.started) return;
    this.mmT = 1.2;
    const G = this.G, w = G.world, n = w.n, sim = G.sim;
    const cv = $('#mm'), g = cv.getContext('2d'), d = this.mmImg.data;
    const S2 = 256, sc = S2 / n;
    for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) {
      const i = z * n + x;
      let r, gg, b;
      const h = w.tileAvg(x, z);
      if (w.water[i]) { const t = clamp(-h / 2.5, 0, 1); r = 52 - t * 30; gg = 120 - t * 52; b = 178 - t * 40; }
      else if (h < 0.3) { r = 214; gg = 200; b = 150; }
      else if (w.tree[i]) { r = 54; gg = 104; b = 56; }
      else if (h > 4) { r = 140; gg = 134; b = 124; }
      else if (h > 2.6) { r = 116; gg = 140; b = 84; }
      else { r = 108; gg = 160; b = 82; }
      const rt = w.road[i];
      const bd = w.bid[i] ? w.buildings.get(w.bid[i]) : null;
      if (rt) { const hw = rt === R.HIGHWAY; r = hw ? 240 : rt === R.RAIL ? 90 : 168; gg = hw ? 180 : rt === R.RAIL ? 70 : 168; b = hw ? 60 : rt === R.RAIL ? 60 : 168; }
      else if (bd) {
        if (bd.kind === 'zone') { const c = ZONE_INFO[bd.zone] ? ZONE_INFO[bd.zone].color : [200, 200, 200]; r = c[0] * 0.85; gg = c[1] * 0.85; b = c[2] * 0.85; }
        else if (bd.def && bd.def.industry) { r = 232; gg = 190; b = 70; }
        else { r = 238; gg = 238; b = 246; }
        if (bd.state === 'abandoned' || bd.state === 'ruin') { r *= 0.45; gg *= 0.45; b *= 0.45; }
        if (bd.state === 'burning') { r = 255; gg = 90; b = 30; }
      } else if (w.zone[i] && w.zone[i] <= 5) { const c = ZONE_INFO[w.zone[i]].color; r = r * 0.6 + c[0] * 0.4; gg = gg * 0.6 + c[1] * 0.4; b = b * 0.6 + c[2] * 0.4; }
      else if (w.park[i]) { r = 80; gg = 190; b = 90; }
      for (let py = 0; py < sc; py++) for (let px = 0; px < sc; px++) {
        const o = ((Math.floor(z * sc) + py) * S2 + Math.floor(x * sc) + px) * 4;
        d[o] = r; d[o + 1] = gg; d[o + 2] = b; d[o + 3] = 255;
      }
    }
    g.putImageData(this.mmImg, 0, 0);
    // camera footprint
    const v = G.view, cw = innerWidth, ch = innerHeight;
    const pts = [[0.04, 0.12], [0.96, 0.12], [0.96, 0.88], [0.04, 0.88]].map(([fx, fy]) => v.pick(fx * cw, fy * ch));
    const t = G.cam.t;
    g.lineWidth = 2; g.strokeStyle = '#ffffff'; g.fillStyle = 'rgba(255,255,255,0.12)';
    g.beginPath();
    pts.forEach((p, k) => {
      const px = (p ? clamp(p.wx, 0, n) : t.x + (k % 3 === 0 ? -1 : 1) * G.cam.dist * 0.6) * sc, pz = (p ? clamp(p.wz, 0, n) : t.z + (k < 2 ? -1 : 1) * G.cam.dist * 0.5) * sc;
      if (k) g.lineTo(px, pz); else g.moveTo(px, pz);
    });
    g.closePath(); g.fill(); g.stroke();
  }

  setLoading(p, msg) {
    const f = $('#load-fill'); if (f) f.style.width = Math.round(p * 100) + '%';
    const m = $('#load-msg'); if (m && msg) m.textContent = msg;
  }
  hideLoading() { const l = $('#loading'); if (l) { l.classList.add('fade'); setTimeout(() => l.remove(), 600); } }

  // ================================================================ HUD
  buildHUD() {
    const top = $('#hud-top');
    top.innerHTML = `
      <div class="hud-left">
        <div class="city-name" id="h-name" title="Click to rename">Fairhaven</div>
        <div class="hud-sub"><span id="h-date">Mar 1, Year 1</span> · <span id="h-rank">Hamlet</span></div>
      </div>
      <div class="hud-mid">
        <div class="stat" id="h-pop-wrap" title="Population (cap 25,000)"><div class="stat-ico">👥</div><div><div class="stat-val" id="h-pop">0</div><div class="stat-bar"><i id="h-pop-bar"></i></div></div></div>
        <div class="stat" title="Treasury"><div class="stat-ico">💰</div><div><div class="stat-val" id="h-money">$0</div><div class="stat-sub" id="h-net">+$0/mo</div></div></div>
        <div class="stat" title="Citizens' happiness — click for details" id="h-happy-wrap"><div class="stat-ico" id="h-happy-ico">🙂</div><div><div class="stat-val" id="h-happy">60%</div><div class="stat-sub" id="h-job">jobs</div></div></div>
        <div class="rci" title="Zone demand: Residential / Commercial / Industrial">
          <div class="rci-col"><div class="rci-bar"><i id="d-r" class="r"></i></div><b>R</b></div>
          <div class="rci-col"><div class="rci-bar"><i id="d-c" class="c"></i></div><b>C</b></div>
          <div class="rci-col"><div class="rci-bar"><i id="d-i" class="i"></i></div><b>I</b></div>
        </div>
        <div class="stat sm" title="Power"><div class="stat-ico" id="h-pw-ico">⚡</div><div class="stat-val" id="h-pw">–</div></div>
        <div class="stat sm" title="Water"><div class="stat-ico" id="h-wt-ico">💧</div><div class="stat-val" id="h-wt">–</div></div>
      </div>
      <div class="hud-right">
        <div class="speed" id="speed">
          <button data-sp="0" title="Pause (P)">⏸</button><button data-sp="1" title="Normal (1)">▶</button><button data-sp="2" title="Fast (2)">▶▶</button><button data-sp="3" title="Fastest (3)">▶▶▶</button>
        </div>
        <div class="clock" id="h-clock" title="Time of day">☀️ 10:00</div>
        <select id="h-overlay" title="Map overlays">${OVERLAYS.map((o) => `<option value="${o.id}">${o.name}</option>`).join('')}</select>
        <button class="hbtn" data-open="budget" title="Budget & taxes">💰<span>Budget</span></button>
        <button class="hbtn" data-open="laws" title="City laws">⚖️<span>Laws</span></button>
        <button class="hbtn" data-open="industries" title="Special industries">🏭<span>Industry</span></button>
        <button class="hbtn" data-open="stats" title="Statistics">📊<span>Stats</span></button>
        <button class="hbtn" data-open="settings" title="Menu & settings">⚙️<span>Menu</span></button>
        <button class="hbtn" data-open="help" title="Help">❓</button>
      </div>`;
    $$('#speed button').forEach((b) => b.addEventListener('click', () => this.setSpeed(+b.dataset.sp)));
    $$('[data-open]', top).forEach((b) => b.addEventListener('click', () => this.openModal(b.dataset.open)));
    $('#h-overlay').addEventListener('change', (e) => { this.manualOverlay = e.target.value !== 'none'; this.setOverlay(e.target.value); e.target.blur(); });
    $('#h-name').addEventListener('click', () => { const n = prompt('Rename your city:', this.G.sim.S.name); if (n && n.trim()) { this.G.sim.S.name = n.trim().slice(0, 28); this.refresh(0, true); } });
    $('#h-happy-wrap').addEventListener('click', () => this.openModal('stats', 'happy'));
  }

  setSpeed(s) { this.G.sim.S.speed = s; $$('#speed button').forEach((b) => b.classList.toggle('on', +b.dataset.sp === s)); }

  refresh(dt, force) {
    this.refreshT -= dt;
    if (force) this.refreshT = 0;
    if (this.refreshT > 0) return;
    this.refreshT = 0.25;
    const S = this.G.sim.S, sim = this.G.sim;
    $('#h-name').textContent = S.name;
    $('#h-date').textContent = sim.dateStr();
    const ms = MILESTONES[S.milestone];
    $('#h-rank').textContent = ms ? ms.name : '';
    $('#h-pop').textContent = `${fmtNum(S.pop)} / ${fmtNum(POP_CAP)}`;
    $('#h-pop-bar').style.width = clamp(S.pop / POP_CAP * 100, 0, 100) + '%';
    $('#h-money').textContent = sim.sandbox() ? '∞ Sandbox' : fmtMoney(S.money);
    $('#h-money').classList.toggle('neg', S.money < 0);
    const net = S.fin.net || 0;
    $('#h-net').textContent = sim.sandbox() ? 'free build' : `${net >= 0 ? '+' : '−'}$${fmtNum(Math.abs(net))}/mo`;
    $('#h-net').className = 'stat-sub ' + (net >= 0 ? 'pos' : 'neg');
    const hp = Math.round(S.happy);
    $('#h-happy').textContent = hp + '%';
    $('#h-happy-ico').textContent = hp > 78 ? '😄' : hp > 62 ? '🙂' : hp > 45 ? '😐' : hp > 28 ? '😟' : '😡';
    $('#h-job').textContent = `${Math.round(S.unemployment * 100)}% unemployed`;
    const setBar = (id, v) => { const e = $(id); e.style.height = Math.abs(v) * 50 + '%'; e.classList.toggle('neg', v < 0); e.style.top = v >= 0 ? 'auto' : '50%'; e.style.bottom = v >= 0 ? '50%' : 'auto'; };
    setBar('#d-r', S.demand.r); setBar('#d-c', S.demand.c); setBar('#d-i', S.demand.i);
    const pr = S.power.demand > 0 ? S.power.supply / S.power.demand : (S.power.supply > 0 ? 2 : 1);
    const wr = S.water.demand > 0 ? S.water.supply / S.water.demand : (S.water.supply > 0 ? 2 : 1);
    const sh = (x) => (x >= 10000 ? Math.round(x / 1000) + 'k' : x >= 1000 ? (x / 1000).toFixed(1) + 'k' : Math.round(x));
    $('#h-pw').textContent = `${sh(S.power.supply)}/${sh(S.power.demand)}`;
    $('#h-wt').textContent = `${sh(S.water.supply)}/${sh(S.water.demand)}`;
    $('#h-pw-ico').className = 'stat-ico ' + (pr < 0.98 ? 'bad' : '');
    $('#h-wt-ico').className = 'stat-ico ' + (wr < 0.98 ? 'bad' : '');
    const h = Math.floor(S.tod), m = Math.floor((S.tod - h) * 60);
    const ic = S.tod >= 6 && S.tod < 18 ? '☀️' : '🌙';
    $('#h-clock').textContent = `${ic} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    $$('#speed button').forEach((b) => b.classList.toggle('on', +b.dataset.sp === S.speed));
    if (this.modal && this.modal.refresh) this.modal.refresh();
    this.refreshInfo();
    this.updateToolLocks();
    this.updateMinimap(0.25);
  }

  // ================================================================ toolbar
  itemsFor(cat) {
    const sim = this.G.sim;
    if (cat === 'terrain') return TERRAIN_TOOLS.map((t) => ({ id: t.id, name: t.name, icon: t.icon, desc: t.desc, cost: 0, kind: ['raise', 'lower', 'smooth', 'flatten', 'water', 'land'].includes(t.id) ? 'terrain' : t.id === 'gen' ? 'action' : t.id }));
    if (cat === 'roads') return [1, 2, 3, 4, 5, 6].map((t) => ({ id: t, kind: 'road', name: ROADS[t].name, icon: ROADS[t].icon, desc: ROADS[t].desc, cost: ROADS[t].cost, unlock: ROADS[t].unlock, upkeep: ROADS[t].upkeep, per: '/tile' }));
    if (cat === 'zones') {
      const z = [1, 2, 3, 4, 5].map((id) => ({ id, kind: 'zone', name: ZONE_INFO[id].name, icon: ZONE_INFO[id].icon, desc: `Drag to zone. Buildings appear automatically where roads, power and water reach.`, cost: 2, per: '/tile', unlock: id === 2 || id === 4 ? 400 : 0, color: ZONE_INFO[id].color }));
      z.push({ id: 6, kind: 'zone', name: 'Park (open space)', icon: '🌳', desc: 'Public parkland: raises happiness and land value.', cost: 4, per: '/tile', color: ZONE_INFO[6].color });
      z.push({ id: 0, kind: 'zone', name: 'Remove zoning', icon: '🧽', desc: 'Drag to clear zoned land.', cost: 0 });
      return z;
    }
    if (cat === 'lots') return LOT_TYPES.map((l) => ({ id: l.id, kind: 'lot', name: l.name, icon: l.icon, desc: `Hand-place a ${l.arch === 'house' ? 'home' : l.arch === 'apt' ? 'multi-family building' : l.arch === 'shop' ? 'shop' : l.arch === 'office' ? 'office building' : 'factory'} in the chosen style (${l.lw}×${l.ld}). Needs road frontage; buildings also grow on zoned land by themselves.`, cost: l.cost, unlock: l.unlock, size: `${l.lw}×${l.ld}`, lot: l }));
    if (cat === 'bulldoze') return [];
    const out = [];
    for (const k in BUILDINGS) {
      const d = BUILDINGS[k];
      if (d.cat !== cat) continue;
      out.push({ id: k, kind: k === 'pylon' ? 'pylon' : 'building', name: d.name, icon: d.icon, desc: d.desc, cost: d.cost, upkeep: d.upkeep, unlock: d.unlock, def: d, size: `${d.w}×${d.d}` });
    }
    return out;
  }

  buildToolbar() {
    const tb = $('#toolbar');
    tb.innerHTML = CATEGORIES.map((c) => `<button class="cat" data-cat="${c.id}" title="${c.name}"><span class="ci">${c.icon}</span><span class="cl">${c.name}</span></button>`).join('');
    $$('.cat', tb).forEach((b) => b.addEventListener('click', () => this.selectCategory(b.dataset.cat)));
  }

  selectCategory(cat) {
    if (cat === 'bulldoze') { this.cat = 'bulldoze'; this.G.tools.setTool({ kind: 'bulldoze', id: 'bulldoze' }); this.showSubbar(null); this.markCat(); return; }
    if (this.cat === cat) { this.cat = null; this.G.tools.setTool(null); this.showSubbar(null); this.markCat(); return; }
    this.cat = cat;
    this.showSubbar(cat);
    this.markCat();
    // auto select first unlocked item for zones/roads convenience
    if (cat === 'roads') this.pickItem(this.itemsFor('roads')[1]);
    else this.G.tools.setTool(null);
  }
  markCat() { $$('#toolbar .cat').forEach((b) => b.classList.toggle('on', b.dataset.cat === this.cat)); }

  showSubbar(cat) {
    const sb = $('#subbar');
    if (!cat) { sb.classList.add('hidden'); $('#stylebar').classList.add('hidden'); $('#brushbar').classList.add('hidden'); return; }
    const items = this.itemsFor(cat);
    sb.innerHTML = `<div class="sub-title">${CATEGORIES.find((c) => c.id === cat).name}</div><div class="sub-items">` + items.map((it, i) => {
      const locked = !this.G.sim.isUnlocked(it);
      const sw = it.color ? `style="--zc:rgb(${it.color.join(',')})"` : '';
      return `<button class="tool ${locked ? 'locked' : ''}" data-i="${i}" ${sw}><span class="ti">${it.icon}</span><span class="tn">${it.name}</span><span class="tc">${it.cost ? (this.G.sim.sandbox() ? '' : '$' + fmtNum(it.cost)) + (it.per || '') : ''}</span>${locked ? `<span class="lock">🔒 ${it.unlock}</span>` : ''}</button>`;
    }).join('') + '</div>';
    sb.classList.remove('hidden');
    this.subItems = items;
    $$('.tool', sb).forEach((b) => {
      const it = items[+b.dataset.i];
      b.addEventListener('click', () => this.pickItem(it));
      b.addEventListener('mouseenter', (e) => this.itemTip(it, e));
      b.addEventListener('mousemove', (e) => this.moveTip(e));
      b.addEventListener('mouseleave', () => this.hideTip());
    });
    $('#stylebar').classList.toggle('hidden', cat !== 'zones' && cat !== 'civic' && cat !== 'lots');
    this.buildStylebar();
    $('#brushbar').classList.toggle('hidden', cat !== 'terrain');
    this.buildBrushbar();
  }

  updateToolLocks() {
    if (!this.subItems) return;
    $$('#subbar .tool').forEach((b) => {
      const it = this.subItems[+b.dataset.i];
      const locked = !this.G.sim.isUnlocked(it);
      if (b.classList.contains('locked') !== locked) { this.showSubbar(this.cat); }
    });
  }

  pickItem(it) {
    const T = this.G.tools;
    if (!it) return;
    if (!this.G.sim.isUnlocked(it)) { this.toast(`Unlocks at ${fmtNum(it.unlock)} population`, 'bad'); return; }
    if (it.kind === 'action') { this.openModal('generate'); return; }
    const t = { kind: it.kind, id: it.id, name: it.name };
    T.setTool(t);
    $$('#subbar .tool').forEach((b) => b.classList.toggle('on', this.subItems[+b.dataset.i] === it));
    const styled = (it.kind === 'zone' && it.id >= 1 && it.id <= 5) || it.kind === 'lot' || (it.def && it.def.styled);
    $('#stylebar').classList.toggle('hidden', !styled);
    this.buildStylebar();
    this.sfx('click');
  }

  onToolChanged(t) {
    if (!t) { $$('#subbar .tool').forEach((b) => b.classList.remove('on')); if (this.cat !== 'bulldoze') { /* keep cat */ } }
    if (!t && this.cat === 'bulldoze') { this.cat = null; this.markCat(); }
    if (!t || t.kind !== 'zone' && t.kind !== 'building' && this.cat !== 'zones') { /* style bar handled in pickItem */ }
  }

  buildStylebar() {
    const sb = $('#stylebar');
    const S = this.G.sim.S;
    sb.innerHTML = `<div class="sub-title">Architecture style</div><div class="style-items">` + STYLES.map((s) => `<button class="style ${S.style === s.id ? 'on' : ''}" data-s="${s.id}" style="--sc:${s.color}" title="${s.name}: ${s.desc}"><span class="si">${s.icon}</span><span class="sn">${s.name}</span></button>`).join('') + '</div>';
    $$('.style', sb).forEach((b) => b.addEventListener('click', () => { S.style = +b.dataset.s; this.buildStylebar(); this.sfx('click'); this.G.view.hideGhost(); }));
  }

  buildBrushbar() {
    const bb = $('#brushbar'), T = this.G.tools;
    bb.innerHTML = `<div class="brush-row"><label>Brush size <b id="bs-v">${T.brush.size}</b></label><input id="bs" type="range" min="1" max="12" step="1" value="${T.brush.size}"></div>
      <div class="brush-row"><label>Strength <b id="bt-v">${Math.round(T.brush.strength * 100)}%</b></label><input id="bt" type="range" min="0.1" max="1" step="0.05" value="${T.brush.strength}"></div>`;
    $('#bs').addEventListener('input', (e) => { T.brush.size = +e.target.value; $('#bs-v').textContent = T.brush.size; });
    $('#bt').addEventListener('input', (e) => { T.brush.strength = +e.target.value; $('#bt-v').textContent = Math.round(T.brush.strength * 100) + '%'; });
  }

  // ================================================================ tooltips
  itemTip(it, e) {
    const sim = this.G.sim;
    let html = `<div class="tip-h">${it.icon} ${it.name}</div><div class="tip-d">${it.desc || ''}</div>`;
    if (it.cost && !sim.sandbox()) html += `<div class="tip-r">Cost: <b>$${fmtNum(it.cost)}${it.per || ''}</b></div>`;
    if (it.upkeep) html += `<div class="tip-r">Upkeep: <b>$${fmtNum(it.upkeep)}/mo</b></div>`;
    if (it.def) {
      const d = it.def;
      if (d.jobs) html += `<div class="tip-r">Jobs: <b>${d.jobs}</b></div>`;
      if (d.radius && d.cov) html += `<div class="tip-r">Service radius: <b>${d.radius} tiles</b></div>`;
      if (d.power > 0) html += `<div class="tip-r">Power: <b>+${d.power} MW</b></div>`;
      if (d.water) html += `<div class="tip-r">Water: <b>+${fmtNum(d.water)}</b></div>`;
      if (d.sewage) html += `<div class="tip-r">Sewage: <b>${fmtNum(d.sewage)}</b></div>`;
      if (d.revenue) html += `<div class="tip-r">Revenue: <b>up to $${fmtNum(d.revenue)}/mo</b></div>`;
      if (d.req) html += `<div class="tip-r req">Requires: ${d.req}</div>`;
      if (d.pollute) html += `<div class="tip-r warn">Pollution ${'●'.repeat(Math.min(5, Math.ceil(d.pollute)))}</div>`;
      html += `<div class="tip-r dim">Size ${it.size}${d.place === 'shore' ? ' · shoreline' : ''}${d.place === 'road' ? ' · on road' : ''}${d.place === 'rail' ? ' · beside rail' : ''}</div>`;
    }
    if (it.unlock && !sim.isUnlocked(it)) html += `<div class="tip-r bad">🔒 Unlocks at ${fmtNum(it.unlock)} population</div>`;
    this.tipEl.innerHTML = html;
    this.tipEl.classList.remove('hidden');
    this.moveTip(e);
  }
  moveTip(e) {
    const t = this.tipEl, pad = 16;
    const w = t.offsetWidth, h = t.offsetHeight;
    let x = e.clientX + pad, y = e.clientY - h - pad;
    if (x + w > innerWidth - 8) x = e.clientX - w - pad;
    if (y < 8) y = e.clientY + pad;
    t.style.transform = `translate(${x}px, ${y}px)`;
  }
  setTip(text, mouse, cls = '') {
    this.tipEl.innerHTML = `<div class="tip-line ${cls}">${text}</div>`;
    this.tipEl.classList.remove('hidden');
    this.moveTip({ clientX: mouse.x, clientY: mouse.y });
  }
  hideTip() { this.tipEl.classList.add('hidden'); }
  tileTip(hit, mouse) {
    const sim = this.G.sim, w = this.G.world;
    const info = sim.tileInfo(hit.x, hit.z);
    if (!info) return;
    let name;
    const b = info.bid ? w.buildings.get(info.bid) : null;
    if (b) name = this.buildingName(b);
    else if (info.road) name = ROADS[info.road].name + (info.water ? ' (bridge)' : '');
    else if (info.water) name = 'Water';
    else if (info.zone) name = ZONE_INFO[info.zone].name;
    else if (info.park) name = 'Park';
    else if (info.pylon) name = 'Power line';
    else if (info.tree) name = 'Forest';
    else name = info.h > 3.2 ? 'Hills' : info.h < 0.25 ? 'Beach' : 'Grassland';
    this.setTip(`<b>${name}</b><br><span class="dim">Land value ${Math.round(info.lv)} · happiness ${Math.round(info.happy)} · height ${info.h.toFixed(1)}m</span>`, mouse);
  }

  toast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = 'toast ' + type; t.textContent = msg;
    $('#toasts').appendChild(t);
    if ($('#toasts').children.length > 4) $('#toasts').firstChild.remove();
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3200);
    if (type === 'bad') this.sfx('error');
  }

  onLog(e) {
    const n = $('#news');
    if (!n) return;
    const d = document.createElement('div');
    d.className = 'news-item ' + (e.type === 'tip' ? 'ntip' : e.type); d.innerHTML = `<span class="nd">${e.date}</span> ${e.msg}`;
    n.prepend(d);
    while (n.children.length > 5) n.lastChild.remove();
    setTimeout(() => d.classList.add('old'), 14000);
    if (e.type === 'bad') this.sfx('alert'); else if (e.type === 'good') this.sfx('good');
  }

  onMilestone(m) {
    this.sfx('good');
    const b = document.createElement('div');
    b.className = 'banner';
    b.innerHTML = `<div class="bn-k">🏆 Milestone reached</div><div class="bn-t">${m.name}</div><div class="bn-d">${m.note}</div>`;
    this.root.appendChild(b);
    setTimeout(() => b.classList.add('out'), 5200);
    setTimeout(() => b.remove(), 6200);
  }

  // ================================================================ info panel
  buildingName(b) {
    if (b.kind === 'zone') return `${STYLES[b.style].name} ${ARCH_NAMES[b.arch][b.level - 1]}`;
    const d = b.def;
    return d.styled && d.cat !== 'industries' ? `${STYLES[b.style].name} ${d.name}` : d.name;
  }

  showSelection(b, tile) {
    this.sel = b ? b.id : null;
    this.selTile = tile;
    const info = $('#info');
    if (!b && !tile) { info.classList.add('hidden'); this.G.view.showTiles(null); return; }
    info.classList.remove('hidden');
    this.refreshInfo(true);
  }

  refreshInfo(force) {
    const info = $('#info');
    if (info.classList.contains('hidden')) return;
    const G = this.G, w = G.world, sim = G.sim, S = sim.S;
    let html = '';
    if (this.sel) {
      const b = w.buildings.get(this.sel);
      if (!b) { info.classList.add('hidden'); return; }
      const n = w.n, i = (b.z + (b.d >> 1)) * n + b.x + (b.w >> 1), m = sim.maps;
      const yes = (v) => v ? '<span class="ok">●</span>' : '<span class="no">●</span>';
      const stateTxt = { construct: 'Under construction', ok: 'Operational', abandoned: 'Abandoned', burning: '🔥 On fire!', ruin: 'Burnt ruins' }[b.state];
      html += `<div class="info-h"><span>${b.def ? b.def.icon : ARCH_ICON[b.arch]}</span><div><div class="info-t">${this.buildingName(b)}</div><div class="info-s">${stateTxt}${b.kind === 'zone' ? ` · Level ${b.level}` : ''}</div></div><button class="x" id="info-x">✕</button></div>`;
      html += `<div class="rows">`;
      if (b.kind === 'zone') {
        if (b.arch === 'house' || b.arch === 'apt') html += row('Residents', `${b.occ} / ${b.cap}`);
        else html += row('Workers', `${b.workers} / ${b.jobs}`);
        html += row('Style', STYLES[b.style].name);
      } else if (b.def) {
        const d = b.def;
        if (b.def.jobs) html += row('Workers', `${b.workers} / ${d.jobs}`);
        if (d.power > 0) html += row('Power output', `${d.power} MW`);
        if (d.water) html += row('Water supply', fmtNum(d.water));
        if (d.sewage) html += row('Sewage capacity', fmtNum(d.sewage));
        if (d.cov && d.radius) html += row('Service radius', `${d.radius} tiles`);
        if (d.industry) html += row('Efficiency', Math.round((b.eff || 0) * 100) + '%') + row('Revenue', '$' + fmtNum(b.rev || 0) + '/mo');
        if (d.upkeep) html += row('Upkeep', '$' + fmtNum(d.upkeep) + '/mo');
        if (b.key === 'landfill') html += row('Landfill used', Math.round((b.fill || 0) / d.storage * 100) + '%');
        if (b.key === 'prison') html += row('Inmates', `${Math.round(S.prisoners)} / ${d.prison}`);
        if (b.key === 'townhall') html += row('Laws', 'Enabled');
      }
      html += `<div class="sep"></div>`;
      html += row('Power', yes(b.powered) + (b.cPw ? '' : ' <i class="dim">not connected</i>'));
      html += row('Water', yes(b.watered) + (b.cWt ? '' : ' <i class="dim">not connected</i>'));
      if (b.kind === 'zone') html += row('Sewage', yes(b.cSw));
      html += row('Land value', Math.round(m.landvalue[i]));
      html += row('Happiness', Math.round(m.happy[i]) + '%');
      html += row('Pollution', Math.round(m.pollution[i]) + ' · Noise ' + Math.round(m.noise[i]));
      html += row('Crime', Math.round(m.crime[i]));
      html += `</div><div class="info-btns"><button class="btn" id="info-go">🎯 Focus</button><button class="btn danger" id="info-del">🚜 Demolish</button></div>`;
      info.dataset.bid = b.id;
    } else if (this.selTile) {
      const t = sim.tileInfo(this.selTile.x, this.selTile.z);
      if (!t) return;
      const zn = t.zone ? ZONE_INFO[t.zone].name : t.water ? 'Water' : t.road ? ROADS[t.road].name : 'Empty land';
      html += `<div class="info-h"><span>📍</span><div><div class="info-t">${zn}</div><div class="info-s">Tile ${t.x}, ${t.z}</div></div><button class="x" id="info-x">✕</button></div><div class="rows">`;
      html += row('Height', t.h.toFixed(1) + ' m') + row('Land value', Math.round(t.lv)) + row('Happiness', Math.round(t.happy) + '%') + row('Pollution', Math.round(t.pollution)) + row('Noise', Math.round(t.noise)) + row('Crime', Math.round(t.crime));
      html += `<div class="sep"></div>` + row('Police', Math.round(t.police * 100) + '%') + row('Fire', Math.round(t.fire * 100) + '%') + row('Health', Math.round(t.health * 100) + '%') + row('Education', Math.round(t.edu * 100) + '%');
      html += row('Power grid', t.power ? '<span class="ok">●</span>' : '<span class="no">●</span>') + row('Water grid', t.waterNet ? '<span class="ok">●</span>' : '<span class="no">●</span>');
      html += `</div>`;
    }
    if (info.dataset.html !== html) {
      info.innerHTML = html; info.dataset.html = html;
      $('#info-x')?.addEventListener('click', () => G.tools.select(null));
      $('#info-go')?.addEventListener('click', () => { const b = w.buildings.get(this.sel); if (b) G.cam.focus(b.x + b.w / 2, b.z + b.d / 2, 22); });
      $('#info-del')?.addEventListener('click', () => { const b = w.buildings.get(this.sel); if (b) { sim.bulldozeBuilding(b); G.tools.select(null); this.sfx('bulldoze'); } });
    }
  }

  // ================================================================ overlays
  setAutoOverlay(id) {
    if (this.manualOverlay) return;
    this.autoOverlayId = id;
    this.setOverlay(id || 'none', true);
  }
  setOverlay(id, auto) {
    this.activeOverlay = id;
    if (!auto) $('#h-overlay').value = id;
    else $('#h-overlay').value = id === 'zones' ? 'zones' : 'none';
    this.ovT = 0;
    this.applyOverlay();
  }

  applyOverlay() {
    const G = this.G, id = this.activeOverlay, v = G.view, w = G.world, sim = G.sim, m = sim.maps, n = w.n;
    const lg = $('#legend');
    if (id === 'none') { v.clearOverlay(); lg.classList.add('hidden'); return; }
    const ramp = (t, stops) => { t = clamp(t, 0, 1); const k = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(k)), f = k - i; const a = stops[i], b = stops[i + 1]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f]; };
    const heatBad = [[60, 200, 90, 0], [230, 220, 60, 150], [240, 120, 40, 190], [220, 30, 30, 215]];
    const heatGood = [[200, 60, 60, 190], [240, 200, 60, 170], [90, 200, 110, 150], [60, 220, 150, 170]];
    const cover = [[40, 120, 220, 0], [60, 150, 230, 90], [70, 200, 220, 150], [80, 240, 170, 190]];
    let fn, crisp = false, label = '', grad = null;
    const none = [0, 0, 0, 0];
    switch (id) {
      case 'zones': crisp = true; label = 'Zoning'; fn = (i) => { const z = w.zone[i]; if (z && z <= 5) { const c = ZONE_INFO[z].color; return [c[0], c[1], c[2], w.bid[i] ? 90 : 170]; } if (w.park[i]) return [70, 200, 90, 130]; if (w.bid[i]) { return [200, 200, 200, 60]; } return none; };
        lg.innerHTML = `<b>Zoning</b><div class="lg-chips"><span style="--c:rgb(90,200,100)">Residential</span><span style="--c:rgb(90,150,240)">Commercial</span><span style="--c:rgb(235,190,70)">Industrial</span><span style="--c:rgb(70,200,90)">Park</span></div>`; break;
      case 'traffic': { const tm = G.traffic.map; label = 'Traffic'; fn = (i) => w.road[i] && w.road[i] <= 5 ? ramp(tm[i] / 1.0, [[60, 210, 90, 220], [240, 220, 60, 230], [240, 120, 40, 235], [220, 30, 30, 240]]) : none; grad = ['Free', 'Gridlock', 'good-bad']; break; }
      case 'power': label = 'Power grid'; crisp = true; fn = (i) => { const b = w.bid[i] ? w.buildings.get(w.bid[i]) : null; if (b && b.def !== undefined && b.state === 'ok') return b.powered ? [250, 220, 60, 170] : [230, 50, 50, 200]; if (sim.pw[i]) return [250, 220, 60, 200]; if (w.road[i] && w.road[i] <= 5) return [120, 120, 130, 100]; return none; };
        lg.innerHTML = `<b>Power</b><div class="lg-chips"><span style="--c:rgb(250,220,60)">Powered</span><span style="--c:rgb(230,50,50)">No power</span></div>`; break;
      case 'water': label = 'Water & sewage'; crisp = true; fn = (i) => { const b = w.bid[i] ? w.buildings.get(w.bid[i]) : null; if (b && b.state === 'ok') return b.watered ? (b.cSw || b.kind !== 'zone' ? [60, 150, 240, 170] : [150, 110, 60, 190]) : [230, 50, 50, 200]; if (sim.wt[i]) return [60, 150, 240, 200]; return none; };
        lg.innerHTML = `<b>Water</b><div class="lg-chips"><span style="--c:rgb(60,150,240)">Supplied</span><span style="--c:rgb(150,110,60)">No sewage</span><span style="--c:rgb(230,50,50)">No water</span></div>`; break;
      case 'pollution': label = 'Pollution'; fn = (i) => ramp(m.pollution[i] / 70, [[120, 90, 160, 0], [160, 100, 140, 120], [150, 70, 70, 190], [90, 30, 40, 225]]); grad = ['Clean', 'Toxic', 'good-bad']; break;
      case 'noise': label = 'Noise'; fn = (i) => ramp(m.noise[i] / 70, heatBad); grad = ['Quiet', 'Loud', 'good-bad']; break;
      case 'crime': label = 'Crime'; fn = (i) => ramp(m.crime[i] / 60, heatBad); grad = ['Safe', 'Dangerous', 'good-bad']; break;
      case 'police': label = 'Police coverage'; fn = (i) => ramp(m.police[i], cover); grad = ['None', 'Full', 'cover']; break;
      case 'fire': label = 'Fire coverage'; fn = (i) => ramp(m.fire[i], cover); grad = ['None', 'Full', 'cover']; break;
      case 'health': label = 'Healthcare'; fn = (i) => ramp(m.health[i], cover); grad = ['None', 'Full', 'cover']; break;
      case 'edu': label = 'Education'; fn = (i) => ramp(m.edu[i], cover); grad = ['None', 'Full', 'cover']; break;
      case 'waste': label = 'Waste collection'; fn = (i) => ramp(m.waste[i], cover); grad = ['None', 'Full', 'cover']; break;
      case 'happy': label = 'Happiness'; fn = (i) => (w.water[i] ? none : ramp(m.happy[i] / 100, heatGood)); grad = ['Miserable', 'Joyful', 'bad-good']; break;
      case 'landvalue': label = 'Land value'; fn = (i) => (w.water[i] ? none : ramp(m.landvalue[i] / 80, [[60, 90, 200, 140], [90, 190, 210, 150], [240, 220, 90, 170], [250, 170, 40, 200]])); grad = ['Low', 'High', 'lv']; break;
    }
    if (grad) lg.innerHTML = `<b>${label}</b><div class="lg-bar ${grad[2]}"></div><div class="lg-lab"><span>${grad[0]}</span><span>${grad[1]}</span></div>`;
    lg.classList.remove('hidden');
    v.paintOverlay(fn, crisp);
    this.ovCrisp = crisp;
  }

  // ================================================================ modals
  closeModals() {
    if (this.resumeSpeed) { this.G.sim.S.speed = this.resumeSpeed; this.resumeSpeed = 0; }
    if (this.modal) { this.modal = null; const l = $('#modal-layer'); l.classList.add('hidden'); l.innerHTML = ''; return true; }
    return false;
  }

  openModal(kind, arg) {
    const layer = $('#modal-layer');
    this.modal = null;
    const wrap = (title, body, cls = '') => {
      layer.innerHTML = `<div class="modal ${cls}"><div class="modal-h"><h2>${title}</h2><button class="x" id="m-x">✕</button></div><div class="modal-b">${body}</div></div>`;
      layer.classList.remove('hidden');
      $('#m-x').addEventListener('click', () => this.closeModals());
      layer.onclick = (e) => { if (e.target === layer) this.closeModals(); };
    };
    this.sfx('click');
    switch (kind) {
      case 'budget': wrap('Budget & Taxes', this.budgetHTML(), 'wide'); this.bindBudget(); this.modal = { kind, refresh: () => this.refreshBudget() }; break;
      case 'laws': wrap('City Laws', this.lawsHTML(), 'wide'); this.bindLaws(); this.modal = { kind, refresh: () => { } }; break;
      case 'industries': wrap('Special Industries', this.industriesHTML(), 'wide'); this.bindIndustries(); this.modal = { kind, refresh: () => { } }; break;
      case 'stats': wrap('City Statistics', this.statsHTML(arg), 'wide'); this.bindStats(arg); this.modal = { kind, refresh: () => this.refreshStats() }; break;
      case 'settings': wrap('Menu & Settings', this.settingsHTML()); this.bindSettings(); this.modal = { kind }; break;
      case 'help': wrap('How to Play', this.helpHTML(), 'wide'); this.modal = { kind }; if (arg && arg.first) { this.resumeSpeed = this.G.sim.S.speed; this.G.sim.S.speed = 0; } break;
      case 'generate': wrap('Generate Terrain', this.generateHTML()); this.bindGenerate(); this.modal = { kind }; break;
      case 'milestone': {
        const m = arg;
        wrap('🏆 Milestone reached!', `<div class="milestone"><div class="ms-name">${m.name}</div><p>${m.note}</p><p class="dim">New buildings and roads are now available in the toolbar.</p><button class="btn primary" id="ms-ok">Continue</button></div>`);
        $('#ms-ok').addEventListener('click', () => this.closeModals()); this.modal = { kind };
        break;
      }
    }
  }

  // ---------------------------------------------------------------- budget
  budgetHTML() {
    const S = this.G.sim.S;
    const svc = [['police', '🚓', 'Police'], ['fire', '🚒', 'Fire'], ['health', '🏥', 'Health'], ['edu', '🏫', 'Education'], ['waste', '🗑️', 'Waste'], ['transit', '🚌', 'Transit'], ['parks', '🌳', 'Parks & landmarks']];
    return `<div class="grid3">
      <div class="card"><h3>Taxes</h3>
        ${['r:Residential:🏠', 'c:Commercial:🏪', 'i:Industrial:🏭'].map((s) => { const [k, n, ic] = s.split(':'); return `<div class="slider"><label>${ic} ${n} <b id="tx-${k}-v">${S.tax[k]}%</b></label><input type="range" min="0" max="20" step="1" data-tax="${k}" value="${S.tax[k]}"></div>`; }).join('')}
        <p class="dim small">Higher taxes bring more money but reduce happiness and slow growth. Around 9% is balanced.</p>
        <h3>Loans</h3>
        <div class="row-b"><span>Outstanding</span><b id="b-loan">${fmtMoney(S.loan)}</b></div>
        <div class="btn-row"><button class="btn" id="b-borrow">Borrow $10,000</button><button class="btn" id="b-repay">Repay $10,000</button></div>
        <p class="dim small">Interest: 1.2% per month. Maximum $200,000.</p>
      </div>
      <div class="card"><h3>Service budgets</h3>
        ${svc.map(([k, ic, n]) => `<div class="slider"><label>${ic} ${n} <b id="bg-${k}-v">${S.budget[k]}%</b></label><input type="range" min="50" max="150" step="5" data-bud="${k}" value="${S.budget[k]}"></div>`).join('')}
        <p class="dim small">Budgets scale upkeep <i>and</i> effectiveness of coverage.</p>
      </div>
      <div class="card"><h3>Monthly finances</h3><div id="b-fin"></div></div></div>`;
  }
  bindBudget() {
    const S = this.G.sim.S, sim = this.G.sim;
    $$('[data-tax]').forEach((e) => e.addEventListener('input', () => { S.tax[e.dataset.tax] = +e.value; $(`#tx-${e.dataset.tax}-v`).textContent = e.value + '%'; sim.computeFinance(); this.refreshBudget(); }));
    $$('[data-bud]').forEach((e) => e.addEventListener('input', () => { S.budget[e.dataset.bud] = +e.value; $(`#bg-${e.dataset.bud}-v`).textContent = e.value + '%'; sim.mapsDirty = true; sim.computeFinance(); this.refreshBudget(); }));
    $('#b-borrow').addEventListener('click', () => { if (!sim.takeLoan(10000)) this.toast('Loan limit reached', 'bad'); this.refreshBudget(); });
    $('#b-repay').addEventListener('click', () => { if (!sim.repayLoan(10000)) this.toast('Cannot repay', 'bad'); this.refreshBudget(); });
    this.refreshBudget();
  }
  refreshBudget() {
    const S = this.G.sim.S;
    const f = S.fin;
    const line = (k, v, cls) => `<div class="row-b ${cls || ''}"><span>${k}</span><b>${fmtMoney(v)}</b></div>`;
    let h = '<div class="fin-h pos">Income</div>';
    for (const k in f.income) if (f.income[k] > 0.5) h += line(k, f.income[k]);
    h += line('Total income', f.inc, 'tot');
    h += '<div class="fin-h neg">Expenses</div>';
    for (const k in f.expense) if (f.expense[k] > 0.5) h += line(k, -f.expense[k]);
    h += line('Total expenses', -f.exp, 'tot');
    h += `<div class="row-b net ${f.net >= 0 ? 'pos' : 'neg'}"><span>Net per month</span><b>${f.net >= 0 ? '+' : ''}${fmtMoney(f.net)}</b></div>`;
    const e = $('#b-fin'); if (e) e.innerHTML = h;
    const l = $('#b-loan'); if (l) l.textContent = fmtMoney(S.loan);
  }

  // ---------------------------------------------------------------- laws
  lawsHTML() {
    const sim = this.G.sim, S = sim.S;
    let hasHall = sim.sandbox();
    for (const b of sim.blist()) if (b.key === 'townhall' && b.state === 'ok') hasHall = true;
    const enf = Math.round(S.enforcement * 100);
    const eff = Math.round((0.35 + 0.65 * S.enforcement) * 100);
    const fxText = (L) => Object.entries(L.fx).map(([k, v]) => {
      const lab = FX_LABEL[k]; if (!lab) return '';
      const good = (v * lab[1]) > 0;
      const val = k === 'noCut' ? '' : ` ${v > 0 ? '+' : '−'}${Math.abs(k === 'happy' ? v : Math.round(v * 100))}${k === 'happy' ? '' : '%'}`;
      return `<span class="fx ${good ? 'good' : 'bad'}">${lab[0]}${val}</span>`;
    }).join('');
    let h = `<div class="law-top"><div class="enf"><div class="enf-t">Law enforcement <b>${enf}%</b></div><div class="enf-bar"><i style="width:${enf}%"></i></div><div class="dim small">Laws only work as well as your police can enforce them: currently <b>${eff}%</b> effective. Build police stations, a courthouse and fund the police budget to enforce better.</div></div>
      ${hasHall ? '' : '<div class="warnbox">🏛️ Build a <b>Town Hall</b> (Civic) to enact laws.</div>'}</div><div class="law-grid">`;
    for (const id in LAWS) {
      const L = LAWS[id];
      const locked = !sim.sandbox() && L.unlock > S.popPeak;
      const on = !!S.laws[id];
      h += `<div class="law ${on ? 'on' : ''} ${locked ? 'locked' : ''}"><div class="law-h"><span class="law-i">${L.icon}</span><b>${L.name}</b></div><p>${L.desc}</p><div class="fxs">${fxText(L)}</div><div class="law-f"><span class="dim">$${L.cost}/mo</span>${locked ? `<span class="lk">🔒 ${fmtNum(L.unlock)} pop</span>` : `<button class="btn ${on ? 'danger' : 'primary'}" data-law="${id}" ${hasHall ? '' : 'disabled'}>${on ? 'Repeal' : 'Enact'}</button>`}</div></div>`;
    }
    return h + '</div>';
  }
  bindLaws() {
    $$('[data-law]').forEach((b) => b.addEventListener('click', () => {
      const S = this.G.sim.S; const id = b.dataset.law;
      S.laws[id] = !S.laws[id];
      this.G.sim.recomputeLaws(); this.G.sim.mapsDirty = true;
      this.G.sim.log(S.laws[id] ? `📜 ${LAWS[id].name} enacted.` : `📜 ${LAWS[id].name} repealed.`, 'info');
      this.sfx('click');
      $('.modal-b').innerHTML = this.lawsHTML(); this.bindLaws();
    }));
  }

  // ---------------------------------------------------------------- industries
  industriesHTML() {
    const sim = this.G.sim, S = sim.S;
    const stats = {};
    for (const b of sim.blist()) if (b.def && b.def.industry && b.state === 'ok') { const s = stats[b.key] || (stats[b.key] = { n: 0, jobs: 0, rev: 0, eff: 0 }); s.n++; s.jobs += b.workers; s.rev += b.rev || 0; s.eff += b.eff || 0; }
    let tj = 0, tr = 0; for (const k in stats) { tj += stats[k].jobs; tr += stats[k].rev; }
    let h = `<div class="ind-top"><div><b>${fmtNum(tj)}</b><span>industry jobs</span></div><div><b>${fmtMoney(tr)}</b><span>revenue / month</span></div><div><b>${S.outside ? 'Connected' : 'Isolated'}</b><span>outside trade</span></div><div><b>${S.tourism.toFixed(1)}</b><span>tourism</span></div></div>`;
    h += `<div class="ind-grid">`;
    for (const k in INDUSTRIES) {
      const d = INDUSTRIES[k], s = stats[k], locked = !sim.sandbox() && d.unlock > S.popPeak;
      h += `<div class="ind ${s ? 'active' : ''} ${locked ? 'locked' : ''}"><div class="ind-h"><span class="law-i">${d.icon}</span><div><b>${d.name}</b><div class="dim small">${d.group}</div></div></div><p>${d.desc}</p><div class="dim small">📋 ${d.req || 'No special requirement'}</div>
        ${s ? `<div class="ind-s"><span>×${s.n}</span><span>${s.jobs} jobs</span><span>${fmtMoney(s.rev)}/mo</span><span>${Math.round(s.eff / s.n * 100)}% eff.</span></div>` : `<div class="ind-s dim"><span>Up to ${fmtMoney(d.revenue)}/mo</span><span>${d.jobs} jobs</span></div>`}
        <div class="law-f">${locked ? `<span class="lk">🔒 ${fmtNum(d.unlock)} pop</span>` : `<span class="dim">$${fmtNum(d.cost)}</span><button class="btn primary" data-build="${k}">Build</button>`}</div></div>`;
    }
    h += `</div><h3 class="sec">Industry policies</h3><div class="pol-grid">`;
    for (const id in INDUSTRY_POLICIES) {
      const p = INDUSTRY_POLICIES[id], on = !!S.policies[id];
      h += `<div class="pol ${on ? 'on' : ''}"><div><b>${p.name}</b><div class="dim small">${p.desc}</div></div><button class="btn ${on ? 'danger' : ''}" data-pol="${id}">${on ? 'Cancel' : `Adopt · $${p.cost}/mo`}</button></div>`;
    }
    h += `</div><div class="dim small chain">🔗 Supply chains: Farms boost Distilleries & Textile Mills · Ports boost every industry (+15% each, up to +45%) · Refineries need a Port · Tech Campuses need a University & educated citizens · Resorts and Casinos thrive with parks, beaches and happy citizens.</div>`;
    return h;
  }
  bindIndustries() {
    $$('[data-build]').forEach((b) => b.addEventListener('click', () => {
      this.closeModals();
      this.selectCategory('industries');
      const it = this.subItems.find((x) => x.id === b.dataset.build);
      this.pickItem(it);
    }));
    $$('[data-pol]').forEach((b) => b.addEventListener('click', () => {
      const S = this.G.sim.S; S.policies[b.dataset.pol] = !S.policies[b.dataset.pol]; this.G.sim.mapsDirty = true;
      this.sfx('click'); $('.modal-b').innerHTML = this.industriesHTML(); this.bindIndustries();
    }));
  }

  // ---------------------------------------------------------------- stats
  statsHTML(tab) {
    return `<div class="tabs"><button data-tab="overview" class="${tab !== 'happy' ? 'on' : ''}">Overview</button><button data-tab="charts">Charts</button><button data-tab="happy" class="${tab === 'happy' ? 'on' : ''}">Happiness</button><button data-tab="services">Services</button></div><div id="stats-body"></div>`;
  }
  bindStats(tab) {
    this.statsTab = tab === 'happy' ? 'happy' : 'overview';
    $$('.tabs button').forEach((b) => b.addEventListener('click', () => { this.statsTab = b.dataset.tab; $$('.tabs button').forEach((x) => x.classList.toggle('on', x === b)); this.refreshStats(); }));
    this.refreshStats();
  }
  refreshStats() {
    const body = $('#stats-body'); if (!body) return;
    const sim = this.G.sim, S = sim.S;
    const tile = (k, v, sub) => `<div class="kpi"><span>${k}</span><b>${v}</b>${sub ? `<i>${sub}</i>` : ''}</div>`;
    const tab = this.statsTab;
    let h = '';
    if (tab === 'overview') {
      h = `<div class="kpis">${tile('Population', fmtNum(S.pop), `of ${fmtNum(POP_CAP)}`)}${tile('Happiness', Math.round(S.happy) + '%')}${tile('Jobs', fmtNum(S.jobsTotal), `${fmtNum(S.workforce)} workers`)}${tile('Unemployment', Math.round(S.unemployment * 100) + '%')}
        ${tile('Education', Math.round(S.edu * 100) + '%')}${tile('Health', Math.round(S.health * 100) + '%')}${tile('Crime', Math.round(S.crime))}${tile('Pollution', Math.round(S.pollution))}
        ${tile('Traffic', Math.round(S.traffic * 100) + '%')}${tile('Tourism', S.tourism.toFixed(1))}${tile('Fires', S.stats.fires)}${tile('Crimes solved', `${S.stats.solved}/${S.stats.crimes}`)}
        ${tile('Power', `${S.power.supply.toFixed(0)} / ${S.power.demand.toFixed(0)} MW`)}${tile('Water', `${fmtNum(S.water.supply)} / ${fmtNum(S.water.demand)}`)}${tile('Sewage', `${fmtNum(S.sewage.cap)} / ${fmtNum(S.sewage.demand)}`)}${tile('Waste', `${fmtNum(S.waste.cap)} / ${fmtNum(S.waste.prod)} per day`, S.waste.backlog > 200 ? 'backlog ' + fmtNum(S.waste.backlog) : '')}</div>
        ${(S.events && S.events.length) ? `<h3 class="sec">Active events</h3><div class="mile">${S.events.map((e) => `<div class="done"><b>${e.icon} ${e.name}</b><span>${Math.max(0, e.until - S.totalDays)} days left</span></div>`).join('')}</div>` : ''}
        <h3 class="sec">Milestones</h3><div class="mile">${MILESTONES.map((m, i) => `<div class="${i <= S.milestone ? 'done' : ''}"><b>${m.name}</b><span>${fmtNum(m.pop)} pop</span></div>`).join('')}</div>`;
    } else if (tab === 'charts') {
      h = `<div class="charts"><div><h4>Population</h4><canvas id="ch-pop" width="520" height="150"></canvas></div><div><h4>Treasury</h4><canvas id="ch-money" width="520" height="150"></canvas></div><div><h4>Happiness</h4><canvas id="ch-happy" width="520" height="150"></canvas></div><div><h4>Monthly income vs expenses</h4><canvas id="ch-fin" width="520" height="150"></canvas></div></div>`;
    } else if (tab === 'happy') {
      h = `<div class="happy-big">${Math.round(S.happy)}%</div><div class="hp-list">` + S.happyParts.map(([k, v]) => `<div class="hp"><span>${k}</span><div class="hp-bar"><i class="${v >= 0 ? 'p' : 'n'}" style="width:${clamp(Math.abs(v) * 4, 0, 50)}%;${v >= 0 ? 'left:50%' : 'right:50%'}"></i></div><b>${v >= 0 ? '+' : ''}${v.toFixed(1)}</b></div>`).join('') + `</div><p class="dim small">Baseline 52 points. Positive effects come from services, parks and jobs; negative from pollution, noise, crime, high taxes and shortages.</p>`;
    } else if (tab === 'services') {
      const m = sim.maps, n = this.G.world.n;
      const avgCov = (map) => { let s = 0, c = 0; for (const b of sim.blist()) if (b.kind === 'zone' && b.state === 'ok' && b.occ > 0) { s += map[(b.z + (b.d >> 1)) * n + b.x + (b.w >> 1)] * b.occ; c += b.occ; } return c ? s / c : 0; };
      const bar = (n, v, ic) => `<div class="svc"><span>${ic} ${n}</span><div class="sbar"><i style="width:${Math.round(v * 100)}%"></i></div><b>${Math.round(v * 100)}%</b></div>`;
      h = `<div class="svcs">${bar('Police', avgCov(m.police), '🚓')}${bar('Fire', avgCov(m.fire), '🚒')}${bar('Healthcare', avgCov(m.health), '🏥')}${bar('Education', avgCov(m.edu), '🏫')}${bar('Waste collection', avgCov(m.waste), '🗑️')}${bar('Public transit', avgCov(m.transit), '🚌')}</div>
        <p class="dim small">Percentage of residents within reach of each service (scaled by capacity and budget).</p>`;
    }
    body.innerHTML = h;
    if (tab === 'charts') {
      const H = S.hist.slice(-60);
      this.drawChart($('#ch-pop'), [H.map((x) => x.pop)], ['#6bd6a0']);
      this.drawChart($('#ch-money'), [H.map((x) => x.money)], ['#f0c860']);
      this.drawChart($('#ch-happy'), [H.map((x) => x.happy)], ['#7ab8ff']);
      this.drawChart($('#ch-fin'), [H.map((x) => x.inc), H.map((x) => x.exp)], ['#6bd6a0', '#ff7b7b']);
    }
  }
  drawChart(cv, series, colors) {
    if (!cv) return;
    const g = cv.getContext('2d'), W = cv.width, Hh = cv.height;
    g.clearRect(0, 0, W, Hh);
    g.fillStyle = 'rgba(255,255,255,0.04)'; g.fillRect(0, 0, W, Hh);
    const all = series.flat();
    if (all.length < 2) { g.fillStyle = '#8a93a8'; g.font = '13px Inter, sans-serif'; g.fillText('Collecting data… (one point per month)', 14, 30); return; }
    const mn = Math.min(...all, 0), mx = Math.max(...all, 1);
    g.strokeStyle = 'rgba(255,255,255,0.08)';
    for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(0, (Hh * i) / 4); g.lineTo(W, (Hh * i) / 4); g.stroke(); }
    series.forEach((s, k) => {
      g.strokeStyle = colors[k]; g.lineWidth = 2; g.beginPath();
      s.forEach((v, i) => { const x = (i / Math.max(1, s.length - 1)) * (W - 12) + 6, y = Hh - 14 - ((v - mn) / (mx - mn || 1)) * (Hh - 28); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
      g.stroke();
    });
    g.fillStyle = '#9aa3b8'; g.font = '11px Inter, sans-serif'; g.fillText(fmtNum(mx), 6, 12); g.fillText(fmtNum(mn), 6, Hh - 3);
  }

  // ---------------------------------------------------------------- settings
  settingsHTML() {
    const st = this.settings;
    return `<div class="set">
      <div class="set-row"><label>Graphics quality</label><select id="s-q"><option value="high">High (shadows)</option><option value="medium">Medium</option><option value="low">Low (no shadows)</option></select></div>
      <div class="set-row"><label>Day / night</label><select id="s-c"><option value="auto">Cycle automatically</option><option value="day">Always day</option><option value="dusk">Always sunset</option><option value="night">Always night</option></select></div>
      <div class="set-row"><label>Sound effects</label><input type="checkbox" id="s-s" ${st.sound ? 'checked' : ''}></div>
      <div class="set-row"><label>Autosave</label><input type="checkbox" id="s-a" ${st.autosave ? 'checked' : ''}></div>
      <div class="set-row"><label>Fires &amp; crime events</label><input type="checkbox" id="s-d" ${this.G.sim.S.disasters !== false ? 'checked' : ''}></div>
      <hr>
      <div class="btn-row wrap"><button class="btn primary" id="s-save">💾 Save game</button><button class="btn" id="s-load">📂 Load saved game</button><button class="btn" id="s-export">⬇️ Export file</button><button class="btn" id="s-import">⬆️ Import file</button><button class="btn danger" id="s-new">✨ New city</button></div>
      <input type="file" id="s-file" accept=".json,application/json" class="hidden">
      <p class="dim small" id="s-note"></p></div>`;
  }
  bindSettings() {
    const st = this.settings, G = this.G;
    $('#s-q').value = st.quality; $('#s-c').value = st.cycle;
    $('#s-q').addEventListener('change', (e) => { st.quality = e.target.value; this.applySettings(); this.saveSettings(); });
    $('#s-c').addEventListener('change', (e) => { st.cycle = e.target.value; this.saveSettings(); });
    $('#s-s').addEventListener('change', (e) => { st.sound = e.target.checked; this.saveSettings(); });
    $('#s-a').addEventListener('change', (e) => { st.autosave = e.target.checked; this.saveSettings(); });
    $('#s-d').addEventListener('change', (e) => { this.G.sim.S.disasters = e.target.checked; });
    $('#s-save').addEventListener('click', () => { this.save('fcb-save') ? this.toast('Game saved', 'good') : this.toast('Could not save (storage full?)', 'bad'); });
    $('#s-load').addEventListener('click', () => { if (!this.load('fcb-save')) this.toast('No saved game found', 'bad'); else { this.closeModals(); this.toast('Game loaded', 'good'); } });
    $('#s-export').addEventListener('click', () => this.exportFile());
    $('#s-import').addEventListener('click', () => $('#s-file').click());
    $('#s-file').addEventListener('change', (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { G.loadData(JSON.parse(r.result)); this.closeModals(); this.toast('City imported', 'good'); } catch (err) { this.toast('Invalid save file', 'bad'); } }; r.readAsText(f); });
    $('#s-new').addEventListener('click', () => { if (confirm('Start a new city? Unsaved progress will be lost.')) { this.closeModals(); this.showStart(); } });
  }
  applySettings() {
    const v = this.G.view; if (!v) return;
    v.setQuality(this.settings.quality);
    this.ensureAudio();
  }

  helpHTML() {
    return `<div class="help">
      <div class="help-col"><h3>Camera</h3><ul>
        <li><b>W A S D / arrows</b> – pan (Shift = faster)</li><li><b>Q / E</b> – rotate</li><li><b>Mouse wheel</b> – zoom to cursor</li>
        <li><b>Right-drag</b> – orbit &amp; tilt</li><li><b>Middle-drag / Space + drag</b> – pan</li><li><b>Z / X</b> – tilt</li></ul>
        <h3>Tools</h3><ul><li><b>Left-click / drag</b> – use the current tool</li><li><b>R</b> – rotate a building, or flip the bend of a road</li><li><b>Shift</b> while drawing roads – straight line</li><li><b>Esc</b> – cancel tool / close panel</li><li><b>1 2 3 / P</b> – game speed / pause</li><li>With no tool, <b>click a building</b> to inspect it</li></ul></div>
      <div class="help-col"><h3>Getting started</h3><ol>
        <li><b>Shape the land</b> with the Terrain tools: rivers, seas, hills, forests and parks.</li>
        <li>Place a <b>power plant</b> (wind turbines are cheap) and a <b>water pump</b> on the shore — or a <b>water tower &amp; well</b> inland.</li>
        <li>Draw <b>roads</b> connecting them — power and water travel along roads. Use <i>Power Lines</i> to bridge gaps.</li>
        <li>Pick an <b>architecture style</b> and <b>zone</b> Residential, Commercial and Industrial land beside the roads. Buildings grow by themselves where utilities reach; watch the R/C/I demand bars.</li>
        <li>Add <b>services</b>: schools, clinics, police, fire stations and waste facilities. Build a <b>Town Hall</b> to enact <b>laws</b> — police enforce them.</li>
        <li>Watch <b>traffic</b>: upgrade streets to avenues, add bus stops, or lay railways.</li>
        <li>Unlock <b>special industries</b> (farms, ports, mines, resorts, tech…) that use your terrain and boost the economy.</li>
        <li>Grow to <b>25,000</b> citizens — the population cap!</li></ol>
        <h3>Styles</h3><p class="small">Colonial · Georgian · Southern · American · Modern — each zone tile remembers the style it was painted with, so you can build an old colonial harbour next to a modern glass downtown.</p></div></div>`;
  }

  generateHTML() {
    return `<div class="set">
      <p class="dim small">Generates brand-new terrain. <b>This clears your current city.</b></p>
      <div class="tpl-grid" id="g-tpl">${TEMPLATES.map((t, i) => `<button class="tpl ${i === 0 ? 'on' : ''}" data-t="${t.id}"><canvas width="72" height="72"></canvas><b>${t.name}</b><span>${t.desc}</span></button>`).join('')}</div>
      <div class="set-row"><label>Seed</label><input id="g-seed" type="number" value="${(Math.random() * 99999) | 0}" style="width:110px"><button class="btn" id="g-rnd">🎲</button></div>
      <div class="set-row"><label>Forest density</label><input id="g-forest" type="range" min="0" max="1" step="0.1" value="0.5"></div>
      <div class="btn-row"><button class="btn primary" id="g-go">Generate</button></div></div>`;
  }
  bindGenerate() {
    let tpl = 'coast';
    const draw = () => { $$('#g-tpl .tpl').forEach((b) => this.thumb(b.querySelector('canvas'), b.dataset.t, +$('#g-seed').value)); };
    $$('#g-tpl .tpl').forEach((b) => b.addEventListener('click', () => { tpl = b.dataset.t; $$('#g-tpl .tpl').forEach((x) => x.classList.toggle('on', x === b)); }));
    $('#g-rnd').addEventListener('click', () => { $('#g-seed').value = (Math.random() * 99999) | 0; draw(); });
    $('#g-seed').addEventListener('change', draw);
    $('#g-go').addEventListener('click', () => {
      const opts = { template: tpl, seed: +$('#g-seed').value, forest: +$('#g-forest').value };
      this.closeModals();
      this.G.regenerate(opts);
    });
    setTimeout(draw, 20);
  }

  thumb(cv, template, seed) {
    if (!cv) return;
    const w = new World(128);
    w.generate({ seed, template, forest: 0.5 });
    const g = cv.getContext('2d'), S = cv.width, img = g.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const tx = Math.floor((x / S) * 128), tz = Math.floor((y / S) * 128);
      const h = w.tileAvg(tx, tz);
      let c;
      if (h < 0) { const d = clamp(-h / 2.5, 0, 1); c = [60 - d * 40, 130 - d * 60, 190 - d * 50]; }
      else if (h < 0.3) c = [220, 205, 160];
      else if (w.tree[tz * 128 + tx]) c = [60, 120, 60];
      else if (h > 4.2) c = [140, 135, 125];
      else if (h > 2.6) c = [120, 140, 85];
      else c = [110, 165, 85];
      const o = (y * S + x) * 4; img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }

  // ---------------------------------------------------------------- start screen
  showStart() {
    const el = $('#start');
    const hasSave = !!localStorage.getItem('fcb-autosave') || !!localStorage.getItem('fcb-save');
    const rnd = mulberry32((Math.random() * 1e9) | 0);
    this.startOpts = { name: cityName(rnd), template: 'coast', seed: (Math.random() * 99999) | 0, mode: 'career', style: 1, forest: 0.5 };
    const o = this.startOpts;
    el.innerHTML = `<div class="start-card">
      <div class="start-title">Fantasy City Builder</div>
      <div class="start-sub">Sculpt the land. Raise a city of up to 25,000 souls in five architectural styles.</div>
      <div class="start-cols">
        <div class="start-left">
          <label class="lbl">City name</label>
          <div class="set-row"><input id="st-name" value="${o.name}" maxlength="28"><button class="btn" id="st-rn" title="Random name">🎲</button></div>
          <label class="lbl">Starting style</label>
          <div class="style-items" id="st-styles">${STYLES.map((s) => `<button class="style ${o.style === s.id ? 'on' : ''}" data-s="${s.id}" style="--sc:${s.color}" title="${s.desc}"><span class="si">${s.icon}</span><span class="sn">${s.name}</span></button>`).join('')}</div>
          <label class="lbl">Game mode</label>
          <div class="seg" id="st-mode"><button class="on" data-m="career">🏆 Career<small>$60,000 · unlock by population</small></button><button data-m="sandbox">🎨 Sandbox<small>Unlimited money · everything unlocked</small></button></div>
          <div class="set-row"><label>Seed</label><input id="st-seed" type="number" value="${o.seed}" style="width:120px"><button class="btn" id="st-sr">🎲</button></div>
          <div class="set-row"><label>Forests</label><input id="st-forest" type="range" min="0" max="1" step="0.1" value="0.5"></div>
          <div class="btn-row"><button class="btn primary big" id="st-go">Found the city ▶</button>${hasSave ? '<button class="btn big" id="st-cont">Continue saved game</button>' : ''}</div>
          <div class="btn-row"><button class="btn" id="st-file">⬆️ Import save file</button><a class="btn" href="gallery.html" target="_blank" style="text-decoration:none">🏛️ Architecture gallery</a><input type="file" id="st-fi" accept=".json" class="hidden"></div>
        </div>
        <div class="start-right"><label class="lbl">Terrain</label><div class="tpl-grid" id="st-tpl">${TEMPLATES.map((t) => `<button class="tpl ${t.id === o.template ? 'on' : ''}" data-t="${t.id}"><canvas width="72" height="72"></canvas><b>${t.name}</b><span>${t.desc}</span></button>`).join('')}</div></div>
      </div></div>`;
    el.classList.remove('hidden');
    const draw = () => $$('#st-tpl .tpl').forEach((b) => this.thumb(b.querySelector('canvas'), b.dataset.t, o.seed));
    $('#st-name').addEventListener('input', (e) => { o.name = e.target.value; });
    $('#st-rn').addEventListener('click', () => { o.name = cityName(); $('#st-name').value = o.name; });
    $('#st-seed').addEventListener('change', (e) => { o.seed = +e.target.value; draw(); });
    $('#st-sr').addEventListener('click', () => { o.seed = (Math.random() * 99999) | 0; $('#st-seed').value = o.seed; draw(); });
    $('#st-forest').addEventListener('input', (e) => { o.forest = +e.target.value; });
    $$('#st-styles .style').forEach((b) => b.addEventListener('click', () => { o.style = +b.dataset.s; $$('#st-styles .style').forEach((x) => x.classList.toggle('on', x === b)); }));
    $$('#st-tpl .tpl').forEach((b) => b.addEventListener('click', () => { o.template = b.dataset.t; $$('#st-tpl .tpl').forEach((x) => x.classList.toggle('on', x === b)); }));
    $$('#st-mode button').forEach((b) => b.addEventListener('click', () => { o.mode = b.dataset.m; $$('#st-mode button').forEach((x) => x.classList.toggle('on', x === b)); }));
    $('#st-go').addEventListener('click', () => { el.classList.add('hidden'); this.G.newGame(o); this.sfx('good'); });
    $('#st-cont')?.addEventListener('click', () => { if (this.load('fcb-autosave') || this.load('fcb-save')) { el.classList.add('hidden'); } else this.toast('Could not load save', 'bad'); });
    $('#st-file').addEventListener('click', () => $('#st-fi').click());
    $('#st-fi').addEventListener('change', (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { this.G.loadData(JSON.parse(r.result)); el.classList.add('hidden'); } catch (err) { this.toast('Invalid save file', 'bad'); } }; r.readAsText(f); });
    setTimeout(draw, 30);
    this.G.sim && (this.G.sim.S.speed = 0);
  }

  // ================================================================ save / load
  save(key) {
    try { localStorage.setItem(key, JSON.stringify(this.G.sim.serialize())); return true; } catch (e) { console.warn(e); return false; }
  }
  load(key) {
    try { const s = localStorage.getItem(key); if (!s) return false; this.G.loadData(JSON.parse(s)); return true; } catch (e) { console.error(e); return false; }
  }
  firstRunHelp() {
    try { if (localStorage.getItem('fcb-help')) return; localStorage.setItem('fcb-help', '1'); } catch (_) { }
    this.openModal('help', { first: true });
  }
  autosave() { if (this.settings.autosave && this.G.started && (this.G.sim.S.totalDays > 3 || this.G.world.buildings.size > 0)) this.save('fcb-autosave'); }
  exportFile() {
    const data = JSON.stringify(this.G.sim.serialize());
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    a.download = `${this.G.sim.S.name.replace(/\W+/g, '_')}_year${this.G.sim.S.year}.json`;
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ================================================================ input
  onKey(e) {
    if (/input|textarea|select/i.test(e.target.tagName)) return;
    const sim = this.G.sim;
    if (!sim) return;
    if (e.code === 'Digit1') this.setSpeed(1); else if (e.code === 'Digit2') this.setSpeed(2); else if (e.code === 'Digit3') this.setSpeed(3);
    else if (e.code === 'KeyP') this.setSpeed(sim.S.speed === 0 ? 1 : 0);
    else if (e.code === 'KeyB' && !e.ctrlKey) this.selectCategory('bulldoze');
    else if (e.code === 'KeyG') { const v = this.G.view; v.uGrid.value = v.uGrid.value ? 0 : 1; }
    else if (e.code === 'KeyO') { const sel = $('#h-overlay'); const i = (OVERLAYS.findIndex((o) => o.id === this.activeOverlay) + 1) % OVERLAYS.length; this.manualOverlay = OVERLAYS[i].id !== 'none'; this.setOverlay(OVERLAYS[i].id); }
  }

  // ================================================================ audio
  ensureAudio() {
    if (!this.snd.ctx) { try { this.snd.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { } }
    if (this.snd.ctx && this.snd.ctx.state === 'suspended') this.snd.ctx.resume();
  }
  sfx(name) {
    if (!this.settings.sound) return;
    const ctx = this.snd.ctx; if (!ctx) return;
    const t = ctx.currentTime;
    const tone = (f, d, type = 'sine', v = 0.05, f2 = null) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + d + 0.02);
    };
    switch (name) {
      case 'click': tone(620, 0.06, 'triangle', 0.04); break;
      case 'build': tone(180, 0.18, 'square', 0.05, 90); tone(360, 0.1, 'triangle', 0.04); break;
      case 'zone': tone(520, 0.12, 'sine', 0.04, 760); break;
      case 'bulldoze': tone(110, 0.28, 'sawtooth', 0.06, 50); break;
      case 'error': tone(160, 0.18, 'square', 0.04, 110); break;
      case 'good': tone(523, 0.12, 'triangle', 0.05); setTimeout(() => this.ctxTone(659, 0.14), 110); setTimeout(() => this.ctxTone(784, 0.2), 220); break;
      case 'alert': tone(440, 0.14, 'sine', 0.04); setTimeout(() => this.ctxTone(330, 0.2), 140); break;
    }
  }
  ctxTone(f, d) {
    const ctx = this.snd.ctx; if (!ctx || !this.settings.sound) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + d + 0.02);
  }
}

const ARCH_ICON = { house: '🏡', apt: '🏘️', shop: '🏪', office: '🏢', factory: '🏭' };
function row(k, v) { return `<div class="row"><span>${k}</span><b>${v}</b></div>`; }
function footTiles(b) { const t = []; for (let j = 0; j < b.d; j++) for (let i = 0; i < b.w; i++) t.push([b.x + i, b.z + j, 1, 0.9, 0.4, 0.35]); return t; }
