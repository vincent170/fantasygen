// Three.js scene: terrain, water, roads, building chunks, trees, sky, FX, cursor, picking.
import * as THREE from '../lib/three.module.js';
import { MB, toGeometry } from './kit.js';
import { clamp, lerp, smoothstep, hash2, mulberry32 } from './util.js';
import { Atlas } from './atlas.js';
import { Architect } from './architect.js';
import { GroundPainter } from './ground.js';
import { BRIDGE_Y, DX, DZ } from './world.js';
import { Post, QUALITY } from './post.js';
import { Precip, WEATHER, foliageTint } from './weather.js';

const CH = 8; // chunk size in tiles

// ---------------------------------------------------------------- time-of-day keyframes
const K = (h, zen, hor, sunC, sunI, hs, hg, hi, fog, nightGlow) => ({ h, zen: new THREE.Color(zen), hor: new THREE.Color(hor), sunC: new THREE.Color(sunC), sunI, hs: new THREE.Color(hs), hg: new THREE.Color(hg), hi, fog: new THREE.Color(fog), glow: nightGlow });
const SKY = [
  K(0, '#050a1e', '#0e1a3a', '#8ea8ff', 0.5, '#2a3c70', '#141a28', 0.55, '#0e1a3a', 1),
  K(5, '#0d1330', '#2a2c58', '#8ea8ff', 0.4, '#2a3c70', '#141a28', 0.5, '#2a2c58', 1),
  K(6.3, '#4a6aa8', '#f0a070', '#ffb27a', 1.5, '#8091c4', '#5a5040', 0.75, '#e0a888', 0.5),
  K(8, '#4a8ad8', '#c4dcf0', '#fff0d8', 2.5, '#bcd6ff', '#7a8a5a', 1.0, '#bcd4e8', 0),
  K(12, '#3d86e0', '#bcdcf6', '#fffaf0', 2.9, '#c6dcff', '#82925e', 1.1, '#bcd8ee', 0),
  K(16.5, '#4684d8', '#c4daee', '#fff0d0', 2.6, '#bcd0f4', '#7e8a58', 1.0, '#c0d4e6', 0),
  K(18.3, '#3a4c8c', '#f2894a', '#ff9a5a', 1.3, '#8a86b4', '#5a4a3c', 0.7, '#e29a78', 0.4),
  K(20, '#141c44', '#40305a', '#8ea8ff', 0.45, '#2e3c72', '#141a28', 0.55, '#352e58', 1),
  K(24, '#050a1e', '#0e1a3a', '#8ea8ff', 0.5, '#2a3c70', '#141a28', 0.55, '#0e1a3a', 1),
];
function sampleSky(h) {
  let i = 0;
  while (i < SKY.length - 2 && h >= SKY[i + 1].h) i++;
  const a = SKY[i], b = SKY[i + 1];
  const t = clamp((h - a.h) / (b.h - a.h), 0, 1);
  const o = { zen: new THREE.Color(), hor: new THREE.Color(), sunC: new THREE.Color(), hs: new THREE.Color(), hg: new THREE.Color(), fog: new THREE.Color() };
  for (const k of ['zen', 'hor', 'sunC', 'hs', 'hg', 'fog']) o[k].copy(a[k]).lerp(b[k], t);
  o.sunI = lerp(a.sunI, b.sunI, t); o.hi = lerp(a.hi, b.hi, t); o.glow = lerp(a.glow, b.glow, t);
  return o;
}

// ---------------------------------------------------------------- shaders
const SKY_VS = `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const SKY_FS = `
uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uNight;
varying vec3 vDir;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
void main(){
  vec3 d = normalize(vDir);
  float h = clamp(d.y, 0.0, 1.0);
  vec3 c = mix(uHorizon, uZenith, pow(h, 0.55));
  float sd = max(dot(d, uSunDir), 0.0);
  c += uSunCol * (pow(sd, 900.0) * 3.0 + pow(sd, 40.0) * 0.28 + pow(sd, 6.0) * 0.07);
  if (d.y < 0.0) c = mix(uHorizon, uHorizon * 0.7, clamp(-d.y * 4.0, 0.0, 1.0));
  // stars
  if (uNight > 0.01 && d.y > 0.0) {
    vec2 p = floor((d.xz / (d.y + 0.35)) * 90.0);
    float s = step(0.992, hash(p));
    c += vec3(s) * uNight * smoothstep(0.0, 0.25, d.y) * (0.5 + 0.5 * hash(p + 3.0));
  }
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const WATER_VS = `
varying vec3 vWorld;
void main(){ vec4 w = modelMatrix * vec4(position,1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const WATER_FS = `
uniform float uTime; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSky; uniform vec3 uFog; uniform float uFogNear; uniform float uFogFar;
uniform vec3 uDeep; uniform vec3 uShallow; uniform float uLight; uniform sampler2D uHeight; uniform float uMapN; uniform float uRain; uniform float uIce;
varying vec3 vWorld;
float wv(vec2 p, float t){
  float a = sin(p.x*0.9 + t*0.9) + sin(p.y*1.3 - t*0.7) * 0.8;
  a += sin((p.x+p.y)*2.1 + t*1.7) * 0.4 + sin((p.x-p.y)*3.3 - t*2.1) * 0.25;
  a += sin(p.x*4.1 + p.y*2.7 + t*2.9) * 0.08;
  return a * 0.04;
}
float hsh(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
void main(){
  vec2 p = vWorld.xz;
  float e = 0.06;
  float h0 = wv(p, uTime);
  float hx = wv(p + vec2(e,0.0), uTime);
  float hz = wv(p + vec2(0.0,e), uTime);
  float dcam = length(vWorld - cameraPosition);
  float atten = 1.0 - smoothstep(25.0, 130.0, dcam);
  vec3 n = normalize(vec3(-(hx-h0)/e * (1.4 + uRain) * atten, 1.0, -(hz-h0)/e * (1.4 + uRain) * atten));
  // depth from the terrain heightmap (outside the map counts as open sea)
  vec2 huv = (p + 0.5) / (uMapN + 1.0);
  float inside = step(0.0, huv.x) * step(huv.x, 1.0) * step(0.0, huv.y) * step(huv.y, 1.0);
  float ground = texture2D(uHeight, clamp(huv, 0.0, 1.0)).r * 13.0 - 4.0;
  float depth = mix(4.0, max(0.0, -ground), inside);
  vec3 V = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(n, V), 0.0), 3.0);
  vec3 R = reflect(-V, n);
  float dk = smoothstep(0.0, 2.6, depth);
  vec3 col = mix(uShallow, uDeep, dk) * uLight;
  col = mix(col, uSky, clamp(fres * 0.7 + 0.08, 0.0, 0.9));
  float sp = pow(max(dot(R, uSunDir), 0.0), 220.0);
  col += uSunCol * sp * 1.6;
  float sp2 = pow(max(dot(R, uSunDir), 0.0), 18.0);
  col += uSunCol * sp2 * 0.08;
  // shore foam: animated bands where the water is shallow
  float band = sin(depth * 26.0 - uTime * 1.6 + hsh(floor(p * 3.0)) * 2.0) * 0.5 + 0.5;
  float foam = (1.0 - smoothstep(0.02, 0.22, depth)) * (0.55 + 0.45 * band) * inside;
  foam *= smoothstep(0.35, 0.6, fract(sin(dot(floor(p * 9.0), vec2(12.9898, 78.233))) * 43758.5453) + 0.4);
  col = mix(col, vec3(0.92, 0.96, 0.98) * max(uLight, 0.35), clamp(foam, 0.0, 0.85));
  col = mix(col, vec3(0.86, 0.9, 0.95) * uLight, uIce * smoothstep(0.0, 0.8, 1.0 - dk) * inside);
  float dist = length(vWorld - cameraPosition);
  float f = smoothstep(uFogNear, uFogFar, dist);
  col = mix(col, uFog, f);
  float alpha = mix(mix(0.45, 0.9, dk), 0.95, fres);
  alpha = max(alpha, foam * 0.9);
  alpha = mix(alpha, 1.0, f);
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const PART_VS = `
attribute float size; attribute vec4 pcol; varying vec4 vC; uniform float uScale;
void main(){ vC = pcol; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`;
const PART_FS = `
varying vec4 vC;
void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard; float a = smoothstep(0.5, 0.05, d) * vC.a; gl_FragColor = vec4(vC.rgb, a);
  #include <colorspace_fragment>
}`;

/**
 * Adds season effects to a MeshStandardMaterial: snow settles on upward faces (uSnow 0..1),
 * and an optional tint recolours green foliage (autumn/spring).
 */
function snowify(mat, uSnow, k, key, uTint = null, extraMap = null) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, r) => {
    if (prev) prev(shader, r);
    shader.uniforms.uSnow = uSnow;
    if (uTint) shader.uniforms.uTint = uTint;
    let fs = shader.fragmentShader;
    fs = 'uniform float uSnow;\n' + (uTint ? 'uniform vec4 uTint;\n' : '') + fs;
    // recolour greens towards the season's hue (rgb) by amount (a), keeping brightness
    if (uTint) fs = fs.replace('#include <color_fragment>', `#include <color_fragment>
      { float gr = clamp((diffuseColor.g - max(diffuseColor.r, diffuseColor.b)) * 6.0, 0.0, 1.0);
        float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
        diffuseColor.rgb = mix(diffuseColor.rgb, uTint.rgb * lum * 2.4, gr * uTint.a); }`);
    fs = fs.replace('#include <emissivemap_fragment>', `
      { vec3 wN = inverseTransformDirection(normal, viewMatrix);
        float sn = uSnow * ${k.toFixed(3)} * smoothstep(0.42, 0.82, wN.y);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.94, 0.98), sn);
        roughnessFactor = mix(roughnessFactor, 0.7, sn); }
      #include <emissivemap_fragment>`);
    shader.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => 'season-' + key;
}

// ---------------------------------------------------------------- View
export class View {
  constructor(canvas, G) {
    this.G = G;
    this.canvas = canvas;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.95;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.2, 2200);
    this.fog = new THREE.Fog('#bcd8ee', 90, 420);
    this.scene.fog = this.fog;
    this.time = 0;
    this.tod = 10;
    this.world = G.world;
    this.n = G.world.n;
    this.quality = 'high';
    this.uGrid = { value: 0 };
    this.nightK = 0;

