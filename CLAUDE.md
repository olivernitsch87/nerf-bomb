# CLAUDE.md – Technische Arbeitsnotizen

Kontext für die Arbeit an diesem Repository.

## Überblick

Statische Web-App („Nerf Bomb") – Bombenentschärfungs-Spiel im CS-Stil. Kein
Build-System, kein Framework, keine npm-Abhängigkeiten. Reines HTML/CSS/Vanilla-JS.

- `index.html` – Markup, Panels, Audio-Tags, Manifest-/Theme-Color-Links.
- `assets/script.js` – komplette Logik.
- `assets/style.css` – Styling (~540 Zeilen), responsiv ab `max-width: 600px`.
- `sw.js` – Service Worker (Offline-Cache, Cache-first für Same-Origin-Assets).
- `manifest.webmanifest` – PWA-Manifest.

## Zentrale Logik (`assets/script.js`)

### Zustand
- `bombActive` (bool) – ob der Countdown läuft.
- `countdown` (int) – Restsekunden.
- Timer-Handles: `holdInterval`, `animateInterval`, `countdownTimer`, `beepTimer`.

### Ablauf
1. **`holdButton(btn, callback)`** registriert Maus-/Touch-Events. Beim
   `mousedown`/`touchstart` startet `startHold`:
   - spielt Beep + Vibration,
   - startet die Numpad-Code-Animation,
   - misst die Haltedauer per `holdInterval` (50 ms) gegen `holdTimeInput`,
   - bei Erreichen der Dauer → `callback()`.
   `cancelHold` (mouseup/leave/touchend/cancel) bricht ab und setzt Anzeige zurück.
2. **Arm-Callback:** `showDefuseHideArm()` + `startCountdown()`.
3. **`startCountdown()`** setzt `bombActive=true`, startet `countdownTimer` (1 s),
   spielt `planted`, startet `adaptiveBeep()`. Bei `countdown<=0`: Explosion
   (Sound, Overlay, Vibration), Reset-Button einblenden.
4. **Defuse-Callback:** nur wenn `bombActive` – stoppt Timer/Beep, Sound `defused`,
   blendet Reset-Button ein.

### Wichtige Details / Stolpersteine
- Die Numpad-Codes (`4 2 7 1 9` / `3 8 5 2 1`) sind **nur Animation**, keine echte
  Code-Prüfung. Auslöser ist ausschließlich die Haltedauer.
- `.numpad-panel` (und zusätzlich explizit `.numpad-key`, da `touch-action`
  nicht vererbt wird) haben `user-select: none` / `touch-action: manipulation` /
  `-webkit-touch-callout: none`. Ohne das löst ein längeres Halten auf den
  Zahlen-`<div>`s die native Text-Auswahl des Browsers aus, was den
  `touchstart`/`mousedown`-Hold via `touchcancel` abbricht (Bugfix).
- **`vibrate()`** kapselt `navigator.vibrate` (No-op, wenn nicht unterstützt – z. B. iOS).
- Explosions-Vibration ist via `setTimeout(..., 5000)` verzögert – das ist
  **beabsichtigt**, da der eigentliche Knall in `explosion.mp3` erst gegen Ende
  des Clips ertönt und die Vibration damit synchron dazu ausgelöst wird.
- Einstellungen werden in `localStorage` unter `holdTime` / `defuseHoldTime` /
  `countdownTime` persistiert.
- Haltezeit ist **getrennt** für Scharfschalten (`holdTimeInput`) und Entschärfen
  (`defuseHoldTimeInput`). In `holdButton` wird je nach Button die passende
  Haltezeit gewählt.
- Während aktiver Bombe sind `holdTimeInput` und `countdownInput` disabled
  (gelten nur beim Arm-Zeitpunkt).

### Gesprochene Countdown-Ansage
- `SPEECH_THRESHOLDS = [60, 30, 10]` (Sekunden Restzeit; 10 s ist bewusst
  die letzte Ansage, keine 5-Sekunden-Schwelle) – bei jeder
  Schwelle sagt `speak()` per **Web Speech API**
  (`SpeechSynthesisUtterance`, `lang = "de-DE"`) „Noch N Sekunden" an,
  zusätzlich zum Beep. Zweck: Restzeit ist hörbar, ohne dass jemand aufs
  Display schauen muss (z. B. während die Bombe im Rucksack getragen wird).
- Ausgelöst wird pro Tick in `startCountdown()` über
  `announceThresholdCrossings(previousCountdown, countdown)`: eine Schwelle
  wird angesagt, wenn die Restzeit **von darüber auf darunter/gleich
  wechselt** – nicht bei exaktem Sekundenvergleich. Dadurch robust gegen
  ausgelassene Ticks (Hintergrund-Throttling) und automatisch
  reload-/resume-sicher, da `previousCountdown` bei jedem `startCountdown()`-
  Aufruf frisch mit dem ersten berechneten `countdown`-Wert initialisiert
  wird (keine rückwirkende Ansage bereits verstrichener Schwellen nach
  einem Resume).
- `cancelSpeech()` (`speechSynthesis.cancel()`) wird in `reset()`,
  `detonate()` und dem Entschärfen-Callback aufgerufen, damit keine Ansage
  aus einer beendeten Runde in die nächste hineinspricht.
- Feature-Detection über `"speechSynthesis" in window`, No-op sonst –
  gleiches Muster wie `vibrate()`.
- **Stimmenauswahl für Offline-Betrieb:** `pickGermanVoice()` wählt aus
  `speechSynthesis.getVoices()` gezielt eine deutsche Stimme mit
  `localService === true` (geräteeigen, funktioniert offline) statt einer
  netzwerkbasierten Google-Cloud-Stimme, die bei Internetausfall stumm
  bleiben würde. Da die Stimmenliste asynchron nachlädt, wird zusätzlich
  auf das `voiceschanged`-Event reagiert. **Voraussetzung auf dem Gerät:**
  In den Android-Systemeinstellungen unter „Sprachausgabe" (Text-to-Speech)
  muss die deutsche Stimme als Sprachpaket heruntergeladen sein – ist gar
  keine deutsche Stimme installiert, bleibt die Ansage stumm, unabhängig
  vom Code (kein rein clientseitig lösbares Problem).
- **Männliche Stimme (Best-Effort):** Unter den gefundenen deutschen
  Stimmen wird eine bevorzugt, deren Name auf „male" passt (Regex
  `/male/i`, ohne „female"). Die Web Speech API liefert kein
  Geschlecht-Attribut – das ist reine Namensheuristik. Ist auf dem Gerät
  nur eine einzige deutsche Stimme installiert, gibt es keine
  Auswahlmöglichkeit (kein Code-Fix möglich, hängt vom installierten
  Sprachpaket/TTS-Engine des Geräts ab).

### Einstellungen-PIN / Edit-Mode
- **PIN: `9999`** – Konstante `SETTINGS_PIN` in `assets/script.js`.
- Anzeigen des Panels ist immer erlaubt (`settingsToggle`). **Ändern** erst nach
  PIN-Eingabe über „🔒 Bearbeiten" (`settingsEditToggle` → `prompt`).
- `settingsLocked` (Default `true`) steuert die Editierbarkeit. `refreshInputLocks()`
  ist die einzige Stelle, die `disabled` der Felder setzt: gesperrt, wenn
  `settingsLocked` (alle Felder) bzw. zusätzlich `bombActive` (Arm-Haltezeit +
  Countdown). Wird von `setInitialState`, `startCountdown`, Reset und dem
  Edit-Toggle aufgerufen.
- Der PIN ist rein clientseitig (kein echter Schutz); schützt nur vor
  versehentlichem Verstellen.

### Reload-sicherer Countdown
- Der Countdown ist **endzeitbasiert**: beim Scharfschalten wird `endTime`
  (`Date.now() + length*1000`) berechnet und unter `localStorage["nerfBombState"]`
  als `{ endTime }` gespeichert. Die Restzeit wird je Tick aus `endTime` neu
  berechnet (`remainingSeconds()`), nicht heruntergezählt → robust gegen Reload und
  Hintergrund-Throttling.
- `startCountdown(resumeEndTime?)`: ohne Argument frischer Start (speichert State,
  spielt `planted`); mit Argument Wiederaufnahme (kein erneutes `planted`).
- `restoreBombState()` läuft beim Laden nach `setInitialState()`: ist `endTime` noch
  in der Zukunft → Defuse-Panel zeigen und `startCountdown(endTime)`; sonst State
  verwerfen.
- State wird gelöscht (`clearBombState()`) bei Detonation, Entschärfung und „Neues Spiel".
- Es wird bewusst **nur der aktive Lauf** persistiert (keine BOOM/Defused-Endzustände),
  damit ein späterer App-Start nicht mit einem veralteten Endbildschirm öffnet.
- `detonate()` kapselt die Explosion (vorher inline im Tick).

### Rundenzeit-Timer (eigenständig von der Bombe)
- Über den Menüeintrag `roundTimerToggle` ("⏱ Runde starten"/"⏱ Runde
  beenden") start-/stoppbar – **unabhängig** von `bombActive`, damit die
  App auch als reiner Zeitgeber für andere Spielmodi (z. B. Capture the
  Flag) nutzbar ist, ganz ohne die Numpad-Mechanik.
- Zwei Einstellungen in `settingsPanel`: `roundTimeInput` (Minuten) und
  `roundUnlimitedInput` (Checkbox „Unbegrenzt"). Persistiert unter
  `localStorage["roundTime"]`/`["roundUnlimited"]`, gesperrt hinter
  `settingsLocked` wie die übrigen Einstellungsfelder (nicht zusätzlich an
  `bombActive` gekoppelt).
- Reload-sicher nach demselben Prinzip wie der Bomben-Countdown, aber über
  einen eigenen Storage-Key `localStorage["nerfRoundState"]`:
  Countdown-Modus speichert `{ mode: "countdown", endTime }`,
  Stoppuhr-Modus (`unbegrenzt`) speichert `{ mode: "stopwatch", startTime }`.
  `restoreRoundState()` läuft neben `restoreBombState()` beim Laden.
- **Bei Ablauf der gesetzten Rundenzeit** (nur Countdown-Modus): Alarm
  (`speak("Rundenzeit abgelaufen")` + `vibrate([200,100,200])` +
  `.warning`-Klasse auf der Anzeige), der sich danach **alle 10 Sekunden
  Überzeit wiederholt** (Schwellenwert-Variable
  `roundTimerNextOvertimeAlarm`, analog zum Schwellen-Muster der
  Bomben-Countdown-Ansage, aber aufsteigend statt absteigend). Der Timer
  **stoppt dabei nicht**, sondern zählt als Überzeit (`+MM:SS`) weiter –
  das Spiel soll dadurch nicht unterbrochen werden. Beim Resume eines
  bereits abgelaufenen Countdowns wird der erste Alarm bewusst **nicht**
  erneut ausgelöst (sonst würde jeder Reload während der Überzeit erneut
  ansagen) – die 10s-Wiederholung setzt aber ab dem nächsten künftigen
  Vielfachen nahtlos fort statt komplett zu pausieren.
- **Automatisches Beenden als Komfortfunktion** (zusätzlich zum manuellen
  Button, nicht als Ersatz): `stopRoundTimer()` wird auch in `detonate()`,
  im Entschärfen-Callback und im „Neues Spiel"-Handler aufgerufen.
- Anzeige immer sichtbar (`roundTimerDisplay`, leer solange nicht aktiv),
  analog zum Punktestand-Mini-Display.

### Bluetooth-Keep-Alive („🔊 Bluetooth wach halten"-Button)
- `startKeepAlive()` / `stopKeepAlive()`, getoggled über den Menüeintrag
  `keepAliveToggle` (Burger-Menü). Bewusst **kein** Screen Wake Lock, da der
  Bildschirm normal sperrbar bleiben soll (Smartphone wandert oft für
  mehrere Minuten in einen Rucksack, bevor überhaupt scharf geschaltet wird).
- Grund: Android/Chrome friert einen Tab im Hintergrund (Bildschirm gesperrt)
  ein und trennt dabei eine per Bluetooth verbundene Box (z. B. JBL) – außer
  der Tab spielt aktiv Medien ab (wie eine Musik-App). Daher erzeugt
  `startKeepAlive()` per Web Audio API einen dauerhaften, sehr leisen
  Sinuston (Gain `0.001`, praktisch unhörbar) über einen loopenden
  `AudioBufferSourceNode` und setzt zusätzlich
  `navigator.mediaSession.playbackState = "playing"`, damit Android den Tab
  zuverlässig als aktive Medienwiedergabe erkennt.
- Bewusst **keine Audiodatei**: Der Ton wird zur Laufzeit synthetisiert
  (kein neues Asset unter `assets/`), da es rein technischen Zweck erfüllt
  und nicht als Musik/Sound wahrgenommen werden soll.
- Der Modus ist ein reiner An/Aus-Umschalter, unabhängig von `bombActive`
  und läuft bewusst über mehrere Runden (Scharfschalten, Countdown,
  Entschärfen/Explosion, „Neues Spiel") hinweg weiter, bis er explizit über
  den Button beendet wird.
- **Sichtbarer Nebeneffekt:** Android zeigt während der aktiven Wiedergabe
  eine Medien-Benachrichtigung/Sperrbildschirm-Steuerung an – das ist
  erwartet und nötig, damit der Trick funktioniert.
- **Grenzen:** Rein an den Lebenszyklus der Seite gebunden (kein Service
  Worker, kein systemweiter Dienst) – wird der Tab/die App hart geschlossen
  (App-Switcher wegwischen), endet der Ton automatisch mit. Kein Schutz vor
  manuellem Sperren mit gleichzeitigem Task-Kill oder aggressivem
  Battery-Saver. Erfordert `AudioContext`/`webkitAudioContext`
  (Feature-Detection, No-op sonst); `mediaSession` ist optional.

### Burger-Menü & Punktestand
- Die Top-Bar enthält nur noch Titel + `menuToggle` (☰). Sekundäre
  Aktionen (`keepAliveToggle`, `scoreToggle`, `settingsToggle`) liegen als
  gestapelte Buttons in `menuPanel` (`.hidden`-Toggle wie `settingsPanel`).
  Grund: ein dritter Top-Bar-Button hätte auf schmalen Bildschirmen erneut
  das Platzproblem des früheren Vollbild-Buttons erzeugt; das Menü
  skaliert auch für künftige Assistent-Funktionen.
- Klick auf einen Button *innerhalb* von `menuPanel` schließt das Menü
  danach automatisch (ein delegierter Klick-Listener auf `menuPanel`).
- **Punktestand:** `scoreA`/`scoreB` (State) werden in `localStorage` unter
  den flachen Keys `scoreA`/`scoreB` persistiert (gleiches Muster wie
  `holdTime` etc.). `changeScore(team, delta)` ändert und persistiert,
  clamped nicht unter 0. `updateScoreDisplay()` ist die einzige Stelle, die
  sowohl das immer sichtbare Mini-Scoreboard (`scoreDisplay`, z. B.
  „A 3 : 2 B") als auch die Zähler im `scorePanel` aktualisiert.
- `scorePanel` (Toggle über `scoreToggle` im Menü) bietet `+1`/`-1` je Team
  sowie `scoreResetButton` (mit `confirm()`-Bestätigung). Bewusst **keine
  PIN-Sperre** auf Score-Änderungen – anders als Einstellungen werden Punkte
  während des laufenden Spiels häufig geändert.
- `settingsPanel` und `scorePanel` haben je einen eigenen „✕ Schließen"-Button
  (`.panel-close`, `data-panel="…"`, ein delegierter Listener setzt
  `classList.add("hidden")` auf das referenzierte Panel). Ohne diesen Button
  wäre ein Panel nur über einen erneuten Klick auf denselben Menüeintrag im
  Burger-Menü schließbar – das war nicht auffindbar (Bugfix). Zusätzlich
  schließt das Öffnen von Settings/Score automatisch das jeweils andere
  Panel, damit nie beide gleichzeitig offen sind.
- **Teams-Tipp:** Hinweistext in `settingsPanel` (gleicher Stil wie der
  Haptik-Hinweis) empfiehlt, sich bei größeren Spielfeldern zusätzlich per
  Microsoft-Teams-Sitzung zu verbinden (Freisprechen an, Kamera/Mikro aus)
  und auf dem Bomben-Handy Bildschirm + Systemaudio zu teilen. Das ist ein
  reiner Nutzer-Workflow mit Bordmitteln von Teams/Android – **kein Code**
  in der App dafür nötig.

### Offline-Betrieb (Service Worker)
- `sw.js` precached alle lokalen Assets (HTML, CSS, JS, Bilder, **alle Sounds**),
  Strategie **cache-first** für Same-Origin-Requests; Cross-Origin (Google Fonts)
  wird durchgereicht (Fallback-Font greift offline).
- Registrierung am Ende von `script.js` (`navigator.serviceWorker.register("sw.js")`).
- Cache-Version über `CACHE = "nerf-bomb-vN"` (aktuell v7) → bei
  Asset-Änderungen **Version hochzählen**, sonst werden alte Dateien aus
  dem Cache ausgeliefert.
- **Wichtig:** SW läuft nur über `http(s)://`, nicht `file://`. Audio-Plays sind mit
  `.catch(() => {})` abgesichert (Autoplay-Policy nach Reload).

## CSS (`assets/style.css`)
- Dunkle Glas-/Neon-Optik mit `backdrop-filter`, Verläufen und Glow-Schatten.
- Overlay-Effekte über `body::before` mit Klassen `.flash` (Flackern) und
  `.explosion`.
- `.warning` blinkt via `@keyframes blink`.
- Numpad-„Display" nutzt die Webfont **Digital 7** (geladen in `index.html` via
  Google Fonts) mit Monospace-Fallback.
- `.hidden { display: none !important; }` steuert die Sichtbarkeit der Panels.
- **Mobile-Polish (UX/UI-Audit):** `-webkit-tap-highlight-color: transparent`
  auf `html` (kein grauer Tap-Flash), `.icon-button` hat `min-height: 2.75rem`
  (~44px Tap-Target). `viewport-fit=cover` in `index.html` +
  `env(safe-area-inset-top/bottom)` auf `.top-bar`/`main` für Notch/
  Gesten-Leiste (App läuft als installierte PWA im `fullscreen`-Modus).
  `.numpad-display` und `.score-row` bekommen im `@media (max-width: 600px)`
  reduzierte Schriftgröße/Abstände, damit Code-Anzeige und Punktestand auf
  sehr schmalen Geräten nicht umbrechen. Die mobile Regel für volle
  Button-Breite ist gezielt `button:not(.icon-button)` – sie darf `.icon-button`
  (☰, ✕, `+1`/`-1` usw.) **nicht** treffen, sonst werden diese auf Mobile
  fälschlich auf 100% Breite gestreckt (führte zu genau diesem Bug).
- **`.panel-close`** ("✕"-Schließen-Button in `settingsPanel`/`scorePanel`)
  ist bewusst ein rundes Icon-Button (kein Text-Label), optisch von den
  goldenen Haupt-Buttons abgesetzt (rötlicher Hover), damit er klar als
  eigenständige Schließen-Aktion erkennbar ist.
- **App-Icon:** `assets/icon.svg` existiert als selbst erstelltes,
  themenpassendes SVG (💣-Emoji), wird aber **nicht** im Manifest verwendet –
  Android generiert für installierte Fullscreen-PWAs den Splash-Screen aus
  dem Manifest-Icon, und SVG wird dabei nicht zuverlässig unterstützt
  (führte zu einem App-Start-Hänger am Splash-Screen). Das Manifest nutzt
  daher weiterhin `assets/background.png` als Icon (bekannter
  Foto-Zuschnitt-Kompromiss). Ein Ersatz durch ein echtes PNG (z. B. Export
  von `icon.svg` außerhalb dieser Umgebung) ist ein möglicher Folge-Schritt.

## Konventionen
- Oberfläche und Code-Kommentare sind **auf Deutsch**.
- Keine Tooling-/Lint-/Test-Pipeline vorhanden – Änderungen manuell im Browser testen.
- Assets liegen flach in `assets/`. `defuseWires.png` existiert, ist aber aktuell
  nicht in `index.html` eingebunden.

## Testen
Kein automatisierter Test. Manuell prüfen:
```bash
python3 -m http.server 8000   # http://localhost:8000
```
Durchspielen: Arm halten → Countdown → Defuse halten bzw. ablaufen lassen → Neues Spiel.
