'use strict';
/* ---------------------------------------------------------------------------
 * screens.js - everything that isn't the night itself.
 * ------------------------------------------------------------------------- */
(function () {
  const S = FNAF.Screens = {};
  const A = () => FNAF.Audio;
  const W = FNAF.W, H = FNAF.H;

  function paperBg(ctx, x, y, w, h, tint) {
    ctx.save();
    ctx.fillStyle = ctx.createPattern(FNAF.tex.paper, 'repeat');
    ctx.fillRect(x, y, w, h);
    if (tint) { ctx.fillStyle = tint; ctx.fillRect(x, y, w, h); }
    ctx.restore();
  }

  /* ----------------------------------------------------------- warning */
  S.Warning = class {
    constructor(app) { this.app = app; this.t = 0; }
    ready() { return !(FNAF.R3 && FNAF.R3.ok && FNAF.R3.warmupTasks.length); }
    update(dt) { this.t += dt; if (this.t > 4 && this.ready()) this.app.toMenu(); }
    draw(ctx) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      FNAF.text(ctx, 'WARNING', 640, 230, { size: 42, bold: true, color: '#ddd', align: 'center' });
      FNAF.text(ctx, 'This game contains flashing lights and loud, sudden noises.', 640, 310, { size: 24, color: '#bbb', align: 'center' });
      FNAF.text(ctx, 'Headphones are recommended. Click to start, press F for fullscreen.', 640, 350, { size: 20, color: '#888', align: 'center' });
      if (!this.ready()) {
        const p = FNAF.R3.warmupProgress();
        FNAF.text(ctx, 'Preparing the building... ' + Math.round(p * 100) + '%', 640, 520, { size: 16, color: '#666', align: 'center' });
        ctx.fillStyle = '#222'; ctx.fillRect(440, 550, 400, 6); ctx.fillStyle = '#777'; ctx.fillRect(440, 550, 400 * p, 6);
      }
      FNAF.drawGrain(ctx, 0.3);
    }
    onClick() { if (this.ready()) this.app.toMenu(); }
    onKey() { if (this.ready()) this.app.toMenu(); }
    onMove() { }
  };

  /* -------------------------------------------------------------- menu */
  S.Menu = class {
    constructor(app) {
      this.app = app; this.t = 0; this.hover = -1; this.glitchT = 0; this.variant = 0; this.shiftX = 0; this.flash = 0;
      this.buildItems();
      A().menuDrone(true);
    }
    buildItems() {
      const s = this.app.save;
      this.items = [
        { label: 'New Game', action: 'new' },
        s.night > 1 ? { label: 'Continue', sub: 'Night ' + s.night, action: 'continue' } : null,
        s.beat5 ? { label: '6th Night', action: 'night6' } : null,
        s.beat6 ? { label: 'Custom Night', action: 'custom' } : null,
        { label: 'How to Play', action: 'help' },
      ].filter(Boolean);
    }
    itemRect(i) { return { x: 80, y: 392 + i * 58, w: 420, h: 52 }; }
    update(dt) {
      this.t += dt;
      this.glitchT -= dt;
      if (this.glitchT <= 0) {
        this.glitchT = FNAF.rand(0.06, 0.6);
        const r = Math.random();
        this.variant = r < 0.6 ? 0 : r < 0.75 ? 1 : r < 0.9 ? 2 : 3;
        this.shiftX = Math.random() < 0.3 ? FNAF.rand(-14, 14) : 0;
      }
      this.flash = Math.random() < 0.02 ? 1 : this.flash * 0.8;
    }
    draw(ctx) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      // freddy face, flickering
      const v = this.variant;
      const use3D = FNAF.R3 && FNAF.R3.ok;
      if (use3D) {
        const c = FNAF.R3.renderMenuFace(this.t, v);
        if (c) ctx.drawImage(c, this.shiftX, 0, W, H);
        ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(0, 0, W, H);
        const g = ctx.createLinearGradient(0, 0, 640, 0); g.addColorStop(0, 'rgba(0,0,0,0.85)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, 640, H);
        FNAF.drawNoise(ctx, 0.03 + this.flash * 0.3);
      } else {
        const o = v === 0 ? { dark: 0.6 } : v === 1 ? { dark: 0.45, opts: { mouth: 0.35 } } : v === 2 ? { dark: 0.93, glow: true } : { dark: 0.3, opts: { eyes: 'black' } };
        ctx.save();
        ctx.globalAlpha = 0.9;
        FNAF.Chars.draw(ctx, 'freddy', 'face', 960 + this.shiftX, 760, 1.0, o);
        ctx.restore();
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 0, W, H);
        FNAF.drawNoise(ctx, 0.08 + this.flash * 0.3);
        FNAF.drawScanlines(ctx, 0.35);
      }
      // title
      const jit = () => (Math.random() < 0.1 ? FNAF.rand(-2, 2) : 0);
      const tf = { family: FNAF.FONT_SERIF, bold: true, color: '#e8e8e8', shadow: '#000', shadowBlur: 10 };
      FNAF.text(ctx, 'Five', 80 + jit(), 50 + jit(), Object.assign({ size: 74 }, tf));
      FNAF.text(ctx, 'Nights', 80 + jit(), 130 + jit(), Object.assign({ size: 74 }, tf));
      FNAF.text(ctx, 'at', 80 + jit(), 215 + jit(), Object.assign({ size: 52 }, tf));
      FNAF.text(ctx, "Freddy's", 80 + jit(), 262 + jit(), Object.assign({ size: 74 }, tf));
      // stars
      const s = this.app.save;
      const stars = (s.beat5 ? 1 : 0) + (s.beat6 ? 1 : 0) + (s.beat420 ? 1 : 0);
      for (let i = 0; i < stars; i++) { ctx.fillStyle = '#eee'; drawStar(ctx, 100 + i * 44, 360, 16); }
      // items
      this.items.forEach((it, i) => {
        const r = this.itemRect(i);
        const hov = i === this.hover;
        if (hov) FNAF.text(ctx, '>>', r.x - 48, r.y + 6, { size: 36, bold: true, color: '#eee' });
        FNAF.text(ctx, it.label, r.x, r.y + 6, { size: 36, bold: hov, color: hov ? '#fff' : '#cfcfcf', shadow: '#000' });
        if (it.sub) FNAF.text(ctx, it.sub, r.x + 200, r.y + 20, { size: 18, color: '#999' });
      });
      FNAF.text(ctx, 'fan recreation - every image and sound is generated by code', 1250, 690, { size: 13, color: '#666', align: 'right' });
      FNAF.text(ctx, 'F: fullscreen', 30, 690, { size: 13, color: '#666' });
      FNAF.drawGrain(ctx, 0.25);
    }
    onMove(x, y) { this.hover = -1; this.items.forEach((it, i) => { if (FNAF.inRect(x, y, this.itemRect(i))) this.hover = i; }); }
    onClick(x, y) { this.onMove(x, y); if (this.hover >= 0) { A().blip(); this.app.menuAction(this.items[this.hover].action); } }
    onKey(k) {
      if (k === 'ArrowDown') this.hover = (this.hover + 1) % this.items.length;
      if (k === 'ArrowUp') this.hover = (this.hover - 1 + this.items.length) % this.items.length;
      if (k === 'Enter' && this.hover >= 0) this.app.menuAction(this.items[this.hover].action);
    }
    destroy() { A().menuDrone(false); }
  };
  function drawStar(ctx, x, y, s) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? s * 0.45 : s; const a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    ctx.closePath(); ctx.fill();
  }

  /* -------------------------------------------------------- newspaper */
  S.Newspaper = class {
    constructor(app) { this.app = app; this.t = 0; }
    update(dt) { this.t += dt; if (this.t > 7) this.app.afterNewspaper(); }
    draw(ctx) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.translate(640, 360); ctx.rotate(-0.01); ctx.translate(-640, -360);
      paperBg(ctx, 240, 20, 800, 700, 'rgba(120,90,40,0.18)');
      ctx.strokeStyle = '#4a3a20'; ctx.lineWidth = 2; ctx.strokeRect(260, 40, 760, 660);
      FNAF.text(ctx, 'HELP WANTED', 640, 70, { font: 'bold 64px ' + FNAF.FONT_SERIF, color: '#1a1a1a', align: 'center' });
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(290, 150, 700, 3);
      FNAF.text(ctx, "Freddy Fazbear's Pizza", 640, 170, { font: 'bold 36px ' + FNAF.FONT_SERIF, color: '#1a1a1a', align: 'center' });
      const body = "Family pizzeria looking for security guard to work the night shift. 12 AM to 6 AM.\n\nMonitor cameras, ensure safety of equipment and animatronic characters.\n\nNot responsible for injury/dismemberment.\n\n$120 a week.\n\nTo apply call:\n1-888-FAZ-FAZBEAR";
      FNAF.wrapText(ctx, body, 320, 230, 640, 30, { font: '24px ' + FNAF.FONT_SERIF, color: '#222' });
      // faint side columns
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      for (let i = 0; i < 18; i++) { ctx.fillRect(290, 560 + i * 7, 200 - Math.random() * 60, 2); ctx.fillRect(790, 560 + i * 7, 200 - Math.random() * 60, 2); }
      ctx.restore();
      ctx.drawImage(FNAF.tex.vignette, 0, 0);
      FNAF.drawGrain(ctx, 0.3);
      FNAF.text(ctx, 'click to continue', 1250, 690, { size: 14, color: '#777', align: 'right' });
    }
    onClick() { this.app.afterNewspaper(); }
    onKey() { this.app.afterNewspaper(); }
    onMove() { }
  };

  /* ------------------------------------------------------- night intro */
  S.NightIntro = class {
    constructor(app, num, levels) { this.app = app; this.num = num; this.levels = levels; this.t = 0; }
    update(dt) { this.t += dt; if (this.t > 3.6) this.app.startNight(this.num, this.levels); }
    draw(ctx) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      const ord = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th'][this.num - 1] || this.num + 'th';
      FNAF.text(ctx, '12:00 AM', 1220, 560, { size: 40, color: '#eee', align: 'right' });
      FNAF.text(ctx, this.num === 7 ? 'Custom Night' : ord + ' Night', 1220, 612, { size: 28, color: '#ddd', align: 'right' });
      FNAF.drawGrain(ctx, 0.25);
    }
    onClick() { } onKey() { } onMove() { }
  };

  /* ------------------------------------------------------------- 6 AM */
  S.SixAM = class {
    constructor(app, num, levels) { this.app = app; this.num = num; this.levels = levels; this.t = 0; this.chimed = false; this.cheered = false; }
    update(dt) {
      this.t += dt;
      if (this.t > 1.0 && !this.chimed) { this.chimed = true; A().chime(); }
      if (this.t > 1.8 && !this.cheered) { this.cheered = true; A().cheer(); }
      if (this.t > 7) this.app.afterSixAM(this.num, this.levels);
    }
    draw(ctx) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      const k = FNAF.clamp((this.t - 1.0) / 0.45, 0, 1);
      ctx.save();
      ctx.beginPath(); ctx.rect(440, 250, 400, 160); ctx.clip();
      FNAF.text(ctx, '5', 560, 270 - k * 160, { size: 120, bold: true, color: '#eee', align: 'center' });
      FNAF.text(ctx, '6', 560, 430 - k * 160, { size: 120, bold: true, color: '#eee', align: 'center' });
      ctx.restore();
      FNAF.text(ctx, 'AM', 760, 290, { size: 100, bold: true, color: '#eee', align: 'center' });
      FNAF.drawGrain(ctx, 0.25);
    }
    onClick() { if (this.t > 3) this.app.afterSixAM(this.num, this.levels); }
    onKey() { } onMove() { }
  };

  /* --------------------------------------------------------- game over */
  S.GameOver = class {
    constructor(app, name) { this.app = app; this.name = name; this.t = 0; A().staticLoop(true); }
    update(dt) { this.t += dt; if (this.t > 7) this.app.toMenu(); }
    draw(ctx) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      if (FNAF.R3 && FNAF.R3.ok) {
        const c = FNAF.R3.renderGameOver(this.t);
        if (c) ctx.drawImage(c, 0, 0, W, H);
        FNAF.drawNoise(ctx, 0.06);
        FNAF.text(ctx, 'GAME OVER', 40, 30, { size: 34, bold: true, color: '#999' });
        return;
      }
      // backstage-like floor
      let g = ctx.createLinearGradient(0, 300, 0, 720); g.addColorStop(0, '#0a0a0c'); g.addColorStop(1, '#2a2a30');
      ctx.fillStyle = g; ctx.fillRect(0, 300, W, 420);
      // the suit, slumped, with the guard's eyes and teeth inside
      ctx.save();
      ctx.translate(640, 760); ctx.rotate(0.12);
      const o = { eyes: 'black', mouth: 0.45 };
      const img = FNAF.Chars.get('freddy', 'face', o);
      const sc = 0.85;
      FNAF.Chars.draw(ctx, 'freddy', 'face', 0, 0, sc, { dark: 0.55, opts: o });
      // human eyeballs sitting in the sockets
      for (const e of img.eyes) {
        const ex = -img.width * sc / 2 + e[0] * sc, ey = -img.height * sc + e[1] * sc;
        ctx.fillStyle = '#ddd'; FNAF.ellipse(ctx, ex, ey, 11, 11); ctx.fill();
        ctx.fillStyle = '#222'; FNAF.ellipse(ctx, ex + 3, ey + 2, 4.5, 4.5); ctx.fill();
      }
      ctx.restore();
      ctx.drawImage(FNAF.tex.vignette, 0, 0);
      FNAF.drawNoise(ctx, 0.12);
      FNAF.drawScanlines(ctx, 0.4);
      FNAF.text(ctx, 'GAME OVER', 40, 30, { size: 34, bold: true, color: '#999' });
      FNAF.drawGrain(ctx, 0.3);
    }
    onClick() { if (this.t > 1.5) this.app.toMenu(); }
    onKey() { if (this.t > 1.5) this.app.toMenu(); }
    onMove() { }
    destroy() { A().staticLoop(false); }
  };

  /* ---------------------------------------------------------- paycheck */
  S.Paycheck = class {
    constructor(app, amount, words, memo) { this.app = app; this.amount = amount; this.words = words; this.memo = memo; this.t = 0; }
    update(dt) { this.t += dt; if (this.t > 9) this.app.toMenu(); }
    draw(ctx) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      const x = 190, y = 190, w = 900, h = 340;
      paperBg(ctx, x, y, w, h, 'rgba(180,200,220,0.25)');
      ctx.strokeStyle = '#345'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(40,60,90,0.3)'; ctx.lineWidth = 1; ctx.strokeRect(x + 8, y + 8, w - 16, h - 16);
      FNAF.text(ctx, "FREDDY FAZBEAR'S PIZZA", x + 30, y + 28, { font: 'bold 26px ' + FNAF.FONT_SERIF, color: '#1a2a44' });
      FNAF.text(ctx, 'Fazbear Entertainment', x + 30, y + 60, { size: 14, color: '#345' });
      FNAF.text(ctx, 'No. 0093', x + w - 30, y + 28, { size: 16, color: '#345', align: 'right' });
      FNAF.text(ctx, 'DATE  11-13-1993', x + w - 30, y + 60, { size: 16, color: '#1a2a44', align: 'right' });
      FNAF.text(ctx, 'PAY TO THE ORDER OF', x + 30, y + 120, { size: 14, color: '#345' });
      FNAF.text(ctx, 'Night Security Guard', x + 230, y + 112, { font: '28px ' + FNAF.FONT_SERIF, color: '#1a1a1a' });
      ctx.fillStyle = '#1a2a44'; ctx.fillRect(x + 225, y + 146, 420, 1);
      ctx.strokeStyle = '#1a2a44'; ctx.lineWidth = 2; ctx.strokeRect(x + w - 230, y + 108, 200, 44);
      FNAF.text(ctx, '$ ' + this.amount, x + w - 130, y + 118, { font: 'bold 28px ' + FNAF.FONT, color: '#1a1a1a', align: 'center' });
      FNAF.text(ctx, this.words + ' DOLLARS', x + 30, y + 185, { font: '22px ' + FNAF.FONT_SERIF, color: '#1a1a1a' });
      ctx.fillRect(x + 30, y + 214, 740, 1);
      FNAF.text(ctx, 'MEMO  ' + this.memo, x + 30, y + 270, { size: 16, color: '#345' });
      // signature scribble
      ctx.strokeStyle = '#1a2a44'; ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(x + 560, y + 285);
      for (let i = 0; i < 12; i++) ctx.quadraticCurveTo(x + 570 + i * 22, y + 250 + (i % 2) * 40, x + 580 + i * 22, y + 280);
      ctx.stroke();
      ctx.fillRect(x + 560, y + 300, 290, 1);
      FNAF.text(ctx, 'AUTHORIZED SIGNATURE', x + 705, y + 306, { size: 11, color: '#345', align: 'center' });
      FNAF.drawGrain(ctx, 0.2);
      FNAF.text(ctx, 'click to continue', 1250, 690, { size: 14, color: '#777', align: 'right' });
    }
    onClick() { if (this.t > 1) this.app.toMenu(); }
    onKey() { if (this.t > 1) this.app.toMenu(); }
    onMove() { }
  };

  S.PinkSlip = class {
    constructor(app) { this.app = app; this.t = 0; }
    update(dt) { this.t += dt; if (this.t > 10) this.app.toMenu(); }
    draw(ctx) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      const x = 290, y = 90, w = 700, h = 540;
      paperBg(ctx, x, y, w, h, 'rgba(240,120,160,0.35)');
      ctx.strokeStyle = '#633'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
      FNAF.text(ctx, 'NOTICE OF TERMINATION', x + w / 2, y + 36, { font: 'bold 32px ' + FNAF.FONT_SERIF, color: '#3a1a22', align: 'center' });
      FNAF.text(ctx, "Freddy Fazbear's Pizza - Fazbear Entertainment", x + w / 2, y + 80, { size: 16, color: '#533', align: 'center' });
      FNAF.text(ctx, 'Employee: Night Security Guard', x + 50, y + 140, { font: '22px ' + FNAF.FONT_SERIF, color: '#222' });
      FNAF.text(ctx, 'Position: Night Watch (12 AM - 6 AM)', x + 50, y + 172, { font: '22px ' + FNAF.FONT_SERIF, color: '#222' });
      FNAF.text(ctx, 'Reason(s) for termination:', x + 50, y + 240, { font: 'bold 22px ' + FNAF.FONT_SERIF, color: '#222' });
      ['Tampering with the animatronic characters.', 'General unprofessionalism.', 'Odor.'].forEach((r, i) => FNAF.text(ctx, '- ' + r, x + 70, y + 280 + i * 34, { font: '22px ' + FNAF.FONT_SERIF, color: '#222' }));
      FNAF.text(ctx, 'Please return your uniform and badge to management.', x + 50, y + 420, { font: '18px ' + FNAF.FONT_SERIF, color: '#333' });
      FNAF.text(ctx, 'Management', x + w - 60, y + 480, { font: 'italic 24px ' + FNAF.FONT_SERIF, color: '#3a1a22', align: 'right' });
      FNAF.drawGrain(ctx, 0.2);
      FNAF.text(ctx, 'click to continue', 1250, 690, { size: 14, color: '#777', align: 'right' });
    }
    onClick() { if (this.t > 1) this.app.toMenu(); }
    onKey() { if (this.t > 1) this.app.toMenu(); }
    onMove() { }
  };

  /* ------------------------------------------------------ custom night */
  S.CustomNight = class {
    constructor(app) {
      this.app = app; this.levels = [0, 0, 0, 0]; this.names = ['Freddy', 'Bonnie', 'Chica', 'Foxy']; this.keys = ['freddy', 'bonnie', 'chica', 'foxy'];
      this.hover = null; this.t = 0;
    }
    cardX(i) { return 170 + i * 250; }
    rects() {
      const r = [];
      for (let i = 0; i < 4; i++) {
        const cx = this.cardX(i);
        r.push({ id: 'minus' + i, x: cx - 95, y: 420, w: 50, h: 50 });
        r.push({ id: 'plus' + i, x: cx + 45, y: 420, w: 50, h: 50 });
      }
      r.push({ id: 'ready', x: 1010, y: 610, w: 220, h: 60 });
      r.push({ id: 'back', x: 50, y: 610, w: 220, h: 60 });
      return r;
    }
    update(dt) { this.t += dt; }
    draw(ctx) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      FNAF.text(ctx, 'CUSTOMIZE NIGHT 7', 640, 30, { size: 44, bold: true, color: '#eee', align: 'center' });
      FNAF.text(ctx, 'Set the A.I. level of each animatronic (0 - 20)', 640, 90, { size: 20, color: '#aaa', align: 'center' });
      for (let i = 0; i < 4; i++) {
        const cx = this.cardX(i);
        ctx.fillStyle = '#121214'; FNAF.roundRect(ctx, cx - 110, 130, 220, 360, 8); ctx.fill();
        ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.stroke();
        const pc = FNAF.R3 && FNAF.R3.ok ? FNAF.R3.portrait(this.keys[i]) : null;
        if (pc) ctx.drawImage(pc, cx - 105, 140, 210, 210);
        else FNAF.Chars.draw(ctx, this.keys[i], 'face', cx, 345, 0.26, { dark: 0.25 });
        FNAF.text(ctx, this.names[i], cx, 358, { size: 26, bold: true, color: '#eee', align: 'center' });
        FNAF.text(ctx, 'A.I. Level', cx, 392, { size: 14, color: '#999', align: 'center' });
        FNAF.text(ctx, String(this.levels[i]), cx, 426, { size: 40, bold: true, color: '#fff', align: 'center' });
      }
      for (const r of this.rects()) {
        const hov = this.hover === r.id;
        ctx.fillStyle = hov ? '#3a3a40' : '#222226'; FNAF.roundRect(ctx, r.x, r.y, r.w, r.h, 6); ctx.fill();
        ctx.strokeStyle = hov ? '#ccc' : '#555'; ctx.lineWidth = 2; ctx.stroke();
        const label = r.id.startsWith('minus') ? '<' : r.id.startsWith('plus') ? '>' : r.id === 'ready' ? 'READY' : 'GO BACK';
        FNAF.text(ctx, label, r.x + r.w / 2, r.y + r.h / 2, { size: r.w > 100 ? 26 : 30, bold: true, color: '#eee', align: 'center', baseline: 'middle' });
      }
      FNAF.text(ctx, 'Beat 20 / 20 / 20 / 20 to earn the third star.', 640, 530, { size: 16, color: '#777', align: 'center' });
      FNAF.drawGrain(ctx, 0.25);
    }
    onMove(x, y) { this.hover = null; for (const r of this.rects()) if (FNAF.inRect(x, y, r)) this.hover = r.id; }
    onClick(x, y) {
      this.onMove(x, y);
      const h = this.hover; if (!h) return;
      A().blip();
      if (h.startsWith('minus')) { const i = +h.slice(5); this.levels[i] = Math.max(0, this.levels[i] - 1); }
      else if (h.startsWith('plus')) { const i = +h.slice(4); this.levels[i] = Math.min(20, this.levels[i] + 1); }
      else if (h === 'back') this.app.toMenu();
      else if (h === 'ready') {
        if (this.levels.join() === '1,9,8,7') { this.app.goldenCrash(); return; }
        this.app.startCustom(this.levels.slice());
      }
    }
    onKey(k) { if (k === 'Escape') this.app.toMenu(); }
  };

  /* ------------------------------------------------------------- help */
  S.Help = class {
    constructor(app) { this.app = app; this.hover = null; }
    rects() {
      return [
        { id: 'captions', x: 80, y: 520, w: 260, h: 44 },
        { id: 'vol-', x: 400, y: 520, w: 44, h: 44 }, { id: 'vol+', x: 600, y: 520, w: 44, h: 44 },
        { id: 'reset', x: 760, y: 520, w: 260, h: 44 },
        { id: 'back', x: 80, y: 620, w: 220, h: 50 },
      ];
    }
    update() { }
    draw(ctx) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      FNAF.text(ctx, 'HOW TO PLAY', 80, 30, { size: 40, bold: true, color: '#eee' });
      const lines = [
        "You are the night security guard at Freddy Fazbear's Pizza, 12 AM to 6 AM.",
        'Move the mouse to the left or right edge of the screen to look around the office.',
        'Hover the bar at the bottom of the screen (or press SPACE) to raise and lower the camera monitor.',
        'Click the camera buttons on the map to switch cameras. The kitchen camera is audio only.',
        'Click DOOR to close a door and LIGHT to light up a doorway. Doors, lights and the monitor all drain power.',
        'If a character is standing in a doorway, close that door. If the power runs out, you are defenceless.',
        'Freddy will not move while you watch him. Foxy gets restless when nobody checks on Pirate Cove.',
        'Survive until 6 AM. Each night is harder than the last.',
      ];
      let ly = 96;
      for (const l of lines) ly = FNAF.wrapText(ctx, '- ' + l, 80, ly, 1120, 24, { size: 18, color: '#ccc' }) + 12;
      const s = this.app.save;
      for (const r of this.rects()) {
        const hov = this.hover === r.id;
        ctx.fillStyle = hov ? '#3a3a40' : '#1c1c20'; FNAF.roundRect(ctx, r.x, r.y, r.w, r.h, 6); ctx.fill();
        ctx.strokeStyle = hov ? '#ccc' : '#555'; ctx.lineWidth = 2; ctx.stroke();
        const label = r.id === 'captions' ? 'Captions: ' + (s.captions ? 'ON' : 'OFF') : r.id === 'vol-' ? '-' : r.id === 'vol+' ? '+' : r.id === 'reset' ? 'Reset save data' : 'BACK';
        FNAF.text(ctx, label, r.x + r.w / 2, r.y + r.h / 2, { size: 20, bold: true, color: '#eee', align: 'center', baseline: 'middle' });
      }
      FNAF.text(ctx, 'Volume ' + Math.round(s.volume * 100) + '%', 522, 542, { size: 18, color: '#ddd', align: 'center', baseline: 'middle' });
      FNAF.text(ctx, 'Phone calls use your browser\'s speech synthesis. If you hear no voice, keep captions on.', 80, 585, { size: 14, color: '#777' });
      FNAF.drawGrain(ctx, 0.25);
    }
    onMove(x, y) { this.hover = null; for (const r of this.rects()) if (FNAF.inRect(x, y, r)) this.hover = r.id; }
    onClick(x, y) {
      this.onMove(x, y); const h = this.hover; if (!h) return;
      const s = this.app.save; A().blip();
      if (h === 'captions') s.captions = !s.captions;
      if (h === 'vol-') { s.volume = Math.max(0, Math.round((s.volume - 0.1) * 10) / 10); A().setVolume(s.volume); }
      if (h === 'vol+') { s.volume = Math.min(1, Math.round((s.volume + 0.1) * 10) / 10); A().setVolume(s.volume); }
      if (h === 'reset') { this.app.save = Object.assign(FNAF.loadSave(), { night: 1, beat5: false, beat6: false, beat420: false, captions: s.captions, volume: s.volume }); }
      if (h === 'back') this.app.toMenu();
      FNAF.storeSave(this.app.save);
    }
    onKey(k) { if (k === 'Escape') this.app.toMenu(); }
  };

  /* --------------------------------------------------- golden freddy */
  S.GoldenCrash = class {
    constructor(app, silent) { this.app = app; this.t = 0; if (!silent) A().scream(); }
    update(dt) { this.t += dt; if (this.t > 3.2) this.app.toMenu(); }
    draw(ctx) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      if (this.t < 1.1) {
        if (FNAF.R3 && FNAF.R3.ok) {
          const c = FNAF.R3.renderJumpscare('golden', this.t, false);
          if (c) ctx.drawImage(c, 0, 0, W, H);
        } else {
          const mouth = (Math.floor(this.t * 16) % 2) ? 0.9 : 0.5;
          FNAF.Chars.draw(ctx, 'golden', 'scare', 640 + FNAF.rand(-30, 30), 980 + FNAF.rand(-20, 20), 1.1, { opts: { mouth }, dark: 0.2 });
        }
        FNAF.drawNoise(ctx, 0.2);
      }
    }
    onClick() { } onKey() { } onMove() { }
  };
})();
