/* Service worker — o app abre sem internet, mas sempre pega a versão nova quando há rede.
   Só cuida do próprio app (/ e /index.html) e dos ícones. Rotas do servidor
   (/r/*, /admin, /api/*, /img/*, /oauth/*) passam direto, sem cache.
   O Safari recusa resposta "redirecionada" vinda do service worker; por isso toda
   página que entra no cache (ou sai dele) é recriada limpa por limpar(). */
const CACHE = 'relatorio-vsl-v7';
const CHAVE_APP = '/__app-shell';
const ESPERA_MS = 3500;   // se a rede não responder nisso, abre pelo cache
const ESTATICOS = ['./manifest.webmanifest', './icon-192.png', './icon-512.png'];
const DO_SERVIDOR = /^\/(r|api|img|oauth|admin)(\/|$)/;

// copia a resposta sem a marca de redirecionamento
async function limpar(resp) {
  const corpo = await resp.clone().blob();
  return new Response(corpo, { status: resp.status, statusText: resp.statusText, headers: resp.headers });
}

async function guardarApp(resp) {
  if (!resp || !resp.ok || resp.type === 'opaqueredirect') return;
  const c = await caches.open(CACHE);
  await c.put(CHAVE_APP, await limpar(resp));
}

async function appDoCache() {
  const r = await caches.match(CHAVE_APP);
  return r ? limpar(r) : null;   // limpa de novo: protege contra cache antigo já marcado
}

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    try {
      const c = await caches.open(CACHE);
      await c.addAll(ESTATICOS).catch(() => {});
      const r = await fetch('/', { redirect: 'follow', cache: 'no-store' });
      await guardarApp(r);
    } catch (err) { /* instala mesmo sem rede */ }
    await self.skipWaiting();
  })());
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
  if (DO_SERVIDOR.test(url.pathname)) return;           // não é do app: deixa a rede cuidar

  const ehApp = url.pathname === '/' || url.pathname === '/index.html';

  if (e.request.mode === 'navigate' || ehApp) {
    e.respondWith((async () => {
      // rede primeiro, mas sem travar: se demorar ou falhar, entrega o app guardado
      const daRede = fetch(e.request).then(async resp => {
        if (resp && resp.ok && ehApp) guardarApp(resp.clone()).catch(() => {});
        return resp;
      });
      daRede.catch(() => {});
      const relogio = new Promise(ok => setTimeout(() => ok('demorou'), ESPERA_MS));
      try {
        const r = await Promise.race([daRede, relogio]);
        if (r !== 'demorou' && r) {
          // redirecionamento (ex.: /index.html -> /) segue direto para o navegador
          if (r.ok && !r.redirected) return r;
          if (r.type === 'opaqueredirect' || (r.status >= 300 && r.status < 400)) return r;
          if (r.ok) return limpar(r);
        }
      } catch (err) { /* sem rede */ }
      const c = await appDoCache();
      if (c) return c;
      return daRede;
    })());
    return;
  }

  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
      if (resp.ok && !resp.redirected) { const copia = resp.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); }
      return resp;
    }))
  );
});
