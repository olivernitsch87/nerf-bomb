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
const settingsEditToggle = document.getElementById("settingsEditToggle");
const settingsEditHint = document.getElementById("settingsEditHint");
const keepAliveToggle = document.getElementById("keepAliveToggle");
const resetButton = document.getElementById("resetButton");
const menuToggle = document.getElementById("menuToggle");
const menuPanel = document.getElementById("menuPanel");
const scoreToggle = document.getElementById("scoreToggle");
const scorePanel = document.getElementById("scorePanel");
const scoreDisplay = document.getElementById("scoreDisplay");
const scoreValueA = document.getElementById("scoreValueA");
const scoreValueB = document.getElementById("scoreValueB");
const scoreResetButton = document.getElementById("scoreResetButton");
const roundTimeInput = document.getElementById("roundTimeInput");
const roundUnlimitedInput = document.getElementById("roundUnlimitedInput");
const roundTimerToggle = document.getElementById("roundTimerToggle");
const roundTimerDisplay = document.getElementById("roundTimerDisplay");

let holdInterval;
let animateInterval;
let countdownTimer;
let beepTimer;
let countdown = 0;
let bombActive = false;
let keepAliveActive = false;
let keepAliveCtx = null;
let keepAliveSource = null;
let scoreA = parseInt(localStorage.getItem("scoreA"), 10) || 0;
let scoreB = parseInt(localStorage.getItem("scoreB"), 10) || 0;
let roundTimerActive = false;
let roundTimerInterval = null;
let roundTimerAlarmed = false;
let roundTimerNextOvertimeAlarm = 0;

/* Edit-Mode der Einstellungen.
   Anzeigen ist immer erlaubt; Ändern erst nach PIN-Eingabe.
   PIN ist auch in README.md / CLAUDE.md dokumentiert. */
const SETTINGS_PIN = "9999";
let settingsLocked = true;

/* Restzeit-Schwellen (Sekunden), bei denen zusätzlich zum Beep eine
   gesprochene Ansage erfolgt – hörbar, ohne dass jemand aufs Display
   schauen muss (z. B. während die Bombe im Rucksack getragen wird). */
const SPEECH_THRESHOLDS = [60, 30, 10];

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

/* Persistenz des Rundenzeit-Timers (reload-sicher, unabhängig vom
   Bomben-Countdown – der Timer soll auch ohne Bombe nutzbar sein,
   z. B. für Capture the Flag). Gleiches endzeit-/startzeitbasierte
   Prinzip wie beim Bomben-Countdown. */

const ROUND_STORAGE_KEY = "nerfRoundState";

