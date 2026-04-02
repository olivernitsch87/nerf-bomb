document.getElementById("debug").textContent = "Script geladen! defuseButton: " + (document.getElementById("defuseButton") ? "OK" : "NULL");
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
const resetButton = document.getElementById("resetButton");

let holdInterval;
let animateInterval;
let defuseAnim = null;
let defuseShake = null;
let countdownTimer;
let beepTimer;
let countdown = 0;
let bombActive = false;

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
  document.getElementById("armPanel").classList.remove("hidden");
  document.getElementById("defusePanel").classList.add("hidden");
  defuseButton.classList.add("hidden");
}

function showDefuseHideArm() {
  armButton.classList.add("hidden");
  document.getElementById("armPanel").classList.add("hidden");
  document.getElementById("defusePanel").classList.remove("hidden");
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
  bombActive = true;
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
      bombActive = false;
      clearInterval(countdownTimer);
      clearTimeout(beepTimer);
      timerDisplay.textContent = "💥 BOOM!";
      timerDisplay.classList.add("warning");
      explosion.currentTime = 0;
      explosion.play();
      setTimeout(() => vibrate([300, 100, 300, 100, 300]), 5000);
      body.classList.add("explosion");
      setTimeout(() => body.classList.remove("explosion"), 600);
      document.getElementById("defusePanel").classList.add("hidden");
      resetButton.classList.remove("hidden");
    }
  }, 1000);

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

/* Numpad-Animation */

function animateNumpad() {
  const display = document.getElementById("numpadDisplay");
  if (!display) return;
  const codes = ["4", "2", "7", "1", "9"];
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

/* Defuse-Animation */

function resetDefuseAnimation() {
  clearInterval(defuseAnim);
  clearInterval(defuseShake);
  const pliers = document.getElementById("pliers");
  const redLeft = document.getElementById("redLeft");
  const redRight = document.getElementById("redRight");
  const blueLeft = document.getElementById("blueLeft");
  const blueRight = document.getElementById("blueRight");
  const cutRedMask = document.getElementById("cutRedMask");
  const cutBlueMask = document.getElementById("cutBlueMask");
  if (!pliers) return;
  pliers.setAttribute("transform", "translate(290, 105)");
  redLeft.setAttribute("x2", "140"); redRight.setAttribute("x1", "140");
  blueLeft.setAttribute("x2", "185"); blueRight.setAttribute("x1", "185");
  redLeft.setAttribute("stroke", "#e53935"); redRight.setAttribute("stroke", "#e53935");
  blueLeft.setAttribute("stroke", "#1e88e5"); blueRight.setAttribute("stroke", "#1e88e5");
  cutRedMask.setAttribute("opacity", "0");
  cutBlueMask.setAttribute("opacity", "0");
}

function startDefuseAnimation(onComplete) {
  resetDefuseAnimation();
  const pliers = document.getElementById("pliers");
  const redLeft = document.getElementById("redLeft");
  const redRight = document.getElementById("redRight");
  const blueLeft = document.getElementById("blueLeft");
  const blueRight = document.getElementById("blueRight");
  const cutRedMask = document.getElementById("cutRedMask");
  const cutBlueMask = document.getElementById("cutBlueMask");

  function getCurrentX() {
    const t = pliers.getAttribute("transform");
    return parseFloat(t.match(/translate\(([^,]+)/)[1]);
  }

  function moveTo(targetX, targetY, cb) {
    defuseAnim = setInterval(() => {
      let cur = getCurrentX();
      cur -= 5;
      if (cur <= targetX) {
        cur = targetX;
        clearInterval(defuseAnim);
        pliers.setAttribute("transform", `translate(${cur}, ${targetY})`);
        cb();
      } else {
        pliers.setAttribute("transform", `translate(${cur}, ${targetY})`);
      }
    }, 20);
  }

  function shake(x, y, cb) {
    let tick = 0;
    defuseShake = setInterval(() => {
      tick++;
      const off = tick % 2 === 0 ? 3 : -3;
      pliers.setAttribute("transform", `translate(${x + off}, ${y})`);
      if (tick >= 8) {
        clearInterval(defuseShake);
        pliers.setAttribute("transform", `translate(${x}, ${y})`);
        cb();
      }
    }, 70);
  }

  moveTo(140, 106, () => {
    shake(140, 106, () => {
      redLeft.setAttribute("x2", "132");
      redRight.setAttribute("x1", "148");
      redLeft.setAttribute("stroke", "#ff8888");
      redRight.setAttribute("stroke", "#ff8888");
      cutRedMask.setAttribute("opacity", "1");
      setTimeout(() => {
        moveTo(185, 104, () => {
          shake(185, 104, () => {
            blueLeft.setAttribute("x2", "177");
            blueRight.setAttribute("x1", "193");
            blueLeft.setAttribute("stroke", "#88bbff");
            blueRight.setAttribute("stroke", "#88bbff");
            cutBlueMask.setAttribute("opacity", "1");
            setTimeout(() => onComplete(), 300);
          });
        });
      }, 300);
    });
  });
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
    if (btn === armButton) animateNumpad();
    const duration = parseInt(holdTimeInput.value, 10) * 1000;
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
  startDefuseAnimation(() => {
    timerDisplay.textContent = "✅ Entschärft!";
    defused.currentTime = 0;
    defused.play();
    vibrate([100, 50, 100]);
    document.getElementById("defusePanel").classList.add("hidden");
    resetButton.classList.remove("hidden");
  });
});

/* Einstellungen laden */
if (localStorage.getItem("holdTime")) {
  holdTimeInput.value = localStorage.getItem("holdTime");
}
if (localStorage.getItem("countdownTime")) {
  countdownInput.value = localStorage.getItem("countdownTime");
}

/* Einstellungen speichern bei Änderung */
holdTimeInput.addEventListener("input", () => {
  localStorage.setItem("holdTime", holdTimeInput.value);
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

/* Initialer Zustand beim Laden */
setInitialState();

resetButton.addEventListener("click", () => {
  reset();
  resetDefuseAnimation();
  timerDisplay.classList.remove("warning");
  resetButton.classList.add("hidden");
  showArmHideDefuse();
  holdTimeInput.disabled = false;
  countdownInput.disabled = false;
  document.getElementById("numpadDisplay").textContent = "_ _ _ _ _";
});
