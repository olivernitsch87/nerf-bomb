# CLAUDE.md – Technische Arbeitsnotizen

Kontext für die Arbeit an diesem Repository.

## Überblick

Statische Web-App („Nerf Bomb") – Bombenentschärfungs-Spiel im CS-Stil. Kein
Build-System, kein Framework, keine npm-Abhängigkeiten. Reines HTML/CSS/Vanilla-JS.

- `index.html` – Markup, Panels, Audio-Tags.
- `assets/script.js` – komplette Logik (~270 Zeilen).
- `assets/style.css` – Styling (~540 Zeilen), responsiv ab `max-width: 600px`.

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
- Einstellungen werden in `localStorage` unter `holdTime` / `countdownTime` persistiert.
- Während aktiver Bombe sind die Settings-Inputs disabled.

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
