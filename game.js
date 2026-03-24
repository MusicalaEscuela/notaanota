/* ───────────────────────────────────────────────────────────────
   NOTA A NOTA — game.js
   Movimiento estilo Pac-Man + recolección de notas en orden
─────────────────────────────────────────────────────────────── */
'use strict';

// ══════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ══════════════════════════════════════════════════════════════

const TILE   = 40;          // tamaño de cada celda en px
const COLS   = 20;          // columnas del mapa
const ROWS   = 15;          // filas del mapa
const SPEED  = 3;           // píxeles por frame
const TIME_LIMIT = 60;      // segundos para completar el nivel

const NOTES       = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NOTE_COLORS = ['#ff6b6b', '#ff9f43', '#ffd32a', '#51cf66', '#4dabf7', '#cc5de8', '#f783ac'];

// Posiciones [col, row] de cada nota en el mapa
// Distribuidas en esquinas + bordes + centro para un recorrido rico
const NOTE_POSITIONS = [
  [1,  1 ],  // C — esquina superior-izquierda
  [18, 1 ],  // D — esquina superior-derecha
  [18, 13],  // E — esquina inferior-derecha
  [1,  13],  // F — esquina inferior-izquierda
  [9,  1 ],  // G — centro-superior
  [9,  13],  // A — centro-inferior
  [9,  7 ],  // B — centro exacto del mapa
];

// 0 = pared  |  1 = camino libre
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

// ══════════════════════════════════════════════════════════════
// CANVAS
// ══════════════════════════════════════════════════════════════

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
canvas.width  = COLS * TILE;   // 800 px
canvas.height = ROWS * TILE;   // 600 px

// ══════════════════════════════════════════════════════════════
// ESTADO DEL JUEGO
// ══════════════════════════════════════════════════════════════

let running       = false;
let score         = 0;
let timeLeft      = TIME_LIMIT;
let currentIdx    = 0;          // índice de la nota a recolectar ahora
let collected     = [];         // array de booleanos por nota
let particles     = [];
let tick          = 0;          // frames desde inicio
let flashTimer    = 0;          // > 0 → pantalla parpadea
let shakeTimer    = 0;          // > 0 → cámara tiembla
let lastTimestamp = 0;
let timeAccum     = 0;          // acumulador para el temporizador (ms)

// ── Jugador ──────────────────────────────────────────────────
const player = {
  col: 4, row: 7,                       // celda actual
  px:  4 * TILE + TILE / 2,             // posición en píxeles (centro)
  py:  7 * TILE + TILE / 2,
  targetCol: 4, targetRow: 7,           // celda destino (movimiento)
  dir:  { x: 0, y: 0 },                 // dirección actual
  next: { x: 0, y: 0 },                 // próxima dirección (cola)
  moving: false,
  facing: 1,                            // 1=derecha, -1=izquierda
};

// ══════════════════════════════════════════════════════════════
// INPUT
// ══════════════════════════════════════════════════════════════

const DIR_KEYS = {
  ArrowLeft:  { x:-1, y: 0 }, a: { x:-1, y: 0 }, A: { x:-1, y: 0 },
  ArrowRight: { x: 1, y: 0 }, d: { x: 1, y: 0 }, D: { x: 1, y: 0 },
  ArrowUp:    { x: 0, y:-1 }, w: { x: 0, y:-1 }, W: { x: 0, y:-1 },
  ArrowDown:  { x: 0, y: 1 }, s: { x: 0, y: 1 }, S: { x: 0, y: 1 },
};

document.addEventListener('keydown', e => {
  const d = DIR_KEYS[e.key];
  if (!d) return;
  if (running) e.preventDefault();
  player.next = { ...d };
  if (d.x !== 0) player.facing = d.x;
});

// ══════════════════════════════════════════════════════════════
// UTILIDADES
// ══════════════════════════════════════════════════════════════

function isOpen(c, r) {
  return c >= 0 && c < COLS && r >= 0 && r < ROWS && MAP[r][c] === 1;
}

function resetPlayer() {
  player.col = player.targetCol = 4;
  player.row = player.targetRow = 7;
  player.px     = 4 * TILE + TILE / 2;
  player.py     = 7 * TILE + TILE / 2;
  player.dir    = { x: 0, y: 0 };
  player.next   = { x: 0, y: 0 };
  player.moving = false;
  player.facing = 1;
}

function initGame() {
  score      = 0;
  timeLeft   = TIME_LIMIT;
  currentIdx = 0;
  collected  = new Array(NOTES.length).fill(false);
  particles  = [];
  tick       = 0;
  flashTimer = 0;
  shakeTimer = 0;
  timeAccum  = 0;
  resetPlayer();
  refreshHUD();
}

