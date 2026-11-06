/* Chuva dos próximos 15 dias (fazenda) e mapa da chuva (Brasil), para o dono/gerente. Modelo europeu (ECMWF).
   Atualiza todo dia às 4h30 de MT (cron) e fica guardado no banco (tabela config):
   - "chuva:mapa": grade do Brasil, chuva de cada dia nos próximos 15 dias
   - "chuva:p:<lat>,<lon>": 15 dias no ponto da fazenda (50 cenários do ECMWF) */
import { localDaFazenda } from './mercado.js';

const UA = 'Mozilla/5.0 (compatible; AMVS-Relatorio/1.0)';
const GRADE = { la0: -35, la1: 7, lo0: -76, lo1: -32, passo: 2, ver: 2 };   // ver: muda quando a grade muda (refaz o guardado)
const VALIDADE = 26 * 3600e3;   // passou disso sem atualizar (cron falhou): refaz quando alguém abrir
const VER_PONTO = 2;            // 2: só os 15 dias do ECMWF (antes: 30 dias com o GFS no fim)

// limite por minuto do Open-Meteo: na atualização da madrugada (sem pressa) espera 1 minuto e tenta de novo
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
  return Object.assign({}, GRADE, { nlat, nlon, datas, v, fonte, gerado_em: new Date().toISOString() });
}

// 15 dias no ponto da fazenda: chuva do dia (mediana dos cenários), chance de ≥1 mm e ≥5 mm, acumulado (10%, 50%, 90%)
export async function chuvaPonto(lat, lon) {
  const q = 'latitude=' + lat + '&longitude=' + lon + '&daily=precipitation_sum&timezone=America%2FSao_Paulo';
  const ec = await buscar('https://ensemble-api.open-meteo.com/v1/ensemble?' + q + '&models=ecmwf_ifs025&forecast_days=15');
  const te = ec.daily.time, dias = [], cen = [];
  for (let i = 0; i < Math.min(15, te.length); i++) {
    const m = membros(ec.daily, i);
    cen.push(m);
    dias.push({ d: te[i], med: r1(mediana(m)), p1: Math.round(100 * m.filter((x) => x >= 1).length / m.length), p5: Math.round(100 * m.filter((x) => x >= 5).length / m.length), mod: 'ECMWF' });
  }
  // acumulado de cada cenário nos 15 dias
  const tot = (cen[0] || []).map((_, k) => cen.reduce((s, m) => s + (m[k] || 0), 0)).sort((a, b) => a - b);
  const pct = (p) => (tot.length ? Math.round(tot[Math.min(tot.length - 1, Math.floor(p * tot.length))]) : 0);
  return { ver: VER_PONTO, dias, acc: [pct(0.1), pct(0.5), pct(0.9)], gerado_em: new Date().toISOString() };
}

const chaveP = (l) => 'chuva:p:' + (Math.round(l.lat * 4) / 4).toFixed(2) + ',' + (Math.round(l.lon * 4) / 4).toFixed(2);

// cron de todo dia (4h30 de MT): o mapa e o ponto de cada fazenda que tem acesso de dono/gerente
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

// próxima atualização: hoje às 4h30 de MT se ainda não passou; senão amanhã
function proximaAtualizacao() {
  const mt = new Date(Date.now() - 4 * 3600e3), passou = mt.getUTCHours() * 60 + mt.getUTCMinutes() >= 4 * 60 + 30;
  if (passou) mt.setUTCDate(mt.getUTCDate() + 1);
  return mt.toISOString().slice(0, 10);
}

// para a tela Início: o que estiver guardado; sem nada (ou vencido), busca agora e guarda
export async function chuvaDaFazenda(env, f) {
  const local = await localDaFazenda(f);
  if (!local) return { erro: 'sem local' };
  const velho = (x) => !x || !x.gerado_em || Date.now() - new Date(x.gerado_em).getTime() > VALIDADE;
  const pontoVelho = (x) => velho(x) || (x.ver || 1) !== VER_PONTO;
  let [mapa, ponto] = await Promise.all([ler(env, 'chuva:mapa'), ler(env, chaveP(local))]);
  if (mapa && mapa.ver !== GRADE.ver) mapa = null;   // grade antiga
  if (pontoVelho(ponto)) {
    try { ponto = Object.assign(await chuvaPonto(Math.round(local.lat * 4) / 4, Math.round(local.lon * 4) / 4), { lat: local.lat, lon: local.lon }); await gravar(env, chaveP(local), ponto); }
    catch (e) { if (!ponto) ponto = null; }
  }
  if (velho(mapa)) {
    try { mapa = await mapaChuva(); await gravar(env, 'chuva:mapa', mapa); } catch (e) { if (!mapa) mapa = await ler(env, 'chuva:mapa'); }
  }
  return { local, ponto, mapa, proxima: proximaAtualizacao() };
}

// só o mapa (painel do consultor: um mapa único na tela principal)
export async function mapaGuardado(env) {
  let mapa = await ler(env, 'chuva:mapa');
  if (mapa && mapa.ver !== GRADE.ver) mapa = null;
  if (!mapa || !mapa.gerado_em || Date.now() - new Date(mapa.gerado_em).getTime() > VALIDADE) {
    try { mapa = await mapaChuva(); await gravar(env, 'chuva:mapa', mapa); } catch (e) { if (!mapa) mapa = await ler(env, 'chuva:mapa'); }
  }
  return { mapa, proxima: proximaAtualizacao() };
}
