/* Service Worker für die Nerf-Bomb-App.
   Cached alle lokalen Assets, damit die App nach dem ersten Laden
   vollständig offline funktioniert – inkl. aller Sounds und auch
   nach einem Reload bei Verbindungsabbruch. */

const CACHE = "nerf-bomb-v12";

const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/style.css",
  "./assets/script.js",
  "./assets/background.png",
  "./assets/icon.svg",
  "./assets/defuseWires.png",
  "./assets/beep_short.ogg",
  "./assets/planted.mp3",
  "./assets/explosion.mp3",
  "./assets/defused.mp3"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Fremd-Domains (z. B. Google Fonts) nicht abfangen – normaler Netzpfad,
  // bei fehlender Verbindung greift der Fallback-Font im CSS.
  if (url.origin !== self.location.origin) return;

  // Cache-first: lokale Assets kommen aus dem Cache, sonst aus dem Netz
  // (und werden dann nachgecached). Offline greift der Cache.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
