/* ============================================================
   agrorel.js — blocos do relatório do cliente vindos do plantio e das recomendações
     • próximas aplicações (alerta dentro do relatório enviado)
     • mapa colorido por variedade + evolução do plantio
     • etiquetas de cultura/DAE/sementes em cada talhão
     • bloco final "Aplicações" (produtos, dose, calda por tanque, total)
   Só aparece quando há dados; o relatório antigo continua igual.
   ============================================================ */

const esc = (s) => String(s == null ? '' : s)
  .replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const fmt = (n, d) => Number(n || 0).toLocaleString('pt-BR', {
  minimumFractionDigits: d == null ? 1 : d, maximumFractionDigits: d == null ? 1 : d
});
const dataBR = (iso) => { const p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '—'; };
const curta = (iso) => dataBR(iso).slice(0, 5);

// hoje em Mato Grosso (UTC-4), para o "DAE" e os alertas
const hojeMT = () => new Date(Date.now() - 4 * 3600 * 1000).toISOString().slice(0, 10);
const addDias = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const difDias = (a, b) => Math.round((new Date(a + 'T12:00:00Z') - new Date(b + 'T12:00:00Z')) / 864e5);

const FEM = /^(Dessecação|Adubação|Outra)/;
const ordTxt = (op, n) => n + (FEM.test(op) ? 'ª ' : 'º ') + op;
const unid = (u) => String(u || '').split('/')[0];
const liquido = (u) => /^(L|mL)\//.test(String(u || ''));
const volTotal = (v, u) => fmt(v, v < 10 ? 1 : 0) + ' ' + unid(u);
const doseTxt = (d) => fmt(d, d < 1 ? 2 : (d % 1 ? 1 : 0));

const CULTURAS = { soja: 'Soja', milho: 'Milho', algodao: 'Algodão', feijao: 'Feijão', sorgo: 'Sorgo',
  pastagem: 'Pastagem', pousio: 'Pousio', outra: 'Outra cultura' };
const SEM_PLANTIO = { pastagem: 1, pousio: 1 };

/* ---------------- ajuda ---------------- */

function tanques(ha, hat, calda) {
  const n = Math.floor(ha / hat + 1e-9), resto = Math.round((ha - n * hat) * 10) / 10;
  let t = n + (n === 1 ? ' tanque cheio' : ' tanques cheios');
  if (resto > 0.05) t += ' + 1 com ' + fmt(resto) + ' ha (' + fmt(resto * calda, 0) + ' L de calda)';
  return t;
}

function areasDoMapa(mapa) {
  const a = {};
  ((mapa && mapa.features) || []).forEach((f) => {
    const p = f.properties || {};
    if (p.nome) a[p.nome] = Number(p.area_ha) || 0;
  });
  return a;
}

const dadosDe = (r) => (r && r.dados) || {};
const talDe = (r) => Array.isArray(dadosDe(r).tal) ? dadosDe(r).tal : [];
const feitoDe = (r) => dadosDe(r).feito || {};
const proxDe = (r) => dadosDe(r).prox || {};
const prodsDe = (r) => Array.isArray(dadosDe(r).prods) ? dadosDe(r).prods : [];

function venc(r, t) {
  const d = dadosDe(r), f = feitoDe(r)[t];
  return f && Number(d.rep) > 0 ? addDias(f, Number(d.rep)) : null;
}

function situ(data, aviso, hoje) {
  const n = difDias(data, hoje);
  if (n < 0) return { k: 'venc', n };
  if (n === 0) return { k: 'hoje', n };
  if (n <= aviso) return { k: 'perto', n };
  return { k: 'ok', n };
}

/* ---------------- próximas aplicações ---------------- */

