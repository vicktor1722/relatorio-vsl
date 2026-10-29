/* ============================================================
   portalpagina.js — a página amvs.ia.br/portal (login da fazenda e do operador)
   Uma página só: entra com login/senha e mostra a visão do papel do acesso.
   (O JavaScript abaixo fica dentro de um template literal: nada de crases nem dólar+chave.)
   ============================================================ */

import { AGRO_REL_CSS, AGRO_REL_JS } from './agrorel.js';

export function paginaPortal() {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#1B7A43">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="AMVS Fazenda">
<link rel="apple-touch-icon" href="/api/icone/app.png">
<title>Acesso da fazenda · AMVS</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<style>
:root{--verde:#1B7A43;--verde-escuro:#146034;--verde-claro:#E3F2E8;--linha:#E1E7E3;--fraco:#6B7B72;--texto:#1C2B23;--fundo:#F3F5F4;--erro:#C62828;--laranja:#E08A00}
*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:var(--fundo);color:var(--texto);-webkit-text-size-adjust:100%;overflow-wrap:break-word}
.obs,.ap-sub,.tl .n,.caixa,.nota,.grupo-leg,.px{overflow-wrap:anywhere;min-width:0}
button{font:inherit;cursor:pointer}
.oculto{display:none!important}
.login{min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:20px}
.login .card{background:#fff;border-radius:18px;padding:26px 22px;width:100%;max-width:380px;box-shadow:0 6px 24px rgba(0,0,0,.08)}
.login h1{margin:0 0 4px;font-size:22px;color:var(--verde-escuro)}.login p{margin:0 0 18px;color:var(--fraco);font-size:14px}
.campo{margin-bottom:12px}.campo label{display:block;font-size:12.5px;color:var(--fraco);margin-bottom:4px}
.campo input,.campo select{width:100%;font-size:16px;padding:11px 12px;border:1px solid #CFD8D3;border-radius:10px;background:#fff;color:var(--texto)}
.btn{display:block;width:100%;border:0;border-radius:12px;background:var(--verde);color:#fff;font-weight:700;font-size:16px;padding:13px}
.btn:disabled{opacity:.5}.btn.sec{background:#fff;color:var(--verde);border:1.5px solid var(--verde)}
.msg{font-size:13.5px;color:var(--erro);margin-top:10px;min-height:18px}
header.topo{background:var(--verde);color:#fff;padding:calc(12px + env(safe-area-inset-top,0px)) 16px 12px;position:sticky;top:0;z-index:1000;display:flex;align-items:center;gap:10px}
header.topo .info{flex:1;min-width:0}header.topo h1{margin:0;font-size:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
header.topo p{margin:2px 0 0;font-size:12.5px;opacity:.85}
header.topo button{background:rgba(255,255,255,.18);color:#fff;border:0;border-radius:10px;padding:8px 12px;font-size:13px;font-weight:600}
.corpo{max-width:900px;margin:0 auto;padding:12px 14px 60px}
.sel{display:flex;gap:10px;flex-wrap:wrap}.sel .campo{flex:1;min-width:150px;margin-bottom:8px}
.abas{display:flex;gap:4px;background:#E4EAE6;border-radius:12px;padding:3px;margin:4px 0 14px;overflow-x:auto}
.abas button{flex:1;white-space:nowrap;border:0;background:none;padding:9px 10px;border-radius:10px;font-size:14px;font-weight:600;color:var(--fraco)}
.abas button.on{background:#fff;color:var(--verde-escuro);box-shadow:0 1px 3px rgba(0,0,0,.12)}
h2.talhao{font-size:16px;color:var(--verde-escuro);margin:18px 0 10px;padding-bottom:6px;border-bottom:2px solid var(--verde)}
h2.talhao small{float:right;font-weight:400;color:var(--fraco);font-size:12px;padding-top:3px}
.caixa{background:#fff;border:1px solid var(--linha);border-radius:12px;padding:12px;margin-bottom:12px}
.vazio{background:#fff;border:1px dashed #CFD8D3;border-radius:12px;padding:18px;text-align:center;color:var(--fraco);font-size:14px}
.kpis{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}.kpis div{background:#fff;border:1px solid var(--linha);border-radius:12px;padding:10px 12px;flex:1;min-width:140px}
.kpis b{display:block;font-size:18px;color:var(--verde-escuro)}.kpis span{font-size:12px;color:var(--fraco)}
.tab{overflow-x:auto;background:#fff;border:1px solid var(--linha);border-radius:12px;margin-bottom:14px}
table{width:100%;border-collapse:collapse;font-size:13px;min-width:560px}
th{font-size:11.5px;color:var(--fraco);text-align:right;padding:8px;border-bottom:1px solid var(--linha);white-space:nowrap}
td{text-align:right;padding:8px;border-bottom:1px solid #EEF1EF;white-space:nowrap}
th:first-child,td:first-child{text-align:left}tr:last-child td{border-bottom:0}
.neg{color:var(--erro);font-weight:700}.sem{color:var(--fraco)}
.mapa-sat{height:420px;border-radius:12px;overflow:hidden;border:1px solid var(--linha);background:#DDE5DF}
.leg{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12.5px;margin:8px 2px 4px}.leg i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:5px;vertical-align:-1px}
.tg{display:flex;gap:6px;margin-bottom:8px}.tg button{border:1px solid var(--linha);background:#fff;border-radius:16px;padding:6px 12px;font-size:13px}
.tg button.on{background:var(--verde);border-color:var(--verde);color:#fff}
.rot{background:none;border:0;box-shadow:none;color:#fff;font-weight:700;font-size:12px;text-shadow:0 0 3px #000,0 0 3px #000;white-space:nowrap}
/* operador */
.chips{display:flex;gap:6px;margin-bottom:10px}.chips button{border:1px solid var(--linha);background:#fff;border-radius:16px;padding:7px 14px;font-size:14px}
.chips button.on{background:var(--verde);color:#fff;border-color:var(--verde)}
.ap{background:#fff;border:1px solid var(--linha);border-radius:14px;padding:12px;margin-bottom:12px;border-left:5px solid var(--laranja)}
.ap.aplicada{border-left-color:var(--verde)}.ap.atrasada{border-left-color:var(--erro)}
.ap-h{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.ap-h b{font-size:16.5px}
.selo{display:inline-block;font-size:11.5px;padding:3px 9px;border-radius:10px;background:#FFF3DC;color:#8A5A00;font-weight:700;white-space:nowrap}
.selo.ok{background:var(--verde-claro);color:var(--verde-escuro)}.selo.venc{background:#FDE4E4;color:var(--erro)}
.ap-sub{font-size:13px;color:var(--fraco);margin:3px 0 8px}
.pr{display:grid;grid-template-columns:1fr auto auto;gap:4px 12px;font-size:14px;padding:8px 10px;background:#F6F8F7;border-radius:10px;margin-bottom:8px}
.pr .h{font-size:11px;color:var(--fraco);text-transform:uppercase;letter-spacing:.3px}.pr .q{font-weight:700;color:var(--verde-escuro);text-align:right}.pr .d{text-align:right;color:var(--fraco)}
.calda{font-size:13px;background:#E6F0FA;color:#1A4E85;border-radius:10px;padding:7px 10px;margin-bottom:8px}
.obs{font-size:13px;background:#FFFBEF;border-radius:10px;padding:7px 10px;margin-bottom:8px}
.tl{display:flex;align-items:center;gap:10px;padding:9px 4px;border-top:1px dashed var(--linha);font-size:14.5px}
.tl input{width:24px;height:24px;accent-color:var(--verde);flex:none}.tl .n{flex:1}.tl .n small{display:block;font-size:12px;color:var(--fraco)}
.tl .feito{color:var(--verde-escuro);font-size:12.5px;text-align:right}.tl .desf{border:0;background:none;color:var(--fraco);text-decoration:underline;font-size:12px}
.marcar{display:flex;gap:8px;align-items:flex-end;margin-top:10px;flex-wrap:wrap}.marcar .campo{margin:0;flex:0 0 150px}.marcar .btn{flex:1;min-width:160px}
.vermapa{border:0;background:none;color:var(--verde);font-weight:600;font-size:13px;padding:4px 0}
.mini{height:260px;border-radius:10px;overflow:hidden;margin-top:8px;border:1px solid var(--linha)}
.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#222;color:#fff;padding:10px 16px;border-radius:12px;font-size:14px;z-index:3000;max-width:90%}
.rodape{text-align:center;color:var(--fraco);font-size:12px;margin-top:24px}.rodape a{color:var(--verde)}
${AGRO_REL_CSS}
</style></head><body>

<div class="login" id="telaLogin">
  <div class="card">
    <h1>🌱 Acesso da fazenda</h1>
    <p>Entre com o login e a senha que o consultor passou para você.</p>
    <div class="campo"><label>Login</label><input id="lgLogin" autocomplete="username" autocapitalize="none" placeholder="ex.: fazenda.catarinense"></div>
    <div class="campo"><label>Senha</label><input id="lgSenha" type="password" autocomplete="current-password"></div>
    <button class="btn" id="lgEntrar">Entrar</button>
    <div class="msg" id="lgMsg"></div>
    <div class="rodape">AMVS Relatório · <a href="/termos">Termos de Uso</a></div>
  </div>
</div>

<div id="telaApp" class="oculto">
  <header class="topo"><div class="info"><h1 id="hNome">—</h1><p id="hSub">—</p></div><button id="btnSair">Sair</button></header>
  <div class="corpo">
    <div class="sel"><div class="campo" id="boxFaz"><label>Fazenda</label><select id="selFaz"></select></div>
      <div class="campo" id="boxSafra"><label>Safra</label><select id="selSafra"></select></div></div>
    <div id="conteudo"><div class="vazio">Carregando…</div></div>
    <div class="rodape">AMVS Relatório · <a href="/termos">Termos de Uso</a></div>
  </div>
</div>

<script>${AGRO_REL_JS}</script>
<script>
(function () {
  var CH = 'amvs-portal', tok = '', eu = null, D = null, aba = 'apl', filtro = 'fazer', mapas = [], modoMapa = 'var';
  try { tok = localStorage.getItem(CH) || ''; } catch (e) {}
  var $ = function (s) { return document.querySelector(s); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function n(v, d) { return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  function brl(v) { return 'R$ ' + n(v, 2); }
  function dataBR(i) { var p = String(i || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : '—'; }
  function hoje() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function dif(a, b) { return Math.round((new Date(a + 'T12:00:00Z') - new Date(b + 'T12:00:00Z')) / 864e5); }
  function toast(m) { var t = document.createElement('div'); t.className = 'toast'; t.textContent = m; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3200); }
  // total para o tanque: mL vira L e g vira kg (o operador mede em litro/quilo)
  function total(q, u) { var x = String(u || '').split('/')[0]; if (x === 'mL') return [q / 1000, 'L']; if (x === 'g') return [q / 1000, 'kg']; if (x === 't') return [q, 't']; return [q, x || 'L']; }

  async function api(rota, corpo) {
    var r = await fetch(rota, { method: corpo ? 'POST' : 'GET', headers: Object.assign({ Authorization: 'Bearer ' + tok }, corpo ? { 'Content-Type': 'application/json' } : {}), body: corpo ? JSON.stringify(corpo) : undefined });
    var j = null; try { j = await r.json(); } catch (e) {}
    if (r.status === 401 && rota !== '/api/portal/entrar') { sair(); throw new Error('Entre de novo'); }
    if (!r.ok) throw new Error((j && j.erro) || ('HTTP ' + r.status));
    return j;
  }
  function sair() { tok = ''; try { localStorage.removeItem(CH); } catch (e) {} $('#telaApp').classList.add('oculto'); $('#telaLogin').classList.remove('oculto'); }

  $('#lgEntrar').onclick = async function () {
    var b = this; b.disabled = true; $('#lgMsg').textContent = '';
    try {
      var r = await api('/api/portal/entrar', { login: $('#lgLogin').value, senha: $('#lgSenha').value });
      tok = r.token; try { localStorage.setItem(CH, tok); } catch (e) {}
      $('#lgSenha').value = ''; await iniciar();
    } catch (e) { $('#lgMsg').textContent = e.message; }
    b.disabled = false;
  };
  $('#lgSenha').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('#lgEntrar').click(); });
  $('#btnSair').onclick = function () { if (confirm('Sair deste acesso?')) sair(); };

  async function iniciar() {
    eu = await api('/api/portal/eu');
    $('#telaLogin').classList.add('oculto'); $('#telaApp').classList.remove('oculto');
    $('#hSub').textContent = eu.papel_nome + ' · ' + eu.nome;
    var sf = $('#selFaz'), ult = ''; try { ult = localStorage.getItem(CH + ':faz') || ''; } catch (e) {}
    sf.innerHTML = eu.fazendas.map(function (f) { return '<option value="' + esc(f.id) + '"' + (f.id === ult ? ' selected' : '') + '>' + esc(f.nome) + '</option>'; }).join('');
    $('#boxFaz').classList.toggle('oculto', eu.fazendas.length < 2);
    $('#boxSafra').classList.toggle('oculto', eu.papel === 'operador');
    if (!eu.fazendas.length) { $('#conteudo').innerHTML = '<div class="vazio">Nenhuma fazenda liberada para este acesso. Fale com o consultor.</div>'; return; }
    await carregar();
  }
  $('#selFaz').onchange = function () { try { localStorage.setItem(CH + ':faz', this.value); } catch (e) {} D = null; carregar(); };
  $('#selSafra').onchange = function () { carregar(this.value); };

  async function carregar(safra) {
    var fid = $('#selFaz').value;
    if (!D) $('#conteudo').innerHTML = '<div class="vazio">Carregando…</div>';
    try { D = await api('/api/portal/fazenda?id=' + encodeURIComponent(fid) + (safra ? '&safra=' + encodeURIComponent(safra) : '')); }
    catch (e) { $('#conteudo').innerHTML = '<div class="vazio">' + esc(e.message) + '</div>'; return; }
    $('#hNome').textContent = D.fazenda.nome;
    $('#selSafra').innerHTML = (D.safras.length ? D.safras : [D.safra]).map(function (s) { return '<option' + (s === D.safra ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('');
    pintar();
  }

  /* ---------- mapa (satélite + talhões) ---------- */
  var CORES = ['#2E7D32', '#F9A825', '#1565C0', '#C62828', '#6A1B9A', '#00838F', '#EF6C00', '#558B2F', '#AD1457', '#4E342E'];
  function desenharMapa(el, estilo, rotulo) {
    if (!window.L || !D.mapa || !D.mapa.features || !D.mapa.features.length) { el.innerHTML = '<div class="vazio" style="border:0">Mapa da fazenda ainda não cadastrado (KML).</div>'; return null; }
    var m = L.map(el, { scrollWheelZoom: false });
    var esri = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
    L.tileLayer(esri + 'World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, maxNativeZoom: 18, attribution: 'Imagens © Esri' }).addTo(m);
    var g = L.geoJSON(D.mapa);
    m.fitBounds(g.getBounds(), { padding: [16, 16], maxZoom: 17 });   // enquadra antes de desenhar
    L.geoJSON(D.mapa, {
      style: function (f) { return estilo((f.properties || {}).nome || ''); },
      onEachFeature: function (f, c) {
        var nm = (f.properties || {}).nome || '';
        c.bindPopup(rotulo(nm, f.properties || {}));
        c.bindTooltip(esc(nm), { permanent: true, direction: 'center', className: 'rot' });
      }
    }).addTo(m);
    mapas.push(m);
    return m;
  }
  function plantioDe(t) { return (D.plantio || []).filter(function (p) { return p.talhao === t; })[0] || null; }
  var NC = { soja: 'Soja', milho: 'Milho', algodao: 'Algodão', feijao: 'Feijão', sorgo: 'Sorgo', trigo: 'Trigo', pastagem: 'Pastagem', pousio: 'Pousio', outra: 'Outra' };

  function vistaMapas() {
    var vars = {}, haVar = {}, i = 0, areas = {};
    ((D.mapa && D.mapa.features) || []).forEach(function (f) { var q = f.properties || {}; if (q.nome) areas[q.nome] = Number(q.area_ha) || 0; });
    (D.plantio || []).forEach(function (p) { var k = p.variedade || (p.cultura ? NC[p.cultura] || p.cultura : ''); if (!k) return; if (!vars[k]) vars[k] = CORES[i++ % CORES.length]; haVar[k] = (haVar[k] || 0) + (areas[p.talhao] || 0); });
    var h = '<div class="tg"><button data-mm="var" class="' + (modoMapa === 'var' ? 'on' : '') + '">Variedade</button><button data-mm="area" class="' + (modoMapa === 'area' ? 'on' : '') + '">Áreas</button></div>' +
      '<div class="mapa-sat" id="mapaFaz"></div>';
    if (modoMapa === 'var') h += '<div class="leg">' + (Object.keys(vars).length ? Object.keys(vars).map(function (k) { return '<span><i style="background:' + vars[k] + '"></i>' + esc(k) + (haVar[k] ? ' · ' + n(haVar[k], 1) + ' ha' : '') + '</span>'; }).join('') + '<span><i style="background:#9AA5A0"></i>sem plantio</span>' : '<span>Plantio ainda não informado.</span>') + '</div>';
    else h += '<div class="leg"><span>Toque no talhão para ver a área.</span></div>';
    $('#conteudo').innerHTML = abas() + h;
    document.querySelectorAll('[data-mm]').forEach(function (b) { b.onclick = function () { modoMapa = b.dataset.mm; pintar(); }; });
    desenharMapa($('#mapaFaz'), function (nm) {
      if (modoMapa === 'area') return { color: '#FFFFFF', weight: 2, fillColor: '#2FA05A', fillOpacity: 0.22 };
      var p = plantioDe(nm), k = p ? (p.variedade || NC[p.cultura] || p.cultura) : '';
      return { color: '#FFFFFF', weight: 2, fillColor: vars[k] || '#9AA5A0', fillOpacity: 0.55 };
    }, function (nm, q) {
      var p = plantioDe(nm);
      return '<b>' + esc(nm) + '</b>' + (q.area_ha ? '<br>' + n(q.area_ha, 1) + ' ha' : '') +
        (p ? '<br>' + esc(NC[p.cultura] || p.cultura || '') + (p.variedade ? ' · ' + esc(p.variedade) : '') + (p.data_plantio ? '<br>plantio ' + dataBR(p.data_plantio) : '') : '');
    });
  }

  /* ---------- visão da fazenda ---------- */
  function abas() {
    if (eu.papel === 'operador') return '';
    return '<div class="abas">' + [['apl', 'Aplicações'], ['mapa', 'Mapas'], ['plantio', 'Plantio'], ['est', 'Estoque e custos']].map(function (x) {
      return '<button data-aba="' + x[0] + '" class="' + (aba === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div>';
  }
  function ligarAbas() { document.querySelectorAll('[data-aba]').forEach(function (b) { b.onclick = function () { aba = b.dataset.aba; pintar(); window.scrollTo(0, 0); }; }); }

  function pintar() {
    mapas.forEach(function (m) { try { m.remove(); } catch (e) {} }); mapas = [];
    if (eu.papel === 'operador') return vistaOperador();
    if (aba === 'mapa') vistaMapas();
    else if (aba === 'plantio') {
      var lin = (D.plantio || []).slice().sort(function (a, b) { return String(a.talhao).localeCompare(b.talhao, 'pt-BR', { numeric: true }); }).map(function (p) {
        var dae = p.data_emerg ? dif(hoje(), p.data_emerg) : null;
        return '<tr><td><b>' + esc(p.talhao) + '</b></td><td style="text-align:left">' + esc(NC[p.cultura] || p.cultura || '—') + '</td><td style="text-align:left">' + esc(p.variedade || '—') + '</td><td>' + dataBR(p.data_plantio) + '</td><td>' + (dae !== null && dae >= 0 ? dae : '—') + '</td></tr>';
      }).join('');
      $('#conteudo').innerHTML = abas() + (D.blocos.evolucao || '<div class="vazio">Evolução do plantio aparece quando as datas de plantio forem lançadas.</div>') +
        (lin ? '<h2 class="talhao">Talhões</h2><div class="tab"><table><tr><th>Talhão</th><th style="text-align:left">Cultura</th><th style="text-align:left">Variedade</th><th>Plantio</th><th>DAE</th></tr>' + lin + '</table></div>' : '');
    } else if (aba === 'est') vistaEstoque();
    else {
      $('#conteudo').innerHTML = abas() + ((D.blocos.proximas || '') + (D.blocos.aplicacoes || '') || '<div class="vazio">Nenhuma aplicação nesta safra ainda.</div>');
    }
    ligarAbas();
  }

  function vistaEstoque() {
    var e = D.estoque || [], val = 0, gasto = 0;
    e.forEach(function (x) { val += x.valor_saldo; gasto += x.gasto; });
    var h = abas() + '<div class="kpis"><div><b>' + brl(val) + '</b><span>valor em estoque</span></div><div><b>' + brl(gasto) + '</b><span>gasto em produtos aplicados</span></div></div>';
    h += '<h2 class="talhao">Estoque de produtos</h2>' + (e.length ? '<div class="tab"><table><tr><th>Produto</th><th>Entradas</th><th>Aplicado</th><th>A aplicar</th><th>Saldo</th><th>Sobra após recomendações</th><th>Preço médio</th></tr>' +
      e.map(function (x) { var u = x.unidade; return '<tr><td><b>' + esc(x.produto) + '</b></td><td>' + n(x.entradas, 1) + ' ' + u + '</td><td>' + n(x.aplicado, 1) + ' ' + u + '</td><td>' + n(x.a_aplicar, 1) + ' ' + u + '</td>' +
        '<td' + (x.saldo < 0 ? ' class="neg"' : '') + '>' + n(x.saldo, 1) + ' ' + u + '</td><td' + (x.sobra < 0 ? ' class="neg"' : '') + '>' + (x.sobra < 0 ? 'faltam ' + n(-x.sobra, 1) : n(x.sobra, 1)) + ' ' + u + '</td>' +
        '<td>' + (x.custo_unit ? brl(x.custo_unit) + '/' + u : '<span class="sem">—</span>') + '</td></tr>'; }).join('') + '</table></div>' : '<div class="vazio">Nenhum produto lançado no estoque desta fazenda.</div>');
    var c = D.custo, col = {}; (D.colheita || []).forEach(function (x) { col[x.talhao] = x.sc_ha; });
    h += '<h2 class="talhao">Custo por talhão<small>produtos aplicados × preço médio</small></h2>';
    if (c && c.talhoes && c.talhoes.length) {
      var tot = { ha: 0, g: 0 };
      h += '<div class="tab"><table><tr><th>Talhão</th><th>Área (ha)</th><th>Aplicações</th><th>Gasto</th><th>Gasto/ha</th><th>Colheita (sc/ha)</th></tr>' + c.talhoes.map(function (t) {
        tot.ha += t.ha; tot.g += t.custo;
        return '<tr><td><b>' + esc(t.nome) + '</b></td><td>' + n(t.ha, 1) + '</td><td>' + (t.aplicacoes || '—') + '</td><td>' + (t.custo ? brl(t.custo) : '<span class="sem">—</span>') + '</td><td>' + (t.custo_ha ? brl(t.custo_ha) : '<span class="sem">—</span>') + '</td><td>' + (t.sc_ha ? n(t.sc_ha, 1) : '<span class="sem">—</span>') + '</td></tr>';
      }).join('') + '<tr><td><b>Total</b></td><td><b>' + n(tot.ha, 1) + '</b></td><td></td><td><b>' + brl(tot.g) + '</b></td><td><b>' + (tot.ha ? brl(tot.g / tot.ha) : '—') + '</b></td><td></td></tr></table></div>' +
        (c.sem_preco && c.sem_preco.length ? '<div class="obs">Sem preço no estoque (fora do gasto): ' + esc(c.sem_preco.join(', ')) + '</div>' : '');
    } else h += '<div class="vazio">O custo por talhão aparece quando houver aplicações marcadas como feitas.</div>';
    $('#conteudo').innerHTML = h;
  }

  /* ---------- visão do operador / encarregado ---------- */
  var aberto = {};
  function vistaOperador() {
    var l = (D.aplicacoes || []).filter(function (a) { return filtro === 'fazer' ? a.status !== 'aplicada' : a.tal.some(function (t) { return t.feito; }); });
    l.sort(function (a, b) { return filtro === 'fazer' ? (a.data < b.data ? -1 : 1) : (a.data > b.data ? -1 : 1); });
    var nFazer = (D.aplicacoes || []).filter(function (a) { return a.status !== 'aplicada'; }).length;
    var h = '<div class="chips"><button data-f="fazer" class="' + (filtro === 'fazer' ? 'on' : '') + '">A fazer (' + nFazer + ')</button><button data-f="feitas" class="' + (filtro === 'feitas' ? 'on' : '') + '">Aplicadas</button></div>';
    if (!l.length) h += '<div class="vazio">' + (filtro === 'fazer' ? 'Nenhuma aplicação pendente. 👍' : 'Nenhuma aplicação marcada ainda.') + '</div>';
    h += l.map(cartao).join('');
    $('#conteudo').innerHTML = h;
    document.querySelectorAll('[data-f]').forEach(function (b) { b.onclick = function () { filtro = b.dataset.f; pintar(); }; });
    document.querySelectorAll('[data-marcar]').forEach(function (b) { b.onclick = function () { marcar(b.dataset.marcar, false); }; });
    document.querySelectorAll('[data-desf]').forEach(function (b) { b.onclick = function () { var p = b.dataset.desf.split('|'); desfazer(p[0], p.slice(1).join('|')); }; });
    document.querySelectorAll('[data-vm]').forEach(function (b) { b.onclick = function () { aberto[b.dataset.vm] = !aberto[b.dataset.vm]; pintar(); }; });
    document.querySelectorAll('.ap input[type=checkbox]').forEach(function (c) { c.onchange = function () { contar(c.dataset.rec); }; });
    l.forEach(function (a) { contar(a.id); if (aberto[a.id]) miniMapa(a); });
  }
  function quando(a) {
    if (a.status === 'aplicada') return '<span class="selo ok">Aplicada</span>';
    if (!a.data) return '<span class="selo">Pendente</span>';
    var d = dif(a.data, hoje());
    return d < 0 ? '<span class="selo venc">Atrasada ' + (-d) + (d === -1 ? ' dia' : ' dias') + '</span>' : d === 0 ? '<span class="selo venc">Hoje</span>' : d === 1 ? '<span class="selo">Amanhã</span>' : '<span class="selo">' + dataBR(a.data) + '</span>';
  }
  function cartao(a) {
    var pend = a.tal.filter(function (t) { return !t.feito; }), haP = pend.reduce(function (s, t) { return s + t.ha; }, 0);
    var haT = a.tal.reduce(function (s, t) { return s + t.ha; }, 0), base = haP || haT;
    var cls = a.status === 'aplicada' ? 'aplicada' : a.atrasada ? 'atrasada' : '';
    var h = '<div class="ap ' + cls + '"><div class="ap-h"><b>' + esc(a.titulo) + '</b>' + quando(a) + '</div>' +
      '<div class="ap-sub">' + a.tal.length + ' talhão(ões) · ' + n(haT, 1) + ' ha' + (a.resp ? ' · resp.: ' + esc(a.resp) : '') + '</div>';
    if (a.prods.length) h += '<div class="pr"><span class="h">Produto</span><span class="h d">Dose</span><span class="h q">Total ' + (haP ? 'a aplicar' : '') + '</span>' +
      a.prods.map(function (p) { var t = total(p.dose * base, p.unidade); return '<span>' + esc(p.nome) + '</span><span class="d">' + n(p.dose, p.dose < 1 ? 2 : 1) + ' ' + esc(p.unidade) + '</span><span class="q">' + n(t[0], t[0] < 10 ? 1 : 0) + ' ' + esc(t[1]) + '</span>'; }).join('') + '</div>';
    if (a.calda) h += '<div class="calda">Calda ' + n(a.calda) + ' L/ha' + (a.tanque ? ' · tanque ' + n(a.tanque) + ' L = ' + n(a.tanque / a.calda, 1) + ' ha por tanque' + (base ? ' · ' + Math.ceil(base * a.calda / a.tanque) + ' tanque(s)' : '') : '') + '</div>';
    if (a.obs) h += '<div class="obs">📝 ' + esc(a.obs) + '</div>';
    h += a.tal.map(function (t) {
      if (t.feito) return '<div class="tl"><span style="width:24px;text-align:center">✅</span><div class="n"><b>' + esc(t.nome) + '</b><small>' + n(t.ha, 1) + ' ha</small></div>' +
        '<div class="feito">aplicado ' + dataBR(t.feito) + (t.por ? '<br>' + esc(t.por) : '') + (t.meu ? '<br><button class="desf" data-desf="' + esc(a.id) + '|' + esc(t.nome) + '">desfazer</button>' : '') + '</div></div>';
      return '<label class="tl"><input type="checkbox" data-rec="' + esc(a.id) + '" value="' + esc(t.nome) + '" checked><div class="n"><b>' + esc(t.nome) + '</b><small>' + n(t.ha, 1) + ' ha' + (t.data ? ' · prevista ' + dataBR(t.data) : '') + '</small></div></label>';
    }).join('');
    if (pend.length) h += '<div class="marcar"><div class="campo"><label>Data da aplicação</label><input type="date" id="dt_' + esc(a.id) + '" value="' + hoje() + '" max="' + hoje() + '"></div>' +
      '<button class="btn" data-marcar="' + esc(a.id) + '" id="bt_' + esc(a.id) + '">✔ Marcar aplicado</button></div>';
    h += '<button class="vermapa" data-vm="' + esc(a.id) + '">' + (aberto[a.id] ? '▴ Esconder mapa' : '🗺️ Ver no mapa') + '</button>' + (aberto[a.id] ? '<div class="mini" id="mm_' + esc(a.id) + '"></div>' : '') + '</div>';
    return h;
  }
  function marcados(id) { return Array.prototype.slice.call(document.querySelectorAll('input[data-rec="' + id + '"]:checked')).map(function (c) { return c.value; }); }
  function contar(id) { var b = document.getElementById('bt_' + id); if (!b) return; var k = marcados(id).length; b.disabled = !k; b.textContent = k ? '✔ Marcar aplicado (' + k + (k > 1 ? ' talhões' : ' talhão') + ')' : 'Escolha os talhões'; }
  async function marcar(id) {
    var tal = marcados(id), dt = (document.getElementById('dt_' + id) || {}).value || hoje();
    if (!tal.length) return;
    if (!confirm('Confirmar aplicação em ' + tal.join(', ') + ' no dia ' + dataBR(dt) + '?')) return;
    try { await api('/api/portal/aplicar', { rec_id: id, talhoes: tal, data: dt }); toast('✔ Aplicação registrada. O consultor já vê no app.'); await carregar(); }
    catch (e) { toast(e.message); }
  }
  async function desfazer(id, t) {
    if (!confirm('Desfazer a aplicação marcada em ' + t + '?')) return;
    try { await api('/api/portal/aplicar', { rec_id: id, talhoes: [t], desfazer: true }); toast('Desfeito'); await carregar(); }
    catch (e) { toast(e.message); }
  }
  function miniMapa(a) {
    var el = document.getElementById('mm_' + a.id); if (!el) return;
    var st = {}; a.tal.forEach(function (t) { st[t.nome] = t.feito ? 'ok' : 'pend'; });
    desenharMapa(el, function (nm) {
      return st[nm] === 'pend' ? { color: '#FFFFFF', weight: 2, fillColor: '#E08A00', fillOpacity: 0.6 }
        : st[nm] === 'ok' ? { color: '#FFFFFF', weight: 2, fillColor: '#2E7D32', fillOpacity: 0.55 }
        : { color: '#FFFFFF', weight: 1, fillColor: '#9AA5A0', fillOpacity: 0.15 };
    }, function (nm, q) { return '<b>' + esc(nm) + '</b>' + (q.area_ha ? '<br>' + n(q.area_ha, 1) + ' ha' : '') + (st[nm] ? '<br>' + (st[nm] === 'ok' ? 'aplicado' : 'a aplicar') : ''); });
  }

  if (tok) iniciar().catch(function () { sair(); });
})();
</script>
</body></html>`;
}
