import * as THREE from '../vendor/three.module.js';
import { M } from './materials.js';
/* ---------------------------------------------------------------------------
 * animatronics.js - jointed procedural rigs for the five characters.
 * Models face +Z, feet at y=0, roughly 2.1 m tall.
 * ------------------------------------------------------------------------- */
const PAL = {
  freddy: { fur: '#6b4a2b', muzzle: '#b48a5c', iris: '#5d8fd8', bow: '#111111', wear: 0.5 },
  golden: { fur: '#c9a23a', muzzle: '#e2cb7e', iris: '#000000', bow: '#2a1a4a', wear: 0.8 },
  bonnie: { fur: '#3b3380', muzzle: '#6d64b5', iris: '#c43b7a', bow: '#c0252a', inner: '#8b84c9', wear: 0.45 },
  chica: { fur: '#e3bf1f', muzzle: '#f2d865', iris: '#c43b7a', beak: '#e0772c', wear: 0.45 },
  foxy: { fur: '#a3332a', muzzle: '#d9b58e', iris: '#e9c44a', inner: '#3a1612', wear: 1.0 },
};

const G = {
  sphere: (r, w, h) => new THREE.SphereGeometry(r, w || 32, h || 24),
  capsule: (r, l) => new THREE.CapsuleGeometry(r, l, 8, 24),
  cyl: (rt, rb, h, s) => new THREE.CylinderGeometry(rt, rb, h, s || 32),
  box: (x, y, z) => new THREE.BoxGeometry(x, y, z),
  cone: (r, h, s) => new THREE.ConeGeometry(r, h, s || 24),
  torus: (r, t, arc) => new THREE.TorusGeometry(r, t, 12, 32, arc || Math.PI * 2),
};

