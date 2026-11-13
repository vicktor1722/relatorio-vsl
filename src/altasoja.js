/* ============================================================
   altasoja.js — resumo da soja no fim do dia (disponível, futuro 30/04 e dólar), com o alerta de alta
   Uma notificação por dia útil, a partir das 18h de MT (Chicago e o dólar já fecharam):
     📊 Soja hoje · fechamento            (ou 📈 Soja em alta hoje, quando algum preço bateu a máxima de 30 dias)
     Disponível Pontes e Lacerda: R$ 128,00 (+R$ 1,00) 🔺 maior em 30 dias
     Futuro 30/04: R$ 123,55 (+0,6%)
     Dólar: R$ 5,64 (+0,2%)
   O disponível é o da região calibrada mais perto da fazenda (até 400 km), com o último fechamento do porto.
   Quem recebe: o gerente/dono da fazenda (login do portal, nunca o operador) e o consultor dono das fazendas.
   Dia sem pregão em Chicago (feriado) não manda. Histórico em config 'alta:soja'; resumo em /api/status/alta.
   ============================================================ */
import { calibracao, calibrado, futuroAgora, geocodificar, km, mercadoGeral } from './mercado.js';
import { enviarParaConta } from './push.js';
import { resumosDe, lerResumo } from './resumokml.js';

const CHAVE = 'alta:soja';
const DIAS = 30, MIN_HIST = 8;   // máxima de 30 dias; precisa de 8 fechamentos antes para comparar
const HORA = 18;                 // a partir das 18h de MT
const hojeMT = () => new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 10);
const somaDias = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const r2 = (v) => Math.round(v * 100) / 100;
const brl = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (v, c) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c });
const sinal = (v, c) => (v > 0 ? '+' : v < 0 ? '−' : '') + num(Math.abs(v), c);
const dataBR = (iso) => String(iso || '').slice(8, 10) + '/' + String(iso || '').slice(5, 7);

async function ler(env) { try { const r = await env.DB.prepare('SELECT valor FROM config WHERE chave = ?').bind(CHAVE).first(); return r ? JSON.parse(r.valor) : {}; } catch (e) { return {}; } }
async function gravar(env, v) { await env.DB.prepare('INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor').bind(CHAVE, JSON.stringify(v)).run(); }

/* guarda o valor do dia (fechamento) e diz se é a maior dos últimos 30 dias e quanto mudou desde o fechamento anterior */
export function conferir(est, chave, dia, preco, inicio) {
  est.hist = est.hist || {};
  const desde = somaDias(dia, -DIAS);
  let h = (est.hist[chave] || []).filter((x) => x.d >= desde && x.d < dia);
  // começo: completa com a série que o mercado já traz (fechamentos do porto ou de Chicago)
  (inicio || []).forEach((x) => { if (x.d >= desde && x.d < dia && !h.some((y) => y.d === x.d)) h.push(x); });
  h.sort((a, b) => (a.d < b.d ? -1 : 1));
  const max = h.length ? Math.max.apply(null, h.map((x) => x.p)) : null, ant = h.length ? h[h.length - 1].p : null;
  est.hist[chave] = h.concat([{ d: dia, p: r2(preco) }]).slice(-45);
  return { preco: r2(preco), max: max != null ? r2(max) : null, nova: h.length >= MIN_HIST && preco > max + 0.004,
    dif: ant != null ? r2(preco - ant) : null, pc: ant ? r2((preco - ant) / ant * 100) : null, n: h.length };
}

