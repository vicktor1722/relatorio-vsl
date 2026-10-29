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
<link rel="manifest" href="/portal.webmanifest">
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
.pr.t4{grid-template-columns:1fr auto auto auto;gap:4px 10px}.pr .tq{font-weight:700;color:#1A4E85;text-align:right;background:#E6F0FA;border-radius:6px;padding:0 5px}
.pr .h.tq{background:none;color:#1A4E85}
.calda b{color:#0F3A66}
.campo-sel select{width:100%;font-size:15px;padding:10px;border:1px solid var(--linha);border-radius:10px;background:#fff;margin-bottom:8px}
.calda{font-size:13px;background:#E6F0FA;color:#1A4E85;border-radius:10px;padding:7px 10px;margin-bottom:8px}
.obs{font-size:13px;background:#FFFBEF;border-radius:10px;padding:7px 10px;margin-bottom:8px}
.tl{display:flex;align-items:center;gap:10px;padding:9px 4px;border-top:1px dashed var(--linha);font-size:14.5px}
.tl input{width:24px;height:24px;accent-color:var(--verde);flex:none}.tl .n{flex:1}.tl .n small{display:block;font-size:12px;color:var(--fraco)}
.tl .feito{color:var(--verde-escuro);font-size:12.5px;text-align:right}.tl .desf{border:0;background:none;color:var(--fraco);text-decoration:underline;font-size:12px}
.marcar{display:flex;gap:8px;align-items:flex-end;margin-top:10px;flex-wrap:wrap}.marcar .campo{margin:0;flex:0 0 150px}.marcar .btn{flex:1;min-width:160px}
.vermapa{border:0;background:none;color:var(--verde);font-weight:600;font-size:13px;padding:4px 0}
.mini{height:260px;border-radius:10px;overflow:hidden;margin-top:8px;border:1px solid var(--linha)}
.faixa{border-radius:12px;padding:9px 12px;font-size:13.5px;margin-bottom:10px;background:#E6F0FA;color:#1A4E85}
.faixa.am{background:#FFF3DC;color:#7A5200}
.push{display:flex;flex-direction:column;gap:8px;background:#EEF6F0;border:1px solid #CFE5D6;border-radius:12px;padding:10px 12px;margin-bottom:12px;font-size:14px}
.reg{font-size:12.5px;color:#1A4E85;margin-top:3px;overflow-wrap:anywhere}.reg img{width:56px;height:56px;object-fit:cover;border-radius:7px;margin:4px 4px 0 0}
.espera{color:#7A5200;font-size:12.5px}
.veu{position:fixed;inset:0;background:rgba(10,30,20,.5);z-index:2000;display:flex;align-items:flex-end;justify-content:center}
.folha{background:#fff;width:100%;max-width:560px;max-height:94dvh;overflow-y:auto;border-radius:18px 18px 0 0;padding:14px 16px calc(16px + env(safe-area-inset-bottom,0px))}
.folha h3{margin:0 0 2px;font-size:18px}.folha .q{font-size:13px;color:var(--fraco);margin-bottom:10px}
.g3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.g3 .campo{margin-bottom:8px;min-width:0}
.folha .campo input,.folha .campo textarea{width:100%;font-size:16px;padding:10px;border:1px solid #CFD8D3;border-radius:10px;font-family:inherit}
.folha label.l{display:block;font-size:12px;color:var(--fraco);margin-bottom:3px}
.alerta{background:#FFF3DC;color:#7A5200;border-radius:10px;padding:8px 10px;font-size:13px;margin-bottom:8px}
.fotos{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 8px}.fotos img{width:64px;height:64px;object-fit:cover;border-radius:8px}
.addfoto{border:1.5px dashed #9AA5A0;background:none;border-radius:10px;padding:10px;font-size:14px;width:100%;color:var(--texto)}
.folha .btn{margin-top:8px}
.cal-h{display:flex;align-items:center;justify-content:space-between;margin:4px 0 8px}.cal-h b{font-size:15px}
.cal-h button{border:1px solid var(--linha);background:#fff;border-radius:50%;width:34px;height:34px;font-size:16px}
.cal{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
.cal .dw{font-size:11px;color:var(--fraco);text-align:center;padding-bottom:2px}
.cal button{background:#fff;border:1px solid var(--linha);border-radius:9px;aspect-ratio:1/1.05;display:flex;flex-direction:column;align-items:center;padding:4px 0 0;gap:2px;font-size:13px;color:var(--texto)}
.cal button.hj{box-shadow:inset 0 0 0 1.5px var(--verde)}.cal button.sl{background:var(--verde);color:#fff;border-color:var(--verde)}
.cal button i{display:flex;gap:1px;height:20px;align-items:center;font-style:normal}
.ico{width:19px;height:19px;display:block}
.k-prev{color:#3B78C3}.k-apl{color:#2F9E5B}.k-venc{color:#C0392B}.k-colh{color:#9A5B12}
.cal button.sl .ico{filter:drop-shadow(0 0 1.5px #fff) drop-shadow(0 0 1px #fff)}
.legc{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12px;color:var(--fraco);margin:8px 2px 12px}.legc span{display:inline-flex;align-items:center;gap:4px}
.ev{display:flex;gap:10px;align-items:center;background:#fff;border:1px solid var(--linha);border-radius:12px;padding:9px 11px;margin-bottom:7px;font-size:13.5px}
.ev .ico{width:24px;height:24px;flex:none}.ev small{display:block;color:var(--fraco);font-size:12px}
.sems{display:flex;align-items:flex-end;gap:4px;height:110px;border-bottom:1px solid var(--linha);padding:0 2px}
.sems .c{flex:1;display:flex;flex-direction:column-reverse;gap:1px;min-width:0}.sems u{display:block;border-radius:2px}
.semr{display:flex;gap:4px;font-size:10.5px;color:var(--fraco);padding:3px 2px 0}.semr span{flex:1;text-align:center;min-width:0;overflow:hidden}
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
    <div id="faixa" class="faixa oculto"></div>
    <div id="conteudo"><div class="vazio">Carregando…</div></div>
    <div class="rodape">AMVS Relatório · <a href="/termos">Termos de Uso</a></div>
  </div>
</div>

<script>${AGRO_REL_JS}</script>
<script>
(function () {
  var CH = 'amvs-portal', tok = '', eu = null, D = null, aba = 'apl', filtro = 'fazer', mapas = [], modoMapa = 'var';
  var opAba = 'apl', opMapa = '*', selec = {};   // operador: aba, aplicação do mapa e talhões que ele marcou
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

  var semRede = false;
  async function api(rota, corpo, extra) {
    var r;
    try {
      r = await fetch(rota, Object.assign({ method: corpo ? 'POST' : 'GET', headers: Object.assign({ Authorization: 'Bearer ' + tok }, corpo && !(corpo instanceof Blob) ? { 'Content-Type': 'application/json' } : {}, (extra && extra.headers) || {}),
        body: corpo ? (corpo instanceof Blob ? corpo : JSON.stringify(corpo)) : undefined }));
    } catch (e) { var er = new Error('Sem internet agora'); er.rede = true; throw er; }
    if (!corpo) semRede = r.headers.get('X-Portal-Cache') === '1';
    var j = null; try { j = await r.json(); } catch (e) {}
    if (r.status === 401 && rota !== '/api/portal/entrar') { sair(); throw new Error('Entre de novo'); }
    if (!r.ok) throw new Error((j && j.erro) || ('HTTP ' + r.status));
    return j;
  }
  function sair() {
    tok = ''; try { localStorage.removeItem(CH); } catch (e) {}
    try { caches.delete('amvs-portal-v1'); } catch (e) {}   // dados guardados para abrir sem internet
    $('#telaApp').classList.add('oculto'); $('#telaLogin').classList.remove('oculto');
  }

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
  $('#btnSair').onclick = async function () {
    var nf = (await filaTudo()).length;
    if (!confirm(nf ? 'Ainda há ' + nf + ' marcação(ões) esperando internet. Se sair, elas se perdem. Sair mesmo assim?' : 'Sair deste acesso?')) return;
    if (nf) await filaLimpar();
    sair();
  };

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
    catch (e) { $('#conteudo').innerHTML = '<div class="vazio">' + esc(e.rede ? 'Sem internet e esta fazenda ainda não foi aberta neste celular. Abra uma vez com sinal para ela ficar guardada.' : e.message) + '</div>'; return; }
    await sobreporFila();
    $('#hNome').textContent = D.fazenda.nome;
    $('#selSafra').innerHTML = (D.safras.length ? D.safras : [D.safra]).map(function (s) { return '<option' + (s === D.safra ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('');
    pintar();
    faixa();
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
    return '<div class="abas">' + [['apl', 'Aplicações'], ['mapa', 'Mapas'], ['plantio', 'Plantio'], ['colh', 'Colheita'], ['est', 'Estoque e custos']].map(function (x) {
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
    else if (aba === 'colh') vistaColheita();
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


  /* ---------- colheita: previsão = plantio + ciclo do material (± 5 dias) ---------- */
  var CICLO_PADRAO = { soja: 115, milho: 135, algodao: 180, feijao: 90, sorgo: 120, outra: 120 };
  var ICO_PULV = '<svg class="ico" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="2.5" y="6.5" width="5" height="5.5" rx="1"/><rect x="7.5" y="5" width="9.5" height="7" rx="2.5"/><circle cx="5.2" cy="14.3" r="2.6"/><circle cx="14.5" cy="14.6" r="2.2"/><rect x="0.5" y="17.3" width="23" height="1.6" rx=".8"/><path d="M2.5 19.4 1 23h3zM9 19.4 7.5 23h3zM15.5 19.4 14 23h3zM22 19.4 20.5 23h3z"/></svg>';
  var ICO_COLH = '<svg class="ico" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="9" y="2.5" width="5" height="4.5" rx="1"/><path d="M7.5 7h8.5l3 4h4v6.5H7.5z"/><rect x="15" y="4.2" width="7.5" height="1.7" rx=".85"/><path d="M0.5 10.5h6v6.5h-6zM0.5 10.5 2 9h4.5v1.5z"/><circle cx="11" cy="18.3" r="3.4"/><circle cx="19.5" cy="19" r="2.4"/></svg>';
  function chave(x) { return String(x || '').trim().replace(/\\s+/g, ' ').toLowerCase(); }
  function somaDias(iso, k) { var d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); }
  // de onde veio o ciclo: informado pelo consultor ou calculado pelo grupo de maturação (GMR) da cultivar
  function rotCiclo(c) {
    if (!c || !c.dias) return 'estimado';
    var g = String(Number(c.gmr || 0).toFixed(1)).replace('.', ',');
    return c.fonte === 'gmr' ? 'GMR ' + g : c.fonte === 'faixa' ? 'GMR ~' + g : 'informado';
  }
  function previsoes() {
    var areas = {}, col = {};
    ((D.mapa && D.mapa.features) || []).forEach(function (f) { var q = f.properties || {}; if (q.nome) areas[q.nome] = Number(q.area_ha) || 0; });
    (D.colheita || []).forEach(function (c) { if (c.sc_ha) col[c.talhao] = c; });
    return (D.plantio || []).filter(function (p) { return p.cultura && p.cultura !== 'pastagem' && p.cultura !== 'pousio' && p.data_plantio; }).map(function (p) {
      var c = (D.ciclos || []).filter(function (x) { return p.variedade && chave(x.variedade) === chave(p.variedade); })[0];
      var dias = c && c.dias ? Number(c.dias) : CICLO_PADRAO[p.cultura]; if (!dias) return null;
      return { talhao: p.talhao, mat: p.variedade || NC[p.cultura] || p.cultura, cultura: p.cultura, ha: areas[p.talhao] || 0, plantio: p.data_plantio,
        dias: dias, est: !(c && c.dias), lab: rotCiclo(c), data: somaDias(p.data_plantio, dias), colhido: col[p.talhao] || null };
    }).filter(Boolean).sort(function (a, b) { return a.data < b.data ? -1 : a.data > b.data ? 1 : String(a.talhao).localeCompare(b.talhao, 'pt-BR', { numeric: true }); });
  }
  // eventos do calendário: aplicações (pulverizador) e colheita prevista (colheitadeira)
  function eventosCal(pv) {
    var ev = [];
    (D.aplicacoes || []).forEach(function (a) {
      var g = {};
      a.tal.forEach(function (t) {
        var d = t.feito || t.data; if (!d) return;
        var k = (t.feito ? 'apl' : (t.data < hoje() ? 'venc' : 'prev')) + '|' + d;
        (g[k] = g[k] || []).push(t.nome);
      });
      Object.keys(g).forEach(function (k) { var p = k.split('|'); ev.push({ d: p[1], k: p[0], txt: a.titulo + (p[0] === 'apl' ? ' aplicada' : ' prevista'), tal: g[k] }); });
    });
    var gc = {};
    pv.forEach(function (x) { if (x.colhido) return; var k = x.data + '|' + x.mat; (gc[k] = gc[k] || { d: x.data, k: 'colh', txt: 'Colheita prevista · ' + x.mat, tal: [], est: x.est }).tal.push(x.talhao); });
    Object.keys(gc).forEach(function (k) { ev.push(gc[k]); });
    return ev;
  }
  var CAL = { y: 0, m: 0, sel: '' };
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  function vistaColheita() {
    var pv = previsoes(), ev = eventosCal(pv);
    if (!CAL.y) {   // abre no mês da próxima colheita prevista (ou no mês atual)
      var prox = pv.filter(function (x) { return !x.colhido && x.data >= hoje(); })[0], base = prox ? prox.data : hoje();
      CAL.y = Number(base.slice(0, 4)); CAL.m = Number(base.slice(5, 7)) - 1; CAL.sel = base;
    }
    var ini = new Date(Date.UTC(CAL.y, CAL.m, 1)).getUTCDay(), nd = new Date(Date.UTC(CAL.y, CAL.m + 1, 0)).getUTCDate(), g = '';
    ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'].forEach(function (x) { g += '<div class="dw">' + x + '</div>'; });
    for (var i = 0; i < ini; i++) g += '<div></div>';
    for (var d = 1; d <= nd; d++) {
      var iso = CAL.y + '-' + ('0' + (CAL.m + 1)).slice(-2) + '-' + ('0' + d).slice(-2), es = ev.filter(function (e) { return e.d === iso; });
      var ap = es.filter(function (e) { return e.k !== 'colh'; }), co = es.filter(function (e) { return e.k === 'colh'; });
      var cor = ap.some(function (e) { return e.k === 'venc'; }) ? 'venc' : ap.some(function (e) { return e.k === 'prev'; }) ? 'prev' : 'apl';
      g += '<button data-dia="' + iso + '" class="' + (iso === hoje() ? 'hj ' : '') + (iso === CAL.sel ? 'sl' : '') + '"><span>' + d + '</span><i>' +
        (ap.length ? '<span class="k-' + cor + '">' + ICO_PULV + '</span>' : '') + (co.length ? '<span class="k-colh">' + ICO_COLH + '</span>' : '') + '</i></button>';
    }
    var ds = ev.filter(function (e) { return e.d === CAL.sel; });
    var h = abas() + '<h2 class="talhao">Calendário<small>aplicações e colheita prevista</small></h2>' +
      '<div class="cal-h"><button data-mes="-1" aria-label="mês anterior">‹</button><b>' + MESES[CAL.m].charAt(0).toUpperCase() + MESES[CAL.m].slice(1) + ' de ' + CAL.y + '</b><button data-mes="1" aria-label="próximo mês">›</button></div>' +
      '<div class="cal">' + g + '</div>' +
      '<div class="legc"><span class="k-prev">' + ICO_PULV + 'aplicação prevista</span><span class="k-apl">' + ICO_PULV + 'aplicada</span><span class="k-venc">' + ICO_PULV + 'atrasada</span><span class="k-colh">' + ICO_COLH + 'colheita prevista</span></div>' +
      '<div style="font-weight:700;margin:4px 2px 6px">' + dataBR(CAL.sel) + (CAL.sel === hoje() ? ' (hoje)' : '') + '</div>' +
      (ds.length ? ds.map(function (e) {
        return '<div class="ev"><span class="k-' + (e.k === 'colh' ? 'colh' : e.k) + '">' + (e.k === 'colh' ? ICO_COLH : ICO_PULV) + '</span><div><b>' + esc(e.txt) + '</b>' + (e.est ? ' <span class="sem">(estimado)</span>' : '') +
          '<small>' + esc(e.tal.join(', ')) + (e.k === 'colh' ? ' · janela ' + dataBR(somaDias(e.d, -5)) + ' a ' + dataBR(somaDias(e.d, 5)) : '') + '</small></div></div>';
      }).join('') : '<div class="sem" style="margin:0 2px 10px">Nada neste dia.</div>');

    if (!pv.length) {
      h += '<div class="vazio">A previsão de colheita aparece quando o consultor lançar a data de plantio dos talhões.</div>';
    } else {
      // resumo por material
      var mats = {}, cores = {}, ci = 0;
      pv.forEach(function (x) {
        var m = mats[x.mat] || (mats[x.mat] = { ha: 0, ini: x.data, fim: x.data, est: false, colhido: 0, lab: x.lab, dias: x.dias });
        m.ha += x.ha; if (x.data < m.ini) m.ini = x.data; if (x.data > m.fim) m.fim = x.data; if (x.est) m.est = true; if (x.colhido) m.colhido += x.ha;
        if (!cores[x.mat]) cores[x.mat] = CORES[ci++ % CORES.length];
      });
      h += '<h2 class="talhao">Previsão por material</h2><div class="tab"><table><tr><th>Material</th><th>Área</th><th>Colheita prevista</th><th>Ciclo</th></tr>' + Object.keys(mats).map(function (k) {
        var m = mats[k];
        return '<tr><td><b><i style="display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px;background:' + cores[k] + '"></i>' + esc(k) + '</b></td><td>' + n(m.ha, 1) + ' ha' + (m.colhido ? '<br><span class="sem">' + n(m.colhido, 1) + ' ha colhidos</span>' : '') + '</td>' +
          '<td>' + dataBR(m.ini) + (m.fim !== m.ini ? ' a ' + dataBR(m.fim) : '') + '</td><td>' + m.dias + ' dias<br><span class="sem">' + esc(m.lab) + '</span></td></tr>';
      }).join('') + '</table></div>';
      // hectares prontos por semana (segunda-feira de cada semana), por material
      var sem = {}, mx = 0;
      pv.forEach(function (x) {
        if (x.colhido) return;
        var dt = new Date(x.data + 'T12:00:00Z'), seg = new Date(dt); seg.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
        var k = seg.toISOString().slice(0, 10), w = sem[k] || (sem[k] = { tot: 0, m: {} });
        w.tot += x.ha; w.m[x.mat] = (w.m[x.mat] || 0) + x.ha; if (w.tot > mx) mx = w.tot;
      });
      var ks = Object.keys(sem).sort();
      if (ks.length > 1) {
        var todas = [], cur = ks[0];
        while (cur <= ks[ks.length - 1] && todas.length < 40) { todas.push(cur); if (!sem[cur]) sem[cur] = { tot: 0, m: {} }; cur = somaDias(cur, 7); }
        ks = todas;
      }
      if (ks.length) {
        h += '<h2 class="talhao">Hectares prontos por semana</h2><div class="caixa"><div class="sems">' + ks.map(function (k) {
          return '<div class="c" title="' + n(sem[k].tot, 1) + ' ha">' + Object.keys(sem[k].m).map(function (m) { return '<u style="height:' + Math.max(2, sem[k].m[m] / mx * 100) + 'px;background:' + cores[m] + '"></u>'; }).join('') + '</div>';
        }).join('') + '</div><div class="semr">' + ks.map(function (k) { return '<span>' + dataBR(k) + '</span>'; }).join('') + '</div>' +
          '<div class="leg">' + Object.keys(mats).map(function (k) { return '<span><i style="background:' + cores[k] + '"></i>' + esc(k) + '</span>'; }).join('') + '</div></div>';
      }
      // tabela por talhão
      h += '<h2 class="talhao">Por talhão</h2><div class="tab"><table><tr><th>Talhão</th><th>Material</th><th>Área</th><th>Plantio</th><th>Ciclo</th><th>Previsão</th><th>Janela</th><th>Faltam</th></tr>' + pv.map(function (x) {
        var f = dif(x.data, hoje());
        return '<tr><td><b>' + esc(x.talhao) + '</b></td><td style="text-align:left">' + esc(x.mat) + '</td><td>' + n(x.ha, 1) + '</td><td>' + dataBR(x.plantio) + '</td>' +
          '<td>' + x.dias + ' d' + (x.est ? ' <span class="sem">(est.)</span>' : '') + '</td><td><b>' + dataBR(x.data) + '</b></td>' +
          '<td>' + dataBR(somaDias(x.data, -5)) + ' – ' + dataBR(somaDias(x.data, 5)) + '</td>' +
          '<td>' + (x.colhido ? '<span style="color:#2F9E5B;font-weight:700">colhido</span>' : f > 0 ? f + ' dias' : f === 0 ? 'hoje' : '<span class="neg">' + (-f) + ' dias atrás</span>') + '</td></tr>';
      }).join('') + '</table></div>' +
        '<div class="sem" style="font-size:12.5px;margin:0 2px">Previsão = data de plantio + ciclo do material, com janela de ± 5 dias (clima e chuva mexem na colheita). Na soja o ciclo sai do grupo de maturação (GMR) da cultivar; "estimado" = ciclo padrão da cultura.</div>';
    }
    $('#conteudo').innerHTML = h;
    document.querySelectorAll('[data-dia]').forEach(function (b) { b.onclick = function () { CAL.sel = b.dataset.dia; pintar(); }; });
    document.querySelectorAll('[data-mes]').forEach(function (b) { b.onclick = function () { CAL.m += Number(b.dataset.mes); if (CAL.m < 0) { CAL.m = 11; CAL.y--; } if (CAL.m > 11) { CAL.m = 0; CAL.y++; } pintar(); }; });
  }

  /* ---------- visão do operador / encarregado ---------- */
  var aberto = {};
  function vistaOperador() {
    if (opAba === 'mapa') return mapaOperador();
    var l = (D.aplicacoes || []).filter(function (a) { return filtro === 'fazer' ? a.status !== 'aplicada' : a.tal.some(function (t) { return t.feito; }); });
    l.sort(function (a, b) { return filtro === 'fazer' ? (a.data < b.data ? -1 : 1) : (a.data > b.data ? -1 : 1); });
    var nFazer = (D.aplicacoes || []).filter(function (a) { return a.status !== 'aplicada'; }).length;
    var h = abasOp() + cartaoPush() + '<div class="chips"><button data-f="fazer" class="' + (filtro === 'fazer' ? 'on' : '') + '">A fazer (' + nFazer + ')</button><button data-f="feitas" class="' + (filtro === 'feitas' ? 'on' : '') + '">Aplicadas</button></div>';
    if (!l.length) h += '<div class="vazio">' + (filtro === 'fazer' ? 'Nenhuma aplicação pendente. 👍' : 'Nenhuma aplicação marcada ainda.') + '</div>';
    h += l.map(cartao).join('');
    $('#conteudo').innerHTML = h;
    document.querySelectorAll('[data-f]').forEach(function (b) { b.onclick = function () { filtro = b.dataset.f; pintar(); }; });
    document.querySelectorAll('[data-marcar]').forEach(function (b) { b.onclick = function () { abrirFolha(b.dataset.marcar); }; });
    document.querySelectorAll('[data-cancela]').forEach(function (b) { b.onclick = function () { cancelarFila(b.dataset.cancela); }; });
    var bp = document.getElementById('btnPush'); if (bp) bp.onclick = ativarAvisos;
    document.querySelectorAll('[data-desf]').forEach(function (b) { b.onclick = function () { var p = b.dataset.desf.split('|'); desfazer(p[0], p.slice(1).join('|')); }; });
    document.querySelectorAll('[data-vm]').forEach(function (b) { b.onclick = function () { aberto[b.dataset.vm] = !aberto[b.dataset.vm]; pintar(); }; });
    ligarAbasOp();
    document.querySelectorAll('.ap input[type=checkbox]').forEach(function (c) { c.onchange = function () { selec[c.dataset.rec] = marcados(c.dataset.rec); contar(c.dataset.rec); }; });
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
    // quanto de cada produto vai em um tanque cheio: dose × hectares que um tanque cobre (tanque ÷ calda)
    var haTq = a.calda && a.tanque ? a.tanque / a.calda : 0;
    if (a.prods.length) h += '<div class="pr' + (haTq ? ' t4' : '') + '"><span class="h">Produto</span><span class="h d">Dose</span>' + (haTq ? '<span class="h tq">Por tanque</span>' : '') + '<span class="h q">Total ' + (haP ? 'a aplicar' : '') + '</span>' +
      a.prods.map(function (p) {
        var t = total(p.dose * base, p.unidade), k = haTq ? total(p.dose * haTq, p.unidade) : null;
        return '<span>' + esc(p.nome) + '</span><span class="d">' + n(p.dose, p.dose < 1 ? 2 : 1) + ' ' + esc(p.unidade) + '</span>' +
          (k ? '<span class="tq">' + qtd(k) + '</span>' : '') + '<span class="q">' + n(t[0], t[0] < 10 ? 1 : 0) + ' ' + esc(t[1]) + '</span>';
      }).join('') + '</div>';
    if (a.calda) h += '<div class="calda">' + caldaTxt(a, base, haTq) + '</div>';
    if (a.obs) h += '<div class="obs">📝 ' + esc(a.obs) + '</div>';
    h += a.tal.map(function (t) {
      if (t.feito) return '<div class="tl"><span style="width:24px;text-align:center">' + (t.fila ? '⏳' : '✅') + '</span><div class="n"><b>' + esc(t.nome) + '</b><small>' + n(t.ha, 1) + ' ha</small>' + regDe(a, t.nome) + '</div>' +
        '<div class="feito">aplicado ' + dataBR(t.feito) + (t.fila ? '<br><span class="espera">esperando internet</span><br><button class="desf" data-cancela="' + esc(t.fila) + '">cancelar</button>'
          : (t.por ? '<br>' + esc(t.por) : '') + (t.meu ? '<br><button class="desf" data-desf="' + esc(a.id) + '|' + esc(t.nome) + '">desfazer</button>' : '')) + '</div></div>';
      return '<label class="tl"><input type="checkbox" data-rec="' + esc(a.id) + '" value="' + esc(t.nome) + '"' + ((selec[a.id] || []).indexOf(t.nome) >= 0 ? ' checked' : '') + '><div class="n"><b>' + esc(t.nome) + '</b><small>' + n(t.ha, 1) + ' ha' + (t.data ? ' · prevista ' + dataBR(t.data) : '') + '</small></div></label>';
    }).join('');
    if (pend.length) h += '<div class="marcar"><button class="btn" data-marcar="' + esc(a.id) + '" id="bt_' + esc(a.id) + '">✔ Marcar aplicado</button></div>';
    h += '<button class="vermapa" data-vm="' + esc(a.id) + '">' + (aberto[a.id] ? '▴ Esconder mapa' : '🗺️ Ver no mapa') + '</button>' + (aberto[a.id] ? '<div class="mini" id="mm_' + esc(a.id) + '"></div>' : '') + '</div>';
    return h;
  }
  function qtd(t) { return n(t[0], t[0] < 1 ? 2 : t[0] < 10 ? 1 : 0) + ' ' + esc(t[1]); }
  // calda e tanques: quantos tanques cheios e quanto vai no último (quando sobra área)
  function caldaTxt(a, base, haTq) {
    var s = 'Calda ' + n(a.calda) + ' L/ha';
    if (!haTq) return s;
    s += ' · tanque de ' + n(a.tanque) + ' L = <b>' + n(haTq, 1) + ' ha por tanque</b>';
    if (!base) return s;
    var cheios = Math.floor(base / haTq + 1e-6), resto = base - cheios * haTq;
    if (resto < 0.05) return s + ' · ' + cheios + (cheios === 1 ? ' tanque' : ' tanques');
    return s + ' · ' + cheios + (cheios === 1 ? ' tanque cheio' : ' tanques cheios') + ' + 1 último de <b>' + n(resto * a.calda) + ' L</b> (' + n(resto, 1) + ' ha): ' +
      a.prods.map(function (p) { return esc(p.nome) + ' ' + qtd(total(p.dose * resto, p.unidade)); }).join(' · ');
  }
  function marcados(id) { return Array.prototype.slice.call(document.querySelectorAll('input[data-rec="' + id + '"]:checked')).map(function (c) { return c.value; }); }
  function contar(id) { var b = document.getElementById('bt_' + id); if (!b) return; var k = marcados(id).length; b.disabled = !k; b.textContent = k ? '✔ Marcar aplicado (' + k + (k > 1 ? ' talhões' : ' talhão') + ')' : 'Toque no talhão que você aplicou'; }
  async function desfazer(id, t) {
    if (!confirm('Desfazer a aplicação marcada em ' + t + '?')) return;
    try { await api('/api/portal/aplicar', { rec_id: id, talhoes: [t], desfazer: true }); toast('Desfeito'); await carregar(); }
    catch (e) { toast(e.message); }
  }
  /* ---------- operador: aba Mapa (onde já foi aplicado) ---------- */
  function abasOp() {
    return '<div class="abas">' + [['apl', 'Aplicações'], ['mapa', 'Mapa']].map(function (x) {
      return '<button data-opa="' + x[0] + '" class="' + (opAba === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div>';
  }
  function ligarAbasOp() { document.querySelectorAll('[data-opa]').forEach(function (b) { b.onclick = function () { opAba = b.dataset.opa; pintar(); window.scrollTo(0, 0); }; }); }
  var COR_ST = { ok: '#2E7D32', pend: '#E08A00', atr: '#C62828' };
  function stTal(a, t) { return t.feito ? 'ok' : (t.data && t.data < hoje()) ? 'atr' : 'pend'; }
  function mapaOperador() {
    var ap = (D.aplicacoes || []).slice().sort(function (x, y) { return (x.status === 'aplicada') - (y.status === 'aplicada') || (x.data < y.data ? -1 : 1); });
    if (opMapa !== '*' && !ap.some(function (x) { return x.id === opMapa; })) opMapa = '*';
    var areas = {}; ((D.mapa && D.mapa.features) || []).forEach(function (f) { var q = f.properties || {}; if (q.nome) areas[q.nome] = Number(q.area_ha) || 0; });
    // situação de cada talhão: numa aplicação escolhida, ou somando todas (pior situação vence)
    var st = {}, det = {}, peso = { atr: 3, pend: 2, ok: 1 };
    ap.forEach(function (x) {
      if (opMapa !== '*' && x.id !== opMapa) return;
      x.tal.forEach(function (t) {
        var s = stTal(x, t);
        if (!st[t.nome] || peso[s] > peso[st[t.nome]]) st[t.nome] = s;
        (det[t.nome] = det[t.nome] || []).push(esc(x.titulo) + ': ' + (s === 'ok' ? 'aplicado ' + dataBR(t.feito) : s === 'atr' ? 'atrasado (prevista ' + dataBR(t.data) + ')' : 'a aplicar' + (t.data ? ' · prevista ' + dataBR(t.data) : '')));
      });
    });
    var ha = { ok: 0, pend: 0, atr: 0 }; Object.keys(st).forEach(function (k) { ha[st[k]] += areas[k] || 0; });
    var h = abasOp() + '<div class="campo-sel"><select id="selOpMapa"><option value="*">Todas as aplicações</option>' + ap.map(function (x) {
      return '<option value="' + esc(x.id) + '"' + (x.id === opMapa ? ' selected' : '') + '>' + esc(x.titulo) + (x.status === 'aplicada' ? ' (aplicada)' : x.data ? ' · ' + dataBR(x.data) : '') + '</option>'; }).join('') + '</select></div>' +
      '<div class="mapa-sat" id="mapaOp"></div>' +
      '<div class="leg"><span><i style="background:' + COR_ST.ok + '"></i>Aplicado · ' + n(ha.ok, 1) + ' ha</span><span><i style="background:' + COR_ST.pend + '"></i>A aplicar · ' + n(ha.pend, 1) + ' ha</span>' +
      '<span><i style="background:' + COR_ST.atr + '"></i>Atrasado · ' + n(ha.atr, 1) + ' ha</span><span><i style="background:#9AA5A0"></i>' + (opMapa === '*' ? 'sem aplicação' : 'fora desta aplicação') + '</span></div>' +
      '<div class="sem" style="font-size:12.5px;margin:4px 2px">' + (opMapa === '*' ? 'Com todas as aplicações, o talhão mostra a situação mais urgente. ' : '') + 'Toque no talhão para ver o detalhe.</div>';
    $('#conteudo').innerHTML = h;
    ligarAbasOp();
    $('#selOpMapa').onchange = function () { opMapa = this.value; pintar(); };
    desenharMapa($('#mapaOp'), function (nm) {
      return st[nm] ? { color: '#FFFFFF', weight: 2, fillColor: COR_ST[st[nm]], fillOpacity: 0.6 } : { color: '#FFFFFF', weight: 1, fillColor: '#9AA5A0', fillOpacity: 0.15 };
    }, function (nm, q) { return '<b>' + esc(nm) + '</b>' + (q.area_ha ? ' · ' + n(q.area_ha, 1) + ' ha' : '') + (det[nm] ? '<br>' + det[nm].join('<br>') : '<br>sem aplicação'); });
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

  /* ---------- registro mostrado no cartão ---------- */
  function n1(v) { return String(Math.round(Number(v) * 10) / 10).replace('.', ','); }
  function regDe(a, nome) {
    var g = (a.registros || []).filter(function (x) { return (x.talhoes || []).indexOf(nome) >= 0; }).pop();
    if (!g) return '';
    var l = [g.inicio ? g.inicio + (g.fim ? '–' + g.fim : '') : '', g.vento != null ? 'vento ' + n1(g.vento) + ' km/h' : '', g.temp != null ? n1(g.temp) + ' °C' : '', g.umid != null ? n1(g.umid) + '% umid.' : ''].filter(Boolean);
    return '<div class="reg">' + esc(l.join(' · ')) + (g.obs ? (l.length ? '<br>' : '') + '“' + esc(g.obs) + '”' : '') +
      ((g.fotos || []).length ? '<div>' + g.fotos.map(function (u) { return '<a href="' + esc(u) + '" target="_blank" rel="noopener"><img src="' + esc(u) + '" alt=""></a>'; }).join('') + '</div>' : '') + '</div>';
  }

  /* ---------- folha "Marcar aplicado": só a data é obrigatória ---------- */
  var LIM = { vento: 10, temp: 30, umid: 55 };   // boas práticas de pulverização: só avisa, não impede
  function abrirFolha(id) {
    var a = (D.aplicacoes || []).filter(function (x) { return x.id === id; })[0], tal = marcados(id);
    if (!a || !tal.length) return;
    var ha = a.tal.filter(function (t) { return tal.indexOf(t.nome) >= 0; }).reduce(function (s, t) { return s + t.ha; }, 0);
    var fotos = [];
    var v = document.createElement('div'); v.className = 'veu';
    v.innerHTML = '<div class="folha"><h3>Marcar aplicado</h3><div class="q">' + esc(a.titulo) + ' · ' + esc(tal.join(', ')) + ' · ' + n(ha, 1) + ' ha</div>' +
      '<div class="g3"><div class="campo"><label class="l">Data *</label><input type="date" id="fData" value="' + hoje() + '" max="' + hoje() + '"></div>' +
      '<div class="campo"><label class="l">Início</label><input type="time" id="fIni"></div><div class="campo"><label class="l">Fim</label><input type="time" id="fFim"></div></div>' +
      '<div class="g3"><div class="campo"><label class="l">Vento (km/h)</label><input id="fVento" inputmode="decimal" placeholder="—"></div>' +
      '<div class="campo"><label class="l">Temp. (°C)</label><input id="fTemp" inputmode="decimal" placeholder="—"></div>' +
      '<div class="campo"><label class="l">Umidade (%)</label><input id="fUmid" inputmode="decimal" placeholder="—"></div></div>' +
      '<div id="fAlerta"></div>' +
      '<div class="fotos" id="fFotos"></div><button type="button" class="addfoto" id="fAdd">📷 Adicionar foto (opcional)</button>' +
      '<input type="file" id="fArq" accept="image/*" capture="environment" class="oculto">' +
      '<div class="campo" style="margin-top:10px"><label class="l">Observação (opcional)</label><textarea id="fObs" rows="2" placeholder="ex.: parei 20 min por garoa"></textarea></div>' +
      '<button class="btn" id="fOk">✔ Confirmar aplicação</button><button class="btn sec" id="fNao">Cancelar</button></div>';
    document.body.appendChild(v);
    var val = function (i) { var x = String(v.querySelector(i).value || '').replace(',', '.').trim(); return x === '' ? '' : Number(x); };
    var avisar = function () {
      var al = [], ve = val('#fVento'), te = val('#fTemp'), um = val('#fUmid');
      if (ve !== '' && ve > LIM.vento) al.push('vento acima de ' + LIM.vento + ' km/h');
      if (te !== '' && te > LIM.temp) al.push('temperatura acima de ' + LIM.temp + ' °C');
      if (um !== '' && um < LIM.umid) al.push('umidade abaixo de ' + LIM.umid + '%');
      v.querySelector('#fAlerta').innerHTML = al.length ? '<div class="alerta">⚠ Clima fora do ideal: ' + al.join(', ') + '. Pode registrar mesmo assim.</div>' : '';
    };
    ['#fVento', '#fTemp', '#fUmid'].forEach(function (i) { v.querySelector(i).addEventListener('input', avisar); });
    v.querySelector('#fAdd').onclick = function () { if (fotos.length >= 3) { toast('Até 3 fotos por aplicação'); return; } v.querySelector('#fArq').click(); };
    v.querySelector('#fArq').onchange = async function () {
      var f = this.files && this.files[0]; this.value = ''; if (!f) return;
      try { var b = await reduzir(f); fotos.push(b); v.querySelector('#fFotos').innerHTML = fotos.map(function (x) { return '<img src="' + URL.createObjectURL(x) + '" alt="">'; }).join(''); }
      catch (e) { toast('Não deu para usar essa foto'); }
    };
    v.querySelector('#fNao').onclick = function () { v.remove(); };
    v.querySelector('#fOk').onclick = async function () {
      var dt = v.querySelector('#fData').value;
      if (!dt) { toast('Informe a data da aplicação'); return; }
      if (dt > hoje()) { toast('A data não pode ser no futuro'); return; }
      var item = { id: 'rg' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), rec_id: id, talhoes: tal, data: dt, em: new Date().toISOString(),
        registro: { inicio: v.querySelector('#fIni').value, fim: v.querySelector('#fFim').value, vento: val('#fVento'), temp: val('#fTemp'), umid: val('#fUmid'), obs: v.querySelector('#fObs').value.trim() },
        fotos: fotos, fazenda: $('#selFaz').value };
      this.disabled = true;
      // o Safari do iPhone às vezes recusa guardar Blob: guarda os bytes da foto
      item.fotos = await Promise.all(fotos.map(function (b) { return b.arrayBuffer().then(function (buf) { return { buf: buf, tipo: b.type || 'image/jpeg' }; }); }));
      await filaPor(item);          // guarda primeiro: sem internet nada se perde
      selec[id] = [];
      v.remove();
      await sobreporFila(); pintar(); faixa();
      var ok = await enviarFila();
      toast(ok ? '✔ Aplicação registrada. O consultor já vê no app.' : '✔ Guardado no celular. Envia sozinho quando tiver internet.');
    };
  }
  // foto menor antes de guardar/enviar (até 1600 px, JPEG)
  function reduzir(arq) {
    return new Promise(function (ok, falha) {
      var u = URL.createObjectURL(arq), im = new Image();
      im.onload = function () {
        var e = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
        c.width = Math.round(im.naturalWidth * e); c.height = Math.round(im.naturalHeight * e);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
        c.toBlob(function (b) { b ? ok(b) : falha(new Error('foto')); }, 'image/jpeg', 0.8);
      };
      im.onerror = function () { URL.revokeObjectURL(u); falha(new Error('foto')); };
      im.src = u;
    });
  }

  /* ---------- fila sem internet (IndexedDB: guarda também as fotos) ---------- */
  var dbP = null;
  function db() {
    if (!dbP) dbP = new Promise(function (ok, falha) {
      var r = indexedDB.open('amvs-portal', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('fila', { keyPath: 'id' }); };
      r.onsuccess = function () { ok(r.result); }; r.onerror = function () { falha(r.error); };
    });
    return dbP;
  }
  function loja(modo, fn) { return db().then(function (d) { return new Promise(function (ok, falha) { var t = d.transaction('fila', modo), s = t.objectStore('fila'), r = fn(s); t.oncomplete = function () { ok(r && r.result); }; t.onerror = function () { falha(t.error); }; }); }); }
  function filaPor(item) { return loja('readwrite', function (s) { return s.put(item); }); }
  function filaTudo() { return loja('readonly', function (s) { return s.getAll(); }).then(function (l) { return (l || []).sort(function (a, b) { return a.em < b.em ? -1 : 1; }); }).catch(function () { return []; }); }
  function filaTirar(id) { return loja('readwrite', function (s) { return s.delete(id); }); }
  function filaLimpar() { return loja('readwrite', function (s) { return s.clear(); }); }

  // o que está na fila aparece como aplicado (⏳) até subir
  async function sobreporFila() {
    if (!D || !D.aplicacoes) return;
    var f = await filaTudo();
    f.forEach(function (it) {
      var a = D.aplicacoes.filter(function (x) { return x.id === it.rec_id; })[0]; if (!a) return;
      a.tal.forEach(function (t) { if (it.talhoes.indexOf(t.nome) >= 0 && !t.feito) { t.feito = it.data; t.fila = it.id; } });
      var pend = a.tal.filter(function (t) { return !t.feito; }).length;
      a.status = !pend ? 'aplicada' : pend < a.tal.length ? 'andamento' : 'pendente';
    });
  }
  var enviando = false;
  async function enviarFila() {
    if (enviando || !tok) return false;
    enviando = true;
    var tudoOk = true;
    try {
      var f = await filaTudo();
      for (var i = 0; i < f.length; i++) {
        var it = f[i], chaves = [];
        try {
          for (var k = 0; k < (it.fotos || []).length; k++) {
            var fo = it.fotos[k], blob = fo instanceof Blob ? fo : new Blob([fo.buf], { type: fo.tipo || 'image/jpeg' });
            var r = await api('/api/portal/foto', blob, { headers: { 'Content-Type': 'image/jpeg', 'X-Foto-Id': it.id + 'f' + k } });
            chaves.push(r.midia);
          }
          var reg = Object.assign({}, it.registro, { fotos: chaves });
          await api('/api/portal/aplicar', { rec_id: it.rec_id, talhoes: it.talhoes, data: it.data, reg_id: it.id, em: it.em, registro: reg });
          await filaTirar(it.id);
        } catch (e) {
          tudoOk = false;
          if (e.rede) break;                   // sem sinal: tenta de novo depois
          await filaTirar(it.id);              // recusado pelo servidor (ex.: já aplicado por outro): avisa e tira
          toast('Não foi possível registrar ' + it.talhoes.join(', ') + ': ' + e.message);
        }
      }
    } finally { enviando = false; }
    if (f && f.length && D) { await carregarQuieto(); }
    faixa();
    return tudoOk;
  }
  async function cancelarFila(id) {
    if (!confirm('Cancelar esta marcação que ainda não foi enviada?')) return;
    await filaTirar(id); await carregarQuieto();
  }
  async function carregarQuieto() { try { await carregar($('#selSafra').value || undefined); } catch (e) {} }
  async function faixa() {
    var el = $('#faixa'); if (!el) return;
    var nf = (await filaTudo()).length, sem = semRede || !navigator.onLine;
    var t = [];
    if (sem) t.push('📶 Sem internet · mostrando os dados guardados neste celular');
    if (nf) t.push('⏳ ' + nf + (nf > 1 ? ' marcações esperando' : ' marcação esperando') + ' internet para enviar');
    el.textContent = t.join(' · ');
    el.className = 'faixa' + (nf ? ' am' : '') + (t.length ? '' : ' oculto');
  }
  window.addEventListener('online', function () { enviarFila(); });
  window.addEventListener('offline', faixa);
  setInterval(function () { if (navigator.onLine) filaTudo().then(function (f) { if (f.length) enviarFila(); }); }, 30000);

  /* ---------- aviso no celular (5h00) ---------- */
  function pushPossivel() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
  function instalado() { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }
  function perguntado() { try { return !!localStorage.getItem(CH + ':push'); } catch (e) { return false; } }
  function cartaoPush() {
    if (!eu || eu.papel !== 'operador' || perguntado()) return '';
    if (pushPossivel() && Notification.permission !== 'default') return '';
    if (!pushPossivel()) {
      if (!/iPhone|iPad|iPod/.test(navigator.userAgent) || instalado()) return '';
      return '<div class="push">🔔 Para receber às 5h o aviso das aplicações do dia: no Safari toque em <b>Compartilhar → Adicionar à Tela de Início</b> e abra pelo ícone <b>AMVS Fazenda</b>.</div>';
    }
    return '<div class="push"><span>🔔 Receba às 5h da manhã, no celular, as aplicações do dia — mesmo com o portal fechado.</span><button class="btn" id="btnPush">Receber avisos</button></div>';
  }
  function chaveBytes(b) { var x = String(b).replace(/-/g, '+').replace(/_/g, '/'), bin = atob(x + '==='.slice((x.length + 3) % 4)), o = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i); return o; }
  async function assinarPush() {
    var reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
    if (!sub) { var k = await api('/api/portal/push/chave'); sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveBytes(k.chave) }); }
    await api('/api/portal/push/assinar', { assinatura: sub.toJSON() });
  }
  function ativarAvisos() {
    try { localStorage.setItem(CH + ':push', '1'); } catch (e) {}   // pergunta uma vez só
    Notification.requestPermission().then(async function (p) {
      if (p !== 'granted') { toast('Avisos bloqueados. Dá para liberar nos Ajustes do celular.'); pintar(); return; }
      try { await assinarPush(); toast('🔔 Pronto! Às 5h chegam as aplicações do dia.'); } catch (e) { toast('Não deu para ligar os avisos: ' + e.message); }
      pintar();
    });
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/portal-sw.js', { scope: '/portal' }).catch(function () {});
    navigator.serviceWorker.addEventListener('message', function (ev) { if (ev.data && ev.data.abrir === 'fazer') { filtro = 'fazer'; if (D) pintar(); } });
  }
  if (/[?&]aba=fazer/.test(location.search)) { filtro = 'fazer'; try { history.replaceState(null, '', '/portal'); } catch (e) {} }
  // sessão guardada: abre mesmo sem internet (dados do aparelho); só sai se o servidor recusar o login
  if (tok) iniciar().then(function () {
    if (eu && eu.papel === 'operador') {
      enviarFila();
      if (pushPossivel() && Notification.permission === 'granted' && navigator.onLine) assinarPush().catch(function () {});
    }
  }).catch(function (e) {
    if (e && e.rede) { $('#telaLogin').classList.add('oculto'); $('#telaApp').classList.remove('oculto'); $('#conteudo').innerHTML = '<div class="vazio">Sem internet e o portal ainda não foi aberto neste celular com sinal. Abra uma vez com internet.</div>'; }
  });
})();
</script>
</body></html>`;
}
