const CACHE = "mis-pagos-v1";
const ASSETS = ["./", "./index.html", "./manifest.json"];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (!e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      return cached || fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});

function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open("mispagos-db", 1);
    r.onupgradeneeded = e => e.target.result.createObjectStore("kv");
    r.onsuccess = e => res(e.target.result);
    r.onerror = () => rej(r.error);
  });
}

async function idbGet(key) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction("kv", "readonly");
    const req = tx.objectStore("kv").get(key);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

self.addEventListener("periodicsync", e => {
  if (e.tag === "check-payments") e.waitUntil(checkPayments());
});

async function checkPayments() {
  let data;
  try { data = await idbGet("upcoming"); } catch(e) { return; }
  if (!data || !data.items) return;

  const today = new Date(); today.setHours(0, 0, 0, 0);

  for (const item of data.items) {
    const limit = new Date(item.limitDate);
    const days = Math.ceil((limit - today) / 86400000);
    if (days > 5 || days < 0) continue;

    await self.registration.showNotification(days === 0 ? "⚠ Vence HOY" : "Recordatorio de pago", {
      body: `${item.cardName}: vence en ${days} días`,
      icon: "./icon-192.png",
      data: { url: "./" }
    });
  }
}

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(clients.openWindow("./"));
});
