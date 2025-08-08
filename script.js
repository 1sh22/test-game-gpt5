const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

const storage = {
  load(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  },
  save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }
};

const SOUND_ENABLED_KEY = "glide_sound";
const HIGHSCORES_KEY = "glide_highscores_v1";
const LAST_NAME_KEY = "glide_last_name";

class Sound {
  constructor() {
    this.enabled = storage.load(SOUND_ENABLED_KEY, true);
    this.ctx = null;
  }
  ensureCtx() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  play(freq = 440, type = "sine", durationMs = 80, volume = 0.04) {
    if (!this.enabled) return;
    try {
      this.ensureCtx();
      const ctx = this.ctx;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.value = volume;
      o.connect(g); g.connect(ctx.destination);
      const now = ctx.currentTime;
      o.start(now);
      o.stop(now + durationMs / 1000);
    } catch {}
  }
}

const sound = new Sound();

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function rand(min, max) { return Math.random() * (max - min) + min; }
function chance(p) { return Math.random() < p; }

// Effects
class EffectRing {
  constructor(game, x, y, color = "#2563eb") {
    this.game = game; this.x = x; this.y = y; this.r = 6; this.maxR = 40; this.a = 0.6; this.color = color;
  }
  update(dt) { this.r += 180 * dt; this.a -= 1.2 * dt; }
  done() { return this.a <= 0 || this.r >= this.maxR; }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.a);
    ctx.strokeStyle = this.color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(this.x, this.y, Math.min(this.r, this.maxR), 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
}

class FloatingText {
  constructor(game, x, y, text, color = "#111827") { this.game = game; this.x = x; this.y = y; this.text = text; this.a = 1; this.vy = -60; this.color = color; }
  update(dt) { this.y += this.vy * dt; this.a -= 1.5 * dt; }
  done() { return this.a <= 0; }
  draw(ctx) { ctx.save(); ctx.globalAlpha = Math.max(0, this.a); ctx.fillStyle = this.color; ctx.font = "700 12px Space Grotesk"; ctx.textAlign = "center"; ctx.fillText(this.text, this.x, this.y); ctx.restore(); }
}

class Input {
  constructor(canvas) {
    this.left = false;
    this.right = false;
    this.touchActive = false;
    this.touchX = 0;

    window.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") this.left = true;
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") this.right = true;
    });
    window.addEventListener("keyup", (e) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") this.left = false;
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") this.right = false;
    });

    const updateTouch = (clientX) => {
      const rect = canvas.getBoundingClientRect();
      this.touchX = clamp((clientX - rect.left) / rect.width, 0, 1);
    };

    canvas.addEventListener("pointerdown", (e) => { this.touchActive = true; updateTouch(e.clientX); });
    canvas.addEventListener("pointermove", (e) => { if (this.touchActive) updateTouch(e.clientX); });
    window.addEventListener("pointerup", () => { this.touchActive = false; });
  }
}

