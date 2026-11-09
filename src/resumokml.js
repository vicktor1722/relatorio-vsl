/* ============================================================
   resumokml.js — resumo do mapa da fazenda (1 a 3 KB no lugar do KML inteiro)
   O KML guarda o desenho de cada talhão (milhares de pontos). Para painel, portal, custo e colheita
   basta o nome e a área de cada talhão e o centro da fazenda: isso fica pronto em fazendas.resumo,
   calculado ao salvar o KML. "len" é o tamanho do KML de quando o resumo foi feito: se o KML mudou
   por outro caminho, o resumo deixa de valer e é refeito.
   ============================================================ */

let colunaOk = false;
async function garantirColuna(env) {
  if (colunaOk) return;
  try { await env.DB.prepare('ALTER TABLE fazendas ADD COLUMN resumo TEXT').run(); } catch (e) { /* já existe */ }
  colunaOk = true;
}
const semColuna = (e) => /no such column: (f\.)?resumo|has no column named resumo/i.test(String((e && e.message) || e));

// roda a consulta; se a coluna ainda não existe (banco antigo), cria e tenta de novo
export async function comResumo(env, fn) {
  try { return await fn(); }
  catch (e) { if (!semColuna(e)) throw e; colunaOk = false; await garantirColuna(env); return await fn(); }
}

export function calcularResumo(talhoes) {
  const s = typeof talhoes === 'string' ? talhoes : (talhoes ? JSON.stringify(talhoes) : '');
  const out = { v: 1, len: s.length, n: 0, total: 0, areas: {}, centro: null };
  if (!s) return out;
  let gj = null;
  try { gj = typeof talhoes === 'string' ? JSON.parse(talhoes) : talhoes; } catch (e) { return out; }
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const passa = (c) => {
    if (!Array.isArray(c)) return;
    if (typeof c[0] === 'number') { if (c[0] < x0) x0 = c[0]; if (c[0] > x1) x1 = c[0]; if (c[1] < y0) y0 = c[1]; if (c[1] > y1) y1 = c[1]; }
    else for (let i = 0; i < c.length; i++) passa(c[i]);
  };
  ((gj && gj.features) || []).forEach((ft) => {
    const p = (ft && ft.properties) || {};
    if (p.nome) { const ha = Number(p.area_ha) || 0; out.areas[String(p.nome)] = ha; out.total += ha; out.n++; }
    if (ft && ft.geometry && ft.geometry.coordinates) passa(ft.geometry.coordinates);
  });
  out.total = Math.round(out.total * 100) / 100;
  if (x0 < Infinity && Math.abs(y0) <= 90) out.centro = { lat: Math.round((y0 + y1) / 2 * 1000) / 1000, lon: Math.round((x0 + x1) / 2 * 1000) / 1000 };
  return out;
}

// resumo guardado e ainda válido (mesmo tamanho de KML), ou null
export function lerResumo(resumo, kmlLen) {
  if (!resumo) return null;
  try {
    const r = typeof resumo === 'string' ? JSON.parse(resumo) : resumo;
    if (!r || r.v !== 1 || !r.areas) return null;
    if (kmlLen != null && Number(kmlLen || 0) !== Number(r.len || 0)) return null;
    return r;
  } catch (e) { return null; }
}

/* resumo de várias fazendas de uma vez. rows: [{ id, resumo, kml_len }] (sem o KML).
   As que estão sem resumo válido: busca o KML só delas, calcula e guarda (uma vez). */