    this.atlas = new Atlas();
    this.arc = new Architect(this.atlas);
    this.makeMaterials();
    this.makeLights();
    this.makeSky();
    this.makeTerrain();
    this.makeWater();
    this.makeChunks();
    this.makeTrees();
    this.makeFX();
    this.makeCursor();
    this.makeOverlay();
    this.makeExtras();
    this.makeIcons();
    this.infra = null;
    this.infraLines = null;
    this.rotors = new Map();
    this.fountains = [];
    this.smokers = [];
    this.wx = { rain: 0, snow: 0, fog: 0, cloud: 0, flash: 0 };
    this.precip = new Precip(this.scene);
    this.post = new Post(r, this.scene, this.camera);
    this.setQuality('high');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  // ------------------------------------------------------------ setup
  makeMaterials() {
    const A = this.atlas;
    this.uSnow = { value: 0 };
    this.uArea = { value: new Array(16).fill(1) };
    this.uAreaShow = { value: 0 };
    this.uFoliage = { value: new THREE.Vector4(1, 1, 1, 0) };
    this.uGrass = { value: new THREE.Vector4(1, 1, 1, 0) };
    this.mat = new THREE.MeshStandardMaterial({ map: A.texture, emissiveMap: A.emissive, emissive: new THREE.Color(1, 0.95, 0.85), emissiveIntensity: 0, vertexColors: true, roughness: 0.88, metalness: 0.0 });
    this.matRoad = this.mat.clone();
    this.matRoad.polygonOffset = true; this.matRoad.polygonOffsetFactor = -2; this.matRoad.polygonOffsetUnits = -2;
    this.matRoad.roughness = 0.95;
    this.matGhost = this.mat.clone();
    this.matGhost.transparent = true; this.matGhost.opacity = 0.72; this.matGhost.depthWrite = false;
    this.matGhost.emissiveIntensity = 0;
    this.matTree = this.mat.clone();
    this.matTree.emissiveIntensity = 0;
    this.matCar = this.mat.clone();
    this.matCar.roughness = 0.55;
    snowify(this.mat, this.uSnow, 1, 'bld');
    snowify(this.matRoad, this.uSnow, 0.28, 'road');
    snowify(this.matTree, this.uSnow, 0.85, 'tree', this.uFoliage);
    snowify(this.matCar, this.uSnow, 0.4, 'car');
    this.dimK = 1;
  }

  /** overlay dimming × season tint */
  applyTints() {
    const d = this.dimK;
    this.mat.color.setRGB(d < 1 ? 0.62 : 1, d < 1 ? 0.64 : 1, d < 1 ? 0.7 : 1);
    this.matTree.color.setRGB(d < 1 ? 0.7 : 1, d < 1 ? 0.72 : 1, d < 1 ? 0.75 : 1);
  }

  makeLights() {
    const s = this.scene;
    this.hemi = new THREE.HemisphereLight('#cfe3ff', '#7a8a5a', 1.0);
    s.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff3dd', 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    const sc = this.sun.shadow.camera;
    sc.near = 1; sc.far = 400; sc.left = sc.bottom = -50; sc.right = sc.top = 50;
    s.add(this.sun); s.add(this.sun.target);
    this.sunDir = new THREE.Vector3(0.4, 0.8, 0.4).normalize();
  }

