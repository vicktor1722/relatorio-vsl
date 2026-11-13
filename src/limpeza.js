/* ============================================================
   limpeza.js — correção pontual de dado (roda uma vez só)
   12/11/2026: uma observação "Protocolos:" subiu só com a primeira versão (T3, T4 e T5 vazios), sumiu do
   aparelho e o consultor escreveu de novo. O relatório ficou com as duas; ele pediu para tirar a antiga.
   O app não apaga registro que só existe na nuvem, então a antiga sai por aqui.
   Só apaga se achar EXATAMENTE um registro com todos os sinais da versão antiga e se a conta tiver a
   versão nova (completa). Em qualquer outro caso não mexe em nada e guarda o motivo.
   Resultado em /api/status/limpeza.
   ============================================================ */
import { salvarCalibracao } from './mercado.js';
const CHAVE = 'limpeza:protocolos-1211';

export async function apagarObservacaoAntiga(env) {
  const feito = await env.DB.prepare('SELECT valor FROM config WHERE chave = ?').bind(CHAVE).first().catch(() => null);
  if (feito) return JSON.parse(feito.valor);
  const out = { em: new Date().toISOString(), apagado: false };
  const { results } = await env.DB.prepare(`
    SELECT i.id, i.relatorio_id, i.capturado_em, i.legenda
    FROM itens i JOIN relatorios r ON r.id = i.relatorio_id
    WHERE i.tipo = 'texto'
      AND i.legenda LIKE '%Protocolos:%' AND i.legenda LIKE '%Tander.%'
      AND i.legenda NOT LIKE '%Sequencial%' AND i.legenda NOT LIKE '%Thunder%'
      AND i.capturado_em >= '2026-11-12' AND i.capturado_em < '2026-11-14'
      AND EXISTS (SELECT 1 FROM itens j JOIN relatorios r2 ON r2.id = j.relatorio_id
                  WHERE j.tipo = 'texto' AND j.id <> i.id AND r2.usuario_id = r.usuario_id
                    AND j.legenda LIKE '%Protocolos:%' AND j.legenda LIKE '%Sequencial 10 DAAP%' AND j.legenda LIKE '%Thunder%')`).all();
  // a versão antiga termina com os três protocolos ainda vazios
  const alvo = (results || []).filter((x) => /T3\s*\n\s*T4\s*\n\s*T5\s*$/.test(String(x.legenda || '')));
  out.achados = alvo.length;
  if (alvo.length === 1) {
    const x = alvo[0];
    await env.DB.prepare("DELETE FROM itens WHERE id = ? AND tipo = 'texto'").bind(x.id).run();
    out.apagado = true; out.id = x.id; out.relatorio_id = x.relatorio_id; out.capturado_em = x.capturado_em; out.tamanho = String(x.legenda).length;
  } else out.motivo = alvo.length ? 'mais de um registro parecido: nada foi apagado' : 'nenhum registro com os sinais da versão antiga';
  await env.DB.prepare('INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor').bind(CHAVE, JSON.stringify(out)).run();
  return out;
}

/* 13/11/2026: o consultor passou as cotações reais da soja disponível (R$/sc): Pontes e Lacerda 128,00 e
   Comodoro 129,00. Recalibra cada município com o mercado do dia (porto, Chicago e dólar), do mesmo jeito que o
   botão do painel faz. Cada um só é marcado como feito quando der certo (sem o preço do porto, tenta na próxima). */
const COTACOES_1311 = [
  { chave: 'calib:pontes-1311', municipio: 'Pontes e Lacerda', disp: 128 },
  { chave: 'calib:comodoro-1311', municipio: 'Comodoro', disp: 129 }
];
export async function calibrarPontes1311(env) {
  const out = {};
  for (const c of COTACOES_1311) {
    const feito = await env.DB.prepare('SELECT valor FROM config WHERE chave = ?').bind(c.chave).first().catch(() => null);
    if (feito) { out[c.municipio] = JSON.parse(feito.valor); continue; }
    const cal = await salvarCalibracao(env, { municipio: c.municipio, uf: 'MT', disp: c.disp });
    const p = (cal.pontos || []).filter((x) => x.municipio === c.municipio)[0] || null;
    const r = { em: new Date().toISOString(), ponto: p };
    await env.DB.prepare('INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor').bind(c.chave, JSON.stringify(r)).run();
    out[c.municipio] = r;
  }
  return out;
}
