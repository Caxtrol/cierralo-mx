// ═══════════════════════════════════════════════════════════
// SW.JS — Service Worker de Ciérralo.mx
// Maneja: notificaciones push + caché básico para PWA
// ═══════════════════════════════════════════════════════════

const CACHE_NAME = 'cierralo-v1';

// Instalar SW
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

// Activar SW
self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

// ── Recibir notificación push ──
self.addEventListener('push', (e) => {
  let data = { title: 'Ciérralo.mx', body: 'Tienes alertas pendientes', icon: '/icon-192.png' };
  if (e.data) {
    try { data = { ...data, ...e.data.json() }; } catch(err) {}
  }

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'cierralo-alerta',
      renotify: true,
      data: { url: data.url || '/' }
    })
  );
});

// ── Click en notificación → abrir app ──
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Si ya está abierta, enfocarla
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Si no está abierta, abrir
      if (self.clients.openWindow) {
        return self.clients.openWindow(e.notification.data?.url || '/');
      }
    })
  );
});

// ── Notificación local programada (sin servidor push) ──
// Recibe mensaje desde la app para mostrar notificación local
self.addEventListener('message', (e) => {
  if (e.data?.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag, url } = e.data;
    self.registration.showNotification(title || 'Ciérralo.mx', {
      body: body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: tag || 'cierralo',
      renotify: true,
      data: { url: url || '/' }
    });
  }
});
