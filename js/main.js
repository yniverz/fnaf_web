'use strict';
/* ---------------------------------------------------------------------------
 * main.js - app shell: canvas scaling, input, screen state machine, saves.
 * ------------------------------------------------------------------------- */
(function () {
  const W = FNAF.W, H = FNAF.H;

  class App {
    constructor() {
      this.canvas = document.getElementById('game');
      this.ctx = this.canvas.getContext('2d');
      this.save = FNAF.loadSave();
      this.screen = null; this.last = 0; this.started = false;
      this.boot = document.getElementById('boot');
      window.addEventListener('resize', () => this.resize());
      this.resize();
      const btn = document.getElementById('boot-btn');
      btn.addEventListener('click', () => this.start());
    }

    resize() {
      const ww = window.innerWidth, wh = window.innerHeight;
      const s = Math.min(ww / W, wh / H);
      this.canvas.style.width = Math.floor(W * s) + 'px';
      this.canvas.style.height = Math.floor(H * s) + 'px';
    }

    start() {
      if (this.started) return;
      this.started = true;
      FNAF.Audio.init();
      FNAF.Audio.setVolume(this.save.volume);
      FNAF.Audio.resume();
      const status = document.getElementById('boot-status');
      const btn = document.getElementById('boot-btn');
      btn.disabled = true; btn.textContent = 'LOADING...';
      if (status) status.textContent = 'Building Freddy Fazbear\'s Pizza...';
      setTimeout(() => {
        FNAF.buildTextures();
        FNAF.Chars.prewarm();
        FNAF.Office.init();
        let ok = false;
        if (FNAF.R3 && FNAF.R3.init) { try { ok = FNAF.R3.init(); } catch (e) { console.error(e); ok = false; } }
        if (!ok) { FNAF.Rooms.prewarm(); console.warn('WebGL renderer unavailable, using the 2D fallback'); }
        this.use3D = ok;
        if (ok) FNAF.R3.buildWarmup();
        this.boot.classList.add('hidden');
        this.bindInput();
        this.setScreen(new FNAF.Screens.Warning(this));
        requestAnimationFrame(ts => this.loop(ts));
      }, 40);
    }

    toCanvas(cx, cy) {
      const r = this.canvas.getBoundingClientRect();
      return { x: (cx - r.left) * (W / r.width), y: (cy - r.top) * (H / r.height) };
    }

    bindInput() {
      const c = this.canvas;
      c.addEventListener('mousemove', e => { const p = this.toCanvas(e.clientX, e.clientY); this.screen && this.screen.onMove(p.x, p.y); });
      c.addEventListener('mousedown', e => {
        if (e.button !== 0) return;
        FNAF.Audio.resume();
        const p = this.toCanvas(e.clientX, e.clientY);
        this.screen && this.screen.onMove(p.x, p.y);
        this.screen && this.screen.onClick(p.x, p.y);
      });
      c.addEventListener('contextmenu', e => e.preventDefault());
      c.addEventListener('touchstart', e => {
        e.preventDefault(); FNAF.Audio.resume();
        const t = e.changedTouches[0]; const p = this.toCanvas(t.clientX, t.clientY);
        this.screen && this.screen.onMove(p.x, p.y);
        this.screen && this.screen.onClick(p.x, p.y);
      }, { passive: false });
      c.addEventListener('touchmove', e => {
        e.preventDefault();
        const t = e.changedTouches[0]; const p = this.toCanvas(t.clientX, t.clientY);
        this.screen && this.screen.onMove(p.x, p.y);
      }, { passive: false });
      window.addEventListener('keydown', e => {
        if (e.key === 'f' || e.key === 'F') { this.toggleFullscreen(); return; }
        if (e.key === ' ') e.preventDefault();
        this.screen && this.screen.onKey(e.key);
      });
      document.addEventListener('visibilitychange', () => { if (!document.hidden) FNAF.Audio.resume(); });
    }

    toggleFullscreen() {
      const el = document.getElementById('wrap');
      if (!document.fullscreenElement) { if (el.requestFullscreen) el.requestFullscreen().catch(() => { }); }
      else if (document.exitFullscreen) document.exitFullscreen();
    }

    setScreen(s) {
      if (this.screen && this.screen.destroy) this.screen.destroy();
      this.screen = s;
      this.canvas.classList.toggle('hidecursor', false);
    }

    loop(ts) {
      const dt = Math.min(0.05, (ts - this.last) / 1000 || 0.016);
      this.last = ts;
      try {
        if (this.use3D && FNAF.R3.warmupTasks.length) FNAF.R3.warmupStep();
        if (this.screen) { this.screen.update(dt); this.screen.draw(this.ctx); }
      } catch (e) { console.error(e); }
      requestAnimationFrame(t => this.loop(t));
    }

    /* ----------------------------------------------------------- flow */
    toMenu() { this.setScreen(new FNAF.Screens.Menu(this)); }
    menuAction(a) {
      if (a === 'new') { this.save.night = 1; FNAF.storeSave(this.save); this.setScreen(new FNAF.Screens.Newspaper(this)); }
      else if (a === 'continue') this.setScreen(new FNAF.Screens.NightIntro(this, this.save.night));
      else if (a === 'night6') this.setScreen(new FNAF.Screens.NightIntro(this, 6));
      else if (a === 'custom') this.setScreen(new FNAF.Screens.CustomNight(this));
      else if (a === 'help') this.setScreen(new FNAF.Screens.Help(this));
    }
    afterNewspaper() { this.setScreen(new FNAF.Screens.NightIntro(this, 1)); }
    startNight(num, levels) { this.setScreen(new FNAF.Night(this, num, levels)); }
    startCustom(levels) { this.setScreen(new FNAF.Screens.NightIntro(this, 7, levels)); }
    nightWon(num, levels) {
      if (num < 5) this.save.night = num + 1;
      if (num === 5) { this.save.beat5 = true; this.save.night = 5; }
      if (num === 6) this.save.beat6 = true;
      if (num === 7 && levels && levels.every(v => v === 20)) this.save.beat420 = true;
      FNAF.storeSave(this.save);
      this.setScreen(new FNAF.Screens.SixAM(this, num, levels));
    }
    afterSixAM(num, levels) {
      if (num < 5) this.setScreen(new FNAF.Screens.NightIntro(this, num + 1));
      else if (num === 5) this.setScreen(new FNAF.Screens.Paycheck(this, '120.00', 'ONE HUNDRED TWENTY AND 00/100', 'Night shift, week 1'));
      else if (num === 6) this.setScreen(new FNAF.Screens.Paycheck(this, '120.50', 'ONE HUNDRED TWENTY AND 50/100', 'Night shift + overtime'));
      else this.setScreen(new FNAF.Screens.PinkSlip(this));
    }
    gameOver(name) { this.setScreen(new FNAF.Screens.GameOver(this, name)); }
    goldenCrash(silent) { this.setScreen(new FNAF.Screens.GoldenCrash(this, silent)); }
  }

  window.addEventListener('DOMContentLoaded', () => { window.fnafApp = new App(); });
})();
