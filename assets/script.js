const armButton = document.getElementById("armButton");
const defuseButton = document.getElementById("defuseButton");
const timerDisplay = document.getElementById("timerDisplay");
const beep = document.getElementById("beep");
const explosion = document.getElementById("explosion");
const planted = document.getElementById("planted");
const defused = document.getElementById("defused");
const holdTimeInput = document.getElementById("holdTimeInput");
const defuseHoldTimeInput = document.getElementById("defuseHoldTimeInput");
const countdownInput = document.getElementById("countdownInput");
const progressBar = document.querySelector(".progress-bar");
const progress = document.getElementById("progress");
const body = document.body;
const settingsToggle = document.getElementById("settingsToggle");
const settingsPanel = document.getElementById("settingsPanel");
const fullscreenButton = document.getElementById("fullscreenButton");
const resetButton = document.getElementById("resetButton");

let holdInterval;
let animateInterval;
let countdownTimer;
let beepTimer;
let countdown = 0;
let bombActive = false;

/* Persistenz des laufenden Countdowns (reload-sicher)
   Es wird nur der aktive Lauf gespeichert: der absolute Endzeitpunkt.
   So kann nach einem versehentlichen Reload exakt weitergemacht werden. */

const STORAGE_KEY = "nerfBombState";

function saveBombState(endTime) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ endTime }));
  } catch (e) {
    /* localStorage nicht verfügbar – Spiel läuft trotzdem weiter */
  }
}

function loadBombState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch (e) {
    return null;
  }
}

function clearBombState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    /* ignorieren */
  }
}

/* Hilfsfunktionen */

