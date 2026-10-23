// Interaction: terrain brushes, roads, zoning, building placement, bulldozing, inspection.
import { clamp, hash2 } from './util.js';
import { R, ROADS, Z, ZONE_INFO, BUILDINGS, STYLES, TERRAIN_TOOLS, LOT_TYPES, AREA_N, AREA_SIZE } from './data.js';
import { DX, DZ } from './world.js';

export class Tools {
  constructor(G) {
    this.G = G;
    this.tool = null;           // {kind, id}
    this.brush = { size: 4, strength: 0.6 };
    this.facing = 2; this.manualFacing = false;
    this.hFirst = true;
    this.drag = null;
    this.hover = null;
    this.mouse = { x: 0, y: 0, over: false };
    this.selected = null;       // selected building id
    this.selTile = null;
    this.riverSeed = 1;
    this.rebuildTimer = 0;
    this.lastPreviewKey = '';
    this.bind();
  }

  get canvas() { return this.G.view.canvas; }

  bind() {
    const c = this.canvas;
    c.addEventListener('pointermove', (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.over = true; });
    c.addEventListener('pointerleave', () => { this.mouse.over = false; this.G.view.showTiles(null); this.G.view.showRing(null); this.G.view.hideGhost(); this.G.ui && this.G.ui.hideTip(); });
    c.addEventListener('pointerdown', (e) => { if (e.button === 0 && !this.G.cam.keys.has('Space')) this.down(e); });
    window.addEventListener('pointerup', (e) => { if (e.button === 0) this.up(e); });
    window.addEventListener('keydown', (e) => this.key(e));
  }

  // ------------------------------------------------------------ tool selection
  setTool(t) {
    this.tool = t;
    this.drag = null; this.manualFacing = false;
    const v = this.G.view;
    v.showTiles(null); v.showRing(null); v.hideGhost(); v.showArea && v.showArea(null);
    const grid = t && (t.kind === 'road' || t.kind === 'zone' || t.kind === 'building' || t.kind === 'lot' || t.kind === 'bulldoze' || t.kind === 'pylon' || t.kind === 'oneway' || t.kind === 'district');
    v.uGrid.value = grid ? 1 : 0;
    const auto = t && t.kind === 'zone' ? 'zones' : t && (t.kind === 'district') ? 'districts' : t && t.kind === 'area' ? 'areas' : t && t.kind === 'line' ? 'transitlines' : null;
    this.G.ui && this.G.ui.setAutoOverlay(auto);
    if (t && t.kind === 'line') this.lineDraft = null;
    this.G.ui && this.G.ui.onToolChanged(t);
  }

  key(e) {
    if (/input|textarea|select/i.test(e.target.tagName)) return;
    if (e.code === 'Escape') {
      if (this.G.ui && this.G.ui.closeModals()) return;
      if (this.tool && this.tool.kind === 'line' && this.lineDraft) { this.finishLine(); return; }
      this.setTool(null); this.select(null); this.G.ui && this.G.ui.unfollow && this.G.ui.unfollow();
    } else if ((e.code === 'Enter' || e.code === 'NumpadEnter') && this.tool && this.tool.kind === 'line') this.finishLine();
    else if (e.code === 'KeyR' && !e.ctrlKey) {
      if (this.tool && this.tool.kind === 'building') { this.facing = (this.facing + 1) % 4; this.manualFacing = true; }
      else this.hFirst = !this.hFirst;
    }
  }

  // ------------------------------------------------------------ pointer events
  pickTile(e) {
    const hit = this.G.view.pick(e.clientX, e.clientY);
    return hit && hit.inside ? hit : null;
  }

