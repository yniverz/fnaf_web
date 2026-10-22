import * as THREE from '../vendor/three.module.js';
import { Building } from './building.js';
import { Post, PRESET } from './post.js';
import * as TX from './textures.js';
import { M } from './materials.js';
import { createAnimatronic } from './animatronics.js';
/* ---------------------------------------------------------------------------
 * index.js - the 3D renderer. Exposed as window.FNAF.R3 and consumed by the
 * 2D game layer (night.js / screens.js) which draws the result on its canvas.
 * ------------------------------------------------------------------------- */
const W = 1280, H = 720;
const R3 = { ready: false, ok: false, canvas: null };
window.FNAF = window.FNAF || {};
window.FNAF.R3 = R3;

let renderer, scene, building, post, portraitScene, portraitRig, portraitCam, portraitLights, scareLight, flashLight;
const camSeeds = {};
const camLoss = {};
const yawState = { cur: 0, lastT: -1 };
const ray = new THREE.Raycaster();
const camPanDir = new THREE.Vector3();

R3.init = function () {
  if (R3.ready) return true;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.NoToneMapping;      // tone mapping happens in the post pass
    R3.canvas = canvas;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.FogExp2(0x02030a, 0.028);
    building = new Building(scene);
    post = new Post(renderer, W, H);
    // portrait / menu scene
    portraitScene = new THREE.Scene();
    portraitScene.background = new THREE.Color(0x000000);
    portraitRig = {};
    for (const n of ['freddy', 'bonnie', 'chica', 'foxy', 'golden']) {
      const r = createAnimatronic(n, { mic: false, cupcake: false, guitar: false });
      r.group.visible = false; portraitScene.add(r.group); portraitRig[n] = r;
    }
    portraitCam = new THREE.PerspectiveCamera(35, 16 / 9, 0.05, 20);
    portraitLights = {
      key: new THREE.SpotLight(0xfff0dc, 40, 10, 0.7, 0.6, 2),
      under: new THREE.PointLight(0xffd0a0, 6, 6, 2),
      rim: new THREE.PointLight(0x4060ff, 8, 8, 2),
    };
    portraitLights.key.position.set(1.5, 3.2, 2.5); portraitLights.key.castShadow = true; portraitLights.key.shadow.mapSize.set(1024, 1024); portraitLights.key.shadow.bias = -0.0004;
    portraitLights.under.position.set(0.2, 0.8, 1.4);
    portraitLights.rim.position.set(-1.5, 2.2, -1.0);
    for (const l of Object.values(portraitLights)) portraitScene.add(l);
    portraitScene.add(portraitLights.key.target);
    portraitScene.add(new THREE.HemisphereLight(0x202838, 0x050505, 0.15));
    // jumpscare lights live in the main scene
    scareLight = new THREE.PointLight(0xffffff, 0, 8, 2); scareLight.position.set(0, 1.8, 0.8); scene.add(scareLight);
    flashLight = new THREE.PointLight(0xffffff, 0, 12, 1.5); flashLight.position.set(0, 1.5, 1.0); scene.add(flashLight);
    R3.building = building; R3.scene = scene; R3.renderer = renderer;
    R3.ready = true; R3.ok = true;
    return true;
  } catch (e) {
    console.error('3D init failed', e);
    R3.ready = true; R3.ok = false;
    return false;
  }
};

function seedFor(id) {
  if (!camSeeds[id]) { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0; camSeeds[id] = { noise: 0.07 + (h % 7) * 0.008, tint: 0.5 + (h % 5) * 0.1, phase: (h % 100) / 10, tear: 0.2 + (h % 4) * 0.07 }; }
  return camSeeds[id];
}

