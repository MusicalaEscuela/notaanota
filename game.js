/* ───────────────────────────────────────────────────────────────
   NOTA A NOTA · Musicala
   Movimiento tipo laberinto + secuencia musical + audio sintético
─────────────────────────────────────────────────────────────── */
'use strict';

// ══════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ══════════════════════════════════════════════════════════════

const TILE = 40;
const COLS = 20;
const ROWS = 15;
const GAME_WIDTH = COLS * TILE;
const GAME_HEIGHT = ROWS * TILE;
const BASE_SPEED = 3.35;
const TIME_LIMIT = 60;
const STORAGE_KEY = 'musicala-nota-a-nota-best-score';

const NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NOTE_COLORS = ['#ff5b7e', '#ff9d2e', '#f3c300', '#2ac77f', '#1c9df2', '#7b4dff', '#d100b8'];
const NOTE_FREQUENCIES = {
  C: 261.63,
  D: 293.66,
  E: 329.63,
  F: 349.23,
  G: 392.00,
  A: 440.00,
  B: 493.88,
};

const NOTE_POSITIONS = [
  [1, 1],
  [18, 1],
  [18, 13],
  [1, 13],
  [9, 1],
  [9, 13],
  [9, 7],
];

// 0 = pared | 1 = camino libre
const MAP = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,0,0,1,1,1,0,0,1,1,0,0,1,1,1,0,0,1,0],
  [0,1,0,0,1,1,1,0,0,1,1,0,0,1,1,1,0,0,1,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,1,0,0,1,0,0,1,1,1,1,0,0,1,0,0,1,1,0],
  [0,1,1,0,0,1,0,0,1,1,1,1,0,0,1,0,0,1,1,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,1,0,0,1,0,0,1,1,1,1,0,0,1,0,0,1,1,0],
  [0,1,1,0,0,1,0,0,1,1,1,1,0,0,1,0,0,1,1,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,0,0,1,1,1,0,0,1,1,0,0,1,1,1,0,0,1,0],
  [0,1,0,0,1,1,1,0,0,1,1,0,0,1,1,1,0,0,1,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};

const DIR_KEYS = {
  ArrowLeft: DIRS.left,
  a: DIRS.left,
  A: DIRS.left,
  ArrowRight: DIRS.right,
  d: DIRS.right,
  D: DIRS.right,
  ArrowUp: DIRS.up,
  w: DIRS.up,
  W: DIRS.up,
  ArrowDown: DIRS.down,
  s: DIRS.down,
  S: DIRS.down,
};

// ══════════════════════════════════════════════════════════════
// ELEMENTOS
// ══════════════════════════════════════════════════════════════

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('hud-score');
const bestEl = document.getElementById('hud-best');
const timeEl = document.getElementById('hud-time');
const seqEl = document.getElementById('hud-seq');
const overlayEl = document.getElementById('overlay');
const titleEl = document.getElementById('ov-title');
const msgEl = document.getElementById('ov-msg');
const btnEl = document.getElementById('ov-btn');
const feedbackEl = document.getElementById('game-feedback');

const logoImg = new Image();
logoImg.src = 'logo.png';
logoImg.onload = () => drawPreview();

let audioCtx = null;
let running = false;
let score = 0;
let bestScore = loadBestScore();
let timeLeft = TIME_LIMIT;
let currentIdx = 0;
let collected = [];
let particles = [];
let floatingTexts = [];
let tick = 0;
let flashTimer = 0;
let shakeTimer = 0;
let lastTimestamp = 0;
let timeAccum = 0;
let feedbackTimer = 0;
let wrongCooldown = 0;

const player = {
  col: 4,
  row: 7,
  px: 4 * TILE + TILE / 2,
  py: 7 * TILE + TILE / 2,
  targetCol: 4,
  targetRow: 7,
  dir: { x: 0, y: 0 },
  next: { x: 0, y: 0 },
  moving: false,
  facing: 1,
};

// ══════════════════════════════════════════════════════════════
// CANVAS RESPONSIVO / ALTA DENSIDAD
// ══════════════════════════════════════════════════════════════

function setupCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = GAME_WIDTH * dpr;
  canvas.height = GAME_HEIGHT * dpr;
  canvas.style.width = '100%';
  canvas.style.height = 'auto';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

setupCanvas();
window.addEventListener('resize', () => {
  setupCanvas();
  if (!running) drawPreview();
});

// ══════════════════════════════════════════════════════════════
// AUDIO GENERADO EN EL NAVEGADOR
// ══════════════════════════════════════════════════════════════

function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playTone(freq, duration = 0.12, type = 'sine', gainValue = 0.07, delay = 0) {
  if (!audioCtx) return;

  const start = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function playCollectSound(note, idx) {
  const freq = NOTE_FREQUENCIES[note] || 440;
  playTone(freq, 0.11, 'triangle', 0.08, 0);
  playTone(freq * 1.5, 0.14, 'sine', 0.045, 0.08);
  if (idx === NOTES.length - 1) playWinSound();
}

function playWrongSound() {
  playTone(130, 0.12, 'sawtooth', 0.035, 0);
  playTone(96, 0.16, 'triangle', 0.035, 0.09);
}

function playWinSound() {
  const melody = [523.25, 659.25, 783.99, 1046.5];
  melody.forEach((freq, i) => playTone(freq, 0.13, 'triangle', 0.075, i * 0.1));
}

function playLoseSound() {
  [220, 196, 174.61, 146.83].forEach((freq, i) => playTone(freq, 0.14, 'triangle', 0.055, i * 0.11));
}

// ══════════════════════════════════════════════════════════════
// INPUT
// ══════════════════════════════════════════════════════════════

function setDirection(dir) {
  if (!dir) return;
  player.next = { ...dir };
  if (dir.x !== 0) player.facing = dir.x;
}

document.addEventListener('keydown', (event) => {
  const dir = DIR_KEYS[event.key];
  if (!dir) return;
  if (running) event.preventDefault();
  setDirection(dir);
});

document.querySelectorAll('.control-btn').forEach((button) => {
  const dirName = button.dataset.dir;
  const dir = DIRS[dirName];

  const press = (event) => {
    event.preventDefault();
    ensureAudio();
    setDirection(dir);
    button.classList.add('is-pressed');
    canvas.focus({ preventScroll: true });
  };

  const release = () => button.classList.remove('is-pressed');

  button.addEventListener('pointerdown', press);
  button.addEventListener('pointerup', release);
  button.addEventListener('pointerleave', release);
  button.addEventListener('click', (event) => event.preventDefault());
});

// ══════════════════════════════════════════════════════════════
// UTILIDADES
// ══════════════════════════════════════════════════════════════

function isOpen(c, r) {
  return c >= 0 && c < COLS && r >= 0 && r < ROWS && MAP[r][c] === 1;
}

function loadBestScore() {
  try {
    return Number(localStorage.getItem(STORAGE_KEY) || 0);
  } catch (error) {
    return 0;
  }
}

function saveBestScore(value) {
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch (error) {
    // Si el navegador bloquea localStorage, el juego sigue funcionando.
  }
}

function formatScore(value) {
  return String(Math.max(0, Math.round(value))).padStart(5, '0');
}

function roundRect(x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function resetPlayer() {
  player.col = player.targetCol = 4;
  player.row = player.targetRow = 7;
  player.px = 4 * TILE + TILE / 2;
  player.py = 7 * TILE + TILE / 2;
  player.dir = { x: 0, y: 0 };
  player.next = { x: 0, y: 0 };
  player.moving = false;
  player.facing = 1;
}

function initGame() {
  score = 0;
  timeLeft = TIME_LIMIT;
  currentIdx = 0;
  collected = new Array(NOTES.length).fill(false);
  particles = [];
  floatingTexts = [];
  tick = 0;
  flashTimer = 0;
  shakeTimer = 0;
  timeAccum = 0;
  feedbackTimer = 0;
  wrongCooldown = 0;
  resetPlayer();
  refreshHUD();
}

function showFeedback(text, tone = 'default') {
  feedbackEl.textContent = text;
  feedbackEl.classList.add('show');
  feedbackEl.dataset.tone = tone;
  feedbackTimer = 105;
}

function updateFeedback() {
  if (feedbackTimer <= 0) return;
  feedbackTimer--;
  if (feedbackTimer <= 0) feedbackEl.classList.remove('show');
}

function addFloatingText(text, x, y, color = '#5b34f4') {
  floatingTexts.push({ text, x, y, color, life: 1 });
}

// ══════════════════════════════════════════════════════════════
// MOVIMIENTO
// ══════════════════════════════════════════════════════════════

function tryMove() {
  for (const dir of [player.next, player.dir]) {
    if (dir.x === 0 && dir.y === 0) continue;

    const nc = player.col + dir.x;
    const nr = player.row + dir.y;

    if (isOpen(nc, nr)) {
      player.dir = { ...dir };
      player.targetCol = nc;
      player.targetRow = nr;
      player.moving = true;
      return;
    }
  }

  player.moving = false;
}

function updatePlayer(dt) {
  if (!player.moving) {
    tryMove();
    return;
  }

  const tpx = player.targetCol * TILE + TILE / 2;
  const tpy = player.targetRow * TILE + TILE / 2;
  const dx = tpx - player.px;
  const dy = tpy - player.py;
  const dist = Math.hypot(dx, dy);
  const step = BASE_SPEED * Math.max(0.75, Math.min(dt / 16.67, 2));

  if (dist <= step) {
    player.px = tpx;
    player.py = tpy;
    player.col = player.targetCol;
    player.row = player.targetRow;
    player.moving = false;
    checkCollection();
    tryMove();
  } else {
    player.px += (dx / dist) * step;
    player.py += (dy / dist) * step;
  }
}

// ══════════════════════════════════════════════════════════════
// RECOLECCIÓN
// ══════════════════════════════════════════════════════════════

function checkCollection() {
  if (currentIdx >= NOTES.length) return;

  const [targetCol, targetRow] = NOTE_POSITIONS[currentIdx];

  if (player.col === targetCol && player.row === targetRow) {
    const note = NOTES[currentIdx];
    const color = NOTE_COLORS[currentIdx];

    collected[currentIdx] = true;
    currentIdx++;
    score += 150 + currentIdx * 10;
    flashTimer = 8;
    spawnBurst(player.px, player.py, color, 24);
    addFloatingText(`+${150 + currentIdx * 10}`, player.px, player.py - 22, color);
    showFeedback(currentIdx < NOTES.length ? `¡Bien! Ahora busca ${NOTES[currentIdx]}` : '¡Secuencia completa!', 'success');
    playCollectSound(note, currentIdx - 1);
    refreshHUD();

    if (currentIdx >= NOTES.length) {
      score += timeLeft * 12;
      refreshHUD();
      setTimeout(() => showEnd(true), 650);
    }

    return;
  }

  const wrongIdx = NOTE_POSITIONS.findIndex(([c, r], idx) => (
    idx !== currentIdx && !collected[idx] && player.col === c && player.row === r
  ));

  if (wrongIdx !== -1 && wrongCooldown <= 0) {
    const expected = NOTES[currentIdx];
    const touched = NOTES[wrongIdx];
    score = Math.max(0, score - 50);
    timeLeft = Math.max(0, timeLeft - 3);
    wrongCooldown = 28;
    shakeTimer = 20;
    spawnBurst(player.px, player.py, '#ef335f', 12);
    addFloatingText('-3s', player.px, player.py - 22, '#ef335f');
    showFeedback(`Esa era ${touched}. Tocaba ${expected}. La música también exige orden, qué tragedia.`, 'warning');
    playWrongSound();
    refreshHUD();

    if (timeLeft <= 0) showEnd(false);
  }
}

// ══════════════════════════════════════════════════════════════
// PARTÍCULAS / TEXTOS
// ══════════════════════════════════════════════════════════════

function spawnBurst(x, y, color, amount) {
  for (let i = 0; i < amount; i++) {
    const angle = Math.PI * 2 * (i / amount) + Math.random() * 0.55;
    const speed = 1.4 + Math.random() * 3.3;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1.2,
      color,
      size: 3 + Math.random() * 5,
      life: 1,
    });
  }
}

