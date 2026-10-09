/* ============================================================
   Relatório VSL — Worker
   API (login, cadastro, relatórios) + página pública do relatório
   ============================================================ */
import { conferirSenha, criarToken, hashSenha, novoId, usuarioDaRequisicao } from './auth.js';
import { cfgSet, pastaRaiz, trocarCodigo, urlAutorizacao } from './google.js';
import { espaco, ler as lerMidia, salvar as salvarMidia } from './midia.js';
import { juntarRelatorios, paginaRelatorio, paginaSimples } from './pagina.js';
import { registrarAcesso } from './acessos.js';
import { areasAdmin, criarConta, definirPrazo, ehAdmin, paginaAdmin, promover, resumoAdmin, trocarSenha } from './admin.js';

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

const json = (dados, status = 200) => new Response(JSON.stringify(dados), {
  status, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, CORS)
});
const html = (txt, status = 200) => new Response(txt, {
  status, headers: { 'Content-Type': 'text/html; charset=utf-8' }
});

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const rota = url.pathname;
    const origem = url.origin;

    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

    try {
      /* ================= público ================= */

      if (rota === '/api/status') {
        const e = await espaco(env).catch(function () { return {}; });
        return json({ ok: true, midia: e.modo || null, usado: e.usado || 0, limite: e.limite || 0 });
      }

      if (rota.startsWith('/img/')) {
        const chave = decodeURIComponent(rota.slice(5));
        const cache = caches.default;
        const chaveCache = new Request(origem + '/img/' + encodeURIComponent(chave));
        const guardado = await cache.match(chaveCache);
        if (guardado) return guardado;

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
        return resp;
      }

      // a página do painel é aberta; quem valida é o /api/admin/* com o token
      if (rota === '/admin' || rota === '/admin/') {
        return html(paginaAdmin(env.EMPRESA || 'Relatório de Campo VSL'));
      }

      if (rota.startsWith('/r/')) {
        let bruto = rota.slice(3).replace(/\/$/, '');
        try { bruto = decodeURIComponent(bruto); } catch (e) {}
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
          let perfilJ = null;
          if (rels[0].usuario_id) {
            perfilJ = await env.DB.prepare('SELECT empresa,cidade,logo FROM perfis WHERE usuario_id = ?')
              .bind(rels[0].usuario_id).first();
          }
          if (req.method === 'GET' && url.searchParams.get('sc') !== '1') {
            ids.forEach((i) => ctx.waitUntil(registrarAcesso(env, req, i)));
          }
          return html(paginaRelatorio(juntarRelatorios(rels), todos || [], env, origem, perfilJ));
        }

        const id = ids[0] || '';
        const rel = await env.DB.prepare('SELECT * FROM relatorios WHERE id = ? AND status = ?')
          .bind(id, 'publicado').first();
        if (!rel) return html(paginaSimples('Relatório não disponível',
          'Este link não existe ou o relatório ainda não foi finalizado pelo técnico.'), 404);
        const { results } = await env.DB.prepare(
          'SELECT * FROM itens WHERE relatorio_id = ? ORDER BY capturado_em ASC').bind(id).all();
        let perfil = null;
        if (rel.usuario_id) {
          perfil = await env.DB.prepare('SELECT empresa,cidade,logo FROM perfis WHERE usuario_id = ?')
            .bind(rel.usuario_id).first();
        }
        // conta a visualização (o admin abre com ?sc=1 para não se contar)
        if (req.method === 'GET' && url.searchParams.get('sc') !== '1') ctx.waitUntil(registrarAcesso(env, req, id));
        return html(paginaRelatorio(rel, results || [], env, origem, perfil));
      }

      /* ================= conta ================= */

      // cadastro aberto desligado: conta nova só pelo painel do administrador.
      // (a primeira conta do sistema ainda pode ser criada aqui, para não travar quem começa do zero)
      if (rota === '/api/registrar' && req.method === 'POST') {
        const quantos = await env.DB.prepare('SELECT COUNT(*) AS n FROM usuarios').first();
        if (Number(quantos && quantos.n || 0) > 0) {
          return json({ erro: 'as contas são criadas pelo administrador. Fale com o responsável pela VSL.' }, 403);
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
      }

      if (rota === '/api/eu') return json({ ok: true, id: me.id, nome: me.nome, email: me.email });

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
        if (rota === '/api/admin/prazo' && req.method === 'POST') {
          const b = await req.json();
          try { return json(await definirPrazo(env, b.id, b.dias)); }
          catch (e) { return json({ erro: e.message }, 400); }
        }
        if (rota === '/api/admin/senha' && req.method === 'POST') {
          const b = await req.json();
          try { return json(await trocarSenha(env, b.id, b.senha)); }
          catch (e) { return json({ erro: e.message }, 400); }
        }
        return json({ erro: 'rota não encontrada' }, 404);
      }

      /* ---------- identidade da empresa ---------- */

      if (rota === '/api/perfil' && req.method === 'GET') {
        const r = await env.DB.prepare('SELECT empresa,cidade,logo FROM perfis WHERE usuario_id = ?').bind(me.id).first();
        return json({ ok: true, perfil: r || { empresa: '', cidade: '', logo: '' } });
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
        return json({
          ok: true,
          produtores: prod.results || [],
          fazendas: faz.results || [],
          safras: saf.results || [],
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
        const nome = String(b.nome || '').trim();
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
                r.produtor || '', r.fazenda || '', r.safra || '', r.servico || '', r.responsavel || '',
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
      return html(paginaSimples('Relatório VSL', 'Servidor no ar. O app fica em outro endereço.'));

    } catch (e) {
      if (rota.startsWith('/api/')) return json({ erro: e.message }, 500);
      return html(paginaSimples('Erro', e.message), 500);
    }
  }
};
