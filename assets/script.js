const armButton = document.getElementById("armButton");
const defuseButton = document.getElementById("defuseButton");
const timerDisplay = document.getElementById("timerDisplay");
const beep = document.getElementById("beep");
const explosion = document.getElementById("explosion");
const planted = document.getElementById("planted");
const defused = document.getElementById("defused");
const holdTimeInput = document.getElementById("holdTimeInput");
const countdownInput = document.getElementById("countdownInput");
const progressBar = document.querySelector(".progress-bar");
const progress = document.getElementById("progress");
const body = document.body;

const settingsToggle = document.getElementById("settingsToggle");
const settingsPanel = document.getElementById("settingsPanel");
const fullscreenButton = document.getElementById("fullscreenButton");

let holdInterval;
let countdownTimer;
let beepTimer;
let countdown = 0;

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
  armButton.classList.remove("hidden");
  defuseButton.classList.add("hidden");
}

function showDefuseHideArm() {
  armButton.classList.add("hidden");
  defuseButton.classList.remove("hidden");
}

function setInitialState() {
  holdTimeInput.disabled = false;
  countdownInput.disabled = false;
  showArmHideDefuse();
}

/* Countdown & Sounds */

function startCountdown() {
  holdTimeInput.disabled = true;
  countdownInput.disabled = true;
  reset();
  countdown = parseInt(countdownInput.value, 10);
  timerDisplay.textContent = countdown;

  countdownTimer = setInterval(() => {
    countdown--;
    timerDisplay.textContent = countdown;
    if (countdown <= 10) {
      timerDisplay.classList.add("warning");
    }
    if (countdown <= 5 && countdown > 0) {
      flashBackground();
    }
    if (countdown <= 0) {
      clearInterval(countdownTimer);
      clearTimeout(beepTimer);
      timerDisplay.textContent = "💥 BOOM!";
      explosion.currentTime = 0;
      explosion.play();
      body.classList.add("explosion");
      vibrate([300, 100, 300]);
      setInitialState();
      setTimeout(() => {
        body.classList.remove("explosion");
      }, 600);
    }
  }, 1000);

  // planted.mp3 und Countdown-Beep gleichzeitig starten
  planted.currentTime = 0;
  planted.play();
  adaptiveBeep();
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
    beep.play();
    const delay = getBeepDelay(countdown);
    beepTimer = setTimeout(beepLoop, delay);
  }

  beepLoop();
}

function flashBackground() {
  body.classList.add("flash");
  setTimeout(() => body.classList.remove("flash"), 100);
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
    const duration = parseInt(holdTimeInput.value, 10) * 1000;
    let holdStart = Date.now();
    progressBar.style.display = "block";
    progress.style.width = "0%";
    holdInterval = setInterval(() => {
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
    progress.style.width = "0%";
    progressBar.style.display = "none";
  };

  btn.addEventListener("mousedown", startHold);
  btn.addEventListener("mouseup", cancelHold);
  btn.addEventListener("mouseleave", cancelHold);
  btn.addEventListener("touchstart", startHold);
  btn.addEventListener("touchend", cancelHold);
  btn.addEventListener("touchcancel", cancelHold);
}

/* Button-Aktionen */

holdButton(armButton, () => {
  vibrate(200);
  showDefuseHideArm();
  startCountdown();
});

holdButton(defuseButton, () => {
  clearInterval(countdownTimer);
  clearTimeout(beepTimer);
  timerDisplay.textContent = "✅ Entschärft!";
  timerDisplay.classList.remove("warning");
  body.classList.remove("flash");
  defused.currentTime = 0;
  defused.play();
  vibrate([100, 50, 100]);
  setInitialState();
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

/* Initialer Zustand beim Laden */

setInitialState();
