'use strict';
/* ---------------------------------------------------------------------------
 * audio.js - Web Audio synthesizer. Every sound in the game is generated here.
 * ------------------------------------------------------------------------- */
(function () {
  const A = FNAF.Audio = {
    ctx: null, master: null, comp: null, sfxBus: null, ambBus: null,
    noiseBuf: null, brownBuf: null, loops: {}, inited: false, volume: 0.8,
    musicOn: false, musicTimer: null, musicIdx: 0, musicNext: 0, musicRate: 1, musicGain: 0.22,
    speechOk: false, voice: null, currentUtter: null, speaking: false,
  };

  A.init = function () {
    if (A.inited) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { A.inited = true; return; }
    A.ctx = new AC();
    A.comp = A.ctx.createDynamicsCompressor();
    A.comp.threshold.value = -12; A.comp.ratio.value = 6; A.comp.attack.value = 0.003; A.comp.release.value = 0.2;
    A.master = A.ctx.createGain();
    A.master.gain.value = A.volume;
    A.sfxBus = A.ctx.createGain();
    A.ambBus = A.ctx.createGain();
    A.sfxBus.connect(A.master); A.ambBus.connect(A.master);
    A.master.connect(A.comp); A.comp.connect(A.ctx.destination);
    // noise buffers
    const sr = A.ctx.sampleRate, len = sr * 2;
    A.noiseBuf = A.ctx.createBuffer(1, len, sr);
    A.brownBuf = A.ctx.createBuffer(1, len, sr);
    const w = A.noiseBuf.getChannelData(0), b = A.brownBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const v = Math.random() * 2 - 1;
      w[i] = v;
      last = (last + 0.02 * v) / 1.02;
      b[i] = last * 3.5;
    }
    // distortion curve
    const curve = new Float32Array(2048);
    for (let i = 0; i < 2048; i++) { const x = (i / 1024) - 1; curve[i] = Math.tanh(x * 12) / Math.tanh(12) ; }
    A.distCurve = curve;
    A.inited = true;
    A.initSpeech();
  };

  A.resume = function () { if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume(); };
  A.now = () => (A.ctx ? A.ctx.currentTime : 0);
  A.setVolume = v => { A.volume = v; if (A.master) A.master.gain.value = v; };

  /* ---- primitives --------------------------------------------------------- */
  function bus(o) { return (o && o.bus === 'amb') ? A.ambBus : A.sfxBus; }

  function applyFilter(node, f) {
    if (!f) return node;
    const fl = A.ctx.createBiquadFilter();
    fl.type = f[0]; fl.frequency.value = f[1]; fl.Q.value = f[2] || 1;
    node.connect(fl);
    return fl;
  }

  /* play a buffer with envelope; returns handle */
  A.playBuf = function (buf, o) {
    if (!A.ctx) return null;
    o = o || {};
    const t = o.t !== undefined ? o.t : A.now();
    const src = A.ctx.createBufferSource();
    src.buffer = buf; src.loop = !!o.loop;
    src.playbackRate.value = o.rate || 1;
    let node = src;
    let filterNode = null;
    if (o.filter) { filterNode = applyFilter(node, o.filter); node = filterNode; }
    if (o.filterEnd && filterNode) {
      filterNode.frequency.setValueAtTime(o.filter[1], t);
      filterNode.frequency.exponentialRampToValueAtTime(Math.max(20, o.filterEnd), t + (o.dur || 1));
    }
    if (o.dist) { const ws = A.ctx.createWaveShaper(); ws.curve = A.distCurve; node.connect(ws); node = ws; }
    const g = A.ctx.createGain();
    const peak = o.gain !== undefined ? o.gain : 0.5;
    const atk = o.attack !== undefined ? o.attack : 0.005;
    const rel = o.release !== undefined ? o.release : 0.05;
    const dur = o.dur || (o.loop ? 1e9 : buf.duration);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + atk);
    if (!o.loop) {
      g.gain.setValueAtTime(peak, t + Math.max(atk, dur - rel));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.01);
    }
    node.connect(g); g.connect(o.dest || bus(o));
    src.start(t);
    if (!o.loop) src.stop(t + dur + 0.05);
    return { src, gain: g, filter: filterNode, stop: (fade) => {
      const n = A.now(); g.gain.cancelScheduledValues(n); g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), n);
      g.gain.exponentialRampToValueAtTime(0.0001, n + (fade || 0.05)); try { src.stop(n + (fade || 0.05) + 0.02); } catch (e) { }
    } };
  };

  A.osc = function (o) {
    if (!A.ctx) return null;
    const t = o.t !== undefined ? o.t : A.now();
    const os = A.ctx.createOscillator();
    os.type = o.type || 'sine';
    os.frequency.setValueAtTime(o.freq, t);
    if (o.freqEnd) os.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqEnd), t + (o.dur || 0.5));
    if (o.detune) os.detune.value = o.detune;
    let node = os;
    if (o.vibrato) {
      const lfo = A.ctx.createOscillator(); lfo.frequency.value = o.vibrato[0];
      const lg = A.ctx.createGain(); lg.gain.value = o.vibrato[1];
      lfo.connect(lg); lg.connect(os.frequency); lfo.start(t); lfo.stop(t + (o.dur || 0.5) + 0.1);
    }
    if (o.filter) node = applyFilter(node, o.filter);
    if (o.dist) { const ws = A.ctx.createWaveShaper(); ws.curve = A.distCurve; node.connect(ws); node = ws; }
    const g = A.ctx.createGain();
    const peak = o.gain !== undefined ? o.gain : 0.3;
    const atk = o.attack !== undefined ? o.attack : 0.01;
    const rel = o.release !== undefined ? o.release : 0.05;
    const dur = o.dur || 0.5;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + atk);
    if (o.decay) g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * 0.3), t + atk + o.decay);
    g.gain.setValueAtTime(o.decay ? Math.max(0.0001, peak * 0.3) : peak, t + Math.max(atk, dur - rel));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.01);
    if (o.tremolo) {
      const lfo = A.ctx.createOscillator(); lfo.frequency.value = o.tremolo[0];
      const lg = A.ctx.createGain(); lg.gain.value = o.tremolo[1] * peak;
      lfo.connect(lg); lg.connect(g.gain); lfo.start(t); lfo.stop(t + dur + 0.1);
    }
    node.connect(g); g.connect(o.dest || bus(o));
    os.start(t); os.stop(t + dur + 0.05);
    return { src: os, gain: g };
  };

  /* ---- loops ------------------------------------------------------------- */
  A.stopLoop = function (name, fade) {
    const l = A.loops[name];
    if (!l) return;
    delete A.loops[name];
    const n = A.now();
    l.gain.gain.cancelScheduledValues(n);
    l.gain.gain.setValueAtTime(Math.max(0.0001, l.gain.gain.value), n);
    l.gain.gain.exponentialRampToValueAtTime(0.0001, n + (fade || 0.1));
    for (const s of l.sources) { try { s.stop(n + (fade || 0.1) + 0.05); } catch (e) { } }
  };

  function makeLoop(name, build, fadeIn, target, toBus) {
    if (!A.ctx || A.loops[name]) return;
    const g = A.ctx.createGain();
    g.gain.setValueAtTime(0.0001, A.now());
    g.gain.exponentialRampToValueAtTime(target, A.now() + (fadeIn || 0.2));
    g.connect(toBus || A.ambBus);
    const sources = build(g);
    A.loops[name] = { gain: g, sources };
  }

  A.fan = function (on) {
    if (!on) { A.stopLoop('fan', 0.4); return; }
    makeLoop('fan', g => {
      const s = A.ctx.createBufferSource(); s.buffer = A.brownBuf; s.loop = true;
      const f = A.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 650;
      const f2 = A.ctx.createBiquadFilter(); f2.type = 'highpass'; f2.frequency.value = 90;
      s.connect(f); f.connect(f2);
      const ng = A.ctx.createGain(); ng.gain.value = 0.55; f2.connect(ng); ng.connect(g);
      // blade whir: amplitude modulation
      const lfo = A.ctx.createOscillator(); lfo.frequency.value = 23;
      const lg = A.ctx.createGain(); lg.gain.value = 0.12; lfo.connect(lg); lg.connect(ng.gain);
      const hum = A.ctx.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 58;
      const hf = A.ctx.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 180;
      const hg = A.ctx.createGain(); hg.gain.value = 0.10; hum.connect(hf); hf.connect(hg); hg.connect(g);
      s.start(); lfo.start(); hum.start();
      return [s, lfo, hum];
    }, 0.8, 0.5);
  };

  A.ambience = function (on) {
    if (!on) { A.stopLoop('amb', 0.8); return; }
    makeLoop('amb', g => {
      const s = A.ctx.createBufferSource(); s.buffer = A.brownBuf; s.loop = true;
      const f = A.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 140;
      s.connect(f); const ng = A.ctx.createGain(); ng.gain.value = 0.5; f.connect(ng); ng.connect(g);
      const hum = A.ctx.createOscillator(); hum.frequency.value = 50;
      const hg = A.ctx.createGain(); hg.gain.value = 0.08; hum.connect(hg); hg.connect(g);
      const lfo = A.ctx.createOscillator(); lfo.frequency.value = 0.07;
      const lg = A.ctx.createGain(); lg.gain.value = 0.25; lfo.connect(lg); lg.connect(ng.gain);
      s.start(); hum.start(); lfo.start();
      return [s, hum, lfo];
    }, 1.5, 0.35);
  };

  A.menuDrone = function (on) {
    if (!on) { A.stopLoop('drone', 1.0); return; }
    makeLoop('drone', g => {
      const o1 = A.ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 55;
      const o2 = A.ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 55.7;
      const o3 = A.ctx.createOscillator(); o3.type = 'sine'; o3.frequency.value = 110.3;
      const f = A.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220; f.Q.value = 2;
      const lfo = A.ctx.createOscillator(); lfo.frequency.value = 0.11;
      const lg = A.ctx.createGain(); lg.gain.value = 120; lfo.connect(lg); lg.connect(f.frequency);
      o1.connect(f); o2.connect(f); o3.connect(f);
      const ng = A.ctx.createGain(); ng.gain.value = 0.35; f.connect(ng); ng.connect(g);
      const s = A.ctx.createBufferSource(); s.buffer = A.noiseBuf; s.loop = true;
      const nf = A.ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 900; nf.Q.value = 0.4;
      const sg = A.ctx.createGain(); sg.gain.value = 0.05; s.connect(nf); nf.connect(sg); sg.connect(g);
      o1.start(); o2.start(); o3.start(); lfo.start(); s.start();
      return [o1, o2, o3, lfo, s];
    }, 2.0, 0.5);
  };

  A.lightBuzz = function (side, on) {
    const name = 'light' + side;
    if (!on) { A.stopLoop(name, 0.05); return; }
    makeLoop(name, g => {
      const o = A.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 120;
      const o2 = A.ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 240;
      const f = A.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400; f.Q.value = 3;
      o.connect(f); const g2 = A.ctx.createGain(); g2.gain.value = 0.25; o2.connect(g2); g2.connect(f);
      const ng = A.ctx.createGain(); ng.gain.value = 0.4; f.connect(ng); ng.connect(g);
      const lfo = A.ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 9 + Math.random() * 6;
      const lg = A.ctx.createGain(); lg.gain.value = 0.12; lfo.connect(lg); lg.connect(ng.gain);
      o.start(); o2.start(); lfo.start();
      return [o, o2, lfo];
    }, 0.03, 0.08, A.sfxBus);
  };

  A.staticLoop = function (on) {
    if (!on) { A.stopLoop('static', 0.15); return; }
    makeLoop('static', g => {
      const s = A.ctx.createBufferSource(); s.buffer = A.noiseBuf; s.loop = true;
      const f = A.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 0.5;
      s.connect(f); f.connect(g); s.start();
      return [s];
    }, 0.1, 0.045, A.sfxBus);
  };

  A.musicBoxKitchen = function (on) { if (on) A.musicStart(0.9, 0.08); else A.musicStop(); };

  /* ---- one-shots ---------------------------------------------------------- */
  A.door = function () {
    if (!A.ctx) return;
    A.osc({ type: 'sine', freq: 160, freqEnd: 45, dur: 0.28, gain: 0.7, attack: 0.004, release: 0.2 });
    A.playBuf(A.brownBuf, { dur: 0.35, filter: ['lowpass', 700, 1], gain: 0.9, attack: 0.003, release: 0.28, rate: 1.4 });
    A.playBuf(A.noiseBuf, { dur: 0.08, filter: ['bandpass', 2400, 6], gain: 0.18, attack: 0.002, release: 0.06 });
    A.osc({ type: 'square', freq: 90, dur: 0.12, gain: 0.12, filter: ['lowpass', 300, 1], t: A.now() + 0.08 });
  };

  A.error = function () {
    if (!A.ctx) return;
    A.osc({ type: 'square', freq: 165, dur: 0.26, gain: 0.16, filter: ['lowpass', 650, 1], attack: 0.005, release: 0.03 });
    A.osc({ type: 'square', freq: 110, dur: 0.26, gain: 0.08, filter: ['lowpass', 500, 1], attack: 0.005, release: 0.03 });
  };

  A.camUp = function () {
    if (!A.ctx) return;
    A.playBuf(A.noiseBuf, { dur: 0.32, filter: ['bandpass', 500, 1.2], filterEnd: 4200, gain: 0.35, attack: 0.02, release: 0.1 });
    A.osc({ type: 'sine', freq: 300, freqEnd: 900, dur: 0.18, gain: 0.05 });
  };
  A.camDown = function () {
    if (!A.ctx) return;
    A.playBuf(A.noiseBuf, { dur: 0.3, filter: ['bandpass', 4000, 1.2], filterEnd: 400, gain: 0.33, attack: 0.01, release: 0.12 });
    A.osc({ type: 'sine', freq: 700, freqEnd: 220, dur: 0.18, gain: 0.05 });
  };
  A.camSwitch = function () {
    if (!A.ctx) return;
    A.playBuf(A.noiseBuf, { dur: 0.28, filter: ['highpass', 1400, 0.7], gain: 0.4, attack: 0.003, release: 0.2 });
    A.osc({ type: 'sine', freq: 1600, dur: 0.035, gain: 0.12, attack: 0.002, release: 0.02 });
  };
  A.blip = function () { if (A.ctx) A.osc({ type: 'square', freq: 900, dur: 0.03, gain: 0.05, attack: 0.002, release: 0.01 }); };

  A.footsteps = function (count, vol, rate) {
    if (!A.ctx) return;
    count = count || 3; vol = vol || 0.3; rate = rate || 1;
    const t0 = A.now();
    for (let i = 0; i < count; i++) {
      const t = t0 + i * 0.46 / rate;
      A.playBuf(A.brownBuf, { t, dur: 0.14, filter: ['lowpass', 220, 1], gain: vol * (0.8 + Math.random() * 0.4), attack: 0.004, release: 0.1, rate: 1 + Math.random() * 0.4 });
      A.osc({ t, type: 'sine', freq: 70, freqEnd: 40, dur: 0.12, gain: vol * 0.7, attack: 0.003, release: 0.08 });
    }
  };

  A.laugh = function (vol) {
    if (!A.ctx) return;
    vol = vol || 0.6;
    const t0 = A.now();
    const n = 5;
    for (let i = 0; i < n; i++) {
      const t = t0 + i * (0.30 - i * 0.012);
      const f = 92 - i * 4;
      A.osc({ t, type: 'sawtooth', freq: f, freqEnd: f * 0.85, dur: 0.24, gain: vol * 0.55, attack: 0.025, release: 0.08, filter: ['bandpass', 420 - i * 30, 2.2], vibrato: [6, 4] });
      A.osc({ t, type: 'sine', freq: f / 2, dur: 0.24, gain: vol * 0.45, attack: 0.02, release: 0.1 });
      A.playBuf(A.noiseBuf, { t, dur: 0.07, filter: ['bandpass', 1200, 1.5], gain: vol * 0.12, attack: 0.002, release: 0.05 });
    }
  };

  A.moan = function (vol) {
    if (!A.ctx) return;
    vol = vol || 0.25;
    const t = A.now();
    A.osc({ t, type: 'sawtooth', freq: 86, freqEnd: 70, dur: 1.9, gain: vol, attack: 0.3, release: 0.6, filter: ['bandpass', 380, 3], tremolo: [5.5, 0.4] });
    A.osc({ t, type: 'sawtooth', freq: 87.6, freqEnd: 71, dur: 1.9, gain: vol * 0.8, attack: 0.3, release: 0.6, filter: ['bandpass', 260, 3] });
    A.osc({ t, type: 'sine', freq: 43, freqEnd: 35, dur: 1.9, gain: vol * 0.9, attack: 0.3, release: 0.6 });
  };

  A.pots = function (vol) {
    if (!A.ctx) return;
    vol = vol || 0.4;
    const t0 = A.now();
    const n = FNAF.randInt(2, 4);
    let t = t0;
    for (let i = 0; i < n; i++) {
      const f = 1500 + Math.random() * 2800;
      A.playBuf(A.noiseBuf, { t, dur: 0.4, filter: ['bandpass', f, 18], gain: vol, attack: 0.002, release: 0.35 });
      A.osc({ t, type: 'sine', freq: f, freqEnd: f * 0.92, dur: 0.35, gain: vol * 0.3, attack: 0.002, release: 0.3 });
      A.osc({ t, type: 'triangle', freq: f * 0.5, dur: 0.25, gain: vol * 0.12, attack: 0.002, release: 0.2 });
      if (Math.random() < 0.5) A.playBuf(A.brownBuf, { t, dur: 0.12, filter: ['lowpass', 500, 1], gain: vol * 0.6, attack: 0.002, release: 0.1 });
      t += 0.12 + Math.random() * 0.3;
    }
  };

  A.bang = function () {
    if (!A.ctx) return;
    const t0 = A.now();
    for (let i = 0; i < 4; i++) {
      const t = t0 + i * 0.23;
      A.osc({ t, type: 'sine', freq: 85, freqEnd: 32, dur: 0.22, gain: 1.0, attack: 0.003, release: 0.15 });
      A.playBuf(A.brownBuf, { t, dur: 0.26, filter: ['lowpass', 160, 1], gain: 1.0, attack: 0.002, release: 0.2, rate: 0.8 });
      A.playBuf(A.noiseBuf, { t, dur: 0.1, filter: ['bandpass', 1800, 4], gain: 0.22, attack: 0.002, release: 0.08 });
    }
  };

  A.foxyRun = function () {
    if (!A.ctx) return;
    const t0 = A.now();
    for (let i = 0; i < 10; i++) {
      const t = t0 + i * 0.115;
      const v = 0.18 + i * 0.05;
      A.playBuf(A.brownBuf, { t, dur: 0.09, filter: ['lowpass', 320, 1], gain: v, attack: 0.002, release: 0.06, rate: 1.3 });
      A.osc({ t, type: 'sine', freq: 95, freqEnd: 55, dur: 0.08, gain: v * 0.8, attack: 0.002, release: 0.05 });
    }
  };

  A.scream = function (vol) {
    if (!A.ctx) return;
    const v = vol === undefined ? 1 : vol;
    const t = A.now();
    A.playBuf(A.noiseBuf, { t, dur: 1.3, filter: ['bandpass', 1900, 0.8], filterEnd: 500, gain: 1.0 * v, attack: 0.004, release: 0.35, dist: true });
    A.osc({ t, type: 'sawtooth', freq: 230, freqEnd: 150, dur: 1.3, gain: 0.8 * v, attack: 0.004, release: 0.3, vibrato: [28, 25], dist: true, filter: ['lowpass', 2500, 1] });
    A.osc({ t, type: 'sawtooth', freq: 920, freqEnd: 560, dur: 1.1, gain: 0.45 * v, attack: 0.004, release: 0.3, vibrato: [35, 60], dist: true });
    A.osc({ t, type: 'square', freq: 115, freqEnd: 80, dur: 1.3, gain: 0.5 * v, attack: 0.004, release: 0.3, filter: ['lowpass', 900, 1], dist: true });
    A.osc({ t, type: 'sawtooth', freq: 1800, freqEnd: 1100, dur: 0.9, gain: 0.22 * v, attack: 0.004, release: 0.3, vibrato: [40, 120], dist: true });
  };

  A.chime = function () {
    if (!A.ctx) return;
    const t0 = A.now();
    const notes = [1046.5, 1318.5, 1568, 2093];
    notes.forEach((f, i) => {
      const t = t0 + i * 0.38;
      A.osc({ t, type: 'sine', freq: f, dur: 1.8, gain: 0.3, attack: 0.004, release: 1.5 });
      A.osc({ t, type: 'sine', freq: f * 2.76, dur: 0.9, gain: 0.07, attack: 0.004, release: 0.8 });
      A.osc({ t, type: 'sine', freq: f * 0.5, dur: 1.5, gain: 0.08, attack: 0.004, release: 1.2 });
    });
  };

  A.cheer = function () {
    if (!A.ctx) return;
    const t = A.now() + 0.2;
    for (let i = 0; i < 9; i++) {
      const f = 280 + Math.random() * 420;
      A.osc({ t: t + Math.random() * 0.25, type: 'sawtooth', freq: f, freqEnd: f * 1.35, dur: 2.6, gain: 0.05, attack: 0.5, release: 1.4, filter: ['bandpass', 1100 + Math.random() * 500, 0.9], vibrato: [5 + Math.random() * 3, 10] });
    }
    A.playBuf(A.noiseBuf, { t, dur: 2.8, filter: ['bandpass', 2300, 0.6], gain: 0.12, attack: 0.6, release: 1.6 });
    for (let i = 0; i < 14; i++) {
      A.playBuf(A.noiseBuf, { t: t + 0.3 + Math.random() * 2.0, dur: 0.05, filter: ['bandpass', 2800, 2], gain: 0.18, attack: 0.002, release: 0.04 });
    }
  };

  A.ring = function (count) {
    if (!A.ctx) return;
    count = count || 2;
    const t0 = A.now();
    for (let r = 0; r < count; r++) {
      const t = t0 + r * 1.7;
      A.osc({ t, type: 'sine', freq: 440, dur: 1.0, gain: 0.16, attack: 0.01, release: 0.05, tremolo: [20, 0.9], filter: ['bandpass', 1200, 1] });
      A.osc({ t, type: 'sine', freq: 480, dur: 1.0, gain: 0.16, attack: 0.01, release: 0.05, tremolo: [20, 0.9], filter: ['bandpass', 1200, 1] });
    }
  };

  A.honk = function () {
    if (!A.ctx) return;
    A.osc({ type: 'sine', freq: 330, freqEnd: 250, dur: 0.14, gain: 0.35, attack: 0.005, release: 0.05 });
    A.osc({ type: 'triangle', freq: 660, freqEnd: 500, dur: 0.14, gain: 0.12, attack: 0.005, release: 0.05 });
  };

  A.powerDown = function () {
    if (!A.ctx) return;
    const t = A.now();
    A.osc({ t, type: 'sine', freq: 70, freqEnd: 18, dur: 1.8, gain: 0.5, attack: 0.01, release: 1.0 });
    A.playBuf(A.brownBuf, { t, dur: 1.4, filter: ['lowpass', 400, 1], filterEnd: 40, gain: 0.5, attack: 0.01, release: 1.0 });
    A.playBuf(A.noiseBuf, { t, dur: 0.03, filter: ['highpass', 2000, 1], gain: 0.3, attack: 0.002, release: 0.02 });
  };

  A.breath = function () {
    if (!A.ctx) return;
    const t = A.now();
    A.playBuf(A.noiseBuf, { t, dur: 1.6, filter: ['bandpass', 600, 1.2], filterEnd: 350, gain: 0.14, attack: 0.7, release: 0.8 });
    A.playBuf(A.noiseBuf, { t: t + 1.8, dur: 1.4, filter: ['bandpass', 350, 1.2], filterEnd: 600, gain: 0.11, attack: 0.5, release: 0.8 });
  };

  A.glitch = function () {
    if (!A.ctx) return;
    A.playBuf(A.noiseBuf, { dur: 0.07, filter: ['highpass', 2500, 1], gain: 0.25, attack: 0.002, release: 0.04 });
    A.osc({ type: 'square', freq: 45, dur: 0.07, gain: 0.12, attack: 0.002, release: 0.03 });
  };

  A.creak = function () {
    if (!A.ctx) return;
    const f = 180 + Math.random() * 200;
    A.osc({ type: 'sawtooth', freq: f, freqEnd: f * 0.7, dur: 0.7, gain: 0.05, attack: 0.1, release: 0.4, filter: ['bandpass', f * 2, 6], vibrato: [11, 12] });
  };

  A.childLaugh = function () {
    if (!A.ctx) return;
    const t0 = A.now();
    for (let i = 0; i < 4; i++) {
      const t = t0 + i * 0.2;
      A.osc({ t, type: 'triangle', freq: 620 + i * 20, freqEnd: 520, dur: 0.16, gain: 0.05, attack: 0.02, release: 0.08, filter: ['bandpass', 1500, 1.5] });
    }
  };

  A.endoClank = function () {
    if (!A.ctx) return;
    A.playBuf(A.noiseBuf, { dur: 0.25, filter: ['bandpass', 3200, 10], gain: 0.15, attack: 0.002, release: 0.2 });
    A.osc({ type: 'sine', freq: 3200, freqEnd: 2900, dur: 0.22, gain: 0.05, attack: 0.002, release: 0.2 });
  };

  A.click = function () { if (A.ctx) A.playBuf(A.noiseBuf, { dur: 0.025, filter: ['bandpass', 3000, 2], gain: 0.2, attack: 0.001, release: 0.02 }); };

  /* Night 5 garbled call: a stream of distorted low vocal-ish tones */
  A.garble = function (duration) {
    if (!A.ctx) return;
    const t0 = A.now();
    let t = t0;
    while (t < t0 + duration) {
      const f = 55 + Math.random() * 70;
      const d = 0.25 + Math.random() * 0.9;
      A.osc({ t, type: 'sawtooth', freq: f, freqEnd: f * (0.6 + Math.random() * 0.8), dur: d, gain: 0.22, attack: 0.05, release: 0.15, filter: ['bandpass', 200 + Math.random() * 500, 4], dist: true, vibrato: [4 + Math.random() * 8, 15] });
      if (Math.random() < 0.5) A.playBuf(A.noiseBuf, { t, dur: d * 0.6, filter: ['bandpass', 800 + Math.random() * 2000, 3], gain: 0.06, attack: 0.05, release: 0.2 });
      t += d * (0.7 + Math.random() * 0.6);
    }
  };

  /* ---- music box: Toreador refrain, loosely transcribed in C major ------- */
  // [midi note, beats]
  const TOREADOR = [
    [67, 0.75], [64, 0.25], [60, 1], [65, 1], [64, 0.75], [62, 0.25], [60, 2],
    [60, 0.5], [62, 0.5], [64, 0.5], [65, 0.5], [67, 2],
    [62, 0.5], [64, 0.5], [65, 0.5], [67, 0.5], [69, 2],
    [67, 0.5], [67, 0.5], [67, 0.5], [67, 0.5], [69, 0.5], [67, 0.5], [65, 1],
    [64, 0.5], [62, 0.5], [60, 1], [65, 0.5], [65, 0.5], [65, 0.5], [65, 0.5], [67, 0.5], [65, 0.5], [64, 1],
    [62, 0.5], [60, 0.5], [59, 1],
    [67, 0.75], [64, 0.25], [60, 1], [65, 1], [64, 0.75], [62, 0.25], [60, 2],
    [-1, 1.5],
  ];
  const midiFreq = m => 440 * Math.pow(2, (m - 69) / 12);

  A.musicNote = function (t, midi, gain) {
    const f = midiFreq(midi);
    A.osc({ t, type: 'sine', freq: f, dur: 1.4, gain: gain, attack: 0.004, release: 1.2, decay: 0.25 });
    A.osc({ t, type: 'sine', freq: f * 2, dur: 0.8, gain: gain * 0.35, attack: 0.004, release: 0.7 });
    A.osc({ t, type: 'sine', freq: f * 4.03, dur: 0.35, gain: gain * 0.12, attack: 0.003, release: 0.3 });
    A.osc({ t, type: 'triangle', freq: f * 0.5, dur: 0.6, gain: gain * 0.08, attack: 0.004, release: 0.5 });
  };

  A.musicStart = function (rate, gain) {
    if (!A.ctx || A.musicOn) return;
    A.musicOn = true; A.musicRate = rate || 1; A.musicGain = gain || 0.22;
    A.musicIdx = 0; A.musicNext = A.now() + 0.05;
    A.musicTick();
  };
  A.musicTick = function () {
    if (!A.musicOn) return;
    const beat = (60 / 116) / A.musicRate;
    while (A.musicNext < A.now() + 0.5) {
      const [m, b] = TOREADOR[A.musicIdx];
      if (m > 0) A.musicNote(A.musicNext, m, A.musicGain);
      A.musicNext += b * beat;
      A.musicIdx = (A.musicIdx + 1) % TOREADOR.length;
    }
    A.musicTimer = setTimeout(A.musicTick, 150);
  };
  A.musicStop = function () {
    A.musicOn = false;
    if (A.musicTimer) { clearTimeout(A.musicTimer); A.musicTimer = null; }
  };

  /* ---- speech (phone guy) -------------------------------------------------- */
  A.initSpeech = function () {
    if (!('speechSynthesis' in window)) { A.speechOk = false; return; }
    A.speechOk = true;
    const pickVoice = () => {
      const voices = speechSynthesis.getVoices();
      if (!voices || !voices.length) return;
      const en = voices.filter(v => /^en/i.test(v.lang));
      const prefs = [/Daniel/i, /David/i, /Google UK English Male/i, /Google US English/i, /Mark/i, /Alex/i, /male/i];
      let v = null;
      for (const p of prefs) { v = en.find(x => p.test(x.name)); if (v) break; }
      A.voice = v || en[0] || voices[0];
    };
    pickVoice();
    if (speechSynthesis.onvoiceschanged !== undefined) speechSynthesis.onvoiceschanged = pickVoice;
  };

  A.speak = function (text, onend) {
    if (!A.speechOk) { if (onend) onend(false); return false; }
    try {
      const u = new SpeechSynthesisUtterance(text);
      if (A.voice) u.voice = A.voice;
      u.pitch = 0.78; u.rate = 0.98; u.volume = Math.min(1, A.volume + 0.15);
      let done = false;
      const finish = ok => { if (done) return; done = true; A.speaking = false; A.currentUtter = null; if (onend) onend(ok); };
      u.onend = () => finish(true);
      u.onerror = () => finish(false);
      A.currentUtter = u; A.speaking = true;
      speechSynthesis.speak(u);
      // safety: some browsers never fire onend
      const words = text.split(/\s+/).length;
      setTimeout(() => finish(true), 1500 + words * 520);
      return true;
    } catch (e) { if (onend) onend(false); return false; }
  };
  A.stopSpeech = function () {
    if (!A.speechOk) return;
    try { speechSynthesis.cancel(); } catch (e) { }
    A.speaking = false; A.currentUtter = null;
  };

  A.stopAll = function () {
    for (const k of Object.keys(A.loops)) A.stopLoop(k, 0.2);
    A.musicStop();
    A.stopSpeech();
  };
})();
