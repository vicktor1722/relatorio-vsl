/* ============================================================
   Relatório VSL — Worker
   API (login, cadastro, relatórios) + página pública do relatório
   ============================================================ */
import { conferirSenha, criarToken, hashSenha, novoId, usuarioDaRequisicao } from './auth.js';
import { cfgSet, pastaRaiz, trocarCodigo, urlAutorizacao } from './google.js';
import { espaco, ler as lerMidia, salvar as salvarMidia } from './midia.js';
import { juntarRelatorios, paginaRelatorio, paginaSimples } from './pagina.js';
import { traduzirRelatorio } from './traducao.js';
import { registrarAcesso } from './acessos.js';
import { padronizarSafras, safraAtual, safraPadrao, safrasProntas } from './safras.js';
import { dadosParaRelatorio, modulosAdmin, rotasAgro, salvarModulos } from './agro.js';
import { areasAdmin, cancelarCobranca, criarCobranca, criarConta, definirPrazo, ehAdmin, excluirConta, listarPagamentos, pagamentoManual, paginaAdmin, promover, resumoAdmin, salvarAssinatura, salvarConfigPagto, trocarSenha, webhookPicPay } from './admin.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Item-Id,X-Rel-Id'
};

// cada conta pode cadastrar até 4 responsáveis (nomes que aparecem para escolher no relatório); a conta administradora, até 6
const MAX_RESPONSAVEIS = 4;
const MAX_RESPONSAVEIS_ADMIN = 6;
let respPronta = null;
function garantirResponsaveis(env) {
  if (!respPronta) {
    respPronta = env.DB.prepare(`CREATE TABLE IF NOT EXISTS responsaveis (
      id         TEXT PRIMARY KEY,
      usuario_id TEXT NOT NULL,
      nome       TEXT NOT NULL,
      criado_em  TEXT DEFAULT (datetime('now'))
    )`).run().catch((e) => { respPronta = null; throw e; });
  }
  return respPronta;
}

// telefone e e-mail de contato da empresa (aparecem abaixo do nome no relatório do cliente); tabela criada sozinha
let contatoPronto = null;
function garantirContatos(env) {
  if (!contatoPronto) {
    contatoPronto = env.DB.prepare(`CREATE TABLE IF NOT EXISTS contatos (
      usuario_id TEXT PRIMARY KEY,
      telefone   TEXT DEFAULT '',
      email      TEXT DEFAULT '',
      atualizado_em TEXT DEFAULT (datetime('now'))
    )`).run().catch((e) => { contatoPronto = null; throw e; });
  }
  return contatoPronto;
}
async function lerContato(env, uid) {
  try {
    await garantirContatos(env);
    const r = uid ? await env.DB.prepare('SELECT telefone, email FROM contatos WHERE usuario_id = ?').bind(uid).first() : null;
    return { telefone: (r && r.telefone) || '', email: (r && r.email) || '' };
  } catch (e) { return { telefone: '', email: '' }; }
}

const json = (dados, status = 200) => new Response(JSON.stringify(dados), {
  status, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, CORS)
});
const html = (txt, status = 200) => new Response(txt, {
  status, headers: { 'Content-Type': 'text/html; charset=utf-8' }
});

// devolve a mesma mídia como arquivo para baixar (Content-Disposition: attachment); o nome vem de ?n=
function comoDownload(resp, nome) {
  const mime = (resp.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic',
    'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm' }[mime] || 'bin';
  let base = String(nome || 'midia').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^[._]+|[._]+$/g, '').slice(0, 60) || 'midia';
  if (!new RegExp('\\.' + ext + '$', 'i').test(base)) base += '.' + ext;
  const h = new Headers(resp.headers);
  h.set('Content-Disposition', 'attachment; filename="' + base + '"');
  h.set('Cache-Control', 'no-store');
  return new Response(resp.body, { status: resp.status, headers: h });
}

