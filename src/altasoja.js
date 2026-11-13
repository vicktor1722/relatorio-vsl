/* ============================================================
   altasoja.js — alerta de alta da soja (futuro 30/04 em tempo real e disponível da região)
   - Futuro 30/04: conferido a cada 15 min (cron), de segunda a sexta entre 7h e 21h de MT, com Chicago e o dólar
     de agora. Quando passa o maior valor dos últimos 30 dias, avisa UMA vez naquele dia; nos dias seguintes só
     avisa de novo se passar R$ 1,00 acima do último aviso.
   - Disponível de cada região calibrada (Pontes e Lacerda, Comodoro…): conferido quando sai fechamento novo do
     porto (a fonte publica uma vez por dia). Mesma regra.
   Quem recebe: o gerente/dono da fazenda (login do portal, nunca o operador) com o preço da região dele, e o
   consultor dono das fazendas. Histórico e últimos avisos em config 'alta:soja'; resumo em /api/status/alta.
   ============================================================ */
import { calibracao, calibrado, futuroAgora, geocodificar, km, mercadoGeral } from './mercado.js';
import { enviarParaConta } from './push.js';
import { resumosDe, lerResumo } from './resumokml.js';

const CHAVE = 'alta:soja';
const DIAS = 30, MIN_HIST = 8, PASSO = 1;   // máxima de 30 dias; precisa de 8 fechamentos antes; R$ 1,00 entre avisos de dias diferentes
const hojeMT = () => new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 10);
const somaDias = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const r2 = (v) => Math.round(v * 100) / 100;
const brl = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dataBR = (iso) => String(iso || '').slice(8, 10) + '/' + String(iso || '').slice(5, 7);

async function ler(env) { try { const r = await env.DB.prepare('SELECT valor FROM config WHERE chave = ?').bind(CHAVE).first(); return r ? JSON.parse(r.valor) : {}; } catch (e) { return {}; } }
async function gravar(env, v) { await env.DB.prepare('INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor').bind(CHAVE, JSON.stringify(v)).run(); }

/* confere um preço: guarda o valor do dia (o último visto no dia fica como fechamento) e diz se é nova máxima de
   30 dias e se merece aviso: uma vez por dia, e em outro dia só R$ 1,00 acima do último aviso */
export function conferir(est, chave, hoje, preco, inicio) {
  est.hist = est.hist || {}; est.ult = est.ult || {};
  const desde = somaDias(hoje, -DIAS);
  let h = (est.hist[chave] || []).filter((x) => x.d >= desde && x.d < hoje);
  // começo: completa com a série que o mercado já traz (fechamentos do porto ou de Chicago)
  (inicio || []).forEach((x) => { if (x.d >= desde && x.d < hoje && !h.some((y) => y.d === x.d)) h.push(x); });
  h.sort((a, b) => (a.d < b.d ? -1 : 1));
  const max = h.length ? Math.max.apply(null, h.map((x) => x.p)) : null;
  const semana = h.filter((x) => x.d <= somaDias(hoje, -7)).slice(-1)[0] || h[0] || null;
  est.hist[chave] = h.concat([{ d: hoje, p: r2(preco) }]).slice(-45);
  const u = est.ult[chave];
  const nova = h.length >= MIN_HIST && preco > max + 0.004;
  const avisa = nova && (!u || (u.d !== hoje && (u.d < desde || preco >= u.p + PASSO)));
  if (avisa) est.ult[chave] = { d: hoje, p: r2(preco) };
  return { nova, avisa, preco: r2(preco), max: max != null ? r2(max) : null, semana: semana ? r2(preco - semana.p) : null, n: h.length };
}

export async function alertaAltaSoja(env, forcar) {
  const agora = new Date(), mt = new Date(Date.now() - 4 * 3600e3), hMT = mt.getUTCHours(), dsem = mt.getUTCDay();
  if (!forcar && (hMT < 7 || hMT >= 21)) return { fora_do_horario: true };   // não acorda ninguém de madrugada
  const est = await ler(env), cal = await calibracao(env), hoje = hojeMT();
  const res = { em: agora.toISOString(), enviados: { portal: 0, consultor: 0 } };
  const pontos = (cal.pontos || []).map((p) => ({ municipio: p.municipio, lat: p.lat, lon: p.lon, r: null }));

  // 1) futuro 30/04 em tempo real (pregão de segunda a sexta)
  let rFut = null;
  if (forcar || (dsem >= 1 && dsem <= 5)) {
    const fut = await futuroAgora(env).catch(() => null);
    if (fut && fut.preco) {
      rFut = Object.assign(conferir(est, 'futuro', hoje, fut.preco, fut.dias.filter((x) => x.d < hoje)), { venc: fut.venc, moeda: fut.moeda, cbot: fut.cbot, dolar: fut.dolar });
      res.futuro = rFut;
    }
  }

  // 2) disponível da região: a cada fechamento novo do porto
  const m = await mercadoGeral(env);
  const ps = m.portos && m.portos.soja && m.portos.soja['Paranaguá'];
  const ultPorto = ps && ps.length ? ps[ps.length - 1].d : '';
  res.porto = ultPorto;
  if (ultPorto && (forcar || !est.porto || ultPorto > est.porto)) {
    pontos.forEach((x) => {
      const c = calibrado(m, cal, { lat: x.lat, lon: x.lon });
      if (!c || !c.disp) return;
      const inicio = ps.slice(0, -1).map((y) => ({ d: y.d, p: r2(y.p + c.disp.dif) }));
      x.r = conferir(est, 'disp:' + x.municipio, ultPorto, c.disp.preco, inicio);
    });
    est.porto = ultPorto;
    res.regioes = pontos.filter((x) => x.r).map((x) => Object.assign({ municipio: x.municipio }, x.r));
  }

  const altas = pontos.filter((x) => x.r && x.r.avisa), futAlta = !!(rFut && rFut.avisa);
  if (altas.length || futAlta) await enviar(env, pontos, altas, futAlta ? rFut : null, res, forcar);
  est.resultado = Object.assign({}, res, { previa: undefined });   // a prévia (com nomes) não fica no status público
  if (altas.length || futAlta) est.ultimo_aviso = { em: res.em, futuro: futAlta, regioes: altas.map((x) => x.municipio), enviados: res.enviados };
  await gravar(env, est);
  return res;
}

