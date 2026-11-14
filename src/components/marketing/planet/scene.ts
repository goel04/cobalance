/**
 * Fixed full-viewport WebGL planet (three r0.143).
 * GLTF Earth with a day/night/city-lights/ocean-glint/rim shader, atmosphere halo, three cloud shells,
 * ambient motes, a twinkling starfield and golden land markers, composited through bloom + a corner-flame
 * final pass. Scroll position drives the planet's position/scale/rotation.
 *
 * `createPlanetScene(canvas)` returns a dispose function (safe to call once; used on route change / unmount).
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { GammaCorrectionShader } from 'three/examples/jsm/shaders/GammaCorrectionShader.js';
import { CopyShader } from 'three/examples/jsm/shaders/CopyShader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ── Assets ────────────────────────────────────────────────────────────────
const ASSET_BASE_URL = 'https://api.getlayers.ai/storage/v1/object/public/public/assets/ascend-d9857ad1f2';
const PLANET_GLB = `${ASSET_BASE_URL}/planet.glb`;
const PLANET_LIGHTS_GLB = `${ASSET_BASE_URL}/planet-lights.glb`;
const PLANET_CLOUDS_PNG = `${ASSET_BASE_URL}/planet-clouds.png`;
const DRACO_DECODER_PATH = 'https://www.gstatic.com/draco/versioned/decoders/1.5.5/';

// ── Config ────────────────────────────────────────────────────────────────
const CONFIG = {
  rimColor: '#c1faff', rimPower: 2.4, nightLights: 10, terrainDepth: 0.33, terrainShade: 1.3,
  oceanGlint: 0.45, oceanDeep: 0.12, oceanFlow: 3, oceanFlowSpeed: 0.8, oceanFlowScale: 2.1,
  glowColor: '#3a6cff', glowIntensity: 3.35, planetRadius: 1.95, spin: 0.03, initRotation: 2.07,
  tilt: 0.37, autoRotate: 0,
  cloud1Height: 1.005, cloud1Opacity: 0.6, cloud1Spin: 0.06,
  cloud2Height: 1.03, cloud2Opacity: 0.5, cloud2Spin: 0.14,
  cloud3Height: 1.075, cloud3Opacity: 0.5, cloud3Spin: 0.1,
  bgColor: '#040a1e', flameColor: '#3a6cff', flameColor2: '#c1faff', flameAmt: 0.15,
  atmoColor: '#9fc4ff', atmoCount: 320, atmoSize: 22, atmoSpeed: 0.8,
  starColor: '#cfe0ff', starCount: 1400, starSize: 1.6, starFlicker: 1,
  markerColor: '#ffd27a', markerCount: 60, markerSize: 16, markerSpeed: 0.5,
} as const;
const LAYERS = { NONE: 0, TORUS_SCENE: 1, BLOOM_SCENE: 2, ENTIRE_SCENE: 3 };

// Scroll keyframes: huge & low at the top → zoom out, swing left → right → settle near the CTA.
type Stop = { p: number; v: number };
const STOPS_X: Stop[] = [{ p: 0, v: 0 }, { p: 0.32, v: -3.1 }, { p: 0.64, v: 3.2 }, { p: 1, v: 0 }];
const STOPS_Y: Stop[] = [{ p: 0, v: -4.5 }, { p: 0.32, v: 0.55 }, { p: 0.64, v: 0.45 }, { p: 1, v: 0.15 }];
const STOPS_S: Stop[] = [{ p: 0, v: 2.15 }, { p: 0.32, v: 1.0 }, { p: 0.64, v: 0.92 }, { p: 1, v: 1.12 }];
const ENTRY_DUR = 1.9;
const ENTRY_START_Y = -6.5;

// ── Helpers ───────────────────────────────────────────────────────────────
const Lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const hexToVec3 = (hex: string) => {
  const c = new THREE.Color(hex);
  return new THREE.Vector3(c.r, c.g, c.b);
};
function sample(stops: Stop[], p: number) {
  if (p <= stops[0].p) return stops[0].v;
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (p <= b.p) {
      const t = (p - a.p) / (b.p - a.p);
      return Lerp(a.v, b.v, t * t * (3 - 2 * t));
    }
  }
  return stops[stops.length - 1].v;
}

// ── Shared simplex noise ──────────────────────────────────────────────────
const SNOISE = /* glsl */ `
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0); const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + 1.0 * C.xxx; vec3 x2 = x0 - i2 + 2.0 * C.xxx; vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0/7.0; vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
  vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ *ns.x + ns.yyyy; vec4 y = y_ *ns.x + ns.yyyy; vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0; vec4 s1 = floor(b1)*2.0 + 1.0; vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy,h.x); vec3 p1 = vec3(a0.zw,h.y); vec3 p2 = vec3(a1.xy,h.z); vec3 p3 = vec3(a1.zw,h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0); m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
`;

