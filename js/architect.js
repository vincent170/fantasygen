// Turns a building record into world-space geometry.
import { MB } from './kit.js';
import { ZONE_GEN } from './build_zone.js';
import { SPECIAL_GEN, PYLON } from './build_special.js';
import { STYLES, BUILDINGS } from './data.js';
import { mulberry32 } from './util.js';
import { DX, DZ } from './world.js';
import { fence } from './build_common.js';

SPECIAL_GEN.pylon = PYLON;
SPECIAL_GEN.bus_stop = ({ b }) => {
  const A = b.A;
  // shelter at the +z edge (sidewalk), bench, sign pole
  b.box(0.2, 0.0, 0.8, 0.8, 0.012, 0.95, A.white, '#9a948a', { rep: 0, top: A.white });
  for (const x of [0.22, 0.78]) b.box(x - 0.008, 0, 0.82, x + 0.008, 0.2, 0.84, A.white, '#3a3d42', { rep: 0 });
  b.box(0.2, 0.2, 0.8, 0.8, 0.23, 0.95, A.white, '#2b8a9a', { rep: 0, top: A.white });
  b.box(0.22, 0.05, 0.935, 0.78, 0.2, 0.94, A.wall({ m: 'glass', c: '#9ad0c4', w: 'curtain', gl: 'teal', fl: 'u' }), '#fff', { rep: 0, top: A.white });
  b.box(0.3, 0.04, 0.86, 0.7, 0.06, 0.9, A.white, '#7a5a3d', { rep: 0, top: A.white });
  b.cyl(0.88, 0.88, 0.008, 0, 0.3, 5, A.white, '#3a3d42', {});
  b.box(0.84, 0.28, 0.865, 0.92, 0.34, 0.875, A.white, '#2b8a9a', { rep: 0 });
  return { floors: 1, h: 0.3 };
};

export class Architect {
  constructor(atlas) { this.A = atlas; }

  styleKey(styleId) { return STYLES[styleId % 5].key; }

  /**
   * rec: {kind:'zone'|'special', arch, key, style, level, lw, ld, x, z, w, d, facing, seed, y0}
   * returns {geo, info}
   */
  generate(rec, opts = {}) {
    const b = new MB(this.A);
    b.smoke = [];
    const rng = mulberry32(rec.seed | 0);
    const st = this.styleKey(rec.style || 0);
    let info;
    // transform
    const f = rec.facing === undefined ? 2 : rec.facing;
    const rot = Math.atan2(DX[f], DZ[f]);
    const c = Math.cos(rot), s = Math.sin(rot);
    const lcx = rec.lw / 2, lcz = rec.ld / 2;
    const rx = lcx * c + lcz * s, rz = -lcx * s + lcz * c;
    const wx = rec.x + rec.w / 2, wz = rec.z + rec.d / 2;
    b.setT(wx - rx, rec.y0 || 0, wz - rz, rot);
    if (opts.construction) {
      info = this.construction(b, rng, rec);
    } else if (rec.kind === 'zone') {
      const fn = ZONE_GEN[st][rec.arch];
      info = fn({ b, rng, lw: rec.lw, ld: rec.ld, level: rec.level || 1 });
    } else {
      const fn = SPECIAL_GEN[rec.key];
      if (!fn) throw new Error('no generator for ' + rec.key);
      info = fn({ b, rng, lw: rec.lw, ld: rec.ld, st, level: rec.level || 1 });
    }
    const geo = b.build();
    for (let i = 0; i < geo.pos.length; i++) if (!Number.isFinite(geo.pos[i])) { console.error('NaN geometry in', rec.kind, rec.key || rec.arch, 'style', rec.style, 'level', rec.level, 'lot', rec.lw, rec.ld); break; }
    // transform helper for local points (smoke / rotor)
    const T = (p) => [p[0] * c + p[2] * s + (wx - rx), p[1] + (rec.y0 || 0), -p[0] * s + p[2] * c + (wz - rz)];
    info.smoke = (b.smoke.concat(info.smoke || [])).map(T);
    if (info.rotor) { info.rotorPos = T(info.rotor); info.rotorYaw = rot; }
    if (info.fountain) info.fountainPos = T(info.fountain);
    if (info.flare) info.flarePos = T(info.flare);
    return { geo, info };
  }