// ══════════════════════════════════════════════════════════════
// MOVIMIENTO ESTILO PAC-MAN
// ══════════════════════════════════════════════════════════════

/**
 * Intenta iniciar un movimiento.
 * Prioridad: dirección nueva (next) → dirección actual (dir)
 */
function tryMove() {
  for (const d of [player.next, player.dir]) {
    if (d.x === 0 && d.y === 0) continue;
    const nc = player.col + d.x;
    const nr = player.row + d.y;
    if (isOpen(nc, nr)) {
      player.dir       = { ...d };
      player.targetCol = nc;
      player.targetRow = nr;
      player.moving    = true;
      return;
    }
  }
  player.moving = false;   // chocó con pared en ambas direcciones
}

function updatePlayer() {
  if (!player.moving) { tryMove(); return; }

  // Posición objetivo en píxeles (centro de la celda destino)
  const tpx  = player.targetCol * TILE + TILE / 2;
  const tpy  = player.targetRow * TILE + TILE / 2;
  const dx   = tpx - player.px;
  const dy   = tpy - player.py;
  const dist = Math.hypot(dx, dy);

  if (dist <= SPEED) {
    // Llegó a la celda destino — ajustar exacto
    player.px  = tpx;  player.py  = tpy;
    player.col = player.targetCol;
    player.row = player.targetRow;
    player.moving = false;
    checkCollection();
    tryMove();            // encadenar movimiento sin pausa
  } else {
    player.px += (dx / dist) * SPEED;
    player.py += (dy / dist) * SPEED;
  }
}

// ══════════════════════════════════════════════════════════════
// RECOLECCIÓN DE NOTAS
// ══════════════════════════════════════════════════════════════

function checkCollection() {
  if (currentIdx >= NOTES.length) return;

  const [nc, nr] = NOTE_POSITIONS[currentIdx];
  if (player.col === nc && player.row === nr) {
    // ✓ Nota correcta recogida
    collected[currentIdx] = true;
    currentIdx++;
    score += 150;
    spawnBurst(player.px, player.py, NOTE_COLORS[currentIdx - 1], 20);
    refreshHUD();

    if (currentIdx >= NOTES.length) {
      // ¡Completado! Bonus de tiempo
      score += timeLeft * 12;
      refreshHUD();
      setTimeout(() => showEnd(true), 700);
    }
  }
}

// ══════════════════════════════════════════════════════════════
// PARTÍCULAS
// ══════════════════════════════════════════════════════════════

function spawnBurst(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i / n) + Math.random() * 0.5;
    const speed = 1.5 + Math.random() * 3.5;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1.2,
      color,
      size: 3 + Math.random() * 5,
      life: 1,
    });
  }
}

function updateParticles() {
  particles = particles.filter(p => {
    p.x  += p.vx;
    p.y  += p.vy;
    p.vy += 0.14;          // gravedad
    p.life -= 0.022;
    return p.life > 0;
  });
}

// ══════════════════════════════════════════════════════════════
// HUD (DOM)
// ══════════════════════════════════════════════════════════════

function refreshHUD() {
  // Puntos
  document.getElementById('hud-score').textContent =
    String(score).padStart(5, '0');

  // Tiempo
  const timeEl = document.getElementById('hud-time');
  timeEl.textContent = String(Math.max(0, Math.ceil(timeLeft)));
  timeEl.classList.toggle('urgent', timeLeft <= 10);

  // Chips de secuencia
  const seqEl = document.getElementById('hud-seq');
  seqEl.innerHTML = NOTES.map((n, i) => {
    const cls = collected[i] ? 'note-chip done'
              : i === currentIdx ? 'note-chip active'
              : 'note-chip';
    const sep = i < NOTES.length - 1
      ? `<span class="hud-arrow">›</span>` : '';
    return `<span class="${cls}" style="color:${NOTE_COLORS[i]}">${n}</span>${sep}`;
  }).join('');
}

// ══════════════════════════════════════════════════════════════
// DIBUJO
// ══════════════════════════════════════════════════════════════