function saveRoundState(state) {
  try {
    localStorage.setItem(ROUND_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    /* localStorage nicht verfügbar */
  }
}

function loadRoundState() {
  try {
    return JSON.parse(localStorage.getItem(ROUND_STORAGE_KEY));
  } catch (e) {
    return null;
  }
}

function clearRoundState() {
  try {
    localStorage.removeItem(ROUND_STORAGE_KEY);
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

/* Deutsche Stimme für die Sprachausgabe auswählen. Android/Chrome bieten oft
   sowohl eine geräteeigene ("localService": true, funktioniert offline) als
   auch eine netzwerkbasierte Stimme (Google-Cloud-TTS) für Deutsch an – ohne
   explizite Auswahl kann Chrome eine Netzwerk-Stimme wählen, die bei
   Verbindungsabbruch stumm bleibt. Stimmenliste lädt asynchron nach, daher
   zusätzlich auf "voiceschanged" reagieren.
   Die Web Speech API liefert kein Geschlecht-Attribut für Stimmen – eine
   männliche Stimme wird daher nur heuristisch über den Stimmennamen
   bevorzugt (z. B. "German (Male)"). Ist auf dem Gerät nur eine einzige
   deutsche Stimme installiert, gibt es keine Auswahlmöglichkeit. */
let speechVoice = null;

function pickGermanVoice() {
  if (!("speechSynthesis" in window)) return null;
  const germanVoices = speechSynthesis.getVoices().filter((v) => v.lang && v.lang.toLowerCase().startsWith("de"));
  if (!germanVoices.length) return null;
  const local = germanVoices.filter((v) => v.localService);
  const candidates = local.length ? local : germanVoices;
  const male = candidates.find((v) => /male/i.test(v.name) && !/female/i.test(v.name));
  return male || candidates[0];
}

if ("speechSynthesis" in window) {
  speechVoice = pickGermanVoice();
  speechSynthesis.addEventListener("voiceschanged", () => {
    speechVoice = pickGermanVoice();
  });
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  try {
    // Chrome-Bug: eine hängende/unvollständige Warteschlange lässt spätere
    // speak()-Aufrufe stumm verpuffen (betrifft v.a. wiederholte Ansagen wie
    // die 10s-Rundenzeit-Überzeit-Alarme). cancel() vor jedem speak() räumt
    // die Warteschlange auf und behebt das zuverlässig.
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "de-DE";
    if (speechVoice) {
      utterance.voice = speechVoice;
    }
    speechSynthesis.speak(utterance);
  } catch (e) {
    /* Sprachausgabe nicht verfügbar – ignorieren */
  }
}

function cancelSpeech() {
  if ("speechSynthesis" in window) {
    speechSynthesis.cancel();
  }
}

/* Ansage ausgelöst durch den Übergang über eine Schwelle (statt exaktem
   Sekundenvergleich) – robust gegen ausgelassene Ticks bei Hintergrund-
   Throttling und automatisch reload-sicher, da beim Resume kein Vergleich
   vor dem ersten Tick stattfindet. */
function announceThresholdCrossings(previousCountdown, currentCountdown) {
  SPEECH_THRESHOLDS.forEach((threshold) => {
    if (previousCountdown > threshold && currentCountdown <= threshold) {
      speak(`Noch ${threshold} Sekunden`);
    }
  });
}

/* Bluetooth-Verbindung (z. B. zur Lautsprecherbox) bei gesperrtem Bildschirm
   halten. Das Smartphone wandert oft für mehrere Minuten in einen Rucksack,
   bevor überhaupt scharf geschaltet wird – der Bildschirm soll dabei ganz
   normal sperrbar bleiben (kein Wake Lock). Android/Chrome friert einen Tab
   im Hintergrund aber ein und trennt dabei Bluetooth, außer der Tab spielt
   aktiv Medien ab (wie eine Musik-App). Daher wird bei Bedarf ein praktisch
   unhörbarer Dauerton per Web Audio API erzeugt, der nur diesen Zweck erfüllt.
   Läuft rein innerhalb der Seite – wird der Tab/die App geschlossen, endet
   der Ton automatisch mit. */
function startKeepAlive() {
  if (keepAliveActive) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  try {
    keepAliveCtx = new AudioCtx();
    const sampleRate = keepAliveCtx.sampleRate;
    const buffer = keepAliveCtx.createBuffer(1, sampleRate, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.sin((2 * Math.PI * 20 * i) / sampleRate);
    }
    const gainNode = keepAliveCtx.createGain();
    gainNode.gain.value = 0.001;
    keepAliveSource = keepAliveCtx.createBufferSource();
    keepAliveSource.buffer = buffer;
    keepAliveSource.loop = true;
    keepAliveSource.connect(gainNode).connect(keepAliveCtx.destination);
    keepAliveSource.start();

    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: "Nerf Bomb – aktiv" });
      navigator.mediaSession.playbackState = "playing";
    }

    keepAliveActive = true;
    keepAliveToggle.textContent = "🔇 Beenden";
  } catch (e) {
    /* Web Audio nicht verfügbar – ignorieren */
  }
}

function stopKeepAlive() {
  if (keepAliveSource) {
    try {
      keepAliveSource.stop();
    } catch (e) {
      /* bereits gestoppt */
    }
    keepAliveSource = null;
  }
  if (keepAliveCtx) {
    keepAliveCtx.close().catch(() => {});
    keepAliveCtx = null;
  }
  if ("mediaSession" in navigator) {
    navigator.mediaSession.playbackState = "none";
  }
  keepAliveActive = false;
  keepAliveToggle.textContent = "🔊 Bluetooth wach halten";
}

/* Rundenzeit-Timer: eigenständig von der Bombe start-/stoppbar, damit die
   App auch für andere Spielmodi (z. B. Capture the Flag) als reiner
   Zeitgeber nutzbar ist. Countdown-Modus zeigt die Restzeit; bei Erreichen
   von 0 ertönt ein einmaliger Alarm, danach läuft die Anzeige als Überzeit
   weiter, statt bei "00:00" einzufrieren – das Spiel soll dadurch nicht
   unterbrochen werden. "Unbegrenzt" zählt von Anfang an als Stoppuhr hoch. */