  construction(b, rng, rec) {
    const A = b.A, w = A.white;
    const { lw, ld } = rec;
    // dirt plot
    b.flatQuad(0.04, 0.04, lw - 0.04, ld - 0.04, 0.01, A.roof({ m: 'gravel', c: '#9a8461' }), '#ffffff', Math.max(1, lw * 2), Math.max(1, ld * 2));
    // hoarding fence
    const hoard = A.decal('hoard', (ctx, S) => {
      ctx.fillStyle = '#e8892b'; ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = '#ffffff';
      for (let x = -S; x < S * 2; x += 16) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 8, 0); ctx.lineTo(x + 8 + S / 2, S); ctx.lineTo(x + S / 2, S); ctx.fill(); }
    });
    const hh = 0.08;
    b.wall(0.04, ld - 0.04, 0, 1, lw - 0.08, 0, hh, hoard, '#fff', 0.25, 0);
    b.wall(lw - 0.04, 0.04, 0, -1, lw - 0.08, 0, hh, hoard, '#fff', 0.25, 0);
    b.wall(lw - 0.04, ld - 0.04, 1, 0, ld - 0.08, 0, hh, hoard, '#fff', 0.25, 0);
    b.wall(0.04, 0.04, -1, 0, ld - 0.08, 0, hh, hoard, '#fff', 0.25, 0);
    // foundation slab and rising frame
    const fw = lw - 0.3, fd = ld - 0.3;
    b.box(0.15, 0.01, 0.15, 0.15 + fw, 0.05, 0.15 + fd, w, '#9a968c', { rep: 0, top: w });
    const lv = rec.level || 1;
    const frameH = 0.12 + 0.1 * lv + rng() * 0.1;
    for (const [x, z] of [[0.15, 0.15], [0.15 + fw - 0.02, 0.15], [0.15, 0.15 + fd - 0.02], [0.15 + fw - 0.02, 0.15 + fd - 0.02]]) b.box(x, 0.05, z, x + 0.02, 0.05 + frameH, z + 0.02, w, '#7d7d7a', { rep: 0, top: w });
    b.box(0.15, 0.05 + frameH, 0.15, 0.15 + fw, 0.07 + frameH, 0.15 + fd, w, '#8e8d88', { rep: 0, top: w });
    // crane
    const cx = Math.max(0.2, lw - 0.25), cz = 0.22;
    const ch = 0.5 + Math.min(0.6, lw * 0.12);
    b.box(cx - 0.012, 0, cz - 0.012, cx + 0.012, ch, cz + 0.012, w, '#e8b82a', { rep: 0, top: w });
    b.box(cx - 0.3, ch, cz - 0.008, cx + 0.12, ch + 0.015, cz + 0.008, w, '#e8b82a', { rep: 0, top: w });
    b.box(cx - 0.31, ch - 0.06, cz - 0.01, cx - 0.29, ch, cz + 0.01, w, '#444', { rep: 0 });
    b.box(cx + 0.06, ch + 0.015, cz - 0.015, cx + 0.12, ch + 0.05, cz + 0.015, w, '#555', { rep: 0 });
    // materials
    for (let i = 0; i < 4; i++) b.box(0.2 + i * 0.1, 0.01, ld - 0.22, 0.28 + i * 0.1, 0.06, ld - 0.14, w, i % 2 ? '#b9783f' : '#8a8f94', { rep: 0, top: w });
    return { floors: 0, h: ch + 0.05 };
  }
}
