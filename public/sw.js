/* Service worker — o app abre sem internet, mas sempre pega a versão nova quando há rede.
   HTML: rede primeiro (cai para o cache se estiver offline).
   Ícones e manifesto: cache primeiro. */
const CACHE = 'relatorio-vsl-v4';
const ESPERA_MS = 3500;   // se a rede não responder nisso, abre pelo cache
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
    e.respondWith((async () => {
      const doCache = () => caches.match('./index.html').then(r => r || caches.match('./'));

      const daRede = fetch(e.request).then(resp => {
        if (resp && resp.ok) {
          const copia = resp.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copia));
        }
        return resp;
      });

      // rede primeiro, mas sem travar: se demorar, entrega o cache
      const relogio = new Promise(ok => setTimeout(() => ok('demorou'), ESPERA_MS));
      try {
        const r = await Promise.race([daRede, relogio]);
        if (r !== 'demorou' && r && r.ok) return r;
      } catch (err) { /* sem rede */ }
      const c = await doCache();
      if (c) return c;
      return daRede;
    })());
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