/* ------------------------------------------------------------- office */
R3.renderOffice = function (st) {
  if (!R3.ok) return null;
  const B = building, P = B.officeParts, t = st.t || 0;
  B.hideAll();
  B.setActiveLights(['office']);
  B.goldenPoster.visible = false;
  const yaw = -(st.scroll / window.FNAF.Office.MAX_SCROLL - 0.5) * 2 * 0.85;
  const dt = yawState.lastT < 0 ? 1 : Math.min(0.25, Math.max(0, t - yawState.lastT));
  yawState.lastT = t;
  yawState.cur += (yaw - yawState.cur) * Math.min(1, dt * 14);
  P.camera.rotation.set(0, yawState.cur, 0);
  P.camera.position.set(0, 1.45 + Math.sin(t * 0.9) * 0.004, 1.1);
  // doors
  P.leftDoor.position.y = 3.6 - 2.4 * (st.leftDoor || 0);
  P.rightDoor.position.y = 3.6 - 2.4 * (st.rightDoor || 0);
  const flick = st.lightFlicker === undefined ? 1 : st.lightFlicker;
  const po = !!st.powerOut;
  // every office light stays registered (constant shader configuration); unused ones run at zero intensity
  P.leftLight.intensity = (st.leftLight && !po) ? P.leftLight.userData.base * flick : 0;
  P.rightLight.intensity = (st.rightLight && !po) ? P.rightLight.userData.base * flick : 0;
  // the office dims as the power drains, with brownouts under 20%
  const pw = st.power === undefined ? 100 : st.power;
  const dim = 0.45 + 0.55 * Math.min(1, pw / 55);
  const brown = pw < 20 && Math.random() < 0.08 ? 0.35 + Math.random() * 0.4 : 1;
  P.ceilingLight.intensity = po ? 0 : P.ceilingLight.userData.base * dim * brown;
  P.monitorGlow.intensity = po ? 0 : P.monitorGlow.userData.base * (0.8 + 0.2 * Math.sin(t * 37));
  B.hemi.intensity = po ? 0.3 : 0.08;
  P.eyeLight.intensity = (po && st.freddyEyes > 0) ? st.freddyEyes * P.eyeLight.userData.base * (0.7 + 0.3 * Math.random()) : 0;
  scareLight.intensity = 0; flashLight.intensity = 0;
  // screens
  if (!po) { TX.updateStatic(); for (const s of P.screens) s.material = M.screen(); } else for (const s of P.screens) s.material = M.screenOff();
  // buttons
  P.lpanel.door.material = M.button(st.leftDoor >= 1 ? '#e8322c' : '#7a1d1a', st.leftDoor >= 1);
  P.rpanel.door.material = M.button(st.rightDoor >= 1 ? '#e8322c' : '#7a1d1a', st.rightDoor >= 1);
  P.lpanel.light.material = M.button(st.leftLight ? '#f4f4f4' : '#8a8a8a', !!st.leftLight);
  P.rpanel.light.material = M.button(st.rightLight ? '#f4f4f4' : '#8a8a8a', !!st.rightLight);
  P.fanBlades.rotation.z = -(st.fanAngle || 0);
  // characters at the doors are only revealed by the lights
  if (st.bonnieAtDoor && st.leftLight && !po) B.place(B.rigs.bonnie, B.spots.bonnie.LDOOR, 'stand', 0, t);
  if (st.chicaAtDoor && st.rightLight && !po) B.place(B.rigs.chica, B.spots.chica.RDOOR, 'stand', 0, t);
  if (po && st.freddyEyes > 0) { B.place(B.rigs.freddy, B.spots.freddy.POWEROUT, 'stand', 0, t, 'glow'); B.rigs.freddy.group.visible = Math.random() < 0.92; }
  if (st.golden) { B.place(B.rigs.golden, B.spots.golden.OFFICE, 'slump', 0, t, 'black'); B.rigs.golden.group.visible = Math.random() < 0.9; }
  // a figure in the dark corner for a frame or two
  if (st.halluc && !st.golden) {
    const who = st.halluc === 'bonnie' ? B.rigs.bonnie : B.rigs.freddy;
    B.place(who, [-2.9, -2.05, 0.3], 'stand', 0, t, 'glow', { variant: 3 });
  }
  const p = Object.assign({}, PRESET.office, { time: t, brightness: po ? 0.7 : 1, exposure: po ? 2.2 : 1.3, noiseAmt: po ? 0.13 : 0.045 + (st.halluc ? 0.25 : 0), flicker: po ? 0.85 + Math.random() * 0.15 : 1, burst: st.halluc ? 0.25 : 0 });
  post.render(scene, P.camera, p);
  return R3.canvas;
};

