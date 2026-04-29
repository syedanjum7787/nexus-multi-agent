/* ══════════════════════════════════════════════
   NEKO — Intelligent Productivity Cat Companion
   Shimeji + Smart Reactions + Drag-to-Task
   ══════════════════════════════════════════════ */

// ── Cat States ──
const NEKO_STATES = {
  idle:       { label:'IDLE',     msg:['*purrs*','Mew~','*tail wag*','Nya~','*blinks*'] },
  sleeping:   { label:'SLEEPING', msg:['Zzz...','*snore*','5 more min...','*dream paws*'] },
  hungry:     { label:'HUNGRY',   msg:['Feed me!','*growl*','Fish?!','Where treats?!'] },
  love:       { label:'LOVE',     msg:['Pet me~','*nuzzles*','*rolls over*','*boop*'] },
  happy:      { label:'HAPPY',    msg:['Nya~!','Purrfect!','*dance*','Yay~!'] },
  playing:    { label:'PLAYING',  msg:['*pounce*','Wheee~!','*zooms*','So fun!'] },
  thinking:   { label:'THINKING', msg:['Hmm...','*tilts head*','Processing nya...'] },
  error:      { label:'ERROR',    msg:['Oh no!','*hisses*','Error!','*floof*'] },
  eating:     { label:'EATING',   msg:['*nom nom*','Yummy~!','Delicious!','More!'] },
  walking:    { label:'WALKING',  msg:['*pad pad*','~walking~','*explores*'] },
  celebrate:  { label:'YAY',      msg:['AMAZING!','*jumps*','PURRFECT!','WOW!'] },
  distressed: { label:'LOST',     msg:['Where server?!','*shakes*','No backend! 😰','Help!'] },
  sad:        { label:'SAD',      msg:['Meow...😿','*droops*','Something overdue...','*sigh*'] },
};

let currentState = 'idle';
let nekoMoodTimer = null;
let inventoryOpen = false;
let catHappiness = 70;
let catHunger = 50;
let _completedToday = 0;
let _lastActivity = Date.now();
let _focusMode = false;
let _focusTimer = null;

// ── Inventory Items (now functional — all 8 items) ──
const INVENTORY = [
  { id:'fish',   name:'Fish',   emoji:'🐟', effect:'briefing', msg:'Generating briefing...',  happiness:10, hunger:-30 },
  { id:'treats', name:'Treats', emoji:'🍪', effect:'streak',   msg:'Checking your streak...', happiness:15, hunger:-15 },
  { id:'milk',   name:'Milk',   emoji:'🥛', effect:'refresh',  msg:'*laps milk* Refreshing!', happiness:8,  hunger:-20 },
  { id:'bed',    name:'Bed',    emoji:'🛏️', effect:'focus',    msg:'*curls up* Focus mode~',  happiness:10, hunger:5   },
  { id:'brush',  name:'Brush',  emoji:'✨', effect:'archive',  msg:'Cleaning up tasks...',    happiness:18, hunger:0   },
  { id:'catnip', name:'Catnip', emoji:'🌿', effect:'play',     msg:'*rolls around* Wheee~!', happiness:25, hunger:-5  },
  { id:'collar', name:'Collar', emoji:'🎀', effect:'style',    msg:'*prances* So pretty!',   happiness:12, hunger:0   },
  { id:'mouse',  name:'Mouse',  emoji:'🐭', effect:'play',     msg:'*pounce pounce* Got it!', happiness:20, hunger:-10 },
];

// ── Philosophy Quotes ──
const PHILOSOPHY_QUOTES = [
  '"Every journey begins with a single paw step. 🐾"',
  '"A cat needs no validation. Neither do your tasks. ✨"',
  '"In chaos, be the cat on the keyboard. 🐱"',
  '"Productivity is knowing when to nap. 💤"',
  '"Focus on what matters, like a laser dot. 🎯"',
  '"Rest is not laziness — hunters nap too. 🌙"',
];
let quoteIndex = Math.floor(Math.random() * PHILOSOPHY_QUOTES.length);

// ══════════════════════════════════════
// ── FLOATING DESKTOP PET (Shimeji) ──
// ══════════════════════════════════════
let nekoPet = null;

class NekoDesktopPet {
  constructor() {
    this.el = document.getElementById('neko-pet');
    if (!this.el) return;

    this.x = window.innerWidth / 2 - 48;
    this.y = window.innerHeight - 100;
    this.targetX = this.x;
    this.targetY = this.y;
    this.speed = 1.5;
    this.state = 'idle';
    this.facing = 'right';
    this.idleTimer = 0;
    this.walkTimer = 0;
    this.maxIdleTime = 200 + Math.random() * 300;
    this.maxWalkTime = 100 + Math.random() * 200;
    this.paused = false;

    // Drag state
    this.dragging = false;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
    this._dragHighlightedRow = null;

    this._updatePosition();
    this._tick = this._tick.bind(this);
    this._animFrame = null;
    this._startLoop();
    this._initDrag();
  }

  _initDrag() {
    const canvasWrap = document.getElementById('neko-pet-canvas');
    if (!canvasWrap) return;

    canvasWrap.addEventListener('mousedown', (e) => {
      e.preventDefault(); e.stopPropagation();
      this._startDrag(e.clientX, e.clientY);
    });
    canvasWrap.addEventListener('touchstart', (e) => {
      e.preventDefault(); e.stopPropagation();
      const t = e.touches[0];
      this._startDrag(t.clientX, t.clientY);
    }, { passive: false });

    document.addEventListener('mousemove', (e) => {
      if (!this.dragging) return;
      this._doDrag(e.clientX, e.clientY);
    });
    document.addEventListener('mouseup', (e) => {
      if (!this.dragging) return;
      this._endDrag(e.clientX, e.clientY);
    });
    document.addEventListener('touchmove', (e) => {
      if (!this.dragging) return;
      const t = e.touches[0];
      this._doDrag(t.clientX, t.clientY);
    }, { passive: false });
    document.addEventListener('touchend', (e) => {
      if (!this.dragging) return;
      const t = e.changedTouches[0];
      this._endDrag(t.clientX, t.clientY);
    });
  }

