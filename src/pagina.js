/* ============================================================
   pagina.js — HTML do relatório público, renderizado no Worker
   (link abre sem JS, com prévia no WhatsApp e impressão em PDF)
   ============================================================ */

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
.grade img,.grade video{aspect-ratio:4/3;object-fit:cover;max-height:none}
.grade.n1 img,.grade.n1 video{aspect-ratio:auto;object-fit:contain;max-height:70vh}
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
.mapa svg{width:100%;height:auto;display:block;background:#F5F8F5;border-radius:8px}
.resumo{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin:14px 0 4px}
.resumo div{background:#F7F9F7;border:1px solid var(--linha);border-radius:10px;padding:10px 12px}
.resumo b{display:block;font-size:19px;color:var(--verde-escuro)}
.resumo span{font-size:11.5px;color:var(--fraco)}
footer{background:#F7F9F7;border-top:1px solid var(--linha);padding:20px;text-align:center;font-size:12.5px;color:var(--fraco)}
footer b{color:var(--verde-escuro)}
.barra{position:sticky;bottom:0;display:flex;gap:8px;padding:10px 16px;background:#fff;border-top:1px solid var(--linha)}
.barra button{flex:1;padding:11px;border:none;border-radius:9px;background:var(--verde);color:#fff;font-weight:600;font-size:14px}
.barra button.sec{background:#fff;color:var(--verde);border:1px solid var(--verde)}
.item img{cursor:zoom-in}
.visor{position:fixed;left:0;right:0;top:0;height:100vh;height:100dvh;z-index:90;background:rgba(0,0,0,.96);
 display:flex;align-items:center;justify-content:center}
.visor img{max-width:100%;max-height:100%;object-fit:contain;touch-action:pinch-zoom}
.visor .x{position:absolute;top:calc(12px + env(safe-area-inset-top));left:12px;z-index:2;width:44px;height:44px;border-radius:50%;
 background:rgba(255,255,255,.18);color:#fff;font-size:22px;line-height:44px;text-align:center;border:0;cursor:pointer}
.visor .leg{position:absolute;left:0;right:0;bottom:0;padding:28px 16px calc(18px + env(safe-area-inset-bottom));color:#fff;
 font-size:15px;text-align:center;background:linear-gradient(transparent,rgba(0,0,0,.7));pointer-events:none}
.visor .cont{position:absolute;top:calc(22px + env(safe-area-inset-top));right:14px;z-index:2;color:#fff;font-size:14px;font-weight:600;
 background:rgba(255,255,255,.18);border-radius:14px;padding:4px 12px;pointer-events:none}
.visor .cont:empty{display:none}
.visor .nav{position:absolute;top:50%;transform:translateY(-50%);z-index:2;width:46px;height:64px;border:0;background:rgba(255,255,255,.18);
 color:#fff;font-size:34px;line-height:60px;text-align:center;padding:0;cursor:pointer}
.visor .nav.ant{left:0;border-radius:0 12px 12px 0}
.visor .nav.prox{right:0;border-radius:12px 0 0 12px}
@media print{.visor{display:none}}
@media print{body{background:#fff}.folha{box-shadow:none;max-width:none}.barra{display:none}
 h2.talhao{position:static;break-after:avoid}.item,.grupo{break-inside:avoid}video{display:none}}
`;

function fmtData(d) {
  if (!d) return '—';
  const p = String(d).slice(0, 10).split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
}
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

function diaLongo(iso) {
  const d = new Date(iso);
  return `${DIAS[d.getUTCDay()]}, ${String(d.getUTCDate()).padStart(2, '0')} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}
function hora(iso) {
  const d = new Date(iso);
  return String(d.getUTCHours() - 4 < 0 ? d.getUTCHours() + 20 : d.getUTCHours() - 4).padStart(2, '0') + ':' +
         String(d.getUTCMinutes()).padStart(2, '0');   // UTC-4 (Mato Grosso)
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
  });
  itens.filter(i => i.lat != null).forEach(i => {
    s += `<circle cx="${px(i.lon).toFixed(1)}" cy="${py(i.lat).toFixed(1)}" r="7" fill="${i.tipo === 'video' ? '#D93025' : '#1B7A43'}" stroke="#fff" stroke-width="2.5"/>`;
  });
  s += '</svg>';
  return `<div class="mapa">${s}<div style="font-size:11.5px;color:#6B7B72;margin-top:8px">🟢 fotos · 🔴 vídeos · polígonos do KML da fazenda</div></div>`;
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
    const chave = i.talhao ? i.talhao : (i.tipo === 'texto' ? '\u0000notas' : '\u0000fora');
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
      lista.forEach(i => { dias[String(i.capturado_em).slice(0, 10)] = 1; });
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
  return `<div class="item"><figure>` +
    (i.tipo === 'foto'
      ? `<img loading="lazy" src="${src}" alt="${esc(i.legenda || '')}">`
      : `<video controls preload="metadata" playsinline src="${src}"></video>`) +
    `</figure><div class="meta">` +
    `<span class="tag cinza">${hora(i.capturado_em)}</span>` +
    (i.lat != null ? `<span class="tag cinza">${i.lat.toFixed(5)}, ${i.lon.toFixed(5)}</span>` : '') +
    (i.precisao_m ? `<span class="tag cinza">±${Math.round(i.precisao_m)} m</span>` : '') +
    (i.tipo === 'video' && i.duracao_s ? `<span class="tag cinza">${Math.round(i.duracao_s)}s</span>` : '') +
    `</div></div>`;
}

// cada grupo vira um cartão: fotos em grade e a legenda logo abaixo (como no modelo de referência)
function blocoGrupos(midias) {
  return gruposDeLegenda(midias).map(g => {
    const n = g.itens.length;
    return `<div class="grupo"><div class="grade n${Math.min(n, 3)}">${g.itens.map(celulaMidia).join('')}</div>` +
      (g.titulo ? `<p class="grupo-leg">${esc(g.titulo)}</p>` : '') + `</div>`;
  }).join('');
}

/* Junta várias visitas já publicadas (mesma conta) em um único relatório para o cliente. */
export function juntarRelatorios(rels) {
  const lista = rels.slice().sort((a, b) =>
    String(a.data_inicio || a.criado_em).localeCompare(String(b.data_inicio || b.criado_em)));
  const unicos = (campo, sep) => [...new Set(lista.map(r => String(r[campo] || '').trim()).filter(Boolean))].join(sep);
  const datas = lista.map(r => String(r.data_inicio || r.criado_em || '').slice(0, 10)).filter(Boolean);
  const fins = lista.map(r => String(r.data_fim || r.data_inicio || r.criado_em || '').slice(0, 10)).filter(Boolean);

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

export function paginaRelatorio(rel, itens, env, origem, perfil) {
  const p = perfil || {};
  const empresa = p.empresa || env.EMPRESA || 'VSL Consultoria';
  const cidade = p.cidade || env.CIDADE || '';
  const logo = p.logo || '';
  let talhoes = null;
  try { talhoes = rel.talhoes ? JSON.parse(rel.talhoes) : null; } catch (e) {}

  const fotos = itens.filter(i => i.tipo === 'foto').length;
  const videos = itens.filter(i => i.tipo === 'video').length;
  const talhoesVisitados = new Set(itens.filter(i => i.talhao).map(i => i.talhao)).size;
  const areaTotal = ((talhoes && talhoes.features) || []).reduce((s, f) => s + ((f.properties && f.properties.area_ha) || 0), 0);
  const capa = itens.find(i => i.tipo === 'foto' && i.midia);

  const grupos = agruparPorTalhao(itens, talhoes);

  // observações gerais (texto solto) sobem para logo depois do mapa
  const gNotas = grupos.filter(g => g.chave === '\u0000notas')[0];
  const notasTopo = (rel.observacoes ? `<div class="nota">${esc(rel.observacoes)}</div>` : '') +
    (gNotas ? gNotas.itens.map(i => `<div class="nota">${rel._n > 1 ? `<b>${fmtData(i.capturado_em)}</b> · ` : ''}${esc(i.legenda)}</div>`).join('') : '');
  const obsGerais = notasTopo ? `<h2 class="talhao">Observações gerais</h2>${notasTopo}` : '';

  let corpo = '';
  grupos.filter(g => g.chave !== '\u0000notas').forEach(g => {
    const extra = [g.itens.length + ' registro(s)'];
    if (g.area) extra.push(g.area.toFixed(1).replace('.', ',') + ' ha');
    corpo += `<h2 class="talhao">${esc(g.titulo)}<small>${extra.join(' · ')}</small></h2>`;

    // separa por dia quando o talhão foi visitado em mais de um dia
    const segmentos = [];
    g.itens.forEach(i => {
      const d = g.varioDia ? String(i.capturado_em).slice(0, 10) : '';
      let seg = segmentos[segmentos.length - 1];
      if (!seg || seg.d !== d) { seg = { d, iso: i.capturado_em, lista: [] }; segmentos.push(seg); }
      seg.lista.push(i);
    });
    segmentos.forEach(seg => {
      if (g.varioDia) corpo += `<h3 class="dia">${esc(diaLongo(seg.iso))}</h3>`;
      seg.lista.filter(i => i.tipo === 'texto').forEach(i => { corpo += `<div class="nota">${esc(i.legenda)}</div>`; });
      corpo += blocoGrupos(seg.lista.filter(i => i.tipo !== 'texto'));
    });
  });

  const titulo = `${rel._n > 1 ? 'Relatório de ' + rel._n + ' visitas' : 'Relatório de visita'} — ${rel.fazenda || ''}`;
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
${capa ? `<meta property="og:image" content="${origem}/img/${encodeURIComponent(capa.midia)}">` : ''}
<meta property="og:type" content="article">
<style>${CSS}</style>
</head><body><div class="folha">
<header class="capa">
  <div class="marca">${logo
      ? `<img class="logo" src="${esc(logo)}" alt="">`
      : '<div class="logo">🌱</div>'}<div><b>${esc(empresa)}</b><span>${esc(cidade)}</span></div></div>
  <h1>${esc(rel.fazenda || 'Relatório de visita')}</h1>
  <p class="sub">${esc(rel.servico || 'Relatório de visita técnica')}</p>
</header>
<div class="painel">
  <div><span>Produtor</span><b>${esc(rel.produtor || '—')}</b></div>
  <div><span>Safra</span><b>${esc(rel.safra || '—')}</b></div>
  <div><span>Período</span><b>${fmtData(rel.data_inicio)} – ${fmtData(rel.data_fim)}</b></div>
  <div><span>Responsável</span><b>${esc(rel.responsavel || '—')}</b></div>
</div>
<div class="corpo">
  <div class="resumo">
    ${rel._n > 1 ? `<div><b>${rel._n}</b><span>visitas</span></div>` : ''}
    <div><b>${fotos}</b><span>fotos</span></div>
    <div><b>${videos}</b><span>vídeos</span></div>
    <div><b>${talhoesVisitados}</b><span>talhões registrados</span></div>
    <div><b>${areaTotal ? areaTotal.toFixed(0) : '—'}</b><span>hectares mapeados</span></div>
  </div>
  ${mapaSVG(talhoes, itens)}
  ${obsGerais}
  ${corpo}
  <div style="text-align:center;margin:30px 0 10px;font-size:15px;color:#146034;font-weight:600">Serviço concluído ✔️</div>
</div>
<footer><b>${esc(empresa)}</b><br>${esc(cidade)}<br>
<span style="font-size:11.5px">${rel.publicado_em ? 'Publicado em ' + fmtData(rel.publicado_em) : ''}</span></footer>
<div class="barra">
  <button class="sec" onclick="window.print()">Baixar PDF</button>
  <button onclick="if(navigator.share){navigator.share({title:document.title,url:location.href})}else{navigator.clipboard.writeText(location.href);alert('Link copiado')}">Compartilhar</button>
</div>
<script>
(function(){
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
    var ant = mk('button','nav ant','‹'); ant.type='button'; ant.setAttribute('aria-label','Foto anterior');
    var prox = mk('button','nav prox','›'); prox.type='button'; prox.setAttribute('aria-label','Próxima foto');
    var im = document.createElement('img'); im.alt = '';
    var l = mk('div','leg');
    v.appendChild(b); v.appendChild(ct); v.appendChild(ant); v.appendChild(prox); v.appendChild(im); v.appendChild(l);
    function mostrar(){
      var f = todas[i];
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