// ── Final composite pass: background + corner flame + composer textures ──
const FinalPass = {
  uniforms: {
    iTime: { value: 0 }, tDiffuse: { value: null }, torusTexture: { value: null }, bloomTexture: { value: null }, haloTexture: { value: null },
    uBg: { value: hexToVec3(CONFIG.bgColor) }, uFlameA: { value: hexToVec3(CONFIG.flameColor) },
    uFlameB: { value: hexToVec3(CONFIG.flameColor2) }, uFlameAmt: { value: CONFIG.flameAmt },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }`,
  fragmentShader: `
    uniform float iTime; uniform sampler2D tDiffuse; uniform sampler2D bloomTexture; uniform sampler2D torusTexture; uniform sampler2D haloTexture;
    uniform vec3 uBg; uniform vec3 uFlameA; uniform vec3 uFlameB; uniform float uFlameAmt;
    varying vec2 vUv;
    vec3 warp3d(vec3 pos, float t){ float curv=.8,a=1.9,b=0.7; pos*=2.;
      pos.x+=curv*sin(t+a*pos.y)+t*b; pos.y+=curv*cos(t+a*pos.x);
      pos.y+=curv*sin(t+a*pos.z)+t*b; pos.z+=curv*cos(t+a*pos.y);
      pos.z+=curv*sin(t+a*pos.x)+t*b; pos.x+=curv*cos(t+a*pos.z);
      return 0.5+0.5*cos(pos.xyz+vec3(1,2,4)); }
    void main(){
      vec2 uv = 2.*vUv - 1.;
      vec3 w = pow(warp3d(vec3(uv.x, sin(uv.y), uv.y), iTime*1.5), vec3(1.5));
      vec3 flame = 1.5*uFlameA*w.x; flame*=w.y; flame += uFlameB*w.z;
      flame *= smoothstep(0.25, 1., abs(uv.y));
      float md = smoothstep(-0.7, 1., -uv.y*uv.x); flame *= md*md;
      vec3 bg = uBg * (1.0 - 0.4 * length(uv));
      vec3 halo = texture2D(haloTexture, vUv).xyz;
      gl_FragColor = vec4(bg + flame*uFlameAmt + texture2D(bloomTexture, vUv).xyz + texture2D(torusTexture, vUv).xyz + texture2D(tDiffuse, vUv).xyz + halo, 1.);
    }`,
};

// ── Planet surface shader injection ───────────────────────────────────────
const PLANET_FRAGMENT_INJECT = /* glsl */ `
#include <dithering_fragment>
vec3 normalizedNormal = normalize(vNormal);
vec3 viewDir = normalize(vViewPosition);
float rim = 1.0 - max(dot(viewDir, normalizedNormal), 0.0);
rim = pow(rim, rimPower); rim = pow(rim, 1.5); rim *= 0.7;
vec3 currentColor = gl_FragColor.rgb;
float blueDom = currentColor.b - max(currentColor.r, currentColor.g);
float waterMask = clamp(smoothstep(-0.005, 0.03, blueDom), 0.0, 1.0);
float shimmer = snoise(vec3(vCustomUv.x * noiseScale + time * speedX, vCustomUv.y * noiseScale - time * speedY, time * speedZ));
gl_FragColor.rgb += waterMask * shimmer * 0.025;
float fT = time * oceanFlowSpeed * 4.0;
float fS = 4.0 * oceanFlowScale;
float warp = snoise(vec3(vCustomUv.x * fS - fT * 0.5, vCustomUv.y * fS + fT * 0.4, fT * 0.5));
float flow = snoise(vec3(vCustomUv.x * fS * 2.0 + fT * 0.6 + warp, vCustomUv.y * fS * 2.0 - fT * 0.5, fT * 0.7));
flow = warp * 0.6 + flow * 0.4;
gl_FragColor.rgb += waterMask * flow * 0.12 * oceanFlow;
gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.01, 0.06, 0.16), waterMask * oceanDeep);
vec3 finalColor = mix(gl_FragColor.rgb, rimColor, rim);
gl_FragColor = vec4(finalColor, 1.0);
vec3 surfPos = -vViewPosition;
float terrH = dot(texture2D(map, vCustomUv).rgb, vec3(0.299, 0.587, 0.114));
vec3 sigX = dFdx(surfPos), sigY = dFdy(surfPos);
vec3 vR1 = cross(sigY, normalizedNormal), vR2 = cross(normalizedNormal, sigX);
float fDet = dot(sigX, vR1);
vec3 vGrad = sign(fDet) * (dFdx(terrH) * vR1 + dFdy(terrH) * vR2);
vec3 bumpedNormal = normalize(abs(fDet) * normalizedNormal - terrainDepth * vGrad);
vec3 shadeNormal = mix(bumpedNormal, normalizedNormal, waterMask);
vec3 cityLights = texture2D(nightBlendTexture, vCustomUv).rgb * gl_FragColor.rgb * nightLights;
vec3 viewSunDir = normalize(vec3(-0.9, 0.18, 0.4));
float ndl = dot(normalizedNormal, viewSunDir);
float dayAmt = smoothstep(-0.05, 0.35, ndl);
float relief = dot(shadeNormal, viewSunDir) - ndl;
gl_FragColor.rgb *= clamp(1.0 + relief * terrainShade * dayAmt, 0.55, 1.6);
float nightFactor  = smoothstep(0.18, -0.30, ndl);
float lightsFactor = smoothstep(0.30, -0.35, ndl);
gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * 0.08, nightFactor);
gl_FragColor.rgb += cityLights * lightsFactor;
vec3 halfDir = normalize(viewSunDir + viewDir);
float ripple = snoise(vec3(vCustomUv * 240.0, time * 4.0));
float ndh = max(dot(normalizedNormal, halfDir) + ripple * 0.02, 0.0);
float glint = pow(ndh, 140.0);
gl_FragColor.rgb += glint * waterMask * dayAmt * oceanGlint * vec3(1.0, 0.97, 0.88);
`;

const CLOUD_FRAGMENT_INJECT = /* glsl */ `
#include <dithering_fragment>
gl_FragColor.rgb = vec3(1.0);
float cloudNoise = snoise(vec3(vCloudUv.x * noiseScale + uTime * uSpeedX + uPhase, vCloudUv.y * noiseScale - uTime * uSpeedY + uPhase, uTime * uSpeedZ + uPhase));
float cloudNdv = max(dot(normalize(vNormal), normalize(vViewPosition)), 0.0);
float cloudEdge = pow(1.0 - cloudNdv, 3.0);
float cloudMod = mix(cloudNoise, 1.0, cloudEdge);
float cloudNdl = dot(normalize(vNormal), normalize(vec3(-0.9, 0.18, 0.4)));
float cloudDay = 1.0 - smoothstep(0.30, -0.30, cloudNdl) * 0.9;
gl_FragColor.a *= cloudMod * uOpacity * cloudDay;
`;

// ── Land-marker sampling: area-weighted points on land (not ocean) ────────
function attrGet(attr: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, i: number, c: 0 | 1 | 2) {
  const v = c === 0 ? attr.getX(i) : c === 1 ? attr.getY(i) : attr.getZ(i);
  if (!attr.normalized) return v;
  const arr = (attr as THREE.BufferAttribute).array;
  if (arr instanceof Uint16Array) return v / 65535;
  if (arr instanceof Uint8Array) return v / 255;
  if (arr instanceof Int16Array) return Math.max(v / 32767, -1);
  if (arr instanceof Int8Array) return Math.max(v / 127, -1);
  return v;
}

function sampleLandPoints(mesh: THREE.Mesh, count: number) {
  const geo = mesh.geometry;
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const map = (mesh.material as THREE.MeshStandardMaterial).map;
  const img = map?.image as (CanvasImageSource & { width: number; height: number }) | undefined;
  if (!pos || !uv || !img || !img.width) return null;

  const scale = Math.min(1, 1024 / img.width);
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const cvs = document.createElement('canvas');
  cvs.width = w;
  cvs.height = h;
  const ctx = cvs.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;

  const index = geo.index;
  const triCount = index ? index.count / 3 : pos.count / 3;
  const vi = (t: number, k: number) => (index ? index.getX(t * 3 + k) : t * 3 + k);
  const cum = new Float64Array(triCount);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  let total = 0;
  for (let t = 0; t < triCount; t++) {
    a.fromBufferAttribute(pos, vi(t, 0));
    b.fromBufferAttribute(pos, vi(t, 1));
    c.fromBufferAttribute(pos, vi(t, 2));
    total += b.sub(a).cross(c.sub(a)).length() * 0.5;
    cum[t] = total;
  }
  if (total <= 0) return null;

  const positions: number[] = [];
  const seeds: number[] = [];
  const p = new THREE.Vector3();
  for (let attempt = 0; attempt < count * 80 && seeds.length < count; attempt++) {
    const r = Math.random() * total;
    let lo = 0;
    let hi = triCount - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    let r1 = Math.random();
    let r2 = Math.random();
    if (r1 + r2 > 1) {
      r1 = 1 - r1;
      r2 = 1 - r2;
    }
    const w0 = 1 - r1 - r2;
    const i0 = vi(lo, 0);
    const i1 = vi(lo, 1);
    const i2 = vi(lo, 2);
    let u = w0 * attrGet(uv, i0, 0) + r1 * attrGet(uv, i1, 0) + r2 * attrGet(uv, i2, 0);
    let v = w0 * attrGet(uv, i0, 1) + r1 * attrGet(uv, i1, 1) + r2 * attrGet(uv, i2, 1);
    u = u - Math.floor(u);
    v = v - Math.floor(v);
    // GLTF textures are not flipped (flipY = false): uv (0,0) is the image's top-left.
    const ix = Math.min(w - 1, Math.floor(u * w));
    const iy = Math.min(h - 1, Math.floor((map!.flipY ? 1 - v : v) * h));
    const o = (iy * w + ix) * 4;
    const cr = px[o];
    const cg = px[o + 1];
    const cb = px[o + 2];
    if (cb > cr + 6 && cb > cg + 6) continue; // ocean
    p.set(0, 0, 0)
      .addScaledVector(a.fromBufferAttribute(pos, i0), w0)
      .addScaledVector(b.fromBufferAttribute(pos, i1), r1)
      .addScaledVector(c.fromBufferAttribute(pos, i2), r2)
      .multiplyScalar(1.012);
    positions.push(p.x, p.y, p.z);
    seeds.push(Math.random());
  }
  return { positions: new Float32Array(positions), seeds: new Float32Array(seeds) };
}

// ── Scene ─────────────────────────────────────────────────────────────────
export function createPlanetScene(canvas: HTMLCanvasElement, opts: { reducedMotion?: boolean } = {}) {
  const reducedMotion = !!opts.reducedMotion;
  let disposed = false;

  const renderer = new THREE.WebGL1Renderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 0, 8);
  camera.layers.enable(LAYERS.TORUS_SCENE);
  camera.layers.enable(LAYERS.BLOOM_SCENE);
  camera.layers.enable(LAYERS.ENTIRE_SCENE);
  scene.add(camera);

  // Lights must be visible in every pass that renders lit materials (layers are tested for lights too).
  const ambient = new THREE.AmbientLight(0xffffff, 1.8);
  const sun = new THREE.DirectionalLight(0xffffff, 0.8);
  sun.position.set(0, 10, 2);
  for (const l of [ambient, sun]) {
    l.layers.enable(LAYERS.ENTIRE_SCENE);
    l.layers.enable(LAYERS.TORUS_SCENE);
    l.layers.enable(LAYERS.BLOOM_SCENE);
    scene.add(l);
  }

  const onLayer = (obj: THREE.Object3D, layer: number) => obj.layers.set(layer);

  // Composers
  const size = () => new THREE.Vector2(window.innerWidth, window.innerHeight);
  const torusComposer = new EffectComposer(renderer);
  torusComposer.renderToScreen = false;
  torusComposer.addPass(new RenderPass(scene, camera));
  torusComposer.addPass(new ShaderPass(GammaCorrectionShader));
  torusComposer.addPass(new UnrealBloomPass(size(), 0.22, 0.2, 0));
  torusComposer.addPass(new ShaderPass(CopyShader));

  const bloomComposer = new EffectComposer(renderer);
  bloomComposer.renderToScreen = false;
  bloomComposer.addPass(new RenderPass(scene, camera));
  bloomComposer.addPass(new UnrealBloomPass(size(), 0.5, 0.6, 0));
  bloomComposer.addPass(new ShaderPass(GammaCorrectionShader));

  const finalComposer = new EffectComposer(renderer);
  finalComposer.addPass(new RenderPass(scene, camera));
  const finalPass = new ShaderPass(FinalPass);
  // Set after construction: ShaderPass clones its uniforms.
  finalPass.uniforms.bloomTexture.value = bloomComposer.renderTarget1.texture;
  finalPass.uniforms.torusTexture.value = torusComposer.renderTarget1.texture;
  finalComposer.addPass(finalPass);
  const composers = [torusComposer, bloomComposer, finalComposer];

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.enabled = false;
  controls.autoRotate = true;
  controls.autoRotateSpeed = CONFIG.autoRotate;
  controls.minDistance = 3.5;
  controls.maxDistance = 16;
  controls.target.set(0, 0, 0);

  const resUniform = () => new THREE.Vector2(window.innerWidth * renderer.getPixelRatio(), window.innerHeight * renderer.getPixelRatio());

  // Hierarchy
  const worldGroup = new THREE.Group();
  worldGroup.position.set(STOPS_X[0].v, STOPS_Y[0].v, 0);
  worldGroup.scale.setScalar(STOPS_S[0].v);
  scene.add(worldGroup);

  const planetGroup = new THREE.Group();
  planetGroup.rotation.z = CONFIG.tilt;
  worldGroup.add(planetGroup);

  const cloudGroup = new THREE.Group();
  cloudGroup.rotation.z = CONFIG.tilt;
  cloudGroup.visible = false;
  worldGroup.add(cloudGroup);

  // Atmosphere halo (additive billboard)
  const glowMat = new THREE.ShaderMaterial({
    uniforms: { uGlow: { value: hexToVec3(CONFIG.glowColor) }, uIntensity: { value: CONFIG.glowIntensity } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 uGlow; uniform float uIntensity; varying vec2 vUv;
      void main(){
        float d = length(vUv - 0.5) * 2.0;
        float a = pow(clamp(1.0 - d, 0.0, 1.0), 2.2);
        gl_FragColor = vec4(uGlow * a * uIntensity, a);
      }`,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const glowMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), glowMat);
  glowMesh.scale.setScalar(CONFIG.planetRadius * 2.3);
  onLayer(glowMesh, LAYERS.TORUS_SCENE);
  worldGroup.add(glowMesh);

  // Shared clocks
  const planetTime = { value: 0 };
  const cloudTime = { value: 0 };
  let starTime = 0;
  let markerTime = 0;

  // Ambient motes
  const atmoGeo = new THREE.BufferGeometry();
  {
    const n = CONFIG.atmoCount;
    const p = new Float32Array(n * 3);
    const s = new Float32Array(n);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      p[i * 3] = Math.random() * 2 - 1;
      p[i * 3 + 1] = Math.random() * 2 - 1;
      p[i * 3 + 2] = Math.random() * 2 - 1;
      s[i] = CONFIG.atmoSize * (0.4 + Math.random());
      seed[i] = Math.random();
    }
    atmoGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    atmoGeo.setAttribute('size', new THREE.BufferAttribute(s, 1));
    atmoGeo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  }
  const atmoMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uRes: { value: resUniform() }, uColor: { value: hexToVec3(CONFIG.atmoColor) } },
    vertexShader: `
      attribute float size; attribute float seed; uniform float uTime; uniform vec2 uRes;
      varying float vA;
      vec3 warp(vec3 p, float t){ float c=0.9,a=1.9,b=0.02,s=0.05; p*=2.;
        p.x+=c*sin(s*t+a*p.y)+t*b; p.y+=c*cos(s*t+a*p.x); p.y+=c*sin(s*t+a*p.z)+t*b;
        p.z+=c*cos(s*t+a*p.y); p.z+=c*sin(s*t+a*p.x)+t*b; p.x+=c*cos(s*t+a*p.z);
        return cos(p+vec3(1,2,4)); }
      void main(){
        vec3 v = position*4.0 + warp(position, uTime)*1.2;
        vec4 mv = modelViewMatrix * vec4(v, 1.0);
        float r = length(v); float farF = 1.0 - smoothstep(5.0, 6.5, r); float nearF = smoothstep(0.0, 0.5, -mv.z);
        vA = farF * nearF;
        gl_PointSize = size * uRes.y / 900.0 / -mv.z; gl_PointSize = max(gl_PointSize, 1.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor; varying float vA;
      void main(){ vec2 p = gl_PointCoord - 0.5; float l = length(p); if (l > 0.5) discard;
        float tex = smoothstep(0.5, 0.0, l); gl_FragColor = vec4(uColor * tex, tex * vA * 0.55); }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  });
  const atmo = new THREE.Points(atmoGeo, atmoMat);
  atmo.frustumCulled = false;
  onLayer(atmo, LAYERS.BLOOM_SCENE);
  atmo.onBeforeRender = () => {
    const t = (performance.now() / 1000) * CONFIG.atmoSpeed * 8;
    atmoMat.uniforms.uTime.value = t;
    atmo.position.copy(camera.position);
    atmo.updateMatrixWorld();
    finalPass.uniforms.iTime.value = t;
  };
  scene.add(atmo);

  // Starfield
  const starGeo = new THREE.BufferGeometry();
  {
    const n = CONFIG.starCount;
    const p = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    const bright = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1;
      const th = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      p[i * 3] = 90 * r * Math.cos(th);
      p[i * 3 + 1] = 90 * r * Math.sin(th);
      p[i * 3 + 2] = 90 * u;
      seed[i] = Math.random() * Math.PI * 2;
      bright[i] = 0.35 + Math.random() * 0.65;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    starGeo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    starGeo.setAttribute('bright', new THREE.BufferAttribute(bright, 1));
  }
  const starMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uSize: { value: CONFIG.starSize }, uFlicker: { value: CONFIG.starFlicker },
      uColor: { value: hexToVec3(CONFIG.starColor) }, uRes: { value: resUniform() },
    },
    vertexShader: `
      attribute float seed; attribute float bright;
      uniform float uTime; uniform float uSize; uniform float uFlicker; uniform vec2 uRes;
      varying float vTw;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float tw = 0.6 + 0.4 * sin(uTime * uFlicker + seed);
        vTw = bright * tw;
        gl_PointSize = max(uSize * uRes.y / 900.0 * (90.0 / max(-mv.z, 1.0)), 1.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor; varying float vTw;
      void main(){
        vec2 p = gl_PointCoord - 0.5; float l = length(p); if (l > 0.5) discard;
        float core = smoothstep(0.5, 0.0, l);
        gl_FragColor = vec4(uColor, core * vTw);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false;
  onLayer(stars, LAYERS.TORUS_SCENE);
  scene.add(stars);

  // Markers (built once the planet loads)
  let markerMat: THREE.ShaderMaterial | null = null;

  // Cloud shells
  const cloudMats: THREE.MeshStandardMaterial[] = [];
  const cloudMeshes: { mesh: THREE.Mesh; spin: number }[] = [];
  const texLoader = new THREE.TextureLoader();
  texLoader.setCrossOrigin('anonymous');
  const cloudTex = texLoader.load(PLANET_CLOUDS_PNG);
  cloudTex.wrapS = cloudTex.wrapT = THREE.RepeatWrapping;
  cloudTex.repeat.set(5, 5);
  const LAYERS_DEF = [
    { h: CONFIG.cloud1Height, o: CONFIG.cloud1Opacity, s: CONFIG.cloud1Spin, ry: 0.0, phase: 0.0 },
    { h: CONFIG.cloud2Height, o: CONFIG.cloud2Opacity, s: CONFIG.cloud2Spin, ry: 2.2, phase: 13.0 },
    { h: CONFIG.cloud3Height, o: CONFIG.cloud3Opacity, s: CONFIG.cloud3Spin, ry: 4.3, phase: 27.0 },
  ];
  for (const layer of LAYERS_DEF) {
    const mat = new THREE.MeshStandardMaterial({ map: cloudTex, transparent: true, depthWrite: false });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = cloudTime;
      shader.uniforms.noiseScale = { value: 20 };
      shader.uniforms.uSpeedX = { value: 1 };
      shader.uniforms.uSpeedY = { value: 2 };
      shader.uniforms.uSpeedZ = { value: 2 };
      shader.uniforms.uOpacity = { value: layer.o };
      shader.uniforms.uPhase = { value: layer.phase };
      shader.vertexShader = 'varying vec2 vCloudUv;\n' + shader.vertexShader.replace('void main() {', 'void main() {\n  vCloudUv = uv;');
      shader.fragmentShader =
        'uniform float uTime; uniform float noiseScale; uniform float uSpeedX; uniform float uSpeedY; uniform float uSpeedZ; uniform float uOpacity; uniform float uPhase;\nvarying vec2 vCloudUv;\n' +
        SNOISE +
        shader.fragmentShader.replace('#include <dithering_fragment>', CLOUD_FRAGMENT_INJECT);
    };
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(CONFIG.planetRadius * layer.h, 64, 64), mat);
    mesh.rotation.y = layer.ry;
    mesh.renderOrder = 2;
    onLayer(mesh, LAYERS.TORUS_SCENE);
    cloudGroup.add(mesh);
    cloudMats.push(mat);
    cloudMeshes.push({ mesh, spin: layer.s });
  }

  // Planet
  let planetLoaded = false;
  let entryT = reducedMotion ? ENTRY_DUR : 0;
  const draco = new DRACOLoader();
  draco.setDecoderPath(DRACO_DECODER_PATH);
  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(draco);

  const firstMesh = (root: THREE.Object3D) => {
    let found: THREE.Mesh | null = null;
    root.traverse((o) => {
      if (!found && (o as THREE.Mesh).isMesh) found = o as THREE.Mesh;
    });
    return found as THREE.Mesh | null;
  };

  gltfLoader.load(
    PLANET_LIGHTS_GLB,
    (lightsGltf) => {
      if (disposed) return;
      const lightsMesh = firstMesh(lightsGltf.scene);
      const nightTex = (lightsMesh?.material as THREE.MeshStandardMaterial | undefined)?.map ?? null;
      gltfLoader.load(
        PLANET_GLB,
        (gltf) => {
          if (disposed) return;
          const mesh = firstMesh(gltf.scene);
          if (!mesh) return;
          mesh.removeFromParent();
          mesh.position.set(0, 0, 0);
          mesh.rotation.set(0, 0, 0);
          mesh.geometry.computeBoundingSphere();
          const r = mesh.geometry.boundingSphere?.radius || 1;
          mesh.scale.setScalar(CONFIG.planetRadius / r);

          const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
          mat.metalness = 0;
          mat.roughness = 1;
          mat.envMapIntensity = 0;
          // dFdx/dFdy need OES_standard_derivatives under WebGL1.
          (mat as unknown as { extensions: { derivatives: boolean } }).extensions = { derivatives: true };
          mat.onBeforeCompile = (shader) => {
            shader.uniforms.time = planetTime;
            shader.uniforms.noiseScale = { value: 30 };
            shader.uniforms.speedX = { value: 1.5 };
            shader.uniforms.speedY = { value: 2.0 };
            shader.uniforms.speedZ = { value: 2.5 };
            shader.uniforms.rimColor = { value: hexToVec3(CONFIG.rimColor) };
            shader.uniforms.rimPower = { value: CONFIG.rimPower };
            shader.uniforms.nightBlendTexture = { value: nightTex };
            shader.uniforms.nightLights = { value: CONFIG.nightLights };
            shader.uniforms.terrainDepth = { value: CONFIG.terrainDepth };
            shader.uniforms.terrainShade = { value: CONFIG.terrainShade };
            shader.uniforms.oceanGlint = { value: CONFIG.oceanGlint };
            shader.uniforms.oceanDeep = { value: CONFIG.oceanDeep };
            shader.uniforms.oceanFlow = { value: CONFIG.oceanFlow };
            shader.uniforms.oceanFlowSpeed = { value: CONFIG.oceanFlowSpeed };
            shader.uniforms.oceanFlowScale = { value: CONFIG.oceanFlowScale };
            shader.vertexShader = 'varying vec2 vCustomUv;\n' + shader.vertexShader.replace('void main() {', 'void main() {\n  vCustomUv = uv;');
            shader.fragmentShader =
              [
                'uniform float time; uniform float noiseScale; uniform float speedX; uniform float speedY; uniform float speedZ;',
                'uniform vec3 rimColor; uniform float rimPower; uniform sampler2D nightBlendTexture; uniform float nightLights;',
                'uniform float terrainDepth; uniform float terrainShade; uniform float oceanGlint; uniform float oceanDeep;',
                'uniform float oceanFlow; uniform float oceanFlowSpeed; uniform float oceanFlowScale;',
                'varying vec2 vCustomUv;',
              ].join('\n') +
              '\n' +
              SNOISE +
              shader.fragmentShader.replace('#include <dithering_fragment>', PLANET_FRAGMENT_INJECT);
          };
          mesh.material = mat;
          onLayer(mesh, LAYERS.TORUS_SCENE);
          planetGroup.add(mesh);

          // Golden land markers
          try {
            const pts = sampleLandPoints(mesh, CONFIG.markerCount);
            if (pts && pts.seeds.length) {
              const g = new THREE.BufferGeometry();
              g.setAttribute('position', new THREE.BufferAttribute(pts.positions, 3));
              g.setAttribute('seed', new THREE.BufferAttribute(pts.seeds, 1));
              markerMat = new THREE.ShaderMaterial({
                uniforms: {
                  uTime: { value: 0 }, uColor: { value: hexToVec3(CONFIG.markerColor) }, uSize: { value: CONFIG.markerSize },
                  uSpeed: { value: CONFIG.markerSpeed }, uRes: { value: resUniform() },
                },
                vertexShader: `
                  attribute float seed; uniform float uSize; uniform vec2 uRes;
                  varying float vSeed; varying float vFade;
                  void main(){
                    vSeed = seed;
                    vec4 mv = modelViewMatrix * vec4(position, 1.0);
                    vec3 vn = normalize(normalMatrix * normalize(position));
                    vec3 vd = normalize(-mv.xyz);
                    vFade = smoothstep(0.15, 0.5, dot(vn, vd));
                    gl_PointSize = max(uSize * uRes.y / 900.0 * (7.0 / max(-mv.z, 1.0)), 2.0);
                    gl_Position = projectionMatrix * mv;
                  }`,
                fragmentShader: `
                  uniform vec3 uColor; uniform float uTime; uniform float uSpeed;
                  varying float vSeed; varying float vFade;
                  void main(){
                    if (vFade <= 0.001) discard;
                    vec2 p = gl_PointCoord - 0.5;
                    float d = length(p) * 2.0;
                    if (d > 1.0) discard;
                    float core = smoothstep(0.30, 0.0, d) * 1.2;
                    float ph = fract(uTime * uSpeed + vSeed);
                    float ring = smoothstep(0.07, 0.0, abs(d - ph)) * (1.0 - ph);
                    gl_FragColor = vec4(uColor, clamp(core + ring, 0.0, 1.0) * vFade);
                  }`,
                transparent: true,
                blending: THREE.AdditiveBlending,
                depthTest: true,
                depthWrite: false,
              });
              const markers = new THREE.Points(g, markerMat);
              markers.frustumCulled = false;
              onLayer(markers, LAYERS.BLOOM_SCENE);
              mesh.add(markers);
            }
          } catch (err) {
            console.warn('[planet] marker sampling skipped', err);
          }

          cloudGroup.visible = true;
          planetLoaded = true;
        },
        undefined,
        (err) => console.warn('[planet] planet.glb failed to load', err),
      );
    },
    undefined,
    (err) => console.warn('[planet] planet-lights.glb failed to load', err),
  );

  // Resize
  const onResize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    const pr = renderer.getPixelRatio();
    for (const c of composers) {
      c.setPixelRatio(pr);
      c.setSize(w, h);
    }
    const res = resUniform();
    atmoMat.uniforms.uRes.value.copy(res);
    starMat.uniforms.uRes.value.copy(res);
    markerMat?.uniforms.uRes.value.copy(res);
  };
  window.addEventListener('resize', onResize);
  onResize();

  // Loop
  let curP = 0;
  let curX = STOPS_X[0].v;
  let curY = STOPS_Y[0].v;
  let curS = STOPS_S[0].v;
  let spinPhase = 0;
  let last = performance.now();
  let raf = 0;

  const scrollProgress = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    return max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
  };
  curP = scrollProgress();
  curX = sample(STOPS_X, curP) * clamp(window.innerWidth / 1200, 0.5, 1);
  curY = sample(STOPS_Y, curP);
  curS = sample(STOPS_S, curP);

  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    planetTime.value += dt / 12;
    cloudTime.value += dt / 20;
    starTime += dt;
    markerTime += dt;
    starMat.uniforms.uTime.value = starTime;
    if (markerMat) markerMat.uniforms.uTime.value = markerTime;

    // Scroll choreography
    const pTarget = scrollProgress();
    curP += (pTarget - curP) * Math.min(1, dt * 4.5);
    const sideScale = clamp(window.innerWidth / 1200, 0.5, 1);
    const k = Math.min(1, dt * 3.2);
    curX += (sample(STOPS_X, curP) * sideScale - curX) * k;
    curY += (sample(STOPS_Y, curP) - curY) * k;
    curS += (sample(STOPS_S, curP) - curS) * k;

    // One-time float-up entrance once the planet has loaded
    let entryY = ENTRY_START_Y;
    if (planetLoaded) {
      entryT = Math.min(ENTRY_DUR, entryT + dt);
      const t = entryT / ENTRY_DUR;
      entryY = ENTRY_START_Y * (1 - (1 - Math.pow(1 - t, 3)));
    } else if (reducedMotion) {
      entryY = 0;
    }
    worldGroup.position.set(curX, curY + entryY, 0);
    worldGroup.scale.setScalar(curS);

    spinPhase += dt * CONFIG.spin;
    planetGroup.rotation.y = CONFIG.initRotation + spinPhase + curP * Math.PI * 1.6;
    for (const c of cloudMeshes) c.mesh.rotation.y += dt * c.spin;

    glowMesh.quaternion.copy(camera.quaternion);
    controls.update();

    camera.layers.set(LAYERS.TORUS_SCENE);
    torusComposer.render();
    camera.layers.set(LAYERS.BLOOM_SCENE);
    bloomComposer.render();
    camera.layers.set(LAYERS.ENTIRE_SCENE);
    finalComposer.render();
  };
  raf = requestAnimationFrame(tick);

  return function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', onResize);
    controls.dispose();
    draco.dispose();
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mat of mats) {
        for (const v of Object.values(mat)) if (v && (v as THREE.Texture).isTexture) (v as THREE.Texture).dispose();
        mat.dispose();
      }
    });
    cloudTex.dispose();
    for (const c of composers) {
      c.renderTarget1.dispose();
      c.renderTarget2.dispose();
      for (const pass of c.passes) (pass as unknown as { dispose?: () => void }).dispose?.();
    }
    renderer.dispose();
  };
}
