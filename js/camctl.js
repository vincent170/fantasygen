// RTS-style camera: WASD/arrows pan, Q/E rotate, wheel zoom, right-drag orbit, middle-drag pan.
import * as THREE from '../lib/three.module.js';
import { clamp, lerp } from './util.js';

export class CamCtl {
  constructor(view, canvas) {
    this.v = view; this.canvas = canvas;
    const n = view.n;
    this.t = new THREE.Vector3(n / 2, 0, n / 2); this.tt = this.t.clone();
    this.dist = 64; this.td = 64;
    this.yaw = 0.78; this.ty = 0.78;
    this.pitch = 0.92; this.tp = 0.92;
    this.keys = new Set();
    this.drag = null;
    this.enabled = true;
    this.lastMouse = { x: 0, y: 0 };
    this.bind();
    this.apply(0);
  }

  bind() {
    const c = this.canvas;
    window.addEventListener('keydown', (e) => { if (/input|textarea|select/i.test(e.target.tagName)) return; this.keys.add(e.code); });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('pointerdown', (e) => {
      if (e.button === 2 || e.button === 1 || (e.button === 0 && this.keys.has('Space'))) {
        this.drag = { mode: e.button === 2 ? 'orbit' : 'pan', x: e.clientX, y: e.clientY };
        c.setPointerCapture(e.pointerId);
        e.preventDefault();
      }
    });
    c.addEventListener('pointermove', (e) => {
      this.lastMouse.x = e.clientX; this.lastMouse.y = e.clientY;
      if (!this.drag) return;
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      this.drag.x = e.clientX; this.drag.y = e.clientY;
      if (this.drag.mode === 'orbit') {
        this.ty -= dx * 0.006;
        this.tp = clamp(this.tp + dy * 0.005, 0.25, 1.45);
      } else {
        const s = this.td * 0.0016;
        const fx = -Math.sin(this.ty), fz = -Math.cos(this.ty);
        const rx = Math.cos(this.ty), rz = -Math.sin(this.ty);
        this.tt.x -= (rx * dx - fx * dy) * s; this.tt.z -= (rz * dx - fz * dy) * s;
      }
    });
    const end = (e) => { if (this.drag) { this.drag = null; try { c.releasePointerCapture(e.pointerId); } catch (_) { } } };
    c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const hit = this.v.pick(e.clientX, e.clientY);
      const f = Math.exp(e.deltaY * 0.0011);
      const nd = clamp(this.td * f, 5, 120);
      if (hit && hit.inside && e.deltaY < 0) {
        const k = 1 - nd / this.td;
        this.tt.x += (hit.wx - this.tt.x) * k; this.tt.z += (hit.wz - this.tt.z) * k;
      }
      this.td = nd;
    }, { passive: false });
    // touch: one finger pans (when no tool), two fingers pinch/rotate
    let tch = null;
    c.addEventListener('touchstart', (e) => { if (e.touches.length === 2) { tch = this.touchInfo(e); } }, { passive: true });
    c.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && tch) {
        const now = this.touchInfo(e);
        this.td = clamp(this.td * (tch.d / Math.max(10, now.d)), 5, 120);
        this.ty -= (now.a - tch.a);
        const s = this.td * 0.0016;
        const dx = now.cx - tch.cx, dy = now.cy - tch.cy;
        const fx = -Math.sin(this.ty), fz = -Math.cos(this.ty), rx = Math.cos(this.ty), rz = -Math.sin(this.ty);
        this.tt.x -= (rx * dx - fx * dy) * s; this.tt.z -= (rz * dx - fz * dy) * s;
        tch = now;
      }
    }, { passive: true });
    c.addEventListener('touchend', () => { tch = null; }, { passive: true });
  }
  touchInfo(e) {
    const a = e.touches[0], b = e.touches[1];
    return { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), a: Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX), cx: (a.clientX + b.clientX) / 2, cy: (a.clientY + b.clientY) / 2 };
  }

  focus(x, z, dist) { this.tt.set(x, 0, z); if (dist) this.td = dist; }

  update(dt) {
    dt = clamp(dt, 0, 0.1);
    // follow a vehicle / citizen picked by the player
    if (this.follow) {
      const v = this.follow;
      if (v.gone) this.follow = null;
      else { this.tt.x = v.x; this.tt.z = v.z; }
    }
    if (this.enabled) {
      const k = this.keys;
      let mx = 0, mz = 0;
      if (k.has('KeyW') || k.has('ArrowUp')) mz += 1;
      if (k.has('KeyS') || k.has('ArrowDown')) mz -= 1;
      if (k.has('KeyD') || k.has('ArrowRight')) mx += 1;
      if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1;
      if ((mx || mz) && this.follow) { this.follow = null; if (this.onUnfollow) this.onUnfollow(); }
      if (mx || mz) {
        const sp = this.td * 0.85 * dt * (k.has('ShiftLeft') || k.has('ShiftRight') ? 2.2 : 1);
        const fx = -Math.sin(this.ty), fz = -Math.cos(this.ty), rx = Math.cos(this.ty), rz = -Math.sin(this.ty);
        this.tt.x += (fx * mz + rx * mx) * sp; this.tt.z += (fz * mz + rz * mx) * sp;
      }
      if (k.has('KeyQ')) this.ty += dt * 1.4;
      if (k.has('KeyE')) this.ty -= dt * 1.4;
      if (k.has('PageUp') || k.has('KeyR') && false) this.td = clamp(this.td * (1 - dt * 1.2), 5, 120);
      if (k.has('PageDown')) this.td = clamp(this.td * (1 + dt * 1.2), 5, 120);
      if (k.has('KeyZ')) this.tp = clamp(this.tp + dt, 0.25, 1.45);
      if (k.has('KeyX')) this.tp = clamp(this.tp - dt, 0.25, 1.45);
    }
    this.apply(dt);
  }

  apply(dt) {
    const n = this.v.n;
    this.tt.x = clamp(this.tt.x, -6, n + 6); this.tt.z = clamp(this.tt.z, -6, n + 6);
    const s = dt ? 1 - Math.exp(-dt * 12) : 1;
    this.t.x = lerp(this.t.x, this.tt.x, s); this.t.z = lerp(this.t.z, this.tt.z, s);
    this.dist = lerp(this.dist, this.td, s); this.yaw = lerp(this.yaw, this.ty, s); this.pitch = lerp(this.pitch, this.tp, s);
    const gh = Math.max(this.v.world.heightAt(clamp(this.t.x, 0, n - 0.01), clamp(this.t.z, 0, n - 0.01)), 0);
    this.t.y = lerp(this.t.y, gh, dt ? 1 - Math.exp(-dt * 6) : 1);
    const cp = Math.cos(this.pitch);
    const pos = new THREE.Vector3(this.t.x + Math.sin(this.yaw) * cp * this.dist, this.t.y + Math.sin(this.pitch) * this.dist, this.t.z + Math.cos(this.yaw) * cp * this.dist);
    const cam = this.v.camera;
    const sh = this.v.shake || 0;
    if (sh > 0) { pos.x += (Math.random() - 0.5) * sh; pos.y += (Math.random() - 0.5) * sh * 0.6; pos.z += (Math.random() - 0.5) * sh; }
    cam.position.copy(pos); cam.lookAt(this.t);
    this.v.camTarget = this.t; this.v.camDist = this.dist;
    // fog follows zoom
    this.v.fog.near = Math.max(60, this.dist * 1.8); this.v.fog.far = Math.max(380, this.dist * 5.5 + 200);
  }
}
