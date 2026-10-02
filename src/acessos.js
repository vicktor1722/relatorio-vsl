/* ============================================================
   acessos.js — conta quantas vezes cada relatório público foi aberto
   A tabela é criada sozinha na primeira chamada (sem migração manual).
   ============================================================ */

let pronta = null;

function garantirTabela(env) {
  if (!pronta) {
    pronta = env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS acessos (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        relatorio_id TEXT NOT NULL,
        visitante    TEXT,
        em           TEXT DEFAULT (datetime('now'))
      )`),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS acessos_rel ON acessos (relatorio_id, em)')
    ]).catch((e) => { pronta = null; throw e; });
  }
  return pronta;
}

// pré-visualizadores de link (WhatsApp, Telegram…) e robôs não contam como leitura
const ROBO = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|slack|discord|linkedin|curl|wget|python-requests|headless/i;

async function impressao(texto) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buf)).slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function registrarAcesso(env, req, relId) {
  try {
    const ua = req.headers.get('user-agent') || '';
    if (ROBO.test(ua)) return;
    const ip = req.headers.get('cf-connecting-ip') || '';
    await garantirTabela(env);
    // guarda só uma impressão digital (não o IP) para contar visitantes diferentes
    const visitante = await impressao(ip + '|' + ua);
    await env.DB.prepare('INSERT INTO acessos (relatorio_id, visitante) VALUES (?, ?)')
      .bind(relId, visitante).run();
  } catch (e) { /* contar acesso nunca pode derrubar a página do relatório */ }
}

// { id: { total, visitantes, ultimo } }
export async function contagemAcessos(env) {
  try {
    await garantirTabela(env);
    const { results } = await env.DB.prepare(`
      SELECT relatorio_id AS id, COUNT(*) AS total,
             COUNT(DISTINCT visitante) AS visitantes, MAX(em) AS ultimo
        FROM acessos GROUP BY relatorio_id
    `).all();
    const mapa = {};
    (results || []).forEach((r) => { mapa[r.id] = r; });
    return mapa;
  } catch (e) {
    return {};
  }
}
