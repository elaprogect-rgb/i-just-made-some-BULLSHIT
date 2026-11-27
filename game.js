/* ===== CONFIG (edit freely) ===== */
const BASE = "https://cdn.jsdelivr.net/gh/elaprogect-rgb/i-just-made-some-BULLSHIT/";
// If your repo's default branch isn't resolved, try ".../i-just-made-some-BULLSHIT@main/"

const FILES = {
  idle: "EGG_CharlesIdle (1).png",
  run: "EGG_CharlesRun (1).png",
  moveSfx: "Charles EGG move (1).mp3",
  normal: "EGG_Normal (1).png",
  rotten: "EGG_Rotten (1).png",
  gold: "EGG_Gold (1).png",
  collectSfx: "Egg get (1).mp3",
  lifeSfx: "Egg minigame life lost (1).mp3",
  heartFull: "EGG_HeartFull (1).png",
  heartBroken: "EGG_HeartBroken (1).png",
  glitchLoop: "GlitchLoop.ogg",
  gif1: "sprite-animation (1).gif",
  gif2: "sprite-animation.gif",
  endAudio: "Glitchdeathmusicend.ogg",
  endGif: "sprite-animation (2).gif",
};

const SCORE = { normal: 100, rotten: -200, gold: 500 }; // gold value TBD
const LIVES = 3;
const GOLD_CHANCE = 0.05, ROTTEN_CHANCE = 0.22;

const TIMING = {            // ms from the start of Game Over
  blackAndGif2: 500,
  levelFailed: 500,
  causeAndTip: 1500,        // 1s after LEVEL FAILED
  convert: 4500,            // lines convert in place into the closing set
  endAudioAndGif: 7000,
  backToMenu: 11000,
};

// Closing sets: each is [line1, line2]. Add more, one is picked at random.
const CLOSERS = [
  ["[IM HONESTLY SURPRISED, THAT YOU WENT ALL THIS WAY]", "[ALL THIS WAY JUST TO PLAY GAMES?]"],
  ["[YOU ARE DOING GREAT.]", "[DONT FAIL AGAIN.]"],
];

// Death reasons
const DEATHS = {
  missed: { cause: "FAILED TO CATCH EGGS", tip: "MOVE UNDER EVERY GOOD EGG BEFORE IT HITS THE FLOOR" },
  rotten: { cause: "ATE A ROTTEN EGG", tip: "LET THE ROTTEN ONES FALL. DON'T CATCH THEM" },
};

/* ===== SETUP ===== */
const url = k => BASE + encodeURIComponent(FILES[k]).replace(/%2F/g, "/");
const $ = id => document.getElementById(id);
const audio = {};
["moveSfx", "collectSfx", "lifeSfx", "glitchLoop", "endAudio"].forEach(k => {
  const a = new Audio(url(k)); a.preload = "auto"; audio[k] = a;
});
audio.glitchLoop.loop = true;
const play = (k, clone) => {
  const a = clone ? audio[k].cloneNode() : audio[k];
  a.currentTime = 0; a.play().catch(() => {});
};
const stop = k => { audio[k].pause(); audio[k].currentTime = 0; };
[FILES.idle, FILES.run, FILES.normal, FILES.rotten, FILES.gold, FILES.heartFull, FILES.heartBroken]
  .forEach(f => { new Image().src = BASE + encodeURIComponent(f); });

const el = { menu: $("menu"), play: $("play"), over: $("over"), field: $("field"), eggs: $("eggs"),
  player: $("player"), score: $("score"), lives: $("lives"), floaters: $("floaters") };
const show = which => ["menu", "play", "over"].forEach(n => el[n].classList.toggle("hidden", n !== which));

/* ===== STATE ===== */
let lane, score, lives, eggs, running, lastT, spawnT, speed, lastCause, runTimer, timers = [];

function renderLives() {
  el.lives.innerHTML = "";
  for (let i = 0; i < LIVES; i++) {
    const img = document.createElement("img");
    img.src = url(i < lives ? "heartFull" : "heartBroken");
    img.alt = i < lives ? "life" : "lost life";
    el.lives.appendChild(img);
  }
}
const setScore = n => { score = Math.max(0, n); el.score.textContent = score; };

function setLane(n) {
  lane = n;
  el.player.style.left = (n * 33.333 + 16.667) + "%";
}
function move(dir) {
  if (!running) return;
  setLane((lane + dir + 3) % 3);        // wraps around
  play("moveSfx", true);
  el.player.src = url("run");
  clearTimeout(runTimer);
  runTimer = setTimeout(() => (el.player.src = url("idle")), 180);
}

function floater(text, cls) {
  const f = document.createElement("div");
  f.className = "floater " + cls; f.textContent = text;
  f.style.left = (lane * 33.333 + 16.667) + "%";
  f.style.top = (el.field.clientHeight * 0.7) + "px";
  el.floaters.appendChild(f);
  setTimeout(() => f.remove(), 800);
}

function loseLife(cause) {
  lives--; lastCause = cause;
  play("lifeSfx", true);
  renderLives();
  el.field.parentElement.parentElement.classList.remove("shake");
  void el.field.offsetWidth;
  $("game").classList.add("shake");
  if (lives <= 0) gameOver();
}

