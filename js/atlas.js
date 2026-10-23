// Procedural texture atlas: road auto-tiles, facade bays, roofs, decals.
// One atlas is shared by every building, road and prop so the whole city merges into few draw calls.
import * as THREE from '../lib/three.module.js';
import { mulberry32, strSeed, shade, mix, hex2rgb, rgb2hex, clamp } from './util.js';

const AW = 4096, AH = 4096;
const ROAD_S = 128;           // road cell size
const FAC_S = 64;             // facade cell size
const FAC_Y0 = ROAD_S * 6;    // facade region starts below road region
const FAC_COLS = AW / FAC_S;
const FAC_ROWS = (AH - FAC_Y0) / FAC_S;

export class Atlas {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = AW; this.canvas.height = AH;
    this.ctx = this.canvas.getContext('2d');
    this.ecanvas = document.createElement('canvas');
    this.ecanvas.width = AW / 2; this.ecanvas.height = AH / 2;
    this.ectx = this.ecanvas.getContext('2d');
    this.ectx.fillStyle = '#000'; this.ectx.fillRect(0, 0, AW / 2, AH / 2);
    this.ctx.fillStyle = '#888'; this.ctx.fillRect(0, 0, AW, AH);

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
    this.texture.generateMipmaps = true;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.emissive = new THREE.CanvasTexture(this.ecanvas);
    this.emissive.colorSpace = THREE.SRGBColorSpace;
    this.emissive.anisotropy = 4;
    this.emissive.channel = 1;
    this.blackUV = [2.5 / AW, 1 - 2.5 / AH];

