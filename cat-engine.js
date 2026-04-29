/* ═══════════════════════════════════════════════════════
   NEXUS Pixel Cat Engine v4 — Minecraft White Cat (Snowball)
   96×96 display, 24×24 grid ×4 scale
   States: idle, sleeping, happy, sad, walking, eating,
           love, celebrate, thinking, error, distressed
   ═══════════════════════════════════════════════════════ */
'use strict';

(function() {

// ── Minecraft White Cat Palette ──────────────────────
const C = {
  W: '#F5F5F5',   // off-white body
  H: '#FFFFFF',   // pure white highlight / belly
  S: '#CCCCCC',   // shadow grey
  G: '#E0E0E0',   // tail tip / light grey
  O: '#2C2C2C',   // outline (near-black, NOT pure black)
  E: '#4FC3F7',   // cyan/blue eyes
  P: '#1A1A2E',   // pupils (deep dark)
  N: '#FFB3C6',   // pink nose / inner ear
  M: '#FF8FAB',   // mouth/tongue
  _: null,
};

const GRID = 24, SCALE = 4;

// ═══════════════════════════════════════════════════════
// Sprite Data — Minecraft White Cat (front-facing, sit)
// ═══════════════════════════════════════════════════════

// ─ EARS ──────────────────────────────────────────────
const EARS = [
  [6,0,'O'],[7,0,'O'],
  [5,1,'O'],[6,1,'N'],[7,1,'O'],
  [5,2,'O'],[6,2,'N'],[7,2,'O'],
  [16,0,'O'],[17,0,'O'],
  [16,1,'O'],[17,1,'N'],[18,1,'O'],
  [16,2,'O'],[17,2,'N'],[18,2,'O'],
];

// ─ HEAD ──────────────────────────────────────────────
const HEAD_OUTLINE = [];
for (let x = 4; x <= 19; x++) { HEAD_OUTLINE.push([x,3,'O']); HEAD_OUTLINE.push([x,10,'O']); }
for (let y = 3; y <= 10; y++) { HEAD_OUTLINE.push([3,y,'O']); HEAD_OUTLINE.push([20,y,'O']); }

const HEAD_FILL = [];
for (let y = 4; y <= 9; y++) for (let x = 4; x <= 19; x++) HEAD_FILL.push([x, y, 'W']);
// Forehead highlight
const FOREHEAD_HL = [[10,4,'H'],[11,4,'H'],[12,4,'H'],[13,4,'H']];

// ─ EYES ──────────────────────────────────────────────
const EYES_OPEN = [
  [6,6,'O'],[7,6,'O'],[8,6,'O'],
  [6,7,'O'],[7,7,'E'],[8,7,'O'],
  [6,8,'O'],[7,8,'O'],[8,8,'O'],
  [15,6,'O'],[16,6,'O'],[17,6,'O'],
  [15,7,'O'],[16,7,'E'],[17,7,'O'],
  [15,8,'O'],[16,8,'O'],[17,8,'O'],
  // Pupils (dark dot inside iris)
  [7,7,'P'],[16,7,'P'],
  // Re-draw iris around pupil
  [7,6,'E'],[7,8,'E'],[6,7,'E'],[8,7,'E'],
  [16,6,'E'],[16,8,'E'],[15,7,'E'],[17,7,'E'],
];
const EYES_HALF = [
  [6,7,'O'],[7,7,'O'],[8,7,'O'],
  [6,8,'O'],[7,8,'E'],[8,8,'O'],
  [15,7,'O'],[16,7,'O'],[17,7,'O'],
  [15,8,'O'],[16,8,'E'],[17,8,'O'],
];
const EYES_CLOSED = [
  [6,7,'O'],[7,7,'O'],[8,7,'O'],
  [15,7,'O'],[16,7,'O'],[17,7,'O'],
];
const EYES_HAPPY = [
  [6,7,'O'],[7,6,'O'],[8,7,'O'],
  [15,7,'O'],[16,6,'O'],[17,7,'O'],
];
const EYES_SAD = [
  [6,7,'O'],[7,8,'O'],[8,7,'O'],
  [15,7,'O'],[16,8,'O'],[17,7,'O'],
];
const EYES_LOVE = [
  [6,6,'N'],[8,6,'N'],[7,5,'N'],[7,7,'N'],
  [15,6,'N'],[17,6,'N'],[16,5,'N'],[16,7,'N'],
];
const EYES_BOOP = [
  [6,6,'O'],[8,8,'O'],[8,6,'O'],[6,8,'O'],[7,7,'O'],
  [15,6,'O'],[17,8,'O'],[17,6,'O'],[15,8,'O'],[16,7,'O'],
];

// ─ NOSE & MOUTH ──────────────────────────────────────
const NOSE = [[11,8,'N'],[12,8,'N']];
const WHISKERS = [
  [2,7,'S'],[3,7,'S'],[4,7,'S'],
  [1,8,'S'],[2,8,'S'],[3,8,'S'],
  [19,7,'S'],[20,7,'S'],[21,7,'S'],
  [20,8,'S'],[21,8,'S'],[22,8,'S'],
];
const MOUTH_CLOSED = [[10,9,'O'],[11,9,'O'],[12,9,'O'],[13,9,'O']];
const MOUTH_OPEN = [
  [10,9,'O'],[13,9,'O'],
  [10,10,'O'],[11,10,'M'],[12,10,'M'],[13,10,'O'],
  [11,11,'O'],[12,11,'O'],
];
const MOUTH_CHEW = [
  [10,9,'O'],[11,9,'M'],[12,9,'M'],[13,9,'O'],
  [10,10,'O'],[11,10,'O'],[12,10,'O'],[13,10,'O'],
];

// ─ BODY (sitting) ────────────────────────────────────
const BODY_SIT = [];
for (let x = 5; x <= 18; x++) { BODY_SIT.push([x,11,'O']); BODY_SIT.push([x,19,'O']); }
for (let y = 11; y <= 19; y++) { BODY_SIT.push([4,y,'O']); BODY_SIT.push([19,y,'O']); }
for (let y = 12; y <= 18; y++) for (let x = 5; x <= 18; x++) BODY_SIT.push([x, y, 'W']);
// Belly highlight (pure white center)
const BELLY = [];
for (let y = 14; y <= 17; y++) for (let x = 9; x <= 14; x++) BELLY.push([x, y, 'H']);
// Shadow under head
const BODY_SHADOW = [[5,12,'S'],[6,12,'S'],[17,12,'S'],[18,12,'S']];

// ─ LEGS (sitting) ────────────────────────────────────
const LEGS_SIT = [
  [5,19,'O'],[6,19,'O'],[7,19,'O'],[8,19,'O'],
  [5,20,'O'],[6,20,'W'],[7,20,'W'],[8,20,'O'],
  [5,21,'O'],[6,21,'S'],[7,21,'S'],[8,21,'O'],
  [15,19,'O'],[16,19,'O'],[17,19,'O'],[18,19,'O'],
  [15,20,'O'],[16,20,'W'],[17,20,'W'],[18,20,'O'],
  [15,21,'O'],[16,21,'S'],[17,21,'S'],[18,21,'O'],
];

// ─ WALK FRAMES ───────────────────────────────────────
const WALK_LEGS = [
  [
    [4,19,'O'],[5,19,'W'],[6,19,'O'],[7,19,'O'],[8,19,'W'],[9,19,'O'],
    [4,20,'O'],[5,20,'S'],[6,20,'O'],[7,20,'O'],[8,20,'S'],[9,20,'O'],
    [14,19,'O'],[15,19,'W'],[16,19,'O'],[17,19,'O'],[18,19,'W'],[19,19,'O'],
    [14,20,'O'],[15,20,'S'],[16,20,'O'],[17,20,'O'],[18,20,'S'],[19,20,'O'],
  ],
  [
    [5,19,'O'],[6,19,'W'],[7,19,'W'],[8,19,'O'],
    [5,20,'O'],[6,20,'S'],[7,20,'S'],[8,20,'O'],
    [15,19,'O'],[16,19,'W'],[17,19,'W'],[18,19,'O'],
    [15,20,'O'],[16,20,'S'],[17,20,'S'],[18,20,'O'],
  ],
  [
    [5,19,'O'],[6,19,'W'],[7,19,'O'],[8,19,'O'],[9,19,'W'],[10,19,'O'],
    [5,20,'O'],[6,20,'S'],[7,20,'O'],[8,20,'O'],[9,20,'S'],[10,20,'O'],
    [13,19,'O'],[14,19,'W'],[15,19,'O'],[16,19,'O'],[17,19,'W'],[18,19,'O'],
    [13,20,'O'],[14,20,'S'],[15,20,'O'],[16,20,'O'],[17,20,'S'],[18,20,'O'],
  ],
  [
    [5,19,'O'],[6,19,'W'],[7,19,'W'],[8,19,'O'],
    [5,20,'O'],[6,20,'S'],[7,20,'S'],[8,20,'O'],
    [15,19,'O'],[16,19,'W'],[17,19,'W'],[18,19,'O'],
    [15,20,'O'],[16,20,'S'],[17,20,'S'],[18,20,'O'],
  ],
];

// ─ TAIL ──────────────────────────────────────────────
const TAIL_FRAMES = [
  [[20,11,'O'],[21,10,'O'],[22,9,'O'],[22,8,'O'],[21,8,'W'],[22,7,'O'],[21,7,'G']],
  [[20,12,'O'],[21,11,'O'],[22,10,'O'],[22,9,'O'],[21,9,'W'],[22,8,'O']],
  [[20,13,'O'],[21,13,'O'],[22,14,'O'],[22,15,'O'],[21,14,'W'],[22,16,'O']],
];

// ═══════════════════════════════════════════════════════
class PixelCatEngine {
  constructor(container) {
    this.container = container;
    this.S = SCALE; this.LW = GRID; this.LH = GRID;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.LW * this.S;
    this.canvas.height = this.LH * this.S;
    this.canvas.style.cssText = `
      image-rendering: pixelated;
      image-rendering: crisp-edges;
      -ms-interpolation-mode: nearest-neighbor;
      display: block; margin: 0 auto; cursor: inherit;
    `;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    const old = container.querySelector('canvas');
    if (old) old.remove();
    const oldImg = container.querySelector('img');
    if (oldImg) oldImg.remove();
    container.prepend(this.canvas);

    this.frame = 0; this.tick = 0;
    this.state = 'idle'; this.prevState = 'idle';
    this.blinking = false; this.blinkTimer = 0;
    this.blinkNext = 60 + Math.random() * 80;
    this.tailPhase = 0; this.eatPhase = 0; this.eatTick = 0;
    this.walkFrame = 0; this.walkTick = 0;
    this.zzzY = 0; this.heartAlpha = 0; this.bounce = 0;
    this.stateTimer = 0; this.celebrateJump = 0;
    this.purring = false; this.purrTick = 0;
    this.boopTimer = 0; this._sunglasses = false;

    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  setState(s) {
    if (this.state === s) return;
    this.prevState = this.state;
    this.state = s;
    this.stateTimer = 0; this.eatPhase = 0; this.eatTick = 0;
    this.walkFrame = 0; this.walkTick = 0; this.celebrateJump = 0;
    if (s === 'boop') this.boopTimer = 12;
  }

  _loop() {
    this.frame++;
    if (this.frame % 4 === 0) {
      this.tick++;
      this.stateTimer++;
      this._updateAnimState();
    }
    this._draw();
    requestAnimationFrame(this._loop);
  }

  _updateAnimState() {
    const t = this.tick, s = this.state;

    // Tail wag speed
    if (s === 'happy' || s === 'celebrate' || s === 'love')
      this.tailPhase = Math.floor(t / 3) % 3;
    else if (s === 'sleeping') this.tailPhase = 2;
    else if (s === 'sad' || s === 'distressed') this.tailPhase = 2;
    else this.tailPhase = Math.floor(t / 8) % 3;

    // Bounce
    if (s === 'happy' || s === 'celebrate')
      this.bounce = Math.floor(t / 3) % 2 === 0 ? -1 : 0;
    else this.bounce = 0;

    // Celebrate jump
    if (s === 'celebrate') this.celebrateJump = Math.sin(t * 0.4) * 3;

    // Boop countdown
    if (this.boopTimer > 0) {
      this.boopTimer--;
      if (this.boopTimer <= 0) this.setState(this.prevState || 'idle');
    }

    // Blink
    if (s === 'idle' || s === 'happy' || s === 'walking') {
      this.blinkTimer++;
      if (this.blinkTimer >= this.blinkNext) {
        this.blinking = true;
        if (this.blinkTimer >= this.blinkNext + 4) {
          this.blinking = false; this.blinkTimer = 0;
          this.blinkNext = 50 + Math.random() * 70;
        }
      }
    } else { this.blinking = false; this.blinkTimer = 0; }

    // Eating
    if (s === 'eating') {
      this.eatTick++;
      if (this.eatTick >= 6) { this.eatTick = 0; this.eatPhase = (this.eatPhase + 1) % 4; }
    }

    // Walk
    if (s === 'walking' || s === 'walk-left' || s === 'walk-right') {
      this.walkTick++;
      if (this.walkTick >= 5) { this.walkTick = 0; this.walkFrame = (this.walkFrame + 1) % 4; }
    }

    // Sleep breathing
    if (s === 'sleeping') this.zzzY = (t % 40) / 40;

    // Love pulse
    if (s === 'love') this.heartAlpha = 0.6 + 0.4 * Math.sin(t * 0.25);

    // Purr
    this.purring = (s === 'love' || s === 'happy');
    if (this.purring) this.purrTick = t;
  }

  _draw() {
    const ctx = this.ctx, s = this.S;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const BY = (this.bounce + (this.state === 'celebrate' ? Math.floor(this.celebrateJump) : 0)) * s;
    // Sad rock
    let RX = 0;
    if (this.state === 'sad' || this.state === 'distressed')
      RX = Math.sin(this.tick * 0.2) * s * 0.5;

    const px = (lx, ly, ck) => {
      const col = C[ck]; if (!col) return;
      ctx.fillStyle = col;
      ctx.fillRect(lx * s + RX, ly * s + BY, s, s);
    };
    const batch = (arr) => arr.forEach(([x, y, c]) => px(x, y, c));

    // TAIL
    if (TAIL_FRAMES[this.tailPhase])
      TAIL_FRAMES[this.tailPhase].forEach(([x,y,c]) => {
        ctx.fillStyle = C[c] || '#F5F5F5';
        ctx.fillRect(x*s+RX, y*s+BY, s, s);
      });

    // BODY
    batch(BODY_SIT); batch(BELLY); batch(BODY_SHADOW);

    // LEGS
    const isWalking = this.state === 'walking' || this.state === 'walk-left' || this.state === 'walk-right';
    batch(isWalking ? WALK_LEGS[this.walkFrame] : LEGS_SIT);

    // EARS
    batch(EARS);

    // HEAD
    batch(HEAD_FILL); batch(HEAD_OUTLINE); batch(FOREHEAD_HL); batch(WHISKERS);

    // EYES
    this._drawEyes(px);

    // NOSE & MOUTH
    batch(NOSE); this._drawMouth(px);

    // OVERLAYS
    if (this.state === 'sleeping') this._drawZzz(ctx, s);
    if (this.state === 'love') this._drawHearts(ctx, s, BY);
    if (this.state === 'eating') this._drawFood(ctx, s, BY);
    if (this.state === 'happy' || this.state === 'celebrate') this._drawSparkles(ctx, s, BY);
    if (this.state === 'sad') this._drawRaindrop(ctx, s, BY, RX);
    if (this.purring) this._drawPurrNotes(ctx, s, BY);

    // Sunglasses overlay (F8 dark mode easter egg)
    if (this._sunglasses) this._drawSunglasses(ctx, s, BY, RX);
  }

  _drawEyes(px) {
    const st = this.state;
    if (this.boopTimer > 0) EYES_BOOP.forEach(([x,y,c]) => px(x,y,c));
    else if (st === 'sleeping') EYES_CLOSED.forEach(([x,y,c]) => px(x,y,c));
    else if (st === 'love') EYES_LOVE.forEach(([x,y,c]) => px(x,y,c));
    else if (st === 'happy' || st === 'celebrate') EYES_HAPPY.forEach(([x,y,c]) => px(x,y,c));
    else if (st === 'sad' || st === 'distressed') EYES_SAD.forEach(([x,y,c]) => px(x,y,c));
    else if (this.blinking) EYES_HALF.forEach(([x,y,c]) => px(x,y,c));
    else EYES_OPEN.forEach(([x,y,c]) => px(x,y,c));
  }

  _drawMouth(px) {
    const st = this.state;
    if (st === 'eating') {
      if (this.eatPhase === 0 || this.eatPhase === 2) MOUTH_OPEN.forEach(([x,y,c]) => px(x,y,c));
      else if (this.eatPhase === 1) MOUTH_CHEW.forEach(([x,y,c]) => px(x,y,c));
      else MOUTH_CLOSED.forEach(([x,y,c]) => px(x,y,c));
    } else if (st === 'sleeping') {
      [[11,9,'O'],[12,9,'O']].forEach(([x,y,c]) => px(x,y,c));
    } else if (st === 'happy' || st === 'celebrate') {
      MOUTH_OPEN.forEach(([x,y,c]) => px(x,y,c));
    } else {
      MOUTH_CLOSED.forEach(([x,y,c]) => px(x,y,c));
    }
  }

  _drawZzz(ctx, s) {
    ctx.save();
    ctx.font = `bold ${s*3}px 'Press Start 2P', monospace`;
    ctx.fillStyle = '#98A4D8'; ctx.textAlign = 'left';
    const p = this.zzzY;
    ctx.globalAlpha = Math.max(0, 1 - p);
    ctx.fillText('z', this.canvas.width - s*3, s*5 - p*s*8);
    ctx.globalAlpha = Math.max(0, 0.6 - p*0.5);
    ctx.font = `bold ${s*4}px 'Press Start 2P', monospace`;
    ctx.fillText('Z', this.canvas.width - s*1, s*3 - p*s*6);
    ctx.restore();
  }

  _drawHearts(ctx, s, BY) {
    ctx.save(); ctx.globalAlpha = this.heartAlpha;
    ctx.font = `${s*4}px serif`; ctx.textAlign = 'center';
    const cx = this.canvas.width / 2, t = this.tick;
    ctx.fillStyle = '#FFB3C6';
    ctx.fillText('♥', cx - s*4, s*3 - Math.sin(t*0.2)*s*2 + BY);
    ctx.fillText('♥', cx + s*4, s*4 - Math.sin(t*0.2+1)*s*2 + BY);
    ctx.globalAlpha = this.heartAlpha * 0.6;
    ctx.font = `${s*2.5}px serif`;
    ctx.fillText('♥', cx, s*1 - Math.sin(t*0.3+2)*s + BY);
    ctx.restore();
  }

  _drawSparkles(ctx, s, BY) {
    const t = this.tick;
    ctx.save(); ctx.font = `${s*2.5}px serif`;
    ctx.textAlign = 'center'; ctx.fillStyle = '#FFD700';
    [[3*s,3*s+BY],[20*s,2*s+BY],[12*s,1*s+BY],[1*s,8*s+BY]].forEach(([x,y], i) => {
      ctx.globalAlpha = 0.4 + 0.6 * Math.sin(t * 0.35 + i * 1.5);
      ctx.fillText('✦', x, y);
    });
    ctx.restore();
  }

  _drawFood(ctx, s, BY) {
    if (this.eatPhase === 3) return;
    ctx.save(); ctx.font = `${s*3}px serif`; ctx.textAlign = 'center';
    const foodY = (this.eatPhase === 0 ? 8 : this.eatPhase === 1 ? 10 : 11) * s;
    ctx.fillText('🐟', 3*s, foodY + BY);
    ctx.restore();
  }

  _drawRaindrop(ctx, s, BY, RX) {
    ctx.save(); ctx.font = `${s*2.5}px serif`; ctx.textAlign = 'center';
    ctx.globalAlpha = 0.5 + 0.3 * Math.sin(this.tick * 0.3);
    ctx.fillText('💧', 20*s + RX, 5*s + BY);
    ctx.restore();
  }

  _drawPurrNotes(ctx, s, BY) {
    const t = this.purrTick;
    ctx.save(); ctx.font = `${s*2}px serif`; ctx.textAlign = 'center';
    ctx.globalAlpha = 0.3 + 0.3 * Math.sin(t * 0.5);
    ctx.fillStyle = '#D6BDE4';
    ctx.fillText('♪', 2*s, 6*s - Math.sin(t*0.3)*s*2 + BY);
    ctx.fillText('♫', 22*s, 4*s - Math.sin(t*0.3+1)*s*2 + BY);
    ctx.restore();
  }

  _drawSunglasses(ctx, s, BY, RX) {
    ctx.fillStyle = '#1A1A2E';
    for (let x = 5; x <= 9; x++) for (let y = 5; y <= 9; y++)
      ctx.fillRect(x*s+RX, y*s+BY, s, s);
    for (let x = 14; x <= 18; x++) for (let y = 5; y <= 9; y++)
      ctx.fillRect(x*s+RX, y*s+BY, s, s);
    for (let x = 9; x <= 14; x++) {
      ctx.fillRect(x*s+RX, 6*s+BY, s, s);
      ctx.fillRect(x*s+RX, 7*s+BY, s, s);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(6*s+RX, 6*s+BY, s, s);
    ctx.fillRect(15*s+RX, 6*s+BY, s, s);
  }
}

// ═══════════════════════════════════════════════════════
// Boot & attach — preserves existing API
// ═══════════════════════════════════════════════════════
let catEngine = null;

function initPixelCat() {
  const container = document.getElementById('neko-pet-canvas') || document.getElementById('neko-cat');
  if (!container) { console.warn('[PixelCat] container not found'); return; }
  catEngine = new PixelCatEngine(container);
  window._catEngine = catEngine;
}

window.setCatState = function(state) {
  if (catEngine) catEngine.setState(state);
};

// ── Sunglasses overlay for dark mode (F8) ──
let _wearingSunglasses = false;
window.nekoWearSunglasses = function(wear) {
  _wearingSunglasses = wear;
  if (catEngine) catEngine._sunglasses = wear;
};

// ── Boop on click ──
document.addEventListener('click', (e) => {
  if (!catEngine) return;
  const cv = catEngine.canvas;
  if (cv && cv.contains(e.target)) {
    catEngine.boopTimer = 12;
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPixelCat);
} else {
  setTimeout(initPixelCat, 50);
}

})();