  _startDrag(mx, my) {
    this.dragging = true;
    this.paused = true;
    this.dragOffsetX = mx - this.x;
    this.dragOffsetY = my - this.y;
    this.el.style.cursor = 'grabbing';
    this._dragStartTime = Date.now();
    _lastActivity = Date.now();
    if (typeof setCatState === 'function') setCatState('happy');
    showPixelBubble('Wheee~!', 1500);
  }

  _doDrag(mx, my) {
    this.x = mx - this.dragOffsetX;
    this.y = my - this.dragOffsetY;
    this.x = Math.max(0, Math.min(window.innerWidth - 96, this.x));
    this.y = Math.max(0, Math.min(window.innerHeight - 96, this.y));
    this._updatePosition();

    // Check if hovering over a task row
    this._checkTaskRowHover(mx, my);
  }

  _checkTaskRowHover(mx, my) {
    // Clear old highlight
    if (this._dragHighlightedRow) {
      this._dragHighlightedRow.classList.remove('task-drop-highlight');
      this._dragHighlightedRow = null;
    }
    // Find task rows under the cat
    const rows = document.querySelectorAll('tr[data-task-id][data-task-status="pending"]');
    for (const row of rows) {
      const rect = row.getBoundingClientRect();
      if (mx >= rect.left && mx <= rect.right && my >= rect.top && my <= rect.bottom) {
        row.classList.add('task-drop-highlight');
        this._dragHighlightedRow = row;
        break;
      }
    }
  }

  _endDrag(mx, my) {
    this.dragging = false;
    this.el.style.cursor = '';
    const wasDragTime = Date.now() - this._dragStartTime;

    // Check if dropped on a task row
    if (this._dragHighlightedRow) {
      const row = this._dragHighlightedRow;
      row.classList.remove('task-drop-highlight');
      this._dragHighlightedRow = null;
      const taskId = row.getAttribute('data-task-id');
      const taskTitle = row.getAttribute('data-task-title');
      if (taskId && row.getAttribute('data-task-status') === 'pending') {
        showTaskConfirmBubble(taskId, taskTitle, this.x, this.y);
        this.paused = true;
        return;
      }
    }

    if (wasDragTime < 200) {
      petCat({ stopPropagation: () => {} });
    } else {
      showPixelBubble('*lands*', 2000);
    }

    this.state = 'idle';
    this.idleTimer = 0;
    this.maxIdleTime = 200 + Math.random() * 300;
    setTimeout(() => {
      this.paused = false;
      if (typeof setCatState === 'function') setCatState('idle');
    }, 1500);
  }

  _startLoop() {
    let lastTime = 0;
    const loop = (time) => {
      if (time - lastTime > 50) {
        lastTime = time;
        this._tick();
      }
      this._animFrame = requestAnimationFrame(loop);
    };
    this._animFrame = requestAnimationFrame(loop);
  }

  _tick() {
    if (this.paused || this.dragging) return;

    if (this.state === 'idle') {
      this.idleTimer++;
      if (this.idleTimer > this.maxIdleTime) this._startWalking();
    } else if (this.state === 'walking') {
      this.walkTimer++;
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      const dist = Math.hypot(dx, dy);
      // Speed varies with mood
      const moodSpeed = catHappiness < 30 ? 0.8 : this.speed;

      if (dist < 3 || this.walkTimer > this.maxWalkTime) {
        this._stopWalking();
      } else {
        this.x += (dx / dist) * moodSpeed;
        this.y += (dy / dist) * moodSpeed;
        this.facing = dx > 0 ? 'right' : 'left';
      }
    }

    this.x = Math.max(0, Math.min(window.innerWidth - 96, this.x));
    this.y = Math.max(100, Math.min(window.innerHeight - 96, this.y));
    this._updatePosition();
  }

  _startWalking() {
    this.state = 'walking';
    this.walkTimer = 0;
    this.maxWalkTime = 80 + Math.random() * 150;
    this.targetX = 40 + Math.random() * (window.innerWidth - 160);
    this.targetY = window.innerHeight * 0.5 + Math.random() * (window.innerHeight * 0.45 - 96);
    if (typeof setCatState === 'function') setCatState('walking');
  }

  _stopWalking() {
    this.state = 'idle';
    this.idleTimer = 0;
    this.maxIdleTime = 150 + Math.random() * 350;
    if (typeof setCatState === 'function') setCatState('idle');
  }

  _updatePosition() {
    if (!this.el) return;
    this.el.style.left = this.x + 'px';
    this.el.style.top = this.y + 'px';
    this.el.classList.toggle('facing-left', this.facing === 'left');
  }

  pause() { this.paused = true; }
  resume() { this.paused = false; this.state = 'idle'; this.idleTimer = 0; }
}

