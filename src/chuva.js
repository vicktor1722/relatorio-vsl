/* Chuva dos próximos 30 dias (fazenda) e mapa da chuva (Brasil), para o dono/gerente.
   Atualiza uma vez por semana, domingo à noite (cron), e fica guardado no banco (tabela config):
   - "chuva:mapa": grade do Brasil (3°), chuva de cada dia nos próximos 15 dias (modelo europeu ECMWF)
   - "chuva:p:<lat>,<lon>": 30 dias no ponto da fazenda: 1–15 ECMWF (50 cenários), 16–30 GFS (tendência, 30 cenários) */
import { localDaFazenda } from './mercado.js';

const UA = 'Mozilla/5.0 (compatible; AMVS-Relatorio/1.0)';
const GRADE = { la0: -35, la1: 7, lo0: -76, lo1: -32, passo: 2, ver: 3 };   // ver 3: + dias 16 a 30   // ver: muda quando a grade muda (refaz o guardado)
const VALIDADE = 8 * 864e5;   // passou disso sem atualizar (cron falhou): refaz quando alguém abrir

// limite por minuto do Open-Meteo: na atualização de domingo (sem pressa) espera 1 minuto e tenta de novo
let PACIENTE = false;
async function buscar(url, tentou) {
  try { return await buscar1(url); }
  catch (e) {
    if (PACIENTE && !tentou && /minut/i.test(e.message)) { await new Promise((r) => setTimeout(r, 61000)); return buscar(url, true); }
    throw e;
  }
}
async function buscar1(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || j.error) throw new Error((j && j.reason) || ('HTTP ' + r.status));
  return j;
}
const r1 = (v) => Math.round((v || 0) * 10) / 10;
function membros(d, i) { return Object.keys(d).filter((k) => k.startsWith('precipitation_sum')).map((k) => Number(d[k][i]) || 0); }
function mediana(l) { const s = l.slice().sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

async function ler(env, chave) {
  try { const r = await env.DB.prepare('SELECT valor FROM config WHERE chave = ?').bind(chave).first(); return r ? JSON.parse(r.valor) : null; } catch (e) { return null; }
}
async function gravar(env, chave, v) {
  await env.DB.prepare('INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor').bind(chave, JSON.stringify(v)).run();
}

// grade do Brasil: chuva prevista de cada dia (mm), 15 dias
export async function mapaChuva() {
  const lats = [], lons = [];
  for (let la = GRADE.la1; la >= GRADE.la0; la -= GRADE.passo) for (let lo = GRADE.lo0; lo <= GRADE.lo1; lo += GRADE.passo) { lats.push(la); lons.push(lo); }
  const q = (la, lo) => 'latitude=' + la.join(',') + '&longitude=' + lo.join(',') + '&daily=precipitation_sum&forecast_days=15&timezone=America%2FSao_Paulo';
  let lista, fonte;
  try {
    lista = await buscar('https://api.open-meteo.com/v1/forecast?' + q(lats, lons) + '&models=ecmwf_ifs025');
    fonte = 'ECMWF';
  } catch (e) {   // limite da previsão comum: usa a média dos cenários do mesmo modelo, em partes (resposta grande)
    lista = [];
    for (let i = 0; i < lats.length; i += 100) {
      let parte = await buscar('https://ensemble-api.open-meteo.com/v1/ensemble?' + q(lats.slice(i, i + 100), lons.slice(i, i + 100)) + '&models=ecmwf_ifs025');
      if (!Array.isArray(parte)) parte = [parte];
      parte.forEach((p) => { const d = p.daily, m = { time: d.time, precipitation_sum: d.time.map((_, k) => { const l = membros(d, k); return l.reduce((a, x) => a + x, 0) / (l.length || 1); }) }; lista.push({ daily: m }); });
    }
    fonte = 'ECMWF (média dos cenários)';
  }
  if (!Array.isArray(lista)) lista = [lista];
  const datas = lista[0].daily.time;
  const v = datas.map((_, i) => lista.map((p) => { const m = membros(p.daily, i); return r1(m.reduce((s, x) => s + x, 0) / (m.length || 1)); }));
  const nlon = Math.round((GRADE.lo1 - GRADE.lo0) / GRADE.passo) + 1, nlat = Math.round((GRADE.la1 - GRADE.la0) / GRADE.passo) + 1;
  // dias 16 a 30: tendência do modelo americano (GFS, média de 30 cenários), numa grade de 4° e preenchida para a de 2°
  let v1630 = null, ate30 = '';
  try {
    const ini = somaDia(datas[datas.length - 1], 1); ate30 = somaDia(ini, 14);
    const r = await acumuladoGfs(ini, ate30);
    v1630 = []; for (let a = 0; a < nlat; a++) for (let b = 0; b < nlon; b++) v1630.push(r1(r(GRADE.la1 - a * GRADE.passo, GRADE.lo0 + b * GRADE.passo)));
  } catch (e) { v1630 = null; }
  return Object.assign({}, GRADE, { nlat, nlon, datas, v, v1630, ate30: v1630 ? ate30 : '', fonte, gerado_em: new Date().toISOString() });
}
const somaDia = (iso, k) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };
// soma da chuva do período (média dos cenários do GFS) em pontos a cada 4°; devolve uma função (lat, lon) → mm, interpolada
export async function acumuladoGfs(ini, fim) {
  const P = 4, la1 = GRADE.la1 + 1, lo0 = GRADE.lo0, nla = Math.ceil((la1 - GRADE.la0) / P) + 1, nlo = Math.ceil((GRADE.lo1 - lo0) / P) + 1;
  const lats = [], lons = [];
  for (let a = 0; a < nla; a++) for (let b = 0; b < nlo; b++) { lats.push(la1 - a * P); lons.push(lo0 + b * P); }
  const val = [];
  for (let i = 0; i < lats.length; i += 70) {
    let parte = await buscar('https://ensemble-api.open-meteo.com/v1/ensemble?latitude=' + lats.slice(i, i + 70).join(',') + '&longitude=' + lons.slice(i, i + 70).join(',') +
      '&daily=precipitation_sum&models=gfs05&timezone=America%2FSao_Paulo&start_date=' + ini + '&end_date=' + fim);
    if (!Array.isArray(parte)) parte = [parte];
    parte.forEach((p) => { const d = p.daily; let s = 0; d.time.forEach((_, k) => { const m = membros(d, k); s += m.reduce((a, x) => a + x, 0) / (m.length || 1); }); val.push(s); });
  }
  const g = (a, b) => val[Math.max(0, Math.min(nla - 1, a)) * nlo + Math.max(0, Math.min(nlo - 1, b))];
  return (la, lo) => {
    const fa = (la1 - la) / P, fb = (lo - lo0) / P, a = Math.floor(fa), b = Math.floor(fb), ta = fa - a, tb = fb - b;
    return g(a, b) * (1 - ta) * (1 - tb) + g(a + 1, b) * ta * (1 - tb) + g(a, b + 1) * (1 - ta) * tb + g(a + 1, b + 1) * ta * tb;
  };
}

