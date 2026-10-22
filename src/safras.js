/* ============================================================
   safras.js — safra sempre no padrão "2026/2027"
   A lista já vem pronta para escolher (ninguém digita safra), e os dados
   antigos ("2026/27", "2026-27") são acertados uma vez por instância do Worker.
   ============================================================ */

// "2026/27", "2026-27", "2026 / 2027" → "2026/2027"; o resto fica como está
export function safraPadrao(s) {
  return String(s == null ? '' : s).trim()
    .replace(/^(\d{4})\s*[\/-]\s*(\d{2}|\d{4})$/, (m, a, b) => a + '/' + (b.length === 2 ? a.slice(0, 2) + b : b));
}

// safra em andamento: a partir de julho já é a do ano seguinte (2026/2027 começa no plantio de 2026)
export function safraAtual(agora) {
  const d = new Date((agora || Date.now()) - 4 * 3600 * 1000);   // horário de Mato Grosso
  const a = d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return a + '/' + (a + 1);
}

// lista pronta: a safra anterior, a atual e as três seguintes
export function safrasProntas(agora) {
  const a = Number(safraAtual(agora).slice(0, 4));
  const l = [];
  for (let i = a - 1; i <= a + 3; i++) l.push(i + '/' + (i + 1));
  return l;
}

let padronizado = false;
export async function padronizarSafras(env) {
  if (padronizado) return;
  padronizado = true;
  try {
    const tabelas = [['safras', 'nome'], ['relatorios', 'safra'], ['plantio', 'safra'], ['recomendacoes', 'safra']];
    for (const [tab, col] of tabelas) {
      let vals = [];
      try { vals = (await env.DB.prepare(`SELECT DISTINCT ${col} AS v FROM ${tab}`).all()).results || []; }
      catch (e) { continue; }   // tabela ainda não criada
      for (const { v } of vals) {
        const n = safraPadrao(v);
        if (!v || n === v) continue;
        await env.DB.prepare(`UPDATE OR IGNORE ${tab} SET ${col} = ? WHERE ${col} = ?`).bind(n, v).run();
        // plantio: o que não mudou é talhão que já tinha a linha no padrão (lançada depois); fica a do padrão
        if (tab === 'plantio') await env.DB.prepare('DELETE FROM plantio WHERE safra = ?').bind(v).run();
      }
    }
    // a mesma safra duas vezes na conta depois de padronizar
    await env.DB.prepare('DELETE FROM safras WHERE rowid NOT IN (SELECT MIN(rowid) FROM safras GROUP BY usuario_id, nome)').run();
  } catch (e) {
    padronizado = false;   // tenta de novo na próxima requisição
  }
}
