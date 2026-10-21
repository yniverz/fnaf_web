'use strict';
/* ---------------------------------------------------------------------------
 * monitor.js - camera monitor UI: feed, static, bezel, map and buttons.
 * ------------------------------------------------------------------------- */
(function () {
  const M = FNAF.Monitor = {};
  M.MAP = { x: 860, y: 372, w: 400, h: 330 };
  // floorplan rooms (relative to map box)
  const ROOMS = [
    ['Show Stage', 140, 6, 115, 42], ['Dining Area', 100, 50, 195, 92], ['Backstage', 18, 18, 80, 62], ['Pirate Cove', 18, 88, 80, 54],
    ['Restrooms', 300, 56, 82, 72], ['Kitchen', 300, 150, 82, 92], ['Supply', 18, 186, 64, 54], ['W. Hall', 112, 142, 50, 150],
    ['E. Hall', 232, 142, 50, 150], ['Office', 164, 232, 66, 60],
  ];
  const BTN = {
    '1A': [172, 20], '1B': [150, 88], '5': [26, 40], '1C': [28, 112], '7': [312, 86], '6': [312, 190],
    '3': [20, 210], '2A': [106, 170], '2B': [106, 265], '4A': [228, 170], '4B': [228, 265],
  };
  const BW = 58, BH = 24;
  M.MUTE = { x: 30, y: 90, w: 150, h: 36 };

  M.buttonRect = id => ({ x: M.MAP.x + BTN[id][0], y: M.MAP.y + BTN[id][1], w: BW, h: BH });

  M.hit = function (x, y, callActive) {
    for (const id of Object.keys(BTN)) if (FNAF.inRect(x, y, M.buttonRect(id))) return id;
    if (callActive && FNAF.inRect(x, y, M.MUTE)) return 'mute';
    return null;
  };

  let mapBg = null;
  function buildMap() {
    mapBg = FNAF.makeCanvas(M.MAP.w, M.MAP.h);
    const ctx = mapBg.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.0)';
    for (const [name, x, y, w, h] of ROOMS) {
      ctx.fillStyle = 'rgba(40,60,50,0.55)'; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(220,220,220,0.85)'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
    }
    // connections
    ctx.fillStyle = 'rgba(40,60,50,0.55)';
    ctx.fillRect(112, 292, 170, 10); // bottom corridor
    ctx.fillRect(98, 100, 20, 30); ctx.fillRect(282, 90, 20, 30); ctx.fillRect(282, 180, 20, 20); ctx.fillRect(82, 210, 30, 16);
    ctx.fillStyle = '#ccc';
    FNAF.text(ctx, 'YOU', 197, 262, { size: 11, bold: true, color: '#ddd', align: 'center', baseline: 'middle' });
  }

  /* st: { cam, hoverCam, burst(0..1), t, room (state for Rooms.draw), callActive, muted, recBlink } */
  M.draw = function (ctx, st) {
    if (!mapBg) buildMap();
    // feed
    FNAF.Rooms.draw(ctx, st.cam, st.room);
    // static
    FNAF.drawNoise(ctx, 0.10 + 0.9 * (st.burst || 0));
    if (st.burst > 0.3) { ctx.fillStyle = 'rgba(0,0,0,' + (st.burst * 0.5) + ')'; ctx.fillRect(0, 0, FNAF.W, FNAF.H); }
    FNAF.drawScanlines(ctx, 0.6);
    // rolling bar
    const by = ((st.t * 90) % (FNAF.H + 200)) - 100;
    const g = ctx.createLinearGradient(0, by, 0, by + 90);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.05)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, by, FNAF.W, 90);
    // bezel
    ctx.strokeStyle = '#0a0a0a'; ctx.lineWidth = 28; FNAF.roundRect(ctx, 0, 0, FNAF.W, FNAF.H, 40); ctx.stroke();
    ctx.strokeStyle = '#2a2a2e'; ctx.lineWidth = 6; FNAF.roundRect(ctx, 12, 12, FNAF.W - 24, FNAF.H - 24, 30); ctx.stroke();
    // REC
    if (Math.floor(st.t * 2) % 2 === 0) { ctx.fillStyle = '#e22'; FNAF.ellipse(ctx, 44, 44, 9, 9); ctx.fill(); }
    FNAF.text(ctx, 'REC', 62, 32, { size: 22, bold: true, color: '#eee' });
    // mute call
    if (st.callActive) {
      const r = M.MUTE;
      ctx.fillStyle = st.muted ? 'rgba(80,80,80,0.5)' : 'rgba(0,0,0,0.55)'; FNAF.roundRect(ctx, r.x, r.y, r.w, r.h, 4); ctx.fill();
      ctx.strokeStyle = '#bbb'; ctx.lineWidth = 2; ctx.stroke();
      FNAF.text(ctx, st.muted ? 'CALL MUTED' : 'MUTE CALL', r.x + r.w / 2, r.y + r.h / 2, { size: 18, bold: true, color: '#eee', align: 'center', baseline: 'middle' });
    }
    // camera name
    FNAF.text(ctx, 'CAM ' + st.cam, M.MAP.x, M.MAP.y - 62, { size: 30, bold: true, color: '#eee', shadow: '#000' });
    FNAF.text(ctx, FNAF.Rooms.CAMS[st.cam].name, M.MAP.x, M.MAP.y - 28, { size: 20, color: '#ddd', shadow: '#000' });
    // map
    ctx.drawImage(mapBg, M.MAP.x, M.MAP.y);
    for (const id of Object.keys(BTN)) {
      const r = M.buttonRect(id);
      const active = id === st.cam, hover = id === st.hoverCam;
      ctx.fillStyle = active ? '#2ecc40' : (hover ? '#9a9a9a' : '#6a6a6a');
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = active ? '#9f9' : '#ddd'; ctx.lineWidth = 2; ctx.strokeRect(r.x, r.y, r.w, r.h);
      FNAF.text(ctx, 'CAM', r.x + 4, r.y + 2, { size: 9, bold: true, color: active ? '#063' : '#eee' });
      FNAF.text(ctx, id, r.x + r.w - 4, r.y + 5, { size: 15, bold: true, color: active ? '#063' : '#fff', align: 'right' });
    }
  };
})();
