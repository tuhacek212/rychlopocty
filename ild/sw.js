// Service worker instalovatelné aplikace: soubory stránky z mezipaměti hned (rychlý start, i se slabým
// signálem) a na pozadí se stáhnou nové (příští spuštění má novou verzi). Data týmu (Firebase, jiná
// adresa) ani přihlášení se sem nikdy neukládají – jdou vždy živě.

const VERZE = "ild-2026-10-04a";
const SOUBORY = ["./", "index.html", "app.css", "manifest.webmanifest", "logo.png", "ikona.png", "ikona-192.png", "ikona-512.png",
  "js/app.js", "js/oblak.js", "js/data.js", "js/ui.js", "js/zpravy.js", "js/kalendar.js", "js/export.js", "js/xlsx.js",
  "js/finance.js", "js/cashflow.js", "js/projekty.js", "js/vzhled.js", "js/dovolene.js", "js/nastaveni.js"];

self.addEventListener("install", (ev) => {
  ev.waitUntil(caches.open(VERZE).then((c) => c.addAll(SOUBORY.map((u) => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil(caches.keys().then((klice) => Promise.all(klice.filter((k) => k !== VERZE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (ev) => {
  const url = new URL(ev.request.url);
  if (ev.request.method !== "GET" || url.origin !== self.location.origin || !url.pathname.startsWith(new URL("./", self.location).pathname)) return;
  ev.respondWith(caches.open(VERZE).then(async (cache) => {
    const ulozena = await cache.match(ev.request, { ignoreSearch: true });
    const sit = fetch(ev.request).then((odpoved) => {
      if (odpoved.ok && odpoved.type === "basic") cache.put(ev.request, odpoved.clone());
      return odpoved;
    }).catch(() => ulozena);
    return ulozena || sit;
  }));
});