  down(e) {
    const hit = this.pickTile(e);
    const t = this.tool;
    if (!t) {
      // citizens & vehicles take priority over the building under them
      const v = this.G.traffic && this.G.traffic.pickVehicle(e.clientX, e.clientY, this.G.view);
      if (v) { this.G.ui.showCim(v); return; }
      if (hit) this.inspect(hit);
      return;
    }
    if (!hit) return;
    this.drag = { x0: hit.x, z0: hit.z, x1: hit.x, z1: hit.z, hx: hit.wx, hz: hit.wz, h0: this.G.world.heightAt(hit.wx, hit.wz) };
    if (t.kind === 'river') this.riverSeed = (Math.random() * 1e6) | 0;
    if ((t.kind === 'building' && !this.isLine(t)) || t.kind === 'lot') { this.place(hit); this.drag = null; }
    else if (t.kind === 'area') { this.buyArea(hit); this.drag = null; }
    else if (t.kind === 'line') { this.lineClick(hit); this.drag = null; }
    else if (t.kind === 'disaster') { this.G.sim.triggerDisaster(t.id, hit.wx, hit.wz); this.drag = null; }
  }

  isLine(t) { return t.kind === 'pylon'; }

  up(e) {
    const t = this.tool, d = this.drag;
    if (!d) return;
    this.drag = null;
    const hit = this.pickTile(e) || this.hover;
    if (hit) { d.x1 = hit.x; d.z1 = hit.z; }
    const G = this.G;
    switch (t && t.kind) {
      case 'road': this.commitRoad(d, t.id); break;
      case 'pylon': this.commitPylon(d); break;
      case 'zone': this.commitZone(d, t.id); break;
      case 'oneway': this.commitOneWay(d, t.id); break;
      case 'district': this.commitDistrict(d, t.id); break;
      case 'bulldoze': this.commitBulldoze(d); break;
      case 'river': {
        const w = G.world;
        const pts = w.riverPath(d.x0 + 0.5, d.z0 + 0.5, d.x1 + 0.5, d.z1 + 0.5, this.riverSeed, 0.8);
        w.carveRiver(pts, Math.max(1.2, this.brush.size * 0.55));
        G.sim.touchWorld(); w.dirty.roads = true; w.dirty.trees = true;
        break;
      }
      case 'terrain': case 'park': case 'forest': case 'clear': w_flush(G); break;
      default: break;
    }
    G.view.showTiles(null);
  }

  inspect(hit) {
    const w = this.G.world, i = hit.z * w.n + hit.x;
    let b = w.bid[i] ? w.buildings.get(w.bid[i]) : null;
    if (!b && w.stops && w.stops.has(i)) b = w.stops.get(i);
    this.select(b, hit);
  }
  select(b, hit) {
    this.selected = b ? b.id : null;
    this.selTile = !b && hit ? { x: hit.x, z: hit.z } : null;
    this.G.ui && this.G.ui.showSelection(b, this.selTile);
  }

