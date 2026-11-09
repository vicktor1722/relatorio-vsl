/* ============================================================
   quadros.js — quadros prontos (painel e portal sem recalcular a cada abertura)
   Cada quadro pesado (Fazendas hoje, Plantio das áreas, custo, colheita, portal da fazenda) é montado
   uma vez e guardado no cache do Cloudflare (não usa o banco). A chave leva a "versão dos dados":
   todo lançamento (plantio, recomendação, estoque, aplicação, cadastro) sobe a versão e os quadros
   antigos deixam de ser usados. Além disso cada quadro vence sozinho (tempo e mercado mudam).
   Sem cache (endereço workers.dev ou falha), o quadro é montado na hora, como antes.
   ============================================================ */

const CHAVE = 'ver:dados';

// uma leitura pequena por quadro aberto (sem memória entre acessos: logo depois de um lançamento o quadro já sai novo)
export async function versaoDados(env) {
  try { const r = await env.DB.prepare('SELECT valor FROM config WHERE chave = ?').bind(CHAVE).first(); return r ? String(r.valor) : '0'; }
  catch (e) { return '0'; }
}

export async function mudouDados(env) {
  await env.DB.prepare("INSERT INTO config (chave, valor) VALUES (?, '1') ON CONFLICT(chave) DO UPDATE SET valor = CAST(CAST(valor AS INTEGER) + 1 AS TEXT)").bind(CHAVE).run();
}

// lançamentos que mudam o que os quadros mostram (envio de fotos e relatórios não entra: não muda os quadros)
export function mudaQuadros(rota, metodo) {
  if (metodo === 'GET' || metodo === 'HEAD' || metodo === 'OPTIONS') return false;
  if (/^\/api\/portal\/(entrar|push|foto)/.test(rota)) return false;
  return rota.startsWith('/api/agro/') || rota.startsWith('/api/portal/') || rota === '/api/fazenda' || rota === '/api/produtor' ||
    rota.startsWith('/api/admin/fazenda') || rota === '/api/admin/modulos' || rota === '/api/painel/calibracao' || rota.startsWith('/api/estoque');
}

const JSON_CAB = { 'Content-Type': 'application/json; charset=utf-8' };

/* devolve o quadro pronto ou monta (montar() → objeto) e guarda.
   chave: o que identifica o quadro (rota + conta + parâmetros); ttl em segundos. */
export async function quadroPronto(env, ctx, req, chave, ttl, montar) {
  const cache = typeof caches !== 'undefined' && caches.default ? caches.default : null;
  let url = null;
  if (cache) {
    try {
      const v = await versaoDados(env);
      url = new URL('/__quadro/' + encodeURIComponent(chave) + '?v=' + encodeURIComponent(v), req.url).toString();
      const pronto = await cache.match(url);
      if (pronto) return new Response(await pronto.text(), { headers: Object.assign({ 'Cache-Control': 'no-store', 'X-Quadro': 'pronto' }, JSON_CAB) });
    } catch (e) { url = null; }
  }
  const corpo = await montar();
  if (corpo instanceof Response) return corpo;   // erro ou resposta pronta da própria rota
  const txt = JSON.stringify(corpo);
  if (cache && url && corpo && !corpo.erro) {
    const guardar = cache.put(url, new Response(txt, { headers: Object.assign({ 'Cache-Control': 'public, max-age=' + ttl }, JSON_CAB) })).catch(() => {});
    if (ctx && ctx.waitUntil) ctx.waitUntil(guardar); else await guardar;
  }
  return new Response(txt, { headers: Object.assign({ 'Cache-Control': 'no-store', 'X-Quadro': 'novo' }, JSON_CAB) });
}
