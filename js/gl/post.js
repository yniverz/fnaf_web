import * as THREE from '../vendor/three.module.js';
/* ---------------------------------------------------------------------------
 * post.js - single-pass post processing: tone mapping + security camera look.
 * ------------------------------------------------------------------------- */
const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const FRAG = `
precision highp float;
uniform sampler2D tDiffuse;
uniform sampler2D tBloom;
uniform vec2 res;
uniform float time, exposure, noiseAmt, burst, vignette, aberration, scanline, distortion, desat, brightness, interlace, tearing, bloom, rollbar, tint, signalLoss, flicker;
varying vec2 vUv;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
vec3 fetch(vec2 uv){ vec3 c = texture2D(tDiffuse, uv).rgb; return c; }
void main(){
  vec2 uv = vUv;
  vec2 c = uv - 0.5;
  float r2 = dot(c, c);
  uv = 0.5 + c * (1.0 + distortion * r2 * 2.0);
  // tearing: occasional horizontal bands shifted sideways
  float row = floor(uv.y * 36.0);
  float tr = hash(vec2(row, floor(time * 9.0)));
  float band = step(1.0 - tearing * 0.08, tr);
  uv.x += band * (hash(vec2(time * 3.0, row)) - 0.5) * 0.09 * tearing;
  // vertical roll jitter
  uv.y += (hash(vec2(floor(time * 24.0), 1.0)) - 0.5) * 0.004 * tearing;
  float ab = aberration * (0.6 + r2 * 3.0);
  vec3 col;
  col.r = fetch(uv + vec2(ab, 0.0)).r;
  col.g = fetch(uv).g;
  col.b = fetch(uv - vec2(ab, 0.0)).b;
  col += texture2D(tBloom, uv).rgb * bloom;
  col = aces(col * exposure * brightness * flicker);
  col = toSRGB(col);
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(l), desat);
  col = mix(col, col * vec3(0.86, 1.0, 1.08), tint);
  // sensor noise, heavier in the dark
  float n = hash(uv * res + fract(time * 7.13) * 100.0) - 0.5;
  col += n * noiseAmt * (1.4 - l);
  // signal static burst
  float st = hash(uv * res * 1.3 + fract(time * 3.7) * 60.0);
  col = mix(col, vec3(st), clamp(burst + signalLoss, 0.0, 1.0));
  // scanlines & interlacing
  float sl = 0.5 + 0.5 * sin(uv.y * res.y * 3.14159 * 0.5);
  col *= 1.0 - scanline * 0.35 * sl;
  float il = step(0.5, fract(uv.y * res.y * 0.25 + floor(time * 30.0) * 0.5));
  col *= 1.0 - interlace * 0.12 * il;
  // rolling bar
  float bar = 1.0 - abs(fract(uv.y * 0.6 - time * 0.07) * 2.0 - 1.0);
  col += rollbar * 0.035 * smoothstep(0.85, 1.0, bar);
  // vignette
  col *= 1.0 - vignette * smoothstep(0.25, 1.05, length(c) * 1.55);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) col = vec3(0.0);
  gl_FragColor = vec4(col, 1.0);
}`;

const BRIGHT_FRAG = `
precision highp float; uniform sampler2D tDiffuse; uniform float threshold; varying vec2 vUv;
void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; float l = dot(c, vec3(0.299, 0.587, 0.114)); float k = max(0.0, l - threshold); gl_FragColor = vec4(c * (k / max(l, 0.0001)), 1.0); }`;
const BLUR_FRAG = `
precision highp float; uniform sampler2D tDiffuse; uniform vec2 dir; varying vec2 vUv;
void main(){
  vec3 c = texture2D(tDiffuse, vUv).rgb * 0.2270270270;
  c += texture2D(tDiffuse, vUv + dir * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(tDiffuse, vUv - dir * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(tDiffuse, vUv + dir * 3.2307692308).rgb * 0.0702702703;
  c += texture2D(tDiffuse, vUv - dir * 3.2307692308).rgb * 0.0702702703;
  gl_FragColor = vec4(c, 1.0); }`;

