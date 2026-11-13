/* ============================================================
   altasoja.js — alerta de alta da soja (disponível e futuro 30/04)
   A cada fechamento novo do porto (a fonte publica o do dia à tarde, às vezes no dia seguinte), entre 7h e 21h
   de MT, confere o preço calibrado de cada região
   (municípios com cotação real informada pelo consultor) e o futuro. Quando o preço passa a máxima dos
   últimos 30 dias, avisa no celular:
   - o gerente/dono da fazenda (login do portal, nunca o operador), com o preço da região da fazenda;
   - o consultor dono das fazendas, com as regiões e as fazendas.
   No máximo um aviso por dia, e outro só se subir pelo menos R$ 1,00 desde o último aviso daquele preço.
   Histórico e últimos avisos ficam em config 'alta:soja'. Resultado do dia em /api/status/alta.
   ============================================================ */
import { calibracao, calibrado, geocodificar, km, mercadoGeral } from './mercado.js';
import { enviarParaConta } from './push.js';
import { resumosDe, lerResumo } from './resumokml.js';

const CHAVE = 'alta:soja';
const DIAS = 30, MIN_HIST = 10, PASSO = 1;   // máxima de 30 dias; precisa de 10 fechamentos antes; R$ 1,00 entre avisos
const somaDias = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const r2 = (v) => Math.round(v * 100) / 100;
const brl = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dataBR = (iso) => String(iso || '').slice(8, 10) + '/' + String(iso || '').slice(5, 7);

async function ler(env) { try { const r = await env.DB.prepare('SELECT valor FROM config WHERE chave = ?').bind(CHAVE).first(); return r ? JSON.parse(r.valor) : {}; } catch (e) { return {}; } }
async function gravar(env, v) { await env.DB.prepare('INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor').bind(CHAVE, JSON.stringify(v)).run(); }

// confere um preço: guarda o fechamento de hoje e diz se é nova máxima de 30 dias (e se merece aviso)
export function conferir(est, chave, hoje, preco, inicio) {
  est.hist = est.hist || {}; est.ult = est.ult || {};
  const desde = somaDias(hoje, -DIAS);
  let h = (est.hist[chave] || []).filter((x) => x.d >= desde && x.d < hoje);
  // começo: completa com a série de fechamentos que o mercado já traz (porto ou Chicago dos últimos dias)
  (inicio || []).forEach((x) => { if (x.d >= desde && x.d < hoje && !h.some((y) => y.d === x.d)) h.push(x); });
  h.sort((a, b) => (a.d < b.d ? -1 : 1));
  const max = h.length ? Math.max.apply(null, h.map((x) => x.p)) : null;
  const semana = h.filter((x) => x.d <= somaDias(hoje, -7)).slice(-1)[0] || h[0] || null;
  est.hist[chave] = h.concat([{ d: hoje, p: r2(preco) }]).slice(-45);
  const u = est.ult[chave];
  const nova = h.length >= MIN_HIST && preco > max + 0.004;
  const avisa = nova && (!u || u.d < desde || preco >= u.p + PASSO);
  if (avisa) est.ult[chave] = { d: hoje, p: r2(preco) };
  return { nova, avisa, preco: r2(preco), max: max != null ? r2(max) : null, semana: semana ? r2(preco - semana.p) : null, n: h.length };
}