function updateParticles() {
  particles = particles.filter((particle) => {
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vy += 0.13;
    particle.life -= 0.024;
    return particle.life > 0;
  });

  floatingTexts = floatingTexts.filter((item) => {
    item.y -= 0.72;
    item.life -= 0.022;
    return item.life > 0;
  });
}

// ══════════════════════════════════════════════════════════════
// HUD
// ══════════════════════════════════════════════════════════════

function refreshHUD() {
  scoreEl.textContent = formatScore(score);
  bestEl.textContent = formatScore(bestScore);
  timeEl.textContent = String(Math.max(0, Math.ceil(timeLeft)));
  timeEl.classList.toggle('urgent', timeLeft <= 10);

  seqEl.innerHTML = NOTES.map((note, idx) => {
    const stateClass = collected[idx]
      ? 'note-chip done'
      : idx === currentIdx
        ? 'note-chip active'
        : 'note-chip';
    const separator = idx < NOTES.length - 1 ? '<span class="hud-arrow">›</span>' : '';
    return `<span class="${stateClass}" style="color:${NOTE_COLORS[idx]}">${note}</span>${separator}`;
  }).join('');
}

function updateBestScore() {
  if (score <= bestScore) return;
  bestScore = score;
  saveBestScore(bestScore);
  refreshHUD();
}

