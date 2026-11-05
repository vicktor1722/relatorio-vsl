/* Gráficos do quadro de plantio, com troca para o lado: Evolução do plantio ⇄ Previsão de colheita.
   Usado no painel (admin e usuário comum) e no login da fazenda (portal).
   Tocar em dois pontos do gráfico mostra a área entre as duas datas.
   O código vai para dentro de outras páginas por ${...}: aqui não pode ter crase nem "${". */

export const DPG_CSS = `
.dpg{margin:14px 0 4px}
.dpg-cab{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.dpg-seta{flex:0 0 auto;width:36px;height:36px;border-radius:50%;border:1px solid var(--linha);background:#fff;color:var(--verde-escuro);font-size:24px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0 0 3px}
.dpg-seta:active{background:var(--verde-claro)}
.dpg-tit{flex:1;text-align:center;min-width:0}
.dpg-tit b{display:block;font-size:14.5px;color:var(--verde-escuro)}
.dpg.fixo .dpg-tit{text-align:left}
.dpg-dots{display:inline-flex;gap:6px;margin-top:5px}
.dpg-dots button{width:8px;height:8px;border-radius:4px;border:0;padding:0;background:var(--linha);cursor:pointer;transition:width .2s}
.dpg-dots button.on{background:var(--verde);width:20px}
.dpg[data-lado=c] .dpg-dots button.on{background:#C77700}
.dpg[data-lado=c] .dpg-tit b{color:#8A5300}
.dpg-corpo{touch-action:pan-y}
.dpg-dir{animation:dpgDir .25s ease}.dpg-esq{animation:dpgEsq .25s ease}
@keyframes dpgDir{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:none}}
@keyframes dpgEsq{from{opacity:0;transform:translateX(-30px)}to{opacity:1;transform:none}}
.dpg-res{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px}
.dpg-res span{font-size:12.5px;border-radius:12px;padding:4px 10px;background:#E8F3EC;color:var(--verde-escuro)}
.dpg[data-lado=c] .dpg-res span{background:#FFF1DB;color:#6B4200}
.dpg .nota{font-size:12.5px;color:var(--fraco);margin:6px 2px;line-height:1.4}
.dpg-dica{text-align:center;font-size:11.5px;color:var(--fraco);margin:6px 0 0}
.dp-graf svg{display:block;width:100%;max-width:760px;height:auto;margin:0 auto;cursor:crosshair}
.dp-gl{stroke:var(--linha);stroke-width:1}
.dp-ax{font-size:11px;fill:var(--fraco)}
.dp-ar{fill:var(--verde-claro);stroke:none}
.dp-ln{fill:none;stroke:var(--verde);stroke-width:2.5}
.dp-pt{fill:#fff;stroke:var(--verde);stroke-width:2.5}
.dp-tot{stroke:var(--fraco);stroke-width:1;stroke-dasharray:4 4}
.dp-sel{fill:rgba(27,122,67,.14)}.dp-mk{stroke:#14532D;stroke-width:1.6;stroke-dasharray:4 3}
.dpg-svg.c .dp-ar{fill:#FCEBD0}.dpg-svg.c .dp-ln,.dpg-svg.c .dp-pt{stroke:#C77700}
.dpg-svg.c .dp-sel{fill:rgba(199,119,0,.16)}.dpg-svg.c .dp-mk{stroke:#7A4600}
.dp-hj{stroke:#C62828;stroke-width:1.4;stroke-dasharray:3 3}.dp-hjt{font-size:11px;fill:#C62828;font-weight:700}
.dp-entre{background:#E8F3EC;border-radius:10px;padding:9px 12px;margin:6px 0 4px;font-size:14px;line-height:1.45}
.dpg[data-lado=c] .dp-entre{background:#FFF1DB}
.dpg-mats{display:block;font-size:12.5px;color:var(--fraco);margin-top:3px}
.dp-limpa{border:0;background:none;color:var(--verde);text-decoration:underline;cursor:pointer;font-size:13px}
`;