class Player {
  constructor(game) {
    this.game = game;
    this.width = 34;
    this.height = 38;
    // Keep player comfortably above bottom regardless of canvas size
    const bottomMargin = Math.max(110, game.height * 0.14);
    this.x = game.width / 2;
    this.y = game.height - bottomMargin;
    this.speed = 0;
    this.maxSpeed = 520;
    this.acc = 1800;
    this.friction = 1400;
    this.color = "#111827"; // primary dark
    this.t = 0;
    this.trail = [];
    this.trailTimer = 0;
  }
  update(dt, input) {
    this.t += dt;
    if (input.touchActive) {
      this.x = clamp(input.touchX * this.game.width, this.width * 0.6, this.game.width - this.width * 0.6);
      this.speed = 0;
    } else {
      const target = (input.left ? -1 : 0) + (input.right ? 1 : 0);
      if (target !== 0) this.speed += target * this.acc * dt; else this.speed = Math.abs(this.speed) < this.friction * dt ? 0 : this.speed - Math.sign(this.speed) * this.friction * dt;
      this.speed = clamp(this.speed, -this.maxSpeed, this.maxSpeed);
      this.x = clamp(this.x + this.speed * dt, this.width * 0.6, this.game.width - this.width * 0.6);
    }
    // trail sampling (slightly faster, shorter)
    this.trailTimer -= dt;
    if (this.trailTimer <= 0) {
      this.trail.unshift({ x: this.x, y: this.y });
      if (this.trail.length > 5) this.trail.pop();
      this.trailTimer = 0.025;
    }
  }
  draw(ctx) {
    ctx.save();
    // quicker, subtler hover
    ctx.translate(this.x, this.y + Math.sin(this.t * 9) * 0.9);
    // trail
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const p = this.trail[i];
      const alpha = (i + 1) / (this.trail.length + 1) * 0.28;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x - this.x, p.y - this.y);
      ctx.fillStyle = "#111827";
      ctx.beginPath();
      ctx.moveTo(0, -this.height * 0.5);
      ctx.lineTo(this.width * 0.6, this.height * 0.6);
      ctx.lineTo(-this.width * 0.6, this.height * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // main shape
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.moveTo(0, -this.height * 0.5);
    ctx.lineTo(this.width * 0.6, this.height * 0.6);
    ctx.lineTo(-this.width * 0.6, this.height * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }
  getBounds() { return { x: this.x - this.width * 0.45, y: this.y - this.height * 0.45, w: this.width * 0.9, h: this.height * 0.9 }; }
}

class Obstacle {
  constructor(game) {
    this.game = game;
    this.w = rand(34, 90);
    this.h = rand(18, 30);
    this.x = rand(this.w / 2, game.width - this.w / 2);
    this.y = -this.h - rand(0, 60);
    this.speed = rand(game.speed * 0.85, game.speed * 1.25);
    this.color = "#111827"; // simple dark blocks
    this.a = 0; // fade-in alpha
  }
  update(dt) { this.y += this.speed * dt; this.a = Math.min(1, this.a + dt * 4); }
  offscreen() { return this.y - this.h > this.game.height + 40; }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.globalAlpha = this.a;
    ctx.fillStyle = this.color;
    const rx = 6;
    const w2 = this.w / 2, h2 = this.h / 2;
    ctx.beginPath();
    ctx.moveTo(-w2 + rx, -h2);
    ctx.lineTo(w2 - rx, -h2);
    ctx.quadraticCurveTo(w2, -h2, w2, -h2 + rx);
    ctx.lineTo(w2, h2 - rx);
    ctx.quadraticCurveTo(w2, h2, w2 - rx, h2);
    ctx.lineTo(-w2 + rx, h2);
    ctx.quadraticCurveTo(-w2, h2, -w2, h2 - rx);
    ctx.lineTo(-w2, -h2 + rx);
    ctx.quadraticCurveTo(-w2, -h2, -w2 + rx, -h2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  getBounds() { return { x: this.x - this.w/2, y: this.y - this.h/2, w: this.w, h: this.h }; }
}

class Orb {
  constructor(game) {
    this.game = game;
    this.r = 9;
    this.x = rand(this.r + 6, game.width - this.r - 6);
    this.y = -this.r - rand(20, 120);
    this.speed = rand(game.speed * 0.8, game.speed * 1.1);
    this.color = "#2563eb"; // single accent
    this.a = 0; // fade-in alpha
    this.pulse = Math.random() * Math.PI * 2;
  }
  update(dt) { this.y += this.speed * dt; this.a = Math.min(1, this.a + dt * 4); this.pulse += dt * 4.5; }
  offscreen() { return this.y - this.r > this.game.height + 40; }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.globalAlpha = this.a;
    const scale = 1 + 0.15 * Math.sin(this.pulse);
    ctx.scale(scale, scale);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(0, 0, this.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  getBounds() { return { x: this.x - this.r, y: this.y - this.r, w: this.r*2, h: this.r*2 }; }
}

function rectsOverlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

class Grid {
  constructor(game) { this.game = game; }
  update() {}
  draw(ctx) {
    ctx.save();
    ctx.strokeStyle = "#e5e7eb"; // border
    ctx.lineWidth = 1;
    for (let x = 0; x <= this.game.width; x += this.game.width / 6) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.game.height); ctx.stroke();
    }
    ctx.restore();
  }
}

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.width = 390;
    this.height = 700;
    this.resize();

    this.input = new Input(canvas);
    this.grid = new Grid(this);
    this.player = new Player(this);
    this.obstacles = [];
    this.orbs = [];
    this.effects = [];

    this.elapsed = 0;
    this.running = false;
    this.speed = 150;
    this.difficulty = 0;
    this.spawnCooldown = 0;
    this.orbCooldown = 2;

    this.score = 0;
    this.best = (storage.load(HIGHSCORES_KEY, [])[0]?.score) || 0;
    this.multiplier = 1;
    this.nearMissGrace = 0.0;

    this.shakeTime = 0; this.shakeMag = 0;

