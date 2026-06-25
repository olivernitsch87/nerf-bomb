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
- **`vibrate()`** kapselt `navigator.vibrate` (No-op, wenn nicht unterstützt – z. B. iOS).
- Explosions-Vibration ist via `setTimeout(..., 5000)` verzögert – wirkt erst 5 s nach
  „BOOM!" (potenzielle Inkonsistenz, falls vorher „Neues Spiel" gedrückt wird).
- Einstellungen werden in `localStorage` unter `holdTime` / `defuseHoldTime` /
  `countdownTime` persistiert.
- Haltezeit ist **getrennt** für Scharfschalten (`holdTimeInput`) und Entschärfen
  (`defuseHoldTimeInput`). In `holdButton` wird je nach Button die passende
  Haltezeit gewählt.
- Während aktiver Bombe sind `holdTimeInput` und `countdownInput` disabled
  (gelten nur beim Arm-Zeitpunkt).

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

### Offline-Betrieb (Service Worker)
- `sw.js` precached alle lokalen Assets (HTML, CSS, JS, Bilder, **alle Sounds**),
  Strategie **cache-first** für Same-Origin-Requests; Cross-Origin (Google Fonts)
  wird durchgereicht (Fallback-Font greift offline).
- Registrierung am Ende von `script.js` (`navigator.serviceWorker.register("sw.js")`).
- Cache-Version über `CACHE = "nerf-bomb-v1"` → bei Asset-Änderungen **Version
  hochzählen**, sonst werden alte Dateien aus dem Cache ausgeliefert.
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
