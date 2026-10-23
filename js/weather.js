// Seasons & weather: a daily weather state machine (sim side) and precipitation / sky effects (view side).
import * as THREE from '../lib/three.module.js';
import { clamp, lerp, smoothstep } from './util.js';

export const CLIMATES = {
  temperate: { name: 'Temperate', icon: '🍂', snow: true, winter: [11, 0, 1], baseT: 12, swing: 11, wet: 0.28 },
  boreal: { name: 'Boreal', icon: '❄️', snow: true, winter: [10, 11, 0, 1, 2], baseT: 4, swing: 14, wet: 0.24 },
  tropical: { name: 'Tropical', icon: '🌴', snow: false, winter: [], baseT: 26, swing: 3, wet: 0.36 },
};

export const WEATHER = {
  clear: { name: 'Clear', icon: '☀️', night: '🌙', cloud: 0.05, rain: 0, snow: 0, fog: 0, solar: 1, wind: 0.9, traffic: 1, fire: 1.25, happy: 1, tourism: 1.15 },
  cloudy: { name: 'Cloudy', icon: '⛅', night: '☁️', cloud: 0.55, rain: 0, snow: 0, fog: 0.1, solar: 0.6, wind: 1.05, traffic: 1, fire: 1, happy: 0, tourism: 1 },
  rain: { name: 'Rain', icon: '🌧️', night: '🌧️', cloud: 0.85, rain: 0.65, snow: 0, fog: 0.25, solar: 0.35, wind: 1.1, traffic: 0.9, fire: 0.4, happy: -1, tourism: 0.8 },
  storm: { name: 'Thunderstorm', icon: '⛈️', night: '⛈️', cloud: 1, rain: 1, snow: 0, fog: 0.35, solar: 0.2, wind: 1.45, traffic: 0.82, fire: 0.5, happy: -2, tourism: 0.6, lightning: true },
  fog: { name: 'Fog', icon: '🌫️', night: '🌫️', cloud: 0.6, rain: 0, snow: 0, fog: 1, solar: 0.5, wind: 0.6, traffic: 0.88, fire: 0.8, happy: 0, tourism: 0.9 },
  snow: { name: 'Snow', icon: '🌨️', night: '🌨️', cloud: 0.8, rain: 0, snow: 1, fog: 0.3, solar: 0.3, wind: 1, traffic: 0.78, fire: 0.6, happy: 0, tourism: 1 },
};

export const SEASONS = ['Winter', 'Spring', 'Summer', 'Autumn'];
export function seasonOf(month) { return month === 11 || month <= 1 ? 0 : month <= 4 ? 1 : month <= 7 ? 2 : 3; }

/** daily weather step; mutates S.weather */
export function weatherStep(S, rng) {
  const C = CLIMATES[S.climate] || CLIMATES.temperate;
  const W = S.weather || (S.weather = { type: 'clear', days: 3, snowCover: 0, temp: C.baseT });
  const yearT = (S.month * 30 + S.day) / 360;
  // temperature: coldest mid-January
  const seasonal = -Math.cos((yearT - 0.04) * Math.PI * 2);
  W.temp = C.baseT + seasonal * C.swing + (rng() - 0.5) * 4 + (W.type === 'rain' || W.type === 'storm' ? -2 : 0);
  const winter = C.winter.includes(S.month);
  if (--W.days <= 0) {
    const r = rng();
    let t;
    if (winter && C.snow && W.temp < 3) t = r < 0.38 ? 'snow' : r < 0.6 ? 'cloudy' : r < 0.72 ? 'fog' : 'clear';
    else {
      const wet = C.wet * (S.month >= 5 && S.month <= 7 && C.baseT < 20 ? 0.75 : 1);
      t = r < 0.42 ? 'clear' : r < 0.42 + wet * 0.55 ? 'cloudy' : r < 0.42 + wet * 1.35 ? 'rain' : r < 0.42 + wet * 1.6 ? 'storm' : r < 0.42 + wet * 1.85 ? 'fog' : 'clear';
      if (t === 'storm' && (S.month < 3 || S.month > 9) && C.baseT < 20) t = 'rain';
    }
    W.type = t;
    W.days = t === 'storm' ? 1 + ((rng() * 2) | 0) : 2 + ((rng() * 5) | 0);
  }
  if (W.type === 'snow') W.snowCover = clamp(W.snowCover + 0.3, 0, 1);
  else if (W.temp > 4) W.snowCover = clamp(W.snowCover - 0.18 - (W.type === 'rain' ? 0.2 : 0), 0, 1);
  else W.snowCover = clamp(W.snowCover - 0.02, 0, 1);
  if (!C.snow) W.snowCover = 0;
  return W;
}

