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
  var SEG_DIA = 550;   // milissegundos por dia no vídeo
  var cssPronto = false;
  function css() {
    if (cssPronto) return; cssPronto = true;
    var s = document.createElement('style');
    s.textContent = '.ex-fundo{position:fixed;inset:0;z-index:5000;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif}' +
      '.ex-cx{background:#fff;color:#1B2B22;width:100%;max-width:440px;max-height:92vh;overflow:auto;border-radius:18px 18px 0 0;padding:16px 16px calc(16px + env(safe-area-inset-bottom,0px))}' +
      '@media(min-width:700px){.ex-fundo{align-items:center}.ex-cx{border-radius:16px}}' +
      '.ex-cab{display:flex;justify-content:space-between;align-items:center}.ex-cab b{font-size:17px}.ex-x{border:0;background:#EEF1EF;width:34px;height:34px;border-radius:50%;font-size:15px;cursor:pointer}' +
      '.ex-p{font-size:12.5px;color:#6B7B72;margin:4px 0 6px}.ex-lab{font-size:12px;color:#6B7B72;font-weight:700;margin:12px 0 6px}' +
      '.ex-op{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ex-op button{text-align:left;border:1px solid #D5DDD9;background:#fff;border-radius:10px;padding:9px 10px;font-size:12.5px;color:#4A5A51;cursor:pointer}' +
      '.ex-op button b{display:block;font-size:14px;color:#1B2B22}.ex-op button.on{border:2px solid #1B7A43;background:#EEF7F1}' +
      '.ex-go{display:block;width:100%;margin-top:14px;border:0;background:#1B7A43;color:#fff;border-radius:10px;padding:12px;font-size:15px;font-weight:700;cursor:pointer}.ex-go[disabled]{opacity:.6}' +
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
  function folha(ctx, x, y, s) {   // logo AMVS (folha), desenhado à mão para não depender de imagem
    ctx.save(); ctx.translate(x, y); ctx.scale(s / 34, s / 34);
    ctx.fillStyle = '#17703D'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(0, 0, 34, 34, 9); else ctx.rect(0, 0, 34, 34); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; ctx.fill(new Path2D('M9 23c0-6 4-10 11-10h5c0 7-4 11-10 11-2 0-4 0-6-1z'));
    ctx.strokeStyle = '#17703D'; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.stroke(new Path2D('M9 25c3-5 6-8 11-10'));
    ctx.restore();
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
      cx.font = '800 18px ' + fonte; var tw = cx.measureText('AMVS Relatório').width, lw = tw + 58, lx = OW - 24 - lw, ly = OH - 58;
      cx.fillStyle = '#FFFFFF'; cx.beginPath(); if (cx.roundRect) cx.roundRect(lx, ly, lw, 42, 10); else cx.rect(lx, ly, lw, 42); cx.fill();
      folha(cx, lx + 6, ly + 6, 30); cx.fillStyle = '#12261B'; cx.fillText('AMVS Relatório', lx + 44, ly + 28);
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
      var t0 = null, fim = (dias - 1) * SEG_DIA, seg = 900;
      function passo(ts) {
        if (t0 === null) t0 = ts;
        var e = ts - t0, t = Math.min(dias - 1, e / SEG_DIA);
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
      var enc = G.GIFEncoder(), passos = 3, tot = (dias - 1) * passos + 1, i = 0;
      return new Promise(function (ok, erro) {
        function um() {
          try {
            var t = i / passos; M.quadro(t);
            px.drawImage(M.out, 0, 0, w, h);
            var d = px.getImageData(0, 0, w, h).data, pal = G.quantize(d, 256, { format: 'rgb444' }), ix = G.applyPalette(d, pal, 'rgb444');
            enc.writeFrame(ix, w, h, { palette: pal, delay: i === tot - 1 ? 1500 : Math.round(SEG_DIA / passos) });
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
    var fmt = tipoVideo() ? 'video' : 'gif', dias = Math.min(15, o.n), ocupado = false;
    var f = document.createElement('div'); f.className = 'ex-fundo';
    f.innerHTML = '<div class="ex-cx" role="dialog" aria-label="Exportar animação da chuva"><div class="ex-cab"><b>🎬 Animação da chuva</b><button class="ex-x" aria-label="Fechar">✕</button></div>' +
      '<div class="ex-p">Um quadro por dia, com a data, a escala de cores e o logo AMVS. O enquadramento é o do mapa na tela.</div>' +
      '<div class="ex-lab">Formato</div><div class="ex-op" data-g="fmt">' +
        '<button data-v="video"><b>🎥 Vídeo</b>melhor para WhatsApp e Instagram</button><button data-v="gif"><b>🖼️ GIF</b>abre em qualquer lugar, arquivo maior</button></div>' +
      '<div class="ex-lab">Período</div><div class="ex-op" data-g="dias">' +
        '<button data-v="7"><b>7 dias</b>~4 segundos</button><button data-v="' + Math.min(15, o.n) + '"><b>' + Math.min(15, o.n) + ' dias</b>~8 segundos</button></div>' +
      '<button class="ex-go">Gerar animação</button><div class="ex-res"></div></div>';
    document.body.appendChild(f);
    var cxa = f.querySelector('.ex-cx'), res = f.querySelector('.ex-res'), go = f.querySelector('.ex-go');
    function marcar() {
      f.querySelectorAll('[data-g="fmt"] button').forEach(function (x) { x.classList.toggle('on', x.dataset.v === fmt); });
      f.querySelectorAll('[data-g="dias"] button').forEach(function (x) { x.classList.toggle('on', Number(x.dataset.v) === dias); });
    }
    marcar();
    f.querySelectorAll('[data-g] button').forEach(function (x) { x.onclick = function () { if (ocupado) return; if (x.parentNode.dataset.g === 'fmt') fmt = x.dataset.v; else dias = Number(x.dataset.v); marcar(); }; });
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
      var trabalho = (fmt === 'video' ? video : gif)(o, dias, prog);
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
        res.innerHTML = '<div class="ex-prev">' + (fmt === 'gif' ? '<img alt="Animação da chuva" src="' + url + '">' : '<video src="' + url + '" autoplay loop muted playsinline controls></video>') + '</div>' +
          '<button class="ex-go ex-salva">' + (viaMenu ? '💾 Salvar ' + (fmt === 'gif' ? 'GIF' : 'vídeo') + ' / compartilhar' : '⬇ Baixar ' + (fmt === 'gif' ? 'GIF' : 'vídeo')) + ' (' + tam + ')</button>' +
          (podeComp && !viaMenu ? '<button class="ex-sec ex-comp">Compartilhar</button>' : '') +
          '<div class="ex-nota">' + (viaMenu ? 'No menu que abrir, toque em <b>Salvar ' + (fmt === 'gif' ? 'imagem' : 'vídeo') + '</b> (vai para as Fotos) ou escolha o WhatsApp.' :
            'Se não baixar, toque e segure na prévia para salvar.') + (ext === 'webm' ? ' Este aparelho grava em WebM; se o WhatsApp não aceitar, gere em GIF.' : '') + '</div>';
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
        ocupado = false; go.disabled = false; go.textContent = 'Gerar de novo';
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
