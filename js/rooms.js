'use strict';
/* ---------------------------------------------------------------------------
 * rooms.js - the eleven camera feeds. Backgrounds are pre-rendered once with a
 * tiny perspective projector; animatronics are placed in the same world space.
 * ------------------------------------------------------------------------- */
(function () {
  const R = FNAF.Rooms = { cache: {} };
  const BW = 1400, BH = 720;   // background width (wider than view for slow pans)

  R.CAMS = {
    '1A': { name: 'Show Stage', pan: 60 },
    '1B': { name: 'Dining Area', pan: 110 },
    '1C': { name: 'Pirate Cove', pan: 40 },
    '2A': { name: 'West Hall', pan: 50 },
    '2B': { name: 'W. Hall Corner', pan: 30 },
    '3': { name: 'Supply Closet', pan: 25 },
    '4A': { name: 'East Hall', pan: 50 },
    '4B': { name: 'E. Hall Corner', pan: 30 },
    '5': { name: 'Backstage', pan: 40 },
    '6': { name: 'Kitchen', pan: 0 },
    '7': { name: 'Restrooms', pan: 70 },
  };
  R.ORDER = ['1A', '1B', '5', '1C', '3', '2A', '2B', '4A', '4B', '7', '6'];

  /* ---------------------------------------------------------- projector */
  function projector(cfg) {
    const { vx, hy, f, camH } = cfg;
    const pr = (X, Y, Z) => [vx + X * f / Z, hy + Y * f / Z];
    pr.scale = Z => f / Z;
    pr.cfg = cfg;
    pr.feet = (X, Z, floorY) => pr(X, floorY === undefined ? camH : floorY, Z);
    // sprite scale so that a 'stand' sprite (720px ~ 2.3 world units) renders in perspective
    pr.charScale = (Z, units) => ((units || 2.3) * f / Z) / 720;
    return pr;
  }

  function quad(ctx, pts, fill, stroke) {
    FNAF.poly(ctx, pts);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }

  function floorChecker(ctx, pr, cfg, zNear, zFar, xHalf, colA, colB, tile) {
    tile = tile || 0.5;
    const Y = cfg.camH;
    for (let Z = zNear; Z < zFar; Z += tile) {
      const z2 = Math.min(Z + tile, zFar);
      for (let X = -xHalf; X < xHalf; X += tile) {
        const i = Math.round(X / tile) + Math.round(Z / tile);
        const c = (i & 1) ? colA : colB;
        const shade = FNAF.clamp(1.1 - Z / zFar * 0.9, 0.12, 1);
        ctx.fillStyle = c;
        ctx.globalAlpha = 1;
        quad(ctx, [pr(X, Y, Z), pr(X + tile, Y, Z), pr(X + tile, Y, z2), pr(X, Y, z2)], c);
        ctx.fillStyle = 'rgba(0,0,0,' + (1 - shade) + ')';
        quad(ctx, [pr(X, Y, Z), pr(X + tile, Y, Z), pr(X + tile, Y, z2), pr(X, Y, z2)], 'rgba(0,0,0,' + (1 - shade) + ')');
      }
    }
  }

  function wallsAndCeiling(ctx, pr, cfg, xHalf, zNear, zFar, wallCol, ceilCol, backCol) {
    const ch = -cfg.ceilH, fh = cfg.camH;
    // back wall
    const bl = pr(-xHalf, ch, zFar), br = pr(xHalf, fh, zFar);
    ctx.fillStyle = backCol || wallCol;
    ctx.fillRect(bl[0], bl[1], br[0] - bl[0], br[1] - bl[1]);
    // left wall
    let g = ctx.createLinearGradient(pr(-xHalf, 0, zNear)[0], 0, pr(-xHalf, 0, zFar)[0], 0);
    g.addColorStop(0, FNAF.lighten(wallCol, 0.08)); g.addColorStop(1, FNAF.darken(wallCol, 0.6));
    quad(ctx, [pr(-xHalf, ch, zNear), pr(-xHalf, ch, zFar), pr(-xHalf, fh, zFar), pr(-xHalf, fh, zNear)], g);
    g = ctx.createLinearGradient(pr(xHalf, 0, zNear)[0], 0, pr(xHalf, 0, zFar)[0], 0);
    g.addColorStop(0, FNAF.lighten(wallCol, 0.08)); g.addColorStop(1, FNAF.darken(wallCol, 0.6));
    quad(ctx, [pr(xHalf, ch, zNear), pr(xHalf, ch, zFar), pr(xHalf, fh, zFar), pr(xHalf, fh, zNear)], g);
    // ceiling
    g = ctx.createLinearGradient(0, pr(0, ch, zNear)[1], 0, pr(0, ch, zFar)[1]);
    g.addColorStop(0, ceilCol); g.addColorStop(1, FNAF.darken(ceilCol, 0.7));
    quad(ctx, [pr(-xHalf, ch, zNear), pr(xHalf, ch, zNear), pr(xHalf, ch, zFar), pr(-xHalf, ch, zFar)], g);
    // ceiling tiles
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
    for (let Z = zNear; Z <= zFar; Z += 0.6) { const a = pr(-xHalf, ch, Z), b = pr(xHalf, ch, Z); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    for (let X = -xHalf; X <= xHalf; X += 0.6) { const a = pr(X, ch, zNear), b = pr(X, ch, zFar); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
  }

  /* wall stripe (the black/white checker band) at height Y along a side wall */
  function wallBand(ctx, pr, X, zNear, zFar, Y, h, n) {
    const t = (zFar - zNear) / n;
    for (let i = 0; i < n; i++) {
      const Z = zNear + i * t;
      quad(ctx, [pr(X, Y, Z), pr(X, Y, Z + t), pr(X, Y + h, Z + t), pr(X, Y + h, Z)], (i & 1) ? '#d8d8d8' : '#151515');
      quad(ctx, [pr(X, Y + h, Z), pr(X, Y + h, Z + t), pr(X, Y + 2 * h, Z + t), pr(X, Y + 2 * h, Z)], (i & 1) ? '#151515' : '#d8d8d8');
    }
  }
  function backBand(ctx, pr, xHalf, Z, Y, h, n) {
    const t = (2 * xHalf) / n;
    for (let i = 0; i < n; i++) {
      const X = -xHalf + i * t;
      quad(ctx, [pr(X, Y, Z), pr(X + t, Y, Z), pr(X + t, Y + h, Z), pr(X, Y + h, Z)], (i & 1) ? '#d8d8d8' : '#151515');
      quad(ctx, [pr(X, Y + h, Z), pr(X + t, Y + h, Z), pr(X + t, Y + 2 * h, Z), pr(X, Y + 2 * h, Z)], (i & 1) ? '#151515' : '#d8d8d8');
    }
  }

  function lightPool(ctx, x, y, rx, ry, col, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
    g.addColorStop(0, col.replace('A', a)); g.addColorStop(1, col.replace('A', 0));
    ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx); ctx.translate(-x, -y);
    ctx.fillStyle = g; ctx.fillRect(x - rx, y - rx, rx * 2, rx * 2);
    ctx.restore();
  }

  function partyHat(ctx, x, y, s, col) {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(x - s * 0.5, y); ctx.lineTo(x + s * 0.5, y); ctx.lineTo(x, y - s * 1.4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 3; i++) { FNAF.ellipse(ctx, x + (i - 1) * s * 0.18, y - s * 0.3 - i * s * 0.25 * (i % 2), s * 0.06, s * 0.06); ctx.fill(); }
    FNAF.ellipse(ctx, x, y - s * 1.4, s * 0.12, s * 0.12); ctx.fill();
  }

  function table(ctx, pr, X, Z, w, d, cfg, hats) {
    const Y = cfg.camH - 0.55;
    const top = [pr(X - w / 2, Y, Z), pr(X + w / 2, Y, Z), pr(X + w / 2, Y, Z + d), pr(X - w / 2, Y, Z + d)];
    // cloth checker
    const n = 6, m = 3;
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      const x0 = X - w / 2 + i * w / n, z0 = Z + j * d / m;
      quad(ctx, [pr(x0, Y, z0), pr(x0 + w / n, Y, z0), pr(x0 + w / n, Y, z0 + d / m), pr(x0, Y, z0 + d / m)], ((i + j) & 1) ? '#cfcfcf' : '#1a1a1a');
    }
    // front face
    quad(ctx, [top[0], top[1], pr(X + w / 2, Y + 0.12, Z), pr(X - w / 2, Y + 0.12, Z)], '#8a8a8a');
    // legs
    ctx.strokeStyle = '#333'; ctx.lineWidth = Math.max(1, pr.scale(Z) * 0.02);
    for (const [lx, lz] of [[X - w / 2 + 0.1, Z + 0.05], [X + w / 2 - 0.1, Z + 0.05]]) {
      const a = pr(lx, Y + 0.12, lz), b = pr(lx, cfg.camH, lz);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    // hats
    if (hats) {
      const cols = ['#d33', '#3b7', '#36c', '#ec3', '#c4c'];
      for (let i = 0; i < hats; i++) {
        const hx = X - w / 2 + (i + 0.5) * w / hats, hz = Z + d * (0.3 + 0.4 * (i % 2));
        const p = pr(hx, Y, hz);
        partyHat(ctx, p[0], p[1], pr.scale(hz) * 0.14, cols[i % 5]);
      }
    }
  }

  function curtain(ctx, x, y, w, h, col, stars, folds) {
    folds = folds || 7;
    const fw = w / folds;
    for (let i = 0; i < folds; i++) {
      const g = ctx.createLinearGradient(x + i * fw, 0, x + (i + 1) * fw, 0);
      g.addColorStop(0, FNAF.darken(col, 0.55)); g.addColorStop(0.5, FNAF.lighten(col, 0.1)); g.addColorStop(1, FNAF.darken(col, 0.55));
      ctx.fillStyle = g; ctx.fillRect(x + i * fw, y, fw + 1, h);
    }
    if (stars) {
      const rnd = FNAF.seeded(x * 7 + 13);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      for (let i = 0; i < stars; i++) {
        const sx = x + rnd() * w, sy = y + rnd() * h, s = 3 + rnd() * 5;
        star(ctx, sx, sy, s);
      }
    }
  }
  function star(ctx, x, y, s) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? s * 0.45 : s;
      const a = -Math.PI / 2 + i * Math.PI / 5;
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill();
  }

  /* small posters */
  function posterCelebrate(ctx, x, y, w, h) {
    ctx.fillStyle = '#e8e2d0'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#444'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
    const s = w / 240;
    FNAF.text(ctx, 'CELEBRATE!', x + w / 2, y + 6 * s, { font: 'bold ' + (30 * s) + 'px ' + FNAF.FONT_TITLE, color: '#c0392b', align: 'center' });
    FNAF.Chars.draw(ctx, 'bonnie', 'stand', x + w * 0.25, y + h * 0.95, 0.19 * s * (h / 300), { opts: { guitar: true } });
    FNAF.Chars.draw(ctx, 'freddy', 'stand', x + w * 0.5, y + h * 0.97, 0.21 * s * (h / 300), {});
    FNAF.Chars.draw(ctx, 'chica', 'stand', x + w * 0.75, y + h * 0.95, 0.19 * s * (h / 300), {});
  }
  function posterGolden(ctx, x, y, w, h) {
    ctx.fillStyle = '#e8e2d0'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#444'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
    FNAF.Chars.draw(ctx, 'golden', 'face', x + w / 2, y + h * 0.98, (h / 760) * 0.95, {});
  }
  function posterRules(ctx, x, y, w, h) {
    ctx.fillStyle = '#efe9d8'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#444'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
    const s = h / 220;
    FNAF.text(ctx, 'RULES FOR SAFETY', x + w / 2, y + 8 * s, { font: 'bold ' + (13 * s) + 'px ' + FNAF.FONT, color: '#222', align: 'center' });
    const rules = ['1. Don\'t run.', '2. Don\'t yell.', '3. Don\'t scream.', '4. Don\'t poop on floor.', '5. Stay close to mom.', '6. Don\'t touch Freddy.', '7. Don\'t hit.', '8. Leave before dark.'];
    rules.forEach((r, i) => FNAF.text(ctx, r, x + 8 * s, y + (30 + i * 20) * s, { font: (11 * s) + 'px ' + FNAF.FONT, color: '#333' }));
  }
  function kidDrawing(ctx, x, y, w, h, seed) {
    const rnd = FNAF.seeded(seed);
    ctx.fillStyle = '#f3efe4'; ctx.fillRect(x, y, w, h);
    const cols = ['#d33', '#36c', '#3a3', '#e92', '#93c', '#6b4a2b'];
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = cols[Math.floor(rnd() * cols.length)]; ctx.lineWidth = 2 + rnd() * 3;
      ctx.beginPath(); ctx.moveTo(x + rnd() * w, y + rnd() * h);
      for (let j = 0; j < 4; j++) ctx.lineTo(x + rnd() * w, y + rnd() * h);
      ctx.stroke();
    }
    ctx.fillStyle = cols[Math.floor(rnd() * cols.length)];
    FNAF.ellipse(ctx, x + w * 0.5, y + h * 0.45, w * 0.2, h * 0.2); ctx.fill();
  }

  /* ------------------------------------------------------- room builders */
  const builders = {};

  builders['1A'] = ctx => {
    const cfg = { vx: 700, hy: 330, f: 520, camH: 1.0, ceilH: 1.6 };
    const pr = projector(cfg);
    const xHalf = 3.2, zNear = 1.2, zFar = 6.5;
    wallsAndCeiling(ctx, pr, cfg, xHalf, zNear, zFar, '#2a2c33', '#1a1b1f', '#0e0e14');
    floorChecker(ctx, pr, cfg, zNear, zFar, xHalf, '#b9b9b9', '#1c1c1c', 0.5);
    // stage platform
    const sZ = 3.6, sH = 0.55, Y = cfg.camH;
    quad(ctx, [pr(-xHalf, Y - sH, sZ), pr(xHalf, Y - sH, sZ), pr(xHalf, Y - sH, zFar), pr(-xHalf, Y - sH, zFar)], '#3a2a22');
    quad(ctx, [pr(-xHalf, Y - sH, sZ), pr(xHalf, Y - sH, sZ), pr(xHalf, Y, sZ), pr(-xHalf, Y, sZ)], '#5a1f2a');
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    for (let i = 0; i < 12; i++) { const a = pr(-xHalf + i * xHalf * 2 / 12, Y - sH, sZ), b = pr(-xHalf + i * xHalf * 2 / 12, Y, sZ); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    // back curtain with stars
    const bl = pr(-xHalf, -cfg.ceilH, zFar), br = pr(xHalf, Y - sH, zFar);
    curtain(ctx, bl[0], bl[1], br[0] - bl[0], br[1] - bl[1], '#3b1e5e', 40, 16);
    // side curtains (red) framing the stage
    const lt = pr(-xHalf, -cfg.ceilH, sZ), lb = pr(-xHalf + 1.1, Y - sH, sZ);
    curtain(ctx, lt[0], lt[1], lb[0] - lt[0], lb[1] - lt[1], '#7a1a24', 0, 5);
    const rt = pr(xHalf - 1.1, -cfg.ceilH, sZ), rb = pr(xHalf, Y - sH, sZ);
    curtain(ctx, rt[0], rt[1], rb[0] - rt[0], rb[1] - rt[1], '#7a1a24', 0, 5);
    // valance
    const vt = pr(-xHalf, -cfg.ceilH, sZ), vb = pr(xHalf, -cfg.ceilH + 0.35, sZ);
    curtain(ctx, vt[0], vt[1], vb[0] - vt[0], vb[1] - vt[1], '#8a2030', 0, 20);
    // spotlights
    lightPool(ctx, pr(-1.4, Y - sH, 4.3)[0], pr(0, Y - sH, 4.3)[1], 180, 60, 'rgba(255,230,180,A)', 0.25);
    lightPool(ctx, pr(0, Y - sH, 4.3)[0], pr(0, Y - sH, 4.3)[1], 200, 60, 'rgba(255,230,180,A)', 0.3);
    lightPool(ctx, pr(1.4, Y - sH, 4.3)[0], pr(0, Y - sH, 4.3)[1], 180, 60, 'rgba(255,230,180,A)', 0.25);
    return { pr, stageY: Y - sH, stageZ: 4.3 };
  };

  builders['1B'] = ctx => {
    const cfg = { vx: 700, hy: 280, f: 480, camH: 1.35, ceilH: 1.4 };
    const pr = projector(cfg);
    const xHalf = 4.2, zNear = 1.3, zFar = 11;
    wallsAndCeiling(ctx, pr, cfg, xHalf, zNear, zFar, '#2c2e36', '#17181c', '#101016');
    wallBand(ctx, pr, -xHalf, zNear, zFar, -0.9, 0.12, 22);
    wallBand(ctx, pr, xHalf, zNear, zFar, -0.9, 0.12, 22);
    backBand(ctx, pr, xHalf, zFar, -0.9, 0.12, 16);
    floorChecker(ctx, pr, cfg, zNear, zFar, xHalf, '#aeaeae', '#1a1a1a', 0.5);
    // far stage glimpse
    const bl = pr(-1.8, -1.4, zFar), br = pr(1.8, 0.8, zFar);
    curtain(ctx, bl[0], bl[1], br[0] - bl[0], br[1] - bl[1], '#3b1e5e', 10, 8);
    // tables
    table(ctx, pr, -2.4, 2.4, 2.4, 0.9, cfg, 4);
    table(ctx, pr, 2.4, 2.4, 2.4, 0.9, cfg, 4);
    table(ctx, pr, -2.5, 4.6, 2.4, 0.9, cfg, 4);
    table(ctx, pr, 2.5, 4.6, 2.4, 0.9, cfg, 4);
    table(ctx, pr, -2.5, 7.0, 2.4, 0.9, cfg, 3);
    table(ctx, pr, 2.5, 7.0, 2.4, 0.9, cfg, 3);
    // streamers
    ctx.strokeStyle = 'rgba(200,60,80,0.6)'; ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const Z = 2 + i * 2.3; const a = pr(-xHalf, -1.4, Z), b = pr(xHalf, -1.4, Z);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo((a[0] + b[0]) / 2, a[1] + 60 / (i + 1), b[0], b[1]); ctx.stroke();
    }
    lightPool(ctx, 700, 420, 400, 120, 'rgba(255,240,200,A)', 0.12);
    return { pr };
  };

  builders['1C'] = ctx => {
    const cfg = { vx: 700, hy: 340, f: 520, camH: 1.0, ceilH: 1.5 };
    const pr = projector(cfg);
    const xHalf = 2.6, zNear = 1.2, zFar = 4.6;
    wallsAndCeiling(ctx, pr, cfg, xHalf, zNear, zFar, '#2a2c33', '#1a1b1f', '#0e0e14');
    floorChecker(ctx, pr, cfg, zNear, zFar, xHalf, '#b0b0b0', '#1c1c1c', 0.5);
    const sZ = 2.7, sH = 0.4, Y = cfg.camH;
    quad(ctx, [pr(-xHalf, Y - sH, sZ), pr(xHalf, Y - sH, sZ), pr(xHalf, Y - sH, zFar), pr(-xHalf, Y - sH, zFar)], '#3a2a22');
    quad(ctx, [pr(-xHalf, Y - sH, sZ), pr(xHalf, Y - sH, sZ), pr(xHalf, Y, sZ), pr(-xHalf, Y, sZ)], '#4a1f2a');
    return { pr, stageY: Y - sH, stageZ: 3.4, xHalf, sZ, zFar };
  };

  function hallBuilder(mirror) {
    return ctx => {
      const cfg = { vx: 700, hy: 300, f: 520, camH: 1.25, ceilH: 1.3 };
      const pr = projector(cfg);
      const xHalf = 1.35, zNear = 1.2, zFar = 14;
      wallsAndCeiling(ctx, pr, cfg, xHalf, zNear, zFar, '#2c2e36', '#17181c', '#0a0a0e');
      wallBand(ctx, pr, -xHalf, zNear, zFar, -0.8, 0.1, 26);
      wallBand(ctx, pr, xHalf, zNear, zFar, -0.8, 0.1, 26);
      floorChecker(ctx, pr, cfg, zNear, zFar, xHalf, '#b5b5b5', '#1a1a1a', 0.45);
      // doorway at the far end (to the office) glow
      const dl = pr(-0.6, -1.1, zFar), dr = pr(0.6, cfg.camH, zFar);
      ctx.fillStyle = '#0d0d12'; ctx.fillRect(dl[0], dl[1], dr[0] - dl[0], dr[1] - dl[1]);
      // posters on the wall
      const side = mirror ? xHalf : -xHalf;
      const p1 = pr(side, -0.55, 4.0), p2 = pr(side, 0.35, 5.0);
      ctx.save();
      // draw poster as a flat rectangle then skew roughly by clipping to the wall quad
      FNAF.poly(ctx, [pr(side, -0.55, 4.0), pr(side, -0.55, 5.0), pr(side, 0.35, 5.0), pr(side, 0.35, 4.0)]); ctx.clip();
      const x = Math.min(p1[0], p2[0]), w = Math.abs(p2[0] - p1[0]);
      if (mirror) posterRules(ctx, x, p1[1], w + 2, p2[1] - p1[1]); else posterCelebrate(ctx, x, p1[1], w + 2, p2[1] - p1[1]);
      ctx.restore();
      // trash can
      const tX = mirror ? -0.95 : 0.95, tZ = 3.0;
      const tb = pr(tX, cfg.camH, tZ), tt = pr(tX, cfg.camH - 0.5, tZ), s = pr.scale(tZ);
      ctx.fillStyle = '#3a3a3a'; ctx.fillRect(tb[0] - 0.18 * s, tt[1], 0.36 * s, tb[1] - tt[1]);
      ctx.fillStyle = '#555'; FNAF.ellipse(ctx, tb[0], tt[1], 0.18 * s, 0.06 * s); ctx.fill();
      // ceiling lights (off)
      for (let Z = 2.5; Z < zFar; Z += 2.5) { const a = pr(-0.3, -1.3, Z), b = pr(0.3, -1.3, Z + 0.6); ctx.fillStyle = '#44444a'; ctx.fillRect(a[0], a[1], b[0] - a[0], Math.max(2, b[1] - a[1])); }
      lightPool(ctx, 700, 420, 300, 150, 'rgba(255,240,220,A)', 0.08);
      return { pr, xHalf, zFar };
    };
  }
  builders['2A'] = hallBuilder(false);
  builders['4A'] = hallBuilder(true);

  function cornerBuilder(mirror) {
    return ctx => {
      const cfg = { vx: mirror ? 500 : 900, hy: 330, f: 520, camH: 1.0, ceilH: 1.4 };
      const pr = projector(cfg);
      const xHalf = 1.6, zNear = 0.9, zFar = 2.6;
      wallsAndCeiling(ctx, pr, cfg, xHalf, zNear, zFar, '#2c2e36', '#17181c', '#262830');
      wallBand(ctx, pr, -xHalf, zNear, zFar, -0.8, 0.1, 6);
      wallBand(ctx, pr, xHalf, zNear, zFar, -0.8, 0.1, 6);
      backBand(ctx, pr, xHalf, zFar, -0.8, 0.1, 10);
      floorChecker(ctx, pr, cfg, zNear, zFar, xHalf, '#b5b5b5', '#1a1a1a', 0.4);
      // door opening to the office on the side
      const side = mirror ? -xHalf : xHalf;
      quad(ctx, [pr(side, -1.1, 1.0), pr(side, -1.1, 1.9), pr(side, cfg.camH, 1.9), pr(side, cfg.camH, 1.0)], '#08080b');
      if (!mirror) {
        const a = pr(-0.9, -0.5, zFar), b = pr(-0.15, 0.4, zFar);
        posterCelebrate(ctx, a[0], a[1], b[0] - a[0], b[1] - a[1]);
      } else {
        for (let i = 0; i < 4; i++) {
          const a = pr(-1.3 + i * 0.65, -0.5 + (i % 2) * 0.1, zFar), b = pr(-0.8 + i * 0.65, 0.2 + (i % 2) * 0.1, zFar);
          kidDrawing(ctx, a[0], a[1], b[0] - a[0], b[1] - a[1], 50 + i);
        }
      }
      lightPool(ctx, cfg.vx, 500, 350, 150, 'rgba(255,240,220,A)', 0.07);
      return { pr, zFar, posterRect: !mirror ? [pr(-0.9, -0.5, zFar), pr(-0.15, 0.4, zFar)] : null };
    };
  }
  builders['2B'] = cornerBuilder(false);
  builders['4B'] = cornerBuilder(true);

  builders['3'] = ctx => {
    const cfg = { vx: 700, hy: 340, f: 520, camH: 1.0, ceilH: 1.4 };
    const pr = projector(cfg);
    const xHalf = 1.2, zNear = 0.9, zFar = 2.7;
    wallsAndCeiling(ctx, pr, cfg, xHalf, zNear, zFar, '#2a2d33', '#17181c', '#1f2126');
    floorChecker(ctx, pr, cfg, zNear, zFar, xHalf, '#9a9a9a', '#1a1a1a', 0.4);
    // shelves on back wall
    for (let i = 0; i < 3; i++) {
      const Y = -1.0 + i * 0.6;
      const a = pr(-xHalf, Y, zFar), b = pr(xHalf, Y + 0.06, zFar);
      ctx.fillStyle = '#4a3b2a'; ctx.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
      const rnd = FNAF.seeded(100 + i);
      for (let j = 0; j < 7; j++) {
        const x = a[0] + 10 + j * (b[0] - a[0] - 20) / 7, h = 18 + rnd() * 30, w = 12 + rnd() * 16;
        ctx.fillStyle = ['#3b6', '#c33', '#36c', '#ddd', '#ec3'][Math.floor(rnd() * 5)];
        ctx.fillRect(x, a[1] - h, w, h);
        ctx.fillStyle = '#222'; ctx.fillRect(x + w * 0.3, a[1] - h - 6, w * 0.4, 6);
      }
    }
    // mop + bucket
    const bZ = 1.6, bb = pr(0.85, cfg.camH, bZ), s = pr.scale(bZ);
    ctx.fillStyle = '#c9c31a'; FNAF.roundRect(ctx, bb[0] - 0.2 * s, bb[1] - 0.35 * s, 0.4 * s, 0.35 * s, 4); ctx.fill();
    ctx.strokeStyle = '#7a6a3a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(bb[0] + 0.05 * s, bb[1] - 0.3 * s); ctx.lineTo(bb[0] + 0.25 * s, bb[1] - 1.5 * s); ctx.stroke();
    ctx.fillStyle = '#ddd'; FNAF.ellipse(ctx, bb[0] + 0.05 * s, bb[1] - 0.3 * s, 0.12 * s, 0.08 * s); ctx.fill();
    lightPool(ctx, 700, 500, 300, 150, 'rgba(255,240,220,A)', 0.07);
    return { pr, zFar };
  };

  builders['5'] = ctx => {
    const cfg = { vx: 700, hy: 330, f: 520, camH: 1.0, ceilH: 1.4 };
    const pr = projector(cfg);
    const xHalf = 1.9, zNear = 0.9, zFar = 4.2;
    wallsAndCeiling(ctx, pr, cfg, xHalf, zNear, zFar, '#2a2d33', '#17181c', '#1b1d22');
    floorChecker(ctx, pr, cfg, zNear, zFar, xHalf, '#9a9a9a', '#1a1a1a', 0.5);
    // shelves with spare heads
    for (let i = 0; i < 2; i++) {
      const Y = -0.95 + i * 0.75;
      const a = pr(-xHalf, Y, zFar), b = pr(xHalf * 0.3, Y + 0.06, zFar);
      ctx.fillStyle = '#4a3b2a'; ctx.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
      const names = ['freddy', 'bonnie', 'chica', 'freddy'];
      for (let j = 0; j < 4; j++) {
        const x = a[0] + 30 + j * (b[0] - a[0] - 40) / 4;
        const r = 16;
        FNAF.Chars.drawHead(ctx, names[(j + i) % 4], x, a[1] - r * 1.1, r, { eyes: 'black', mouth: 0 });
      }
    }
    // table with endoskeleton
    table(ctx, pr, 1.0, 2.6, 1.4, 0.8, cfg, 0);
    const ep = pr(1.0, cfg.camH - 0.55, 2.9);
    ctx.save(); ctx.translate(ep[0], ep[1] - pr.scale(2.9) * 0.1);
    FNAF.Chars.drawEndo(ctx, 0, -pr.scale(2.9) * 0.78, pr.scale(2.9) * 0.16);
    ctx.restore();
    lightPool(ctx, 700, 450, 300, 150, 'rgba(255,240,220,A)', 0.07);
    return { pr, zFar };
  };

  builders['7'] = ctx => {
    const cfg = { vx: 700, hy: 300, f: 520, camH: 1.15, ceilH: 1.3 };
    const pr = projector(cfg);
    const xHalf = 2.2, zNear = 1.2, zFar = 6.5;
    wallsAndCeiling(ctx, pr, cfg, xHalf, zNear, zFar, '#aab2b8', '#2a2c30', '#a0a8ae');
    // tiles on walls
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
    for (let Y = -1.3; Y <= cfg.camH; Y += 0.3) { for (const X of [-xHalf, xHalf]) { const a = pr(X, Y, zNear), b = pr(X, Y, zFar); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); } const a = pr(-xHalf, Y, zFar), b = pr(xHalf, Y, zFar); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    for (let Z = zNear; Z <= zFar; Z += 0.3) for (const X of [-xHalf, xHalf]) { const a = pr(X, -1.3, Z), b = pr(X, cfg.camH, Z); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    for (let X = -xHalf; X <= xHalf; X += 0.3) { const a = pr(X, -1.3, zFar), b = pr(X, cfg.camH, zFar); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    floorChecker(ctx, pr, cfg, zNear, zFar, xHalf, '#b9b9b9', '#4a4a4a', 0.5);
    // doors
    for (const [X, label] of [[-1.3, 'LADIES'], [1.3, 'GENTS']]) {
      const a = pr(X - 0.45, -0.9, zFar), b = pr(X + 0.45, cfg.camH, zFar);
      ctx.fillStyle = '#3a2d22'; ctx.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
      ctx.fillStyle = '#ddd'; ctx.fillRect(a[0] + 6, a[1] + 8, b[0] - a[0] - 12, 18);
      FNAF.text(ctx, label, (a[0] + b[0]) / 2, a[1] + 10, { size: 12, bold: true, color: '#222', align: 'center' });
      ctx.fillStyle = '#999'; FNAF.ellipse(ctx, b[0] - 12, (a[1] + b[1]) / 2, 4, 4); ctx.fill();
    }
    // hand dryer
    const d = pr(xHalf, -0.4, 3.5); ctx.fillStyle = '#ccc'; ctx.fillRect(d[0] - 26, d[1], 26, 36);
    lightPool(ctx, 700, 420, 420, 160, 'rgba(230,240,255,A)', 0.14);
    return { pr, zFar };
  };

  builders['6'] = ctx => { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, BW, BH); return {}; };

  R.getBackground = function (id) {
    let e = R.cache[id];
    if (!e) {
      const c = FNAF.makeCanvas(BW, BH);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, BW, BH);
      const info = builders[id](ctx) || {};
      // camera look: desaturate + darken slightly
      ctx.fillStyle = 'rgba(10,14,20,0.28)'; ctx.fillRect(0, 0, BW, BH);
      e = R.cache[id] = { canvas: c, info };
    }
    return e;
  };

  R.prewarm = function () { for (const id of Object.keys(R.CAMS)) R.getBackground(id); };

  /* ------------------------------------------------------- dynamic draw */
  /* st = { bonnie, chica, freddy (cam ids), foxy: {stage, running, runT}, golden: bool, t: seconds, lightLevel } */
  R.draw = function (ctx, id, st) {
    const bg = R.getBackground(id);
    const info = bg.info, pr = info.pr;
    const cam = R.CAMS[id];
    const pan = cam.pan ? (cam.pan * (0.5 + 0.5 * Math.sin(st.t * 0.22 + id.length))) : 0;
    const ox = -pan - (BW - FNAF.W) / 2 + cam.pan;   // keep the pan centered in the wide background
    ctx.save();
    ctx.translate(Math.round(ox), 0);
    ctx.drawImage(bg.canvas, 0, 0);
    const near = { dark: 0.35, glow: false }, far = { dark: 0.55, glow: false };
    const fred = { dark: 0.78, glow: true };

    if (id === '1A') {
      const y = pr(0, info.stageY, info.stageZ)[1];
      const sc = pr.charScale(info.stageZ, 2.3);
      if (st.bonnie === '1A') FNAF.Chars.draw(ctx, 'bonnie', 'stand', pr(-1.45, 0, info.stageZ)[0], y, sc, { opts: { guitar: true }, dark: 0.3 });
      if (st.freddy === '1A') FNAF.Chars.draw(ctx, 'freddy', 'stand', pr(0, 0, info.stageZ)[0], y, sc, { dark: 0.3 });
      if (st.chica === '1A') FNAF.Chars.draw(ctx, 'chica', 'stand', pr(1.45, 0, info.stageZ)[0], y, sc, { dark: 0.3 });
    }
    if (id === '1B') {
      if (st.freddy === '1B') { const Z = 6.8; FNAF.Chars.draw(ctx, 'freddy', 'stand', pr(0.3, 0, Z)[0], pr.feet(0, Z)[1], pr.charScale(Z), fred); }
      if (st.bonnie === '1B') { const Z = 3.9; FNAF.Chars.draw(ctx, 'bonnie', 'stand', pr(-0.9, 0, Z)[0], pr.feet(0, Z)[1], pr.charScale(Z), near); }
      if (st.chica === '1B') { const Z = 4.4; FNAF.Chars.draw(ctx, 'chica', 'stand', pr(1.1, 0, Z)[0], pr.feet(0, Z)[1], pr.charScale(Z), near); }
    }
    if (id === '1C') {
      const Y = info.stageY, Z = info.stageZ;
      const stage = st.foxy.stage;
      // curtain (closed / parted)
      const lt = pr(-info.xHalf, -1.5, info.sZ), rb = pr(info.xHalf, Y, info.sZ);
      const w = rb[0] - lt[0], h = rb[1] - lt[1];
      const gap = stage === 0 ? 0 : stage === 1 ? 0.14 : stage === 2 ? 0.32 : 0.55;
      // dark stage interior behind the curtain gap
      ctx.fillStyle = '#0a0810';
      ctx.fillRect(lt[0] + w * (0.5 - gap / 2), lt[1], w * gap, h);
      // foxy behind curtain
      if (stage === 1) {
        ctx.save();
        ctx.beginPath(); ctx.rect(lt[0] + w * (0.5 - gap / 2), lt[1], w * gap, h); ctx.clip();
        FNAF.Chars.draw(ctx, 'foxy', 'stand', pr(-0.25, 0, Z)[0], pr(0, Y, Z)[1], pr.charScale(Z), { dark: 0.4, rot: -0.12 });
        ctx.restore();
      } else if (stage === 2) {
        FNAF.Chars.draw(ctx, 'foxy', 'stand', pr(0.15, 0, Z - 0.3)[0], pr(0, Y, Z - 0.3)[1], pr.charScale(Z - 0.3), { dark: 0.3, rot: -0.2 });
      }
      // dark stage interior visible through the gap
      const gl = lt[0] + w * (0.5 - gap / 2);
      ctx.fillStyle = 'rgba(5,5,10,0.0)';
      curtain(ctx, lt[0], lt[1], w * (0.5 - gap / 2), h, '#3b1e5e', 18, 6);
      curtain(ctx, lt[0] + w * (0.5 + gap / 2), lt[1], w * (0.5 - gap / 2), h, '#3b1e5e', 18, 6);
      // valance
      curtain(ctx, lt[0], lt[1], w, h * 0.12, '#52287d', 0, 18);
      // sign
      const sp = pr(-1.5, Y, 2.0), ss = pr.scale(2.0);
      ctx.fillStyle = '#666'; ctx.fillRect(sp[0] - 0.03 * ss, sp[1] - 0.95 * ss, 0.06 * ss, 0.95 * ss);
      ctx.fillStyle = '#444'; FNAF.ellipse(ctx, sp[0], sp[1], 0.25 * ss, 0.07 * ss); ctx.fill();
      ctx.fillStyle = '#e8e4d6'; FNAF.roundRect(ctx, sp[0] - 0.42 * ss, sp[1] - 1.3 * ss, 0.84 * ss, 0.5 * ss, 6); ctx.fill();
      ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.stroke();
      const itsMe = stage >= 3 && st.itsMe;
      FNAF.text(ctx, itsMe ? "IT'S ME" : 'Sorry!', sp[0], sp[1] - 1.26 * ss, { font: 'bold ' + (0.16 * ss) + 'px ' + FNAF.FONT_TITLE, color: itsMe ? '#a00' : '#222', align: 'center' });
      if (!itsMe) FNAF.text(ctx, 'OUT OF ORDER', sp[0], sp[1] - 1.06 * ss, { font: 'bold ' + (0.13 * ss) + 'px ' + FNAF.FONT_TITLE, color: '#b22', align: 'center' });
    }
    if (id === '2A') {
      if (st.bonnie === '2A') { const Z = 5.0; FNAF.Chars.draw(ctx, 'bonnie', 'stand', pr(-0.25, 0, Z)[0], pr.feet(0, Z)[1], pr.charScale(Z), near); }
      if (st.foxy.running) {
        // runs from the far end toward the camera
        const k = FNAF.clamp(st.foxy.runT / 1.6, 0, 1);
        const Z = FNAF.lerp(10, 1.5, k * k);
        const phase = Math.round(((st.foxy.runT * 6) % 1) * 8) / 8;
        const x = pr(0.1, 0, Z)[0], y = pr.feet(0, Z)[1], sc = pr.charScale(Z);
        const img = FNAF.Chars.getDark('foxy', 'stand', { run: phase }, 0.35, false);
        ctx.save(); ctx.globalAlpha = 0.35;
        ctx.drawImage(img, x - img.width * sc / 2 - 30 * sc, y - img.height * sc, img.width * sc, img.height * sc);
        ctx.drawImage(img, x - img.width * sc / 2 + 30 * sc, y - img.height * sc, img.width * sc, img.height * sc);
        ctx.globalAlpha = 1;
        ctx.drawImage(img, x - img.width * sc / 2, y - img.height * sc, img.width * sc, img.height * sc);
        ctx.restore();
      }
    }
    if (id === '4A') {
      if (st.freddy === '4A') { const Z = 5.5; FNAF.Chars.draw(ctx, 'freddy', 'stand', pr(0.1, 0, Z)[0], pr.feet(0, Z)[1], pr.charScale(Z), fred); }
      if (st.chica === '4A') { const Z = 4.6; FNAF.Chars.draw(ctx, 'chica', 'stand', pr(0.3, 0, Z)[0], pr.feet(0, Z)[1], pr.charScale(Z), near); }
    }
    if (id === '2B') {
      if (st.golden && info.posterRect) {
        const [a, b] = info.posterRect;
        posterGolden(ctx, a[0], a[1], b[0] - a[0], b[1] - a[1]);
      }
      if (st.bonnie === '2B') { const Z = 1.35; FNAF.Chars.draw(ctx, 'bonnie', 'face', pr(-0.55, 0, Z)[0], pr(0, 0.95, Z)[1], pr.charScale(Z, 1.1) * (720 / 760), { dark: 0.3 }); }
    }
    if (id === '4B') {
      if (st.chica === '4B') { const Z = 1.35; FNAF.Chars.draw(ctx, 'chica', 'face', pr(0.55, 0, Z)[0], pr(0, 0.95, Z)[1], pr.charScale(Z, 1.1) * (720 / 760), { dark: 0.3 }); }
      if (st.freddy === '4B') { const Z = 1.6; FNAF.Chars.draw(ctx, 'freddy', 'face', pr(0.3, 0, Z)[0], pr(0, 0.9, Z)[1], pr.charScale(Z, 1.1) * (720 / 760), { dark: 0.9, glow: true }); }
    }
    if (id === '3') {
      if (st.bonnie === '3') { const Z = 1.7; FNAF.Chars.draw(ctx, 'bonnie', 'stand', pr(0.1, 0, Z)[0], pr.feet(0, Z)[1] + 40, pr.charScale(Z), { dark: 0.3 }); }
    }
    if (id === '5') {
      if (st.bonnie === '5') { const Z = 1.15; FNAF.Chars.draw(ctx, 'bonnie', 'face', pr(-0.2, 0, Z)[0], pr(0, 1.0, Z)[1], pr.charScale(Z, 1.2) * (720 / 760), { dark: 0.25 }); }
    }
    if (id === '7') {
      if (st.freddy === '7') { const Z = 4.8; FNAF.Chars.draw(ctx, 'freddy', 'stand', pr(0.9, 0, Z)[0], pr.feet(0, Z)[1], pr.charScale(Z), fred); }
      if (st.chica === '7') { const Z = 4.0; FNAF.Chars.draw(ctx, 'chica', 'stand', pr(-0.9, 0, Z)[0], pr.feet(0, Z)[1], pr.charScale(Z), near); }
    }
    ctx.restore();

    if (id === '6') {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, FNAF.W, FNAF.H);
      FNAF.text(ctx, 'CAMERA DISABLED', 640, 300, { size: 44, color: '#ddd', align: 'center', bold: true });
      FNAF.text(ctx, 'AUDIO ONLY', 640, 360, { size: 44, color: '#ddd', align: 'center', bold: true });
    }
    // camera darkness & vignette
    ctx.drawImage(FNAF.tex.vignette, 0, 0);
    ctx.drawImage(FNAF.tex.smudge, 0, 0);
  };
})();