    this.hudScore = document.getElementById("hudScore");
    this.hudBest = document.getElementById("hudBest");
    this.hudMultiplier = document.getElementById("hudMultiplier");

    this.updateHud();

    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    const wrap = this.canvas.parentElement;
    const rect = wrap.getBoundingClientRect();
    const ar = 9/16;
    // Fit to available height (no page scroll)
    let h = rect.height;
    let w = h * ar;
    if (w > rect.width) { w = rect.width; h = w / ar; }

    // Use a fixed logical size and scale by DPR
    this.width = 390;
    this.height = Math.round(this.width / ar);

    this.canvas.width = Math.floor(this.width * DPR);
    this.canvas.height = Math.floor(this.height * DPR);
    this.ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  start() {
    this.running = true;
    this.elapsed = 0;
    this.difficulty = 0;
    this.spawnCooldown = 0;
    this.orbCooldown = 1.5;
    this.score = 0;
    this.multiplier = 1;
    this.nearMissGrace = 0;
    this.grid = new Grid(this);
    this.player = new Player(this);
    this.obstacles = [];
    this.orbs = [];
    this.effects = [];
    this.shakeTime = 0; this.shakeMag = 0;
    this._lastTs = undefined; // reset timestamp so first dt is correct
    this.loop(performance.now());
  }

  stop() { this.running = false; }

  updateHud() {
    this.hudScore.textContent = Math.floor(this.score).toString();
    this.hudBest.textContent = Math.floor(Math.max(this.best, this.score)).toString();
    this.hudMultiplier.textContent = this.multiplier.toFixed(1);
  }

  spawnObstacle() { this.obstacles.push(new Obstacle(this)); }
  spawnOrb() { this.orbs.push(new Orb(this)); }

  loop(ts) {
    if (!this._lastTs) this._lastTs = ts;
    const dt = Math.min(0.033, (ts - this._lastTs) / 1000);
    this._lastTs = ts;
    if (!this.running) return;

    this.update(dt);
    this.draw();
    requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    this.elapsed += dt;
    this.difficulty = Math.min(1, this.elapsed / 90);
    this.speed = 150 + 320 * this.difficulty;

    this.spawnCooldown -= dt;
    const spawnEvery = clamp(0.8 - this.difficulty * 0.55, 0.18, 0.8);
    if (this.spawnCooldown <= 0) { this.spawnObstacle(); this.spawnCooldown = spawnEvery; }

    this.orbCooldown -= dt;
    const orbEvery = clamp(2.8 - this.difficulty * 1.5, 0.9, 3.0);
    if (this.orbCooldown <= 0) { if (chance(0.8)) this.spawnOrb(); this.orbCooldown = orbEvery; }

    this.player.update(dt, this.input);
    for (const o of this.obstacles) o.update(dt);
    for (const c of this.orbs) c.update(dt);

    const pb = this.player.getBounds();
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const orb = this.orbs[i];
      if (rectsOverlap(pb, orb.getBounds())) {
        this.orbs.splice(i, 1);
        const bonus = 30 * this.multiplier;
        this.score += bonus;
        this.effects.push(new EffectRing(this, orb.x, orb.y, "#2563eb"));
        this.effects.push(new FloatingText(this, orb.x, orb.y - 6, `+${Math.floor(bonus)}`));
        sound.play(640, "sine", 100, 0.035);
      }
    }

    let hit = false;
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const ob = this.obstacles[i];
      const obb = ob.getBounds();
      if (rectsOverlap(pb, obb)) { hit = true; break; }