// ══════════════════════════════════════════════════════════════
// DIBUJO
// ══════════════════════════════════════════════════════════════

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, GAME_WIDTH, GAME_HEIGHT);
  gradient.addColorStop(0, '#fff8ff');
  gradient.addColorStop(0.52, '#f8fbff');
  gradient.addColorStop(1, '#fff3fb');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.strokeStyle = '#eadfff';
  ctx.lineWidth = 1;
  for (let x = 0; x <= GAME_WIDTH; x += TILE) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, GAME_HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y <= GAME_HEIGHT; y += TILE) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(GAME_WIDTH, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMap() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = c * TILE;
      const y = r * TILE;

      if (MAP[r][c] === 0) {
        const wallGradient = ctx.createLinearGradient(x, y, x + TILE, y + TILE);
        wallGradient.addColorStop(0, '#6b46ff');
        wallGradient.addColorStop(0.55, '#8d55ff');
        wallGradient.addColorStop(1, '#d219bb');

        ctx.save();
        ctx.shadowColor = 'rgba(91, 52, 244, 0.24)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 2;
        roundRect(x + 4, y + 4, TILE - 8, TILE - 8, 12);
        ctx.fillStyle = wallGradient;
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        roundRect(x + 8, y + 8, TILE - 16, TILE - 16, 8);
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.save();
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = '#ffffff';
        roundRect(x + 14, y + 14, 12, 12, 6);
        ctx.fill();
        ctx.restore();
      }
    }
  }
}

function drawPathHint() {
  if (currentIdx >= NOTES.length) return;

  const [targetCol, targetRow] = NOTE_POSITIONS[currentIdx];
  const targetX = targetCol * TILE + TILE / 2;
  const targetY = targetRow * TILE + TILE / 2;

  ctx.save();
  ctx.globalAlpha = 0.2 + Math.sin(tick * 0.08) * 0.05;
  ctx.strokeStyle = NOTE_COLORS[currentIdx];
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 10]);
  ctx.lineDashOffset = -tick * 0.65;
  ctx.beginPath();
  ctx.moveTo(player.px, player.py);
  ctx.lineTo(targetX, targetY);
  ctx.stroke();
  ctx.restore();
}