    this.cells = new Map();
    this.next = 0;
    this.dirty = false;
    this.roadCells = [];
    this.drawRoads();
    this.white = this.solid('#ffffff');
    this.dirty = true;
  }

  flush() {
    if (!this.dirty) return;
    this.texture.needsUpdate = true;
    this.emissive.needsUpdate = true;
    this.dirty = false;
  }

  _rect(px, py, w, h) {
    return {
      u0: (px + 0.5) / AW, u1: (px + w - 0.5) / AW,
      vt: 1 - (py + 0.5) / AH, vb: 1 - (py + h - 0.5) / AH,
    };
  }

  _alloc() {
    const k = this.next++;
    if (k >= FAC_COLS * FAC_ROWS) { this.full = true; return null; }
    return { x: (k % FAC_COLS) * FAC_S, y: FAC_Y0 + Math.floor(k / FAC_COLS) * FAC_S };
  }
  _overflow() {
    if (!this._ovf) { console.warn('texture atlas full; using fallback cell'); this._ovf = this.solid('#9a958a'); }
    return this._ovf;
  }

  // ------------------------------------------------------------ road region
  road(type, mask) { return this.roadCells[(type - 1) * 16 + mask]; }

  drawRoads() {
    for (let t = 1; t <= 6; t++) {
      for (let m = 0; m < 16; m++) {
        const ox = m * ROAD_S, oy = (t - 1) * ROAD_S;
        this.ctx.save();
        this.ctx.beginPath(); this.ctx.rect(ox, oy, ROAD_S, ROAD_S); this.ctx.clip();
        this.ctx.translate(ox, oy);
        drawRoadCell(this.ctx, t, m, ROAD_S);
        this.ctx.restore();
        const cell = this._rect(ox, oy, ROAD_S, ROAD_S);
        if (t >= 2 && t <= 5) {
          // night-time pools of street light, sampled through the emissive map
          const e = this.ectx;
          e.save(); e.beginPath(); e.rect(ox / 2, oy / 2, ROAD_S / 2, ROAD_S / 2); e.clip();
          e.translate(ox / 2, oy / 2); e.scale(0.5, 0.5);
          drawRoadGlow(e, t, m, ROAD_S);
          e.restore();
          cell.glow = true;
        }
        this.roadCells[(t - 1) * 16 + m] = cell;
      }
    }
  }

  // ------------------------------------------------------------ facade cells
  solid(color) {
    const key = 'solid:' + color;
    let c = this.cells.get(key);
    if (c) return c;
    const p = this._alloc();
    if (!p) return this.cells.get('solid:#ffffff') || this.white;
    const ctx = this.ctx;
    ctx.fillStyle = color; ctx.fillRect(p.x, p.y, FAC_S, FAC_S);
    c = this._rect(p.x, p.y, FAC_S, FAC_S);
    this.cells.set(key, c); this.dirty = true;
    return c;
  }

  /** wall bay: recipe {m,c,w,wc,sh,fl,lit,dc,aw}. Irrelevant fields are normalised away so cells get reused. */
  wall(r0) {
    const r = normRecipe(r0);
    const key = 'w|' + r.m + '|' + r.c + '|' + r.w + '|' + r.wc + '|' + r.sh + '|' + r.fl + '|' + r.lit + '|' + r.dc + '|' + r.aw + '|' + r.gl + '|' + r.sg;
    let c = this.cells.get(key);
    if (c) return c;
    const p = this._alloc();
    if (!p) return this._overflow();
    const rnd = mulberry32(strSeed(key));
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath(); ctx.rect(p.x, p.y, FAC_S, FAC_S); ctx.clip();
    ctx.translate(p.x, p.y);
    drawWallCell(ctx, r, 'color', rnd);
    ctx.restore();
    const e = this.ectx;
    e.save();
    e.beginPath(); e.rect(p.x / 2, p.y / 2, FAC_S / 2, FAC_S / 2); e.clip();
    e.fillStyle = '#000'; e.fillRect(p.x / 2, p.y / 2, FAC_S / 2, FAC_S / 2);
    e.translate(p.x / 2, p.y / 2); e.scale(0.5, 0.5);
    if (r.hasEmit) drawWallCell(e, Object.assign({}, r, { lit: 1 }), 'emit', mulberry32(strSeed(key + 'e')));
    e.restore();
    c = this._rect(p.x, p.y, FAC_S, FAC_S);
    c.hasEmit = r.hasEmit;
    this.cells.set(key, c); this.dirty = true;
    return c;
  }

  /** roof texture: {m, c} */
  roof(r) {
    const key = 'r|' + r.m + '|' + r.c;
    let c = this.cells.get(key);
    if (c) return c;
    const p = this._alloc();
    if (!p) return this._overflow();
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath(); ctx.rect(p.x, p.y, FAC_S, FAC_S); ctx.clip();
    ctx.translate(p.x, p.y);
    drawRoofCell(ctx, r, mulberry32(strSeed(key)));
    ctx.restore();
    c = this._rect(p.x, p.y, FAC_S, FAC_S);
    this.cells.set(key, c); this.dirty = true;
    return c;
  }

  /** arbitrary decal: draw(ctx, size) */
  decal(key, draw, emitDraw) {
    key = 'd|' + key;
    let c = this.cells.get(key);
    if (c) return c;
    const p = this._alloc();
    if (!p) return this._overflow();
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath(); ctx.rect(p.x, p.y, FAC_S, FAC_S); ctx.clip();
    ctx.translate(p.x, p.y);
    draw(ctx, FAC_S);
    ctx.restore();
    if (emitDraw) {
      const e = this.ectx;
      e.save();
      e.beginPath(); e.rect(p.x / 2, p.y / 2, FAC_S / 2, FAC_S / 2); e.clip();
      e.translate(p.x / 2, p.y / 2); e.scale(0.5, 0.5);
      emitDraw(e, FAC_S);
      e.restore();
    }
    c = this._rect(p.x, p.y, FAC_S, FAC_S);
    c.glow = !!emitDraw;
    this.cells.set(key, c); this.dirty = true;
    return c;
  }

  clock() {
    return this.decal('clock', (ctx, S) => {
      ctx.fillStyle = '#f4f1e7'; ctx.fillRect(0, 0, S, S); ctx.fillStyle = '#fbfaf3'; ctx.beginPath(); ctx.arc(S / 2, S / 2, S * 0.42, 0, 7); ctx.fill();
      ctx.strokeStyle = '#222'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(S / 2, S / 2); ctx.lineTo(S / 2, S * 0.2); ctx.moveTo(S / 2, S / 2); ctx.lineTo(S * 0.7, S * 0.58); ctx.stroke();
      ctx.lineWidth = 1.5; for (let k = 0; k < 12; k++) { const an = k * Math.PI / 6; ctx.beginPath(); ctx.moveTo(S / 2 + Math.cos(an) * S * 0.36, S / 2 + Math.sin(an) * S * 0.36); ctx.lineTo(S / 2 + Math.cos(an) * S * 0.4, S / 2 + Math.sin(an) * S * 0.4); ctx.stroke(); }
    });
  }

  helipad() {
    return this.decal('helipad', (ctx, S) => {
      ctx.fillStyle = '#3b3f45'; ctx.fillRect(0, 0, S, S); ctx.strokeStyle = '#e8c43a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(S / 2, S / 2, S * 0.4, 0, 7); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillRect(S * 0.3, S * 0.28, 5, S * 0.44); ctx.fillRect(S * 0.62, S * 0.28, 5, S * 0.44); ctx.fillRect(S * 0.3, S * 0.46, S * 0.38, 5);
    });
  }

  /** pre-built simple tiled materials (paving etc.) are plain solids */
  /** emissive uv: the cell's own art when lit, otherwise a black texel */
  euv(cell, lu, lv, lit) { return (cell.glow || (lit && cell.hasEmit)) ? this.uv(cell, lu, lv) : this.blackUV; }
  uv(cell, lu, lv) { return [cell.u0 + lu * (cell.u1 - cell.u0), cell.vt + lv * (cell.vb - cell.vt)]; }
}

const SHUT = new Set(['sash', 'small', 'arch', 'tall', 'porchdoor']);
const DOORW = new Set(['door', 'garage', 'loading', 'porchdoor']);
const LITW = new Set(['sash', 'small', 'arch', 'tall', 'casement', 'ribbon', 'curtain', 'deco', 'shop', 'slit', 'gallery', 'porchdoor']);
const FLRW = new Set(['shop', 'door', 'porchdoor', 'garage', 'loading', 'gallery']);
const GLASSW = new Set(['sash', 'small', 'arch', 'tall', 'casement', 'ribbon', 'curtain', 'deco', 'shop', 'slit', 'gallery', 'plainw', 'door', 'porchdoor']);
function normRecipe(r) {
  const w = r.w || '';
  return {
    m: r.m || 'plain', c: r.c || '#cccccc', w, wc: GLASSW.has(w) ? (r.wc || '') : '', sh: SHUT.has(w) ? (r.sh || '') : '', fl: FLRW.has(w) ? (r.fl || 'u') : 'u',
    lit: 0, hasEmit: LITW.has(w), dc: DOORW.has(w) ? (r.dc || '') : '', aw: r.aw || '', gl: GLASSW.has(w) ? (r.gl || '') : '', sg: w === 'shop' ? (r.sg || '') : '',
  };
}

