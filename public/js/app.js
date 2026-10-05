/* ============================================================
   app.js — Relatório de Campo · VSL
   UI estilo WhatsApp: captura de foto/vídeo com GPS e talhão (KML),
   armazenamento offline e sincronização com o servidor da VSL.
   ============================================================ */
(function (global) {
  'use strict';

  const $ = function (s) { return document.querySelector(s); };
  const $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  const st = {
    rel: null,            // visita aberta (a que recebe os registros de agora)
    visitas: [],          // todas as visitas da conversa (mesma fazenda)
    itens: [],            // registros de todas as visitas, em ordem
    pos: null,            // última posição GPS
    cfg: { qualidade: 0.82, video: 720 },
    stream: null,
    facing: 'environment',
    recorder: null,
    chunks: [],
    gravando: false,
    tRec: null,
    urls: []              // object URLs a revogar
  };

  /* ---------------- utilidades ---------------- */
  function hora(iso) {
    const d = new Date(iso);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function dataExt(iso) {
    const d = new Date(iso);
    const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const hoje = new Date();
    const mesmo = function (a, b) { return a.toDateString() === b.toDateString(); };
    if (mesmo(d, hoje)) return 'Hoje';
    const ontem = new Date(hoje.getTime() - 86400000);
    if (mesmo(d, ontem)) return 'Ontem';
    return String(d.getDate()).padStart(2, '0') + ' ' + meses[d.getMonth()] + ' ' + d.getFullYear();
  }
  function mmss(s) {
    s = Math.round(s || 0);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }
  function bytesFmt(b) {
    if (!b) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(u.length - 1, Math.floor(Math.log(b) / Math.log(1024)));
    return (b / Math.pow(1024, i)).toFixed(i ? 1 : 0) + ' ' + u[i];
  }
  function toast(msg, ms, aoTocar) {
    const el = document.createElement('div');
    el.className = 'toast'; el.textContent = msg;
    if (aoTocar) {
      el.classList.add('clicavel');
      el.onclick = function () { el.remove(); aoTocar(); };
    }
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, ms || 2600);
    return el;
  }
  function objURL(blob) { const u = URL.createObjectURL(blob); st.urls.push(u); return u; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function abrir(id) { $('#' + id).classList.remove('oculto'); }
  function fechar(id) { $('#' + id).classList.add('oculto'); }

  /* ---------------- GPS ---------------- */
  /* Altura real da janela. No navegador de dentro do WhatsApp/Instagram a barra
     de baixo cobre parte da tela e o botão da câmera ficava cortado. */
  function medirAltura() {
    const h = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
    if (h) document.documentElement.style.setProperty('--altura', Math.round(h) + 'px');
  }
  function ligarMedidaDeAltura() {
    medirAltura();
    window.addEventListener('resize', medirAltura);
    window.addEventListener('orientationchange', function () { setTimeout(medirAltura, 250); });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', medirAltura);
    // o Safari muda a altura logo depois de abrir
    setTimeout(medirAltura, 300);
    setTimeout(medirAltura, 1200);
  }

  function iniciarGPS() {
    if (!navigator.geolocation) { $('#txtGps').textContent = 'GPS indisponível'; return; }
    if (st.vigiaGps != null) { try { navigator.geolocation.clearWatch(st.vigiaGps); } catch (e) {} }
    st.vigiaGps = navigator.geolocation.watchPosition(function (p) {
      st.pos = {
        lat: p.coords.latitude, lon: p.coords.longitude,
        acc: p.coords.accuracy, alt: p.coords.altitude, t: p.timestamp
      };
      atualizarGPS();
    }, function (err) {
      $('#dotGps').className = 'dot ruim';
      st.gpsNegado = err.code === 1;
      $('#txtGps').textContent = 'GPS: ' + (st.gpsNegado ? 'permissão negada · toque' : 'sem sinal · toque');
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
  }

  // toque na faixa do GPS: tenta de novo e explica como liberar
  function ligarToqueGps() {
    const alvo = $('#txtGps').closest('.pill') || $('#txtGps');
    alvo.style.cursor = 'pointer';
    alvo.addEventListener('click', function () {
      if (st.pos) { toast('GPS ativo: ±' + Math.round(st.pos.acc || 0) + ' m'); return; }
      iniciarGPS();
      if (st.gpsNegado) {
        toast('Libere a localização: Ajustes do celular → Safari/Chrome → Localização → Permitir. Depois recarregue.', 6000);
      } else {
        toast('Procurando satélites… fique a céu aberto por alguns segundos.', 4000);
      }
    });
  }

  function atualizarGPS() {
    if (!st.pos) return;
    const acc = st.pos.acc || 99;
    const dot = $('#dotGps');
    dot.className = 'dot ' + (acc <= 10 ? 'ok' : acc <= 30 ? 'medio' : 'ruim');
    const t = talhaoAtual();
    $('#txtGps').textContent = '±' + Math.round(acc) + ' m' + (t ? ' · ' + t.nome : '');
    const cg = $('#camGeo');
    if (cg) cg.textContent = '📍 ±' + Math.round(acc) + ' m' + (t ? ' · ' + t.nome : ' · fora dos talhões');
    if (st.rel) $('#subtituloRel').textContent = subtitulo();
  }

  function talhaoAtual() {
    if (!st.pos || !st.rel || !st.rel.talhoes) return null;
    return Geo.talhaoDoPonto(st.pos.lon, st.pos.lat, st.rel.talhoes);
  }

  function subtitulo() {
    if (!st.rel) return 'Toque em ☰ para criar';
    const t = talhaoAtual();
    const n = (st.rel.talhoes && st.rel.talhoes.features || []).length;
    const v = (st.visitas || []).length;
    return [st.rel.safra ? 'Safra ' + st.rel.safra : null,
            v > 1 ? v + ' visitas' : null,
            n ? n + ' talhões' : 'sem KML',
            t ? '📍 ' + t.nome : null].filter(Boolean).join(' · ');
  }

  /* ---------------- sync status ---------------- */
  function atualizarSync() {
    Promise.all([DB.pendentes(), DB.all('relatorios')]).then(function (r) {
      const p = r[0];
      const fila = r[1].filter(function (x) { return x.na_fila && x.status !== 'publicado'; }).length;
      const dot = $('#dotSync'), txt = $('#txtSync');
      const sufixo = fila ? ' · ' + fila + ' relat.' : '';
      if (!navigator.onLine) {
        dot.className = 'dot medio';
        txt.textContent = 'offline · ' + p.length + ' na fila' + sufixo;
        return;
      }
      if (p.length === 0 && !fila) { dot.className = 'dot ok'; txt.textContent = 'sincronizado'; return; }
      dot.className = 'dot medio';
      txt.textContent = (p.length ? p.length + ' para enviar' : 'enviando') + sufixo;
    });
  }

  /* ---------------- conversa (uma por fazenda) ----------------
     Cada fazenda tem uma conversa só. Dentro dela ficam as visitas, uma embaixo
     da outra. Visita finalizada fica trancada; a próxima continua na mesma tela. */

  function chaveConversa(r) {
    return r.fazenda_id || ('nome:' + String(r.fazenda || '').trim().toLowerCase());
  }

  function visitaFechada(r) {
    return !!(r && (r.status === 'publicado' || r.na_fila));
  }

  async function visitasDa(rel) {
    if (!rel) return [];
    const k = chaveConversa(rel);
    return (await DB.all('relatorios'))
      .filter(function (r) { return chaveConversa(r) === k; })
      .sort(function (a, b) { return String(a.criado_em || '').localeCompare(String(b.criado_em || '')); });
  }

  function hojeISO() { return new Date().toISOString().slice(0, 10); }

  // a visita que recebe os registros de agora; cria uma nova se a última foi fechada
  async function visitaAberta() {
    if (st.rel && !visitaFechada(st.rel)) return st.rel;
    const base = st.rel || (st.visitas && st.visitas[st.visitas.length - 1]);
    if (!base) { toast('Abra ou crie um relatório primeiro'); return null; }
    const novo = {
      id: novoId(),
      produtor_id: base.produtor_id || null, fazenda_id: base.fazenda_id || null,
      produtor: base.produtor || '', fazenda: base.fazenda || '',
      safra: base.safra || '', servico: base.servico || '',
      responsavel: base.responsavel || '', talhoes: base.talhoes || null,
      data_inicio: hojeISO(), data_fim: hojeISO(), observacoes: '',
      status: 'rascunho', criado_em: new Date().toISOString()
    };
    await DB.put('relatorios', novo);
    await DB.cfg('ultimo', novo.id);
    st.rel = novo;
    toast('Nova visita de ' + dataCurta(hojeISO()) + ' nesta conversa', 3500);
    if (navigator.onLine) Sync.sincronizar(novo.id);
    return novo;
  }

  function dataCurta(iso) {
    const p = String(iso || '').slice(0, 10).split('-');
    return p.length === 3 ? p[2] + '/' + p[1] : (iso || '');
  }

  function divisorVisita(v, n) {
    const fechada = visitaFechada(v);
    const estado = v.status === 'publicado' ? 'enviada' : v.na_fila ? 'na fila' : 'em aberto';
    return '<div class="visita' + (fechada ? ' fechada' : '') + '" data-visita="' + v.id + '">' +
      '<b>' + (fechada ? '🔒 ' : '✏️ ') + 'Visita ' + n + ' · ' + esc(dataCurta(v.data_inicio || v.criado_em)) + '</b>' +
      '<span>' + estado + '</span>' +
      '<button class="visita-env" data-env="' + v.id + '" title="' +
        (v.status === 'publicado' ? 'Link do cliente' : 'Finalizar e enviar esta visita') + '">' +
        (v.status === 'publicado' ? '🔗' : v.na_fila ? '⏳' : '🔄') + '</button>' +
      '</div>';
  }

  /* ---------------- chat ---------------- */
  async function renderChat() {
    const chat = $('#chat');
    st.urls.forEach(URL.revokeObjectURL); st.urls = [];
    if (!st.rel) {
      chat.innerHTML = '<div class="aviso">Nenhuma conversa aberta. Toque em <b>☰</b> e crie um relatório.</div>';
      return;
    }

    st.visitas = await visitasDa(st.rel);
    // a visita corrente é a última ainda aberta
    const abertas = st.visitas.filter(function (v) { return !visitaFechada(v); });
    if (abertas.length) {
      const atual = abertas[abertas.length - 1];
      if (!st.rel || st.rel.id !== atual.id) { st.rel = atual; await DB.cfg('ultimo', atual.id); }
    }

    $('#dicaCamera').textContent = visitaFechada(st.rel)
      ? 'Visita fechada — o próximo registro abre uma visita nova'
      : 'Toque para foto · Segure para vídeo · Segure um registro para editar';

    st.itens = [];
    let html = '';
    for (let vi = 0; vi < st.visitas.length; vi++) {
      const v = st.visitas[vi];
      const itens = await DB.itensDoRelatorio(v.id);
      html += divisorVisita(v, vi + 1);
      if (!itens.length) {
        html += '<div class="aviso">Visita sem registros ainda. Toque na câmera.</div>';
        continue;
      }
      let diaAtual = '';
      for (const it of itens) {
        const dia = dataExt(it.capturado_em);
        if (dia !== diaAtual) { diaAtual = dia; html += '<div class="divisor"><span>' + esc(dia) + '</span></div>'; }
        html += bolhaHTML(it);
        st.itens.push(it);
      }
    }

    if (!st.itens.length && st.visitas.length <= 1) {
      html += '<div class="aviso">Toque na <b>câmera</b> para o primeiro registro — a localização e o talhão entram automaticamente.</div>' +
        '<div class="aviso">Para usar como aplicativo: no navegador do celular, <b>Adicionar à tela inicial</b>.</div>';
    }
    chat.innerHTML = html;

    $$('#chat [data-env]').forEach(function (b) {
      b.onclick = function (ev) { ev.stopPropagation(); enviarDaLista(b); };
    });

    // carrega mídias do IndexedDB
    for (const it of st.itens) {
      if (it.tipo === 'texto') continue;
      const el = chat.querySelector('[data-midia="' + it.id + '"]');
      if (!el) continue;
      const blob = await DB.lerMidia(it.id);
      if (blob) {
        const u = objURL(blob);
        if (it.tipo === 'foto') el.innerHTML = '<img src="' + u + '" alt="">';
        else el.innerHTML = '<video src="' + u + '" preload="metadata" playsinline></video><div class="play">▶</div>' +
          (it.duracao_s ? '<div class="dur">' + mmss(it.duracao_s) + '</div>' : '');
      } else if (it.midia || it.drive_id) {
        const mini = await DB.lerMini(it.id);
        if (mini) {
          el.innerHTML = '<img src="' + objURL(mini) + '" alt="">' +
            (it.tipo === 'video' ? '<div class="play">▶</div>' : '') +
            '<div class="dur" style="right:auto;left:6px">☁️ na nuvem</div>';
        } else {
          el.innerHTML = '<div style="padding:26px;color:#fff;font-size:12px;text-align:center">' +
            (it.tipo === 'video' ? '▶ vídeo ' : '') + 'enviado · mídia na nuvem</div>';
        }
      } else {
        el.innerHTML = '<div style="padding:26px;color:#fff;font-size:12px;text-align:center">⚠️ arquivo não ficou guardado neste aparelho</div>';
      }
    }
    chat.scrollTop = chat.scrollHeight;
  }

  function bolhaHTML(it) {
    const ticks = it.sync_state === 'ok'
      ? '<span class="ticks ok">✓✓</span>'
      : it.sync_state === 'erro'
        ? '<span class="ticks erro" title="' + esc(it.erro || '') + '">!</span>'
        : '<span class="ticks">✓</span>';

    const chip = it.tipo === 'texto' ? '' : (it.talhao
      ? '<div class="chip-talhao">📍 ' + esc(it.talhao) + (it.precisao_m ? ' · ±' + Math.round(it.precisao_m) + 'm' : '') + '</div>'
      : '<div class="chip-talhao fora">📍 fora dos talhões' + (it.lat ? '' : ' · sem GPS') + '</div>');

    if (it.tipo === 'texto') {
      return '<div class="msg eu" data-id="' + it.id + '"><div class="bolha so-texto">' +
        '<div class="legenda">' + esc(it.legenda) + '</div>' +
        '<div class="rodape"><span>' + hora(it.capturado_em) + '</span>' + ticks + '</div></div></div>';
    }

    return '<div class="msg eu" data-id="' + it.id + '"><div class="bolha">' +
      '<div class="midia" data-midia="' + it.id + '" data-abrir="' + it.id + '"></div>' +
      chip +
      (it.legenda ? '<div class="legenda">' + esc(it.legenda) + '</div>' : '') +
      '<div class="rodape">' + (it.bytes ? '<span>' + bytesFmt(it.bytes) + '</span>' : '') +
      '<span>' + hora(it.capturado_em) + '</span>' + ticks + '</div></div></div>';
  }

  /* ---------------- captura ---------------- */

  /* Traz o arquivo para a memória na hora. No iPhone o File da galeria deixa de
     poder ser lido pouco depois (principalmente HEIC), e a foto sumia. */
  async function materializar(file) {
    const buf = await file.arrayBuffer();
    return new Blob([buf], { type: file.type || 'application/octet-stream' });
  }

  function desenhar(fonte, lado, alt, qualidade) {
    const escala = Math.min(1, 2048 / Math.max(lado, alt));
    const w = Math.max(1, Math.round(lado * escala)), h = Math.max(1, Math.round(alt * escala));
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    cv.getContext('2d').drawImage(fonte, 0, 0, w, h);
    return new Promise(function (res) { cv.toBlob(res, 'image/jpeg', qualidade); });
  }

  async function comprimirImagem(blob, maxLado, qualidade) {
    // caminho normal
    try {
      const bmp = await createImageBitmap(blob);
      const r = await desenhar(bmp, bmp.width, bmp.height, qualidade);
      bmp.close && bmp.close();
      if (r && r.size) return r;
    } catch (e) { /* cai no plano B */ }

    // plano B: <img> — o Safari decodifica HEIC aqui e devolve JPEG
    return await new Promise(function (res) {
      const u = URL.createObjectURL(blob);
      const im = new Image();
      im.onload = async function () {
        try {
          const r = await desenhar(im, im.naturalWidth, im.naturalHeight, qualidade);
          URL.revokeObjectURL(u);
          res(r && r.size ? r : blob);
        } catch (e) { URL.revokeObjectURL(u); res(blob); }
      };
      im.onerror = function () { URL.revokeObjectURL(u); res(blob); };
      im.src = u;
    });
  }

  async function novoItem(tipo, blob, extras) {
    if (!st.rel) { toast('Crie ou abra um relatório primeiro'); return null; }
    // visita fechada? abre uma nova na mesma conversa, com a data de hoje
    const alvo = await visitaAberta();
    if (!alvo) return null;
    const t = talhaoAtual();
    const item = Object.assign({
      id: novoId(),
      relatorio_id: alvo.id,
      tipo: tipo,
      legenda: '',
      mime: blob ? blob.type : null,
      bytes: blob ? blob.size : null,
      lat: st.pos ? st.pos.lat : null,
      lon: st.pos ? st.pos.lon : null,
      precisao_m: st.pos ? st.pos.acc : null,
      altitude_m: st.pos ? st.pos.alt : null,
      talhao: t ? t.nome : null,
      talhao_id: t ? t.id : null,
      capturado_em: new Date().toISOString(),
      ordem: Date.now(),
      sync_state: 'pendente'
    }, extras || {});
    if (blob) await DB.salvarMidia(item.id, blob);
    await DB.put('itens', item);
    return item;
  }

  // Folha de legenda após a captura. Devolve uma promessa:
  //   { legenda, talhao, talhao_id, repetir }  ou  null se foi descartada.
  // Uma folha por vez — a próxima só abre depois que esta fecha.
  function pedirLegenda(blob, tipo, posicao) {
    // garante que não fica nenhuma folha antiga aberta por baixo
    Array.prototype.slice.call(document.querySelectorAll('.folha, .veu')).forEach(function (e) { e.remove(); });

    return new Promise(function (resolve) {
      const veu = document.createElement('div'); veu.className = 'veu';
      const folha = document.createElement('div'); folha.className = 'folha';
      const u = objURL(blob);
      const t = talhaoAtual();
      const feats = (st.rel && st.rel.talhoes && st.rel.talhoes.features) || [];
      const opcoes = ['<option value="">Fora dos talhões</option>'].concat(feats.map(function (f) {
        const n = f.properties.nome;
        return '<option value="' + esc(n) + '"' + (t && t.nome === n ? ' selected' : '') + '>' + esc(n) + '</option>';
      })).join('');
      const varios = posicao && posicao.total > 1;

      folha.innerHTML =
        '<div class="alca"></div>' +
        (varios ? '<div style="font-size:13px;font-weight:600;margin-bottom:6px">Arquivo ' + posicao.n + ' de ' + posicao.total + '</div>' : '') +
        (tipo === 'foto'
          ? '<img src="' + u + '" style="width:100%;border-radius:10px;max-height:34dvh;object-fit:cover">'
          : '<video src="' + u + '" controls playsinline style="width:100%;border-radius:10px;max-height:34dvh"></video>') +
        '<div style="margin:8px 0 2px;font-size:12.5px;color:#667781">' +
          (st.pos ? '📍 GPS ±' + Math.round(st.pos.acc) + ' m' + (t ? ' · detectou ' + esc(t.nome) : ' · fora dos talhões')
                  : '📍 sem GPS neste aparelho — escolha o talhão abaixo') + '</div>' +
        (feats.length ? '<div class="campo"><label>Talhão</label><select id="legTalhao">' + opcoes + '</select></div>' : '') +
        '<div class="campo"><textarea id="legTxt" rows="2" placeholder="Legenda (opcional)"></textarea></div>' +
        (varios ? '<label class="marcar"><input type="checkbox" id="legRepetir" checked> Usar este talhão e legenda nos ' +
                  (posicao.total - posicao.n) + ' arquivo(s) seguintes</label>' : '') +
        '<button class="btn" id="legOk">Adicionar ao relatório</button>' +
        '<button class="btn secundario" id="legCancel">Descartar</button>';
      veu.appendChild(folha); document.body.appendChild(veu); medirAltura();

      let respondeu = false;
      const fechar2 = function (valor) {
        if (respondeu) return;
        respondeu = true;
        veu.remove(); folha.remove();
        resolve(valor);
      };
      // o véu NÃO descarta a mídia: só os botões decidem (evita perder a foto num toque errado)
      veu.onclick = function (e) { if (e.target === veu) e.stopPropagation(); };
      folha.querySelector('#legCancel').onclick = function () { fechar2(null); };
      folha.querySelector('#legOk').onclick = function () {
        const leg = folha.querySelector('#legTxt').value.trim();
        const sel = folha.querySelector('#legTalhao');
        const nome = sel ? sel.value : (t ? t.nome : '');
        const f = feats.find(function (x) { return x.properties.nome === nome; });
        const rep = folha.querySelector('#legRepetir');
        fechar2({
          legenda: leg,
          talhao: nome || null,
          talhao_id: nome && f ? f.properties.id : null,
          repetir: !!(rep && rep.checked)
        });
      };
      setTimeout(function () { const a = folha.querySelector('#legTxt'); if (a) a.focus(); }, 150);
    });
  }

  // Adiciona uma mídia já com a folha de legenda. `fixo` repete talhão/legenda sem perguntar.
  async function adicionarMidia(blob, tipo, extras, posicao, fixo) {
    if (tipo === 'foto') {
      try { blob = await comprimirImagem(blob, 2048, st.cfg.qualidade); } catch (e) { /* mantém original */ }
    }
    const r = fixo || await pedirLegenda(blob, tipo, posicao);
    if (!r) return null;
    try {
      const item = await novoItem(tipo, blob, Object.assign(
        { legenda: r.legenda || '' }, extras || {},
        { talhao: r.talhao || null, talhao_id: r.talhao_id || null }
      ));
      if (!item) return null;
      await renderChat(); atualizarSync();
      if (navigator.onLine) Sync.sincronizar(st.rel.id);
      return r;
    } catch (e) {
      // nunca falhar calado: antes a foto simplesmente sumia
      toast('Não deu para guardar este arquivo: ' + (e.message || e), 5000);
      return r;
    }
  }

  // Vários arquivos da galeria: um de cada vez, na ordem.
  async function adicionarVarios(arquivos) {
    let fixo = null, ok = 0;
    for (let i = 0; i < arquivos.length; i++) {
      let b;
      try {
        b = await materializar(arquivos[i]);          // lê o arquivo agora, enquanto dá
      } catch (e) {
        toast('Não consegui ler ' + (arquivos[i].name || 'o arquivo') + '. Tente pela câmera do app.', 5000);
        continue;
      }
      const tipo = (b.type || '').indexOf('video') === 0 ? 'video' : 'foto';
      const r = await adicionarMidia(b, tipo, null, { n: i + 1, total: arquivos.length }, fixo);
      if (r) ok++;
      if (!fixo && r && r.repetir) fixo = { legenda: r.legenda, talhao: r.talhao, talhao_id: r.talhao_id };
    }
    if (arquivos.length > 1) toast(ok + ' de ' + arquivos.length + ' adicionado(s)');
  }

  /* ---------------- câmera in-app ---------------- */
  async function abrirCamera() {
    if (!st.rel) { toast('Crie ou abra um relatório primeiro'); return; }
    try {
      const alt = st.cfg.video === 1080 ? 1080 : 720;
      st.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: st.facing, width: { ideal: alt === 1080 ? 1920 : 1280 }, height: { ideal: alt } },
        audio: true
      });
    } catch (e) {
      // sem acesso direto à câmera (iframe, permissão negada): usa a câmera do sistema
      st.semCameraInterna = true;
      $('#inpFoto').click();
      return;
    }
    $('#camVideo').srcObject = st.stream;
    abrir('telaCamera');
    medirAltura();
    setTimeout(medirAltura, 400);
    atualizarGPS();
  }

  function fecharCamera() {
    if (st.gravando) pararVideo();
    if (st.stream) { st.stream.getTracks().forEach(function (t) { t.stop(); }); st.stream = null; }
    fechar('telaCamera');
  }

  async function tirarFoto() {
    const v = $('#camVideo');
    const cv = document.createElement('canvas');
    cv.width = v.videoWidth; cv.height = v.videoHeight;
    cv.getContext('2d').drawImage(v, 0, 0);
    const blob = await new Promise(function (r) { cv.toBlob(r, 'image/jpeg', st.cfg.qualidade); });
    fecharCamera();
    adicionarMidia(blob, 'foto');
  }

  function iniciarVideo() {
    if (!st.stream || st.gravando) return;
    const tipos = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9,opus', 'video/webm'];
    const mime = tipos.find(function (t) { return MediaRecorder.isTypeSupported(t); }) || '';
    st.chunks = [];
    const taxa = st.cfg.video === 1080 ? 2500000 : 1200000;
    st.recorder = new MediaRecorder(st.stream, mime ? { mimeType: mime, videoBitsPerSecond: taxa } : undefined);
    st.recorder.ondataavailable = function (e) { if (e.data.size) st.chunks.push(e.data); };
    st.recorder.onstop = function () {
      const blob = new Blob(st.chunks, { type: st.recorder.mimeType || 'video/webm' });
      const dur = (Date.now() - st.tInicio) / 1000;
      fecharCamera();
      adicionarMidia(blob, 'video', { duracao_s: +dur.toFixed(1) });
    };
    st.recorder.start(1000);
    st.gravando = true; st.tInicio = Date.now();
    $('#camObturador').classList.add('gravando');
    $('#camRec').classList.remove('oculto');
    $('#btnCamera').classList.add('gravando');
    st.tRec = setInterval(function () {
      $('#camTempo').textContent = mmss((Date.now() - st.tInicio) / 1000);
    }, 500);
    if (navigator.vibrate) navigator.vibrate(30);
  }

  function pararVideo() {
    if (!st.gravando) return;
    st.gravando = false;
    clearInterval(st.tRec);
    $('#camObturador').classList.remove('gravando');
    $('#camRec').classList.add('oculto');
    $('#btnCamera').classList.remove('gravando');
    try { st.recorder.stop(); } catch (e) {}
  }

  /* ---------------- enviar observação escrita ---------------- */

  function atualizarBotaoEnvio() {
    const temTexto = $('#txtMsg').value.trim().length > 0;
    st.modoEnvio = temTexto;
    const b = $('#btnCamera');
    b.classList.toggle('enviar', temTexto);
    b.textContent = temTexto ? '➤' : '📷';
    b.title = temTexto ? 'Enviar' : 'Câmera';
    $('#dicaCamera').style.visibility = temTexto ? 'hidden' : 'visible';
  }

  async function enviarTexto() {
    const txt = $('#txtMsg');
    const v = txt.value.trim();
    if (!v) return;
    const item = await novoItem('texto', null, { legenda: v });
    if (!item) return;
    txt.value = ''; txt.style.height = 'auto';
    atualizarBotaoEnvio();
    await renderChat(); atualizarSync();
    if (navigator.onLine) Sync.sincronizar(st.rel.id);
  }

  /* botão do composer: vira "enviar" quando há texto; senão toque = foto, segurar = vídeo */
  function ligarBotaoCamera() {
    const btn = $('#btnCamera');
    let timer = null, segurou = false;

    const inicio = function (e) {
      if (st.modoEnvio) return;
      segurou = false;
      timer = setTimeout(async function () {
        segurou = true;
        if (st.semCameraInterna) { $('#inpVideo').click(); return; }
        await abrirCamera();
        setTimeout(iniciarVideo, 350);
      }, 450);
    };
    const fim = function (e) {
      if (st.modoEnvio) { e.preventDefault(); enviarTexto(); return; }
      clearTimeout(timer);
      if (segurou) { pararVideo(); return; }
      abrirCamera();
    };
    btn.addEventListener('touchstart', inicio, { passive: true });
    btn.addEventListener('touchend', fim);
    btn.addEventListener('mousedown', inicio);
    btn.addEventListener('mouseup', fim);
  }

  function ligarObturador() {
    const ob = $('#camObturador');
    let timer = null, segurou = false;
    const inicio = function () {
      segurou = false;
      timer = setTimeout(function () { segurou = true; iniciarVideo(); }, 350);
    };
    const fim = function () {
      clearTimeout(timer);
      if (st.gravando) { pararVideo(); return; }
      if (!segurou) tirarFoto();
    };
    ob.addEventListener('touchstart', inicio, { passive: true });
    ob.addEventListener('touchend', fim);
    ob.addEventListener('mousedown', inicio);
    ob.addEventListener('mouseup', fim);
  }

  /* ---------------- conversas (uma linha por fazenda) ---------------- */
  async function listarRelatorios() {
    const rels = await DB.all('relatorios');
    const wrap = $('#listaRelatorios');
    if (!rels.length) {
      wrap.innerHTML = '<div class="aviso">Nenhum relatório ainda.</div>';
      $('#subLista').textContent = '0 conversas';
      return;
    }

    // agrupa por fazenda
    const grupos = {};
    rels.forEach(function (r) {
      const k = chaveConversa(r);
      (grupos[k] = grupos[k] || []).push(r);
    });
    const chaves = Object.keys(grupos);
    chaves.forEach(function (k) {
      grupos[k].sort(function (a, b) { return String(a.criado_em || '').localeCompare(String(b.criado_em || '')); });
    });
    chaves.sort(function (a, b) {
      const ua = grupos[a][grupos[a].length - 1].criado_em || '';
      const ub = grupos[b][grupos[b].length - 1].criado_em || '';
      return ub.localeCompare(ua);
    });
    $('#subLista').textContent = chaves.length + ' conversa(s) · ' + rels.length + ' visita(s)';

    const partes = [];
    for (const k of chaves) {
      const visitas = grupos[k];
      const ultima = visitas[visitas.length - 1];
      let registros = 0, pend = 0;
      for (const v of visitas) {
        const itens = await DB.itensDoRelatorio(v.id);
        registros += itens.length;
        pend += itens.filter(function (i) { return i.sync_state !== 'ok'; }).length;
      }
      const porEnviar = visitas.filter(function (v) { return v.status !== 'publicado'; });
      const naFila = visitas.some(function (v) { return v.na_fila; });
      const icone = naFila ? '📤' : porEnviar.length ? '🌱' : '✅';
      const selo = naFila ? 'na fila' : porEnviar.length ? porEnviar.length + ' em aberto' : 'tudo enviado';
      const classeSelo = naFila ? 'fila' : porEnviar.length ? '' : 'pub';
      const classeBotao = naFila ? ' esperando' : porEnviar.length ? '' : ' pronto';
      const icoBotao = naFila ? '⏳' : porEnviar.length ? '🔄' : '🔗';

      partes.push(
        '<div class="lista-item" data-rel="' + ultima.id + '">' +
        '<div class="ic">' + icone + '</div>' +
        '<div class="txt"><b>' + esc(ultima.fazenda || 'Sem fazenda') + '</b>' +
        '<span>' + esc(ultima.produtor || '—') + ' · ' + visitas.length + ' visita(s) · ' + registros + ' registros' +
          (pend ? ' · ' + pend + ' a enviar' : '') + '</span></div>' +
        '<span class="badge ' + classeSelo + '">' + selo + '</span>' +
        '<button class="acao-env' + classeBotao + '" data-conversa="' + esc(k) + '" title="Enviar uma visita">' +
          icoBotao + '</button>' +
        '</div>');
    }
    wrap.innerHTML = partes.join('');
    $$('#listaRelatorios [data-rel]').forEach(function (el) {
      el.onclick = function () { abrirRelatorio(el.dataset.rel); fechar('telaLista'); };
    });
    $$('#listaRelatorios [data-conversa]').forEach(function (b) {
      b.onclick = function (ev) { ev.stopPropagation(); escolherVisita(grupos[b.dataset.conversa] || []); };
    });
  }

  /* ---------- várias visitas em um único link ----------
     Segurar o dedo numa visita liga a seleção. Só entram visitas já enviadas. */
  function aoSegurar(el, fn) {
    let t = null;
    const ini = function () { clearTimeout(t); t = setTimeout(function () {
      el.__segurou = true;
      if (navigator.vibrate) navigator.vibrate(20);
      fn();
    }, 550); };
    const fim = function () { clearTimeout(t); };
    el.addEventListener('touchstart', ini, { passive: true });
    el.addEventListener('touchend', fim);
    el.addEventListener('touchmove', fim, { passive: true });
    el.addEventListener('touchcancel', fim);
    el.addEventListener('mousedown', ini);
    el.addEventListener('mouseup', fim);
    el.addEventListener('mouseleave', fim);
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  async function linkUnico(visitas) {
    const c = await Sync.conf();
    return String(c.api).replace(/\/$/, '') + '/r/' + visitas.map(function (v) { return v.id; }).join('+');
  }

  async function selecionarVisitas(visitas, idInicial) {
    const ord = visitas.slice().sort(function (a, b) {
      return String(a.data_inicio || a.criado_em).localeCompare(String(b.data_inicio || b.criado_em));
    });
    if (!ord.some(function (v) { return v.status === 'publicado'; })) {
      toast('Envie uma visita primeiro: só visitas já enviadas entram no link único.', 5000);
      return;
    }
    const sel = new Set();
    const ini = ord.find(function (v) { return v.id === idInicial; });
    if (ini && ini.status === 'publicado') sel.add(ini.id);
    else if (ini) toast('Essa visita ainda não foi enviada. Marque as que já foram.', 4000);

    const veu = document.createElement('div'); veu.className = 'veu';
    const folha = document.createElement('div'); folha.className = 'folha';
    const linhas = [];
    for (let i = 0; i < ord.length; i++) {
      const v = ord[i];
      const itens = await DB.itensDoRelatorio(v.id);
      const ok = v.status === 'publicado';
      linhas.push(
        '<label class="opcao sel' + (ok ? '' : ' desab') + '">' +
        '<input type="checkbox" data-v="' + v.id + '"' + (ok ? '' : ' disabled') + (sel.has(v.id) ? ' checked' : '') + '>' +
        '<span><b>Visita ' + (i + 1) + ' · ' + esc(dataCurta(v.data_inicio || v.criado_em)) + '</b>' +
        '<small style="display:block;color:var(--texto-fraco);font-size:12px">' +
          itens.length + ' registro(s) · ' + (ok ? 'enviada' : 'ainda não enviada') + '</small></span></label>');
    }
    folha.innerHTML = '<div class="alca"></div>' +
      '<h2 style="margin-top:0">Juntar visitas em um link</h2>' +
      '<p style="margin:0 0 8px;font-size:13px;color:var(--texto-fraco)">' + esc(ord[0].fazenda || '') +
      ' · marque as datas que o cliente vai receber no mesmo relatório</p>' + linhas.join('') +
      '<button class="btn" id="btnJuntar" style="margin-top:12px"></button>' +
      '<button class="btn secundario" id="btnJuntarFechar">Cancelar</button>';
    veu.appendChild(folha); document.body.appendChild(veu); medirAltura();
    const sair = function () { veu.remove(); };
    veu.onclick = function (e) { if (e.target === veu) sair(); };
    folha.querySelector('#btnJuntarFechar').onclick = sair;
    const btn = folha.querySelector('#btnJuntar');
    const atualizar = function () {
      sel.clear();
      folha.querySelectorAll('input[data-v]:checked').forEach(function (x) { sel.add(x.dataset.v); });
      btn.disabled = sel.size < 1;
      btn.textContent = sel.size < 2 ? 'Marque 2 ou mais visitas' : 'Gerar link único (' + sel.size + ' visitas)';
      btn.disabled = sel.size < 2;
    };
    folha.querySelectorAll('input[data-v]').forEach(function (x) { x.onchange = atualizar; });
    atualizar();
    btn.onclick = async function () {
      const esc2 = ord.filter(function (v) { return sel.has(v.id); });
      if (esc2.length < 2) return;
      sair();
      mostrarLink(await linkUnico(esc2), {
        fazenda: esc2[0].fazenda, produtor: esc2[0].produtor, multi: true, n: esc2.length
      });
    };
  }

  /* Qual visita enviar: com uma só vai direto; com várias, pergunta. */
  async function escolherVisita(visitas) {
    if (!visitas.length) return;
    if (visitas.length === 1) {
      return enviarDaLista({ dataset: { env: visitas[0].id }, textContent: '🔄', disabled: false });
    }
    const veu = document.createElement('div'); veu.className = 'veu';
    const folha = document.createElement('div'); folha.className = 'folha';
    const linhas = [];
    for (let i = 0; i < visitas.length; i++) {
      const v = visitas[i];
      const itens = await DB.itensDoRelatorio(v.id);
      const estado = v.status === 'publicado' ? 'já enviada · ver link'
        : v.na_fila ? 'na fila, esperando internet'
          : itens.length + ' registro(s) · pronta para enviar';
      linhas.push(
        '<div class="opcao" data-v="' + v.id + '">' +
        '<span>' + (v.status === 'publicado' ? '🔗' : v.na_fila ? '⏳' : '🔄') + '</span>' +
        '<span><b>Visita ' + (i + 1) + ' · ' + esc(dataCurta(v.data_inicio || v.criado_em)) + '</b>' +
        '<small style="display:block;color:var(--texto-fraco);font-size:12px">' + esc(estado) + '</small></span>' +
        '</div>');
    }
    folha.innerHTML = '<div class="alca"></div>' +
      '<h2 style="margin-top:0">Qual visita enviar?</h2>' +
      '<p style="margin:0 0 4px;font-size:12px;color:var(--texto-fraco)">Segure o dedo numa visita para juntar várias em um só link.</p>' +
      '<p style="margin:0 0 8px;font-size:13px;color:var(--texto-fraco)">' +
        esc(visitas[0].fazenda || '') + '</p>' + linhas.join('');
    veu.appendChild(folha); document.body.appendChild(veu); medirAltura();
    const sair = function () { veu.remove(); };
    veu.onclick = function (e) { if (e.target === veu) sair(); };
    folha.querySelectorAll('.opcao').forEach(function (o) {
      aoSegurar(o, function () { const id = o.dataset.v; sair(); selecionarVisitas(visitas, id); });
      o.onclick = function () {
        if (o.__segurou) { o.__segurou = false; return; }
        const id = o.dataset.v; sair();
        enviarDaLista({ dataset: { env: id }, textContent: '🔄', disabled: false });
      };
    });
  }

  // Botão da lista: finaliza o relatório, sobe tudo e devolve o link do cliente.
  // Sem internet ele entra na fila e sobe sozinho quando a conexão voltar.
  async function enviarDaLista(botao) {
    const rel = await DB.get('relatorios', botao.dataset.env);
    if (!rel) return;

    if (rel.status === 'publicado') { mostrarLink(await linkDe(rel), rel); return; }

    const itens = await DB.itensDoRelatorio(rel.id);

    // já estava na fila: tenta agora, ou deixa voltar a rascunho
    if (rel.na_fila) {
      if (!navigator.onLine) {
        if (confirm('Ainda sem internet. Ele sobe sozinho assim que conectar.\n\nQuer tirar da fila e voltar a editar?')) {
          await Sync.cancelarEnvio(rel);
          if (st.rel && st.rel.id === rel.id) { st.rel = await DB.get('relatorios', rel.id); await renderChat(); }
          await listarRelatorios();
        }
        return;
      }
      return tentarPublicar(rel, botao, itens);
    }

    if (!itens.length) { toast('Este relatório ainda não tem nenhum registro.', 3500); return; }

    if (!navigator.onLine) {
      if (!confirm('Finalizar "' + (rel.fazenda || 'relatório') + '" com ' + itens.length + ' registro(s)?\n\n' +
                   'Você está sem internet: ele fica guardado no aparelho e sobe sozinho quando a conexão voltar. ' +
                   'A partir de agora ele não pode mais ser editado.')) return;
      await Sync.marcarParaEnvio(rel);
      if (st.rel && st.rel.id === rel.id) { st.rel = await DB.get('relatorios', rel.id); await renderChat(); }
      await listarRelatorios(); atualizarSync();
      toast('Guardado. Sobe sozinho quando a internet voltar.', 5000);
      return;
    }

    if (!confirm('Finalizar "' + (rel.fazenda || 'relatório') + '" e enviar para a nuvem?\n\n' +
                 itens.length + ' registro(s). Depois de finalizado ele não pode mais ser editado.')) return;
    return tentarPublicar(rel, botao, itens);
  }

  async function tentarPublicar(rel, botao, itens) {
    const antes = botao.textContent;
    botao.textContent = '⏳'; botao.disabled = true;
    const pend = itens.filter(function (i) { return i.sync_state !== 'ok'; }).length;
    toast(pend ? 'Enviando ' + pend + ' arquivo(s)…' : 'Publicando…', 8000);
    try {
      const link = await Sync.publicar(rel);
      if (st.rel && st.rel.id === rel.id) {
        st.rel = await DB.get('relatorios', rel.id);
        await renderChat();
      }
      await listarRelatorios();
      atualizarSync();
      mostrarLink(link, rel);
    } catch (e) {
      // não deu agora: fica na fila, nada se perde
      await Sync.marcarParaEnvio(rel);
      await listarRelatorios(); atualizarSync();
      toast('Não consegui enviar agora (' + e.message + '). Ficou na fila e sobe sozinho.', 6000);
    }
  }

  async function linkDe(rel) {
    const c = await Sync.conf();
    return String(c.api).replace(/\/$/, '') + '/r/' + rel.id;
  }

  async function abrirRelatorio(id) {
    st.rel = await DB.get('relatorios', id);
    if (!st.rel) return;
    await DB.cfg('ultimo', id);
    fechar('telaLista');
    await renderChat();                       // ajusta st.rel para a visita aberta
    $('#tituloRel').textContent = st.rel.fazenda || 'Relatório';
    $('#subtituloRel').textContent = subtitulo();
    $('#avatarRel').textContent = visitaFechada(st.rel) ? (st.rel.na_fila ? '📤' : '✅') : '🌱';
    atualizarSync(); atualizarGPS();
  }

  function preencherFormulario(rel) {
    Conta.preencherSelecoes();
    $('#fProdutorSel').value = rel.produtor_id || '';
    Conta.preencherSelecoes();
    $('#fFazendaSel').value = rel.fazenda_id || '';
    $('#fSafraSel').dataset.pendente = rel.safra || '';
    Conta.preencherSelecoes();
    $('#fResponsavel').value = rel.responsavel || '';
    $('#fServico').value = rel.servico || '';
    $('#fInicio').value = rel.data_inicio || '';
    $('#fFim').value = rel.data_fim || '';
    $('#fObs').value = rel.observacoes || '';
    Conta.preencherSelecoes();
    $('#tituloTelaRel').textContent = rel.id ? 'Editar relatório' : 'Novo relatório';
    $('#btnApagarRel').classList.toggle('oculto', !rel.id);
  }

  let relEdicao = null;

  async function salvarRelatorio() {
    const base = relEdicao || {};
    const prod = Conta.produtorPorId($('#fProdutorSel').value);
    const faz = Conta.fazendaPorId($('#fFazendaSel').value);
    if (!faz) { toast('Escolha a fazenda — ou cadastre uma primeiro'); return; }
    const rel = Object.assign({}, base, {
      id: base.id || novoId('r'),
      produtor_id: prod ? prod.id : null,
      fazenda_id: faz.id,
      produtor: prod ? prod.nome : '',
      fazenda: faz.nome,
      safra: $('#fSafraSel').value.trim(),
      responsavel: $('#fResponsavel').value.trim(),
      servico: $('#fServico').value.trim(),
      data_inicio: $('#fInicio').value || hojeISO(),
      data_fim: $('#fFim').value || null,
      observacoes: $('#fObs').value.trim(),
      talhoes: faz.talhoes || { type: 'FeatureCollection', features: [] },
      status: base.status || 'rascunho',
      criado_em: base.criado_em || new Date().toISOString()
    });
    await DB.put('relatorios', rel);
    relEdicao = null;
    fechar('telaRel');
    await abrirRelatorio(rel.id);
    await listarRelatorios();
    if (navigator.onLine) Sync.sincronizar(rel.id);
  }

  /* ---------------- mapa SVG ---------------- */
  function desenharMapa() {
    const wrap = $('#mapaWrap');
    if (!st.rel || !st.rel.talhoes || !st.rel.talhoes.features.length) {
      wrap.innerHTML = '<div class="aviso">Importe um KML para ver o mapa.</div>';
      $('#legendaTalhoes').innerHTML = ''; $('#resumoTalhoes').innerHTML = ''; return;
    }
    const gj = st.rel.talhoes;
    const b = Geo.bounds(gj);
    const pad = 0.02;
    const dx = (b.maxX - b.minX) || 0.001, dy = (b.maxY - b.minY) || 0.001;
    const minX = b.minX - dx * pad, maxX = b.maxX + dx * pad;
    const minY = b.minY - dy * pad, maxY = b.maxY + dy * pad;
    const W = 1000, H = Math.round(W * ((maxY - minY) / (maxX - minX)) * Math.cos(((minY + maxY) / 2) * Math.PI / 180));
    const px = function (lon) { return (lon - minX) / (maxX - minX) * W; };
    const py = function (lat) { return H - (lat - minY) / (maxY - minY) * H; };

    let svg = '<svg viewBox="0 0 ' + W + ' ' + (H || 600) + '" xmlns="http://www.w3.org/2000/svg">';
    gj.features.forEach(function (f, i) {
      const g = f.geometry;
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
      polys.forEach(function (rings) {
        const d = rings.map(function (ring) {
          return 'M' + ring.map(function (p) { return px(p[0]).toFixed(1) + ',' + py(p[1]).toFixed(1); }).join('L') + 'Z';
        }).join(' ');
        svg += '<path d="' + d + '" fill="rgba(27,122,67,.14)" stroke="#1B7A43" stroke-width="2.5"/>';
      });
      const c = centroide(f.geometry);
      svg += '<text x="' + px(c[0]).toFixed(1) + '" y="' + py(c[1]).toFixed(1) +
        '" font-size="20" fill="#146034" text-anchor="middle" font-family="sans-serif" font-weight="600">' +
        esc(f.properties.nome) + '</text>';
    });
    st.itens.forEach(function (it) {
      if (!it.lat) return;
      const cor = it.tipo === 'video' ? '#D93025' : '#1B7A43';
      svg += '<circle cx="' + px(it.lon).toFixed(1) + '" cy="' + py(it.lat).toFixed(1) +
        '" r="7" fill="' + cor + '" stroke="#fff" stroke-width="2.5"/>';
    });
    if (st.pos) {
      svg += '<circle cx="' + px(st.pos.lon).toFixed(1) + '" cy="' + py(st.pos.lat).toFixed(1) +
        '" r="10" fill="#2196F3" stroke="#fff" stroke-width="3"/>';
    }
    svg += '</svg>';
    wrap.innerHTML = svg;

    $('#legendaTalhoes').innerHTML = '<span>🟢 foto</span><span>🔴 vídeo</span><span>🔵 você</span>';
    const porTalhao = {};
    st.itens.forEach(function (it) {
      const k = it.talhao || 'Fora dos talhões';
      porTalhao[k] = (porTalhao[k] || 0) + 1;
    });
    $('#resumoTalhoes').innerHTML = Object.keys(porTalhao).map(function (k) {
      return '<div class="lista-item"><div class="ic">📍</div><div class="txt"><b>' + esc(k) +
        '</b><span>' + porTalhao[k] + ' registro(s)</span></div></div>';
    }).join('') || '<div class="aviso">Nenhum registro ainda.</div>';
    $('#subMapa').textContent = st.rel.fazenda || '';
  }

  function centroide(g) {
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    let sx = 0, sy = 0, n = 0;
    polys.forEach(function (rings) {
      rings[0].forEach(function (p) { sx += p[0]; sy += p[1]; n++; });
    });
    return [sx / n, sy / n];
  }

  /* ---------------- menu ⋮ ---------------- */
  function menuMais() {
    if (!st.rel) { toast('Abra um relatório'); return; }
    const veu = document.createElement('div'); veu.className = 'veu';
    const folha = document.createElement('div'); folha.className = 'folha';
    folha.innerHTML = '<div class="alca"></div>' +
      '<div class="opcao" data-a="editar"><span>✏️</span><span>Editar dados da visita</span></div>' +
      '<div class="opcao" data-a="sync"><span>🔄</span><span>Sincronizar agora</span></div>' +
      '<div class="opcao" data-a="previa"><span>👁️</span><span>Ver como o cliente vê</span></div>' +
      '<div class="opcao" data-a="publicar"><span>🔗</span><span><b>Finalizar e gerar link</b></span></div>' +
      '<div class="opcao" data-a="lista"><span>📁</span><span>Todos os relatórios</span></div>';
    veu.appendChild(folha); document.body.appendChild(veu); medirAltura();
    const sair = function () { veu.remove(); folha.remove(); };
    veu.onclick = function (e) { if (e.target === veu) sair(); };
    folha.querySelectorAll('.opcao').forEach(function (o) {
      o.onclick = async function () {
        const a = o.dataset.a; sair();
        if (a === 'editar') {
          if (relFinalizado()) { toast('Esta visita já foi finalizada — crie um registro novo para abrir outra', 4000); return; }
          relEdicao = st.rel; preencherFormulario(st.rel); abrir('telaRel');
        }
        if (a === 'sync') { toast('Sincronizando…'); const r = await Sync.sincronizar(); if (!r.erro) toast(r.enviados + ' enviados, ' + r.falhas + ' falhas'); await renderChat(); atualizarSync(); }
        if (a === 'previa') abrirRelatorioPronto(st.rel.id, true);
        if (a === 'publicar') publicarRelatorio();
        if (a === 'lista') { await listarRelatorios(); abrir('telaLista'); }
      };
    });
  }

  // o item "Finalizar e gerar link" do menu ⋮ usa o mesmo caminho do botão da lista,
  // incluindo a fila quando está sem internet
  async function publicarRelatorio() {
    if (!st.rel) return;
    const falso = { dataset: { env: st.rel.id }, textContent: '🔄', disabled: false };
    return enviarDaLista(falso);
  }

  async function publicarRelatorioAntigo() {
    if (!st.rel) return;
    const pend = st.itens.filter(function (i) { return i.sync_state !== 'ok'; }).length;
    toast(pend ? 'Sincronizando ' + pend + ' item(ns)…' : 'Publicando…', 4000);
    try {
      const link = await Sync.publicar(st.rel);
      st.rel = await DB.get('relatorios', st.rel.id);
      await renderChat(); atualizarSync();
      await listarRelatorios();
      mostrarLink(link, st.rel);
    } catch (e) {
      toast('Não publicou: ' + e.message, 5000);
    }
  }

  function mostrarLink(link, relOpcional) {
    const rel = relOpcional || st.rel || {};
    const veu = document.createElement('div'); veu.className = 'veu';
    const folha = document.createElement('div'); folha.className = 'folha';
    folha.innerHTML = '<div class="alca"></div>' +
      '<h2 style="margin-top:0">' + (rel.multi ? 'Relatório único · ' + rel.n + ' visitas' : 'Relatório publicado') + '</h2>' +
      '<p style="margin:0 0 10px;font-size:13.5px;color:var(--texto-fraco)">' +
        esc(rel.fazenda || '') + (rel.produtor ? ' · ' + esc(rel.produtor) : '') + '</p>' +
      '<div class="campo"><input id="linkOut" readonly value="' + esc(link) + '"></div>' +
      '<button class="btn" id="btnCompart">Enviar para o cliente</button>' +
      '<button class="btn secundario" id="btnCopiar">Copiar link</button>' +
      '<button class="btn secundario" id="btnAbrir">Abrir relatório</button>';
    veu.appendChild(folha); document.body.appendChild(veu); medirAltura();
    const sair = function () { veu.remove(); };
    veu.onclick = function (e) { if (e.target === veu) sair(); };
    const texto = (rel.multi ? 'Relatório de visitas — ' : 'Relatório de visita — ') + (rel.fazenda || '') + '\n' + link;
    folha.querySelector('#btnCompart').onclick = function () {
      if (navigator.share) navigator.share({ title: 'Relatório de visita', text: texto });
      else window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank');
    };
    folha.querySelector('#btnCopiar').onclick = function () {
      navigator.clipboard.writeText(link); toast('Link copiado');
    };
    folha.querySelector('#btnAbrir').onclick = function () {
      sair();
      if (rel.multi) window.open(link, '_blank');
      else abrirRelatorioPronto(rel.id, false);
    };
  }

  /* ---------------- ajustes ---------------- */
  async function carregarCfg() {
    const c = await DB.cfg('servidor');
    if (c) st.cfg = Object.assign(st.cfg, c);
    $('#cfgEmpresa').value = st.cfg.empresa || '';
    $('#cfgCidade').value = st.cfg.cidade || '';
    mostrarLogo();
    $('#cfgQualidade').value = String(st.cfg.qualidade || 0.82);
    $('#cfgVideo').value = String(st.cfg.video || 720);
    const u = await DB.uso();
    $('#usoDisco').textContent = bytesFmt(u.usado) + (u.cota ? ' de ' + bytesFmt(u.cota) : '');
    const q = await Sync.quemSou();
    $('#infoConta').innerHTML = '<div class="lista-item"><div class="ic">👤</div><div class="txt"><b>' +
      esc(q.nome || q.email || 'sem conta') + '</b><span>' + esc(q.email || '') + '</span></div></div>';
  }

  async function salvarCfg() {
    const atual = (await DB.cfg('servidor')) || {};
    st.cfg = Object.assign({}, atual, {
      empresa: $('#cfgEmpresa').value.trim(),
      cidade: $('#cfgCidade').value.trim(),
      qualidade: parseFloat($('#cfgQualidade').value),
      video: parseInt($('#cfgVideo').value, 10)
    });
    await DB.cfg('servidor', st.cfg);
    toast('Ajustes salvos');
    Sync.salvarPerfil({ empresa: st.cfg.empresa, cidade: st.cfg.cidade, logo: st.cfg.logo || '' })
      .catch(function (e) { toast('Salvo no aparelho; servidor: ' + e.message, 4000); });
  }

  /* ---------------- logo da empresa ---------------- */

  function mostrarLogo() {
    const previa = $('#logoPrevia');
    if (st.cfg.logo) {
      previa.innerHTML = '<div class="ic" style="background:#fff;padding:3px"><img src="' + st.cfg.logo +
        '" style="max-width:100%;max-height:100%;object-fit:contain"></div>' +
        '<div class="txt"><b>Logo definido</b><span>aparece no cabeçalho do relatório</span></div>';
      $('#btnRemoverLogo').classList.remove('oculto');
    } else {
      previa.innerHTML = '<div class="ic">🏷️</div><div class="txt"><b>Nenhum logo</b>' +
        '<span>JPG ou PNG, aparece no cabeçalho do relatório</span></div>';
      $('#btnRemoverLogo').classList.add('oculto');
    }
  }

  async function prepararLogo(file) {
    const bmp = await createImageBitmap(file);
    const escala = Math.min(1, 300 / bmp.width, 120 / bmp.height);
    const w = Math.max(1, Math.round(bmp.width * escala));
    const h = Math.max(1, Math.round(bmp.height * escala));
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close && bmp.close();
    let url = cv.toDataURL('image/png');
    if (url.length > 200000) {
      const cv2 = document.createElement('canvas'); cv2.width = w; cv2.height = h;
      const c2 = cv2.getContext('2d');
      c2.fillStyle = '#fff'; c2.fillRect(0, 0, w, h);
      c2.drawImage(cv, 0, 0);
      url = cv2.toDataURL('image/jpeg', 0.85);
    }
    return url;
  }

  async function testarConexao() {
    const info = $('#infoServidor');
    info.innerHTML = '<div class="aviso">Verificando…</div>';
    try {
      const s = await Sync.status();
      const linhas = [];
      linhas.push(s.armazenamento ? '✅ Armazenamento do app conectado' : '❌ Sem armazenamento — rodando só neste aparelho');
      linhas.push(s.midia ? '✅ Envio de fotos e vídeos liberado' : '⚠️ Esta sessão não pode enviar mídia (visualização apenas)');
      linhas.push(navigator.geolocation ? '✅ GPS disponível no navegador' : '❌ GPS indisponível');
      info.innerHTML = '<div class="aviso" style="text-align:left">' + linhas.join('<br>') + '</div>';
    } catch (e) {
      info.innerHTML = '<div class="aviso">Falha ao verificar: ' + esc(e.message) + '</div>';
    }
  }

  /* ---------------- editar registro ---------------- */

  function relFinalizado() {
    return !!(st.rel && (st.rel.status === 'publicado' || st.rel.na_fila));
  }

  async function abrirEdicao(item) {
    const dono = st.visitas.find(function (v) { return v.id === item.relatorio_id; });
    if (visitaFechada(dono)) {
      toast('Esta visita já foi finalizada — os registros dela não mudam mais', 3800);
      return;
    }
    const veu = document.createElement('div'); veu.className = 'veu';
    const folha = document.createElement('div'); folha.className = 'folha';
    const titulo = item.tipo === 'texto' ? 'Editar observação' : 'Editar legenda';
    folha.innerHTML =
      '<div class="alca"></div>' +
      '<h2 style="margin-top:0">' + titulo + '</h2>' +
      (item.talhao ? '<div style="font-size:12.5px;color:#667781;margin-bottom:6px">📍 ' + esc(item.talhao) + '</div>' : '') +
      '<div class="campo"><textarea id="edTxt" rows="4"></textarea></div>' +
      '<button class="btn" id="edOk">Salvar</button>' +
      '<button class="btn perigo" id="edApagar">Apagar registro</button>' +
      '<button class="btn secundario" id="edCancel">Cancelar</button>';
    veu.appendChild(folha); document.body.appendChild(veu); medirAltura();
    const campo = folha.querySelector('#edTxt');
    campo.value = item.legenda || '';
    const sair = function () { veu.remove(); folha.remove(); };
    veu.onclick = function (e) { if (e.target === veu) sair(); };
    folha.querySelector('#edCancel').onclick = sair;

    folha.querySelector('#edOk').onclick = async function () {
      const novo = campo.value.trim();
      if (item.tipo === 'texto' && !novo) { toast('A observação não pode ficar vazia'); return; }
      item.legenda = novo;
      if (item.sync_state === 'ok') item.sync_state = 'pendente';
      await DB.put('itens', item);
      sair();
      await renderChat(); atualizarSync();
      if (navigator.onLine) Sync.sincronizar(st.rel.id);
    };

    folha.querySelector('#edApagar').onclick = async function () {
      if (!confirm('Apagar este registro do relatório?')) return;
      await DB.del('midias', item.id);
      await DB.del('itens', item.id);
      sair();
      await renderChat(); atualizarSync();
      toast('Registro apagado');
    };

    setTimeout(function () { campo.focus(); }, 150);
  }

  function ligarEdicaoNoChat() {
    const chat = $('#chat');
    let timer = null, segurou = false, segurouVisita = false;

    const achaItem = function (alvo) {
      const el = alvo.closest('[data-id]');
      if (!el) return null;
      return st.itens.find(function (i) { return i.id === el.dataset.id; }) || null;
    };

    const inicio = function (e) {
      const item = achaItem(e.target);
      if (!item) return;
      segurou = false;
      timer = setTimeout(function () {
        segurou = true;
        if (navigator.vibrate) navigator.vibrate(20);
        abrirEdicao(item);
      }, 500);
    };
    const fim = function () { clearTimeout(timer); };

    chat.addEventListener('touchstart', inicio, { passive: true });
    chat.addEventListener('touchend', fim);
    chat.addEventListener('touchmove', fim, { passive: true });
    chat.addEventListener('mousedown', inicio);
    chat.addEventListener('mouseup', fim);
    chat.addEventListener('mouseleave', fim);

    // segurar o cabeçalho de uma visita: juntar visitas já enviadas em um link só
    let tv = null;
    const iniV = function (e) {
      const d = e.target.closest && e.target.closest('.visita');
      if (!d || e.target.closest('.visita-env')) return;
      clearTimeout(tv);
      tv = setTimeout(function () {
        segurouVisita = true;
        if (navigator.vibrate) navigator.vibrate(20);
        selecionarVisitas(st.visitas || [], d.dataset.visita);
      }, 550);
    };
    const fimV = function () { clearTimeout(tv); };
    chat.addEventListener('touchstart', iniV, { passive: true });
    chat.addEventListener('touchend', fimV);
    chat.addEventListener('touchmove', fimV, { passive: true });
    chat.addEventListener('mousedown', iniV);
    chat.addEventListener('mouseup', fimV);
    chat.addEventListener('mouseleave', fimV);
    chat.addEventListener('contextmenu', function (e) { if (e.target.closest && e.target.closest('.visita')) e.preventDefault(); });
    chat.addEventListener('click', function (e) {
      if (segurouVisita) { segurouVisita = false; e.stopPropagation(); e.preventDefault(); }
    }, true);

    // toque simples numa observação de texto abre a edição direto
    chat.addEventListener('click', function (e) {
      if (segurou) { segurou = false; e.stopPropagation(); return; }
      const item = achaItem(e.target);
      if (item && item.tipo === 'texto') abrirEdicao(item);
    });
  }

  /* ---------------- tela do relatório pronto ---------------- */
  async function abrirRelatorioPronto(id, local) {
    const tela = $('#telaRelPronto');
    tela.classList.remove('oculto');
    tela.innerHTML = '<div class="carregando" style="padding:60px 20px;text-align:center;color:#667781">Carregando relatório…</div>';

    let rel, itens;
    try {
      if (local) {
        rel = await DB.get('relatorios', id);
        itens = await DB.itensDoRelatorio(id);
        for (const it of itens) {
          if (it.tipo === 'texto') continue;
          const blob = await DB.lerMidia(it.id);
          if (blob) it.src = objURL(blob);
          else if (it.midia) {
            // original já está na nuvem: usa a nuvem quando há internet, senão a miniatura
            const mini = await DB.lerMini(it.id);
            it.src = navigator.onLine ? await Sync.urlMidia(it) : (mini ? objURL(mini) : '');
          }
        }
      } else {
        const r = await Sync.lerRelatorio(id);
        rel = r.rel; itens = r.itens;
      }
    } catch (e) {
      tela.innerHTML = '<button class="rp-voltar" id="rpVoltar">✕</button>' +
        '<div class="aviso" style="margin:80px 20px">Não foi possível abrir este relatório.<br><small>' + esc(e.message) + '</small></div>';
      $('#rpVoltar').onclick = fecharRelatorioPronto;
      return;
    }

    tela.innerHTML = '<button class="rp-voltar" id="rpVoltar">✕</button>' +
      Relatorio.montar(rel, itens, { empresa: st.cfg.empresa, cidade: st.cfg.cidade, logo: st.cfg.logo }) +
      '<div class="rp-barra">' +
      '<button class="sec" id="rpPdf">Baixar PDF</button>' +
      '<button id="rpCompartilhar">Compartilhar</button></div>';

    $('#rpVoltar').onclick = fecharRelatorioPronto;
    $('#rpPdf').onclick = () => window.print();
    $('#rpCompartilhar').onclick = () => {
      const link = location.origin + location.pathname + '#/r/' + id;
      const texto = 'Relatório de visita — ' + (rel.fazenda || '') + '\n' + link;
      if (navigator.share) navigator.share({ title: 'Relatório de visita', text: texto, url: link });
      else { navigator.clipboard.writeText(link); toast('Link copiado'); }
    };
  }

  function fecharRelatorioPronto() {
    $('#telaRelPronto').classList.add('oculto');
    $('#telaRelPronto').innerHTML = '';
    if (location.hash.startsWith('#/r/')) history.replaceState(null, '', location.pathname);
  }

  /* ---------------- eventos ---------------- */
  function ligarEventos() {
    $$('[data-fechar]').forEach(function (b) { b.onclick = function () { fechar(b.dataset.fechar); }; });

    $('#btnMenuLista').onclick = async function () { await listarRelatorios(); abrir('telaLista'); };
    $('#btnMais').onclick = menuMais;
    $('#btnMapa').onclick = function () { desenharMapa(); abrir('telaMapa'); };
    $('#btnAjustes').onclick = async function () { await carregarCfg(); abrir('telaAjustes'); };
    $('#btnNovoRel').onclick = function () { relEdicao = {}; preencherFormulario({}); abrir('telaRel'); };
    $('#btnSalvarRel').onclick = salvarRelatorio;
    $('#btnSalvarCfg').onclick = salvarCfg;
    $('#btnEscolherLogo').onclick = function () { $('#inpLogo').click(); };
    $('#inpLogo').onchange = async function (e) {
      const f = e.target.files[0]; e.target.value = '';
      if (!f) return;
      try {
        st.cfg.logo = await prepararLogo(f);
        await DB.cfg('servidor', st.cfg);
        mostrarLogo();
        toast('Logo carregado — toque em Salvar ajustes');
      } catch (err) { toast('Não consegui ler a imagem: ' + err.message, 4000); }
    };
    $('#btnRemoverLogo').onclick = async function () {
      st.cfg.logo = '';
      await DB.cfg('servidor', st.cfg);
      mostrarLogo();
      toast('Logo removido — toque em Salvar ajustes');
    };
    $('#btnTestar').onclick = testarConexao;
    $('#btnSincronizarTudo').onclick = async function () { toast('Sincronizando…'); const r = await Sync.sincronizar(); toast('Enviados: ' + (r.enviados || 0)); await renderChat(); atualizarSync(); };
    $('#btnRecuperar').onclick = async function () {
      toast('Buscando na nuvem…', 4000);
      try {
        const r = await Sync.restaurarDaNuvem();
        await listarRelatorios(); atualizarSync();
        toast(r.relatorios
          ? 'Recuperei ' + r.relatorios + ' visita(s) e ' + r.itens + ' registro(s). Veja na lista de conversas.'
          : 'Não havia nada novo na nuvem para trazer.', 6000);
      } catch (e) { toast('Não consegui recuperar: ' + e.message, 5000); }
    };
    $('#btnAnexo').onclick = function () { $('#inpArquivo').click(); };

    $('#btnApagarRel').onclick = async function () {
      if (!relEdicao || !relEdicao.id) return;
      if (!confirm('Apagar este relatório e todas as mídias locais?')) return;
      await DB.apagarRelatorio(relEdicao.id);
      relEdicao = null; st.rel = null;
      fechar('telaRel'); await listarRelatorios(); await renderChat();
      $('#tituloRel').textContent = 'Nenhum relatório aberto';
    };

    // texto simples
    const txt = $('#txtMsg');
    txt.addEventListener('input', function () {
      txt.style.height = 'auto'; txt.style.height = Math.min(110, txt.scrollHeight) + 'px';
      atualizarBotaoEnvio();
    });
    txt.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarTexto(); }
    });

    // arquivos (galeria / câmera nativa)
    $('#inpArquivo').onchange = async function (e) {
      const files = Array.prototype.slice.call(e.target.files || []);
      e.target.value = '';
      if (!files.length) return;
      if (!st.rel) { toast('Crie ou abra um relatório primeiro'); return; }
      await adicionarVarios(files);
    };

    ['#inpFoto', '#inpVideo'].forEach(function (sel) {
      $(sel).onchange = async function (e) {
        const f = e.target.files && e.target.files[0]; e.target.value = '';
        if (!f) return;
        await adicionarVarios([f]);
      };
    });

    // KML — entra no cadastro da fazenda
    $('#inpKml').onchange = async function (e) {
      const f = e.target.files[0]; e.target.value = '';
      if (f) await Conta.importarKmlFazenda(f);
    };

    // câmera
    $('#camFechar').onclick = fecharCamera;
    $('#camTrocar').onclick = async function () {
      st.facing = st.facing === 'environment' ? 'user' : 'environment';
      fecharCamera(); await abrirCamera();
    };
    ligarBotaoCamera();
    ligarObturador();

    // visor de mídia
    ligarEdicaoNoChat();

    $('#chat').addEventListener('click', async function (e) {
      const alvo = e.target.closest('[data-abrir]');
      if (!alvo) return;
      const it = st.itens.find(function (i) { return i.id === alvo.dataset.abrir; });
      if (!it) return;
      const blob = await DB.lerMidia(it.id);
      let u = null;
      if (blob) u = objURL(blob);
      else if (it.midia) {
        if (!navigator.onLine) { toast('Sem internet: o original está na nuvem. Conecte para abrir.'); return; }
        u = await Sync.urlMidia(it);
      }
      if (!u) return;
      const v = document.createElement('div'); v.className = 'visor';
      v.innerHTML = '<button class="fechar">✕</button>' +
        (it.tipo === 'foto' ? '<img src="' + u + '">' : '<video src="' + u + '" controls autoplay playsinline></video>');
      v.onclick = function (ev) { if (ev.target === v || ev.target.className === 'fechar') v.remove(); };
      document.body.appendChild(v);
    });

    window.addEventListener('online', atualizarSync);
    window.addEventListener('offline', atualizarSync);
    Sync.aoMudar(async function (evt) {
      if (evt.tipo === 'fim' || evt.tipo === 'liberado') { renderChat(); atualizarSync(); }
      if (evt.tipo === 'item' && evt.estado === 'ok') atualizarSync();
      if (evt.tipo === 'fila') { listarRelatorios(); atualizarSync(); }
      // a fila subiu sozinha quando a internet voltou
      if (evt.tipo === 'publicado') {
        if (st.rel && st.rel.id === evt.id) { st.rel = await DB.get('relatorios', evt.id); await renderChat(); }
        await listarRelatorios(); atualizarSync();
        const r = await DB.get('relatorios', evt.id);
        toast('Relatório de ' + (evt.fazenda || '') + ' publicado — toque para pegar o link', 10000,
          function () { mostrarLink(evt.link, r); });
      }
    });
  }

  /* ---------------- init ---------------- */
  async function init() {
    ligarMedidaDeAltura();
    ligarEventos();
    Conta.ligar();
    // pede ao navegador para não apagar os dados do app quando o aparelho ficar cheio
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persisted().then(function (ja) {
        if (!ja) navigator.storage.persist().catch(function () {});
      }).catch(function () {});
    }
    await carregarCfg();

    // link do relatório: #/r/<id> abre direto a tela do cliente
    const alvo = (location.hash.match(/^#\/r\/(.+)$/) || [])[1];
    if (alvo) {
      abrirRelatorioPronto(alvo, false);
      window.addEventListener('hashchange', function () {
        const a = (location.hash.match(/^#\/r\/(.+)$/) || [])[1];
        if (a) abrirRelatorioPronto(a, false);
      });
    }

    try {
      if (/[?&]recuperar=1/.test(location.search)) {
        localStorage.setItem('vsl-recuperar', '1');
        history.replaceState(null, '', location.pathname);
      }
    } catch (e) {}
    iniciarGPS();
    ligarToqueGps();
    Sync.autoSync();
    const ultimo = await DB.cfg('ultimo');
    if (ultimo) {
      const r = await DB.get('relatorios', ultimo);
      if (r) { await abrirRelatorio(ultimo); }
    }
    if (!(await Sync.logado())) {
      await Conta.mostrarLogin();
    } else {
      await Conta.atualizarCadastro(navigator.onLine);
      await recuperarSeSolicitado();
    }
    if (!st.rel) { await renderChat(); await listarRelatorios(); abrir('telaLista'); }
    atualizarSync();
    atualizarBotaoEnvio();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  }

  // Link de recuperação: amvs.ia.br/?recuperar=1 — traz da nuvem o que sumiu do aparelho
  async function recuperarSeSolicitado() {
    let ped = false;
    try { ped = !!localStorage.getItem('vsl-recuperar'); } catch (e) {}
    if (!ped || !navigator.onLine || !(await Sync.logado())) return;
    try {
      toast('Recuperando seus relatórios da nuvem…', 5000);
      const r = await Sync.restaurarDaNuvem();
      try { localStorage.removeItem('vsl-recuperar'); } catch (e) {}
      await listarRelatorios(); atualizarSync();
      if (r.abertos.length === 1) { await abrirRelatorio(r.abertos[0]); }
      toast(r.relatorios
        ? 'Recuperado: ' + r.relatorios + ' visita(s) e ' + r.itens + ' registro(s). Pode continuar.'
        : 'Não havia nada novo na nuvem para trazer.', 7000);
    } catch (e) { toast('Não consegui recuperar: ' + e.message + '. Abra o link de novo com internet.', 6000); }
  }

  global.App = {
    aoEntrar: async function () {
      await recuperarSeSolicitado();
      await listarRelatorios();
      await renderChat();
      atualizarSync();
      Sync.sincronizar();
    }
  };

  document.addEventListener('DOMContentLoaded', init);
})(window);