function drawNote(idx) {
  if (collected[idx]) return;

  const [col, row] = NOTE_POSITIONS[idx];
  const cx = col * TILE + TILE / 2;
  const cy = row * TILE + TILE / 2;
  const color = NOTE_COLORS[idx];
  const label = NOTES[idx];
  const isTarget = idx === currentIdx;
  const bob = Math.sin(tick * 0.055 + idx * 1.3) * 3;
  const pulse = 0.5 + 0.5 * Math.sin(tick * 0.1 + idx);

  ctx.save();
  ctx.translate(cx, cy + bob);

  if (isTarget) {
    ctx.save();
    ctx.globalAlpha = 0.16 + pulse * 0.14;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 20 + pulse * 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = isTarget ? 24 : 12;
  ctx.fillStyle = '#ffffff';
  roundRect(-18, -20, 36, 42, 16);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = color;
  ctx.font = '900 24px "Nunito", "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('♪', 0, -4);

  ctx.fillStyle = isTarget ? '#241442' : '#766a90';
  ctx.font = '900 12px "Inter", sans-serif';
  ctx.fillText(label, 0, 15);

  ctx.restore();
}

function drawPlayer() {
  const { px, py, moving, facing } = player;
  const bounce = moving ? Math.sin(tick * 0.26) * 2 : Math.sin(tick * 0.08) * 1.2;
  const leg = moving ? Math.sin(tick * 0.32) * 3 : 0;

  ctx.save();
  ctx.translate(px, py + bounce);
  if (facing < 0) ctx.scale(-1, 1);

  const bodyGradient = ctx.createLinearGradient(-16, -20, 16, 22);
  bodyGradient.addColorStop(0, '#1399ea');
  bodyGradient.addColorStop(0.54, '#5b34f4');
  bodyGradient.addColorStop(1, '#d900b9');

  ctx.save();
  ctx.shadowColor = 'rgba(91, 52, 244, 0.34)';
  ctx.shadowBlur = 18;
  ctx.fillStyle = bodyGradient;
  ctx.beginPath();
  ctx.arc(0, -2, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Audífonos
  ctx.strokeStyle = '#241442';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, -8, 15, Math.PI * 1.08, Math.PI * 1.92);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  roundRect(-20, -7, 7, 15, 4);
  ctx.fill();
  roundRect(13, -7, 7, 15, 4);
  ctx.fill();

  // Cara
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-5, -5, 2.5, 0, Math.PI * 2);
  ctx.arc(5, -5, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 1, 6, 0.18 * Math.PI, 0.82 * Math.PI);
  ctx.stroke();

  // Patitas
  ctx.strokeStyle = '#241442';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-7, 13);
  ctx.lineTo(-11 + leg, 21);
  ctx.moveTo(7, 13);
  ctx.lineTo(11 - leg, 21);
  ctx.stroke();

  ctx.restore();
}