// ======================================================================= drawing helpers
function speckle(ctx, x, y, w, h, n, rnd, amt = 0.08) {
  for (let i = 0; i < n; i++) {
    const px = x + rnd() * w, py = y + rnd() * h;
    ctx.fillStyle = rnd() < 0.5 ? `rgba(255,255,255,${rnd() * amt})` : `rgba(0,0,0,${rnd() * amt})`;
    ctx.fillRect(px | 0, py | 0, 1 + (rnd() < 0.3 ? 1 : 0), 1);
  }
}

function drawRoadCell(ctx, type, mask, S) {
  const rnd = mulberry32(type * 977 + mask * 31);
  const c = S / 2;
  const widths = { 1: 0.4, 2: 0.62, 3: 0.84, 4: 0.88, 5: 0.96, 6: 0.5 };
  const half = widths[type] * S / 2;
  const N = mask & 1, E = mask & 2, Sd = mask & 4, W = mask & 8;
  const nconn = (N ? 1 : 0) + (E ? 1 : 0) + (Sd ? 1 : 0) + (W ? 1 : 0);
  const straightNS = (mask === 5) || (mask === 1) || (mask === 4) || (mask === 0);
  const straightEW = (mask === 10) || (mask === 2) || (mask === 8);
  const corner = nconn === 2 && !(mask === 5 || mask === 10);

  ctx.clearRect(0, 0, S, S);

  if (type === 6) { drawRail(ctx, mask, S, rnd); return; }

  // ---- background
  if (type === 1) {
    // dirt lane: transparent background
  } else if (type === 5) {
    ctx.fillStyle = '#6f7266'; ctx.fillRect(0, 0, S, S);
    speckle(ctx, 0, 0, S, S, 900, rnd, 0.15);
  } else {
    // sidewalk
    ctx.fillStyle = '#b3aea2'; ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = 'rgba(80,76,70,0.28)'; ctx.lineWidth = 1;
    for (let i = 0; i <= S; i += 16) {
      ctx.beginPath(); ctx.moveTo(i + 0.5, 0); ctx.lineTo(i + 0.5, S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i + 0.5); ctx.lineTo(S, i + 0.5); ctx.stroke();
    }
    speckle(ctx, 0, 0, S, S, 800, rnd, 0.12);
  }

  // asphalt shape (arms + centre, rounded outer corner)
  const shape = (grow) => {
    const h = half + grow;
    ctx.beginPath();
    const arm = (d) => {
      switch (d) {
        case 0: ctx.rect(c - h, -1, h * 2, c + 1); break;
        case 1: ctx.rect(c, c - h, c + 1, h * 2); break;
        case 2: ctx.rect(c - h, c, h * 2, c + 1); break;
        case 3: ctx.rect(-1, c - h, c + 1, h * 2); break;
      }
    };
    if (nconn === 0) { arm(0); arm(2); }
    else for (let d = 0; d < 4; d++) if (mask & (1 << d)) arm(d);
    ctx.rect(c - h, c - h, h * 2, h * 2);
  };
  const baseCol = type === 1 ? '#a98e66' : type === 5 ? '#34373b' : '#3d4045';
  const curbCol = type === 1 ? '#8f7650' : '#8c8b86';
  if (type !== 1) { shape(2.5); ctx.fillStyle = curbCol; ctx.fill(); }
  shape(0); ctx.fillStyle = baseCol; ctx.fill();

  // round the outer corner
  if (corner) {
    const rr = half * 0.95;
    // find outer corner: opposite of connected sides
    const ox = (mask & 2) ? -1 : 1; // if east connected, outer corner is west
    const oz = (mask & 1) ? 1 : -1; // if north connected, outer corner is south
    const cx0 = c + ox * half, cz0 = c + oz * half;
    const bg = type === 1 ? null : '#b3aea2';
    ctx.save();
    ctx.beginPath(); ctx.rect(Math.min(cx0, cx0 - ox * rr), Math.min(cz0, cz0 - oz * rr), rr, rr);
    ctx.clip();
    if (type === 1) ctx.clearRect(0, 0, S, S); else { ctx.fillStyle = bg; ctx.fillRect(0, 0, S, S); }
    ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.rect(Math.min(cx0, cx0 - ox * rr), Math.min(cz0, cz0 - oz * rr), rr, rr); ctx.clip();
    if (type !== 1) { ctx.beginPath(); ctx.arc(cx0 - ox * rr, cz0 - oz * rr, rr + 2.5, 0, Math.PI * 2); ctx.fillStyle = curbCol; ctx.fill(); }
    ctx.beginPath(); ctx.arc(cx0 - ox * rr, cz0 - oz * rr, rr, 0, Math.PI * 2); ctx.fillStyle = baseCol; ctx.fill();
    ctx.restore();
  }

  // clip further painting to asphalt
  ctx.save();
  shape(0); ctx.clip();
  if (type === 1) {
    speckle(ctx, 0, 0, S, S, 1400, rnd, 0.22);
  } else {
    speckle(ctx, 0, 0, S, S, 1600, rnd, 0.1);
    // subtle tyre wear
    ctx.globalAlpha = 0.07; ctx.fillStyle = '#000';
    if (!corner && nconn <= 2) {
      if (straightNS) { ctx.fillRect(c - half * 0.5 - 6, 0, 12, S); ctx.fillRect(c + half * 0.5 - 6, 0, 12, S); }
      if (straightEW) { ctx.fillRect(0, c - half * 0.5 - 6, S, 12); ctx.fillRect(0, c + half * 0.5 - 6, S, 12); }
    }
    ctx.globalAlpha = 1;
  }

  const yellow = '#e0b52a', white = '#e6e6e0';
  const dashLine = (x0, y0, x1, y1, col, wd, on = 8, off = 8) => {
    ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.setLineDash([on, off]); ctx.lineDashOffset = 0;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.setLineDash([]);
  };
  const solidLine = (x0, y0, x1, y1, col, wd) => dashLine(x0, y0, x1, y1, col, wd, 999, 0);

  const junction = nconn >= 3;
  // markings per arm
  const armLine = (d, off, col, wd, dashed) => {
    // line parallel to arm d at lateral offset off, from border to the junction square edge (or through for straight roads)
    const ext = (junction || corner || nconn === 1) ? half : 0;
    const L = (dashed ? dashLine : solidLine);
    switch (d) {
      case 0: L(c + off, 0, c + off, c - ext, col, wd); break;
      case 2: L(c + off, S, c + off, c + ext, col, wd); break;
      case 1: L(S, c + off, c + ext, c + off, col, wd); break;
      case 3: L(0, c + off, c - ext, c + off, col, wd); break;
    }
  };
  const lanes = (d) => {
    switch (type) {
      case 2:
        armLine(d, 0, yellow, 2, true); break;
      case 3:
        armLine(d, -2.5, yellow, 1.8, false); armLine(d, 2.5, yellow, 1.8, false);
        armLine(d, -half * 0.5, white, 1.5, true); armLine(d, half * 0.5, white, 1.5, true); break;
      case 4:
        armLine(d, -half * 0.55, white, 1.5, true); armLine(d, half * 0.55, white, 1.5, true); break;
      case 5:
        armLine(d, -half * 0.33, white, 1.8, true); armLine(d, half * 0.33, white, 1.8, true);
        armLine(d, -half * 0.88, white, 2, false); armLine(d, half * 0.88, white, 2, false); break;
    }
  };
  if (type >= 2) {
    if (nconn === 0) { lanes(0); lanes(2); }
    else for (let d = 0; d < 4; d++) if (mask & (1 << d)) lanes(d);
    // medians
    if (type === 4 || type === 3 || type === 5) {
      const mw = type === 4 ? 14 : type === 5 ? 5 : 0;
      if (mw) {
        const col = type === 4 ? '#4c8f43' : '#9a9a96';
        ctx.fillStyle = col;
        const arms = nconn === 0 ? [0, 2] : [0, 1, 2, 3].filter((d) => mask & (1 << d));
        for (const d of arms) {
          const ext = (junction || corner || nconn === 1) ? half : 0;
          if (d === 0) ctx.fillRect(c - mw / 2, 0, mw, c - ext);
          if (d === 2) ctx.fillRect(c - mw / 2, c + ext, mw, c - ext);
          if (d === 1) ctx.fillRect(c + ext, c - mw / 2, c - ext, mw);
          if (d === 3) ctx.fillRect(0, c - mw / 2, c - ext, mw);
        }
        if (!junction && !corner && nconn !== 1) {
          if (straightNS) ctx.fillRect(c - mw / 2, 0, mw, S);
          if (straightEW) ctx.fillRect(0, c - mw / 2, S, mw);
        }
        if (type === 4) {
          // little trees (round blobs)
          for (let k = 0; k < 4; k++) {
            const t = 16 + k * 32;
            ctx.fillStyle = '#2f6f35';
            if (straightNS || nconn === 0) { ctx.beginPath(); ctx.arc(c, t, 6, 0, 6.3); ctx.fill(); }
            if (straightEW) { ctx.beginPath(); ctx.arc(t, c, 6, 0, 6.3); ctx.fill(); }
          }
        }
      }
    }
    // crosswalks at junctions
    if (junction && type <= 4) {
      ctx.fillStyle = 'rgba(235,235,225,0.9)';
      for (let d = 0; d < 4; d++) {
        if (!(mask & (1 << d))) continue;
        const z0 = half + 3, zl = 9;
        for (let s = -half + 3; s < half - 2; s += 7) {
          switch (d) {
            case 0: ctx.fillRect(c + s, c - z0 - zl, 4, zl); break;
            case 2: ctx.fillRect(c + s, c + z0, 4, zl); break;
            case 1: ctx.fillRect(c + z0, c + s, zl, 4); break;
            case 3: ctx.fillRect(c - z0 - zl, c + s, zl, 4); break;
          }
        }
      }
    }
  } else {
    // dirt ruts
    ctx.globalAlpha = 0.35; ctx.fillStyle = '#5b4527';
    const arms = nconn === 0 ? [0, 2] : [0, 1, 2, 3].filter((d) => mask & (1 << d));
    for (const d of arms) for (const o of [-half * 0.4, half * 0.4]) {
      switch (d) {
        case 0: ctx.fillRect(c + o - 2, 0, 4, c); break;
        case 2: ctx.fillRect(c + o - 2, c, 4, c); break;
        case 1: ctx.fillRect(c, c + o - 2, c, 4); break;
        case 3: ctx.fillRect(0, c + o - 2, c, 4); break;
      }
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();

}

function drawRoadGlow(ctx, type, mask, S) {
  const c = S / 2;
  const half = { 2: 0.62, 3: 0.84, 4: 0.88, 5: 0.96 }[type] * S / 2;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, S, S);
  ctx.globalCompositeOperation = 'lighter';
  const pool = (x, y, r, a) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,196,120,${a})`); g.addColorStop(0.55, `rgba(220,150,80,${a * 0.45})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  const a = type === 5 ? 0.3 : 0.42;
  const nconn = [0, 1, 2, 3].filter((d) => mask & (1 << d)).length;
  if (nconn >= 3) pool(c, c, S * 0.55, a * 0.9);
  else {
    const ns = (mask & 5) || mask === 0, ew = !!(mask & 10);
    if (ns) { pool(c - half * 0.75, c, S * 0.42, a); pool(c + half * 0.75, c, S * 0.42, a * 0.85); }
    if (ew) { pool(c, c - half * 0.75, S * 0.42, a); pool(c, c + half * 0.75, S * 0.42, a * 0.85); }
  }
  ctx.globalCompositeOperation = 'source-over';
}

