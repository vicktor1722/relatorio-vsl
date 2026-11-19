/* ============================================================
   exportachuva.js — exporta o mapa da chuva dia a dia em vídeo (MP4/WebM) ou GIF
   Usado no portal da fazenda, no painel e no app de campo (só na tela cheia, ícone pequeno).
   ExportaChuva.abrir({ mapa, cont, canvas, desenhar(t), restaurar(), n, datas, local, atualizado, pontos })
   - mapa: mapa Leaflet já aberto (o enquadramento da tela é o do vídeo)
   - cont: elemento do mapa; canvas: camada da chuva; desenhar(t): desenha o dia t (fração = transição)
   Cada quadro: título e data no topo, mapa com a chuva, escala de cores e o logo AMVS embaixo.
   O código entra em outras páginas por ${...}: aqui não pode ter crase nem "${".
   ============================================================ */
export const EXPORTA_CHUVA_JS = String.raw`
var ExportaChuva = (function () {
  var GIFENC = 'https://cdn.jsdelivr.net/npm/gifenc@1.0.3/dist/gifenc.esm.js';
  var ESC = [[0, '#BDBDBD'], [8, '#9BE29B'], [16, '#2EAA3C'], [24, '#0B6B2B'], [32, '#1E3FD8'], [40, '#2E7BFF'], [48, '#8FD6FF'], [56, '#F7F3C2'], [64, '#FFB000'], [72, '#FF6A00'], [80, '#E31A1C'], [88, '#FFB3D9'], [100, '#8E5CFF']];
  var ROT = [['<1', 0], ['10', 16], ['17', 32], ['30', 48], ['50', 64], ['120', 80], ['270+ mm', 100]];
  // tempo de cada dia: fica parado mostrando o dia e depois passa devagar para o próximo
  var PARADO = 800, TRANS = 700, SEG_DIA = PARADO + TRANS, FIM = 1800;
  function suave(x) { return x * x * (3 - 2 * x); }
  function tempoDia(e, dias) {   // milissegundos desde o começo → dia (com fração na passagem)
    var k = Math.floor(e / SEG_DIA), r = e - k * SEG_DIA;
    if (k >= dias - 1) return dias - 1;
    return r < PARADO ? k : k + suave((r - PARADO) / TRANS);
  }
  var cssPronto = false;
  function css() {
    if (cssPronto) return; cssPronto = true;
    var s = document.createElement('style');
    s.textContent = '.ex-fundo{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif}' +
      '.ex-cx{background:#fff;color:#1B2B22;width:100%;max-width:440px;max-height:92vh;overflow:auto;border-radius:18px 18px 0 0;padding:16px 16px calc(16px + env(safe-area-inset-bottom,0px))}' +
      '@media(min-width:700px){.ex-fundo{align-items:center}.ex-cx{border-radius:16px}}' +
      '.ex-cab{display:flex;justify-content:space-between;align-items:center}.ex-cab b{font-size:17px}.ex-x{border:0;background:#EEF1EF;width:34px;height:34px;border-radius:50%;font-size:15px;cursor:pointer}' +
      '.ex-p{font-size:12.5px;color:#6B7B72;margin:4px 0 6px}.ex-lab{font-size:12px;color:#6B7B72;font-weight:700;margin:12px 0 6px}' +
      '.ex-op{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ex-op button{text-align:left;border:1px solid #D5DDD9;background:#fff;border-radius:10px;padding:9px 10px;font-size:12.5px;color:#4A5A51;cursor:pointer}' +
      '.ex-op button b{display:block;font-size:14px;color:#1B2B22}.ex-op button.on{border:2px solid #1B7A43;background:#EEF7F1}' +
      '.ex-go{display:block;width:100%;margin-top:14px;border:0;background:#1B7A43;color:#fff;border-radius:10px;padding:12px;font-size:15px;font-weight:700;cursor:pointer}.ex-go[disabled]{opacity:.6}.ex-go[hidden]{display:none}' +
      '.ex-sec{display:block;width:100%;margin-top:8px;border:1px solid #1B7A43;background:#fff;color:#1B7A43;border-radius:10px;padding:10px;font-size:14px;font-weight:700;text-align:center;text-decoration:none;cursor:pointer}' +
      '.ex-pr{margin-top:14px;font-size:13px}.ex-pb{height:8px;background:#E6EBE8;border-radius:5px;margin-top:6px;overflow:hidden}.ex-pb i{display:block;height:100%;width:0;background:#1B7A43;transition:width .2s}' +
      '.ex-prev{margin-top:12px;border-radius:10px;overflow:hidden;background:#0B1F14;text-align:center}.ex-prev video,.ex-prev img{max-width:100%;max-height:46vh;display:block;margin:0 auto}' +
      '.ex-err{margin-top:10px;color:#C62828;font-size:13px}.ex-nota{font-size:11.5px;color:#6B7B72;margin-top:8px}';
    document.head.appendChild(s);
  }
  function br(d) { return d ? d.slice(8, 10) + '/' + d.slice(5, 7) : ''; }
  function ret(el, b) { var r = el.getBoundingClientRect(); return { x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height }; }
  // desenha os caminhos do SVG do Leaflet (divisas e pontos) num canvas, sem transformar o SVG em imagem
  function svgNoCanvas(ctx, svg, b) {
    var vb = svg.viewBox && svg.viewBox.baseVal, r = ret(svg, b);
    if (!r.w || !r.h) return;
    var vw = vb && vb.width ? vb.width : r.w, sx = r.w / vw;
    ctx.save(); ctx.translate(r.x, r.y); ctx.scale(sx, sx); if (vb && vb.width) ctx.translate(-vb.x, -vb.y);
    var ps = svg.querySelectorAll('path');
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i], d = p.getAttribute('d'); if (!d) continue;
      var P; try { P = new Path2D(d); } catch (e) { continue; }
      var fi = p.getAttribute('fill'), sk = p.getAttribute('stroke');
      if (fi && fi !== 'none') { ctx.globalAlpha = Number(p.getAttribute('fill-opacity') || 1); ctx.fillStyle = fi; ctx.fill(P, p.getAttribute('fill-rule') === 'evenodd' ? 'evenodd' : 'nonzero'); }
      if (sk && sk !== 'none') { ctx.globalAlpha = Number(p.getAttribute('stroke-opacity') || 1); ctx.strokeStyle = sk; ctx.lineWidth = Number(p.getAttribute('stroke-width') || 1); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(P); }
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }
  // fotos do mapa (satélite embaixo; divisas e nomes por cima), na posição em que estão na tela
  function camada(o, W, H, k, qual) {
    var c = document.createElement('canvas'); c.width = Math.round(W * k); c.height = Math.round(H * k);
    var ctx = c.getContext('2d'); ctx.scale(k, k);
    var b = o.cont.getBoundingClientRect(), panes = o.mapa.getPanes(), pane = qual === 'base' ? panes.tilePane : o.mapa.getPane('limites');
    if (pane) {
      var ims = pane.querySelectorAll('img');
      for (var i = 0; i < ims.length; i++) {
        var im = ims[i]; if (!im.complete || !im.naturalWidth) continue;
        var r = ret(im, b); ctx.globalAlpha = Number(getComputedStyle(im).opacity || 1);
        try { ctx.drawImage(im, r.x, r.y, r.w, r.h); } catch (e) { /* foto que não deixa copiar: fica de fora */ }
      }
      ctx.globalAlpha = 1;
    }
    if (qual !== 'base') {
      var svgs = o.cont.querySelectorAll('svg');
      for (var j = 0; j < svgs.length; j++) svgNoCanvas(ctx, svgs[j], b);
      (o.pontos || []).forEach(function (p) {
        if (!p || !p.lat || !p.nome) return;
        var q = o.mapa.latLngToContainerPoint([p.lat, p.lon]);
        ctx.font = '700 13px system-ui,-apple-system,Segoe UI,Arial,sans-serif'; ctx.textAlign = 'center';
        var tw = ctx.measureText(p.nome).width;
        ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(q.x - tw / 2 - 6, q.y - 32, tw + 12, 20, 6); else ctx.rect(q.x - tw / 2 - 6, q.y - 32, tw + 12, 20); ctx.fill();
        ctx.fillStyle = '#12261B'; ctx.fillText(p.nome, q.x, q.y - 17);
      });
    }
    return c;
  }
  // logo AMVS (ícone do app), o mesmo selo dos mapas
  var LOGO = null;
  function carregarLogo() {
    return new Promise(function (ok) {
      if (LOGO) { ok(LOGO); return; }
      var im = new Image(); im.onload = function () { LOGO = im; ok(im); }; im.onerror = function () { ok(null); };
      im.src = '/icon-192.png';
    });
  }
  function montador(o) {
    var b = o.cont.getBoundingClientRect(), W = Math.max(1, b.width), H = Math.max(1, b.height), k = Math.min(2, window.devicePixelRatio || 1);
    var base = camada(o, W, H, k, 'base'), topo = camada(o, W, H, k, 'topo');
    var OW = 720, HEAD = 112, FOOT = 132;
    var MH = Math.round(Math.max(520, Math.min(1000, OW * H / W)) / 2) * 2, OH = HEAD + MH + FOOT;
    var out = document.createElement('canvas'); out.width = OW; out.height = OH;
    var mc = document.createElement('canvas'); mc.width = base.width; mc.height = base.height;
    var cx = out.getContext('2d'), mx = mc.getContext('2d'), filtro = 'filter' in mx;
    // recorte do mapa que cabe no quadro (preenche, cortando o que sobra do lado mais comprido)
    var esc = Math.max(OW / W, MH / H), sw = OW / esc, sh = MH / esc, sx = (W - sw) / 2, sy = (H - sh) / 2;
    var fonte = 'system-ui,-apple-system,Segoe UI,Arial,sans-serif';
    function quadro(t) {
      o.desenhar(t);
      mx.setTransform(1, 0, 0, 1, 0, 0); mx.clearRect(0, 0, mc.width, mc.height); mx.drawImage(base, 0, 0);
      var r = ret(o.canvas, b);
      mx.save(); mx.scale(k, k); if (filtro) mx.filter = 'blur(2px) saturate(1.35) contrast(1.08)';
      try { mx.drawImage(o.canvas, r.x, r.y, r.w, r.h); } catch (e) {}
      mx.restore(); mx.drawImage(topo, 0, 0);
      cx.fillStyle = '#0B1F14'; cx.fillRect(0, 0, OW, OH);
      cx.drawImage(mc, sx * k, sy * k, sw * k, sh * k, 0, HEAD, OW, MH);
      var di = Math.min(o.n - 1, Math.round(t));
      cx.fillStyle = '#FFFFFF'; cx.textAlign = 'left'; cx.font = '800 32px ' + fonte; cx.fillText('🌧️ Chuva prevista no dia', 24, 50);
      cx.textAlign = 'right'; cx.font = '800 50px ' + fonte; cx.fillText(br(o.datas[di]), OW - 24, 58);
      cx.textAlign = 'left'; cx.font = '500 19px ' + fonte; cx.fillStyle = 'rgba(255,255,255,.85)';
      cx.fillText((o.local ? '📍 ' + o.local + ' · ' : '') + 'Modelo europeu (ECMWF)', 24, 92);
      var y = HEAD + MH + 22, gx = 24, gw = OW - 48, g = cx.createLinearGradient(gx, 0, gx + gw, 0);
      ESC.forEach(function (e) { g.addColorStop(e[0] / 100, e[1]); });
      cx.fillStyle = g; cx.beginPath(); if (cx.roundRect) cx.roundRect(gx, y, gw, 16, 5); else cx.rect(gx, y, gw, 16); cx.fill();
      cx.font = '500 16px ' + fonte; cx.fillStyle = 'rgba(255,255,255,.85)';
      ROT.forEach(function (e, i) { cx.textAlign = i === 0 ? 'left' : i === ROT.length - 1 ? 'right' : 'center'; cx.fillText(e[0], gx + gw * e[1] / 100, y + 40); });
      cx.textAlign = 'left'; cx.font = '500 16px ' + fonte; cx.fillStyle = 'rgba(255,255,255,.7)';
      if (o.atualizado) cx.fillText('atualizado ' + o.atualizado, 24, OH - 26);
      cx.font = '800 24px ' + fonte; var tw = cx.measureText('AMVS').width + 3, lw = tw + (LOGO ? 66 : 28), lx = OW - 18 - lw, ly = HEAD + MH - 18 - 52;   // dentro do mapa, canto de baixo à direita
      cx.save(); cx.shadowColor = 'rgba(0,0,0,.35)'; cx.shadowBlur = 8; cx.shadowOffsetY = 1; cx.fillStyle = 'rgba(255,255,255,.96)'; cx.beginPath(); if (cx.roundRect) cx.roundRect(lx, ly, lw, 52, 12); else cx.rect(lx, ly, lw, 52); cx.fill(); cx.restore();
      var tx0 = lx + 14; if (LOGO) { cx.save(); cx.beginPath(); if (cx.roundRect) cx.roundRect(lx + 7, ly + 7, 38, 38, 9); else cx.rect(lx + 7, ly + 7, 38, 38); cx.clip(); try { cx.drawImage(LOGO, lx + 7, ly + 7, 38, 38); } catch (e) {} cx.restore(); tx0 = lx + 53; }
      cx.fillStyle = '#17703D'; if ('letterSpacing' in cx) cx.letterSpacing = '1px'; cx.fillText('AMVS', tx0, ly + 35); if ('letterSpacing' in cx) cx.letterSpacing = '0px';
    }
    return { out: out, quadro: quadro, W: OW, H: OH };
  }
  function tipoVideo() {
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) return null;
    var l = ['video/mp4;codecs=avc1.42E01F', 'video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4;codecs=h264', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];   // H.264 primeiro (WhatsApp e iPhone)
    for (var i = 0; i < l.length; i++) { try { if (MediaRecorder.isTypeSupported(l[i])) return l[i]; } catch (e) {} }
    return null;
  }
  function video(o, dias, prog) {
    return new Promise(function (ok, erro) {
      var tp = tipoVideo(); if (!tp) { erro(new Error('este aparelho não grava vídeo; escolha GIF')); return; }
      var M = montador(o), st = M.out.captureStream(30), pd = [], rec;
      try { rec = new MediaRecorder(st, { mimeType: tp, videoBitsPerSecond: 5000000 }); } catch (e) { erro(e); return; }
      rec.ondataavailable = function (e) { if (e.data && e.data.size) pd.push(e.data); };
      rec.onstop = function () { ok(new Blob(pd, { type: tp.split(';')[0] })); };
      M.quadro(0); rec.start(250);
      var t0 = null, fim = (dias - 1) * SEG_DIA, seg = FIM;
      function passo(ts) {
        if (t0 === null) t0 = ts;
        var e = ts - t0, t = tempoDia(e, dias);
        M.quadro(t); prog(Math.min(1, e / (fim + seg)), Math.min(dias, Math.floor(t) + 1), dias);
        if (e < fim + seg) requestAnimationFrame(passo); else setTimeout(function () { try { rec.stop(); } catch (x) { erro(x); } }, 120);
      }
      requestAnimationFrame(passo);
    });
  }
  function gif(o, dias, prog) {
    return import(GIFENC).then(function (G) {
      var M = montador(o), w = 480, h = Math.round(M.H * 480 / M.W / 2) * 2;
      var pc = document.createElement('canvas'); pc.width = w; pc.height = h; var px = pc.getContext('2d', { willReadFrequently: true });
      // cada dia: um quadro parado e 4 de passagem para o próximo
      var enc = G.GIFEncoder(), passos = 5, tot = (dias - 1) * passos + 1, i = 0;
      return new Promise(function (ok, erro) {
        function um() {
          try {
            var k = Math.floor(i / passos), j = i % passos, t = k + (j ? suave(j / passos) : 0); M.quadro(t);
            px.drawImage(M.out, 0, 0, w, h);
            var d = px.getImageData(0, 0, w, h).data, pal = G.quantize(d, 256, { format: 'rgb444' }), ix = G.applyPalette(d, pal, 'rgb444');
            enc.writeFrame(ix, w, h, { palette: pal, delay: i === tot - 1 ? FIM : j === 0 ? PARADO : Math.round(TRANS / (passos - 1)) });
            i++; prog(i / tot, Math.min(dias, Math.floor(t) + 1), dias);
            if (i < tot) setTimeout(um, 0); else { enc.finish(); ok(new Blob([enc.bytes()], { type: 'image/gif' })); }
          } catch (e) { erro(e); }
        }
        um();
      });
    });
  }
  function abrir(o) {
    css();
    if (!o || !o.mapa || !o.canvas || !o.n) return;
    var fmt = tipoVideo() ? 'video' : 'gif', dias = Math.min(15, o.n), ocupado = false, pronto = false;
    var f = document.createElement('div'); f.className = 'ex-fundo';
    f.innerHTML = '<div class="ex-cx" role="dialog" aria-label="Exportar animação da chuva"><div class="ex-cab"><b>🎬 Animação da chuva</b><button class="ex-x" aria-label="Fechar">✕</button></div>' +
      '<div class="ex-p">Um quadro por dia, com a data, a escala de cores e o logo AMVS. O enquadramento é o do mapa na tela.</div>' +
      '<div class="ex-lab">Formato</div><div class="ex-op" data-g="fmt">' +
        '<button data-v="video"><b>🎥 Vídeo</b>melhor para WhatsApp e Instagram</button><button data-v="gif"><b>🖼️ GIF</b>abre em qualquer lugar, arquivo maior</button></div>' +
      '<div class="ex-lab">Período</div><div class="ex-op" data-g="dias">' +
        '<button data-v="7"><b>7 dias</b>~' + Math.round((6 * SEG_DIA + FIM) / 1000) + ' segundos</button><button data-v="' + Math.min(15, o.n) + '"><b>' + Math.min(15, o.n) + ' dias</b>~' + Math.round(((Math.min(15, o.n) - 1) * SEG_DIA + FIM) / 1000) + ' segundos</button></div>' +
      '<button class="ex-go">Gerar animação</button><div class="ex-res"></div></div>';
    document.body.appendChild(f);
    var cxa = f.querySelector('.ex-cx'), res = f.querySelector('.ex-res'), go = f.querySelector('.ex-go');
    function marcar() {
      f.querySelectorAll('[data-g="fmt"] button').forEach(function (x) { x.classList.toggle('on', x.dataset.v === fmt); });
      f.querySelectorAll('[data-g="dias"] button').forEach(function (x) { x.classList.toggle('on', Number(x.dataset.v) === dias); });
    }
    marcar();
    f.querySelectorAll('[data-g] button').forEach(function (x) { x.onclick = function () {
      if (ocupado) return; if (x.parentNode.dataset.g === 'fmt') fmt = x.dataset.v; else dias = Number(x.dataset.v); marcar();
      if (pronto) { pronto = false; res.innerHTML = ''; go.hidden = false; go.textContent = 'Gerar animação'; }   // trocou a escolha: gera de novo
    }; });
    var url = null;
    function fechar() { if (ocupado) return; if (url) URL.revokeObjectURL(url); f.remove(); }
    f.querySelector('.ex-x').onclick = fechar;
    f.onclick = function (e) { if (e.target === f) fechar(); };
    go.onclick = function () {
      if (ocupado) return; ocupado = true; go.disabled = true; go.textContent = 'Gerando…';
      if (url) { URL.revokeObjectURL(url); url = null; }
      res.innerHTML = '<div class="ex-pr"><span>Preparando o mapa…</span><div class="ex-pb"><i></i></div></div>';
      var tx = res.querySelector('.ex-pr span'), bar = res.querySelector('.ex-pb i');
      function prog(p, d, n) { tx.textContent = 'Montando o dia ' + d + ' de ' + n + '…'; bar.style.width = Math.round(p * 100) + '%'; }
      var trabalho = carregarLogo().then(function () { return (fmt === 'video' ? video : gif)(o, dias, prog); });
      trabalho.then(function (blob) {
        var ext = fmt === 'gif' ? 'gif' : blob.type.indexOf('mp4') >= 0 ? 'mp4' : 'webm';
        var nome = 'chuva-' + (o.datas[0] || 'previsao') + '-' + dias + 'dias.' + ext;
        url = URL.createObjectURL(blob);
        var arq = null; try { arq = new File([blob], nome, { type: blob.type }); } catch (e) { arq = null; }
        var podeComp = !!(arq && navigator.canShare && navigator.canShare({ files: [arq] }));
        // iPhone/iPad e app instalado na tela inicial: o "baixar" do navegador não funciona; o menu de compartilhar tem "Salvar vídeo/imagem"
        var ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        var instalado = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
        var viaMenu = podeComp && (ios || instalado);
        var tam = (blob.size / 1048576).toFixed(1).replace('.', ',') + ' MB';
        pronto = true; go.hidden = true;   // pronto: só o botão de salvar (sem prévia)
        res.innerHTML = '<button class="ex-go ex-salva">' + (viaMenu ? '💾 Salvar ' + (fmt === 'gif' ? 'GIF' : 'vídeo') + ' / compartilhar' : '⬇ Baixar ' + (fmt === 'gif' ? 'GIF' : 'vídeo')) + ' (' + tam + ')</button>' +
          (podeComp && !viaMenu ? '<button class="ex-sec ex-comp">Compartilhar</button>' : '') +
          '<div class="ex-nota">' + (viaMenu ? 'No menu que abrir, toque em <b>Salvar ' + (fmt === 'gif' ? 'imagem' : 'vídeo') + '</b> (vai para as Fotos) ou escolha o WhatsApp.' :
            'Pronto! Toque para baixar o arquivo.') + (ext === 'webm' ? ' Este aparelho grava em WebM; se o WhatsApp não aceitar, gere em GIF.' : '') + '</div>';
        function compartilhar() { return navigator.share({ files: [arq], title: 'Chuva prevista' }); }
        function baixar() {
          var a = document.createElement('a'); a.href = url; a.download = nome; a.rel = 'noopener'; a.style.display = 'none';
          document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 1000);
        }
        res.querySelector('.ex-salva').onclick = function () {
          if (viaMenu) compartilhar().catch(function (e) { if (!e || e.name !== 'AbortError') { try { window.open(url, '_blank'); } catch (x) { baixar(); } } });
          else baixar();
        };
        var cb = res.querySelector('.ex-comp');
        if (cb) cb.onclick = function () { compartilhar().catch(function () {}); };
      }).catch(function (e) {
        res.innerHTML = '<div class="ex-err">Não deu para gerar: ' + String((e && e.message) || e) + '</div>';
      }).then(function () {
        ocupado = false; go.disabled = false; if (!pronto) go.textContent = 'Gerar animação';
        try { if (o.restaurar) o.restaurar(); } catch (e) {}
      });
    };
    return f;
  }
  // ícone pequeno (só aparece na tela cheia): seta para baixo dentro de um quadrado
  var ICONE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11"></path><path d="M7.5 10.5 12 15l4.5-4.5"></path><path d="M5 19h14"></path></svg>';
  return { abrir: abrir, icone: ICONE, suportaVideo: function () { return !!tipoVideo(); } };
}());
`;