R3.pickOffice = function (x, y) {
  if (!R3.ok) return null;
  const P = building.officeParts;
  ray.setFromCamera(new THREE.Vector2((x / W) * 2 - 1, -(y / H) * 2 + 1), P.camera);
  const hits = ray.intersectObjects(P.pickables, false);
  return hits.length ? hits[0].object.name : null;
};

/* ------------------------------------------------------------ cameras */
R3.renderCam = function (id, st) {
  if (!R3.ok) return null;
  if (id === '6') return null;
  const B = building, c = B.cams[id], t = st.t || 0, sd = seedFor(id);
  B.hideAll();
  B.setActiveLights([id]);
  B.goldenPoster.visible = !!st.golden && id === '2B';
  // characters: stance variants, and they turn their heads to the lens when stared at
  const stare = st.stare || 0;
  const look = Math.min(1, Math.max(0, (stare - 3) / 4));
  let occupants = 0;
  for (const name of ['bonnie', 'chica', 'freddy']) {
    const pos = st[name];
    const spot = B.spots[name][pos];
    if (pos === id && spot) {
      occupants++;
      const eyes = name === 'freddy' && id !== '1A' ? 'glow' : 'normal';
      const v = (st.variants && st.variants[name]) || { variant: 0, faceOff: 0 };
      const onStage = id === '1A';
      B.place(B.rigs[name], spot, 'stand', 0, t, eyes, { variant: onStage ? 0 : v.variant, faceOff: onStage ? 0 : v.faceOff, look, lookYaw: -(onStage ? 0 : v.faceOff), lookPitch: -0.3 });
    }
  }
  if (id === '1C') {
    const stage = st.foxy.stage;
    B.setCoveGap(stage === 0 ? 0 : stage === 1 ? 0.2 : stage === 2 ? 0.5 : 0.8);
    if (stage === 1) { B.place(B.rigs.foxy, [-13.55, -23.1, Math.atan2(c.pos[0] + 13.55, c.pos[2] + 23.1)], 'peek', 0, t); B.rigs.foxy.group.position.y = 0.4; }
    if (stage === 2) { B.place(B.rigs.foxy, [-13.0, -23.0, Math.atan2(c.pos[0] + 13.0, c.pos[2] + 23.0)], 'lean', 0, t); B.rigs.foxy.group.position.y = 0.4; }
    B.coveSign.material = (stage >= 3 && st.itsMe) ? M.sign(["IT'S ME"], ['#a00']) : M.sign(['Sorry!', 'OUT OF ORDER'], ['#222', '#b22']);
  }
  if (id === '2A' && st.foxy.running) {
    const k = Math.min(1, st.foxy.runT / 1.6);
    const z = -17 + (13.5) * k * k;
    B.place(B.rigs.foxy, [-5.5, z, 0], 'run', (st.foxy.runT * 4.5) % 1, t);
  }
  // camera with slow pan
  scareLight.intensity = 0; flashLight.intensity = 0;
  const cam = c.camera;
  cam.fov = c.fov; cam.updateProjectionMatrix();
  const pan = c.pan * Math.sin(t * 0.28 + sd.phase);
  camPanDir.set(c.target[0] - c.pos[0], c.target[1] - c.pos[1], c.target[2] - c.pos[2]).applyAxisAngle(new THREE.Vector3(0, 1, 0), pan);
  cam.lookAt(c.pos[0] + camPanDir.x, c.pos[1] + camPanDir.y, c.pos[2] + camPanDir.z);
  // light flicker on some cams
  for (const l of B.roomLights[id] || []) l.intensity = l.userData.base * (Math.random() < 0.06 ? 0.4 + Math.random() * 0.6 : 1);
  // signal drop-outs: short, and more frequent in occupied rooms
  const cl = camLoss[id] || (camLoss[id] = { until: 0, strength: 0 });
  if (id === '1C' && st.foxy && st.foxy.stage > 0) occupants++;
  if (t > cl.until && Math.random() < 0.0012 + 0.0035 * occupants) { cl.until = t + 0.06 + Math.random() * 0.35; cl.strength = 0.5 + Math.random() * 0.5; }
  const loss = t < cl.until ? cl.strength : 0;
  const p = Object.assign({}, PRESET.cam, { time: t, burst: st.burst || 0, noiseAmt: sd.noise + loss * 0.2, tint: sd.tint, tearing: sd.tear + (st.burst || 0) * 1.5 + loss, signalLoss: loss });
  post.render(scene, cam, p);
  return R3.canvas;
};