/** sim multipliers for the current weather */
export function weatherFx(S) {
  const W = S.weather; if (!W) return WEATHER.clear;
  return WEATHER[W.type] || WEATHER.clear;
}
export function heatingDemand(S) {
  const W = S.weather; if (!W) return 1;
  return 1 + clamp((8 - W.temp) / 30, 0, 0.45);
}

// ---------------------------------------------------------------- foliage colour through the year
// [yearT, [r, g, b, amount]]: target foliage hue and how strongly greens move towards it
const TINTS = [
  [0, [0.5, 0.45, 0.32, 0.55]],
  [0.17, [0.5, 0.45, 0.32, 0.5]],
  [0.24, [0.62, 0.95, 0.35, 0.35]],     // fresh spring green
  [0.36, [0.55, 0.9, 0.3, 0.15]],
  [0.45, [1, 1, 1, 0]],
  [0.64, [1, 1, 1, 0]],
  [0.71, [0.95, 0.7, 0.18, 0.45]],
  [0.77, [1.0, 0.42, 0.1, 0.8]],        // autumn peak
  [0.85, [0.75, 0.32, 0.12, 0.75]],
  [0.92, [0.52, 0.42, 0.28, 0.6]],
  [1, [0.5, 0.45, 0.32, 0.55]],
];
export function foliageTint(yearT, climate) {
  if (climate === 'tropical') return [0.5, 0.95, 0.35, 0.1];
  let i = 0; while (i < TINTS.length - 2 && yearT >= TINTS[i + 1][0]) i++;
  const a = TINTS[i][1], b = TINTS[i + 1][1], t = clamp((yearT - TINTS[i][0]) / (TINTS[i + 1][0] - TINTS[i][0]), 0, 1);
  const am = lerp(a[3], b[3], t);
  // blend hues only where both ends are actually tinting
  const pick = (k) => (a[3] === 0 ? b[k] : b[3] === 0 ? a[k] : lerp(a[k], b[k], t));
  return [pick(0), pick(1), pick(2), am];
}

