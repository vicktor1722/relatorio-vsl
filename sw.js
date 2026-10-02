/* Service worker — o app abre sem internet, mas sempre pega a versão nova quando há rede.
   HTML: rede primeiro (cai para o cache se estiver offline).
   Ícones e manifesto: cache primeiro. */
const CACHE = 'relatorio-vsl-v3';
const ESTATICOS = ['./manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ESTATICOS.concat(['./', './index.html'])).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  const ehPagina = e.request.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html');

  if (ehPagina) {
    e.respondWith(
      fetch(e.request)
        .then(resp => {
          const copia = resp.clone();
          if (resp.ok) caches.open(CACHE).then(c => c.put('./index.html', copia));
          return resp;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
      const copia = resp.clone();
      if (resp.ok) caches.open(CACHE).then(c => c.put(e.request, copia));
      return resp;
    }))
  );
});