/* ---------------------------------------------------------- jumpscare */
R3.renderJumpscare = function (name, t, powerOut) {
  if (!R3.ok) return null;
  const B = building, P = B.officeParts;
  B.hideAll();
  B.setActiveLights(['office']);
  P.leftLight.intensity = 0; P.rightLight.intensity = 0; P.eyeLight.intensity = 0;
  P.ceilingLight.intensity = powerOut ? 0 : P.ceilingLight.userData.base; P.monitorGlow.intensity = powerOut ? 0 : P.monitorGlow.userData.base;
  B.hemi.intensity = powerOut ? 0.3 : 0.08;
  const rig = B.rigs[name];
  const k = Math.min(1, t / 0.28);
  const cam = P.camera;
  cam.position.set(0, 1.45, 1.1);
  if (name === 'foxy') {
    const x = -2.6 + 2.5 * k, z = -0.9 + 1.0 * k;
    B.place(rig, [x, z, Math.atan2(cam.position.x - x, cam.position.z - z)], 'scare', 0, t);
  } else if (name === 'golden') {
    B.place(rig, [0, 0.5, 0], 'scare', 0, t, 'black');
    rig.group.visible = Math.random() < 0.85;
  } else {
    const z = -1.2 + 1.5 * k;
    B.place(rig, [0.0, z, 0], 'scare', 0, t, name === 'freddy' && powerOut ? 'glow' : 'normal');
  }
  rig.group.position.y += 0.04 * Math.sin(t * 60) - 0.35 * k;
  // aim at the face, with shake
  const headPos = new THREE.Vector3(); rig.head.skull.getWorldPosition(headPos);
  cam.lookAt(headPos);
  const shake = Math.min(1, t * 4) * 0.06;
  cam.rotation.x += (Math.random() - 0.5) * shake; cam.rotation.y += (Math.random() - 0.5) * shake * 1.5; cam.rotation.z += (Math.random() - 0.5) * shake;
  scareLight.position.set(cam.position.x + 0.3, cam.position.y + 0.3, cam.position.z);
  scareLight.intensity = 9 * k * (0.7 + 0.3 * Math.random());
  flashLight.intensity = t < 0.12 ? 30 * (1 - t / 0.12) : 0;
  const p = Object.assign({}, PRESET.scare, { time: t, burst: t > 1.05 ? Math.min(1, (t - 1.05) * 6) : 0, flicker: 0.8 + Math.random() * 0.4, brightness: powerOut ? 0.6 : 1 });
  post.render(scene, cam, p);
  scareLight.intensity = 0; flashLight.intensity = 0;
  return R3.canvas;
};

