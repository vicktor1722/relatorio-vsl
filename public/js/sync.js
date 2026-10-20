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
    if (r.status === 401) {
      // no login, 401 quer dizer e-mail/senha errados — não é sessão expirada
      if (rota === '/api/entrar' || rota === '/api/registrar') throw new Error((j && j.erro) || 'e-mail ou senha incorretos');
      emitir({ tipo: 'sem-sessao' }); throw new Error('sessão expirada');
    }
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
    DB.setDono(null);
    await salvarConf({ token: null });
    await DB.cfg('cadastro', { produtores: [], fazendas: [], safras: [], responsaveis: [], em: null });
  }

  /* ---------------- de quem são os dados deste aparelho ---------------- */
  // id da conta que está logada (vem de dentro do token)
  async function meuId() {
    const c = await conf();
    if (!c || !c.token) return null;
    try {
      const corpo = String(c.token).split('.')[0].replace(/-/g, '+').replace(/_/g, '/');
      const m = /"id":"([^"]+)"/.exec(atob(corpo + '==='.slice((corpo.length + 3) % 4)));
      return m ? m[1] : null;
    } catch (e) { return null; }
  }

  // Define o dono dos dados que aparecem agora e separa o que é de outra conta.
  // Relatórios antigos (sem dono) ficam com quem tem a fazenda/produtor deles no cadastro; os outros
  // ficam escondidos (não são apagados) e voltam quando a conta certa entrar.
  async function fixarDono() {
    const id = await meuId();
    DB.setDono(id);
    if (!id) return { id: null, mudou: false };
    const antes = await DB.cfg('ultimoDono');
    const mudou = !!antes && antes !== id;
    await DB.cfg('ultimoDono', id);
    const cad = mudou ? { fazendas: [], produtores: [] } : await cadastroLocal();   // na troca de conta o cadastro guardado ainda é o da outra
    const fz = new Set((cad.fazendas || []).map(function (f) { return f.id; }));
    const pr = new Set((cad.produtores || []).map(function (p) { return p.id; }));
    const temCad = fz.size > 0 || pr.size > 0;
    const mapa = {};
    for (const r of await DB.todos('relatorios')) {
      let d;
      if (r.dono && r.dono !== '?' && r.dono !== id) d = r.dono;                       // já é de outra conta
      else if (r.dono === id) d = id;
      else if ((r.fazenda_id && fz.has(r.fazenda_id)) || (r.produtor_id && pr.has(r.produtor_id))) d = id;
      else if (!r.fazenda_id && !r.produtor_id) d = temCad || !mudou ? id : '?';       // sem vínculo: fica com quem usa
      else if (temCad || mudou) d = '?';                                               // é de outra conta: esconde
      else d = r.dono;                                                                  // sem cadastro para julgar: não mexe
      mapa[r.id] = d;
      if (d !== undefined && d !== r.dono) { r.dono = d; await DB.putRaw('relatorios', r); }
    }
    for (const i of await DB.todos('itens')) {
      const d = mapa[i.relatorio_id];
      if (d !== undefined && i.dono !== d) { i.dono = d; await DB.putRaw('itens', i); }
    }
    return { id: id, mudou: mudou };
  }

  // Troca de conta: limpa só a identidade (empresa, logo, cadastro). Os relatórios ficam guardados no aparelho,
  // escondidos, até a conta deles entrar de novo.
  async function limparIdentidadeLocal() {
    const c = await conf();
    delete c.empresa; delete c.cidade; delete c.telefone; delete c.email; delete c.logo;
    await DB.cfg('servidor', c);
    await DB.cfg('cadastro', { produtores: [], fazendas: [], safras: [], responsaveis: [], em: null });
    await DB.cfg('ultimo', null);
  }

  // Outra conta entrou neste aparelho: zera tudo que era da conta anterior
  // (relatórios, fotos, identidade da empresa, cadastro). Mantém só o login e o endereço do servidor.
  async function limparDadosLocais() {
    for (const loja of ['relatorios', 'itens', 'midias']) await DB.limpar(loja);
    const c = await conf();
    delete c.empresa; delete c.cidade; delete c.telefone; delete c.email; delete c.logo;
    await DB.cfg('servidor', c);
    await DB.cfg('cadastro', { produtores: [], fazendas: [], safras: [], responsaveis: [], em: null });
    await DB.cfg('ultimo', null);
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
    if (!c.responsaveis) c.responsaveis = [];
    return c;
  }

  async function baixarCadastro() {
    const r = await chamar('/api/cadastro');
    const dados = { produtores: r.produtores || [], fazendas: r.fazendas || [], safras: r.safras || [], responsaveis: r.responsaveis || [], max_responsaveis: r.max_responsaveis || 4, em: new Date().toISOString() };
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

  async function salvarResponsavel(nome) {
    const r = await comJson('/api/responsavel', { nome: nome });
    await baixarCadastro();
    return r.id;
  }

  let repetidoNoServidor = false;   // o último cadastro já existia na conta (outro aparelho tinha criado)

  async function salvarProdutor(p) {
    const r = await comJson('/api/produtor', p);
    repetidoNoServidor = !!r.repetido;
    await baixarCadastro();
    return r.id;
  }

  async function salvarFazenda(f) {
    const r = await comJson('/api/fazenda', f);
    repetidoNoServidor = !!r.repetido;
    await baixarCadastro();
    return r.id;
  }

  async function apagarCadastro(tipo, id) {
    await comJson('/api/apagar', { tipo, id });
    await baixarCadastro();
  }

  /* ---------------- relatórios ---------------- */

  function payloadRel(rel) {
    return {
      id: rel.id, produtor_id: rel.produtor_id || null, fazenda_id: rel.fazenda_id || null,
      produtor: rel.produtor, fazenda: rel.fazenda, safra: rel.safra, servico: rel.servico,
      responsavel: rel.responsavel, data_inicio: rel.data_inicio, data_fim: rel.data_fim,
      observacoes: rel.observacoes, talhoes: rel.talhoes,
      status: rel.status, publicado_em: rel.publicado_em
    };
  }
  async function enviarRelatorio(rel) {
    await comJson('/api/relatorio', payloadRel(rel));
  }

  // Assinatura do que já foi enviado de cada relatório: se nada mudou e não há item pendente,
  // a rodada pula o relatório em vez de refazer uma chamada de rede por relatório a cada minuto.
  let sigs = null;
  async function carregarSigs() {
    if (sigs) return;
    try { sigs = (await DB.cfg('sigRel')) || {}; } catch (e) { sigs = {}; }
    if (!sigs._t || Date.now() - sigs._t > 6 * 3600 * 1000) sigs = { _t: Date.now() };   // a cada 6 h confere tudo de novo
  }
  async function salvarSigs() { try { await DB.cfg('sigRel', sigs); } catch (e) {} }

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

  // Endereço que vai nos links dos clientes: sempre o domínio próprio, mesmo que este aparelho
  // tenha aberto/instalado o app pelo endereço antigo (workers.dev).
  const DOMINIO_PUBLICO = 'https://amvs.ia.br';
  async function baseLink() {
    const c = await conf();
    let b = String(c.api || '').replace(/\/$/, '');
    try { if (/\.workers\.dev$/i.test(new URL(b).hostname)) b = DOMINIO_PUBLICO; } catch (e) {}
    return b || DOMINIO_PUBLICO;
  }
  function linkPublico(link) {
    return String(link || '').replace(/^https?:\/\/[^/]*\.workers\.dev/i, DOMINIO_PUBLICO);
  }

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

  // Traz de volta o que a conta já enviou para a nuvem e não está mais neste aparelho
  // (relatórios e registros; as fotos continuam na nuvem e aparecem de lá).
  async function restaurarDaNuvem() {
    if (!navigator.onLine) throw new Error('sem conexão');
    const j = await chamar('/api/restaurar');
    const locais = new Set((await DB.all('relatorios')).map(function (r) { return r.id; }));
    const novos = (j.relatorios || []).filter(function (r) { return !locais.has(r.id); });
    const ids = new Set(novos.map(function (r) { return r.id; }));
    let nRel = 0, nIt = 0;
    for (const r of novos) {
      let talh = r.talhoes;
      if (typeof talh === 'string') { try { talh = talh ? JSON.parse(talh) : null; } catch (e) { talh = null; } }
      await DB.put('relatorios', {
        id: r.id, produtor_id: r.produtor_id || null, fazenda_id: r.fazenda_id || null,
        produtor: r.produtor || '', fazenda: r.fazenda || '', safra: r.safra || '', servico: r.servico || '',
        responsavel: r.responsavel || '', data_inicio: r.data_inicio, data_fim: r.data_fim,
        observacoes: r.observacoes || '', talhoes: talh || null,
        status: r.status || 'rascunho', publicado_em: r.publicado_em || null,
        criado_em: r.criado_em || new Date().toISOString()
      });
      nRel++;
    }
    const jaTem = new Set((await DB.all('itens')).map(function (i) { return i.id; }));
    for (const i of (j.itens || [])) {
      if (!ids.has(i.relatorio_id) || jaTem.has(i.id)) continue;
      await DB.put('itens', Object.assign({}, i, { sync_state: 'ok', erro: null }));
      nIt++;
    }
    return {
      relatorios: nRel, itens: nIt,
      abertos: novos.filter(function (r) { return r.status !== 'publicado'; }).map(function (r) { return r.id; })
    };
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
    if (!(await logado())) { emitir({ tipo: 'sem-sessao' }); return { erro: 'sem-sessao' }; }
    if (!navigator.onLine) { emitir({ tipo: 'offline' }); return { erro: 'offline' }; }
    // pedido de um relatório específico (ex.: acabou de salvar uma foto) espera a rodada em andamento
    // terminar, em vez de ser descartado e só subir no próximo minuto
    while (rodando) {
      if (!relIdOpcional) return { rodando: true };
      await new Promise(function (r) { setTimeout(r, 300); });
    }
    rodando = true; emitir({ tipo: 'inicio' });
    let enviados = 0, falhas = 0;
    try {
      await carregarSigs();
      const relatorios = await DB.all('relatorios');
      // o que está na fila de publicação vai primeiro
      relatorios.sort(function (a, b) { return (b.na_fila ? 1 : 0) - (a.na_fila ? 1 : 0); });
      for (const rel of relatorios) {
        if (relIdOpcional && rel.id !== relIdOpcional) continue;
        const itens = (await DB.itensDoRelatorio(rel.id)).filter(i => i.sync_state !== 'ok');
        const sig = JSON.stringify(payloadRel(rel));
        if (!itens.length && sigs[rel.id] === sig) continue;          // nada mudou: não gasta rede
        try { await enviarRelatorio(rel); sigs[rel.id] = sig; }
        catch (e) { falhas++; emitir({ tipo: 'erro', msg: e.message }); continue; }

        let prox = 0;
        const trabalhador = async function () {
          while (prox < itens.length) {
            const item = itens[prox++];
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
        };
        await Promise.all([trabalhador(), trabalhador(), trabalhador()]);   // até 3 itens ao mesmo tempo
      }
    } finally {
      rodando = false;
      await salvarSigs();
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
    // término = dia em que o relatório foi fechado (se ficou na fila offline, o dia em que entrou na fila)
    rel.data_fim = diaLocal(rel.fila_desde || rel.publicado_em);
    rel.na_fila = false;
    await DB.put('relatorios', rel);
    await enviarRelatorio(rel);
    const r = await comJson('/api/publicar', { id: rel.id });
    return linkPublico(r.link);
  }

  /* ---------------- fila de publicação (offline) ----------------
     Sem internet o relatório é marcado como "na fila": fica fechado para
     edição, guardado no aparelho, e sobe sozinho quando a conexão voltar. */

  // dia (AAAA-MM-DD) no fuso do aparelho
  function diaLocal(iso) {
    const d = iso ? new Date(iso) : new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  async function marcarParaEnvio(rel) {
    rel.na_fila = true;
    rel.status = 'fila';
    rel.fila_desde = new Date().toISOString();
    rel.data_fim = diaLocal(rel.fila_desde);
    await DB.put('relatorios', rel);
    emitir({ tipo: 'fila', id: rel.id });
    return rel;
  }

  async function cancelarEnvio(rel) {
    rel.na_fila = false;
    rel.fila_desde = null;
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
      await publicarPendentes();      // o que está na fila de publicação vai primeiro
      await sincronizar();
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
    cadastroLocal, baixarCadastro, salvarProdutor, salvarFazenda, salvarSafra, salvarResponsavel, apagarCadastro,
    salvarPerfil, baixarPerfil,
    meuId, fixarDono, limparIdentidadeLocal, limparDadosLocais, restaurarDaNuvem, baseLink, linkPublico, foiRepetido: function () { return repetidoNoServidor; }, urlMidia, liberarSincronizados, sincronizar, publicar, marcarParaEnvio, cancelarEnvio, publicarPendentes, rodada,
    status, autoSync, aoMudar: f => ouvintes.push(f)
  };
})(window);
