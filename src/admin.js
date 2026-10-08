/* ============================================================
   admin.js — painel do administrador
   /admin                → a página
   /api/admin/resumo     → contas, relatórios e pontos das visitas
   /api/admin/usuario    → cria uma conta nova
   /api/admin/promover   → liga/desliga o acesso de administrador
   ============================================================ */

import { hashSenha, novoId } from './auth.js';
import { contagemAcessos } from './acessos.js';

const esc = (s) => String(s == null ? '' : s)
  .replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/* ---------------- quem é admin ---------------- */

export async function ehAdmin(env, me) {
  if (!me) return false;
  try {
    const u = await env.DB.prepare('SELECT admin FROM usuarios WHERE id = ?').bind(me.id).first();
    return !!(u && Number(u.admin) === 1);
  } catch (e) {
    return false;   // coluna ainda não existe
  }
}

/* ---------------- dados ---------------- */

/* ---------------- prazo de uso de cada conta ---------------- */

// Quantos dias a pessoa vai usar o app. Sem informar, vale 1 ano. 0 = sem prazo.
// A tabela é criada sozinha na primeira chamada (sem migração manual).
export const PRAZO_PADRAO = 365;
let prazosPronta = null;

function garantirPrazos(env) {
  if (!prazosPronta) {
    prazosPronta = env.DB.prepare(`CREATE TABLE IF NOT EXISTS prazos_conta (
      usuario_id    TEXT PRIMARY KEY,
      dias          INTEGER NOT NULL,
      atualizado_em TEXT DEFAULT (datetime('now'))
    )`).run().catch((e) => { prazosPronta = null; throw e; });
  }
  return prazosPronta;
}

function lerPrazo(valor, padrao) {
  if (valor === undefined || valor === null || String(valor).trim() === '') return padrao;
  const n = Math.floor(Number(valor));
  if (!Number.isFinite(n) || n < 0 || n > 3650) throw new Error('o prazo deve ser de 0 a 3650 dias (0 = sem prazo)');
  return n;
}

function criadoEm(txt) {
  let t = String(txt || '').trim();
  if (!t) return NaN;
  if (t.indexOf('T') < 0) t = t.replace(' ', 'T');
  if (!/(Z|[+-]\d\d:?\d\d)$/.test(t)) t += 'Z';
  return Date.parse(t);
}

async function aplicarPrazos(env, contas) {
  let mapa = new Map();
  try {
    await garantirPrazos(env);
    const { results } = await env.DB.prepare('SELECT usuario_id, dias FROM prazos_conta').all();
    (results || []).forEach((r) => mapa.set(r.usuario_id, Number(r.dias)));
  } catch (e) { mapa = new Map(); }
  const agora = Date.now();
  contas.forEach((c) => {
    const criado = criadoEm(c.criado_em);
    const dias = mapa.has(c.id) ? mapa.get(c.id) : (Number(c.admin) === 1 ? 0 : PRAZO_PADRAO);
    c.dias_conta = isNaN(criado) ? null : Math.max(0, Math.floor((agora - criado) / 86400000));
    c.prazo_dias = dias > 0 ? dias : null;
    c.prazo_proprio = mapa.has(c.id);
    c.restam = (c.prazo_dias != null && c.dias_conta != null) ? c.prazo_dias - c.dias_conta : null;
    c.vence_em = (c.prazo_dias != null && !isNaN(criado))
      ? new Date(criado + c.prazo_dias * 86400000).toISOString().slice(0, 10) : null;
  });
}

export async function definirPrazo(env, id, dias) {
  const n = lerPrazo(dias, null);
  if (n === null) throw new Error('informe o prazo em dias (0 = sem prazo)');
  const u = await env.DB.prepare('SELECT id FROM usuarios WHERE id = ?').bind(id).first();
  if (!u) throw new Error('conta não encontrada');
  await garantirPrazos(env);
  await env.DB.prepare(`INSERT INTO prazos_conta (usuario_id, dias, atualizado_em) VALUES (?,?,datetime('now'))
    ON CONFLICT(usuario_id) DO UPDATE SET dias = excluded.dias, atualizado_em = datetime('now')`).bind(id, n).run();
  return { ok: true, id, dias: n };
}

