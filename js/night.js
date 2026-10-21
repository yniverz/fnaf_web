'use strict';
/* ---------------------------------------------------------------------------
 * night.js - one night of gameplay.
 * ------------------------------------------------------------------------- */
(function () {
  const A = () => FNAF.Audio;
  const O = () => FNAF.Office;
  const M = () => FNAF.Monitor;

  const HOUR_LEN = 89;          // seconds per in-game hour (6 hours per night)
  const FLIP_TIME = 0.32;       // monitor flip animation
  const DOOR_TIME = 0.28;

  FNAF.Night = class {
    constructor(app, num, levels) {
      this.app = app; this.num = num;
      this.levels = (levels || FNAF.AI.NIGHT_AI[num] || FNAF.AI.NIGHT_AI[6]).slice();
      this.chars = FNAF.AI.create(this.levels);
      this.freddy = this.chars.freddy; this.bonnie = this.chars.bonnie; this.chica = this.chars.chica; this.foxy = this.chars.foxy;
      this.time = 0; this.hour = 0; this.t = 0;
      this.power = 100; this.powerTimer = 0; this.powerOut = false; this.powerOutT = 0; this.poStage = 0; this.poTick = 0; this.eyes = 0;
      this.leftDoor = 0; this.rightDoor = 0; this.leftDoorClosed = false; this.rightDoorClosed = false;
      this.leftLight = false; this.rightLight = false; this.leftDisabled = false; this.rightDisabled = false;
      this.monitorAnim = 0; this.monitorTarget = 0; this.monitorUp = false; this.cam = '1A'; this.hoverCam = null;
      this.stripArmed = false; this.burst = 0;
      this.scroll = O().MAX_SCROLL / 2; this.mouse = { x: 640, y: 360 };
      this.fanAngle = 0; this.flicker = 1;
      this.phone = new FNAF.Phone.Call(num);
      this.state = 'play'; this.fade = 1;
      this.intruder = null; this.jumpscare = null;
      this.golden = { poster: false, inOffice: false, t: 0 };
      this.ambientT = FNAF.rand(15, 30); this.potsT = 0; this.moanT = FNAF.rand(5, 12); this.glitchT = 0;
      this.shake = 0; this.itsMe = FNAF.chance(0.05);
      this.kitchenMusic = false;
      this.hallFootT = 0;
      A().fan(true); A().ambience(true);
      // tiny chance the office is just dark and quiet for a moment
      this.started = true;
    }

    /* ----------------------------------------------------------- AI hooks */
    get leftDoorClosedForAI() { return this.leftDoorClosed; }
    notifyMove(name, from, to) {
      if (this.monitorUp && (this.cam === from || this.cam === to)) { this.burst = Math.max(this.burst, 0.8); A().camSwitch(); }
      if (name === 'bonnie' || name === 'chica') {
        const close = ['2B', '4B', 'LDOOR', 'RDOOR', '3'].includes(to) || ['2B', '4B', 'LDOOR', 'RDOOR'].includes(from);
        A().footsteps(FNAF.randInt(2, 4), close ? 0.45 : 0.16, 1);
        if (to === '6' && name === 'chica') this.potsT = 1.5;
        if (to === 'LDOOR' || to === 'RDOOR') this.moanT = FNAF.rand(1.5, 4);
      }
      if (name === 'foxy' && to !== 'gone') A().creak();
      if (name === 'freddy' && to === '6' && this.monitorUp && this.cam === '6') this.updateKitchenMusic();
    }
    freddyLaugh() {
      const far = ['1B', '7'].includes(this.freddy.pos);
      A().laugh(far ? 0.35 : 0.6);
    }
    animatronicEntered(side, name) {
      this.intruder = { side, name, timer: FNAF.rand(6, 22) };
      if (side === 'left') { this.leftDisabled = true; if (this.leftLight) { this.leftLight = false; A().lightBuzz('L', false); } }
      else { this.rightDisabled = true; if (this.rightLight) { this.rightLight = false; A().lightBuzz('R', false); } }
      if (name === 'freddy' && !this.monitorUp) this.intruder.timer = FNAF.rand(0.8, 2.5);
      A().glitch();
    }
    animatronicBlocked(side, name) { A().footsteps(3, 0.3, 1.2); }
    foxyRunStart() {
      A().foxyRun();
      if (this.monitorUp && this.cam === '2A') this.burst = Math.max(this.burst, 0.5);
    }
    foxyArrived(attacks) {
      if (this.leftDoorClosed) {
        A().bang();
        this.shake = 1;
        const drain = 1 + 5 * (attacks - 1);
        this.power = Math.max(0, this.power - drain);
      } else this.triggerJumpscare('foxy');
    }

    triggerJumpscare(name) {
      if (this.state !== 'play') return;
      this.state = 'scare';
      this.jumpscare = { name, t: 0 };
      this.monitorAnim = 0; this.monitorTarget = 0; this.monitorUp = false;
      A().stopAll();
      A().scream();
      this.phone.stop();
    }

    /* ------------------------------------------------------------ input */
    onMove(x, y) { this.mouse.x = x; this.mouse.y = y; this.hoverCam = this.monitorUp ? M().hit(x, y, false) : null; }
    onClick(x, y) {
      if (this.state !== 'play') return;
      if (this.monitorAnim >= 1) {
        const h = M().hit(x, y, this.phone.active);
        if (h === 'mute') { this.phone.mute(); A().blip(); return; }
        if (h) this.switchCam(h);
        return;
      }
      if (this.monitorAnim > 0) return;
      const h = O().hit(x, y, this.scroll);
      if (!h) return;
      if (h === 'nose') { A().honk(); return; }
      if (this.powerOut) { A().error(); return; }
      if (h === 'ldoor') { if (this.leftDisabled) { A().error(); return; } this.leftDoorClosed = !this.leftDoorClosed; A().door(); }
      if (h === 'rdoor') { if (this.rightDisabled) { A().error(); return; } this.rightDoorClosed = !this.rightDoorClosed; A().door(); }
      if (h === 'llight') { if (this.leftDisabled) { A().error(); return; } this.leftLight = !this.leftLight; A().lightBuzz('L', this.leftLight); A().click(); }
      if (h === 'rlight') { if (this.rightDisabled) { A().error(); return; } this.rightLight = !this.rightLight; A().lightBuzz('R', this.rightLight); A().click(); }
    }
    onKey(k) {
      if (this.state !== 'play') return;
      if (k === ' ' || k === 'c' || k === 'C') this.toggleMonitor();
    }
    switchCam(id) {
      if (id === this.cam) return;
      this.cam = id; this.burst = 1; A().camSwitch();
      if (id !== '2B') this.golden.poster = false;
      else if (!this.golden.poster && FNAF.chance(1 / 100)) this.golden.poster = true;
      this.updateKitchenMusic();
    }
    updateKitchenMusic() {
      const want = this.monitorUp && this.cam === '6' && this.freddy.pos === '6' && !this.powerOut;
      if (want && !this.kitchenMusic) { A().musicStart(0.85, 0.08); this.kitchenMusic = true; }
      if (!want && this.kitchenMusic) { A().musicStop(); this.kitchenMusic = false; }
    }
    canFlip() { return this.state === 'play' && !this.powerOut; }
    toggleMonitor() {
      if (!this.canFlip()) return;
      if (this.monitorTarget === 0) { this.monitorTarget = 1; A().camUp(); A().staticLoop(true); this.burst = 0.6; }
      else { this.monitorTarget = 0; A().camDown(); A().staticLoop(false); }
    }
    onMonitorFullyUp() {
      this.monitorUp = true;
      if (this.golden.inOffice) { this.golden.inOffice = false; }
      this.updateKitchenMusic();
      this.hoverCam = M().hit(this.mouse.x, this.mouse.y, false);
    }
    onMonitorFullyDown() {
      this.monitorUp = false;
      this.foxy.onMonitorDown();
      this.updateKitchenMusic();
      if (this.intruder) { this.triggerJumpscare(this.intruder.name); return; }
      if (this.golden.poster) { this.golden.poster = false; this.golden.inOffice = true; this.golden.t = 0; A().breath(); }
    }

    /* ----------------------------------------------------------- update */
    update(dt) {
      this.t += dt;
      this.fade = Math.max(0, this.fade - dt / 1.5);
      if (this.state === 'scare') {
        this.jumpscare.t += dt;
        if (this.jumpscare.t > 1.4) {
          if (this.jumpscare.name === 'golden') this.app.goldenCrash(); else this.app.gameOver(this.jumpscare.name);
          this.state = 'done';
        }
        return;
      }
      if (this.state !== 'play') return;

      // clock
      this.time += dt;
      const h = Math.floor(this.time / HOUR_LEN);
      if (h > this.hour) { this.hour = h; FNAF.AI.hourBump(this.chars, h); if (h >= 6) { this.win(); return; } }

      // monitor flip
      if (this.monitorAnim !== this.monitorTarget) {
        const dir = this.monitorTarget > this.monitorAnim ? 1 : -1;
        this.monitorAnim = FNAF.clamp(this.monitorAnim + dir * dt / FLIP_TIME, 0, 1);
        if (this.monitorAnim >= 1 && dir > 0) this.onMonitorFullyUp();
        if (this.monitorAnim <= 0 && dir < 0) this.onMonitorFullyDown();
        if (this.state !== 'play') return;
      }
      this.burst = Math.max(0, this.burst - dt * 2.4);
      // flip strip hover
      const inStrip = FNAF.inRect(this.mouse.x, this.mouse.y, O().R.strip);
      if (inStrip) { if (this.stripArmed && this.canFlip() && this.monitorAnim === this.monitorTarget) { this.toggleMonitor(); this.stripArmed = false; } }
      else this.stripArmed = true;

      // doors
      const lt = this.leftDoorClosed ? 1 : 0, rt = this.rightDoorClosed ? 1 : 0;
      this.leftDoor = FNAF.clamp(this.leftDoor + Math.sign(lt - this.leftDoor) * dt / DOOR_TIME, 0, 1);
      this.rightDoor = FNAF.clamp(this.rightDoor + Math.sign(rt - this.rightDoor) * dt / DOOR_TIME, 0, 1);

      // office scroll (monitor down only)
      if (this.monitorAnim === 0) {
        const mx = this.mouse.x;
        if (mx < 260) this.scroll -= ((260 - mx) / 260) * 650 * dt;
        else if (mx > FNAF.W - 260) this.scroll += ((mx - (FNAF.W - 260)) / 260) * 650 * dt;
        this.scroll = FNAF.clamp(this.scroll, 0, O().MAX_SCROLL);
      }
      this.fanAngle += dt * (this.powerOut ? 0 : 22);
      this.flicker = 1 - (Math.random() < 0.08 ? Math.random() * 0.5 : 0);
      this.shake = Math.max(0, this.shake - dt * 2.5);

      // power
      if (!this.powerOut) {
        const usage = this.usage();
        this.powerTimer += dt;
        const per = 9.6 / usage;
        while (this.powerTimer >= per) { this.powerTimer -= per; this.power = Math.max(0, this.power - 1); }
        if (this.power <= 0) this.startPowerOut();
      } else this.updatePowerOut(dt);

      // animatronics
      if (!this.powerOut) {
        for (const c of Object.values(this.chars)) { c.update(dt, this); if (this.state !== 'play') return; }
        if (this.intruder && !this.monitorUp && this.monitorAnim === 0) {
          this.intruder.timer -= dt;
          if (this.intruder.timer <= 0) { this.triggerJumpscare(this.intruder.name); return; }
        }
      }
      // golden freddy in the office
      if (this.golden.inOffice) {
        this.golden.t += dt;
        if (this.golden.t > 4.5) { this.triggerJumpscare('golden'); return; }
      }
      // phone
      this.phone.update(dt);
      // ambient sound events
      this.ambientT -= dt;
      if (this.ambientT <= 0) {
        this.ambientT = FNAF.rand(18, 45);
        const r = Math.random();
        if (r < 0.4) A().creak(); else if (r < 0.6) A().childLaugh(); else if (r < 0.8) A().footsteps(2, 0.12, 0.8); else A().endoClank();
      }
      if (this.chica.pos === '6' && !this.powerOut) {
        this.potsT -= dt;
        if (this.potsT <= 0) { this.potsT = FNAF.rand(2.5, 7); A().pots(this.monitorUp && this.cam === '6' ? 0.5 : 0.14); }
      }
      if ((this.bonnie.pos === 'LDOOR' || this.chica.pos === 'RDOOR') && !this.powerOut) {
        this.moanT -= dt;
        if (this.moanT <= 0) { this.moanT = FNAF.rand(6, 14); A().moan(0.22); }
      }
      if (this.intruder) { this.glitchT -= dt; if (this.glitchT <= 0) { this.glitchT = FNAF.rand(0.8, 3); A().glitch(); this.burst = Math.max(this.burst, 0.4); } }
    }

    usage() {
      let u = 1 + (this.leftDoorClosed ? 1 : 0) + (this.rightDoorClosed ? 1 : 0) + (this.leftLight ? 1 : 0) + (this.rightLight ? 1 : 0) + (this.monitorTarget ? 1 : 0);
      return Math.min(5, u);
    }

    startPowerOut() {
      this.powerOut = true; this.powerOutT = 0; this.poStage = 0; this.poTick = 0; this.eyes = 0;
      this.leftDoorClosed = false; this.rightDoorClosed = false;
      if (this.leftLight) { this.leftLight = false; A().lightBuzz('L', false); }
      if (this.rightLight) { this.rightLight = false; A().lightBuzz('R', false); }
      this.monitorTarget = 0;
      if (this.monitorAnim > 0) { this.monitorAnim = 0; this.onMonitorFullyDown(); }
      A().staticLoop(false); A().fan(false); A().ambience(false); A().musicStop(); this.kitchenMusic = false;
      A().powerDown();
      this.poNext = FNAF.rand(3, 6);
    }
    updatePowerOut(dt) {
      this.powerOutT += dt;
      if (this.poStage === 0) {
        if (this.powerOutT >= this.poNext) { this.poStage = 1; this.poTick = 0; A().musicStart(1.0, 0.26); }
      } else if (this.poStage === 1) {
        this.eyes = 0.6 + 0.4 * (Math.random() < 0.85 ? 1 : 0);
        this.poTick += dt;
        if (this.poTick >= 5) { this.poTick = 0; if (FNAF.chance(0.2)) { this.poStage = 2; this.eyes = 0; A().musicStop(); } }
      } else if (this.poStage === 2) {
        this.poTick += dt;
        if (this.poTick >= 2) { this.poTick = 0; if (FNAF.chance(0.2)) this.triggerJumpscare('freddy'); }
      }
    }

    win() {
      this.state = 'won';
      A().stopAll();
      this.phone.stop();
      this.app.nightWon(this.num, this.levels);
    }
    destroy() { A().stopAll(); this.phone.stop(); }

    /* ------------------------------------------------------------- draw */
    roomState() {
      return {
        bonnie: this.bonnie.pos, chica: this.chica.pos, freddy: this.freddy.pos,
        foxy: { stage: this.foxy.stage, running: this.foxy.running, runT: this.foxy.runT },
        golden: this.golden.poster, itsMe: this.itsMe, t: this.t,
      };
    }
    draw(ctx) {
      if (this.state === 'scare' || this.state === 'done') { this.drawJumpscare(ctx); return; }
      ctx.save();
      if (this.shake > 0) ctx.translate((Math.random() - 0.5) * 24 * this.shake, (Math.random() - 0.5) * 24 * this.shake);
      if (this.monitorAnim < 1) {
        O().draw(ctx, {
          scroll: this.scroll, leftDoor: this.leftDoor, rightDoor: this.rightDoor, leftLight: this.leftLight, rightLight: this.rightLight,
          bonnieAtDoor: this.bonnie.pos === 'LDOOR', chicaAtDoor: this.chica.pos === 'RDOOR', fanAngle: this.fanAngle,
          powerOut: this.powerOut, freddyEyes: this.eyes, golden: this.golden.inOffice, t: this.t,
          leftDisabled: this.leftDisabled, rightDisabled: this.rightDisabled, lightFlicker: this.flicker,
        });
      }
      if (this.monitorAnim > 0) {
        ctx.save();
        const a = this.monitorAnim;
        // flip: the monitor rises from the bottom edge
        ctx.translate(0, FNAF.H); ctx.scale(1, a); ctx.translate(0, -FNAF.H);
        ctx.beginPath(); ctx.rect(0, 0, FNAF.W, FNAF.H); ctx.clip();
        M().draw(ctx, { cam: this.cam, hoverCam: this.hoverCam, burst: this.burst, t: this.t, room: this.roomState(), callActive: this.phone.active, muted: this.phone.muted });
        if (a < 1) { ctx.fillStyle = 'rgba(0,0,0,' + (1 - a) * 0.6 + ')'; ctx.fillRect(0, 0, FNAF.W, FNAF.H); }
        ctx.restore();
      }
      ctx.restore();
      this.drawHUD(ctx);
      if (this.canFlip()) O().drawStrip(ctx, this.monitorAnim > 0 ? 0.35 : 0.55);
      // captions
      if (this.phone.active && this.phone.caption && this.app.save.captions) {
        ctx.save();
        ctx.font = FNAF.font(20);
        const maxW = 700;
        const lines = [];
        let line = '';
        for (const w of this.phone.caption.split(' ')) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
        if (line) lines.push(line);
        const bh = lines.length * 26 + 16;
        const cx = this.monitorAnim > 0 ? 440 : 640, by = this.monitorAnim > 0 ? 606 : 600;
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(cx - maxW / 2 - 12, by - bh, maxW + 24, bh);
        lines.forEach((l, i) => FNAF.text(ctx, l, cx, by + 8 - bh + i * 26, { size: 20, color: '#f3e9c6', align: 'center' }));
        ctx.restore();
      }
      if (this.golden.inOffice) { FNAF.drawNoise(ctx, 0.12); }
      FNAF.drawGrain(ctx, 0.35);
      if (this.fade > 0) { ctx.fillStyle = 'rgba(0,0,0,' + this.fade + ')'; ctx.fillRect(0, 0, FNAF.W, FNAF.H); }
    }
    drawHUD(ctx) {
      // power
      if (!this.powerOut) {
        FNAF.text(ctx, 'Power left: ' + Math.round(this.power) + '%', 30, 626, { size: 26, color: '#eee', shadow: '#000' });
        FNAF.text(ctx, 'Usage:', 30, 664, { size: 24, color: '#eee', shadow: '#000' });
        const u = this.usage();
        const cols = ['#2ecc40', '#2ecc40', '#e6d31a', '#f08a1a', '#e0302a'];
        for (let i = 0; i < u; i++) { ctx.fillStyle = cols[i]; ctx.fillRect(126 + i * 20, 660, 16, 30); }
      } else {
        FNAF.text(ctx, 'Power left: 0%', 30, 626, { size: 26, color: '#777' });
      }
      // time
      const hr = this.hour === 0 ? 12 : this.hour;
      FNAF.text(ctx, hr + ' AM', 1250, 22, { size: 46, bold: true, color: '#eee', align: 'right', shadow: '#000' });
      FNAF.text(ctx, this.num === 7 ? 'Custom Night' : 'Night ' + this.num, 1250, 76, { size: 26, color: '#eee', align: 'right', shadow: '#000' });
    }
    drawJumpscare(ctx) {
      const js = this.jumpscare;
      const t = js ? js.t : 0;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, FNAF.W, FNAF.H);
      if (t > 1.15) { FNAF.drawNoise(ctx, 1); return; }
      const name = js.name;
      const sc = 1.0 + Math.min(t, 0.5) * 1.1;
      const mouth = (Math.floor(t * 14) % 2) ? 0.9 : 0.55;
      const sx = (Math.random() - 0.5) * 70, sy = (Math.random() - 0.5) * 50;
      let x = 640 + sx, y = 1000 + sy;
      if (name === 'foxy') { x = FNAF.lerp(-200, 640, Math.min(1, t * 4)) + sx; }
      if (name === 'freddy' && this.powerOut) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, FNAF.W, FNAF.H); }
      FNAF.Chars.draw(ctx, name, 'scare', x, y, sc, { opts: { mouth } });
      if (t < 0.08) { ctx.fillStyle = 'rgba(255,255,255,' + (1 - t / 0.08) * 0.8 + ')'; ctx.fillRect(0, 0, FNAF.W, FNAF.H); }
      FNAF.drawNoise(ctx, 0.15);
    }
  };
})();
