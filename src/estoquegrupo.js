/* Estoque compartilhado: fazendas do mesmo produtor que usam um estoque só (a compra é geral).
   Fica no banco (config "estoque_grupos") como { idDoGrupo: [ids das fazendas] }.
   As entradas de qualquer fazenda do grupo valem para todas e as recomendações de todas dão baixa. */
const CHAVE = 'estoque_grupos';

export async function lerGrupos(env) {
  try { const r = await env.DB.prepare('SELECT valor FROM config WHERE chave = ?').bind(CHAVE).first(); return r ? JSON.parse(r.valor) || {} : {}; }
  catch (e) { return {}; }
}

// fazenda → ids do grupo dela (só os grupos com mais de uma fazenda)
export async function mapaGrupos(env) {
  const g = await lerGrupos(env), m = {};
  Object.keys(g).forEach((gid) => { const l = (g[gid] || []).filter(Boolean); if (l.length > 1) l.forEach((f) => { m[f] = l; }); });
  return m;
}

export async function grupoDaFazenda(env, fid) {
  const m = await mapaGrupos(env), ids = m[fid];
  return ids ? { id: ids[0], ids } : { id: fid, ids: [fid] };
}

export async function salvarGrupo(env, gid, ids) {
  const g = await lerGrupos(env);
  // uma fazenda fica em um grupo só
  Object.keys(g).forEach((k) => { if (k !== gid) g[k] = (g[k] || []).filter((f) => ids.indexOf(f) < 0); });
  g[gid] = [...new Set([gid].concat(ids))];
  await env.DB.prepare('INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor').bind(CHAVE, JSON.stringify(g)).run();
  return g[gid];
}