function drawRail(ctx, mask, S, rnd) {
  const c = S / 2;
  const N = mask & 1, E = mask & 2, Sd = mask & 4, W = mask & 8;
  const nconn = (N ? 1 : 0) + (E ? 1 : 0) + (Sd ? 1 : 0) + (W ? 1 : 0);
  const corner = nconn === 2 && mask !== 5 && mask !== 10;
  const arms = nconn === 0 ? [0, 2] : [0, 1, 2, 3].filter((d) => mask & (1 << d));
  const bw = 36;
  const pathFor = (a, b) => {
    const pt = (d) => [[c, 0], [S, c], [c, S], [0, c]][d];
    const pa = pt(a), pb = pt(b);
    ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.quadraticCurveTo(c, c, pb[0], pb[1]);
  };
  // ballast
  ctx.lineCap = 'butt';
  ctx.strokeStyle = '#74695c'; ctx.lineWidth = bw;
  if (corner) { const [a, b] = arms; pathFor(a, b); ctx.stroke(); }
  else {
    for (const d of arms) { const pt = [[c, 0], [S, c], [c, S], [0, c]][d]; ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(pt[0], pt[1]); ctx.stroke(); }
    ctx.fillStyle = '#74695c'; ctx.fillRect(c - bw / 2, c - bw / 2, bw, bw);
  }
  // ballast speckle (only on already-painted pixels)
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  speckle(ctx, 0, 0, S, S, 1400, rnd, 0.2);
  ctx.restore();
  // sleepers
  ctx.strokeStyle = '#4a3a2a'; ctx.lineWidth = 3;
  const sleeper = (x, y, horiz) => {
    ctx.beginPath();
    if (horiz) { ctx.moveTo(x - 13, y); ctx.lineTo(x + 13, y); } else { ctx.moveTo(x, y - 13); ctx.lineTo(x, y + 13); }
    ctx.stroke();
  };
  if (corner) {
    const [a, b] = arms;
    const pt = (d) => [[c, 0], [S, c], [c, S], [0, c]][d];
    const pa = pt(a), pb = pt(b);
    for (let t = 0.04; t < 1; t += 0.085) {
      const x = (1 - t) * (1 - t) * pa[0] + 2 * (1 - t) * t * c + t * t * pb[0];
      const y = (1 - t) * (1 - t) * pa[1] + 2 * (1 - t) * t * c + t * t * pb[1];
      const dx = 2 * (1 - t) * (c - pa[0]) + 2 * t * (pb[0] - c), dy = 2 * (1 - t) * (c - pa[1]) + 2 * t * (pb[1] - c);
      const l = Math.hypot(dx, dy) || 1;
      ctx.beginPath(); ctx.moveTo(x - dy / l * 13, y + dx / l * 13); ctx.lineTo(x + dy / l * 13, y - dx / l * 13); ctx.stroke();
    }
    ctx.strokeStyle = '#b9bcc2'; ctx.lineWidth = 2.4;
    for (const o of [-8, 8]) {
      ctx.beginPath();
      const oa = a % 2 === 0 ? [pa[0] + o, pa[1]] : [pa[0], pa[1] + o];
      const ob = b % 2 === 0 ? [pb[0] + o, pb[1]] : [pb[0], pb[1] + o];
      ctx.moveTo(oa[0], oa[1]); ctx.quadraticCurveTo(c + (a % 2 === 0 ? o : 0) * 0 + (b % 2 === 0 ? o : 0) * 0, c, ob[0], ob[1]); ctx.stroke();
    }
  } else {
    for (const d of arms) {
      for (let t = 4; t < c; t += 11) {
        switch (d) {
          case 0: sleeper(c, c - t, true); break;
          case 2: sleeper(c, c + t, true); break;
          case 1: sleeper(c + t, c, false); break;
          case 3: sleeper(c - t, c, false); break;
        }
      }
    }
    sleeper(c, c, true); sleeper(c, c, false);
    ctx.strokeStyle = '#b9bcc2'; ctx.lineWidth = 2.4;
    for (const o of [-8, 8]) for (const d of arms) {
      ctx.beginPath();
      switch (d) {
        case 0: ctx.moveTo(c + o, 0); ctx.lineTo(c + o, c); break;
        case 2: ctx.moveTo(c + o, S); ctx.lineTo(c + o, c); break;
        case 1: ctx.moveTo(S, c + o); ctx.lineTo(c, c + o); break;
        case 3: ctx.moveTo(0, c + o); ctx.lineTo(c, c + o); break;
      }
      ctx.stroke();
    }
  }
}

