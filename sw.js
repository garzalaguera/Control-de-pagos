const CACHE = "kalifa-pagos-v3";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "https://unpkg.com/react@18/umd/react.production.min.js",
  "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js",
  "https://unpkg.com/@babel/standalone/babel.min.js"
];

// ── Install & activate ─────────────────────────────────────────
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
      .then(keys => Promise.all(keys.filter(k => k!==CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch (offline cache) ──────────────────────────────────────
self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status===200 && res.type!=="opaque") {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match("./index.html"));
    })
  );
});

// ── IndexedDB (shared with page) ──────────────────────────────
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open("kalifa-db", 1);
    r.onupgradeneeded = e => e.target.result.createObjectStore("kv");
    r.onsuccess = e => res(e.target.result);
    r.onerror   = () => rej(r.error);
  });
}
async function idbGet(key) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction("kv","readonly");
    const req = tx.objectStore("kv").get(key);
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}

// ── Periodic background sync ──────────────────────────────────
self.addEventListener("periodicsync", e => {
  if (e.tag === "check-payments") e.waitUntil(checkPayments());
});

async function checkPayments() {
  let data;
  try { data = await idbGet("upcoming"); } catch(e) { return; }
  if (!data || !data.items || !data.items.length) return;

  const today = new Date(); today.setHours(0,0,0,0);

  for (const item of data.items) {
    const limit = new Date(item.limitDate);
    const days  = Math.ceil((limit - today) / 86400000);

    // Only notify for items due in 0–5 days or already overdue
    if (days > 5) continue;

    let title, body;
    if (days < 0) {
      title = "⚠ Pago vencido — Kalifa";
      body  = `${item.cardName}: el límite de pago ya pasó`;
    } else if (days === 0) {
      title = "⚠ Vence HOY — Kalifa";
      body  = `${item.cardName}: último día para pagar`;
    } else {
      title = "Recordatorio de pago — Kalifa";
      body  = `${item.cardName}: vence en ${days} día${days!==1?"s":""}`;
    }

    await self.registration.showNotification(title, {
      body,
      tag:     `kp-${item.key}`,
      icon:    "./icon-192.png",
      badge:   "./icon-192.png",
      vibrate: [200, 100, 200],
      data:    { url: "./" },
      actions: [{ action:"open", title:"Ver pagos" }]
    });
  }
}

// ── Notification click ─────────────────────────────────────────
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = e.notification.data?.url || "./";
  e.waitUntil(
    clients.matchAll({ type:"window", includeUncontrolled:true }).then(list => {
      for (const client of list) {
        if (client.url.includes("kalifa-pagos") && "focus" in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});
