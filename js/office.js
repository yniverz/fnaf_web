'use strict';
/* ---------------------------------------------------------------------------
 * office.js - the security office. A 1600px-wide scene that scrolls with the
 * mouse. Doors, lights, buttons, fan, posters, power-out and Golden Freddy.
 * ------------------------------------------------------------------------- */
(function () {
  const O = FNAF.Office = {};
  O.SCENE_W = 1600;
  O.MAX_SCROLL = O.SCENE_W - FNAF.W;

  // scene-space rectangles
  O.R = {
    ldoor: { x: 100, y: 95, w: 180, h: 505 },
    rdoor: { x: 1400, y: 95, w: 180, h: 505 },
    lpanel: { x: 318, y: 300, w: 56, h: 160 },
    rpanel: { x: 1218, y: 300, w: 56, h: 160 },
    lDoorBtn: { x: 324, y: 310, w: 44, h: 60 },
    lLightBtn: { x: 324, y: 388, w: 44, h: 60 },
    rDoorBtn: { x: 1224, y: 310, w: 44, h: 60 },
    rLightBtn: { x: 1224, y: 388, w: 44, h: 60 },
    window: { x: 1290, y: 125, w: 92, h: 210 },
    poster: { x: 620, y: 150, w: 200, h: 200 },
    rules: { x: 860, y: 160, w: 95, h: 175 },
    nose: { x: 720 - 5, y: 150 + 158, w: 14, h: 12 },
    strip: { x: 300, y: 655, w: 680, h: 65 },   // screen space
  };

  let bg = null, hallL = null, hallR = null, fanBase = null, fanBlades = null, doorImg = null;

  function checkerFloor(ctx, x0, y0, w, h, cols, rows, a, b) {
    for (let j = 0; j < rows; j++) {
      const t0 = j / rows, t1 = (j + 1) / rows;
      const y1 = y0 + h * (1 - Math.pow(1 - t0, 1.6)), y2 = y0 + h * (1 - Math.pow(1 - t1, 1.6));
      for (let i = 0; i < cols; i++) {
        ctx.fillStyle = ((i + j) & 1) ? a : b;
        ctx.fillRect(x0 + i * w / cols, y1, w / cols + 1, y2 - y1 + 1);
      }
    }
  }

  function buildBackground() {
    const c = FNAF.makeCanvas(O.SCENE_W, FNAF.H);
    const ctx = c.getContext('2d');
    const W = O.SCENE_W, H = FNAF.H;
    // walls
    let g = ctx.createLinearGradient(0, 90, 0, 520);
    g.addColorStop(0, '#2b2d36'); g.addColorStop(1, '#1b1c22');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 520);
    // ceiling
    g = ctx.createLinearGradient(0, 0, 0, 90);
    g.addColorStop(0, '#0d0d10'); g.addColorStop(1, '#1e1f25');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 90);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    for (let x = 0; x < W; x += 110) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 30, 90); ctx.stroke(); }
    // wall band
    for (let x = 0; x < W; x += 40) { ctx.fillStyle = ((x / 40) & 1) ? '#cfcfcf' : '#111'; ctx.fillRect(x, 92, 40, 18); ctx.fillStyle = ((x / 40) & 1) ? '#111' : '#cfcfcf'; ctx.fillRect(x, 110, 40, 18); }
    // wall texture lines
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    for (let y = 140; y < 520; y += 26) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    // floor
    checkerFloor(ctx, -200, 520, W + 400, 200, 22, 7, '#a9a9a9', '#1a1a1a');
    g = ctx.createLinearGradient(0, 520, 0, 720); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0.15)');
    ctx.fillStyle = g; ctx.fillRect(0, 520, W, 200);
    // door frames
    for (const r of [O.R.ldoor, O.R.rdoor]) {
      ctx.fillStyle = '#56585f'; ctx.fillRect(r.x - 18, r.y - 18, r.w + 36, r.h + 18);
      ctx.fillStyle = '#3a3c42'; ctx.fillRect(r.x - 10, r.y - 10, r.w + 20, r.h + 10);
      ctx.fillStyle = '#050507'; ctx.fillRect(r.x, r.y, r.w, r.h);
    }
    // panels
    for (const p of [O.R.lpanel, O.R.rpanel]) {
      ctx.fillStyle = '#17181c'; FNAF.roundRect(ctx, p.x - 6, p.y - 8, p.w + 12, p.h + 16, 8); ctx.fill();
      ctx.fillStyle = '#2a2c33'; FNAF.roundRect(ctx, p.x, p.y, p.w, p.h, 6); ctx.fill();
      ctx.strokeStyle = '#555'; ctx.lineWidth = 2; ctx.stroke();
    }
    // window (right)
    const w = O.R.window;
    ctx.fillStyle = '#4a4c54'; ctx.fillRect(w.x - 10, w.y - 10, w.w + 20, w.h + 20);
    ctx.fillStyle = '#050507'; ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.strokeStyle = '#4a4c54'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(w.x + w.w / 2, w.y); ctx.lineTo(w.x + w.w / 2, w.y + w.h); ctx.stroke();
    // posters
    const p = O.R.poster;
    ctx.save(); ctx.translate(p.x + p.w / 2, p.y + p.h / 2); ctx.rotate(-0.02); ctx.translate(-p.w / 2, -p.h / 2);
    ctx.fillStyle = '#e6dfca'; ctx.fillRect(0, 0, p.w, p.h);
    ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.strokeRect(0, 0, p.w, p.h);
    FNAF.text(ctx, 'CELEBRATE!', p.w / 2, 8, { font: 'bold 28px ' + FNAF.FONT_TITLE, color: '#c0392b', align: 'center' });
    FNAF.Chars.draw(ctx, 'bonnie', 'stand', p.w * 0.25, p.h * 0.95, 0.19, { opts: { guitar: true } });
    FNAF.Chars.draw(ctx, 'freddy', 'stand', p.w * 0.5, p.h * 0.97, 0.21, {});
    FNAF.Chars.draw(ctx, 'chica', 'stand', p.w * 0.75, p.h * 0.95, 0.19, {});
    ctx.restore();
    const r = O.R.rules;
    ctx.fillStyle = '#efe9d8'; ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.strokeRect(r.x, r.y, r.w, r.h);
    FNAF.text(ctx, 'RULES FOR', r.x + r.w / 2, r.y + 6, { size: 11, bold: true, color: '#222', align: 'center' });
    FNAF.text(ctx, 'SAFETY', r.x + r.w / 2, r.y + 19, { size: 11, bold: true, color: '#222', align: 'center' });
    ['1. Don\'t run.', '2. Don\'t yell.', '3. Don\'t scream.', '4. Don\'t poop', '   on floor.', '5. Stay close', '   to mom.', '6. Don\'t touch', '   Freddy.', '7. Don\'t hit.', '8. Leave before', '   dark.'].forEach((t, i) => FNAF.text(ctx, t, r.x + 6, r.y + 38 + i * 11, { size: 9, color: '#333' }));
    // kids' drawings on the left wall
    const drawings = [[400, 180], [470, 170], [540, 190]];
    drawings.forEach(([x, y], i) => {
      const rnd = FNAF.seeded(300 + i);
      ctx.fillStyle = '#efe9d8'; ctx.fillRect(x, y, 56, 70);
      for (let k = 0; k < 4; k++) { ctx.strokeStyle = ['#d33', '#36c', '#3a3', '#e92'][k]; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 5 + rnd() * 46, y + 5 + rnd() * 60); ctx.lineTo(x + 5 + rnd() * 46, y + 5 + rnd() * 60); ctx.lineTo(x + 5 + rnd() * 46, y + 5 + rnd() * 60); ctx.stroke(); }
    });
    // desk
    g = ctx.createLinearGradient(0, 480, 0, 720); g.addColorStop(0, '#5a5f6a'); g.addColorStop(1, '#2d3036');
    FNAF.poly(ctx, [[430, 480], [1170, 480], [1320, 720], [280, 720]]); ctx.fillStyle = g; ctx.fill();
    ctx.fillStyle = '#23252b'; FNAF.poly(ctx, [[430, 480], [1170, 480], [1172, 488], [428, 488]]); ctx.fill();
    // desk clutter: papers
    ctx.save(); ctx.translate(900, 560); ctx.rotate(0.15); ctx.fillStyle = '#d9d4c4'; ctx.fillRect(-50, -35, 100, 70); ctx.strokeStyle = '#888'; ctx.lineWidth = 1; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-40, -22 + i * 11); ctx.lineTo(40, -22 + i * 11); ctx.stroke(); } ctx.restore();
    ctx.save(); ctx.translate(760, 600); ctx.rotate(-0.25); ctx.fillStyle = '#cfcab8'; ctx.fillRect(-45, -30, 90, 60); ctx.restore();
    // monitors
    const mon = (x, y, w, h) => {
      ctx.fillStyle = '#2b2d33'; FNAF.roundRect(ctx, x, y, w, h, 8); ctx.fill();
      ctx.fillStyle = '#0a0c10'; ctx.fillRect(x + 8, y + 8, w - 16, h - 24);
      ctx.fillStyle = '#1b1d24'; ctx.fillRect(x + w * 0.3, y + h, w * 0.4, 14); ctx.fillRect(x + w * 0.15, y + h + 12, w * 0.7, 8);
    };
    mon(690, 372, 150, 112); mon(1010, 395, 120, 90);
    // phone
    ctx.fillStyle = '#1a1a1e'; FNAF.roundRect(ctx, 1150, 455, 70, 34, 5); ctx.fill();
    ctx.fillStyle = '#2d2d33'; FNAF.roundRect(ctx, 1158, 440, 54, 16, 6); ctx.fill();
    for (let i = 0; i < 6; i++) { ctx.fillStyle = '#555'; ctx.fillRect(1160 + (i % 3) * 14, 462 + Math.floor(i / 3) * 10, 9, 6); }
    // soda cup
    ctx.fillStyle = '#c42b2b'; ctx.fillRect(650, 450, 26, 40); ctx.fillStyle = '#eee'; ctx.fillRect(648, 446, 30, 6); ctx.strokeStyle = '#eee'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(663, 446); ctx.lineTo(670, 420); ctx.stroke();
    // cupcake on desk
    FNAF.Chars.drawCupcake(ctx, 1100, 455, 22);
    // cables on ceiling
    ctx.strokeStyle = '#111'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, 20); ctx.quadraticCurveTo(300, 70, 600, 30); ctx.quadraticCurveTo(900, 0, 1600, 40); ctx.stroke();
    ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 50); ctx.quadraticCurveTo(400, 90, 800, 50); ctx.quadraticCurveTo(1200, 20, 1600, 70); ctx.stroke();
    // vent above right door
    ctx.fillStyle = '#3a3c42'; ctx.fillRect(1440, 30, 100, 40);
    for (let i = 0; i < 4; i++) { ctx.fillStyle = '#111'; ctx.fillRect(1446, 36 + i * 9, 88, 4); }
    // ambient lighting: warm pool over the desk
    g = ctx.createRadialGradient(800, 420, 50, 800, 420, 700);
    g.addColorStop(0, 'rgba(255,230,190,0.10)'); g.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    return c;
  }

  function buildHall(mirror) {
    // lit hallway seen through a doorway (180x505)
    const c = FNAF.makeCanvas(180, 505);
    const ctx = c.getContext('2d');
    let g = ctx.createLinearGradient(0, 0, 0, 505);
    g.addColorStop(0, '#3a3d46'); g.addColorStop(0.75, '#22242a'); g.addColorStop(1, '#111');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 180, 505);
    // far wall band
    for (let x = 0; x < 180; x += 20) { ctx.fillStyle = ((x / 20) & 1) ? '#bbb' : '#111'; ctx.fillRect(x, 40, 20, 10); ctx.fillStyle = ((x / 20) & 1) ? '#111' : '#bbb'; ctx.fillRect(x, 50, 20, 10); }
    // receding side wall
    g = ctx.createLinearGradient(mirror ? 180 : 0, 0, mirror ? 0 : 180, 0);
    g.addColorStop(0, '#2a2c33'); g.addColorStop(1, '#14151a');
    ctx.fillStyle = g;
    if (!mirror) FNAF.poly(ctx, [[0, 0], [70, 60], [70, 360], [0, 505]]); else FNAF.poly(ctx, [[180, 0], [110, 60], [110, 360], [180, 505]]);
    ctx.fill();
    // floor
    checkerFloor(ctx, -60, 300, 300, 205, 8, 6, '#9a9a9a', '#181818');
    // a poster far away
    ctx.fillStyle = '#d8d2c0'; ctx.fillRect(mirror ? 118 : 30, 120, 30, 40);
    g = ctx.createRadialGradient(90, 250, 20, 90, 250, 300);
    g.addColorStop(0, 'rgba(255,240,210,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 180, 505);
    return c;
  }

  function buildDoor() {
    const c = FNAF.makeCanvas(180, 505);
    const ctx = c.getContext('2d');
    let g = ctx.createLinearGradient(0, 0, 180, 0);
    g.addColorStop(0, '#5c5f66'); g.addColorStop(0.5, '#8a8d95'); g.addColorStop(1, '#4a4d54');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 180, 505);
    for (let y = 0; y < 505; y += 36) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, y, 180, 6);
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(0, y + 6, 180, 3);
    }
    ctx.fillStyle = '#2a2c31'; ctx.fillRect(0, 0, 12, 505); ctx.fillRect(168, 0, 12, 505);
    // rivets
    ctx.fillStyle = '#333';
    for (let y = 18; y < 505; y += 36) { FNAF.ellipse(ctx, 6, y, 3, 3); ctx.fill(); FNAF.ellipse(ctx, 174, y, 3, 3); ctx.fill(); }
    return c;
  }

  function buildFan() {
    fanBase = FNAF.makeCanvas(160, 190);
    let ctx = fanBase.getContext('2d');
    // pedestal
    ctx.fillStyle = '#2a2c31'; FNAF.ellipse(ctx, 80, 178, 46, 11); ctx.fill();
    ctx.fillStyle = '#44464d'; ctx.fillRect(72, 110, 16, 70);
    // cage
    ctx.strokeStyle = '#8c8f97'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(80, 80, 70, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1.2; ctx.strokeStyle = '#a0a3aa';
    for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; ctx.beginPath(); ctx.moveTo(80, 80); ctx.lineTo(80 + Math.cos(a) * 70, 80 + Math.sin(a) * 70); ctx.stroke(); }
    for (let r = 20; r < 70; r += 16) { ctx.beginPath(); ctx.arc(80, 80, r, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = '#2d2f35'; FNAF.ellipse(ctx, 80, 80, 14, 14); ctx.fill();
    fanBlades = FNAF.makeCanvas(140, 140);
    ctx = fanBlades.getContext('2d');
    ctx.translate(70, 70);
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = 'rgba(200,205,215,0.85)';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(50, -40, 62, 0); ctx.quadraticCurveTo(50, 20, 0, 0); ctx.fill();
    }
  }

  O.init = function () {
    bg = buildBackground();
    hallL = buildHall(false);
    hallR = buildHall(true);
    doorImg = buildDoor();
    buildFan();
  };

  function button(ctx, r, label, active, red, disabled) {
    const base = red ? (active ? '#e8322c' : '#7a1d1a') : (active ? '#e8e8e8' : '#8a8a8a');
    ctx.fillStyle = '#111'; FNAF.roundRect(ctx, r.x - 3, r.y - 3, r.w + 6, r.h + 6, 8); ctx.fill();
    const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
    g.addColorStop(0, FNAF.lighten(base, 0.2)); g.addColorStop(1, FNAF.darken(base, 0.3));
    ctx.fillStyle = g; FNAF.roundRect(ctx, r.x, r.y, r.w, r.h, 6); ctx.fill();
    if (active) {
      ctx.save(); ctx.shadowColor = base; ctx.shadowBlur = 22; ctx.fillStyle = 'rgba(255,255,255,0.0)'; FNAF.roundRect(ctx, r.x, r.y, r.w, r.h, 6); ctx.fill(); ctx.restore();
    }
    FNAF.text(ctx, label, r.x + r.w / 2, r.y + r.h / 2, { size: 11, bold: true, color: active ? '#111' : '#ddd', align: 'center', baseline: 'middle' });
    if (disabled) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; FNAF.roundRect(ctx, r.x, r.y, r.w, r.h, 6); ctx.fill(); }
  }

  /* st: {scroll,leftDoor,rightDoor,leftLight,rightLight,bonnieAtDoor,chicaAtDoor,fanAngle,powerOut,freddyEyes,golden,t,leftDisabled,rightDisabled,lightFlicker} */
  O.draw = function (ctx, st) {
    if (!bg) O.init();
    ctx.save();
    ctx.translate(-Math.round(st.scroll), 0);
    ctx.drawImage(bg, 0, 0);
    const R = O.R;
    const flick = st.lightFlicker !== undefined ? st.lightFlicker : 1;
    // left doorway
    if (st.leftLight && !st.powerOut) {
      ctx.save(); ctx.globalAlpha = 0.85 * flick;
      ctx.drawImage(hallL, R.ldoor.x, R.ldoor.y);
      if (st.bonnieAtDoor) FNAF.Chars.draw(ctx, 'bonnie', 'stand', R.ldoor.x + 92, R.ldoor.y + R.ldoor.h - 8, 0.66, { dark: 0.25 });
      ctx.restore();
    } else if (st.powerOut && st.freddyEyes > 0) {
      ctx.save(); ctx.globalAlpha = st.freddyEyes;
      FNAF.Chars.draw(ctx, 'freddy', 'face', R.ldoor.x + 95, R.ldoor.y + 330, 0.42, { dark: 0.93, glow: true });
      ctx.restore();
    }
    // left door
    if (st.leftDoor > 0) {
      ctx.save(); ctx.beginPath(); ctx.rect(R.ldoor.x, R.ldoor.y, R.ldoor.w, R.ldoor.h); ctx.clip();
      ctx.drawImage(doorImg, R.ldoor.x, R.ldoor.y - R.ldoor.h * (1 - st.leftDoor));
      ctx.restore();
    }
    // right window + doorway
    if (st.rightLight && !st.powerOut) {
      ctx.save(); ctx.globalAlpha = 0.85 * flick;
      ctx.drawImage(hallR, R.rdoor.x, R.rdoor.y);
      if (st.chicaAtDoor) FNAF.Chars.draw(ctx, 'chica', 'stand', R.rdoor.x + 88, R.rdoor.y + R.rdoor.h - 8, 0.66, { dark: 0.25 });
      // window
      ctx.beginPath(); ctx.rect(R.window.x, R.window.y, R.window.w, R.window.h); ctx.clip();
      ctx.fillStyle = '#2a2c33'; ctx.fillRect(R.window.x, R.window.y, R.window.w, R.window.h);
      if (st.chicaAtDoor) FNAF.Chars.draw(ctx, 'chica', 'face', R.window.x + 50, R.window.y + 230, 0.3, { dark: 0.35 });
      ctx.restore();
      ctx.strokeStyle = '#4a4c54'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(R.window.x + R.window.w / 2, R.window.y); ctx.lineTo(R.window.x + R.window.w / 2, R.window.y + R.window.h); ctx.stroke();
    }
    if (st.rightDoor > 0) {
      ctx.save(); ctx.beginPath(); ctx.rect(R.rdoor.x, R.rdoor.y, R.rdoor.w, R.rdoor.h); ctx.clip();
      ctx.drawImage(doorImg, R.rdoor.x, R.rdoor.y - R.rdoor.h * (1 - st.rightDoor));
      ctx.restore();
    }
    // buttons
    button(ctx, R.lDoorBtn, 'DOOR', st.leftDoor >= 1, true, st.leftDisabled);
    button(ctx, R.lLightBtn, 'LIGHT', !!st.leftLight, false, st.leftDisabled);
    button(ctx, R.rDoorBtn, 'DOOR', st.rightDoor >= 1, true, st.rightDisabled);
    button(ctx, R.rLightBtn, 'LIGHT', !!st.rightLight, false, st.rightDisabled);
    // fan
    ctx.drawImage(fanBase, 480, 300);
    ctx.save(); ctx.translate(560, 380); ctx.rotate(st.fanAngle || 0); ctx.globalAlpha = st.powerOut ? 1 : 0.7; ctx.drawImage(fanBlades, -70, -70); ctx.restore();
    // monitor glow (static) on the desk monitors
    if (!st.powerOut) {
      const a = 0.25 + 0.1 * Math.sin(st.t * 30);
      ctx.save(); ctx.globalAlpha = a; ctx.imageSmoothingEnabled = false;
      const nf = FNAF.tex.noise[(st.t * 25 | 0) % FNAF.tex.noise.length];
      ctx.drawImage(nf, 698, 380, 134, 88);
      ctx.restore();
      ctx.fillStyle = 'rgba(80,120,160,0.18)'; ctx.fillRect(1018, 403, 104, 66);
    }
    // golden freddy
    if (st.golden) {
      ctx.save(); ctx.globalAlpha = 0.9 + 0.1 * Math.sin(st.t * 40);
      FNAF.Chars.draw(ctx, 'golden', 'slump', 800, 720, 0.78, { dark: 0.35 });
      ctx.restore();
    }
    ctx.restore();
    if (st.powerOut) {
      ctx.fillStyle = 'rgba(0,0,0,0.82)'; ctx.fillRect(0, 0, FNAF.W, FNAF.H);
    }
    ctx.drawImage(FNAF.tex.vignette, 0, 0);
  };

  O.drawStrip = function (ctx, alpha) {
    const s = O.R.strip;
    ctx.save(); ctx.globalAlpha = alpha === undefined ? 0.55 : alpha;
    ctx.fillStyle = '#fff';
    ctx.fillRect(s.x, s.y + 24, s.w, 18);
    ctx.fillStyle = '#000';
    // chevrons
    for (const cx of [s.x + s.w / 2 - 60, s.x + s.w / 2 + 60]) {
      ctx.beginPath(); ctx.moveTo(cx - 10, s.y + 26); ctx.lineTo(cx, s.y + 33); ctx.lineTo(cx - 10, s.y + 40); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + 10, s.y + 26); ctx.lineTo(cx, s.y + 33); ctx.lineTo(cx + 10, s.y + 40); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  };

  /* hit test in screen space */
  O.hit = function (sx, sy, scroll) {
    const x = sx + scroll, y = sy;
    const R = O.R;
    if (FNAF.inRect(x, y, R.lDoorBtn)) return 'ldoor';
    if (FNAF.inRect(x, y, R.lLightBtn)) return 'llight';
    if (FNAF.inRect(x, y, R.rDoorBtn)) return 'rdoor';
    if (FNAF.inRect(x, y, R.rLightBtn)) return 'rlight';
    if (FNAF.inRect(x, y, R.nose)) return 'nose';
    return null;
  };
})();
