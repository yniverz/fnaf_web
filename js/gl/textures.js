import * as THREE from '../vendor/three.module.js';
/* ---------------------------------------------------------------------------
 * textures.js - every texture is painted on a canvas at load time.
 * ------------------------------------------------------------------------- */
const cache = {};

export function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function seeded(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

/* value noise, tileable, returns Float32Array w*h in 0..1 */
export function noise(w, h, cells, octaves, seed) {
  const out = new Float32Array(w * h);
  let amp = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const n = cells << o;
    const rnd = seeded(seed * 7919 + o * 104729 + 13);
    const grid = new Float32Array(n * n);
    for (let i = 0; i < n * n; i++) grid[i] = rnd();
    for (let y = 0; y < h; y++) {
      const gy = (y / h) * n, y0 = Math.floor(gy), fy = gy - y0, y1 = (y0 + 1) % n;
      const sy = fy * fy * (3 - 2 * fy);
      for (let x = 0; x < w; x++) {
        const gx = (x / w) * n, x0 = Math.floor(gx), fx = gx - x0, x1 = (x0 + 1) % n;
        const sx = fx * fx * (3 - 2 * fx);
        const a = grid[y0 * n + x0], b = grid[y0 * n + x1], c = grid[y1 * n + x0], d = grid[y1 * n + x1];
        const v = (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
        out[y * w + x] += v * amp;
      }
    }
    total += amp; amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

export function tex(c, o) {
  o = o || {};
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (o.repeat) t.repeat.set(o.repeat[0], o.repeat[1]);
  if (o.srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function heightToNormal(src, strength) {
  const w = src.width, h = src.height;
  const sctx = src.getContext('2d');
  const d = sctx.getImageData(0, 0, w, h).data;
  const out = canvas(w, h), octx = out.getContext('2d');
  const img = octx.createImageData(w, h), od = img.data;
  const hgt = (x, y) => d[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (hgt(x + 1, y) - hgt(x - 1, y)) * strength;
    const dy = (hgt(x, y + 1) - hgt(x, y - 1)) * strength;
    let nx = -dx, ny = -dy, nz = 1;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (y * w + x) * 4;
    od[i] = (nx * 0.5 + 0.5) * 255; od[i + 1] = (ny * 0.5 + 0.5) * 255; od[i + 2] = (nz * 0.5 + 0.5) * 255; od[i + 3] = 255;
  }
  octx.putImageData(img, 0, 0);
  return out;
}

function hexRgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

/* apply per-pixel: fn(x,y,i) -> [r,g,b] */
function paint(w, h, fn) {
  const c = canvas(w, h), ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    const p = fn(x, y, i);
    d[i * 4] = p[0]; d[i * 4 + 1] = p[1]; d[i * 4 + 2] = p[2]; d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/* ---------------------------------------------------------------- walls */
export function wallTextures(baseHex, seed) {
  const key = 'wall' + baseHex + seed;
  if (cache[key]) return cache[key];
  const S = 512;
  const base = hexRgb(baseHex);
  const n1 = noise(S, S, 4, 4, seed), n2 = noise(S, S, 64, 2, seed + 1), n3 = noise(S, S, 2, 3, seed + 2);
  const map = paint(S, S, (x, y, i) => {
    const v = 0.85 + (n1[i] - 0.5) * 0.35 + (n2[i] - 0.5) * 0.12;
    // grime: darker near the floor (bottom of the texture) in vertical streaks
    const grime = Math.pow(y / S, 2.2) * (0.35 + n3[i] * 0.5);
    const k = clamp(v - grime, 0.1, 1.2);
    return [base[0] * k, base[1] * k, base[2] * k];
  });
  const rough = paint(S, S, (x, y, i) => { const r = 200 + (n2[i] - 0.5) * 70; return [r, r, r]; });
  const hgt = paint(S, S, (x, y, i) => { const v = 128 + (n2[i] - 0.5) * 60 + (n1[i] - 0.5) * 30; return [v, v, v]; });
  const normal = heightToNormal(hgt, 1.2);
  cache[key] = { map: tex(map, { srgb: true }), roughnessMap: tex(rough), normalMap: tex(normal) };
  return cache[key];
}

export function bandTexture() {
  if (cache.band) return cache.band;
  const c = canvas(256, 64), ctx = c.getContext('2d');
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i % 2 ? '#d8d8d8' : '#121212'; ctx.fillRect(i * 64, 0, 64, 32);
    ctx.fillStyle = i % 2 ? '#121212' : '#d8d8d8'; ctx.fillRect(i * 64, 32, 64, 32);
  }
  const n = noise(256, 64, 16, 2, 5);
  const img = ctx.getImageData(0, 0, 256, 64), d = img.data;
  for (let i = 0; i < 256 * 64; i++) { const k = 0.75 + n[i] * 0.3; d[i * 4] *= k; d[i * 4 + 1] *= k; d[i * 4 + 2] *= k; }
  ctx.putImageData(img, 0, 0);
  cache.band = { map: tex(c, { srgb: true }) };
  return cache.band;
}

/* ---------------------------------------------------------------- floors */
export function floorTextures(lightHex, darkHex, seed) {
  const key = 'floor' + lightHex + darkHex + seed;
  if (cache[key]) return cache[key];
  const S = 512, tiles = 4, ts = S / tiles, grout = 3;
  const L = hexRgb(lightHex), D = hexRgb(darkHex);
  const n1 = noise(S, S, 8, 3, seed), n2 = noise(S, S, 128, 1, seed + 3), n3 = noise(S, S, 3, 3, seed + 9);
  const rnd = seeded(seed + 77);
  // per tile brightness variation
  const tv = []; for (let i = 0; i < tiles * tiles; i++) tv.push(0.85 + rnd() * 0.3);
  const scratches = canvas(S, S); const sc = scratches.getContext('2d');
  sc.strokeStyle = 'rgba(255,255,255,1)'; sc.lineWidth = 1;
  for (let i = 0; i < 60; i++) { sc.globalAlpha = 0.2 + rnd() * 0.5; sc.beginPath(); const x = rnd() * S, y = rnd() * S; sc.moveTo(x, y); sc.lineTo(x + (rnd() - 0.5) * 80, y + (rnd() - 0.5) * 80); sc.stroke(); }
  const sd = sc.getImageData(0, 0, S, S).data;
  const map = paint(S, S, (x, y, i) => {
    const tx = Math.floor(x / ts), ty = Math.floor(y / ts);
    const inGrout = (x % ts) < grout || (y % ts) < grout;
    if (inGrout) { const g = 40 + n2[i] * 30; return [g, g, g * 0.95]; }
    const col = ((tx + ty) & 1) ? L : D;
    let k = tv[ty * tiles + tx] * (0.92 + (n1[i] - 0.5) * 0.2 + (n2[i] - 0.5) * 0.08);
    k -= Math.pow(n3[i], 3) * 0.45; // grime blotches
    const s = sd[i * 4 + 3] / 255 * 0.5;
    return [clamp(col[0] * k + s * 80, 0, 255), clamp(col[1] * k + s * 80, 0, 255), clamp(col[2] * k + s * 80, 0, 255)];
  });
  const rough = paint(S, S, (x, y, i) => {
    const inGrout = (x % ts) < grout || (y % ts) < grout;
    const r = inGrout ? 230 : 95 + (n1[i] - 0.5) * 60 + Math.pow(n3[i], 2) * 120 + (n2[i] - 0.5) * 30;
    return [r, r, r];
  });
  const hgt = paint(S, S, (x, y, i) => {
    const inGrout = (x % ts) < grout || (y % ts) < grout;
    const v = inGrout ? 60 : 128 + (n2[i] - 0.5) * 18;
    return [v, v, v];
  });
  const normal = heightToNormal(hgt, 2.0);
  cache[key] = { map: tex(map, { srgb: true }), roughnessMap: tex(rough), normalMap: tex(normal) };
  return cache[key];
}

export function tileWallTextures() {
  if (cache.tilewall) return cache.tilewall;
  const S = 512, tiles = 6, ts = S / tiles, grout = 4;
  const n1 = noise(S, S, 8, 3, 21), n2 = noise(S, S, 128, 1, 22), n3 = noise(S, S, 3, 3, 23);
  const map = paint(S, S, (x, y, i) => {
    const inGrout = (x % ts) < grout || (y % ts) < grout;
    if (inGrout) { const g = 150 + n2[i] * 40; return [g, g, g * 0.95]; }
    let k = 0.9 + (n1[i] - 0.5) * 0.15 - Math.pow(n3[i], 3) * 0.35;
    return [clamp(225 * k, 0, 255), clamp(230 * k, 0, 255), clamp(228 * k, 0, 255)];
  });
  const rough = paint(S, S, (x, y, i) => { const inGrout = (x % ts) < grout || (y % ts) < grout; const r = inGrout ? 230 : 60 + n2[i] * 40 + Math.pow(n3[i], 2) * 120; return [r, r, r]; });
  const hgt = paint(S, S, (x, y, i) => { const inGrout = (x % ts) < grout || (y % ts) < grout; const v = inGrout ? 70 : 128; return [v, v, v]; });
  cache.tilewall = { map: tex(map, { srgb: true }), roughnessMap: tex(rough), normalMap: tex(heightToNormal(hgt, 2.0)) };
  return cache.tilewall;
}

export function ceilingTextures() {
  if (cache.ceil) return cache.ceil;
  const S = 256;
  const n1 = noise(S, S, 32, 3, 31), n2 = noise(S, S, 4, 2, 32);
  const map = paint(S, S, (x, y, i) => {
    const edge = x < 3 || y < 3 || x > S - 4 || y > S - 4;
    if (edge) return [40, 40, 42];
    const speck = n1[i] > 0.62 ? -40 : 0;
    const k = 0.75 + (n2[i] - 0.5) * 0.3;
    const v = clamp(190 * k + speck, 0, 255);
    return [v, v * 0.98, v * 0.93];
  });
  cache.ceil = { map: tex(map, { srgb: true }) };
  return cache.ceil;
}

/* -------------------------------------------------------------- curtain */
export function curtainTexture(colorHex, stars, seed) {
  const key = 'curtain' + colorHex + stars + seed;
  if (cache[key]) return cache[key];
  const S = 512;
  const base = hexRgb(colorHex);
  const n = noise(S, S, 48, 2, seed);
  const c = paint(S, S, (x, y, i) => {
    const fold = 0.55 + 0.45 * Math.sin((x / S) * Math.PI * 2 * 7) ** 1;
    const k = clamp(0.35 + fold * 0.8 + (n[i] - 0.5) * 0.15, 0.1, 1.3);
    return [base[0] * k, base[1] * k, base[2] * k];
  });
  if (stars) {
    const ctx = c.getContext('2d'); const rnd = seeded(seed + 5);
    ctx.fillStyle = '#fff8e0';
    for (let i = 0; i < stars; i++) {
      const x = rnd() * S, y = rnd() * S, s = 3 + rnd() * 6;
      ctx.globalAlpha = 0.6 + rnd() * 0.4;
      ctx.beginPath();
      for (let k = 0; k < 10; k++) { const r = k % 2 ? s * 0.45 : s; const a = -Math.PI / 2 + k * Math.PI / 5; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
      ctx.closePath(); ctx.fill();
    }
  }
  cache[key] = { map: tex(c, { srgb: true }) };
  return cache[key];
}

/* ------------------------------------------------------------------ fur */
export function furBump() {
  if (cache.furBump) return cache.furBump;
  const S = 256;
  const n = noise(S, S, 64, 3, 41);
  const c = paint(S, S, (x, y, i) => { const v = n[i] * 255; return [v, v, v]; });
  cache.furBump = tex(c, { repeat: [6, 6] });
  return cache.furBump;
}

export function furMap(colorHex, wear, seed) {
  const key = 'fur' + colorHex + wear + seed;
  if (cache[key]) return cache[key];
  const S = 512;
  const base = hexRgb(colorHex);
  const n1 = noise(S, S, 6, 3, seed), n2 = noise(S, S, 96, 2, seed + 1), n3 = noise(S, S, 3, 2, seed + 2);
  const c = paint(S, S, (x, y, i) => {
    let k = 0.9 + (n1[i] - 0.5) * 0.25 + (n2[i] - 0.5) * 0.1;
    // wear: darkened matted patches and grime
    k -= Math.pow(n3[i], 2.5) * wear * 0.8;
    k = clamp(k, 0.12, 1.2);
    return [base[0] * k, base[1] * k, base[2] * k];
  });
  cache[key] = tex(c, { srgb: true, repeat: [2, 2] });
  return cache[key];
}

/* ---------------------------------------------------------------- metal */
export function metalTextures() {
  if (cache.metal) return cache.metal;
  const S = 256;
  const n = noise(S, S, 2, 1, 51), n2 = noise(S, S, 128, 1, 52);
  const map = paint(S, S, (x, y, i) => { const v = 120 + (n[i] - 0.5) * 60 + (n2[i] - 0.5) * 25 + ((y * 3) % 7 === 0 ? -8 : 0); return [v, v, v * 1.02]; });
  const rough = paint(S, S, (x, y, i) => { const v = 90 + n[i] * 90; return [v, v, v]; });
  cache.metal = { map: tex(map, { srgb: true }), roughnessMap: tex(rough) };
  return cache.metal;
}

export function woodTextures() {
  if (cache.wood) return cache.wood;
  const S = 512;
  const n = noise(S, S, 3, 3, 61), n2 = noise(S, S, 96, 2, 62);
  const map = paint(S, S, (x, y, i) => {
    const plank = Math.floor(y / 64);
    const grain = Math.sin((x / S) * 40 + n[i] * 12 + plank) * 0.5 + 0.5;
    const edge = (y % 64) < 2 ? 0.5 : 1;
    const k = (0.55 + grain * 0.25 + (n2[i] - 0.5) * 0.15) * edge;
    return [95 * k, 62 * k, 38 * k];
  });
  cache.wood = { map: tex(map, { srgb: true }) };
  return cache.wood;
}

/* ------------------------------------------------------------ paper etc */
export function posterTexture(kind) {
  const key = 'poster' + kind;
  if (cache[key]) return cache[key];
  const c = canvas(256, 320), ctx = c.getContext('2d');
  const C = window.FNAF.Chars;
  ctx.fillStyle = '#e8e2d0'; ctx.fillRect(0, 0, 256, 320);
  if (kind === 'celebrate') {
    window.FNAF.text(ctx, 'CELEBRATE!', 128, 10, { font: 'bold 38px ' + window.FNAF.FONT_TITLE, color: '#c0392b', align: 'center' });
    C.draw(ctx, 'bonnie', 'stand', 64, 300, 0.3, { opts: { guitar: true } });
    C.draw(ctx, 'freddy', 'stand', 128, 306, 0.33, {});
    C.draw(ctx, 'chica', 'stand', 192, 300, 0.3, {});
  } else if (kind === 'golden') {
    C.draw(ctx, 'golden', 'face', 128, 318, 0.4, {});
  } else if (kind === 'rules') {
    window.FNAF.text(ctx, 'RULES FOR SAFETY', 128, 12, { size: 20, bold: true, color: '#222', align: 'center' });
    ['1. Don\'t run.', '2. Don\'t yell.', '3. Don\'t scream.', '4. Don\'t poop on floor.', '5. Stay close to mom.', '6. Don\'t touch Freddy.', '7. Don\'t hit.', '8. Leave before dark.'].forEach((r, i) => window.FNAF.text(ctx, r, 18, 50 + i * 30, { size: 16, color: '#333' }));
  }
  // age it
  const n = noise(256, 320, 4, 3, 71);
  const img = ctx.getImageData(0, 0, 256, 320), d = img.data;
  for (let i = 0; i < 256 * 320; i++) { const k = 0.82 + n[i] * 0.22; d[i * 4] *= k; d[i * 4 + 1] *= k * 0.98; d[i * 4 + 2] *= k * 0.9; }
  ctx.putImageData(img, 0, 0);
  cache[key] = tex(c, { srgb: true });
  cache[key].wrapS = cache[key].wrapT = THREE.ClampToEdgeWrapping;
  return cache[key];
}

export function drawingTexture(seed) {
  const key = 'drawing' + seed;
  if (cache[key]) return cache[key];
  const c = canvas(128, 160), ctx = c.getContext('2d');
  const rnd = seeded(seed);
  ctx.fillStyle = '#f1ece0'; ctx.fillRect(0, 0, 128, 160);
  const cols = ['#d33', '#36c', '#3a3', '#e92', '#93c', '#6b4a2b', '#222'];
  for (let i = 0; i < 6; i++) {
    ctx.strokeStyle = cols[Math.floor(rnd() * cols.length)]; ctx.lineWidth = 2 + rnd() * 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(rnd() * 128, rnd() * 160);
    for (let j = 0; j < 4; j++) ctx.lineTo(rnd() * 128, rnd() * 160);
    ctx.stroke();
  }
  ctx.fillStyle = cols[Math.floor(rnd() * cols.length)];
  ctx.beginPath(); ctx.arc(40 + rnd() * 50, 50 + rnd() * 60, 14 + rnd() * 14, 0, Math.PI * 2); ctx.fill();
  cache[key] = tex(c, { srgb: true }); cache[key].wrapS = cache[key].wrapT = THREE.ClampToEdgeWrapping;
  return cache[key];
}

export function signTexture(lines, colors, w, h) {
  const key = 'sign' + lines.join('|');
  if (cache[key]) return cache[key];
  const c = canvas(w || 256, h || 160), ctx = c.getContext('2d');
  ctx.fillStyle = '#e9e5d8'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = '#333'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, c.width - 4, c.height - 4);
  lines.forEach((l, i) => window.FNAF.text(ctx, l, c.width / 2, 20 + i * 60, { font: 'bold ' + (i === 0 ? 44 : 30) + 'px ' + window.FNAF.FONT_TITLE, color: colors[i] || '#222', align: 'center' }));
  cache[key] = tex(c, { srgb: true }); cache[key].wrapS = cache[key].wrapT = THREE.ClampToEdgeWrapping;
  return cache[key];
}

export function bibTexture() {
  if (cache.bib) return cache.bib;
  const c = canvas(256, 256), ctx = c.getContext('2d');
  ctx.fillStyle = '#f0f0ee'; ctx.fillRect(0, 0, 256, 256);
  const rnd = seeded(9);
  const cols = ['#e03b5a', '#3b8be0', '#2fb55a', '#f0c030'];
  for (let i = 0; i < 40; i++) { ctx.fillStyle = cols[i % 4]; ctx.beginPath(); ctx.arc(rnd() * 256, rnd() * 256, 4, 0, Math.PI * 2); ctx.fill(); }
  window.FNAF.text(ctx, "LET'S", 128, 60, { font: 'bold 58px ' + window.FNAF.FONT_TITLE, color: '#d3326a', align: 'center' });
  window.FNAF.text(ctx, 'EAT!!!', 128, 130, { font: 'bold 58px ' + window.FNAF.FONT_TITLE, color: '#d3326a', align: 'center' });
  const n = noise(256, 256, 4, 2, 81);
  const img = ctx.getImageData(0, 0, 256, 256), d = img.data;
  for (let i = 0; i < 256 * 256; i++) { const k = 0.85 + n[i] * 0.18; d[i * 4] *= k; d[i * 4 + 1] *= k; d[i * 4 + 2] *= k; }
  ctx.putImageData(img, 0, 0);
  cache.bib = tex(c, { srgb: true }); cache.bib.wrapS = cache.bib.wrapT = THREE.ClampToEdgeWrapping;
  return cache.bib;
}

export function tableClothTexture() {
  if (cache.cloth) return cache.cloth;
  const c = canvas(256, 256), ctx = c.getContext('2d');
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { ctx.fillStyle = ((x + y) & 1) ? '#e4e4e4' : '#1c1c1c'; ctx.fillRect(x * 32, y * 32, 32, 32); }
  const n = noise(256, 256, 6, 2, 91);
  const img = ctx.getImageData(0, 0, 256, 256), d = img.data;
  for (let i = 0; i < 256 * 256; i++) { const k = 0.8 + n[i] * 0.25; d[i * 4] *= k; d[i * 4 + 1] *= k; d[i * 4 + 2] *= k; }
  ctx.putImageData(img, 0, 0);
  cache.cloth = tex(c, { srgb: true, repeat: [2, 1] });
  return cache.cloth;
}

export function staticCanvas() {
  if (cache.staticC) return cache.staticC;
  const c = canvas(96, 72);
  cache.staticC = { canvas: c, ctx: c.getContext('2d'), tex: tex(c) };
  cache.staticC.tex.wrapS = cache.staticC.tex.wrapT = THREE.ClampToEdgeWrapping;
  cache.staticC.tex.magFilter = THREE.NearestFilter;
  return cache.staticC;
}
export function updateStatic() {
  const s = staticCanvas();
  const img = s.ctx.createImageData(96, 72), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 180; d[i] = v * 0.8; d[i + 1] = v * 0.95; d[i + 2] = v; d[i + 3] = 255; }
  s.ctx.putImageData(img, 0, 0);
  s.tex.needsUpdate = true;
}

export function paperTexture(seed) {
  const key = 'paper' + seed;
  if (cache[key]) return cache[key];
  const c = canvas(128, 160), ctx = c.getContext('2d');
  ctx.fillStyle = '#ddd7c6'; ctx.fillRect(0, 0, 128, 160);
  ctx.strokeStyle = '#9aa'; ctx.lineWidth = 1;
  for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(10, 30 + i * 14); ctx.lineTo(118, 30 + i * 14); ctx.stroke(); }
  const rnd = seeded(seed); ctx.strokeStyle = '#334'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(14, 27 + i * 14); let x = 14; while (x < 100) { x += 4 + rnd() * 10; ctx.lineTo(x, 24 + i * 14 + rnd() * 5); } ctx.stroke(); }
  cache[key] = tex(c, { srgb: true }); cache[key].wrapS = cache[key].wrapT = THREE.ClampToEdgeWrapping;
  return cache[key];
}