// ----------------------------------------------------------------------- wall cells
function wallPattern(ctx, r, rnd) {
  const S = FAC_S, c = r.c || '#cccccc';
  ctx.fillStyle = c; ctx.fillRect(0, 0, S, S);
  switch (r.m) {
    case 'clap': {
      const bh = 6;
      for (let y = 0; y < S; y += bh) {
        ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(0, y, S, 1);
        ctx.fillStyle = 'rgba(0,0,0,0.20)'; ctx.fillRect(0, y + bh - 2, S, 2);
        ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.fillRect(0, y + bh - 3, S, 1);
      }
      speckle(ctx, 0, 0, S, S, 300, rnd, 0.06);
      break;
    }
    case 'brick': {
      const bh = 4, bw = 10;
      ctx.fillStyle = shade(c, 1.35); ctx.globalAlpha = 0.55; ctx.fillRect(0, 0, S, S); ctx.globalAlpha = 1;
      for (let row = 0, y = 0; y < S; row++, y += bh) {
        const off = row % 2 ? bw / 2 : 0;
        for (let x = -off; x < S; x += bw) {
          const f = 0.88 + rnd() * 0.24;
          ctx.fillStyle = shade(c, f);
          ctx.fillRect(x + 1, y + 1, bw - 1, bh - 1);
        }
      }
      speckle(ctx, 0, 0, S, S, 250, rnd, 0.08);
      break;
    }
    case 'stucco': {
      speckle(ctx, 0, 0, S, S, 900, rnd, 0.13);
      break;
    }
    case 'stone': {
      for (let y = 0; y < S; y += 10) {
        let x = -(rnd() * 10) | 0;
        while (x < S) {
          const w = 12 + ((rnd() * 10) | 0);
          ctx.fillStyle = shade(c, 0.9 + rnd() * 0.2);
          ctx.fillRect(x + 1, y + 1, w - 1, 9);
          x += w;
        }
      }
      speckle(ctx, 0, 0, S, S, 400, rnd, 0.1);
      break;
    }
    case 'conc': {
      speckle(ctx, 0, 0, S, S, 700, rnd, 0.1);
      ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fillRect(0, 0, 1, S); ctx.fillRect(S - 1, 0, 1, S);
      ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(0, 0, S, 1);
      break;
    }
    case 'metal': {
      for (let x = 0; x < S; x += 4) {
        ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(x, 0, 1, S);
        ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(x + 2, 0, 1, S);
      }
      speckle(ctx, 0, 0, S, S, 150, rnd, 0.1);
      break;
    }
    case 'wood': {
      for (let x = 0; x < S; x += 8) {
        ctx.fillStyle = shade(c, 0.9 + rnd() * 0.2); ctx.fillRect(x, 0, 8, S);
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x, 0, 1, S);
      }
      speckle(ctx, 0, 0, S, S, 300, rnd, 0.1);
      break;
    }
    case 'glass': {
      const g = ctx.createLinearGradient(0, 0, S, S);
      g.addColorStop(0, shade(c, 1.25)); g.addColorStop(1, shade(c, 0.7));
      ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
      break;
    }
    default: speckle(ctx, 0, 0, S, S, 200, rnd, 0.05);
  }
}

