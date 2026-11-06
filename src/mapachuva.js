/* Mapa da chuva (satélite + chuva prevista + divisas), usado no painel do consultor.
   MapaChuva.criar(el, M, P, op): M = grade guardada (chuva.js), P = {lat, lon, nome}.
   O código vai para dentro de outras páginas por ${...}: aqui não pode ter crase nem "${". */

export const MAPA_CHUVA_CSS = `
.mc-cv{filter:blur(2px) saturate(1.35) contrast(1.08)}
.mc-esc{height:11px;border-radius:3px;margin-top:8px;background:linear-gradient(90deg,#BDBDBD,#9BE29B 8%,#2EAA3C 16%,#0B6B2B 24%,#1E3FD8 32%,#2E7BFF 40%,#8FD6FF 48%,#F7F3C2 56%,#FFB000 64%,#FF6A00 72%,#E31A1C 80%,#FFB3D9 88%,#8E5CFF)}
.mc-escx{position:relative;height:14px;font-size:10px;color:#6B7B72;margin-top:2px}.mc-escx span{position:absolute;top:0;white-space:nowrap}
`;

export const MAPA_CHUVA_JS = String.raw`
var MapaChuva = (function () {
  var ESC = [[1, [189, 189, 189]], [5, [155, 226, 155]], [10, [46, 170, 60]], [13, [11, 107, 43]], [17, [30, 63, 216]], [20, [46, 123, 255]], [30, [143, 214, 255]],
    [40, [247, 243, 194]], [50, [255, 176, 0]], [70, [255, 106, 0]], [120, [227, 26, 28]], [180, [255, 179, 217]], [270, [142, 92, 255]]];
  // acumulado de 15 dias: mesmas cores numa escala até 500 mm (senão fica tudo vermelho na época das chuvas)
  var LIM_15 = [3, 10, 20, 30, 45, 60, 80, 110, 150, 200, 280, 380, 500];
  function limites(modo) { return modo === 'a15' ? LIM_15 : ESC.map(function (x) { return x[0]; }); }
  function rotulos(modo) {   // números da régua embaixo do mapa, cada um embaixo da sua cor
    var l = limites(modo);
    return [0, 2, 4, 6, 8, 10, 12].map(function (k, i, a) {
      var pos = k === 12 ? 100 : k * 8, ali = i === 0 ? 'left:0' : i === a.length - 1 ? 'right:0' : 'left:' + pos + '%;transform:translateX(-50%)';
      return '<span style="' + ali + '">' + (i === 0 ? '&lt;' : '') + l[k] + (i === a.length - 1 ? '+ mm' : '') + '</span>';
    }).join('');
  }
  function cor(v, modo) {
    var L = limites(modo);
    if (v < L[0]) return null;
    for (var i = 1; i < ESC.length; i++) if (v <= L[i]) {
      var t = (v - L[i - 1]) / (L[i] - L[i - 1]);
      return ESC[i - 1][1].map(function (c, j) { return Math.round(c + (ESC[i][1][j] - c) * t); });
    }
    return ESC[ESC.length - 1][1];
  }
  var RUIDO = (function () { var a = [], s = 7; for (var i = 0; i < 64 * 64; i++) { s = (s * 16807) % 2147483647; a.push(s / 2147483647); } return a; })();
  function ruido(x, y) {
    var x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    function r(i, j) { return RUIDO[((j & 63) * 64) + (i & 63)]; }
    return r(x0, y0) * (1 - fx) * (1 - fy) + r(x0 + 1, y0) * fx * (1 - fy) + r(x0, y0 + 1) * (1 - fx) * fy + r(x0 + 1, y0 + 1) * fx * fy;
  }
  function merc(la) { var r = la * Math.PI / 180; return Math.log(Math.tan(Math.PI / 4 + r / 2)); }
  var Camada = window.L && L.ImageOverlay.extend({
    _initImage: function () {
      var el = this._image = this._url;
      L.DomUtil.addClass(el, 'leaflet-image-layer');
      if (this._zoomAnimated) L.DomUtil.addClass(el, 'leaflet-zoom-animated');
      el.onselectstart = L.Util.falseFn; el.onmousemove = L.Util.falseFn;
    }
  });
  var UFS = null;

  function criar(el, M, P, op) {
    op = op || {};
    if (!window.L || !Camada || !M || !M.v) return null;
    var st = { modo: op.modo || 'dia', t: 0, play: null };
    P = P || {};
    var m = L.map(el, { zoomControl: !!op.zoom, attributionControl: false, scrollWheelZoom: false }).setView([P.lat || op.lat || -14, P.lon || op.lon || -54], op.nivel || 4);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 10 }).addTo(m);
    m.createPane('limites'); m.getPane('limites').style.zIndex = 450; m.getPane('limites').style.pointerEvents = 'none';
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 10, pane: 'limites' }).addTo(m);
    (UFS ? Promise.resolve(UFS) : fetch('/portal/ufs.json').then(function (r) { return r.json(); }).then(function (g) { UFS = g; return g; }))
      .then(function (g) { try { L.geoJSON(g, { pane: 'limites', interactive: false, style: { color: '#FFFFFF', weight: 1.1, opacity: 0.85 } }).addTo(m); } catch (e) {} }).catch(function () {});
    var cv = document.createElement('canvas'); cv.width = 220; cv.height = 240; cv.className = 'mc-cv';
    new Camada(cv, [[M.la0, M.lo0], [M.la1, M.lo1]], { interactive: false }).addTo(m);
    var grupo = L.layerGroup().addTo(m);
    function pontos(l) {
      grupo.clearLayers();
      (l || []).forEach(function (p) { if (p && p.lat) L.circleMarker([p.lat, p.lon], { radius: 6, color: '#fff', weight: 2, fillColor: '#C62828', fillOpacity: 1, pane: 'limites' })
        .addTo(grupo).bindTooltip(String(p.nome || ''), { permanent: !!op.rotulos, direction: 'top', offset: [0, -6] }); });
    }
    if (P && P.lat) pontos([P]);

    function desenhar() {
      var np = M.nlat * M.nlon, G = new Array(np), i, d, t = st.t;
      if (st.modo === 'dia') {
        var d0 = Math.floor(t), d1 = Math.min(M.v.length - 1, d0 + 1), f = t - d0;
        for (i = 0; i < np; i++) G[i] = (M.v[d0][i] || 0) * (1 - f) + (M.v[d1][i] || 0) * f;
      } else {
        var nd = Math.min(M.v.length, st.modo === 'a7' ? 7 : 15);
        for (i = 0; i < np; i++) { var s = 0; for (d = 0; d < nd; d++) s += M.v[d][i] || 0; G[i] = s; }
      }
      var cw = cv.width, ch = cv.height, cx = cv.getContext('2d'), im = cx.createImageData(cw, ch);
      var m1 = merc(M.la1), m0 = merc(M.la0), dx = st.modo === 'dia' ? t * 2.2 : 0, dy = st.modo === 'dia' ? -t * 1.3 : 0;
      function g(a, b) { a = a < 0 ? 0 : a > M.nlat - 1 ? M.nlat - 1 : a; b = b < 0 ? 0 : b > M.nlon - 1 ? M.nlon - 1 : b; return G[a * M.nlon + b]; }
      for (var y = 0; y < ch; y++) {
        var la = Math.atan(Math.sinh(m1 - (y + 0.5) / ch * (m1 - m0))) * 180 / Math.PI;
        var fa = (M.la1 - la) / M.passo, a0 = Math.floor(fa), ta = fa - a0, ey = Math.min(y, ch - 1 - y) / (ch * 0.12);
        for (var x = 0; x < cw; x++) {
          var fb = (x + 0.5) / cw * (M.nlon - 1), b0 = Math.floor(fb), tb = fb - b0;
          var v = g(a0, b0) * (1 - ta) * (1 - tb) + g(a0 + 1, b0) * ta * (1 - tb) + g(a0, b0 + 1) * (1 - ta) * tb + g(a0 + 1, b0 + 1) * ta * tb;
          if (v < 1) continue;
          var nz = 0.65 * ruido(x / 9 + dx, y / 9 + dy) + 0.35 * ruido(x / 4 - dx * 1.6, y / 4 + dy * 1.4);
          var vv = v * (st.modo === 'dia' ? 0.7 + 0.6 * nz : 0.94 + 0.12 * nz), c = cor(vv, st.modo);
          if (!c) continue;
          var ex = Math.min(x, cw - 1 - x) / (cw * 0.12), borda = Math.min(1, ex, ey);
          var o = (y * cw + x) * 4; im.data[o] = c[0]; im.data[o + 1] = c[1]; im.data[o + 2] = c[2];
          im.data[o + 3] = Math.min(1, (vv - 0.8) / 4) * (0.72 + 0.28 * nz) * borda * borda * 240;
        }
      }
      cx.putImageData(im, 0, 0);
      if (op.escala) op.escala.innerHTML = rotulos(st.modo);
      if (op.info) {
        var di = Math.min(M.v.length - 1, Math.round(t)), nd2 = Math.min(M.v.length, st.modo === 'a7' ? 7 : 15), br = function (i) { return i.slice(8, 10) + '/' + i.slice(5, 7); };
        op.info(st.modo === 'dia' ? 'Chuva prevista no dia (mm)' : 'Acumulado ' + br(M.datas[0]) + ' a ' + br(M.datas[nd2 - 1]),
          st.modo === 'dia' ? br(M.datas[di]) : (st.modo === 'a7' ? '7 dias' : '15 dias'), Math.floor(t));
      }
    }
    function parar() { if (st.play) { cancelAnimationFrame(st.play); st.play = null; } }
    desenhar();
    return {
      mapa: m, st: st, n: M.v.length, pontos: pontos,
      modo: function (mo) { parar(); st.modo = mo; desenhar(); },
      dia: function (t) { parar(); st.t = t; desenhar(); },
      tocando: function () { return !!st.play; },
      play: function () {
        if (st.play) { parar(); return false; }
        var ult = 0;
        function passo(ts) {
          if (!document.body.contains(el)) { st.play = null; return; }
          if (ts - ult > 50) { st.t = ult ? st.t + (ts - ult) / 1400 : st.t; ult = ts; if (st.t > M.v.length - 1) st.t = 0; desenhar(); }
          st.play = requestAnimationFrame(passo);
        }
        st.play = requestAnimationFrame(passo);
        return true;
      },
      parar: parar,
      destruir: function () { parar(); try { m.remove(); } catch (e) {} }
    };
  }
  return { criar: criar, cor: cor, rotulos: rotulos };
}());
`;
