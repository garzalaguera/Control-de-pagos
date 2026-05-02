const CACHE_NAME = "kalifa-v2";

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(["./", "./index.html", "./manifest.json"]))
  );
});

// Función para leer de IndexedDB
function getDBData() {
  return new Promise((res) => {
    const request = indexedDB.open('mispagos-db', 1);
    request.onsuccess = e => {
      const db = e.target.result;
      const tx = db.transaction('kv', 'readonly');
      const store = tx.objectStore('kv');
      const req = store.get('upcoming_vencimientos');
      req.onsuccess = () => res(req.result);
    };
    request.onerror = () => res(null);
  });
}

// Revisar vencimientos cada vez que el SW se activa o hay un evento de sincronización
self.addEventListener("periodicsync", e => {
  if (e.tag === "check-payments") e.waitUntil(sendReminders());
});

async function sendReminders() {
  const data = await getDBData();
  if (!data) return;

  const today = new Date();
  today.setHours(0,0,0,0);

  data.forEach(item => {
    if (item.paid) return;
    const limit = new Date(item.limit);
    const diffDays = Math.ceil((limit - today) / (1000 * 60 * 60 * 24));

    if (diffDays <= 2 && diffDays >= 0) {
      self.registration.showNotification("Recordatorio de Pago", {
        body: `${item.name} vence en ${diffDays === 0 ? 'HOY' : diffDays + ' días'}`,
        icon: "icon-192.png",
        tag: item.key
      });
    }
  });
}