      const verticalClose = Math.abs((obb.y + obb.h/2) - (pb.y + pb.h/2)) < 22;
      const horizontalGap = Math.abs((obb.x + obb.w/2) - (pb.x + pb.w/2));
      if (verticalClose && horizontalGap < 18 + pb.w/2 + obb.w/2 && horizontalGap > (pb.w/2 + obb.w/2 - 14)) {
        if (this.nearMissGrace <= 0) {
          this.multiplier = clamp(this.multiplier + 0.1, 1, 4.0);
          this.nearMissGrace = 0.25;
          this.effects.push(new FloatingText(this, this.player.x, this.player.y - 20, `x${this.multiplier.toFixed(1)}`));
          this.shake(3, 0.15);
          sound.play(880, "triangle", 60, 0.03);
        }
      }
    }

    if (hit) { this.shake(8, 0.3); this.gameOver(); return; }

    this.nearMissGrace -= dt;

    this.obstacles = this.obstacles.filter(o => !o.offscreen());
    this.orbs = this.orbs.filter(o => !o.offscreen());

    for (const e of this.effects) e.update(dt);
    this.effects = this.effects.filter(e => !e.done());

    this.score += (12 + this.difficulty * 24) * dt * this.multiplier;
    if (this.score < 0) this.score = 0; // safety clamp
    this.updateHud();

    // decay shake
    if (this.shakeTime > 0) { this.shakeTime -= dt; if (this.shakeTime <= 0) { this.shakeTime = 0; this.shakeMag = 0; } }
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // subtle background
    ctx.save();
    // apply shake
    if (this.shakeTime > 0 && this.shakeMag > 0) {
      const m = this.shakeMag * (this.shakeTime);
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, this.width, this.height);

    // grid lanes
    this.grid.draw(ctx);

    // entities
    for (const orb of this.orbs) orb.draw(ctx);
    for (const ob of this.obstacles) ob.draw(ctx);
    this.player.draw(ctx);

    // effects overlay
    for (const fx of this.effects) fx.draw(ctx);

    ctx.restore();
  }

  gameOver() {
    sound.play(220, "sawtooth", 200, 0.05);
    this.stop();
    const final = Math.floor(this.score);
    document.getElementById("finalScore").textContent = String(final);
    const nameInput = document.getElementById("playerName");
    nameInput.value = storage.load(LAST_NAME_KEY, "Player");
    openDialog(gameOverDialog);
    if (final > this.best) this.best = final;
    this.updateHud();
  }

  shake(magnitude = 4, time = 0.2) { this.shakeMag = Math.max(this.shakeMag, magnitude); this.shakeTime = Math.max(this.shakeTime, time); }
}

function openDialog(dialog) { if (!dialog.open) dialog.showModal(); }
function closeDialog(dialog) { if (dialog.open) dialog.close(); }

const canvas = document.getElementById("gameCanvas");
const startDialog = document.getElementById("startDialog");
const pauseDialog = document.getElementById("pauseDialog");
const gameOverDialog = document.getElementById("gameOverDialog");
const helpDialog = document.getElementById("helpDialog");
const leaderboardDialog = document.getElementById("leaderboardDialog");
const leaderboardList = document.getElementById("leaderboardList");
const touchHint = document.getElementById("touchHint");

const btnStart = document.getElementById("btnStart");
const btnPause = document.getElementById("btnPause");
const btnResume = document.getElementById("btnResume");
const pauseToStart = document.getElementById("pauseToStart");

const btnHelp = document.getElementById("btnHelp");
const helpClose = document.getElementById("helpClose");
const openHelp = document.getElementById("openHelp");

const btnLeaderboard = document.getElementById("btnLeaderboard");
const openLeaderboard = document.getElementById("openLeaderboard");
const leaderboardClose = document.getElementById("leaderboardClose");
const btnClearScores = document.getElementById("btnClearScores");
const goToLeaderboard = document.getElementById("goToLeaderboard");

const btnSaveScore = document.getElementById("btnSaveScore");
const btnRetry = document.getElementById("btnRetry");

const btnShare = document.getElementById("btnShare");
const btnSound = document.getElementById("btnSound");
const soundIcon = document.getElementById("soundIcon");

const game = new Game(canvas);

// Auto-restart after game-over flows
let pendingAutoRestart = false;

// Restart helper
function requestRestartOnDialogClose() { pendingAutoRestart = true; }
function restartNow() { pendingAutoRestart = false; game.start(); }

// Close listeners for all dialogs to honor pending restart
startDialog?.addEventListener("close", () => { if (pendingAutoRestart) restartNow(); });
pauseDialog?.addEventListener("close", () => { if (pendingAutoRestart) restartNow(); });
helpDialog?.addEventListener("close", () => { if (pendingAutoRestart) restartNow(); });
gameOverDialog?.addEventListener("close", () => { if (pendingAutoRestart) restartNow(); });
leaderboardDialog?.addEventListener("close", () => { if (pendingAutoRestart) restartNow(); });

// When leaderboard (opened from anywhere) is closed, restart if requested
// (already handled by the generic close listener above)

function updateTouchHint() {
  touchHint.style.opacity = ("ontouchstart" in window || navigator.maxTouchPoints > 0) ? 1 : 0;
}
updateTouchHint();

