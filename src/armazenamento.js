/* Raio-X do armazenamento (só totais, sem nomes nem arquivos): o que ocupa espaço no R2 e no banco.
   GET /api/status/armazenamento — guarda o resultado por 30 min (varrer o R2 custa leituras). */
const CHAVE = 'arm:raio_x';
const VALIDADE = 30 * 60e3;
const MB = (b) => Math.round((Number(b) || 0) / 1048576 * 10) / 10;

function classe(k) {
  if (/\.capa\.jpg$/i.test(k)) return 'capa';
  if (k.startsWith('aplic/')) return 'foto_aplicacao';
  const ext = (k.match(/\.([a-z0-9]+)$/i) || [])[1] || '';
  if (/^(jpe?g|png|webp|heic)$/i.test(ext)) return 'foto';
  if (/^(mp4|mov)$/i.test(ext)) return 'video';
  if (/^(m4a|mp3|ogg|aac|wav)$/i.test(ext)) return 'audio';
  if (/^webm$/i.test(ext)) return 'webm';   // vídeo ou áudio do Android
  return 'outro';
}

export async function raioX(env, forcar) {
  if (!forcar) {
    try { const c = await env.DB.prepare('SELECT valor FROM config WHERE chave = ?').bind(CHAVE).first(); if (c) { const v = JSON.parse(c.valor); if (Date.now() - new Date(v.em).getTime() < VALIDADE) return v; } } catch (e) { /* refaz */ }
  }
  const out = { em: new Date().toISOString() };
  // banco: registros dos relatórios por tipo
  const porTipo = (await env.DB.prepare(`SELECT tipo, COUNT(*) n, COALESCE(SUM(bytes),0) b, COALESCE(MAX(bytes),0) mx,
      SUM(CASE WHEN midia IS NOT NULL AND midia != '' THEN 1 ELSE 0 END) na_nuvem FROM itens GROUP BY tipo`).all()).results || [];
  out.banco_por_tipo = porTipo.map((r) => ({ tipo: r.tipo, qtd: r.n, mb: MB(r.b), media_kb: r.n ? Math.round(r.b / r.n / 1024) : 0, maior_mb: MB(r.mx), na_nuvem: r.na_nuvem }));
  const porMes = (await env.DB.prepare(`SELECT substr(capturado_em,1,7) m, tipo, COUNT(*) n, COALESCE(SUM(bytes),0) b FROM itens
      WHERE capturado_em IS NOT NULL GROUP BY m, tipo ORDER BY m`).all()).results || [];
  const meses = {};
  porMes.forEach((r) => { const x = meses[r.m] || (meses[r.m] = { mes: r.m, mb: 0 }); x[r.tipo] = MB(r.b); x.mb = Math.round((x.mb + MB(r.b)) * 10) / 10; });
  out.banco_por_mes = Object.values(meses);
  const faixas = (await env.DB.prepare(`SELECT CASE WHEN bytes < 1048576 THEN 'a <1 MB' WHEN bytes < 5242880 THEN 'b 1-5 MB' WHEN bytes < 20971520 THEN 'c 5-20 MB'
      WHEN bytes < 52428800 THEN 'd 20-50 MB' ELSE 'e 50+ MB' END f, tipo, COUNT(*) n, SUM(bytes) b FROM itens WHERE bytes > 0 GROUP BY f, tipo ORDER BY f`).all()).results || [];
  out.faixas = faixas.map((r) => ({ faixa: r.f.slice(2), tipo: r.tipo, qtd: r.n, mb: MB(r.b) }));
  const dur = await env.DB.prepare(`SELECT COUNT(*) n, COALESCE(SUM(duracao_s),0) s, COALESCE(SUM(bytes),0) b FROM itens WHERE tipo = 'video' AND duracao_s > 0`).first();
  out.video = { qtd_com_duracao: dur.n, minutos: Math.round(dur.s / 60), mb_por_minuto: dur.s ? Math.round(MB(dur.b) / (dur.s / 60) * 10) / 10 : 0 };
  // R2: tudo o que está guardado de fato (inclui capas e fotos das aplicações, que o contador do app não soma)
  if (env.MIDIA) {
    const r2 = {}, idsNoBanco = new Set();
    ((await env.DB.prepare("SELECT midia FROM itens WHERE midia IS NOT NULL AND midia != ''").all()).results || []).forEach((r) => idsNoBanco.add(r.midia));
    let cursor, paginas = 0, total = 0, objetos = 0, orfaos = { qtd: 0, b: 0 };
    do {
      const l = await env.MIDIA.list({ cursor, limit: 1000 });
      (l.objects || []).forEach((o) => {
        const c = classe(o.key), x = r2[c] || (r2[c] = { qtd: 0, b: 0 });
        x.qtd++; x.b += o.size; total += o.size; objetos++;
        if ((c === 'foto' || c === 'video' || c === 'audio' || c === 'webm') && !idsNoBanco.has(o.key)) { orfaos.qtd++; orfaos.b += o.size; }
      });
      cursor = l.truncated ? l.cursor : null;
      paginas++;
    } while (cursor && paginas < 50);
    out.r2 = { total_mb: MB(total), objetos, completo: !cursor,
      por_classe: Object.keys(r2).map((k) => ({ classe: k, qtd: r2[k].qtd, mb: MB(r2[k].b), media_kb: Math.round(r2[k].b / r2[k].qtd / 1024) })).sort((a, b) => b.mb - a.mb),
      sem_registro_no_banco: { qtd: orfaos.qtd, mb: MB(orfaos.b) } };
  }
  // banco D1 (tamanho aproximado das tabelas maiores)
  try {
    const t = await env.DB.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE type='table'").first();
    out.banco_tabelas = t.n;
  } catch (e) { /* sem acesso */ }
  try { await env.DB.prepare('INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor').bind(CHAVE, JSON.stringify(out)).run(); } catch (e) { /* sem cache */ }
  return out;
}
