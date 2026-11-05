/* Painel do consultor · aba "Fazendas": uma linha por fazenda (alertas, plantio, chuva da semana,
   janela de pulverização, soja na fazenda) e o resumo de uma fazenda ao clicar.
   Usa os mesmos cálculos da tela Início do dono (portal). */
import { modulosDe } from './agro.js';
import { dadosParaPainel } from './portal.js';
import { climaVarios, climaDe, localDaFazenda, mercadoDaFazenda, mercadoGeral } from './mercado.js';
import { chuvaDaFazenda, mapaGuardado } from './chuva.js';

const json = (o, status) => new Response(JSON.stringify(o), {
  status: status || 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
});
const hojeMT = () => new Date(Date.now() - 4 * 3600 * 1000).toISOString().slice(0, 10);
const somaDias = (iso, k) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };
const r1 = (v) => Math.round(v * 10) / 10;
const br = (v) => String(r1(v)).replace('.', ',');   // número para texto (vírgula)

async function fretes(env) {
  const out = {};
  try {
    const { results } = await env.DB.prepare("SELECT chave, valor FROM config WHERE chave LIKE 'frete:%'").all();
    (results || []).forEach((r) => { try { out[r.chave.slice(6)] = JSON.parse(r.valor); } catch (e) { /* valor ruim */ } });
  } catch (e) { /* sem tabela */ }
  return out;
}

// alertas e números de uma fazenda a partir dos dados do portal (+ tempo, quando houver)
function resumo(d, clima) {
  const hj = hojeMT(), sem = somaDias(hj, 7);
  const pend = (d.aplicacoes || []).filter((a) => a.status !== 'aplicada');
  const atrasadas = pend.filter((a) => a.data && a.data < hj), hoje = pend.filter((a) => a.data === hj);
  const prox7 = pend.filter((a) => a.data > hj && a.data <= sem);
  const falta = (d.estoque || []).filter((e) => e.sobra < 0 && e.a_aplicar > 0).sort((a, b) => a.sobra - b.sobra);
  const dias = (clima && clima.dias) || [];
  const chuvaNo = (dt) => dias.filter((x) => x.d === dt)[0];
  const chuvaAplic = pend.filter((a) => a.data && a.data >= hj && a.data <= somaDias(hj, 3)).map((a) => ({ a, c: chuvaNo(a.data) })).filter((x) => x.c && x.c.mm >= 10);
  const g = d.graf || {}, pl = (g.linha || []).reduce((s, x) => s + x.ha, 0);
  const prev = (g.prev || []).filter((x) => !x.col && x.d >= hj).map((x) => x.d).sort()[0] || '';
  const atencao = [];
  atrasadas.slice(0, 3).forEach((a) => atencao.push({ ic: '⏰', t: a.titulo + ' atrasada ' + Math.round((new Date(hj) - new Date(a.data)) / 864e5) + ' dias',
    s: a.tal.filter((t) => !t.feito).map((t) => t.nome).slice(0, 4).join(', ') + ' · ' + br(a.tal.filter((t) => !t.feito).reduce((s, t) => s + Math.max(0, t.ha - (t.feitoHa || 0)), 0)) + ' ha' }));
  chuvaAplic.slice(0, 2).forEach((x) => atencao.push({ ic: '🌧️', t: Math.round(x.c.mm) + ' mm em ' + x.a.data.slice(8, 10) + '/' + x.a.data.slice(5, 7), s: x.a.titulo + ' marcada para esse dia' }));
  falta.slice(0, 2).forEach((e) => atencao.push({ ic: '📦', t: e.produto + ' vai faltar', s: 'faltam ' + br(-e.sobra) + ' ' + e.unidade + ' para as aplicações programadas' }));
  return {
    alertas: { atrasadas: atrasadas.length, hoje: hoje.length, prox7: prox7.length, estoque: falta.length, chuva: chuvaAplic.length },
    plantio: { ha: r1(pl), total: r1(g.total_ha || 0), pct: g.total_ha ? Math.round(pl / g.total_ha * 1000) / 10 : 0 },
    colheita: prev, atencao,
    pendentes: pend.sort((a, b) => ((a.data || '9') < (b.data || '9') ? -1 : 1)).slice(0, 5).map((a) => ({ titulo: a.titulo, data: a.data,
      tal: a.tal.filter((t) => !t.feito).map((t) => t.nome), ha: r1(a.tal.filter((t) => !t.feito).reduce((s, t) => s + Math.max(0, t.ha - (t.feitoHa || 0)), 0)) }))
  };
}

// média das praças de um estado (último fechamento)
function mediaUF(tab, uf) {
  if (!tab) return null;
  const l = Object.keys(tab).filter((n) => n.endsWith('/' + uf)).map((n) => tab[n]);
  if (!l.length) return null;
  const ult = l.map((s) => s[s.length - 1]), ant = l.map((s) => s[s.length - 2] || s[s.length - 1]);
  const m = ult.reduce((a, x) => a + x.p, 0) / ult.length, ma = ant.reduce((a, x) => a + x.p, 0) / ant.length;
  return { preco: Math.round(m * 100) / 100, var: ma ? Math.round((m - ma) / ma * 10000) / 100 : null, n: l.length };
}

