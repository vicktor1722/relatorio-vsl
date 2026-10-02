/* ============================================================
   sync.js — conversa com o servidor (login, cadastro, relatórios)
   Tudo funciona offline: a fila fica no aparelho até a conexão voltar.
   ============================================================ */
(function (global) {
  'use strict';

  let rodando = false;
  const ouvintes = [];
  const emitir = (evt) => ouvintes.forEach(f => { try { f(evt); } catch (e) {} });

  /* A sessão fica guardada em dois lugares (banco do app + localStorage).
     Se um deles for limpo pelo navegador, o outro ainda mantém o login. */
  const CHAVE_LOCAL = 'vsl-sessao';

  function lerLocal() {
    try { return JSON.parse(localStorage.getItem(CHAVE_LOCAL) || 'null'); } catch (e) { return null; }
  }
  function gravarLocal(c) {
    try {
      localStorage.setItem(CHAVE_LOCAL, JSON.stringify({
        api: c.api || '', token: c.token || null, nome: c.nome || '', email: c.email || ''
      }));
    } catch (e) {}
  }

  async function conf() {
    let c = null;
    try { c = await DB.cfg('servidor'); } catch (e) { c = null; }
    c = c || {};
    const l = lerLocal();
    if (!c.token && l && l.token) {          // banco limpo: recupera do localStorage
      c.token = l.token;
      c.nome = c.nome || l.nome || '';
      c.email = c.email || l.email || '';
      if (!c.api && l.api) c.api = l.api;
      try { await DB.cfg('servidor', c); } catch (e) {}
    }
    if (!c.api) c.api = 'https://relatorio-vsl.vicktorlima17.workers.dev';
    return c;
  }

  async function salvarConf(novo) {
    const c = Object.assign(await conf(), novo || {});
    await DB.cfg('servidor', c);
    gravarLocal(c);
    return c;
  }

  async function chamar(rota, opcoes) {
    const o = opcoes || {};
    const c = await conf();
    const cab = Object.assign({}, o.headers || {});
    if (c.token) cab.Authorization = 'Bearer ' + c.token;

    // nunca deixa a tela travada esperando a rede
    const corte = new AbortController();
    const relogio = setTimeout(function () { corte.abort(); }, o.timeout || 20000);
    let r;
    try {
      r = await fetch(c.api.replace(/\/$/, '') + rota, {
        method: o.method || 'GET', headers: cab, body: o.body, signal: corte.signal
      });
    } catch (e) {
      clearTimeout(relogio);
      throw new Error(e.name === 'AbortError' ? 'servidor não respondeu' : 'sem conexão');
    }
    clearTimeout(relogio);
    const txt = await r.text();
    let j = null; try { j = JSON.parse(txt); } catch (e) {}
    if (r.status === 401) { emitir({ tipo: 'sem-sessao' }); throw new Error('sessão expirada'); }
    if (!r.ok) throw new Error((j && j.erro) || ('HTTP ' + r.status));
    return j;
  }

  const comJson = (rota, dados, metodo) => chamar(rota, {
    method: metodo || 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados)
  });

  /* ---------------- conta ---------------- */

  async function entrar(email, senha) {
    const r = await comJson('/api/entrar', { email, senha });
    await salvarConf({ token: r.token, nome: r.nome, email: r.email });
    return r;
  }

  async function registrar(dados) {
    const r = await comJson('/api/registrar', dados);
    await salvarConf({ token: r.token, nome: r.nome, email: r.email });
    return r;
  }

  async function sair() {
    try { localStorage.removeItem(CHAVE_LOCAL); } catch (e) {}
    await salvarConf({ token: null });
    await DB.cfg('cadastro', { produtores: [], fazendas: [], safras: [], em: null });
  }

  async function logado() {
    const c = await conf();
    return !!c.token;
  }

  async function quemSou() {
    const c = await conf();
    return { nome: c.nome || '', email: c.email || '', api: c.api };
  }

  /* ---------------- identidade da empresa ---------------- */

  async function salvarPerfil(perfil) {
    if (!(await logado())) return null;
    return comJson('/api/perfil', perfil);
  }

  async function baixarPerfil() {
    if (!(await logado())) return null;
    const r = await chamar('/api/perfil');
    return r.perfil || null;
  }

  /* ---------------- cadastro ---------------- */

  async function cadastroLocal() {
    const c = (await DB.cfg('cadastro')) || { produtores: [], fazendas: [], em: null };
    if (!c.safras) c.safras = [];
    return c;
  }

  async function baixarCadastro() {
    const r = await chamar('/api/cadastro');
    const dados = { produtores: r.produtores || [], fazendas: r.fazendas || [], safras: r.safras || [], em: new Date().toISOString() };
    dados.fazendas.forEach(function (f) {
      if (typeof f.talhoes === 'string' && f.talhoes) {
        try { f.talhoes = JSON.parse(f.talhoes); } catch (e) { f.talhoes = null; }
      }
    });
    await DB.cfg('cadastro', dados);
    emitir({ tipo: 'cadastro' });
    return dados;
  }

  async function salvarSafra(s) {
    const r = await comJson('/api/safra', s);
    await baixarCadastro();
    return r.id;
  }

  async function salvarProdutor(p) {
    const r = await comJson('/api/produtor', p);
    await baixarCadastro();
    return r.id;
  }

  async function salvarFazenda(f) {
    const r = await comJson('/api/fazenda', f);
    await baixarCadastro();
    return r.id;
  }

  async function apagarCadastro(tipo, id) {
    await comJson('/api/apagar', { tipo, id });
    await baixarCadastro();
  }

  /* ---------------- relatórios ---------------- */

  async function enviarRelatorio(rel) {
    await comJson('/api/relatorio', {
      id: rel.id, produtor_id: rel.produtor_id || null, fazenda_id: rel.fazenda_id || null,
      produtor: rel.produtor, fazenda: rel.fazenda, safra: rel.safra, servico: rel.servico,
      responsavel: rel.responsavel, data_inicio: rel.data_inicio, data_fim: rel.data_fim,
      observacoes: rel.observacoes, talhoes: rel.talhoes,
      status: rel.status, publicado_em: rel.publicado_em
    });
  }

  async function enviarItem(item) {
    let midia = item.midia || null;
    if (item.tipo !== 'texto' && !midia) {
      const blob = await DB.lerMidia(item.id);
      if (!blob) throw new Error('mídia ausente no aparelho');
      const r = await chamar('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': item.mime || 'application/octet-stream',
          'X-Item-Id': item.id, 'X-Rel-Id': item.relatorio_id
        },
        body: blob,
        timeout: 120000
      });
      midia = r.midia;
    }
    await comJson('/api/item', {
      id: item.id, relatorio_id: item.relatorio_id, tipo: item.tipo,
      legenda: item.legenda || '', midia: midia, mime: item.mime,
      duracao_s: item.duracao_s, bytes: item.bytes,
      lat: item.lat, lon: item.lon, precisao_m: item.precisao_m, altitude_m: item.altitude_m,
      talhao: item.talhao, talhao_id: item.talhao_id,
      capturado_em: item.capturado_em, ordem: item.ordem
    });
    item.midia = midia;
    item.sync_state = 'ok';
    item.erro = null;
    await DB.put('itens', item);
  }


  /* ---------------- liberar o aparelho depois de sincronizar ----------------
     A foto/vídeo fica guardada no aparelho até subir. Só depois de conferir que o
     arquivo está de fato na nuvem é que o original sai do aparelho (fica a miniatura). */

  async function urlMidia(item) {
    if (!item || !item.midia) return null;
    const c = await conf();
    return c.api.replace(/\/$/, '') + '/img/' + encodeURIComponent(item.midia);
  }

  async function estaNaNuvem(item) {
    try {
      const u = await urlMidia(item); if (!u) return false;
      const corte = new AbortController();
      const t = setTimeout(function () { corte.abort(); }, 15000);
      const r = await fetch(u, { signal: corte.signal, cache: 'no-store' });
      clearTimeout(t);
      const ok = r.ok;
      try { if (r.body) r.body.cancel(); } catch (e) {}
      return ok;
    } catch (e) { return false; }
  }

  function miniatura(blob) {
    return new Promise(function (res) {
      const u = URL.createObjectURL(blob);
      const im = new Image();
      im.onload = function () {
        try {
          const lado = Math.max(im.naturalWidth, im.naturalHeight) || 1;
          const e = Math.min(1, 720 / lado);
          const cv = document.createElement('canvas');
          cv.width = Math.max(1, Math.round(im.naturalWidth * e));
          cv.height = Math.max(1, Math.round(im.naturalHeight * e));
          cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
          cv.toBlob(function (b) {
            URL.revokeObjectURL(u);
            if (!b) return res(null);
            b.arrayBuffer().then(function (buf) { res({ bytes: buf, tipo: 'image/jpeg' }); }, function () { res(null); });
          }, 'image/jpeg', 0.72);
        } catch (e) { URL.revokeObjectURL(u); res(null); }
      };
      im.onerror = function () { URL.revokeObjectURL(u); res(null); };
      im.src = u;
    });
  }

  async function liberarItem(item) {
    if (!item || item.tipo === 'texto' || item.sync_state !== 'ok' || !item.midia) return false;
    if (!(await DB.temOriginal(item.id))) return false;
    if (!(await estaNaNuvem(item))) return false;          // sem confirmação, o original fica
    let mini = null;
    if (item.tipo === 'foto') {
      const blob = await DB.lerMidia(item.id);
      mini = blob ? await miniatura(blob) : null;
      if (!mini) return false;                              // não deu para gerar a miniatura: não arrisca
    }
    await DB.liberarMidia(item.id, mini);
    return true;
  }

  async function liberarSincronizados() {
    if (!navigator.onLine) return 0;
    let n = 0;
    try {
      const todos = await DB.all('itens');
      for (const it of todos) { if (await liberarItem(it)) n++; }
    } catch (e) {}
    if (n) emitir({ tipo: 'liberado', n: n });
    return n;
  }

  async function sincronizar(relIdOpcional) {
    if (rodando) return { rodando: true };
    if (!(await logado())) { emitir({ tipo: 'sem-sessao' }); return { erro: 'sem-sessao' }; }
    if (!navigator.onLine) { emitir({ tipo: 'offline' }); return { erro: 'offline' }; }

    rodando = true; emitir({ tipo: 'inicio' });
    let enviados = 0, falhas = 0;
    try {
      const relatorios = await DB.all('relatorios');
      for (const rel of relatorios) {
        if (relIdOpcional && rel.id !== relIdOpcional) continue;
        try { await enviarRelatorio(rel); }
        catch (e) { falhas++; emitir({ tipo: 'erro', msg: e.message }); continue; }

        const itens = (await DB.itensDoRelatorio(rel.id)).filter(i => i.sync_state !== 'ok');
        for (const item of itens) {
          try {
            item.sync_state = 'enviando'; await DB.put('itens', item);
            emitir({ tipo: 'item', id: item.id, estado: 'enviando' });
            await enviarItem(item);
            enviados++; emitir({ tipo: 'item', id: item.id, estado: 'ok' });
            try { await liberarItem(item); } catch (e) {}
          } catch (e) {
            item.sync_state = 'erro'; item.erro = e.message; await DB.put('itens', item);
            falhas++; emitir({ tipo: 'item', id: item.id, estado: 'erro', msg: e.message });
          }
        }
      }
    } finally {
      rodando = false;
      emitir({ tipo: 'fim', enviados, falhas });
    }
    return { enviados, falhas };
  }

  async function publicar(rel) {
    if (!(await logado())) throw new Error('entre na sua conta para publicar');
    await sincronizar(rel.id);
    const pend = (await DB.itensDoRelatorio(rel.id)).filter(i => i.sync_state !== 'ok');
    if (pend.length) throw new Error(pend.length + ' item(ns) ainda não subiram. Tente de novo com internet.');

    rel.status = 'publicado';
    rel.publicado_em = new Date().toISOString();
    rel.na_fila = false;
    await DB.put('relatorios', rel);
    await enviarRelatorio(rel);
    const r = await comJson('/api/publicar', { id: rel.id });
    return r.link;
  }

  /* ---------------- fila de publicação (offline) ----------------
     Sem internet o relatório é marcado como "na fila": fica fechado para
     edição, guardado no aparelho, e sobe sozinho quando a conexão voltar. */

  async function marcarParaEnvio(rel) {
    rel.na_fila = true;
    rel.status = 'fila';
    rel.fila_desde = new Date().toISOString();
    await DB.put('relatorios', rel);
    emitir({ tipo: 'fila', id: rel.id });
    return rel;
  }

  async function cancelarEnvio(rel) {
    rel.na_fila = false;
    rel.status = 'rascunho';
    await DB.put('relatorios', rel);
    emitir({ tipo: 'fila', id: rel.id });
    return rel;
  }

  // chamada pelo autoSync: tenta publicar tudo que está esperando
  let publicando = false;
  async function publicarPendentes() {
    if (publicando) return [];
    if (!navigator.onLine) return [];
    if (!(await logado())) return [];
    publicando = true;
    const prontos = [];
    try {
      const rels = (await DB.all('relatorios')).filter(function (r) {
        return r.na_fila && r.status !== 'publicado';
      });
      for (const rel of rels) {
        try {
          const link = await publicar(rel);
          prontos.push({ rel: rel, link: link });
          emitir({ tipo: 'publicado', id: rel.id, link: link, fazenda: rel.fazenda || '' });
        } catch (e) {
          emitir({ tipo: 'fila-erro', id: rel.id, msg: e.message });
        }
      }
    } finally {
      publicando = false;
    }
    return prontos;
  }

  async function status() {
    const c = await conf();
    const r = await fetch(c.api.replace(/\/$/, '') + '/api/status');
    return r.json();
  }

  let emRodada = false;
  async function rodada() {
    if (emRodada || !navigator.onLine) return;
    emRodada = true;
    try {
      await sincronizar();
      await publicarPendentes();
      await liberarSincronizados();
    } finally {
      emRodada = false;
    }
  }

  function autoSync() {
    window.addEventListener('online', function () { setTimeout(rodada, 1200); });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && navigator.onLine) rodada();
    });
    setInterval(rodada, 60000);
    if (navigator.onLine) setTimeout(rodada, 2500);
  }

  global.Sync = {
    conf, salvarConf, entrar, registrar, sair, logado, quemSou,
    cadastroLocal, baixarCadastro, salvarProdutor, salvarFazenda, salvarSafra, apagarCadastro,
    salvarPerfil, baixarPerfil,
    urlMidia, liberarSincronizados, sincronizar, publicar, marcarParaEnvio, cancelarEnvio, publicarPendentes, rodada,
    status, autoSync, aoMudar: f => ouvintes.push(f)
  };
})(window);
