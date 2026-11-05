/* Chuva dos próximos 30 dias (fazenda) e mapa da chuva (Brasil), para o dono/gerente.
   Atualiza uma vez por semana, domingo à noite (cron), e fica guardado no banco (tabela config):
   - "chuva:mapa": grade do Brasil (3°), chuva de cada dia nos próximos 15 dias (modelo europeu ECMWF)
   - "chuva:p:<lat>,<lon>": 30 dias no ponto da fazenda: 1–15 ECMWF (50 cenários), 16–30 GFS (tendência, 30 cenários) */
import { localDaFazenda } from './mercado.js';

const UA = 'Mozilla/5.0 (compatible; AMVS-Relatorio/1.0)';
const GRADE = { la0: -34, la1: 5, lo0: -74, lo1: -35, passo: 3 };
const VALIDADE = 8 * 864e5;   // passou disso sem atualizar (cron falhou): refaz quando alguém abrir

async function buscar(url) {
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
  const q = 'latitude=' + lats.join(',') + '&longitude=' + lons.join(',') + '&daily=precipitation_sum&forecast_days=15&timezone=America%2FSao_Paulo';
  let lista, fonte;
  try {
    lista = await buscar('https://api.open-meteo.com/v1/forecast?' + q + '&models=ecmwf_ifs025');
    fonte = 'ECMWF';
  } catch (e) {   // limite da previsão comum: usa a média dos cenários do mesmo modelo
    lista = await buscar('https://ensemble-api.open-meteo.com/v1/ensemble?' + q + '&models=ecmwf_ifs025');
    fonte = 'ECMWF (média dos cenários)';
  }
  if (!Array.isArray(lista)) lista = [lista];
  const datas = lista[0].daily.time;
  const v = datas.map((_, i) => lista.map((p) => { const m = membros(p.daily, i); return r1(m.reduce((s, x) => s + x, 0) / (m.length || 1)); }));
  const nlon = Math.round((GRADE.lo1 - GRADE.lo0) / GRADE.passo) + 1, nlat = Math.round((GRADE.la1 - GRADE.la0) / GRADE.passo) + 1;
  return Object.assign({}, GRADE, { nlat, nlon, datas, v, fonte, gerado_em: new Date().toISOString() });
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
  if (velho(ponto)) {
    try { ponto = Object.assign(await chuvaPonto(Math.round(local.lat * 4) / 4, Math.round(local.lon * 4) / 4), { lat: local.lat, lon: local.lon }); await gravar(env, chaveP(local), ponto); }
    catch (e) { if (!ponto) ponto = null; }
  }
  if (velho(mapa)) {
    try { mapa = await mapaChuva(); await gravar(env, 'chuva:mapa', mapa); } catch (e) { if (!mapa) mapa = null; }
  }
  return { local, ponto, mapa, proxima: proximoDomingo() };
}
