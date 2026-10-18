/* ============================================================
   agro.js — telas de Plantio dos talhões e Recomendações (módulos novos)
   Só aparecem quando a conta tem o módulo liberado (GET /api/modulos).
   Funciona sem internet: guarda uma cópia no aparelho e uma fila de envios.
   ============================================================ */
(function (global) {
  'use strict';

  var LS = 'agro_v1';
  var ST = { email: '', mod: { plantio: false, recomendacoes: false, admin: false }, plantio: [], recs: [], produtos: [], fila: [], ult: {} };

  var CULTURAS = [['soja', 'Soja'], ['milho', 'Milho'], ['algodao', 'Algodão'], ['feijao', 'Feijão'], ['sorgo', 'Sorgo'],
    ['pastagem', 'Pastagem'], ['pousio', 'Pousio'], ['outra', 'Outra cultura']];
  var NOME_CULT = {}; CULTURAS.forEach(function (c) { NOME_CULT[c[0]] = c[1]; });
  var OPS = ['Dessecação', 'Adubação de base', 'Adubação de cobertura', 'Plantio', 'Fungicida', 'Inseticida', 'Herbicida pós'];
  var TIPOS = ['Herbicida', 'Fungicida', 'Inseticida', 'Fertilizante', 'Corretivo', 'Adjuvante', 'Semente', 'Outro'];
  var UNIDADES = ['L/ha', 'mL/ha', 'kg/ha', 'g/ha', 't/ha'];
  var MODELOS = {
    'Dessecação pré-plantio': ['Dessecação', [['Glifosato 480', 2, 'L/ha'], ['Óleo mineral', 0.5, 'L/ha']]],
    'Fungicida na soja': ['Fungicida', [['Fungicida duplo mix', 0.4, 'L/ha'], ['Óleo mineral', 0.5, 'L/ha']]],
    'Adubação de base': ['Adubação de base', [['MAP', 200, 'kg/ha'], ['Cloreto de potássio (KCl 60%)', 150, 'kg/ha']]],
    'Inseticida': ['Inseticida', [['Inseticida piretroide', 0.15, 'L/ha']]]
  };
  var PADRAO = [
    ['Glifosato 480', 'Herbicida', 'glifosato 480 g/L', 2, 'L/ha', 0], ['Cletodim 240', 'Herbicida', 'cletodim 240 g/L', 0.4, 'L/ha', 0],
    ['Atrazina 500', 'Herbicida', 'atrazina 500 g/L', 3, 'L/ha', 0], ['Fungicida duplo mix', 'Fungicida', 'estrobilurina + triazol', 0.4, 'L/ha', 14],
    ['Fungicida multissítio', 'Fungicida', 'mancozebe 750 g/kg', 1.5, 'kg/ha', 10], ['Inseticida piretroide', 'Inseticida', 'lambda-cialotrina 50 g/L', 0.15, 'L/ha', 10],
    ['Inseticida neonicotinoide', 'Inseticida', 'imidacloprido + bifentrina', 0.25, 'L/ha', 14], ['Cloreto de potássio (KCl 60%)', 'Fertilizante', '60% K2O', 150, 'kg/ha', 0],
    ['MAP', 'Fertilizante', '52% P2O5 · 11% N', 200, 'kg/ha', 0], ['Superfosfato simples', 'Fertilizante', '18% P2O5 · 12% S', 300, 'kg/ha', 0],
    ['Calcário dolomítico', 'Corretivo', 'PRNT 85%', 2, 't/ha', 0], ['Gesso agrícola', 'Corretivo', '16% Ca · 15% S', 1, 't/ha', 0],
    ['Óleo mineral', 'Adjuvante', 'óleo mineral 760 g/L', 0.5, 'L/ha', 0], ['Semente de soja', 'Semente', 'cultivar a definir', 60, 'kg/ha', 0],
    ['Semente de braquiária', 'Semente', 'B. Marandu · VC 70%', 8, 'kg/ha', 0]
  ];

  /* ---------------- ajudantes ---------------- */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var p2 = function (n) { return ('0' + n).slice(-2); };
  function hoje() { var d = new Date(); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
  function fmt(n, d) { return Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: d == null ? 1 : d, maximumFractionDigits: d == null ? 1 : d }); }
  function numBR(v) {
    v = String(v == null ? '' : v).trim(); if (!v) return 0;
    if (v.indexOf(',') >= 0) v = v.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(v)) v = v.replace(/\./g, '');
    var n = parseFloat(v); return isNaN(n) ? 0 : n;
  }
  function dataBR(i) { var p = String(i || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '—'; }
  function curta(i) { return dataBR(i).slice(0, 5); }
  function addDias(iso, n) { var d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function difDias(a, b) { return Math.round((new Date(a + 'T12:00:00Z') - new Date(b + 'T12:00:00Z')) / 864e5); }
  function novoId(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function cp(o) { return JSON.parse(JSON.stringify(o)); }
  function toast(m) { if (global.App && App.toast) App.toast(m); else { var e = document.createElement('div'); e.className = 'toast'; e.textContent = m; document.body.appendChild(e); setTimeout(function () { e.remove(); }, 2600); } }
  var FEM = /^(Dessecação|Adubação|Outra)/;
  function ordTxt(op, n) { return n + (FEM.test(op) ? 'ª ' : 'º ') + op; }
  function unid(u) { return String(u || '').split('/')[0]; }
  function liquido(u) { return /^(L|mL)\//.test(String(u || '')); }
  function volTotal(v, u) { return fmt(v, v < 10 ? 1 : 0) + ' ' + unid(u); }
  function doseTxt(d) { return fmt(d, d < 1 ? 2 : (d % 1 ? 1 : 0)); }
  function tanques(ha, hat, calda) {
    var n = Math.floor(ha / hat + 1e-9), resto = Math.round((ha - n * hat) * 10) / 10;
    var t = n + (n === 1 ? ' tanque cheio' : ' tanques cheios');
    if (resto > 0.05) t += ' + 1 com ' + fmt(resto) + ' ha (' + fmt(resto * calda, 0) + ' L de calda)';
    return t;
  }
  function espDe(c, esp) { return esp || (c === 'soja' ? 50 : c === 'milho' ? 70 : 0); }
  function daeDe(emerg) { if (!emerg) return null; var n = difDias(hoje(), emerg); return n >= 0 ? n : null; }

  /* ---------------- guardar / carregar ---------------- */
  function carregar() {
    try {
      var o = JSON.parse(localStorage.getItem(LS) || 'null');
      if (o && typeof o === 'object') Object.keys(ST).forEach(function (k) { if (o[k] !== undefined) ST[k] = o[k]; });
    } catch (e) { /* começa vazio */ }
  }
  function gravar() { try { localStorage.setItem(LS, JSON.stringify(ST)); } catch (e) { /* sem espaço */ } }

  /* ---------------- servidor ---------------- */
  async function chamar(rota, corpo) {
    var c = await Sync.conf();
    if (!c.token) { var e0 = new Error('sem login'); e0.rede = true; throw e0; }
    var corte = new AbortController(), t = setTimeout(function () { corte.abort(); }, 20000), r;
    try {
      r = await fetch(c.api.replace(/\/$/, '') + rota, {
        method: corpo === undefined ? 'GET' : 'POST',
        headers: Object.assign({ Authorization: 'Bearer ' + c.token }, corpo === undefined ? {} : { 'Content-Type': 'application/json' }),
        body: corpo === undefined ? undefined : JSON.stringify(corpo), signal: corte.signal
      });
    } catch (e) { clearTimeout(t); var er = new Error('sem conexão'); er.rede = true; throw er; }
    clearTimeout(t);
    var j = null; try { j = await r.json(); } catch (e) { /* sem corpo */ }
    if (!r.ok) { var eh = new Error((j && j.erro) || ('HTTP ' + r.status)); eh.status = r.status; throw eh; }
    return j;
  }

  var enviando = false;
  async function descarregar() {
    if (enviando) return; enviando = true;
    try {
      while (ST.fila.length) {
        var it = ST.fila[0];
        try { await chamar(it.rota, it.corpo); ST.fila.shift(); gravar(); }
        catch (e) {
          if (e.rede) break;
          ST.fila.shift(); gravar(); toast('Não salvou na nuvem: ' + e.message);
        }
      }
    } finally { enviando = false; }
  }
  function enfileirar(rota, corpo) { ST.fila.push({ rota: rota, corpo: corpo }); gravar(); if (navigator.onLine) descarregar(); }

  async function atualizarModulos() {
    try {
      var c0 = await Sync.conf(), uid0 = (await Sync.meuId()) || '';
      if ((c0.email || '') !== (ST.email || '') || (uid0 && ST.uid && ST.uid !== uid0)) { ST = { email: c0.email || '', uid: uid0, mod: { plantio: false, recomendacoes: false, admin: false }, plantio: [], recs: [], produtos: [], fila: [], ult: {} }; gravar(); }
      else if (uid0 && !ST.uid) { ST.uid = uid0; gravar(); }
      var m = await chamar('/api/modulos');
      ST.mod = { plantio: !!m.plantio, recomendacoes: !!m.recomendacoes, admin: !!m.admin };
      ST.erroMod = '';
      ST.checado = true;
      gravar();
    } catch (e) {
      // mantém o que já sabia, mas guarda o motivo para mostrar na tela do mapa
      ST.erroMod = e && e.rede ? 'sem conexão' : ((e && e.status ? e.status + ' ' : '') + ((e && e.message) || 'erro'));
      try { gravar(); } catch (e2) { /* sem espaço */ }
    }
    botoes();
  }

  async function baixar() {
    if (!navigator.onLine) return false;
    await descarregar();
    if (ST.fila.length) return false;
    try {
      var tudo = await Promise.all([
        ST.mod.plantio ? chamar('/api/agro/plantio') : null,
        ST.mod.recomendacoes ? chamar('/api/agro/recs') : null,
        ST.mod.recomendacoes ? chamar('/api/agro/produtos') : null
      ]);
      if (ST.fila.length) return false;
      if (tudo[0]) ST.plantio = tudo[0].plantio || [];
      if (tudo[1]) ST.recs = tudo[1].recs || [];
      if (tudo[2]) ST.produtos = tudo[2].produtos || [];
      gravar();
      return true;
    } catch (e) { return false; }
  }

  /* ---------------- cadastro (fazendas, safras) ---------------- */
  function cad() { return (global.Conta && Conta.dados && Conta.dados()) || {}; }
  function fazendas() { return (cad().fazendas || []).filter(function (f) { return f.talhoes && f.talhoes.features && f.talhoes.features.length; }); }
  function fazDe(id) { return (cad().fazendas || []).filter(function (f) { return f.id === id; })[0]; }
  function safras() { return (cad().safras || []).map(function (s) { return s.nome; }); }
  function talhoesDe(f) {
    if (!f || !f.talhoes || !f.talhoes.features) return [];
    return f.talhoes.features.map(function (ft) { var p = ft.properties || {}; return { nome: String(p.nome || ''), ha: Number(p.area_ha) || 0, f: ft }; }).filter(function (t) { return t.nome; });
  }
  function haDe(f, nomes) { var h = 0; talhoesDe(f).forEach(function (t) { if (nomes.indexOf(t.nome) >= 0) h += t.ha; }); return Math.round(h * 10) / 10; }
  // quando aberto pelo mapa do relatório, só as fazendas do produtor daquele relatório
  var ESC = '';
  function fazEscopo() { return fazendas().filter(function (f) { return !ESC || f.produtor_id === ESC; }); }
  function opcoesFaz(sel) {
    return fazEscopo().map(function (f) { return '<option value="' + esc(f.id) + '"' + (f.id === sel ? ' selected' : '') + '>' + esc(f.nome) + '</option>'; }).join('');
  }
  function opcoesSafra(sel) {
    var l = safras(); if (sel && l.indexOf(sel) < 0) l.unshift(sel);
    if (!l.length) return '<option value="">— sem safra —</option>';
    return l.map(function (s) { return '<option value="' + esc(s) + '"' + (s === sel ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('');
  }
  function fazPadrao() {
    var l = fazEscopo(); if (!l.length) return '';
    return l.some(function (f) { return f.id === ST.ult.faz; }) ? ST.ult.faz : l[0].id;
  }
  // fazenda e safra do relatório que está aberto no app (o app guarda em window.relAtualMapa ao abrir o mapa)
  function doRelatorio() {
    var r = global.relAtualMapa || {}, f = fazendas().filter(function (x) { return x.id === r.fazenda_id; })[0];
    return { faz: f ? f.id : '', prod: (f && f.produtor_id) || r.produtor_id || '', safra: r.safra && safras().indexOf(r.safra) >= 0 ? r.safra : '' };
  }
  function safraPadrao() { var l = safras(); return ST.ult.safra && l.indexOf(ST.ult.safra) >= 0 ? ST.ult.safra : (l[0] || ''); }

  /* ---------------- telas ---------------- */
  function criarTela(id) {
    var d = document.createElement('div'); d.className = 'tela oculto ag-tela'; d.id = id; document.body.appendChild(d); return d;
  }
  function pintar(el, titulo, sub, acoes, corpo) {
    var rolo = $('.conteudo', el), y = rolo ? rolo.scrollTop : 0;
    el.innerHTML = '<header class="topo"><button class="voltar" data-a="voltar">←</button><div class="info"><h1>' + esc(titulo) + '</h1><p>' + esc(sub || '') +
      '</p></div>' + (acoes ? '<div class="acoes">' + acoes + '</div>' : '') + '</header><div class="conteudo">' + corpo + '</div>';
    var n = $('.conteudo', el); if (n) n.scrollTop = y;
  }
  function topoRolagem(el) { var n = $('.conteudo', el); if (n) n.scrollTop = 0; }

  /* =================== PLANTIO =================== */
  var tP = null, P = { faz: '', safra: '', ed: null, nome: '', outros: [], sel: [] };

  function linhaPlantio(fid, safra, nome) {
    return ST.plantio.filter(function (r) { return r.fazenda_id === fid && (r.safra || '') === (safra || '') && r.talhao === nome; })[0] || null;
  }
  function semTxt(r) { return r.sem_ha ? fmt(r.sem_m, 1) + ' sem/m · ' + fmt(r.sem_ha, 0) + ' sem/ha' : ''; }

  function mapaPlantio(f, tl) {
    var feitos = tl.filter(function (t) { var r = linhaPlantio(P.faz, P.safra, t.nome); return r && (r.cultura || r.variedade || r.data_plantio); }).map(function (t) { return t.nome; });
    P.sel = P.sel.filter(function (n) { return tl.some(function (t) { return t.nome === n; }); });
    return '<div class="ag-dica">👆 Toque nos talhões do mapa para marcar onde lançar o plantio (pode marcar vários). Mais claro = já informado. Para os talhões pequenos, amplie com + / − ou com dois dedos.</div><div class="ag-mapa">' + mapaSVG(f, P.sel, 'ptog', feitos) + '</div>' +
      '<div class="ag-chips"><button class="ag-chip" data-a="ptodos">Todos</button><button class="ag-chip" data-a="plimpar">Limpar</button></div>' +
      (P.sel.length ? '<button class="btn" data-a="plancar">🌱 Lançar plantio em ' + P.sel.length + ' talhão(ões) · ' + fmt(haDe(f, P.sel)) + ' ha</button>' : '') +
      '<div class="ag-dica">Ou toque num talhão da lista abaixo para lançar só nele.</div>';
  }

  function pintarPlantio() {
    if (P.ed) return pintarEditorPlantio();
    var f = fazDe(P.faz), tl = talhoesDe(f), feitos = 0;
    var cards = tl.map(function (t) {
      var r = linhaPlantio(P.faz, P.safra, t.nome); if (r && (r.cultura || r.variedade || r.data_plantio)) feitos++;
      var d = r ? daeDe(r.data_emerg) : null;
      var l2 = r ? [r.variedade, r.data_plantio ? 'plantio ' + curta(r.data_plantio) : '', d !== null ? 'DAE ' + d : (r.data_emerg ? 'ainda não emergiu' : ''), semTxt(r)].filter(Boolean).join(' · ') : '';
      return '<div class="lista-item ag-tal" data-a="edtal" data-v="' + esc(t.nome) + '"><div class="ic">' + (r && r.cultura ? '🌱' : '＋') + '</div><div class="txt"><b>' + esc(t.nome) + '</b><span>' +
        (t.ha ? fmt(t.ha) + ' ha' : '') + (r && r.cultura ? ' · ' + esc(NOME_CULT[r.cultura] || r.cultura) : '') + '</span>' +
        '<span>' + esc(l2 || 'toque para informar o plantio') + '</span></div></div>';
    }).join('');
    pintar(tP, 'Plantio dos talhões', tl.length ? feitos + ' de ' + tl.length + ' talhões informados' : 'sem talhões',
      '', '<div class="linha2"><div class="campo"><label>Fazenda</label><select data-c="faz">' + opcoesFaz(P.faz) + '</select></div>' +
      '<div class="campo"><label>Safra</label><select data-c="safra">' + opcoesSafra(P.safra) + '</select></div></div>' +
      (tl.length ? mapaPlantio(f, tl) + cards : '<div class="aviso">Esta fazenda ainda não tem talhões. Importe o KML em Produtores e fazendas.</div>') +
      '<div class="ag-nota">Cultura, variedade, datas e sementes alimentam o mapa por variedade e a evolução do plantio no relatório do cliente.</div>');
    if (!fazendas().length) $('.conteudo', tP).innerHTML = '<div class="aviso">Nenhuma fazenda com talhões. Importe o KML em Produtores e fazendas.</div>';
  }

  function pintarEditorPlantio() {
    var e = P.ed, t = talhoesDe(fazDe(P.faz)).filter(function (x) { return x.nome === P.nome; })[0] || { ha: 0 };
    var esp = espDe(e.cultura, e.espac_cm), d = daeDe(e.data_emerg);
    var vars = {}; ST.plantio.forEach(function (r) { if (r.variedade && (!e.cultura || r.cultura === e.cultura)) vars[r.variedade] = 1; });
    var outros = talhoesDe(fazDe(P.faz)).filter(function (x) { return x.nome !== P.nome; }).map(function (x) {
      return '<button class="ag-chip' + (P.outros.indexOf(x.nome) >= 0 ? ' on' : '') + '" data-a="outro" data-v="' + esc(x.nome) + '">' + esc(x.nome) + '</button>';
    }).join('');
    pintar(tP, P.nome, (t.ha ? fmt(t.ha) + ' ha · ' : '') + P.safra, '',
      '<div class="campo"><label>Cultura</label><select data-k="cultura"><option value="">— escolher —</option>' + CULTURAS.map(function (c) {
        return '<option value="' + c[0] + '"' + (c[0] === e.cultura ? ' selected' : '') + '>' + c[1] + '</option>'; }).join('') + '</select></div>' +
      '<div class="campo"><label>Variedade / híbrido</label><input data-k="variedade" list="agVars" value="' + esc(e.variedade) + '" placeholder="Ex.: Cultivar A-7210" autocomplete="off">' +
      '<datalist id="agVars">' + Object.keys(vars).map(function (v) { return '<option value="' + esc(v) + '">'; }).join('') + '</datalist></div>' +
      '<div class="linha2"><div class="campo"><label>Data de plantio</label><input type="date" data-k="data_plantio" value="' + esc(e.data_plantio) + '"></div>' +
      '<div class="campo"><label>Data de emergência</label><input type="date" data-k="data_emerg" value="' + esc(e.data_emerg) + '"></div></div>' +
      '<div class="ag-chips"><span>Emergência:</span><button class="ag-chip" data-a="emerg" data-v="4">plantio + 4 dias</button><button class="ag-chip" data-a="emerg" data-v="5">plantio + 5 dias</button></div>' +
      '<div class="ag-dica" id="agDae">' + daeTxt(e) + '</div>' +
      '<div class="linha2"><div class="campo"><label>Espaçamento (cm)</label><input inputmode="decimal" data-k="espac_cm" value="' + (e.espac_cm ? String(e.espac_cm).replace('.', ',') : '') + '" placeholder="' + (esp || 'ex.: 50') + '"></div><div></div></div>' +
      '<div class="linha2"><div class="campo"><label>Sementes por metro</label><input inputmode="decimal" data-k="sem_m" value="' + (e.sem_m ? String(e.sem_m).replace('.', ',') : '') + '"></div>' +
      '<div class="campo"><label>Sementes por hectare</label><input inputmode="numeric" data-k="sem_ha" value="' + (e.sem_ha ? fmt(e.sem_ha, 0) : '') + '"></div></div>' +
      '<div class="ag-dica" id="agSem">' + semDica(e) + '</div>' +
      (outros ? '<h2>Aplicar também aos talhões</h2><div class="ag-chips">' + outros + '</div>' : '') +
      '<button class="btn" data-a="salvarplantio">Salvar</button><button class="btn perigo" data-a="limparplantio">Limpar plantio deste talhão</button>');
  }
  function daeTxt(e) { var d = daeDe(e.data_emerg); return d === null ? (e.data_emerg ? 'ainda não emergiu' : 'Informe a data de emergência para contar os dias (DAE).') : 'DAE ' + d + ' · emergiu em ' + curta(e.data_emerg); }
  function semDica(e) { var esp = espDe(e.cultura, e.espac_cm); return e.sem_ha ? '= ' + fmt(e.sem_m, 1) + ' sementes/m a ' + esp + ' cm = ' + fmt(e.sem_ha, 0) + ' sementes/ha' : 'Informe sementes/m ou sementes/ha: a outra é calculada pelo espaçamento (' + (esp ? esp + ' cm' : 'informe o espaçamento') + ').'; }

  function entradaPlantio(inp) {
    var e = P.ed, k = inp.dataset.k; if (!e) return;
    if (k === 'cultura' || k === 'variedade') { e[k] = inp.value; if (k === 'cultura') pintarPlantio(); return; }
    if (k === 'data_plantio' || k === 'data_emerg') { e[k] = inp.value; var d = $('#agDae', tP); if (d) d.textContent = daeTxt(e); return; }
    var esp = espDe(e.cultura, e.espac_cm);
    if (k === 'espac_cm') { e.espac_cm = numBR(inp.value); esp = espDe(e.cultura, e.espac_cm); if (e.sem_m && esp) e.sem_ha = Math.round(e.sem_m * 10000 / (esp / 100)); }
    if (k === 'sem_m') { e.sem_m = numBR(inp.value); e.sem_ha = (e.sem_m && esp) ? Math.round(e.sem_m * 10000 / (esp / 100)) : 0; }
    if (k === 'sem_ha') { e.sem_ha = Math.round(numBR(inp.value)); e.sem_m = (e.sem_ha && esp) ? Math.round(e.sem_ha * (esp / 100) / 10000 * 10) / 10 : 0; }
    var a = $('[data-k="sem_m"]', tP), b = $('[data-k="sem_ha"]', tP);
    if (k !== 'sem_m' && a) a.value = e.sem_m ? String(e.sem_m).replace('.', ',') : '';
    if (k !== 'sem_ha' && b) b.value = e.sem_ha ? fmt(e.sem_ha, 0) : '';
    var dc = $('#agSem', tP); if (dc) dc.textContent = semDica(e);
  }

  function vazioPlantio(e) { return !e.cultura && !e.variedade && !e.data_plantio && !e.data_emerg && !e.sem_m && !e.sem_ha; }
  function gravarPlantio(limpar) {
    var e = P.ed, alvo = [P.nome].concat(P.outros), enviar = [];
    alvo.forEach(function (nome) {
      var row = { fazenda_id: P.faz, safra: P.safra, talhao: nome, cultura: limpar ? '' : e.cultura, variedade: limpar ? '' : e.variedade,
        data_plantio: limpar ? '' : e.data_plantio, data_emerg: limpar ? '' : e.data_emerg,
        espac_cm: limpar ? 0 : (e.sem_m ? espDe(e.cultura, e.espac_cm) : (e.espac_cm || 0)), sem_m: limpar ? 0 : e.sem_m, sem_ha: limpar ? 0 : e.sem_ha };
      ST.plantio = ST.plantio.filter(function (r) { return !(r.fazenda_id === P.faz && (r.safra || '') === (P.safra || '') && r.talhao === nome); });
      if (!vazioPlantio(row)) ST.plantio.push(row);
      enviar.push(row);
    });
    gravar();
    enfileirar('/api/agro/plantio', { fazenda_id: P.faz, safra: P.safra, talhoes: enviar });
    P.sel = []; toast(limpar ? 'Plantio limpo' : 'Plantio salvo' + (alvo.length > 1 ? ' em ' + alvo.length + ' talhões' : ''));
    P.ed = null; P.outros = []; pintarPlantio();
  }

  function abrirPlantio() {
    if (!ST.mod.plantio) return;
    marcaVisto('plantio');
    var dr = doRelatorio(); ESC = dr.prod;
    P.faz = dr.faz || fazPadrao(); P.safra = dr.safra || safraPadrao(); P.ed = null; P.outros = []; P.sel = [];
    tP.classList.remove('oculto'); pintarPlantio(); topoRolagem(tP);
    baixar().then(function (ok) { if (ok && !tP.classList.contains('oculto') && !P.ed) pintarPlantio(); });
  }

  function cliquePlantio(a, v, alvo) {
    if (a === 'voltar') { if (P.ed) { P.ed = null; P.outros = []; pintarPlantio(); } else tP.classList.add('oculto'); return; }
    if (a === 'ptog') { var kp = P.sel.indexOf(v); if (kp >= 0) P.sel.splice(kp, 1); else P.sel.push(v); pintarPlantio(); return; }
    if (a === 'ptodos') { P.sel = talhoesDe(fazDe(P.faz)).map(function (t) { return t.nome; }); pintarPlantio(); return; }
    if (a === 'plimpar') { P.sel = []; pintarPlantio(); return; }
    if (a === 'plancar') { if (!P.sel.length) return; var p0 = P.sel[0], resto = P.sel.slice(1); cliquePlantio('edtal', p0); P.outros = resto; pintarPlantio(); topoRolagem(tP); return; }
    if (a === 'edtal') {
      var r = linhaPlantio(P.faz, P.safra, v);
      P.nome = v; P.outros = [];
      P.ed = r ? { cultura: r.cultura || '', variedade: r.variedade || '', data_plantio: r.data_plantio || '', data_emerg: r.data_emerg || '', espac_cm: r.espac_cm || 0, sem_m: r.sem_m || 0, sem_ha: r.sem_ha || 0 }
        : { cultura: '', variedade: '', data_plantio: '', data_emerg: '', espac_cm: 0, sem_m: 0, sem_ha: 0 };
      pintarPlantio(); topoRolagem(tP); return;
    }
    if (a === 'emerg') {
      if (!P.ed.data_plantio) { toast('Informe primeiro a data de plantio'); return; }
      P.ed.data_emerg = addDias(P.ed.data_plantio, Number(v)); pintarPlantio(); return;
    }
    if (a === 'outro') { var i = P.outros.indexOf(v); if (i >= 0) P.outros.splice(i, 1); else P.outros.push(v); pintarPlantio(); return; }
    if (a === 'salvarplantio') { gravarPlantio(false); return; }
    if (a === 'limparplantio') { if (confirm('Limpar o plantio de ' + P.nome + '?')) gravarPlantio(true); }
  }
  function mudancaPlantio(sel) {
    if (sel.dataset.c === 'faz') { P.sel = []; P.faz = sel.value; ST.ult.faz = P.faz; gravar(); pintarPlantio(); }
    else if (sel.dataset.c === 'safra') { P.safra = sel.value; ST.ult.safra = P.safra; gravar(); pintarPlantio(); }
    else if (sel.dataset.k) entradaPlantio(sel);
  }

  /* =================== RECOMENDAÇÕES =================== */
  var tR = null, R = { view: 'lista', faz: '', filtro: 'todas', id: null, W: null, cy: 0, cm: 0, sel: '' };
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  function recDe(id) { return ST.recs.filter(function (r) { return r.id === id; })[0]; }
  function dd(r) { r.dados = r.dados || {}; return r.dados; }
  function talDe(r) { return dd(r).tal || []; }
  function feitoDe(r) { return dd(r).feito || {}; }
  function proxDe(r) { return dd(r).prox || {}; }
  function prodsDe(r) { return dd(r).prods || []; }
  function venc(r, t) { var f = feitoDe(r)[t]; return f && Number(dd(r).rep) > 0 ? addDias(f, Number(dd(r).rep)) : null; }
  function stRec(r) {
    var n = talDe(r).filter(function (t) { return feitoDe(r)[t]; }).length;
    return n === 0 ? 'Pendente' : n >= talDe(r).length ? 'Aplicada' : 'Em andamento';
  }
  function selo(s) { return '<span class="badge ' + (s === 'Aplicada' ? 'pub' : s === 'Pendente' ? '' : 'fila') + '">' + s + '</span>'; }
  function situ(data, aviso) {
    var n = difDias(data, hoje());
    if (n < 0) return { k: 'venc', t: 'Vencida há ' + (-n) + ' dia' + (n < -1 ? 's' : '') };
    if (n === 0) return { k: 'hoje', t: 'Vence hoje' };
    if (n <= aviso) return { k: 'perto', t: 'Vence em ' + n + ' dia' + (n > 1 ? 's' : '') };
    return { k: 'ok', t: 'Em ' + n + ' dias' };
  }
  function alertasDe(fid) {
    var out = [];
    ST.recs.forEach(function (r) {
      if (r.fazenda_id !== fid) return;
      var d = dd(r); if (!(Number(d.rep) > 0) || !((Number(d.num) || 1) < (Number(d.total) || 1))) return;
      var g = {};
      talDe(r).forEach(function (t) { if (feitoDe(r)[t] && !proxDe(r)[t]) { var v = venc(r, t); (g[v] = g[v] || []).push(t); } });
      Object.keys(g).forEach(function (v) { out.push({ d: v, r: r, tal: g[v], sit: situ(v, Number(d.aviso) || 0) }); });
    });
    return out.sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; });
  }

  /* ----- lista ----- */
  function pintarRecs() {
    var v = R.view;
    if (v === 'det') return pintarOrdem();
    if (v === 'wiz') return pintarWiz();
    if (v === 'prods') return pintarCatalogo();
    if (v === 'cal') return pintarCalendario();
    var f = fazDe(R.faz);
    var lista = ST.recs.filter(function (r) { return r.fazenda_id === R.faz; }).filter(function (r) {
      var s = stRec(r);
      return R.filtro === 'todas' || (R.filtro === 'pend' && s === 'Pendente') || (R.filtro === 'and' && s === 'Em andamento') || (R.filtro === 'apl' && s === 'Aplicada');
    }).sort(function (a, b) { return (b.data_prevista || '') < (a.data_prevista || '') ? -1 : 1; });
    var al = alertasDe(R.faz).map(function (e) {
      var d = dd(e.r), ic = e.sit.k === 'ok' ? '🟢' : e.sit.k === 'perto' ? '🟡' : '🔴';
      return '<div class="ag-alerta ' + e.sit.k + '"><div class="ag-ai">' + ic + '</div><div class="ag-ac"><b>' + esc(ordTxt(e.r.operacao, (Number(d.num) || 1) + 1)) + '</b> <span class="badge">' + esc(e.sit.t) + '</span>' +
        '<span>' + curta(e.d) + ' · ' + esc(e.tal.join(', ')) + ' · ' + fmt(haDe(f, e.tal)) + ' ha</span></div>' +
        '<button class="ag-peq" data-a="prog" data-v="' + esc(e.r.id) + '|' + e.d + '">Programar</button></div>';
    }).join('');
    var cards = lista.map(function (r) {
      var d = dd(r), ha = haDe(f, talDe(r)), pf = haDe(f, talDe(r).filter(function (t) { return feitoDe(r)[t]; })), pc = ha ? Math.round(pf / ha * 100) : 0;
      return '<div class="lista-item ag-rec" data-a="abrirrec" data-v="' + esc(r.id) + '"><div class="ic">📋</div><div class="txt"><b>' + esc(Number(d.rep) > 0 ? ordTxt(r.operacao, Number(d.num) || 1) : r.operacao) + '</b>' +
        '<span>' + curta(r.data_prevista) + ' · ' + talDe(r).length + ' talhão(ões) · ' + fmt(ha) + ' ha</span>' +
        '<span>' + esc(prodsDe(r).map(function (p) { return p[0]; }).join(' + ') || 'sem produtos') + '</span>' +
        '<div class="ag-barra"><i style="width:' + pc + '%"></i></div></div>' + selo(stRec(r)) + '</div>';
    }).join('');
    var filtros = [['todas', 'Todas'], ['pend', 'Pendentes'], ['and', 'Em andamento'], ['apl', 'Aplicadas']].map(function (x) {
      return '<button class="ag-chip' + (R.filtro === x[0] ? ' on' : '') + '" data-a="filtro" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('');
    pintar(tR, 'Recomendações', f ? f.nome : '—', '<button data-a="catalogo" title="Produtos">🧪</button>',
      abasRec('lista') + '<div class="campo"><label>Fazenda</label><select data-c="faz">' + opcoesFaz(R.faz) + '</select></div>' +
      '<button class="btn" data-a="nova">+ Nova recomendação</button>' +
      (al ? '<h2>Próximas aplicações</h2>' + al : '') +
      '<div class="ag-chips" style="margin-top:14px">' + filtros + '</div>' +
      (cards || '<div class="aviso" style="margin-top:10px">Nenhuma recomendação aqui ainda.</div>'));
    if (!fazendas().length) $('.conteudo', tR).innerHTML = '<div class="aviso">Nenhuma fazenda com talhões. Importe o KML em Produtores e fazendas.</div>';
  }

  function abrirRecs() {
    if (!ST.mod.recomendacoes) return;
    marcaVisto('recs');
    var dr = doRelatorio(); ESC = dr.prod;
    R.faz = dr.faz || fazPadrao(); R.view = 'lista'; R.filtro = 'todas'; R.W = null;
    tR.classList.remove('oculto'); pintarRecs(); topoRolagem(tR);
    baixar().then(function (ok) { if (ok && !tR.classList.contains('oculto') && R.view === 'lista') pintarRecs(); });
  }


  /* ----- calendário ----- */
  function abasRec(at) {
    return '<div class="ag-abas"><button class="' + (at === 'lista' ? 'on' : '') + '" data-a="aba" data-v="lista">📋 Lista</button><button class="' + (at === 'cal' ? 'on' : '') + '" data-a="aba" data-v="cal">📅 Calendário</button></div>';
  }
  function eventosDe(fid) {
    var ev = [];
    ST.recs.forEach(function (r) {
      if (r.fazenda_id !== fid) return;
      var d = dd(r), pend = talDe(r).filter(function (t) { return !feitoDe(r)[t]; });
      if (pend.length && r.data_prevista) ev.push({ d: r.data_prevista, k: 'prev', r: r, tal: pend, txt: r.operacao + ' prevista' });
      var g = {}; talDe(r).forEach(function (t) { if (feitoDe(r)[t]) (g[feitoDe(r)[t]] = g[feitoDe(r)[t]] || []).push(t); });
      Object.keys(g).forEach(function (dia) { ev.push({ d: dia, k: 'apl', r: r, tal: g[dia], txt: r.operacao + ' aplicada' }); });
      if (Number(d.rep) > 0 && (Number(d.num) || 1) < (Number(d.total) || 1)) {
        var gg = {}; talDe(r).forEach(function (t) { if (feitoDe(r)[t] && !proxDe(r)[t]) { var v = venc(r, t); (gg[v] = gg[v] || []).push(t); } });
        Object.keys(gg).forEach(function (dia) { var st = situ(dia, Number(d.aviso) || 0); ev.push({ d: dia, k: 'prox-' + st.k, r: r, tal: gg[dia], sit: st, txt: ordTxt(r.operacao, (Number(d.num) || 1) + 1) }); });
      }
    });
    return ev;
  }
  function corEv(e) { return e.k === 'prev' ? 'prev' : e.k === 'apl' ? 'apl' : (e.sit.k === 'venc' || e.sit.k === 'hoje') ? 'venc' : e.sit.k === 'perto' ? 'perto' : 'ok'; }
  function pintarCalendario() {
    var f = fazDe(R.faz), ev = eventosDe(R.faz), h = abasRec('cal');
    if (!R.cy) { var t0 = new Date(); R.cy = t0.getFullYear(); R.cm = t0.getMonth(); R.sel = hoje(); }
    var ini = new Date(Date.UTC(R.cy, R.cm, 1)).getUTCDay(), nd = new Date(Date.UTC(R.cy, R.cm + 1, 0)).getUTCDate(), g = '';
    ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'].forEach(function (x) { g += '<div class="ag-dow">' + x + '</div>'; });
    for (var i = 0; i < ini; i++) g += '<div></div>';
    for (var d = 1; d <= nd; d++) {
      var iso = R.cy + '-' + p2(R.cm + 1) + '-' + p2(d), es = ev.filter(function (e) { return e.d === iso; });
      g += '<button class="ag-dia' + (iso === hoje() ? ' hoje' : '') + (iso === R.sel ? ' sel' : '') + '" data-a="calsel" data-v="' + iso + '"><span>' + d + '</span><i>' +
        es.slice(0, 4).map(function (e) { return '<u class="c-' + corEv(e) + '"></u>'; }).join('') + '</i></button>';
    }
    h += '<div class="campo"><label>Fazenda</label><select data-c="faz">' + opcoesFaz(R.faz) + '</select></div>' +
      '<div class="ag-calhead"><button data-a="calmes" data-v="-1">‹</button><b>' + MESES[R.cm].charAt(0).toUpperCase() + MESES[R.cm].slice(1) + ' de ' + R.cy + '</b><button data-a="calmes" data-v="1">›</button></div>' +
      '<div class="ag-grade">' + g + '</div>' +
      '<div class="ag-leg"><span><u class="c-prev"></u>prevista</span><span><u class="c-apl"></u>aplicada</span><span><u class="c-perto"></u>próxima (perto)</span><span><u class="c-venc"></u>vencida</span><span><u class="c-ok"></u>próxima</span></div>';
    var ds = ev.filter(function (e) { return e.d === R.sel; });
    h += '<h2>' + dataBR(R.sel) + (R.sel === hoje() ? ' (hoje)' : '') + '</h2>' + (ds.length ? ds.map(function (e) {
      return '<div class="ag-alerta c-' + corEv(e) + '" data-a="abrirrec" data-v="' + esc(e.r.id) + '"><div class="ag-ac"><b>' + esc(e.txt) + '</b>' + (e.sit ? ' <span class="badge">' + esc(e.sit.t) + '</span>' : '') +
        '<span>' + esc(e.tal.join(', ')) + ' · ' + fmt(haDe(f, e.tal)) + ' ha</span></div>' +
        (e.k.indexOf('prox-') === 0 ? '<button class="ag-peq" data-a="prog" data-v="' + esc(e.r.id) + '|' + e.d + '">Programar</button>' : '') + '</div>';
    }).join('') : '<div class="ag-dica">Nada neste dia.</div>');
    pintar(tR, 'Calendário', f ? f.nome : '—', '', h);
  }

  /* ----- ordem de campo ----- */
  function pintarOrdem() {
    var r = recDe(R.id); if (!r) { R.view = 'lista'; return pintarRecs(); }
    var f = fazDe(r.fazenda_id), d = dd(r), ha = haDe(f, talDe(r)), pf = haDe(f, talDe(r).filter(function (t) { return feitoDe(r)[t]; })), pc = ha ? Math.round(pf / ha * 100) : 0;
    var prods = prodsDe(r), liq = prods.some(function (p) { return liquido(p[2]); }), hat = d.calda ? d.tanque / d.calda : 0;
    var tl = talhoesDe(f), h = '<div class="ag-capa"><small>' + esc(f ? f.nome : '') + ' · prevista ' + curta(r.data_prevista) + '</small><h3>' +
      esc(Number(d.rep) > 0 ? ordTxt(r.operacao, Number(d.num) || 1) : r.operacao) + '</h3><div class="ag-barra b"><i style="width:' + pc + '%"></i></div><small>' + fmt(pf) + ' de ' + fmt(ha) + ' ha · ' + pc + '%</small></div>';
    if (d.obs) h += '<div class="ag-nota aviso-obs">⚠️ ' + esc(d.obs) + '</div>';
    if (d.resp) h += '<div class="ag-nota">Quem aplica: <b>' + esc(d.resp) + '</b></div>';
    h += '<div class="ag-sec"><b>Ordem de mistura</b>' + prods.map(function (p, i) {
      return '<div class="ag-mix"><b class="ag-ord">' + (i + 1) + '</b><span>' + esc(p[0]) + '</span><em>' + doseTxt(p[1]) + ' ' + esc(p[2]) + '</em></div>'; }).join('') + '</div>';
    if (liq && hat) h += '<div class="ag-sec azul"><b>💧 Por tanque de ' + fmt(d.tanque, 0) + ' L (' + fmt(hat, 0) + ' ha)</b><small>Calda ' + fmt(d.calda, 0) + ' L/ha · ' + tanques(ha, hat, d.calda) + '</small>' +
      prods.filter(function (p) { return liquido(p[2]) && p[0]; }).map(function (p) {
        return '<div class="ag-mix"><span>' + esc(p[0]) + '</span><em>' + fmt(p[1] * hat, p[1] * hat < 10 ? 2 : 1) + ' ' + esc(unid(p[2])) + '</em></div>'; }).join('') + '</div>';
    h += '<h2>Talhões</h2>';
    var pend = 0;
    talDe(r).forEach(function (nome) {
      var t = tl.filter(function (x) { return x.nome === nome; })[0] || { ha: 0 }, ok = feitoDe(r)[nome]; if (!ok) pend++;
      h += '<div class="ag-talc' + (ok ? ' ok' : '') + '"><div class="ag-tt"><b>' + esc(nome) + '</b><span>' + fmt(t.ha) + ' ha</span></div><div class="ag-tp">' +
        prods.map(function (p) { return '<div><span>' + esc(p[0]) + '</span><b>' + volTotal(p[1] * t.ha, p[2]) + '</b></div>'; }).join('') + '</div>' +
        (ok ? '<div class="ag-feito">✔ Aplicado em ' + curta(ok) + (venc(r, nome) && (Number(d.num) || 1) < (Number(d.total) || 1) ? ' · 📅 próxima ' + curta(venc(r, nome)) : '') +
          ' <button class="ag-link" data-a="desfazer" data-v="' + esc(nome) + '">desfazer</button></div>'
          : '<button class="btn" data-a="aplicar" data-v="' + esc(nome) + '">Marcar como aplicado</button>') + '</div>';
    });
    if (pend > 1) h += '<button class="btn secundario" data-a="aplicar" data-v="*">Marcar todos os pendentes como aplicados</button>';
    h += '<h2>Volume total</h2><div class="ag-sec"><small>' + fmt(ha) + ' ha · ' + talDe(r).length + ' talhão(ões)</small>' +
      prods.map(function (p) { return '<div class="ag-mix"><span>' + esc(p[0]) + '</span><em>' + volTotal(p[1] * ha, p[2]) + '</em></div>'; }).join('') +
      (liq && hat ? '<div class="ag-mix"><span>💧 Calda total (' + fmt(d.calda, 0) + ' L/ha)</span><em>' + fmt(ha * d.calda, 0) + ' L</em></div><small>' + tanques(ha, hat, d.calda) + '</small>' : '') + '</div>';
    var prox = alertasDe(r.fazenda_id).filter(function (e) { return e.r.id === r.id; });
    prox.forEach(function (e) {
      h += '<button class="btn secundario" data-a="prog" data-v="' + esc(r.id) + '|' + e.d + '">+ Programar ' + esc(ordTxt(r.operacao, (Number(d.num) || 1) + 1)) + ' (' + curta(e.d) + ' · ' + esc(e.tal.join(', ')) + ')</button>';
    });
    h += '<label class="ag-sw"><input type="checkbox" data-a="mostrar"' + (r.mostrar ? ' checked' : '') + '> Mostrar no relatório do cliente</label>' +
      '<button class="btn secundario" data-a="editarrec">Editar recomendação</button><button class="btn perigo" data-a="excluirrec">Excluir recomendação</button>';
    pintar(tR, 'Ordem de campo', f ? f.nome : '', '', h);
  }

  function salvarRecLocal(r) {
    var i = ST.recs.findIndex(function (x) { return x.id === r.id; });
    if (i >= 0) ST.recs[i] = r; else ST.recs.unshift(r);
    gravar();
    enfileirar('/api/agro/rec', { id: r.id, fazenda_id: r.fazenda_id, safra: r.safra, operacao: r.operacao, data_prevista: r.data_prevista, mostrar: r.mostrar, dados: r.dados });
  }

  function modalAplicar(alvo) {
    var r = recDe(R.id), ov = document.createElement('div'); ov.className = 'ag-ov';
    ov.innerHTML = '<div class="ag-mod"><h3>Marcar como aplicado</h3><p class="ag-dica">' + esc(r.operacao) + ' · ' + (alvo === '*' ? 'todos os talhões pendentes' : esc(alvo)) + '</p>' +
      '<div class="campo"><label>Data da aplicação</label><input type="date" id="agDataApl" value="' + hoje() + '"></div>' +
      '<button class="btn" data-m="ok">Confirmar</button><button class="btn secundario" data-m="no">Cancelar</button></div>';
    document.body.appendChild(ov);
    ov.onclick = function (ev) {
      var m = ev.target.dataset && ev.target.dataset.m;
      if (m === 'no' || ev.target === ov) { ov.remove(); return; }
      if (m !== 'ok') return;
      var data = $('#agDataApl', ov).value; if (!data) { toast('Informe a data'); return; }
      var d = dd(r); d.feito = d.feito || {};
      (alvo === '*' ? talDe(r).filter(function (t) { return !d.feito[t]; }) : [alvo]).forEach(function (t) { d.feito[t] = data; });
      ov.remove(); salvarRecLocal(r); pintarOrdem();
      toast('✔ Aplicação registrada · ' + stRec(r));
    };
  }

  /* ----- assistente (Onde · O quê · Quando) ----- */
  function novoW(fid) {
    return { passo: 1, id: null, faz: fid, safra: safraPadrao(), tal: [], op: '', prods: [], calda: 100, tanque: 3000, data: hoje(), resp: '', obs: '', mostrar: true,
      rep: 0, total: 1, aviso: 3, repMan: false, num: 1, origem: null, feito: {}, prox: {}, modelo: '' };
  }
  function wDeRec(r) {
    var d = dd(r);
    return { passo: 1, id: r.id, faz: r.fazenda_id, safra: r.safra || '', tal: talDe(r).slice(), op: r.operacao, prods: cp(prodsDe(r)), calda: d.calda || 100, tanque: d.tanque || 3000, dae: d.dae || 0,
      data: r.data_prevista || hoje(), resp: d.resp || '', obs: d.obs || '', mostrar: !!r.mostrar, rep: Number(d.rep) || 0, total: Number(d.total) || 1, aviso: d.aviso == null ? 3 : Number(d.aviso),
      repMan: true, num: Number(d.num) || 1, origem: null, feito: cp(feitoDe(r)), prox: cp(proxDe(r)), modelo: '' };
  }
  function prodCat(nome) { return ST.produtos.filter(function (p) { return p.nome === nome; })[0]; }

  /* ---------------- zoom nos mapas de seleção: botões + / −, pinça e arrastar ---------------- */
  var ZW = 1000, MZ = { k: 1, x: 0, y: 0, id: '' }, zFeito = false, zGest = null, zSupr = 0;
  function zoomDe(id) { if (MZ.id !== id) MZ = { k: 1, x: 0, y: 0, id: id }; return MZ; }
  function zAplica(svg) {
    var z = MZ, H = Number(svg.getAttribute('data-h')) || 600, vw = ZW / z.k, vh = H / z.k;
    z.x = Math.max(0, Math.min(ZW - vw, z.x)); z.y = Math.max(0, Math.min(H - vh, z.y));
    svg.setAttribute('viewBox', z.x.toFixed(1) + ' ' + z.y.toFixed(1) + ' ' + vw.toFixed(1) + ' ' + vh.toFixed(1));
    svg.style.setProperty('--zk', z.k.toFixed(2));
    svg.style.touchAction = z.k > 1 ? 'none' : 'pan-y';
  }
  // posição de um ponto da tela dentro da área visível do mapa (0 a 1) e escala em px por unidade
  function zPonto(svg, cx, cy) {
    var r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal, s = Math.min(r.width / vb.width, r.height / vb.height) || 1;
    var ox = (r.width - vb.width * s) / 2, oy = (r.height - vb.height * s) / 2;
    return { fx: Math.max(0, Math.min(1, ((cx - r.left - ox) / s) / vb.width)), fy: Math.max(0, Math.min(1, ((cy - r.top - oy) / s) / vb.height)), s: s };
  }
  function zZoom(svg, k2, fx, fy) {
    var z = MZ, H = Number(svg.getAttribute('data-h')) || 600, vw = ZW / z.k, vh = H / z.k;
    k2 = Math.max(1, Math.min(10, k2));
    var px = z.x + vw * fx, py = z.y + vh * fy;
    z.k = k2; z.x = px - (ZW / k2) * fx; z.y = py - (H / k2) * fy;
    zAplica(svg);
  }
  function zoomIniciar() {
    if (zFeito) return; zFeito = true;
    var st = document.createElement('style');
    st.textContent = '.ag-zw{position:relative}.ag-zb{position:absolute;right:6px;top:6px;display:flex;flex-direction:column;gap:6px}' +
      '.ag-zb button{width:40px;height:40px;border-radius:10px;border:1px solid #cfd8d2;background:rgba(255,255,255,.96);font-size:21px;font-weight:700;line-height:1;color:#146034;box-shadow:0 1px 4px rgba(0,0,0,.18);padding:0;cursor:pointer}' +
      '.ag-mapa svg{touch-action:pan-y;user-select:none;-webkit-user-select:none}.ag-mapa .ag-poly{stroke-width:calc(3px / var(--zk,1))}.ag-mapa .ag-poly.on{stroke-width:calc(4px / var(--zk,1))}' +
      '.ag-mapa text{font-size:calc(24px * (0.6 + 0.4 * var(--zk,1)) / var(--zk,1));stroke-width:calc(4px / var(--zk,1))}';
    document.head.appendChild(st);
    var svgDe = function (n) { return n && n.closest ? n.closest('.ag-zw') && n.closest('.ag-zw').querySelector('svg') : null; };
    document.addEventListener('click', function (ev) {
      if (Date.now() - zSupr < 450 && ev.target.closest && ev.target.closest('.ag-zw')) { ev.stopPropagation(); ev.preventDefault(); return; }
      var b = ev.target.closest ? ev.target.closest('[data-z]') : null; if (!b) return;
      var svg = svgDe(b); if (!svg) return; ev.stopPropagation(); ev.preventDefault();
      var a = b.getAttribute('data-z');
      if (a === 'reset') zZoom(svg, 1, 0.5, 0.5); else zZoom(svg, MZ.k * (a === 'in' ? 1.7 : 1 / 1.7), 0.5, 0.5);
    }, true);
    var dist = function (t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); };
    document.addEventListener('touchstart', function (ev) {
      var svg = ev.target.closest ? ev.target.closest('.ag-zw svg') : null; if (!svg) { zGest = null; return; }
      var t = ev.touches;
      if (t.length === 2) {
        var m = zPonto(svg, (t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2), H = Number(svg.getAttribute('data-h')) || 600;
        zGest = { svg: svg, tipo: 'pinca', d0: dist(t), k0: MZ.k, px: MZ.x + (ZW / MZ.k) * m.fx, py: MZ.y + (H / MZ.k) * m.fy, mov: true };
      } else if (t.length === 1) {
        zGest = { svg: svg, tipo: 'arrasta', sx: t[0].clientX, sy: t[0].clientY, x0: MZ.x, y0: MZ.y, mov: false };
      }
    }, { passive: true });
    document.addEventListener('touchmove', function (ev) {
      var g = zGest; if (!g) return; var t = ev.touches, H = Number(g.svg.getAttribute('data-h')) || 600;
      if (g.tipo === 'pinca' && t.length === 2) {
        ev.preventDefault();
        var m = zPonto(g.svg, (t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2);
        var k2 = Math.max(1, Math.min(10, g.k0 * dist(t) / (g.d0 || 1)));
        MZ.k = k2; MZ.x = g.px - (ZW / k2) * m.fx; MZ.y = g.py - (H / k2) * m.fy; zAplica(g.svg);
      } else if (g.tipo === 'arrasta' && t.length === 1) {
        var dx = t[0].clientX - g.sx, dy = t[0].clientY - g.sy;
        if (Math.abs(dx) + Math.abs(dy) > 8) g.mov = true;
        if (MZ.k > 1 && g.mov) {
          ev.preventDefault();
          var s = zPonto(g.svg, 0, 0).s;
          MZ.x = g.x0 - dx / s; MZ.y = g.y0 - dy / s; zAplica(g.svg);
        }
      }
    }, { passive: false });
    var fim = function (ev) { if (zGest && zGest.mov && MZ.k > 1) zSupr = Date.now(); if (!ev.touches || !ev.touches.length) zGest = null; };
    document.addEventListener('touchend', fim, { passive: true }); document.addEventListener('touchcancel', fim, { passive: true });
    // computador: roda do mouse amplia, arrastar move
    document.addEventListener('wheel', function (ev) {
      var svg = ev.target.closest ? ev.target.closest('.ag-zw svg') : null; if (!svg) return;
      ev.preventDefault(); var m = zPonto(svg, ev.clientX, ev.clientY); zZoom(svg, MZ.k * (ev.deltaY < 0 ? 1.25 : 0.8), m.fx, m.fy);
    }, { passive: false });
    var mouse = null;
    document.addEventListener('mousedown', function (ev) {
      var svg = ev.target.closest ? ev.target.closest('.ag-zw svg') : null; if (!svg || MZ.k <= 1) return;
      mouse = { svg: svg, sx: ev.clientX, sy: ev.clientY, x0: MZ.x, y0: MZ.y, mov: false };
    });
    document.addEventListener('mousemove', function (ev) {
      if (!mouse) return; var dx = ev.clientX - mouse.sx, dy = ev.clientY - mouse.sy;
      if (Math.abs(dx) + Math.abs(dy) > 5) mouse.mov = true;
      if (mouse.mov) { var s = zPonto(mouse.svg, 0, 0).s; MZ.x = mouse.x0 - dx / s; MZ.y = mouse.y0 - dy / s; zAplica(mouse.svg); }
    });
    document.addEventListener('mouseup', function () { if (mouse && mouse.mov) zSupr = Date.now(); mouse = null; });
  }

  function mapaSVG(f, sel, act, feitos) {
    var feats = (f && f.talhoes && f.talhoes.features) || [], minX = 180, minY = 90, maxX = -180, maxY = -90;
    var each = function (ft, cb) { var g = ft.geometry; if (!g) return; (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).forEach(cb); };
    feats.forEach(function (ft) { each(ft, function (rings) { rings.forEach(function (rg) { rg.forEach(function (p) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }); }); }); });
    if (maxX < minX) return '';
    var dx = (maxX - minX) || 0.001, dy = (maxY - minY) || 0.001; minX -= dx * 0.03; maxX += dx * 0.03; minY -= dy * 0.03; maxY += dy * 0.03;
    var Wd = 1000, H = Math.max(300, Math.round(Wd * ((maxY - minY) / (maxX - minX)) * Math.cos((minY + maxY) / 2 * Math.PI / 180)));
    var px = function (l) { return (l - minX) / (maxX - minX) * Wd; }, py = function (l) { return H - (l - minY) / (maxY - minY) * H; };
    var z = zoomDe((f && f.id) || ''), zvw = Wd / z.k, zvh = H / z.k;
    z.x = Math.max(0, Math.min(Wd - zvw, z.x)); z.y = Math.max(0, Math.min(H - zvh, z.y));
    var s = '<div class="ag-zw"><svg viewBox="' + z.x.toFixed(1) + ' ' + z.y.toFixed(1) + ' ' + zvw.toFixed(1) + ' ' + zvh.toFixed(1) + '" data-h="' + H + '" style="--zk:' + z.k.toFixed(2) + (z.k > 1 ? ';touch-action:none' : '') + '"><rect width="' + Wd + '" height="' + H + '" fill="#F1F4F2"/>', txt = '';
    feats.forEach(function (ft) {
      var nome = (ft.properties && ft.properties.nome) || '', on = sel.indexOf(nome) >= 0, d = '', cx = 0, cy = 0, n = 0;
      each(ft, function (rings) {
        d += rings.map(function (rg, ri) { if (ri === 0) rg.forEach(function (q) { cx += px(q[0]); cy += py(q[1]); n++; }); return 'M' + rg.map(function (q) { return px(q[0]).toFixed(1) + ',' + py(q[1]).toFixed(1); }).join('L') + 'Z'; }).join(' ');
      });
      s += '<path class="ag-poly' + (on ? ' on' : '') + (feitos && feitos.indexOf(nome) >= 0 ? ' feito' : '') + '" data-a="' + (act || 'wtog') + '" data-v="' + esc(nome) + '" d="' + d + '"/>';
      if (n) txt += '<text x="' + (cx / n).toFixed(0) + '" y="' + (cy / n).toFixed(0) + '" text-anchor="middle">' + (on ? '✔ ' : '') + esc(nome) + '</text>';
    });
    return s + txt + '</svg><div class="ag-zb"><button type="button" data-z="in" title="Ampliar">+</button><button type="button" data-z="out" title="Reduzir">−</button><button type="button" data-z="reset" title="Mapa inteiro">⤢</button></div></div>';
  }

  function pintarWiz() {
    var W = R.W, f = fazDe(W.faz), ha = haDe(f, W.tal), h = '';
    var passos = ['Onde', 'O quê', 'Quando'].map(function (n, i) { return '<div class="ag-passo' + (W.passo === i + 1 ? ' on' : '') + (W.passo > i + 1 ? ' ok' : '') + '"><b>' + (W.passo > i + 1 ? '✔' : i + 1) + '</b>' + n + '</div>'; }).join('');
    h += '<div class="ag-passos">' + passos + '</div>';
    if (W.passo === 1) {
      var culturas = {}; ST.plantio.forEach(function (r) { if (r.fazenda_id === W.faz && (r.safra || '') === (W.safra || '') && r.cultura) culturas[r.cultura] = 1; });
      h += '<div class="campo"><label>Fazenda</label><select data-w="faz">' + opcoesFaz(W.faz) + '</select></div>' +
        '<div class="ag-dica">👆 Toque nos talhões do mapa para marcar onde vai a aplicação.</div><div class="ag-mapa">' + mapaSVG(f, W.tal) + '</div>' +
        '<div class="ag-chips"><button class="ag-chip" data-a="wtodos">Todos</button>' + Object.keys(culturas).map(function (k) {
          return '<button class="ag-chip" data-a="wcult" data-v="' + k + '">Só ' + esc((NOME_CULT[k] || k).toLowerCase()) + '</button>'; }).join('') + '<button class="ag-chip" data-a="wlimpar">Limpar</button></div>' +
        '<div class="ag-resumo-ha"><b>' + W.tal.length + '</b> talhão(ões) · <b>' + fmt(ha) + '</b> ha</div>';
    } else if (W.passo === 2) {
      if (W.origem) { var ro = recDe(W.origem.id); h += '<div class="ag-seq">🔁 <b>' + esc(ordTxt(W.op, W.num)) + '</b> em ' + esc(W.tal.join(', ')) + ', data prevista <b>' + curta(W.data) + '</b> (intervalo de ' + W.rep + ' dias). A anterior foi com <b>' + esc(prodsDe(ro).map(function (p) { return p[0]; }).join(' + ')) + '</b>. Escolha os produtos desta: podem ser outros, só a data segue o intervalo.</div>'; }
      if (!ST.produtos.length) h += '<div class="ag-sec"><b>Seu catálogo de produtos está vazio</b><small>Carregue uma lista inicial (herbicidas, fungicidas, adubos…) e ajuste depois.</small><button class="btn secundario" data-a="padrao">Carregar lista inicial</button></div>';
      h += '<label class="ag-l">Comece por um modelo pronto (você ajusta depois)</label><div class="ag-chips">' + Object.keys(MODELOS).map(function (m) {
        return '<button class="ag-chip' + (W.modelo === m ? ' on' : '') + '" data-a="wmodelo" data-v="' + esc(m) + '">' + esc(m) + '</button>'; }).join('') + '<button class="ag-chip" data-a="wbranco">Em branco</button></div>';
      h += W.prods.map(function (p, i) {
        var tem = ST.produtos.some(function (x) { return x.nome === p[0]; });
        var opts = TIPOS.map(function (tp) {
          var l = ST.produtos.filter(function (x) { return (x.tipo || 'Outro') === tp; }); if (!l.length) return '';
          return '<optgroup label="' + tp + '">' + l.map(function (x) { return '<option value="' + esc(x.nome) + '"' + (x.nome === p[0] ? ' selected' : '') + '>' + esc(x.nome) + '</option>'; }).join('') + '</optgroup>';
        }).join('') + (p[0] && !tem ? '<option value="' + esc(p[0]) + '" selected>' + esc(p[0]) + '</option>' : '');
        return '<div class="ag-prod"><div class="ag-pt"><b class="ag-ord">' + (i + 1) + '</b><select data-w="prod" data-i="' + i + '"><option value="">Escolher produto…</option>' + opts + '</select>' +
          '<div class="ag-mv"><button data-a="wmover" data-v="' + i + '|-1">↑</button><button data-a="wmover" data-v="' + i + '|1">↓</button><button data-a="wdel" data-v="' + i + '">✕</button></div></div>' +
          '<div class="ag-dose"><button data-a="wdose" data-v="' + i + '|-1">−</button><input inputmode="decimal" data-w="dose" data-i="' + i + '" value="' + String(p[1]).replace('.', ',') + '">' +
          '<select data-w="un" data-i="' + i + '">' + UNIDADES.map(function (u) { return '<option' + (u === p[2] ? ' selected' : '') + '>' + u + '</option>'; }).join('') + '</select>' +
          '<button data-a="wdose" data-v="' + i + '|1">+</button><div class="ag-tot">' + (ha ? 'total <b>' + volTotal(p[1] * ha, p[2]) + '</b>' : '—') + '</div></div></div>';
      }).join('');
      h += '<div class="ag-duas"><button class="btn secundario" data-a="waddprod">+ Adicionar produto</button><button class="btn secundario" data-a="novoprod">Cadastrar produto novo</button></div>';
      if (W.prods.some(function (p) { return liquido(p[2]); })) {
        var hat = W.tanque / (W.calda || 1);
        h += '<div class="ag-sec azul"><b>💧 Calda</b><div class="linha2" style="margin-top:6px"><div class="campo"><label>Vazão (L/ha)</label><input inputmode="numeric" data-w="calda" value="' + W.calda + '"></div>' +
          '<div class="campo"><label>Tanque do pulverizador (L)</label><input inputmode="numeric" data-w="tanque" value="' + W.tanque + '"></div></div>' +
          '<div class="ag-chips">' + [2000, 3000, 4000].map(function (v) { return '<button class="ag-chip' + (W.tanque === v ? ' on' : '') + '" data-a="wtanque" data-v="' + v + '">Jacto ' + v.toLocaleString('pt-BR') + ' L</button>'; }).join('') + '</div>' +
          '<small>Cada tanque cobre <b>' + fmt(hat, 0) + ' ha</b>' + (ha ? ' · ' + tanques(ha, hat, W.calda) : '') + '. Por tanque cheio, na ordem de mistura:</small>' +
          W.prods.filter(function (p) { return liquido(p[2]) && p[0]; }).map(function (p, i) { return '<div class="ag-mix"><span>' + (i + 1) + '. ' + esc(p[0]) + '</span><em>' + fmt(p[1] * hat, p[1] * hat < 10 ? 2 : 1) + ' ' + esc(unid(p[2])) + '</em></div>'; }).join('') + '</div>';
      }
    } else {
      var livre = !!W.opLivre || (!!W.op && OPS.indexOf(W.op) < 0);
      var op = W.op || 'Dessecação', resps = (cad().responsaveis || []).map(function (x) { return x.nome; });
      if (W.resp && resps.indexOf(W.resp) < 0) resps.unshift(W.resp);
      h += '<div class="linha2"><div class="campo"><label>Operação</label><select data-w="op">' + OPS.map(function (o) { return '<option' + (!livre && o === op ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '<option value="__outra"' + (livre ? ' selected' : '') + '>✏️ Escrever outra…</option></select>' + (livre ? '<input data-w="oplivre" placeholder="Digite a operação (ex.: Dessecação pré-plantio)" value="' + esc(W.op) + '" style="margin-top:6px">' : '') + '</div>' +
        '<div class="campo"><label>Data prevista</label><input type="date" data-w="data" value="' + esc(W.data) + '"></div></div>' +
        '<div class="campo"><label>Ou programar por DAE (dias após a emergência)</label><input inputmode="numeric" data-w="dae" placeholder="Ex.: 25" value="' + (W.dae || '') + '"></div>' +
        '<div class="ag-chips">' + [15, 20, 25, 30, 35, 40, 45, 50].map(function (v) { return '<button class="ag-chip' + (W.dae === v ? ' on' : '') + '" data-a="wdae" data-v="' + v + '">DAE ' + v + '</button>'; }).join('') + '</div>' +
        (W.dae && W.daeMsg ? '<div class="ag-dica">📆 ' + esc(W.daeMsg) + '</div>' : '') +
        '<div class="linha2"><div class="campo"><label>Quem aplica</label><select data-w="resp"><option value="">—</option>' + resps.map(function (n) { return '<option' + (n === W.resp ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select></div>' +
        '<div class="campo"><label>Safra</label><select data-w="safra">' + opcoesSafra(W.safra) + '</select></div></div>' +
        '<div class="ag-rep"><label class="ag-sw"><input type="checkbox" data-w="repon"' + (W.rep > 0 ? ' checked' : '') + '> 🔁 Faz parte de uma sequência (1º, 2º, 3º fungicida…)</label>' +
        (W.rep > 0 ? '<div class="ag-g3"><div class="campo"><label>Próxima em (dias)</label><input inputmode="numeric" data-w="rep" value="' + W.rep + '"></div><div class="campo"><label>Nº de aplicações</label><input inputmode="numeric" data-w="total" value="' + W.total + '"></div><div class="campo"><label>Avisar (dias antes)</label><input inputmode="numeric" data-w="aviso" value="' + W.aviso + '"></div></div>' +
          '<div class="ag-dica">⏱ A contagem começa quando você marcar “aplicada”. Ex.: aplicou em ' + curta(W.data) + ' → a próxima (podem ser outros produtos) vence em <b>' + curta(addDias(W.data, W.rep)) + '</b>, e o alerta aparece aqui e no relatório do cliente ' + W.aviso + ' dia(s) antes.</div>' : '') + '</div>' +
        '<div class="campo"><label>Observação para a aplicação</label><textarea rows="2" data-w="obs" placeholder="Ex.: aplicar com vento abaixo de 10 km/h">' + esc(W.obs) + '</textarea></div>' +
        '<label class="ag-sw"><input type="checkbox" data-w="mostrar"' + (W.mostrar ? ' checked' : '') + '> Mostrar no relatório do cliente</label>' +
        '<div class="ag-sec"><b>Resumo</b><small>' + esc(op) + ' · ' + esc(f ? f.nome : '') + '</small>' +
        (W.rep > 0 ? '<small>🔁 ' + esc(ordTxt(op, W.num)) + ' de ' + W.total + ' · próxima ' + W.rep + ' dias depois · avisa ' + W.aviso + ' dia(s) antes</small>' : '') +
        '<small>' + esc(W.tal.join(', ')) + ' · <b>' + fmt(ha) + ' ha</b></small>' +
        W.prods.filter(function (p) { return p[0]; }).map(function (p, i) { return '<small>' + (i + 1) + '. ' + esc(p[0]) + ' · ' + doseTxt(p[1]) + ' ' + esc(p[2]) + ' → <b>' + volTotal(p[1] * ha, p[2]) + '</b></small>'; }).join('') + '</div>';
    }
    h += '<div class="ag-rodape">' + (W.passo > 1 ? '<button class="btn secundario" data-a="wvoltar">← Voltar</button>' : '') +
      (W.passo < 3 ? '<button class="btn" data-a="wprox">Continuar →</button>' : '<button class="btn" data-a="wsalvar">' + (W.id ? 'Salvar alterações' : 'Salvar recomendação') + '</button>') + '</div>';
    pintar(tR, W.origem ? 'Programar ' + ordTxt(W.op, W.num) : (W.id ? 'Editar recomendação' : 'Nova recomendação'), 'Passo ' + W.passo + ' de 3', '', h);
  }

  function wProx() {
    var W = R.W;
    if (W.passo === 1 && !W.tal.length) { toast('Toque em pelo menos um talhão do mapa'); return; }
    if (W.passo === 2 && !W.prods.filter(function (p) { return p[0]; }).length) { toast('Escolha ao menos um produto'); return; }
    W.passo++;
    if (W.passo === 3 && !W.repMan) {
      var iv = 0; W.prods.forEach(function (p) { var c = prodCat(p[0]); if (c && Number(c.intervalo_dias) > iv) iv = Number(c.intervalo_dias); });
      W.rep = iv; W.total = iv ? 3 : 1;
    }
    pintarWiz(); topoRolagem(tR);
  }

  function wSalvar() {
    var W = R.W;
    if (!W.tal.length) { toast('Escolha os talhões'); return; }
    var prods = W.prods.filter(function (p) { return p[0]; }).map(function (p) { return [p[0], p[1], p[2]]; });
    if (!prods.length) { toast('Escolha ao menos um produto'); return; }
    var antes = W.id ? recDe(W.id) : null;
    var r = {
      id: W.id || novoId('rc'), fazenda_id: W.faz, safra: W.safra || '', operacao: W.op || 'Dessecação', data_prevista: W.data, mostrar: !!W.mostrar,
      dados: { tal: W.tal.slice(), dae: W.dae || 0, prods: prods, calda: W.calda, tanque: W.tanque, resp: W.resp, obs: W.obs, rep: W.rep, num: W.num || 1, total: W.total, aviso: W.aviso,
        feito: antes ? cp(feitoDe(antes)) : {}, prox: antes ? cp(proxDe(antes)) : {} }
    };
    if (antes) { Object.keys(r.dados.feito).forEach(function (t) { if (r.dados.tal.indexOf(t) < 0) delete r.dados.feito[t]; }); }
    if (W.origem) {
      var o = recDe(W.origem.id);
      if (o) { var od = dd(o); od.prox = od.prox || {}; W.origem.tal.forEach(function (t) { od.prox[t] = true; }); salvarRecLocal(o); }
    }
    salvarRecLocal(r);
    ST.ult.safra = r.safra; gravar();
    R.W = null; R.id = r.id; R.view = 'det'; pintarRecs(); topoRolagem(tR);
    toast('Recomendação salva');
  }

  function aplicaDae(n) {
    var W = R.W;
    if (!(n > 0)) { W.dae = 0; return; }
    W.dae = n;
    var em = W.tal.map(function (t) { var r = linhaPlantio(W.faz, W.safra, t); return r && r.data_emerg ? [t, r.data_emerg] : null; }).filter(Boolean).sort(function (a, b) { return a[1] < b[1] ? -1 : 1; });
    if (!em.length) { W.daeMsg = 'Nenhum talhão escolhido tem data de emergência. Informe em 🌱 Plantio.'; pintarWiz(); return; }
    W.data = addDias(em[0][1], n);
    var difs = em.some(function (x) { return x[1] !== em[0][1]; });
    W.daeMsg = 'DAE ' + n + ' = ' + curta(W.data) + ' (emergência de ' + em[0][0] + ' em ' + curta(em[0][1]) + ')' +
      (difs ? ' · emergências diferentes: ' + em.map(function (x) { return x[0] + ' ' + curta(x[1]); }).join(', ') + '. Usei a mais cedo.' : '');
    pintarWiz();
  }
  function entradaWiz(el) {
    var W = R.W, w = el.dataset.w, i = Number(el.dataset.i);
    if (w === 'faz') { W.faz = el.value; W.tal = []; ST.ult.faz = W.faz; gravar(); pintarWiz(); return; }
    if (w === 'prod') {
      var c = prodCat(el.value); W.prods[i][0] = el.value;
      if (c) { W.prods[i][1] = Number(c.dose) || 0; W.prods[i][2] = c.unidade || 'L/ha'; }
      pintarWiz(); return;
    }
    if (w === 'dose') { W.prods[i][1] = numBR(el.value); pintarWiz(); return; }
    if (w === 'un') { W.prods[i][2] = el.value; pintarWiz(); return; }
    if (w === 'calda') { W.calda = numBR(el.value) || 100; pintarWiz(); return; }
    if (w === 'tanque') { W.tanque = numBR(el.value) || 3000; pintarWiz(); return; }
    if (w === 'op') { if (el.value === '__outra') { W.opLivre = true; W.op = ''; pintarWiz(); var xo = document.querySelector('[data-w="oplivre"]'); if (xo) xo.focus(); return; } W.opLivre = false; W.op = el.value; return; }
    if (w === 'oplivre') { W.op = el.value; return; }
    if (w === 'dae') { aplicaDae(parseInt(el.value, 10)); return; }
    if (w === 'data') { var tinhaDae = W.dae; W.dae = 0; W.data = el.value; if (W.rep > 0 || tinhaDae) pintarWiz(); return; }
    if (w === 'resp') { W.resp = el.value; return; }
    if (w === 'safra') { W.safra = el.value; return; }
    if (w === 'obs') { W.obs = el.value; return; }
    if (w === 'mostrar') { W.mostrar = el.checked; return; }
    if (w === 'repon') { W.repMan = true; W.rep = el.checked ? (W.rep || 14) : 0; W.total = el.checked ? Math.max(W.total, 2) : 1; pintarWiz(); return; }
    if (w === 'rep' || w === 'total' || w === 'aviso') {
      W.repMan = true; var v = parseInt(el.value, 10) || 0;
      W[w] = Math.max(w === 'aviso' ? 0 : 1, v); if (w === 'total' && W.total < 2) W.total = 2; pintarWiz();
    }
  }

  function cliqueWiz(a, v) {
    var W = R.W, p;
    if (a === 'wtog') { var k = W.tal.indexOf(v); if (k >= 0) W.tal.splice(k, 1); else W.tal.push(v); pintarWiz(); return true; }
    if (a === 'wtodos') { W.tal = talhoesDe(fazDe(W.faz)).map(function (t) { return t.nome; }); pintarWiz(); return true; }
    if (a === 'wlimpar') { W.tal = []; pintarWiz(); return true; }
    if (a === 'wcult') {
      var nomes = ST.plantio.filter(function (r) { return r.fazenda_id === W.faz && (r.safra || '') === (W.safra || '') && r.cultura === v; }).map(function (r) { return r.talhao; });
      W.tal = talhoesDe(fazDe(W.faz)).map(function (t) { return t.nome; }).filter(function (n) { return nomes.indexOf(n) >= 0; }); pintarWiz(); return true;
    }
    if (a === 'wdae') { aplicaDae(Number(v)); return true; }
    if (a === 'wmodelo') { var m = MODELOS[v]; W.modelo = v; W.opLivre = false; W.op = m[0]; W.prods = cp(m[1]); pintarWiz(); return true; }
    if (a === 'wbranco') { W.modelo = ''; W.prods = []; pintarWiz(); return true; }
    if (a === 'waddprod') { W.prods.push(['', 1, 'L/ha']); pintarWiz(); return true; }
    if (a === 'wdel') { W.prods.splice(Number(v), 1); pintarWiz(); return true; }
    if (a === 'wmover') { p = v.split('|'); var i = Number(p[0]), j = i + Number(p[1]); if (j >= 0 && j < W.prods.length) { var x = W.prods[i]; W.prods[i] = W.prods[j]; W.prods[j] = x; pintarWiz(); } return true; }
    if (a === 'wdose') {
      p = v.split('|'); var q = W.prods[Number(p[0])], passo = q[1] >= 50 ? 10 : q[1] >= 5 ? 0.5 : q[1] >= 1 ? 0.1 : 0.05;
      q[1] = Math.max(0, Math.round((q[1] + Number(p[1]) * passo) * 100) / 100); pintarWiz(); return true;
    }
    if (a === 'wtanque') { W.tanque = Number(v); pintarWiz(); return true; }
    if (a === 'wprox') { wProx(); return true; }
    if (a === 'wvoltar') { W.passo--; pintarWiz(); topoRolagem(tR); return true; }
    if (a === 'wsalvar') { wSalvar(); return true; }
    if (a === 'padrao') { carregarPadrao().then(pintarWiz); return true; }
    if (a === 'novoprod') { modalProduto(null, function (pr) { W.prods.push([pr.nome, Number(pr.dose) || 1, pr.unidade || 'L/ha']); pintarWiz(); }); return true; }
    return false;
  }

  /* ----- catálogo de produtos ----- */
  async function carregarPadrao() {
    var ja = {}; ST.produtos.forEach(function (p) { ja[p.nome] = 1; });
    PADRAO.forEach(function (x) {
      if (ja[x[0]]) return;
      var pr = { id: novoId('pr'), nome: x[0], tipo: x[1], ingrediente: x[2], dose: x[3], unidade: x[4], intervalo_dias: x[5] };
      ST.produtos.push(pr); ST.fila.push({ rota: '/api/agro/produto', corpo: pr });
    });
    gravar(); if (navigator.onLine) await descarregar();
    toast('Lista inicial carregada');
  }

  function pintarCatalogo() {
    var h = '<button class="btn" data-a="pnovo">+ Novo produto</button>';
    if (!ST.produtos.length) h += '<div class="aviso" style="margin-top:10px">Catálogo vazio.</div><button class="btn secundario" data-a="padrao">Carregar lista inicial</button>';
    TIPOS.forEach(function (tp) {
      var l = ST.produtos.filter(function (p) { return (p.tipo || 'Outro') === tp; }); if (!l.length) return;
      h += '<h2>' + tp + '</h2>' + l.map(function (p) {
        return '<div class="lista-item" data-a="pedit" data-v="' + esc(p.id) + '"><div class="txt"><b>' + esc(p.nome) + '</b><span>' + esc(p.ingrediente || '') + '</span></div>' +
          '<span class="badge">' + doseTxt(Number(p.dose) || 0) + ' ' + esc(p.unidade) + (Number(p.intervalo_dias) ? ' · ' + p.intervalo_dias + ' d' : '') + '</span></div>';
      }).join('');
    });
    pintar(tR, 'Produtos', ST.produtos.length + ' no catálogo', '', h);
  }

  function modalProduto(p, depois) {
    var novo = !p; p = p || { id: novoId('pr'), nome: '', tipo: 'Fungicida', ingrediente: '', dose: 1, unidade: 'L/ha', intervalo_dias: 0 };
    var ov = document.createElement('div'); ov.className = 'ag-ov';
    ov.innerHTML = '<div class="ag-mod"><h3>' + (novo ? 'Novo produto' : 'Editar produto') + '</h3>' +
      '<div class="campo"><label>Nome</label><input id="pdNome" value="' + esc(p.nome) + '" placeholder="Ex.: Fungicida duplo mix"></div>' +
      '<div class="linha2"><div class="campo"><label>Tipo</label><select id="pdTipo">' + TIPOS.map(function (t) { return '<option' + (t === p.tipo ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></div>' +
      '<div class="campo"><label>Unidade</label><select id="pdUn">' + UNIDADES.map(function (u) { return '<option' + (u === p.unidade ? ' selected' : '') + '>' + u + '</option>'; }).join('') + '</select></div></div>' +
      '<div class="campo"><label>Ingrediente ativo</label><input id="pdIng" value="' + esc(p.ingrediente) + '"></div>' +
      '<div class="linha2"><div class="campo"><label>Dose padrão</label><input id="pdDose" inputmode="decimal" value="' + String(p.dose).replace('.', ',') + '"></div>' +
      '<div class="campo"><label>Intervalo (dias)</label><input id="pdInt" inputmode="numeric" value="' + (Number(p.intervalo_dias) || '') + '" placeholder="só p/ sequências"></div></div>' +
      '<button class="btn" data-m="ok">Salvar</button>' + (novo ? '' : '<button class="btn perigo" data-m="del">Excluir produto</button>') + '<button class="btn secundario" data-m="no">Cancelar</button></div>';
    document.body.appendChild(ov);
    ov.onclick = function (ev) {
      var m = ev.target.dataset && ev.target.dataset.m;
      if (m === 'no' || ev.target === ov) { ov.remove(); return; }
      if (m === 'del') {
        if (!confirm('Excluir este produto do catálogo?')) return;
        ST.produtos = ST.produtos.filter(function (x) { return x.id !== p.id; }); gravar(); enfileirar('/api/agro/produto/apagar', { id: p.id }); ov.remove(); pintarRecs(); return;
      }
      if (m !== 'ok') return;
      var nome = $('#pdNome', ov).value.trim(); if (!nome) { toast('Informe o nome'); return; }
      var pr = { id: p.id, nome: nome, tipo: $('#pdTipo', ov).value, ingrediente: $('#pdIng', ov).value.trim(), dose: numBR($('#pdDose', ov).value), unidade: $('#pdUn', ov).value, intervalo_dias: Math.round(numBR($('#pdInt', ov).value)) };
      var i = ST.produtos.findIndex(function (x) { return x.id === p.id; });
      if (i >= 0) ST.produtos[i] = pr; else ST.produtos.push(pr);
      gravar(); enfileirar('/api/agro/produto', pr); ov.remove();
      if (depois) depois(pr); else pintarRecs();
    };
  }

  /* ----- cliques das recomendações ----- */
  function cliqueRecs(a, v, alvo) {
    if (R.view === 'wiz' && cliqueWiz(a, v)) return;
    if (a === 'voltar') {
      if (R.view === 'wiz') {
        if (!confirm('Descartar esta recomendação?')) return;
        R.view = R.W && R.W.id ? 'det' : 'lista'; R.W = null; pintarRecs(); return;
      }
      if (R.view === 'det' || R.view === 'prods' || R.view === 'cal') { R.view = (R.view === 'det' && R.de === 'cal') ? 'cal' : 'lista'; R.de = ''; pintarRecs(); return; }
      tR.classList.add('oculto'); return;
    }
    if (a === 'aba') { R.view = v; pintarRecs(); topoRolagem(tR); return; }
    if (a === 'calsel') { R.sel = v; pintarCalendario(); return; }
    if (a === 'calmes') { R.cm += Number(v); if (R.cm < 0) { R.cm = 11; R.cy--; } if (R.cm > 11) { R.cm = 0; R.cy++; } pintarCalendario(); return; }
    if (a === 'filtro') { R.filtro = v; pintarRecs(); return; }
    if (a === 'nova') { R.W = novoW(R.faz); R.view = 'wiz'; pintarRecs(); topoRolagem(tR); return; }
    if (a === 'abrirrec') { R.de = R.view; R.id = v; R.view = 'det'; pintarRecs(); topoRolagem(tR); return; }
    if (a === 'catalogo') { R.view = 'prods'; pintarRecs(); return; }
    if (a === 'padrao') { carregarPadrao().then(pintarRecs); return; }
    if (a === 'pnovo') { modalProduto(null, null); return; }
    if (a === 'pedit') { modalProduto(ST.produtos.filter(function (x) { return x.id === v; })[0], null); return; }
    if (a === 'aplicar') { modalAplicar(v); return; }
    if (a === 'desfazer') {
      var r = recDe(R.id); delete dd(r).feito[v]; salvarRecLocal(r); pintarOrdem(); return;
    }
    if (a === 'editarrec') { R.W = wDeRec(recDe(R.id)); R.view = 'wiz'; pintarRecs(); topoRolagem(tR); return; }
    if (a === 'excluirrec') {
      if (!confirm('Excluir esta recomendação? Isso também tira do relatório do cliente.')) return;
      var id = R.id; ST.recs = ST.recs.filter(function (x) { return x.id !== id; }); gravar(); enfileirar('/api/agro/rec/apagar', { id: id });
      R.view = 'lista'; pintarRecs(); return;
    }
    if (a === 'prog') {
      var pr = v.split('|'), o = recDe(pr[0]); if (!o) return;
      var od = dd(o), tl = talDe(o).filter(function (t) { return feitoDe(o)[t] && !proxDe(o)[t] && venc(o, t) === pr[1]; });
      var W = novoW(o.fazenda_id);
      W.safra = o.safra || W.safra; W.tal = tl.slice(); W.op = o.operacao; W.data = pr[1] < hoje() ? hoje() : pr[1]; W.rep = Number(od.rep) || 0; W.total = Number(od.total) || 1;
      W.aviso = od.aviso == null ? 3 : Number(od.aviso); W.repMan = true; W.num = (Number(od.num) || 1) + 1; W.calda = od.calda || 100; W.tanque = od.tanque || 3000;
      W.resp = od.resp || ''; W.mostrar = !!o.mostrar; W.origem = { id: o.id, tal: tl.slice() }; W.passo = 2;
      R.W = W; R.view = 'wiz'; pintarRecs(); topoRolagem(tR);
    }
  }
  function mudancaRecs(el) {
    if (R.view === 'wiz' && el.dataset.w) { entradaWiz(el); return; }
    if (el.dataset.c === 'faz') { R.faz = el.value; ST.ult.faz = R.faz; gravar(); pintarRecs(); return; }
    if (el.dataset.a === 'mostrar') { var r = recDe(R.id); r.mostrar = el.checked; salvarRecLocal(r); toast(el.checked ? 'Vai aparecer no relatório do cliente' : 'Escondida do relatório do cliente'); }
  }

  /* ---------------- aviso de novidade (módulos liberados) ---------------- */
  function nv() { ST.novo = ST.novo || {}; return ST.novo; }
  function temModulo() { return !!(ST.mod && (ST.mod.plantio || ST.mod.recomendacoes)); }
  function marcaVisto(k) { if (!nv()[k]) { nv()[k] = true; gravar(); } botoes(); }
  function pontoNovo() { var b = $('#btnMapa'); if (b) b.classList.toggle('ag-ponto', temModulo() && !nv().mapa); }
  var avisoTimer = null;
  function avisoNovo() {
    if (avisoTimer || !temModulo() || nv().aviso) return;
    avisoTimer = setInterval(function () {
      if (!temModulo() || nv().aviso) { clearInterval(avisoTimer); avisoTimer = null; return; }
      var b = $('#btnMapa');
      // só aparece quando a pessoa está dentro do relatório da fazenda (nenhuma outra tela por cima)
      if (!b || !b.offsetParent || document.getElementById('agNovo') || document.querySelector('.tela:not(.oculto)')) return;
      var l = []; if (ST.mod.plantio) l.push('<b>Plantio dos talhões</b>'); if (ST.mod.recomendacoes) l.push('<b>Recomendações</b>');
      var d = document.createElement('div'); d.id = 'agNovo'; d.className = 'ag-novo';
      d.innerHTML = '<div class="ag-novo-card"><div class="ag-novo-ic">🌱</div><h3>Novidade no app!</h3>' +
        '<p>Agora você pode usar ' + l.join(' e ') + ', tudo pelo mapa da fazenda.</p>' +
        '<p class="ag-novo-como">Como acessar: toque em <b>🗺️ Mapa</b> no topo da tela e escolha ' + (ST.mod.plantio ? '<b>🌱 Plantio</b>' : '') + (ST.mod.plantio && ST.mod.recomendacoes ? ' ou ' : '') + (ST.mod.recomendacoes ? '<b>📋 Recomendações</b>' : '') + '.</p>' +
        '<button class="btn" id="agNovoVer">Abrir o mapa</button><button class="btn secundario" id="agNovoOk">Entendi</button></div>';
      document.body.appendChild(d);
      var fecha = function () { nv().aviso = true; gravar(); d.remove(); clearInterval(avisoTimer); avisoTimer = null; };
      document.getElementById('agNovoOk').onclick = fecha;
      document.getElementById('agNovoVer').onclick = function () { fecha(); var m = $('#btnMapa'); if (m) m.click(); };
    }, 1500);
  }

  /* ---------------- botões dentro da tela "Mapa da visita" ---------------- */
  function botoes() {
    var c = $('#telaMapa .conteudo'); if (!c) return;
    var box = document.getElementById('agMapaAcoes');
    if (!box) {
      box = document.createElement('div'); box.id = 'agMapaAcoes'; box.className = 'ag-mapa-acoes';
      box.innerHTML = '<button class="btn secundario" id="btnAbrirPlantio">🌱 Plantio</button><button class="btn secundario" id="btnAbrirRecs">📋 Recomendações</button>';
      c.insertBefore(box, c.firstChild);
      document.getElementById('btnAbrirPlantio').onclick = abrirPlantio;
      document.getElementById('btnAbrirRecs').onclick = abrirRecs;
    }
    document.getElementById('btnAbrirPlantio').classList.toggle('oculto', !ST.mod.plantio);
    document.getElementById('btnAbrirRecs').classList.toggle('oculto', !ST.mod.recomendacoes);
    box.classList.toggle('oculto', !ST.mod.plantio && !ST.mod.recomendacoes);
    document.getElementById('btnAbrirPlantio').classList.toggle('novo', !!ST.mod.plantio && !nv().plantio);
    document.getElementById('btnAbrirRecs').classList.toggle('novo', !!ST.mod.recomendacoes && !nv().recs);
    // se a conta tem módulo marcado mas o app não conseguiu liberar, mostra o motivo (em vez de ficar mudo)
    var er = document.getElementById('agErro');
    var msg = '';
    if (!temModulo()) {
      if (ST.erroMod && ST.erroMod !== 'sem conexão') msg = 'Não consegui verificar os módulos desta conta (' + ST.erroMod + '). ' + (/401|sess/i.test(ST.erroMod) ? 'Saia da conta e entre de novo, em Ajustes.' : 'Feche e abra o app com internet.');
      else if (ST.erroMod === 'sem conexão') msg = 'Sem conexão com o servidor para liberar Plantio e Recomendações. Abra o app com internet.';
      else if (ST.checado) msg = 'Plantio e Recomendações não estão liberados para a conta ' + (ST.email || '?') + '. Se deveria ter acesso, saia e entre de novo em Ajustes.';
    }
    if (msg) {
      if (!er) { er = document.createElement('div'); er.id = 'agErro'; er.className = 'ag-dica'; c.insertBefore(er, c.firstChild); }
      er.textContent = msg;
    } else if (er) { er.remove(); }
    var vr = document.getElementById('agVer');
    if (!vr) { vr = document.createElement('div'); vr.id = 'agVer'; vr.style.cssText = 'font-size:11px;color:#9aa5a0;text-align:center;padding:14px 0 4px'; c.appendChild(vr); }
    vr.textContent = 'Módulos ' + BUILD.slice(9, -1) + ' · Plantio ' + (ST.mod && ST.mod.plantio ? 'sim' : 'não') + ' · Recomendações ' + (ST.mod && ST.mod.recomendacoes ? 'sim' : 'não');
    pontoNovo(); avisoNovo();
  }

  /* ---------------- aviso de versão nova (o iPhone deixa o app aberto por dias) ---------------- */
  var BUILD = 'BUILD_ID=2026-10-18b;';
  var vVerif = 0;
  function verificarVersao() {
    if (!navigator.onLine || document.getElementById('agAtualiza') || Date.now() - vVerif < 60000) return;
    vVerif = Date.now();
    fetch('/?_=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.text() : ''; }).then(function (t) {
      var m = /BUILD_ID=([0-9a-z-]+);/.exec(t || '');
      if (!m || ('BUILD_ID=' + m[1] + ';') === BUILD || document.getElementById('agAtualiza')) return;
      var d = document.createElement('div'); d.id = 'agAtualiza';
      d.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:9998;background:#146034;color:#fff;border-radius:12px;padding:10px 12px;display:flex;align-items:center;gap:10px;font-size:14px;box-shadow:0 4px 16px rgba(0,0,0,.3)';
      d.innerHTML = '<span style="flex:1">🔄 Tem uma versão nova do app.</span><button style="background:#fff;color:#146034;border:0;border-radius:8px;padding:8px 12px;font-weight:700">Atualizar</button>';
      d.querySelector('button').onclick = function () { location.reload(); };
      document.body.appendChild(d);
    }).catch(function () { /* sem rede: tenta depois */ });
  }

  function ligarTela(el, clique, muda) {
    el.addEventListener('click', function (ev) {
      var n = ev.target.closest('[data-a]'); if (!n || !el.contains(n)) return;
      if (n.tagName === 'INPUT' || n.tagName === 'SELECT') return;
      clique(n.dataset.a, n.dataset.v, n);
    });
    el.addEventListener('change', function (ev) { var n = ev.target; if (n.tagName === 'INPUT' || n.tagName === 'SELECT' || n.tagName === 'TEXTAREA') muda(n); });
  }

  async function ligar() {
    carregar();
    var c = await Sync.conf(), uid = (await Sync.meuId()) || '';
    if ((c.email || '') !== (ST.email || '') || (uid && ST.uid && ST.uid !== uid)) { ST = { email: c.email || '', uid: uid, mod: { plantio: false, recomendacoes: false, admin: false }, plantio: [], recs: [], produtos: [], fila: [], ult: {} }; gravar(); }
    else if (uid && !ST.uid) { ST.uid = uid; gravar(); }
    tP = criarTela('telaPlantio'); tR = criarTela('telaRecs');
    ligarTela(tP, cliquePlantio, mudancaPlantio); ligarTela(tR, cliqueRecs, mudancaRecs);
    // plantio: digitar nos campos de texto atualiza na hora, sem redesenhar a tela
    tR.addEventListener('input', function (ev) { var n = ev.target; if (R.W && n.dataset && n.dataset.w === 'obs') R.W.obs = n.value; if (R.W && n.dataset && n.dataset.w === 'oplivre') R.W.op = n.value; });
    tP.addEventListener('input', function (ev) { var n = ev.target; if (n.dataset && n.dataset.k && n.tagName === 'INPUT') entradaPlantio(n); });
    zoomIniciar();
    botoes();
    var bm = $('#btnMapa'); if (bm) bm.addEventListener('click', function () { marcaVisto('mapa'); atualizarModulos(); });
    window.addEventListener('online', function () { atualizarModulos().then(descarregar); verificarVersao(); });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') { atualizarModulos().then(descarregar); verificarVersao(); } });
    atualizarModulos().then(descarregar);
    setTimeout(verificarVersao, 4000);
  }

  // se algo impedir os módulos de iniciar, mostra o motivo na tela do mapa (em vez de ficar mudo)
  function falhaLigar(e) {
    try {
      var c = $('#telaMapa .conteudo'); if (!c) return;
      var er = document.getElementById('agErro');
      if (!er) { er = document.createElement('div'); er.id = 'agErro'; er.className = 'ag-dica'; c.insertBefore(er, c.firstChild); }
      er.textContent = 'Plantio e Recomendações não iniciaram neste aparelho (' + ((e && e.message) || e || 'erro') + '). Feche e abra o app; se continuar, me mande esta mensagem.';
    } catch (x) { /* nada a fazer */ }
  }

  global.Agro = { ligar: ligar, atualizarModulos: atualizarModulos };
  document.addEventListener('DOMContentLoaded', function () { setTimeout(function () { ligar().catch(function (e) { falhaLigar(e); }); }, 400); });
})(window);