  // ------------------------------------------------------------ areas, districts, one-way, lines
  buyArea(hit) {
    const G = this.G, w = G.world;
    const k = w.areaIndex(hit.x, hit.z);
    if (w.areas[k]) { G.ui.toast('You already own this area', 'info'); return; }
    const r = G.sim.buyArea(k);
    if (!r.ok) G.ui.toast(r.reason, 'bad'); else { G.ui.sfx('good'); G.ui.applyOverlay(); }
  }
  commitDistrict(d, id) {
    const sim = this.G.sim;
    let did = 0;
    if (id !== 'erase') {
      if (!this.activeDistrict || !sim.districtById(this.activeDistrict)) this.activeDistrict = sim.newDistrict().id;
      did = this.activeDistrict;
    }
    let n = 0;
    for (const [x, z] of this.rectTiles(d)) if (sim.paintDistrict(x, z, did)) n++;
    if (n) { sim.touchWorld(); this.G.ui.sfx('zone'); this.G.ui.applyOverlay(); this.G.view.labelsDirty = true; this.G.ui.refreshDistrictPanel && this.G.ui.refreshDistrictPanel(); }
  }
  commitOneWay(d, id) {
    const sim = this.G.sim, w = this.G.world;
    const tiles = this.roadPath(d, this.hFirst);
    if (tiles.length < 2 && id === 'oneway') { this.G.ui.toast('Drag along the street in the direction of travel', 'info'); return; }
    let n = 0;
    for (let k = 0; k < tiles.length; k++) {
      const [x, z] = tiles[k];
      if (!w.inb(x, z)) continue;
      const i = z * w.n + x;
      let t = w.road[i];
      if (id === 'twoway') { if (w.rdir[i]) { w.rdir[i] = 0; n++; } continue; }
      if (!t) { if (!sim.placeRoad(x, z, R.STREET)) continue; t = R.STREET; }
      if (t === R.RAIL || t === R.HIGHWAY || t === R.LANE) continue;
      // direction from this tile to the next (or from the previous one for the last tile)
      const [nx, nz] = k < tiles.length - 1 ? tiles[k + 1] : [x + (x - tiles[k - 1][0]), z + (z - tiles[k - 1][1])];
      const dx = Math.sign(nx - x), dz = Math.sign(nz - z);
      const dir = dz < 0 ? 0 : dx > 0 ? 1 : dz > 0 ? 2 : 3;
      w.rdir[i] = dir + 1; n++;
    }
    if (n) { w.dirty.roads = true; sim.touchWorld(); this.G.ui.sfx('build'); if (this.G.traffic) this.G.traffic.pathRev = -1; }
  }
  lineClick(hit) {
    const G = this.G, sim = G.sim, w = G.world, n = w.n;
    const type = this.tool.id;
    let key = null;
    if (type === 'bus') {
      // nearest bus stop within 1 tile
      let best = null, bd = 9;
      for (const [k] of w.stops || []) { const x = k % n, z = (k / n) | 0; const d = Math.hypot(x + 0.5 - hit.wx, z + 0.5 - hit.wz); if (d < 1.4 && d < bd) { bd = d; best = k; } }
      key = best;
      if (key === null) { G.ui.toast('Click on a bus stop (build them on streets first)', 'bad'); return; }
    } else {
      const i = hit.z * n + hit.x, b = w.bid[i] ? w.buildings.get(w.bid[i]) : null;
      if (!b || b.key !== 'metro') { G.ui.toast('Click on a metro station', 'bad'); return; }
      key = b.id;
    }
    if (!this.lineDraft) { this.lineDraft = sim.newLine(type); G.ui.toast(`${this.lineDraft.name} started — click more stops, then click the first stop (or press Enter) to finish.`, 'info'); }
    const L = this.lineDraft;
    if (L.stops.length >= 2 && key === L.stops[0]) { this.finishLine(); return; }
    if (L.stops[L.stops.length - 1] === key) return;
    L.stops.push(key);
    G.ui.sfx('click');
    if (G.traffic) G.traffic.linesRev = -1;
    sim.mapsDirty = true; G.ui.applyOverlay();
  }
  finishLine() {
    const L = this.lineDraft, G = this.G;
    this.lineDraft = null;
    if (!L) return;
    if (L.stops.length < 2) { G.sim.removeLine(L.id); G.ui.toast('A line needs at least two stops', 'bad'); return; }
    G.sim.mapsDirty = true; if (G.traffic) G.traffic.linesRev = -1;
    G.sim.log(`${L.type === 'metro' ? 'Ⓜ️' : '🚌'} ${L.name} opened with ${L.stops.length} stops.`, 'good');
    G.ui.toast(`${L.name} created`, 'good'); G.ui.sfx('good');
    G.ui.openModal('transit');
  }

  // ------------------------------------------------------------ road path
  roadPath(d, hFirst) {
    const tiles = [];
    let { x0, z0, x1, z1 } = d;
    if (this.G.cam.keys.has('ShiftLeft') || this.G.cam.keys.has('ShiftRight')) {
      // straight line along dominant axis
      if (Math.abs(x1 - x0) >= Math.abs(z1 - z0)) z1 = z0; else x1 = x0;
    }
    const sx = Math.sign(x1 - x0) || 1, sz = Math.sign(z1 - z0) || 1;
    if (hFirst) {
      for (let x = x0; x !== x1 + sx; x += sx) tiles.push([x, z0]);
      for (let z = z0 + sz; z !== z1 + sz && z0 !== z1; z += sz) tiles.push([x1, z]);
    } else {
      for (let z = z0; z !== z1 + sz; z += sz) tiles.push([x0, z]);
      for (let x = x0 + sx; x !== x1 + sx && x0 !== x1; x += sx) tiles.push([x, z1]);
    }
    return tiles;
  }