function formatRoundTime(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function startRoundTimer(resumeState) {
  clearInterval(roundTimerInterval);

  const isResume = !!resumeState;
  const unlimited = isResume ? resumeState.mode === "stopwatch" : roundUnlimitedInput.checked;
  let endTime = null;
  let startTime = null;

  if (unlimited) {
    startTime = isResume ? resumeState.startTime : Date.now();
    if (!isResume) saveRoundState({ mode: "stopwatch", startTime });
  } else if (isResume) {
    endTime = resumeState.endTime;
  } else {
    const minutes = parseInt(roundTimeInput.value, 10);
    endTime = Date.now() + minutes * 60000;
    saveRoundState({ mode: "countdown", endTime });
  }

  // Beim Resume eines bereits abgelaufenen Countdowns nicht sofort erneut
  // Alarm auslösen (sonst würde jeder Reload während der Überzeit erneut
  // ansagen) - die 10s-Wiederholung läuft aber ab dem nächsten künftigen
  // Vielfachen nahtlos weiter.
  const alreadyExpired = !unlimited && isResume && endTime <= Date.now();
  roundTimerAlarmed = alreadyExpired;
  roundTimerNextOvertimeAlarm = alreadyExpired
    ? (Math.floor((Date.now() - endTime) / 1000 / 10) + 1) * 10
    : 0;

  roundTimerActive = true;
  roundTimerToggle.textContent = "⏱ Runde beenden";

  function tick() {
    if (unlimited) {
      const elapsed = (Date.now() - startTime) / 1000;
      roundTimerDisplay.textContent = `⏱ ${formatRoundTime(elapsed)}`;
      return;
    }
    const remaining = (endTime - Date.now()) / 1000;
    if (remaining <= 0) {
      const overtime = -remaining;
      if (!roundTimerAlarmed || overtime >= roundTimerNextOvertimeAlarm) {
        roundTimerAlarmed = true;
        speak("Rundenzeit abgelaufen");
        vibrate([200, 100, 200]);
        roundTimerDisplay.classList.add("warning");
        roundTimerNextOvertimeAlarm += 10;
      }
      roundTimerDisplay.textContent = `⏱ +${formatRoundTime(overtime)}`;
    } else {
      roundTimerDisplay.textContent = `⏱ ${formatRoundTime(remaining)}`;
    }
  }

  tick();
  roundTimerInterval = setInterval(tick, 1000);
}

function stopRoundTimer() {
  clearInterval(roundTimerInterval);
  roundTimerInterval = null;
  roundTimerActive = false;
  roundTimerAlarmed = false;
  roundTimerNextOvertimeAlarm = 0;
  roundTimerDisplay.textContent = "";
  roundTimerDisplay.classList.remove("warning");
  roundTimerToggle.textContent = "⏱ Runde starten";
  clearRoundState();
}

function reset() {
  clearInterval(countdownTimer);
  clearTimeout(beepTimer);
  cancelSpeech();
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
  refreshInputLocks();
  showArmHideDefuse();
}

/* Sperrzustand der Eingabefelder aktualisieren.
   Arm-Haltezeit & Countdown-Länge gelten nur beim Scharfschalten und sind
   während eines aktiven Laufs ohnehin gesperrt. Bearbeitbar ist generell
   nur im Edit-Mode (nach PIN). */
function refreshInputLocks() {
  const armCountdownLocked = settingsLocked || bombActive;
  holdTimeInput.disabled = armCountdownLocked;
  countdownInput.disabled = armCountdownLocked;
  defuseHoldTimeInput.disabled = settingsLocked;
  roundTimeInput.disabled = settingsLocked;
  roundUnlimitedInput.disabled = settingsLocked;
}

/* Countdown & Sounds */

function startCountdown(resumeEndTime) {
  bombActive = true;
  refreshInputLocks();
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
  let previousCountdown = countdown;
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
    announceThresholdCrossings(previousCountdown, countdown);
    previousCountdown = countdown;
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
  cancelSpeech();
  clearBombState();
  stopRoundTimer();
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
  cancelSpeech();
  timerDisplay.classList.remove("warning");
  body.classList.remove("flash");
  bombActive = false;
  clearBombState();
  stopRoundTimer();
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
if (localStorage.getItem("roundTime")) {
  roundTimeInput.value = localStorage.getItem("roundTime");
}
if (localStorage.getItem("roundUnlimited") === "true") {
  roundUnlimitedInput.checked = true;
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

roundTimeInput.addEventListener("input", () => {
  localStorage.setItem("roundTime", roundTimeInput.value);
});

roundUnlimitedInput.addEventListener("change", () => {
  localStorage.setItem("roundUnlimited", roundUnlimitedInput.checked);
});

/* Einstellungen ein-/ausblenden (Anzeigen ist ohne PIN erlaubt).
   Score-Panel wird dabei geschlossen, damit nie beide gleichzeitig offen sind. */
settingsToggle.addEventListener("click", () => {
  scorePanel.classList.add("hidden");
  settingsPanel.classList.toggle("hidden");
});

/* Direkter Schließen-Button je Panel (Settings/Score), da die Panels sonst
   nur über einen erneuten Klick auf den jeweiligen Menüeintrag zu
   schließen wären. */
document.querySelectorAll(".panel-close").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.getElementById(btn.dataset.panel).classList.add("hidden");
  });
});

