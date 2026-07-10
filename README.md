# Nerf Bomb 💣

Eine browserbasierte **Bombenentschärfungs-App** im Counter-Strike-Stil, gedacht für
Nerf-Gefechte und ähnliche Spiele in der echten Welt. Ein Team „scharfschaltet" die
Bombe (Plant), das gegnerische Team versucht, sie vor Ablauf des Countdowns zu
„entschärfen" (Defuse). Läuft der Timer ab, gibt es eine akustische und visuelle
Explosion.

Die App ist als reine Statik-Seite (HTML/CSS/JS, kein Build, keine Abhängigkeiten)
umgesetzt und auf den Einsatz auf Smartphones/Tablets optimiert (Touch, Vibration).
Als installierte PWA läuft sie über Chrome bereits im Vollbildmodus (siehe
`manifest.webmanifest`, `"display": "fullscreen"`).

## Funktionen

- **Scharfschalten (Arm):** Numpad gedrückt halten → Code-Animation läuft → nach
  Ablauf der Haltezeit startet der Countdown.
- **Entschärfen (Defuse):** Während die Bombe aktiv ist, das Defuse-Numpad gedrückt
  halten → nach Ablauf der Haltezeit ist die Bombe entschärft.
- **Adaptiver Beep:** Das Piep-Intervall wird mit ablaufender Zeit kürzer
  (3 s → 1 s → 0,5 s → 0,2 s).
- **Visuelles Feedback:** Rotes Flackern in den letzten 5 Sekunden, Explosions-Overlay,
  blinkende Warnanzeige ab 10 Sekunden Restzeit.
- **Audio:** `planted`, `beep`, `explosion`, `defused`.
- **Haptik:** Vibration bei Tastendruck, Plant, Defuse und Explosion
  (sofern vom Gerät/System unterstützt).
- **Einstellungen (persistiert in `localStorage`):**
  - Haltezeit Scharfschalten (1–30 s, Default 5 s)
  - Haltezeit Entschärfen (separat einstellbar, 1–30 s, Default 5 s)
  - Countdown-Länge (10–300 s, Default 45 s)
- **PIN-Schutz der Einstellungen:** Anzeigen ist frei, **Ändern** erst nach Eingabe
  des PIN im Edit-Mode (Button „🔒 Bearbeiten"). **PIN: `9999`** (siehe unten).
- **Ein-/ausblendbares Einstellungs-Panel.**
- **Reload-sicher:** Der absolute Endzeitpunkt eines laufenden Countdowns wird in
  `localStorage` gespeichert. Nach einem versehentlichen Neuladen wird der Lauf exakt
  dort fortgesetzt (Defuse-Panel + Beep wieder aktiv). Abgelaufene Stände werden verworfen.
- **Offline-fähig (PWA):** Ein Service Worker (`sw.js`) cached alle lokalen Assets
  inkl. **aller Sounds**. Nach dem ersten Laden funktioniert die App komplett ohne
  Netz – auch bei Verbindungsabbruch und bei einem Reload ohne Verbindung.

## Bedienung

1. Seite öffnen – das **Arm-Numpad** ist sichtbar.
2. Numpad **gedrückt halten**, bis der Fortschrittsbalken voll ist → Bombe ist scharf,
   der Countdown startet, das **Defuse-Numpad** erscheint.
3. Zum Entschärfen das Defuse-Numpad **gedrückt halten**, bis der Balken voll ist.
4. Bei Erfolg: „✅ Entschärft!" – bei Ablauf: „💥 BOOM!".
5. Über **🔄 Neues Spiel** in den Ausgangszustand zurückkehren.

> Die angezeigten Codes (`4 2 7 1 9` / `3 8 5 2 1`) sind reine Anzeige-Animation –
> es gibt keine echte Code-Eingabe-Prüfung. Ausgelöst wird allein durch das Halten.

## Projektstruktur

```
nerf-bomb/
├── index.html            # Seitenstruktur, Audio-Elemente, Panels
├── sw.js                 # Service Worker (Offline-Cache aller Assets)
├── manifest.webmanifest  # PWA-Manifest
├── README.md             # Diese Datei
├── CLAUDE.md             # Technische Arbeitsnotizen
└── assets/
    ├── script.js         # Spiellogik (Hold, Countdown, Beep, Sounds, Settings)
    ├── style.css         # Styling (Glas-/Neon-Optik, responsiv)
    ├── background.png     # Hintergrundbild
    ├── defuseWires.png    # Grafik (aktuell nicht im HTML referenziert)
    ├── beep_short.ogg     # Beep-Sound
    ├── planted.mp3        # Sound beim Scharfschalten
    ├── explosion.mp3      # Sound bei Explosion
    └── defused.mp3        # Sound bei Entschärfung
```

## Lokal starten

Keine Build-Schritte nötig. Entweder `index.html` direkt im Browser öffnen oder einen
einfachen Webserver verwenden (empfohlen, damit Audio-Wiedergabe zuverlässig ist):

```bash
python3 -m http.server 8000
# dann http://localhost:8000 öffnen
```

## Einstellungen-PIN

Die Einstellungen lassen sich frei **anzeigen**, aber nur im **Edit-Mode**
**ändern**. Dazu im Einstellungs-Panel auf „🔒 Bearbeiten" tippen und den PIN
eingeben:

> **PIN: `9999`**

Definiert in `assets/script.js` als Konstante `SETTINGS_PIN`. Zum Ändern des PIN dort
den Wert anpassen. (Hinweis: Der PIN ist clientseitig im JavaScript hinterlegt und
schützt nur vor versehentlichem Verstellen, nicht gegen technisch versierte Nutzer.)

## Hinweise

- Sprache der Oberfläche: **Deutsch**.
- Vibration funktioniert nur, wenn haptisches Feedback in den Systemeinstellungen
  aktiviert ist und der Browser die `navigator.vibrate`-API unterstützt
  (v. a. Android/Chrome; iOS Safari unterstützt sie nicht).
- Audio-Wiedergabe erfordert auf Mobilgeräten i. d. R. eine vorherige
  Nutzer-Interaktion (durch das Halten der Buttons gegeben). Wird der Countdown nach
  einem Reload automatisch fortgesetzt, kann der Beep durch die Autoplay-Sperre des
  Browsers bis zur ersten Berührung stummgeschaltet bleiben – der Timer läuft optisch
  trotzdem korrekt weiter.
- **Der Service Worker (Offline-Modus) funktioniert nur, wenn die App über einen
  Webserver (`http://`/`https://`) geöffnet wird – nicht per `file://`.** Auf
  GitHub Pages o. ä. funktioniert es automatisch; lokal via `python3 -m http.server`.