// ══════════════════════════════════════
// ── TASK DROP CONFIRM BUBBLE ──
// ══════════════════════════════════════
function showTaskConfirmBubble(taskId, taskTitle, x, y) {
  // Remove existing
  document.querySelectorAll('.neko-confirm-bubble').forEach(e => e.remove());

  const bubble = document.createElement('div');
  bubble.className = 'neko-confirm-bubble';
  bubble.style.left = (x - 40) + 'px';
  bubble.style.top = (y - 80) + 'px';
  bubble.innerHTML = `
    <div class="confirm-msg">Mark <span class="confirm-task-name">"${taskTitle}"</span> done? 🐱</div>
    <div class="confirm-actions">
      <button class="confirm-btn yes" data-action="yes">Yes ✓</button>
      <button class="confirm-btn" data-action="no">Nah</button>
    </div>
  `;
  document.body.appendChild(bubble);

  bubble.querySelector('[data-action="yes"]').addEventListener('click', () => {
    bubble.remove();
    if (typeof toggleTaskStatus === 'function') toggleTaskStatus(parseInt(taskId), 'pending');
    nekoReact('task-completed');
    showPixelBubble('Purrfect! ✓', 3000);
  });
  bubble.querySelector('[data-action="no"]').addEventListener('click', () => {
    bubble.remove();
    showPixelBubble('OK, later~', 2000);
    if (nekoPet) { nekoPet.paused = false; nekoPet.state = 'idle'; }
    if (typeof setCatState === 'function') setCatState('idle');
  });

  // Auto-dismiss after 8s
  setTimeout(() => { if (bubble.parentNode) { bubble.remove(); if (nekoPet) nekoPet.resume(); } }, 8000);
}

// ══════════════════════════════════════
// ── PIXEL SPEECH BUBBLE ──
// ══════════════════════════════════════
let _bubbleTimer = null;
function showPixelBubble(text, duration = 3000) {
  const petEl = document.getElementById('neko-pet');
  if (!petEl) return;
  let bubble = petEl.querySelector('.neko-pixel-bubble');
  if (!bubble) {
    bubble = document.createElement('div');
    bubble.className = 'neko-pixel-bubble';
    petEl.appendChild(bubble);
  }
  bubble.textContent = text;
  bubble.classList.add('show');
  clearTimeout(_bubbleTimer);
  _bubbleTimer = setTimeout(() => bubble.classList.remove('show'), duration);
}

// ══════════════════════════════════════
// ── LOGIN SYSTEM ──
// ══════════════════════════════════════
let isSignUp = false;

function getUserDB() {
  try { return JSON.parse(localStorage.getItem('nexus-users') || '{}'); }
  catch { return {}; }
}
function saveUserDB(db) { localStorage.setItem('nexus-users', JSON.stringify(db)); }

function handleLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl  = document.getElementById('login-error');
  if (!username || !password) { showLoginError('Fill both fields'); return; }
  if (username.length < 3) { showLoginError('Username: 3+ chars'); return; }
  if (password.length < 4) { showLoginError('Password: 4+ chars'); return; }
  const db = getUserDB();
  if (isSignUp) {
    if (db[username]) { showLoginError('Username taken'); return; }
    db[username] = { password, created: Date.now() };
    saveUserDB(db);
    localStorage.setItem('nexus-current-user', username);
    errorEl.textContent = '';
    proceedToApp(username, true);
  } else {
    if (!db[username]) { showLoginError('User not found'); return; }
    if (db[username].password !== password && db[username] !== password) {
      showLoginError('Wrong password'); return;
    }
    localStorage.setItem('nexus-current-user', username);
    errorEl.textContent = '';
    proceedToApp(username, false);
  }
}

function showLoginError(msg) {
  const el = document.getElementById('login-error');
  if (!el) return;
  el.textContent = '> ' + msg;
  el.style.animation = 'none';
  requestAnimationFrame(() => { el.style.animation = 'shake 0.4s ease'; });
}

function toggleLoginMode() {
  isSignUp = !isSignUp;
  const label  = document.getElementById('login-mode-label');
  const btn    = document.getElementById('login-btn');
  const toggle = document.getElementById('login-toggle');
  document.getElementById('login-error').textContent = '';
  if (isSignUp) {
    label.textContent = 'CREATE YOUR ACCOUNT';
    btn.textContent   = 'CREATE ACCOUNT 🐾';
    toggle.innerHTML  = 'Already have one? <span onclick="toggleLoginMode()">Sign In</span>';
  } else {
    label.textContent = 'SIGN IN TO CONTINUE';
    btn.textContent   = 'SIGN IN 🐾';
    toggle.innerHTML  = 'New here? <span onclick="toggleLoginMode()">Create Account</span>';
  }
  loginCatBounce();
}

function proceedToApp(username, isNew) {
  const bubble = document.getElementById('login-cat-bubble');
  if (bubble) {
    bubble.textContent = isNew ? `Welcome, ${username}!` : `Welcome back!`;
    bubble.classList.add('show');
  }
  const btn = document.getElementById('login-btn');
  if (btn) btn.textContent = '> LOADING...';
  setTimeout(() => {
    const loginScreen = document.getElementById('login-screen');
    loginScreen.classList.add('fade-out');
    setTimeout(() => {
      loginScreen.style.display = 'none';
      const ws = document.getElementById('welcome-screen');
      ws.style.display = '';
      initBoot();
    }, 600);
  }, 800);
}

function checkExistingLogin() {
  const user = localStorage.getItem('nexus-current-user');
  if (user) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('welcome-screen').style.display = '';
    initBoot();
  }
}

// ── Login helpers ──
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('login-password')?.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
  document.getElementById('login-username')?.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
  initLoginStars();
  initLoginCatChatter();
});

function initLoginStars() {
  const container = document.getElementById('login-stars');
  if (!container) return;
  const symbols = ['✦','✧','⋆','•','✿','❋','⊹','✶'];
  for (let i = 0; i < 50; i++) {
    const star = document.createElement('div');
    star.className = 'login-star';
    star.textContent = symbols[Math.floor(Math.random() * symbols.length)];
    star.style.cssText = `
      left: ${Math.random()*100}%; top: ${Math.random()*100}%;
      --dur: ${3 + Math.random()*5}s; --delay: -${Math.random()*5}s;
      font-size: ${8 + Math.random()*14}px;
      color: hsla(${260 + Math.random()*40},60%,60%,${0.3 + Math.random()*0.4});
    `;
    container.appendChild(star);
  }
}