export class Post {
  constructor(renderer, w, h) {
    this.renderer = renderer;
    const opts = { type: THREE.HalfFloatType, samples: 4, depthBuffer: true };
    this.rtHi = new THREE.WebGLRenderTarget(w, h, opts);
    this.rtLo = new THREE.WebGLRenderTarget(Math.round(w / 2), Math.round(h / 2), Object.assign({}, opts, { samples: 2 }));
    const bw = Math.round(w / 4), bh = Math.round(h / 4);
    const bopts = { type: THREE.HalfFloatType, depthBuffer: false };
    this.rtBright = new THREE.WebGLRenderTarget(bw, bh, bopts);
    this.rtBlurA = new THREE.WebGLRenderTarget(bw, bh, bopts);
    this.rtBlurB = new THREE.WebGLRenderTarget(bw, bh, bopts);
    this.brightMat = new THREE.ShaderMaterial({ uniforms: { tDiffuse: { value: null }, threshold: { value: 1.0 } }, vertexShader: VERT, fragmentShader: BRIGHT_FRAG, depthTest: false, depthWrite: false, toneMapped: false });
    this.blurMat = new THREE.ShaderMaterial({ uniforms: { tDiffuse: { value: null }, dir: { value: new THREE.Vector2(1 / bw, 0) } }, vertexShader: VERT, fragmentShader: BLUR_FRAG, depthTest: false, depthWrite: false, toneMapped: false });
    this.bw = bw; this.bh = bh;
    this.scene = new THREE.Scene();
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.uniforms = {
      tDiffuse: { value: null }, tBloom: { value: null }, res: { value: new THREE.Vector2(w, h) }, time: { value: 0 }, exposure: { value: 1 },
      noiseAmt: { value: 0.05 }, burst: { value: 0 }, vignette: { value: 0.6 }, aberration: { value: 0.0008 }, scanline: { value: 0 },
      distortion: { value: 0.02 }, desat: { value: 0.1 }, brightness: { value: 1 }, interlace: { value: 0 }, tearing: { value: 0 },
      bloom: { value: 1 }, bloomThreshold: { value: 1 }, rollbar: { value: 0 }, tint: { value: 0 }, signalLoss: { value: 0 }, flicker: { value: 1 },
    };
    this.mat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false, toneMapped: false });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }
  pass(mat, target) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, this.cam);
  }
  render(scene, camera, p) {
    const rt = p.low ? this.rtLo : this.rtHi;
    const r = this.renderer;
    r.setRenderTarget(rt);
    r.clear();
    r.render(scene, camera);
    // bloom chain
    this.brightMat.uniforms.tDiffuse.value = rt.texture;
    this.brightMat.uniforms.threshold.value = p.bloomThreshold === undefined ? 1.0 : p.bloomThreshold;
    this.pass(this.brightMat, this.rtBright);
    this.blurMat.uniforms.tDiffuse.value = this.rtBright.texture; this.blurMat.uniforms.dir.value.set(1 / this.bw, 0);
    this.pass(this.blurMat, this.rtBlurA);
    this.blurMat.uniforms.tDiffuse.value = this.rtBlurA.texture; this.blurMat.uniforms.dir.value.set(0, 1 / this.bh);
    this.pass(this.blurMat, this.rtBlurB);
    this.blurMat.uniforms.tDiffuse.value = this.rtBlurB.texture; this.blurMat.uniforms.dir.value.set(1 / this.bw, 0);
    this.pass(this.blurMat, this.rtBlurA);
    this.blurMat.uniforms.tDiffuse.value = this.rtBlurA.texture; this.blurMat.uniforms.dir.value.set(0, 1 / this.bh);
    this.pass(this.blurMat, this.rtBlurB);
    // final
    const u = this.uniforms;
    u.tDiffuse.value = rt.texture;
    u.tBloom.value = this.rtBlurB.texture;
    u.res.value.set(rt.width, rt.height);
    for (const k of Object.keys(p)) if (u[k] && k !== 'tDiffuse' && k !== 'res' && k !== 'tBloom') u[k].value = p[k];
    r.setRenderTarget(null);
    this.pass(this.mat, null);
  }
}

/* parameter presets */
export const PRESET = {
  office: { low: false, exposure: 1.3, noiseAmt: 0.05, burst: 0, vignette: 0.5, aberration: 0.0009, scanline: 0, distortion: 0.015, desat: 0.08, brightness: 1, interlace: 0, tearing: 0, bloom: 0.18, bloomThreshold: 1.4, rollbar: 0, tint: 0.1, signalLoss: 0, flicker: 1 },
  cam: { low: true, exposure: 2.6, noiseAmt: 0.085, burst: 0, vignette: 0.55, aberration: 0.003, scanline: 0.5, distortion: 0.08, desat: 0.5, brightness: 1.1, interlace: 0.8, tearing: 0.3, bloom: 0.5, bloomThreshold: 0.8, rollbar: 1, tint: 0.8, signalLoss: 0, flicker: 1 },
  scare: { low: false, exposure: 1.2, noiseAmt: 0.12, burst: 0, vignette: 0.6, aberration: 0.004, scanline: 0.2, distortion: 0.03, desat: 0.15, brightness: 1, interlace: 0.4, tearing: 0.5, bloom: 0.5, bloomThreshold: 1.0, rollbar: 0, tint: 0.2, signalLoss: 0, flicker: 1 },
  clean: { low: false, exposure: 1.2, noiseAmt: 0.0, burst: 0, vignette: 0.0, aberration: 0, scanline: 0, distortion: 0, desat: 0, brightness: 1, interlace: 0, tearing: 0, bloom: 0.3, bloomThreshold: 1.0, rollbar: 0, tint: 0, signalLoss: 0, flicker: 1 },
};