export const DPG_JS = String.raw`
var DPG = (function () {
  var LADOS = ['p', 'c'], TIT = { p: 'Evolução do plantio', c: 'Previsão de colheita' };
  var NCULT = { soja: 'Soja', milho: 'Milho', algodao: 'Algodão', feijao: 'Feijão', sorgo: 'Sorgo', outra: 'Outra cultura' };
  function n(v, c) { c = c || 0; return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c }); }
  function soma(iso, k) { var d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); }
  function dias(a, b) { return Math.round((new Date(a + 'T12:00:00Z') - new Date(b + 'T12:00:00Z')) / 864e5); }
  function dt(iso) { return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : ''; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function hoje() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function nomeMat(x) { return x.mat || NCULT[x.cultura] || x.cultura || 'sem variedade'; }

  function estado(lado) { return { lado: lado || 'p', pts: { p: [], c: [] }, anim: '' }; }

  // pontos do gráfico: plantio = ha plantados por dia; colheita = ha com colheita prevista por dia
  function serie(S, lado) {
    if (lado === 'p') return { ev: S.linha || [], ref: S.total_ha || 0, refTxt: 'área total' };
    var g = {}, tot = 0;
    (S.prev || []).forEach(function (x) { g[x.d] = (g[x.d] || 0) + x.ha; tot += x.ha; });
    return { ev: Object.keys(g).sort().map(function (d) { return { d: d, ha: g[d] }; }), ref: tot, refTxt: 'plantado com previsão' };
  }

  function grafico(st, S, lado) {
    var se = serie(S, lado), ev = se.ev;
    if (!ev.length || !se.ref) return '<div class="nota">' + (lado === 'p' ? 'Ainda não há data de plantio lançada nesta safra.'
      : 'A previsão de colheita aparece quando houver data de plantio lançada.') + '</div>';
    var hj = hoje(), W = 640, H = 230, L = 52, R = 16, T = 16, B = 28;
    var x0 = soma(ev[0].d, -1), x1 = ev[ev.length - 1].d;
    if (lado === 'p') { if (hj > x1) x1 = hj; } else x1 = soma(x1, 1);
    var rg = Math.max(1, dias(x1, x0));
    var X = function (d) { return L + dias(d, x0) / rg * (W - L - R); };
    var step = Math.max(1, Math.ceil(se.ref / 3 / 100) * 100), ym = step * 3;
    var Y = function (v) { return T + (1 - v / ym) * (H - T - B); };
    st.eixo = { x0: x0, rg: rg, L: L, R: R, W: W };
    var g = '<svg class="dpg-svg' + (lado === 'c' ? ' c' : '') + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' +
      (lado === 'p' ? 'Área plantada acumulada por dia' : 'Área com colheita prevista acumulada por dia') + '">';
    var pts = st.pts[lado];
    if (pts.length) {
      var pa = pts.slice().sort(), xa = X(pa[0]), xb = X(pa[pa.length - 1]);
      if (pa.length > 1) g += '<rect x="' + Math.min(xa, xb) + '" y="' + T + '" width="' + Math.max(2, Math.abs(xb - xa)) + '" height="' + (H - T - B) + '" class="dp-sel"/>';
      pa.forEach(function (d) { g += '<line x1="' + X(d) + '" x2="' + X(d) + '" y1="' + T + '" y2="' + (H - B) + '" class="dp-mk"/>'; });
    }
    for (var k = 0; k <= 3; k++) {
      g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(k * step) + '" y2="' + Y(k * step) + '" class="dp-gl"/>' +
        '<text x="' + (L - 6) + '" y="' + (Y(k * step) + 4) + '" text-anchor="end" class="dp-ax">' + n(k * step) + '</text>';
    }
    var tk = Math.max(1, Math.ceil(rg / 6));
    for (var d = 0; d <= rg; d += tk) { var di = soma(x0, d); g += '<text x="' + X(di) + '" y="' + (H - 8) + '" text-anchor="middle" class="dp-ax">' + dt(di) + '</text>'; }
    if (lado === 'c' && hj >= x0 && hj <= x1) {
      g += '<line x1="' + X(hj) + '" x2="' + X(hj) + '" y1="' + T + '" y2="' + (H - B) + '" class="dp-hj"/><text x="' + (X(hj) + 4) + '" y="' + (T + 11) + '" class="dp-hjt">hoje</text>';
    }
    var cum = 0, ln = 'M' + X(x0) + ',' + Y(0), cs = '';
    ev.forEach(function (e, i) {
      cum += e.ha; ln += ' H' + X(e.d) + ' V' + Y(cum);
      cs += '<circle cx="' + X(e.d) + '" cy="' + Y(cum) + '" r="' + (i === ev.length - 1 ? 5 : 3.5) + '" class="dp-pt"><title>' + dt(e.d) + ': ' +
        (lado === 'p' ? '+' + n(e.ha, 1) + ' ha' : n(e.ha, 1) + ' ha prontos para colher') + ' · acumulado ' + n(cum) + ' ha (' + n(cum / se.ref * 100, 1) + '%)</title></circle>';
    });
    ln += ' H' + X(x1);
    g += '<path d="' + ln + ' V' + Y(0) + ' Z" class="dp-ar"/><path d="' + ln + '" class="dp-ln"/>' + cs;
    g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(se.ref) + '" y2="' + Y(se.ref) + '" class="dp-tot"/>' +
      '<text x="' + (L + 4) + '" y="' + (Y(se.ref) - 5) + '" class="dp-ax">' + se.refTxt + ' ' + n(se.ref) + ' ha</text></svg>';
    return g;
  }

  // área entre os dois dias tocados (os dois dias inclusive)
  function entre(st, S, lado) {
    var pts = st.pts[lado];
    if (pts.length < 2) return '';
    var a = pts[0] < pts[1] ? pts[0] : pts[1], b = pts[0] < pts[1] ? pts[1] : pts[0], ha = 0, nd = {};
    var limpa = ' <button type="button" class="dp-limpa dpg-limpa">limpar</button></div>';
    if (lado === 'p') {
      (S.linha || []).forEach(function (e) { if (e.d >= a && e.d <= b) { ha += e.ha; nd[e.d] = 1; } });
      var dd = Object.keys(nd).length;
      return '<div class="dp-entre"><b>' + n(ha, 1) + ' ha</b> plantados de <b>' + dt(a) + '</b> a <b>' + dt(b) + '</b>' +
        (S.total_ha ? ' · ' + n(ha / S.total_ha * 100, 1) + '% da área' : '') +
        (dd ? ' · ' + dd + (dd === 1 ? ' dia com plantio' : ' dias com plantio') + ' · média ' + n(ha / dd, 1) + ' ha/dia' : '') + limpa;
    }
    var mats = {}, tot = 0;
    (S.prev || []).forEach(function (x) {
      tot += x.ha;
      if (x.d < a || x.d > b) return;
      ha += x.ha; nd[x.d] = 1; var m = nomeMat(x); mats[m] = (mats[m] || 0) + x.ha;
    });
    var lm = Object.keys(mats).sort(function (p, q) { return mats[q] - mats[p]; });
    return '<div class="dp-entre"><b>' + n(ha, 1) + ' ha</b> com colheita prevista de <b>' + dt(a) + '</b> a <b>' + dt(b) + '</b>' +
      (tot ? ' · ' + n(ha / tot * 100, 1) + '% do previsto' : '') + (ha ? ' · média ' + n(ha / (dias(b, a) + 1), 1) + ' ha/dia no período' : '') +
      (lm.length ? '<span class="dpg-mats">' + lm.map(function (m) { return esc(m) + ' ' + n(mats[m], 1) + ' ha'; }).join(' · ') + '</span>' : '') + limpa;
  }

  // resumo em cima do gráfico de colheita
  function resumoC(S) {
    var l = S.prev || [];
    if (!l.length) return '';
    var tot = 0, col = 0, ini = l[0].d, fim = l[0].d, hj = hoje(), prox = '';
    l.forEach(function (x) {
      tot += x.ha; if (x.col) col += x.ha;
      if (x.d < ini) ini = x.d; if (x.d > fim) fim = x.d;
      if (!x.col && x.d >= hj && (!prox || x.d < prox)) prox = x.d;
    });
    var f = prox ? dias(prox, hj) : 0;
    return '<div class="dpg-res"><span><b>' + n(tot) + ' ha</b> previstos</span><span>' + dt(ini) + (fim !== ini ? ' a ' + dt(fim) : '') + '</span>' +
      (prox ? '<span>próxima: <b>' + dt(prox) + '</b> (' + (f === 0 ? 'hoje' : f === 1 ? 'amanhã' : 'em ' + f + ' dias') + ')</span>' : '') +
      (col ? '<span><b>' + n(col) + ' ha</b> colhidos</span>' : '') + '</div>';
  }

  function html(st, S, opt) {
    opt = opt || {};
    var lado = opt.so || st.lado;   // opt.so: um gráfico só, sem troca para o lado
    if (opt.so) st.lado = opt.so;
    var h = opt.so ? '<div class="dpg fixo" data-lado="' + lado + '"><div class="dpg-cab"><div class="dpg-tit"><b>' + TIT[lado] + '</b></div></div>' :
      '<div class="dpg" data-lado="' + lado + '"><div class="dpg-cab">' +
      '<button type="button" class="dpg-seta" data-dpgir="-1" aria-label="Gráfico anterior">‹</button>' +
      '<div class="dpg-tit"><b>' + TIT[lado] + '</b><span class="dpg-dots">' + LADOS.map(function (x) {
        return '<button type="button" data-dpgl="' + x + '" class="' + (x === lado ? 'on' : '') + '" aria-label="' + TIT[x] + '"></button>'; }).join('') + '</span></div>' +
      '<button type="button" class="dpg-seta" data-dpgir="1" aria-label="Próximo gráfico">›</button></div>';
    h += '<div class="dpg-corpo' + (st.anim ? ' dpg-' + st.anim : '') + '">';
    if (lado === 'c') h += resumoC(S);
    else if (opt.resumo && S.total_ha) {
      var pl = (S.linha || []).reduce(function (s, x) { return s + x.ha; }, 0);
      h += '<div class="dpg-res"><span><b>' + n(pl) + ' ha</b> de ' + n(S.total_ha) + ' ha plantados</span><span><b>' + n(pl / S.total_ha * 100, 1) + '%</b> da área</span></div>';
    }
    h += '<div class="dp-graf">' + grafico(st, S, lado) + '</div>';
    if (serie(S, lado).ev.length) {
      h += entre(st, S, lado) || '<p class="nota">👆 Toque em dois pontos do gráfico para ver a área ' + (lado === 'p' ? 'plantada' : 'com colheita prevista') + ' entre as duas datas.' +
        (st.pts[lado].length === 1 ? ' Início: <b>' + dt(st.pts[lado][0]) + '</b> — agora toque no fim.' : '') + '</p>';
    }
    if (lado === 'c' && (S.prev || []).length) {
      h += '<p class="nota">Previsão = dia plantado + ciclo do material' + ((S.prev || []).some(function (x) { return x.est; }) ? '; material sem ciclo cadastrado usa o ciclo padrão da cultura' : '') + '. Clima e chuva podem adiantar ou atrasar a colheita.</p>';
    }
    st.anim = '';
    return h + '</div>' + (opt.so ? '' : '<p class="dpg-dica">Toque nas setas ‹ › ou arraste para o lado para trocar o gráfico</p>') + '</div>';
  }

  function ligar(root, st, repintar) {
    var el = root.querySelector('.dpg');
    if (!el) return;
    function ir(k) { st.anim = k > 0 ? 'dir' : 'esq'; st.lado = LADOS[(LADOS.indexOf(st.lado) + k + LADOS.length) % LADOS.length]; repintar(); }
    el.querySelectorAll('[data-dpgir]').forEach(function (b) { b.onclick = function () { ir(Number(b.dataset.dpgir)); }; });
    el.querySelectorAll('[data-dpgl]').forEach(function (b) { b.onclick = function () {
      var i = LADOS.indexOf(b.dataset.dpgl), j = LADOS.indexOf(st.lado); if (i !== j) ir(i - j); }; });
    // arrastar para o lado troca o gráfico (menos no gráfico fixo)
    var tx = null, ty = 0;
    if (!el.classList.contains('fixo')) {
    el.addEventListener('touchstart', function (e) { var t = e.touches[0]; tx = t.clientX; ty = t.clientY; }, { passive: true });
    el.addEventListener('touchend', function (e) {
      if (tx === null) return;
      var t = e.changedTouches[0], dx = t.clientX - tx, dy = t.clientY - ty; tx = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) ir(dx < 0 ? 1 : -1);
    }, { passive: true });
    }
    var sv = el.querySelector('.dpg-svg');
    if (sv) sv.addEventListener('click', function (ev) {
      var r = sv.getBoundingClientRect(), E = st.eixo, xs = (ev.clientX - r.left) / r.width * E.W;
      var k = Math.round((xs - E.L) / (E.W - E.L - E.R) * E.rg); k = Math.max(0, Math.min(E.rg, k));
      var d = soma(E.x0, k), p = st.pts[st.lado];
      st.pts[st.lado] = p.length >= 2 ? [d] : p.concat(d);
      repintar();
    });
    var lp = el.querySelector('.dpg-limpa'); if (lp) lp.onclick = function () { st.pts[st.lado] = []; repintar(); };
  }

  return { estado: estado, html: html, ligar: ligar, limpar: function (st) { st.pts = { p: [], c: [] }; } };
}());
`;
