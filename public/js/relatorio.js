/* ============================================================
   relatorio.js — tela do relatório pronto (o que o link abre)
   ============================================================ */
(function (global) {
  'use strict';

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

  const fmtData = d => {
    if (!d) return '—';
    const p = String(d).slice(0, 10).split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
  };
  const diaLongo = iso => {
    const d = new Date(iso);
    return `${DIAS[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
  };
  const hora = iso => {
    const d = new Date(iso);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  };

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
      s += `<text x="${px(sx / n).toFixed(1)}" y="${py(sy / n).toFixed(1)}" font-size="19" font-weight="600" fill="#146034" text-anchor="middle" font-family="sans-serif">${esc((f.properties || {}).nome || '')}</text>`;
    });
    itens.filter(i => i.lat != null).forEach(i => {
      s += `<circle cx="${px(i.lon).toFixed(1)}" cy="${py(i.lat).toFixed(1)}" r="7" fill="${i.tipo === 'video' ? '#D93025' : '#1B7A43'}" stroke="#fff" stroke-width="2.5"/>`;
    });
    s += '</svg>';
    return `<div class="rp-mapa">${s}<div class="rp-obs">🟢 fotos · 🔴 vídeos · polígonos do KML da fazenda</div></div>`;
  }

  /* Agrupa os registros por talhão, na ordem em que os talhões vêm do KML.
     Registros fora dos talhões e observações soltas entram no fim. */
  function agruparPorTalhao(itens, talhoes) {
    const ordem = {}, areas = {};
    ((talhoes && talhoes.features) || []).forEach(function (f, i) {
      const p = f.properties || {};
      if (p.nome) { ordem[p.nome] = i; areas[p.nome] = p.area_ha || 0; }
    });

    const mapa = {};
    itens.forEach(function (i) {
      const chave = i.talhao ? i.talhao : (i.tipo === 'texto' ? '\u0000notas' : '\u0000fora');
      (mapa[chave] = mapa[chave] || []).push(i);
    });

    const chaves = Object.keys(mapa).sort(function (a, b) {
      const pa = a.charCodeAt(0) === 0 ? 1e6 + (a === '\u0000notas' ? 1 : 0) : (ordem[a] != null ? ordem[a] : 1e5);
      const pb = b.charCodeAt(0) === 0 ? 1e6 + (b === '\u0000notas' ? 1 : 0) : (ordem[b] != null ? ordem[b] : 1e5);
      return pa - pb || a.localeCompare(b);
    });

    return chaves.map(function (k) {
      const lista = mapa[k].slice().sort(function (a, b) {
        return String(a.capturado_em).localeCompare(String(b.capturado_em));
      });
      const diasDistintos = {};
      lista.forEach(function (i) { diasDistintos[String(i.capturado_em).slice(0, 10)] = 1; });
      return {
        chave: k,
        titulo: k === '\u0000notas' ? 'Observações gerais' : k === '\u0000fora' ? 'Fora dos talhões' : k,
        area: areas[k] || 0,
        varioDia: Object.keys(diasDistintos).length > 1,
        itens: lista
      };
    });
  }


  /* Dentro de um talhão: junta os registros que têm a mesma legenda num grupo só
     (comparação sem diferenciar maiúsculas/espaços), na ordem em que aparecem. */
  const normLeg = s => String(s == null ? '' : s).trim().replace(/\s+/g, ' ').toLowerCase();
  function gruposDeLegenda(lista) {
    const ordem = [], mapa = {};
    lista.forEach(function (i) {
      const k = normLeg(i.legenda);
      if (!mapa[k]) { mapa[k] = { titulo: String(i.legenda || '').trim(), itens: [] }; ordem.push(k); }
      mapa[k].itens.push(i);
    });
    return ordem.map(function (k) { return mapa[k]; });
  }

  function celulaMidia(i) {
    const src = i.src || (i.asset_id ? '/_blob/' + i.asset_id : '');
    return `<div class="rp-item"><figure>` +
      (i.tipo === 'foto'
        ? `<img loading="lazy" src="${src}" alt="${esc(i.legenda || '')}">`
        : `<video controls preload="metadata" playsinline src="${src}"></video>`) +
      `</figure><div class="rp-meta">` +
      `<span class="rp-tag cinza">${hora(i.capturado_em)}</span>` +
      (i.lat != null ? `<span class="rp-tag cinza">${Number(i.lat).toFixed(5)}, ${Number(i.lon).toFixed(5)}</span>` : '') +
      (i.precisao_m ? `<span class="rp-tag cinza">±${Math.round(i.precisao_m)} m</span>` : '') +
      (i.tipo === 'video' && i.duracao_s ? `<span class="rp-tag cinza">${Math.round(i.duracao_s)}s</span>` : '') +
      `</div></div>`;
  }

  // cada grupo vira um cartão: fotos em grade e a legenda logo abaixo (como no modelo de referência)
  function blocoGrupos(midias) {
    return gruposDeLegenda(midias).map(function (g) {
      const n = g.itens.length;
      return `<div class="rp-grupo"><div class="rp-grade n${Math.min(n, 2)}">${g.itens.map(celulaMidia).join('')}</div>` +
        (g.titulo ? `<p class="rp-grupo-leg">${esc(g.titulo)}</p>` : '') + `</div>`;
    }).join('');
  }

  function montar(rel, itens, opcoes) {
    const o = opcoes || {};
    const empresa = o.empresa || 'VSL Consultoria e Treinamento na Agricultura';
    const cidade = o.cidade || 'Pontes e Lacerda · MT';
    const logo = o.logo || '';
    const fotos = itens.filter(i => i.tipo === 'foto').length;
    const videos = itens.filter(i => i.tipo === 'video').length;
    const nTalhoes = new Set(itens.filter(i => i.talhao).map(i => i.talhao)).size;
    const area = ((rel.talhoes && rel.talhoes.features) || []).reduce((s, f) => s + ((f.properties || {}).area_ha || 0), 0);

    // ---- agrupado por talhão (ordem do KML) ----
    const grupos = agruparPorTalhao(itens, rel.talhoes);

    // observações gerais (texto solto) sobem para logo depois do mapa
    const gNotas = grupos.filter(g => g.chave === '\u0000notas')[0];
    const notasTopo = (rel.observacoes ? `<div class="rp-nota">${esc(rel.observacoes)}</div>` : '') +
      (gNotas ? gNotas.itens.map(i => `<div class="rp-nota">${esc(i.legenda)}</div>`).join('') : '');
    const obsGerais = notasTopo
      ? `<h3 class="rp-talhao">Observações gerais</h3>${notasTopo}` : '';

    let corpo = '';
    grupos.filter(g => g.chave !== '\u0000notas').forEach(g => {
      const extra = [g.itens.length + ' registro(s)'];
      if (g.area) extra.push(g.area.toFixed(1).replace('.', ',') + ' ha');
      corpo += `<h3 class="rp-talhao">${esc(g.titulo)}<small>${extra.join(' · ')}</small></h3>`;

      // separa por dia quando o talhão foi visitado em mais de um dia
      const segmentos = [];
      g.itens.forEach(i => {
        const d = g.varioDia ? String(i.capturado_em).slice(0, 10) : '';
        let seg = segmentos[segmentos.length - 1];
        if (!seg || seg.d !== d) { seg = { d: d, iso: i.capturado_em, lista: [] }; segmentos.push(seg); }
        seg.lista.push(i);
      });
      segmentos.forEach(seg => {
        if (g.varioDia) corpo += `<h4 class="rp-dia">${esc(diaLongo(seg.iso))}</h4>`;
        seg.lista.filter(i => i.tipo === 'texto').forEach(i => { corpo += `<div class="rp-nota">${esc(i.legenda)}</div>`; });
        corpo += blocoGrupos(seg.lista.filter(i => i.tipo !== 'texto'));
      });
    });

    return `<div class="rp-folha">
  <header class="rp-capa">
    <div class="rp-marca">${logo ? '<img class="rp-logo-img" src="' + esc(logo) + '" alt="">' : '<div class="rp-logo">🌱</div>'}<div><b>${esc(empresa)}</b><span>${esc(cidade)}</span></div></div>
    <h1>${esc(rel.fazenda || 'Relatório de visita')}</h1>
    <p>${esc(rel.servico || 'Relatório de visita técnica')}</p>
  </header>
  <div class="rp-painel">
    <div><span>Produtor</span><b>${esc(rel.produtor || '—')}</b></div>
    <div><span>Safra</span><b>${esc(rel.safra || '—')}</b></div>
    <div><span>Período</span><b>${fmtData(rel.data_inicio)} – ${fmtData(rel.data_fim)}</b></div>
    <div><span>Responsável</span><b>${esc(rel.responsavel || '—')}</b></div>
  </div>
  <div class="rp-corpo">
    <div class="rp-resumo">
      <div><b>${fotos}</b><span>fotos</span></div>
      <div><b>${videos}</b><span>vídeos</span></div>
      <div><b>${nTalhoes}</b><span>talhões</span></div>
      <div><b>${area ? area.toFixed(0) : '—'}</b><span>hectares</span></div>
    </div>
    ${mapaSVG(rel.talhoes, itens)}
    ${obsGerais}
    ${corpo || '<div class="aviso">Nenhum registro neste relatório.</div>'}
    <div class="rp-fim">Serviço concluído ✔️</div>
  </div>
  <footer class="rp-rodape"><b>${esc(empresa)}</b><br>${esc(cidade)}
    ${rel.publicado_em ? '<br><span>Publicado em ' + fmtData(rel.publicado_em) + '</span>' : ''}</footer>
</div>`;
  }


  /* Toque na foto: abre só ela em tela cheia, com ✕ para voltar ao relatório. */
  function abrirImagem(src, legenda) {
    if (!src || document.querySelector('.visor-rel')) return;
    const v = document.createElement('div');
    v.className = 'visor visor-rel';
    v.innerHTML = '<button class="visor-x" type="button" aria-label="Fechar">✕</button>' +
      '<img src="' + esc(src) + '" alt="">' +
      (legenda ? '<div class="visor-leg">' + esc(legenda) + '</div>' : '');
    function fechar() { v.remove(); document.removeEventListener('keydown', tecla); }
    function tecla(e) { if (e.key === 'Escape') fechar(); }
    v.addEventListener('click', function (e) { if (e.target.tagName !== 'IMG') fechar(); });
    document.addEventListener('keydown', tecla);
    document.body.appendChild(v);
  }
  document.addEventListener('click', function (e) {
    const img = e.target && e.target.closest ? e.target.closest('.rp-item img') : null;
    if (img) abrirImagem(img.currentSrc || img.src, img.getAttribute('alt') || '');
  });

  global.Relatorio = { montar };
})(window);