export async function alertaAltaSoja(env, forcar) {
  const agora = new Date(), mt = new Date(Date.now() - 4 * 3600e3), hMT = mt.getUTCHours(), dsem = mt.getUTCDay(), hoje = hojeMT();
  if (!forcar && (dsem === 0 || dsem === 6 || hMT < HORA || hMT >= 22)) return { fora_do_horario: true };
  const est = await ler(env);
  if (!forcar && est.dia === hoje) return est.resultado || { feito: true };   // um resumo por dia
  const cal = await calibracao(env);
  const fut = await futuroAgora(env).catch(() => null);
  if (!fut || !fut.preco) return { sem_futuro: true };                          // tenta no próximo ciclo
  const res = { em: agora.toISOString(), dia: hoje, enviados: { portal: 0, consultor: 0 } };
  if (fut.em !== hoje && !forcar) {                                            // feriado em Chicago: sem resumo
    est.dia = hoje; est.resultado = Object.assign(res, { sem_pregao: true, futuro_em: fut.em }); await gravar(env, est); return res;
  }
  // futuro 30/04 e dólar
  const rFut = Object.assign(conferir(est, 'futuro', hoje, fut.preco, fut.dias.filter((x) => x.d < hoje)), { venc: fut.venc, moeda: fut.moeda, cbot: fut.cbot });
  res.futuro = rFut; res.dolar = fut.dolar ? { preco: r2(fut.dolar * 100) / 100, var: fut.dolar_var } : null;
  // disponível de cada região: último fechamento do porto (só entra no histórico quando o fechamento é novo)
  const m = await mercadoGeral(env);
  const ps = m.portos && m.portos.soja && m.portos.soja['Paranaguá'];
  const ultPorto = ps && ps.length ? ps[ps.length - 1].d : '';
  res.porto = ultPorto;
  const portoNovo = ultPorto !== est.porto;   // a fonte do porto às vezes não publica no dia: aí o disponível não conta como alta de novo
  const pontos = (cal.pontos || []).map((p) => {
    const x = { municipio: p.municipio, lat: p.lat, lon: p.lon, r: null };
    const c = calibrado(m, cal, { lat: p.lat, lon: p.lon });
    if (c && c.disp) {
      const inicio = ps.slice(0, -1).map((y) => ({ d: y.d, p: r2(y.p + c.disp.dif) }));
      x.r = Object.assign(conferir(est, 'disp:' + p.municipio, ultPorto, c.disp.preco, inicio), { em: ultPorto });
      if (!portoNovo) x.r.nova = false;
    }
    return x;
  });
  res.regioes = pontos.filter((x) => x.r).map((x) => Object.assign({ municipio: x.municipio }, x.r));
  await enviar(env, pontos.filter((x) => x.r), rFut, res.dolar, res, forcar);
  est.dia = hoje; est.porto = ultPorto; est.resultado = Object.assign({}, res, { previa: undefined });   // a prévia (com nomes) não fica no status público
  await gravar(env, est);
  return res;
}

async function enviar(env, pontos, rFut, dolar, res, forcar) {
  const alta = ' 🔺 maior em 30 dias';
  const linhaReg = (x) => 'Disponível ' + x.municipio + ': ' + brl(x.r.preco) + (x.r.dif ? ' (' + sinal(x.r.dif, 2).replace(/^([+−])/, '$1R$ ') + ')' : '') +
    (x.r.em && x.r.em !== res.dia ? ' · porto de ' + dataBR(x.r.em) : '') + (x.r.nova ? alta : '');
  const linhaFut = 'Futuro ' + dataBR(rFut.venc) + ': ' + (rFut.moeda === 'R$' ? brl(rFut.preco) : 'US$ ' + num(rFut.preco, 2)) +
    (rFut.pc != null ? ' (' + sinal(rFut.pc, 1) + '%)' : '') + (rFut.nova ? alta : '');
  const linhaUsd = dolar ? 'Dólar: ' + brl(dolar.preco) + (dolar.var != null ? ' (' + sinal(dolar.var, 1) + '%)' : '') : '';
  const msgDe = (regs, extra) => {
    const emAlta = rFut.nova || regs.some((g) => g.r.nova);
    return { title: emAlta ? '📈 Soja em alta hoje' : '📊 Soja hoje · fechamento',
      body: regs.map((g) => linhaReg(g) + (extra ? extra(g) : '')).concat([linhaFut], linhaUsd ? [linhaUsd] : []).join('\n'), tag: 'resumo-soja' };
  };
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
        msg = Object.assign(msgDe(regs), { url: '/portal' }); tipo = 'portal';
      } else {
        // consultor: as regiões onde ele tem fazendas, com as fazendas de cada uma
        const minhas = (fzs || []).filter((f) => f.usuario_id === uid && regiaoDe[f.id]);
        if (!minhas.length) continue;
        const porReg = new Map();
        minhas.forEach((f) => { const g = regiaoDe[f.id]; if (!porReg.has(g)) porReg.set(g, []); porReg.get(g).push(f.nome); });
        const regs = [...porReg.keys()];
        msg = Object.assign(msgDe(regs, regs.length > 1 ? (g) => ' · ' + porReg.get(g).length + (porReg.get(g).length === 1 ? ' fazenda' : ' fazendas') : null), { url: '/' }); tipo = 'consultor';
      }
      if (forcar) (res.previa = res.previa || []).push(Object.assign({ para: tipo }, msg));
      if (await enviarParaConta(env, uid, msg)) res.enviados[tipo]++;
    } catch (e) { /* uma conta com problema não segura as outras */ }
  }
}

export async function statusAlta(env) { const e = await ler(env); return e.resultado || { pendente: true }; }