/* Burger-Menü ein-/ausblenden. Ein Klick auf einen Menüeintrag schließt
   das Menü danach automatisch wieder (delegierter Listener). */
menuToggle.addEventListener("click", () => {
  menuPanel.classList.toggle("hidden");
});

menuPanel.addEventListener("click", (e) => {
  if (e.target.closest("button")) {
    menuPanel.classList.add("hidden");
  }
});

/* Punktestand (manuell, persistiert in localStorage) */

function updateScoreDisplay() {
  scoreDisplay.textContent = `A ${scoreA} : ${scoreB} B`;
  scoreValueA.textContent = scoreA;
  scoreValueB.textContent = scoreB;
}

function changeScore(team, delta) {
  if (team === "A") {
    scoreA = Math.max(0, scoreA + delta);
    localStorage.setItem("scoreA", scoreA);
  } else {
    scoreB = Math.max(0, scoreB + delta);
    localStorage.setItem("scoreB", scoreB);
  }
  updateScoreDisplay();
}

document.querySelectorAll(".score-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    changeScore(btn.dataset.team, parseInt(btn.dataset.delta, 10));
  });
});

scoreToggle.addEventListener("click", () => {
  settingsPanel.classList.add("hidden");
  scorePanel.classList.toggle("hidden");
});

scoreResetButton.addEventListener("click", () => {
  if (!confirm("Punktestand wirklich zurücksetzen?")) return;
  scoreA = 0;
  scoreB = 0;
  localStorage.setItem("scoreA", scoreA);
  localStorage.setItem("scoreB", scoreB);
  updateScoreDisplay();
});

updateScoreDisplay();

/* Edit-Mode der Einstellungen per PIN freischalten/sperren */
function setSettingsEditMode(unlocked) {
  settingsLocked = !unlocked;
  settingsEditToggle.textContent = unlocked ? "🔓 Sperren" : "🔒 Bearbeiten";
  settingsEditHint.textContent = unlocked
    ? "Bearbeiten freigeschaltet."
    : "Zum Ändern PIN eingeben.";
  refreshInputLocks();
}

settingsEditToggle.addEventListener("click", () => {
  if (settingsLocked) {
    const pin = prompt("PIN eingeben, um die Einstellungen zu bearbeiten:");
    if (pin === null) return; // Abgebrochen
    if (pin === SETTINGS_PIN) {
      setSettingsEditMode(true);
    } else {
      settingsEditHint.textContent = "Falscher PIN.";
    }
  } else {
    setSettingsEditMode(false);
  }
});

keepAliveToggle.addEventListener("click", () => {
  if (keepAliveActive) {
    stopKeepAlive();
  } else {
    startKeepAlive();
  }
});

roundTimerToggle.addEventListener("click", () => {
  if (roundTimerActive) {
    stopRoundTimer();
  } else {
    startRoundTimer();
  }
});

resetButton.addEventListener("click", () => {
  reset();
  clearBombState();
  stopRoundTimer();
  timerDisplay.classList.remove("warning");
  resetButton.classList.add("hidden");
  showArmHideDefuse();
  refreshInputLocks();
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
    startCountdown(state.endTime); // setzt Sperren via refreshInputLocks()
  } else {
    // Zeit ist während der Abwesenheit abgelaufen -> Stand verwerfen
    clearBombState();
  }
}

/* Laufenden Rundenzeit-Timer nach Reload wiederherstellen (unabhängig vom
   Bomben-Countdown) */
function restoreRoundState() {
  const state = loadRoundState();
  if (!state) return;
  if (state.mode === "stopwatch" && typeof state.startTime === "number") {
    startRoundTimer(state);
  } else if (state.mode === "countdown" && typeof state.endTime === "number") {
    startRoundTimer(state);
  }
}

/* Initialer Zustand beim Laden */
setInitialState();
restoreBombState();
restoreRoundState();

/* Service Worker für Offline-Betrieb registrieren.
   Sorgt dafür, dass die App (inkl. aller Sounds) auch ohne Netz
   und nach einem Reload bei Verbindungsabbruch vollständig läuft. */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
