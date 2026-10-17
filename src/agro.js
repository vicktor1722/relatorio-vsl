/* ============================================================
   agro.js — plantio dos talhões e recomendações (módulos novos)
   Tudo criado sozinho na primeira chamada (sem migração manual).

   Quem enxerga o quê:
     • a conta administradora sempre tem os dois módulos;
     • as outras contas só recebem se (1) a chave geral "liberar para os demais"
       estiver ligada E (2) o administrador marcou o módulo para aquela conta.
   ============================================================ */

import { novoId } from './auth.js';

let pronta = null;

function garantir(env) {
  if (!pronta) {
    pronta = env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS modulos_usuario (
        usuario_id   TEXT PRIMARY KEY,
        plantio      INTEGER DEFAULT 0,
        recomendacoes INTEGER DEFAULT 0,
        atualizado_em TEXT DEFAULT (datetime('now'))
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS plantio (
        fazenda_id   TEXT NOT NULL,
        safra        TEXT NOT NULL DEFAULT '',
        talhao       TEXT NOT NULL,
        usuario_id   TEXT NOT NULL,
        cultura      TEXT DEFAULT '',
        variedade    TEXT DEFAULT '',
        data_plantio TEXT DEFAULT '',
        data_emerg   TEXT DEFAULT '',
        espac_cm     REAL DEFAULT 0,
        sem_m        REAL DEFAULT 0,
        sem_ha       REAL DEFAULT 0,
        atualizado_em TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (fazenda_id, safra, talhao)
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS produtos_agro (
        id          TEXT PRIMARY KEY,
        usuario_id  TEXT NOT NULL,
        nome        TEXT NOT NULL,
        tipo        TEXT DEFAULT '',
        ingrediente TEXT DEFAULT '',
        dose        REAL DEFAULT 0,
        unidade     TEXT DEFAULT 'L/ha',
        intervalo_dias INTEGER DEFAULT 0,
        criado_em   TEXT DEFAULT (datetime('now'))
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS recomendacoes (
        id           TEXT PRIMARY KEY,
        usuario_id   TEXT NOT NULL,
        fazenda_id   TEXT NOT NULL,
        safra        TEXT DEFAULT '',
        operacao     TEXT DEFAULT '',
        data_prevista TEXT DEFAULT '',
        mostrar      INTEGER DEFAULT 1,
        dados        TEXT DEFAULT '{}',
        criado_em    TEXT DEFAULT (datetime('now')),
        atualizado_em TEXT DEFAULT (datetime('now'))
      )`),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS recs_faz ON recomendacoes (usuario_id, fazenda_id)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS plantio_usr ON plantio (usuario_id, fazenda_id)')
    ]).catch((e) => { pronta = null; throw e; });
  }
  return pronta;
}

const json = (o, status) => new Response(JSON.stringify(o), {
  status: status || 200,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
});

/* ---------------- permissões ---------------- */

async function ehAdm(env, id) {
  try {
    const u = await env.DB.prepare('SELECT admin FROM usuarios WHERE id = ?').bind(id).first();
    return !!(u && Number(u.admin) === 1);
  } catch (e) { return false; }
}

async function liberadoGeral(env) {
  try {
    const r = await env.DB.prepare("SELECT valor FROM config WHERE chave = 'agro_liberado'").first();
    return !!(r && String(r.valor) === '1');
  } catch (e) { return false; }
}

// o que esta conta pode usar agora
export async function modulosDe(env, usuarioId) {
  await garantir(env);
  if (!usuarioId) return { plantio: false, recomendacoes: false, admin: false };
  if (await ehAdm(env, usuarioId)) return { plantio: true, recomendacoes: true, admin: true };
  if (!(await liberadoGeral(env))) return { plantio: false, recomendacoes: false, admin: false };
  const r = await env.DB.prepare('SELECT plantio, recomendacoes FROM modulos_usuario WHERE usuario_id = ?')
    .bind(usuarioId).first();
  return { plantio: !!(r && r.plantio), recomendacoes: !!(r && r.recomendacoes), admin: false };
}

// painel do administrador: todas as contas com as marcações
export async function modulosAdmin(env) {
  await garantir(env);
  const { results } = await env.DB.prepare(`
    SELECT u.id, u.email, u.nome, u.admin, m.plantio, m.recomendacoes
      FROM usuarios u LEFT JOIN modulos_usuario m ON m.usuario_id = u.id
     ORDER BY u.criado_em`).all();
  return {
    ok: true,
    liberado: await liberadoGeral(env),
    contas: (results || []).map((u) => ({
      id: u.id, email: u.email, nome: u.nome || '', admin: Number(u.admin) === 1,
      plantio: Number(u.admin) === 1 ? true : !!u.plantio,
      recomendacoes: Number(u.admin) === 1 ? true : !!u.recomendacoes
    }))
  };
}

export async function salvarModulos(env, b) {
  await garantir(env);
  if (b && typeof b.liberado === 'boolean') {
    await env.DB.prepare("INSERT INTO config (chave, valor) VALUES ('agro_liberado', ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor")
      .bind(b.liberado ? '1' : '0').run();
  }
  if (b && b.id) {
    await env.DB.prepare(`INSERT INTO modulos_usuario (usuario_id, plantio, recomendacoes, atualizado_em)
        VALUES (?,?,?,datetime('now'))
        ON CONFLICT(usuario_id) DO UPDATE SET plantio = excluded.plantio,
          recomendacoes = excluded.recomendacoes, atualizado_em = datetime('now')`)
      .bind(String(b.id), b.plantio ? 1 : 0, b.recomendacoes ? 1 : 0).run();
  }
  return modulosAdmin(env);
}

/* ---------------- ajudantes ---------------- */

const txt = (v, max) => String(v == null ? '' : v).trim().slice(0, max || 200);
const num = (v) => { const n = Number(String(v == null ? '' : v).replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const dia = (v) => { const s = String(v || '').trim(); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; };

async function fazendaDoUsuario(env, usuarioId, fazendaId) {
  return env.DB.prepare('SELECT id, nome, talhoes FROM fazendas WHERE id = ? AND usuario_id = ?')
    .bind(fazendaId, usuarioId).first();
}

function lerDados(s) {
  try { const o = JSON.parse(s || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; }
}

function linhaRec(r) {
  return {
    id: r.id, fazenda_id: r.fazenda_id, safra: r.safra || '', operacao: r.operacao || '',
    data_prevista: r.data_prevista || '', mostrar: Number(r.mostrar) !== 0,
    dados: lerDados(r.dados), atualizado_em: r.atualizado_em
  };
}

/* ---------------- dados do relatório do cliente ---------------- */

// o que entra no relatório público: só o que o dono do relatório pode usar
export async function dadosParaRelatorio(env, rel) {
  try {
    if (!rel || !rel.usuario_id || !rel.fazenda_id) return null;
    const mod = await modulosDe(env, rel.usuario_id);
    if (!mod.plantio && !mod.recomendacoes) return null;
    const out = { plantio: [], recs: [], mapa: null };
    if (mod.plantio) {
      const { results } = await env.DB.prepare(
        'SELECT * FROM plantio WHERE usuario_id = ? AND fazenda_id = ? AND safra = ?')
        .bind(rel.usuario_id, rel.fazenda_id, rel.safra || '').all();
      out.plantio = results || [];
      const f = await fazendaDoUsuario(env, rel.usuario_id, rel.fazenda_id);
      if (f && f.talhoes) { try { out.mapa = JSON.parse(f.talhoes); } catch (e) { /* sem mapa */ } }
    }
    if (mod.recomendacoes) {
      const { results } = await env.DB.prepare(
        'SELECT * FROM recomendacoes WHERE usuario_id = ? AND fazenda_id = ? AND mostrar = 1 ORDER BY data_prevista')
        .bind(rel.usuario_id, rel.fazenda_id).all();
      out.recs = (results || []).filter((r) => !rel.safra || !r.safra || r.safra === rel.safra).map(linhaRec);
    }
    if (!out.plantio.length && !out.recs.length) return null;
    return out;
  } catch (e) {
    return null;     // o relatório nunca pode quebrar por causa dos módulos novos
  }
}

/* ---------------- rotas /api/agro/* ---------------- */

export async function rotasAgro(env, req, me, rota, url) {
  await garantir(env);
  const mod = await modulosDe(env, me.id);

  if (rota === '/api/modulos') return json({ ok: true, plantio: mod.plantio, recomendacoes: mod.recomendacoes, admin: mod.admin });

  const precisaPlantio = rota.startsWith('/api/agro/plantio');
  const precisaRec = rota.startsWith('/api/agro/rec') || rota.startsWith('/api/agro/produto');
  if (precisaPlantio && !mod.plantio) return json({ erro: 'módulo de plantio não liberado para esta conta' }, 403);
  if (precisaRec && !mod.recomendacoes) return json({ erro: 'módulo de recomendações não liberado para esta conta' }, 403);

  /* ----- plantio ----- */
  if (rota === '/api/agro/plantio' && req.method === 'GET') {
    const fid = txt(url.searchParams.get('fazenda_id'), 80);
    const { results } = fid
      ? await env.DB.prepare('SELECT * FROM plantio WHERE usuario_id = ? AND fazenda_id = ?').bind(me.id, fid).all()
      : await env.DB.prepare('SELECT * FROM plantio WHERE usuario_id = ?').bind(me.id).all();
    return json({ ok: true, plantio: results || [] });
  }

  if (rota === '/api/agro/plantio' && req.method === 'POST') {
    const b = await req.json();
    const fid = txt(b.fazenda_id, 80);
    if (!fid || !(await fazendaDoUsuario(env, me.id, fid))) return json({ erro: 'fazenda não encontrada' }, 404);
    const safra = txt(b.safra, 40);
    const lista = Array.isArray(b.talhoes) ? b.talhoes.slice(0, 400) : [];
    const cmds = [];
    for (const t of lista) {
      const talhao = txt(t.talhao, 80);
      if (!talhao) continue;
      const vazio = !t.cultura && !t.variedade && !t.data_plantio && !t.data_emerg && !num(t.sem_m) && !num(t.sem_ha);
      if (vazio) {
        cmds.push(env.DB.prepare('DELETE FROM plantio WHERE fazenda_id = ? AND safra = ? AND talhao = ? AND usuario_id = ?')
          .bind(fid, safra, talhao, me.id));
        continue;
      }
      cmds.push(env.DB.prepare(`INSERT INTO plantio
          (fazenda_id, safra, talhao, usuario_id, cultura, variedade, data_plantio, data_emerg, espac_cm, sem_m, sem_ha, atualizado_em)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
          ON CONFLICT(fazenda_id, safra, talhao) DO UPDATE SET
            cultura = excluded.cultura, variedade = excluded.variedade, data_plantio = excluded.data_plantio,
            data_emerg = excluded.data_emerg, espac_cm = excluded.espac_cm, sem_m = excluded.sem_m,
            sem_ha = excluded.sem_ha, atualizado_em = datetime('now')
          WHERE plantio.usuario_id = excluded.usuario_id`)
        .bind(fid, safra, talhao, me.id, txt(t.cultura, 20), txt(t.variedade, 80), dia(t.data_plantio),
              dia(t.data_emerg), num(t.espac_cm), num(t.sem_m), Math.round(num(t.sem_ha))));
    }
    if (cmds.length) await env.DB.batch(cmds);
    return json({ ok: true, salvos: cmds.length });
  }

  /* ----- produtos (catálogo) ----- */
  if (rota === '/api/agro/produtos' && req.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM produtos_agro WHERE usuario_id = ? ORDER BY tipo, nome')
      .bind(me.id).all();
    return json({ ok: true, produtos: results || [] });
  }
  if (rota === '/api/agro/produto' && req.method === 'POST') {
    const b = await req.json();
    const nome = txt(b.nome, 120);
    if (!nome) return json({ erro: 'informe o nome do produto' }, 400);
    const id = b.id ? txt(b.id, 60) : novoId('pr');
    await env.DB.prepare(`INSERT INTO produtos_agro (id, usuario_id, nome, tipo, ingrediente, dose, unidade, intervalo_dias)
        VALUES (?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET nome = excluded.nome, tipo = excluded.tipo, ingrediente = excluded.ingrediente,
          dose = excluded.dose, unidade = excluded.unidade, intervalo_dias = excluded.intervalo_dias
        WHERE produtos_agro.usuario_id = excluded.usuario_id`)
      .bind(id, me.id, nome, txt(b.tipo, 40), txt(b.ingrediente, 160), num(b.dose), txt(b.unidade, 12) || 'L/ha',
            Math.max(0, Math.round(num(b.intervalo_dias)))).run();
    return json({ ok: true, id: id });
  }
  if (rota === '/api/agro/produto/apagar' && req.method === 'POST') {
    const b = await req.json();
    await env.DB.prepare('DELETE FROM produtos_agro WHERE id = ? AND usuario_id = ?').bind(txt(b.id, 60), me.id).run();
    return json({ ok: true });
  }

  /* ----- recomendações ----- */
  if (rota === '/api/agro/recs' && req.method === 'GET') {
    const fid = txt(url.searchParams.get('fazenda_id'), 80);
    const { results } = fid
      ? await env.DB.prepare('SELECT * FROM recomendacoes WHERE usuario_id = ? AND fazenda_id = ? ORDER BY data_prevista, criado_em').bind(me.id, fid).all()
      : await env.DB.prepare('SELECT * FROM recomendacoes WHERE usuario_id = ? ORDER BY data_prevista, criado_em').bind(me.id).all();
    return json({ ok: true, recs: (results || []).map(linhaRec) });
  }
  if (rota === '/api/agro/rec' && req.method === 'POST') {
    const b = await req.json();
    const fid = txt(b.fazenda_id, 80);
    if (!fid || !(await fazendaDoUsuario(env, me.id, fid))) return json({ erro: 'fazenda não encontrada' }, 404);
    const id = b.id ? txt(b.id, 60) : novoId('rc');
    const dados = JSON.stringify(b.dados && typeof b.dados === 'object' ? b.dados : {});
    if (dados.length > 60000) return json({ erro: 'recomendação grande demais' }, 400);
    await env.DB.prepare(`INSERT INTO recomendacoes (id, usuario_id, fazenda_id, safra, operacao, data_prevista, mostrar, dados, atualizado_em)
        VALUES (?,?,?,?,?,?,?,?,datetime('now'))
        ON CONFLICT(id) DO UPDATE SET fazenda_id = excluded.fazenda_id, safra = excluded.safra,
          operacao = excluded.operacao, data_prevista = excluded.data_prevista, mostrar = excluded.mostrar,
          dados = excluded.dados, atualizado_em = datetime('now')
        WHERE recomendacoes.usuario_id = excluded.usuario_id`)
      .bind(id, me.id, fid, txt(b.safra, 40), txt(b.operacao, 80), dia(b.data_prevista), b.mostrar === false ? 0 : 1, dados).run();
    return json({ ok: true, id: id });
  }
  if (rota === '/api/agro/rec/apagar' && req.method === 'POST') {
    const b = await req.json();
    await env.DB.prepare('DELETE FROM recomendacoes WHERE id = ? AND usuario_id = ?').bind(txt(b.id, 60), me.id).run();
    return json({ ok: true });
  }

  return json({ erro: 'rota não encontrada' }, 404);
}