  evalRoad(tiles, type) {
    const sim = this.G.sim, w = this.G.world;
    let cost = 0, bridgeRun = 0, bad = false;
    const out = [];
    for (const [x, z] of tiles) {
      if (!w.inb(x, z)) { out.push([x, z, false]); bad = true; continue; }
      let ok = sim.canRoad(x, z, type);
      const water = w.water[z * w.n + x];
      bridgeRun = water ? bridgeRun + 1 : 0;
      if (bridgeRun > 8) ok = false;
      if (ok) cost += sim.roadCost(x, z, type);
      else bad = true;
      out.push([x, z, ok]);
    }
    return { out, cost, bad };
  }

  commitRoad(d, type) {
    const sim = this.G.sim;
    const tiles = this.roadPath(d, this.hFirst);
    const { out, cost } = this.evalRoad(tiles, type);
    if (!sim.canAfford(cost)) { this.G.ui.toast('Not enough money', 'bad'); return; }
    let n = 0;
    for (const [x, z, ok] of out) if (ok && sim.placeRoad(x, z, type)) n++;
    if (n) this.G.ui.sfx('build');
  }
  commitPylon(d) {
    const sim = this.G.sim;
    const tiles = this.roadPath(d, this.hFirst);
    let n = 0;
    for (const [x, z] of tiles) if (sim.placePylon(x, z)) n++;
    if (n) this.G.ui.sfx('build');
  }

