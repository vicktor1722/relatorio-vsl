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
header.capa .marca b{display:block;font-size:14.5px}
header.capa .marca span{font-size:11.5px;opacity:.85}
header.capa h1{margin:16px 0 2px;font-size:25px;line-height:1.2}
header.capa p.sub{margin:0;font-size:13.5px;opacity:.9}
.painel{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1px;background:var(--linha)}
.painel div{background:#fff;padding:12px 16px}
.painel span{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--fraco)}
.painel b{font-size:14.5px}
.corpo{padding:6px 18px 40px}
h2.dia{position:sticky;top:0;background:#fff;margin:26px 0 12px;padding:10px 0 8px;font-size:15px;
 color:var(--verde-escuro);border-bottom:2px solid var(--verde-claro);z-index:5}
h2.dia small{float:right;font-weight:400;color:var(--fraco);font-size:12px}
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
@media print{body{background:#fff}.folha{box-shadow:none;max-width:none}.barra{display:none}
 h2.dia{position:static}.item{break-inside:avoid}video{display:none}}
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

export function paginaRelatorio(rel, itens, env, origem) {
  const empresa = env.EMPRESA || 'VSL Consultoria';
  const cidade = env.CIDADE || '';
  let talhoes = null;
  try { talhoes = rel.talhoes ? JSON.parse(rel.talhoes) : null; } catch (e) {}

  const fotos = itens.filter(i => i.tipo === 'foto').length;
  const videos = itens.filter(i => i.tipo === 'video').length;
  const talhoesVisitados = new Set(itens.filter(i => i.talhao).map(i => i.talhao)).size;
  const areaTotal = ((talhoes && talhoes.features) || []).reduce((s, f) => s + ((f.properties && f.properties.area_ha) || 0), 0);
  const capa = itens.find(i => i.tipo === 'foto' && i.midia);

  const dias = {};
  itens.forEach(i => { const k = String(i.capturado_em).slice(0, 10); (dias[k] = dias[k] || []).push(i); });

  let corpo = '';
  Object.keys(dias).sort().forEach(k => {
    const lista = dias[k];
    corpo += `<h2 class="dia">${esc(diaLongo(lista[0].capturado_em))}<small>${lista.length} registro(s)</small></h2>`;
    lista.forEach(i => {
      if (i.tipo === 'texto') { corpo += `<div class="nota">${esc(i.legenda)}</div>`; return; }
      const src = '/img/' + encodeURIComponent(i.midia);
      corpo += `<div class="item"><figure>` +
        (i.tipo === 'foto'
          ? `<img loading="lazy" src="${src}" alt="${esc(i.legenda || '')}">`
          : `<video controls preload="metadata" playsinline src="${src}"></video>`) +
        `</figure><div class="meta">` +
        (i.talhao ? `<span class="tag">📍 ${esc(i.talhao)}</span>` : `<span class="tag cinza">📍 fora dos talhões</span>`) +
        `<span class="tag cinza">${hora(i.capturado_em)}</span>` +
        (i.lat != null ? `<span class="tag cinza">${i.lat.toFixed(5)}, ${i.lon.toFixed(5)}</span>` : '') +
        (i.precisao_m ? `<span class="tag cinza">±${Math.round(i.precisao_m)} m</span>` : '') +
        (i.tipo === 'video' && i.duracao_s ? `<span class="tag cinza">${Math.round(i.duracao_s)}s</span>` : '') +
        `</div>` +
        (i.legenda ? `<p class="legenda">${esc(i.legenda)}</p>` : '') +
        `</div>`;
    });
  });

  const titulo = `Relatório de visita — ${rel.fazenda || ''}`;
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
  <div class="marca"><div class="logo">🌱</div><div><b>${esc(empresa)}</b><span>${esc(cidade)}</span></div></div>
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
    <div><b>${fotos}</b><span>fotos</span></div>
    <div><b>${videos}</b><span>vídeos</span></div>
    <div><b>${talhoesVisitados}</b><span>talhões registrados</span></div>
    <div><b>${areaTotal ? areaTotal.toFixed(0) : '—'}</b><span>hectares mapeados</span></div>
  </div>
  ${rel.observacoes ? `<div class="nota">${esc(rel.observacoes)}</div>` : ''}
  ${mapaSVG(talhoes, itens)}
  ${corpo}
  <div style="text-align:center;margin:30px 0 10px;font-size:15px;color:#146034;font-weight:600">Serviço concluído ✔️</div>
</div>
<footer><b>${esc(empresa)}</b><br>${esc(cidade)}<br>
<span style="font-size:11.5px">${rel.publicado_em ? 'Publicado em ' + fmtData(rel.publicado_em) : ''}</span></footer>
<div class="barra">
  <button class="sec" onclick="window.print()">Baixar PDF</button>
  <button onclick="if(navigator.share){navigator.share({title:document.title,url:location.href})}else{navigator.clipboard.writeText(location.href);alert('Link copiado')}">Compartilhar</button>
</div>
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
