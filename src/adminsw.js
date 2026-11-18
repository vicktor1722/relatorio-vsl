/* ============================================================
   adminsw.js — manifesto e service worker do painel (amvs.ia.br/admin)
   Só para as notificações no celular (Soja hoje, alerta de alta…) do administrador e do Adm de equipe:
   o painel instalado na tela de início recebe o aviso e, ao tocar, abre o sininho.
   ============================================================ */

export const ADMIN_MANIFEST = JSON.stringify({
  name: 'AMVS Painel',
  short_name: 'AMVS Painel',
  description: 'Painel de gestão do AMVS Relatório: relatórios, timeline, lavoura e avisos.',
  start_url: '/admin',
  scope: '/admin',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#F3F5F4',
  theme_color: '#1B7A43',
  icons: [
    { src: '/api/icone/adm.png', sizes: '512x512', type: 'image/png', purpose: 'any' }
  ]
});

export const ADMIN_SW = `
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener('push', function (e) {
  var m = {};
  try { m = e.data ? e.data.json() : {}; } catch (err) { m = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(m.title || 'AMVS Painel', {
    body: m.body || '', tag: m.tag || 'aviso', renotify: true,
    icon: '/api/icone/adm.png', badge: '/api/icone/adm.png', data: { url: m.url || '/admin?avisos=1' }
  }));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || '/admin?avisos=1';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (abertas) {
    for (var i = 0; i < abertas.length; i++) {
      if (new URL(abertas[i].url).pathname.indexOf('/admin') === 0) { abertas[i].postMessage({ abrir: 'avisos' }); return abertas[i].focus(); }
    }
    return self.clients.openWindow(url);
  }));
});
`;