export async function alertaAltaSoja(env, forcar) {
  const agora = new Date(), hMT = (agora.getUTCHours() + 20) % 24;
  if (!forcar && (hMT < 7 || hMT >= 21)) return { fora_do_horario: true };   // não acorda ninguém de madrugada
  const est = await ler(env);
  const m = await mercadoGeral(env), cal = await calibracao(env);
  const ps = m.portos && m.portos.soja && m.portos.soja['Paranaguá'];
  const ultPorto = ps && ps.length ? ps[ps.length - 1].d : '';
  // um fechamento do porto, uma conferência (fim de semana e feriado não têm fechamento novo)
  if (!ultPorto || (!forcar && est.porto && ultPorto <= est.porto)) return { sem_fechamento_novo: true, porto: ultPorto };
  const hoje = ultPorto;
  // preço de cada região calibrada e do futuro
  const regioes = [];
  let fut = null;
  for (const p of cal.pontos || []) {
    const c = calibrado(m, cal, { lat: p.lat, lon: p.lon });
    if (!c || !c.disp) continue;
    const inicio = ps.slice(0, -1).map((x) => ({ d: x.d, p: r2(x.p + c.disp.dif) }));
    regioes.push({ municipio: p.municipio, lat: p.lat, lon: p.lon, r: conferir(est, 'disp:' + p.municipio, hoje, c.disp.preco, inicio) });
    if (!fut && c.futuro) fut = c.futuro;
  }
  let rFut = null;
  if (fut) {
    const fator = fut.brl && fut.usd ? fut.brl / fut.usd : null;          // R$ por US$ (dólar a termo de hoje)
    const preco = fator ? fut.brl : fut.usd;
    const dias = (m.cbot_fut && m.cbot_fut.dias) || [];
    const inicio = dias.slice(0, -1).map((x) => ({ d: x[0], p: r2((x[1] + fut.base) * 2.20462 * (fator || 1)) }));
    rFut = Object.assign(conferir(est, 'futuro', hoje, preco, inicio), { venc: fut.venc, moeda: fator ? 'R$' : 'US$' });
  }
  const altas = regioes.filter((x) => x.r.avisa);
  const futAlta = rFut && rFut.avisa;
  const res = { em: agora.toISOString(), porto: ultPorto, regioes: regioes.map((x) => Object.assign({ municipio: x.municipio }, x.r)), futuro: rFut, enviados: { portal: 0, consultor: 0 } };
  if (altas.length || futAlta) {
    const linhaFut = futAlta ? 'Futuro ' + dataBR(rFut.venc) + ': ' + (rFut.moeda === 'R$' ? brl(rFut.preco) : 'US$ ' + rFut.preco.toFixed(2)) + ' — maior valor em 30 dias' : '';
    const linhaReg = (x) => x.municipio + ': ' + brl(x.r.preco) + ' — maior valor em 30 dias' + (x.r.semana > 0 ? ' (+' + brl(x.r.semana) + ' na semana)' : '');
    // fazendas e a região calibrada mais perto de cada uma (até 400 km, igual ao card de mercado)
    const { results: fzs } = await env.DB.prepare('SELECT id, nome, usuario_id, resumo, length(talhoes) AS kml_len, municipio, uf FROM fazendas').all();
    const rs = await resumosDe(env, fzs || []);
    const regiaoDe = {};
    for (const f of fzs || []) {
      let c = (rs[f.id] && rs[f.id].centro) || (lerResumo(f.resumo, f.kml_len) || {}).centro;
      // sem mapa: centro do município cadastrado
      if ((!c || typeof c.lat !== 'number') && f.municipio) c = await geocodificar(f.municipio, f.uf || 'MT').catch(() => null);
      if (!c || typeof c.lat !== 'number') continue;
      let melhor = null, dmin = Infinity;
      regioes.forEach((x) => { const d = km([c.lat, c.lon], [x.lat, x.lon]); if (d < dmin) { dmin = d; melhor = x; } });
      if (melhor && dmin <= 400) regiaoDe[f.id] = melhor;
    }
    // gerente/dono no portal (com aviso ligado)
    const { results: subs } = await env.DB.prepare("SELECT DISTINCT usuario_id FROM push_assinaturas").all();
    for (const { usuario_id: uid } of subs || []) {
      try {
        if (String(uid).startsWith('portal:')) {
          const a = await env.DB.prepare('SELECT * FROM acessos_fazenda WHERE id = ?').bind(uid.slice(7)).first();
          if (!a || Number(a.ativo) === 0 || a.papel === 'operador') continue;
          let ids = []; try { ids = JSON.parse(a.fazendas || '[]'); } catch (e) { ids = []; }
          const regs = []; ids.forEach((id) => { const g = regiaoDe[id]; if (g && regs.indexOf(g) < 0) regs.push(g); });
          if (!regs.length) continue;
          const minhas = regs.filter((g) => g.r.avisa);
          if (!minhas.length && !futAlta) continue;
          const linhas = minhas.map(linhaReg).concat(linhaFut ? [linhaFut] : []);
          const t = minhas.length === 1 ? '📈 Soja em alta: ' + brl(minhas[0].r.preco) + ' em ' + minhas[0].municipio : '📈 Soja em alta';
          const msgP = { title: t, body: linhas.join('\n'), url: '/portal', tag: 'alta-soja' };
          if (forcar) (res.previa = res.previa || []).push(Object.assign({ para: 'portal' }, msgP));
          if (await enviarParaConta(env, uid, msgP)) res.enviados.portal++;
          continue;
        }
        // consultor: as regiões em alta onde ele tem fazendas
        const minhas = (fzs || []).filter((f) => f.usuario_id === uid && regiaoDe[f.id]);
        if (!minhas.length) continue;
        const porReg = new Map();
        minhas.forEach((f) => { const g = regiaoDe[f.id]; if (!porReg.has(g)) porReg.set(g, []); porReg.get(g).push(f.nome); });
        const regs = [...porReg.keys()].filter((g) => g.r.avisa);
        if (!regs.length && !futAlta) continue;
        const linhas = regs.map((g) => linhaReg(g) + ' · ' + porReg.get(g).slice(0, 3).join(', ') + (porReg.get(g).length > 3 ? '…' : '')).concat(linhaFut ? [linhaFut] : []);
        const msgC = { title: '📈 Soja em alta nas suas fazendas', body: linhas.join('\n'), url: '/', tag: 'alta-soja' };
        if (forcar) (res.previa = res.previa || []).push(Object.assign({ para: 'consultor' }, msgC));
        if (await enviarParaConta(env, uid, msgC)) res.enviados.consultor++;
      } catch (e) { /* uma conta com problema não segura as outras */ }
    }
  }
  est.porto = ultPorto; est.resultado = Object.assign({}, res, { previa: undefined });   // a prévia (com nomes) não fica no status público
  await gravar(env, est);
  return res;
}

export async function statusAlta(env) { const e = await ler(env); return e.resultado || { pendente: true }; }