function getScores() { return storage.load(HIGHSCORES_KEY, []); }
function saveScores(scores) { storage.save(HIGHSCORES_KEY, scores.slice(0,10)); }
function renderLeaderboard() {
  const scores = getScores();
  leaderboardList.innerHTML = "";
  if (!scores.length) {
    leaderboardList.innerHTML = `<li><span class="name">No scores yet</span><span class="score">—</span></li>`;
    return;
  }
  for (const { name, score, date } of scores) {
    const li = document.createElement("li");
    const left = document.createElement("span"); left.className = "name"; left.textContent = `${name} — ${new Date(date).toLocaleDateString()}`;
    const right = document.createElement("span"); right.className = "score"; right.textContent = String(score);
    li.append(left, right);
    leaderboardList.appendChild(li);
  }
}

function addScore(name, score) {
  const scores = getScores();
  scores.push({ name, score, date: Date.now() });
  scores.sort((a, b) => b.score - a.score);
  saveScores(scores);
}

btnStart?.addEventListener("click", (e) => { e.preventDefault(); closeDialog(startDialog); restartNow(); });
btnPause?.addEventListener("click", () => { requestRestartOnDialogClose(); if (!game.running) return; game.stop(); openDialog(pauseDialog); });
btnResume?.addEventListener("click", (e) => { e.preventDefault(); closeDialog(pauseDialog); restartNow(); });

pauseToStart?.addEventListener("click", (e) => { e.preventDefault(); requestRestartOnDialogClose(); closeDialog(pauseDialog); openDialog(startDialog); });

btnHelp?.addEventListener("click", () => { requestRestartOnDialogClose(); openDialog(helpDialog); });
helpClose?.addEventListener("click", (e) => { e.preventDefault(); closeDialog(helpDialog); /* restart happens on close */ });
openHelp?.addEventListener("click", (e) => { e.preventDefault(); requestRestartOnDialogClose(); closeDialog(startDialog); openDialog(helpDialog); });

btnLeaderboard?.addEventListener("click", () => { requestRestartOnDialogClose(); renderLeaderboard(); openDialog(leaderboardDialog); });
openLeaderboard?.addEventListener("click", (e) => { e.preventDefault(); requestRestartOnDialogClose(); closeDialog(startDialog); renderLeaderboard(); openDialog(leaderboardDialog); });
leaderboardClose?.addEventListener("click", (e) => { e.preventDefault(); closeDialog(leaderboardDialog); });
btnClearScores?.addEventListener("click", (e) => { e.preventDefault(); storage.save(HIGHSCORES_KEY, []); renderLeaderboard(); requestRestartOnDialogClose(); });

goToLeaderboard?.addEventListener("click", (e) => {
  e.preventDefault();
  requestRestartOnDialogClose();
  closeDialog(gameOverDialog);
  renderLeaderboard();
  openDialog(leaderboardDialog);
});

btnSaveScore?.addEventListener("click", (e) => {
  e.preventDefault();
  const final = parseInt(document.getElementById("finalScore").textContent || "0", 10);
  const name = (document.getElementById("playerName").value || "Player").trim().slice(0, 16) || "Player";
  storage.save(LAST_NAME_KEY, name);
  addScore(name, final);
  renderLeaderboard();
  requestRestartOnDialogClose();
  closeDialog(gameOverDialog);
  openDialog(leaderboardDialog);
});

btnRetry?.addEventListener("click", (e) => { e.preventDefault(); closeDialog(gameOverDialog); restartNow(); });

btnShare?.addEventListener("click", async (e) => {
  e.preventDefault();
  const s = document.getElementById("finalScore").textContent;
  const text = `I just scored ${s} in Glide!`;
  try {
    if (navigator.share) { await navigator.share({ title: "Glide", text }); }
    else { await navigator.clipboard.writeText(text); alert("Copied to clipboard!"); }
  } catch {}
  requestRestartOnDialogClose();
  closeDialog(gameOverDialog);
});

btnSound?.addEventListener("click", () => {
  sound.enabled = !sound.enabled;
  storage.save(SOUND_ENABLED_KEY, sound.enabled);
  soundIcon.textContent = sound.enabled ? "🔊" : "🔇";
  if (sound.enabled) sound.play(660, "square", 80, 0.03);
  // Restart immediately after toggling sound as per requirement
  restartNow();
});

afterDomInit();
function afterDomInit() {
  soundIcon.textContent = sound.enabled ? "🔊" : "🔇";
  openDialog(startDialog);
  canvas.addEventListener('touchmove', (e) => { e.preventDefault(); }, { passive: false });
} 