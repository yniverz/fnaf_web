'use strict';
/* ---------------------------------------------------------------------------
 * chars.js - procedural animatronic art.
 *   Freddy, Bonnie, Chica, Foxy, Golden Freddy.
 *   Poses: 'stand' (400x720 box), 'face' (640x760), 'scare' (1000x1000),
 *          'slump' (golden only, 400x520)
 * ------------------------------------------------------------------------- */
(function () {
  const C = FNAF.Chars = { cache: {} };
  const PAL = {
    freddy: { body: '#6b4a2b', hi: '#8a6440', lo: '#3a2615', muzzle: '#b48a5c', muzzleHi: '#d2ab7c', iris: '#5d8fd8', bow: '#111', hat: '#141414' },
    golden: { body: '#c9a23a', hi: '#e0c060', lo: '#6d5518', muzzle: '#e2cb7e', muzzleHi: '#f0e0a0', iris: '#000', bow: '#2a1a4a', hat: '#141414' },
    bonnie: { body: '#3b3380', hi: '#5a4fb0', lo: '#1c1840', muzzle: '#6d64b5', muzzleHi: '#8d85d0', iris: '#c43b7a', bow: '#c0252a', inner: '#8b84c9' },
    chica: { body: '#e3bf1f', hi: '#f6dc5a', lo: '#8a7210', muzzle: '#e3bf1f', muzzleHi: '#f6dc5a', iris: '#c43b7a', beak: '#e0772c', beakHi: '#f5a052', beakLo: '#8a4512', bib: '#f2f2f2' },
    foxy: { body: '#a3332a', hi: '#c94d40', lo: '#4e1510', muzzle: '#d9b58e', muzzleHi: '#efd3b0', iris: '#e9c44a', inner: '#3a1612', endo: '#8c8c8c', endoLo: '#444' },
  };
  C.PAL = PAL;

  /* ------------------------------------------------------------ primitives */
  function sphere(ctx, cx, cy, rx, ry, base, hi, lo, rot) {
    const g = ctx.createRadialGradient(cx - rx * 0.3, cy - ry * 0.35, Math.min(rx, ry) * 0.1, cx, cy, Math.max(rx, ry) * 1.15);
    g.addColorStop(0, hi); g.addColorStop(0.45, base); g.addColorStop(1, lo);
    ctx.fillStyle = g;
    FNAF.ellipse(ctx, cx, cy, rx, ry, rot);
    ctx.fill();
  }
  function limb(ctx, x1, y1, x2, y2, w, base, lo) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = lo; ctx.lineWidth = w + 3;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    const g = ctx.createLinearGradient(x1 - w / 2, y1, x1 + w / 2, y1);
    g.addColorStop(0, lo); g.addColorStop(0.35, base); g.addColorStop(0.7, base); g.addColorStop(1, lo);
    ctx.strokeStyle = g; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.restore();
  }
  function jointRing(ctx, x, y, r, col) {
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, r * 0.18);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  }

  function eye(ctx, x, y, rx, ry, iris, mode, r) {
    // socket
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    FNAF.ellipse(ctx, x, y + ry * 0.1, rx * 1.25, ry * 1.25); ctx.fill();
    if (mode === 'black') {
      ctx.fillStyle = '#000'; FNAF.ellipse(ctx, x, y, rx, ry); ctx.fill();
      ctx.fillStyle = '#fff'; FNAF.ellipse(ctx, x, y, rx * 0.12, ry * 0.12); ctx.fill();
      return;
    }
    if (mode === 'glow') {
      const g = ctx.createRadialGradient(x, y, 0, x, y, rx * 2.2);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.9)'); g.addColorStop(0.5, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; FNAF.ellipse(ctx, x, y, rx * 2.2, ry * 2.2); ctx.fill();
      ctx.fillStyle = '#fff'; FNAF.ellipse(ctx, x, y, rx * 0.8, ry * 0.8); ctx.fill();
      ctx.fillStyle = '#000'; FNAF.ellipse(ctx, x, y, rx * 0.22, ry * 0.22); ctx.fill();
      return;
    }
    const g = ctx.createRadialGradient(x, y, rx * 0.2, x, y, rx);
    g.addColorStop(0, '#fff'); g.addColorStop(1, '#c9c9c9');
    ctx.fillStyle = g; FNAF.ellipse(ctx, x, y, rx, ry); ctx.fill();
    ctx.fillStyle = iris; FNAF.ellipse(ctx, x, y + ry * 0.05, rx * 0.55, ry * 0.58); ctx.fill();
    ctx.fillStyle = '#000'; FNAF.ellipse(ctx, x, y + ry * 0.05, rx * 0.3, ry * 0.32); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; FNAF.ellipse(ctx, x - rx * 0.2, y - ry * 0.25, rx * 0.14, ry * 0.14); ctx.fill();
  }

  function teethRow(ctx, x1, y, x2, count, h, pointDown, sharp) {
    const w = (x2 - x1) / count;
    for (let i = 0; i < count; i++) {
      const x = x1 + i * w;
      ctx.fillStyle = i % 3 === 1 ? '#e8e8e8' : '#f6f6f6';
      if (sharp) {
        ctx.beginPath();
        if (pointDown) { ctx.moveTo(x + w * 0.1, y); ctx.lineTo(x + w * 0.9, y); ctx.lineTo(x + w * 0.5, y + h); }
        else { ctx.moveTo(x + w * 0.1, y); ctx.lineTo(x + w * 0.9, y); ctx.lineTo(x + w * 0.5, y - h); }
        ctx.closePath(); ctx.fill();
      } else {
        FNAF.roundRect(ctx, x + w * 0.08, pointDown ? y : y - h, w * 0.84, h, w * 0.2); ctx.fill();
      }
    }
  }

  /* -------------------------------------------------------------- heads */
  // returns eye positions [[x,y,r],[x,y,r]]
  C.drawHead = function (ctx, name, cx, cy, r, o) {
    o = o || {};
    const P = PAL[name];
    const m = o.mouth || 0;              // 0..1 open
    const eyeMode = o.eyes || 'normal';
    const eyes = [];
    ctx.save();
    if (o.tilt) { ctx.translate(cx, cy); ctx.rotate(o.tilt); ctx.translate(-cx, -cy); }

    if (name === 'freddy' || name === 'golden') {
      // ears
      for (const s of [-1, 1]) {
        sphere(ctx, cx + s * 0.8 * r, cy - 0.78 * r, 0.36 * r, 0.36 * r, P.body, P.hi, P.lo);
        sphere(ctx, cx + s * 0.8 * r, cy - 0.76 * r, 0.2 * r, 0.2 * r, P.muzzle, P.muzzleHi, P.lo);
      }
      sphere(ctx, cx, cy, r, r * 0.98, P.body, P.hi, P.lo);
      // hat
      ctx.save();
      ctx.translate(cx + 0.02 * r, cy - 0.86 * r); ctx.rotate(-0.06);
      ctx.fillStyle = '#0a0a0a'; FNAF.ellipse(ctx, 0, 0, 0.66 * r, 0.13 * r); ctx.fill();
      const hg = ctx.createLinearGradient(-0.45 * r, 0, 0.45 * r, 0);
      hg.addColorStop(0, '#050505'); hg.addColorStop(0.4, '#2a2a2a'); hg.addColorStop(1, '#080808');
      ctx.fillStyle = hg; ctx.fillRect(-0.45 * r, -0.85 * r, 0.9 * r, 0.85 * r);
      ctx.fillStyle = '#1c1c1c'; FNAF.ellipse(ctx, 0, -0.85 * r, 0.45 * r, 0.09 * r); ctx.fill();
      ctx.fillStyle = '#222'; ctx.fillRect(-0.45 * r, -0.2 * r, 0.9 * r, 0.09 * r);
      ctx.restore();
      // brows
      ctx.strokeStyle = P.lo; ctx.lineWidth = 0.11 * r; ctx.lineCap = 'round';
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(cx + s * 0.62 * r, cy - 0.42 * r); ctx.quadraticCurveTo(cx + s * 0.4 * r, cy - 0.58 * r, cx + s * 0.14 * r, cy - 0.46 * r); ctx.stroke();
      }
      // eyes
      for (const s of [-1, 1]) { eye(ctx, cx + s * 0.36 * r, cy - 0.17 * r, 0.2 * r, 0.19 * r, P.iris, name === 'golden' ? 'black' : eyeMode, r); eyes.push([cx + s * 0.36 * r, cy - 0.17 * r, 0.2 * r]); }
      // muzzle (upper)
      sphere(ctx, cx, cy + 0.38 * r, 0.64 * r, 0.42 * r, P.muzzle, P.muzzleHi, FNAF.darken(P.muzzle, 0.5));
      // freckles
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { FNAF.ellipse(ctx, cx + s * (0.3 + i * 0.1) * r, cy + (0.32 + (i % 2) * 0.08) * r, 0.025 * r, 0.025 * r); ctx.fill(); }
      // mouth
      const my = cy + 0.5 * r;
      if (m < 0.05) {
        ctx.strokeStyle = '#1a0d05'; ctx.lineWidth = 0.05 * r;
        ctx.beginPath(); ctx.moveTo(cx - 0.48 * r, my - 0.04 * r); ctx.quadraticCurveTo(cx, my + 0.22 * r, cx + 0.48 * r, my - 0.04 * r); ctx.stroke();
        ctx.save(); ctx.beginPath(); ctx.moveTo(cx - 0.48 * r, my - 0.04 * r); ctx.quadraticCurveTo(cx, my + 0.22 * r, cx + 0.48 * r, my - 0.04 * r); ctx.lineTo(cx + 0.48 * r, my - 0.3 * r); ctx.lineTo(cx - 0.48 * r, my - 0.3 * r); ctx.closePath(); ctx.clip();
        ctx.fillStyle = '#1a0d05'; ctx.fillRect(cx - 0.5 * r, my - 0.1 * r, r, 0.4 * r);
        teethRow(ctx, cx - 0.42 * r, my - 0.09 * r, cx + 0.42 * r, 7, 0.12 * r, true, false);
        ctx.restore();
      } else {
        const open = 0.1 * r + 0.55 * r * m;
        ctx.fillStyle = '#120804';
        FNAF.ellipse(ctx, cx, my + open * 0.5, 0.52 * r, open * 0.62); ctx.fill();
        ctx.fillStyle = '#3a0c0c'; FNAF.ellipse(ctx, cx, my + open * 0.75, 0.3 * r, open * 0.3); ctx.fill();
        teethRow(ctx, cx - 0.44 * r, my - 0.05 * r, cx + 0.44 * r, 8, 0.14 * r, true, false);
        // lower jaw
        sphere(ctx, cx, my + open + 0.1 * r, 0.5 * r, 0.22 * r, P.muzzle, P.muzzleHi, FNAF.darken(P.muzzle, 0.5));
        teethRow(ctx, cx - 0.38 * r, my + open - 0.02 * r, cx + 0.38 * r, 7, 0.12 * r, false, false);
      }
      // nose
      sphere(ctx, cx, cy + 0.14 * r, 0.2 * r, 0.13 * r, '#101010', '#4a4a4a', '#000');
    }

    if (name === 'bonnie') {
      // ears
      for (const s of [-1, 1]) {
        const rot = s * 0.16 + (s < 0 ? -0.22 : 0);
        ctx.save(); ctx.translate(cx + s * 0.48 * r, cy - 0.75 * r); ctx.rotate(rot);
        sphere(ctx, 0, -0.7 * r, 0.25 * r, 0.82 * r, P.body, P.hi, P.lo);
        sphere(ctx, 0, -0.68 * r, 0.12 * r, 0.6 * r, P.inner, FNAF.lighten(P.inner, 0.2), FNAF.darken(P.inner, 0.4));
        ctx.restore();
      }
      sphere(ctx, cx, cy, r, r * 0.98, P.body, P.hi, P.lo);
      // cheeks / muzzle
      sphere(ctx, cx, cy + 0.36 * r, 0.56 * r, 0.42 * r, P.muzzle, P.muzzleHi, FNAF.darken(P.muzzle, 0.5));
      // eyelids (angled)
      ctx.fillStyle = P.lo;
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(cx + s * 0.62 * r, cy - 0.5 * r); ctx.lineTo(cx + s * 0.12 * r, cy - 0.38 * r); ctx.lineTo(cx + s * 0.12 * r, cy - 0.25 * r); ctx.lineTo(cx + s * 0.62 * r, cy - 0.3 * r); ctx.closePath(); ctx.fill();
      }
      for (const s of [-1, 1]) { eye(ctx, cx + s * 0.37 * r, cy - 0.16 * r, 0.2 * r, 0.19 * r, P.iris, eyeMode, r); eyes.push([cx + s * 0.37 * r, cy - 0.16 * r, 0.2 * r]); }
      // nose
      ctx.fillStyle = '#0d0a1f';
      ctx.beginPath(); ctx.moveTo(cx - 0.12 * r, cy + 0.08 * r); ctx.lineTo(cx + 0.12 * r, cy + 0.08 * r); ctx.lineTo(cx, cy + 0.22 * r); ctx.closePath(); ctx.fill();
      // mouth
      const my = cy + 0.5 * r;
      if (m < 0.05) {
        ctx.strokeStyle = '#120b2a'; ctx.lineWidth = 0.045 * r;
        ctx.beginPath(); ctx.moveTo(cx - 0.42 * r, my - 0.05 * r); ctx.quadraticCurveTo(cx, my + 0.16 * r, cx + 0.42 * r, my - 0.05 * r); ctx.stroke();
        ctx.fillStyle = '#f4f4f4';
        FNAF.roundRect(ctx, cx - 0.17 * r, my - 0.02 * r, 0.16 * r, 0.2 * r, 0.03 * r); ctx.fill();
        FNAF.roundRect(ctx, cx + 0.01 * r, my - 0.02 * r, 0.16 * r, 0.2 * r, 0.03 * r); ctx.fill();
      } else {
        const open = 0.1 * r + 0.6 * r * m;
        ctx.fillStyle = '#0c0616'; FNAF.ellipse(ctx, cx, my + open * 0.5, 0.5 * r, open * 0.62); ctx.fill();
        ctx.fillStyle = '#3a0c1a'; FNAF.ellipse(ctx, cx, my + open * 0.75, 0.28 * r, open * 0.3); ctx.fill();
        teethRow(ctx, cx - 0.42 * r, my - 0.04 * r, cx + 0.42 * r, 8, 0.15 * r, true, false);
        sphere(ctx, cx, my + open + 0.1 * r, 0.48 * r, 0.2 * r, P.muzzle, P.muzzleHi, FNAF.darken(P.muzzle, 0.5));
        teethRow(ctx, cx - 0.36 * r, my + open - 0.02 * r, cx + 0.36 * r, 7, 0.12 * r, false, false);
      }
    }

    if (name === 'chica') {
      // hair tufts
      ctx.fillStyle = P.lo;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath(); ctx.moveTo(cx + i * 0.22 * r - 0.1 * r, cy - 0.85 * r); ctx.lineTo(cx + i * 0.22 * r + 0.1 * r, cy - 0.85 * r); ctx.lineTo(cx + i * 0.3 * r, cy - 1.25 * r); ctx.closePath(); ctx.fill();
      }
      sphere(ctx, cx, cy, r * 1.04, r, P.body, P.hi, P.lo);
      // brows
      ctx.fillStyle = '#3a2a05';
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(cx + s * 0.66 * r, cy - 0.6 * r); ctx.lineTo(cx + s * 0.14 * r, cy - 0.44 * r); ctx.lineTo(cx + s * 0.14 * r, cy - 0.32 * r); ctx.lineTo(cx + s * 0.66 * r, cy - 0.46 * r); ctx.closePath(); ctx.fill();
      }
      for (const s of [-1, 1]) { eye(ctx, cx + s * 0.38 * r, cy - 0.14 * r, 0.21 * r, 0.2 * r, P.iris, eyeMode, r); eyes.push([cx + s * 0.38 * r, cy - 0.14 * r, 0.21 * r]); }
      // beak
      const open = 0.12 * r + 0.55 * r * m;
      const by = cy + 0.14 * r;
      // mouth interior
      ctx.fillStyle = '#1a0606';
      FNAF.poly(ctx, [[cx - 0.5 * r, by + 0.1 * r], [cx + 0.5 * r, by + 0.1 * r], [cx + 0.42 * r, by + 0.5 * r + open], [cx - 0.42 * r, by + 0.5 * r + open]]); ctx.fill();
      // upper beak
      let g = ctx.createLinearGradient(cx, by, cx, by + 0.45 * r);
      g.addColorStop(0, P.beakHi); g.addColorStop(1, P.beak);
      ctx.fillStyle = g;
      FNAF.poly(ctx, [[cx - 0.6 * r, by], [cx + 0.6 * r, by], [cx + 0.34 * r, by + 0.42 * r], [cx - 0.34 * r, by + 0.42 * r]]); ctx.fill();
      ctx.fillStyle = P.beakLo; FNAF.ellipse(ctx, cx - 0.15 * r, by + 0.12 * r, 0.04 * r, 0.025 * r); ctx.fill(); FNAF.ellipse(ctx, cx + 0.15 * r, by + 0.12 * r, 0.04 * r, 0.025 * r); ctx.fill();
      teethRow(ctx, cx - 0.33 * r, by + 0.41 * r, cx + 0.33 * r, 9, 0.11 * r, true, true);
      // lower beak
      const ly = by + 0.46 * r + open;
      g = ctx.createLinearGradient(cx, ly, cx, ly + 0.3 * r);
      g.addColorStop(0, P.beak); g.addColorStop(1, P.beakLo);
      ctx.fillStyle = g;
      FNAF.poly(ctx, [[cx - 0.44 * r, ly], [cx + 0.44 * r, ly], [cx + 0.22 * r, ly + 0.3 * r], [cx - 0.22 * r, ly + 0.3 * r]]); ctx.fill();
      teethRow(ctx, cx - 0.3 * r, ly + 0.01 * r, cx + 0.3 * r, 8, 0.1 * r, false, true);
    }

    if (name === 'foxy') {
      // ears
      for (const s of [-1, 1]) {
        ctx.fillStyle = P.lo;
        FNAF.poly(ctx, [[cx + s * 0.3 * r, cy - 0.7 * r], [cx + s * 0.85 * r, cy - 0.55 * r], [cx + s * 0.62 * r, cy - 1.45 * r]]); ctx.fill();
        const g = ctx.createLinearGradient(cx + s * 0.3 * r, cy - 0.7 * r, cx + s * 0.8 * r, cy - 1.3 * r);
        g.addColorStop(0, P.body); g.addColorStop(1, P.hi);
        ctx.fillStyle = g;
        FNAF.poly(ctx, [[cx + s * 0.34 * r, cy - 0.72 * r], [cx + s * 0.8 * r, cy - 0.58 * r], [cx + s * 0.6 * r, cy - 1.38 * r]]); ctx.fill();
        ctx.fillStyle = P.inner;
        FNAF.poly(ctx, [[cx + s * 0.42 * r, cy - 0.74 * r], [cx + s * 0.7 * r, cy - 0.66 * r], [cx + s * 0.58 * r, cy - 1.2 * r]]); ctx.fill();
        if (s > 0) { ctx.fillStyle = '#000'; FNAF.poly(ctx, [[cx + 0.72 * r, cy - 1.0 * r], [cx + 0.86 * r, cy - 1.08 * r], [cx + 0.8 * r, cy - 0.9 * r]]); ctx.fill(); }
      }
      sphere(ctx, cx, cy, r, r * 0.95, P.body, P.hi, P.lo);
      // worn patches
      ctx.fillStyle = 'rgba(20,8,6,0.75)';
      FNAF.ellipse(ctx, cx - 0.55 * r, cy - 0.1 * r, 0.09 * r, 0.06 * r, 0.4); ctx.fill();
      FNAF.ellipse(ctx, cx + 0.6 * r, cy + 0.25 * r, 0.07 * r, 0.1 * r, -0.3); ctx.fill();
      // brows
      ctx.strokeStyle = P.lo; ctx.lineWidth = 0.1 * r; ctx.lineCap = 'round';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + s * 0.62 * r, cy - 0.5 * r); ctx.lineTo(cx + s * 0.16 * r, cy - 0.4 * r); ctx.stroke(); }
      // eye patch (raised) + strap
      ctx.strokeStyle = '#111'; ctx.lineWidth = 0.05 * r;
      ctx.beginPath(); ctx.moveTo(cx - 0.95 * r, cy - 0.3 * r); ctx.quadraticCurveTo(cx, cy - 0.9 * r, cx + 0.95 * r, cy - 0.3 * r); ctx.stroke();
      ctx.fillStyle = '#0d0d0d'; FNAF.ellipse(ctx, cx + 0.38 * r, cy - 0.58 * r, 0.25 * r, 0.17 * r, 0.1); ctx.fill();
      for (const s of [-1, 1]) { eye(ctx, cx + s * 0.37 * r, cy - 0.15 * r, 0.19 * r, 0.18 * r, P.iris, eyeMode, r); eyes.push([cx + s * 0.37 * r, cy - 0.15 * r, 0.19 * r]); }
      // snout
      sphere(ctx, cx, cy + 0.42 * r, 0.48 * r, 0.48 * r, P.muzzle, P.muzzleHi, FNAF.darken(P.muzzle, 0.55));
      const my = cy + 0.56 * r;
      const open = 0.06 * r + 0.6 * r * m;
      ctx.fillStyle = '#0d0505'; FNAF.ellipse(ctx, cx, my + open * 0.5, 0.5 * r, open * 0.6 + 0.03 * r); ctx.fill();
      teethRow(ctx, cx - 0.45 * r, my - 0.06 * r, cx + 0.45 * r, 9, 0.17 * r, true, true);
      // lower jaw
      sphere(ctx, cx, my + open + 0.08 * r, 0.44 * r, 0.18 * r, P.muzzle, P.muzzleHi, FNAF.darken(P.muzzle, 0.55));
      teethRow(ctx, cx - 0.38 * r, my + open - 0.01 * r, cx + 0.38 * r, 8, 0.14 * r, false, true);
      sphere(ctx, cx, cy + 0.17 * r, 0.17 * r, 0.11 * r, '#101010', '#4a4a4a', '#000');
    }
    ctx.restore();
    return eyes;
  };

  /* ---------------------------------------------------------------- bodies */
  C.drawBody = function (ctx, name, cx, cy, r, o) {
    o = o || {};
    const P = PAL[name];
    const run = o.run || 0; // 0..1 phase for running legs
    const lo = P.lo, hi = P.hi, body = P.body;
    const top = cy + 0.95 * r;
    // legs
    const legSwing = run ? Math.sin(run * Math.PI * 2) * 0.5 * r : 0;
    for (const s of [-1, 1]) {
      const sw = legSwing * s;
      const hipX = cx + s * 0.42 * r, hipY = cy + 3.0 * r;
      const kneeX = cx + s * 0.5 * r + sw * 0.5, kneeY = cy + 4.15 * r;
      const ankX = cx + s * 0.55 * r + sw, ankY = cy + 5.2 * r;
      if (name === 'foxy') {
        limb(ctx, hipX, hipY, kneeX, kneeY, 0.5 * r, body, lo);
        // exposed endoskeleton lower leg
        limb(ctx, kneeX, kneeY, ankX, ankY, 0.18 * r, P.endo, P.endoLo);
        limb(ctx, kneeX + 0.1 * r * s, kneeY + 0.1 * r, ankX + 0.08 * r * s, ankY - 0.1 * r, 0.07 * r, '#b0b0b0', '#333');
        jointRing(ctx, kneeX, kneeY, 0.2 * r, '#2a2a2a');
        ctx.fillStyle = P.endo; FNAF.ellipse(ctx, ankX + s * 0.1 * r, ankY + 0.18 * r, 0.42 * r, 0.16 * r); ctx.fill();
        ctx.fillStyle = '#333';
        for (let i = 0; i < 3; i++) { FNAF.ellipse(ctx, ankX + s * (0.25 + i * 0.12) * r, ankY + 0.2 * r, 0.06 * r, 0.1 * r); ctx.fill(); }
      } else {
        limb(ctx, hipX, hipY, kneeX, kneeY, 0.52 * r, body, lo);
        limb(ctx, kneeX, kneeY, ankX, ankY, 0.46 * r, body, lo);
        jointRing(ctx, kneeX, kneeY, 0.2 * r, lo);
        const footCol = name === 'chica' ? P.beak : body;
        sphere(ctx, ankX + s * 0.12 * r, ankY + 0.18 * r, 0.5 * r, 0.2 * r, footCol, FNAF.lighten(footCol, 0.2), FNAF.darken(footCol, 0.5));
        if (name === 'chica') { ctx.strokeStyle = P.beakLo; ctx.lineWidth = 0.03 * r; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(ankX + s * 0.12 * r, ankY + 0.18 * r); ctx.lineTo(ankX + s * 0.12 * r + i * 0.2 * r + s * 0.3 * r, ankY + 0.3 * r); ctx.stroke(); } }
      }
    }
    // torso
    const tw = (name === 'chica' ? 2.1 : 1.95) * r;
    const g = ctx.createLinearGradient(cx - tw / 2, 0, cx + tw / 2, 0);
    g.addColorStop(0, lo); g.addColorStop(0.3, body); g.addColorStop(0.55, hi); g.addColorStop(1, lo);
    ctx.fillStyle = g;
    FNAF.roundRect(ctx, cx - tw / 2, top, tw, 2.25 * r, 0.55 * r); ctx.fill();
    if (name === 'foxy') {
      // torn chest
      ctx.fillStyle = '#120605';
      FNAF.ellipse(ctx, cx + 0.05 * r, cy + 2.15 * r, 0.55 * r, 0.6 * r, 0.3); ctx.fill();
      ctx.strokeStyle = '#777'; ctx.lineWidth = 0.05 * r;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(cx - 0.35 * r, cy + (1.75 + i * 0.25) * r); ctx.quadraticCurveTo(cx + 0.05 * r, cy + (1.85 + i * 0.25) * r, cx + 0.45 * r, cy + (1.7 + i * 0.25) * r); ctx.stroke(); }
      ctx.fillStyle = body;
      FNAF.poly(ctx, [[cx - 0.5 * r, cy + 1.6 * r], [cx - 0.3 * r, cy + 1.9 * r], [cx - 0.55 * r, cy + 2.2 * r]]); ctx.fill();
    } else {
      // belly patch
      sphere(ctx, cx, cy + 2.2 * r, 0.62 * r, 0.85 * r, P.muzzle, P.muzzleHi, FNAF.darken(P.muzzle, 0.35));
    }
    // arms
    const armSwing = run ? Math.sin(run * Math.PI * 2 + Math.PI) * 0.5 * r : 0;
    for (const s of [-1, 1]) {
      const sw = armSwing * s;
      const shX = cx + s * 0.95 * r, shY = cy + 1.25 * r;
      const elX = cx + s * 1.25 * r + sw * 0.4, elY = cy + 2.15 * r;
      const haX = cx + s * 1.28 * r + sw, haY = cy + 3.05 * r;
      sphere(ctx, shX, shY, 0.32 * r, 0.32 * r, body, hi, lo);
      limb(ctx, shX, shY, elX, elY, 0.42 * r, body, lo);
      limb(ctx, elX, elY, haX, haY, 0.36 * r, body, lo);
      jointRing(ctx, elX, elY, 0.17 * r, lo);
      if (name === 'foxy' && s > 0) {
        // hook
        ctx.strokeStyle = '#9a9a9a'; ctx.lineWidth = 0.09 * r; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(haX + 0.05 * r, haY + 0.25 * r, 0.28 * r, Math.PI * 1.1, Math.PI * 2.5); ctx.stroke();
        ctx.fillStyle = '#333'; FNAF.ellipse(ctx, haX, haY, 0.2 * r, 0.14 * r); ctx.fill();
      } else {
        const hc = name === 'chica' ? body : (name === 'foxy' ? body : body);
        sphere(ctx, haX, haY + 0.1 * r, 0.3 * r, 0.3 * r, hc, FNAF.lighten(hc, 0.15), lo);
        for (let i = 0; i < 3; i++) sphere(ctx, haX + s * (-0.15 + i * 0.16) * r, haY + 0.4 * r, 0.1 * r, 0.14 * r, hc, FNAF.lighten(hc, 0.15), lo);
      }
    }
    // neck
    ctx.fillStyle = lo; ctx.fillRect(cx - 0.25 * r, cy + 0.8 * r, 0.5 * r, 0.25 * r);
    // character specifics
    if (name === 'freddy' || name === 'golden' || name === 'bonnie') {
      const by = cy + 1.12 * r;
      ctx.fillStyle = P.bow;
      FNAF.poly(ctx, [[cx - 0.4 * r, by - 0.16 * r], [cx - 0.06 * r, by], [cx - 0.4 * r, by + 0.16 * r]]); ctx.fill();
      FNAF.poly(ctx, [[cx + 0.4 * r, by - 0.16 * r], [cx + 0.06 * r, by], [cx + 0.4 * r, by + 0.16 * r]]); ctx.fill();
      ctx.fillStyle = FNAF.lighten(P.bow, 0.2); FNAF.ellipse(ctx, cx, by, 0.08 * r, 0.1 * r); ctx.fill();
    }
    if (name === 'freddy' || name === 'golden') {
      ctx.fillStyle = '#111';
      FNAF.ellipse(ctx, cx, cy + 1.7 * r, 0.09 * r, 0.09 * r); ctx.fill();
      FNAF.ellipse(ctx, cx, cy + 2.05 * r, 0.09 * r, 0.09 * r); ctx.fill();
      if (o.mic !== false && name === 'freddy') {
        // microphone in left hand
        const hx = cx - 1.28 * r, hy = cy + 3.1 * r;
        ctx.strokeStyle = '#222'; ctx.lineWidth = 0.1 * r; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + 0.15 * r, hy - 0.7 * r); ctx.stroke();
        sphere(ctx, hx + 0.18 * r, hy - 0.85 * r, 0.2 * r, 0.2 * r, '#777', '#bbb', '#222');
      }
    }
    if (name === 'bonnie' && o.guitar) {
      ctx.save();
      ctx.translate(cx, cy + 2.4 * r); ctx.rotate(-0.55);
      ctx.fillStyle = '#b3202a';
      FNAF.ellipse(ctx, -0.1 * r, 0.1 * r, 0.55 * r, 0.45 * r); ctx.fill();
      FNAF.ellipse(ctx, 0.45 * r, -0.05 * r, 0.42 * r, 0.36 * r); ctx.fill();
      ctx.fillStyle = '#3a2410'; ctx.fillRect(0.6 * r, -0.08 * r, 1.6 * r, 0.16 * r);
      ctx.fillStyle = '#111'; FNAF.ellipse(ctx, 0.15 * r, 0.02 * r, 0.14 * r, 0.14 * r); ctx.fill();
      ctx.strokeStyle = '#ccc'; ctx.lineWidth = 0.015 * r;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-0.5 * r, -0.05 * r + i * 0.035 * r); ctx.lineTo(2.2 * r, -0.05 * r + i * 0.035 * r); ctx.stroke(); }
      ctx.restore();
    }
    if (name === 'chica') {
      // bib
      ctx.fillStyle = P.bib;
      FNAF.roundRect(ctx, cx - 0.72 * r, cy + 1.05 * r, 1.44 * r, 1.25 * r, 0.3 * r); ctx.fill();
      ctx.strokeStyle = '#ccc'; ctx.lineWidth = 0.02 * r; ctx.stroke();
      // confetti
      const cols = ['#e03b5a', '#3b8be0', '#2fb55a', '#f0c030'];
      const rnd = FNAF.seeded(9);
      for (let i = 0; i < 18; i++) { ctx.fillStyle = cols[i % 4]; FNAF.ellipse(ctx, cx - 0.6 * r + rnd() * 1.2 * r, cy + 1.1 * r + rnd() * 1.15 * r, 0.03 * r, 0.03 * r); ctx.fill(); }
      FNAF.text(ctx, "LET'S", cx, cy + 1.3 * r, { font: 'bold ' + (0.36 * r) + 'px ' + FNAF.FONT_TITLE, color: '#d3326a', align: 'center' });
      FNAF.text(ctx, 'EAT!!!', cx, cy + 1.7 * r, { font: 'bold ' + (0.36 * r) + 'px ' + FNAF.FONT_TITLE, color: '#d3326a', align: 'center' });
      if (o.cupcake !== false) C.drawCupcake(ctx, cx + 1.28 * r, cy + 2.75 * r, 0.42 * r);
    }
  };

  C.drawCupcake = function (ctx, cx, cy, s) {
    // plate
    ctx.fillStyle = '#ddd'; FNAF.ellipse(ctx, cx, cy + 0.55 * s, 1.2 * s, 0.25 * s); ctx.fill();
    // wrapper
    const g = ctx.createLinearGradient(cx - 0.6 * s, 0, cx + 0.6 * s, 0);
    g.addColorStop(0, '#5a1d12'); g.addColorStop(0.5, '#a0402a'); g.addColorStop(1, '#5a1d12');
    ctx.fillStyle = g;
    FNAF.poly(ctx, [[cx - 0.65 * s, cy - 0.2 * s], [cx + 0.65 * s, cy - 0.2 * s], [cx + 0.5 * s, cy + 0.55 * s], [cx - 0.5 * s, cy + 0.55 * s]]); ctx.fill();
    // frosting
    sphere(ctx, cx, cy - 0.35 * s, 0.8 * s, 0.55 * s, '#e8559a', '#ff8fc5', '#8a1c55');
    // eyes
    for (const d of [-1, 1]) { ctx.fillStyle = '#fff'; FNAF.ellipse(ctx, cx + d * 0.3 * s, cy - 0.4 * s, 0.17 * s, 0.17 * s); ctx.fill(); ctx.fillStyle = '#000'; FNAF.ellipse(ctx, cx + d * 0.3 * s, cy - 0.4 * s, 0.08 * s, 0.08 * s); ctx.fill(); }
    // teeth
    ctx.fillStyle = '#fff'; ctx.fillRect(cx - 0.2 * s, cy - 0.15 * s, 0.4 * s, 0.12 * s);
    ctx.strokeStyle = '#000'; ctx.lineWidth = Math.max(1, 0.02 * s); ctx.strokeRect(cx - 0.2 * s, cy - 0.15 * s, 0.4 * s, 0.12 * s);
    // candle
    ctx.fillStyle = '#eee'; ctx.fillRect(cx - 0.06 * s, cy - 1.2 * s, 0.12 * s, 0.5 * s);
    ctx.fillStyle = '#f3a21b'; FNAF.ellipse(ctx, cx, cy - 1.3 * s, 0.09 * s, 0.16 * s); ctx.fill();
    ctx.fillStyle = '#fff3a0'; FNAF.ellipse(ctx, cx, cy - 1.27 * s, 0.04 * s, 0.08 * s); ctx.fill();
  };

  /* Bare endoskeleton (backstage prop) */
  C.drawEndo = function (ctx, cx, cy, r) {
    const endo = '#8c8c8c', lo = '#3a3a3a';
    sphere(ctx, cx, cy, r, r * 1.05, endo, '#c8c8c8', lo);
    ctx.fillStyle = '#111'; FNAF.ellipse(ctx, cx - 0.35 * r, cy - 0.1 * r, 0.28 * r, 0.28 * r); ctx.fill(); FNAF.ellipse(ctx, cx + 0.35 * r, cy - 0.1 * r, 0.28 * r, 0.28 * r); ctx.fill();
    ctx.fillStyle = '#eee'; FNAF.ellipse(ctx, cx - 0.35 * r, cy - 0.1 * r, 0.07 * r, 0.07 * r); ctx.fill(); FNAF.ellipse(ctx, cx + 0.35 * r, cy - 0.1 * r, 0.07 * r, 0.07 * r); ctx.fill();
    ctx.fillStyle = '#222'; FNAF.ellipse(ctx, cx, cy + 0.55 * r, 0.5 * r, 0.2 * r); ctx.fill();
    teethRow(ctx, cx - 0.4 * r, cy + 0.42 * r, cx + 0.4 * r, 8, 0.12 * r, true, false);
    limb(ctx, cx, cy + r, cx, cy + 1.6 * r, 0.25 * r, endo, lo);
    for (let i = 0; i < 5; i++) { ctx.strokeStyle = endo; ctx.lineWidth = 0.08 * r; ctx.beginPath(); ctx.moveTo(cx - 0.7 * r, cy + (1.7 + i * 0.3) * r); ctx.lineTo(cx + 0.7 * r, cy + (1.7 + i * 0.3) * r); ctx.stroke(); }
    limb(ctx, cx, cy + 1.6 * r, cx, cy + 3.3 * r, 0.3 * r, endo, lo);
    for (const s of [-1, 1]) {
      limb(ctx, cx + s * 0.8 * r, cy + 1.7 * r, cx + s * 1.2 * r, cy + 2.6 * r, 0.16 * r, endo, lo);
      limb(ctx, cx + s * 1.2 * r, cy + 2.6 * r, cx + s * 1.0 * r, cy + 3.5 * r, 0.14 * r, endo, lo);
      limb(ctx, cx + s * 0.35 * r, cy + 3.3 * r, cx + s * 0.5 * r, cy + 4.6 * r, 0.18 * r, endo, lo);
    }
  };

  /* ------------------------------------------------------------ sprites */
  const BOX = {
    stand: { w: 400, h: 720, cx: 200, cy: 166, r: 95 },
    face: { w: 640, h: 760, cx: 320, cy: 470, r: 185 },
    scare: { w: 1000, h: 1000, cx: 500, cy: 560, r: 280 },
    slump: { w: 420, h: 520, cx: 210, cy: 190, r: 95 },
  };
  C.BOX = BOX;

  C.render = function (name, pose, o) {
    o = o || {};
    const b = BOX[pose];
    const c = FNAF.makeCanvas(b.w, b.h);
    const ctx = c.getContext('2d');
    let eyes;
    if (pose === 'stand') {
      C.drawBody(ctx, name, b.cx, b.cy, b.r, o);
      eyes = C.drawHead(ctx, name, b.cx, b.cy, b.r, o);
    } else if (pose === 'slump') {
      // golden freddy sitting slumped
      const r = b.r, cx = b.cx, cy = b.cy;
      const P = PAL[name];
      // legs splayed forward
      for (const s of [-1, 1]) {
        limb(ctx, cx + s * 0.5 * r, cy + 2.8 * r, cx + s * 1.4 * r, cy + 3.2 * r, 0.5 * r, P.body, P.lo);
        sphere(ctx, cx + s * 1.75 * r, cy + 3.2 * r, 0.45 * r, 0.3 * r, P.body, P.hi, P.lo);
      }
      const g = ctx.createLinearGradient(cx - r, 0, cx + r, 0);
      g.addColorStop(0, P.lo); g.addColorStop(0.4, P.body); g.addColorStop(1, P.lo);
      ctx.fillStyle = g; FNAF.roundRect(ctx, cx - r, cy + 0.9 * r, 2 * r, 2.1 * r, 0.5 * r); ctx.fill();
      sphere(ctx, cx, cy + 2.1 * r, 0.6 * r, 0.8 * r, P.muzzle, P.muzzleHi, FNAF.darken(P.muzzle, 0.35));
      for (const s of [-1, 1]) {
        limb(ctx, cx + s * 0.95 * r, cy + 1.2 * r, cx + s * 1.5 * r, cy + 2.4 * r, 0.4 * r, P.body, P.lo);
        limb(ctx, cx + s * 1.5 * r, cy + 2.4 * r, cx + s * 1.3 * r, cy + 3.1 * r, 0.34 * r, P.body, P.lo);
      }
      const by = cy + 1.1 * r; ctx.fillStyle = P.bow;
      FNAF.poly(ctx, [[cx - 0.4 * r, by - 0.16 * r], [cx - 0.06 * r, by], [cx - 0.4 * r, by + 0.16 * r]]); ctx.fill();
      FNAF.poly(ctx, [[cx + 0.4 * r, by - 0.16 * r], [cx + 0.06 * r, by], [cx + 0.4 * r, by + 0.16 * r]]); ctx.fill();
      ctx.fillStyle = '#111'; FNAF.ellipse(ctx, cx, cy + 1.7 * r, 0.09 * r, 0.09 * r); ctx.fill(); FNAF.ellipse(ctx, cx, cy + 2.05 * r, 0.09 * r, 0.09 * r); ctx.fill();
      eyes = C.drawHead(ctx, name, cx, cy + 0.15 * r, r, Object.assign({ tilt: 0.25, mouth: 0.15 }, o));
    } else {
      eyes = C.drawHead(ctx, name, b.cx, b.cy, b.r, o);
    }
    c.eyes = eyes;
    return c;
  };

  C.get = function (name, pose, o) {
    o = o || {};
    const key = name + '|' + pose + '|' + JSON.stringify(o);
    let c = C.cache[key];
    if (!c) {
      c = C.render(name, pose, o);
      C.cache[key] = c;
    }
    return c;
  };

  /* darkened variant with glowing eyes kept bright */
  C.getDark = function (name, pose, o, dark, glow) {
    const d = Math.round(FNAF.clamp(dark, 0, 1) * 10);
    const key = name + '|' + pose + '|' + JSON.stringify(o || {}) + '|d' + d + (glow ? 'g' : '');
    let c = C.cache[key];
    if (!c) {
      const base = C.get(name, pose, o);
      c = FNAF.makeCanvas(base.width, base.height);
      const ctx = c.getContext('2d');
      ctx.drawImage(base, 0, 0);
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(0,0,0,' + (d / 10) + ')';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.globalCompositeOperation = 'source-over';
      if (glow && base.eyes) {
        for (const e of base.eyes) {
          const g = ctx.createRadialGradient(e[0], e[1], 0, e[0], e[1], e[2] * 2.4);
          g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.95)'); g.addColorStop(0.45, 'rgba(255,255,255,0.3)'); g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g; FNAF.ellipse(ctx, e[0], e[1], e[2] * 2.4, e[2] * 2.4); ctx.fill();
          ctx.fillStyle = '#000'; FNAF.ellipse(ctx, e[0], e[1], e[2] * 0.2, e[2] * 0.2); ctx.fill();
        }
      }
      C.cache[key] = c;
    }
    return c;
  };

  /* draw a sprite with its feet (bottom-center of box) at (x, y) scaled */
  C.draw = function (ctx, name, pose, x, y, scale, o) {
    o = o || {};
    const img = (o.dark || o.glow) ? C.getDark(name, pose, o.opts, o.dark || 0, o.glow) : C.get(name, pose, o.opts);
    const w = img.width * scale, h = img.height * scale;
    ctx.save();
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    if (o.flip) { ctx.translate(x, y); ctx.scale(-1, 1); ctx.translate(-x, -y); }
    if (o.rot) { ctx.translate(x, y); ctx.rotate(o.rot); ctx.translate(-x, -y); }
    ctx.drawImage(img, x - w / 2, y - h, w, h);
    ctx.restore();
    return { x: x - w / 2, y: y - h, w, h };
  };

  /* pre-warm the sprite cache so the first night doesn't hitch */
  C.prewarm = function () {
    for (const n of ['freddy', 'bonnie', 'chica', 'foxy']) {
      C.get(n, 'stand', n === 'bonnie' ? { guitar: true } : {});
      C.get(n, 'stand', {});
      C.get(n, 'face', {});
      C.get(n, 'scare', { mouth: 0.9 });
      C.get(n, 'scare', { mouth: 0.55 });
    }
    C.get('golden', 'slump', {});
    C.get('golden', 'scare', { mouth: 0.9 });
    C.get('golden', 'face', {});
  };
})();