  rectTiles(d) {
    const x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1), z0 = Math.min(d.z0, d.z1), z1 = Math.max(d.z0, d.z1);
    const t = [];
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) t.push([x, z]);
    return t;
  }

  commitZone(d, id) {
    const sim = this.G.sim, w = this.G.world;
    const style = sim.S.style;
    const tiles = this.rectTiles(d);
    let n = 0, cost = 0;
    for (const [x, z] of tiles) {
      const i = z * w.n + x;
      if (id === 0) { if (w.zone[i] && !w.bid[i]) { w.zone[i] = 0; w.markGround(x, z, x, z); n++; } else if (w.park[i]) { if (sim.clearPark(x, z)) n++; } }
      else if (id === Z.PARK) { if (sim.paintPark(x, z)) n++; }
      else if (sim.paintZone(x, z, id, style)) n++;
    }
    if (n) { sim.touchWorld(); this.G.ui.sfx('zone'); }
    else if (id && tiles.length && tiles.every(([x, z]) => !sim.ownsTile(x, z))) this.G.ui.toast('You don\'t own this land yet — buy it under Areas', 'bad');
  }

  commitBulldoze(d) {
    const sim = this.G.sim, w = this.G.world;
    const tiles = this.rectTiles(d);
    const seen = new Set();
    let n = 0;
    for (const [x, z] of tiles) {
      const i = z * w.n + x;
      if (w.bid[i]) { const b = w.buildings.get(w.bid[i]); if (b && !seen.has(b.id)) { seen.add(b.id); sim.bulldozeBuilding(b); n++; } continue; }
      if (w.stops && w.stops.has(i)) { sim.bulldozeBuilding(w.stops.get(i)); n++; continue; }
      if (w.road[i]) { if (!sim.sandbox()) sim.S.money += Math.round(ROADS[w.road[i]].cost * 0.4); sim.removeRoad(x, z); n++; continue; }
      if (w.pylon[i]) { sim.removePylon(x, z); n++; continue; }
      if (w.zone[i]) { w.zone[i] = 0; w.markGround(x, z, x, z); sim.touchWorld(); n++; continue; }
      if (w.park[i]) { sim.clearPark(x, z); n++; continue; }
      if (w.tree[i]) { w.tree[i] = 0; w.dirty.trees = true; w.markGround(x, z, x, z); n++; }
    }
    if (n) { this.G.ui.sfx('bulldoze'); this.select(null); }
  }

  // ------------------------------------------------------------ building placement
  placement(hit) {
    const key = this.tool.id, def = BUILDINGS[key], sim = this.G.sim, w = this.G.world;
    let facing = this.facing;
    const probe = (f) => { const [fw, fd] = sim.footprint(def, f); return [fw, fd, hit.x - (fw >> 1), hit.z - (fd >> 1)]; };
    if (def.place === 'road') return { def, key, x: hit.x, z: hit.z, fw: 1, fd: 1, facing: this.facing };
    let [fw, fd, x, z] = probe(facing);
    if (!this.manualFacing) { facing = sim.bestFacing(x, z, fw, fd, 2); [fw, fd, x, z] = probe(facing); facing = sim.bestFacing(x, z, fw, fd, facing); [fw, fd, x, z] = probe(facing); }
    return { def, key, x, z, fw, fd, facing };
  }

  lotPlacement(hit) {
    const lot = LOT_TYPES.find((l) => l.id === this.tool.id), sim = this.G.sim;
    const probe = (f) => { const [fw, fd] = sim.lotFootprint(lot, f); return [fw, fd, hit.x - (fw >> 1), hit.z - (fd >> 1)]; };
    let facing = this.facing;
    let [fw, fd, x, z] = probe(facing);
    if (!this.manualFacing) { facing = sim.bestFacing(x, z, fw, fd, 2); [fw, fd, x, z] = probe(facing); facing = sim.bestFacing(x, z, fw, fd, facing); [fw, fd, x, z] = probe(facing); }
    return { lot, x, z, fw, fd, facing };
  }

  place(hit) {
    const t = this.tool; if (!t) return;
    const sim = this.G.sim;
    if (t.kind === 'lot') {
      const p = this.lotPlacement(hit);
      const res = sim.placeLot(p.lot, p.x, p.z, p.facing, sim.S.style);
      if (!res.ok) { if (res.reason) this.G.ui.toast(res.reason, 'bad'); return; }
      this.G.ui.sfx('build'); this.G.view.hideGhost();
      return;
    }
    if (t.kind !== 'building') return;
    const p = this.placement(hit);
    const res = sim.placeSpecial(p.key, p.x, p.z, p.facing, sim.S.style);
    if (!res.ok) { if (res.reason) this.G.ui.toast(res.reason, 'bad'); return; }
    this.G.ui.sfx('build');
    if (res.b && p.def.place !== 'road') {
      const v = this.G.view; v.hideGhost();
    }
  }

  // ------------------------------------------------------------ per-frame
  update(dt) {
    const G = this.G, v = G.view, w = G.world, sim = G.sim;
    if (!this.mouse.over) return;
    const hit = this.pickTile({ clientX: this.mouse.x, clientY: this.mouse.y });
    this.hover = hit;
    if (!hit) { v.showTiles(null); v.showRing(null); v.hideGhost(); G.ui.hideTip(); return; }
    const t = this.tool;
    if (this.drag) { this.drag.x1 = hit.x; this.drag.z1 = hit.z; }
    this.rebuildTimer += dt;
    if (!t) {
      v.showRing(null); v.hideGhost();
      const tiles = [[hit.x, hit.z, 1, 1, 1, 0.22]];
      const sb = this.selected ? w.buildings.get(this.selected) : null;
      if (sb) for (let j = 0; j < sb.d; j++) for (let i = 0; i < sb.w; i++) tiles.push([sb.x + i, sb.z + j, 1, 0.9, 0.4, 0.35]);
      v.showTiles(tiles);
      G.ui.tileTip(hit, this.mouse);
      return;
    }
    switch (t.kind) {
      case 'terrain': case 'park': case 'forest': case 'clear': {
        v.showRing(hit.wx, hit.wz, this.brush.size, '#ffffff'); v.showTiles(null);
        if (this.drag) this.applyBrush(t, hit, dt);
        G.ui.setTip(`${t.name || ''} — radius ${this.brush.size}`, this.mouse);
        break;
      }
      case 'river': {
        v.showRing(null);
        if (this.drag) {
          const pts = w.riverPath(this.drag.x0 + 0.5, this.drag.z0 + 0.5, hit.x + 0.5, hit.z + 0.5, this.riverSeed, 0.8);
          const seen = new Set(), tiles = [];
          for (const [px, pz] of pts) { const k = (px | 0) + ',' + (pz | 0); if (!seen.has(k)) { seen.add(k); tiles.push([px | 0, pz | 0, 0.2, 0.55, 1, 0.5]); } }
          v.showTiles(tiles);
        } else v.showTiles([[hit.x, hit.z, 0.2, 0.55, 1, 0.5]]);
        G.ui.setTip('Drag to carve a river (R is unused here). Width follows brush size.', this.mouse);
        break;
      }
      case 'road': case 'pylon': {
        const type = t.kind === 'road' ? t.id : 0;
        const d = this.drag || { x0: hit.x, z0: hit.z, x1: hit.x, z1: hit.z };
        const tiles = this.roadPath(d, this.hFirst);
        if (t.kind === 'road') {
          const { out, cost, bad } = this.evalRoad(tiles, type);
          v.showTiles(out.map(([x, z, ok]) => [x, z, ok ? 0.25 : 1, ok ? 1 : 0.2, ok ? 0.45 : 0.2, 0.75]));
          G.ui.setTip(`${ROADS[type].name} · ${tiles.length} tiles · ${sim.sandbox() ? 'free' : '$' + Math.round(cost).toLocaleString()}${bad ? ' · blocked' : ''}  (R: change bend)`, this.mouse);
        } else {
          v.showTiles(tiles.map(([x, z]) => [x, z, 0.95, 0.85, 0.3, 0.55]));
          G.ui.setTip(`Power Line · ${tiles.length} pylons`, this.mouse);
        }
        v.showRing(null);
        break;
      }
      case 'zone': {
        const d = this.drag || { x0: hit.x, z0: hit.z, x1: hit.x, z1: hit.z };
        const tiles = this.rectTiles(d);
        const zi = ZONE_INFO[t.id];
        const col = t.id === 0 ? [0.9, 0.9, 0.9] : zi.color.map((c) => c / 255);
        let ok = 0;
        const arr = tiles.map(([x, z]) => {
          const valid = t.id === 0 || (w.buildable(x, z) && !w.road[z * w.n + x] && !w.bid[z * w.n + x]);
          if (valid) ok++;
          return [x, z, valid ? col[0] : 1, valid ? col[1] : 0.2, valid ? col[2] : 0.2, valid ? 0.5 : 0.35];
        });
        v.showTiles(arr); v.showRing(null);
        G.ui.setTip(t.id === 0 ? `Clear zoning · ${tiles.length} tiles` : `${zi.name} · ${STYLES[sim.S.style].name} · ${ok} tiles · ${sim.sandbox() ? 'free' : '$' + ok * (t.id === Z.PARK ? 4 : 2)}`, this.mouse);
        break;
      }
      case 'oneway': {
        const d = this.drag || { x0: hit.x, z0: hit.z, x1: hit.x, z1: hit.z };
        const tiles = this.roadPath(d, this.hFirst);
        v.showTiles(tiles.map(([x, z]) => [x, z, 0.3, 0.75, 1, 0.6])); v.showRing(null);
        G.ui.setTip(t.id === 'twoway' ? 'Drag over one-way streets to make them two-way' : `One-way street · drag in the direction of traffic · ${tiles.length} tiles`, this.mouse);
        break;
      }
      case 'district': {
        const d = this.drag || { x0: hit.x, z0: hit.z, x1: hit.x, z1: hit.z };
        const did = this.activeDistrict;
        const dd = did ? sim.districtById(did) : null;
        const c = dd ? dd.color : '#ffffff';
        const col = [parseInt(c.slice(1, 3), 16) / 255, parseInt(c.slice(3, 5), 16) / 255, parseInt(c.slice(5, 7), 16) / 255];
        v.showTiles(this.rectTiles(d).map(([x, z]) => (t.id === 'erase' ? [x, z, 1, 0.3, 0.3, 0.45] : [x, z, col[0], col[1], col[2], 0.55]))); v.showRing(null);
        G.ui.setTip(t.id === 'erase' ? 'Erase district (drag)' : `Paint ${dd ? dd.name : 'new district'} (drag)`, this.mouse);
        break;
      }
      case 'area': {
        const k = w.areaIndex(hit.x, hit.z), ax = (k % AREA_N) * AREA_SIZE, az = ((k / AREA_N) | 0) * AREA_SIZE;
        const owned = w.areas[k], buy = sim.areaBuyable(k);
        v.showTiles([[ax, az, 1, 1, 1, 0], [ax + AREA_SIZE - 1, az + AREA_SIZE - 1, 1, 1, 1, 0]]);
        v.showArea(ax, az, AREA_SIZE, owned ? '#6bd6a0' : buy ? '#e8c26a' : '#ff6b6b');
        G.ui.setTip(owned ? 'You own this area' : buy ? `Buy this area · $${sim.areaCost().toLocaleString()}${sim.sandbox() ? '' : ` · permits: ${sim.S.permits || 0}`}` : 'Must border land you own', this.mouse, owned || buy ? '' : 'bad');
        break;
      }
      case 'line': {
        v.showRing(null); v.showTiles([[hit.x, hit.z, 0.4, 0.7, 1, 0.6]]);
        const L = this.lineDraft;
        G.ui.setTip(L ? `${L.name}: ${L.stops.length} stops · click next stop · click first stop or Enter to finish` : `Click a ${t.id === 'bus' ? 'bus stop' : 'metro station'} to start a ${t.id === 'bus' ? 'bus' : 'metro'} line`, this.mouse);
        break;
      }
      case 'disaster': {
        v.showRing(hit.wx, hit.wz, 3, '#ff5a3c'); v.showTiles(null);
        G.ui.setTip(`Click to unleash: ${t.name}`, this.mouse, 'bad');
        break;
      }
      case 'bulldoze': {
        const d = this.drag || { x0: hit.x, z0: hit.z, x1: hit.x, z1: hit.z };
        v.showTiles(this.rectTiles(d).map(([x, z]) => [x, z, 1, 0.2, 0.15, 0.5])); v.showRing(null);
        G.ui.setTip('Bulldoze (drag to select an area)', this.mouse);
        break;
      }
      case 'lot': {
        const p = this.lotPlacement(hit), lot = p.lot;
        const chk = sim.canPlaceLot(lot, p.x, p.z, p.facing);
        const tiles = [];
        for (let j = 0; j < p.fd; j++) for (let i = 0; i < p.fw; i++) tiles.push([p.x + i, p.z + j, chk.ok ? 0.3 : 1, chk.ok ? 0.9 : 0.25, chk.ok ? 0.4 : 0.25, 0.4]);
        v.showTiles(tiles); v.showRing(null);
        const x = clamp(p.x, 0, w.n - p.fw), z = clamp(p.z, 0, w.n - p.fd);
        let sum = 0, cnt = 0;
        for (let j = 0; j <= p.fd; j++) for (let i = 0; i <= p.fw; i++) { sum += w.H(x + i, z + j); cnt++; }
        const rec = { kind: 'zone', arch: lot.arch, style: sim.S.style === 5 ? 1 : sim.S.style, level: lot.level, lw: lot.lw, ld: lot.ld, x, z, w: p.fw, d: p.fd, facing: p.facing, seed: 5, y0: Math.max(0.3, sum / cnt) };
        v.showGhost(rec, chk.ok);
        G.ui.setTip(`${STYLES[sim.S.style].name} ${lot.name}${chk.ok ? '' : ' — ' + chk.reason}${sim.sandbox() ? '' : ' · $' + lot.cost.toLocaleString()}  (R: rotate)`, this.mouse, chk.ok ? '' : 'bad');
        break;
      }
      case 'building': {
        const p = this.placement(hit);
        const def = p.def;
        let chk;
        if (def.place === 'road') {
          chk = sim.canPlace(p.key, p.x, p.z, p.facing);
          v.showTiles([[p.x, p.z, chk.ok ? 0.3 : 1, chk.ok ? 0.9 : 0.25, chk.ok ? 0.4 : 0.25, 0.6]]);
          const rec = { kind: 'special', key: p.key, style: 0, level: 1, lw: 1, ld: 1, x: p.x, z: p.z, w: 1, d: 1, facing: this.roadFacing(p.x, p.z), seed: 5, y0: w.roadY(p.x + 0.5, p.z + 0.5) };
          v.showGhost(rec, chk.ok);
        } else {
          chk = sim.canPlace(p.key, p.x, p.z, p.facing);
          const tiles = [];
          for (let j = 0; j < p.fd; j++) for (let i = 0; i < p.fw; i++) tiles.push([p.x + i, p.z + j, chk.ok ? 0.3 : 1, chk.ok ? 0.9 : 0.25, chk.ok ? 0.4 : 0.25, 0.4]);
          v.showTiles(tiles);
          const x = clamp(p.x, 0, w.n - p.fw), z = clamp(p.z, 0, w.n - p.fd);
          let sum = 0, cnt = 0;
          for (let j = 0; j <= p.fd; j++) for (let i = 0; i <= p.fw; i++) { sum += w.H(x + i, z + j); cnt++; }
          const y0 = Math.max(0.3, sum / cnt);
          const rec = { kind: 'special', key: p.key, style: def.styled ? (sim.S.style === 5 ? 1 : sim.S.style) : 0, level: 1, lw: def.w, ld: def.d, x, z, w: p.fw, d: p.fd, facing: p.facing, seed: 5, y0 };
          if (def.cat === 'power' && p.key === 'pylon') { v.hideGhost(); }
          else v.showGhost(rec, chk.ok);
        }
        v.showRing(null);
        let warn = '';
        if (chk.ok && def.power > 0 && !chk.adjRoad) {
          let py = false;
          for (let dz = -4; dz <= p.fd + 3 && !py; dz++) for (let dx = -4; dx <= p.fw + 3; dx++) if (w.inb(p.x + dx, p.z + dz) && w.pylon[(p.z + dz) * w.n + p.x + dx]) { py = true; break; }
          if (!py) warn = '<br><span style="color:#f6c065">⚠️ Not connected: put it beside a road or add power lines</span>';
        }
        G.ui.setTip(`${def.name}${chk.ok ? '' : ' — ' + chk.reason}${sim.sandbox() ? '' : ' · $' + def.cost.toLocaleString()}  (R: rotate)${warn}`, this.mouse, chk.ok ? '' : 'bad');
        break;
      }
      default: break;
    }
  }

  roadFacing(x, z) {
    const m = this.G.world.roadMask(x, z);
    return (m & 5) ? 1 : 2;
  }

  applyBrush(t, hit, dt) {
    const w = this.G.world, sim = this.G.sim, b = this.brush;
    const r = b.size, k = b.strength;
    if (t.kind === 'terrain') {
      const mode = t.id;
      const amt = (mode === 'raise' || mode === 'lower') ? 2.2 * k * dt : (mode === 'smooth' ? 1.4 * k * dt : (mode === 'flatten' ? 1.0 * k * dt : 4.5 * k * dt));
      w.brush(mode, hit.wx, hit.wz, r, amt, this.drag.h0);
      if (this.rebuildTimer > 0.2) { this.rebuildTimer = 0; w_flush(this.G); }
    } else if (t.kind === 'park') {
      const R_ = Math.max(1, Math.round(r));
      for (let z = hit.z - R_; z <= hit.z + R_; z++) for (let x = hit.x - R_; x <= hit.x + R_; x++) if (Math.hypot(x - hit.x, z - hit.z) <= R_ && w.inb(x, z)) sim.paintPark(x, z);
    } else if (t.kind === 'forest' || t.kind === 'clear') {
      if (!sim.ownsTile(hit.x, hit.z)) return;
      w.paintTrees(hit.wx, hit.wz, r, t.kind === 'forest' ? 1 : 0);
    }
  }
}

function w_flush(G) {
  const w = G.world;
  w.dirty.roads = true; w.dirty.trees = true;
  G.sim.touchWorld();
  // rebuild building ground heights are untouched (vertices under buildings are locked)
}
