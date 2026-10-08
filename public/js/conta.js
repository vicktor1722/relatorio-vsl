/* ============================================================
   conta.js — entrar na conta e cadastro de produtores e fazendas
   ============================================================ */
(function (global) {
  'use strict';

  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const abrir = id => $('#' + id).classList.remove('oculto');
  const fechar = id => $('#' + id).classList.add('oculto');
  const aviso = (el, txt, ok) => { el.innerHTML = txt ? '<div class="aviso"' + (ok ? ' style="background:#DCF8C6;color:#146034"' : '') + '>' + esc(txt) + '</div>' : ''; };

  let modoCriar = false;
  let cadastro = { produtores: [], fazendas: [], safras: [] };
  let fazendaEdicao = null, produtorEdicao = null, kmlPendente = null;

  /* ---------------- login ---------------- */

  async function mostrarLogin() {
    const q = await Sync.quemSou();
    $('#loginEmail').value = q.email || '';
    abrir('telaLogin');
  }

  function alternarModo() {
    modoCriar = !modoCriar;
    $('#loginExtra').classList.toggle('oculto', !modoCriar);
    $('#btnEntrar').textContent = modoCriar ? 'Criar conta e entrar' : 'Entrar';
    $('#btnAlternarConta').textContent = modoCriar ? 'Já tenho conta' : 'Criar uma conta';
    aviso($('#loginMsg'), '');
  }

  async function entrar() {
    const email = $('#loginEmail').value.trim();
    const senha = $('#loginSenha').value;
    const msg = $('#loginMsg');
    if (!email || !senha) { aviso(msg, 'Preencha e-mail e senha.'); return; }
    // se o aparelho era de outra conta, os dados dela não podem aparecer para a nova
    const dono = String((await Sync.conf()).email || '').toLowerCase();
    const outraConta = !!dono && dono !== email.toLowerCase();
    if (outraConta) {
      const pend = (await DB.pendentes()).length;
      if (pend && !confirm('Há ' + pend + ' registro(s) de ' + dono + ' que ainda não foram enviados. ' +
        'Entrar com outra conta apaga os dados deste aparelho e esses registros se perdem. Continuar?')) return;
    }
    $('#btnEntrar').disabled = true;
    aviso(msg, modoCriar ? 'Criando conta…' : 'Entrando…');
    try {
      if (modoCriar) {
        await Sync.registrar({
          email, senha,
          nome: $('#loginNome').value.trim(),
          convite: $('#loginConvite').value.trim()
        });
      } else {
        await Sync.entrar(email, senha);
      }
      $('#loginSenha').value = '';
      aviso(msg, '');
      fechar('telaLogin');
      if (outraConta) await Sync.limparDadosLocais();
      try {
        const perfil = await Sync.baixarPerfil();
        if (perfil && (perfil.empresa || perfil.cidade || perfil.logo)) {
          const c = (await DB.cfg('servidor')) || {};
          await DB.cfg('servidor', Object.assign(c, {
            empresa: perfil.empresa || c.empresa || '',
            cidade: perfil.cidade || c.cidade || '',
            logo: perfil.logo || c.logo || ''
          }));
        }
      } catch (e) { /* segue sem perfil */ }
      await atualizarCadastro(true);
      if (outraConta) { location.reload(); return; }   // recarrega para limpar o que estava na tela
      if (global.App && App.aoEntrar) await App.aoEntrar();
    } catch (e) {
      aviso(msg, e.message);
    } finally {
      $('#btnEntrar').disabled = false;
    }
  }

  async function trocarServidor() {
    const atual = (await Sync.conf()).api;
    const novo = prompt('Endereço do servidor:', atual);
    if (novo) { await Sync.salvarConf({ api: novo.trim().replace(/\/$/, '') }); aviso($('#loginMsg'), 'Servidor atualizado.', true); }
  }

  /* ---------------- cadastro ---------------- */

  let estadoCadastro = { falha: null, conta: '' };
  let ultimaBaixa = 0;

  async function atualizarCadastro(baixar) {
    if (baixar) {
      estadoCadastro = { falha: null, conta: String((await Sync.conf()).email || '') };
      ultimaBaixa = Date.now();
    }
    try {
      cadastro = baixar ? await Sync.baixarCadastro() : await Sync.cadastroLocal();
    } catch (e) {
      estadoCadastro.falha = e.message || 'erro';
      cadastro = await Sync.cadastroLocal();
    }
    renderCadastro();
    preencherSelecoes();
    return cadastro;
  }

  // atualização silenciosa ao voltar para o app, para vários celulares da mesma conta ficarem iguais
  async function atualizarSePrecisar() {
    if (!navigator.onLine || Date.now() - ultimaBaixa < 30000) return;
    if (!(await Sync.logado())) return;
    await atualizarCadastro(true);
  }

  // o mesmo cliente nunca é cadastrado duas vezes: confere a lista da nuvem antes de criar
  const norm = function (s) { return String(s || '').trim().replace(/\s+/g, ' ').toLowerCase(); };
  async function jaCadastrado(tipo, nome, produtorId) {
    if (navigator.onLine) await atualizarCadastro(true);
    const lista = tipo === 'produtor' ? (cadastro.produtores || []) : (cadastro.fazendas || []);
    return lista.find(function (x) {
      return norm(x.nome) === norm(nome) && (tipo === 'produtor' || (x.produtor_id || '') === (produtorId || ''));
    });
  }

  function statusCadastro() {
    let el = $('#avisoCadastro');
    if (!el) {
      const ref = $('#btnNovaFazenda');
      if (!ref || !ref.parentNode) return;
      el = document.createElement('div'); el.id = 'avisoCadastro';
      ref.parentNode.insertBefore(el, ref);
    }
    const quando = cadastro.em ? new Date(cadastro.em) : null;
    const hh = quando && !isNaN(quando)
      ? quando.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' +
        quando.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';
    if (estadoCadastro.falha) {
      el.className = 'aviso';
      el.innerHTML = '⚠️ Não consegui atualizar da nuvem agora (' + esc(estadoCadastro.falha) + '). ' +
        'Mostrando a última lista salva neste aparelho (' + hh + '). Toque em 🔄 para tentar de novo.';
    } else {
      el.className = '';
      el.innerHTML = '<div style="font-size:12px;color:#6B7B72;margin:0 2px 10px">Atualizado da nuvem em ' + hh +
        (estadoCadastro.conta ? ' · conta ' + esc(estadoCadastro.conta) : '') +
        ' — a lista é a mesma em todos os aparelhos desta conta.</div>';
    }
  }

  function renderCadastro() {
    const f = cadastro.fazendas || [], p = cadastro.produtores || [], sa = cadastro.safras || [];
    $('#subCadastro').textContent = f.length + ' fazenda(s) · ' + p.length + ' produtor(es) · ' + sa.length + ' safra(s)';
    statusCadastro();

    $('#listaSafras').innerHTML = sa.length ? sa.map(function (x) {
      return '<div class="lista-item"><div class="ic">🌱</div><div class="txt"><b>' + esc(x.nome) +
        '</b><span>safra cadastrada</span></div>' +
        '<button class="badge" data-safra="' + esc(x.id) + '">remover</button></div>';
    }).join('') : '<div class="aviso">Nenhuma safra cadastrada. Toque em <b>+ Nova safra</b>.</div>';

    $('#listaFazendas').innerHTML = f.length ? f.map(function (x) {
      const prod = p.find(y => y.id === x.produtor_id);
      return '<div class="lista-item" data-fazenda="' + esc(x.id) + '">' +
        '<div class="ic">🌾</div><div class="txt"><b>' + esc(x.nome) + '</b><span>' +
        (prod ? esc(prod.nome) + ' · ' : '') +
        (x.n_talhoes ? x.n_talhoes + ' talhões · ' + Math.round(x.area_ha || 0) + ' ha' : 'sem KML') +
        '</span></div><span class="badge">editar</span></div>';
    }).join('') : '<div class="aviso">Nenhuma fazenda cadastrada.</div>';

    $('#listaProdutores').innerHTML = p.length ? p.map(function (x) {
      const n = f.filter(y => y.produtor_id === x.id).length;
      return '<div class="lista-item" data-produtor="' + esc(x.id) + '">' +
        '<div class="ic">👤</div><div class="txt"><b>' + esc(x.nome) + '</b><span>' +
        (x.telefone ? esc(x.telefone) + ' · ' : '') + n + ' fazenda(s)</span></div>' +
        '<span class="badge">editar</span></div>';
    }).join('') : '<div class="aviso">Nenhum produtor cadastrado.</div>';

    document.querySelectorAll('[data-safra]').forEach(el => el.onclick = async function () {
      const s = (cadastro.safras || []).find(x => x.id === el.dataset.safra);
      if (!s || !confirm('Remover a safra ' + s.nome + ' do cadastro?')) return;
      await Sync.apagarCadastro('safra', s.id);
      await atualizarCadastro(false);
    });
    document.querySelectorAll('[data-fazenda]').forEach(el => el.onclick = () => abrirFazenda(el.dataset.fazenda));
    document.querySelectorAll('[data-produtor]').forEach(el => el.onclick = () => abrirProdutor(el.dataset.produtor));
  }

  function sugestaoSafra() {
    const d = new Date();
    const a = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
    return a + '/' + String((a + 1) % 100).padStart(2, '0');
  }

  async function novaSafra() {
    const nome = prompt('Nome da safra:', sugestaoSafra());
    if (!nome || !nome.trim()) return;
    try {
      await Sync.salvarSafra({ nome: nome.trim() });
      await atualizarCadastro(false);
    } catch (e) { alert('Não salvou: ' + e.message); }
  }

  function preencherSelecoes() {
    const p = cadastro.produtores || [], f = cadastro.fazendas || [], sa = cadastro.safras || [];

    const selSafra = $('#fSafraSel');
    if (selSafra) {
      const v = selSafra.value || selSafra.dataset.pendente || '';
      let ops = sa.map(x => '<option value="' + esc(x.nome) + '">' + esc(x.nome) + '</option>');
      if (v && !sa.some(x => x.nome === v)) ops.unshift('<option value="' + esc(v) + '">' + esc(v) + '</option>');
      selSafra.innerHTML = (sa.length || v ? '' : '<option value="">— cadastre uma safra —</option>') + ops.join('');
      if (v) selSafra.value = v;
    }
    const opcoesProd = '<option value="">— selecione —</option>' +
      p.map(x => '<option value="' + esc(x.id) + '">' + esc(x.nome) + '</option>').join('');

    const selFazProd = $('#fzProdutor');
    if (selFazProd) { const v = selFazProd.value; selFazProd.innerHTML = opcoesProd; selFazProd.value = v; }

    const selRelProd = $('#fProdutorSel');
    if (selRelProd) { const v = selRelProd.value; selRelProd.innerHTML = opcoesProd; selRelProd.value = v; }

    const selRelFaz = $('#fFazendaSel');
    if (selRelFaz) {
      const prodSel = selRelProd ? selRelProd.value : '';
      const lista = prodSel ? f.filter(x => x.produtor_id === prodSel || !x.produtor_id) : f;
      const v = selRelFaz.value;
      selRelFaz.innerHTML = '<option value="">— selecione —</option>' +
        lista.map(x => '<option value="' + esc(x.id) + '">' + esc(x.nome) + '</option>').join('');
      selRelFaz.value = v;
      mostrarTalhoesDaFazenda();
    }
  }

  function fazendaPorId(id) { return (cadastro.fazendas || []).find(x => x.id === id) || null; }
  function produtorPorId(id) { return (cadastro.produtores || []).find(x => x.id === id) || null; }

  function mostrarTalhoesDaFazenda() {
    const info = $('#fTalhoesInfo'); if (!info) return;
    const f = fazendaPorId($('#fFazendaSel').value);
    info.textContent = f
      ? (f.n_talhoes ? '📐 ' + f.n_talhoes + ' talhões · ' + Math.round(f.area_ha || 0) + ' ha, já importados'
                     : '⚠️ esta fazenda ainda não tem KML')
      : '';
  }

  /* ---------------- produtor ---------------- */

  function abrirProdutor(id) {
    produtorEdicao = id ? produtorPorId(id) : null;
    const p = produtorEdicao || {};
    $('#tituloProdutor').textContent = id ? 'Editar produtor' : 'Novo produtor';
    $('#pNome').value = p.nome || ''; $('#pDoc').value = p.documento || '';
    $('#pTel').value = p.telefone || ''; $('#pObs').value = p.observacoes || '';
    $('#btnApagarProdutor').classList.toggle('oculto', !id);
    abrir('telaProdutor');
  }

  async function salvarProdutor() {
    const nome = $('#pNome').value.trim();
    if (!nome) { alert('Informe o nome do produtor.'); return; }
    $('#btnSalvarProdutor').disabled = true;
    try {
      if (!produtorEdicao) {
        const ja = await jaCadastrado('produtor', nome);
        if (ja) {
          alert('O produtor "' + ja.nome + '" já está cadastrado nesta conta. Para alterar, toque nele na lista.');
          fechar('telaProdutor'); return;
        }
      }
      await Sync.salvarProdutor({
        id: produtorEdicao ? produtorEdicao.id : null, nome: nome,
        documento: $('#pDoc').value.trim(), telefone: $('#pTel').value.trim(),
        observacoes: $('#pObs').value.trim()
      });
      if (Sync.foiRepetido()) alert('Esse produtor já estava cadastrado em outro aparelho. Mantive o cadastro que já existe.');
      await atualizarCadastro(false);
      fechar('telaProdutor');
    } catch (e) { alert('Não salvou: ' + e.message); }
    finally { $('#btnSalvarProdutor').disabled = false; }
  }

  /* ---------------- fazenda ---------------- */

  function abrirFazenda(id) {
    fazendaEdicao = id ? fazendaPorId(id) : null;
    kmlPendente = null;
    const f = fazendaEdicao || {};
    $('#tituloFazenda').textContent = id ? 'Editar fazenda' : 'Nova fazenda';
    $('#fzNome').value = f.nome || ''; $('#fzMunicipio').value = f.municipio || '';
    $('#fzUf').value = f.uf || '';
    preencherSelecoes();
    $('#fzProdutor').value = f.produtor_id || '';
    $('#fzCampoNomeBox').classList.add('oculto');
    statusKmlFazenda(f.talhoes || null, f.n_talhoes, f.area_ha);
    $('#btnApagarFazenda').classList.toggle('oculto', !id);
    abrir('telaFazenda');
  }

  function statusKmlFazenda(gj, n, area) {
    const qtd = gj && gj.features ? gj.features.length : (n || 0);
    const ha = gj && gj.features
      ? gj.features.reduce((s, x) => s + ((x.properties && x.properties.area_ha) || 0), 0)
      : (area || 0);
    $('#fzStatusKml').innerHTML = '<div class="ic">📐</div><div class="txt"><b>' +
      (qtd ? qtd + ' talhões · ' + ha.toFixed(1) + ' ha' : 'Nenhum talhão carregado') + '</b><span>' +
      (qtd ? 'toque no mapa abaixo para conferir' : 'Importe o KML da fazenda') + '</span></div>';
    desenharTalhoes(gj);
  }

  // mapa + lista dos talhões na tela da fazenda
  function desenharTalhoes(gj) {
    const mapa = $('#fzMapa'), lista = $('#fzListaTalhoes');
    if (!gj || !gj.features || !gj.features.length) {
      mapa.classList.add('oculto'); mapa.innerHTML = ''; lista.innerHTML = '';
      return;
    }
    mapa.classList.remove('oculto');
    mapa.innerHTML = Geo.svgTalhoes(gj);
    const linhas = gj.features.map(function (f) {
      const a = f.properties.area_ha;
      return '<tr><td style="padding:4px 8px 4px 0">' + esc(f.properties.nome) + '</td>' +
        '<td style="padding:4px 0;text-align:right;color:#667781">' + (a ? a.toFixed(1) + ' ha' : '—') + '</td></tr>';
    }).join('');
    lista.innerHTML = '<div class="lista-item" style="display:block"><table style="width:100%;font-size:13.5px">' +
      linhas + '</table></div>';
  }

  // seletor de qual atributo vira o nome do talhão
  function montarSeletorNome(gj) {
    const box = $('#fzCampoNomeBox'), sel = $('#fzCampoNome'), amo = $('#fzCampoNomeAmostra');
    const opcoes = Geo.atributos(gj);
    if (!opcoes.length) { box.classList.add('oculto'); return; }
    box.classList.remove('oculto');
    sel.innerHTML = opcoes.map(function (o) {
      return '<option value="' + esc(o.chave) + '">' + esc(o.rotulo) + '</option>';
    }).join('');
    const mostrarAmostra = function () {
      const o = opcoes.find(function (x) { return x.chave === sel.value; });
      amo.textContent = o && o.amostra ? 'Ex.: ' + o.amostra : '';
    };
    sel.onchange = function () {
      Geo.aplicarNome(kmlPendente, sel.value);
      mostrarAmostra();
      statusKmlFazenda(kmlPendente);
    };
    mostrarAmostra();
  }

  async function salvarFazenda() {
    const nome = $('#fzNome').value.trim();
    if (!nome) { alert('Informe o nome da fazenda.'); return; }
    $('#btnSalvarFazenda').disabled = true;
    try {
      if (!fazendaEdicao) {
        const ja = await jaCadastrado('fazenda', nome, $('#fzProdutor').value || '');
        if (ja) {
          alert('A fazenda "' + ja.nome + '" já está cadastrada para esse produtor. Para alterar, toque nela na lista.');
          fechar('telaFazenda'); return;
        }
      }
      const corpo = {
        id: fazendaEdicao ? fazendaEdicao.id : null,
        nome: nome,
        produtor_id: $('#fzProdutor').value || null,
        municipio: $('#fzMunicipio').value.trim(),
        uf: $('#fzUf').value.trim().toUpperCase()
      };
      if (kmlPendente) corpo.talhoes = kmlPendente;
      else if (fazendaEdicao && fazendaEdicao.talhoes) corpo.talhoes = fazendaEdicao.talhoes;
      await Sync.salvarFazenda(corpo);
      if (Sync.foiRepetido()) alert('Essa fazenda já estava cadastrada em outro aparelho. Mantive o cadastro que já existe.');
      await atualizarCadastro(false);
      fechar('telaFazenda');
    } catch (e) { alert('Não salvou: ' + e.message); }
    finally { $('#btnSalvarFazenda').disabled = false; }
  }

  async function importarKmlFazenda(file) {
    try {
      const gj = await Geo.importarArquivo(file);
      if (!gj.features.length) { alert('Nenhum polígono encontrado no arquivo.'); return; }
      kmlPendente = gj;
      montarSeletorNome(gj);
      statusKmlFazenda(gj);
    } catch (e) { alert('Erro no KML: ' + e.message); }
  }

  /* ---------------- ligações ---------------- */

  function ligar() {
    $('#btnEntrar').onclick = entrar;
    $('#btnAlternarConta').onclick = alternarModo;
    if ($('#btnTrocarServidor')) $('#btnTrocarServidor').onclick = trocarServidor;
    $('#loginSenha').addEventListener('keydown', e => { if (e.key === 'Enter') entrar(); });

    $('#btnAbrirCadastro').onclick = async function () { await atualizarCadastro(true); abrir('telaCadastro'); };
    $('#btnAtualizarCadastro').onclick = async function () {
      const b = this; b.disabled = true;
      const el = $('#avisoCadastro');
      if (el) { el.className = ''; el.innerHTML = '<div style="font-size:12px;color:#6B7B72;margin:0 2px 10px">Atualizando da nuvem…</div>'; }
      try { await atualizarCadastro(true); } finally { b.disabled = false; }
    };
    $('#btnNovoProdutor').onclick = () => abrirProdutor(null);
    $('#btnNovaFazenda').onclick = () => abrirFazenda(null);
    $('#btnNovaSafra').onclick = novaSafra;
    $('#btnSalvarProdutor').onclick = salvarProdutor;
    $('#btnSalvarFazenda').onclick = salvarFazenda;
    $('#btnFzKml').onclick = () => $('#inpKml').click();

    $('#btnApagarProdutor').onclick = async function () {
      if (!produtorEdicao || !confirm('Apagar este produtor do cadastro?')) return;
      await Sync.apagarCadastro('produtor', produtorEdicao.id);
      await atualizarCadastro(false); fechar('telaProdutor');
    };
    $('#btnApagarFazenda').onclick = async function () {
      if (!fazendaEdicao || !confirm('Apagar esta fazenda e seus talhões do cadastro?')) return;
      await Sync.apagarCadastro('fazenda', fazendaEdicao.id);
      await atualizarCadastro(false); fechar('telaFazenda');
    };

    const selProd = $('#fProdutorSel'), selFaz = $('#fFazendaSel');
    if (selProd) selProd.onchange = preencherSelecoes;
    if (selFaz) selFaz.onchange = mostrarTalhoesDaFazenda;

    $('#btnSair').onclick = async function () {
      if (!confirm('Sair da conta? Os relatórios já salvos continuam neste aparelho.')) return;
      await Sync.sair();
      location.reload();
    };

    Sync.aoMudar(function (evt) { if (evt.tipo === 'sem-sessao') mostrarLogin(); });
  }

  global.Conta = {
    ligar, mostrarLogin, atualizarCadastro, atualizarSePrecisar, fazendaPorId, produtorPorId,
    importarKmlFazenda, preencherSelecoes,
    telaFazendaAberta: () => !$('#telaFazenda').classList.contains('oculto'),
    dados: () => cadastro
  };
})(window);
