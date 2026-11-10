/* ============================================================
   renomeio.js — troca de nome de talhões de uma fazenda (uma vez só)
   Recanto do Pindaituba: TH-128 → TH-127 e TH-129 → TH-128 (pedido do consultor, 10/11/2026).
   Muda em todo lugar onde o nome do talhão fica guardado: mapa (KML) da fazenda, mapa copiado em cada
   relatório, registros (fotos) dos relatórios, plantio, colheita e recomendações (talhões, aplicados,
   datas, partes, parciais e registros do operador). Troca simultânea (com nome provisório), para o
   TH-129 não virar TH-127. Se a fazenda já tiver um TH-127, não mexe em nada e registra o motivo.
   O app recebe a lista de trocas no /api/cadastro e ajusta as cópias guardadas no aparelho.
   ============================================================ */
import { mudouDados } from './quadros.js';

const CHAVE = 'renomeio:pindaituba-127';
export const CHAVE_LISTA = 'renomeios:talhoes';
const MAPA = { 'TH-128': 'TH-127', 'TH-129': 'TH-128' };
const TMP = '__renomeio_TH-127__';

const troca = (s) => (Object.prototype.hasOwnProperty.call(MAPA, s) ? MAPA[s] : s);

// troca nomes de talhão em qualquer JSON: valores iguais ao nome e chaves de objeto iguais ao nome
function trocarFundo(v) {
  if (typeof v === 'string') return troca(v);
  if (Array.isArray(v)) return v.map(trocarFundo);
  if (v && typeof v === 'object') {
    const o = {};
    Object.keys(v).forEach((k) => { o[troca(k)] = trocarFundo(v[k]); });
    return o;
  }
  return v;
}
function trocarGeo(gj) {
  let n = 0;
  ((gj && gj.features) || []).forEach((ft) => {
    const p = ft && ft.properties; if (!p) return;
    ['nome', 'name', 'Name', 'NOME'].forEach((k) => { if (typeof p[k] === 'string' && MAPA[p[k]]) { p[k] = MAPA[p[k]]; n++; } });
  });
  return n;
}
const nomesDe = (gj) => ((gj && gj.features) || []).map((ft) => String((ft && ft.properties && ft.properties.nome) || ''));

// troca numa coluna de texto (talhão) em duas etapas, sem bater na chave única (fazenda, safra, talhão)
function trocaColuna(env, tabela, onde, args) {
  return [
    env.DB.prepare(`UPDATE ${tabela} SET talhao = ? WHERE talhao = 'TH-128' AND ${onde}`).bind(TMP, ...args),
    env.DB.prepare(`UPDATE ${tabela} SET talhao = 'TH-128' WHERE talhao = 'TH-129' AND ${onde}`).bind(...args),
    env.DB.prepare(`UPDATE ${tabela} SET talhao = 'TH-127' WHERE talhao = ? AND ${onde}`).bind(TMP, ...args)
  ];
}