export async function rotasPainelFaz(env, req, me, rota, url) {
  const mod = await modulosDe(env, me.id);
  const admin = mod.admin && !!me.cf;
  if (!admin && !mod.plantio && !mod.recomendacoes) return json({ erro: 'módulos de lavoura não liberados para esta conta' }, 403);

  if (rota === '/api/painel/fazendas') {
    const q = `SELECT f.id, f.nome, f.talhoes, f.municipio, f.uf, f.usuario_id, p.nome AS produtor, u.nome AS conta
                 FROM fazendas f LEFT JOIN produtores p ON p.id = f.produtor_id LEFT JOIN usuarios u ON u.id = f.usuario_id
                WHERE ` + (admin ? '' : 'f.usuario_id = ? AND ') + `((f.talhoes IS NOT NULL AND f.talhoes != '')
                   OR EXISTS (SELECT 1 FROM recomendacoes r WHERE r.fazenda_id = f.id) OR EXISTS (SELECT 1 FROM plantio pl WHERE pl.fazenda_id = f.id))
                ORDER BY f.nome LIMIT 300`;
    const { results } = await (admin ? env.DB.prepare(q) : env.DB.prepare(q).bind(me.id)).all();
    const faz = results || [];
    const [fr, mg] = await Promise.all([fretes(env), mercadoGeral(env).catch(() => null)]);
    // dados de cada fazenda (de 6 em 6) e o local
    const dados = [], locais = [];
    for (let i = 0; i < faz.length; i += 6) {
      const parte = await Promise.all(faz.slice(i, i + 6).map(async (f) => {
        const [d, l] = await Promise.all([dadosParaPainel(env, f.usuario_id, f.id, { leve: true }).catch(() => null), localDaFazenda(f).catch(() => null)]);
        return [d, l];
      }));
      parte.forEach((x) => { dados.push(x[0]); locais.push(x[1]); });
    }
    const climas = await climaVarios(locais).catch(() => locais.map(() => null));
    const linhas = [];
    for (let i = 0; i < faz.length; i++) {
      const f = faz[i], d = dados[i] || {}, c = climas[i], l = locais[i];
      const r = resumo(d, c);
      const m = l ? await mercadoDaFazenda(env, l, fr[f.id]).catch(() => null) : null;
      const F = m && m.formacao;
      linhas.push(Object.assign({
        id: f.id, nome: f.nome, produtor: f.produtor || '', conta: f.conta || '', municipio: f.municipio || '', uf: f.uf || '', local: l,
        chuva7: c && c.dias ? r1(c.dias.slice(0, 7).reduce((s, x) => s + (x.mm || 0), 0)) : null,
        janela: c && c.janela ? { melhor: c.janela.melhor, hoje: c.janela.hoje, horas: c.janela.horas.map((h) => h.st) } : null,
        tempo: c && c.agora ? { ic: c.agora.ic, temp: c.agora.temp } : null,
        venda: F ? (F.venda != null ? F.venda : F.fazenda) : null, praca: m && m.soja ? { nome: m.soja.praca, preco: m.soja.preco } : null
      }, r));
    }
    return json({
      ok: true, hoje: hojeMT(), admin,
      mercado: mg ? { dolar: mg.dolar, cbot_soja: mg.cbot_soja, cbot_milho: mg.cbot_milho,
        soja_mt: mediaUF(mg.pracas && mg.pracas.soja, 'MT'), milho_mt: mediaUF(mg.pracas && mg.pracas.milho, 'MT'),
        paranagua: mg.portos && mg.portos.soja && mg.portos.soja['Paranaguá'] ? mg.portos.soja['Paranaguá'].slice(-1)[0] : null } : null,
      fazendas: linhas
    });
  }

  if (rota === '/api/painel/fazenda') {
    const fid = String(url.searchParams.get('id') || '').slice(0, 80);
    const f = await env.DB.prepare(`SELECT f.id, f.nome, f.talhoes, f.municipio, f.uf, f.usuario_id, p.nome AS produtor FROM fazendas f
        LEFT JOIN produtores p ON p.id = f.produtor_id WHERE f.id = ?`).bind(fid).first();
    if (!f || (!admin && f.usuario_id !== me.id)) return json({ erro: 'fazenda não encontrada' }, 404);
    const fr = await fretes(env);
    const local = await localDaFazenda(f).catch(() => null);
    const [d, clima, chuva, mercado] = await Promise.all([
      dadosParaPainel(env, f.usuario_id, f.id, { leve: true }).catch(() => null),
      local ? climaDe(local.lat, local.lon).catch(() => null) : null,
      local ? chuvaDaFazenda(env, f).catch(() => null) : null,
      local ? mercadoDaFazenda(env, local, fr[f.id]).catch(() => null) : null
    ]);
    return json(Object.assign({ ok: true, fazenda: { id: f.id, nome: f.nome, produtor: f.produtor || '', municipio: f.municipio || '', uf: f.uf || '' },
      local, clima, chuva, mercado }, resumo(d || {}, clima)));
  }
  if (rota === '/api/painel/chuva-mapa') return json(Object.assign({ ok: true }, await mapaGuardado(env)));
  return json({ erro: 'rota não encontrada' }, 404);
}