const LOGIN_CAT_MSGS = [
  'Mew~!', 'Nya~!', 'Sign in!', '*nuzzles*',
  'Purr...', 'Ready?', 'Hi! 🐾', "Let's go!",
];

function loginCatBounce() {
  const img = document.getElementById('login-cat-img');
  const bubble = document.getElementById('login-cat-bubble');
  if (!img || !bubble) return;
  img.style.transform = 'scale(1.15) rotate(-8deg)';
  bubble.textContent = LOGIN_CAT_MSGS[Math.floor(Math.random() * LOGIN_CAT_MSGS.length)];
  bubble.classList.add('show');
  setTimeout(() => {
    img.style.transform = '';
    setTimeout(() => bubble.classList.remove('show'), 800);
  }, 600);
}

function initLoginCatChatter() {
  setTimeout(loginCatBounce, 1500);
  setInterval(() => {
    const ls = document.getElementById('login-screen');
    if (ls && ls.style.display !== 'none' && !ls.classList.contains('fade-out')) {
      if (Math.random() > 0.4) loginCatBounce();
    }
  }, 4000);
}

// ══════════════════════════════════════
// ── INITIALIZE ──
// ══════════════════════════════════════
function initNeko() {
  initTheme();
  initParticles();
  initSparkles();
  initDragFeed();
  initActivityTracker();
  checkExistingLogin();

  setTimeout(() => {
    nekoPet = new NekoDesktopPet();
    nekoReact('greeting');
    // Morning briefing after short delay
    setTimeout(() => showMorningBriefing(), 3000);
  }, 300);

  startNekoLifecycle();
  setInterval(smartCatChatter, 10000);
}

function initActivityTracker() {
  ['click','keydown','mousemove','touchstart'].forEach(evt => {
    document.addEventListener(evt, () => { _lastActivity = Date.now(); }, { passive: true });
  });
}

// ══════════════════════════════════════
// ── SMART CHATTER (replaces random) ──
// ══════════════════════════════════════
function smartCatChatter() {
  if (currentState !== 'idle' || _focusMode) return;

  const tasks = window._nekoTaskCache || [];
  const events = window._nekoEventCache || [];
  const now = new Date();
  const todayStr = now.toISOString().substring(0, 10);

  // Build pool of smart messages
  const pool = [];

  // Overdue tasks
  const overdue = tasks.filter(t => t.status === 'pending' && t.due_date && t.due_date < todayStr);
  if (overdue.length > 0) {
    pool.push(`Psst! "${overdue[0].title}" is overdue 📋`);
    pool.push(`Meow... ${overdue.length} overdue task${overdue.length>1?'s':''} 😿`);
  }

  // Due tomorrow
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomStr = tomorrow.toISOString().substring(0, 10);
  const dueTomorrow = tasks.filter(t => t.status === 'pending' && t.due_date === tomStr);
  if (dueTomorrow.length > 0) {
    pool.push(`"${dueTomorrow[0].title}" due tomorrow! 📋`);
  }

  // Completed today stats
  const completedToday = tasks.filter(t => t.status === 'completed').length;
  if (completedToday > 0) {
    pool.push(`${completedToday} task${completedToday>1?'s':''} completed! 🐾`);
  }

  // Events today
  const todayEvents = events.filter(e => (e.start_time||'').substring(0, 10) === todayStr);
  if (todayEvents.length > 0) {
    pool.push(`${todayEvents.length} event${todayEvents.length>1?'s':''} today nya~ 📅`);
  }

  // Pending count
  const pending = tasks.filter(t => t.status === 'pending').length;
  if (pending > 0) {
    pool.push(`${pending} task${pending>1?'s':''} pending...`);
  }

  // Fallback personality
  if (pool.length === 0) {
    pool.push('*yawns*', 'Nya~', '*stretches*', '...', '🐾', 'Mew?');
  }

  showPixelBubble(pool[Math.floor(Math.random() * pool.length)], 3500);

  // Trigger sad state if overdue tasks found
  if (overdue.length > 0 && Math.random() > 0.5) {
    nekoReact('overdue');
  }
}

// ══════════════════════════════════════
// ── MORNING BRIEFING ──
// ══════════════════════════════════════
function showMorningBriefing() {
  const tasks = window._nekoTaskCache || [];
  const events = window._nekoEventCache || [];

  if (tasks.length === 0 && events.length === 0) {
    showPixelBubble('Good morning nya~ ☀️', 4000);
    return;
  }

  const now = new Date();
  const todayStr = now.toISOString().substring(0, 10);
  const pending = tasks.filter(t => t.status === 'pending').length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const todayEvents = events.filter(e => (e.start_time||'').substring(0, 10) === todayStr);

  let msg = '☀️ ';
  if (pending > 0) msg += `${pending} tasks pending`;
  if (todayEvents.length > 0) msg += `${pending > 0 ? ', ' : ''}${todayEvents.length} events today`;
  if (completed > 0) msg += ` | ${completed} done!`;
  if (!pending && !todayEvents.length && !completed) msg += 'All clear! Nya~';
  msg += ' 🐾';

  showPixelBubble(msg, 5000);
}