/* capa do app (apple-touch-icon): desenhada aqui mesmo, sem arquivo de imagem */
function desenharIcone(tipo, S) {
  var adm = tipo === 'adm', c1 = adm ? [58, 90, 120] : [42, 157, 92], c2 = adm ? [28, 47, 66] : [20, 92, 50];
  var K = 512 / S, buf = new Uint8Array(S * S * 3);
  function caixa(x, y, x0, y0, w, h, r) {
    var cx = Math.min(Math.max(x, x0 + r), x0 + w - r), cy = Math.min(Math.max(y, y0 + r), y0 + h - r);
    return (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r;
  }
  function elipse(x, y, cx, cy, a, b, ang) {
    var dx = x - cx, dy = y - cy, co = Math.cos(ang), si = Math.sin(ang), u = dx * co + dy * si, v = -dx * si + dy * co;
    return (u * u) / (a * a) + (v * v) / (b * b) <= 1;
  }
  function cor(x, y) {
    var t = (x + y) / 1024, c = [c1[0] + (c2[0] - c1[0]) * t, c1[1] + (c2[1] - c1[1]) * t, c1[2] + (c2[2] - c1[2]) * t];
    var escuro = adm ? [28, 47, 66] : [20, 85, 46];
    if (caixa(x, y, 122, 92, 254, 340, 28) && x - y <= 208) {
      c = [255, 255, 255];
      if (x >= 300 && y <= 168) c = [207, 227, 214];
      if (caixa(x, y, 164, 196, 150, 16, 8)) c = escuro;
      if (caixa(x, y, 164, 236, 184, 12, 6) || caixa(x, y, 164, 268, 184, 12, 6) || caixa(x, y, 164, 300, 120, 12, 6)) c = [201, 216, 206];
    }
    var dx = x - 358, dy = y - 372;
    if (dx * dx + dy * dy <= 92 * 92) {
      c = [245, 181, 10];
      if (adm) {
        var r = Math.sqrt(dx * dx + dy * dy), a = Math.atan2(dy, dx), p = Math.PI / 4, d = Math.abs(((a % p) + p) % p - p / 2);
        if ((r <= 44 && r >= 18) || (r > 44 && r <= 62 && d > p / 2 - 0.2)) c = escuro;
      } else if (caixa(x, y, 352, 348, 12, 80, 6) || elipse(x, y, 329, 337, 38, 16, 0.64) || elipse(x, y, 389, 322, 40, 17, -0.66)) c = escuro;
    }
    return c;
  }
  var N = 3;
  for (var j = 0; j < S; j++) for (var i = 0; i < S; i++) {
    var R = 0, G = 0, B = 0;
    for (var m = 0; m < N; m++) for (var n = 0; n < N; n++) {
      var c = cor((i + (n + 0.5) / N) * K, (j + (m + 0.5) / N) * K); R += c[0]; G += c[1]; B += c[2];
    }
    var o = (j * S + i) * 3; buf[o] = R / (N * N); buf[o + 1] = G / (N * N); buf[o + 2] = B / (N * N);
  }
  return buf;
}
async function pngIcone(tipo) {
  var S = 180, raw = desenharIcone(tipo, S), lin = new Uint8Array((S * 3 + 1) * S);
  for (var y = 0; y < S; y++) lin.set(raw.subarray(y * S * 3, (y + 1) * S * 3), y * (S * 3 + 1) + 1);
  var cs = new Response(new Blob([lin]).stream().pipeThrough(new CompressionStream('deflate')));
  var z = new Uint8Array(await cs.arrayBuffer());
  var tab = []; for (var n = 0; n < 256; n++) { var k = n; for (var b = 0; b < 8; b++) k = k & 1 ? 0xEDB88320 ^ (k >>> 1) : k >>> 1; tab[n] = k >>> 0; }
  function crc(u) { var k = 0xFFFFFFFF; for (var i = 0; i < u.length; i++) k = tab[(k ^ u[i]) & 255] ^ (k >>> 8); return (k ^ 0xFFFFFFFF) >>> 0; }
  function bloco(tp, dados) {
    var o = new Uint8Array(12 + dados.length), v = new DataView(o.buffer);
    v.setUint32(0, dados.length); for (var i = 0; i < 4; i++) o[4 + i] = tp.charCodeAt(i);
    o.set(dados, 8); v.setUint32(8 + dados.length, crc(o.subarray(4, 8 + dados.length))); return o;
  }
  var ih = new Uint8Array(13), vh = new DataView(ih.buffer); vh.setUint32(0, S); vh.setUint32(4, S); ih[8] = 8; ih[9] = 2;
  var partes = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), bloco('IHDR', ih), bloco('IDAT', z), bloco('IEND', new Uint8Array(0))];
  var tot = 0; partes.forEach(function (p) { tot += p.length; });
  var out = new Uint8Array(tot), pos = 0; partes.forEach(function (p) { out.set(p, pos); pos += p.length; });
  return new Response(out, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' } });
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const rota = url.pathname;
    const origem = url.origin;

    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

    try {
      /* ================= público ================= */

      // site institucional: www.amvs.ia.br mostra o site; amvs.ia.br e o app
      if (url.hostname.startsWith('www.')) {
        const mapaSite = { '/': '/amvs/', '/planos': '/amvs/planos', '/contato': '/amvs/contato' };
        if (mapaSite[rota] && env.ASSETS) {
          const u2 = new URL(req.url); u2.pathname = mapaSite[rota];
          return env.ASSETS.fetch(new Request(u2.toString(), req));
        }
      } else if (rota === '/amvs' || rota.startsWith('/amvs/')) {
        return Response.redirect('https://www.' + url.hostname + '/', 302);
      }

      // capa do app na tela inicial do iPhone (apple-touch-icon)
      if (rota === '/api/icone/app.png') return pngIcone('app');
      if (rota === '/api/icone/adm.png') return pngIcone('adm');

      // aviso de pagamento da PicPay (a chave vai no cabeçalho authorization; sem login de usuário)
      if (rota === '/api/pagamentos/picpay' && req.method === 'POST') {
        const w = await webhookPicPay(env, req);
        return json(w.corpo, w.status);
      }

      // limpeza do app no aparelho: apaga o cache antigo e recarrega a versão nova (não mexe nos relatórios guardados)
      if (rota === '/api/limpar') {
        const pagina = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Atualizando</title>' +
          '<style>body{font-family:-apple-system,sans-serif;background:#f3f6f4;color:#14532d;text-align:center;padding:64px 24px}</style></head><body>' +
          '<h2>Atualizando o app…</h2><p id="m">Limpando a versão antiga.</p><script>' +
          '(async function(){try{var r=await navigator.serviceWorker.getRegistrations();for(var i=0;i<r.length;i++)await r[i].unregister();}catch(e){}' +
          'try{var k=await caches.keys();for(var j=0;j<k.length;j++)await caches.delete(k[j]);}catch(e){}' +
          'document.getElementById("m").textContent="Pronto! Abrindo a versão nova…";setTimeout(function(){location.replace("/?v="+Date.now());},700);})();' +
          '</script></body></html>';
        return new Response(pagina, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
      }

      if (rota === '/api/status') {
        const e = await espaco(env).catch(function () { return {}; });
        return json({ ok: true, midia: e.modo || null, usado: e.usado || 0, limite: e.limite || 0 });
      }

      if (rota.startsWith('/img/')) {
        const chave = decodeURIComponent(rota.slice(5));
        const cache = caches.default;
        const chaveCache = new Request(origem + '/img/' + encodeURIComponent(chave));
        const baixar = url.searchParams.get('baixar') === '1';
        const guardado = await cache.match(chaveCache);
        if (guardado) return baixar ? comoDownload(guardado, url.searchParams.get('n')) : guardado;

        const m = await lerMidia(env, chave);
        if (!m) return new Response('não encontrado', { status: 404 });
        const resp = new Response(m.corpo, {
          headers: {
            'Content-Type': m.mime,
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Access-Control-Allow-Origin': '*'
          }
        });
        ctx.waitUntil(cache.put(chaveCache, resp.clone()));
        return baixar ? comoDownload(resp, url.searchParams.get('n')) : resp;
      }

      // a página do painel é aberta; quem valida é o /api/admin/* com o token
      if (rota === '/admin' || rota === '/admin/') {
        return html(paginaAdmin('AMVS'));
      }

      if (rota.startsWith('/r/')) {
        await padronizarSafras(env);   // relatório aberto antes de alguém usar o app já sai com a safra no padrão
        let bruto = rota.slice(3).replace(/\/$/, '');
        try { bruto = decodeURIComponent(bruto); } catch (e) {}
        // /r/<id>/traduzir?lang=en devolve as legendas e textos do relatório traduzidos (pt → en/es)
        const querTraduzir = /\/traduzir$/.test(bruto);
        if (querTraduzir) bruto = bruto.replace(/\/traduzir$/, '');
        const ids = [...new Set(bruto.split(/[+,\s]+/).filter(Boolean))].slice(0, 20);

        // link único com várias visitas: /r/<id1>+<id2>+...
        if (ids.length > 1) {
          const marcas = ids.map(() => '?').join(',');
          const { results: rels } = await env.DB.prepare(
            `SELECT * FROM relatorios WHERE status = 'publicado' AND id IN (${marcas})`).bind(...ids).all();
          const donos = new Set((rels || []).map((r) => r.usuario_id || ''));
          if (!rels || rels.length !== ids.length || donos.size !== 1) {
            return html(paginaSimples('Relatório não disponível',
              'Este link não existe ou alguma das visitas ainda não foi finalizada pelo técnico.'), 404);
          }
          const { results: todos } = await env.DB.prepare(
            `SELECT * FROM itens WHERE relatorio_id IN (${marcas}) ORDER BY capturado_em ASC`).bind(...ids).all();
          if (querTraduzir) {
            return json(await traduzirRelatorio(env, [juntarRelatorios(rels), ...rels], todos || [], url.searchParams.get('lang')));
          }
          let perfilJ = null;
          if (rels[0].usuario_id) {
            perfilJ = await env.DB.prepare('SELECT empresa,cidade,logo FROM perfis WHERE usuario_id = ?')
              .bind(rels[0].usuario_id).first();
          }
          perfilJ = Object.assign({}, perfilJ || {}, await lerContato(env, rels[0].usuario_id));
          if (req.method === 'GET' && url.searchParams.get('sc') !== '1') {
            ids.forEach((i) => ctx.waitUntil(registrarAcesso(env, req, i)));
          }
          const agroJ = await dadosParaRelatorio(env, rels[0]);
          return html(paginaRelatorio(juntarRelatorios(rels), todos || [], env, origem, perfilJ, agroJ));
        }

        const id = ids[0] || '';
        const rel = await env.DB.prepare('SELECT * FROM relatorios WHERE id = ? AND status = ?')
          .bind(id, 'publicado').first();
        if (!rel) return html(paginaSimples('Relatório não disponível',
          'Este link não existe ou o relatório ainda não foi finalizado pelo técnico.'), 404);
        const { results } = await env.DB.prepare(
          'SELECT * FROM itens WHERE relatorio_id = ? ORDER BY capturado_em ASC').bind(id).all();
        if (querTraduzir) return json(await traduzirRelatorio(env, [rel], results || [], url.searchParams.get('lang')));
        let perfil = null;
        if (rel.usuario_id) {
          perfil = await env.DB.prepare('SELECT empresa,cidade,logo FROM perfis WHERE usuario_id = ?')
            .bind(rel.usuario_id).first();
        }
        perfil = Object.assign({}, perfil || {}, await lerContato(env, rel.usuario_id));
        // conta a visualização (o admin abre com ?sc=1 para não se contar)
        if (req.method === 'GET' && url.searchParams.get('sc') !== '1') ctx.waitUntil(registrarAcesso(env, req, id));
        const agro = await dadosParaRelatorio(env, rel);
        return html(paginaRelatorio(rel, results || [], env, origem, perfil, agro));
      }

      /* ================= conta ================= */

      // cadastro aberto desligado: conta nova só pelo painel do administrador.
      // (a primeira conta do sistema ainda pode ser criada aqui, para não travar quem começa do zero)
      if (rota === '/api/registrar' && req.method === 'POST') {
        const quantos = await env.DB.prepare('SELECT COUNT(*) AS n FROM usuarios').first();
        if (Number(quantos && quantos.n || 0) > 0) {
          return json({ erro: 'as contas são criadas pelo administrador. Fale com o responsável pela AMVS.' }, 403);
        }
        const b = await req.json();
        const email = String(b.email || '').trim().toLowerCase();
        const senha = String(b.senha || '');
        if (!email.includes('@') || senha.length < 6) {
          return json({ erro: 'informe um e-mail válido e senha de pelo menos 6 caracteres' }, 400);
        }
        if (env.CONVITE && b.convite !== env.CONVITE) {
          return json({ erro: 'código de convite inválido' }, 403);
        }
        const existe = await env.DB.prepare('SELECT id FROM usuarios WHERE email = ?').bind(email).first();
        if (existe) return json({ erro: 'já existe uma conta com esse e-mail' }, 409);

        // a primeira conta do sistema já nasce administradora
        const u = { id: novoId('u'), email: email, nome: String(b.nome || '').trim() };
        await env.DB.prepare('INSERT INTO usuarios (id,email,senha_hash,nome,admin) VALUES (?,?,?,?,1)')
          .bind(u.id, u.email, await hashSenha(senha), u.nome).run();
        return json({ ok: true, token: await criarToken(env, u), nome: u.nome, email: u.email });
      }

      if (rota === '/api/entrar' && req.method === 'POST') {
        const b = await req.json();
        const email = String(b.email || '').trim().toLowerCase();
        const u = await env.DB.prepare('SELECT * FROM usuarios WHERE email = ?').bind(email).first();
        if (!u || !(await conferirSenha(String(b.senha || ''), u.senha_hash))) {
          return json({ erro: 'e-mail ou senha incorretos' }, 401);
        }
        return json({ ok: true, token: await criarToken(env, u), nome: u.nome, email: u.email });
      }

      /* ================= daqui para baixo, só logado ================= */

      const me = await usuarioDaRequisicao(req, env);
      if (rota.startsWith('/api/')) {
        if (!me) return json({ erro: 'sessão expirada, entre de novo' }, 401);
        await padronizarSafras(env);   // dados antigos "2026/27" → "2026/2027" (uma vez por instância)
      }

      if (rota === '/api/eu') return json({ ok: true, id: me.id, nome: me.nome, email: me.email });

      // plantio dos talhões e recomendações (módulos novos; liberados por conta)
      if (rota === '/api/modulos' || rota.startsWith('/api/agro/')) return await rotasAgro(env, req, me, rota, url);

      /* ---------- administração ---------- */
      if (rota.startsWith('/api/admin/')) {
        const adm = await ehAdmin(env, me);
        // qualquer conta vê o próprio painel; admin vê o de todos
        if (rota === '/api/admin/resumo') return json(await resumoAdmin(env, me, adm));
        if (rota === '/api/admin/areas') return json(await areasAdmin(env, me, adm));
        if (!adm) return json({ erro: 'esta conta não tem acesso de administrador' }, 403);
        if (rota === '/api/admin/usuario' && req.method === 'POST') {
          try { return json(await criarConta(env, await req.json())); }
          catch (e) { return json({ erro: e.message }, 400); }
        }
        if (rota === '/api/admin/promover' && req.method === 'POST') {
          const b = await req.json();
          if (b.id === me.id && !b.admin) return json({ erro: 'não dá para tirar o seu próprio acesso' }, 400);
          return json(await promover(env, b.id, b.admin));
        }
        if (rota === '/api/admin/excluir' && req.method === 'POST') {
          const b = await req.json();
          try { return json(await excluirConta(env, me, b.id, b.email)); }
          catch (e) { return json({ erro: e.message }, 400); }
        }
        if (rota === '/api/admin/prazo' && req.method === 'POST') {
          const b = await req.json();
          try { return json(await definirPrazo(env, b.id, b.dias)); }
          catch (e) { return json({ erro: e.message }, 400); }
        }
        if (rota === '/api/admin/assinatura' && req.method === 'POST') {
          try { return json(await salvarAssinatura(env, await req.json())); }
          catch (e) { return json({ erro: e.message }, 400); }
        }
        if (rota === '/api/admin/pagamentos' && req.method === 'GET') return json(await listarPagamentos(env, origem));
        if (rota === '/api/admin/pagamentos/config' && req.method === 'POST') {
          try { return json(await salvarConfigPagto(env, await req.json())); }
          catch (e) { return json({ erro: e.message }, 400); }
        }
        if (rota === '/api/admin/cobranca' && req.method === 'POST') {
          try { return json(await criarCobranca(env, origem, await req.json())); }
          catch (e) { return json({ erro: e.message }, 400); }
        }
        if (rota === '/api/admin/cobranca/cancelar' && req.method === 'POST') {
          const b = await req.json();
          try { return json(await cancelarCobranca(env, b.id)); }
          catch (e) { return json({ erro: e.message }, 400); }
        }
        if (rota === '/api/admin/pagamento-manual' && req.method === 'POST') {
          try { return json(await pagamentoManual(env, await req.json())); }
          catch (e) { return json({ erro: e.message }, 400); }
        }
        if (rota === '/api/admin/senha' && req.method === 'POST') {
          const b = await req.json();
          try { return json(await trocarSenha(env, b.id, b.senha)); }
          catch (e) { return json({ erro: e.message }, 400); }
        }
        if (rota === '/api/admin/modulos') {
          if (req.method === 'POST') return json(await salvarModulos(env, await req.json()));
          return json(await modulosAdmin(env));
        }
        return json({ erro: 'rota não encontrada' }, 404);
      }

      /* ---------- identidade da empresa ---------- */

      if (rota === '/api/perfil' && req.method === 'GET') {
        const r = await env.DB.prepare('SELECT empresa,cidade,logo FROM perfis WHERE usuario_id = ?').bind(me.id).first();
        return json({ ok: true, perfil: Object.assign({ empresa: '', cidade: '', logo: '' }, r || {}, await lerContato(env, me.id)) });
      }

      if (rota === '/api/perfil' && req.method === 'POST') {
        const b = await req.json();
        const logo = typeof b.logo === 'string' ? b.logo : '';
        if (logo && logo.length > 400000) return json({ erro: 'imagem muito grande (máx. ~300 KB)' }, 400);
        await env.DB.prepare(`
          INSERT INTO perfis (usuario_id, empresa, cidade, logo, atualizado_em)
          VALUES (?,?,?,?,datetime('now'))
          ON CONFLICT(usuario_id) DO UPDATE SET
            empresa=excluded.empresa, cidade=excluded.cidade, logo=excluded.logo,
            atualizado_em=datetime('now')
        `).bind(me.id, String(b.empresa || ''), String(b.cidade || ''), logo).run();
        if (b.telefone !== undefined || b.email !== undefined) {
          try {
            await garantirContatos(env);
            await env.DB.prepare(`
              INSERT INTO contatos (usuario_id, telefone, email, atualizado_em) VALUES (?,?,?,datetime('now'))
              ON CONFLICT(usuario_id) DO UPDATE SET telefone=excluded.telefone, email=excluded.email, atualizado_em=datetime('now')
            `).bind(me.id, String(b.telefone || '').trim().slice(0, 40), String(b.email || '').trim().slice(0, 120)).run();
          } catch (e) { /* o resto do perfil já foi salvo */ }
        }
        return json({ ok: true });
      }

      /* ---------- cadastro ---------- */

      if (rota === '/api/cadastro' && req.method === 'GET') {
        const prod = await env.DB.prepare(
          'SELECT * FROM produtores WHERE usuario_id = ? ORDER BY nome').bind(me.id).all();
        const faz = await env.DB.prepare(
          'SELECT * FROM fazendas WHERE usuario_id = ? ORDER BY nome').bind(me.id).all();
        const saf = await env.DB.prepare(
          'SELECT * FROM safras WHERE usuario_id = ? ORDER BY nome DESC').bind(me.id).all();
        let resp = { results: [] };
        try {
          await garantirResponsaveis(env);
          resp = await env.DB.prepare('SELECT * FROM responsaveis WHERE usuario_id = ? ORDER BY criado_em, nome').bind(me.id).all();
        } catch (e) { /* sem responsáveis por enquanto */ }
        const limiteResp = (await ehAdmin(env, me)) ? MAX_RESPONSAVEIS_ADMIN : MAX_RESPONSAVEIS;
        // safras: a lista pronta para escolher + alguma outra que a conta já tinha cadastrado
        const nomesSaf = safrasProntas();
        const extras = (saf.results || []).filter((s) => nomesSaf.indexOf(s.nome) < 0);
        return json({
          ok: true,
          produtores: prod.results || [],
          fazendas: faz.results || [],
          safras: nomesSaf.map((n) => ({ id: 'pronta:' + n, nome: n, pronta: true })).concat(extras),
          safra_atual: safraAtual(),
          responsaveis: resp.results || [],
          max_responsaveis: limiteResp
        });
      }

      if (rota === '/api/responsavel' && req.method === 'POST') {
        const b = await req.json();
        const nome = String(b.nome || '').trim().replace(/\s+/g, ' ').slice(0, 60);
        if (!nome) return json({ erro: 'informe o nome do responsável' }, 400);
        await garantirResponsaveis(env);
        const { results } = await env.DB.prepare('SELECT id, nome FROM responsaveis WHERE usuario_id = ?').bind(me.id).all();
        const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
        const ja = (results || []).find((x) => norm(x.nome) === norm(nome));
        if (ja) return json({ ok: true, id: ja.id, repetido: true });
        const id = novoId('o');
        const limiteResp = (await ehAdmin(env, me)) ? MAX_RESPONSAVEIS_ADMIN : MAX_RESPONSAVEIS;
        // o limite é conferido dentro do próprio INSERT, então dois aparelhos ao mesmo tempo não passam do limite
        const r = await env.DB.prepare(`INSERT INTO responsaveis (id, usuario_id, nome)
          SELECT ?, ?, ? WHERE (SELECT COUNT(*) FROM responsaveis WHERE usuario_id = ?) < ?`)
          .bind(id, me.id, nome, me.id, limiteResp).run();
        if (!r.meta || !r.meta.changes) {
          return json({ erro: 'limite de ' + limiteResp + ' responsáveis por conta. Remova um para cadastrar outro.' }, 400);
        }
        return json({ ok: true, id: id });
      }

      if (rota === '/api/safra' && req.method === 'POST') {
        const b = await req.json();
        const nome = safraPadrao(b.nome);
        if (!nome) return json({ erro: 'informe o nome da safra' }, 400);
        const ja = await env.DB.prepare('SELECT id FROM safras WHERE usuario_id = ? AND nome = ?')
          .bind(me.id, nome).first();
        if (ja) return json({ ok: true, id: ja.id, repetido: true });
        const id = b.id || novoId('s');
        await env.DB.prepare('INSERT INTO safras (id,usuario_id,nome) VALUES (?,?,?)')
          .bind(id, me.id, nome).run();
        return json({ ok: true, id: id });
      }

      if (rota === '/api/produtor' && req.method === 'POST') {
        const p = await req.json();
        // sem id = cadastro novo: se a conta já tem um produtor com esse nome, devolve o existente
        if (!p.id) {
          // (comparação em JS: o lower() do SQLite não entende acentos, ex.: JOÃO x João)
          const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
          const { results: todos } = await env.DB.prepare('SELECT id, nome FROM produtores WHERE usuario_id = ?').bind(me.id).all();
          const ja = (todos || []).find((x) => norm(x.nome) === norm(p.nome));
          if (ja) return json({ ok: true, id: ja.id, repetido: true });
        }
        const id = p.id || novoId('p');
        await env.DB.prepare(`
          INSERT INTO produtores (id,usuario_id,nome,documento,telefone,observacoes,atualizado_em)
          VALUES (?,?,?,?,?,?,datetime('now'))
          ON CONFLICT(id) DO UPDATE SET
            nome=excluded.nome, documento=excluded.documento, telefone=excluded.telefone,
            observacoes=excluded.observacoes, atualizado_em=datetime('now')
          WHERE produtores.usuario_id = excluded.usuario_id
        `).bind(id, me.id, String(p.nome || '').trim(), p.documento || '', p.telefone || '', p.observacoes || '').run();
        return json({ ok: true, id: id });
      }

      if (rota === '/api/fazenda' && req.method === 'POST') {
        const f = await req.json();
        // sem id = cadastro novo: mesma fazenda (nome + produtor) já cadastrada? devolve a existente
        if (!f.id) {
          const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
          const { results: todas } = await env.DB.prepare('SELECT id, nome, produtor_id, talhoes FROM fazendas WHERE usuario_id = ?').bind(me.id).all();
          const ja = (todas || []).find((x) => norm(x.nome) === norm(f.nome) && (x.produtor_id || '') === (f.produtor_id || ''));
          if (ja) {
            // se a existente está sem talhões e esta veio com KML, aproveita o KML
            const novo = f.talhoes ? (typeof f.talhoes === 'string' ? f.talhoes : JSON.stringify(f.talhoes)) : '';
            if (novo && !ja.talhoes) {
              let n2 = 0, a2 = 0;
              try { const o2 = JSON.parse(novo); n2 = (o2.features || []).length;
                a2 = (o2.features || []).reduce((s, x) => s + ((x.properties && x.properties.area_ha) || 0), 0); } catch (e) {}
              await env.DB.prepare("UPDATE fazendas SET talhoes = ?, n_talhoes = ?, area_ha = ?, atualizado_em = datetime('now') WHERE id = ? AND usuario_id = ?")
                .bind(novo, n2, a2, ja.id, me.id).run();
            }
            return json({ ok: true, id: ja.id, repetido: true });
          }
        }
        const id = f.id || novoId('f');
        const gj = f.talhoes ? (typeof f.talhoes === 'string' ? f.talhoes : JSON.stringify(f.talhoes)) : '';
        let n = 0, area = 0;
        try {
          const o = gj ? JSON.parse(gj) : null;
          if (o && o.features) {
            n = o.features.length;
            area = o.features.reduce((s, x) => s + ((x.properties && x.properties.area_ha) || 0), 0);
          }
        } catch (e) { /* ignora */ }
        await env.DB.prepare(`
          INSERT INTO fazendas (id,usuario_id,produtor_id,nome,municipio,uf,area_ha,talhoes,n_talhoes,atualizado_em)
          VALUES (?,?,?,?,?,?,?,?,?,datetime('now'))
          ON CONFLICT(id) DO UPDATE SET
            produtor_id=excluded.produtor_id, nome=excluded.nome, municipio=excluded.municipio,
            uf=excluded.uf, area_ha=excluded.area_ha, talhoes=excluded.talhoes,
            n_talhoes=excluded.n_talhoes, atualizado_em=datetime('now')
          WHERE fazendas.usuario_id = excluded.usuario_id
        `).bind(id, me.id, f.produtor_id || null, String(f.nome || '').trim(),
                f.municipio || '', f.uf || '', area, gj, n).run();
        return json({ ok: true, id: id, n_talhoes: n, area_ha: area });
      }

      if (rota === '/api/apagar' && req.method === 'POST') {
        const b = await req.json();
        if (b.tipo === 'produtor') {
          await env.DB.prepare('DELETE FROM produtores WHERE id = ? AND usuario_id = ?').bind(b.id, me.id).run();
        } else if (b.tipo === 'fazenda') {
          await env.DB.prepare('DELETE FROM fazendas WHERE id = ? AND usuario_id = ?').bind(b.id, me.id).run();
        } else if (b.tipo === 'responsavel') {
          await garantirResponsaveis(env);
          await env.DB.prepare('DELETE FROM responsaveis WHERE id = ? AND usuario_id = ?').bind(b.id, me.id).run();
        } else if (b.tipo === 'safra') {
          await env.DB.prepare('DELETE FROM safras WHERE id = ? AND usuario_id = ?').bind(b.id, me.id).run();
        } else return json({ erro: 'tipo inválido' }, 400);
        return json({ ok: true });
      }

      /* ---------- relatórios ---------- */

      // tudo o que a conta já mandou para a nuvem — o app usa para recuperar o que sumiu do aparelho
      if (rota === '/api/restaurar' && req.method === 'GET') {
        const rels = await env.DB.prepare('SELECT * FROM relatorios WHERE usuario_id = ? ORDER BY criado_em DESC LIMIT 300')
          .bind(me.id).all();
        const itens = await env.DB.prepare(`
          SELECT i.id, i.relatorio_id, i.tipo, i.legenda, i.midia, i.mime, i.duracao_s, i.bytes, i.lat, i.lon,
                 i.precisao_m, i.altitude_m, i.talhao, i.talhao_id, i.capturado_em, i.ordem
            FROM itens i JOIN relatorios r ON r.id = i.relatorio_id
           WHERE r.usuario_id = ? ORDER BY i.capturado_em LIMIT 5000`).bind(me.id).all();
        return json({ ok: true, relatorios: rels.results || [], itens: itens.results || [] });
      }

      if (rota === '/api/relatorios' && req.method === 'GET') {
        const r = await env.DB.prepare(
          'SELECT id,fazenda,produtor,safra,status,publicado_em,criado_em FROM relatorios WHERE usuario_id = ? ORDER BY criado_em DESC LIMIT 200')
          .bind(me.id).all();
        return json({ ok: true, relatorios: r.results || [] });
      }

      if (rota === '/api/relatorio' && req.method === 'POST') {
        const r = await req.json();
        await env.DB.prepare(`
          INSERT INTO relatorios (id,usuario_id,produtor_id,fazenda_id,produtor,fazenda,safra,servico,responsavel,
                                  data_inicio,data_fim,observacoes,talhoes,status,publicado_em,atualizado_em)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
          ON CONFLICT(id) DO UPDATE SET
            produtor_id=excluded.produtor_id, fazenda_id=excluded.fazenda_id,
            produtor=excluded.produtor, fazenda=excluded.fazenda, safra=excluded.safra,
            servico=excluded.servico, responsavel=excluded.responsavel,
            data_inicio=excluded.data_inicio, data_fim=excluded.data_fim,
            observacoes=excluded.observacoes, talhoes=excluded.talhoes,
            status=excluded.status, publicado_em=excluded.publicado_em, atualizado_em=datetime('now')
          WHERE relatorios.usuario_id = excluded.usuario_id
        `).bind(r.id, me.id, r.produtor_id || null, r.fazenda_id || null,
                r.produtor || '', r.fazenda || '', safraPadrao(r.safra), r.servico || '', r.responsavel || '',
                r.data_inicio || null, r.data_fim || null, r.observacoes || '',
                r.talhoes ? JSON.stringify(r.talhoes) : '', r.status || 'rascunho', r.publicado_em || null).run();
        return json({ ok: true, id: r.id });
      }

      if (rota === '/api/upload' && req.method === 'POST') {
        const itemId = req.headers.get('X-Item-Id');
        const relId = req.headers.get('X-Rel-Id');
        const mime = req.headers.get('Content-Type') || 'application/octet-stream';
        if (!itemId || !relId) return json({ erro: 'faltam X-Item-Id / X-Rel-Id' }, 400);

        const dono = await env.DB.prepare('SELECT usuario_id FROM relatorios WHERE id = ?').bind(relId).first();
        if (dono && dono.usuario_id && dono.usuario_id !== me.id) return json({ erro: 'relatório de outro usuário' }, 403);

        const existente = await env.DB.prepare('SELECT midia FROM itens WHERE id = ?').bind(itemId).first();
        if (existente && existente.midia) return json({ ok: true, midia: existente.midia, repetido: true });

        const dados = await req.arrayBuffer();
        const ext = mime.includes('mp4') ? 'mp4' : mime.includes('webm') ? 'webm' : mime.includes('png') ? 'png' : 'jpg';
        const r = await salvarMidia(env, { chave: relId + '/' + itemId + '.' + ext, mime, dados });
        return json({ ok: true, midia: r.chave, bytes: r.bytes });
      }

      if (rota === '/api/item' && req.method === 'POST') {
        const i = await req.json();
        await env.DB.prepare(`
          INSERT INTO itens (id,relatorio_id,tipo,legenda,midia,mime,duracao_s,bytes,lat,lon,precisao_m,altitude_m,talhao,talhao_id,capturado_em,ordem)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(id) DO UPDATE SET
            legenda=excluded.legenda, midia=COALESCE(excluded.midia, itens.midia),
            talhao=excluded.talhao, talhao_id=excluded.talhao_id
        `).bind(i.id, i.relatorio_id, i.tipo, i.legenda || '', i.midia || null, i.mime || null,
                i.duracao_s || null, i.bytes || null, i.lat ?? null, i.lon ?? null,
                i.precisao_m || null, i.altitude_m || null, i.talhao || null, i.talhao_id || null,
                i.capturado_em, i.ordem || 0).run();
        return json({ ok: true, id: i.id });
      }

      if (rota === '/api/publicar' && req.method === 'POST') {
        const { id } = await req.json();
        const rel = await env.DB.prepare('SELECT usuario_id FROM relatorios WHERE id = ?').bind(id).first();
        if (!rel) return json({ erro: 'relatório não encontrado no servidor' }, 404);
        if (rel.usuario_id && rel.usuario_id !== me.id) return json({ erro: 'relatório de outro usuário' }, 403);
        await env.DB.prepare("UPDATE relatorios SET status='publicado', publicado_em=datetime('now'), atualizado_em=datetime('now') WHERE id = ?")
          .bind(id).run();
        return json({ ok: true, link: origem + '/r/' + id });
      }

      /* ---------- Google Drive (opcional) ---------- */

      if (rota === '/oauth/start') {
        if (url.searchParams.get('key') !== env.ADMIN_KEY) return html(paginaSimples('Acesso negado', 'Chave inválida.'), 403);
        return Response.redirect(urlAutorizacao(env, origem + '/oauth/callback', 'vsl'), 302);
      }
      if (rota === '/oauth/callback') {
        const code = url.searchParams.get('code');
        if (!code) return html(paginaSimples('Autorização cancelada', 'Nenhum código recebido.'), 400);
        const tok = await trocarCodigo(env, code, origem + '/oauth/callback');
        if (!tok.refresh_token) return html(paginaSimples('Falta o refresh token',
          'Remova o acesso do app em myaccount.google.com/permissions e autorize de novo.'), 400);
        await cfgSet(env, 'google_refresh_token', tok.refresh_token);
        await pastaRaiz(env);
        return html(paginaSimples('Conta conectada ✔️', 'Pode fechar esta página.'));
      }

      /* ---------- arquivos do app, quando servidos daqui ---------- */
      if (env.ASSETS) return env.ASSETS.fetch(req);
      return html(paginaSimples('AMVS Relatório', 'Servidor no ar. O app fica em outro endereço.'));

    } catch (e) {
      if (rota.startsWith('/api/')) return json({ erro: e.message }, 500);
      return html(paginaSimples('Erro', e.message), 500);
    }
  }
};