/* ------------------------------------------------------- menu & misc */
function showPortrait(name, pose, eyes) {
  for (const r of Object.values(portraitRig)) r.group.visible = false;
  const r = portraitRig[name];
  r.group.visible = true; r.group.position.set(0, 0, 0); r.group.rotation.y = 0;
  r.setPose(pose || 'stand', 0, 0); r.setEyes(eyes || (name === 'golden' ? 'black' : 'normal'));
  return r;
}
R3.renderMenuFace = function (t, variant) {
  if (!R3.ok) return null;
  const r = showPortrait('freddy', 'stand', variant === 2 ? 'glow' : variant === 3 ? 'black' : 'normal');
  r.J.neck.rotation.set(0.05, 0.1, 0.05); r.J.jaw.rotation.x = variant === 1 ? 0.5 : 0.1;
  portraitCam.fov = 28; portraitCam.updateProjectionMatrix();
  portraitCam.position.set(0.9 + (Math.random() < 0.3 ? (Math.random() - 0.5) * 0.08 : 0), 2.05, 1.9);
  portraitCam.lookAt(-0.05, 2.0, 0);
  const fl = Math.random() < 0.15 ? 0.3 : 1;
  portraitLights.key.intensity = 18 * fl; portraitLights.under.intensity = 10 * fl; portraitLights.rim.intensity = 6;
  portraitLights.key.target.position.set(0, 2, 0);
  const p = Object.assign({}, PRESET.clean, { time: t, noiseAmt: 0.12, vignette: 0.9, desat: 0.35, aberration: 0.003, scanline: 0.5, interlace: 0.6, tearing: 0.4, brightness: 0.85, flicker: 0.85 + Math.random() * 0.2 });
  post.render(portraitScene, portraitCam, p);
  return R3.canvas;
};
R3.renderGameOver = function (t) {
  if (!R3.ok) return null;
  const r = showPortrait('freddy', 'slump', 'black');
  r.J.neck.rotation.set(-0.9, 0.3, 0.5); r.J.jaw.rotation.x = 0.4;
  portraitCam.fov = 40; portraitCam.updateProjectionMatrix();
  portraitCam.position.set(0.6, 1.4, 2.4); portraitCam.lookAt(0, 1.0, 0);
  portraitLights.key.intensity = 10; portraitLights.under.intensity = 2; portraitLights.rim.intensity = 3;
  const p = Object.assign({}, PRESET.clean, { time: t, noiseAmt: 0.14, vignette: 0.95, desat: 0.5, scanline: 0.5, interlace: 0.5, brightness: 0.7 });
  post.render(portraitScene, portraitCam, p);
  return R3.canvas;
};
const portraitCache = {};
R3.portrait = function (name) {
  if (!R3.ok) return null;
  if (portraitCache[name]) return portraitCache[name];
  const r = showPortrait(name, 'stand');
  r.J.neck.rotation.set(0.05, 0, 0); r.J.jaw.rotation.x = 0.1;
  portraitCam.fov = 30; portraitCam.updateProjectionMatrix();
  portraitCam.position.set(0, 2.05, 2.1); portraitCam.lookAt(0, 2.0, 0);
  portraitLights.key.intensity = 16; portraitLights.under.intensity = 3; portraitLights.rim.intensity = 5;
  post.render(portraitScene, portraitCam, Object.assign({}, PRESET.clean, { vignette: 0.6 }));
  const c = document.createElement('canvas'); c.width = 400; c.height = 400;
  c.getContext('2d').drawImage(R3.canvas, 440, 160, 400, 400, 0, 0, 400, 400);
  portraitCache[name] = c;
  return c;
};

/* Warm-up: render every lighting configuration once so shaders compile, textures upload and shadow maps
 * are allocated before the player sees them. Run one step per frame (see main.js). */
R3.warmupTasks = [];
R3.buildWarmup = function () {
  if (!R3.ok) return;
  const room = { bonnie: '1B', chica: '1B', freddy: '1B', foxy: { stage: 1, running: true, runT: 0.5 }, golden: true, itsMe: false, t: 1, burst: 0 };
  const office = { scroll: 160, leftDoor: 0, rightDoor: 0, leftLight: false, rightLight: false, fanAngle: 0, t: 1, lightFlicker: 1 };
  const tasks = [];
  tasks.push(() => R3.renderOffice(office));
  tasks.push(() => R3.renderOffice(Object.assign({}, office, { leftLight: true, rightLight: true, bonnieAtDoor: true, chicaAtDoor: true, leftDoor: 1, rightDoor: 1 })));
  tasks.push(() => R3.renderOffice(Object.assign({}, office, { powerOut: true, freddyEyes: 1, golden: true })));
  for (const id of Object.keys(building.cams)) if (id !== '6') tasks.push(() => R3.renderCam(id, Object.assign({}, room, { bonnie: id, chica: id, freddy: id })));
  for (const n of ['freddy', 'bonnie', 'chica', 'foxy', 'golden']) tasks.push(() => R3.renderJumpscare(n, 0.3, false));
  tasks.push(() => R3.renderMenuFace(1, 0));
  tasks.push(() => R3.renderGameOver(1));
  for (const n of ['freddy', 'bonnie', 'chica', 'foxy']) tasks.push(() => R3.portrait(n));
  R3.warmupTasks = tasks;
  R3.warmupTotal = tasks.length;
};
R3.warmupStep = function () {
  if (!R3.warmupTasks.length) return true;
  const t = R3.warmupTasks.shift();
  try { t(); } catch (e) { console.error('warmup', e); }
  return R3.warmupTasks.length === 0;
};
R3.warmupProgress = function () { return R3.warmupTotal ? 1 - R3.warmupTasks.length / R3.warmupTotal : 1; };

window.dispatchEvent(new Event('fnaf-r3-loaded'));
