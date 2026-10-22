import * as THREE from '../vendor/three.module.js';
import { M } from './materials.js';
import * as TX from './textures.js';
import { createAnimatronic } from './animatronics.js';
/* ---------------------------------------------------------------------------
 * building.js - Freddy Fazbear's Pizza as one connected 3D building.
 * +x east, -z north (away from the office), y up. Office at the origin.
 * ------------------------------------------------------------------------- */
const WALL_T = 0.16, H = 3.2;

function uvScale(geo, sx, sy) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
  uv.needsUpdate = true;
  return geo;
}
function mesh(geo, mat, p, r, s) {
  const m = new THREE.Mesh(geo, mat);
  if (p) m.position.set(p[0], p[1], p[2]);
  if (r) m.rotation.set(r[0], r[1], r[2]);
  if (s) m.scale.set(s[0], s[1], s[2]);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function box(w, h, d, mat, p, r) { return mesh(new THREE.BoxGeometry(w, h, d), mat, p, r); }

export class Building {
  constructor(scene) {
    this.scene = scene;
    this.roomLights = {};     // id -> [lights]
    this.cams = {};
    this.spots = {};
    this.officeParts = {};
    this.build();
  }

  /* ---- primitives ------------------------------------------------------ */
  wall(x1, z1, x2, z2, mat, yFrom, yTo, band) {
    yFrom = yFrom || 0; yTo = yTo || H;
    const len = Math.hypot(x2 - x1, z2 - z1);
    if (len < 0.01) return null;
    const g = uvScale(new THREE.BoxGeometry(len, yTo - yFrom, WALL_T), len / 3, (yTo - yFrom) / 3);
    const m = mesh(g, mat, [(x1 + x2) / 2, (yFrom + yTo) / 2, (z1 + z2) / 2], [0, -Math.atan2(z2 - z1, x2 - x1), 0]);
    this.scene.add(m);
    if (band && yTo > 2.5) {
      const bg = uvScale(new THREE.BoxGeometry(len, 0.36, WALL_T + 0.02), len / 1.0, 1);
      const b = mesh(bg, M.band(), [(x1 + x2) / 2, 2.35, (z1 + z2) / 2], [0, -Math.atan2(z2 - z1, x2 - x1), 0]);
      b.castShadow = false;
      this.scene.add(b);
    }
    return m;
  }
  /* wall along one axis with openings: openings = [[from,to,{yFrom,yTo}]] along the wall's parameter */
  wallWithOpenings(x1, z1, x2, z2, mat, openings, band) {
    const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
    const at = t => [x1 + dx * (t / len), z1 + dz * (t / len)];
    let cur = 0;
    const ops = (openings || []).slice().sort((a, b) => a[0] - b[0]);
    for (const o of ops) {
      const a = Math.max(cur, o[0]), b = Math.min(len, o[1]);
      if (a > cur) { const p = at(cur), q = at(a); this.wall(p[0], p[1], q[0], q[1], mat, 0, H, band); }
      const p = at(a), q = at(b);
      const yFrom = (o[2] && o[2].yFrom) || 0, yTo = (o[2] && o[2].yTo) || 2.4;
      if (yFrom > 0) this.wall(p[0], p[1], q[0], q[1], mat, 0, yFrom, false);
      if (yTo < H) this.wall(p[0], p[1], q[0], q[1], mat, yTo, H, band);
      cur = b;
    }
    if (cur < len) { const p = at(cur), q = at(len); this.wall(p[0], p[1], q[0], q[1], mat, 0, H, band); }
  }
  floor(x1, z1, x2, z2, mat, y) {
    const w = x2 - x1, d = z2 - z1;
    const g = uvScale(new THREE.PlaneGeometry(w, d), w / 2, d / 2);
    const m = mesh(g, mat, [(x1 + x2) / 2, y || 0, (z1 + z2) / 2], [-Math.PI / 2, 0, 0]);
    m.castShadow = false;
    this.scene.add(m);
    return m;
  }
  ceiling(x1, z1, x2, z2) {
    const w = x2 - x1, d = z2 - z1;
    const g = uvScale(new THREE.PlaneGeometry(w, d), w / 0.6, d / 0.6);
    const m = mesh(g, M.ceiling(), [(x1 + x2) / 2, H, (z1 + z2) / 2], [Math.PI / 2, 0, 0]);
    m.castShadow = false;
    this.scene.add(m);
    return m;
  }
  /* a room: rectangle with wall openings per side. openings: {n:[[from,to]],s:..,e:..,w:..} measured from the min corner */
  room(id, x1, z1, x2, z2, o) {
    o = o || {};
    const wallMat = o.wallMat || M.wall(o.wallHex || '#474a55', o.seed || 1);
    const floorMat = o.floorMat || M.floor(o.floorLight || '#dcdcdc', o.floorDark || '#161616', o.seed || 1);
    this.floor(x1, z1, x2, z2, floorMat);
    if (o.ceiling !== false) this.ceiling(x1, z1, x2, z2);
    const band = o.band !== false;
    const op = o.openings || {};
    if (!o.noWalls || !o.noWalls.includes('n')) this.wallWithOpenings(x1, z1, x2, z1, wallMat, op.n, band);
    if (!o.noWalls || !o.noWalls.includes('s')) this.wallWithOpenings(x1, z2, x2, z2, wallMat, op.s, band);
    if (!o.noWalls || !o.noWalls.includes('w')) this.wallWithOpenings(x1, z1, x1, z2, wallMat, op.w, band);
    if (!o.noWalls || !o.noWalls.includes('e')) this.wallWithOpenings(x2, z1, x2, z2, wallMat, op.e, band);
  }
  light(id, type, color, intensity, p, target, o) {
    o = o || {};
    let l;
    if (type === 'spot') {
      l = new THREE.SpotLight(color, intensity, o.distance || 18, o.angle || 0.9, o.penumbra === undefined ? 0.6 : o.penumbra, o.decay || 2);
      l.position.set(p[0], p[1], p[2]);
      l.target.position.set(target[0], target[1], target[2]);
      this.scene.add(l.target);
    } else {
      l = new THREE.PointLight(color, intensity, o.distance || 12, o.decay || 2);
      l.position.set(p[0], p[1], p[2]);
    }
    if (o.shadow) {
      l.castShadow = true;
      l.shadow.mapSize.set(o.shadowSize || 1024, o.shadowSize || 1024);
      l.shadow.bias = -0.0004; l.shadow.normalBias = 0.02;
      l.shadow.camera.near = 0.2; l.shadow.camera.far = o.distance || 18;
    }
    l.visible = false;
    l.userData.base = intensity;
    this.scene.add(l);
    (this.roomLights[id] = this.roomLights[id] || []).push(l);
    return l;
  }
  fixture(p, on) {
    const g = new THREE.Group();
    g.add(box(0.6, 0.06, 1.2, M.matte('#555860'), [0, 0, 0]));
    const panel = box(0.5, 0.01, 1.1, on ? M.emissive('#fff2d0', 1.8) : M.matte('#8a8a80'), [0, -0.035, 0]);
    panel.castShadow = false;
    g.add(panel);
    g.position.set(p[0], p[1], p[2]);
    this.scene.add(g);
    return g;
  }
  cam(id, pos, target, fov, pan, extra) {
    const c = new THREE.PerspectiveCamera(fov, 16 / 9, 0.05, 60);
    c.position.set(pos[0], pos[1], pos[2]);
    this.cams[id] = Object.assign({ camera: c, pos, target, pan, fov }, extra || {});
    return c;
  }

  /* ---- props ------------------------------------------------------------ */
  table(x, z, w, d, hats, rotY) {
    const g = new THREE.Group();
    const top = mesh(uvScale(new THREE.BoxGeometry(w, 0.05, d), w / 1.0, d / 1.0), M.cloth(), [0, 0.75, 0]);
    g.add(top);
    g.add(box(w - 0.1, 0.04, d - 0.1, M.matte('#8a8a8a'), [0, 0.71, 0]));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 10), M.darkMetal(), [sx * (w / 2 - 0.12), 0.35, sz * (d / 2 - 0.12)]));
    const cols = ['#d33a3a', '#3bb273', '#3a6fd8', '#e8c53a', '#c24ac2'];
    for (let i = 0; i < hats; i++) {
      const hx = -w / 2 + (i + 0.5) * (w / hats), hz = (i % 2 ? 0.2 : -0.2) * d;
      const hat = mesh(new THREE.ConeGeometry(0.07, 0.2, 16), M.plastic(cols[i % 5], 0.5), [hx, 0.88, hz]);
      g.add(hat);
      const pom = mesh(new THREE.SphereGeometry(0.02, 8, 6), M.plastic('#ffffff', 0.6), [hx, 0.99, hz]); pom.castShadow = false; g.add(pom);
      // paper plate + cup
      if (i % 2 === 0) { const plate = mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.01, 20), M.plastic('#eeeeee', 0.7), [hx + 0.25, 0.78, hz]); g.add(plate); }
      else { const cup = mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.1, 14), M.plastic('#d8d8d8', 0.6), [hx - 0.22, 0.83, hz + 0.1]); g.add(cup); }
    }
    // chairs
    for (const sz of [-1, 1]) for (let i = 0; i < Math.max(1, Math.round(w / 1.2)); i++) {
      const cx = -w / 2 + (i + 0.5) * (w / Math.max(1, Math.round(w / 1.2)));
      const ch = new THREE.Group();
      ch.add(box(0.4, 0.04, 0.4, M.plastic('#c0392b', 0.6), [0, 0.45, 0]));
      ch.add(box(0.4, 0.42, 0.04, M.plastic('#c0392b', 0.6), [0, 0.68, -0.18]));
      for (const a of [-1, 1]) for (const b of [-1, 1]) ch.add(mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.45, 8), M.darkMetal(), [a * 0.17, 0.22, b * 0.17]));
      ch.position.set(cx, 0, sz * (d / 2 + 0.3)); ch.rotation.y = sz < 0 ? 0 : Math.PI;
      g.add(ch);
    }
    g.position.set(x, 0, z); if (rotY) g.rotation.y = rotY;
    this.scene.add(g);
    return g;
  }
  curtain(x, y, z, w, h, mat, rotY, folds) {
    const seg = Math.max(24, Math.round(w * 12));
    const g = new THREE.PlaneGeometry(w, h, seg, 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      pos.setZ(i, Math.sin((px / w) * Math.PI * 2 * (folds || 7)) * 0.06);
    }
    g.computeVertexNormals();
    uvScale(g, w / 2.5, h / 3);
    const m = mesh(g, mat, [x, y, z], [0, rotY || 0, 0]);
    this.scene.add(m);
    return m;
  }
  poster(kind, x, y, z, w, h, rotY) {
    const m = mesh(new THREE.PlaneGeometry(w, h), M.poster(kind), [x, y, z], [0, rotY || 0, 0]);
    m.castShadow = false;
    this.scene.add(m);
    return m;
  }
  shelf(x, y, z, w, rotY, items) {
    const g = new THREE.Group();
    g.add(box(w, 0.04, 0.35, M.wood(), [0, 0, 0]));
    for (const s of [-1, 1]) g.add(box(0.04, 0.5, 0.35, M.wood(), [s * (w / 2 - 0.02), -0.25, 0]));
    const cols = ['#3bb273', '#d33a3a', '#3a6fd8', '#eeeeee', '#e8c53a', '#8a8a8a'];
    for (let i = 0; i < items; i++) {
      const ix = -w / 2 + 0.15 + i * ((w - 0.3) / Math.max(1, items - 1));
      const hgt = 0.15 + ((i * 37) % 10) * 0.02, r = 0.04 + ((i * 13) % 5) * 0.008;
      g.add(mesh(new THREE.CylinderGeometry(r, r, hgt, 12), M.plastic(cols[i % 6], 0.4), [ix, 0.02 + hgt / 2, 0.02]));
      g.add(mesh(new THREE.CylinderGeometry(r * 0.5, r * 0.5, 0.03, 10), M.black(), [ix, 0.035 + hgt, 0.02]));
    }
    g.position.set(x, y, z); g.rotation.y = rotY || 0;
    this.scene.add(g);
    return g;
  }
  doorPanel(x, y, z, w, h, rotY, signText) {
    const g = new THREE.Group();
    g.add(box(w, h, 0.05, M.wood(), [0, h / 2, 0]));
    g.add(box(w + 0.16, 0.1, 0.1, M.matte('#2a2a2e'), [0, h + 0.05, 0]));
    g.add(mesh(new THREE.SphereGeometry(0.03, 10, 8), M.metal(), [w / 2 - 0.12, h * 0.45, 0.05]));
    if (signText) { const s = mesh(new THREE.PlaneGeometry(0.4, 0.12), M.sign([signText], ['#222']), [0, h * 0.75, 0.03]); s.castShadow = false; g.add(s); }
    g.position.set(x, y, z); g.rotation.y = rotY || 0;
    this.scene.add(g);
    return g;
  }
  trashCan(x, z) {
    const c = mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.6, 20), M.darkMetal(), [x, 0.3, z]);
    this.scene.add(c);
    const lid = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 20), M.darkMetal(), [x, 0.61, z]);
    this.scene.add(lid);
  }
  cupcake(p) {
    const c = new THREE.Group();
    c.add(mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.01, 32), M.plastic('#dddddd', 0.3), [0, 0, 0]));
    c.add(mesh(new THREE.CylinderGeometry(0.06, 0.045, 0.08, 20), M.matte('#7a2a1a'), [0, 0.045, 0]));
    c.add(mesh(new THREE.SphereGeometry(0.07, 24, 16), M.plastic('#e8559a', 0.4), [0, 0.11, 0], null, [1, 0.8, 1]));
    for (const s of [-1, 1]) { c.add(mesh(new THREE.SphereGeometry(0.018, 12, 8), M.sclera(false), [s * 0.03, 0.12, 0.055])); c.add(mesh(new THREE.SphereGeometry(0.008, 8, 6), M.pupil(), [s * 0.03, 0.12, 0.07])); }
    c.add(box(0.04, 0.012, 0.01, M.teeth(), [0, 0.085, 0.07]));
    c.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.08, 8), M.plastic('#eeeeee', 0.5), [0, 0.19, 0]));
    const flame = mesh(new THREE.ConeGeometry(0.012, 0.03, 8), M.emissive('#ffb347', 3), [0, 0.245, 0]); flame.castShadow = false; c.add(flame);
    c.position.set(p[0], p[1], p[2]);
    this.scene.add(c);
    return c;
  }

  /* ---- the building ----------------------------------------------------- */
  build() {
    const S = this.scene;
    const wallA = M.wall('#474a55', 1), wallB = M.wall('#4a4a4a', 2), wallC = M.wall('#3e4350', 3);
    const floorA = M.floor('#dcdcdc', '#161616', 1), floorB = M.floor('#c9c9c9', '#1a1a1a', 2);

    /* OFFICE ------------------------------------------------------------ */
    this.room('office', -3.5, -2.5, 3.5, 2.5, {
      wallMat: wallC, floorMat: floorA,
      openings: { w: [[1.05, 2.35]], e: [[1.05, 2.35], [0.1, 0.9, { yFrom: 1.0, yTo: 2.2 }]] },
    });
    this.buildOffice();

    /* WEST SIDE ---------------------------------------------------------- */
    // 2B corner
    this.room('2B', -6.8, -2.2, -3.5, 0.8, { wallMat: wallA, floorMat: floorA, openings: { e: [[0.75, 2.05]], n: [[0.3, 2.3]] }, noWalls: ['e'] });
    // 2A hall
    this.room('2A', -6.5, -18, -4.5, -2.2, { wallMat: wallA, floorMat: floorA, openings: { w: [[9, 10.4]] }, noWalls: ['s', 'n'] });
    // 3 closet
    this.room('3', -10, -9.2, -6.5, -6.2, { wallMat: wallB, floorMat: floorB, openings: { e: [[0.2, 1.6]] }, noWalls: ['e'], band: false });
    /* EAST SIDE ---------------------------------------------------------- */
    this.room('4B', 3.5, -2.2, 6.8, 0.8, { wallMat: wallA, floorMat: floorA, openings: { w: [[0.75, 2.05]], n: [[1.0, 3.0]] }, noWalls: ['w'] });
    this.room('4A', 4.5, -18, 6.5, -2.2, { wallMat: wallA, floorMat: floorA, noWalls: ['s', 'n'] });
    /* DINING + STAGE ----------------------------------------------------- */
    this.room('1B', -9, -36.5, 9, -18, { wallMat: wallA, floorMat: floorA, openings: { s: [[2.5, 4.5], [13.5, 15.5]], w: [[10.5, 15.5], [3.5, 5.5]], e: [[9.5, 13.5]] } });
    /* PIRATE COVE -------------------------------------------------------- */
    this.room('1C', -16, -26, -9, -20, { wallMat: wallC, floorMat: floorA, openings: { e: [[1.0, 5.0]] }, noWalls: ['e'] });
    /* BACKSTAGE ---------------------------------------------------------- */
    this.room('5', -16, -36.5, -9, -29, { wallMat: wallB, floorMat: floorB, openings: { e: [[3.5, 5.5]] }, noWalls: ['e'], band: false });
    /* RESTROOMS ---------------------------------------------------------- */
    this.room('7', 9, -29, 16, -22, { wallMat: M.tileWall(), floorMat: M.floor('#bdbdbd', '#4a4a4a', 3), openings: { w: [[2.0, 6.0]] }, noWalls: ['w'], band: false });
    /* KITCHEN (never seen, keep the shell) ------------------------------- */
    this.room('6', 9, -19, 16, -13, { wallMat: wallB, floorMat: floorB, band: false });

    this.buildStage();
    this.buildDining();
    this.buildCove();
    this.buildHalls();
    this.buildCloset();
    this.buildBackstage();
    this.buildRestrooms();
    this.buildCameras();
    this.buildAnimatronics();
    this.hemi = new THREE.HemisphereLight(0x1a2030, 0x060608, 0.08);
    S.add(this.hemi);
  }

  buildOffice() {
    const S = this.scene, P = this.officeParts;
    // desk
    S.add(box(4.4, 0.08, 1.3, M.matte('#5a5f6a'), [0, 0.78, -1.65]));
    S.add(box(4.4, 0.72, 0.05, M.matte('#3a3e46'), [0, 0.37, -1.02]));
    for (const s of [-1, 1]) S.add(box(0.05, 0.72, 1.25, M.matte('#3a3e46'), [s * 2.17, 0.37, -1.65]));
    // fan
    const fan = new THREE.Group();
    fan.add(mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.03, 24), M.darkMetal(), [0, 0.015, 0]));
    fan.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.36, 10), M.darkMetal(), [0, 0.2, 0]));
    const cage = new THREE.Group();
    cage.add(mesh(new THREE.TorusGeometry(0.24, 0.008, 8, 48), M.metal(), [0, 0, 0]));
    cage.add(mesh(new THREE.TorusGeometry(0.12, 0.006, 8, 32), M.metal(), [0, 0, 0.03]));
    for (let i = 0; i < 12; i++) { const r = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.46, 6), M.metal(), [0, 0, 0.0], [0, 0, i * Math.PI / 12]); cage.add(r); }
    cage.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.12, 16), M.darkMetal(), [0, 0, -0.06], [Math.PI / 2, 0, 0]));
    const blades = new THREE.Group();
    for (let i = 0; i < 4; i++) { const b = mesh(new THREE.BoxGeometry(0.2, 0.06, 0.008), M.plastic('#cfd3da', 0.4), [0.11, 0, 0.02], [0.35, 0, 0]); const bg = new THREE.Group(); bg.rotation.z = i * Math.PI / 2; bg.add(b); blades.add(bg); }
    cage.add(blades);
    cage.position.set(0, 0.5, 0.03); cage.rotation.y = 0.5;
    fan.add(cage);
    fan.position.set(-1.35, 0.82, -1.7);
    S.add(fan);
    P.fanBlades = blades;
    // monitors
    const mon = (x, y, z, ry, w, h) => {
      const g = new THREE.Group();
      g.add(box(w, h, 0.36, M.matte('#2b2d33'), [0, h / 2, 0]));
      const screen = mesh(new THREE.PlaneGeometry(w - 0.06, h - 0.07), M.screen(), [0, h / 2, 0.181]); screen.castShadow = false;
      g.add(screen);
      g.add(box(w * 0.5, 0.05, 0.2, M.matte('#1b1d24'), [0, -0.025, 0]));
      g.position.set(x, y, z); g.rotation.y = ry;
      S.add(g);
      return screen;
    };
    P.screens = [mon(0.25, 0.87, -1.95, -0.1, 0.42, 0.34), mon(1.3, 0.84, -2.0, 0.25, 0.34, 0.28)];
    // phone
    S.add(box(0.22, 0.06, 0.16, M.plastic('#1a1a1e', 0.5), [1.95, 0.85, -1.45]));
    S.add(mesh(new THREE.CapsuleGeometry(0.025, 0.16, 6, 12), M.plastic('#2d2d33', 0.5), [1.95, 0.9, -1.49], [0, 0, Math.PI / 2]));
    // papers, cup, cupcake
    for (const [x, z, r, seed] of [[-0.3, -1.3, 0.2, 1], [0.8, -1.25, -0.4, 2], [-0.8, -1.5, 0.05, 3]]) { const p = mesh(new THREE.PlaneGeometry(0.21, 0.3), M.paper(seed), [x, 0.825, z], [-Math.PI / 2, 0, r]); p.castShadow = false; S.add(p); }
    S.add(mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.14, 16), M.plastic('#c42b2b', 0.4), [-0.55, 0.89, -1.3]));
    S.add(mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.16, 6), M.plastic('#eeeeee', 0.5), [-0.54, 1.0, -1.3], [0.3, 0, 0.2]));
    this.cupcake([1.7, 0.82, -1.95]);
    // posters & drawings on the back wall
    this.poster('celebrate', -0.4, 1.7, -2.41, 0.62, 0.78);
    this.poster('rules', 0.95, 1.78, -2.41, 0.36, 0.46);
    for (let i = 0; i < 3; i++) { const d = mesh(new THREE.PlaneGeometry(0.2, 0.26), M.drawing(300 + i), [-2.2 + i * 0.3, 1.75 + (i % 2) * 0.1, -2.41]); d.castShadow = false; S.add(d); }
    // nose hit box (invisible)
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.04), new THREE.MeshBasicMaterial({ visible: false }));
    nose.position.set(-0.4, 1.7 + 0.08, -2.4); nose.name = 'nose'; S.add(nose); P.nose = nose;
    // doors (sliding down from the ceiling)
    const doorMat = M.metal();
    const mkDoor = (x) => {
      const d = mesh(uvScale(new THREE.BoxGeometry(0.08, 2.4, 1.3), 1, 2), doorMat, [x, 3.6, -0.8]);
      // ribs
      for (let i = 0; i < 6; i++) d.add(box(0.1, 0.05, 1.2, M.darkMetal(), [0, -1.1 + i * 0.4, 0]));
      S.add(d);
      // frame
      S.add(box(0.2, 0.12, 1.5, M.matte('#2a2c31'), [x, 2.46, -0.8]));
      for (const s of [-1, 1]) S.add(box(0.2, 2.4, 0.1, M.matte('#2a2c31'), [x, 1.2, -0.8 + s * 0.7]));
      return d;
    };
    P.leftDoor = mkDoor(-3.5); P.rightDoor = mkDoor(3.5);
    // window frame + glass
    S.add(box(0.1, 0.08, 0.9, M.matte('#4a4c54'), [3.5, 2.24, -2.0]));
    S.add(box(0.1, 0.08, 0.9, M.matte('#4a4c54'), [3.5, 0.96, -2.0]));
    S.add(box(0.1, 1.2, 0.06, M.matte('#4a4c54'), [3.5, 1.6, -2.0]));
    const glass = mesh(new THREE.PlaneGeometry(0.8, 1.2), M.glass(), [3.5, 1.6, -2.0], [0, -Math.PI / 2, 0]); glass.castShadow = false; glass.receiveShadow = false; S.add(glass);
    // button panels
    const mkPanel = (x, s) => {
      S.add(box(0.06, 0.5, 0.26, M.matte('#17181c'), [x, 1.35, 0.35]));
      const door = mesh(new THREE.BoxGeometry(0.05, 0.12, 0.1), M.button('#7a1d1a', false), [x + s * 0.04, 1.47, 0.35]); door.name = x < 0 ? 'ldoor' : 'rdoor'; S.add(door);
      const light = mesh(new THREE.BoxGeometry(0.05, 0.12, 0.1), M.button('#8a8a8a', false), [x + s * 0.04, 1.23, 0.35]); light.name = x < 0 ? 'llight' : 'rlight'; S.add(light);
      return { door, light };
    };
    P.lpanel = mkPanel(-3.44, 1); P.rpanel = mkPanel(3.44, -1);
    P.pickables = [P.lpanel.door, P.lpanel.light, P.rpanel.door, P.rpanel.light, nose];
    // vent + cables
    S.add(box(0.9, 0.35, 0.06, M.darkMetal(), [1.8, 2.85, -2.44]));
    for (let i = 0; i < 4; i++) S.add(box(0.8, 0.03, 0.02, M.black(), [1.8, 2.75 + i * 0.07, -2.4]));
    // lights
    P.ceilingLight = this.light('office', 'spot', 0xffe6c0, 22, [0, 3.1, -0.6], [0, 0, -1.2], { angle: 1.15, penumbra: 0.8, distance: 10, shadow: true, shadowSize: 1024 });
    this.fixture([0, 3.13, -0.6], false);
    P.monitorGlow = this.light('office', 'point', 0x7088ff, 3.5, [0.7, 1.15, -1.6], null, { distance: 5 });
    P.leftLight = this.light('office', 'spot', 0xfff2dc, 34, [-2.7, 2.55, -0.3], [-5.0, 0.9, -1.0], { angle: 0.62, penumbra: 0.7, distance: 11, shadow: true, shadowSize: 1024 });
    P.rightLight = this.light('office', 'spot', 0xfff2dc, 34, [2.7, 2.55, -0.3], [5.0, 0.9, -1.0], { angle: 0.62, penumbra: 0.7, distance: 11, shadow: true, shadowSize: 1024 });
    P.leftLight.visible = false; P.rightLight.visible = false;
    P.eyeLight = this.light('office', 'point', 0x3b4a6a, 0.9, [-3.9, 1.9, -0.8], null, { distance: 4 });
    // office camera
    const cam = new THREE.PerspectiveCamera(64, 16 / 9, 0.05, 40);
    cam.position.set(0, 1.45, 1.1);
    P.camera = cam;
  }

  buildStage() {
    const S = this.scene;
    // platform
    S.add(mesh(uvScale(new THREE.BoxGeometry(12, 0.6, 3.2), 6, 1), M.wood(), [0, 0.3, -34.9]));
    S.add(box(12, 0.6, 0.06, M.matte('#5a1f2a'), [0, 0.3, -33.3]));
    // back curtain with stars, side curtains, valance
    this.curtain(0, 1.9, -36.35, 12, 2.6, M.curtain('#3b1e5e', 60, 1), 0, 14);
    this.curtain(-5.4, 1.9, -33.4, 1.6, 2.6, M.curtain('#7a1a24', 0, 2), 0, 4);
    this.curtain(5.4, 1.9, -33.4, 1.6, 2.6, M.curtain('#7a1a24', 0, 2), 0, 4);
    this.curtain(0, 2.95, -33.35, 12, 0.5, M.curtain('#8a2030', 0, 3), 0, 22);
    // stage lights (fixtures on a bar) + spots
    S.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 10, 8), M.darkMetal(), [0, 3.0, -31.5], [0, 0, Math.PI / 2]));
    for (const x of [-2.2, 0, 2.2]) {
      S.add(mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.25, 12), M.black(), [x, 2.9, -31.5], [-0.6, 0, 0]));
      this.light('1A', 'spot', x === 0 ? 0xffe8c8 : 0xffd0a0, 110, [x, 2.75, -31.7], [x, 0.6, -35], { angle: 0.5, penumbra: 0.6, distance: 10, shadow: x === 0, shadowSize: 1024 });
    }
    this.light('1A', 'spot', 0xa0b0ff, 30, [0, 3.1, -28], [0, 0, -31], { angle: 1.1, penumbra: 0.9, distance: 12 });
    // stars on the back wall above curtain
    for (let i = 0; i < 14; i++) { const st = mesh(new THREE.ConeGeometry(0.06, 0.02, 5), M.plastic('#ffe9a0', 0.5), [-5.5 + i * 0.85, 2.95 + (i % 2) * 0.12, -36.3], [Math.PI / 2, 0, 0]); st.castShadow = false; S.add(st); }
  }

  buildDining() {
    const S = this.scene;
    this.table(-5.0, -22.5, 3.0, 1.0, 4);
    this.table(5.0, -22.5, 3.0, 1.0, 4);
    this.table(-5.0, -26.5, 3.0, 1.0, 4);
    this.table(5.0, -26.5, 3.0, 1.0, 4);
    this.table(-5.0, -30.5, 3.0, 1.0, 3);
    this.table(5.0, -30.5, 3.0, 1.0, 3);
    this.table(0, -21.0, 2.4, 1.0, 3);
    // streamers
    for (let i = 0; i < 5; i++) {
      const z = -20 - i * 3;
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-9, 3.1, z), new THREE.Vector3(-4, 2.6, z + 0.3), new THREE.Vector3(0, 2.45, z), new THREE.Vector3(4, 2.6, z - 0.3), new THREE.Vector3(9, 3.1, z)]);
      const t = mesh(new THREE.TubeGeometry(curve, 24, 0.02, 6, false), M.plastic(i % 2 ? '#c0392b' : '#2c82c9', 0.6));
      t.castShadow = false; S.add(t);
    }
    // ceiling fixtures: most off, one dim emergency light
    for (const [x, z] of [[-5, -22], [5, -22], [-5, -28], [5, -28], [0, -25]]) this.fixture([x, 3.13, z], false);
    this.light('1B', 'spot', 0xffdcb0, 140, [0, 3.1, -25], [0, 0, -25], { angle: 1.3, penumbra: 0.7, distance: 22, shadow: true, shadowSize: 2048 });
    this.light('1B', 'point', 0xff6a3a, 12, [8.6, 2.6, -18.3], null, { distance: 9 });   // red exit light
    this.light('1B', 'spot', 0x9aa8ff, 40, [-7, 3.0, -30], [-5, 0, -31], { angle: 1.1, penumbra: 0.8, distance: 14 });
    this.light('1B', 'spot', 0xffdcb0, 40, [6, 3.0, -21], [6, 0, -22], { angle: 1.1, penumbra: 0.8, distance: 12 });
    // exit sign
    const sign = mesh(new THREE.BoxGeometry(0.5, 0.18, 0.05), M.emissive('#ff3020', 2.0), [8.6, 2.7, -18.2]); sign.castShadow = false; S.add(sign);
    // kids' balloons on a wall
    for (let i = 0; i < 4; i++) { const b = mesh(new THREE.SphereGeometry(0.15, 16, 12), M.plastic(['#d33a3a', '#3bb273', '#e8c53a', '#3a6fd8'][i], 0.3), [-8.8, 2.4 + (i % 2) * 0.25, -24 - i * 0.5], null, [1, 1.2, 1]); S.add(b); }
  }

  buildCove() {
    const S = this.scene;
    S.add(mesh(uvScale(new THREE.BoxGeometry(2.6, 0.4, 5.8), 1, 3), M.wood(), [-14.7, 0.2, -23]));
    S.add(box(0.06, 0.4, 5.8, M.matte('#4a1f2a'), [-13.4, 0.2, -23]));
    // curtain parts along x = -13.4 facing east; two halves that can part
    const mat = M.curtain('#3b1e5e', 40, 4);
    const left = this.curtain(0, 0, 0, 2.9, 2.75, mat, Math.PI / 2, 6);
    const right = this.curtain(0, 0, 0, 2.9, 2.75, mat, Math.PI / 2, 6);
    S.remove(left); S.remove(right);
    const grp = new THREE.Group(); grp.position.set(-13.35, 1.78, -23); grp.add(left, right); S.add(grp);
    this.coveCurtain = { left, right };
    this.setCoveGap(0);
    this.curtain(-13.3, 2.95, -23, 5.8, 0.5, M.curtain('#52287d', 0, 5), Math.PI / 2, 12);
    // sign on a stand
    const stand = new THREE.Group();
    stand.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 10), M.darkMetal(), [0, 0.55, 0]));
    stand.add(mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.03, 20), M.darkMetal(), [0, 0.015, 0]));
    this.coveSign = mesh(new THREE.PlaneGeometry(0.8, 0.5), M.sign(['Sorry!', 'OUT OF ORDER'], ['#222', '#b22']), [0, 1.3, 0.02]);
    this.coveSign.castShadow = false;
    stand.add(this.coveSign);
    stand.position.set(-11.8, 0, -21.6); stand.rotation.y = 1.2;
    S.add(stand);
    this.light('1C', 'spot', 0xc8b0ff, 55, [-11.5, 3.1, -23], [-14, 0.4, -23], { angle: 0.95, penumbra: 0.7, distance: 10, shadow: true });
    this.light('1C', 'point', 0xff8050, 6, [-9.3, 2.5, -20.3], null, { distance: 6 });
  }
  setCoveGap(gap) {
    // gap 0..1: fraction of the 5.8 m width left open in the middle
    const half = 2.9, open = gap * 2.7;
    this.coveCurtain.left.position.z = -half / 2 - open / 2;
    this.coveCurtain.right.position.z = half / 2 + open / 2;
    const sx = Math.max(0.05, 1 - open / half);
    this.coveCurtain.left.scale.x = sx; this.coveCurtain.right.scale.x = sx;
    this.coveCurtain.left.position.z = -(half * sx) / 2 - open / 2;
    this.coveCurtain.right.position.z = (half * sx) / 2 + open / 2;
  }

  buildHalls() {
    const S = this.scene;
    // posters & props in the halls
    this.poster('celebrate', -6.41, 1.6, -9.5, 0.7, 0.88, Math.PI / 2);
    this.poster('rules', 6.41, 1.65, -9.5, 0.5, 0.64, -Math.PI / 2);
    this.trashCan(-4.85, -6.5); this.trashCan(4.85, -6.5);
    for (let z = -4; z > -17; z -= 3.5) { this.fixture([-5.5, 3.13, z], false); this.fixture([5.5, 3.13, z], false); }
    // hall lights: dim, flickering tube at the far end
    for (const [id, x] of [['2A', -5.5], ['4A', 5.5]]) {
      this.light(id, 'spot', 0xffe0c0, 70, [x, 3.1, -14.5], [x, 0, -14.5], { angle: 1.15, penumbra: 0.8, distance: 16, shadow: true });
      this.light(id, 'spot', 0xc0c8e0, 28, [x, 3.1, -9], [x, 0, -9.5], { angle: 1.2, penumbra: 0.9, distance: 10 });
      this.light(id, 'spot', 0x8090c0, 18, [x, 3.1, -4.5], [x, 0, -5], { angle: 1.2, penumbra: 0.9, distance: 9 });
    }
    // corners
    this.poster('celebrate', -5.1, 1.6, -2.12, 0.6, 0.76, 0);
    this.goldenPoster = this.poster('golden', -5.1, 1.6, -2.115, 0.6, 0.76, 0); this.goldenPoster.visible = false;
    for (let i = 0; i < 4; i++) { const d = mesh(new THREE.PlaneGeometry(0.26, 0.33), M.drawing(400 + i), [4.3 + i * 0.5, 1.65 + (i % 2) * 0.12, -2.12]); d.castShadow = false; S.add(d); }
    this.light('2B', 'spot', 0xffe0c0, 24, [-6.0, 3.1, 0.2], [-5.0, 0, -1.4], { angle: 1.0, penumbra: 0.8, distance: 9, shadow: true });
    this.light('4B', 'spot', 0xffe0c0, 26, [4.6, 3.1, 0.3], [4.4, 0, -1.6], { angle: 0.9, penumbra: 0.8, distance: 9, shadow: true });
    // kitchen door on the east hall
    this.doorPanel(6.46, 0, -13.3, 1.2, 2.3, -Math.PI / 2, 'KITCHEN');
    this.light('6', 'point', 0xffffff, 0.1, [12, 3, -16], null, {});
  }

  buildCloset() {
    const S = this.scene;
    for (let i = 0; i < 3; i++) this.shelf(-8.25, 1.0 + i * 0.6, -9.0, 3.2, 0, 7);
    this.shelf(-9.8, 1.0, -7.7, 2.6, Math.PI / 2, 6);
    // mop & bucket
    S.add(mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.35, 16), M.plastic('#c9c31a', 0.5), [-7.2, 0.175, -6.9]));
    S.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.5, 8), M.wood(), [-7.15, 0.9, -6.75], [0.25, 0, 0.1]));
    S.add(mesh(new THREE.SphereGeometry(0.12, 12, 8), M.matte('#dddddd'), [-7.05, 0.2, -6.6], null, [1, 0.6, 1]));
    this.light('3', 'point', 0xffe0c0, 16, [-8.2, 2.9, -7.6], null, { distance: 8, shadow: true, shadowSize: 512 });
  }

  buildBackstage() {
    const S = this.scene;
    // shelves with spare heads
    for (let i = 0; i < 2; i++) {
      const y = 1.1 + i * 0.75;
      S.add(box(5.5, 0.04, 0.5, M.wood(), [-13.0, y, -36.1]));
      const names = ['freddy', 'bonnie', 'chica', 'freddy', 'bonnie'];
      for (let j = 0; j < 5; j++) {
        const head = createAnimatronic(names[(j + i) % 5], { mic: false, cupcake: false, guitar: false });
        // only keep the head
        const hg = head.head.group.clone();
        hg.position.set(-15.2 + j * 1.1, y + 0.02 - 0.3, -36.1); hg.scale.setScalar(0.85);
        hg.rotation.y = (j - 2) * 0.25 + (i ? 0.3 : -0.2);
        hg.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
        S.add(hg);
        this.backstageHeads = this.backstageHeads || [];
        this.backstageHeads.push(head);
      }
    }
    for (const h of this.backstageHeads) h.setEyes('black');
    // table with an endoskeleton sitting on it
    S.add(box(2.0, 0.05, 1.0, M.matte('#8a8a8a'), [-10.5, 0.75, -33.5]));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) S.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.75, 10), M.darkMetal(), [-10.5 + sx * 0.9, 0.37, -33.5 + sz * 0.42]));
    const endo = new THREE.Group();
    const mm = M.metal();
    endo.add(mesh(new THREE.SphereGeometry(0.2, 24, 16), mm, [0, 1.55, 0]));
    for (const s of [-1, 1]) { endo.add(mesh(new THREE.SphereGeometry(0.06, 12, 8), M.black(), [s * 0.08, 1.58, 0.16])); endo.add(mesh(new THREE.SphereGeometry(0.02, 8, 6), M.emissive('#ffffff', 1.5), [s * 0.08, 1.58, 0.2])); }
    endo.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 10), mm, [0, 1.3, 0]));
    for (let i = 0; i < 5; i++) endo.add(mesh(new THREE.TorusGeometry(0.18, 0.015, 8, 24, Math.PI), mm, [0, 1.15 - i * 0.1, 0], [0, 0, Math.PI]));
    endo.add(mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.7, 10), mm, [0, 0.9, 0]));
    for (const s of [-1, 1]) {
      endo.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), mm, [s * 0.28, 1.0, 0], [0, 0, s * 0.3]));
      endo.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.45, 8), mm, [s * 0.36, 0.6, 0.1], [0.4, 0, s * 0.1]));
      endo.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.6, 8), mm, [s * 0.12, 0.55, 0.35], [Math.PI / 2 - 0.3, 0, 0]));
      endo.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 8), mm, [s * 0.12, 0.3, 0.75], [0.3, 0, 0]));
    }
    endo.position.set(-10.3, 0.8, -33.4); endo.rotation.y = 0.5;
    endo.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    S.add(endo);
    // boxes
    S.add(box(0.8, 0.6, 0.6, M.matte('#8a6a40'), [-15.4, 0.3, -30.0]));
    S.add(box(0.6, 0.5, 0.6, M.matte('#8a6a40'), [-15.3, 0.85, -30.1], [0, 0.3, 0]));
    this.light('5', 'point', 0xffe0c0, 26, [-12, 2.85, -32], null, { distance: 11, shadow: true, shadowSize: 1024 });
  }

  buildRestrooms() {
    const S = this.scene;
    this.doorPanel(15.95, 0, -27.0, 1.0, 2.2, -Math.PI / 2, 'LADIES');
    this.doorPanel(15.95, 0, -24.0, 1.0, 2.2, -Math.PI / 2, 'GENTS');
    // sinks + mirror on the north wall
    for (let i = 0; i < 2; i++) {
      S.add(box(0.6, 0.15, 0.45, M.plastic('#f0f0f0', 0.2), [11 + i * 1.2, 0.85, -28.6]));
      S.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 8), M.metal(), [11 + i * 1.2, 1.0, -28.75]));
    }
    const mirror = mesh(new THREE.PlaneGeometry(2.6, 1.0), new THREE.MeshStandardMaterial({ color: 0x9aa4ad, metalness: 1, roughness: 0.15 }), [11.6, 1.7, -28.9]); mirror.castShadow = false; S.add(mirror);
    S.add(box(0.3, 0.4, 0.2, M.plastic('#dddddd', 0.3), [15.9, 1.4, -25.5]));   // hand dryer
    this.light('7', 'spot', 0xdce8ff, 70, [12.5, 3.1, -25.5], [12.5, 0, -25.5], { angle: 1.25, penumbra: 0.7, distance: 14, shadow: true });
    this.light('7', 'point', 0xffffff, 3, [15, 2.5, -23], null, { distance: 7 });
  }

  buildCameras() {
    this.cam('1A', [0, 2.9, -29.0], [0, 1.3, -34.8], 50, 0.1);
    this.cam('1B', [-8.6, 3.05, -18.4], [2, 0.5, -27], 72, 0.14);
    this.cam('1C', [-9.3, 2.95, -20.3], [-14.3, 0.8, -23.5], 62, 0.08);
    this.cam('2A', [-5.5, 2.98, -2.5], [-5.5, 0.6, -18], 58, 0.05);
    this.cam('2B', [-6.6, 2.98, 0.6], [-4.3, 1.1, -1.4], 82, 0.05);
    this.cam('3', [-9.8, 2.95, -6.4], [-8.0, 0.8, -8.7], 76, 0.04);
    this.cam('4A', [5.5, 2.98, -2.5], [5.5, 0.6, -18], 58, 0.05);
    this.cam('4B', [6.6, 2.98, 0.6], [4.3, 1.1, -1.4], 82, 0.05);
    this.cam('5', [-9.2, 2.95, -29.2], [-13.2, 0.8, -33.8], 76, 0.06);
    this.cam('7', [9.3, 2.95, -22.3], [13.5, 0.8, -26.5], 70, 0.08);
    this.cam('6', [12, 2.9, -16], [12, 0, -13], 60, 0);
  }

  buildAnimatronics() {
    const S = this.scene;
    this.rigs = {
      freddy: createAnimatronic('freddy'),
      bonnie: createAnimatronic('bonnie', { guitar: true }),
      chica: createAnimatronic('chica'),
      foxy: createAnimatronic('foxy'),
      golden: createAnimatronic('golden', { mic: false }),
    };
    for (const r of Object.values(this.rigs)) { r.group.visible = false; S.add(r.group); }
    // where each character stands for each location [x, z, faceCamId | yaw]
    const cams = this.cams;
    const face = (x, z, camId) => { const c = cams[camId].pos; return Math.atan2(c[0] - x, c[2] - z); };
    this.spots = {
      freddy: { '1A': [0, -35, face(0, -35, '1A')], '1B': [0.5, -28, face(0.5, -28, '1B')], '7': [14, -26.5, face(14, -26.5, '7')], '4A': [5.5, -11.5, face(5.5, -11.5, '4A')], '4B': [6.1, -1.75, face(6.1, -1.75, '4B')], 'POWEROUT': [-4.1, -0.8, Math.PI / 2] },
      bonnie: { '1A': [-2.3, -35, face(-2.3, -35, '1A')], '1B': [-3, -24, face(-3, -24, '1B')], '5': [-11.0, -31.3, face(-11.0, -31.3, '5')], '2A': [-5.5, -9.5, face(-5.5, -9.5, '2A')], '3': [-8.3, -8.0, face(-8.3, -8.0, '3')], '2B': [-5.1, -0.5, face(-5.1, -0.5, '2B')], 'LDOOR': [-4.0, -0.8, Math.PI / 2] },
      chica: { '1A': [2.3, -35, face(2.3, -35, '1A')], '1B': [3, -23, face(3, -23, '1B')], '7': [11.5, -25.5, face(11.5, -25.5, '7')], '6': [12, -16, 0], '4A': [5.5, -9, face(5.5, -9, '4A')], '4B': [5.1, -0.5, face(5.1, -0.5, '4B')], 'RDOOR': [4.0, -0.8, -Math.PI / 2] },
      golden: { 'OFFICE': [0, -0.35, 0] },
    };
  }

  /* ---- per-frame state ---------------------------------------------- */
  setActiveLights(ids) {
    for (const [id, arr] of Object.entries(this.roomLights)) {
      const on = ids.includes(id);
      for (const l of arr) l.visible = on;
    }
  }
  place(rig, spot, pose, phase, t, eyes) {
    rig.group.visible = true;
    rig.group.position.set(spot[0], 0, spot[1]);
    rig.group.rotation.y = spot[2];
    rig.setPose(pose, phase, t);
    rig.setEyes(eyes || (rig.type === 'golden' ? 'black' : 'normal'));
  }
  hideAll() { for (const r of Object.values(this.rigs)) r.group.visible = false; }
}