function proximas(recs, hoje) {
  const itens = [];
  recs.forEach((r) => {
    const d = dadosDe(r);
    if (!(Number(d.rep) > 0) || !(Number(d.num || 1) < Number(d.total || 1))) return;
    const por = {};
    talDe(r).forEach((t) => {
      if (feitoDe(r)[t] && !proxDe(r)[t]) { const v = venc(r, t); (por[v] = por[v] || []).push(t); }
    });
    Object.keys(por).forEach((v) => {
      const st = situ(v, Number(d.aviso) || 0, hoje);
      if (st.k !== 'ok') itens.push({ d: v, st, op: r.operacao, num: Number(d.num || 1) + 1, tal: por[v] });
    });
  });
  if (!itens.length) return '';
  itens.sort((a, b) => (a.d < b.d ? -1 : 1));
  const linhas = itens.map((e) => {
    const q = e.st.k === 'venc' ? 'prevista para ' + curta(e.d) + ' · em atraso'
      : e.st.k === 'hoje' ? 'prevista para hoje'
        : 'prevista para ' + curta(e.d) + ' · em ' + e.st.n + ' dia' + (e.st.n > 1 ? 's' : '');
    return '<div class="px ' + (e.st.k === 'perto' ? 'perto' : 'venc') + '"><i></i><div><b>' + esc(ordTxt(e.op, e.num)) +
      '</b> <span>' + esc(e.tal.join(', ')) + '</span><small>' + q + '</small></div></div>';
  }).join('');
  return '<div class="prox-cli"><h5>📅 Próximas aplicações</h5>' + linhas + '</div>';
}

/* ---------------- aplicações (bloco final) ---------------- */

function aplicacoes(recs, areas, hoje) {
  const grupos = {}, ordem = [];
  recs.forEach((r) => {
    const d = dadosDe(r), prods = prodsDe(r);
    const k = r.operacao + '|' + (d.num || 1) + '|' + prods.map((p) => p[0] + p[1]).join(',');
    if (!grupos[k]) {
      grupos[k] = { op: r.operacao, num: Number(d.num || 1), prods, tal: [], feito: {}, prox: null,
        total: Number(d.total || 1), rep: Number(d.rep || 0), data: r.data_prevista || '',
        calda: Number(d.calda || 0), tanque: Number(d.tanque || 0), ha: {} };
      ordem.push(k);
    }
    const g = grupos[k];
    talDe(r).forEach((t) => {
      if (g.tal.indexOf(t) < 0) g.tal.push(t);
      { const tot = areas[t] || 0, pt = Number(d.parte && d.parte[t]) || 0; g.ha[t] = Math.min(tot, (g.ha[t] || 0) + (pt > 0 && pt < tot ? pt : tot)); }
      if (feitoDe(r)[t]) g.feito[t] = feitoDe(r)[t];
      const v = venc(r, t);
      if (v && !proxDe(r)[t] && (!g.prox || v < g.prox)) g.prox = v;
    });
    if (r.data_prevista && (!g.data || r.data_prevista < g.data)) g.data = r.data_prevista;
  });
  const lista = ordem.map((k) => grupos[k]).sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
  if (!lista.length) return '';
  const cont = {};
  lista.forEach((g) => { cont[g.op] = Math.max(cont[g.op] || 0, g.num); });
  const haDe = (g) => g.tal.reduce((s, t) => s + (g.ha[t] || 0), 0);

  let h = '<h2 class="talhao">Aplicações<small>' + lista.length + ' no total</small></h2>' +
    '<div class="ap-sub">Dose por hectare e quantidade total para a área de cada aplicação.</div>';
  lista.forEach((g) => {
    const feitos = g.tal.filter((t) => g.feito[t]), datas = feitos.map((t) => g.feito[t]).sort(), ha = haDe(g);
    let st, sel;
    if (feitos.length && feitos.length === g.tal.length) { st = 'Aplicada'; sel = 'v'; }
    else if (feitos.length) { st = 'Em andamento'; sel = 'a'; }
    else { st = 'Prevista'; sel = 'b'; }
    const quando = feitos.length
      ? (datas[0] === datas[datas.length - 1] ? 'em ' + curta(datas[0]) : 'de ' + curta(datas[0]) + ' a ' + curta(datas[datas.length - 1]))
      : (g.data ? 'para ' + curta(g.data) : '');
    const liq = g.calda > 0 && g.tanque > 0 && g.prods.some((p) => liquido(p[2]));
    const hat = liq ? g.tanque / g.calda : 0;
    const titulo = (cont[g.op] > 1 || g.total > 1) ? ordTxt(g.op, g.num) : g.op;
    h += '<div class="ap-card"><div class="ap-topo"><b>' + esc(titulo) + '</b><span class="selo ' + sel + '">' + st + '</span></div>' +
      '<div class="ap-meta">' + (feitos.length ? 'Aplicado ' : 'Prevista ') + quando +
        (feitos.length && feitos.length < g.tal.length ? ' · ' + feitos.length + ' de ' + g.tal.length + ' talhões' : '') + '</div>' +
      '<div class="ap-tal">' + g.tal.map((t) => '<span class="' + (g.feito[t] ? 'ok' : '') + '">' +
        (g.feito[t] && feitos.length < g.tal.length ? '✔ ' : '') + esc(t) + '</span>').join('') +
        (ha ? '<em>' + fmt(ha) + ' ha</em>' : '') + '</div>' +
      (liq ? '<div class="ap-calda">💧 Calda <b>' + g.calda + ' L/ha</b> · tanque de <b>' + fmt(g.tanque, 0) + ' L</b> cobre <b>' +
        fmt(hat, 0) + ' ha</b>' + (ha ? '<br><span>' + tanques(ha, hat, g.calda) + '</span>' : '') + '</div>' : '') +
      '<div class="ap-prod' + (liq ? ' q4' : '') + '"><div class="ap-th"><span>Produto</span><span>Dose/ha</span>' +
        (liq ? '<span>Por tanque</span>' : '') + (ha ? '<span>Total</span>' : '') + '</div>' +
      g.prods.map((p) => '<div><span>' + esc(p[0]) + '</span><span>' + doseTxt(Number(p[1])) + ' ' + esc(unid(p[2])) + '</span>' +
        (liq ? '<span class="tq">' + volTotal(p[1] * hat, p[2]) + '</span>' : '') +
        (ha ? '<b>' + volTotal(p[1] * ha, p[2]) + '</b>' : '') + '</div>').join('') + '</div>' +
      (g.prox && g.num < g.total ? '<div class="ap-prox">📅 Próxima aplicação: <b>' + (g.prox < hoje ? 'a programar' : curta(g.prox)) + '</b></div>' : '') +
      '</div>';
  });
  return h;
}

