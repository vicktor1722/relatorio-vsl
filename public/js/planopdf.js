/* ============================================================
   planopdf.js — PDF feito no próprio aparelho, sem biblioteca (funciona offline).
   Usado pelo app (ordem de campo e planejamento) e pelo painel /admin (planejamento),
   para os dois saírem iguais. O painel carrega este arquivo em /planopdf.js.
   ============================================================ */
(function (global) {
  'use strict';
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function hoje() { var d = new Date(); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
  function dataBR(i) { var p = String(i || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '—'; }
  function curta(i) { return dataBR(i).slice(0, 5); }
  function addDias(iso, n) { var d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  var DIA_SEM = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  function segundaDe(iso) { return addDias(iso, -((new Date(iso + 'T12:00:00Z').getUTCDay() + 6) % 7)); }
  function diaSem(iso) { return DIA_SEM[new Date(iso + 'T12:00:00Z').getUTCDay()]; }
  function periodoTxt(de, ate) {
    if (de === ate) return dataBR(de);
    return (de.slice(0, 4) === ate.slice(0, 4) ? curta(de) : dataBR(de)) + ' a ' + dataBR(ate);
  }
  // texto para dentro do PDF (WinAnsi): troca o que a fonte padrão não tem e escapa parênteses
  function pdfCh(s) {
    var out = '';
    String(s == null ? '' : s).replace(/\s+/g, ' ').replace(/[–—]/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").split('').forEach(function (c) {
      var k = c.charCodeAt(0);
      if (k === 8226) out += '-'; else if (k >= 32 && k < 256) out += c;
    });
    return out.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }
  // rodapé padrão (contato e página) em todas as páginas
  function rodape(pgs, W, M) {
    var hojeTxt = dataBR(hoje());
    pgs.forEach(function (ops, i) {
      ops.push('0.85 0.85 0.85 RG 0.6 w ' + M + ' 46 m ' + (W - M) + ' 46 l S');
      ops.push('BT /F2 8 Tf 0.106 0.478 0.263 rg ' + M + ' 34 Td (' + pdfCh('AMVS Relatório de Campo') + ') Tj ET');
      ops.push('BT /F1 8 Tf 0.4 0.4 0.4 rg ' + (M + 104) + ' 34 Td (' + pdfCh('WhatsApp (65) 99918-9847  ·  amvsdiretoria@gmail.com  ·  amvs.ia.br') + ') Tj ET');
      ops.push('BT /F1 7 Tf 0.5 0.5 0.5 rg ' + M + ' 23 Td (' + pdfCh('Pontes e Lacerda - MT  ·  gerado em ' + hojeTxt) + ') Tj ET');
      ops.push('BT /F1 8 Tf 0.5 0.5 0.5 rg ' + (W - M - 40) + ' 23 Td (' + pdfCh('Página ' + (i + 1) + ' de ' + pgs.length) + ') Tj ET');
    });
  }
  // monta o arquivo PDF a partir das páginas (listas de comandos); o logo (JPEG) fica como /Im1 na 1ª página
  function bytes(pgs, logo, W, H) {
    var objs = [], n = pgs.length;
    objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objs[2] = '<< /Type /Pages /Kids [' + pgs.map(function (_, i) { return (5 + i * 2) + ' 0 R'; }).join(' ') + '] /Count ' + n + ' >>';
    objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    var nImg = logo ? 5 + n * 2 : 0;
    pgs.forEach(function (ops, i) {
      var cont = ops.join('\n');
      objs[5 + i * 2] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>' +
        (nImg && i === 0 ? ' /XObject << /Im1 ' + nImg + ' 0 R >>' : '') + ' >> /Contents ' + (6 + i * 2) + ' 0 R >>';
      objs[6 + i * 2] = '<< /Length ' + cont.length + ' >>\nstream\n' + cont + '\nendstream';
    });
    if (nImg) objs[nImg] = '<< /Type /XObject /Subtype /Image /Width ' + logo.w + ' /Height ' + logo.h +
      ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + logo.bin.length + ' >>\nstream\n' + logo.bin + '\nendstream';
    var pdf = '%PDF-1.4\n', offs = [];
    for (var k = 1; k < objs.length; k++) { offs[k] = pdf.length; pdf += k + ' 0 obj\n' + objs[k] + '\nendobj\n'; }
    var xr = pdf.length;
    pdf += 'xref\n0 ' + objs.length + '\n0000000000 65535 f \n';
    for (var j = 1; j < objs.length; j++) pdf += ('0000000000' + offs[j]).slice(-10) + ' 00000 n \n';
    pdf += 'trailer\n<< /Size ' + objs.length + ' /Root 1 0 R >>\nstartxref\n' + xr + '\n%%EOF';
    var bytes = new Uint8Array(pdf.length);
    for (var b = 0; b < pdf.length; b++) bytes[b] = pdf.charCodeAt(b) & 255;
    return bytes;
  }
  // compartilha (WhatsApp, e-mail...) ou baixa o PDF
  function entregar(dados, nome, titulo, aviso) {
    var blob = new Blob([dados], { type: 'application/pdf' });
    try {
      var arq = new File([blob], nome, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [arq] })) { navigator.share({ files: [arq], title: titulo }).catch(function () {}); return; }
    } catch (e) { /* cai no download */ }
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 3000);
    if (aviso) aviso('PDF baixado');
  }
  function nomeArq(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.pdf'; }
  var COR_PDF = { vis: [0.482, 0.247, 0.749], lem: [0.851, 0.51, 0.169], prev: [0.231, 0.471, 0.765], apl: [0.184, 0.62, 0.357],
    perto: [0.878, 0.631, 0], venc: [0.753, 0.224, 0.169], ok: [0.18, 0.545, 0.545], colh: [0.604, 0.357, 0.071] };
  var NOME_COR = { vis: 'visita', lem: 'lembrete', prev: 'aplicação prevista', apl: 'aplicada', perto: 'próxima (perto)', venc: 'vencida', ok: 'próxima', colh: 'colheita prevista' };
  // ícones do app desenhados no PDF (caminhos simples: M L H V Q Z absolutos, no espaço do viewBox)
  function icone(op, cor, x, y, alt) {
    var vb = cor === 'vis' ? [40, 26] : cor === 'lem' ? [24, 24] : cor === 'colh' ? [44, 24] : [40, 24], s = alt / vb[1];
    function X(v) { return (x + v * s).toFixed(2); }
    function Y(v) { return (y + (vb[1] - v) * s).toFixed(2); }
    function caminho(d, c) {
      var t = d.match(/[MLHVQZ]|-?[\d.]+/g), i = 0, cx = 0, cy = 0, o = [];
      while (i < t.length) {
        var k = t[i++];
        if (k === 'M' || k === 'L') { cx = +t[i++]; cy = +t[i++]; o.push(X(cx) + ' ' + Y(cy) + (k === 'M' ? ' m' : ' l')); }
        else if (k === 'H') { cx = +t[i++]; o.push(X(cx) + ' ' + Y(cy) + ' l'); }
        else if (k === 'V') { cy = +t[i++]; o.push(X(cx) + ' ' + Y(cy) + ' l'); }
        else if (k === 'Q') {
          var qx = +t[i++], qy = +t[i++], ex = +t[i++], ey = +t[i++];
          o.push(X(cx + 2 / 3 * (qx - cx)) + ' ' + Y(cy + 2 / 3 * (qy - cy)) + ' ' + X(ex + 2 / 3 * (qx - ex)) + ' ' + Y(ey + 2 / 3 * (qy - ey)) + ' ' + X(ex) + ' ' + Y(ey) + ' c');
          cx = ex; cy = ey;
        } else if (k === 'Z') o.push('h');
      }
      op(c.join(' ') + ' rg ' + o.join(' ') + ' f');
    }
    function roda(ccx, ccy, r, c) {
      var k = 0.5523 * r;
      op(c.join(' ') + ' rg ' + X(ccx + r) + ' ' + Y(ccy) + ' m ' +
        X(ccx + r) + ' ' + Y(ccy + k) + ' ' + X(ccx + k) + ' ' + Y(ccy + r) + ' ' + X(ccx) + ' ' + Y(ccy + r) + ' c ' +
        X(ccx - k) + ' ' + Y(ccy + r) + ' ' + X(ccx - r) + ' ' + Y(ccy + k) + ' ' + X(ccx - r) + ' ' + Y(ccy) + ' c ' +
        X(ccx - r) + ' ' + Y(ccy - k) + ' ' + X(ccx - k) + ' ' + Y(ccy - r) + ' ' + X(ccx) + ' ' + Y(ccy - r) + ' c ' +
        X(ccx + k) + ' ' + Y(ccy - r) + ' ' + X(ccx + r) + ' ' + Y(ccy - k) + ' ' + X(ccx + r) + ' ' + Y(ccy) + ' c f');
    }
    var C = COR_PDF[cor] || COR_PDF.prev, ESC = [0.13, 0.13, 0.13], CLA = [0.81, 0.81, 0.81];
    if (cor === 'vis') {
      caminho('M3 15 V11.5 Q3 10 4.5 10 H17 L21 4.5 Q21.8 3.5 23 3.5 H30 Q31.5 3.5 32.2 4.8 L35.5 10 Q37.5 10.4 37.5 12.5 V17.5 Q37.5 19 36 19 H4.5 Q3 19 3 17.5 Z', C);
      caminho('M22.4 5.6 H29.6 L32.4 10 H19.6 Z', [0.91, 0.945, 0.984]);
      roda(10.5, 19.5, 4.6, ESC); roda(10.5, 19.5, 2, CLA); roda(29.5, 19.5, 4.6, ESC); roda(29.5, 19.5, 2, CLA);
    } else if (cor === 'lem') {
      caminho('M12 3 Q6 3 6 9 V13.2 L4.3 16.4 Q4 18 5.2 18 H18.8 Q20 18 19.7 16.4 L18 13.2 V9 Q18 3 12 3 Z', C);
      roda(12, 19.6, 2.5, C);
    } else if (cor === 'colh') {
      // colheitadeira simplificada: plataforma, corpo verde, cabine e rodas
      caminho('M1 13 H13 V16 H1 Z', [0.85, 0.63, 0.13]);
      caminho('M13 8 H34 Q36 8 36 10 V17 H13 Z', [0.118, 0.557, 0.243]);
      caminho('M22 2 H31 V8 H22 Z', [0.09, 0.44, 0.19]);
      caminho('M23.5 3.5 H29.5 V7 H23.5 Z', [0.85, 0.92, 0.98]);
      caminho('M34 5 H38 V7 H36 V10 H34 Z', [0.25, 0.25, 0.25]);
      roda(18, 18.5, 4.6, ESC); roda(18, 18.5, 2, CLA); roda(32, 19.5, 3.4, ESC); roda(32, 19.5, 1.4, CLA);
    } else {
      // pulverizador simplificado: tanque, barra e gotas
      caminho('M14 3 H26 Q28 3 28 5 V11 Q28 13 26 13 H14 Q12 13 12 11 V5 Q12 3 14 3 Z', C);
      caminho('M1 12 H39 V14.2 H1 Z', C);
      [4, 10, 30, 36].forEach(function (g) { caminho('M' + g + ' 15.5 L' + (g - 1.6) + ' 20 H' + (g + 1.6) + ' Z', [0.22, 0.714, 0.91]); });
      roda(16, 17, 3.6, ESC); roda(24, 17, 3.6, ESC);
    }
  }
  // o = { de, ate, resp ('*' = todos), fazNome, apl, ativ: [{ d, hora, cor, tit, sub, curto, feito, faz, lemb }], logo, empresa, cidade }
  function plano(o) {
    var W = 595, H = 842, M = 36, pgs = [[]], y = 0, logo = o.logo || null, ch = pdfCh, todosResp = o.resp === '*';
    var at = (o.ativ || []).slice().sort(function (a, b) { var x = a.d + (a.hora || '99'), z = b.d + (b.hora || '99'); return x < z ? -1 : x > z ? 1 : 0; });
    function op(s) { pgs[pgs.length - 1].push(s); }
    function txt(x, yy, size, bold, s, cor) { op('BT /' + (bold ? 'F2' : 'F1') + ' ' + size + ' Tf ' + (cor || [0.1, 0.1, 0.1]).join(' ') + ' rg ' + x.toFixed(2) + ' ' + yy.toFixed(2) + ' Td (' + ch(s) + ') Tj ET'); }
    function rect(x, yy, w, h, c) { op(c.join(' ') + ' rg ' + x.toFixed(2) + ' ' + yy.toFixed(2) + ' ' + w.toFixed(2) + ' ' + h.toFixed(2) + ' re f'); }
    function borda(x, yy, w, h, c, lw) { op((c || [0.85, 0.89, 0.86]).join(' ') + ' RG ' + (lw || 0.6) + ' w ' + x.toFixed(2) + ' ' + yy.toFixed(2) + ' ' + w.toFixed(2) + ' ' + h.toFixed(2) + ' re S'); }
    function linha(x1, yy, x2, c, lw, tr) { op((tr ? '[2 2] 0 d ' : '') + (c || [0.85, 0.85, 0.85]).join(' ') + ' RG ' + (lw || 0.6) + ' w ' + x1.toFixed(2) + ' ' + yy.toFixed(2) + ' m ' + x2.toFixed(2) + ' ' + yy.toFixed(2) + ' l S' + (tr ? ' [] 0 d' : '')); }
    function larg(s, size, bold) { return ch(s).length * size * (bold ? 0.55 : 0.5); }
    function quebra(s, largura, size, bold, max) {
      var cabeL = Math.max(4, Math.floor(largura / (size * (bold ? 0.55 : 0.5)))), out = [], l = '';
      String(s || '').replace(/\s+/g, ' ').trim().split(' ').forEach(function (p) {
        while (p.length > cabeL) { if (l) { out.push(l); l = ''; } out.push(p.slice(0, cabeL)); p = p.slice(cabeL); }
        if ((l + ' ' + p).trim().length > cabeL) { out.push(l); l = p; } else l = (l + ' ' + p).trim();
      });
      if (l) out.push(l);
      if (max && out.length > max) { out = out.slice(0, max); out[max - 1] = out[max - 1].slice(0, cabeL - 3) + '...'; }
      return out;
    }
    function novaPag() { pgs.push([]); y = H - M; }
    function cabe(h) { if (y - h < M + 34) { novaPag(); return false; } return true; }
    var VERDE = [0.106, 0.478, 0.263], ESCURO = [0.059, 0.302, 0.165], CINZA = [0.42, 0.48, 0.45], TRACO = [0.85, 0.89, 0.86];
    // cabeçalho: logo, empresa, data
    var topo = H - M, tx = M;
    if (logo) {
      var lh = Math.min(54, logo.h), lw = logo.w * lh / logo.h;
      if (lw > 130) { lw = 130; lh = logo.h * lw / logo.w; }
      op('q ' + lw.toFixed(2) + ' 0 0 ' + lh.toFixed(2) + ' ' + M + ' ' + (topo - 27 - lh / 2).toFixed(2) + ' cm /Im1 Do Q');
      tx = M + lw + 12;
    }
    var emp = o.empresa || (logo ? '' : 'AMVS Relatório de Campo');
    var el = quebra(emp, W - M - tx - 80, 11.5, true, 2), ey = topo - (el.length > 1 ? 16 : 22);
    el.forEach(function (l) { txt(tx, ey, 11.5, true, l, [0.12, 0.16, 0.13]); ey -= 14; });
    if (o.cidade) txt(tx, ey - 1, 8.5, false, o.cidade, CINZA);
    var agora = new Date(), gerado = dataBR(hoje()) + ' ' + p2(agora.getHours()) + ':' + p2(agora.getMinutes());
    txt(W - M - larg('Gerado em', 7.5), topo - 20, 7.5, false, 'Gerado em', CINZA);
    txt(W - M - larg(gerado, 8), topo - 31, 8, false, gerado, CINZA);
    linha(M, topo - 62, W - M, VERDE, 2);
    y = topo - 90;
    txt(M, y, 19, true, 'Planejamento das Atividades', ESCURO); y -= 24;
    var metas = [['RESPONSÁVEL', todosResp ? 'Todos' : o.resp], ['PERÍODO', periodoTxt(o.de, o.ate)]];
    if (o.fazNome) metas.push(['FAZENDA', o.fazNome]);
    var mx = M;
    metas.forEach(function (m) {
      txt(mx, y, 7, true, m[0], CINZA); txt(mx, y - 13, 11, true, m[1], [0.1, 0.1, 0.1]);
      mx += Math.max(130, larg(m[1], 11, true) + 28);
    });
    y -= 30;
    // calendário do período: semanas de segunda a domingo
    var cw = (W - 2 * M) / 7, ini = segundaDe(o.de), fim = addDias(segundaDe(o.ate), 6), porDia = {};
    at.forEach(function (e) { (porDia[e.d] = porDia[e.d] || []).push(e); });
    function cabecaSemana() {
      rect(M, y - 15, W - 2 * M, 15, [0.93, 0.96, 0.94]);
      ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'].forEach(function (n, i) { txt(M + i * cw + 5, y - 10.5, 7.5, true, n, ESCURO); });
      borda(M, y - 15, W - 2 * M, 15, TRACO); y -= 15;
    }
    cabecaSemana();
    var MAXC = 4, LT = 8.2, FC = 7.1;
    for (var sem = ini; sem <= fim; sem = addDias(sem, 7)) {
      var cel = [], alt = 46;
      for (var i = 0; i < 7; i++) {
        var dia = addDias(sem, i), dentro = dia >= o.de && dia <= o.ate, es = dentro ? (porDia[dia] || []) : [], hs = 20, li = [];
        es.slice(0, MAXC).forEach(function (e) { var q = quebra(e.curto, cw - 24, FC, false, 2); li.push(q); hs += q.length * LT + 3; });
        if (es.length > MAXC) hs += LT + 2;
        cel.push({ dia: dia, dentro: dentro, es: es, li: li }); alt = Math.max(alt, hs + 4);
      }
      if (!cabe(alt)) cabecaSemana();
      cel.forEach(function (c, i) {
        var x0 = M + i * cw;
        if (!c.dentro) rect(x0, y - alt, cw, alt, [0.965, 0.965, 0.965]);
        else if (c.dia === hoje()) rect(x0, y - alt, cw, alt, [0.945, 0.973, 0.953]);
        borda(x0, y - alt, cw, alt, TRACO);
        var nd = String(Number(c.dia.slice(8, 10))) + (c.dia.slice(8, 10) === '01' || c.dia === ini ? '/' + c.dia.slice(5, 7) : '');
        txt(x0 + 5, y - 13, 10.5, true, nd, c.dentro ? [0.12, 0.16, 0.13] : [0.65, 0.65, 0.65]);
        var yy = y - 22;
        c.es.slice(0, MAXC).forEach(function (e, k) {
          icone(op, e.cor, x0 + 3.5, yy - 6.2, 7);
          c.li[k].forEach(function (l, j) { txt(x0 + 16, yy - 5 - j * LT, FC, false, l, e.feito ? [0.5, 0.5, 0.5] : [0.15, 0.15, 0.15]); });
          yy -= c.li[k].length * LT + 3;
        });
        if (c.es.length > MAXC) txt(x0 + 16, yy - 5, FC, true, '+' + (c.es.length - MAXC) + ' mais', CINZA);
      });
      y -= alt;
    }
    // resumo e legenda
    y -= 16; cabe(30);
    var nV = at.filter(function (e) { return e.cor === 'vis'; }).length, nL = at.filter(function (e) { return e.cor === 'lem'; }).length,
      nA = at.filter(function (e) { return !e.lemb && e.cor !== 'colh'; }).length, nC = at.filter(function (e) { return e.cor === 'colh'; }).length, fzs = {};
    at.forEach(function (e) { if (e.faz) fzs[e.faz] = 1; });
    var res = [[nV, nV === 1 ? 'visita' : 'visitas'], [nL, nL === 1 ? 'lembrete' : 'lembretes']];
    if (o.apl) res.push([nA, nA === 1 ? 'aplicação' : 'aplicações']);
    if (o.colh) res.push([nC, nC === 1 ? 'colheita' : 'colheitas']);
    res.push([Object.keys(fzs).length, Object.keys(fzs).length === 1 ? 'fazenda' : 'fazendas']);
    var rx = M;
    res.forEach(function (r) { txt(rx, y, 12, true, String(r[0])); txt(rx + larg(String(r[0]), 12, true) + 4, y, 9.5, false, r[1], [0.25, 0.25, 0.25]); rx += larg(String(r[0]), 12, true) + larg(r[1], 9.5) + 22; });
    var cores = {}; at.forEach(function (e) { cores[e.cor] = 1; });
    var lx = M, leg = Object.keys(NOME_COR).filter(function (k) { return cores[k]; });
    if (leg.length) y -= 15;
    leg.forEach(function (k) {
      icone(op, k, lx, y - 1.5, 8); txt(lx + 16, y, 8, false, NOME_COR[k], CINZA); lx += larg(NOME_COR[k], 8) + 30;
    });
    y -= 12;
    // atividades dia a dia
    var dias = Object.keys(porDia).sort();
    if (!dias.length) { y -= 18; txt(M, y, 11, false, 'Nenhuma atividade programada neste período.', CINZA); }
    var CX = M + 22, TX = M + 62, LS = W - 2 * M - 62 - 26;
    dias.forEach(function (dia) {
      var es = porDia[dia];
      var primeiro = es[0], q0 = quebra(primeiro.sub, LS, 8.5, false);
      cabe(34 + 14 + q0.length * 11);
      y -= 16;
      var dn = diaSem(dia); txt(M, y, 10.5, true, dn.charAt(0).toUpperCase() + dn.slice(1) + ', ' + curta(dia) + (dia === hoje() ? '  (hoje)' : ''), ESCURO);
      y -= 5; linha(M, y, W - M, TRACO, 0.8); y -= 4;
      es.forEach(function (e) {
        var sub = quebra(e.sub, LS, 8.5, false), tl = quebra(e.tit, LS, 10, true, 2), h = 8 + tl.length * 12 + sub.length * 10.5 + 4;
        if (!cabe(h)) { txt(M, y - 10, 8.5, true, curta(dia) + ' (continuação)', CINZA); y -= 16; }
        var y0 = y - 13;
        icone(op, e.cor, M, y0 - 1.5, 9);
        txt(CX, y0, 9.5, true, e.hora || '-', [0.2, 0.2, 0.2]);
        tl.forEach(function (l, j) { txt(TX, y0 - j * 12, 10, true, l, e.feito ? [0.45, 0.45, 0.45] : [0.1, 0.1, 0.1]); });
        sub.forEach(function (l, j) { txt(TX, y0 - tl.length * 12 - j * 10.5 + 1.5, 8.5, false, l, CINZA); });
        var bx = W - M - 11, by = y0 - 1.5;
        if (e.feito) {
          rect(bx, by, 10, 10, VERDE);
          op('1 1 1 RG 1.4 w ' + (bx + 2.2) + ' ' + (by + 5.2) + ' m ' + (bx + 4.3) + ' ' + (by + 2.8) + ' l ' + (bx + 8) + ' ' + (by + 7.6) + ' l S');
        } else borda(bx, by, 10, 10, [0.6, 0.66, 0.63], 0.9);
        y -= h;
        linha(TX, y + 2, W - M, [0.89, 0.91, 0.9], 0.5, true);
      });
    });
    rodape(pgs, W, M);
    return bytes(pgs, logo, W, H);
  }
  global.PlanoPDF = { ch: pdfCh, rodape: rodape, bytes: bytes, entregar: entregar, nomeArq: nomeArq, icone: icone, plano: plano,
    segundaDe: segundaDe, periodoTxt: periodoTxt, COR: COR_PDF, NOME_COR: NOME_COR };
})(typeof window !== 'undefined' ? window : this);
