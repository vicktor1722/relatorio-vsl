/* ============================================================
   agro.js — plantio dos talhões e recomendações (módulos novos)
   Tudo criado sozinho na primeira chamada (sem migração manual).

   Quem enxerga o quê:
     • a conta administradora sempre tem os dois módulos;
     • as outras contas só recebem se (1) a chave geral "liberar para os demais"
       estiver ligada E (2) o administrador marcou o módulo para aquela conta.
   ============================================================ */

import { novoId } from './auth.js';
import { safraPadrao } from './safras.js';

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
        .bind(rel.usuario_id, rel.fazenda_id, safraPadrao(rel.safra)).all();
      out.plantio = results || [];
      const f = await fazendaDoUsuario(env, rel.usuario_id, rel.fazenda_id);
      if (f && f.talhoes) { try { out.mapa = JSON.parse(f.talhoes); } catch (e) { /* sem mapa */ } }
    }
    if (mod.recomendacoes) {
      const { results } = await env.DB.prepare(
        'SELECT * FROM recomendacoes WHERE usuario_id = ? AND fazenda_id = ? AND mostrar = 1 ORDER BY data_prevista')
        .bind(rel.usuario_id, rel.fazenda_id).all();
      out.recs = (results || []).filter((r) => !rel.safra || !r.safra || safraPadrao(r.safra) === safraPadrao(rel.safra)).map(linhaRec);
    }
    if (!out.plantio.length && !out.recs.length) return null;
    return out;
  } catch (e) {
    return null;     // o relatório nunca pode quebrar por causa dos módulos novos
  }
}

/* ---------------- visão geral do plantio (painel do administrador) ---------------- */

const SEM_PLANTIO = { pastagem: 1, pousio: 1 };