const GLASS = {
  slate: ['#4b627a', '#26364a'],
  blue: ['#6d90b5', '#2d4a69'],
  teal: ['#58a6bb', '#1d5068'],
  dark: ['#3a4452', '#151b24'],
  green: ['#5f8f86', '#22443f'],
  warm: ['#7a8691', '#38424c'],
};

function litColor(rnd) {
  const r = rnd();
  return r < 0.6 ? ['#ffd88a', '#ffb44d'] : r < 0.85 ? ['#fff0c8', '#ffd68a'] : ['#cfe6ff', '#8fc0ff'];
}

function paneRect(ctx, x, y, w, h, mode, gl, lc, frame, cols, rows, arch = false) {
  const [g1, g2] = GLASS[gl] || GLASS.slate;
  if (mode === 'color') {
    // frame backing
    ctx.fillStyle = frame;
    if (arch) { archPath(ctx, x - 2, y - 2, w + 4, h + 4); ctx.fill(); } else ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, g1); g.addColorStop(1, g2);
    ctx.fillStyle = g;
    if (arch) { archPath(ctx, x, y, w, h); ctx.fill(); } else ctx.fillRect(x, y, w, h);
    // glare
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath(); ctx.moveTo(x, y + h * 0.7); ctx.lineTo(x + w * 0.6, y); ctx.lineTo(x + w * 0.85, y); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fill();
  } else {
    if (!lc) return;
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, lc[0]); g.addColorStop(1, lc[1]);
    ctx.fillStyle = g;
    if (arch) { archPath(ctx, x, y, w, h); ctx.fill(); } else ctx.fillRect(x, y, w, h);
  }
  // muntins
  ctx.fillStyle = mode === 'color' ? frame : '#000';
  for (let i = 1; i < cols; i++) ctx.fillRect(x + (w * i) / cols - 0.8, y, 1.6, h);
  for (let j = 1; j < rows; j++) ctx.fillRect(x, y + (h * j) / rows - 0.8, w, 1.6);
}

function archPath(ctx, x, y, w, h) {
  ctx.beginPath();
  ctx.moveTo(x, y + h); ctx.lineTo(x, y + w / 2);
  ctx.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0);
  ctx.lineTo(x + w, y + h); ctx.closePath();
}