// ══════════════════════════════════════
// ── CAT STATE MACHINE (Enhanced) ──
// ══════════════════════════════════════
function nekoReact(event) {
  let state;
  let customMsg = null;

  switch (event) {
    case 'query-start':
      state = 'thinking';
      break;
    case 'query-done':
      state = 'celebrate';
      customMsg = 'Done! Purrfect! ✨';
      break;
    case 'task-created':
      state = 'celebrate';
      customMsg = 'Nya~ Task added! ✦';
      break;
    case 'event-created':
      state = 'happy';
      customMsg = 'Scheduled! 📅 Nya~';
      break;
    case 'note-saved':
      state = 'happy';
      customMsg = 'Noted, nya~ 📝';
      break;
    case 'task-completed':
      _completedToday++;
      if (_completedToday >= 5 && _completedToday % 5 === 0) {
        state = 'celebrate';
        customMsg = `${_completedToday} done! AMAZING! 🎉`;
      } else {
        state = 'celebrate';
        customMsg = 'Task done! Purrr~ ✓';
      }
      break;
    case 'overdue':
      state = 'sad';
      customMsg = 'Meow... something overdue 😿';
      break;
    case 'no-backend':
      state = 'distressed';
      // Add shake class
      if (nekoPet && nekoPet.el) nekoPet.el.classList.add('shake');
      setTimeout(() => { if (nekoPet && nekoPet.el) nekoPet.el.classList.remove('shake'); }, 5000);
      break;
    case 'error':
      state = 'error';
      break;
    case 'theme':
      state = 'happy';
      break;
    case 'greeting':
      state = 'idle';
      break;
    case 'feeding': case 'eating':
      state = 'eating';
      break;
    case 'petting':
      state = 'love';
      break;
    case 'sleeping':
      state = 'sleeping';
      break;
    case 'playing':
      state = 'playing';
      break;
    case 'hungry':
      state = 'hungry';
      break;
    case 'love-need':
      state = 'love';
      break;
    case 'idle':
      state = 'idle';
      break;
    case 'happy':
      state = 'happy';
      break;
    default:
      state = 'idle';
  }

  currentState = state;
  const stateData = NEKO_STATES[state] || NEKO_STATES['idle'];
  const msg = customMsg || stateData.msg[Math.floor(Math.random() * stateData.msg.length)];

  const mood = document.getElementById('neko-mood');
  if (mood) mood.textContent = msg;

  if (typeof setCatState === 'function') {
    // Map some states to engine states
    const engineMap = { distressed: 'error', sad: 'sleeping' };
    setCatState(engineMap[state] || state);
  }

  showPixelBubble(msg, 3500);

  if (nekoPet) {
    if (state !== 'idle' && state !== 'walking') nekoPet.pause();
  }

  clearTimeout(nekoMoodTimer);
  if (state !== 'idle' && state !== 'sleeping') {
    nekoMoodTimer = setTimeout(() => {
      if (nekoPet) nekoPet.resume();
      if (catHunger > 70) nekoReact('hungry');
      else if (catHappiness < 30) nekoReact('love-need');
      else nekoReact('idle');
    }, 5000);
  }
}

// ══════════════════════════════════════
// ── PRODUCTIVITY-LINKED MOOD METER ──
// ══════════════════════════════════════
function nekoUpdateProductivity(tasks, events) {
  if (!tasks) return;

  const total = tasks.length;
  const completed = tasks.filter(t => t.status === 'completed').length;

  // HAPPY = % of tasks completed
  if (total > 0) {
    catHappiness = Math.round((completed / total) * 100);
  } else {
    catHappiness = 50; // neutral if no tasks
  }

  // FOOD = decreases over time since last activity
  const hoursSinceActivity = (Date.now() - _lastActivity) / (1000 * 60 * 60);
  const foodDecay = Math.min(100, Math.round(hoursSinceActivity * 8));
  catHunger = Math.min(100, foodDecay);

  updateCatBars();
  updateMoodEffects();
}

function updateMoodEffects() {
  if (!nekoPet || !nekoPet.el) return;

  // When both bars are full (happy ≥ 80, hunger ≤ 20) → glow
  const isGlowing = catHappiness >= 80 && catHunger <= 20;
  nekoPet.el.classList.toggle('glowing', isGlowing);

  // When happy is low → sleepy eyes
  if (catHappiness < 30 && currentState === 'idle') {
    if (typeof setCatState === 'function') setCatState('sleeping');
  }
}

function startNekoLifecycle() {
  // Check productivity every 30 seconds
  setInterval(() => {
    const tasks = window._nekoTaskCache || [];
    const events = window._nekoEventCache || [];
    nekoUpdateProductivity(tasks, events);

    // Detect overdue
    const now = new Date();
    const todayStr = now.toISOString().substring(0, 10);
    const overdue = tasks.filter(t => t.status === 'pending' && t.due_date && t.due_date < todayStr);
    if (overdue.length > 0 && currentState === 'idle' && Math.random() > 0.7) {
      nekoReact('overdue');
    }
  }, 30000);
}

function updateCatBars() {
  const hBar = document.getElementById('hunger-bar-fill') || document.getElementById('hud-food-fill');
  const hpBar = document.getElementById('happy-bar-fill') || document.getElementById('hud-happy-fill');
  if (hBar) hBar.style.width = Math.max(0, 100 - catHunger) + '%';
  if (hpBar) hpBar.style.width = catHappiness + '%';

  // ── Mood-linked sounds (purr when happy, howl when sad) ──
  if (typeof SoundEngine !== 'undefined' && SoundEngine.ready) {
    SoundEngine.updateMoodSounds(catHappiness);
    SoundEngine.checkSadState(catHappiness);
  }
}