export async function resumoAdmin(env, me, adm) {
  // conta comum: só enxerga o que é dela; administrador enxerga tudo
  const meu = adm ? '' : ' AND r.usuario_id = ?';
  const arg = adm ? [] : [me.id];
  const contas = await env.DB.prepare(`
    SELECT u.id, u.email, u.nome, u.criado_em, COALESCE(u.admin,0) AS admin,
           (SELECT COUNT(*) FROM relatorios r WHERE r.usuario_id = u.id) AS relatorios,
           (SELECT COUNT(*) FROM relatorios r WHERE r.usuario_id = u.id AND r.status='publicado') AS publicados,
           (SELECT COUNT(*) FROM produtores p WHERE p.usuario_id = u.id) AS produtores,
           (SELECT COUNT(*) FROM fazendas f WHERE f.usuario_id = u.id) AS fazendas,
           (SELECT MAX(r.atualizado_em) FROM relatorios r WHERE r.usuario_id = u.id) AS ultima_atividade
      FROM usuarios u
     WHERE ${adm ? '1=1' : 'u.id = ?'}
     ORDER BY u.criado_em DESC
  `).bind(...(adm ? [] : [me.id])).all();

  if (adm) await aplicarPrazos(env, contas.results || []);

  const relatorios = await env.DB.prepare(`
    SELECT r.id, r.fazenda, r.produtor, r.safra, r.servico, r.responsavel,
           r.data_inicio, r.data_fim, r.status, r.publicado_em, r.criado_em,
           u.email AS conta, u.nome AS conta_nome,
           (SELECT COUNT(*) FROM itens i WHERE i.relatorio_id = r.id) AS registros,
           (SELECT COUNT(*) FROM itens i WHERE i.relatorio_id = r.id AND i.tipo='foto') AS fotos,
           (SELECT COUNT(*) FROM itens i WHERE i.relatorio_id = r.id AND i.tipo='video') AS videos
      FROM relatorios r LEFT JOIN usuarios u ON u.id = r.usuario_id
     WHERE 1=1${meu}
     ORDER BY (r.status = 'publicado') DESC,
              replace(CASE WHEN r.status = 'publicado'
                           THEN COALESCE(r.publicado_em, r.atualizado_em, r.criado_em)
                           ELSE COALESCE(r.atualizado_em, r.criado_em) END, 'T', ' ') DESC
     LIMIT 500
  `).bind(...arg).all();

  // um ponto por relatório: a média das coordenadas dos registros daquela visita
  const pontos = await env.DB.prepare(`
    SELECT i.relatorio_id AS id, AVG(i.lat) AS lat, AVG(i.lon) AS lon, COUNT(*) AS n,
           r.fazenda, r.produtor, r.status, COALESCE(r.data_inicio, r.criado_em) AS data,
           u.email AS conta
      FROM itens i
      JOIN relatorios r ON r.id = i.relatorio_id
      LEFT JOIN usuarios u ON u.id = r.usuario_id
     WHERE i.lat IS NOT NULL AND i.lon IS NOT NULL${meu}
     GROUP BY i.relatorio_id
     LIMIT 1000
  `).bind(...arg).all();

  const acessos = await contagemAcessos(env);
  (relatorios.results || []).forEach((r) => {
    const a = acessos[r.id] || {};
    r.acessos = Number(a.total || 0);
    r.visitantes = Number(a.visitantes || 0);
    r.ultimo_acesso = a.ultimo || null;
  });

  const itens = adm
    ? await env.DB.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(bytes),0) AS bytes FROM itens').first()
    : await env.DB.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(i.bytes),0) AS bytes FROM itens i
        JOIN relatorios r ON r.id = i.relatorio_id WHERE r.usuario_id = ?`).bind(me.id).first();

  return {
    ok: true,
    eu: { admin: !!adm, id: me.id, nome: me.nome || '', email: me.email || '' },
    contas: contas.results || [],
    relatorios: relatorios.results || [],
    pontos: pontos.results || [],
    totais: {
      contas: (contas.results || []).length,
      relatorios: (relatorios.results || []).length,
      registros: Number(itens && itens.n || 0),
      bytes: Number(itens && itens.bytes || 0)
    }
  };
}

export async function criarConta(env, corpo) {
  const email = String(corpo.email || '').trim().toLowerCase();
  const senha = String(corpo.senha || '');
  if (!email.includes('@')) throw new Error('informe um e-mail válido');
  if (senha.length < 6) throw new Error('a senha precisa de pelo menos 6 caracteres');
  const existe = await env.DB.prepare('SELECT id FROM usuarios WHERE email = ?').bind(email).first();
  if (existe) throw new Error('já existe uma conta com esse e-mail');
  const prazo = lerPrazo(corpo.prazo_dias, corpo.admin ? 0 : PRAZO_PADRAO);
  const id = novoId('u');
  await env.DB.prepare('INSERT INTO usuarios (id,email,senha_hash,nome,admin) VALUES (?,?,?,?,?)')
    .bind(id, email, await hashSenha(senha), String(corpo.nome || '').trim(), corpo.admin ? 1 : 0).run();
  try { await definirPrazo(env, id, prazo); } catch (e) { /* a conta já existe; o prazo pode ser ajustado depois */ }
  return { ok: true, id, email, prazo_dias: prazo };
}

export async function promover(env, id, valor) {
  await env.DB.prepare('UPDATE usuarios SET admin = ? WHERE id = ?').bind(valor ? 1 : 0, id).run();
  return { ok: true };
}

export async function trocarSenha(env, id, senha) {
  const nova = String(senha || '');
  if (nova.length < 6) throw new Error('a senha precisa de pelo menos 6 caracteres');
  const u = await env.DB.prepare('SELECT email FROM usuarios WHERE id = ?').bind(id).first();
  if (!u) throw new Error('conta não encontrada');
  await env.DB.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?')
    .bind(await hashSenha(nova), id).run();
  return { ok: true, email: u.email };
}

/* ---------------- a página ---------------- */

export function paginaAdmin(empresa) {
  return `<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="#1B7A43">
