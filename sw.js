const CACHE = "kalifa-v1";

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(["./", "./index.html", "./manifest.json"])));
});

self.addEventListener("push", e => {
  const data = e.data ? e.data.json() : {title: "Recordatorio", body: "Tienes un pago pendiente hoy"};
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "icon-192.png",
      badge: "icon-192.png"
    })
  );
});

// Al hacer clic en la notificación, abre la app
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(clients.openWindow("./"));
});
