// Post-processing per graphics preset: ambient occlusion, bloom, MSAA and colour grading.
import * as THREE from '../lib/three.module.js';
import { EffectComposer } from '../lib/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../lib/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from '../lib/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from '../lib/jsm/postprocessing/OutputPass.js';
import { UnrealBloomPass } from '../lib/jsm/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from '../lib/jsm/postprocessing/GTAOPass.js';
import { clamp, lerp } from './util.js';

// Preset table. "low" renders straight to the canvas; the others go through the composer.
export const QUALITY = {
  low: { label: 'Low', desc: 'No shadows or effects. Fastest.', shadows: 0, softShadows: false, pixelRatio: 1, post: false, ao: false, bloom: false, msaa: 0, trees: 0.5, props: false, traffic: 0.6 },
  medium: { label: 'Medium', desc: 'Shadows, night bloom, anti-aliasing.', shadows: 2048, softShadows: false, pixelRatio: 1.25, post: true, ao: false, bloom: true, msaa: 4, trees: 0.8, props: true, traffic: 0.85 },
  high: { label: 'High', desc: 'Soft shadows, ambient occlusion, bloom, full resolution.', shadows: 4096, softShadows: true, pixelRatio: 2, post: true, ao: true, bloom: true, msaa: 4, trees: 1, props: true, traffic: 1 },
};

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uSat: { value: 1.08 }, uContrast: { value: 1.05 }, uVig: { value: 0.22 }, uTint: { value: new THREE.Color(1, 1, 1) }, uLift: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uSat; uniform float uContrast; uniform float uVig; uniform vec3 uTint; uniform float uLift;
    varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb * uTint;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, uSat);
      col = (col - 0.5) * uContrast + 0.5 + uLift;
      vec2 d = vUv - 0.5;
      col *= 1.0 - uVig * smoothstep(0.25, 0.85, dot(d, d) * 2.2);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a);
    }`,
};

/** GTAO at a reduced internal resolution (AO is low-frequency, so this costs little quality). */
class LiteGTAOPass extends GTAOPass {
  setSize(w, h) { super.setSize(Math.max(64, Math.round(w * this.k)), Math.max(64, Math.round(h * this.k))); }
  overrideVisibility() {
    const cache = this._visibilityCache;
    this.scene.traverse((o) => {
      cache.set(o, o.visible);
      if (o.isPoints || o.isLine || o.isSprite || o.userData.noAO) o.visible = false;
    });
  }
}

export class Post {
  constructor(renderer, scene, camera) {
    this.r = renderer; this.scene = scene; this.camera = camera;
    this.q = null; this.composer = null;
    this.night = 0;
  }

  setQuality(qid, w, h) {
    const Q = QUALITY[qid] || QUALITY.high;
    this.q = Q; this.qid = qid;
    this.dispose();
    if (!Q.post) return;
    const pr = this.r.getPixelRatio();
    const rt = new THREE.WebGLRenderTarget(Math.max(1, w * pr), Math.max(1, h * pr), { type: THREE.HalfFloatType, samples: Q.msaa });
    const comp = this.composer = new EffectComposer(this.r, rt);
    comp.setPixelRatio(pr);
    comp.setSize(w, h);
    comp.addPass(new RenderPass(this.scene, this.camera));
    if (Q.ao) {
      try {
        const ao = new LiteGTAOPass(this.scene, this.camera, w, h);
        ao.k = 0.75 / pr;
        ao.updateGtaoMaterial({ radius: 0.32, distanceExponent: 1.4, thickness: 1.2, scale: 1.15, samples: 12, distanceFallOff: 1 });
        ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
        ao.blendIntensity = 0.9;
        ao.setSize(w * pr, h * pr);
        comp.addPass(ao);
        this.ao = ao;
      } catch (e) { console.warn('AO unavailable', e); this.ao = null; }
    }
    if (Q.bloom) {
      const k = qid === 'high' ? 0.5 : 0.35;
      this.bloom = new UnrealBloomPass(new THREE.Vector2(w * k, h * k), 0.3, 0.55, 0.92);
      comp.addPass(this.bloom);
    }
    comp.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    comp.addPass(this.grade);
  }

  resize(w, h) {
    if (!this.composer) return;
    this.composer.setPixelRatio(this.r.getPixelRatio());
    this.composer.setSize(w, h);
  }

  /** night: 0 day .. 1 night; weather: {fog,rain,snow} */
  update(night, weather) {
    if (!this.composer) return;
    if (this.bloom) {
      this.bloom.strength = lerp(0.18, 0.95, night);
      this.bloom.threshold = lerp(0.95, 0.55, night);
      this.bloom.radius = lerp(0.4, 0.62, night);
    }
    if (this.ao) this.ao.blendIntensity = lerp(0.9, 0.55, night);
    if (this.grade) {
      const u = this.grade.uniforms;
      const wet = weather ? clamp(weather.rain + weather.fog * 0.6, 0, 1) : 0;
      u.uSat.value = lerp(1.03, 0.9, wet) - night * 0.05;
      u.uContrast.value = lerp(1.05, 0.98, wet);
      u.uVig.value = 0.2 + night * 0.12;
      u.uLift.value = (weather ? weather.snow : 0) * 0.02;
    }
  }

  render() {
    if (this.composer) this.composer.render();
    else this.r.render(this.scene, this.camera);
  }

  dispose() {
    if (this.composer) {
      for (const p of this.composer.passes) if (p.dispose) p.dispose();
      this.composer.renderTarget1.dispose(); this.composer.renderTarget2.dispose();
    }
    this.composer = null; this.ao = null; this.bloom = null; this.grade = null;
  }
}
