// pomodoro.js

// --- DOM ELEMENTS ---
const ui = {
  ring: document.getElementById("pomo-progress-ring"),
  label: document.getElementById("pomo-phase-label"),
  timer: document.getElementById("pomo-timer-display"),
  btnToggle: document.getElementById("pomo-btn-toggle"),
  btnReset: document.getElementById("pomo-btn-reset"),
  inputFocus: document.getElementById("pomo-focus"),
  inputShort: document.getElementById("pomo-short"),
  inputLong: document.getElementById("pomo-long"),
  inputCycles: document.getElementById("pomo-cycles"),
};

// --- CONFIGURATION ---
const PHASES = {
  FOCUS: "FOCUS",
  SHORT: "SHORT BREAK",
  LONG: "LONG BREAK",
};

const RADIUS = 120;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Initialize Ring
ui.ring.style.strokeDasharray = `${CIRCUMFERENCE} ${CIRCUMFERENCE}`;
ui.ring.style.strokeDashoffset = CIRCUMFERENCE;

// --- STATE MANAGEMENT ---
let state = {
  isRunning: false,
  phase: PHASES.FOCUS,
  cycleCount: 0,
  startTime: null,
  duration: 0,
  elapsed: 0,
  animationFrame: null,
};

// --- HELPER FUNCTIONS ---

// Restored: Enforces both min and max limits
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function formatMMSS(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(r).padStart(2, "0");
  return `${mm}:${ss}`;
}

function render() {
  const remaining = Math.max(0, state.duration - state.elapsed);
  ui.timer.textContent = formatMMSS(remaining);

  const progress = state.duration > 0 ? state.elapsed / state.duration : 0;
  const offset = CIRCUMFERENCE - (progress * CIRCUMFERENCE);
  ui.ring.style.strokeDashoffset = offset;
}

function setPhase(newPhase, fromTransition = false) {
  state.phase = newPhase;
  state.elapsed = 0;
  state.startTime = performance.now();

  let minutes;
  if (newPhase === PHASES.FOCUS) {
    minutes = Number(ui.inputFocus.value) || 25;
  } else if (newPhase === PHASES.SHORT) {
    minutes = Number(ui.inputShort.value) || 5;
  } else {
    minutes = Number(ui.inputLong.value) || 15;
  }

  state.duration = minutes * 60; 
  ui.label.textContent = newPhase;

  if (!fromTransition) {
    ui.timer.textContent = formatMMSS(state.duration);
    render();
  }
}

function nextPhase() {
  if (state.phase === PHASES.FOCUS) {
    state.cycleCount += 1;
    const cyclesBeforeLong = Number(ui.inputCycles.value) || 4;

    if (state.cycleCount % cyclesBeforeLong === 0) {
      setPhase(PHASES.LONG, true);
    } else {
      setPhase(PHASES.SHORT, true);
    }
  } else {
    setPhase(PHASES.FOCUS, true);
  }
}

function loop(timestamp) {
  if (!state.isRunning) return;

  if (!state.startTime) state.startTime = timestamp;

  const deltaMs = timestamp - state.startTime;
  state.elapsed = deltaMs / 1000;

  if (state.elapsed >= state.duration) {
    state.elapsed = state.duration;
    render();
    nextPhase();
    state.startTime = performance.now(); 
  }

  render();
  state.animationFrame = requestAnimationFrame(loop);
}

// --- CONTROL FUNCTIONS ---

function start() {
  if (state.isRunning) return;
  if (!state.startTime) {
    if (state.elapsed === 0 && state.duration === 0) setPhase(PHASES.FOCUS);
  } else {
    state.startTime = performance.now() - (state.elapsed * 1000);
  }
  state.isRunning = true;
  ui.btnToggle.textContent = "Pause";
  state.animationFrame = requestAnimationFrame(loop);
}

function pause() {
  if (!state.isRunning) return;
  state.isRunning = false;
  ui.btnToggle.textContent = "Resume";
  cancelAnimationFrame(state.animationFrame);
}

function toggle() {
  if (state.isRunning) pause();
  else start();
}

function reset() {
  state.isRunning = false;
  cancelAnimationFrame(state.animationFrame);
  state.phase = PHASES.FOCUS;
  state.cycleCount = 0;
  state.startTime = null;
  state.duration = Number(ui.inputFocus.value || 25) * 60;
  state.elapsed = 0;

  ui.label.textContent = "READY";
  ui.timer.textContent = formatMMSS(state.duration);
  ui.btnToggle.textContent = "Start";
  ui.ring.style.strokeDashoffset = CIRCUMFERENCE;
}

// --- INPUT SYNC LOGIC (BIDIRECTIONAL) ---
// Standard Pomodoro Ratios: Focus (1) : Short (0.2) : Long (0.6)
// Limits capped at 9000 minutes

const LIMIT = 9000;

// 1. When FOCUS changes -> update Short (1/5) and Long (0.6)
ui.inputFocus.addEventListener("change", () => {
  const f = Number(ui.inputFocus.value) || 25;
  // Short is 1/5 of Focus (e.g. 25 -> 5)
  ui.inputShort.value = clamp(Math.round(f / 5), 1, LIMIT);
  // Long is 0.6 of Focus (e.g. 25 -> 15)
  ui.inputLong.value = clamp(Math.round(f * 0.6), 5, LIMIT);
  
  if (!state.isRunning) reset();
});

// 2. When SHORT changes -> update Focus (x5) and Long (x3)
ui.inputShort.addEventListener("change", () => {
  const s = Number(ui.inputShort.value) || 5;
  // Focus is 5x Short (e.g. 5 -> 25)
  ui.inputFocus.value = clamp(s * 5, 5, LIMIT);
  // Long is 3x Short (e.g. 5 -> 15)
  ui.inputLong.value = clamp(s * 3, 5, LIMIT);

  if (!state.isRunning) reset();
});

// 3. When LONG changes -> update Focus (x1.66) and Short (x0.33)
ui.inputLong.addEventListener("change", () => {
  const l = Number(ui.inputLong.value) || 15;
  // Focus is Long / 0.6 (approx x1.66)
  ui.inputFocus.value = clamp(Math.round(l / 0.6), 5, LIMIT);
  // Short is Long / 3
  ui.inputShort.value = clamp(Math.round(l / 3), 1, LIMIT);

  if (!state.isRunning) reset();
});

// --- EVENT LISTENERS ---
ui.btnToggle.addEventListener("click", toggle);
ui.btnReset.addEventListener("click", reset);

document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT") return;
  if (e.code === "Space") {
    e.preventDefault();
    toggle();
  }
  if (e.code === "KeyR") reset();
});

// --- INITIALIZATION ---
ui.inputFocus.dispatchEvent(new Event('change'));
reset();