async function enviar(env, pontos, altas, rFut, res, forcar) {
  const precoFut = rFut ? (rFut.moeda === 'R$' ? brl(rFut.preco) : 'US$ ' + rFut.preco.toFixed(2)) : '';
  const linhaFut = rFut ? 'Futuro ' + dataBR(rFut.venc) + ': ' + precoFut + ' — maior valor em 30 dias' : '';
  const linhaReg = (x) => 'Disponível ' + x.municipio + ': ' + brl(x.r.preco) + ' — maior valor em 30 dias' + (x.r.semana > 0 ? ' (+' + brl(x.r.semana) + ' na semana)' : '');
  const titulo = (regs) => regs.length === 1 && !rFut ? '📈 Soja em alta: ' + brl(regs[0].r.preco) + ' em ' + regs[0].municipio
    : !regs.length && rFut ? '📈 Soja futuro ' + dataBR(rFut.venc) + ' em alta: ' + precoFut : '📈 Soja em alta';
  // fazendas e a região calibrada mais perto de cada uma (até 400 km, igual ao card de mercado)
  const { results: fzs } = await env.DB.prepare('SELECT id, nome, usuario_id, resumo, length(talhoes) AS kml_len, municipio, uf FROM fazendas').all();
  const rs = await resumosDe(env, fzs || []);
  const regiaoDe = {};
  for (const f of fzs || []) {
    let c = (rs[f.id] && rs[f.id].centro) || (lerResumo(f.resumo, f.kml_len) || {}).centro;
    if ((!c || typeof c.lat !== 'number') && f.municipio) c = await geocodificar(f.municipio, f.uf || 'MT').catch(() => null);   // sem mapa: município
    if (!c || typeof c.lat !== 'number') continue;
    let melhor = null, dmin = Infinity;
    pontos.forEach((x) => { const d = km([c.lat, c.lon], [x.lat, x.lon]); if (d < dmin) { dmin = d; melhor = x; } });
    if (melhor && dmin <= 400) regiaoDe[f.id] = melhor;
  }
  const { results: subs } = await env.DB.prepare('SELECT DISTINCT usuario_id FROM push_assinaturas').all();
  for (const { usuario_id: uid } of subs || []) {
    try {
      let msg = null, tipo = '';
      if (String(uid).startsWith('portal:')) {
        // gerente/dono no portal (com aviso ligado); operador não recebe
        const a = await env.DB.prepare('SELECT * FROM acessos_fazenda WHERE id = ?').bind(uid.slice(7)).first();
        if (!a || Number(a.ativo) === 0 || a.papel === 'operador') continue;
        let ids = []; try { ids = JSON.parse(a.fazendas || '[]'); } catch (e) { ids = []; }
        const regs = []; ids.forEach((id) => { const g = regiaoDe[id]; if (g && regs.indexOf(g) < 0) regs.push(g); });
        if (!regs.length) continue;
        const minhas = regs.filter((g) => altas.indexOf(g) >= 0);
        if (!minhas.length && !rFut) continue;
        msg = { title: titulo(minhas), body: minhas.map(linhaReg).concat(linhaFut ? [linhaFut] : []).join('\n'), url: '/portal', tag: 'alta-soja' }; tipo = 'portal';
      } else {
        // consultor: as regiões em alta onde ele tem fazendas
        const minhas = (fzs || []).filter((f) => f.usuario_id === uid && regiaoDe[f.id]);
        if (!minhas.length) continue;
        const porReg = new Map();
        minhas.forEach((f) => { const g = regiaoDe[f.id]; if (!porReg.has(g)) porReg.set(g, []); porReg.get(g).push(f.nome); });
        const regs = [...porReg.keys()].filter((g) => altas.indexOf(g) >= 0);
        if (!regs.length && !rFut) continue;
        const linhas = regs.map((g) => linhaReg(g) + ' · ' + porReg.get(g).slice(0, 3).join(', ') + (porReg.get(g).length > 3 ? '…' : '')).concat(linhaFut ? [linhaFut] : []);
        msg = { title: regs.length || !rFut ? '📈 Soja em alta nas suas fazendas' : titulo([]), body: linhas.join('\n'), url: '/', tag: 'alta-soja' }; tipo = 'consultor';
      }
      if (forcar) (res.previa = res.previa || []).push(Object.assign({ para: tipo }, msg));
      if (await enviarParaConta(env, uid, msg)) res.enviados[tipo]++;
    } catch (e) { /* uma conta com problema não segura as outras */ }
  }
}

export async function statusAlta(env) { const e = await ler(env); return Object.assign({}, e.resultado || { pendente: true }, e.ultimo_aviso ? { ultimo_aviso: e.ultimo_aviso } : {}); }
