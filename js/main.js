// Entry point: boots the engine, runs the main loop, manages new/load game.
import { World } from './world.js';
import { View } from './view.js';
import { CamCtl } from './camctl.js';
import { Sim } from './sim.js';
import { Traffic } from './traffic.js';
import { Tools } from './tools.js';
import { UI } from './ui.js';
import { clamp, mulberry32 } from './util.js';
import { STYLES, LOTS, BUILDINGS } from './data.js';
import { DX, DZ } from './world.js';

const G = { started: false, overlayDirty: false };
window.G = G; // handy for debugging in the console

const sleep = (ms = 0) => new Promise((r) => setTimeout(r, ms));

async function boot() {
  const canvas = document.getElementById('game');
  G.world = new World(128);
  G.world.generate({ seed: 7, template: 'coast', forest: 0.55 });
  G.ui = new UI(G);
  G.ui.init();
  G.ui.setLoading(0.05, 'Raising the terrain…');
  await sleep(30);
  try {
    G.view = new View(canvas, G);
  } catch (e) {
    document.getElementById('load-msg').textContent = 'WebGL is required to run this game. ' + e.message;
    throw e;
  }
  G.cam = new CamCtl(G.view, canvas);
  G.cam.onUnfollow = () => G.ui.refreshCim(true);
  G.cam.td = 78; G.cam.ty = 0.5; G.cam.tp = 0.62;
  G.sim = new Sim(G);
  G.traffic = new Traffic(G);
  G.traffic.buildModels(G.view.atlas, G.view.matCar, G.view.scene);
  G.tools = new Tools(G);
  G.world.canEdit = (x, z) => G.sim.ownsTile(x, z);
  G.sim.reset({ name: 'Fairhaven', mode: 'career' });
  G.sim.S.speed = 0;
  G.ui.applySettings();
  await prewarm();
  G.ui.setLoading(1, 'Ready');
  await sleep(150);
  G.ui.hideLoading();
  G.ui.refresh(0, true);
  G.ui.showStart();
  requestAnimationFrame(frame);
}

/** Generate a spread of buildings once so the texture atlas is filled before play (avoids hitching). */
async function prewarm() {
  const view = G.view;
  const archs = ['house', 'row', 'apt', 'mixed', 'shop', 'store', 'office', 'factory'];
  let k = 0;
  const total = 5 * archs.length * 3 * 3 + Object.keys(BUILDINGS).length * 5 + 4 * 3;
  for (let st = 0; st < 5; st++) for (const arch of archs) for (let lvl = 1; lvl <= 3; lvl++) for (let s = 0; s < 3; s++) {
    const lots = LOTS[arch].map((l) => l[0]);
    const lot = lots[(s + lvl) % lots.length];
    try { view.arc.generate({ kind: 'zone', arch, style: st, level: lvl, lw: lot[0], ld: lot[1], x: 0, z: 0, w: lot[0], d: lot[1], facing: 2, seed: 1000 + st * 97 + lvl * 13 + s * 7, y0: 0 }); } catch (e) { console.warn('prewarm', st, arch, lvl, e.message); }
    if (++k % 18 === 0) { G.ui.setLoading(0.1 + 0.55 * (k / total), 'Surveying architecture…'); await sleep(0); }
  }
  for (const arch of ['agri', 'forest', 'ore', 'oil']) for (let lvl = 1; lvl <= 3; lvl++) {
    const lot = LOTS[arch][0][0];
    try { view.arc.generate({ kind: 'zone', arch, style: 0, level: lvl, lw: lot[0], ld: lot[1], x: 0, z: 0, w: lot[0], d: lot[1], facing: 2, seed: 77 + lvl, y0: 0 }); } catch (e) { console.warn('prewarm', arch, e.message); }
    k++;
  }
  for (const key in BUILDINGS) {
    const d = BUILDINGS[key];
    if (key === 'pylon') continue;
    for (let st = 0; st < (d.styled ? 5 : 1); st++) {
      try { view.arc.generate({ kind: 'special', key, style: st, level: 1, lw: d.w, ld: d.d, x: 0, z: 0, w: d.w, d: d.d, facing: 2, seed: 7, y0: 0 }); } catch (e) { console.warn('prewarm special', key, e.message); }
      if (++k % 8 === 0) { G.ui.setLoading(0.1 + 0.55 * (k / total), 'Drafting civic buildings…'); await sleep(0); }
    }
  }
  G.ui.setLoading(0.75, 'Painting textures…');
  view.atlas.flush();
  await sleep(10);
  view.renderer.compile(view.scene, view.camera);
  G.ui.setLoading(0.9, 'Almost there…');
}