// ══════════════════════════════════════
// ── INVENTORY = FUNCTIONAL TRIGGERS ──
// ══════════════════════════════════════
function useItem(itemId) {
  const item = INVENTORY.find(i => i.id === itemId);
  if (!item) return;

  _lastActivity = Date.now();
  catHappiness = Math.min(100, catHappiness + item.happiness);
  catHunger = Math.max(0, catHunger + item.hunger);
  updateCatBars();

  // Show the actual item emoji and message (Fix 2)
  showPixelBubble(item.emoji + ' ' + item.msg, 3500);

  // Float the actual food emoji above the cat (Fix 2)
  showFeedEmoji(item.emoji);

  // Visual reaction — uses actual item effect
  if (item.effect === 'briefing') {
    nekoReact('eating');
    setTimeout(() => triggerBriefing(), 1500);
  } else if (item.effect === 'streak') {
    nekoReact('happy');
    setTimeout(() => triggerStreak(), 1500);
  } else if (item.effect === 'refresh') {
    nekoReact('eating');
    setTimeout(() => triggerRefresh(), 1500);
  } else if (item.effect === 'focus') {
    nekoReact('sleeping');
    setTimeout(() => triggerFocusMode(), 1500);
  } else if (item.effect === 'archive') {
    nekoReact('happy');
    setTimeout(() => triggerArchive(), 1500);
  } else if (item.effect === 'play') {
    nekoReact('playing');
  } else if (item.effect === 'style') {
    nekoReact('love');
  }

  const btn = document.querySelector(`[data-item="${itemId}"]`);
  if (btn) { btn.classList.add('item-used'); setTimeout(() => btn.classList.remove('item-used'), 600); }

  if (nekoPet && nekoPet.el) {
    const rect = nekoPet.el.getBoundingClientRect();
    for (let i = 0; i < 12; i++) {
      setTimeout(() => createSparkle(
        rect.left + Math.random() * rect.width,
        rect.top + Math.random() * rect.height
      ), i * 50);
    }
  }
}

// ── Show floating food emoji above cat (Fix 2) ──
function showFeedEmoji(emoji) {
  if (!nekoPet || !nekoPet.el) return;
  const rect = nekoPet.el.getBoundingClientRect();
  const floater = document.createElement('div');
  floater.textContent = emoji;
  floater.style.cssText = `
    position:fixed; left:${rect.left + rect.width/2 - 16}px; top:${rect.top - 10}px;
    font-size:28px; pointer-events:none; z-index:99999;
    animation:feedEmojiFloat 1.5s ease-out forwards;
  `;
  document.body.appendChild(floater);
  setTimeout(() => floater.remove(), 1600);
}

// ── 🐟 Fish: Daily Briefing ──
function triggerBriefing() {
  document.querySelectorAll('.neko-briefing-bubble').forEach(e => e.remove());

  const tasks = window._nekoTaskCache || [];
  const events = window._nekoEventCache || [];
  const now = new Date();
  const todayStr = now.toISOString().substring(0, 10);

  const pending = tasks.filter(t => t.status === 'pending');
  const completed = tasks.filter(t => t.status === 'completed');
  const overdue = pending.filter(t => t.due_date && t.due_date < todayStr);
  const todayEvents = events.filter(e => (e.start_time||'').substring(0, 10) === todayStr);

  let html = '<h4>🐟 DAILY BRIEFING</h4>';
  html += `<div class="briefing-item">📋 ${pending.length} pending, ${completed.length} completed</div>`;
  if (overdue.length) html += `<div class="briefing-item">⚠️ ${overdue.length} overdue: ${overdue.map(t=>t.title).join(', ')}</div>`;
  if (todayEvents.length) html += `<div class="briefing-item">📅 ${todayEvents.length} event(s) today: ${todayEvents.map(e=>e.title).join(', ')}</div>`;
  if (!pending.length && !todayEvents.length) html += '<div class="briefing-item">✨ All clear! Purrfect day~</div>';
  html += '<button class="briefing-close" onclick="this.parentElement.remove()">OK NYA</button>';

  const bubble = document.createElement('div');
  bubble.className = 'neko-briefing-bubble';
  bubble.innerHTML = html;
  if (nekoPet) {
    bubble.style.left = Math.min(nekoPet.x, window.innerWidth - 340) + 'px';
    bubble.style.top = Math.max(10, nekoPet.y - 180) + 'px';
  } else {
    bubble.style.right = '20px'; bubble.style.bottom = '120px';
  }
  document.body.appendChild(bubble);
  setTimeout(() => { if (bubble.parentNode) bubble.remove(); }, 15000);
}

// ── 🍪 Treats: Productivity Streak ──
function triggerStreak() {
  const tasks = window._nekoTaskCache || [];
  const completed = tasks.filter(t => t.status === 'completed').length;
  const total = tasks.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  let msg = `📊 Streak: ${completed}/${total} (${pct}%)`;
  if (pct >= 80) msg += ' AMAZING! 🌟';
  else if (pct >= 50) msg += ' Good! 💪';
  else if (pct > 0) msg += ' Keep going! 🐾';
  else msg += ' Let\'s start! ✦';

  showPixelBubble(msg, 5000);
  if (pct >= 80) nekoReact('celebrate');
}

// ── 🥛 Milk: Refresh All Data ──
function triggerRefresh() {
  showPixelBubble('*refreshing data* 🥛', 2000);
  if (typeof loadStats === 'function') loadStats();
  if (typeof loadTasks === 'function') loadTasks();
  if (typeof loadEvents === 'function') loadEvents();
  if (typeof loadNotes === 'function') loadNotes();
  setTimeout(() => showPixelBubble('All fresh nya~ ✨', 3000), 2500);
}

// ── 🛏️ Bed: Focus Mode ──
function triggerFocusMode() {
  if (_focusMode) return;
  _focusMode = true;

  if (nekoPet && nekoPet.el) {
    nekoPet.el.classList.add('focus-mode');
    nekoPet.pause();
  }

  showPixelBubble('Focus mode... Zzz 🛏️', 3000);

  // Show banner
  const banner = document.createElement('div');
  banner.className = 'focus-mode-banner';
  banner.id = 'focus-banner';
  banner.innerHTML = '🛏️ FOCUS MODE <span id="focus-timer">30:00</span> <button class="focus-end-btn" onclick="endFocusMode()">Wake Up</button>';
  document.body.appendChild(banner);

  let remaining = 30 * 60; // 30 minutes
  _focusTimer = setInterval(() => {
    remaining--;
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    const timerEl = document.getElementById('focus-timer');
    if (timerEl) timerEl.textContent = `${m}:${String(s).padStart(2,'0')}`;
    if (remaining <= 0) endFocusMode();
  }, 1000);
}

