/* Tempo na fazenda (Open-Meteo) e mercado: dólar e soja/milho em Chicago (Yahoo Finance) e
   soja/milho no físico da praça mais próxima da fazenda (tabela pública do Notícias Agrícolas).
   As respostas ficam no cache da Cloudflare; o mercado também fica guardado no banco para quando a fonte cair. */

const UA = 'Mozilla/5.0 (compatible; AMVS-Relatorio/1.0)';

async function buscar(url, ttl, texto) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: texto ? 'text/html' : 'application/json' }, cf: { cacheTtl: ttl, cacheEverything: true } });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' em ' + new URL(url).host);
  return texto ? r.text() : r.json();
}
const r2 = (v) => Math.round(v * 100) / 100;

/* ---------------- local da fazenda ---------------- */
// centro do mapa (KML); sem mapa, o município cadastrado
export async function localDaFazenda(f) {
  try {
    const gj = typeof f.talhoes === 'string' ? JSON.parse(f.talhoes || 'null') : f.talhoes;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const passa = (c) => { if (typeof c[0] === 'number') { x0 = Math.min(x0, c[0]); x1 = Math.max(x1, c[0]); y0 = Math.min(y0, c[1]); y1 = Math.max(y1, c[1]); } else c.forEach(passa); };
    ((gj && gj.features) || []).forEach((ft) => { if (ft && ft.geometry && ft.geometry.coordinates) passa(ft.geometry.coordinates); });
    if (x0 < Infinity && Math.abs(y0) <= 90) return { lat: Math.round((y0 + y1) / 2 * 1000) / 1000, lon: Math.round((x0 + x1) / 2 * 1000) / 1000, fonte: 'mapa' };
  } catch (e) { /* sem mapa */ }
  if (f.municipio) {
    const g = await geocodificar(f.municipio, f.uf).catch(() => null);
    if (g) return Object.assign(g, { fonte: 'municipio' });
  }
  return null;
}