function drawParticles() {
  for (const particle of particles) {
    ctx.save();
    ctx.globalAlpha = particle.life;
    ctx.fillStyle = particle.color;
    ctx.shadowColor = particle.color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size * particle.life, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawFloatingTexts() {
  for (const item of floatingTexts) {
    ctx.save();
    ctx.globalAlpha = item.life;
    ctx.fillStyle = item.color;
    ctx.font = '900 18px "Nunito", "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255,255,255,0.9)';
    ctx.shadowBlur = 8;
    ctx.fillText(item.text, item.x, item.y);
    ctx.restore();
  }
}

function drawWatermark() {
  if (!logoImg.complete || !logoImg.naturalWidth) return;

  const width = 116;
  const height = width * (logoImg.naturalHeight / logoImg.naturalWidth);

  ctx.save();
  ctx.globalAlpha = 0.13;
  ctx.drawImage(logoImg, GAME_WIDTH - width - 22, GAME_HEIGHT - height - 18, width, height);
  ctx.restore();
}

function drawTopGuide() {
  if (currentIdx >= NOTES.length) return;

  const note = NOTES[currentIdx];
  const color = NOTE_COLORS[currentIdx];

  ctx.save();
  ctx.font = '900 18px "Nunito", "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const text = `Busca la nota ${note}`;
  const width = ctx.measureText(text).width + 44;
  const x = GAME_WIDTH / 2 - width / 2;
  const y = 16;

  ctx.fillStyle = 'rgba(255,255,255,0.84)';
  ctx.strokeStyle = 'rgba(91, 52, 244, 0.16)';
  ctx.lineWidth = 1;
  roundRect(x, y, width, 36, 18);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.fillText(text, GAME_WIDTH / 2, y + 18);
  ctx.restore();
}

function drawVignette() {
  const gradient = ctx.createRadialGradient(
    GAME_WIDTH / 2,
    GAME_HEIGHT / 2,
    GAME_HEIGHT * 0.2,
    GAME_WIDTH / 2,
    GAME_HEIGHT / 2,
    GAME_HEIGHT * 0.82
  );
  gradient.addColorStop(0, 'rgba(255,255,255,0)');
  gradient.addColorStop(1, 'rgba(91, 52, 244, 0.1)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
}

function render() {
  ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  ctx.save();
  if (shakeTimer > 0) {
    const mag = (shakeTimer / 20) * 5;
    ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
  }

  drawBackground();
  drawMap();
  drawPathHint();
  for (let i = 0; i < NOTES.length; i++) drawNote(i);
  drawPlayer();
  drawParticles();
  drawFloatingTexts();
  drawTopGuide();
  drawWatermark();
  drawVignette();
  ctx.restore();

  if (flashTimer > 0) {
    ctx.fillStyle = `rgba(91, 52, 244, ${(flashTimer / 8) * 0.12})`;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }
}

// ══════════════════════════════════════════════════════════════
// BUCLE
// ══════════════════════════════════════════════════════════════

function loop(timestamp) {
  if (!running) return;

  const dt = Math.min(timestamp - lastTimestamp, 50);
  lastTimestamp = timestamp;
  tick += dt / 16.67;

  timeAccum += dt;
  if (timeAccum >= 1000) {
    timeLeft -= 1;
    timeAccum -= 1000;
    refreshHUD();

    if (timeLeft <= 0) {
      showEnd(false);
      return;
    }
  }

  updatePlayer(dt);
  updateParticles();
  updateFeedback();
  if (flashTimer > 0) flashTimer--;
  if (shakeTimer > 0) shakeTimer--;
  if (wrongCooldown > 0) wrongCooldown--;

  render();
  requestAnimationFrame(loop);
}

// ══════════════════════════════════════════════════════════════
// CONTROL DE PARTIDA
// ══════════════════════════════════════════════════════════════

function startGame() {
  ensureAudio();
  titleEl.textContent = 'Nota a Nota';
  msgEl.textContent = 'Recorre el mapa y recoge las 7 notas musicales en el orden correcto antes de que el reloj haga su dramática aparición.';
  btnEl.textContent = 'Comenzar';
  initGame();
  overlayEl.classList.add('hidden');
  running = true;
  lastTimestamp = performance.now();
  canvas.focus({ preventScroll: true });
  showFeedback(`Empieza con ${NOTES[currentIdx]}.`, 'info');
  requestAnimationFrame(loop);
}

function showEnd(won) {
  if (!running && won !== true) return;
  running = false;
  updateBestScore();
  feedbackEl.classList.remove('show');

  if (won) {
    titleEl.textContent = '¡Completado!';
    msgEl.innerHTML = `Recogiste todas las notas en orden.<br><br>Puntuación final:<br><strong class="final-score">${formatScore(score)}</strong>`;
  } else {
    titleEl.textContent = 'Se acabó el tiempo';
    msgEl.innerHTML = `Alcanzaste ${currentIdx} de ${NOTES.length} notas.<br><br>Puntuación:<br><strong class="final-score">${formatScore(score)}</strong>`;
    playLoseSound();
  }

  btnEl.textContent = 'Jugar de nuevo';
  overlayEl.classList.remove('hidden');
}

function drawPreview() {
  initGame();
  tick = 35;
  render();
}

btnEl.addEventListener('click', startGame);

initGame();
drawPreview();