function mesh(geo, mat, p, r, s) {
  const m = new THREE.Mesh(geo, mat);
  if (p) m.position.set(p[0], p[1], p[2]);
  if (r) m.rotation.set(r[0], r[1], r[2]);
  if (s) m.scale.set(s[0], s[1], s[2]);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function group(p, r) { const g = new THREE.Group(); if (p) g.position.set(p[0], p[1], p[2]); if (r) g.rotation.set(r[0], r[1], r[2]); return g; }

/* --------------------------------------------------------------- eyes */
function makeEye(irisHex, r) {
  const g = new THREE.Group();
  const sclera = mesh(G.sphere(r), M.sclera(false));
  const iris = mesh(G.sphere(r * 0.58, 24, 16), M.iris(irisHex), [0, 0, r * 0.55], null, [1, 1, 0.55]);
  const pupil = mesh(G.sphere(r * 0.28, 16, 12), M.pupil(), [0, 0, r * 0.86], null, [1, 1, 0.5]);
  const glint = mesh(G.sphere(r * 0.09, 8, 6), M.glint(), [-r * 0.2, r * 0.22, r * 1.0]);
  glint.castShadow = false;
  g.add(sclera, iris, pupil, glint);
  const eye = { group: g, sclera, iris, pupil, glint, irisHex };
  eye.setMode = mode => {
    if (mode === 'glow') { sclera.material = M.sclera(true); iris.visible = false; pupil.visible = false; glint.visible = false; }
    else if (mode === 'black') { sclera.material = M.blackEye(); iris.visible = false; pupil.visible = false; glint.visible = true; glint.scale.setScalar(1.6); }
    else { sclera.material = M.sclera(false); iris.visible = true; pupil.visible = true; glint.visible = true; glint.scale.setScalar(1); }
  };
  return eye;
}

function teethArc(parent, mat, cx, cy, cz, radius, count, w, h, d, upsideDown, sharp) {
  for (let i = 0; i < count; i++) {
    const a = -1.0 + (2.0 * i) / (count - 1);
    const x = cx + Math.sin(a) * radius, z = cz + Math.cos(a) * radius;
    const geo = sharp ? G.cone(w * 0.6, h, 8) : G.box(w, h, d);
    const t = mesh(geo, mat, [x, cy, z], [sharp && !upsideDown ? Math.PI : 0, a, 0]);
    t.castShadow = false;
    parent.add(t);
  }
}

/* --------------------------------------------------------------- heads */
function makeHead(type) {
  const P = PAL[type];
  const fur = M.fur(P.fur, P.wear, type.length);
  const muzzleMat = M.fur(P.muzzle, P.wear * 0.6, type.length + 3);
  const head = group([0, 0, 0]);
  const skull = group([0, 0.3, 0]);   // head center
  skull.scale.setScalar(1.22);
  head.add(skull);
  const eyes = [];
  const jaw = group([0, -0.03, 0.1]);
  skull.add(jaw);
  const R = 0.26;

  const addEyes = (ex, ey, ez, r, irisHex, socketScale) => {
    for (const s of [-1, 1]) {
      const socket = mesh(G.sphere(r * 1.35, 24, 16), M.black(), [s * ex, ey, ez - r * 0.25], null, socketScale || [1, 1, 0.7]);
      socket.castShadow = false;
      skull.add(socket);
      const e = makeEye(irisHex, r);
      e.group.position.set(s * ex, ey, ez);
      e.group.rotation.y = s * 0.12;
      skull.add(e.group);
      eyes.push(e);
    }
  };

  if (type === 'freddy' || type === 'golden') {
    skull.add(mesh(G.sphere(R), fur, [0, 0, 0], null, [1, 0.95, 0.98]));
    for (const s of [-1, 1]) {
      skull.add(mesh(G.sphere(0.1), fur, [s * 0.2, 0.2, -0.02], null, [1, 1, 0.55]));
      skull.add(mesh(G.sphere(0.055), muzzleMat, [s * 0.2, 0.2, 0.035], null, [1, 1, 0.5]));
    }
    // hat
    const hatMat = M.matte('#0d0d0d');
    const hat = group([0.0, 0.19, -0.03], [0, 0, 0.07]);
    hat.add(mesh(G.cyl(0.15, 0.155, 0.27), hatMat, [0, 0.145, 0]));
    hat.add(mesh(G.cyl(0.235, 0.235, 0.02, 48), hatMat, [0, 0.01, 0]));
    hat.add(mesh(G.cyl(0.157, 0.157, 0.035), M.matte('#1c1c1c'), [0, 0.05, 0]));
    skull.add(hat);
    for (const s of [-1, 1]) skull.add(mesh(G.box(0.13, 0.035, 0.04), M.matte('#2a1a0c'), [s * 0.105, 0.12, 0.215], [0.2, 0, s * 0.35]));
    addEyes(0.095, 0.04, 0.2, 0.05, P.iris);
    skull.add(mesh(G.sphere(0.17), muzzleMat, [0, -0.07, 0.17], null, [1.2, 0.72, 0.85]));
    skull.add(mesh(G.sphere(0.065), M.plastic('#0a0a0a', 0.3), [0, 0.0, 0.33], null, [1.35, 0.8, 0.7]));
    // mouth opening
    skull.add(mesh(G.sphere(0.125, 24, 16), M.mouth(), [0, -0.15, 0.2], null, [1.1, 0.5, 0.85]));
    teethArc(skull, M.teeth(), 0, -0.115, 0.19, 0.125, 8, 0.028, 0.03, 0.018, false, false);
    // jaw
    jaw.add(mesh(G.sphere(0.13, 24, 16), muzzleMat, [0, -0.16, 0.08], null, [1.15, 0.45, 0.85]));
    teethArc(jaw, M.teeth(), 0, -0.125, 0.09, 0.11, 7, 0.026, 0.028, 0.018, true, false);
    jaw.add(mesh(G.sphere(0.06, 16, 12), M.tongue(), [0, -0.15, 0.05], null, [1.2, 0.4, 1.3]));
  }

  if (type === 'bonnie') {
    skull.add(mesh(G.sphere(R), fur, [0, 0, 0], null, [1, 0.97, 0.98]));
    for (const s of [-1, 1]) {
      const ear = group([s * 0.13, 0.2, -0.03], [s < 0 ? 0.25 : 0.05, 0, s * 0.1]);
      ear.add(mesh(G.capsule(0.065, 0.42), fur, [0, 0.3, 0]));
      ear.add(mesh(G.capsule(0.03, 0.33), M.fur(P.inner, 0.2, 9), [0, 0.3, 0.04]));
      skull.add(ear);
    }
    for (const s of [-1, 1]) skull.add(mesh(G.box(0.15, 0.035, 0.07), M.matte('#1c1740'), [s * 0.1, 0.11, 0.2], [0.3, 0, s * 0.45]));
    addEyes(0.095, 0.03, 0.2, 0.05, P.iris);
    skull.add(mesh(G.sphere(0.15), muzzleMat, [0, -0.06, 0.17], null, [1.15, 0.8, 0.8]));
    skull.add(mesh(G.cone(0.035, 0.05, 3), M.plastic('#0d0a1f', 0.4), [0, 0.0, 0.31], [Math.PI, 0, 0]));
    skull.add(mesh(G.sphere(0.115, 24, 16), M.mouth(), [0, -0.15, 0.2], null, [1.1, 0.5, 0.85]));
    for (const s of [-1, 1]) skull.add(mesh(G.box(0.045, 0.06, 0.02), M.teeth(), [s * 0.028, -0.135, 0.285]));
    teethArc(skull, M.teeth(), 0, -0.11, 0.19, 0.115, 8, 0.024, 0.024, 0.016, false, false);
    jaw.add(mesh(G.sphere(0.12, 24, 16), muzzleMat, [0, -0.15, 0.08], null, [1.1, 0.45, 0.85]));
    teethArc(jaw, M.teeth(), 0, -0.115, 0.09, 0.1, 7, 0.024, 0.026, 0.016, true, false);
    jaw.add(mesh(G.sphere(0.055, 16, 12), M.tongue(), [0, -0.14, 0.05], null, [1.2, 0.4, 1.3]));
  }

  if (type === 'chica') {
    skull.add(mesh(G.sphere(R), fur, [0, 0, 0], null, [1.05, 0.98, 1]));
    for (const i of [-1, 0, 1]) skull.add(mesh(G.cone(0.03, 0.11, 10), M.matte('#8a7210'), [i * 0.06, 0.29, 0], [0, 0, -i * 0.5]));
    for (const s of [-1, 1]) skull.add(mesh(G.box(0.16, 0.04, 0.05), M.matte('#3a2a05'), [s * 0.1, 0.13, 0.205], [0.3, 0, -s * 0.5]));
    addEyes(0.1, 0.04, 0.2, 0.052, P.iris);
    const beak = M.plastic(P.beak, 0.4);
    skull.add(mesh(G.cone(0.15, 0.26, 28), beak, [0, -0.06, 0.3], [Math.PI / 2, 0, 0], [1.7, 0.38, 1]));
    for (const s of [-1, 1]) skull.add(mesh(G.sphere(0.012, 8, 6), M.black(), [s * 0.05, -0.02, 0.36], null, [1, 0.6, 1]));
    skull.add(mesh(G.sphere(0.12, 24, 16), M.mouth(), [0, -0.13, 0.2], null, [1.3, 0.45, 0.9]));
    teethArc(skull, M.teeth(), 0, -0.1, 0.2, 0.14, 9, 0.02, 0.035, 0.014, false, true);
    jaw.add(mesh(G.cone(0.13, 0.22, 28), beak, [0, -0.135, 0.26], [Math.PI / 2, 0, 0], [1.5, 0.32, 0.9]));
    teethArc(jaw, M.teeth(), 0, -0.115, 0.17, 0.12, 8, 0.018, 0.03, 0.012, true, true);
    jaw.add(mesh(G.sphere(0.05, 16, 12), M.tongue(), [0, -0.14, 0.08], null, [1.2, 0.4, 1.4]));
  }

  if (type === 'foxy') {
    skull.add(mesh(G.sphere(0.25), fur, [0, 0, 0], null, [1, 0.95, 1.05]));
    for (const s of [-1, 1]) {
      const ear = group([s * 0.17, 0.2, -0.03], [-0.15, 0, s * 0.25]);
      ear.add(mesh(G.cone(0.075, 0.26, 12), fur, [0, 0.12, 0]));
      ear.add(mesh(G.cone(0.04, 0.18, 10), M.matte(P.inner), [0, 0.1, 0.035]));
      skull.add(ear);
    }
    for (const s of [-1, 1]) skull.add(mesh(G.box(0.14, 0.04, 0.05), M.matte('#4e1510'), [s * 0.1, 0.13, 0.2], [0.3, 0, s * 0.35]));
    addEyes(0.095, 0.04, 0.2, 0.048, P.iris);
    // eye patch raised, with strap
    skull.add(mesh(new THREE.SphereGeometry(0.075, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), M.matte('#0a0a0a'), [0.1, 0.15, 0.17], [-0.9, 0, 0]));
    const strap = mesh(G.torus(0.262, 0.006), M.matte('#0a0a0a'), [0, 0.1, 0], [Math.PI / 2 + 0.35, 0, 0]);
    skull.add(strap);
    // snout
    skull.add(mesh(G.capsule(0.1, 0.16), muzzleMat, [0, -0.07, 0.3], [Math.PI / 2, 0, 0]));
    skull.add(mesh(G.sphere(0.045), M.plastic('#0a0a0a', 0.3), [0, -0.025, 0.465], null, [1.3, 0.8, 0.8]));
    skull.add(mesh(G.box(0.17, 0.06, 0.22), M.mouth(), [0, -0.15, 0.32]));
    for (const s of [-1, 1]) for (let i = 0; i < 6; i++) { const t = mesh(G.cone(0.011, 0.04, 8), M.teeth(), [s * 0.072, -0.135, 0.22 + i * 0.042], [Math.PI, 0, 0]); t.castShadow = false; skull.add(t); }
    jaw.add(mesh(G.capsule(0.08, 0.16), muzzleMat, [0, -0.17, 0.2], [Math.PI / 2, 0, 0]));
    for (const s of [-1, 1]) for (let i = 0; i < 5; i++) { const t = mesh(G.cone(0.01, 0.035, 8), M.teeth(), [s * 0.058, -0.14, 0.12 + i * 0.045]); t.castShadow = false; jaw.add(t); }
    jaw.add(mesh(G.box(0.1, 0.02, 0.18), M.tongue(), [0, -0.16, 0.18]));
  }

  const rig = { group: head, skull, jaw, eyes };
  rig.setEyes = mode => eyes.forEach(e => e.setMode(mode));
  if (type === 'golden') rig.setEyes('black');
  return rig;
}

/* --------------------------------------------------------------- body */
export function createAnimatronic(type, opts) {
  opts = opts || {};
  const P = PAL[type];
  const fur = M.fur(P.fur, P.wear, type.length);
  const bellyMat = M.fur(P.muzzle, P.wear * 0.6, type.length + 3);
  const joint = M.black();
  const root = new THREE.Group();
  const body = new THREE.Group();   // allows vertical offset for sitting poses
  root.add(body);
  const J = {};

  const chubby = type === 'freddy' || type === 'golden' ? 1.15 : type === 'chica' ? 1.1 : 1.0;
  // legs
  for (const s of [-1, 1]) {
    const side = s < 0 ? 'L' : 'R';
    const hip = group([s * 0.19, 0.92, 0]); body.add(hip); J['hip' + side] = hip;
    hip.add(mesh(G.sphere(0.115), joint));
    hip.add(mesh(G.capsule(0.12, 0.22), fur, [0, -0.18, 0]));
    const knee = group([0, -0.4, 0]); hip.add(knee); J['knee' + side] = knee;
    knee.add(mesh(G.sphere(0.09), joint));
    if (type === 'foxy') {
      knee.add(mesh(G.cyl(0.035, 0.03, 0.4), M.metal(), [0, -0.2, 0]));
      knee.add(mesh(G.cyl(0.012, 0.012, 0.36), M.metal(), [0.05, -0.2, -0.02]));
      knee.add(mesh(G.cyl(0.012, 0.012, 0.36), M.metal(), [-0.05, -0.2, 0.02]));
      const foot = mesh(G.box(0.16, 0.06, 0.3), M.darkMetal(), [0, -0.42, 0.08]); knee.add(foot);
      for (let i = -1; i <= 1; i++) knee.add(mesh(G.box(0.035, 0.04, 0.08), M.darkMetal(), [i * 0.05, -0.42, 0.26]));
    } else {
      knee.add(mesh(G.capsule(0.1, 0.22), fur, [0, -0.18, 0]));
      const footMat = type === 'chica' ? M.plastic(P.beak, 0.5) : fur;
      knee.add(mesh(G.sphere(0.11), footMat, [0, -0.42, 0.06], null, [1.2, 0.5, 1.8]));
      if (type === 'chica') for (let i = -1; i <= 1; i++) knee.add(mesh(G.capsule(0.022, 0.1), footMat, [i * 0.06, -0.44, 0.2], [Math.PI / 2, 0, 0]));
    }
  }
  // torso
  const torso = group([0, 0.95, 0]); body.add(torso); J.torso = torso;
  torso.add(mesh(G.capsule(0.33, 0.3), fur, [0, 0.36, 0], null, [chubby * 1.05, 1, 0.9]));
  if (type === 'foxy') {
    // torn chest exposing the endoskeleton
    torso.add(mesh(G.sphere(0.2, 24, 16), M.mouth(), [0.03, 0.3, 0.17], null, [1.1, 1.2, 0.6]));
    for (let i = 0; i < 4; i++) torso.add(mesh(G.torus(0.13 - i * 0.015, 0.012, Math.PI), M.metal(), [0.03, 0.14 + i * 0.1, 0.2], [0, 0, Math.PI]));
    torso.add(mesh(G.cyl(0.03, 0.03, 0.5), M.metal(), [0.03, 0.32, 0.15]));
  } else {
    torso.add(mesh(G.sphere(0.21), bellyMat, [0, 0.3, 0.14], null, [1.0, 1.25, 0.75]));
  }
  // neck
  torso.add(mesh(G.cyl(0.08, 0.1, 0.16), joint, [0, 0.68, 0]));
  if (type === 'freddy' || type === 'golden' || type === 'bonnie') {
    const bow = M.plastic(P.bow, 0.5);
    for (const s of [-1, 1]) {
      const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(s * 0.15, -0.075); sh.lineTo(s * 0.15, 0.075); sh.closePath();
      torso.add(mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.035, bevelEnabled: false }), bow, [s * 0.02, 0.62, 0.3]));
    }
    torso.add(mesh(G.sphere(0.04), bow, [0, 0.62, 0.32], null, [1, 1.1, 0.8]));
  }
  if (type === 'freddy' || type === 'golden') {
    torso.add(mesh(G.sphere(0.03), M.plastic('#0a0a0a', 0.3), [0, 0.42, 0.33]));
    torso.add(mesh(G.sphere(0.03), M.plastic('#0a0a0a', 0.3), [0, 0.28, 0.34]));
  }
  if (type === 'chica') {
    const bib = mesh(new THREE.CylinderGeometry(0.36, 0.38, 0.38, 32, 1, true, -0.95, 1.9), M.bib(), [0, 0.38, 0.0]);
    bib.rotation.y = Math.PI; bib.castShadow = false;
    torso.add(bib);
  }
  // arms
  for (const s of [-1, 1]) {
    const side = s < 0 ? 'L' : 'R';
    const sh = group([s * 0.38 * chubby, 0.58, 0]); torso.add(sh); J['shoulder' + side] = sh;
    sh.add(mesh(G.sphere(0.1), joint));
    sh.add(mesh(G.capsule(0.085, 0.24), fur, [0, -0.18, 0]));
    const el = group([0, -0.36, 0]); sh.add(el); J['elbow' + side] = el;
    el.add(mesh(G.sphere(0.075), joint));
    el.add(mesh(G.capsule(0.075, 0.22), fur, [0, -0.17, 0]));
    const hand = group([0, -0.36, 0]); el.add(hand); J['hand' + side] = hand;
    if (type === 'foxy' && s > 0) {
      hand.add(mesh(G.cyl(0.04, 0.05, 0.08), M.darkMetal(), [0, 0, 0]));
      hand.add(mesh(G.torus(0.09, 0.014, Math.PI * 1.4), M.metal(), [0, -0.1, 0], [0, Math.PI / 2, 0.3]));
    } else {
      hand.add(mesh(G.sphere(0.085), fur, [0, -0.02, 0], null, [1, 1.1, 0.8]));
      for (let i = -1; i <= 1; i++) hand.add(mesh(G.capsule(0.026, 0.07), fur, [i * 0.05, -0.12, 0.01], [0, 0, i * 0.15]));
      hand.add(mesh(G.capsule(0.026, 0.06), fur, [s * -0.07, -0.05, 0.03], [0, 0, s * -1.0]));
    }
  }
  // props
  if (type === 'freddy' && opts.mic !== false) {
    const h = J.handL;
    h.add(mesh(G.cyl(0.018, 0.022, 0.2), M.darkMetal(), [0, 0.02, 0.1], [1.2, 0, 0]));
    h.add(mesh(G.sphere(0.045), M.metal(), [0, 0.1, 0.2]));
  }
  if (type === 'bonnie' && opts.guitar) {
    const g = group([0.05, 0.25, 0.3], [0, 0, -0.5]);
    const red = M.plastic('#b3202a', 0.3);
    g.add(mesh(G.cyl(0.22, 0.22, 0.05, 32), red, [-0.1, 0, 0], [Math.PI / 2, 0, 0]));
    g.add(mesh(G.cyl(0.17, 0.17, 0.05, 32), red, [0.18, 0.03, 0], [Math.PI / 2, 0, 0]));
    g.add(mesh(G.box(0.7, 0.04, 0.03), M.wood(), [0.55, 0.05, 0]));
    g.add(mesh(G.box(0.14, 0.07, 0.02), M.wood(), [0.95, 0.06, 0]));
    g.add(mesh(G.cyl(0.05, 0.05, 0.06, 24), M.black(), [-0.02, 0.02, 0], [Math.PI / 2, 0, 0]));
    for (let i = 0; i < 4; i++) g.add(mesh(G.cyl(0.002, 0.002, 1.1, 6), M.metal(), [0.3, 0.04 + i * 0.012 - 0.018, 0.028], [0, 0, Math.PI / 2]));
    torso.add(g);
  }
  if (type === 'chica' && opts.cupcake !== false) {
    const h = J.handR;
    const c = group([0, -0.05, 0.12]);
    c.add(mesh(G.cyl(0.11, 0.11, 0.01, 32), M.plastic('#dddddd', 0.3), [0, 0, 0]));
    c.add(mesh(G.cyl(0.06, 0.045, 0.08), M.matte('#7a2a1a'), [0, 0.045, 0]));
    c.add(mesh(G.sphere(0.07), M.plastic('#e8559a', 0.4), [0, 0.11, 0], null, [1, 0.8, 1]));
    for (const s of [-1, 1]) { c.add(mesh(G.sphere(0.018), M.sclera(false), [s * 0.03, 0.12, 0.055])); c.add(mesh(G.sphere(0.008), M.pupil(), [s * 0.03, 0.12, 0.07])); }
    c.add(mesh(G.box(0.04, 0.012, 0.01), M.teeth(), [0, 0.085, 0.07]));
    c.add(mesh(G.cyl(0.008, 0.008, 0.08), M.plastic('#eeeeee', 0.5), [0, 0.19, 0]));
    const flame = mesh(G.cone(0.012, 0.03, 8), M.emissive('#ffb347', 3), [0, 0.245, 0]); flame.castShadow = false; c.add(flame);
    h.add(c);
  }
  // head
  const neck = group([0, 0.72, 0]); torso.add(neck); J.neck = neck;
  const head = makeHead(type);
  neck.add(head.group);
  J.jaw = head.jaw;

  const rig = { type, group: root, body, J, head, eyes: head.eyes, setEyes: head.setEyes, phaseSeed: Math.random() * 10 };
  rig.group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  /* poses */
  rig.setPose = function (name, phase, t, po) {
    const j = rig.J; phase = phase || 0; t = t || 0; po = po || {};
    const z = o => { o.rotation.set(0, 0, 0); };
    ['hipL', 'hipR', 'kneeL', 'kneeR', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'torso', 'neck', 'jaw', 'handL', 'handR'].forEach(k => z(j[k]));
    rig.body.position.set(0, 0, 0);
    const idle = Math.sin(t * 0.7 + rig.phaseSeed) * 0.02;
    if (name === 'stand') {
      const v = po.variant || 0;
      if (v === 1) {            // head down, arms forward, slight lean
        j.torso.rotation.x = -0.1; j.neck.rotation.set(0.35 + idle, 0.15, 0.1);
        j.shoulderL.rotation.set(-0.35, 0, 0.1); j.shoulderR.rotation.set(-0.3, 0, -0.1);
        j.elbowL.rotation.x = -0.6; j.elbowR.rotation.x = -0.5; j.jaw.rotation.x = 0.05;
      } else if (v === 2) {     // looking away, one shoulder dropped, mouth slack
        j.neck.rotation.set(-0.05 + idle, -0.6, -0.25); j.torso.rotation.z = 0.06;
        j.shoulderL.rotation.set(0.15, 0, 0.35); j.shoulderR.rotation.set(0.05, 0, -0.05);
        j.elbowL.rotation.x = -0.15; j.elbowR.rotation.x = -0.4; j.jaw.rotation.x = 0.35;
      } else if (v === 3) {     // hunched, head up
        j.torso.rotation.x = -0.22; j.neck.rotation.set(-0.3 + idle, 0.05, 0.05);
        j.shoulderL.rotation.set(0.4, 0, 0.2); j.shoulderR.rotation.set(0.45, 0, -0.2);
        j.elbowL.rotation.x = -0.2; j.elbowR.rotation.x = -0.2; j.jaw.rotation.x = 0.2;
        j.hipL.rotation.x = 0.15; j.kneeL.rotation.x = 0.2;
      } else {
        j.neck.rotation.set(0.05 + idle, Math.sin(rig.phaseSeed) * 0.25, Math.cos(rig.phaseSeed) * 0.08);
        j.shoulderL.rotation.set(0.1, 0, 0.12); j.shoulderR.rotation.set(-0.05, 0, -0.12);
        j.elbowL.rotation.x = -0.25; j.elbowR.rotation.x = -0.2;
        j.jaw.rotation.x = 0.08;
      }
      // micro-twitch every few seconds, and a slow mechanical head drift
      const tw = (t * 0.37 + rig.phaseSeed) % 1;
      if (tw < 0.025) { j.neck.rotation.z += 0.14; j.neck.rotation.y -= 0.1; }
      j.neck.rotation.y += Math.sin(t * 0.23 + rig.phaseSeed * 2) * 0.05;
      if (((t * 0.11 + rig.phaseSeed) % 1) < 0.015) j.jaw.rotation.x += 0.3;
      // looking into the lens: blend the head toward the camera direction
      if (po.look) {
        const k = po.look;
        j.neck.rotation.y = j.neck.rotation.y * (1 - k) + (po.lookYaw || 0) * k;
        j.neck.rotation.x = j.neck.rotation.x * (1 - k) + (po.lookPitch || 0) * k;
        j.neck.rotation.z *= (1 - k);
      }
    } else if (name === 'lean') {
      j.torso.rotation.x = -0.35; j.neck.rotation.set(0.4, 0.3, 0.1);
      j.hipL.rotation.x = -0.35; j.kneeL.rotation.x = 0.2; j.hipR.rotation.x = 0.2;
      j.shoulderL.rotation.set(0.4, 0, 0.3); j.shoulderR.rotation.set(-0.6, 0, -0.5); j.elbowR.rotation.x = -0.9;
      j.jaw.rotation.x = 0.35;
    } else if (name === 'run') {
      const p = phase * Math.PI * 2;
      j.torso.rotation.x = -0.3;
      j.hipL.rotation.x = -0.9 * Math.sin(p); j.hipR.rotation.x = 0.9 * Math.sin(p);
      j.kneeL.rotation.x = 0.8 * Math.max(0, -Math.sin(p - 0.8)); j.kneeR.rotation.x = 0.8 * Math.max(0, Math.sin(p - 0.8));
      j.shoulderL.rotation.x = 0.9 * Math.sin(p) - 0.3; j.shoulderR.rotation.x = -0.9 * Math.sin(p) - 0.3;
      j.elbowL.rotation.x = -0.9; j.elbowR.rotation.x = -0.9;
      j.neck.rotation.set(0.25, 0, 0); j.jaw.rotation.x = 0.55;
      rig.body.position.y = Math.abs(Math.sin(p)) * 0.06;
    } else if (name === 'scare') {
      j.torso.rotation.x = -0.45;
      j.shoulderL.rotation.set(-1.7, 0, 0.35); j.shoulderR.rotation.set(-1.7, 0, -0.35);
      j.elbowL.rotation.x = -0.4; j.elbowR.rotation.x = -0.4;
      j.handL.rotation.x = -0.3; j.handR.rotation.x = -0.3;
      j.neck.rotation.set(-0.15 + (Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3);
      j.jaw.rotation.x = 0.55 + Math.random() * 0.45;
      j.hipL.rotation.x = -0.25; j.hipR.rotation.x = 0.1;
    } else if (name === 'slump') {
      j.hipL.rotation.set(-1.45, 0, 0.25); j.hipR.rotation.set(-1.4, 0, -0.3);
      j.kneeL.rotation.x = 0.15; j.kneeR.rotation.x = 0.25;
      j.torso.rotation.set(0.3, 0.05, 0.08);
      j.neck.rotation.set(-0.7, 0.15, 0.3);
      j.shoulderL.rotation.set(0.3, 0, 0.7); j.shoulderR.rotation.set(0.2, 0, -0.75);
      j.elbowL.rotation.x = -0.2; j.elbowR.rotation.x = -0.1;
      j.jaw.rotation.x = 0.25;
      rig.body.position.y = -0.72;
    } else if (name === 'peek') {
      j.neck.rotation.set(0.1, -0.5, 0.35);
      j.jaw.rotation.x = 0.3;
      j.torso.rotation.y = -0.6;
    }
  };
  rig.setPose('stand', 0, 0);
  return rig;
}

export { PAL };