function drawWallCell(ctx, r, mode, rnd) {
  const S = FAC_S;
  const frame = r.wc || '#f1eee4';
  const gl = r.gl || 'slate';
  const lc = r.lit ? litColor(rnd) : null;
  if (mode === 'color') wallPattern(ctx, r, rnd);
  const col = r.c || '#cccccc';
  const W = (x, y, w, h, cols, rows, arch) => paneRect(ctx, x, y, w, h, mode, gl, lc, frame, cols, rows, arch);
  const sill = (x, w, y) => { if (mode === 'color') { ctx.fillStyle = frame; ctx.fillRect(x - 3, y, w + 6, 3); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x - 3, y + 3, w + 6, 1.5); } };
  const lintel = (x, w, y, tone) => { if (mode === 'color') { ctx.fillStyle = tone || '#d8d3c6'; ctx.fillRect(x - 3, y - 4, w + 6, 4); ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(x - 3, y, w + 6, 1); } };
  const shutters = (x, y, w, h, sw) => {
    if (mode !== 'color' || !r.sh) return;
    ctx.fillStyle = r.sh;
    ctx.fillRect(x - sw - 2, y - 1, sw, h + 2); ctx.fillRect(x + w + 2, y - 1, sw, h + 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    for (let yy = y + 2; yy < y + h; yy += 3) { ctx.fillRect(x - sw - 2, yy, sw, 1); ctx.fillRect(x + w + 2, yy, sw, 1); }
  };

  switch (r.w) {
    case 'sash': {
      const w = 20, h = 30, x = (S - w) / 2, y = 12;
      shutters(x, y, w, h, 6);
      if (r.m === 'brick' || r.m === 'stone') lintel(x, w, y, '#d6d1c3');
      W(x, y, w, h, 2, 3); sill(x, w, y + h + 2);
      break;
    }
    case 'small': {
      const w = 15, h = 22, x = (S - w) / 2, y = 16;
      shutters(x, y, w, h, 5);
      W(x, y, w, h, 3, 3); sill(x, w, y + h + 2);
      break;
    }
    case 'arch': {
      const w = 22, h = 40, x = (S - w) / 2, y = 9;
      shutters(x, y + 6, w, h - 6, 6);
      W(x, y, w, h, 2, 4, true);
      break;
    }
    case 'tall': {
      const w = 22, h = 46, x = (S - w) / 2, y = 6;
      shutters(x, y, w, h, 7);
      W(x, y, w, h, 2, 5);
      break;
    }
    case 'casement': {
      const w = 34, h = 26, x = (S - w) / 2, y = 14;
      W(x, y, w, h, 2, 1); sill(x, w, y + h + 2);
      break;
    }
    case 'ribbon': {
      W(2, 14, S - 4, 26, 4, 1);
      if (mode === 'color') { ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(0, 0, S, 4); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, S - 5, S, 5); }
      break;
    }
    case 'curtain': {
      W(1, 1, S - 2, S - 8, 2, 1);
      if (mode === 'color') { ctx.fillStyle = r.c || '#9aa'; ctx.fillRect(0, S - 7, S, 7); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, S - 7, S, 1); }
      break;
    }
    case 'deco': {
      // art-deco tall slim window pair between piers
      const w = 11, h = 38;
      W(10, 10, w, h, 1, 4); W(S - 10 - w, 10, w, h, 1, 4);
      if (mode === 'color') { ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(S / 2 - 3, 0, 6, S); }
      break;
    }
    case 'shop': {
      // storefront: sign band + big window + bulkhead
      const sign = r.sg || '#6b2f2a';
      if (mode === 'color') {
        ctx.fillStyle = sign; ctx.fillRect(0, 0, S, 14);
        ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(0, 13, S, 1);
        ctx.fillStyle = 'rgba(255,240,200,0.55)';
        const tw = 16 + ((rnd() * 20) | 0); ctx.fillRect((S - tw) / 2, 5, tw, 3);
        ctx.fillStyle = frame; ctx.fillRect(3, 17, S - 6, 36);
      }
      paneRect(ctx, 6, 20, S - 12, 28, mode, 'warm', lc, frame, 3, 1);
      if (mode === 'color') { ctx.fillStyle = shade(col, 0.7); ctx.fillRect(3, 50, S - 6, 14); ctx.fillStyle = frame; ctx.fillRect(3, 48, S - 6, 2); }
      break;
    }
    case 'door': {
      const dc = r.dc || '#2d3b4f';
      const w = 22, h = 40, x = (S - w) / 2, y = S - h - 2;
      if (mode === 'color') {
        // casing
        ctx.fillStyle = frame; ctx.fillRect(x - 4, y - 7, w + 8, h + 9);
        ctx.fillStyle = dc; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(x + 3, y + 4, 6, 14); ctx.fillRect(x + w - 9, y + 4, 6, 14); ctx.fillRect(x + 3, y + 22, 6, 14); ctx.fillRect(x + w - 9, y + 22, 6, 14);
        ctx.fillStyle = '#d6b44a'; ctx.beginPath(); ctx.arc(x + w - 4, y + h / 2, 1.5, 0, 6.3); ctx.fill();
        // fan light
        ctx.fillStyle = shade(frame, 0.8); ctx.fillRect(x - 4, y - 7, w + 8, 2);
      }
      paneRect(ctx, x + 3, y - 5, w - 6, 4, mode, gl, lc, frame, 3, 1);
      break;
    }
    case 'porchdoor': {
      const dc = r.dc || '#6b3b2a';
      const w = 18, h = 38, x = (S - w) / 2, y = S - h - 1;
      shutters(x, y, w, h, 5);
      if (mode === 'color') {
        ctx.fillStyle = frame; ctx.fillRect(x - 2, y - 2, w + 4, h + 3);
        ctx.fillStyle = dc; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(x + 3, y + 3, w - 6, 14);
        ctx.fillStyle = '#d6b44a'; ctx.beginPath(); ctx.arc(x + w - 4, y + h / 2, 1.5, 0, 6.3); ctx.fill();
      }
      paneRect(ctx, x + 3, y + 3, w - 6, 14, mode, gl, lc, frame, 1, 2);
      break;
    }
    case 'garage': {
      if (mode === 'color') {
        const x = 5, y = 14, w = S - 10, h = S - 14;
        ctx.fillStyle = frame; ctx.fillRect(x - 2, y - 2, w + 4, h + 2);
        ctx.fillStyle = r.dc || '#e8e6df'; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        for (let yy = y + 8; yy < y + h; yy += 10) ctx.fillRect(x, yy, w, 1.5);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        for (let i = 0; i < 4; i++) ctx.fillRect(x + 7 + i * 11, y + 3, 8, 4);
      }
      break;
    }
    case 'loading': {
      if (mode === 'color') {
        ctx.fillStyle = '#2c2f33'; ctx.fillRect(10, 18, S - 20, S - 18);
        ctx.fillStyle = r.dc || '#c9b24a'; ctx.fillRect(12, 20, S - 24, S - 20);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        for (let yy = 24; yy < S; yy += 5) ctx.fillRect(12, yy, S - 24, 1);
        ctx.fillStyle = '#e9d84a'; ctx.fillRect(10, 14, S - 20, 3);
      }
      break;
    }
    case 'slit': {
      const rows = 2;
      for (let i = 0; i < rows; i++) W(6, 12 + i * 22, S - 12, 9, 6, 1);
      break;
    }
    case 'gallery': {
      // verandah bay: dark recess with doors/windows
      if (mode === 'color') { ctx.fillStyle = shade(col, 0.55); ctx.fillRect(0, 0, S, S); }
      W(14, 8, 14, 42, 1, 4); W(36, 8, 14, 42, 1, 4);
      break;
    }
    case 'plainw': {
      const w = 13, h = 13, x = (S - w) / 2, y = 20;
      W(x, y, w, h, 1, 1);
      break;
    }
    default: break;
  }

  // floor-specific extras
  if (mode === 'color') {
    if (r.aw) {
      ctx.fillStyle = r.aw; ctx.fillRect(0, 0, S, 11);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (let x = 0; x < S; x += 12) ctx.fillRect(x, 0, 6, 11);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0, 11, S, 2);
    }
    // soft AO at the base
    if (r.fl === 'g') {
      const g = ctx.createLinearGradient(0, S - 8, 0, S);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.28)');
      ctx.fillStyle = g; ctx.fillRect(0, S - 8, S, 8);
    }
    // stucco trim line / floor line
    if (r.m === 'brick' || r.m === 'clap' || r.m === 'stucco') {
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(0, 0, S, 1);
    }
  }
}

