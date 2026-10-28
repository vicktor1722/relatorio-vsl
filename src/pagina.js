/* ============================================================
   pagina.js — HTML do relatório público, renderizado no Worker
   (link abre sem JS, com prévia no WhatsApp e impressão em PDF)
   ============================================================ */

import { AGRO_REL_CSS, AGRO_REL_JS, blocosAgro } from './agrorel.js';
import { safraPadrao } from './safras.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const CSS = `
:root{--verde:#1B7A43;--verde-escuro:#146034;--verde-claro:#E8F4EC;--texto:#1B2B22;--fraco:#6B7B72;--linha:#E4E9E6}
*{box-sizing:border-box}
body{margin:0;background:#F2F4F2;color:var(--texto);line-height:1.5;
 font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
.folha{max-width:820px;margin:0 auto;background:#fff;min-height:100vh;box-shadow:0 0 30px rgba(0,0,0,.07)}
header.capa{background:var(--verde);color:#fff;padding:22px 22px 18px}
header.capa .marca{display:flex;align-items:center;gap:12px}
header.capa .logo{width:46px;height:46px;border-radius:10px;background:rgba(255,255,255,.18);display:grid;place-items:center;font-size:22px;flex:none}
header.capa img.logo{width:auto;max-width:120px;height:46px;object-fit:contain;background:#fff;padding:4px;border-radius:8px;display:block}
header.capa .marca b{display:block;font-size:14.5px}
header.capa .marca span{font-size:11.5px;opacity:.85}
header.capa .marca small{display:block;font-size:11.5px;opacity:.9;margin-top:2px}
header.capa .marca small a,footer small a{color:inherit;text-decoration:none}
header.capa h1{margin:16px 0 2px;font-size:25px;line-height:1.2}
header.capa p.sub{margin:0;font-size:13.5px;opacity:.9}
.painel{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1px;background:var(--linha)}
.painel div{background:#fff;padding:12px 16px}
.painel span{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--fraco)}
.painel b{font-size:14.5px}
.corpo{padding:6px 18px 40px}
h2.talhao{position:sticky;top:0;background:#fff;margin:26px 0 12px;padding:10px 0 8px;font-size:16px;
 color:var(--verde-escuro);border-bottom:2px solid var(--verde);z-index:5}
h2.talhao small{float:right;font-weight:400;color:var(--fraco);font-size:12px;padding-top:4px}
h3.dia{margin:16px 0 10px;padding:0 0 4px;font-size:13px;font-weight:600;color:var(--fraco);
 border-bottom:1px solid var(--linha)}
.grupo{margin:0 0 16px;background:#fff;border:1px solid var(--linha);border-radius:12px;padding:8px}
.grupo-leg{margin:10px 4px 4px;font-size:14.5px;color:#4d5d54;white-space:pre-wrap}
.grade{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.grade.n1{grid-template-columns:1fr}
.grade .item{margin:0;min-width:0}
.grade .item img,.grade .item video{aspect-ratio:4/3;object-fit:cover;object-position:center;max-height:none}
.grade.n1 .item img,.grade.n1 .item video{aspect-ratio:auto;object-fit:contain;max-height:70vh}
.grade .tag{font-size:10.5px;padding:2px 7px}
@media(min-width:700px){.grade.n2{grid-template-columns:1fr 1fr}.grade.n3{grid-template-columns:1fr 1fr 1fr}}
.item{margin:0 0 22px}
.item figure{margin:0;border-radius:12px;overflow:hidden;background:#000;border:1px solid var(--linha)}
.item img,.item video{display:block;width:100%;max-height:70vh;object-fit:contain;background:#000}
.meta{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 0;align-items:center}
.tag{font-size:11.5px;padding:3px 9px;border-radius:11px;background:var(--verde-claro);color:var(--verde-escuro);font-weight:600}
.tag.cinza{background:#F0F2F1;color:var(--fraco);font-weight:500}
.legenda{margin:6px 0 0;font-size:15px;white-space:pre-wrap}
.nota{background:var(--verde-claro);border-left:4px solid var(--verde);padding:10px 14px;border-radius:0 8px 8px 0;margin:0 0 18px;font-size:14.5px;white-space:pre-wrap}
.mapa{border:1px solid var(--linha);border-radius:12px;padding:10px;margin:18px 0}
.mapa>svg{width:100%;height:auto;display:block;background:#F5F8F5;border-radius:8px}
.mapa-sat{height:360px;border-radius:8px;background:#DDE5DF}
.mapa-sat .leaflet-popup-content{margin:10px 12px;font-size:13px;line-height:1.4}
.resumo{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin:14px 0 4px}
.resumo div{background:#F7F9F7;border:1px solid var(--linha);border-radius:10px;padding:10px 12px}
.resumo b{display:block;font-size:19px;color:var(--verde-escuro)}
.resumo span{font-size:11.5px;color:var(--fraco)}
footer{background:#F7F9F7;border-top:1px solid var(--linha);padding:20px;text-align:center;font-size:12.5px;color:var(--fraco)}
footer b{color:var(--verde-escuro)}
footer .amvs{margin-top:14px;padding-top:12px;border-top:1px solid var(--linha);font-size:11.5px;line-height:1.6}
footer .amvs a{color:var(--verde);text-decoration:none}
footer .bandeira{display:block;margin:12px auto 0;width:30px;height:21px;border-radius:2px;box-shadow:0 0 0 1px rgba(0,0,0,.08)}
.barra{position:sticky;bottom:0;display:flex;gap:8px;padding:10px 16px;background:#fff;border-top:1px solid var(--linha)}
.barra button{flex:1;padding:11px 6px;border:none;border-radius:9px;background:var(--verde);color:#fff;font-weight:600;font-size:14px;white-space:nowrap}
.barra button:disabled{opacity:.7}
.barra button.sec{background:#fff;color:var(--verde);border:1px solid var(--verde)}
.item img{cursor:zoom-in}
.barra-idioma{display:flex;align-items:center;flex-wrap:wrap;gap:6px 8px;padding:9px 16px;background:#fff;border-bottom:1px solid var(--linha);font-size:12.5px;color:var(--fraco)}
.barra-idioma button{border:1px solid var(--linha);background:#fff;color:var(--verde-escuro);border-radius:999px;padding:4px 11px;font-size:12px;font-weight:600;cursor:pointer}
.barra-idioma button.on{background:var(--verde);border-color:var(--verde);color:#fff}
.barra-idioma .aviso-trad{margin-left:auto}
.barra-idioma .aviso-trad button{border:0;background:none;color:var(--verde);text-decoration:underline;padding:0 0 0 4px;font-weight:500}
@media print{.barra-idioma{display:none}}
.visor{position:fixed;left:0;right:0;top:0;height:100vh;height:100dvh;z-index:90;background:rgba(0,0,0,.96);
 display:flex;align-items:center;justify-content:center}
.visor img{max-width:100%;max-height:100%;object-fit:contain;touch-action:pinch-zoom}
.visor .x{position:absolute;top:calc(12px + env(safe-area-inset-top));left:12px;z-index:2;width:44px;height:44px;border-radius:50%;
 background:rgba(255,255,255,.18);color:#fff;font-size:22px;line-height:44px;text-align:center;border:0;cursor:pointer}
.visor .leg{position:absolute;left:0;right:0;bottom:0;padding:28px 16px calc(18px + env(safe-area-inset-bottom));color:#fff;
 font-size:15px;text-align:center;background:linear-gradient(transparent,rgba(0,0,0,.7));pointer-events:none}
.visor .dl{position:absolute;top:calc(12px + env(safe-area-inset-top));right:12px;z-index:2;width:44px;height:44px;border-radius:50%;
 background:rgba(255,255,255,.12);color:#fff;font-size:18px;line-height:44px;text-align:center;border:0;outline:0;cursor:pointer;padding:0;opacity:.85;-webkit-tap-highlight-color:transparent}
.visor .cont{position:absolute;top:calc(22px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:2;color:#fff;font-size:14px;font-weight:600;
 background:rgba(255,255,255,.18);border-radius:14px;padding:4px 12px;pointer-events:none}
.visor .cont:empty{display:none}
.visor .nav{position:absolute;top:50%;transform:translateY(-50%);z-index:2;width:46px;height:64px;border:0;background:rgba(255,255,255,.18);
 color:#fff;font-size:34px;line-height:60px;text-align:center;padding:0;cursor:pointer}
.visor .nav.ant{left:0;border-radius:0 12px 12px 0}
.visor .nav.prox{right:0;border-radius:12px 0 0 12px}
a.tag.baixar{background:#F0F2F1;color:var(--fraco);font-weight:500;text-decoration:none;cursor:pointer;border:0;outline:0;box-shadow:none;-webkit-tap-highlight-color:transparent}
a.tag.baixar svg{width:12px;height:12px;vertical-align:-1px;margin-right:4px}
.visor .dl svg{width:20px;height:20px;vertical-align:middle;margin-top:-2px}
a.tag.baixar:visited,a.tag.baixar:hover,a.tag.baixar:focus,a.tag.baixar:active{color:var(--fraco);outline:0;text-decoration:none}
@media print{.visor{display:none}a.tag.baixar{display:none}}
@media print{body{background:#fff}.folha{box-shadow:none;max-width:none}.barra{display:none}
 h2.talhao{position:static;break-after:avoid}.item,.grupo{break-inside:avoid}video{display:none}}
`;

function fmtData(d) {
  if (!d) return '—';
  const p = String(d).slice(0, 10).split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
}
// data que o navegador reescreve no idioma do leitor (o texto de dentro é o fallback em português)
function dataSpan(d) {
  if (!d) return '—';
  return `<span data-d="${esc(String(d).slice(0, 10))}">${fmtData(d)}</span>`;
}
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

// datas com hora são gravadas em UTC; o relatório mostra no horário de Mato Grosso (UTC-4).
// "2026-10-23T01:30:00Z" (ou "2026-10-23 01:30:00", da nuvem) → "2026-10-22T21:30:00.000Z": dia e hora certos com getUTC*/slice
function noFuso(iso) {
  const s = String(iso || '');
  if (s.length <= 10) return s;   // só a data: não tem fuso
  const t = Date.parse(s.replace(' ', 'T') + (/(Z|[+-]\d\d:?\d\d)$/i.test(s) ? '' : 'Z'));
  return isNaN(t) ? s : new Date(t - 4 * 3600 * 1000).toISOString();
}
// dia = "AAAA-MM-DD" (já no fuso)
function diaLongo(dia) {
  const d = new Date(String(dia).slice(0, 10) + 'T12:00:00Z');
  return `${DIAS[d.getUTCDay()]}, ${String(d.getUTCDate()).padStart(2, '0')} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}
function hora(iso) {
  const d = new Date(noFuso(iso));
  return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
}

function mapaSVG(talhoes, itens) {
  const feats = (talhoes && talhoes.features) || [];
  if (!feats.length) return '';
  let minX = 180, minY = 90, maxX = -180, maxY = -90;
  const each = (f, cb) => {
    const g = f.geometry; if (!g) return;
    (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).forEach(cb);
  };
  feats.forEach(f => each(f, rings => rings.forEach(r => r.forEach(p => {
    minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
    minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
  }))));
  const dx = (maxX - minX) || 0.001, dy = (maxY - minY) || 0.001;
  minX -= dx * 0.03; maxX += dx * 0.03; minY -= dy * 0.03; maxY += dy * 0.03;
  const W = 1000;
  const H = Math.max(300, Math.round(W * ((maxY - minY) / (maxX - minX)) * Math.cos((minY + maxY) / 2 * Math.PI / 180)));
  const px = l => (l - minX) / (maxX - minX) * W, py = l => H - (l - minY) / (maxY - minY) * H;

  let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
  feats.forEach(f => {
    each(f, rings => {
      const d = rings.map(r => 'M' + r.map(p => px(p[0]).toFixed(1) + ',' + py(p[1]).toFixed(1)).join('L') + 'Z').join(' ');
      s += `<path d="${d}" fill="rgba(27,122,67,.13)" stroke="#1B7A43" stroke-width="2.5"/>`;
    });
    let sx = 0, sy = 0, n = 0;
    each(f, rings => rings[0].forEach(p => { sx += p[0]; sy += p[1]; n++; }));
    s += `<text x="${px(sx / n).toFixed(1)}" y="${py(sy / n).toFixed(1)}" font-size="19" font-weight="600" fill="#146034" text-anchor="middle" font-family="sans-serif">${esc(f.properties && f.properties.nome || '')}</text>`;
    const haT = Number(f.properties && f.properties.area_ha) || 0;
    if (haT) s += `<text x="${px(sx / n).toFixed(1)}" y="${(py(sy / n) + 21).toFixed(1)}" font-size="16" fill="#146034" text-anchor="middle" font-family="sans-serif">${haT.toFixed(1).replace('.', ',')} ha</text>`;
  });
  itens.filter(i => i.lat != null).forEach(i => {
    s += `<circle cx="${px(i.lon).toFixed(1)}" cy="${py(i.lat).toFixed(1)}" r="7" fill="${i.tipo === 'video' ? '#D93025' : '#1B7A43'}" stroke="#fff" stroke-width="2.5"/>`;
  });
  s += '</svg>';
  return `<div class="mapa">${s}<div style="font-size:11.5px;color:#6B7B72;margin-top:8px" data-i="legenda_mapa">🟢 fotos · 🔴 vídeos · polígonos do KML da fazenda</div></div>`;
}

// mapa de satélite no fim do relatório com os pontos onde cada foto e vídeo foi feito
// (e os talhões do KML por cima, quando a fazenda tem)
function mapaPontos(talhoes, itens) {
  const feats = ((talhoes && talhoes.features) || []).filter(f => f && f.geometry).map(f => ({
    type: 'Feature', geometry: f.geometry,
    properties: { nome: (f.properties && f.properties.nome) || '', ha: Number(f.properties && f.properties.area_ha) || 0 }
  }));
  const pts = itens.filter(i => i.lat != null && i.lon != null && (i.tipo === 'foto' || i.tipo === 'video')).map(i => ({
    la: i.lat, lo: i.lon, v: i.tipo === 'video' ? 1 : 0, h: hora(i.capturado_em),
    l: String(i.legenda || '').slice(0, 140), m: i.tipo === 'foto' && i.midia ? '/img/' + encodeURIComponent(i.midia) : ''
  }));
  if (!pts.length && !feats.length) return '';
  const dados = JSON.stringify(pts).replace(/</g, '\\u003c');
  const areas = JSON.stringify(feats).replace(/</g, '\\u003c');
  return `<h2 class="talhao"><span data-i="mapa_pontos">Onde foram feitos os registros</span></h2>
<div class="mapa"><div id="mapaPontos" class="mapa-sat"></div>
<div style="font-size:11.5px;color:#6B7B72;margin-top:8px" data-i="${feats.length ? 'legenda_pontos_kml' : 'legenda_pontos'}">${feats.length ? '🟢 fotos · 🔴 vídeos · contorno claro = talhões do KML' : '🟢 fotos · 🔴 vídeos · imagem de satélite'}</div></div>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<script>
(function(){
  var el = document.getElementById('mapaPontos'), P = ${dados}, A = ${areas};
  if (!window.L) { el.parentNode.style.display = 'none'; el.parentNode.previousElementSibling.style.display = 'none'; return; }
  var m = L.map(el, { scrollWheelZoom: false });
  var esri = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
  L.tileLayer(esri + 'World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, maxNativeZoom: 18, attribution: 'Imagens © Esri, Maxar, Earthstar Geographics' }).addTo(m);
  L.tileLayer(esri + 'Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, maxNativeZoom: 18 }).addTo(m);
  function e(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  // enquadra antes de desenhar: o Leaflet não aceita polígonos num mapa ainda sem posição
  var ta = A.length ? L.geoJSON({ type: 'FeatureCollection', features: A }, {
    style: { color: '#B9F5CC', weight: 2, fillColor: '#2FA05A', fillOpacity: 0.15 },
    onEachFeature: function(f, c){
      var q = f.properties || {};
      if (q.nome) c.bindPopup('<b>' + e(q.nome) + '</b>' + (q.ha ? '<br>' + q.ha.toFixed(1).replace('.', ',') + ' ha' : ''));
    }
  }) : null;
  var limites = ta ? ta.getBounds() : L.latLngBounds([]);
  P.forEach(function(p){ limites.extend([p.la, p.lo]); });
  if (!ta && P.length === 1) m.setView([P[0].la, P[0].lo], 16);
  else m.fitBounds(limites, { padding: [24, 24], maxZoom: 17 });
  if (ta) ta.addTo(m);
  P.forEach(function(p){
    L.circleMarker([p.la, p.lo], { radius: 7, color: '#fff', weight: 2.5, fillColor: p.v ? '#D93025' : '#1B7A43', fillOpacity: .95 })
      .bindPopup((p.m ? '<img src="' + p.m + '" style="display:block;width:180px;max-height:140px;object-fit:cover;border-radius:6px;margin-bottom:6px">' : '') +
        '<b>' + e(p.h) + '</b>' + (p.l ? '<br>' + e(p.l) : '')).addTo(m);
  });
})();
</script>`;
}

/* Agrupa os registros por talhão, na ordem em que os talhões vêm do KML. */
function agruparPorTalhao(itens, talhoes) {
  const ordem = {}, areas = {};
  ((talhoes && talhoes.features) || []).forEach((f, i) => {
    const p = f.properties || {};
    if (p.nome) { ordem[p.nome] = i; areas[p.nome] = p.area_ha || 0; }
  });

  const mapa = {};
  itens.forEach(i => {
    const chave = i.tipo === 'texto' ? '\u0000notas' : (i.talhao ? i.talhao : '\u0000fora');   // todo texto vai para as observações gerais, no início
    (mapa[chave] = mapa[chave] || []).push(i);
  });

  const peso = k => k.charCodeAt(0) === 0
    ? 1e6 + (k === '\u0000notas' ? 1 : 0)
    : (ordem[k] != null ? ordem[k] : 1e5);

  return Object.keys(mapa)
    .sort((a, b) => peso(a) - peso(b) || a.localeCompare(b))
    .map(k => {
      const lista = mapa[k].slice().sort((a, b) =>
        String(a.capturado_em).localeCompare(String(b.capturado_em)));
      const dias = {};
      lista.forEach(i => { dias[noFuso(i.capturado_em).slice(0, 10)] = 1; });
      return {
        chave: k,
        titulo: k === '\u0000notas' ? 'Observações gerais' : k === '\u0000fora' ? 'Fora dos talhões' : k,
        area: areas[k] || 0,
        varioDia: Object.keys(dias).length > 1,
        itens: lista
      };
    });
}


/* Dentro de um talhão: junta os registros de mesma legenda num grupo só. */
const normLeg = s => String(s == null ? '' : s).trim().replace(/\s+/g, ' ').toLowerCase();
function gruposDeLegenda(lista) {
  const ordem = [], mapa = {};
  lista.forEach(i => {
    const k = normLeg(i.legenda);
    if (!mapa[k]) { mapa[k] = { titulo: String(i.legenda || '').trim(), itens: [] }; ordem.push(k); }
    mapa[k].itens.push(i);
  });
  return ordem.map(k => mapa[k]);
}

function celulaMidia(i) {
  const src = '/img/' + encodeURIComponent(i.midia);
  const nomeArq = (i.tipo === 'foto' ? 'foto' : 'video') + '-' + noFuso(i.capturado_em).replace(/[^0-9]/g, '').slice(0, 12);
  const dl = src + '?baixar=1&n=' + encodeURIComponent(nomeArq);
  return `<div class="item"><figure>` +
    (i.tipo === 'foto'
      ? `<img loading="lazy" src="${src}" data-dl="${esc(dl)}" alt="${esc(i.legenda || '')}">`
      : `<video controls preload="metadata" playsinline src="${src}"></video>`) +
    `</figure><div class="meta">` +
    `<span class="tag cinza">${hora(i.capturado_em)}</span>` +
    (i.lat != null ? `<span class="tag cinza">${i.lat.toFixed(5)}, ${i.lon.toFixed(5)}</span>` : '') +
    (i.precisao_m ? `<span class="tag cinza">±${Math.round(i.precisao_m)} m</span>` : '') +
    (i.tipo === 'video' && i.duracao_s ? `<span class="tag cinza">${Math.round(i.duracao_s)}s</span>` : '') +
    (i.tipo === 'video' ? `<a class="tag baixar" href="${esc(dl)}" download><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v12m0 0l-5-5m5 5l5-5M5 20h14"/></svg><span data-i="baixar_midia">Baixar</span></a>` : '') +
    `</div></div>`;
}

// cada grupo vira um cartão: fotos em grade e a legenda logo abaixo (como no modelo de referência)
function blocoGrupos(midias) {
  return gruposDeLegenda(midias).map(g => {
    const n = g.itens.length;
    return `<div class="grupo"><div class="grade n${Math.min(n, 3)}">${g.itens.map(celulaMidia).join('')}</div>` +
      (g.titulo ? `<p class="grupo-leg" data-tr>${esc(g.titulo)}</p>` : '') + `</div>`;
  }).join('');
}

/* Junta várias visitas já publicadas (mesma conta) em um único relatório para o cliente. */
export function juntarRelatorios(rels) {
  const lista = rels.slice().sort((a, b) =>
    String(a.data_inicio || a.criado_em).localeCompare(String(b.data_inicio || b.criado_em)));
  const unicos = (campo, sep) => [...new Set(lista.map(r => String(r[campo] || '').trim()).filter(Boolean))].join(sep);
  const datas = lista.map(r => String(r.data_inicio || noFuso(r.criado_em)).slice(0, 10)).filter(Boolean);
  const fins = lista.map(r => String(r.data_fim || r.data_inicio || noFuso(r.criado_em)).slice(0, 10)).filter(Boolean);

  // polígonos: cada talhão aparece uma vez só, mesmo que esteja em várias visitas
  const vistos = new Set(), feats = [];
  lista.forEach(r => {
    let t = null; try { t = r.talhoes ? JSON.parse(r.talhoes) : null; } catch (e) {}
    ((t && t.features) || []).forEach(f => {
      const k = (f.properties && f.properties.nome) || JSON.stringify(f.geometry || '');
      if (!vistos.has(k)) { vistos.add(k); feats.push(f); }
    });
  });

  const obs = lista.filter(r => r.observacoes)
    .map(r => `${fmtData(r.data_inicio || r.criado_em)}: ${r.observacoes}`).join('\n');

  return Object.assign({}, lista[0], {
    fazenda: unicos('fazenda', ' · '), produtor: unicos('produtor', ', '), safra: unicos('safra', ', '),
    servico: unicos('servico', ' · '), responsavel: unicos('responsavel', ', '),
    data_inicio: datas.sort()[0] || null, data_fim: fins.sort().pop() || null,
    observacoes: obs,
    talhoes: feats.length ? JSON.stringify({ type: 'FeatureCollection', features: feats }) : '',
    publicado_em: lista.map(r => r.publicado_em).filter(Boolean).sort().pop() || null,
    _n: lista.length
  });
}


// bandeira do Brasil no fim do relatório (desenhada: o emoji de bandeira não aparece em todo aparelho)
const BANDEIRA = '<svg class="bandeira" viewBox="0 0 20 14" role="img" aria-label="Brasil">' +
  '<rect width="20" height="14" fill="#009C3B"/><path d="M10 1.6 18.2 7 10 12.4 1.8 7Z" fill="#FFDF00"/>' +
  '<circle cx="10" cy="7" r="3.4" fill="#002776"/><path d="M6.7 6.3c2.2-.5 4.6-.2 6.6.9" stroke="#fff" stroke-width=".55" fill="none"/></svg>';

/* ---------- idiomas do relatório (português, inglês, espanhol) ---------- */
const DICT = {
  pt: {
    rel_visita: 'Relatório de visita', rel_visitas: 'Relatório de {n} visitas',
    sub_padrao: 'Relatório de visita técnica',
    produtor: 'Produtor', safra: 'Safra', periodo: 'Período', responsavel: 'Responsável',
    visitas: 'visitas', fotos: 'fotos', videos: 'vídeos', talhoes_reg: 'talhões registrados', ha_map: 'hectares mapeados',
    legenda_mapa: '🟢 fotos · 🔴 vídeos · polígonos do KML da fazenda',
    mapa_pontos: 'Onde foram feitos os registros', legenda_pontos: '🟢 fotos · 🔴 vídeos · imagem de satélite',
    legenda_pontos_kml: '🟢 fotos · 🔴 vídeos · contorno claro = talhões do KML',
    obs_gerais: 'Observações gerais', fora: 'Fora dos talhões', reg: '{n} registro(s)',
    concluido: 'Serviço concluído ✔️', baixar_midia: 'Baixar', pdf: 'Baixar PDF', compartilhar: 'Compartilhar', link_copiado: 'Link copiado',
    publicado: 'Publicado em {d}', gerado_por: 'Gerado por',
    traduzindo: 'Traduzindo…', auto: 'Tradução automática', ver_original: 'ver original', indisp: 'Tradução indisponível no momento'
  },
  en: {
    rel_visita: 'Visit report', rel_visitas: 'Report of {n} visits',
    sub_padrao: 'Technical visit report',
    produtor: 'Producer', safra: 'Crop season', periodo: 'Period', responsavel: 'Responsible',
    visitas: 'visits', fotos: 'photos', videos: 'videos', talhoes_reg: 'fields recorded', ha_map: 'hectares mapped',
    legenda_mapa: '🟢 photos · 🔴 videos · farm KML polygons',
    mapa_pontos: 'Where the records were taken', legenda_pontos: '🟢 photos · 🔴 videos · satellite imagery',
    legenda_pontos_kml: '🟢 photos · 🔴 videos · light outline = farm KML fields',
    obs_gerais: 'General notes', fora: 'Outside the fields', reg: '{n} record(s)',
    concluido: 'Service completed ✔️', baixar_midia: 'Download', pdf: 'Download PDF', compartilhar: 'Share', link_copiado: 'Link copied',
    publicado: 'Published on {d}', gerado_por: 'Generated by',
    traduzindo: 'Translating…', auto: 'Automatic translation', ver_original: 'view original', indisp: 'Translation unavailable right now'
  },
  es: {
    rel_visita: 'Informe de visita', rel_visitas: 'Informe de {n} visitas',
    sub_padrao: 'Informe de visita técnica',
    produtor: 'Productor', safra: 'Campaña', periodo: 'Período', responsavel: 'Responsable',
    visitas: 'visitas', fotos: 'fotos', videos: 'videos', talhoes_reg: 'lotes registrados', ha_map: 'hectáreas mapeadas',
    legenda_mapa: '🟢 fotos · 🔴 videos · polígonos del KML de la finca',
    mapa_pontos: 'Dónde se hicieron los registros', legenda_pontos: '🟢 fotos · 🔴 videos · imagen satelital',
    legenda_pontos_kml: '🟢 fotos · 🔴 videos · contorno claro = lotes del KML',
    obs_gerais: 'Observaciones generales', fora: 'Fuera de los lotes', reg: '{n} registro(s)',
    concluido: 'Servicio concluido ✔️', baixar_midia: 'Descargar', pdf: 'Descargar PDF', compartilhar: 'Compartir', link_copiado: 'Enlace copiado',
    publicado: 'Publicado el {d}', gerado_por: 'Generado por',
    traduzindo: 'Traduciendo…', auto: 'Traducción automática', ver_original: 'ver original', indisp: 'Traducción no disponible por ahora'
  }
};

// roda no navegador do cliente: escolhe o idioma (o do aparelho, ou o que ele já tinha escolhido),
// reescreve os rótulos e pede a tradução das legendas e observações
// ---------- apresentação em PowerPoint (gerada no aparelho de quem abriu o relatório) ----------
// A biblioteca só é baixada quando alguém toca no botão. No iPhone, salvar/compartilhar precisa de um
// toque recente: o primeiro toque gera o arquivo, e o botão vira "Salvar PowerPoint" para o segundo toque.
const SCRIPT_PPT = String.raw`
(function(){
  var btn = document.getElementById('btnPpt'), D = null;
  try { D = JSON.parse(document.getElementById('pptDados').textContent); } catch (e) {}
  if (!btn || !D) return;
  var VERDE = '1B7A43', ESCURO = '146034', CLARO = 'E8F4EC', CINZA = '6B7B72', TEXTO = '1B2B22';
  var arquivo = null, nome = 'relatorio-' + String(D.fazenda || 'visita').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.pptx';
  function lib(){ return new Promise(function(ok, erro){
    if (window.PptxGenJS) return ok();
    var sc = document.createElement('script'); sc.src = 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js';
    sc.onload = function(){ ok(); }; sc.onerror = function(){ erro(new Error('sem conexão')); }; document.head.appendChild(sc);
  }); }
  // foto reduzida (até 1600 px) em JPEG; devolve também o tamanho para caber sem distorcer
  function imagem(src, max){ return new Promise(function(ok){
    if (!src) return ok(null);
    var im = new Image(); im.crossOrigin = 'anonymous';
    im.onload = function(){ try {
      var e = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(im.naturalWidth * e)); c.height = Math.max(1, Math.round(im.naturalHeight * e));
      var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
      ok({ data: c.toDataURL('image/jpeg', 0.85), w: c.width, h: c.height });
    } catch (err) { ok(null); } };
    im.onerror = function(){ ok(null); }; im.src = src;
  }); }
  // mapa da página (SVG) em imagem: copia para o SVG os estilos que vêm do CSS (contorno, rótulos)
  var ESTILOS = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-linejoin', 'stroke-dasharray', 'paint-order', 'opacity', 'font-size', 'font-weight', 'font-family', 'text-anchor'];
  function svgImagem(svg, larg){ return new Promise(function(ok){ try {
    var vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number), w = vb[2] || 1000, h = vb[3] || 600;
    var cl = svg.cloneNode(true), orig = [svg].concat([].slice.call(svg.querySelectorAll('*'))), cop = [cl].concat([].slice.call(cl.querySelectorAll('*')));
    orig.forEach(function(el, i){ var cs = getComputedStyle(el); ESTILOS.forEach(function(k){ var v = cs.getPropertyValue(k); if (v) cop[i].style.setProperty(k, v); }); });
    cl.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); cl.setAttribute('width', w); cl.setAttribute('height', h); cl.removeAttribute('style');
    var im = new Image();
    im.onload = function(){ try {
      var e = larg / w, c = document.createElement('canvas'); c.width = Math.round(w * e); c.height = Math.round(h * e);
      var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
      ok({ data: c.toDataURL('image/png'), w: c.width, h: c.height });
    } catch (err) { ok(null); } };
    im.onerror = function(){ ok(null); };
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(cl));
  } catch (err) { ok(null); } }); }
  function hex(cor){ var m = String(cor || '').match(/\d+/g); return m && m.length >= 3 ? m.slice(0, 3).map(function(n){ return ('0' + Number(n).toString(16)).slice(-2); }).join('').toUpperCase() : '999999'; }
  function caber(im, x, y, bw, bh){ var e = Math.min(bw / im.w, bh / im.h), w = im.w * e, h = im.h * e; return { data: im.data, x: x + (bw - w) / 2, y: y + (bh - h) / 2, w: w, h: h }; }
  function faixa(sl, titulo, sub){
    sl.background = { color: 'FFFFFF' };
    sl.addShape('rect', { x: 0, y: 0, w: 13.333, h: 0.95, fill: { color: VERDE }, line: { color: VERDE } });
    sl.addText(titulo, { x: 0.45, y: 0.12, w: 9.6, h: 0.72, fontSize: 24, bold: true, color: 'FFFFFF', fontFace: 'Arial', valign: 'middle' });
    if (sub) sl.addText(sub, { x: 9.8, y: 0.12, w: 3.1, h: 0.72, fontSize: 13, color: 'FFFFFF', fontFace: 'Arial', align: 'right', valign: 'middle' });
    sl.addText(D.empresa + '  ·  ' + D.fazenda, { x: 0.45, y: 7.08, w: 9, h: 0.3, fontSize: 9, color: CINZA, fontFace: 'Arial' });
    sl.addText('AMVS Relatório de Campo', { x: 9.4, y: 7.08, w: 3.5, h: 0.3, fontSize: 9, color: VERDE, bold: true, fontFace: 'Arial', align: 'right' });
  }
  async function gerar(){
    await lib();
    var P = new window.PptxGenJS(); P.layout = 'LAYOUT_WIDE'; P.title = D.titulo; P.company = D.empresa;
    var logo = await imagem(D.logo, 600);

    // capa
    var c = P.addSlide(); c.background = { color: VERDE };
    if (logo) { var lg = caber(logo, 0.75, 0.6, 2.4, 1.1); c.addShape('roundRect', { x: lg.x - 0.12, y: lg.y - 0.12, w: lg.w + 0.24, h: lg.h + 0.24, fill: { color: 'FFFFFF' }, line: { color: 'FFFFFF' }, rectRadius: 0.08 }); c.addImage(lg); }
    c.addText([{ text: D.empresa, options: { bold: true, fontSize: 20, breakLine: true } }, { text: [D.cidade, D.contato].filter(Boolean).join('  ·  '), options: { fontSize: 13 } }],
      { x: logo ? 3.6 : 0.75, y: 0.55, w: 9, h: 1.2, color: 'FFFFFF', fontFace: 'Arial', valign: 'middle' });
    c.addText(D.fazenda, { x: 0.75, y: 2.3, w: 11.8, h: 1.2, fontSize: 48, bold: true, color: 'FFFFFF', fontFace: 'Arial' });
    c.addText(D.servico, { x: 0.75, y: 3.45, w: 11.8, h: 0.6, fontSize: 22, color: 'D6EEDD', fontFace: 'Arial' });
    var info = [['Produtor', D.produtor], ['Safra', D.safra], ['Período', D.periodo], ['Responsável', D.responsavel]];
    info.forEach(function(it, i){
      c.addText([{ text: it[0].toUpperCase(), options: { fontSize: 11, color: 'BFE3CB', breakLine: true } }, { text: it[1] || '—', options: { fontSize: 18, bold: true, color: 'FFFFFF' } }],
        { x: 0.75 + i * 3.05, y: 4.75, w: 2.95, h: 1.0, fontFace: 'Arial', valign: 'top' });
    });
    if (D.publicado) c.addText('Publicado em ' + D.publicado, { x: 0.75, y: 6.6, w: 8, h: 0.4, fontSize: 12, color: 'D6EEDD', fontFace: 'Arial' });

    // mapa da fazenda (talhões do KML, com os pontos das fotos)
    var svgGeral = document.querySelector('.mapa > svg');
    if (svgGeral) {
      btn.textContent = 'Gerando… mapas';
      var mg = await svgImagem(svgGeral, 2000);
      if (mg) { var sm = P.addSlide(); faixa(sm, 'Mapa da fazenda', D.area); sm.addImage(caber(mg, 0.45, 1.15, 12.4, 5.8)); }
    }
    // mapa por variedade, com a legenda ao lado
    var svgVar = document.querySelector('.mapa-cli svg');
    if (svgVar) {
      var mv = await svgImagem(svgVar, 2000);
      if (mv) {
        var sv = P.addSlide(); faixa(sv, 'Mapa por variedade', D.safra);
        sv.addImage(caber(mv, 0.45, 1.15, 8.9, 5.8));
        var leg = [];
        [].slice.call(document.querySelectorAll('.leg-var .lv-g')).forEach(function(gr){
          var cat = gr.querySelector('.lv-c');
          if (cat) leg.push({ text: cat.textContent.trim(), options: { bold: true, color: CINZA, fontSize: 12, breakLine: true } });
          [].slice.call(gr.querySelectorAll('.lv')).forEach(function(it){
            var q = it.querySelector('i');
            leg.push({ text: '■ ', options: { color: hex(q && getComputedStyle(q).backgroundColor), fontSize: 15 } });
            leg.push({ text: it.textContent.trim(), options: { color: TEXTO, fontSize: 13, breakLine: true } });
          });
        });
        if (leg.length) sv.addText(leg, { x: 9.6, y: 1.25, w: 3.3, h: 5.6, fontFace: 'Arial', valign: 'top', paraSpaceAfter: 4 });
      }
    }
    // evolução do plantio: resumo, gráfico e a tabela por data
    var svgEvo = document.querySelector('.pl-graf svg');
    if (svgEvo) {
      var ge = await svgImagem(svgEvo, 1800);
      if (ge) {
        var se = P.addSlide(); faixa(se, 'Evolução do plantio', D.safra);
        var st = document.querySelector('.pl-stat'), linhas = [];
        if (st) linhas.push({ text: st.textContent.replace(/\s+/g, ' ').trim(), options: { fontSize: 18, bold: true, color: ESCURO, breakLine: true } });
        [].slice.call(document.querySelectorAll('.pl-falta')).forEach(function(f){ linhas.push({ text: f.textContent.replace(/\s+/g, ' ').trim(), options: { fontSize: 12, color: CINZA, breakLine: true } }); });
        if (linhas.length) se.addText(linhas, { x: 0.5, y: 1.1, w: 12.3, h: 0.95, fontFace: 'Arial', valign: 'top' });
        var ev = []; try { ev = JSON.parse(document.getElementById('plDados').textContent); } catch (e) {}
        var comTabela = ev.length && ev.length <= 14;
        se.addImage(caber(ge, 0.45, 2.1, comTabela ? 7.9 : 12.4, 4.85));
        if (comTabela) {
          var cabE = [['Data', 'Talhões', 'ha', 'Acumulado'].map(function(t){ return { text: t, options: { bold: true, color: 'FFFFFF', fill: { color: VERDE } } }; })];
          se.addTable(cabE.concat(ev.map(function(e){ return [e.d, e.tal, e.ha, e.cum + ' (' + e.pc + '%)']; })),
            { x: 8.55, y: 2.1, w: 4.35, colW: [0.75, 1.5, 0.8, 1.3], fontSize: 10, fontFace: 'Arial', color: TEXTO, border: { type: 'solid', color: 'E4E9E6', pt: 1 } });
        }
      }
    }

    // observações gerais (quebra em mais de um slide se for longo)
    if (D.obs.length) {
      var blocos = [], atual = [], tam = 0;
      D.obs.forEach(function(o){ if (tam + o.length > 900 && atual.length) { blocos.push(atual); atual = []; tam = 0; } atual.push(o); tam += o.length; });
      if (atual.length) blocos.push(atual);
      blocos.forEach(function(b, i){
        var sl = P.addSlide(); faixa(sl, 'Observações gerais', blocos.length > 1 ? (i + 1) + ' de ' + blocos.length : '');
        sl.addText(b.map(function(t){ return { text: t, options: { bullet: true, breakLine: true, paraSpaceAfter: 10 } }; }),
          { x: 0.6, y: 1.25, w: 12.1, h: 5.6, fontSize: 17, color: TEXTO, fontFace: 'Arial', valign: 'top' });
      });
    }

    // um slide por foto, por talhão; observações do talhão num slide de texto
    for (var gi = 0; gi < D.grupos.length; gi++) {
      var g = D.grupos[gi], fotos = g.itens.filter(function(i){ return i.tipo === 'foto' && i.src; }), notas = g.itens.filter(function(i){ return i.tipo === 'texto'; });
      if (notas.length) {
        var sn = P.addSlide(); faixa(sn, g.titulo + ' · observações', g.area);
        sn.addText(notas.map(function(n){ return { text: (n.quando ? n.quando + '  —  ' : '') + n.legenda, options: { bullet: true, breakLine: true, paraSpaceAfter: 10 } }; }),
          { x: 0.6, y: 1.25, w: 12.1, h: 5.6, fontSize: 17, color: TEXTO, fontFace: 'Arial', valign: 'top' });
      }
      for (var fi = 0; fi < fotos.length; fi++) {
        btn.textContent = 'Gerando… ' + g.titulo;
        var f = fotos[fi], im = await imagem(f.src, 1600), sf = P.addSlide();
        faixa(sf, g.titulo, (g.area ? g.area + '  ·  ' : '') + 'foto ' + (fi + 1) + ' de ' + fotos.length);
        if (im) sf.addImage(caber(im, 0.45, 1.2, 8.4, 5.75));
        else sf.addText('Foto indisponível', { x: 0.45, y: 1.2, w: 8.4, h: 5.75, align: 'center', color: CINZA, fontSize: 14, fill: { color: 'F2F4F2' } });
        sf.addShape('rect', { x: 9.1, y: 1.2, w: 3.8, h: 5.75, fill: { color: CLARO }, line: { color: CLARO } });
        sf.addText([
          { text: f.quando || '', options: { fontSize: 13, color: CINZA, breakLine: true } },
          { text: f.legenda || 'Sem observação', options: { fontSize: 17, color: f.legenda ? TEXTO : CINZA, breakLine: true } }
        ], { x: 9.3, y: 1.4, w: 3.45, h: 5.4, fontFace: 'Arial', valign: 'top', paraSpaceAfter: 8 });
      }
    }

    // aplicações
    D.apl.forEach(function(a){
      var sa = P.addSlide(); faixa(sa, a.titulo, a.status);
      sa.addText([{ text: a.quando, options: { fontSize: 16, bold: true, color: ESCURO, breakLine: true } },
        { text: 'Talhões: ' + a.talhoes + (a.ha ? '  ·  ' + a.ha : ''), options: { fontSize: 14, color: TEXTO, breakLine: true } },
        { text: a.calda || '', options: { fontSize: 13, color: CINZA, breakLine: true } },
        { text: a.prox || '', options: { fontSize: 13, color: VERDE, bold: true } }],
        { x: 0.6, y: 1.2, w: 12.1, h: 1.6, fontFace: 'Arial', valign: 'top' });
      var cab = [['Produto', 'Dose/ha', 'Total'].map(function(t){ return { text: t, options: { bold: true, color: 'FFFFFF', fill: { color: VERDE } } }; })];
      sa.addTable(cab.concat(a.prods.map(function(p){ return [p[0], p[1], p[2] || '—']; })),
        { x: 0.6, y: 3.0, w: 12.1, colW: [6.5, 2.8, 2.8], fontSize: 14, fontFace: 'Arial', color: TEXTO, border: { type: 'solid', color: 'E4E9E6', pt: 1 }, autoPage: true });
    });

    // encerramento
    var fz = P.addSlide(); fz.background = { color: VERDE };
    fz.addText('Serviço concluído', { x: 0.75, y: 1.6, w: 11.8, h: 1, fontSize: 40, bold: true, color: 'FFFFFF', fontFace: 'Arial' });
    fz.addText([{ text: D.empresa, options: { bold: true, fontSize: 20, breakLine: true } }, { text: [D.cidade, D.contato].filter(Boolean).join('  ·  '), options: { fontSize: 14, breakLine: true } },
      { text: 'Relatório completo, com vídeos e mapa de satélite: ' + location.href.split('?')[0], options: { fontSize: 12, color: 'D6EEDD' } }],
      { x: 0.75, y: 2.8, w: 11.8, h: 1.8, color: 'FFFFFF', fontFace: 'Arial', valign: 'top' });
    fz.addText([{ text: 'Gerado por ', options: { color: 'D6EEDD' } }, { text: 'AMVS Tecnologia', options: { bold: true } },
      { text: '  ·  WhatsApp (65) 99918-9847  ·  amvsdiretoria@gmail.com  ·  amvs.ia.br', options: { color: 'D6EEDD' } }],
      { x: 0.75, y: 6.5, w: 11.8, h: 0.5, fontSize: 12, color: 'FFFFFF', fontFace: 'Arial' });
    return P.write({ outputType: 'blob' });
  }
  function salvar(blob){
    var arq = null; try { arq = new File([blob], nome, { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }); } catch (e) {}
    if (arq && navigator.canShare && navigator.canShare({ files: [arq] })) { navigator.share({ files: [arq], title: D.titulo }).catch(function(){}); return; }
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }
  var rotulo = btn.textContent, gerando = false;
  btn.addEventListener('click', function(){
    if (arquivo) { salvar(arquivo); return; }   // segundo toque: salva/compartilha o que já foi gerado
    if (gerando) return; gerando = true; btn.textContent = 'Gerando…'; btn.disabled = true;
    gerar().then(function(blob){ arquivo = blob; btn.textContent = 'Salvar PowerPoint'; }, function(e){
      btn.textContent = rotulo; alert('Não consegui gerar a apresentação' + (e && e.message ? ': ' + e.message : '') + '. Tente de novo com internet.');
    }).then(function(){ gerando = false; btn.disabled = false; });
  });
})();
`;

const SCRIPT_IDIOMA = String.raw`
(function(){
  var D = __DICT__;
  var LANGS = ['pt','en','es'];
  var atual = 'pt';
  var cache = {};
  var barra = document.getElementById('idiomas');
  var aviso = document.getElementById('avisoTrad');
  function norm(s){ return String(s == null ? '' : s).replace(/\r\n?/g, '\n').trim(); }
  function t(k, v){
    var s = (D[atual] && D[atual][k]) || D.pt[k] || k;
    if (v) for (var n in v) s = s.split('{' + n + '}').join(v[n]);
    return s;
  }
  window.__t = t;
  function loc(){ return atual === 'pt' ? 'pt-BR' : atual === 'es' ? 'es' : 'en-US'; }
  function fmtData(iso){
    var p = String(iso || '').slice(0, 10).split('-');
    if (p.length !== 3) return iso || '—';
    if (atual === 'en') {
      try { return new Intl.DateTimeFormat('en-US', {year:'numeric', month:'short', day:'numeric', timeZone:'UTC'}).format(new Date(Date.UTC(+p[0], +p[1]-1, +p[2]))); } catch(e) {}
    }
    return p[2] + '/' + p[1] + '/' + p[0];
  }
  function diaLongo(iso){
    try { return new Intl.DateTimeFormat(loc(), {weekday:'long', day:'2-digit', month:'long', year:'numeric', timeZone:'UTC'}).format(new Date(iso)); }
    catch(e) { return null; }
  }
  function guardar(e){ if (e.getAttribute('data-o') == null) e.setAttribute('data-o', e.textContent); }

  function aplicarRotulos(){
    document.querySelectorAll('[data-i]').forEach(function(e){
      guardar(e);
      if (atual === 'pt') { e.textContent = e.getAttribute('data-o'); return; }
      var d = e.getAttribute('data-d');
      e.textContent = t(e.getAttribute('data-i'), {n: e.getAttribute('data-n'), d: d ? fmtData(d) : ''});
    });
    document.querySelectorAll('[data-d]:not([data-i])').forEach(function(e){
      guardar(e);
      e.textContent = atual === 'pt' ? e.getAttribute('data-o') : fmtData(e.getAttribute('data-d'));
    });
    document.querySelectorAll('[data-dia]').forEach(function(e){
      guardar(e);
      e.textContent = atual === 'pt' ? e.getAttribute('data-o') : (diaLongo(e.getAttribute('data-dia')) || e.getAttribute('data-o'));
    });
    var n = +document.body.getAttribute('data-n') || 1;
    document.title = t(n > 1 ? 'rel_visitas' : 'rel_visita', {n: n}) + ' — ' + (document.body.getAttribute('data-fz') || '');
  }

  function aplicarTraducao(mapa){
    document.querySelectorAll('[data-tr]').forEach(function(e){
      guardar(e);
      var o = e.getAttribute('data-o'), tr = mapa[norm(o)];
      e.textContent = (atual !== 'pt' && tr) ? tr : o;
    });
    document.querySelectorAll('.item img[alt]').forEach(function(im){
      if (im.getAttribute('data-oalt') == null) im.setAttribute('data-oalt', im.getAttribute('alt'));
      var o = im.getAttribute('data-oalt'), tr = mapa[norm(o)];
      im.setAttribute('alt', (atual !== 'pt' && tr) ? tr : o);
    });
  }

  function buscar(lang, fim){
    if (cache[lang]) return fim(cache[lang]);
    var base = location.pathname.replace(/\/$/, '');
    fetch(base + '/traduzir?lang=' + lang).then(function(r){ return r.json(); })
      .then(function(j){ if (j && j.ok && !j.indisponivel) cache[lang] = j; fim(j); })
      .catch(function(){ fim(null); });
  }

  function marcar(){
    barra.querySelectorAll('button[data-l]').forEach(function(b){
      var on = b.getAttribute('data-l') === atual;
      b.className = on ? 'on' : '';
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function mudar(lang, salvar){
    if (LANGS.indexOf(lang) < 0) lang = 'pt';
    atual = lang;
    document.documentElement.lang = lang === 'pt' ? 'pt-BR' : lang;
    if (salvar) { try { localStorage.setItem('idioma-relatorio', lang); } catch(e) {} }
    marcar();
    aplicarRotulos();
    aviso.textContent = '';
    if (lang === 'pt') { aplicarTraducao({}); return; }
    aviso.textContent = t('traduzindo');
    buscar(lang, function(j){
      if (atual !== lang) return;
      var mapa = (j && j.traducoes) || {};
      aplicarTraducao(mapa);
      aviso.textContent = '';
      if (!j || !j.ok || j.indisponivel) { aviso.textContent = t('indisp'); return; }
      aviso.appendChild(document.createTextNode('🌐 ' + t('auto')));
      var b = document.createElement('button'); b.type = 'button'; b.textContent = t('ver_original');
      b.onclick = function(){ mudar('pt', true); };
      aviso.appendChild(b);
    });
  }

  barra.addEventListener('click', function(ev){
    var b = ev.target.closest && ev.target.closest('button[data-l]');
    if (b) mudar(b.getAttribute('data-l'), true);
  });

  function inicial(){
    try { var q = new URLSearchParams(location.search).get('lang'); if (q && LANGS.indexOf(q) >= 0) return q; } catch(e) {}
    try { var s = localStorage.getItem('idioma-relatorio'); if (s && LANGS.indexOf(s) >= 0) return s; } catch(e) {}
    var prefs = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || 'pt'];
    for (var i = 0; i < prefs.length; i++) {
      var c = String(prefs[i]).toLowerCase().slice(0, 2);
      if (LANGS.indexOf(c) >= 0) return c;
    }
    return 'pt';
  }
  mudar(inicial(), false);
})();
`;

export function paginaRelatorio(rel, itens, env, origem, perfil, agro) {
  const ag = blocosAgro(agro);   // plantio e recomendações (null quando não há)
  const p = perfil || {};
  const empresa = p.empresa || env.EMPRESA || 'AMVS';
  const cidade = p.cidade || env.CIDADE || '';
  const logo = p.logo || '';
  const tel = String(p.telefone || '').trim();
  const mail = String(p.email || '').trim();
  const contato = [
    tel ? `<a href="tel:${esc(tel.replace(/[^0-9+]/g, ''))}">${esc(tel)}</a>` : '',
    mail ? `<a href="mailto:${esc(mail)}">${esc(mail)}</a>` : ''
  ].filter(Boolean).join(' · ');
  let talhoes = null;
  try { talhoes = rel.talhoes ? JSON.parse(rel.talhoes) : null; } catch (e) {}

  const fotos = itens.filter(i => i.tipo === 'foto').length;
  const videos = itens.filter(i => i.tipo === 'video').length;
  const areaTotal = ((talhoes && talhoes.features) || []).reduce((s, f) => s + ((f.properties && f.properties.area_ha) || 0), 0);
  const capa = itens.find(i => i.tipo === 'foto' && i.midia);

  const grupos = agruparPorTalhao(itens, talhoes);

  // observações gerais (texto solto) sobem para logo depois do mapa
  const gNotas = grupos.filter(g => g.chave === '\u0000notas')[0];
  const notasTopo = (rel.observacoes ? `<div class="nota"><span data-tr>${esc(rel.observacoes)}</span></div>` : '') +
    (gNotas ? gNotas.itens.map(i => `<div class="nota">${rel._n > 1 ? `<b>${dataSpan(noFuso(i.capturado_em))}</b> · ` : ''}<span data-tr>${esc(i.legenda)}</span></div>`).join('') : '');
  const obsGerais = notasTopo ? `<h2 class="talhao"><span data-i="obs_gerais">Observações gerais</span></h2>${notasTopo}` : '';

  let corpo = '';
  grupos.filter(g => g.chave !== '\u0000notas').forEach(g => {
    const extra = [`<span data-i="reg" data-n="${g.itens.length}">${g.itens.length} registro(s)</span>`];
    if (g.area) extra.push(g.area.toFixed(1).replace('.', ',') + ' ha');
    const tituloG = g.chave === '\u0000fora' ? '<span data-i="fora">Fora dos talhões</span>' : esc(g.titulo);
    corpo += `<h2 class="talhao">${tituloG}<small>${extra.join(' · ')}</small></h2>`;
    if (ag && g.chave.charCodeAt(0) !== 0) corpo += ag.talhao(g.chave);

    // separa por dia quando o talhão foi visitado em mais de um dia
    const segmentos = [];
    g.itens.forEach(i => {
      const d = g.varioDia ? noFuso(i.capturado_em).slice(0, 10) : '';
      let seg = segmentos[segmentos.length - 1];
      if (!seg || seg.d !== d) { seg = { d, iso: d, lista: [] }; segmentos.push(seg); }
      seg.lista.push(i);
    });
    segmentos.forEach(seg => {
      if (g.varioDia) corpo += `<h3 class="dia" data-dia="${esc(seg.iso)}">${esc(diaLongo(seg.iso))}</h3>`;
      seg.lista.filter(i => i.tipo === 'texto').forEach(i => { corpo += `<div class="nota"><span data-tr>${esc(i.legenda)}</span></div>`; });
      corpo += blocoGrupos(seg.lista.filter(i => i.tipo !== 'texto'));
    });
  });

  const titulo = `${rel._n > 1 ? 'Relatório de ' + rel._n + ' visitas' : 'Relatório de visita'} — ${rel.fazenda || ''}`;
  const quando = (iso) => { const l = noFuso(iso); return l ? fmtData(l) + ' ' + l.slice(11, 16) : ''; };
  const pptDados = {
    titulo, empresa, cidade, logo, contato: [tel, mail].filter(Boolean).join(' · '),
    fazenda: rel.fazenda || 'Relatório de visita', servico: rel.servico || 'Relatório de visita técnica',
    produtor: rel.produtor || '', safra: safraPadrao(rel.safra) || '', responsavel: rel.responsavel || '',
    area: areaTotal ? areaTotal.toFixed(0) + ' ha mapeados' : '',
    periodo: rel.data_inicio ? fmtData(rel.data_inicio) + (rel.data_fim && rel.data_fim !== rel.data_inicio ? ' a ' + fmtData(rel.data_fim) : '') : '',
    publicado: rel.publicado_em ? fmtData(noFuso(rel.publicado_em)) : '',
    obs: [rel.observacoes].concat(gNotas ? gNotas.itens.map(i => i.legenda) : []).map(t => String(t || '').trim()).filter(Boolean),
    grupos: grupos.filter(g => g.chave !== '\u0000notas').map(g => ({
      titulo: g.chave === '\u0000fora' ? 'Fora dos talhões' : g.titulo,
      area: g.area ? g.area.toFixed(1).replace('.', ',') + ' ha' : '',
      itens: g.itens.filter(i => i.tipo === 'foto' || i.tipo === 'texto').map(i => ({
        tipo: i.tipo, legenda: String(i.legenda || '').trim(), quando: quando(i.capturado_em),
        src: i.tipo === 'foto' && i.midia ? '/img/' + encodeURIComponent(i.midia) : ''
      }))
    })),
    apl: (ag && ag.apl) || []
  };
  const descricao = [rel.servico, rel.produtor, `${fotos} fotos`, videos ? `${videos} vídeos` : null]
    .filter(Boolean).join(' · ');

  return `<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="#1B7A43">
<title>${esc(titulo)}</title>
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(descricao)}">
${capa ? `<meta property="og:image" content="${origem}/img/${encodeURIComponent(capa.midia)}?capa=1">` : ''}
<meta property="og:type" content="article">
<style>${CSS}${ag ? AGRO_REL_CSS : ''}</style>
</head><body data-n="${rel._n || 1}" data-fz="${esc(rel.fazenda || '')}"><div class="folha">
<header class="capa">
  <div class="marca">${logo
      ? `<img class="logo" src="${esc(logo)}" alt="">`
      : '<div class="logo">🌱</div>'}<div><b>${esc(empresa)}</b><span>${esc(cidade)}</span>${contato ? `<small>${contato}</small>` : ''}</div></div>
  <h1>${esc(rel.fazenda || 'Relatório de visita')}</h1>
  <p class="sub"${rel.servico ? ' data-tr' : ' data-i="sub_padrao"'}>${esc(rel.servico || 'Relatório de visita técnica')}</p>
</header>
<div class="barra-idioma" id="idiomas">
  <span aria-hidden="true">🌐</span>
  <button type="button" data-l="pt">Português</button>
  <button type="button" data-l="en">English</button>
  <button type="button" data-l="es">Español</button>
  <span class="aviso-trad" id="avisoTrad"></span>
</div>
<div class="painel">
  <div><span data-i="produtor">Produtor</span><b>${esc(rel.produtor || '—')}</b></div>
  <div><span data-i="safra">Safra</span><b>${esc(safraPadrao(rel.safra) || '—')}</b></div>
  <div><span data-i="periodo">Período</span><b>${dataSpan(rel.data_inicio)} – ${dataSpan(rel.data_fim)}</b></div>
  <div><span data-i="responsavel">Responsável</span><b>${esc(rel.responsavel || '—')}</b></div>
</div>
<div class="corpo">
  <div class="resumo">
    ${rel._n > 1 ? `<div><b>${rel._n}</b><span data-i="visitas">visitas</span></div>` : ''}
    <div><b>${areaTotal ? areaTotal.toFixed(0) : '—'}</b><span data-i="ha_map">hectares mapeados</span></div>
  </div>
  ${ag && ag.mapaVar ? '<details class="mapa-geral"><summary>Mapa geral da fazenda<small>fotos e vídeos</small></summary>' + mapaSVG(talhoes, itens) + '</details>' + ag.mapaVar : mapaSVG(talhoes, itens)}
  ${ag ? ag.evolucao : ''}
  ${obsGerais}
  ${corpo}
  ${ag ? ag.fim : ''}
  ${ag ? ag.topo : ''}
  ${mapaPontos(talhoes, itens)}
  <div style="text-align:center;margin:30px 0 10px;font-size:15px;color:#146034;font-weight:600" data-i="concluido">Serviço concluído ✔️</div>
</div>
<footer><b>${esc(empresa)}</b><br>${esc(cidade)}<br>${contato ? `<small>${contato}</small><br>` : ''}
<span style="font-size:11.5px"${rel.publicado_em ? ` data-i="publicado" data-d="${esc(noFuso(rel.publicado_em).slice(0, 10))}"` : ''}>${rel.publicado_em ? 'Publicado em ' + fmtData(noFuso(rel.publicado_em)) : ''}</span>
<div class="amvs"><span data-i="gerado_por">Gerado por</span> <b>AMVS Tecnologia</b> · Relatório de Campo<br>
<a href="https://wa.me/5565999189847">WhatsApp (65) 99918-9847</a> · <a href="mailto:amvsdiretoria@gmail.com">amvsdiretoria@gmail.com</a> · <a href="https://amvs.ia.br/amvs/">amvs.ia.br</a></div>
${BANDEIRA}</footer>
<div class="barra">
  <button class="sec" onclick="window.print()" data-i="pdf">Baixar PDF</button>
  <button class="sec" id="btnPpt" type="button">PowerPoint</button>
  <button data-i="compartilhar" onclick="if(navigator.share){navigator.share({title:document.title,url:location.href})}else{navigator.clipboard.writeText(location.href);alert(window.__t?window.__t('link_copiado'):'Link copiado')}">Compartilhar</button>
</div>
<script>
(function(){
  // baixar: o servidor devolve o arquivo como anexo; navegar até ele faz o navegador baixar (a página continua aberta)
  function direto(href){ location.href = href; }
  function fechar(v){ v.remove(); document.removeEventListener('keydown', tecla); }
  function tecla(e){
    var v=document.querySelector('.visor'); if(!v) return;
    if(e.key==='Escape') fechar(v);
    else if(e.key==='ArrowLeft') v._ir(-1);
    else if(e.key==='ArrowRight') v._ir(1);
  }
  document.addEventListener('click', function(e){
    var img = e.target.closest && e.target.closest('.item img');
    if(!img || document.querySelector('.visor')) return;
    var todas = Array.prototype.slice.call(document.querySelectorAll('.item img'));
    var i = Math.max(0, todas.indexOf(img));
    var v = document.createElement('div'); v.className = 'visor';
    function mk(tag, cls, txt){ var n=document.createElement(tag); if(cls) n.className=cls; if(txt) n.textContent=txt; return n; }
    var b = mk('button','x','✕'); b.type='button'; b.setAttribute('aria-label','Fechar');
    var ct = mk('div','cont');
    var bx = mk('button','dl'); bx.type='button'; bx.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v12m0 0l-5-5m5 5l5-5M5 20h14"/></svg>';
    var rot = (window.__t ? window.__t('baixar_midia') : 'Baixar'); bx.setAttribute('aria-label',rot); bx.title=rot;
    var ant = mk('button','nav ant','‹'); ant.type='button'; ant.setAttribute('aria-label','Foto anterior');
    var prox = mk('button','nav prox','›'); prox.type='button'; prox.setAttribute('aria-label','Próxima foto');
    var im = document.createElement('img'); im.alt = '';
    var l = mk('div','leg');
    v.appendChild(b); v.appendChild(bx); v.appendChild(ct); v.appendChild(ant); v.appendChild(prox); v.appendChild(im); v.appendChild(l);
    function mostrar(){
      var f = todas[i];
      v._file = null;
      var du = f.getAttribute('data-dl');
      if(du && window.fetch && window.File){
        fetch(du.split('?')[0]).then(function(r){ return r.blob(); }).then(function(bl){
          if(todas[i] !== f) return;
          var ext = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[bl.type] || 'jpg';
          var nm = decodeURIComponent((du.match(/[?&]n=([^&]*)/) || [])[1] || 'foto');
          v._file = {u: du, f: new File([bl], nm + '.' + ext, {type: bl.type})};
        }).catch(function(){});
      }
      im.src = f.currentSrc || f.src;
      var leg = f.getAttribute('alt') || '';
      l.textContent = leg; l.style.display = leg ? '' : 'none';
      ct.textContent = todas.length > 1 ? (i+1) + ' / ' + todas.length : '';
      ant.style.display = i > 0 ? '' : 'none';
      prox.style.display = i < todas.length-1 ? '' : 'none';
      [i-1,i+1].forEach(function(k){ if(todas[k]){ var p=new Image(); p.src = todas[k].currentSrc || todas[k].src; } });
    }
    v._ir = function(d){ var n=i+d; if(n<0||n>=todas.length) return; i=n; mostrar(); };
    v.addEventListener('click', function(ev){
      var t = ev.target;
      if(t.closest && t.closest('.dl')){
        var u=todas[i].getAttribute('data-dl'); if(!u) return;
        var pf=v._file, toque=window.matchMedia && window.matchMedia('(pointer:coarse)').matches;
        if(toque && pf && pf.u===u && navigator.canShare && navigator.canShare({files:[pf.f]})){
          navigator.share({files:[pf.f]}).catch(function(e){ if(!e || e.name!=='AbortError') direto(u); });
        } else direto(u);
        return;
      }
      if(t.closest && t.closest('.ant')){ v._ir(-1); return; }
      if(t.closest && t.closest('.prox')){ v._ir(1); return; }
      if(t.tagName !== 'IMG') fechar(v);
    });
    var x0=null, y0=0;
    v.addEventListener('touchstart', function(ev){
      var z = (window.visualViewport && window.visualViewport.scale) || 1;
      if(ev.touches.length===1 && z<=1.02){ x0=ev.touches[0].clientX; y0=ev.touches[0].clientY; } else x0=null;
    }, {passive:true});
    v.addEventListener('touchend', function(ev){
      if(x0==null) return;
      var t=ev.changedTouches[0], dx=t.clientX-x0, dy=t.clientY-y0; x0=null;
      if(Math.abs(dx)>50 && Math.abs(dx)>Math.abs(dy)*1.5) v._ir(dx<0?1:-1);
    }, {passive:true});
    document.addEventListener('keydown', tecla);
    document.body.appendChild(v);
    mostrar();
  });
})();
</script>
${ag ? '<script>' + AGRO_REL_JS + '</script>' : ''}
<script>${SCRIPT_IDIOMA.replace('__DICT__', () => JSON.stringify(DICT))}</script>
<script type="application/json" id="pptDados">${JSON.stringify(pptDados).replace(/</g, '\\u003c')}</script>
<script>${SCRIPT_PPT}</script>
</div></body></html>`;
}

export function paginaSimples(titulo, mensagem) {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titulo)}</title>
<style>${CSS}</style></head><body><div class="folha">
<header class="capa"><h1>${esc(titulo)}</h1></header>
<div class="corpo"><p style="font-size:15px;white-space:pre-wrap">${esc(mensagem)}</p></div>
</div></body></html>`;
}