  makeSky() {
    const geo = new THREE.SphereGeometry(1000, 32, 16);
    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uZenith: { value: new THREE.Color('#3d86e0') }, uHorizon: { value: new THREE.Color('#bcdcf6') }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color('#fff') }, uNight: { value: 0 } },
    });
    this.sky = new THREE.Mesh(geo, this.skyMat);
    this.sky.renderOrder = -10; this.sky.frustumCulled = false; this.sky.userData.noAO = true;
    this.scene.add(this.sky);
    // clouds
    this.clouds = [];
    const cc = document.createElement('canvas'); cc.width = cc.height = 128;
    const g = cc.getContext('2d');
    const rnd = mulberry32(3);
    for (let i = 0; i < 26; i++) {
      const x = 30 + rnd() * 68, y = 44 + rnd() * 40, r = 14 + rnd() * 22;
      const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    }
    const ctex = new THREE.CanvasTexture(cc); ctex.colorSpace = THREE.SRGBColorSpace;
    this.cloudMat = new THREE.MeshBasicMaterial({ map: ctex, transparent: true, depthWrite: false, opacity: 0.8, fog: true, toneMapped: true });
    const cgeo = new THREE.PlaneGeometry(1, 1);
    const rng = mulberry32(11);
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(cgeo, this.cloudMat);
      m.rotation.x = -Math.PI / 2;
      const s = 40 + rng() * 60;
      m.scale.set(s, s * (0.5 + rng() * 0.4), 1);
      m.position.set(rng() * 400 - 140, 70 + rng() * 30, rng() * 400 - 140);
      m.userData.v = 0.6 + rng() * 0.8;
      m.renderOrder = -5; m.userData.noAO = true;
      this.scene.add(m); this.clouds.push(m);
    }
  }

  makeTerrain() {
    const w = this.world, n = this.n, vn = n + 1;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(vn * vn * 3), nor = new Float32Array(vn * vn * 3), uv = new Float32Array(vn * vn * 2);
    for (let j = 0; j < vn; j++) for (let i = 0; i < vn; i++) {
      const k = j * vn + i;
      uv[k * 2] = i / n; uv[k * 2 + 1] = 1 - j / n;
      pos[k * 3] = i; pos[k * 3 + 2] = j;
    }
    const idx = new Uint32Array(n * n * 6);
    let p = 0;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const a = j * vn + i, b = a + 1, c = a + vn, d = c + 1;
      // CCW seen from +y: a(x,z) b(x+1,z) c(x,z+1)  => (a,c,b)
      idx[p++] = a; idx[p++] = c; idx[p++] = b; idx[p++] = b; idx[p++] = c; idx[p++] = d;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    this.terrainGeo = geo;
    this.ground = new GroundPainter(w, 8);
    const mat = new THREE.MeshStandardMaterial({ map: this.ground.texture, roughness: 1, metalness: 0 });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.detailMap = { value: this.ground.detail };
      shader.uniforms.uGrid = this.uGrid;
      shader.uniforms.uMapN = { value: n };
      shader.uniforms.uArea = this.uArea;
      shader.uniforms.uAreaShow = this.uAreaShow;
      shader.vertexShader = 'varying float vTy;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vTy = position.y;');
      shader.fragmentShader = 'uniform sampler2D detailMap; uniform float uGrid; uniform float uMapN; uniform float uArea[16]; uniform float uAreaShow; varying float vTy;\n' + shader.fragmentShader.replace('#include <map_fragment>', `
        vec4 sampledDiffuseColor = texture2D( map, vMapUv );
        vec3 det = texture2D( detailMap, vMapUv * uMapN * 0.5 ).rgb;
        sampledDiffuseColor.rgb *= det * 1.32;
        diffuseColor *= sampledDiffuseColor;
        vec2 gp = vMapUv * uMapN; vec2 gf = abs(fract(gp - 0.5) - 0.5) / max(fwidth(gp), vec2(0.0001));
        float gl = 1.0 - min(min(gf.x, gf.y), 1.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), gl * uGrid * 0.15 * smoothstep(0.02, 0.16, vTy));
        // land you don't own yet is shown dimmed and desaturated
        {
          vec2 ap = vec2(vMapUv.x, 1.0 - vMapUv.y) * 4.0;
          int ai = int(clamp(floor(ap.y), 0.0, 3.0)) * 4 + int(clamp(floor(ap.x), 0.0, 3.0));
          float own = 1.0;
          for (int k = 0; k < 16; k++) if (k == ai) own = uArea[k];
          float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(lum) * vec3(0.78, 0.8, 0.86), (1.0 - own) * 0.55);
          diffuseColor.rgb *= 1.0 - (1.0 - own) * 0.22;
          vec2 af = abs(fract(ap) - 0.5);
          float edge = smoothstep(0.485, 0.5, max(af.x, af.y));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.95, 0.8), edge * uAreaShow * 0.6);
        }
      `);
    };
    snowify(mat, this.uSnow, 1, 'terrain', this.uGrass);
    this.terrainMat = mat;
    this.terrain = new THREE.Mesh(geo, mat);
    this.terrain.receiveShadow = true;
    this.terrain.frustumCulled = false;
    this.scene.add(this.terrain);
    // skirt
    this.skirtMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
    this.skirt = new THREE.Mesh(new THREE.BufferGeometry(), this.skirtMat);
    this.skirt.frustumCulled = false;
    this.scene.add(this.skirt);
    // seabed far away
    const sb = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshBasicMaterial({ color: '#0f3550', fog: true }));
    sb.rotation.x = -Math.PI / 2; sb.position.set(n / 2, -7, n / 2);
    sb.userData.noAO = true;
    this.scene.add(sb); this.seabed = sb;
    this.updateTerrain(true);
  }

  updateTerrain(full) {
    const w = this.world, n = this.n, vn = n + 1;
    const pos = this.terrainGeo.attributes.position.array, nor = this.terrainGeo.attributes.normal.array;
    const h = w.h;
    let d = w.dirty.terrain;
    if (full || !d) d = { x0: 0, z0: 0, x1: n - 1, z1: n - 1 };
    const i0 = Math.max(0, d.x0 - 1), i1 = Math.min(n, d.x1 + 2), j0 = Math.max(0, d.z0 - 1), j1 = Math.min(n, d.z1 + 2);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * vn + i;
      pos[k * 3 + 1] = h[k];
      const hl = h[j * vn + Math.max(0, i - 1)], hr = h[j * vn + Math.min(n, i + 1)];
      const hu = h[Math.max(0, j - 1) * vn + i], hd = h[Math.min(n, j + 1) * vn + i];
      let nx = hl - hr, ny = 2, nz = hu - hd;
      const l = Math.hypot(nx, ny, nz);
      nor[k * 3] = nx / l; nor[k * 3 + 1] = ny / l; nor[k * 3 + 2] = nz / l;
    }
    this.terrainGeo.attributes.position.needsUpdate = true;
    this.terrainGeo.attributes.normal.needsUpdate = true;
    this.terrainGeo.computeBoundingSphere();
    this.buildSkirt();
    if (this.hTex) this.heightTex();
    w.dirty.terrain = null;
    if (full) this.ground.paintAll();
    else this.ground.paintRegion(d.x0 - 1, d.z0 - 1, d.x1 + 1, d.z1 + 1);
    this.ground.upload();
    this.groundDirtyFlag = false;
  }

  buildSkirt() {
    const w = this.world, n = this.n;
    const pos = [], col = [], idx = [];
    const bot = -7;
    const soil = [new THREE.Color('#8a6a45'), new THREE.Color('#6a5038'), new THREE.Color('#4a3a2c'), new THREE.Color('#2a2a30')];
    let vc = 0;
    const edge = (fn, nx, nz, flip) => {
      for (let k = 0; k < n; k++) {
        const [x0, z0, h0] = fn(k), [x1, z1, h1] = fn(k + 1);
        const levels = [Math.max(h0, 0), Math.max(h1, 0)];
        // vertical strips with colour bands
        const ys0 = [Math.max(h0, -0.0), -0.8, -2.8, bot], ys1 = [Math.max(h1, -0.0), -0.8, -2.8, bot];
        for (let s = 0; s < 3; s++) {
          const c0 = soil[s], c1 = soil[s + 1];
          const base = vc;
          pos.push(x0, ys0[s], z0, x1, ys1[s], z1, x1, ys1[s + 1], z1, x0, ys0[s + 1], z0);
          for (const c of [c0, c0, c1, c1]) col.push(c.r, c.g, c.b);
          vc += 4;
          if (flip) idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
          else idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
        }
      }
    };
    const H = (i, j) => w.H(i, j);
    edge((k) => [k, 0, H(k, 0)], 0, -1, false);
    edge((k) => [k, n, H(k, n)], 0, 1, true);
    edge((k) => [0, k, H(0, k)], -1, 0, true);
    edge((k) => [n, k, H(n, k)], 1, 0, false);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    this.skirt.geometry.dispose();
    this.skirt.geometry = g;
  }

  makeWater() {
    const n = this.n;
    this.waterMat = new THREE.ShaderMaterial({
      vertexShader: WATER_VS, fragmentShader: WATER_FS, transparent: true, depthWrite: false,
      uniforms: {
        uTime: { value: 0 }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color('#fff') },
        uSky: { value: new THREE.Color('#bcdcf6') }, uFog: { value: new THREE.Color('#bcd8ee') }, uFogNear: { value: 90 }, uFogFar: { value: 420 },
        uDeep: { value: new THREE.Color('#0f4a66') }, uShallow: { value: new THREE.Color('#3aa9a6') }, uLight: { value: 1 },
        uHeight: { value: this.heightTex() }, uMapN: { value: n }, uRain: { value: 0 }, uIce: { value: 0 },
      },
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400, 1, 1), this.waterMat);
    m.rotation.x = -Math.PI / 2; m.position.set(n / 2, 0, n / 2);
    m.renderOrder = 2; m.userData.noAO = true;
    this.scene.add(m);
    this.water = m;
  }

  /** heightmap as a texture so the water shader knows its depth (shallows, foam) */
  heightTex() {
    if (!this.hTex) {
      const vn = this.n + 1;
      this.hData = new Uint8Array(vn * vn);
      this.hTex = new THREE.DataTexture(this.hData, vn, vn, THREE.RedFormat, THREE.UnsignedByteType);
      this.hTex.magFilter = THREE.LinearFilter; this.hTex.minFilter = THREE.LinearFilter;
      this.hTex.wrapS = this.hTex.wrapT = THREE.ClampToEdgeWrapping;
    }
    const h = this.world.h, d = this.hData;
    for (let k = 0; k < d.length; k++) d[k] = clamp(Math.round((h[k] + 4) / 13 * 255), 0, 255);
    this.hTex.needsUpdate = true;
    return this.hTex;
  }

  // ------------------------------------------------------------ building chunks
  makeChunks() {
    const nc = Math.ceil(this.n / CH);
    this.nc = nc;
    this.chunks = [];
    for (let j = 0; j < nc; j++) for (let i = 0; i < nc; i++) {
      const mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.mat);
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.visible = false;
      this.scene.add(mesh);
      this.chunks.push({ i, j, mesh, set: new Set(), dirty: false });
    }
    this.dirtyChunks = new Set();
  }
  chunkOf(b) {
    const cx = clamp(Math.floor((b.x + b.w / 2) / CH), 0, this.nc - 1), cz = clamp(Math.floor((b.z + b.d / 2) / CH), 0, this.nc - 1);
    return this.chunks[cz * this.nc + cx];
  }

  /** (re)build the geometry of a building and flag its chunk */
  syncBuilding(b, rebuildGeo = true) {
    if (rebuildGeo || !b.geo) {
      const rec = { kind: b.kind, arch: b.arch, key: b.key, style: b.style, level: b.level, lw: b.lw, ld: b.ld, x: b.x, z: b.z, w: b.w, d: b.d, facing: b.facing, seed: b.seed, y0: b.y0 };
      let out;
      try { out = this.arc.generate(rec, { construction: b.state === 'construct' }); }
      catch (e) { console.error('geometry failed for', b.key || b.arch, e); out = this.arc.generate(rec, { construction: true }); }
      b.geo = out.geo; b.ginfo = out.info; b.geoState = b.state === 'construct';
      if (b.state !== 'construct') {
        b.floors = out.info.floors; b.hgt = out.info.h;
        this.registerEmitters(b);
      }
    }
    const c = this.chunkOf(b);
    if (b.chunk && b.chunk !== c) b.chunk.set.delete(b);
    b.chunk = c; c.set.add(b);
    this.dirtyChunks.add(c);
  }
  removeBuilding(b) {
    if (b.chunk) { b.chunk.set.delete(b); this.dirtyChunks.add(b.chunk); b.chunk = null; }
    this.unregisterEmitters(b);
    b.geo = null;
  }
  markChunk(b) { if (b.chunk) this.dirtyChunks.add(b.chunk); }
  clearAllBuildings() {
    for (const c of this.chunks) { for (const b of c.set) this.unregisterEmitters(b); c.set.clear(); c.mesh.visible = false; }
    this.dirtyChunks.clear(); this.fireSites.clear(); this.smokers.length = 0; this.fountains.length = 0;
    for (const [, m] of this.rotors) this.scene.remove(m);
    this.rotors.clear();
    for (const [, m] of this.wheels) { this.scene.remove(m); m.geometry.dispose(); }
    this.wheels.clear();
  }

  registerEmitters(b) {
    this.unregisterEmitters(b);
    const info = b.ginfo;
    if (!info) return;
    if (info.smoke && info.smoke.length && b.state === 'ok') { b._smoke = info.smoke; this.smokers.push(b); }
    if (info.rotorPos) {
      const m = this.makeRotor(); m.position.set(...info.rotorPos); m.rotation.y = info.rotorYaw; m.userData.speed = 1.2 + hash2(b.id, 1) * 0.6;
      this.scene.add(m); this.rotors.set(b.id, m);
    }
    if (info.fountainPos) { b._fountain = info.fountainPos; this.fountains.push(b); }
    if (info.wheelPos) {
      const m = this.makeWheel(info.wheelR); m.position.set(...info.wheelPos); m.rotation.y = info.wheelYaw;
      this.scene.add(m); this.wheels.set(b.id, m);
    }
  }
  unregisterEmitters(b) {
    const i = this.smokers.indexOf(b); if (i >= 0) this.smokers.splice(i, 1);
    const j = this.fountains.indexOf(b); if (j >= 0) this.fountains.splice(j, 1);
    const r = this.rotors.get(b.id); if (r) { this.scene.remove(r); this.rotors.delete(b.id); }
    const wh = this.wheels && this.wheels.get(b.id); if (wh) { this.scene.remove(wh); wh.geometry.dispose(); this.wheels.delete(b.id); }
  }
  makeRotor() {
    if (!this._rotorGeo) {
      const A = this.atlas, mb = new MB(A);
      mb.box(-0.025, -0.025, -0.03, 0.025, 0.025, 0.05, A.white, '#f2f2f0', { rep: 0, top: A.white });
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        const dx = Math.sin(a), dy = Math.cos(a);
        const px = -dy * 0.022, py = dx * 0.022;
        const tip = [dx * 0.5, dy * 0.5, 0.0];
        const base1 = [px, py, 0.01], base2 = [-px, -py, 0.01];
        mb.tri(base1, base2, tip, A.white, '#f4f4f2', { out: [0, 0, 1] });
        mb.tri(base1, base2, tip, A.white, '#dcdcda', { out: [0, 0, -1] });
      }
      this._rotorGeo = toGeometry(mb.build());
    }
    const m = new THREE.Mesh(this._rotorGeo, this.mat);
    m.castShadow = true;
    return m;
  }

  flushChunks(budget = 6) {
    let done = 0;
    for (const c of this.dirtyChunks) {
      this.rebuildChunk(c);
      this.dirtyChunks.delete(c);
      if (++done >= budget) break;
    }
    this.atlas.flush();
  }
  rebuildChunk(c) {
    let nv = 0, ni = 0;
    for (const b of c.set) { if (!b.geo) continue; nv += b.geo.pos.length / 3; ni += b.geo.idx.length; }
    if (!nv) { c.mesh.visible = false; return; }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), uv1 = new Float32Array(nv * 2), col = new Float32Array(nv * 3);
    const idx = new Uint32Array(ni);
    let vo = 0, io = 0;
    for (const b of c.set) {
      const g = b.geo; if (!g) continue;
      const cnt = g.pos.length / 3;
      pos.set(g.pos, vo * 3); nor.set(g.nor, vo * 3); uv.set(g.uv, vo * 2); uv1.set(g.uv1, vo * 2);
      const tm = b.tintMul;
      if (tm) { for (let k = 0; k < cnt * 3; k += 3) { col[vo * 3 + k] = g.col[k] * tm[0]; col[vo * 3 + k + 1] = g.col[k + 1] * tm[1]; col[vo * 3 + k + 2] = g.col[k + 2] * tm[2]; } }
      else col.set(g.col, vo * 3);
      for (let k = 0; k < g.idx.length; k++) idx[io + k] = g.idx[k] + vo;
      vo += cnt; io += g.idx.length;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeBoundingSphere();
    c.mesh.geometry.dispose();
    c.mesh.geometry = geo;
    c.mesh.visible = true;
  }

  // ------------------------------------------------------------ roads & infrastructure
  rebuildInfra() {
    const w = this.world, n = this.n, A = this.atlas;
    const b = new MB(A);
    const white = A.white;
    const pylonTiles = [];
    const lampCell = A.decal('lamp', (c, S) => { c.fillStyle = '#ffe9a0'; c.fillRect(0, 0, S, S); }, (c, S) => { c.fillStyle = '#fff2b0'; c.fillRect(0, 0, S, S); });
    const arrowCell = A.decal('oneway', (c, S) => { c.fillStyle = '#3d4045'; c.fillRect(0, 0, S, S); c.fillStyle = '#e8e8e0'; c.beginPath(); c.moveTo(S / 2, 6); c.lineTo(S - 14, S / 2); c.lineTo(S / 2 + 6, S / 2); c.lineTo(S / 2 + 6, S - 6); c.lineTo(S / 2 - 6, S - 6); c.lineTo(S / 2 - 6, S / 2); c.lineTo(14, S / 2); c.closePath(); c.fill(); });
    const sigR = A.decal('sigR', (c, S) => { c.fillStyle = '#222'; c.fillRect(0, 0, S, S); c.fillStyle = '#e53935'; c.beginPath(); c.arc(S / 2, S * 0.3, S * 0.18, 0, 7); c.fill(); c.fillStyle = '#2e7d32'; c.beginPath(); c.arc(S / 2, S * 0.72, S * 0.18, 0, 7); c.fill(); }, (c, S) => { c.fillStyle = '#000'; c.fillRect(0, 0, S, S); c.fillStyle = '#ff3b30'; c.beginPath(); c.arc(S / 2, S * 0.3, S * 0.2, 0, 7); c.fill(); c.fillStyle = '#34c759'; c.beginPath(); c.arc(S / 2, S * 0.72, S * 0.2, 0, 7); c.fill(); });
    for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) {
      const t = w.road[z * n + x];
      if (!t) continue;
      const mask = w.roadMask(x, z);
      const y00 = w.roadCornerY(x, z), y10 = w.roadCornerY(x + 1, z), y01 = w.roadCornerY(x, z + 1), y11 = w.roadCornerY(x + 1, z + 1);
      const cell = A.road(t, mask);
      b.quad([x, y01, z + 1], [x + 1, y11, z + 1], [x + 1, y10, z], [x, y00, z], cell, [1, 1, 1], { out: [0, 1, 0] });
      const bridge = w.water[z * n + x] === 1;
      const ns = (mask & 5) && !(mask & 10), ew = (mask & 10) && !(mask & 5);
      if (bridge) {
        const yy = BRIDGE_Y;
        const deckT = 0.07;
        const conc = '#a9a69d';
        if (ns || (!ew)) {
          // side beams along z
          b.box(x - 0.0, yy - deckT, z, x + 0.05, yy, z + 1, white, conc, { rep: 0, top: white });
          b.box(x + 0.95, yy - deckT, z, x + 1.0, yy, z + 1, white, conc, { rep: 0, top: white });
          b.box(x + 0.0, yy + 0.0, z, x + 0.035, yy + 0.07, z + 1, white, '#c9c6bc', { rep: 0, top: white });
          b.box(x + 0.965, yy + 0.0, z, x + 1.0, yy + 0.07, z + 1, white, '#c9c6bc', { rep: 0, top: white });
        }
        if (ew || (!ns && mask === 0)) {
          b.box(x, yy - deckT, z, x + 1, yy, z + 0.05, white, conc, { rep: 0, top: white });
          b.box(x, yy - deckT, z + 0.95, x + 1, yy, z + 1, white, conc, { rep: 0, top: white });
          b.box(x, yy, z, x + 1, yy + 0.07, z + 0.035, white, '#c9c6bc', { rep: 0, top: white });
          b.box(x, yy, z + 0.965, x + 1, yy + 0.07, z + 1, white, '#c9c6bc', { rep: 0, top: white });
        }
        if (!ns && !ew && mask !== 0) b.box(x, yy - deckT, z, x + 1, yy, z + 1, white, conc, { rep: 0, top: white, noTop: false });
        // underside + pier
        b.quad([x, yy - deckT, z], [x + 1, yy - deckT, z], [x + 1, yy - deckT, z + 1], [x, yy - deckT, z + 1], white, '#8a877e', { out: [0, -1, 0] });
        if ((x + z) % 2 === 0) {
          const floor = Math.min(w.H(x, z), w.H(x + 1, z), w.H(x, z + 1), w.H(x + 1, z + 1)) - 0.1;
          b.box(x + 0.4, floor, z + 0.2, x + 0.6, yy - deckT, z + 0.8, white, '#8d8a82', { rep: 0, top: white });
        }
      } else if (t >= 2 && t <= 4) {
        const nconn = ((mask & 1) ? 1 : 0) + ((mask & 2) ? 1 : 0) + ((mask & 4) ? 1 : 0) + ((mask & 8) ? 1 : 0);
        // one-way arrow painted on the asphalt
        const od = w.rdir[z * n + x];
        if (od && nconn <= 2) {
          const yy = w.roadY(x + 0.5, z + 0.5) + 0.004, hs = 0.16;
          const P = [[x + 0.5 - hs, z + 0.5 + hs], [x + 0.5 + hs, z + 0.5 + hs], [x + 0.5 + hs, z + 0.5 - hs], [x + 0.5 - hs, z + 0.5 - hs]];
          // rotate corner order so the arrow (pointing to -z in the cell) faces the travel direction
          const rot = (od - 1) & 3, Q = [0, 1, 2, 3].map((k) => P[(k + 4 - rot) % 4]);
          b.quad([Q[0][0], yy, Q[0][1]], [Q[1][0], yy, Q[1][1]], [Q[2][0], yy, Q[2][1]], [Q[3][0], yy, Q[3][1]], arrowCell, [1, 1, 1], { out: [0, 1, 0] });
        }
        // traffic lights at busy junctions
        if (nconn >= 3 && t >= 2) {
          for (const [cx, cz] of [[x + 0.06, z + 0.06], [x + 0.94, z + 0.94]]) {
            const ly = w.roadY(cx, cz);
            b.cyl(cx, cz, 0.006, ly, ly + 0.18, 4, white, '#2b2e33', { cap: false });
            b.box(cx - 0.012, ly + 0.15, cz - 0.012, cx + 0.012, ly + 0.2, cz + 0.012, sigR, '#ffffff', { rep: 0, top: white });
          }
        }
        // street lamps along straight segments
        if ((ns || ew) && ((x * 3 + z * 5) % 4 === 0)) {
          const side = ((x + z) & 1) ? 0.93 : 0.07;
          const lx = ns ? x + side : x + 0.5, lz = ew ? z + side : z + 0.5;
          const ly = w.roadY(lx, lz);
          b.cyl(lx, lz, 0.007, ly, ly + 0.2, 5, white, '#3b3f44', { cap: false });
          const ax = ns ? (side > 0.5 ? -0.05 : 0.05) : 0, az = ew ? (side > 0.5 ? -0.05 : 0.05) : 0;
          b.box(lx - 0.006 + Math.min(0, ax), ly + 0.195, lz - 0.006 + Math.min(0, az), lx + 0.006 + Math.max(0, ax), ly + 0.205, lz + 0.006 + Math.max(0, az), white, '#3b3f44', { rep: 0, top: white });
          b.box(lx + ax - 0.014, ly + 0.185, lz + az - 0.014, lx + ax + 0.014, ly + 0.2, lz + az + 0.014, lampCell, '#ffffff', { rep: 0, top: lampCell });
        }
      }
      // rail crossing signs etc. omitted
    }
    // pylons
    const lines = [];
    for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) if (w.pylon[z * n + x]) {
      const y = Math.max(w.H(x, z), w.H(x + 1, z), w.H(x, z + 1), w.H(x + 1, z + 1), 0.05);
      const sx = b.pos.length;
      b.setT(x, y, z, 0);
      const px = 0.5, pz = 0.5;
      b.cyl(px, pz, 0.013, 0, 0.55, 5, white, '#6c7479', { r1: 0.007, cap: false });
      b.box(px - 0.2, 0.46, pz - 0.006, px + 0.2, 0.475, pz + 0.006, white, '#6c7479', { rep: 0 });
      b.box(px - 0.15, 0.37, pz - 0.006, px + 0.15, 0.385, pz + 0.006, white, '#6c7479', { rep: 0 });
      b.clearT();
      pylonTiles.push([x, z, y]);
    }
    for (let a = 0; a < pylonTiles.length; a++) for (let c = a + 1; c < pylonTiles.length; c++) {
      const p = pylonTiles[a], q = pylonTiles[c];
      if (Math.abs(p[0] - q[0]) <= 3 && Math.abs(p[1] - q[1]) <= 3) {
        for (const off of [-0.2, 0.2]) lines.push(p[0] + 0.5 + off, p[2] + 0.46, p[1] + 0.5, q[0] + 0.5 + off, q[2] + 0.46, q[1] + 0.5);
      }
    }
    if (this.infra) { this.scene.remove(this.infra); this.infra.geometry.dispose(); }
    const geo = toGeometry(b.build());
    this.infra = new THREE.Mesh(geo, this.matRoad);
    this.infra.receiveShadow = true; this.infra.castShadow = true; this.infra.frustumCulled = false;
    this.scene.add(this.infra);
    if (this.infraLines) { this.scene.remove(this.infraLines); this.infraLines.geometry.dispose(); }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    this.infraLines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#1a1c1e' }));
    this.scene.add(this.infraLines);
    this.atlas.flush();
    w.dirty.roads = false;
  }

  // ------------------------------------------------------------ trees
  makeTrees() {
    const A = this.atlas;
    const mk = (fn) => { const mb = new MB(A); fn(mb); return toGeometry(mb.build()); };
    const w = A.white;
    const geos = {
      oak: mk((b) => { b.cyl(0, 0, 0.022, 0, 0.17, 5, w, '#5b4330', { r1: 0.016, cap: false }); b.dome(0, 0, 0.17, 0.13, 0.2, 7, 3, w, '#4a8a3e'); b.dome(0.06, 0.04, 0.11, 0.26, 0.14, 6, 2, w, '#5a9a46'); }),
      pine: mk((b) => { b.cyl(0, 0, 0.018, 0, 0.12, 5, w, '#5b4330', { cap: false }); b.pyramid(0, 0, 0.16, 0.07, 0.3, 7, w, '#2f6b3a', 0, true); b.pyramid(0, 0, 0.125, 0.22, 0.44, 7, w, '#357a42', 0.3, true); b.pyramid(0, 0, 0.085, 0.37, 0.58, 7, w, '#3a8447', 0.6, true); }),
      birch: mk((b) => { b.cyl(0, 0, 0.012, 0, 0.26, 5, w, '#e6e2d4', { r1: 0.009, cap: false }); b.dome(0, 0, 0.1, 0.16, 0.22, 6, 3, w, '#8fb85a'); }),
      palm: mk((b) => { b.cyl(0, 0, 0.016, 0, 0.3, 5, w, '#8a6a45', { r1: 0.01, cap: false }); b.dome(0, 0, 0.18, 0.28, 0.06, 8, 2, w, '#3f9a4a'); b.dome(0, 0, 0.1, 0.32, 0.07, 6, 2, w, '#4aaa55'); }),
      bush: mk((b) => { b.dome(0, 0, 0.07, 0, 0.07, 6, 2, w, '#4a8a3e'); b.dome(0.05, 0.03, 0.045, 0, 0.05, 5, 2, w, '#5a9a46'); }),
    };
    this.treeGeos = geos;
    this.treeMeshes = {};
    const MAXT = 26000;
    for (const k of Object.keys(geos)) {
      const im = new THREE.InstancedMesh(geos[k], this.matTree, MAXT);
      im.count = 0; im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
      this.scene.add(im); this.treeMeshes[k] = im;
    }
  }

  rebuildTrees() {
    const w = this.world, n = this.n;
    const counts = { oak: 0, pine: 0, birch: 0, palm: 0, bush: 0 };
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const c = new THREE.Color();
    const put = (kind, x, y, z, sc, rot, shade) => {
      const im = this.treeMeshes[kind];
      if (counts[kind] >= im.instanceMatrix.count) return;
      q.setFromAxisAngle(up, rot); s.set(sc, sc * (0.9 + shade * 0.3), sc); p.set(x, y, z);
      m.compose(p, q, s);
      im.setMatrixAt(counts[kind], m);
      c.setRGB(0.85 + shade * 0.3, 0.88 + shade * 0.22, 0.85 + (1 - shade) * 0.2);
      im.setColorAt(counts[kind], c);
      counts[kind]++;
    };
    for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) {
      const i = z * n + x;
      const tv = w.tree[i];
      const isPark = w.park[i] || w.lot[i] === 5;
      if (!tv && !isPark) continue;
      if (w.bid[i] && !isPark) continue;
      const hh = w.tileAvg(x, z);
      let cnt = tv === 2 ? 6 : tv === 1 ? 3 : isPark ? (hash2(x, z, 9) < 0.55 ? 1 : 0) : 0;
      if (tv && this.Q && this.Q.trees < 1) cnt = Math.max(1, Math.round(cnt * this.Q.trees));
      for (let k = 0; k < cnt; k++) {
        const r1 = hash2(x * 7 + k, z * 3 + 1, 21), r2 = hash2(x * 5 + 2, z * 11 + k, 22), r3 = hash2(x + k * 13, z, 23), r4 = hash2(x * 17, z * 19 + k, 24);
        const px = x + 0.12 + r1 * 0.76, pz = z + 0.12 + r2 * 0.76;
        const py = w.heightAt(px, pz);
        let kind;
        if (hh < 0.7 && r3 < 0.55) kind = 'palm';
        else if (hh > 3.2) kind = 'pine';
        else { const t = hash2(x >> 2, z >> 2, 5); kind = r3 < (t < 0.4 ? 0.65 : 0.15) ? 'pine' : r3 < 0.85 ? 'oak' : 'birch'; }
        if (isPark && !tv) kind = r3 < 0.7 ? 'oak' : 'birch';
        put(kind, px, py, pz, 0.85 + r4 * 0.6, r1 * 6.28, r4);
        if (k % 2 === 0 && tv) put('bush', px + 0.1, w.heightAt(px + 0.1, pz + 0.07), pz + 0.07, 0.8 + r2 * 0.5, r3 * 6, r1);
      }
    }
    for (const k of Object.keys(this.treeMeshes)) {
      const im = this.treeMeshes[k];
      im.count = counts[k];
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
    w.dirty.trees = false;
  }

  // ------------------------------------------------------------ particles
  makeFX() {
    const N = 2600;
    this.fx = { N, i: 0, pos: new Float32Array(N * 3), col: new Float32Array(N * 4), size: new Float32Array(N), vel: new Float32Array(N * 3), life: new Float32Array(N), max: new Float32Array(N), kind: new Uint8Array(N), c0: new Float32Array(N * 3) };
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.fx.pos, 3));
    g.setAttribute('pcol', new THREE.BufferAttribute(this.fx.col, 4));
    g.setAttribute('size', new THREE.BufferAttribute(this.fx.size, 1));
    this.fxGeo = g;
    this.fxMat = new THREE.ShaderMaterial({ vertexShader: PART_VS, fragmentShader: PART_FS, transparent: true, depthWrite: false, uniforms: { uScale: { value: 800 } } });
    this.fxPoints = new THREE.Points(g, this.fxMat);
    this.fxPoints.frustumCulled = false; this.fxPoints.renderOrder = 5;
    this.scene.add(this.fxPoints);
    this.fireSites = new Map();
  }
  emit(kind, x, y, z, vx, vy, vz, life, size, r, g, b) {
    const f = this.fx, i = f.i; f.i = (f.i + 1) % f.N;
    f.pos[i * 3] = x; f.pos[i * 3 + 1] = y; f.pos[i * 3 + 2] = z;
    f.vel[i * 3] = vx; f.vel[i * 3 + 1] = vy; f.vel[i * 3 + 2] = vz;
    f.life[i] = life; f.max[i] = life; f.size[i] = size; f.kind[i] = kind;
    f.c0[i * 3] = r; f.c0[i * 3 + 1] = g; f.c0[i * 3 + 2] = b;
  }
  updateFX(dt, simSpeed) {
    const f = this.fx;
    const k = Math.max(0.2, simSpeed);
    // emitters
    const rate = dt * (this.quality === 'low' ? 0.5 : 1);
    for (const b of this.smokers) {
      if (b.state !== 'ok' || !b.powered) continue;
      const lvl = Math.max(0.3, Math.min(1.6, (b.def && b.def.pollute) ? b.def.pollute * 0.5 : 0.6));
      for (const p of b._smoke) {
        if (Math.random() < 5 * rate * lvl) this.emit(0, p[0] + (Math.random() - 0.5) * 0.03, p[1], p[2] + (Math.random() - 0.5) * 0.03, 0.05 + Math.random() * 0.03, 0.2 + Math.random() * 0.1, 0.03, 4 + Math.random() * 3, 0.1, 0.6, 0.6, 0.62);
      }
    }
    for (const b of this.fountains) {
      if (Math.random() < 14 * rate) { const a = Math.random() * 6.28, sp = 0.05 + Math.random() * 0.08; this.emit(2, b._fountain[0], b._fountain[1], b._fountain[2], Math.cos(a) * sp, 0.5 + Math.random() * 0.2, Math.sin(a) * sp, 0.8, 0.045, 0.7, 0.88, 1.0); }
    }
    for (const [id, s] of this.fireSites) {
      if (Math.random() < 75 * rate * s.k) this.emit(1, s.x + (Math.random() - 0.5) * s.r, s.y + Math.random() * 0.18, s.z + (Math.random() - 0.5) * s.r, (Math.random() - 0.5) * 0.06, 0.25 + Math.random() * 0.25, (Math.random() - 0.5) * 0.06, 0.8 + Math.random() * 0.6, 0.5 * (0.6 + s.k * 0.6), 1.0, 0.45 + Math.random() * 0.3, 0.1);
      if (Math.random() < 14 * rate * s.k) this.emit(0, s.x + (Math.random() - 0.5) * s.r, s.y + 0.3, s.z + (Math.random() - 0.5) * s.r, 0.05, 0.34, 0.03, 4.2, 0.4, 0.2, 0.2, 0.21);
    }
    // integrate
    for (let i = 0; i < f.N; i++) {
      if (f.life[i] <= 0) { f.col[i * 4 + 3] = 0; continue; }
      f.life[i] -= dt;
      const t = 1 - f.life[i] / f.max[i];
      const kd = f.kind[i];
      f.pos[i * 3] += f.vel[i * 3] * dt; f.pos[i * 3 + 1] += f.vel[i * 3 + 1] * dt; f.pos[i * 3 + 2] += f.vel[i * 3 + 2] * dt;
      if (kd === 2) f.vel[i * 3 + 1] -= 1.3 * dt;
      let a;
      if (kd === 0) { a = Math.sin(Math.min(1, t * 6) * 1.57) * (1 - t) * 0.5; f.size[i] = Math.min(0.85, f.size[i] + dt * 0.2); const night = 1 - this.nightK * 0.6; f.col[i * 4] = f.c0[i * 3] * night; f.col[i * 4 + 1] = f.c0[i * 3 + 1] * night; f.col[i * 4 + 2] = f.c0[i * 3 + 2] * night; }
      else if (kd === 1) { a = (1 - t) * 0.85; f.size[i] *= 1 - dt * 0.7; f.col[i * 4] = 1; f.col[i * 4 + 1] = f.c0[i * 3 + 1] * (1 - t * 0.7); f.col[i * 4 + 2] = 0.08; }
      else { a = (1 - t) * 0.7; f.col[i * 4] = f.c0[i * 3]; f.col[i * 4 + 1] = f.c0[i * 3 + 1]; f.col[i * 4 + 2] = f.c0[i * 3 + 2]; }
      f.col[i * 4 + 3] = a;
    }
    this.fxGeo.attributes.position.needsUpdate = true;
    this.fxGeo.attributes.pcol.needsUpdate = true;
    this.fxGeo.attributes.size.needsUpdate = true;
  }
  dust(b, amount = 1, col = [0.62, 0.56, 0.46]) {
    const cx = b.x + b.w / 2, cz = b.z + b.d / 2, y = (b.y0 || 0) + 0.1;
    const cnt = Math.min(26, Math.round((6 + b.w * b.d) * amount));
    for (let k = 0; k < cnt; k++) {
      const a = Math.random() * 6.28, r = Math.random() * Math.min(b.w, b.d) * 0.5;
      this.emit(0, cx + Math.cos(a) * r, y, cz + Math.sin(a) * r, Math.cos(a) * 0.12, 0.1 + Math.random() * 0.14, Math.sin(a) * 0.12, 1.2 + Math.random() * 0.8, 0.16 + Math.random() * 0.12, col[0], col[1], col[2]);
    }
  }
  setFire(b, on, k = 1) {
    if (on) this.fireSites.set(b.id, { x: b.x + b.w / 2, z: b.z + b.d / 2, y: b.y0 + Math.max(0.2, (b.hgt || 0.5) * 0.6), r: Math.min(b.w, b.d) * 0.7, k });
    else this.fireSites.delete(b.id);
  }

  // ------------------------------------------------------------ cursor & ghost
  makeCursor() {
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    mat.opacity = 0.55;
    this.cursorMesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    this.cursorMesh.frustumCulled = false; this.cursorMesh.renderOrder = 6; this.cursorMesh.userData.noAO = true;
    this.scene.add(this.cursorMesh);
    this.ringLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthTest: false }));
    this.ringLines.frustumCulled = false; this.ringLines.renderOrder = 7;
    this.scene.add(this.ringLines);
    this.ghost = null; this.ghostKey = '';
  }
  /** tiles: array of [x,z,r,g,b,a] ; colours 0..1 */
  showTiles(tiles) {
    if (!tiles || !tiles.length) { this.cursorMesh.visible = false; return; }
    const w = this.world;
    const pos = new Float32Array(tiles.length * 12), col = new Float32Array(tiles.length * 16), idx = new Uint32Array(tiles.length * 6);
    let p = 0, c = 0, ii = 0, v = 0;
    for (const [x, z, r, g, b, a] of tiles) {
      const y = (i, j) => Math.max(w.H(i, j), 0) + 0.04;
      pos.set([x, y(x, z), z, x + 1, y(x + 1, z), z, x, y(x, z + 1), z + 1, x + 1, y(x + 1, z + 1), z + 1], p); p += 12;
      for (let k = 0; k < 4; k++) { col[c++] = r; col[c++] = g; col[c++] = b; col[c++] = a; }
      idx.set([v, v + 2, v + 1, v + 1, v + 2, v + 3], ii); ii += 6; v += 4;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 4));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    this.cursorMesh.geometry.dispose();
    this.cursorMesh.geometry = g;
    this.cursorMesh.material.vertexColors = true;
    this.cursorMesh.visible = true;
  }
  showRing(cx, cz, r, color = '#ffffff') {
    if (r === null || r === undefined) { this.ringLines.visible = false; return; }
    const w = this.world;
    const pts = [];
    const N = 48;
    for (let k = 0; k < N; k++) {
      const a0 = (k / N) * Math.PI * 2, a1 = ((k + 1) / N) * Math.PI * 2;
      const x0 = cx + Math.cos(a0) * r, z0 = cz + Math.sin(a0) * r, x1 = cx + Math.cos(a1) * r, z1 = cz + Math.sin(a1) * r;
      pts.push(x0, Math.max(w.heightAt(x0, z0), 0) + 0.08, z0, x1, Math.max(w.heightAt(x1, z1), 0) + 0.08, z1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.ringLines.geometry.dispose(); this.ringLines.geometry = g;
    this.ringLines.material.color.set(color);
    this.ringLines.visible = true;
  }
  showGhost(rec, valid) {
    if (!rec) { if (this.ghost) this.ghost.visible = false; return; }
    const key = [rec.kind, rec.arch, rec.key, rec.style, rec.level, rec.facing, rec.x, rec.z, rec.y0].join('|');
    if (key !== this.ghostKey) {
      this.ghostKey = key;
      const out = this.arc.generate(rec);
      const geo = toGeometry(out.geo);
      if (!this.ghost) { this.ghost = new THREE.Mesh(geo, this.matGhost); this.scene.add(this.ghost); this.ghost.renderOrder = 8; this.ghost.userData.noAO = true; }
      else { this.ghost.geometry.dispose(); this.ghost.geometry = geo; }
      this.atlas.flush();
    }
    this.ghost.visible = true;
    this.matGhost.color.set(valid ? '#9dffa8' : '#ff7b7b');
  }
  hideGhost() { if (this.ghost) this.ghost.visible = false; this.ghostKey = ''; }

  // ------------------------------------------------------------ extras: area outline, transit lines, labels, wheels
  makeExtras() {
    this.areaLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, depthTest: false }));
    this.areaLines.frustumCulled = false; this.areaLines.renderOrder = 7; this.areaLines.visible = false;
    this.scene.add(this.areaLines);
    this.transitLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95, depthTest: false }));
    this.transitLines.frustumCulled = false; this.transitLines.renderOrder = 7; this.transitLines.visible = false;
    this.scene.add(this.transitLines);
    this.wheels = new Map();
    this.labelsDirty = true; this.labels = [];
    this.labelLayer = document.createElement('div'); this.labelLayer.id = 'labels';
    document.body.appendChild(this.labelLayer);
    this.burns = [];
    this.shake = 0;
  }
  showArea(ax, az, size, color) {
    if (ax === null || ax === undefined) { this.areaLines.visible = false; return; }
    const w = this.world, pts = [];
    const y = (x, z) => Math.max(w.heightAt(Math.min(x, this.n - 0.01), Math.min(z, this.n - 0.01)), 0) + 0.12;
    const seg = (x0, z0, x1, z1) => { const steps = 16; for (let k = 0; k < steps; k++) { const a = k / steps, b = (k + 1) / steps; const xa = x0 + (x1 - x0) * a, za = z0 + (z1 - z0) * a, xb = x0 + (x1 - x0) * b, zb = z0 + (z1 - z0) * b; pts.push(xa, y(xa, za), za, xb, y(xb, zb), zb); } };
    seg(ax, az, ax + size, az); seg(ax + size, az, ax + size, az + size); seg(ax + size, az + size, ax, az + size); seg(ax, az + size, ax, az);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.areaLines.geometry.dispose(); this.areaLines.geometry = g; this.areaLines.material.color.set(color); this.areaLines.visible = true;
  }
  setAreas(areas, show) {
    for (let k = 0; k < 16; k++) this.uArea.value[k] = areas[k] ? 1 : 0;
    this.uAreaShow.value = show ? 1 : 0;
  }
  /** colored polylines for each public transport line */
  showTransitLines(on) {
    if (!on) { this.transitLines.visible = false; return; }
    const sim = this.G.sim, w = this.world, n = this.n, pos = [], col = [];
    const c = new THREE.Color();
    const y = (x, z) => w.roadY(x, z) + 0.15;
    for (const l of sim.S.lines || []) {
      c.set(l.color);
      const add = (x0, z0, x1, z1, yy0, yy1) => { pos.push(x0, yy0, z0, x1, yy1, z1); col.push(c.r, c.g, c.b, c.r, c.g, c.b); };
      if (l.type === 'bus' && l.route) {
        for (let k = 0; k < l.route.length - 1; k++) { const a = l.route[k], b = l.route[k + 1]; const ax = a % n + 0.5, az = ((a / n) | 0) + 0.5, bx = b % n + 0.5, bz = ((b / n) | 0) + 0.5; add(ax, az, bx, bz, y(ax, az), y(bx, bz)); }
      } else {
        const pts = l.stops.map((k) => sim.stopPos(l, k)).filter(Boolean);
        const loop = l.type === 'bus' ? pts.concat(pts.length > 1 ? [pts[0]] : []) : pts;
        for (let k = 0; k < loop.length - 1; k++) { const a = loop[k], b = loop[k + 1]; add(a.x + 0.5, a.z + 0.5, b.x + 0.5, b.z + 0.5, 0.5, 0.5); }
      }
      // stop markers
      for (const k of l.stops) { const p = sim.stopPos(l, k); if (!p) continue; const x = p.x + 0.5, z = p.z + 0.5, h = y(x, z); add(x, z, x, z, h - 0.1, h + 0.7); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    this.transitLines.geometry.dispose(); this.transitLines.geometry = g; this.transitLines.visible = true;
  }
  /** DOM labels for district names */
  updateLabels(show) {
    const sim = this.G.sim, w = this.world, n = this.n;
    const ds = (sim && sim.S.districts) || [];
    if (this.labelsDirty) {
      this.labelsDirty = false;
      const acc = {};
      for (let i = 0; i < w.dist.length; i++) { const id = w.dist[i]; if (!id) continue; const a = acc[id] || (acc[id] = [0, 0, 0]); a[0] += i % n; a[1] += (i / n) | 0; a[2]++; }
      this.labelLayer.innerHTML = '';
      this.labels = [];
      for (const d of ds) {
        const a = acc[d.id]; if (!a) continue;
        const el = document.createElement('div'); el.className = 'dlabel'; el.textContent = d.name; el.style.setProperty('--dc', d.color);
        this.labelLayer.appendChild(el);
        this.labels.push({ el, x: a[0] / a[2] + 0.5, z: a[1] / a[2] + 0.5, size: a[2] });
      }
    }
    this.labelLayer.style.display = show && this.G.started ? '' : 'none';
    if (!show) return;
    const v = new THREE.Vector3(), rect = this.canvas.getBoundingClientRect();
    const far = (this.camDist || 60) > 100;
    for (const L of this.labels) {
      v.set(L.x, Math.max(w.heightAt(L.x, L.z), 0) + 1.2, L.z).project(this.camera);
      const vis = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
      L.el.style.display = vis ? '' : 'none';
      if (vis) L.el.style.transform = `translate(${rect.left + (v.x * 0.5 + 0.5) * rect.width}px, ${rect.top + (-v.y * 0.5 + 0.5) * rect.height}px) translate(-50%, -50%) scale(${far ? 0.85 : 1})`;
    }
  }
  makeWheel(r) {
    const A = this.atlas, mb = new MB(A), W = A.white;
    const N = 20, t = 0.035, hw = 0.07;
    const ring = (rad, col) => {
      for (let k = 0; k < N; k++) {
        const a0 = k / N * Math.PI * 2, a1 = (k + 1) / N * Math.PI * 2;
        const p = (a, rr, z) => [Math.cos(a) * rr, Math.sin(a) * rr, z];
        // outer band, inner band and both side faces of a rim segment
        mb.quad(p(a0, rad, hw), p(a1, rad, hw), p(a1, rad, -hw), p(a0, rad, -hw), W, col, { out: [Math.cos((a0 + a1) / 2), Math.sin((a0 + a1) / 2), 0] });
        mb.quad(p(a0, rad - t, -hw), p(a1, rad - t, -hw), p(a1, rad - t, hw), p(a0, rad - t, hw), W, col, { out: [-Math.cos((a0 + a1) / 2), -Math.sin((a0 + a1) / 2), 0] });
        for (const z of [hw, -hw]) mb.quad(p(a0, rad - t, z), p(a1, rad - t, z), p(a1, rad, z), p(a0, rad, z), W, col, { out: [0, 0, Math.sign(z)] });
      }
    };
    ring(r, '#f2f2f0'); ring(r * 0.55, '#e0e0de');
    for (let k = 0; k < N; k += 2) {
      const a = k / N * Math.PI * 2, c = Math.cos(a), s2 = Math.sin(a), px = -s2 * 0.008, py = c * 0.008;
      for (const z of [hw * 0.8, -hw * 0.8]) {
        const q = [[px, py, z], [c * r + px, s2 * r + py, z], [c * r - px, s2 * r - py, z], [-px, -py, z]];
        mb.quad(q[0], q[1], q[2], q[3], W, '#d8d8d6', { out: [0, 0, 1] });
        mb.quad(q[3], q[2], q[1], q[0], W, '#d8d8d6', { out: [0, 0, -1] });
      }
    }
    // hub
    for (let k = 0; k < 8; k++) { const a0 = k / 8 * Math.PI * 2, a1 = (k + 1) / 8 * Math.PI * 2; mb.quad([Math.cos(a0) * 0.06, Math.sin(a0) * 0.06, hw + 0.03], [Math.cos(a1) * 0.06, Math.sin(a1) * 0.06, hw + 0.03], [Math.cos(a1) * 0.06, Math.sin(a1) * 0.06, -hw - 0.03], [Math.cos(a0) * 0.06, Math.sin(a0) * 0.06, -hw - 0.03], W, '#9aa0a6', { out: [Math.cos(a0), Math.sin(a0), 0] }); }
    // gondolas
    const cols = ['#c0392b', '#2a62a8', '#2d9a4a', '#d9a62b', '#8e44ad'];
    for (let k = 0; k < N; k += 2) {
      const a = k / N * Math.PI * 2, gx = Math.cos(a) * r, gy = Math.sin(a) * r;
      mb.box(gx - 0.05, gy - 0.1, -0.05, gx + 0.05, gy - 0.02, 0.05, W, cols[(k / 2) % cols.length], { rep: 0, top: W });
      mb.box(gx - 0.055, gy - 0.025, -0.055, gx + 0.055, gy - 0.012, 0.055, W, '#f4f4f2', { rep: 0, top: W });
    }
    const m = new THREE.Mesh(toGeometry(mb.build()), this.mat);
    m.castShadow = true;
    return m;
  }
  /** disasters: visual hooks called by the sim */
  onDisaster(d) { if (this.G.ui) this.G.ui.sfx('alert'); }
  impact(x, z, r) {
    const y = Math.max(this.world.heightAt(x, z), 0);
    for (let k = 0; k < 160; k++) { const a = Math.random() * 6.28, sp = 0.5 + Math.random() * 2.2; this.emit(1, x, y + 0.2, z, Math.cos(a) * sp, 0.6 + Math.random() * 2, Math.sin(a) * sp, 0.8 + Math.random() * 1.2, 0.6 + Math.random() * 0.6, 1, 0.5, 0.1); }
    for (let k = 0; k < 90; k++) { const a = Math.random() * 6.28, sp = 0.3 + Math.random() * 1.2; this.emit(0, x, y + 0.2, z, Math.cos(a) * sp, 0.4 + Math.random() * 0.8, Math.sin(a) * sp, 4 + Math.random() * 3, 0.6, 0.35, 0.32, 0.3); }
    this.wx.flash = 1.4; this.shake = 0.6; this.shakeT = 1.2;
    if (this.G.ui) this.G.ui.sfx('boom');
  }
  burnTile(x, z) { this.burns.push({ x: x + 0.5, z: z + 0.5, y: Math.max(this.world.heightAt(x + 0.5, z + 0.5), 0), t: 4 }); if (this.burns.length > 300) this.burns.shift(); }
  updateDisasters(dt) {
    const sim = this.G.sim; if (!sim) return;
    const list = sim.S.activeDisasters || [];
    const w = this.world;
    for (const d of list) {
      if (d.kind === 'meteor' && !d.done) {
        const k = clamp(d.t / d.impact, 0, 1);
        const sx = d.x + 26 * (1 - k), sz = d.z - 18 * (1 - k), sy = Math.max(w.heightAt(clamp(d.x, 0, this.n - 1), clamp(d.z, 0, this.n - 1)), 0) + 32 * (1 - k) + 0.3;
        for (let j = 0; j < 6; j++) this.emit(1, sx + (Math.random() - 0.5) * 0.6, sy + (Math.random() - 0.5) * 0.6, sz + (Math.random() - 0.5) * 0.6, 0, 0, 0, 0.6, 1.4, 1, 0.55, 0.15);
        for (let j = 0; j < 3; j++) this.emit(0, sx, sy, sz, (Math.random() - 0.5) * 0.3, 0.1, (Math.random() - 0.5) * 0.3, 3, 0.9, 0.4, 0.36, 0.34);
      } else if (d.kind === 'tornado') {
        const gy = Math.max(w.heightAt(clamp(d.x, 0, this.n - 1), clamp(d.z, 0, this.n - 1)), 0);
        for (let j = 0; j < 14; j++) {
          const h = Math.random() * 7, a = Math.random() * 6.28 + this.time * 6, r = 0.2 + h * 0.28;
          this.emit(0, d.x + Math.cos(a) * r, gy + h, d.z + Math.sin(a) * r, -Math.sin(a) * 1.6, 0.6, Math.cos(a) * 1.6, 1.2, 0.5 + h * 0.08, 0.42, 0.4, 0.38);
        }
      } else if (d.kind === 'forestfire') {
        for (const [x, z] of d.front.slice(0, 40)) if (Math.random() < 0.5) this.emit(1, x + Math.random(), Math.max(w.heightAt(x + 0.5, z + 0.5), 0) + 0.2 + Math.random() * 0.3, z + Math.random(), 0, 0.35, 0, 0.8, 0.6, 1, 0.5, 0.1);
      }
    }
    for (const b of this.burns) { b.t -= dt; if (Math.random() < 0.3) this.emit(0, b.x, b.y + 0.2, b.z, 0.03, 0.3, 0.02, 3, 0.35, 0.25, 0.24, 0.24); }
    this.burns = this.burns.filter((b) => b.t > 0);
    if (this.shakeT > 0) { this.shakeT -= dt; if (this.shakeT <= 0) this.shake = 0; }
  }

  // ------------------------------------------------------------ overlay
  makeOverlay() {
    const n = this.n;
    this.ovCanvas = document.createElement('canvas'); this.ovCanvas.width = this.ovCanvas.height = n;
    this.ovCtx = this.ovCanvas.getContext('2d');
    this.ovImg = this.ovCtx.createImageData(n, n);
    this.ovTex = new THREE.CanvasTexture(this.ovCanvas);
    this.ovTex.colorSpace = THREE.SRGBColorSpace;
    this.ovTex.magFilter = THREE.LinearFilter; this.ovTex.minFilter = THREE.LinearFilter;
    this.ovTex.generateMipmaps = false;
    const mat = new THREE.MeshBasicMaterial({ map: this.ovTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: false });
    this.overlayMesh = new THREE.Mesh(this.terrainGeo, mat);
    this.overlayMesh.visible = false; this.overlayMesh.renderOrder = 3; this.overlayMesh.frustumCulled = false; this.overlayMesh.userData.noAO = true;
    this.scene.add(this.overlayMesh);
    this.overlayOn = false;
  }
  /** fn(i) -> [r,g,b,a] 0..255 per tile index */
  paintOverlay(fn, crisp = false) {
    const n = this.n, d = this.ovImg.data;
    for (let i = 0; i < n * n; i++) {
      const c = fn(i);
      d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = c[3];
    }
    this.ovCtx.putImageData(this.ovImg, 0, 0);
    this.ovTex.magFilter = crisp ? THREE.NearestFilter : THREE.LinearFilter;
    this.ovTex.needsUpdate = true;
    this.overlayMesh.visible = true; this.overlayOn = true;
    // dim buildings a little so the overlay reads
    this.dimK = 0.6; this.applyTints();
  }
  clearOverlay() {
    this.overlayMesh.visible = false; this.overlayOn = false;
    this.dimK = 1; this.applyTints();
  }

  // ------------------------------------------------------------ problem icons above buildings
  makeIcons() {
    const mk = (emoji, bg) => {
      const c = document.createElement('canvas'); c.width = c.height = 96;
      const g = c.getContext('2d');
      g.fillStyle = bg; g.beginPath(); g.arc(48, 48, 44, 0, Math.PI * 2); g.fill();
      g.lineWidth = 5; g.strokeStyle = 'rgba(255,255,255,0.95)'; g.stroke();
      g.font = '52px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(emoji, 48, 54);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    };
    this.iconTex = { power: mk('⚡', '#d6452f'), water: mk('💧', '#2a6fd0'), fire: mk('🔥', '#e8590c'), abandoned: mk('🏚️', '#555a66'), sewage: mk('🚽', '#8a6a3a'), noroad: mk('🚧', '#c98a1a'), garbage: mk('🗑️', '#5a7a3a'), dead: mk('🪦', '#4a4a5a'), workers: mk('👷', '#3a6ab0'), ruin: mk('🧱', '#6a5a4a') };
    this.iconPool = [];
    this.iconGroup = new THREE.Group(); this.scene.add(this.iconGroup);
    for (let i = 0; i < 90; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.iconTex.power, depthTest: false, transparent: true, fog: false }));
      s.visible = false; s.renderOrder = 20; s.scale.set(0.8, 0.8, 1);
      this.iconGroup.add(s); this.iconPool.push(s);
    }
    this.iconTimer = 0;
  }
  updateIcons(dt) {
    this.iconTimer -= dt;
    if (this.iconTimer > 0) return;
    this.iconTimer = 0.5;
    const tgt = this.camTarget || { x: this.n / 2, z: this.n / 2 };
    const dist = this.camDist || 60;
    const show = dist < 95 && this.G.started;
    let k = 0;
    if (show) {
      const R2 = Math.pow(Math.max(24, dist * 1.1), 2);
      const list = [];
      for (const b of this.world.buildings.values()) {
        if (b.noBid) continue;
        const dx = b.x + b.w / 2 - tgt.x, dz = b.z + b.d / 2 - tgt.z;
        const d2 = dx * dx + dz * dz;
        if (d2 > R2) continue;
        let kind = null;
        if (b.state === 'burning') kind = 'fire';
        else if (b.state === 'abandoned') kind = 'abandoned';
        else if (b.state === 'ruin') kind = 'ruin';
        else if (b.state === 'ok') {
          const sim = this.G.sim, i = (b.z + (b.d >> 1)) * this.n + b.x + (b.w >> 1);
          if (sim && !(b.def && (b.def.power > 0 || b.key === 'lighthouse' || b.key === 'monument')) && sim.accessOf(b) < 0) kind = 'noroad';
          else if (!b.powered) kind = 'power'; else if (!b.watered) kind = 'water';
          else if (sim && b.kind === 'zone') {
            const S = sim.S;
            if (S.waste.backlog > 300 && sim.maps.waste[i] < 0.12 && hash2(b.id, 3) < 0.5) kind = 'garbage';
            else if (b.occ && S.death && S.death.backlog > 20 && sim.maps.death[i] < 0.1 && hash2(b.id, 5) < 0.35) kind = 'dead';
            else if (b.jobs > 8 && b.workers < b.jobs * 0.4 && S.pop > 200 && hash2(b.id, 7) < 0.5) kind = 'workers';
          }
        }
        if (kind) list.push([d2, kind, b]);
      }
      list.sort((a, c) => a[0] - c[0]);
      const sc = clamp(dist * 0.028, 0.55, 2.2);
      for (const [, kind, b] of list) {
        if (k >= this.iconPool.length) break;
        const s = this.iconPool[k++];
        s.material.map = this.iconTex[kind]; s.material.needsUpdate = true;
        s.position.set(b.x + b.w / 2, b.y0 + (b.hgt || 0.6) + 0.5 + sc * 0.3, b.z + b.d / 2);
        s.scale.set(sc, sc, 1); s.visible = true;
        s.userData.bob = b.id;
      }
    }
    for (; k < this.iconPool.length; k++) this.iconPool[k].visible = false;
  }

  // ------------------------------------------------------------ lighting / time
  setTime(tod) {
    this.tod = tod;
    const k = sampleSky(tod);
    const dayA = ((tod - 6) / 12) * Math.PI;
    let dir;
    if (tod >= 6 && tod <= 18) dir = new THREE.Vector3(-Math.cos(dayA) * 0.95, Math.sin(dayA) * 0.92 + 0.06, 0.42);
    else { const t2 = tod >= 18 ? tod - 18 : tod + 6; const a = (t2 / 12) * Math.PI; dir = new THREE.Vector3(-Math.cos(a) * 0.9, Math.sin(a) * 0.7 + 0.12, -0.3); }
    dir.normalize();
    this.sunDir.copy(dir);
    // overcast skies: desaturate towards grey and dim the sun
    const cl = this.wx.cloud, fl = this.wx.flash;
    if (cl > 0.01) {
      const g = (c, f) => { const l = c.r * 0.3 + c.g * 0.55 + c.b * 0.15; c.lerp(new THREE.Color(l * f, l * f * 1.02, l * f * 1.08), cl * 0.75); };
      g(k.zen, 0.85); g(k.hor, 0.95); g(k.fog, 0.95); g(k.hs, 1);
      k.sunI *= 1 - cl * 0.62; k.hi *= 1 - cl * 0.12;
    }
    const night = clamp(k.glow, 0, 1);
    this.nightK = night;
    this.sun.color.copy(k.sunC);
    this.sun.intensity = k.sunI;
    this.hemi.color.copy(k.hs); this.hemi.groundColor.copy(k.hg); this.hemi.intensity = k.hi + fl * 2.5;
    this.fog.color.copy(k.fog);
    this.scene.background = null;
    const u = this.skyMat.uniforms;
    u.uZenith.value.copy(k.zen); u.uHorizon.value.copy(k.hor); u.uSunDir.value.copy(dir); u.uSunCol.value.copy(k.sunC).multiplyScalar(1 - cl * 0.8); u.uNight.value = night * (1 - cl);
    const wu = this.waterMat.uniforms;
    wu.uSunDir.value.copy(dir); wu.uSunCol.value.copy(k.sunC).multiplyScalar(1 - cl * 0.7); wu.uSky.value.copy(k.hor).lerp(k.zen, 0.35); wu.uFog.value.copy(k.fog);
    wu.uLight.value = clamp(0.28 + k.hi * 0.55, 0.3, 1.2) * (1 - cl * 0.15);
    this.mat.emissiveIntensity = smoothstep(0.25, 0.85, Math.max(night, cl * 0.45)) * 1.1;
    this.matRoad.emissiveIntensity = this.mat.emissiveIntensity;
    this.matCar.emissiveIntensity = smoothstep(0.15, 0.7, Math.max(night, cl * 0.6)) * 1.4;
    this.renderer.toneMappingExposure = 0.95 + night * 0.35;
  }

  /** weather & season visuals; S = sim state */
  setWeather(S, dt) {
    const W = S.weather || { type: 'clear', snowCover: 0 };
    const def = WEATHER[W.type] || WEATHER.clear;
    const ease = 1 - Math.exp(-dt * 0.8);
    const wx = this.wx;
    const on = S.weatherOn !== false;
    wx.cloud = lerp(wx.cloud, on ? def.cloud : 0, ease);
    wx.rain = lerp(wx.rain, on ? def.rain : 0, ease);
    wx.fog = lerp(wx.fog, on ? def.fog : 0, ease);
    wx.snowFall = lerp(wx.snowFall || 0, on ? def.snow : 0, ease);
    this.uSnow.value = lerp(this.uSnow.value, on ? W.snowCover || 0 : 0, 1 - Math.exp(-dt * 0.5));
    this.waterMat.uniforms.uIce.value = this.uSnow.value * (W.temp !== undefined && W.temp < -2 ? 0.6 : 0.15);
    this.waterMat.uniforms.uRain.value = wx.rain * 1.5;
    // foliage through the year
    const yearT = ((S.month || 0) * 30 + (S.day || 1)) / 360;
    const ft = on ? foliageTint(yearT, S.climate) : [1, 1, 1, 0];
    this.uFoliage.value.set(ft[0], ft[1], ft[2], ft[3]);
    this.uGrass.value.set(lerp(ft[0], 0.62, 0.3), lerp(ft[1], 0.6, 0.3), lerp(ft[2], 0.3, 0.3), ft[3] * 0.45);
    // lightning
    wx.flash = Math.max(0, wx.flash - dt * 6);
    if (on && def.lightning && Math.random() < dt * 0.25) { wx.flash = 1; if (this.G.ui) this.G.ui.sfx('thunder'); }
    const tgt = this.camTarget || new THREE.Vector3(this.n / 2, 0, this.n / 2);
    this.precip.update(this.time, tgt, this.camDist || 60, wx.rain, wx.snowFall, this.fxMat.uniforms.uScale.value, this.nightK);
  }

  setQuality(q) {
    if (!QUALITY[q]) q = 'high';
    this.quality = q;
    const Q = this.Q = QUALITY[q];
    const r = this.renderer;
    r.shadowMap.enabled = Q.shadows > 0;
    r.shadowMap.type = Q.softShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    this.sun.castShadow = Q.shadows > 0;
    const sz = Q.shadows || 1024;
    if (this.sun.shadow.mapSize.x !== sz) { this.sun.shadow.mapSize.set(sz, sz); if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; } }
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.pixelRatio));
    if (this.treeMeshes) { for (const k in this.treeMeshes) this.treeMeshes[k].castShadow = q !== 'low'; if (this.world) this.world.dirty.trees = true; }
    this.resize();
    if (this.post) { const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight; this.post.setQuality(q, w, h); }
    // materials need recompilation when shadows toggle
    this.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.fxMat) this.fxMat.uniforms.uScale.value = (h * this.renderer.getPixelRatio()) / (2 * Math.tan((this.camera.fov * Math.PI / 180) / 2));
    if (this.post) this.post.resize(w, h);
  }

  // ------------------------------------------------------------ picking
  /** returns {x,z (tile), wx,wz, y} or null; uses water surface (y=0) for submerged terrain */
  pick(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, this.camera);
    const o = ray.ray.origin, d = ray.ray.direction;
    const w = this.world, n = this.n;
    const f = (t) => { const x = o.x + d.x * t, z = o.z + d.z * t; return o.y + d.y * t - Math.max(w.heightAt(x, z), 0); };
    let t = 0, prev = 0;
    const step = 0.5, maxT = 700;
    let hit = false;
    for (t = 0; t < maxT; t += step) {
      const x = o.x + d.x * t, z = o.z + d.z * t;
      if (x < -2 || z < -2 || x > n + 2 || z > n + 2) { if (t > 0 && (d.x * (n / 2 - o.x) + d.z * (n / 2 - o.z)) < 0) break; prev = t; continue; }
      if (f(t) <= 0) { hit = true; break; }
      prev = t;
    }
    if (!hit) return null;
    let a = prev, b = t;
    for (let k = 0; k < 10; k++) { const m = (a + b) / 2; if (f(m) > 0) a = m; else b = m; }
    const tt = (a + b) / 2;
    const wx = o.x + d.x * tt, wz = o.z + d.z * tt;
    if (wx < 0 || wz < 0 || wx >= n || wz >= n) return { x: Math.floor(wx), z: Math.floor(wz), wx, wz, inside: false, y: 0 };
    return { x: Math.floor(wx), z: Math.floor(wz), wx, wz, inside: true, y: Math.max(w.heightAt(wx, wz), 0) };
  }

  // ------------------------------------------------------------ frame
  frame(dt, simSpeed = 1) {
    this.time += dt;
    const w = this.world;
    if (w.dirty.terrain) this.updateTerrain(false);
    if (w.dirty.ground) { const d = w.dirty.ground; this.ground.paintRegion(d.x0, d.z0, d.x1, d.z1); w.dirty.ground = null; }
    if (this.ground.dirtyRect) this.ground.upload();
    if (w.dirty.roads) this.rebuildInfra();
    if (w.dirty.trees) this.rebuildTrees();
    this.flushChunks(8);
    this.waterMat.uniforms.uTime.value = this.time;
    if (this.wx.fog > 0.01) { this.fog.near *= 1 - this.wx.fog * 0.7; this.fog.far *= 1 - this.wx.fog * 0.6; }
    this.waterMat.uniforms.uFogNear.value = this.fog.near; this.waterMat.uniforms.uFogFar.value = this.fog.far;
    for (const [, m] of this.rotors) m.rotateZ(dt * m.userData.speed);
    const gs = this.G.sim ? [0, 1, 2, 3.5][this.G.sim.S.speed] || 0 : 0;
    for (const [, m] of this.wheels) m.rotateZ(dt * 0.25 * Math.max(0.3, gs));
    this.updateDisasters(dt);
    this.updateLabels(this.G.ui ? this.G.ui.showLabels() : false);
    for (const c of this.clouds) { c.position.x += dt * c.userData.v * 1.2; if (c.position.x > 300) c.position.x = -260; }
    this.cloudMat.opacity = Math.min(1, (0.8 + this.wx.cloud * 0.6) * (1 - this.nightK * 0.85));
    this.cloudMat.color.setScalar((1 - this.nightK * 0.7) * (1 - this.wx.cloud * 0.45));
    this.updateFX(dt, simSpeed);
    this.updateIcons(dt);
    for (const s of this.iconPool) if (s.visible) s.position.y += Math.sin(this.time * 3 + s.userData.bob) * 0.0025;
    this.sky.position.copy(this.camera.position);
    // shadow frustum follows the camera target
    const tgt = this.camTarget || new THREE.Vector3(this.n / 2, 0, this.n / 2);
    const dist = this.camDist || 60;
    const R = clamp(dist * 0.85 + 8, 18, 80);
    const sc = this.sun.shadow.camera;
    if (Math.abs(sc.right - R) > 0.5) { sc.left = sc.bottom = -R; sc.right = sc.top = R; sc.updateProjectionMatrix(); }
    this.sun.target.position.set(Math.round(tgt.x), 0, Math.round(tgt.z));
    this.sun.position.copy(this.sun.target.position).addScaledVector(this.sunDir, 150);
    this.sun.target.updateMatrixWorld();
    this.post.update(this.nightK, this.wx);
    this.post.render();
  }
}