// ----------------------------------------------------------------------- roof cells
function drawRoofCell(ctx, r, rnd) {
  const S = FAC_S, c = r.c || '#6b5b4b';
  ctx.fillStyle = c; ctx.fillRect(0, 0, S, S);
  switch (r.m) {
    case 'shingle': {
      for (let y = 0, row = 0; y < S; y += 8, row++) {
        const off = row % 2 ? 6 : 0;
        for (let x = -off; x < S; x += 12) {
          ctx.fillStyle = shade(c, 0.84 + rnd() * 0.3);
          ctx.fillRect(x + 1, y, 11, 8);
        }
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, y + 7, S, 1);
      }
      break;
    }
    case 'tile': {
      for (let x = 0; x < S; x += 8) {
        const g = ctx.createLinearGradient(x, 0, x + 8, 0);
        g.addColorStop(0, shade(c, 1.15)); g.addColorStop(0.5, shade(c, 0.95)); g.addColorStop(1, shade(c, 0.7));
        ctx.fillStyle = g; ctx.fillRect(x, 0, 8, S);
      }
      for (let y = 0; y < S; y += 10) { ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(0, y, S, 1.5); }
      break;
    }
    case 'slate': {
      for (let y = 0, row = 0; y < S; y += 6, row++) {
        const off = row % 2 ? 4 : 0;
        for (let x = -off; x < S; x += 8) {
          ctx.fillStyle = shade(c, 0.8 + rnd() * 0.4);
          ctx.fillRect(x + 1, y, 7, 6);
        }
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0, y + 5, S, 1);
      }
      break;
    }
    case 'metal': {
      for (let x = 0; x < S; x += 10) {
        ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(x, 0, 1.5, S);
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x + 1.5, 0, 1.5, S);
      }
      speckle(ctx, 0, 0, S, S, 300, rnd, 0.12);
      break;
    }
    case 'gravel': {
      speckle(ctx, 0, 0, S, S, 1800, rnd, 0.25);
      break;
    }
    case 'solar': {
      ctx.fillStyle = '#16233a'; ctx.fillRect(0, 0, S, S);
      ctx.strokeStyle = '#7f95b5'; ctx.lineWidth = 1;
      for (let i = 0; i <= S; i += 16) {
        ctx.beginPath(); ctx.moveTo(i + 0.5, 0); ctx.lineTo(i + 0.5, S); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i + 0.5); ctx.lineTo(S, i + 0.5); ctx.stroke();
      }
      const g = ctx.createLinearGradient(0, 0, S, S); g.addColorStop(0, 'rgba(120,170,255,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
      break;
    }
    case 'thatch': {
      for (let y = 0; y < S; y += 3) { ctx.fillStyle = shade(c, 0.8 + rnd() * 0.4); ctx.fillRect(0, y, S, 3); }
      speckle(ctx, 0, 0, S, S, 500, rnd, 0.2);
      break;
    }
    case 'copper': {
      for (let x = 0; x < S; x += 12) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x, 0, 1.5, S); ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(x + 1.5, 0, 1, S); }
      speckle(ctx, 0, 0, S, S, 600, rnd, 0.14);
      break;
    }
    case 'grass': {
      speckle(ctx, 0, 0, S, S, 1500, rnd, 0.25);
      break;
    }
    case 'water': {
      const g = ctx.createLinearGradient(0, 0, S, S); g.addColorStop(0, shade(c, 1.25)); g.addColorStop(1, shade(c, 0.8));
      ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
      break;
    }
    default: speckle(ctx, 0, 0, S, S, 400, rnd, 0.1);
  }
}
