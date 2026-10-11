/* ============================================================
   traducao.js — tradução automática (pt → en/es) das legendas e textos
   do relatório público. Usa o Workers AI (modelo m2m100) e guarda cada
   tradução no banco, então cada texto só é traduzido uma vez.
   ============================================================ */

const ALVO = { en: 'english', es: 'spanish' };
const MODELO = '@cf/meta/m2m100-1.2b';

// mesmo critério do navegador: quebras de linha padronizadas e sem espaço nas pontas
export const norm = (s) => String(s == null ? '' : s).replace(/\r\n?/g, '\n').trim();

let tabelaPronta = null;
function garantirTabela(env) {
  if (!tabelaPronta) {
    tabelaPronta = env.DB.prepare(`CREATE TABLE IF NOT EXISTS traducoes (
      chave     TEXT PRIMARY KEY,
      lang      TEXT NOT NULL,
      original  TEXT NOT NULL,
      texto     TEXT NOT NULL,
      criado_em TEXT DEFAULT (datetime('now'))
    )`).run().catch((e) => { tabelaPronta = null; throw e; });
  }
  return tabelaPronta;
}

async function chaveDe(lang, texto) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return lang + ':' + [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

// só os textos que o próprio relatório tem: o endereço não serve de tradutor aberto
export function textosDoRelatorio(rels, itens) {
  const set = new Set();
  (rels || []).forEach((r) => { set.add(norm(r.servico)); set.add(norm(r.observacoes)); });
  (itens || []).forEach((i) => set.add(norm(i.legenda)));
  return [...set].filter((t) => t && t.length <= 1500).slice(0, 300);
}

async function traduzirUm(env, texto, lang) {
  if (env.TRADUTOR_TESTE) return texto.split('\n').map((l) => (l.trim() ? '[' + lang + '] ' + l : l)).join('\n');
  // o modelo traduz melhor linha a linha
  const linhas = texto.split('\n');
  const saida = [];
  for (const l of linhas) {
    if (!l.trim()) { saida.push(l); continue; }
    const r = await env.AI.run(MODELO, { text: l, source_lang: 'portuguese', target_lang: ALVO[lang] });
    const t = r && (r.translated_text || (r.response && r.response.translated_text));
    if (!t) throw new Error('sem tradução');
    saida.push(String(t).trim());
  }
  return saida.join('\n');
}

export async function traduzirRelatorio(env, rels, itens, lang) {
  if (!ALVO[lang]) return { ok: true, lang, traducoes: {} };
  if (!env.AI && !env.TRADUTOR_TESTE) return { ok: true, lang, traducoes: {}, indisponivel: true };

  const textos = textosDoRelatorio(rels, itens);
  const chaves = await Promise.all(textos.map((t) => chaveDe(lang, t)));
  const mapa = {};
  const faltam = [];

  try {
    await garantirTabela(env);
    const achadas = {};
    for (let i = 0; i < chaves.length; i += 50) {
      const lote = chaves.slice(i, i + 50);
      const { results } = await env.DB.prepare(
        `SELECT chave, texto FROM traducoes WHERE chave IN (${lote.map(() => '?').join(',')})`).bind(...lote).all();
      (results || []).forEach((r) => { achadas[r.chave] = r.texto; });
    }
    textos.forEach((t, i) => { if (achadas[chaves[i]] != null) mapa[t] = achadas[chaves[i]]; else faltam.push(i); });
  } catch (e) {
    textos.forEach((t, i) => faltam.push(i));
  }

  // traduz o que falta, poucos de cada vez
  let falhou = false;
  const novos = [];
  for (let i = 0; i < faltam.length; i += 6) {
    await Promise.all(faltam.slice(i, i + 6).map(async (k) => {
      try {
        const t = await traduzirUm(env, textos[k], lang);
        mapa[textos[k]] = t;
        novos.push(k);
      } catch (e) { falhou = true; }
    }));
  }
  if (novos.length) {
    try {
      await garantirTabela(env);
      await env.DB.batch(novos.map((k) => env.DB.prepare(
        'INSERT OR REPLACE INTO traducoes (chave, lang, original, texto) VALUES (?,?,?,?)')
        .bind(chaves[k], lang, textos[k], mapa[textos[k]])));
    } catch (e) { /* sem guardar, só traduz de novo na próxima */ }
  }
  return { ok: true, lang, traducoes: mapa, parcial: falhou || undefined, indisponivel: (falhou && !Object.keys(mapa).length) || undefined };
}