function endFocusMode() {
  _focusMode = false;
  clearInterval(_focusTimer);

  if (nekoPet && nekoPet.el) {
    nekoPet.el.classList.remove('focus-mode');
    nekoPet.resume();
  }

  const banner = document.getElementById('focus-banner');
  if (banner) banner.remove();

  nekoReact('happy');
  showPixelBubble('*yawns* I\'m back! ☀️', 3000);
}

// ── ✨ Brush: Archive Completed Tasks ──
async function triggerArchive() {
  const noAPI = typeof _noAPI === 'function' && _noAPI();
  const API = window.API || '';
  if (noAPI) {
    showPixelBubble('Need backend to clean! 😿', 3000);
    return;
  }

  const tasks = window._nekoTaskCache || [];
  const completed = tasks.filter(t => t.status === 'completed');
  if (!completed.length) {
    showPixelBubble('Nothing to clean~ ✨', 3000);
    return;
  }

  showPixelBubble(`Cleaning ${completed.length} tasks... ✨`, 2000);

  let archived = 0;
  for (const task of completed) {
    try {
      await fetch(`${API}/tasks/${task.id}`, { method: 'DELETE' });
      archived++;
    } catch {}
  }

  setTimeout(() => {
    showPixelBubble(`Cleaned ${archived} tasks! ✨`, 3000);
    if (typeof loadTasks === 'function') loadTasks();
    if (typeof loadStats === 'function') loadStats();
    nekoReact('celebrate');
  }, 2500);
}

// ══════════════════════════════════════
// ── DRAG & DROP FEEDING ──
// ══════════════════════════════════════
let dragFood = null;
let dragFoodType = null;

function initDragFeed() {
  document.querySelectorAll('.inventory-item').forEach(item => {
    item.addEventListener('mousedown', startDragFood);
    item.addEventListener('touchstart', startDragFood, { passive: false });
  });
}

function startDragFood(e) {
  e.preventDefault();
  const itemId = this.getAttribute('data-item');
  const item = INVENTORY.find(i => i.id === itemId);
  if (!item) return;
  dragFoodType = itemId;
  dragFood = document.createElement('div');
  dragFood.className = 'drag-food';
  dragFood.textContent = item.emoji;
  document.body.appendChild(dragFood);
  const pos = getEventPos(e);
  moveDragFoodTo(pos.x, pos.y);
  document.addEventListener('mousemove', moveDragFood);
  document.addEventListener('mouseup', endDragFood);
  document.addEventListener('touchmove', moveDragFood, { passive: false });
  document.addEventListener('touchend', endDragFood);
}

function moveDragFoodTo(x, y) {
  if (!dragFood) return;
  dragFood.style.left = (x - 20) + 'px';
  dragFood.style.top = (y - 20) + 'px';
}

function moveDragFood(e) {
  e.preventDefault();
  if (!dragFood) return;
  const pos = getEventPos(e);
  moveDragFoodTo(pos.x, pos.y);
  if (nekoPet && nekoPet.el) {
    const rect = nekoPet.el.getBoundingClientRect();
    const dist = Math.hypot(pos.x - (rect.left + 48), pos.y - (rect.top + 48));
    if (dist < 80 && currentState !== 'eating') {
      if (typeof setCatState === 'function') setCatState('hungry');
    }
  }
}

function endDragFood(e) {
  if (!dragFood) return;
  const pos = getEventPos(e);
  if (nekoPet && nekoPet.el) {
    const rect = nekoPet.el.getBoundingClientRect();
    const dist = Math.hypot(pos.x - (rect.left + 48), pos.y - (rect.top + 48));
    if (dist < 100) useItem(dragFoodType);
  }
  dragFood.remove();
  dragFood = null;
  dragFoodType = null;
  document.removeEventListener('mousemove', moveDragFood);
  document.removeEventListener('mouseup', endDragFood);
  document.removeEventListener('touchmove', moveDragFood);
  document.removeEventListener('touchend', endDragFood);
}

function getEventPos(e) {
  if (e.touches?.length) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  if (e.changedTouches?.length) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  return { x: e.clientX, y: e.clientY };
}

// ── Toggle Inventory ──
function toggleInventory() {
  inventoryOpen = !inventoryOpen;
  const panel = document.getElementById('inventory-panel');
  const btn = document.getElementById('inventory-toggle');
  if (panel) panel.classList.toggle('open', inventoryOpen);
  if (btn) {
    btn.classList.toggle('active', inventoryOpen);
    btn.textContent = inventoryOpen ? '✕' : '🎒';
  }
  if (inventoryOpen) setTimeout(initDragFeed, 100);
}

// ── Pet the Cat ──
function petCat(e) {
  if (e) e.stopPropagation();
  _lastActivity = Date.now();
  catHappiness = Math.min(100, catHappiness + 8);
  catHunger = Math.max(0, catHunger - 3);
  updateCatBars();
  nekoReact('petting');
  if (nekoPet && nekoPet.el) {
    const rect = nekoPet.el.getBoundingClientRect();
    for (let i = 0; i < 15; i++) {
      setTimeout(() => createSparkle(
        rect.left + Math.random() * rect.width,
        rect.top + Math.random() * rect.height
      ), i * 40);
    }
  }
}

// ══════════════════════════════════════
// ── SPARKLE SYSTEM ──
// ══════════════════════════════════════
function initSparkles() {
  document.addEventListener('click', e => {
    for (let i = 0; i < 4; i++) {
      setTimeout(() => createSparkle(
        e.clientX + (Math.random()-0.5)*40,
        e.clientY + (Math.random()-0.5)*40
      ), i * 50);
    }
  });
  let lastTrail = 0;
  document.addEventListener('mousemove', e => {
    const now = Date.now();
    if (now - lastTrail < 250) return;
    lastTrail = now;
    if (Math.random() > 0.6) return;
    createSparkle(e.clientX, e.clientY, true);
  });
}