function vibrate(pattern) {
  if (navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

function reset() {
  clearInterval(countdownTimer);
  clearTimeout(beepTimer);
  timerDisplay.textContent = "";
  timerDisplay.classList.remove("warning");
  body.classList.remove("flash");
  body.classList.remove("explosion");
}

function showArmHideDefuse() {
  document.getElementById("armPanel").classList.remove("hidden");
  document.getElementById("defusePanel").classList.add("hidden");
}

function showDefuseHideArm() {
  document.getElementById("armPanel").classList.add("hidden");
  document.getElementById("defusePanel").classList.remove("hidden");
}

function setInitialState() {
  holdTimeInput.disabled = false;
  countdownInput.disabled = false;
  showArmHideDefuse();
}

/* Countdown & Sounds */

function startCountdown(resumeEndTime) {
  holdTimeInput.disabled = true;
  countdownInput.disabled = true;
  bombActive = true;
  reset();

  const isResume = typeof resumeEndTime === "number";
  let endTime;
  if (isResume) {
    endTime = resumeEndTime;
  } else {
    const length = parseInt(countdownInput.value, 10);
    endTime = Date.now() + length * 1000;
    saveBombState(endTime);
  }

  // Restzeit wird aus dem absoluten Endzeitpunkt berechnet, damit ein Reload
  // (oder das Drosseln des Tabs im Hintergrund) den Countdown nicht verfälscht.
  function remainingSeconds() {
    return Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
  }

  countdown = remainingSeconds();
  timerDisplay.textContent = countdown;
  if (countdown <= 10) {
    timerDisplay.classList.add("warning");
  }

  countdownTimer = setInterval(() => {
    countdown = remainingSeconds();
    timerDisplay.textContent = countdown;
    if (countdown <= 10) {
      timerDisplay.classList.add("warning");
    }
    if (countdown <= 5 && countdown > 0) {
      flashBackground();
    }
    if (countdown <= 0) {
      detonate();
    }
  }, 1000);

  if (!isResume) {
    planted.currentTime = 0;
    planted.play().catch(() => {});
  }
  adaptiveBeep();
}

function detonate() {
  bombActive = false;
  clearInterval(countdownTimer);
  clearTimeout(beepTimer);
  clearBombState();
  countdown = 0;
  timerDisplay.textContent = "💥 BOOM!";
  timerDisplay.classList.add("warning");
  explosion.currentTime = 0;
  explosion.play().catch(() => {});
  setTimeout(() => vibrate([300, 100, 300, 100, 300]), 5000);
  body.classList.add("explosion");
  setTimeout(() => body.classList.remove("explosion"), 600);
  document.getElementById("defusePanel").classList.add("hidden");
  resetButton.classList.remove("hidden");
}

function adaptiveBeep() {
  function getBeepDelay(t) {
    if (t <= 5) return 200;
    if (t <= 10) return 500;
    if (t <= 20) return 1000;
    return 3000;
  }

  function beepLoop() {
    if (countdown <= 0) return;
    beep.currentTime = 0;
    beep.play().catch(() => {});
    const delay = getBeepDelay(countdown);
    beepTimer = setTimeout(beepLoop, delay);
  }

  beepLoop();
}

function flashBackground() {
  body.classList.add("flash");
  setTimeout(() => body.classList.remove("flash"), 100);
}

/* Numpad-Animation */

function animateNumpad(displayId, codes) {
  const display = document.getElementById(displayId);
  if (!display) return;
  const blanks = ["_", "_", "_", "_", "_"];
  let i = 0;
  display.textContent = "_ _ _ _ _";
  animateInterval = setInterval(() => {
    if (i >= codes.length) {
      clearInterval(animateInterval);
      return;
    }
    blanks[i] = codes[i];
    display.textContent = blanks.join(" ");
    i++;
  }, 300);
}

/* Halte-Logik für Buttons */

function holdButton(btn, callback) {
  const onFirstTouch = () => {
    beep.currentTime = 0;
    beep.play();
    vibrate(50);
  };

  const startHold = () => {
    onFirstTouch();
    if (btn === armButton) animateNumpad("numpadDisplay", ["4","2","7","1","9"]);
    if (btn === defuseButton) animateNumpad("defuseDisplay", ["3","8","5","2","1"]);
    const holdInput = btn === defuseButton ? defuseHoldTimeInput : holdTimeInput;
    const duration = parseInt(holdInput.value, 10) * 1000;
    let holdStart = Date.now();
    progressBar.style.display = "block";
    progress.style.width = "0%";
    holdInterval = setInterval(() => {
      if (!bombActive && btn === defuseButton) {
        clearInterval(holdInterval);
        progressBar.style.display = "none";
        progress.style.width = "0%";
        return;
      }
      const held = Date.now() - holdStart;
      const percent = Math.min(100, (held / duration) * 100);
      progress.style.width = percent + "%";
      if (held >= duration) {
        clearInterval(holdInterval);
        progressBar.style.display = "none";
        callback();
      }
    }, 50);
  };

  const cancelHold = () => {
    clearInterval(holdInterval);
    clearInterval(animateInterval);
    document.getElementById("numpadDisplay").textContent = "_ _ _ _ _";
    document.getElementById("defuseDisplay").textContent = "_ _ _ _ _";
    progress.style.width = "0%";
    progressBar.style.display = "none";
  };

  btn.addEventListener("mousedown", startHold);
  btn.addEventListener("mouseup", cancelHold);
  btn.addEventListener("mouseleave", cancelHold);
  btn.addEventListener("touchstart", startHold);
  btn.addEventListener("touchend", cancelHold);
  btn.addEventListener("touchcancel", cancelHold);
  btn.addEventListener("contextmenu", (e) => e.preventDefault());
}

/* Button-Aktionen */

holdButton(armButton, () => {
  vibrate(200);
  showDefuseHideArm();
  startCountdown();
});

holdButton(defuseButton, () => {
  if (!bombActive) return;
  clearInterval(countdownTimer);
  clearTimeout(beepTimer);
  timerDisplay.classList.remove("warning");
  body.classList.remove("flash");
  bombActive = false;
  clearBombState();
  timerDisplay.textContent = "✅ Entschärft!";
  defused.currentTime = 0;
  defused.play().catch(() => {});
  vibrate([100, 50, 100]);
  document.getElementById("defusePanel").classList.add("hidden");
  resetButton.classList.remove("hidden");
});

/* Einstellungen laden */
if (localStorage.getItem("holdTime")) {
  holdTimeInput.value = localStorage.getItem("holdTime");
}
if (localStorage.getItem("defuseHoldTime")) {
  defuseHoldTimeInput.value = localStorage.getItem("defuseHoldTime");
}
if (localStorage.getItem("countdownTime")) {
  countdownInput.value = localStorage.getItem("countdownTime");
}

/* Einstellungen speichern bei Änderung */
holdTimeInput.addEventListener("input", () => {
  localStorage.setItem("holdTime", holdTimeInput.value);
});

defuseHoldTimeInput.addEventListener("input", () => {
  localStorage.setItem("defuseHoldTime", defuseHoldTimeInput.value);
});

countdownInput.addEventListener("input", () => {
  localStorage.setItem("countdownTime", countdownInput.value);
});

/* Einstellungen ein-/ausblenden */
settingsToggle.addEventListener("click", () => {
  settingsPanel.classList.toggle("hidden");
});

/* Vollbildmodus */
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
}

fullscreenButton.addEventListener("click", toggleFullscreen);

resetButton.addEventListener("click", () => {
  reset();
  clearBombState();
  timerDisplay.classList.remove("warning");
  resetButton.classList.add("hidden");
  showArmHideDefuse();
  holdTimeInput.disabled = false;
  countdownInput.disabled = false;
  document.getElementById("numpadDisplay").textContent = "_ _ _ _ _";
  document.getElementById("defuseDisplay").textContent = "_ _ _ _ _";
});

/* Laufenden Countdown nach Reload wiederherstellen */
function restoreBombState() {
  const state = loadBombState();
  if (!state || typeof state.endTime !== "number") return;

  if (state.endTime > Date.now()) {
    // Bombe läuft noch -> nahtlos weiterführen
    showDefuseHideArm();
    holdTimeInput.disabled = true;
    countdownInput.disabled = true;
    startCountdown(state.endTime);
  } else {
    // Zeit ist während der Abwesenheit abgelaufen -> Stand verwerfen
    clearBombState();
  }
}

/* Initialer Zustand beim Laden */
setInitialState();
restoreBombState();

/* Service Worker für Offline-Betrieb registrieren.
   Sorgt dafür, dass die App (inkl. aller Sounds) auch ohne Netz
   und nach einem Reload bei Verbindungsabbruch vollständig läuft. */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