// 30 dias no ponto da fazenda: chuva do dia (mediana dos cenários), chance de ≥1 mm e ≥5 mm, acumulado (10%, 50%, 90%)
export async function chuvaPonto(lat, lon) {
  const q = 'latitude=' + lat + '&longitude=' + lon + '&daily=precipitation_sum&timezone=America%2FSao_Paulo';
  const [ec, gf] = await Promise.all([
    buscar('https://ensemble-api.open-meteo.com/v1/ensemble?' + q + '&models=ecmwf_ifs025&forecast_days=15'),
    buscar('https://ensemble-api.open-meteo.com/v1/ensemble?' + q + '&models=gfs05&forecast_days=35')
  ]);
  const te = ec.daily.time, tg = gf.daily.time, dias = [], cen = [];
  for (let i = 0; i < 30; i++) {
    let m, mod, d;
    if (i < te.length) { m = membros(ec.daily, i); mod = 'ECMWF'; d = te[i]; }
    else { d = new Date(new Date(te[0] + 'T12:00:00Z').getTime() + i * 864e5).toISOString().slice(0, 10); const j = tg.indexOf(d); if (j < 0) break; m = membros(gf.daily, j); mod = 'GFS'; }
    cen.push(m);
    dias.push({ d, med: r1(mediana(m)), p1: Math.round(100 * m.filter((x) => x >= 1).length / m.length), p5: Math.round(100 * m.filter((x) => x >= 5).length / m.length), mod });
  }
  // acumulado de cada cenário: cenário k do ECMWF nos 15 primeiros dias + cenário k do GFS no resto
  const tot = (cen[0] || []).map((_, k) => cen.reduce((s, m) => s + m[k % m.length], 0)).sort((a, b) => a - b);
  const pct = (p) => (tot.length ? Math.round(tot[Math.min(tot.length - 1, Math.floor(p * tot.length))]) : 0);
  return { dias, acc: [pct(0.1), pct(0.5), pct(0.9)], gerado_em: new Date().toISOString() };
}