const UF_NOME = { AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Federal District', ES: 'Espírito Santo', GO: 'Goiás',
  MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí',
  RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins' };
const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

async function geocodificar(cidade, uf) {
  const j = await buscar('https://geocoding-api.open-meteo.com/v1/search?count=10&language=pt&country=BR&name=' + encodeURIComponent(cidade), 7 * 86400);
  const est = semAcento(UF_NOME[String(uf || '').toUpperCase()] || '');
  const l = (j.results || []).filter((x) => !est || semAcento(x.admin1) === est || semAcento(x.admin1).startsWith(est));
  const x = l[0] || (est ? null : (j.results || [])[0]);
  return x ? { lat: x.latitude, lon: x.longitude } : null;
}

/* ---------------- tempo ---------------- */
const TEMPO = {
  0: ['☀️', 'Céu limpo'], 1: ['🌤️', 'Poucas nuvens'], 2: ['⛅', 'Parcialmente nublado'], 3: ['☁️', 'Nublado'], 45: ['🌫️', 'Neblina'], 48: ['🌫️', 'Neblina'],
  51: ['🌦️', 'Garoa fraca'], 53: ['🌦️', 'Garoa'], 55: ['🌦️', 'Garoa forte'], 56: ['🌦️', 'Garoa'], 57: ['🌦️', 'Garoa'],
  61: ['🌧️', 'Chuva fraca'], 63: ['🌧️', 'Chuva'], 65: ['🌧️', 'Chuva forte'], 66: ['🌧️', 'Chuva'], 67: ['🌧️', 'Chuva forte'],
  80: ['🌦️', 'Pancadas de chuva'], 81: ['🌧️', 'Pancadas de chuva'], 82: ['⛈️', 'Pancadas fortes'], 95: ['⛈️', 'Trovoadas'], 96: ['⛈️', 'Trovoadas'], 99: ['⛈️', 'Trovoadas']
};
const tempo = (c) => TEMPO[c] || ['⛅', ''];

// boas práticas de pulverização: vento 3–10 km/h, temperatura até 30 °C, umidade 55% ou mais, sem chuva
export const LIM_PULV = { ventoMin: 3, vento: 10, temp: 30, umid: 55 };
function situacaoHora(v, t, u, prob, mm) {
  if (prob >= 60 || mm >= 0.5 || v > 15 || t > 33 || u < 40) return 'ruim';
  if (prob >= 30 || v > LIM_PULV.vento || v < LIM_PULV.ventoMin || t > LIM_PULV.temp || u < LIM_PULV.umid) return 'md';
  return 'ok';
}

export async function climaDe(lat, lon) {
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat.toFixed(2) + '&longitude=' + lon.toFixed(2) +
    '&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code' +
    '&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation_probability,precipitation' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max' +
    '&timezone=auto&forecast_days=7&wind_speed_unit=kmh';
  const j = await buscar(url, 1200);
  const c = j.current || {}, h = j.hourly || {}, d = j.daily || {};
  const agoraIso = String(c.time || '').slice(0, 13);   // "2026-11-05T23"
  const iH = (h.time || []).findIndex((t) => t.slice(0, 13) === agoraIso);
  const hojeL = String(c.time || '').slice(0, 10), horaL = Number(String(c.time || '').slice(11, 13)) || 0;
  // janela de pulverização: hoje até as 10h; depois disso, amanhã (05h às 18h)
  const diaJ = horaL < 10 ? hojeL : (d.time || [])[1] || hojeL;
  const horas = [];
  (h.time || []).forEach((t, i) => {
    if (t.slice(0, 10) !== diaJ) return;
    const hr = Number(t.slice(11, 13));
    if (hr < 5 || hr > 18) return;
    const v = h.wind_speed_10m[i], te = h.temperature_2m[i], u = h.relative_humidity_2m[i], p = h.precipitation_probability[i] || 0, mm = h.precipitation[i] || 0;
    horas.push({ h: hr, st: situacaoHora(v, te, u, p, mm), vento: Math.round(v), temp: Math.round(te), umid: Math.round(u), prob: p });
  });
  // maior trecho seguido de horas boas
  let melhor = null, ini = -1;
  horas.concat({ st: 'fim' }).forEach((x, i) => {
    if (x.st === 'ok') { if (ini < 0) ini = i; return; }
    if (ini >= 0 && (!melhor || i - ini > melhor[1] - melhor[0])) melhor = [ini, i];
    ini = -1;
  });
  return {
    agora: { temp: Math.round(c.temperature_2m), umid: Math.round(c.relative_humidity_2m), vento: Math.round(c.wind_speed_10m), cod: c.weather_code,
      ic: tempo(c.weather_code)[0], txt: tempo(c.weather_code)[1], prob: iH >= 0 ? h.precipitation_probability[iH] || 0 : null, hora: String(c.time || '').slice(11, 16) },
    dias: (d.time || []).map((t, i) => ({ d: t, cod: d.weather_code[i], ic: tempo(d.weather_code[i])[0], txt: tempo(d.weather_code[i])[1],
      max: Math.round(d.temperature_2m_max[i]), min: Math.round(d.temperature_2m_min[i]), mm: Math.round((d.precipitation_sum[i] || 0) * 10) / 10, prob: d.precipitation_probability_max[i] || 0 })),
    janela: { dia: diaJ, hoje: diaJ === hojeL, horas, melhor: melhor ? { de: horas[melhor[0]].h, ate: horas[melhor[1] - 1].h + 1 } : null },
    limites: LIM_PULV
  };
}

/* ---------------- mercado ---------------- */
// coordenadas das praças da tabela (as que aparecerem novas são procuradas pelo nome)
const PRACAS = {
  'Não-Me-Toque/RS': [-28.46, -52.82], 'Nonoai/RS': [-27.36, -52.77], 'Ubiratã/PR': [-24.54, -52.99], 'Castro/PR': [-24.79, -50.01],
  'Marechal Cândido Rondon/PR': [-24.56, -54.06], 'Pato Branco/PR': [-26.23, -52.67], 'Palma Sola/SC': [-26.35, -53.28], 'Rio do Sul/SC': [-27.21, -49.64],
  'Rondonópolis/MT': [-16.47, -54.64], 'Primavera do Leste/MT': [-15.56, -54.30], 'Alto Garças/MT': [-16.94, -53.53], 'Itiquira/MT': [-17.21, -54.15],
  'Tangará da Serra/MT': [-14.62, -57.49], 'Campo Novo do Parecis/MT': [-13.67, -57.89], 'Sorriso/MT': [-12.55, -55.71],
  'São Gabriel do Oeste/MS': [-19.39, -54.57], 'Maracaju/MS': [-21.61, -55.17], 'Campo Grande/MS': [-20.47, -54.62], 'Eldorado/MS': [-23.79, -54.28],
  'Jataí/GO': [-17.88, -51.72], 'Rio Verde/GO': [-17.80, -50.93], 'Brasília/DF': [-15.79, -47.88], 'Oeste da Bahia/BA': [-12.15, -45.00],
  'Luís Eduardo Magalhães/BA': [-12.09, -45.80], 'Machado/MG': [-21.67, -45.92], 'Cândido Mota/SP': [-22.75, -50.39],
  'Itapetininga/SP': [-23.59, -48.05], 'Campinas/SP': [-22.91, -47.06]
};
const NA = {
  soja: 'https://www.noticiasagricolas.com.br/cotacoes/soja/soja-mercado-fisico-sindicatos-e-cooperativas',
  milho: 'https://www.noticiasagricolas.com.br/cotacoes/milho/milho-mercado-fisico-sindicatos-e-cooperativas'
};
const num = (s) => { const n = Number(String(s || '').replace(/\./g, '').replace(',', '.').replace(/[^\d.+-]/g, '')); return Number.isFinite(n) ? n : null; };

// tabela "Praça | Preço (R$/sc 60 kg) | Variação" de cada fechamento → { "Sorriso/MT": [{d, p}, ...] } (mais antigo primeiro)
export function lerPracas(html) {
  const out = {};
  String(html).split('<div class="fechamento">').slice(1, 16).forEach((bl) => {
    const m = bl.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!m) return;
    const d = m[3] + '-' + m[2] + '-' + m[1];
    const tab = bl.split('</table>')[0];
    const re = /<tr>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>/g;
    let x;
    while ((x = re.exec(tab))) {
      const nome = x[1].replace(/<[^>]+>/g, '').replace(/\s*\(.*$/, '').replace(/\s+/g, ' ').trim();
      const p = num(x[2]);
      if (!nome || /^porto/i.test(nome) || !/\/[A-Z]{2}$/.test(nome) || !p) continue;
      (out[nome] = out[nome] || []);
      if (!out[nome].some((y) => y.d === d)) out[nome].push({ d, p });
    }
  });
  Object.keys(out).forEach((k) => out[k].sort((a, b) => (a.d < b.d ? -1 : 1)));
  return out;
}

// preço no porto (exportação), linhas "Porto Paranaguá (disponível)" da mesma tabela: { 'Paranaguá': [{d, p}] }
const PORTOS = { 'Paranaguá': [-25.52, -48.51], 'Rio Grande': [-32.03, -52.10], 'Santos': [-23.96, -46.33] };
export function lerPortos(html) {
  const out = {};
  String(html).split('<div class="fechamento">').slice(1, 16).forEach((bl) => {
    const m = bl.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!m) return;
    const d = m[3] + '-' + m[2] + '-' + m[1];
    const re = /<tr>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>/g;
    let x;
    const tab = bl.split('</table>')[0];
    while ((x = re.exec(tab))) {
      const txt = x[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (!/^porto/i.test(txt) || !/dispon/i.test(txt)) continue;   // só o disponível (entrega imediata)
      const nome = Object.keys(PORTOS).filter((k) => semAcento(txt).indexOf(semAcento(k)) >= 0)[0];
      const p = num(x[2]);
      if (!nome || !p) continue;
      (out[nome] = out[nome] || []);
      if (!out[nome].some((y) => y.d === d)) out[nome].push({ d, p });
    }
  });
  Object.keys(out).forEach((k) => out[k].sort((a, b) => (a.d < b.d ? -1 : 1)));
  return out;
}

async function yahoo(simbolo, div) {
  const j = await buscar('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(simbolo) + '?range=1mo&interval=1d', 1200);
  const r = j.chart && j.chart.result && j.chart.result[0];
  if (!r) throw new Error('sem dados ' + simbolo);
  const ts = r.timestamp || [], cl = (r.indicators && r.indicators.quote && r.indicators.quote[0] && r.indicators.quote[0].close) || [];
  const serie = [];
  ts.forEach((t, i) => { if (cl[i] != null) serie.push({ d: new Date(t * 1000).toISOString().slice(0, 10), p: cl[i] / div }); });
  const atual = (r.meta && r.meta.regularMarketPrice) ? r.meta.regularMarketPrice / div : (serie.length ? serie[serie.length - 1].p : null);
  if (atual == null) throw new Error('sem preço ' + simbolo);
  const hoje = new Date((r.meta.regularMarketTime || Date.now() / 1000) * 1000).toISOString().slice(0, 10);
  if (serie.length && serie[serie.length - 1].d === hoje) serie[serie.length - 1].p = atual; else serie.push({ d: hoje, p: atual });
  const ant = serie.length > 1 ? serie[serie.length - 2].p : null;
  return { preco: r2(atual * 10000) / 10000, var: ant ? r2((atual - ant) / ant * 100) : null, serie: serie.slice(-15).map((x) => r2(x.p * 100) / 100), em: hoje };
}
async function dolar() {
  try { return await yahoo('BRL=X', 1); } catch (e) {
    const j = await buscar('https://economia.awesomeapi.com.br/json/daily/USD-BRL/15', 1200);
    const l = (Array.isArray(j) ? j : []).slice().reverse();
    if (!l.length) throw e;
    const u = l[l.length - 1];
    return { preco: Number(u.bid), var: Number(u.pctChange), serie: l.map((x) => Number(x.bid)), em: new Date(Number(u.timestamp) * 1000).toISOString().slice(0, 10) };
  }
}

let MEM = null;   // cache do isolate: { em, dados }
export async function mercadoGeral(env) {
  if (MEM && Date.now() - MEM.em < 20 * 60 * 1000) return MEM.dados;
  const pega = (p) => p.then((v) => v, () => null);
  const [usd, zs, zc, hs, hm] = await Promise.all([pega(dolar()), pega(yahoo('ZS=F', 100)), pega(yahoo('ZC=F', 100)),
    pega(buscar(NA.soja, 1800, true)), pega(buscar(NA.milho, 1800, true))]);
  let dados = { dolar: usd, cbot_soja: zs, cbot_milho: zc, pracas: { soja: hs ? lerPracas(hs) : null, milho: hm ? lerPracas(hm) : null },
    portos: { soja: hs ? lerPortos(hs) : null, milho: hm ? lerPortos(hm) : null }, em: new Date().toISOString() };
  // o que não veio agora sai do último guardado
  let guardado = null;
  try { const r = await env.DB.prepare("SELECT valor FROM config WHERE chave = 'mercado_ultimo'").first(); guardado = r ? JSON.parse(r.valor) : null; } catch (e) { guardado = null; }
  if (guardado) {
    ['dolar', 'cbot_soja', 'cbot_milho'].forEach((k) => { if (!dados[k] && guardado[k]) dados[k] = Object.assign({}, guardado[k], { antigo: true }); });
    ['soja', 'milho'].forEach((k) => { if ((!dados.pracas[k] || !Object.keys(dados.pracas[k]).length) && guardado.pracas && guardado.pracas[k]) dados.pracas[k] = guardado.pracas[k]; });
    ['soja', 'milho'].forEach((k) => { if ((!dados.portos[k] || !Object.keys(dados.portos[k]).length) && guardado.portos && guardado.portos[k]) dados.portos[k] = guardado.portos[k]; });
  }
  const completo = dados.dolar && !dados.dolar.antigo && dados.pracas.soja && Object.keys(dados.pracas.soja).length;
  if (completo) {
    try {
      await env.DB.prepare("INSERT INTO config (chave, valor) VALUES ('mercado_ultimo', ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor").bind(JSON.stringify(dados)).run();
    } catch (e) { /* tabela config ausente: segue sem guardar */ }
  }
  MEM = { em: completo ? Date.now() : Date.now() - 15 * 60 * 1000, dados };   // incompleto: tenta de novo em 5 min
  return dados;
}

function km(a, b) {
  const R = 6371, rad = Math.PI / 180, dLa = (b[0] - a[0]) * rad, dLo = (b[1] - a[1]) * rad;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
// praça com preço recente mais perto da fazenda (a do próprio município fica a 0–20 km)
async function pracaPerto(tab, local) {
  if (!tab || !local) return null;
  const nomes = Object.keys(tab);
  if (!nomes.length) return null;
  const ult = nomes.map((n) => tab[n][tab[n].length - 1].d).sort().pop();
  const limite = new Date(new Date(ult + 'T12:00:00Z').getTime() - 7 * 864e5).toISOString().slice(0, 10);
  let best = null, novos = 0;
  for (const n of nomes) {
    const s = tab[n];
    if (s[s.length - 1].d < limite) continue;
    let c = PRACAS[n];
    if (!c && novos < 4) {   // praça nova na tabela: procura a cidade (fica no cache)
      novos++;
      const [cid, uf] = n.split('/');
      const g = await geocodificar(cid, uf).catch(() => null);
      if (g) c = PRACAS[n] = [g.lat, g.lon];
    }
    if (!c) continue;
    const dist = km([local.lat, local.lon], c);
    if (!best || dist < best.km) best = { praca: n, km: Math.round(dist), serie: s };
  }
  if (!best) return null;
  const s = best.serie, u = s[s.length - 1], a = s.length > 1 ? s[s.length - 2] : null;
  return { praca: best.praca, km: best.km, preco: u.p, em: u.d, var: a ? r2((u.p - a.p) / a.p * 100) : null, serie: s.map((x) => x.p) };
}

/* Formação do preço da soja na fazenda (paridade de exportação):
   porto (R$/sc) = (Chicago + prêmio) × 2,2046 bu/sc × dólar  → o prêmio sai do preço do porto do dia
   fazenda (R$/sc) = porto − frete (R$/t ÷ 16,667 sc/t)
   base local (US$/bu) = preço da praça ÷ (dólar × 2,2046) − Chicago */
const BU_SC = 2.20462, SC_T = 1000 / 60;
export function freteEstimado(local, porto) {
  const kmRod = Math.round(km([local.lat, local.lon], PORTOS[porto]) * 1.3);   // estrada ≈ 30% mais que a linha reta
  return { km: kmRod, rt: Math.round(kmRod * 0.16) };                       // ~R$ 0,16 por tonelada·km (granel, longa distância)
}
function formacao(m, local, praca, frete) {
  const cbot = m.cbot_soja, usd = m.dolar, portos = (m.portos && m.portos.soja) || {};
  if (!cbot || !usd || !local) return null;
  const nomes = Object.keys(portos);
  if (!nomes.length) return null;
  let porto = frete && frete.porto && portos[frete.porto] ? frete.porto : null;
  if (!porto) porto = nomes.sort((a, b) => km([local.lat, local.lon], PORTOS[a]) - km([local.lat, local.lon], PORTOS[b]))[0];
  const s = portos[porto], u = s[s.length - 1];
  const conv = usd.preco * BU_SC, premio = u.p / conv - cbot.preco;
  const est = freteEstimado(local, porto);
  const rt = frete && frete.rt > 0 ? frete.rt : est.rt, freteSc = rt / SC_T, naFaz = u.p - freteSc;
  // custos e margem da região (porto, impostos como o Fethab, armazém, trade): paridade na praça − preço que a praça paga.
  // O frete da praça usa a mesma tarifa por km do frete da fazenda (se o real foi informado, a praça segue a mesma proporção).
  let custos = null;
  const cp = praca && PRACAS[praca.praca];
  if (cp) {
    const fp = freteEstimado({ lat: cp[0], lon: cp[1] }, porto), escala = est.rt ? rt / est.rt : 1;
    const parPraca = u.p - fp.rt * escala / SC_T;
    custos = { sc: r2(Math.max(0, parPraca - praca.preco)), paridade_praca: r2(parPraca), frete_praca_rt: Math.round(fp.rt * escala) };
  }
  const venda = custos ? naFaz - custos.sc : null;
  return {
    cbot: cbot.preco, dolar: usd.preco, porto: { nome: porto, preco: u.p, em: u.d }, premio: r2(premio),
    frete: { rt, estimado: !(frete && frete.rt > 0), km: est.km, rt_estimado: est.rt, sc: r2(freteSc), em: frete && frete.em, por: frete && frete.por },
    fazenda: r2(naFaz), custos, venda: venda != null ? r2(venda) : null,
    praca: praca ? { nome: praca.praca, preco: praca.preco, km: praca.km, base: r2(praca.preco / conv - cbot.preco), dif: r2(praca.preco - (venda != null ? venda : naFaz)) } : null,
    portos: nomes
  };
}

export async function mercadoDaFazenda(env, local, frete) {
  const m = await mercadoGeral(env);
  const soja = await pracaPerto(m.pracas.soja, local);
  return {
    dolar: m.dolar, cbot_soja: m.cbot_soja, cbot_milho: m.cbot_milho,
    soja, milho: await pracaPerto(m.pracas.milho, local),
    formacao: formacao(m, local, soja, frete),
    fonte: 'Dólar e Chicago: Yahoo Finance · Físico: Notícias Agrícolas (sindicatos e cooperativas)'
  };
}
