/* ============================================================
   portalsw.js — service worker e manifesto do portal (amvs.ia.br/portal)
   Separado do app do consultor (escopo /portal): o portal abre sem internet com os
   últimos dados baixados e recebe o aviso das 5h00 do operador.
   ============================================================ */

export const PORTAL_MANIFEST = JSON.stringify({
  name: 'AMVS Fazenda',
  short_name: 'AMVS Fazenda',
  description: 'Aplicações, mapas e estoque da fazenda; marcação das aplicações pelo operador.',
  start_url: '/portal',
  scope: '/portal',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#F3F5F4',
  theme_color: '#1B7A43',
  icons: [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
  ]
});

export const PORTAL_SW = `
const CACHE = 'amvs-portal-v1';
const ESPERA = 6000;   // sinal fraco: depois disso usa o que está guardado

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

function doCache(resp) {
  // marca a resposta guardada para a página avisar que está sem internet
  return resp.blob().then(function (b) {
    var h = new Headers(resp.headers); h.set('X-Portal-Cache', '1');
    return new Response(b, { status: resp.status, headers: h });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  var meu = url.origin === location.origin;
  var pagina = meu && (url.pathname === '/portal' || url.pathname === '/portal/');
  var dados = meu && /^\\/api\\/portal\\/(eu|fazenda)$/.test(url.pathname);
  var lib = /^https:\\/\\/cdnjs\\.cloudflare\\.com\\/ajax\\/libs\\/leaflet\\//.test(req.url);
  if (pagina || dados) {
    var chave = pagina ? '/portal' : url.pathname + url.search;
    e.respondWith(new Promise(function (ok, falha) {
      var feito = false;
      var guardado = function () {
        return caches.match(chave).then(function (c) { return c ? doCache(c) : null; });
      };
      var rede = fetch(req).then(function (r) {
        if (r.ok) { var copia = r.clone(); caches.open(CACHE).then(function (c) { c.put(chave, copia); }); }
        return r;
      });
      rede.then(function (r) { if (!feito) { feito = true; ok(r); } }).catch(function () {
        guardado().then(function (c) { if (!feito) { feito = true; c ? ok(c) : falha(new Error('sem internet')); } });
      });
      setTimeout(function () {
        if (feito) return;
        guardado().then(function (c) { if (c && !feito) { feito = true; ok(c); } });
      }, ESPERA);
    }));
    return;
  }
  if (lib) {
    e.respondWith(caches.match(req).then(function (r) {
      return r || fetch(req).then(function (resp) {
        if (resp.ok) { var copia = resp.clone(); caches.open(CACHE).then(function (c) { c.put(req, copia); }); }
        return resp;
      });
    }));
  }
});

self.addEventListener('push', function (e) {
  var m = {};
  try { m = e.data ? e.data.json() : {}; } catch (err) { m = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(m.title || 'AMVS Fazenda', {
    body: m.body || '', tag: m.tag || 'aviso', renotify: true,
    icon: '/icon-192.png', badge: '/icon-192.png', data: { url: m.url || '/portal' }
  }));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || '/portal';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (abertas) {
    for (var i = 0; i < abertas.length; i++) {
      if (new URL(abertas[i].url).pathname.indexOf('/portal') === 0) { abertas[i].postMessage({ abrir: 'fazer' }); return abertas[i].focus(); }
    }
    return self.clients.openWindow(url);
  }));
});
`;