// ---------------------------------------------------------------- precipitation renderer
const RAIN_VS = `
uniform float uTime; uniform vec3 uCenter; uniform float uR; uniform float uH; uniform float uLen; uniform vec2 uWind; uniform float uCount;
attribute float e; attribute float idx;
varying float vA;
void main(){
  vec3 p = position;
  float speed = 9.0 + p.y * 3.0;
  float y = mod(p.y * uH - uTime * speed, uH);
  vec3 w = vec3(uCenter.x + p.x * uR, uCenter.y + y, uCenter.z + p.z * uR);
  w.xz += uWind * (uH - y) * 0.18;
  w.y -= e * uLen; w.xz -= uWind * e * uLen * 0.18;
  vA = step(idx, uCount);
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;
const RAIN_FS = `uniform vec3 uCol; uniform float uOp; varying float vA; void main(){ if (vA < 0.5) discard; gl_FragColor = vec4(uCol, uOp); }`;
const SNOW_VS = `
uniform float uTime; uniform vec3 uCenter; uniform float uR; uniform float uH; uniform float uScale; uniform float uCount;
attribute float idx;
varying float vA;
void main(){
  vec3 p = position;
  float y = mod(p.y * uH - uTime * (0.9 + p.y * 0.6), uH);
  vec3 w = vec3(uCenter.x + p.x * uR + sin(uTime * 0.8 + idx * 0.37) * 0.35, uCenter.y + y, uCenter.z + p.z * uR + cos(uTime * 0.6 + idx * 0.21) * 0.35);
  vec4 mv = viewMatrix * vec4(w, 1.0);
  vA = step(idx, uCount);
  gl_PointSize = uScale * 0.09 / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const SNOW_FS = `varying float vA; uniform float uOp; void main(){ if (vA < 0.5) discard; vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard; gl_FragColor = vec4(vec3(1.0), uOp * smoothstep(0.5, 0.1, d)); }`;

export class Precip {
  constructor(scene) {
    const NR = 5000, NS = 4000;
    // rain: line segments, two vertices per drop
    const rp = new Float32Array(NR * 6), re = new Float32Array(NR * 2), ri = new Float32Array(NR * 2);
    for (let i = 0; i < NR; i++) {
      const x = Math.random() * 2 - 1, y = Math.random(), z = Math.random() * 2 - 1;
      rp.set([x, y, z, x, y, z], i * 6); re[i * 2] = 0; re[i * 2 + 1] = 1; ri[i * 2] = ri[i * 2 + 1] = i;
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    rg.setAttribute('e', new THREE.BufferAttribute(re, 1));
    rg.setAttribute('idx', new THREE.BufferAttribute(ri, 1));
    this.rainU = { uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uR: { value: 40 }, uH: { value: 40 }, uLen: { value: 0.5 }, uWind: { value: new THREE.Vector2(0.4, 0.15) }, uCount: { value: 0 }, uCol: { value: new THREE.Color('#c8d4e2') }, uOp: { value: 0.32 } };
    this.rain = new THREE.LineSegments(rg, new THREE.ShaderMaterial({ vertexShader: RAIN_VS, fragmentShader: RAIN_FS, uniforms: this.rainU, transparent: true, depthWrite: false, fog: false }));
    this.rain.frustumCulled = false; this.rain.renderOrder = 9; this.rain.userData.noAO = true; this.rain.visible = false;
    scene.add(this.rain);
    const sp = new Float32Array(NS * 3), si = new Float32Array(NS);
    for (let i = 0; i < NS; i++) { sp.set([Math.random() * 2 - 1, Math.random(), Math.random() * 2 - 1], i * 3); si[i] = i; }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    sg.setAttribute('idx', new THREE.BufferAttribute(si, 1));
    this.snowU = { uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uR: { value: 40 }, uH: { value: 30 }, uScale: { value: 800 }, uCount: { value: 0 }, uOp: { value: 0.85 } };
    this.snow = new THREE.Points(sg, new THREE.ShaderMaterial({ vertexShader: SNOW_VS, fragmentShader: SNOW_FS, uniforms: this.snowU, transparent: true, depthWrite: false, fog: false }));
    this.snow.frustumCulled = false; this.snow.renderOrder = 9; this.snow.userData.noAO = true; this.snow.visible = false;
    scene.add(this.snow);
    this.NR = NR; this.NS = NS;
  }
  update(t, center, dist, rain, snow, scale, night) {
    const R = clamp(dist * 0.9, 12, 90), H = clamp(dist * 0.9, 14, 70);
    for (const u of [this.rainU, this.snowU]) { u.uTime.value = t; u.uCenter.value.set(center.x, center.y, center.z); u.uR.value = R; u.uH.value = H; }
    this.rainU.uCount.value = rain * this.NR; this.rain.visible = rain > 0.01;
    this.rainU.uLen.value = clamp(dist * 0.012, 0.25, 1.2);
    this.rainU.uOp.value = 0.3 * (1 - night * 0.5);
    this.snowU.uCount.value = snow * this.NS; this.snow.visible = snow > 0.01;
    this.snowU.uScale.value = scale;
  }
}