export async function renomearTalhoesPindaituba(env) {
  const feito = await env.DB.prepare('SELECT valor FROM config WHERE chave = ?').bind(CHAVE).first().catch(() => null);
  if (feito) return JSON.parse(feito.valor);
  const out = { em: new Date().toISOString(), mapa: MAPA, fazendas: [] };
  const { results } = await env.DB.prepare("SELECT id, nome, usuario_id, talhoes FROM fazendas WHERE upper(nome) LIKE '%PINDAITUBA%'").all();
  const lista = [];
  for (const f of results || []) {
    let gj = null; try { gj = JSON.parse(f.talhoes || 'null'); } catch (e) { gj = null; }
    const nomes = nomesDe(gj), r = { id: f.id, nome: f.nome };
    if (!nomes.includes('TH-128') && !nomes.includes('TH-129')) { r.pulada = 'mapa sem TH-128/TH-129'; out.fazendas.push(r); continue; }
    if (nomes.includes('TH-127')) { r.pulada = 'o mapa já tem um TH-127: nada foi trocado'; out.fazendas.push(r); continue; }
    const cmds = [];
    r.mapa = trocarGeo(gj);
    cmds.push(env.DB.prepare("UPDATE fazendas SET talhoes = ?, resumo = NULL, atualizado_em = datetime('now') WHERE id = ?").bind(JSON.stringify(gj), f.id));
    // relatórios da fazenda: mapa copiado e talhão de cada registro
    const rels = (await env.DB.prepare('SELECT id, talhoes FROM relatorios WHERE fazenda_id = ?').bind(f.id).all()).results || [];
    r.relatorios = 0;
    rels.forEach((x) => {
      let g = null; try { g = JSON.parse(x.talhoes || 'null'); } catch (e) { g = null; }
      if (g && trocarGeo(g)) { r.relatorios++; cmds.push(env.DB.prepare('UPDATE relatorios SET talhoes = ? WHERE id = ?').bind(JSON.stringify(g), x.id)); }
    });
    const reg = await env.DB.prepare("SELECT COUNT(*) n FROM itens WHERE talhao IN ('TH-128','TH-129') AND relatorio_id IN (SELECT id FROM relatorios WHERE fazenda_id = ?)").bind(f.id).first();
    r.registros = reg ? reg.n : 0;
    cmds.push(...trocaColuna(env, 'itens', 'relatorio_id IN (SELECT id FROM relatorios WHERE fazenda_id = ?)', [f.id]));
    // plantio e colheita (chave fazenda + safra + talhão)
    const pl = await env.DB.prepare("SELECT COUNT(*) n FROM plantio WHERE fazenda_id = ? AND talhao IN ('TH-128','TH-129')").bind(f.id).first().catch(() => null);
    const co = await env.DB.prepare("SELECT COUNT(*) n FROM colheita WHERE fazenda_id = ? AND talhao IN ('TH-128','TH-129')").bind(f.id).first().catch(() => null);
    r.plantio = pl ? pl.n : 0; r.colheita = co ? co.n : 0;
    cmds.push(...trocaColuna(env, 'plantio', 'fazenda_id = ?', [f.id]), ...trocaColuna(env, 'colheita', 'fazenda_id = ?', [f.id]));
    // recomendações: talhões, aplicados, datas, partes, parciais e registros do operador
    const recs = (await env.DB.prepare('SELECT id, dados FROM recomendacoes WHERE fazenda_id = ?').bind(f.id).all()).results || [];
    r.recomendacoes = 0;
    recs.forEach((x) => {
      const antes = x.dados || '{}';
      let d; try { d = JSON.parse(antes); } catch (e) { return; }
      const novo = JSON.stringify(trocarFundo(d));
      if (novo !== JSON.stringify(d)) { r.recomendacoes++; cmds.push(env.DB.prepare("UPDATE recomendacoes SET dados = ?, atualizado_em = datetime('now') WHERE id = ?").bind(novo, x.id)); }
    });
    await env.DB.batch(cmds);
    lista.push({ fazenda_id: f.id, mapa: MAPA, chave: CHAVE });
    out.fazendas.push(r);
  }
  // o app ajusta as cópias guardadas no aparelho (mapa dos relatórios e talhão dos registros)
  if (lista.length) {
    let ant = [];
    try { const a = await env.DB.prepare('SELECT valor FROM config WHERE chave = ?').bind(CHAVE_LISTA).first(); ant = a ? JSON.parse(a.valor) : []; } catch (e) { ant = []; }
    await env.DB.prepare('INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor').bind(CHAVE_LISTA, JSON.stringify(ant.concat(lista))).run();
    await mudouDados(env).catch(() => {});   // painel e portal remontam os quadros
  }
  await env.DB.prepare('INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor').bind(CHAVE, JSON.stringify(out)).run();
  return out;
}

export async function listaRenomeios(env) {
  try { const a = await env.DB.prepare('SELECT valor FROM config WHERE chave = ?').bind(CHAVE_LISTA).first(); return a ? JSON.parse(a.valor) : []; } catch (e) { return []; }
}