G.resetWorldView = () => {
  const v = G.view;
  v.clearAllBuildings();
  G.traffic.reset();
  G.world.dirty.roads = true; G.world.dirty.trees = true;
  G.world.markTerrain(0, 0, G.world.n - 1, G.world.n - 1);
  G.world.markGround(0, 0, G.world.n - 1, G.world.n - 1);
};

G.newGame = (o) => {
  const w = G.world;
  w.generate({ seed: o.seed, template: o.template, forest: o.forest });
  if (o.template !== 'flat') w.makeHighwayEntry(mulberry32(o.seed * 13 + 1));
  G.sim.reset({ name: o.name, mode: o.mode, seed: o.seed, climate: o.climate });
  G.sim.S.style = o.style;
  G.sim.S.template = o.template;
  G.resetWorldView();
  G.view.updateTerrain(true);
  G.ui.buildStylebar();
  G.ui.refresh(0, true);
  G.cam.focus(w.n / 2, w.n / 2, 64);
  G.cam.ty = 0.6; G.cam.tp = 0.85;
  G.ui.setOverlay('none'); G.ui.manualOverlay = false;
  G.view.setAreas(w.areas, false); G.view.labelsDirty = true;
  G.tools.setTool(null); G.tools.select(null); G.tools.activeDistrict = null;
  G.ui.cat = null; G.ui.showSubbar(null); G.ui.markCat();
  G.started = true;
  G.sim.S.speed = 1;
  G.ui.setSpeed(1);
  G.ui.toast(`Welcome to ${o.name}! Start with Roads, Power and Water.`, 'good');
  G.ui.firstRunHelp();
};

G.regenerate = (o) => {
  const S = G.sim.S;
  G.newGame({ name: S.name, mode: S.mode, style: S.style, template: o.template, seed: o.seed, forest: o.forest, climate: S.climate });
};

G.loadData = (data) => {
  G.resetWorldView();
  G.sim.load(data);
  G.world.dirty.roads = true; G.world.dirty.trees = true;
  G.view.updateTerrain(true);
  G.ui.buildStylebar();
  G.ui.refresh(0, true);
  G.cam.focus(G.world.n / 2, G.world.n / 2, 64);
  G.view.setAreas(G.world.areas, G.ui.activeOverlay === 'areas'); G.view.labelsDirty = true;
  G.tools.activeDistrict = null;
  G.started = true;
  G.sim.S.speed = 1; G.ui.setSpeed(1);
};

// ------------------------------------------------------------------ main loop
let last = performance.now(), skyT = 0, ovT = 0, slowT = 0, qCool = 10;
function frame(t) {
  const dt = clamp((t - last) / 1000, 0, 0.1);
  last = t;
  const S = G.sim.S;
  G.cam.update(dt);
  if (!G.started) G.cam.ty += dt * 0.04;
  if (G.started) {
    const cyc = G.ui.settings.cycle;
    const rate = [0, 0.16, 0.3, 0.5][S.speed];
    if (cyc === 'auto') S.tod = (S.tod + dt * rate) % 24;
    else S.tod = cyc === 'day' ? 12 : cyc === 'dusk' ? 18.4 : 1.5;
    G.sim.update(dt);
    G.traffic.update(dt, G.sim);
    G.tools.update(dt);
  } else if (G.sim) {
    S.tod = (S.tod + dt * 0.1) % 24;
    G.view.flushChunks(8);
  }
  // adaptive quality: step graphics down if the frame rate is persistently poor
  qCool -= dt;
  if (G.started && !navigator.webdriver && !document.hidden) {
    slowT = dt > 0.045 ? slowT + dt : Math.max(0, slowT - dt * 2);
    if (slowT > 4 && qCool <= 0) {
      const order = ['high', 'medium', 'low'], i = order.indexOf(G.ui.settings.quality);
      if (i >= 0 && i < 2) { G.ui.settings.quality = order[i + 1]; G.ui.applySettings(); G.ui.saveSettings(); G.ui.toast(`Graphics lowered to ${order[i + 1]} for smoother play (change in Menu)`, 'info'); }
      slowT = 0; qCool = 12;
    }
  }
  skyT -= dt;
  G.view.setWeather(S, dt);
  if (skyT <= 0) { G.view.setTime(S.tod); skyT = 0.08; }
  G.view.frame(dt, S.speed);
  G.ui.refresh(dt);
  ovT -= dt;
  if (G.ui.activeOverlay !== 'none' && ovT <= 0) { ovT = 1.0; G.ui.applyOverlay(); }
  requestAnimationFrame(frame);
}

boot().catch((e) => { console.error(e); });
