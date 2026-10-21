'use strict';
/* ---------------------------------------------------------------------------
 * ai.js - animatronic behaviour. Mirrors the original's movement-opportunity
 * system: every N seconds roll 1..20; move if roll <= AI level.
 * ------------------------------------------------------------------------- */
(function () {
  const AI = FNAF.AI = {};
  // [Freddy, Bonnie, Chica, Foxy]
  AI.NIGHT_AI = { 1: [0, 0, 0, 0], 2: [0, 3, 1, 1], 3: [1, 0, 5, 2], 4: [1, 2, 4, 6], 5: [3, 5, 7, 5], 6: [4, 10, 12, 16] };
  AI.INTERVAL = { freddy: 3.02, bonnie: 4.97, chica: 4.98, foxy: 5.01 };
  const pick = FNAF.pick, randInt = FNAF.randInt;

  class Base {
    constructor(name, ai) { this.name = name; this.ai = ai; this.timer = Math.random() * 2; this.interval = AI.INTERVAL[name]; this.inOffice = false; }
    roll() { return randInt(1, 20) <= this.ai; }
  }

  class Bonnie extends Base {
    constructor(ai) { super('bonnie', ai); this.pos = '1A'; }
    update(dt, N) {
      if (this.inOffice) return;
      this.timer += dt;
      if (this.timer < this.interval) return;
      this.timer -= this.interval;
      if (!this.roll()) return;
      this.move(N);
    }
    move(N) {
      const from = this.pos; let to;
      switch (from) {
        case '1A': to = '1B'; break;
        case '1B': to = pick(['5', '2A', '2A']); break;
        case '5': to = pick(['1B', '2A']); break;
        case '2A': to = pick(['3', '2B', '2B']); break;
        case '3': to = pick(['2A', '2B']); break;
        case '2B': to = 'LDOOR'; break;
        case 'LDOOR':
          if (N.leftDoorClosed) { to = pick(['1B', '5', '2A']); N.animatronicBlocked('left', 'bonnie'); }
          else { this.pos = 'OFFICE'; this.inOffice = true; N.animatronicEntered('left', 'bonnie'); return; }
          break;
        default: to = '1B';
      }
      this.pos = to;
      N.notifyMove('bonnie', from, to);
    }
  }

  class Chica extends Base {
    constructor(ai) { super('chica', ai); this.pos = '1A'; }
    update(dt, N) {
      if (this.inOffice) return;
      this.timer += dt;
      if (this.timer < this.interval) return;
      this.timer -= this.interval;
      if (!this.roll()) return;
      this.move(N);
    }
    move(N) {
      const from = this.pos; let to;
      switch (from) {
        case '1A': to = '1B'; break;
        case '1B': to = pick(['7', '6', '4A']); break;
        case '7': to = pick(['6', '4A', '1B']); break;
        case '6': to = pick(['7', '4A', '4A']); break;
        case '4A': to = pick(['4B', '4B', '6']); break;
        case '4B': to = pick(['RDOOR', 'RDOOR', '4A']); break;
        case 'RDOOR':
          if (N.rightDoorClosed) { to = pick(['1B', '6', '4A']); N.animatronicBlocked('right', 'chica'); }
          else { this.pos = 'OFFICE'; this.inOffice = true; N.animatronicEntered('right', 'chica'); return; }
          break;
        default: to = '1B';
      }
      this.pos = to;
      N.notifyMove('chica', from, to);
    }
  }

  class Freddy extends Base {
    constructor(ai) { super('freddy', ai); this.pos = '1A'; this.pending = false; }
    update(dt, N) {
      if (this.inOffice) return;
      this.timer += dt;
      if (this.timer >= this.interval) {
        this.timer -= this.interval;
        if (this.roll()) this.pending = true;
      }
      if (!this.pending) return;
      if (this.pos === '1A' && (N.bonnie.pos === '1A' || N.chica.pos === '1A')) { this.pending = false; return; }
      if (this.pos === '4B') {
        if (N.monitorUp) return;                 // Freddy only enters while the monitor is down
        this.pending = false;
        if (N.rightDoorClosed) { this.pos = '4A'; N.notifyMove('freddy', '4B', '4A'); N.animatronicBlocked('right', 'freddy'); }
        else { this.pos = 'OFFICE'; this.inOffice = true; N.animatronicEntered('right', 'freddy'); }
        return;
      }
      if (N.monitorUp && N.cam === this.pos) return;   // he will not move while watched
      this.pending = false;
      const path = ['1A', '1B', '7', '6', '4A', '4B'];
      const from = this.pos, to = path[path.indexOf(from) + 1];
      this.pos = to;
      N.notifyMove('freddy', from, to);
      N.freddyLaugh();
    }
  }

  class Foxy extends Base {
    constructor(ai) {
      super('foxy', ai);
      this.stage = 0; this.running = false; this.runT = 0; this.leaveT = 0; this.left = false;
      this.cooldown = 0; this.attacks = 0;
      this.RUN_VISIBLE = 1.6; this.RUN_TIME = 2.4;
    }
    get pos() { return this.left ? 'HALL' : 'COVE'; }
    update(dt, N) {
      if (this.left) {
        if (!this.running) {
          this.leaveT -= dt;
          if (this.leaveT <= 0) { this.running = true; this.runT = 0; N.foxyRunStart(); }
          return;
        }
        this.runT += dt;
        if (this.runT >= this.RUN_TIME) {
          this.running = false; this.left = false; this.stage = 0;
          this.cooldown = FNAF.rand(6, 14);
          this.attacks++;
          N.foxyArrived(this.attacks);
        }
        return;
      }
      if (this.cooldown > 0) this.cooldown -= dt;
      this.timer += dt;
      if (this.timer < this.interval) return;
      this.timer -= this.interval;
      if (N.monitorUp || this.cooldown > 0) return;
      if (!this.roll()) return;
      this.stage++;
      if (this.stage >= 4) {
        this.left = true; this.running = false; this.leaveT = FNAF.rand(1.0, 4.0);
        N.notifyMove('foxy', 'cove3', 'gone');
      } else N.notifyMove('foxy', 'cove' + (this.stage - 1), 'cove' + this.stage);
    }
    onMonitorDown() { this.cooldown = Math.max(this.cooldown, FNAF.rand(0.83, 16.67)); }
  }

  AI.create = function (levels) {
    return {
      freddy: new Freddy(levels[0]),
      bonnie: new Bonnie(levels[1]),
      chica: new Chica(levels[2]),
      foxy: new Foxy(levels[3]),
    };
  };

  /* hourly difficulty bumps (2 AM: Bonnie; 3 AM and 4 AM: Bonnie, Chica, Foxy) */
  AI.hourBump = function (chars, hour) {
    const bump = c => { c.ai = Math.min(20, c.ai + 1); };
    if (hour === 2) bump(chars.bonnie);
    if (hour === 3 || hour === 4) { bump(chars.bonnie); bump(chars.chica); bump(chars.foxy); }
  };
})();