/* ===== EGGS ===== */
function spawn() {
  const r = Math.random();
  const type = r < GOLD_CHANCE ? "gold" : r < GOLD_CHANCE + ROTTEN_CHANCE ? "rotten" : "normal";
  const node = document.createElement("div");
  node.className = "egg";
  const img = document.createElement("img"); img.src = url(type); img.alt = type;
  node.appendChild(img);
  const e = { type, lane: Math.floor(Math.random() * 3), y: -0.1, node };
  node.style.left = (e.lane * 33.333) + "%";
  el.eggs.appendChild(node);
  eggs.push(e);
}

function tick(t) {
  if (!running) return;
  const dt = Math.min((t - lastT) / 1000, 0.05); lastT = t;
  const H = el.field.clientHeight;
  speed = Math.min(0.28 + score / 9000, 0.75);            // field-heights per second
  spawnT -= dt;
  if (spawnT <= 0) { spawn(); spawnT = Math.max(0.35, 1.1 - score / 6000) * (0.8 + Math.random() * 0.5); }

  for (let i = eggs.length - 1; i >= 0 && running; i--) {
    const e = eggs[i];
    e.y += speed * dt;
    e.node.style.transform = `translateY(${e.y * H}px)`;
    const caught = e.lane === lane && e.y > 0.76 && e.y < 0.95;
    if (caught) {
      eggs.splice(i, 1); e.node.remove();
      if (e.type === "rotten") {
        setScore(score + SCORE.rotten); floater(SCORE.rotten, "bad"); loseLife("rotten");
      } else {
        setScore(score + SCORE[e.type]); floater("+" + SCORE[e.type], "good"); play("collectSfx", true);
      }
    } else if (e.y > 1.02) {
      eggs.splice(i, 1); e.node.remove();
      if (e.type === "normal") loseLife("missed");        // gold + rotten can fall freely
    }
  }
  if (running) requestAnimationFrame(tick);
}

function startGame() {
  timers.forEach(clearTimeout); timers = [];
  stop("glitchLoop"); stop("endAudio");
  eggs = []; el.eggs.innerHTML = ""; lives = LIVES; lastCause = "missed";
  setScore(0); renderLives(); setLane(1);
  el.player.src = url("idle");
  show("play");
  running = true; spawnT = 0.6; lastT = performance.now();
  requestAnimationFrame(tick);
}

/* ===== GAME OVER ===== */
const later = (fn, ms) => timers.push(setTimeout(fn, ms));

// Instant in-place conversion: keeps the shared start, swaps the rest in one frame.
function convert(p, text) {
  const old = p.textContent; let i = 0;
  while (i < old.length && i < text.length && old[i] === text[i]) i++;
  p.textContent = old.slice(0, i) + text.slice(i);
  p.classList.remove("flash"); void p.offsetWidth; p.classList.add("flash");
}

function gameOver() {
  running = false;
  const why = DEATHS[lastCause];
  const closer = CLOSERS[Math.floor(Math.random() * CLOSERS.length)];
  const l1 = $("l1"), l2 = $("l2");
  l1.textContent = ""; l2.textContent = "";
  $("gif1").src = url("gif1"); $("gif2").src = url("gif2"); $("gifEnd").src = url("endGif");
  ["black", "gif2", "gifEnd"].forEach(id => $(id).classList.add("hidden"));
  show("over");
  play("glitchLoop");

  later(() => { $("black").classList.remove("hidden"); $("gif2").classList.remove("hidden"); }, TIMING.blackAndGif2);
  later(() => { l1.textContent = "[LEVEL FAILED.]"; }, TIMING.levelFailed);
  later(() => {
    l1.textContent = `[CAUSE OF DEATH: ${why.cause}]`;
    l2.textContent = `[TIP: ${why.tip}]`;
  }, TIMING.causeAndTip);
  later(() => { convert(l1, closer[0]); convert(l2, closer[1]); }, TIMING.convert);
  later(() => {
    stop("glitchLoop"); play("endAudio");
    $("gifEnd").classList.remove("hidden");
  }, TIMING.endAudioAndGif);
  later(() => { stop("endAudio"); show("menu"); }, TIMING.backToMenu);
}

/* ===== INPUT ===== */
$("playBtn").addEventListener("click", startGame);           // user gesture unlocks audio
addEventListener("keydown", e => {
  if (e.repeat) return;
  if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") move(-1);
  if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") move(1);
});
let touchX = null;
el.play.addEventListener("touchstart", e => { touchX = e.touches[0].clientX; }, { passive: true });
el.play.addEventListener("touchend", e => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dx) > 30) move(dx > 0 ? 1 : -1);              // swipe
  else { const r = el.play.getBoundingClientRect(); move(e.changedTouches[0].clientX < r.left + r.width / 2 ? -1 : 1); } // tap half
  touchX = null;
});
el.play.addEventListener("mousedown", e => {
  const r = el.play.getBoundingClientRect(); move(e.clientX < r.left + r.width / 2 ? -1 : 1);
});

show("menu");