export async function resumosDe(env, rows) {
  const out = {}, faltam = [];
  (rows || []).forEach((r) => {
    if (!r || !r.id) return;
    if (!Number(r.kml_len || 0)) { out[r.id] = { v: 1, len: 0, n: 0, total: 0, areas: {}, centro: null }; return; }
    const ok = lerResumo(r.resumo, r.kml_len);
    if (ok) out[r.id] = ok; else faltam.push(r.id);
  });
  for (let i = 0; i < faltam.length; i += 20) {
    const ids = faltam.slice(i, i + 20);
    const { results } = await env.DB.prepare('SELECT id, talhoes FROM fazendas WHERE id IN (' + ids.map(() => '?').join(',') + ')').bind(...ids).all();
    const upd = [];
    (results || []).forEach((f) => {
      const r = calcularResumo(f.talhoes || '');
      out[f.id] = r;
      upd.push(env.DB.prepare('UPDATE fazendas SET resumo = ? WHERE id = ?').bind(JSON.stringify(r), f.id));
    });
    if (upd.length) { try { await comResumo(env, () => env.DB.batch(upd)); } catch (e) { /* fica para a próxima */ } }
  }
  return out;
}

// fazenda lida sem o KML (id, resumo, kml_len…): acrescenta o centro do mapa para o tempo e o mercado
export async function comCentro(env, f) {
  if (!f) return f;
  const r = (await resumosDe(env, [f]))[f.id];
  f.centro = r ? r.centro : null;
  return f;
}
const COLS_LOCAL = 'id, nome, municipio, uf, resumo, length(talhoes) AS kml_len';
// lê uma fazenda com o que o tempo, a chuva e o mercado precisam (sem o KML)
export async function fazendaLocal(env, id) {
  const f = await comResumo(env, () => env.DB.prepare('SELECT ' + COLS_LOCAL + ' FROM fazendas WHERE id = ?').bind(id).first());
  return comCentro(env, f);
}

// nome → hectares dos talhões de uma fazenda (sem abrir o KML); dono opcional confere a conta
export async function areasDaFazenda(env, id, dono) {
  const f = await comResumo(env, () => (dono
    ? env.DB.prepare('SELECT id, nome, resumo, length(talhoes) AS kml_len FROM fazendas WHERE id = ? AND usuario_id = ?').bind(id, dono)
    : env.DB.prepare('SELECT id, nome, resumo, length(talhoes) AS kml_len FROM fazendas WHERE id = ?').bind(id)).first());
  if (!f) return null;
  const r = (await resumosDe(env, [f]))[f.id];
  return { nome: f.nome, areas: (r && r.areas) || {} };
}

// resumo de uma fazenda já lida com o KML (caminhos que precisam do desenho também)
export function resumoDaLinha(f) {
  return lerResumo(f && f.resumo, f && f.talhoes != null ? String(f.talhoes || '').length : null) || calcularResumo((f && f.talhoes) || '');
}

/* preenche os resumos que faltam, em lotes pequenos (cron e /api/status/resumos).
   Limite por tamanho de KML para caber no tempo de processamento de uma chamada. */
export async function preencherResumos(env, limiteBytes) {
  await garantirColuna(env);
  const lim = limiteBytes || 600000;
  // só as que faltam (resumo vazio ou de um KML de outro tamanho), sem ler os resumos prontos
  const { results } = await env.DB.prepare(`SELECT id, length(talhoes) AS kml_len FROM fazendas
      WHERE talhoes IS NOT NULL AND talhoes != '' AND (resumo IS NULL OR resumo = '' OR json_extract(resumo, '$.len') IS NOT length(talhoes))
      ORDER BY length(talhoes)`).all();
  const faltam = results || [];
  let usado = 0, feitos = 0;
  for (const r of faltam) {
    if (feitos > 0 && usado + Number(r.kml_len) > lim) break;
    const f = await env.DB.prepare('SELECT talhoes FROM fazendas WHERE id = ?').bind(r.id).first();
    const res = calcularResumo((f && f.talhoes) || '');
    await env.DB.prepare('UPDATE fazendas SET resumo = ? WHERE id = ?').bind(JSON.stringify(res), r.id).run();
    usado += Number(r.kml_len); feitos++;
  }
  return { feitos, faltam: faltam.length - feitos };
}
