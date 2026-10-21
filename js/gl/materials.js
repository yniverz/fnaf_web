import * as THREE from '../vendor/three.module.js';
import * as TX from './textures.js';
/* ---------------------------------------------------------------------------
 * materials.js - PBR material factory with caching.
 * ------------------------------------------------------------------------- */
const cache = {};
function get(key, make) { if (!cache[key]) cache[key] = make(); return cache[key]; }

export const M = {
  wall: (hex, seed) => get('wall' + hex + seed, () => {
    const t = TX.wallTextures(hex || '#474a55', seed || 1);
    return new THREE.MeshStandardMaterial({ map: t.map, roughnessMap: t.roughnessMap, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.4, 0.4), roughness: 1, metalness: 0 });
  }),
  band: () => get('band', () => new THREE.MeshStandardMaterial({ map: TX.bandTexture().map, roughness: 0.6, metalness: 0 })),
  floor: (light, dark, seed) => get('floor' + light + dark + seed, () => {
    const t = TX.floorTextures(light || '#dcdcdc', dark || '#161616', seed || 1);
    return new THREE.MeshStandardMaterial({ map: t.map, roughnessMap: t.roughnessMap, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.5, 0.5), roughness: 1, metalness: 0.05 });
  }),
  tileWall: () => get('tilewall', () => { const t = TX.tileWallTextures(); return new THREE.MeshStandardMaterial({ map: t.map, roughnessMap: t.roughnessMap, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.5, 0.5), roughness: 1 }); }),
  ceiling: () => get('ceil', () => new THREE.MeshStandardMaterial({ map: TX.ceilingTextures().map, roughness: 0.95 })),
  curtain: (hex, stars, seed) => get('curtain' + hex + stars + seed, () => new THREE.MeshStandardMaterial({ map: TX.curtainTexture(hex, stars, seed || 1).map, roughness: 0.95, side: THREE.DoubleSide })),
  wood: () => get('wood', () => new THREE.MeshStandardMaterial({ map: TX.woodTextures().map, roughness: 0.7 })),
  metal: () => get('metal', () => { const t = TX.metalTextures(); return new THREE.MeshStandardMaterial({ map: t.map, roughnessMap: t.roughnessMap, metalness: 0.9, roughness: 0.5 }); }),
  darkMetal: () => get('darkmetal', () => new THREE.MeshStandardMaterial({ color: 0x3a3c40, metalness: 0.85, roughness: 0.45 })),
  cloth: () => get('cloth', () => new THREE.MeshStandardMaterial({ map: TX.tableClothTexture(), roughness: 0.95 })),
  plastic: (hex, rough) => get('plastic' + hex + rough, () => new THREE.MeshPhysicalMaterial({ color: hex, roughness: rough === undefined ? 0.35 : rough, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.25 })),
  matte: (hex) => get('matte' + hex, () => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.9, metalness: 0 })),
  black: () => get('black', () => new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.95 })),
  mouth: () => get('mouth', () => new THREE.MeshStandardMaterial({ color: 0x1a0505, roughness: 1 })),
  tongue: () => get('tongue', () => new THREE.MeshStandardMaterial({ color: 0x4a1016, roughness: 0.6 })),
  teeth: () => get('teeth', () => new THREE.MeshPhysicalMaterial({ color: 0xe8e4d8, roughness: 0.3, clearcoat: 0.5 })),
  fur: (hex, wear, seed) => get('fur' + hex + wear + seed, () => new THREE.MeshPhysicalMaterial({
    map: TX.furMap(hex, wear === undefined ? 0.5 : wear, seed || 1), bumpMap: TX.furBump(), bumpScale: 0.006, roughness: 0.88, metalness: 0,
    sheen: 0.55, sheenRoughness: 0.7, sheenColor: new THREE.Color(hex).multiplyScalar(0.6),
  })),
  sclera: (glow) => get('sclera' + glow, () => new THREE.MeshPhysicalMaterial({ color: glow ? 0xffffff : 0xf2f2f2, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05, emissive: glow ? 0xffffff : 0x000000, emissiveIntensity: glow ? 2.5 : 0 })),
  blackEye: () => get('blackeye', () => new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: 0.2, clearcoat: 1 })),
  iris: (hex) => get('iris' + hex, () => new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 })),
  pupil: () => get('pupil', () => new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: 0.2, clearcoat: 1 })),
  glint: () => get('glint', () => new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x9a9a9a, emissiveIntensity: 0.35, roughness: 0.1 })),
  poster: (kind) => get('poster' + kind, () => new THREE.MeshStandardMaterial({ map: TX.posterTexture(kind), roughness: 0.9 })),
  drawing: (seed) => get('drawing' + seed, () => new THREE.MeshStandardMaterial({ map: TX.drawingTexture(seed), roughness: 0.9 })),
  sign: (lines, colors) => get('sign' + lines.join('|'), () => new THREE.MeshStandardMaterial({ map: TX.signTexture(lines, colors), roughness: 0.8 })),
  bib: () => get('bib', () => new THREE.MeshStandardMaterial({ map: TX.bibTexture(), roughness: 0.85, side: THREE.DoubleSide })),
  paper: (seed) => get('paper' + seed, () => new THREE.MeshStandardMaterial({ map: TX.paperTexture(seed), roughness: 0.95, side: THREE.DoubleSide })),
  screen: () => get('screen', () => new THREE.MeshStandardMaterial({ color: 0x000000, emissiveMap: TX.staticCanvas().tex, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.3 })),
  screenOff: () => get('screenoff', () => new THREE.MeshPhysicalMaterial({ color: 0x050607, roughness: 0.2, clearcoat: 1 })),
  glass: () => get('glass', () => new THREE.MeshPhysicalMaterial({ color: 0x222a33, roughness: 0.05, metalness: 0, transmission: 0.9, transparent: true, opacity: 0.35, clearcoat: 1 })),
  emissive: (hex, intensity) => get('emis' + hex + intensity, () => new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: intensity })),
  button: (hex, on) => get('btn' + hex + on, () => new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.35, clearcoat: 0.7, emissive: hex, emissiveIntensity: on ? 1.4 : 0.05 })),
};