/* ---------------- mapa por variedade ---------------- */

const PALETA = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#6250d6', '#008300', '#e34948'];
const SEM_VAR = '#D5DBD7';
const codVar = (v) => String(v || '').replace(/^(Cultivar|Híbrido)\s*/i, '');

function mapaVariedade(mapa, plantio, hoje) {
  const feats = (mapa && mapa.features) || [];
  if (!feats.length) return '';
  const porTal = {};
  plantio.forEach((p) => { porTal[p.talhao] = p; });
  if (!plantio.some((p) => p.variedade)) return '';

  const vars = [...new Set(plantio.map((p) => p.variedade).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const cor = (v) => { const i = vars.indexOf(v); return v && i >= 0 ? PALETA[i % PALETA.length] : SEM_VAR; };

  let minX = 180, minY = 90, maxX = -180, maxY = -90;
  const each = (f, cb) => { const g = f.geometry; if (!g) return; (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).forEach(cb); };
  feats.forEach((f) => each(f, (rings) => rings.forEach((r) => r.forEach((p) => {
    minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
  }))));
  const dx = (maxX - minX) || 0.001, dy = (maxY - minY) || 0.001;
  minX -= dx * 0.03; maxX += dx * 0.03; minY -= dy * 0.03; maxY += dy * 0.03;
  const W = 1000;
  const H = Math.max(300, Math.round(W * ((maxY - minY) / (maxX - minX)) * Math.cos((minY + maxY) / 2 * Math.PI / 180)));
  const px = (l) => (l - minX) / (maxX - minX) * W, py = (l) => H - (l - minY) / (maxY - minY) * H;

  let sv = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Mapa da fazenda colorido por variedade">' +
    '<rect width="' + W + '" height="' + H + '" fill="#F1F4F2"/>';
  const rot = [];
  feats.forEach((f) => {
    const nome = (f.properties && f.properties.nome) || '';
    const p = porTal[nome] || {};
    const area = (f.properties && Number(f.properties.area_ha)) || 0;
    const dae = p.data_emerg && difDias(hoje, p.data_emerg) >= 0 ? difDias(hoje, p.data_emerg) : null;
    const info = '<b>' + esc(nome) + '</b> · ' + esc(CULTURAS[p.cultura] || 'sem cadastro') +
      (p.variedade ? ' · ' + esc(codVar(p.variedade)) : ' · sem variedade') + (area ? ' · ' + fmt(area) + ' ha' : '') +
      (p.data_plantio ? ' · plantio ' + curta(p.data_plantio) : '') + (dae !== null ? ' · DAE ' + dae : '');
    let d = '';
    each(f, (rings) => { d += rings.map((r) => 'M' + r.map((q) => px(q[0]).toFixed(1) + ',' + py(q[1]).toFixed(1)).join('L') + 'Z').join(' '); });
    sv += '<path class="mv" data-info="' + esc(info) + '" d="' + d + '" fill="' + cor(p.variedade) + '"/>';
    // centro do talhão pela área (o centro por vértices desloca o rótulo para o lado mais recortado)
    let ar = 0, gx = 0, gy = 0, sx = 0, sy = 0, n = 0;
    each(f, (rings) => {
      const r = rings[0];
      for (let i = 0; i < r.length; i++) {
        const q = r[i], w = r[(i + 1) % r.length];
        const cr = q[0] * w[1] - w[0] * q[1];
        ar += cr; gx += (q[0] + w[0]) * cr; gy += (q[1] + w[1]) * cr;
        sx += q[0]; sy += q[1]; n++;
      }
    });
    const ok = Math.abs(ar) > 1e-14;
    const vr = p.variedade ? codVar(p.variedade) : '';
    rot.push({ nome, vr, x: px(ok ? gx / (3 * ar) : sx / n), y: py(ok ? gy / (3 * ar) : sy / n),
      w: Math.max(nome.length * 16, vr.length * 12.5) + 8, h: vr ? 56 : 30 });
  });
  // separa rótulos que se sobrepõem (talhões vizinhos com nome/variedade encostando)
  for (let it = 0; it < 60; it++) {
    let mexeu = false;
    for (let i = 0; i < rot.length; i++) for (let j = i + 1; j < rot.length; j++) {
      const A = rot[i], B = rot[j];
      const ox = (A.w + B.w) / 2 - Math.abs(A.x - B.x), oy = (A.h + B.h) / 2 - Math.abs(A.y - B.y);
      if (ox <= 0 || oy <= 0) continue;
      mexeu = true;
      if (oy <= ox) { const d = (oy / 2 + 1) * (A.y <= B.y ? 1 : -1); A.y -= d; B.y += d; }
      else { const d = (ox / 2 + 1) * (A.x <= B.x ? 1 : -1); A.x -= d; B.x += d; }
    }
    if (!mexeu) break;
  }
  rot.forEach((L) => {
    const y0 = L.y - L.h / 2, x = L.x.toFixed(1);
    sv += '<text x="' + x + '" y="' + (y0 + 24).toFixed(1) + '" text-anchor="middle" class="m1">' + esc(L.nome) + '</text>';
    if (L.vr) sv += '<text x="' + x + '" y="' + (y0 + 50).toFixed(1) + '" text-anchor="middle" class="m2">' + esc(L.vr) + '</text>';
  });
  sv += '</svg>';

  const areas = areasDoMapa(mapa);
  const grp = {};
  plantio.forEach((p) => {
    if (!p.variedade) return;
    const c = p.cultura || 'outra';
    grp[c] = grp[c] || {};
    grp[c][p.variedade] = (grp[c][p.variedade] || 0) + (areas[p.talhao] || 0);
  });
  let leg = '';
  Object.keys(grp).forEach((c) => {
    leg += '<div class="lv-g"><span class="lv-c">' + esc(CULTURAS[c] || c) + '</span>' +
      Object.keys(grp[c]).map((v) => '<span class="lv"><i style="background:' + cor(v) + '"></i>' + esc(codVar(v)) +
        (grp[c][v] ? ' <em>' + fmt(grp[c][v]) + ' ha</em>' : '') + '</span>').join('') + '</div>';
  });
  const semVar = feats.filter((f) => { const p = porTal[(f.properties || {}).nome]; return !(p && p.variedade); });
  if (semVar.length) {
    const ha = semVar.reduce((s, f) => s + ((f.properties && Number(f.properties.area_ha)) || 0), 0);
    leg += '<div class="lv-g"><span class="lv-c">Outros</span><span class="lv"><i style="background:' + SEM_VAR +
      '"></i>Sem variedade / pousio' + (ha ? ' <em>' + fmt(ha) + ' ha</em>' : '') + '</span></div>';
  }
  return '<details class="mv-det" open><summary><h2 class="talhao">Mapa por variedade<small>toque no talhão</small></h2></summary>' +
    '<div class="mapa-cli">' + sv + '</div><div class="map-cap" id="mapCap">Toque em um talhão para ver os detalhes.</div>' +
    '<div class="leg-var">' + leg + '</div></details>';
}

/* ---------------- evolução do plantio ---------------- */

function evolucaoPlantio(mapa, plantio, hoje) {
  const areas = areasDoMapa(mapa);
  const plantaveis = plantio.filter((p) => p.cultura && !SEM_PLANTIO[p.cultura] && areas[p.talhao]);
  // total = área de todos os talhões da fazenda (só fica de fora o que está marcado como pastagem/pousio)
  const naoPlanta = {};
  plantio.forEach((p) => { if (SEM_PLANTIO[p.cultura]) naoPlanta[p.talhao] = 1; });
  const total = Object.keys(areas).filter((t) => !naoPlanta[t]).reduce((s, t) => s + areas[t], 0);
  if (!total) return '';
  const por = {};
  plantaveis.filter((p) => p.data_plantio).forEach((p) => { (por[p.data_plantio] = por[p.data_plantio] || []).push(p.talhao); });
  const ds = Object.keys(por).sort();
  if (!ds.length) return '';
  let cum = 0;
  const ev = ds.map((d) => { const ha = por[d].reduce((s, t) => s + areas[t], 0); cum += ha; return { d, tal: por[d], ha, cum }; });

  const Wd = 360, Hd = 196, L = 40, R = 14, T = 14, B = 26;
  const x0 = addDias(ds[0], -1), x1 = hoje > ds[ds.length - 1] ? hoje : ds[ds.length - 1];
  const rg = Math.max(1, difDias(x1, x0));
  const X = (d) => L + difDias(d, x0) / rg * (Wd - L - R);
  const step = Math.max(1, Math.ceil(total / 3 / 100) * 100), ym = step * 3;
  const Y = (v) => T + (1 - v / ym) * (Hd - T - B);
  let g = '<svg viewBox="0 0 ' + Wd + ' ' + Hd + '" role="img" aria-label="Evolução da área plantada em hectares por dia">';
  for (let k = 0; k <= 3; k++) {
    const yy = Y(k * step);
    g += '<line x1="' + L + '" x2="' + (Wd - R) + '" y1="' + yy + '" y2="' + yy + '" class="gl"/><text x="' + (L - 6) + '" y="' + (yy + 3.5) +
      '" text-anchor="end" class="ax">' + fmt(k * step, 0) + '</text>';
  }
  const tk = Math.ceil(rg / 4);
  for (let d = 0; d <= rg; d += tk) { const di = addDias(x0, d); g += '<text x="' + X(di) + '" y="' + (Hd - 8) + '" text-anchor="middle" class="ax">' + curta(di) + '</text>'; }
  let ln = 'M' + X(x0) + ',' + Y(0);
  ev.forEach((e) => { ln += ' H' + X(e.d) + ' V' + Y(e.cum); });
  ln += ' H' + X(x1);
  g += '<path d="' + ln + ' V' + Y(0) + ' Z" class="ar"/><path d="' + ln + '" class="ln"/>';
  g += '<line x1="' + L + '" x2="' + (Wd - R) + '" y1="' + Y(total) + '" y2="' + Y(total) + '" class="tot"/><text x="' + (L + 4) + '" y="' + (Y(total) - 5) +
    '" class="ax">área total ' + fmt(total, 0) + ' ha</text>';
  ev.forEach((e, i) => {
    g += '<circle class="pl-pt" cx="' + X(e.d) + '" cy="' + Y(e.cum) + '" r="' + (i === ev.length - 1 ? 6 : 4) + '"/>' +
      '<circle class="pl-hit" data-i="' + i + '" cx="' + X(e.d) + '" cy="' + Y(e.cum) + '" r="15" fill="transparent"/>';
  });
  g += '</svg>';

  const ult = ev[ev.length - 1];
  const plantados = {};
  plantaveis.forEach((p) => { if (p.data_plantio) plantados[p.talhao] = 1; });
  const falta = Object.keys(areas).filter((t) => !naoPlanta[t] && !plantados[t]).map((t) => ({ talhao: t }));
  const hf = falta.reduce((s, p) => s + areas[p.talhao], 0);
  const tb = '<table class="pl-tab"><tr><th>Data</th><th>Talhões</th><th>ha</th><th>Acumulado</th></tr>' +
    ev.map((e) => '<tr><td>' + curta(e.d) + '</td><td>' + esc(e.tal.join(', ')) + '</td><td>' + fmt(e.ha) + '</td><td>' + fmt(e.cum) + '</td></tr>').join('') + '</table>';
  const dadosJs = JSON.stringify(ev.map((e) => ({ d: curta(e.d), tal: e.tal.join(', '), ha: fmt(e.ha), cum: fmt(e.cum), pc: fmt(e.cum / total * 100) })));
  return '<h2 class="talhao">Evolução do plantio<small>área acumulada</small></h2>' +
    '<div class="pl-stat"><b>' + fmt(ult.cum / total * 100) + '%</b> plantado <span>' + fmt(ult.cum, 0) + ' de ' + fmt(total, 0) + ' ha</span></div>' +
    (falta.length ? '<div class="pl-falta">Falta plantar: ' + esc(falta.map((p) => p.talhao).join(', ')) + ' · ' + fmt(hf) + ' ha</div>' : '') +
    '<div class="pl-graf">' + g + '</div><div class="map-cap" id="plCap"></div>' +
    '<details class="pl-det"><summary>Ver em tabela</summary>' + tb + '</details>' +
    '<script type="application/json" id="plDados">' + dadosJs.replace(/</g, '\\u003c') + '</script>';
}

/* ---------------- etiquetas dentro de cada talhão ---------------- */

function chipsDoTalhao(nome, plantio, hoje) {
  const p = plantio.filter((x) => x.talhao === nome)[0];
  if (!p || !(p.cultura || p.variedade || p.data_plantio)) return '';
  const dae = p.data_emerg && difDias(hoje, p.data_emerg) >= 0 ? difDias(hoje, p.data_emerg) : null;
  let h = '<div class="cult">';
  if (p.cultura || p.variedade) h += '<span>🌱 ' + esc([CULTURAS[p.cultura] || '', p.variedade ? codVar(p.variedade) : ''].filter(Boolean).join(' · ')) + '</span>';
  if (p.data_plantio) h += '<span>Plantio ' + curta(p.data_plantio) + '</span>';
  if (dae !== null) h += '<span class="dae">DAE ' + dae + '</span>';
  if (p.sem_ha) h += '<span>' + (p.sem_m ? fmt(p.sem_m, 1) + ' sem/m · ' : '') + fmt(p.sem_ha / 1000, 0) + ' mil sem/ha</span>';
  return h + '</div>';
}

/* ---------------- junta tudo ---------------- */

export function blocosAgro(agro) {
  if (!agro) return null;
  const hoje = hojeMT();
  const areas = areasDoMapa(agro.mapa);
  const temMapa = Object.keys(areas).length > 0;
  // talhões que saíram do KML não entram na legenda nem no gráfico
  const plantio = (agro.plantio || []).filter((p) => !temMapa || p.talhao in areas), recs = agro.recs || [];
  const mapaVar = mapaVariedade(agro.mapa, plantio, hoje);
  const topo = proximas(recs, hoje) + evolucaoPlantio(agro.mapa, plantio, hoje);
  const fim = aplicacoes(recs, areas, hoje);
  if (!topo && !fim && !plantio.length) return null;
  return { topo, mapaVar, fim, talhao: (nome) => chipsDoTalhao(nome, plantio, hoje) };
}

export const AGRO_REL_CSS = `
.cult{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 10px}
.cult span{background:#fff;border:1px solid var(--linha);border-radius:12px;padding:3px 10px;font-size:12px;color:var(--verde-escuro)}
.cult span.dae{background:var(--verde-claro);border-color:transparent;font-weight:700}
.selo{display:inline-block;font-size:11px;padding:2px 8px;border-radius:10px;background:#eee;color:var(--fraco);white-space:nowrap}
.selo.v{background:var(--verde-claro);color:var(--verde-escuro);font-weight:600}
.selo.a{background:#FFF3DC;color:#8A5A00;font-weight:600}
.selo.b{background:#E6F0FA;color:#1A4E85;font-weight:600}
.ap-sub{font-size:12px;color:var(--fraco);margin:-2px 0 10px}
.ap-card{border:1px solid var(--linha);border-radius:12px;padding:11px 12px;margin-bottom:10px;background:#fff}
.ap-topo{display:flex;justify-content:space-between;align-items:center;gap:8px}.ap-topo b{font-size:15.5px}
.ap-meta{font-size:12px;color:var(--fraco);margin:2px 0 8px}
.ap-tal{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-bottom:8px}
.ap-tal span{font-size:11.5px;background:#F0F3F1;border-radius:8px;padding:2px 7px;color:var(--texto)}.ap-tal span.ok{background:var(--verde-claro);color:var(--verde-escuro)}
.ap-tal em{margin-left:auto;font-style:normal;font-size:12px;font-weight:700;color:var(--verde-escuro)}
.ap-prod>div{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:10px;font-size:13px;padding:5px 0;border-top:1px dashed var(--linha);align-items:baseline}
.ap-prod>div>span:nth-child(2){color:var(--fraco);text-align:right;min-width:62px}.ap-prod>div>b,.ap-prod>div>span:nth-child(3){text-align:right;min-width:62px}
.ap-prod .ap-th{border-top:0;font-size:10.5px;text-transform:uppercase;letter-spacing:.4px;color:var(--fraco);padding:0 0 3px}
.ap-calda{font-size:12.5px;background:#E6F0FA;color:#1A4E85;border-radius:8px;padding:6px 9px;margin-bottom:6px;line-height:1.45}.ap-calda span{font-size:11.5px;opacity:.85}
.ap-prod.q4>div{grid-template-columns:minmax(0,1fr) auto auto auto;gap:8px}.ap-prod .tq{color:var(--verde-escuro);font-weight:600}
.ap-prox{margin-top:7px;font-size:12px;background:#EEF6F6;color:#1F5F5F;border-radius:8px;padding:5px 8px}
.mv-det>summary{list-style:none;cursor:pointer}.mv-det>summary::-webkit-details-marker{display:none}
.mapa-geral>summary{list-style:none;cursor:pointer;font-weight:700;font-size:15px;color:var(--verde-escuro);padding:8px 0}.mapa-geral>summary::-webkit-details-marker{display:none}
.mapa-geral>summary small{float:right;font-weight:400;color:var(--fraco);font-size:12px}.mapa-geral>summary small::after{content:" ▾"}.mapa-geral[open]>summary small::after{content:" ▴"}
.mapa-geral .mapa{margin-top:2px}
.mv-det>summary h2.talhao small::after{content:" ▾"}.mv-det[open]>summary h2.talhao small::after{content:" ▴"}
.mapa-cli{border-radius:12px;overflow:hidden;border:1px solid var(--linha)}.mapa-cli svg{display:block;width:100%;height:auto}
.mapa-cli .mv{stroke:#fff;stroke-width:3;stroke-linejoin:round;cursor:pointer}.mapa-cli .mv.on{stroke:#10331F;stroke-width:5}
.mapa-cli text{pointer-events:none;fill:#0b0b0b;paint-order:stroke;stroke:#fff;stroke-width:5px;stroke-linejoin:round;font-family:sans-serif}
.mapa-cli .m1{font-size:26px;font-weight:700}.mapa-cli .m2{font-size:21px;font-weight:600}
.map-cap{font-size:12.5px;color:var(--texto);background:#F4F7F5;border-radius:8px;padding:6px 9px;margin:6px 0;min-height:30px}
.leg-var{display:flex;flex-direction:column;gap:5px;margin-bottom:4px}
.lv-g{display:flex;flex-wrap:wrap;gap:4px 12px;align-items:center;font-size:12.5px}.lv-c{width:62px;color:var(--fraco);font-size:11.5px}
.lv{display:inline-flex;align-items:center;gap:5px;color:var(--texto)}.lv i{width:12px;height:12px;border-radius:3px;display:inline-block}.lv em{font-style:normal;color:var(--fraco)}
.pl-stat{font-size:13px;color:var(--fraco)}.pl-stat b{font-size:26px;color:var(--verde-escuro);margin-right:4px}.pl-stat span{margin-left:4px}
.pl-falta{font-size:12px;color:var(--fraco);margin-bottom:4px}
.pl-graf svg{width:100%;height:auto;display:block}
.pl-graf .gl{stroke:#E4E9E6;stroke-width:1}.pl-graf .ax{font-size:10.5px;fill:#6B7A72}
.pl-graf .ln{fill:none;stroke:var(--verde);stroke-width:2.5;stroke-linejoin:round}.pl-graf .ar{fill:var(--verde);opacity:.14}
.pl-graf .tot{stroke:#8A958F;stroke-width:1.2;stroke-dasharray:4 3}
.pl-graf .pl-pt{fill:var(--verde);stroke:#fff;stroke-width:2}
.pl-det summary{font-size:12px;color:var(--fraco);cursor:pointer;margin:2px 0 6px}
.pl-tab{width:100%;border-collapse:collapse;font-size:12px}.pl-tab th,.pl-tab td{text-align:left;padding:4px 6px;border-top:1px solid var(--linha)}.pl-tab td:nth-child(n+3),.pl-tab th:nth-child(n+3){text-align:right}
.prox-cli{border:1px solid #F0D9A0;background:#FFFBEF;border-radius:12px;padding:9px 12px;margin:14px 0 6px}
.prox-cli h5{margin:0 0 6px;font-size:14px;color:#6B4A00}
.px{display:flex;gap:9px;align-items:flex-start;padding:5px 0;border-top:1px dashed #F0D9A0;font-size:13.5px}.px:first-of-type{border-top:0}
.px i{width:10px;height:10px;border-radius:50%;margin-top:5px;flex:none;background:#E0A100}.px.venc i{background:#C0392B}
.px span{color:var(--fraco);font-size:12.5px;margin-left:4px}.px small{display:block;font-size:12px;color:var(--fraco)}
@media print{.pl-det{display:none}}
`;

// script do relatório: toque no mapa e no gráfico (texto sem crases e sem dólar+chave)
export const AGRO_REL_JS = `
(function(){
  var cap=document.getElementById('mapCap');
  var abertos=[];
  window.addEventListener('beforeprint',function(){abertos=[];document.querySelectorAll('.mv-det,.mapa-geral').forEach(function(d){abertos.push(d.open);d.open=true})});
  window.addEventListener('afterprint',function(){document.querySelectorAll('.mv-det,.mapa-geral').forEach(function(d,i){d.open=abertos[i]})});
  document.addEventListener('click',function(e){
    var p=e.target.closest&&e.target.closest('.mapa-cli .mv');
    if(p&&cap){
      document.querySelectorAll('.mapa-cli .mv').forEach(function(x){x.classList.toggle('on',x===p)});
      cap.innerHTML=p.getAttribute('data-info');return;
    }
    var h=e.target.closest&&e.target.closest('.pl-hit');
    if(h){sel(parseInt(h.getAttribute('data-i'),10));}
  });
  function sel(i){
    var el=document.getElementById('plDados');if(!el)return;
    var d;try{d=JSON.parse(el.textContent)}catch(x){return}
    var e=d[i];if(!e)return;
    document.getElementById('plCap').innerHTML='<b>'+e.d+'</b> · '+e.tal+' · +'+e.ha+' ha · acumulado <b>'+e.cum+' ha</b> ('+e.pc+'%)';
    document.querySelectorAll('.pl-pt').forEach(function(c,k){c.setAttribute('r',k===i?6:4)});
  }
  var el=document.getElementById('plDados');
  if(el){try{sel(JSON.parse(el.textContent).length-1)}catch(x){}}
})();
`;