<title>Painel · ${esc(empresa || 'Relatório VSL')}</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css">
<style>
:root{--verde:#1B7A43;--verde-escuro:#146034;--verde-claro:#E8F4EC;--texto:#1B2B22;
 --fraco:#6B7B72;--linha:#E4E9E6;--erro:#D93025;--altura:100dvh}
*{box-sizing:border-box}
body{margin:0;background:#F2F4F2;color:var(--texto);font-size:15px;line-height:1.5;
 font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
header.topo{background:var(--verde);color:#fff;padding:14px 18px;display:flex;align-items:center;gap:12px}
header.topo h1{margin:0;font-size:17px;flex:1}
header.topo small{opacity:.85;font-size:12px;display:block;font-weight:400}
header.topo button{background:rgba(255,255,255,.18);color:#fff;border:none;border-radius:8px;padding:7px 12px;font-size:13px}
.abas{display:flex;background:#fff;border-bottom:1px solid var(--linha);position:sticky;top:0;z-index:20;overflow-x:auto}
.abas button{flex:1;min-width:120px;background:none;border:none;padding:13px 10px;font-size:14px;color:var(--fraco);
 border-bottom:3px solid transparent;font-weight:600;white-space:nowrap}
.abas button.on{color:var(--verde-escuro);border-bottom-color:var(--verde)}
main{padding:16px;max-width:1100px;margin:0 auto}
.painel{display:none}.painel.on{display:block}
.cartoes{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:18px}
.cartao{background:#fff;border:1px solid var(--linha);border-radius:12px;padding:14px}
.cartao b{display:block;font-size:24px;color:var(--verde-escuro);line-height:1.2}
.cartao span{font-size:12px;color:var(--fraco)}
.caixa{background:#fff;border:1px solid var(--linha);border-radius:12px;padding:14px;margin-bottom:16px}
.caixa h2{margin:0 0 12px;font-size:15px;color:var(--verde-escuro)}
table{width:100%;border-collapse:collapse;font-size:13.5px}
th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:var(--fraco);
 padding:8px 8px;border-bottom:2px solid var(--linha);white-space:nowrap}
td{padding:9px 8px;border-bottom:1px solid var(--linha);vertical-align:top}
tr:last-child td{border-bottom:none}
.rolagem{overflow-x:auto;-webkit-overflow-scrolling:touch}
.selo{font-size:11px;padding:2px 8px;border-radius:10px;background:#eee;color:var(--fraco);white-space:nowrap}
.selo.pub{background:var(--verde-claro);color:var(--verde-escuro);font-weight:600}
.selo.adm{background:#FFF3DC;color:#8A5A00;font-weight:600}
.selo.venc{background:#FDECEA;color:#8A1C12;font-weight:600}
.selo.perto{background:#FFF3DC;color:#8A5A00;font-weight:600}
.peq{color:var(--fraco);font-size:11.5px}
.aviso.perto{background:#FFF8E6;border-left-color:#E8A317;color:#6B4A00}
.aviso button.selo{margin-left:6px;cursor:pointer;border:1px solid var(--linha)}
.pre{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px}
.pre button{cursor:pointer;border:1px solid var(--linha);background:#fff;border-radius:14px;padding:5px 11px;font-size:12.5px;color:var(--verde-escuro)}
.campo{margin-bottom:10px}
.campo label{display:block;font-size:12px;color:var(--fraco);margin-bottom:4px}
.campo input,.campo select{width:100%;padding:11px 12px;border:1px solid var(--linha);border-radius:9px;font-size:15px;background:#fff}
.btn{width:100%;padding:12px;border:none;border-radius:9px;background:var(--verde);color:#fff;font-weight:600;font-size:15px}
.btn.sec{background:#fff;color:var(--verde);border:1.5px solid var(--verde)}
.linha2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.aviso{background:var(--verde-claro);border-left:4px solid var(--verde);padding:10px 12px;border-radius:0 8px 8px 0;font-size:13.5px;margin:10px 0}
.aviso.ruim{background:#FDECEA;border-left-color:var(--erro);color:#8A1C12}
#mapa{height:380px;border-radius:12px;border:1px solid var(--linha);background:#eef}
.barras{display:flex;align-items:flex-end;justify-content:flex-start;gap:6px;height:150px;padding-top:16px;overflow-x:auto}
.barras div{flex:0 1 34px;min-width:22px;max-width:46px;background:var(--verde);border-radius:4px 4px 0 0;position:relative}
.barras div span{position:absolute;bottom:-20px;left:50%;transform:translateX(-50%);font-size:9.5px;color:var(--fraco);white-space:nowrap}
.barras div b{position:absolute;top:-16px;left:50%;transform:translateX(-50%);font-size:10px;color:var(--verde-escuro)}
.legenda-barras{height:26px}
a{color:var(--verde-escuro)}
.entrar{max-width:360px;margin:60px auto;background:#fff;border:1px solid var(--linha);border-radius:14px;padding:22px}
.entrar h1{margin:0 0 4px;font-size:19px}
.entrar p{margin:0 0 16px;font-size:13px;color:var(--fraco)}
td.acoes{white-space:nowrap}
td.acoes button{cursor:pointer;border:1px solid var(--linha);margin-bottom:3px}
.veu{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:80;display:flex;
 align-items:center;justify-content:center;padding:16px}
.modal{background:#fff;border-radius:14px;padding:20px;width:100%;max-width:380px;
 box-shadow:0 10px 40px rgba(0,0,0,.25)}
.marcar{display:flex;align-items:center;gap:9px;font-size:13.5px;margin:2px 0 12px}
.marcar input{width:18px;height:18px;accent-color:var(--verde)}
@media(max-width:560px){ .linha2{grid-template-columns:1fr} #mapa{height:300px} }
</style>
</head><body>

<div id="telaEntrar" class="entrar">
  <h1>Painel de relatórios</h1>
  <p>${esc(empresa || 'Relatório de Campo VSL')}</p>
  <div class="campo"><label>E-mail</label><input id="eMail" type="email" autocomplete="username"></div>
  <div class="campo"><label>Senha</label><input id="eSenha" type="password" autocomplete="current-password"></div>
  <button class="btn" id="btnEntrar">Entrar</button>
  <div id="eMsg"></div>
</div>

<div id="telaPainel" style="display:none">
  <header class="topo">
    <div style="flex:1"><h1 id="titulo">Administração<small id="quem"></small></h1></div>
    <button id="btnAtualizar">Atualizar</button>
    <button id="btnSair">Sair</button>
  </header>
  <div class="abas">
    <button class="on" data-aba="dash">Dashboard</button>
    <button data-aba="contas" id="abaContas">Contas</button>
    <button data-aba="rels">Relatórios</button>
  </div>
  <main>
    <div id="avisoPrazos"></div>
    <section class="painel on" id="pDash">
      <div class="cartoes" id="kpis"></div>
      <div class="caixa">
        <h2>Visitas por dia</h2>
        <div class="barras" id="barras"></div>
        <div class="legenda-barras"></div>
      </div>
      <div class="caixa">
        <h2>Onde foram as visitas</h2>
        <div id="mapa"></div>
        <div style="font-size:11.5px;color:var(--fraco);margin-top:8px">
          🟢 visita enviada · 🟠 ainda em aberto · cada ponto é a média das fotos daquela visita
        </div>
      </div>
    </section>

    <section class="painel" id="pContas">
      <div class="caixa">
        <h2>Criar uma conta</h2>
        <div class="linha2">
          <div class="campo"><label>Nome</label><input id="nNome" placeholder="Nome de quem vai usar"></div>
          <div class="campo"><label>E-mail</label><input id="nEmail" type="email" placeholder="pessoa@exemplo.com"></div>
        </div>
        <div class="linha2">
          <div class="campo"><label>Senha</label><input id="nSenha" type="text" placeholder="mínimo 6 caracteres"></div>
          <div class="campo"><label>Acesso</label>
            <select id="nAdmin"><option value="0">Usuário comum</option><option value="1">Administrador</option></select>
          </div>
        </div>
        <div class="campo"><label>Período de uso, em dias (365 = 1 ano · 0 = sem prazo)</label>
          <input id="nPrazo" type="number" min="0" max="3650" value="365" inputmode="numeric">
        </div>
        <div style="font-size:12px;color:var(--fraco);margin:-4px 0 12px">
          Quando a conta completar esse período, aparece um aviso aqui no painel. O acesso dela não é bloqueado.
        </div>
        <button class="btn" id="btnCriar">Criar conta</button>
        <div id="nMsg"></div>
      </div>
      <div class="caixa">
        <h2>Contas ativas</h2>
        <div class="rolagem"><table id="tContas"></table></div>
      </div>
    </section>

    <section class="painel" id="pRels">
      <div class="caixa">
        <h2 id="hRels">Todos os relatórios</h2>
        <div class="campo"><input id="filtro" placeholder="filtrar por fazenda, produtor ou safra"></div>
        <div class="rolagem"><table id="tRels"></table></div>
      </div>
    </section>
  </main>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<script>
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var CHAVE = 'vsl-admin-token';
  var token = '';
  try { token = localStorage.getItem(CHAVE) || ''; } catch (e) {}
  var dados = null, mapa = null, camada = null;

  function aviso(el, txt, ruim) {
    el.innerHTML = txt ? '<div class="aviso' + (ruim ? ' ruim' : '') + '">' + esc(txt) + '</div>' : '';
  }
  function dataBR(iso) {
    if (!iso) return '—';
    var p = String(iso).slice(0, 10).split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso;
  }
  function bytesFmt(b) {
    if (!b) return '0';
    var u = ['B', 'KB', 'MB', 'GB'], i = 0;
    while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
    return b.toFixed(b < 10 && i > 0 ? 1 : 0) + ' ' + u[i];
  }

  async function api(rota, corpo) {
    var r = await fetch(rota, {
      method: corpo ? 'POST' : 'GET',
      headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
      body: corpo ? JSON.stringify(corpo) : undefined
    });
    var j = null; try { j = await r.json(); } catch (e) {}
    if (!r.ok) throw new Error((j && j.erro) || ('HTTP ' + r.status));
    return j;
  }

  /* ---------- entrar ---------- */
  $('#btnEntrar').onclick = async function () {
    var msg = $('#eMsg');
    aviso(msg, 'Entrando…');
    try {
      var r = await api('/api/entrar', { email: $('#eMail').value.trim(), senha: $('#eSenha').value });
      token = r.token;
      try { localStorage.setItem(CHAVE, token); } catch (e) {}
      aviso(msg, '');
      await abrirPainel();
    } catch (e) { aviso(msg, e.message, true); }
  };
  $('#eSenha').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('#btnEntrar').click(); });

  $('#btnSair').onclick = function () {
    token = ''; try { localStorage.removeItem(CHAVE); } catch (e) {}
    $('#telaPainel').style.display = 'none';
    $('#telaEntrar').style.display = '';
  };
  $('#btnAtualizar').onclick = function () { abrirPainel(); };

  /* ---------- abas ---------- */
  document.querySelectorAll('.abas button').forEach(function (b) {
    b.onclick = function () {
      document.querySelectorAll('.abas button').forEach(function (x) { x.classList.remove('on'); });
      document.querySelectorAll('.painel').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      $('#p' + b.dataset.aba.charAt(0).toUpperCase() + b.dataset.aba.slice(1)).classList.add('on');
      if (b.dataset.aba === 'dash' && mapa) setTimeout(function () { mapa.invalidateSize(); }, 60);
    };
  });

  /* ---------- painel ---------- */
  async function abrirPainel() {
    try {
      dados = await api('/api/admin/resumo');
    } catch (e) {
      aviso($('#eMsg'), e.message, true);
      token = ''; try { localStorage.removeItem(CHAVE); } catch (er) {}
      $('#telaEntrar').style.display = '';
      $('#telaPainel').style.display = 'none';
      return;
    }
    $('#telaEntrar').style.display = 'none';
    $('#telaPainel').style.display = '';
    var adm = !!(dados.eu && dados.eu.admin);
    $('#titulo').firstChild.nodeValue = adm ? 'Administração' : 'Meus relatórios';
    $('#quem').textContent = adm
      ? dados.totais.contas + ' contas · ' + dados.totais.relatorios + ' relatórios'
      : (dados.eu.nome || dados.eu.email) + ' · ' + dados.totais.relatorios + ' relatórios';
    $('#abaContas').style.display = adm ? '' : 'none';
    $('#hRels').textContent = adm ? 'Todos os relatórios' : 'Meus relatórios';
    if (!adm && $('#pContas').classList.contains('on')) document.querySelector('.abas button[data-aba="dash"]').click();
    desenharKpis();
    desenharPrazos();
    desenharContas();
    desenharRelatorios();
    desenharBarras();
    desenharMapa();
  }

  function desenharKpis() {
    var t = dados.totais;
    var pub = dados.relatorios.filter(function (r) { return r.status === 'publicado'; }).length;
    var adm = !!(dados.eu && dados.eu.admin);
    var vencidas = (dados.contas || []).filter(function (c) { return c.restam != null && c.restam <= 0; }).length;
    $('#kpis').innerHTML =
      (adm ? cartao(t.contas, 'contas') : '') +
      (adm && vencidas ? cartao(vencidas, vencidas === 1 ? 'conta com prazo vencido' : 'contas com prazo vencido') : '') +
      cartao(t.relatorios, 'relatórios') +
      cartao(pub, 'já enviados ao cliente') +
      cartao(t.registros, 'fotos, vídeos e notas') +
      cartao(bytesFmt(t.bytes), 'de mídia guardada');
  }
  function cartao(v, t) { return '<div class="cartao"><b>' + esc(v) + '</b><span>' + esc(t) + '</span></div>'; }

  function desenharContas() {
    var linhas = dados.contas.map(function (c) {
      return '<tr><td><b>' + esc(c.nome || '—') + '</b><br><span style="color:var(--fraco);font-size:12px">' + esc(c.email) + '</span>' +
        (Number(c.admin) === 1 ? ' <span class="selo adm">admin</span>' : '') + '</td>' +
        '<td>' + c.relatorios + '<br><span style="color:var(--fraco);font-size:11.5px">' + c.publicados + ' enviados</span></td>' +
        '<td>' + c.produtores + ' / ' + c.fazendas + '</td>' +
        '<td>' + usoCel(c) + '</td>' +
        '<td>' + dataBR(c.ultima_atividade) + '</td>' +
        '<td class="acoes">' +
          '<button class="selo" data-prazo="' + esc(c.id) + '">prazo</button> ' +
          '<button class="selo" data-senha="' + esc(c.id) + '" data-email="' + esc(c.email) + '">trocar senha</button> ' +
          '<button class="selo" data-prom="' + esc(c.id) + '" data-v="' + (Number(c.admin) === 1 ? 0 : 1) + '">' +
          (Number(c.admin) === 1 ? 'tirar admin' : 'tornar admin') + '</button>' +
        '</td></tr>';
    }).join('');
    $('#tContas').innerHTML =
      '<tr><th>Conta</th><th>Relatórios</th><th>Prod./Faz.</th><th>Tempo de uso</th><th>Última atividade</th><th></th></tr>' + linhas;
    document.querySelectorAll('[data-prom]').forEach(function (b) {
      b.onclick = async function () {
        b.disabled = true;
        try { await api('/api/admin/promover', { id: b.dataset.prom, admin: b.dataset.v === '1' }); await abrirPainel(); }
        catch (e) { alert(e.message); b.disabled = false; }
      };
    });
    document.querySelectorAll('[data-senha]').forEach(function (b) {
      b.onclick = function () { abrirTrocaSenha(b.dataset.senha, b.dataset.email); };
    });
    ligarPrazos();
  }

  /* ---------- tempo de uso e prazo de cada conta ---------- */
  function diasTxt(n) { return n + (n === 1 ? ' dia' : ' dias'); }

  function usoCel(c) {
    var h = '<b>' + (c.dias_conta == null ? '—' : diasTxt(c.dias_conta)) + '</b><br><span class="peq">desde ' + dataBR(c.criado_em) + '</span><br>';
    if (c.prazo_dias == null) return h + '<span class="selo">sem prazo</span>';
    var r = c.restam;
    if (r == null) return h + '<span class="selo">prazo de ' + diasTxt(c.prazo_dias) + '</span>';
    if (r < 0) return h + '<span class="selo venc">prazo venceu há ' + diasTxt(-r) + '</span>';
    if (r === 0) return h + '<span class="selo venc">prazo completo hoje</span>';
    if (r <= 30) return h + '<span class="selo perto">vence em ' + diasTxt(r) + ' (' + dataBR(c.vence_em) + ')</span>';
    return h + '<span class="selo pub">restam ' + diasTxt(r) + '</span><br><span class="peq">prazo de ' + diasTxt(c.prazo_dias) + '</span>';
  }

  // aviso no topo do painel: contas que completaram o prazo ou estão a 30 dias de completar
  function desenharPrazos() {
    var el = $('#avisoPrazos');
    var adm = !!(dados.eu && dados.eu.admin);
    if (!adm) { el.innerHTML = ''; return; }
    var lista = (dados.contas || []).filter(function (c) { return c.prazo_dias != null && c.restam != null && c.restam <= 30; })
      .sort(function (a, b) { return a.restam - b.restam; });
    el.innerHTML = lista.map(function (c) {
      var nome = '<b>' + esc(c.nome || c.email) + '</b>';
      var ref = c.prazo_dias === 365 ? '1 ano de uso' : 'o prazo de ' + diasTxt(c.prazo_dias);
      var txt, cls = '';
      if (c.restam < 0) { cls = ' ruim'; txt = '⚠️ ' + nome + ' completou ' + ref + ' (venceu há ' + diasTxt(-c.restam) + ', em ' + dataBR(c.vence_em) + ').'; }
      else if (c.restam === 0) { cls = ' ruim'; txt = '⚠️ ' + nome + ' completa ' + ref + ' hoje.'; }
      else {
        cls = ' perto';
        txt = '⏳ ' + nome + (c.prazo_dias === 365
          ? ' completa 1 ano de uso em ' + diasTxt(c.restam)
          : ': o prazo de ' + diasTxt(c.prazo_dias) + ' termina em ' + diasTxt(c.restam)) + ' (' + dataBR(c.vence_em) + ').';
      }
      return '<div class="aviso' + cls + '">' + txt + '<button class="selo" data-prazo="' + esc(c.id) + '">ajustar prazo</button></div>';
    }).join('');
    ligarPrazos();
  }

  function ligarPrazos() {
    document.querySelectorAll('[data-prazo]').forEach(function (b) {
      b.onclick = function () { abrirPrazo(b.dataset.prazo); };
    });
  }

  function abrirPrazo(id) {
    var c = (dados.contas || []).filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    var veu = document.createElement('div'); veu.className = 'veu';
    var cx = document.createElement('div'); cx.className = 'modal';
    cx.innerHTML =
      '<h2 style="margin:0 0 4px">Prazo de uso</h2>' +
      '<p style="margin:0 0 14px;font-size:13px;color:var(--fraco)">' + esc(c.nome || c.email) +
        (c.dias_conta == null ? '' : ' · usa há ' + diasTxt(c.dias_conta)) + '</p>' +
      '<div class="campo"><label>Prazo, em dias, contado desde a criação da conta (0 = sem prazo)</label>' +
      '<input id="pzDias" type="number" min="0" max="3650" inputmode="numeric" value="' + (c.prazo_dias == null ? 0 : c.prazo_dias) + '"></div>' +
      '<div class="pre">' +
        '<button type="button" data-d="30">30 dias</button><button type="button" data-d="90">3 meses</button>' +
        '<button type="button" data-d="180">6 meses</button><button type="button" data-d="365">1 ano</button>' +
        '<button type="button" data-d="730">2 anos</button><button type="button" data-d="0">sem prazo</button>' +
      '</div>' +
      '<div id="pzMsg"></div>' +
      '<button class="btn" id="pzOk">Salvar prazo</button>' +
      '<button class="btn sec" id="pzCancel" style="margin-top:8px">Cancelar</button>';
    veu.appendChild(cx); document.body.appendChild(veu);
    var sair = function () { veu.remove(); };
    veu.onclick = function (e) { if (e.target === veu) sair(); };
    cx.querySelector('#pzCancel').onclick = sair;
    cx.querySelectorAll('.pre button').forEach(function (b) {
      b.onclick = function () { cx.querySelector('#pzDias').value = b.dataset.d; };
    });
    cx.querySelector('#pzOk').onclick = async function () {
      var msg = cx.querySelector('#pzMsg');
      aviso(msg, 'Salvando…');
      try {
        await api('/api/admin/prazo', { id: id, dias: cx.querySelector('#pzDias').value });
        sair();
        await abrirPainel();
      } catch (e) { aviso(msg, e.message, true); }
    };
  }

  /* ---------- trocar a senha de uma conta ---------- */
  function abrirTrocaSenha(id, email) {
    var veu = document.createElement('div'); veu.className = 'veu';
    var cx = document.createElement('div'); cx.className = 'modal';
    cx.innerHTML =
      '<h2 style="margin:0 0 4px">Trocar a senha</h2>' +
      '<p style="margin:0 0 14px;font-size:13px;color:var(--fraco)">' + esc(email) + '</p>' +
      '<div class="campo"><label>Nova senha</label>' +
      '<input id="snNova" type="text" placeholder="mínimo 6 caracteres" autocomplete="off"></div>' +
      '<label class="marcar"><input type="checkbox" id="snGerar"> Gerar uma senha para mim</label>' +
      '<div id="snMsg"></div>' +
      '<button class="btn" id="snOk">Salvar nova senha</button>' +
      '<button class="btn sec" id="snCancel">Cancelar</button>';
    veu.appendChild(cx); document.body.appendChild(veu);
    var sair = function () { veu.remove(); };
    veu.onclick = function (e) { if (e.target === veu) sair(); };
    cx.querySelector('#snCancel').onclick = sair;
    cx.querySelector('#snGerar').onchange = function () {
      if (this.checked) {
        var a = 'abcdefghjkmnpqrstuvwxyz23456789';
        var s = '';
        for (var i = 0; i < 10; i++) s += a[Math.floor(Math.random() * a.length)];
        cx.querySelector('#snNova').value = s;
      }
    };
    cx.querySelector('#snOk').onclick = async function () {
      var nova = cx.querySelector('#snNova').value;
      var msg = cx.querySelector('#snMsg');
      aviso(msg, 'Salvando…');
      try {
        await api('/api/admin/senha', { id: id, senha: nova });
        sair();
        var q = String.fromCharCode(10);
        alert('Senha trocada.' + q + q + 'Conta: ' + email + q + 'Nova senha: ' + nova +
              q + q + 'Anote e repasse — ela não aparece de novo.');
      } catch (e) { aviso(msg, e.message, true); }
    };
    setTimeout(function () { cx.querySelector('#snNova').focus(); }, 120);
  }

  function acessosCel(r) {
    if (r.status !== 'publicado') return '<span style="color:var(--fraco)">—</span>';
    var n = Number(r.acessos || 0);
    if (!n) return '<b>0</b><br><span style="color:var(--fraco);font-size:11.5px">ninguém abriu ainda</span>';
    var u = Number(r.visitantes || 0);
    var ult = r.ultimo_acesso ? String(r.ultimo_acesso).replace(' ', 'T') + 'Z' : '';
    var quando = '';
    if (ult) {
      var d = new Date(ult);
      if (!isNaN(d)) quando = ' · último ' + d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) +
        ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    return '<b>' + n + (n === 1 ? ' visualização' : ' visualizações') + '</b><br><span style="color:var(--fraco);font-size:11.5px">' +
      u + (u === 1 ? ' visitante' : ' visitantes') + quando + '</span>';
  }

  function desenharRelatorios() {
    var termo = ($('#filtro').value || '').toLowerCase();
    var lista = dados.relatorios.filter(function (r) {
      if (!termo) return true;
      return [r.fazenda, r.produtor, r.conta, r.safra, r.servico].join(' ').toLowerCase().indexOf(termo) >= 0;
    });
    var linhas = lista.map(function (r) {
      var sel = r.status === 'publicado'
        ? '<span class="selo pub">enviado</span>'
        : '<span class="selo">' + esc(r.status || 'rascunho') + '</span>';
      return '<tr><td>' + dataBR(r.data_inicio || r.criado_em) + '</td>' +
        '<td><b>' + esc(r.fazenda || '—') + '</b><br><span style="color:var(--fraco);font-size:12px">' + esc(r.produtor || '') + '</span></td>' +
        '<td>' + esc(r.safra || '—') + '</td>' +
        '<td>' + r.registros + '<br><span style="color:var(--fraco);font-size:11.5px">' + r.fotos + ' fotos · ' + r.videos + ' vídeos</span></td>' +
        '<td>' + esc(r.conta || '—') + '</td>' +
        '<td>' + sel + '</td>' +
        '<td>' + acessosCel(r) + '</td>' +
        '<td>' + (r.status === 'publicado' ? '<a href="/r/' + esc(r.id) + '?sc=1" target="_blank">abrir</a>' : '—') + '</td></tr>';
    }).join('');
    $('#tRels').innerHTML =
      '<tr><th>Data</th><th>Fazenda</th><th>Safra</th><th>Registros</th><th>Conta</th><th>Status</th><th>Acessos</th><th></th></tr>' +
      (linhas || '<tr><td colspan="8" style="color:var(--fraco)">Nada encontrado.</td></tr>');
  }
  $('#filtro').addEventListener('input', function () { if (dados) desenharRelatorios(); });

  function desenharBarras() {
    var porDia = {};
    dados.relatorios.forEach(function (r) {
      var d = String(r.data_inicio || r.criado_em || '').slice(0, 10);
      if (d) porDia[d] = (porDia[d] || 0) + 1;
    });
    var dias = Object.keys(porDia).sort().slice(-30);
    if (!dias.length) { $('#barras').innerHTML = '<div style="color:var(--fraco);font-size:13px">Nenhuma visita registrada ainda.</div>'; return; }
    var max = Math.max.apply(null, dias.map(function (d) { return porDia[d]; }));
    $('#barras').innerHTML = dias.map(function (d) {
      var h = Math.max(6, Math.round(porDia[d] / max * 120));
      return '<div style="height:' + h + 'px" title="' + dataBR(d) + ': ' + porDia[d] + '">' +
        '<b>' + porDia[d] + '</b><span>' + d.slice(8, 10) + '/' + d.slice(5, 7) + '</span></div>';
    }).join('');
  }

  /* Mapa simples em SVG, para quando o Leaflet não carrega (sem internet
     no computador, bloqueio de CDN). Mostra os pontos uns em relação aos outros. */
  function mapaSimples(pts) {
    var el = $('#mapa');
    if (!pts.length) {
      el.innerHTML = '<div style="padding:20px;color:var(--fraco);font-size:13px">' +
        'Nenhuma visita com GPS ainda.</div>';
      return;
    }
    var minX = 180, maxX = -180, minY = 90, maxY = -90;
    pts.forEach(function (p) {
      minX = Math.min(minX, p.lon); maxX = Math.max(maxX, p.lon);
      minY = Math.min(minY, p.lat); maxY = Math.max(maxY, p.lat);
    });
    var dx = (maxX - minX) || 0.05, dy = (maxY - minY) || 0.05;
    minX -= dx * 0.15; maxX += dx * 0.15; minY -= dy * 0.15; maxY += dy * 0.15;
    var W = 900, H = 380;
    var px = function (l) { return (l - minX) / (maxX - minX) * W; };
    var py = function (l) { return H - (l - minY) / (maxY - minY) * H; };
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:100%;display:block;background:#EEF3EE">';
    pts.forEach(function (p) {
      var cor = p.status === 'publicado' ? '#1B7A43' : '#F0A202';
      s += '<circle cx="' + px(p.lon).toFixed(1) + '" cy="' + py(p.lat).toFixed(1) + '" r="9" fill="' + cor +
        '" stroke="#fff" stroke-width="3"><title>' + esc(p.fazenda || '') + ' · ' + dataBR(p.data) + '</title></circle>' +
        '<text x="' + px(p.lon).toFixed(1) + '" y="' + (py(p.lat) - 14).toFixed(1) +
        '" font-size="13" text-anchor="middle" fill="#146034" font-family="sans-serif">' +
        esc(p.fazenda || '') + '</text>';
    });
    s += '</svg>';
    el.innerHTML = s;
    el.insertAdjacentHTML('afterend',
      '<div style="font-size:11.5px;color:var(--fraco);margin-top:6px">' +
      'Mapa de fundo indisponível agora — mostrando só a posição relativa das visitas.</div>');
  }

  function desenharMapa() {
    var pts = dados.pontos.filter(function (p) { return p.lat != null && p.lon != null; });
    if (typeof L === 'undefined') { mapaSimples(pts); return; }
    if (!mapa) {
      mapa = L.map('mapa');
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '© OpenStreetMap'
      }).addTo(mapa);
      mapa.setView([-15.2, -59.3], 7);
    }
    if (camada) mapa.removeLayer(camada);
    if (!pts.length) return;
    camada = L.layerGroup(pts.map(function (p) {
      var cor = p.status === 'publicado' ? '#1B7A43' : '#F0A202';
      return L.circleMarker([p.lat, p.lon], {
        radius: 8, color: '#fff', weight: 2, fillColor: cor, fillOpacity: .9
      }).bindPopup(
        '<b>' + esc(p.fazenda || '—') + '</b><br>' + esc(p.produtor || '') +
        '<br>' + dataBR(p.data) + ' · ' + p.n + ' registro(s)' +
        '<br><span style="color:#6B7B72;font-size:11px">' + esc(p.conta || '') + '</span>' +
        (p.status === 'publicado' ? '<br><a href="/r/' + esc(p.id) + '?sc=1" target="_blank">abrir relatório</a>' : '')
      );
    })).addTo(mapa);
    mapa.fitBounds(L.latLngBounds(pts.map(function (p) { return [p.lat, p.lon]; })).pad(0.25));
  }

  /* ---------- criar conta ---------- */
  $('#btnCriar').onclick = async function () {
    var msg = $('#nMsg');
    aviso(msg, 'Criando…');
    try {
      await api('/api/admin/usuario', {
        nome: $('#nNome').value.trim(),
        email: $('#nEmail').value.trim(),
        senha: $('#nSenha').value,
        admin: $('#nAdmin').value === '1',
        prazo_dias: $('#nPrazo').value
      });
      $('#nNome').value = ''; $('#nEmail').value = ''; $('#nSenha').value = ''; $('#nPrazo').value = '365';
      aviso(msg, 'Conta criada.');
      await abrirPainel();
      document.querySelector('.abas button[data-aba="contas"]').click();
    } catch (e) { aviso(msg, e.message, true); }
  };

  if (token) abrirPainel();
})();
</script>
</body></html>`;
}