const SPARKLE_SHAPES = ['✦','✧','⋆','•','❋','✶','⊹','★'];
const SPARKLE_COLORS = ['#98A4D8','#FFD5E9','#D6BDE4','#b8c0e8','#e8d088','#88d8a0','#f0e8f4'];

function createSparkle(x, y, isTrail) {
  const sparkle = document.createElement('div');
  sparkle.className = 'sparkle' + (isTrail ? ' trail' : '');
  const size = isTrail ? (4 + Math.random()*5) : (6 + Math.random()*10);
  const dur = (0.3 + Math.random()*0.5).toFixed(2);
  const color = SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)];
  sparkle.textContent = SPARKLE_SHAPES[Math.floor(Math.random() * SPARKLE_SHAPES.length)];
  sparkle.style.cssText = `
    position:fixed; left:${x}px; top:${y}px;
    font-size:${size}px; color:${color};
    pointer-events:none; z-index:99999;
    animation:sparkleAnim ${dur}s ease-out forwards;
    text-shadow:0 0 6px ${color};
    transform:translate(-50%,-50%) rotate(${Math.random()*360}deg);
  `;
  document.body.appendChild(sparkle);
  setTimeout(() => sparkle.remove(), 900);
}

// ══════════════════════════════════════
// ── THEME TOGGLE ──
// ══════════════════════════════════════
function initTheme() {
  const saved = localStorage.getItem('nexus-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);
}
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('nexus-theme', next);
  updateThemeIcon(next);
  nekoReact('theme');
}
function updateThemeIcon(theme) {
  const icon = document.getElementById('theme-icon');
  const label = document.getElementById('theme-label');
  if (icon) icon.textContent = theme === 'dark' ? '🌙' : '☀️';
  if (label) label.textContent = theme === 'dark' ? 'DARK MODE' : 'LIGHT MODE';
}

// ══════════════════════════════════════
// ── FLOATING PIXEL PARTICLES ──
// ══════════════════════════════════════
function initParticles() {
  const canvas = document.getElementById('particles-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
  resize(); window.addEventListener('resize', resize);

  const hues = [260, 280, 300, 200, 140, 50];
  const particles = Array.from({ length: 40 }, () => ({
    x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight,
    r: Math.random() * 2 + 1,
    dx: (Math.random()-0.5)*0.3, dy: (Math.random()-0.5)*0.3,
    alpha: Math.random()*0.2 + 0.05,
    hue: hues[Math.floor(Math.random()*hues.length)],
  }));

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    particles.forEach(p => {
      ctx.fillStyle = isDark
        ? `hsla(${p.hue},60%,55%,${p.alpha})`
        : `hsla(${p.hue},50%,40%,${p.alpha * 0.3})`;
      ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.r*2, p.r*2);
      p.x += p.dx; p.y += p.dy;
      if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
    });
    requestAnimationFrame(draw);
  }
  draw();
}

// ══════════════════════════════════════
// ── BOOT SCREEN ──
// ══════════════════════════════════════
function initBoot() {
  const ws = document.getElementById('welcome-screen');
  if (!ws) return;
  const cat = document.getElementById('boot-cat');
  const title = document.getElementById('boot-title');
  const sub = document.getElementById('boot-subtitle');
  const terminal = document.getElementById('boot-terminal');
  const pw = document.getElementById('boot-progress-wrap');
  const pb = document.getElementById('boot-progress-bar');
  const quote = document.getElementById('boot-quote');
  const enter = document.getElementById('boot-enter');

  quoteIndex = (quoteIndex + 1) % PHILOSOPHY_QUOTES.length;
  if (quote) quote.innerHTML = '<em>' + PHILOSOPHY_QUOTES[quoteIndex] + '</em>';

  setTimeout(() => cat?.classList.add('visible'), 300);
  setTimeout(() => { title?.classList.add('visible'); sub?.classList.add('visible'); }, 1200);
  setTimeout(() => {
    terminal?.classList.add('visible');
    document.querySelectorAll('.term-line').forEach(l => {
      setTimeout(() => l.classList.add('visible'), parseInt(l.dataset.delay || 0));
    });
  }, 2000);
  setTimeout(() => { pw?.classList.add('visible'); setTimeout(() => pb?.classList.add('fill'), 200); }, 5200);
  setTimeout(() => quote?.classList.add('visible'), 7000);
  setTimeout(() => enter?.classList.add('visible'), 7800);

  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Enter' || e.key === 'Escape') {
      dismissWelcome();
      document.removeEventListener('keydown', onKey);
    }
  });
}

// ══════════════════════════════════════
// ── GUIDE ──
// ══════════════════════════════════════
function updateWalleGuide(tab) {
  const body = document.getElementById('neko-guide-body');
  if (!body) return;
  const guides = {
    query:    '<div class="neko-tip">🐱 <b>Nya~</b> Ask me anything and agents will work!</div><div class="neko-tip">⌨️ Press <b>Ctrl+Enter</b> to run</div>',
    tasks:    '<div class="neko-tip">✅ <b>Tasks:</b> Create items with priorities!</div><div class="neko-tip">🐱 <b>Drag me</b> onto a task to mark it done!</div>',
    calendar: '<div class="neko-tip">📅 <b>Click a date</b> to auto-fill!</div>',
    notes:    '<div class="neko-tip">📝 <b>Save notes</b> with tags</div>',
    logs:     '<div class="neko-tip">📊 <b>Logs</b> show agent actions</div>',
    mcp:      '<div class="neko-tip">🔧 <b>MCP Tools</b> — agent capabilities</div>',
  };
  body.innerHTML = guides[tab] || guides.query;
}

const walleReact = nekoReact;
document.addEventListener('DOMContentLoaded', initNeko);