const chaveP = (l) => 'chuva:p:' + (Math.round(l.lat * 4) / 4).toFixed(2) + ',' + (Math.round(l.lon * 4) / 4).toFixed(2);

// cron de domingo à noite: o mapa e o ponto de cada fazenda que tem acesso de dono/gerente
export async function atualizarChuva(env) {
  PACIENTE = true;
  try { await atualizarChuva1(env); } finally { PACIENTE = false; }
}
async function atualizarChuva1(env) {
  try { await gravar(env, 'chuva:mapa', await mapaChuva()); } catch (e) { console.log('mapa da chuva:', e.message); }
  let ids = [];
  try {
    const { results } = await env.DB.prepare("SELECT fazendas FROM acessos_fazenda WHERE ativo = 1 AND papel != 'operador'").all();
    (results || []).forEach((r) => { try { ids = ids.concat(JSON.parse(r.fazendas || '[]')); } catch (e) { /* lista ruim */ } });
  } catch (e) { ids = []; }
  ids = [...new Set(ids)].slice(0, 200);
  const feitos = {};
  for (const id of ids) {
    const f = await env.DB.prepare('SELECT talhoes, municipio, uf FROM fazendas WHERE id = ?').bind(id).first();
    const l = f && await localDaFazenda(f);
    if (!l) continue;
    const k = chaveP(l);
    if (feitos[k]) continue;
    feitos[k] = 1;
    try { await gravar(env, k, Object.assign(await chuvaPonto(Math.round(l.lat * 4) / 4, Math.round(l.lon * 4) / 4), { lat: l.lat, lon: l.lon })); }
    catch (e) { console.log('chuva da fazenda', id, e.message); }
  }
}

// próximo domingo (dia da atualização)
function proximoDomingo() { const d = new Date(Date.now() - 4 * 3600e3); d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7 || 7)); return d.toISOString().slice(0, 10); }

// para a tela Início: o que estiver guardado; sem nada (ou vencido), busca agora e guarda
export async function chuvaDaFazenda(env, f) {
  const local = await localDaFazenda(f);
  if (!local) return { erro: 'sem local' };
  const velho = (x) => !x || !x.gerado_em || Date.now() - new Date(x.gerado_em).getTime() > VALIDADE;
  let [mapa, ponto] = await Promise.all([ler(env, 'chuva:mapa'), ler(env, chaveP(local))]);
  if (mapa && mapa.ver !== GRADE.ver) mapa = null;   // grade antiga
  if (velho(ponto)) {
    try { ponto = Object.assign(await chuvaPonto(Math.round(local.lat * 4) / 4, Math.round(local.lon * 4) / 4), { lat: local.lat, lon: local.lon }); await gravar(env, chaveP(local), ponto); }
    catch (e) { if (!ponto) ponto = null; }
  }
  if (velho(mapa)) {
    try { mapa = await mapaChuva(); await gravar(env, 'chuva:mapa', mapa); } catch (e) { if (!mapa) mapa = await ler(env, 'chuva:mapa'); }
  }
  return { local, ponto, mapa, proxima: proximoDomingo() };
}

// só o mapa (painel do consultor: um mapa único na tela principal)
export async function mapaGuardado(env) {
  let mapa = await ler(env, 'chuva:mapa');
  if (mapa && mapa.ver !== GRADE.ver) mapa = null;
  if (!mapa || !mapa.gerado_em || Date.now() - new Date(mapa.gerado_em).getTime() > VALIDADE) {
    try { mapa = await mapaChuva(); await gravar(env, 'chuva:mapa', mapa); } catch (e) { if (!mapa) mapa = await ler(env, 'chuva:mapa'); }
  }
  return { mapa, proxima: proximoDomingo() };
}