// junta o plantio de todas as contas: por safra, área plantada x área total, evolução por data,
// variedades e andamento de cada fazenda. Só entram fazendas com KML (precisa da área de cada talhão).
export async function plantioGeral(env) {
  await garantir(env);
  const [pl, fz, mu] = await Promise.all([
    env.DB.prepare('SELECT fazenda_id, safra, talhao, cultura, variedade, data_plantio FROM plantio LIMIT 30000').all(),
    env.DB.prepare(`SELECT f.id, f.nome, f.talhoes, f.usuario_id, u.nome AS conta_nome, u.email AS conta, u.admin AS adm, p.nome AS produtor
        FROM fazendas f LEFT JOIN usuarios u ON u.id = f.usuario_id LEFT JOIN produtores p ON p.id = f.produtor_id
       WHERE f.talhoes IS NOT NULL AND f.talhoes != '' LIMIT 1000`).all(),
    env.DB.prepare('SELECT usuario_id FROM modulos_usuario WHERE plantio = 1').all()
  ]);
  const geral = await liberadoGeral(env);
  const comModulo = {};
  ((mu && mu.results) || []).forEach((m) => { if (geral) comModulo[m.usuario_id] = 1; });

  const faz = {};
  ((fz && fz.results) || []).forEach((f) => {
    let gj = null;
    try { gj = JSON.parse(f.talhoes); } catch (e) { return; }
    const areas = {}; let total = 0;
    ((gj && gj.features) || []).forEach((ft) => {
      const pr = (ft && ft.properties) || {};
      const nome = String(pr.nome || ''); const ha = Number(pr.area_ha) || 0;
      if (nome) { areas[nome] = ha; total += ha; }
    });
    if (!total) return;
    faz[f.id] = { id: f.id, nome: f.nome || '', produtor: f.produtor || '', conta: f.conta_nome || f.conta || '',
      areas, total, ativa: Number(f.adm) === 1 || !!comModulo[f.usuario_id] };
  });

  // junta as grafias da mesma variedade (ex.: "Olimpo" e "BMX Olimpo IPRO"): vale o nome mais completo
  const chaveVar = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\b(bmx|ipro)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
  const nomeVar = {};
  ((pl && pl.results) || []).forEach((r) => {
    const v = String(r.variedade || '').trim().replace(/\s+/g, ' ');
    r.variedade = v;
    if (!v) return;
    const k = (r.cultura || '') + '|' + (chaveVar(v) || v.toLowerCase());
    if (!nomeVar[k] || v.length > nomeVar[k].length) nomeVar[k] = v;
  });
  ((pl && pl.results) || []).forEach((r) => {
    if (r.variedade) r.variedade = nomeVar[(r.cultura || '') + '|' + (chaveVar(r.variedade) || r.variedade.toLowerCase())] || r.variedade;
  });
  const porSafra = {};
  ((pl && pl.results) || []).forEach((r) => {
    if (!faz[r.fazenda_id]) return;
    const k = String(r.safra || '').trim().replace(/^(\d{4})\s*[\/-]\s*(\d{2}|\d{4})$/, function (m, a, b) { return a + '/' + (b.length === 2 ? a.slice(0, 2) + b : b); }) || '(sem safra)';
    (porSafra[k] = porSafra[k] || []).push(r);
  });

  const r1 = (n) => Math.round(n * 10) / 10;
  const safras = Object.keys(porSafra).sort().reverse().map((safra) => {
    const rows = porSafra[safra];
    const porFaz = {};
    rows.forEach((r) => { (porFaz[r.fazenda_id] = porFaz[r.fazenda_id] || []).push(r); });

    let total = 0, plantado = 0, fora = 0;
    const cult = {}, vari = {}, linha = {}, fazendas = [];
    Object.keys(porFaz).forEach((fid) => {
      const F = faz[fid], rs = porFaz[fid];
      let naoPlanta = 0, plant = 0, primeira = '', ultima = '', comCultura = 0;
      const vs = {}, cultsFaz = {};
      rs.forEach((r) => {
        const ha = F.areas[r.talhao] || 0;
        if (SEM_PLANTIO[r.cultura]) { naoPlanta += ha; return; }
        if (r.cultura) {
          const c = cult[r.cultura] = cult[r.cultura] || { cultura: r.cultura, ha: 0, plantado: 0 };
          c.ha += ha; if (r.data_plantio) c.plantado += ha;
          comCultura += ha; cultsFaz[r.cultura] = 1;
        }
        if (r.variedade) {
          const k = (r.cultura || '') + '|' + r.variedade;
          const v = vari[k] = vari[k] || { cultura: r.cultura || '', variedade: r.variedade, ha: 0, plantado: 0, fazs: {} };
          v.ha += ha; if (r.data_plantio) v.plantado += ha; v.fazs[fid] = 1;
          vs[r.variedade] = 1;
        }
        if (r.cultura && r.data_plantio) {
          plant += ha;
          linha[r.data_plantio] = (linha[r.data_plantio] || 0) + ha;
          if (!primeira || r.data_plantio < primeira) primeira = r.data_plantio;
          if (!ultima || r.data_plantio > ultima) ultima = r.data_plantio;
        }
      });
      const tot = Math.max(0, F.total - naoPlanta);
      // fazenda com uma cultura só (ex.: soja): os talhões ainda sem cultura entram na área dela;
      // pastagem e pousio já ficaram fora de tot
      const unica = Object.keys(cultsFaz);
      if (unica.length === 1 && tot > comCultura) cult[unica[0]].ha += tot - comCultura;
      total += tot; plantado += plant; fora += naoPlanta;
      fazendas.push({ id: fid, nome: F.nome, produtor: F.produtor, conta: F.conta, total_ha: r1(tot), plantado_ha: r1(plant),
        primeira, ultima, variedades: Object.keys(vs).sort() });
    });
    fazendas.sort((a, b) => (b.plantado_ha / (b.total_ha || 1)) - (a.plantado_ha / (a.total_ha || 1)) || a.nome.localeCompare(b.nome));
    // fazendas de contas com o módulo que ainda não têm nada lançado nesta safra
    const sem = Object.keys(faz).filter((id) => faz[id].ativa && !porFaz[id]).map((id) => ({ id, nome: faz[id].nome, conta: faz[id].conta, total_ha: r1(faz[id].total) }));
    return {
      safra, total_ha: r1(total), plantado_ha: r1(plantado), fora_ha: r1(fora),
      culturas: Object.keys(cult).map((k) => ({ cultura: k, ha: r1(cult[k].ha), plantado: r1(cult[k].plantado) })).sort((a, b) => b.ha - a.ha),
      variedades: Object.keys(vari).map((k) => ({ cultura: vari[k].cultura, variedade: vari[k].variedade, ha: r1(vari[k].ha),
        plantado: r1(vari[k].plantado), fazendas: Object.keys(vari[k].fazs).length })).sort((a, b) => b.ha - a.ha),
      linha: Object.keys(linha).sort().map((d) => ({ d, ha: r1(linha[d]) })),
      fazendas, sem_lancamento: sem
    };
  });
  return { ok: true, safras };
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

  /* ----- visão geral para o painel do administrador ----- */
  if (rota === '/api/agro/admin/plantio' && req.method === 'GET') {
    if (!mod.admin) return json({ erro: 'somente o administrador vê todas as contas' }, 403);
    return json(await plantioGeral(env));
  }

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
    const safra = safraPadrao(txt(b.safra, 40));
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
      .bind(id, me.id, fid, safraPadrao(txt(b.safra, 40)), txt(b.operacao, 80), dia(b.data_prevista), b.mostrar === false ? 0 : 1, dados).run();
    return json({ ok: true, id: id });
  }
  if (rota === '/api/agro/rec/apagar' && req.method === 'POST') {
    const b = await req.json();
    await env.DB.prepare('DELETE FROM recomendacoes WHERE id = ? AND usuario_id = ?').bind(txt(b.id, 60), me.id).run();
    return json({ ok: true });
  }

  return json({ erro: 'rota não encontrada' }, 404);
}