// ── Mapa ──────────────────────────────────────────────────────
function drawMap() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = c * TILE, y = r * TILE;

      if (MAP[r][c] === 0) {
        // Pared — efecto 3D con capas
        ctx.fillStyle = '#0a0a24';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#12124a';
        ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
        ctx.fillStyle = '#1a1a58';     // bisel superior-izquierdo
        ctx.fillRect(x + 2, y + 2, TILE - 4, 3);
        ctx.fillRect(x + 2, y + 2, 3, TILE - 4);
        ctx.fillStyle = '#0c0c36';     // bisel inferior-derecho
        ctx.fillRect(x + 2, y + TILE - 5, TILE - 4, 3);
        ctx.fillRect(x + TILE - 5, y + 2, 3, TILE - 4);
      } else {
        // Suelo — muy oscuro con punto tenue en el centro
        ctx.fillStyle = '#07071c';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = 'rgba(30, 30, 80, 0.35)';
        ctx.fillRect(x + TILE / 2 - 1, y + TILE / 2 - 1, 2, 2);
      }
    }
  }
}

// ── Nota musical ──────────────────────────────────────────────
function drawNote(idx) {
  if (collected[idx]) return;

  const [col, row] = NOTE_POSITIONS[idx];
  const cx    = col * TILE + TILE / 2;
  const cy    = row * TILE + TILE / 2;
  const color = NOTE_COLORS[idx];
  const label = NOTES[idx];
  const isTarget = (idx === currentIdx);

  // Bob suave (diferente fase por índice)
  const bob = Math.sin(tick * 0.055 + idx * 1.3) * 3;

  ctx.save();
  ctx.translate(cx, cy + bob);

  // Anillo pulsante en la nota objetivo
  if (isTarget) {
    const pulse = 0.5 + 0.5 * Math.sin(tick * 0.1);
    ctx.globalAlpha   = 0.2 + 0.25 * pulse;
    ctx.strokeStyle   = color;
    ctx.lineWidth     = 2;
    ctx.shadowColor   = color;
    ctx.shadowBlur    = 8;
    ctx.beginPath();
    ctx.arc(0, 0, 17 + pulse * 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.shadowColor = color;
  ctx.shadowBlur  = isTarget ? 20 : 9;

  // ── Cabeza de la nota (elipse inclinada) ──
  ctx.fillStyle = color;
  ctx.save();
  ctx.translate(-2, 6);
  ctx.rotate(-0.4);
  ctx.beginPath();
  ctx.ellipse(0, 0, 7, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ── Plica (tallo vertical) ──
  ctx.strokeStyle = color;
  ctx.lineWidth   = 2.5;
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(5,   5);
  ctx.lineTo(5, -11);
  ctx.stroke();

  // ── Corchete ──
  ctx.beginPath();
  ctx.moveTo(5, -11);
  ctx.quadraticCurveTo(14, -7, 9, -2);
  ctx.stroke();

  // ── Letra de la nota ──
  ctx.shadowBlur     = 0;
  ctx.fillStyle      = isTarget ? '#ffffff' : 'rgba(255,255,255,0.55)';
  ctx.font           = `bold 9px 'Press Start 2P', monospace`;
  ctx.textAlign      = 'center';
  ctx.textBaseline   = 'middle';
  ctx.fillText(label, 0, 18);

  ctx.restore();
}

// ── Jugador (muñequito) ────────────────────────────────────────
function drawPlayer() {
  // Parpadeo durante estado de carga / inicio
  if (tick < 120 && Math.floor(tick / 8) % 2 === 1) return;

  const { px, py, moving, facing } = player;
  const s   = 10;
  const leg = moving ? Math.sin(tick * 0.28) * 0.48 : 0;
  const arm = moving ? Math.sin(tick * 0.28 + 1.2) * 0.3 : 0;

  ctx.save();
  ctx.translate(px, py);
  if (facing < 0) ctx.scale(-1, 1);      // espejear según dirección

  ctx.shadowColor = '#00f5ff';
  ctx.shadowBlur  = 18;
  ctx.fillStyle   = '#00f5ff';
  ctx.strokeStyle = '#00f5ff';
  ctx.lineWidth   = 2.5;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';

  // Cabeza
  ctx.beginPath();
  ctx.arc(0, -s * 1.3, s * 0.58, 0, Math.PI * 2);
  ctx.fill();

  // Ojos
  ctx.shadowBlur = 0;
  ctx.fillStyle  = '#07071c';
  ctx.beginPath();
  ctx.arc(-2.5, -s * 1.36, 1.6, 0, Math.PI * 2);
  ctx.arc( 3.2, -s * 1.36, 1.6, 0, Math.PI * 2);
  ctx.fill();

  // Brillo pupila
  ctx.shadowColor = '#00f5ff';
  ctx.shadowBlur  = 14;
  ctx.fillStyle   = '#00f5ff';
  ctx.strokeStyle = '#00f5ff';

  // Cuerpo
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.72);
  ctx.lineTo(0,  s * 0.45);
  ctx.stroke();

  // Brazos (animados)
  ctx.beginPath();
  ctx.moveTo(-s * 0.85 + arm * s, -s * 0.18);
  ctx.lineTo( s * 0.85 - arm * s, -s * 0.18);
  ctx.stroke();

  // Piernas (animadas)
  ctx.beginPath();
  ctx.moveTo(0,  s * 0.45);
  ctx.lineTo(-s * 0.52 + leg * s * 0.6, s * 1.3);
  ctx.moveTo(0,  s * 0.45);
  ctx.lineTo( s * 0.52 - leg * s * 0.6, s * 1.3);
  ctx.stroke();

  ctx.restore();
}

// ── Partículas ────────────────────────────────────────────────
function drawParticles() {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle   = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur  = 8;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ── Viñeta ────────────────────────────────────────────────────
function drawVignette() {
  const g = ctx.createRadialGradient(
    canvas.width / 2, canvas.height / 2, canvas.height * 0.28,
    canvas.width / 2, canvas.height / 2, canvas.height * 0.82
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(4,4,20,0.6)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// ══════════════════════════════════════════════════════════════
// BUCLE PRINCIPAL
// ══════════════════════════════════════════════════════════════

function loop(timestamp) {
  if (!running) return;

  const dt = Math.min(timestamp - lastTimestamp, 50);  // máx 50 ms (tab inactivo)
  lastTimestamp = timestamp;

  tick++;

  // ── Temporizador ──
  timeAccum += dt;
  if (timeAccum >= 1000) {
    timeLeft  -= 1;
    timeAccum -= 1000;
    refreshHUD();
    if (timeLeft <= 0) { showEnd(false); return; }
  }

  // ── Lógica ──
  updatePlayer();
  updateParticles();
  if (flashTimer > 0) flashTimer--;
  if (shakeTimer > 0) shakeTimer--;

  // ── Render ──
  ctx.fillStyle = '#07071c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  if (shakeTimer > 0) {
    const mag = (shakeTimer / 25) * 4;
    ctx.translate(
      (Math.random() - 0.5) * mag,
      (Math.random() - 0.5) * mag
    );
  }

  drawMap();

  for (let i = 0; i < NOTES.length; i++) drawNote(i);

  drawPlayer();
  drawParticles();
  drawVignette();
  ctx.restore();

  // Flash de pantalla (al recoger nota correcta con mucho tiempo = flash blanco breve)
  if (flashTimer > 0) {
    ctx.fillStyle = `rgba(0,245,255,${(flashTimer / 10) * 0.18})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  requestAnimationFrame(loop);
}

// ══════════════════════════════════════════════════════════════
// CONTROL DE PARTIDA
// ══════════════════════════════════════════════════════════════

function startGame() {
  initGame();
  document.getElementById('overlay').classList.add('hidden');
  running = true;
  lastTimestamp = performance.now();
  requestAnimationFrame(loop);
}

function showEnd(won) {
  running = false;
  const titleEl = document.getElementById('ov-title');
  const msgEl   = document.getElementById('ov-msg');
  const btnEl   = document.getElementById('ov-btn');

  if (won) {
    titleEl.textContent  = '¡COMPLETADO!';
    titleEl.style.color  = '#ffd700';
    titleEl.style.textShadow = '0 0 30px #ffd700, 0 0 60px rgba(255,215,0,0.3)';
    msgEl.innerHTML =
      `¡Todas las notas en orden!<br><br>Puntuación final:<br><span style="color:#ffd700;font-size:14px">${String(score).padStart(5,'0')}</span>`;
  } else {
    titleEl.textContent  = 'TIEMPO';
    titleEl.style.color  = '#ff6b6b';
    titleEl.style.textShadow = '0 0 30px #ff6b6b';
    msgEl.innerHTML =
      `Se acabó el tiempo.<br>Notas recogidas: ${currentIdx}/7<br><br>Puntuación:<br><span style="color:#ff6b6b;font-size:14px">${String(score).padStart(5,'0')}</span>`;
  }

  btnEl.textContent = 'JUGAR DE NUEVO';
  document.getElementById('overlay').classList.remove('hidden');
}

// ══════════════════════════════════════════════════════════════
// INIT — dibujo estático antes de empezar
// ══════════════════════════════════════════════════════════════

document.getElementById('ov-btn').addEventListener('click', startGame);

// Render de preview (overlay visible por encima)
initGame();
ctx.fillStyle = '#07071c';
ctx.fillRect(0, 0, canvas.width, canvas.height);
drawMap();
for (let i = 0; i < NOTES.length; i++) drawNote(i);
drawVignette();
