/* ============================================================
   portal.js — acesso da fazenda e do operador (amvs.ia.br/portal)
   O consultor cria logins no painel (Lavoura → Acessos) e escolhe as fazendas:
     • papel "fazenda": o produtor/gerente acompanha aplicações, mapas de área e
       variedade, evolução do plantio, estoque e custo por talhão (só leitura);
     • papel "operador": operador do pulverizador / encarregado vê as aplicações
       e marca o que aplicou — no app do consultor aparece como aplicado.
   Os dados continuam sendo da conta do consultor (dono_id); o login do portal
   só enxerga as fazendas liberadas para ele.
   ============================================================ */

import { conferirSenha, criarTokenPortal, hashSenha, lerTokenPortal, novoId } from './auth.js';
import { blocosAgro } from './agrorel.js';
import { baseUnidade, comparativo, modulosDe } from './agro.js';
import { safraPadrao } from './safras.js';
import { chavePublica, garantirPush } from './push.js';
import { salvar as salvarMidia } from './midia.js';

const json = (o, status) => new Response(JSON.stringify(o), {
  status: status || 200,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' }
});
const txt = (v, max) => String(v == null ? '' : v).trim().slice(0, max || 200);
const dia = (v) => { const s = String(v || '').trim(); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; };
const hojeMT = () => new Date(Date.now() - 4 * 3600 * 1000).toISOString().slice(0, 10);
const somaDias = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const FEM = /^(Dessecação|Adubação|Outra)/;
const ordTxt = (op, n) => n + (FEM.test(op) ? 'ª ' : 'º ') + op;
const PAPEIS = { fazenda: 'Fazenda', operador: 'Operador / encarregado' };
function lerJson(s, padrao) { try { const o = JSON.parse(s || ''); return o == null ? padrao : o; } catch (e) { return padrao; } }

let pronta = null;
function garantir(env) {
  if (!pronta) {
    pronta = env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS acessos_fazenda (
        id            TEXT PRIMARY KEY,
        dono_id       TEXT NOT NULL,
        nome          TEXT DEFAULT '',
        login         TEXT NOT NULL UNIQUE,
        senha_hash    TEXT NOT NULL,
        papel         TEXT NOT NULL DEFAULT 'fazenda',
        fazendas      TEXT DEFAULT '[]',
        ativo         INTEGER DEFAULT 1,
        criado_em     TEXT DEFAULT (datetime('now')),
        ultimo_acesso TEXT DEFAULT ''
      )`),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS acessos_dono ON acessos_fazenda (dono_id)')
    ]).catch((e) => { pronta = null; throw e; });
  }
  return pronta;
}

function semSenha(a) {
  return { id: a.id, nome: a.nome, login: a.login, papel: a.papel, fazendas: lerJson(a.fazendas, []), ativo: Number(a.ativo) !== 0,
    criado_em: a.criado_em, ultimo_acesso: a.ultimo_acesso || '' };
}

/* ---------------- gestão pelo consultor (/api/acessos*) ---------------- */
export async function rotasAcessos(env, req, me, rota) {
  await garantir(env);
  const mod = await modulosDe(env, me.id);
  if (!mod.plantio && !mod.recomendacoes) return json({ erro: 'Plantio/Recomendações não liberados para esta conta' }, 403);

  if (rota === '/api/acessos' && req.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM acessos_fazenda WHERE dono_id = ? ORDER BY criado_em').bind(me.id).all();
    return json({ ok: true, acessos: (results || []).map(semSenha) });
  }

  if (rota === '/api/acessos/salvar' && req.method === 'POST') {
    const b = await req.json();
    const login = txt(b.login, 80).toLowerCase().replace(/\s+/g, '');
    const papel = b.papel === 'operador' ? 'operador' : 'fazenda';
    if (!/^[a-z0-9._@-]{3,80}$/.test(login)) return json({ erro: 'login: use de 3 a 80 letras, números, ponto, traço ou @ (sem espaço)' }, 400);
    // só fazendas desta conta
    const { results: minhas } = await env.DB.prepare('SELECT id FROM fazendas WHERE usuario_id = ?').bind(me.id).all();
    const ok = new Set((minhas || []).map((f) => f.id));
    const fazs = (Array.isArray(b.fazendas) ? b.fazendas : []).map(String).filter((id) => ok.has(id));
    if (!fazs.length) return json({ erro: 'escolha ao menos uma fazenda' }, 400);
    const outro = await env.DB.prepare('SELECT id, dono_id FROM acessos_fazenda WHERE login = ?').bind(login).first();
    if (outro && outro.id !== b.id) return json({ erro: 'esse login já está em uso; escolha outro' }, 409);
    if (b.id) {
      const a = await env.DB.prepare('SELECT * FROM acessos_fazenda WHERE id = ? AND dono_id = ?').bind(txt(b.id, 60), me.id).first();
      if (!a) return json({ erro: 'acesso não encontrado' }, 404);
      const senha = String(b.senha || '');
      if (senha && senha.length < 6) return json({ erro: 'a senha precisa de pelo menos 6 caracteres' }, 400);
      await env.DB.prepare('UPDATE acessos_fazenda SET nome = ?, login = ?, papel = ?, fazendas = ?, ativo = ?, senha_hash = ? WHERE id = ? AND dono_id = ?')
        .bind(txt(b.nome, 80), login, papel, JSON.stringify(fazs), b.ativo === false ? 0 : 1, senha ? await hashSenha(senha) : a.senha_hash, a.id, me.id).run();
      return json({ ok: true, id: a.id });
    }
    const senha = String(b.senha || '');
    if (senha.length < 6) return json({ erro: 'a senha precisa de pelo menos 6 caracteres' }, 400);
    const id = novoId('ac');
    await env.DB.prepare('INSERT INTO acessos_fazenda (id, dono_id, nome, login, senha_hash, papel, fazendas) VALUES (?,?,?,?,?,?,?)')
      .bind(id, me.id, txt(b.nome, 80), login, await hashSenha(senha), papel, JSON.stringify(fazs)).run();
    return json({ ok: true, id });
  }

  if (rota === '/api/acessos/apagar' && req.method === 'POST') {
    const b = await req.json();
    await env.DB.prepare('DELETE FROM acessos_fazenda WHERE id = ? AND dono_id = ?').bind(txt(b.id, 60), me.id).run();
    return json({ ok: true });
  }
  return json({ erro: 'rota não encontrada' }, 404);
}

/* ---------------- dados de uma fazenda para o portal ---------------- */
function areasDe(talhoes) {
  const out = {};
  const t = lerJson(talhoes, null);
  ((t && t.features) || []).forEach((x) => { const p = x.properties || {}; if (p.nome) out[String(p.nome)] = Number(p.area_ha) || 0; });
  return out;
}

// estoque da fazenda: entradas − aplicado; "a aplicar" = recomendado e ainda não aplicado (mesma conta do app)
export function estoqueDe(entradas, recs, areas) {
  const chave = (n) => String(n || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const m = {};
  const item = (nome, un) => { const k = chave(nome) + '|' + un; return m[k] || (m[k] = { nome, un, ent: 0, val: 0, qv: 0, apl: 0, prev: 0 }); };
  entradas.forEach((e) => {
    const x = item(e.produto, e.unidade || 'L'); x.ent += Number(e.qtd) || 0;
    if (Number(e.qtd) > 0 && Number(e.valor) > 0) { x.val += Number(e.valor); x.qv += Number(e.qtd); }
  });
  recs.forEach((r) => {
    const d = r.dados, parte = d.parte || {}, feito = d.feito || {};
    (d.tal || []).forEach((t) => {
      const tot = areas[t] || 0, p = Number(parte[t]), ha = p > 0 && p < tot ? p : tot;
      (d.prods || []).forEach((pr) => {
        if (!pr || !pr[0]) return;
        const [un, f] = baseUnidade(pr[2]), x = item(pr[0], un), q = (Number(pr[1]) || 0) * ha * f;
        if (feito[t]) x.apl += q; else x.prev += q;
      });
    });
  });
  const r2 = (v) => Math.round(v * 100) / 100;
  return Object.values(m).map((x) => {
    const custo = x.qv ? x.val / x.qv : 0, saldo = x.ent - x.apl;
    return { produto: x.nome, unidade: x.un, entradas: r2(x.ent), aplicado: r2(x.apl), a_aplicar: r2(x.prev), saldo: r2(saldo),
      sobra: r2(saldo - x.prev), custo_unit: r2(custo), valor_saldo: r2(Math.max(0, saldo) * custo), gasto: r2(x.apl * custo) };
  }).sort((a, b) => a.produto.localeCompare(b.produto, 'pt-BR'));
}

// data prevista de cada talhão (DAE pela emergência, senão a data da recomendação) — igual ao app
function datasTal(r, plantio) {
  const d = r.dados, n = Number(d.dae) || 0, out = {};
  (d.tal || []).forEach((t) => {
    let data = (d.datas && d.datas[t]) || r.data_prevista || '';
    if (n > 0) {
      const p = plantio[safraPadrao(r.safra) + '|' + t];
      const base = p ? (p.data_emerg || (p.data_plantio ? somaDias(p.data_plantio, 5) : '')) : '';
      if (base) data = somaDias(base, n);
    }
    out[t] = data;
  });
  return out;
}

async function dadosFazenda(env, acesso, fid, safraPedida) {
  const f = await env.DB.prepare('SELECT f.id, f.nome, f.talhoes, p.nome AS produtor FROM fazendas f LEFT JOIN produtores p ON p.id = f.produtor_id WHERE f.id = ? AND f.usuario_id = ?')
    .bind(fid, acesso.dono_id).first();
  if (!f) return null;
  const dono = acesso.dono_id;
  const [pl, rc, es, co, ci] = await Promise.all([
    env.DB.prepare('SELECT * FROM plantio WHERE usuario_id = ? AND fazenda_id = ?').bind(dono, fid).all(),
    env.DB.prepare('SELECT * FROM recomendacoes WHERE usuario_id = ? AND fazenda_id = ? ORDER BY data_prevista, criado_em').bind(dono, fid).all(),
    env.DB.prepare('SELECT * FROM estoque_agro WHERE usuario_id = ? AND fazenda_id = ?').bind(dono, fid).all().catch(() => ({ results: [] })),
    env.DB.prepare('SELECT * FROM colheita WHERE usuario_id = ? AND fazenda_id = ?').bind(dono, fid).all().catch(() => ({ results: [] })),
    env.DB.prepare('SELECT variedade, cultura, dias FROM ciclos WHERE usuario_id = ?').bind(dono).all().catch(() => ({ results: [] }))
  ]);
  const recs = (rc.results || []).map((r) => ({ id: r.id, safra: r.safra || '', operacao: r.operacao || '', data_prevista: r.data_prevista || '',
    mostrar: Number(r.mostrar) !== 0, dados: lerJson(r.dados, {}) }));
  const plantioTodas = pl.results || [];
  const safras = [...new Set(plantioTodas.map((p) => safraPadrao(p.safra)).concat(recs.map((r) => safraPadrao(r.safra))).filter(Boolean))].sort().reverse();
  const safra = safraPadrao(safraPedida || '') || safras[0] || '';
  const daSafra = (x) => !safra || !x.safra || safraPadrao(x.safra) === safra;
  const plantio = plantioTodas.filter(daSafra);
  const mapa = lerJson(f.talhoes, null);
  const areas = areasDe(f.talhoes);
  const porTal = {}; plantio.forEach((p) => { porTal[safraPadrao(p.safra) + '|' + p.talhao] = p; });
  const base = { fazenda: { id: f.id, nome: f.nome, produtor: f.produtor || '' }, safra, safras, mapa,
    plantio: plantio.map((p) => ({ talhao: p.talhao, cultura: p.cultura, variedade: p.variedade, data_plantio: p.data_plantio, data_emerg: p.data_emerg })) };

  // aplicações em formato de lista (as duas visões usam)
  const hoje = hojeMT();
  const aplicacoes = recs.filter(daSafra).filter((r) => acesso.papel === 'operador' || r.mostrar).map((r) => {
    const d = r.dados, num = Number(d.num) || 1, datas = datasTal(r, porTal), feito = d.feito || {};
    const tal = (d.tal || []).map((t) => {
      const tot = areas[t] || 0, p = Number((d.parte || {})[t]), ha = p > 0 && p < tot ? p : tot;
      return { nome: t, ha: Math.round(ha * 100) / 100, data: datas[t] || '', feito: feito[t] || '', por: (d.feitoPor || {})[t] || '',
        meu: String((d.feitoPorId || {})[t] || '').split('|')[0] === acesso.id };
    });
    const pend = tal.filter((t) => !t.feito);
    const prox = pend.map((t) => t.data).filter(Boolean).sort()[0] || '';
    const registros = (d.aplicReg || []).map((g) => Object.assign({}, g, { porId: undefined,
      fotos: (g.fotos || []).map((k) => '/img/' + encodeURIComponent(k)) }));
    return { id: r.id, titulo: Number(d.rep) > 0 ? ordTxt(r.operacao, num) : r.operacao, safra: r.safra, data: prox || r.data_prevista, registros,
      prods: (d.prods || []).filter((p) => p && p[0]).map((p) => ({ nome: p[0], dose: Number(p[1]) || 0, unidade: p[2] || 'L/ha' })),
      calda: Number(d.calda) || 0, tanque: Number(d.tanque) || 0, obs: d.obs || '', resp: d.resp || '', tal,
      status: !pend.length ? 'aplicada' : pend.length < tal.length ? 'andamento' : 'pendente', atrasada: !!(prox && prox < hoje) };
  });

  if (acesso.papel === 'operador') return Object.assign(base, { aplicacoes });

  const bl = blocosAgro({ plantio, recs: recs.filter(daSafra).filter((r) => r.mostrar), mapa }) || {};
  let custo = null;
  try {
    const cp = await comparativo(env, { id: dono }, false, safra);
    custo = (cp.fazendas || []).filter((x) => x.id === fid)[0] || null;
  } catch (e) { custo = null; }
  return Object.assign(base, {
    aplicacoes,
    blocos: { evolucao: bl.evolucao || '', mapaVar: bl.mapaVar || '', proximas: bl.topo || '', aplicacoes: bl.fim || '' },
    estoque: estoqueDe(es.results || [], recs, areas),
    custo: custo ? { talhoes: custo.talhoes, sem_preco: custo.sem_preco } : null,
    colheita: (co.results || []).filter(daSafra).map((c) => ({ talhao: c.talhao, sc_ha: c.sc_ha, data: c.data || '' })),
    ciclos: (ci.results || []).map((c) => ({ variedade: c.variedade, cultura: c.cultura, dias: c.dias }))
  });
}

/* ---------------- rotas públicas do portal (/api/portal/*) ---------------- */
async function acessoDaRequisicao(req, env) {
  const cab = req.headers.get('Authorization') || '';
  const tk = await lerTokenPortal(env, cab.startsWith('Bearer ') ? cab.slice(7) : '');
  if (!tk) return null;
  const a = await env.DB.prepare('SELECT * FROM acessos_fazenda WHERE id = ?').bind(tk.pid).first();
  if (!a || Number(a.ativo) === 0) return null;
  const mod = await modulosDe(env, a.dono_id);
  if (!mod.plantio && !mod.recomendacoes) return null;   // a conta do consultor perdeu os módulos
  a.lista = lerJson(a.fazendas, []);
  return a;
}

export async function rotasPortal(env, req, rota, url) {
  await garantir(env);
  if (req.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' } });

  if (rota === '/api/portal/entrar' && req.method === 'POST') {
    const b = await req.json().catch(() => ({}));
    const login = txt(b.login, 80).toLowerCase().replace(/\s+/g, '');
    const a = login ? await env.DB.prepare('SELECT * FROM acessos_fazenda WHERE login = ?').bind(login).first() : null;
    if (!a || !(await conferirSenha(String(b.senha || ''), a.senha_hash))) return json({ erro: 'login ou senha incorretos' }, 401);
    if (Number(a.ativo) === 0) return json({ erro: 'este acesso está desativado. Fale com o consultor.' }, 403);
    await env.DB.prepare('UPDATE acessos_fazenda SET ultimo_acesso = ? WHERE id = ?').bind(new Date().toISOString(), a.id).run();
    return json({ ok: true, token: await criarTokenPortal(env, a) });
  }

  const a = await acessoDaRequisicao(req, env);
  if (!a) return json({ erro: 'sessão expirada, entre de novo' }, 401);

  /* ----- aviso no celular do operador (5h00) ----- */
  if (rota === '/api/portal/push/chave') return json({ ok: true, chave: await chavePublica(env) });
  if (rota === '/api/portal/push/assinar' && req.method === 'POST') {
    await garantirPush(env);
    const b = await req.json().catch(() => ({}));
    const s = b.assinatura || {}, k = s.keys || {}, endpoint = String(s.endpoint || '');
    if (!/^https:\/\//.test(endpoint) || !k.p256dh || !k.auth) return json({ erro: 'assinatura inválida' }, 400);
    await env.DB.prepare(`INSERT INTO push_assinaturas (endpoint, usuario_id, p256dh, auth) VALUES (?,?,?,?)
        ON CONFLICT(endpoint) DO UPDATE SET usuario_id = excluded.usuario_id, p256dh = excluded.p256dh, auth = excluded.auth`)
      .bind(endpoint.slice(0, 1000), 'portal:' + a.id, String(k.p256dh).slice(0, 200), String(k.auth).slice(0, 100)).run();
    return json({ ok: true });
  }

  /* ----- foto do registro da aplicação ----- */
  if (rota === '/api/portal/foto' && req.method === 'POST') {
    if (a.papel !== 'operador') return json({ erro: 'só o operador envia foto da aplicação' }, 403);
    const tipo = String(req.headers.get('Content-Type') || '').split(';')[0];
    if (!/^image\/(jpeg|png|webp)$/.test(tipo)) return json({ erro: 'envie a foto em JPEG' }, 400);
    const dados = await req.arrayBuffer();
    if (!dados.byteLength || dados.byteLength > 5 * 1024 * 1024) return json({ erro: 'foto grande demais (máx. 5 MB)' }, 400);
    const id = txt(req.headers.get('X-Foto-Id'), 60).replace(/[^a-z0-9]/gi, '') || novoId('f');
    const r = await salvarMidia(env, { chave: 'aplic/' + a.dono_id + '/' + id + (tipo === 'image/png' ? '.png' : '.jpg'), mime: tipo, dados });
    return json({ ok: true, midia: r.chave });
  }

  if (rota === '/api/portal/eu') {
    const ids = a.lista;
    const fazs = ids.length ? (await env.DB.prepare('SELECT f.id, f.nome, p.nome AS produtor FROM fazendas f LEFT JOIN produtores p ON p.id = f.produtor_id WHERE f.usuario_id = ? AND f.id IN (' + ids.map(() => '?').join(',') + ')')
      .bind(a.dono_id, ...ids).all()).results || [] : [];
    const dono = await env.DB.prepare('SELECT nome FROM usuarios WHERE id = ?').bind(a.dono_id).first();
    return json({ ok: true, nome: a.nome || a.login, papel: a.papel, papel_nome: PAPEIS[a.papel] || a.papel, consultor: (dono && dono.nome) || '',
      fazendas: fazs.sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR')) });
  }

  if (rota === '/api/portal/fazenda') {
    const fid = txt(url.searchParams.get('id'), 80);
    if (!a.lista.includes(fid)) return json({ erro: 'fazenda não liberada para este acesso' }, 403);
    const d = await dadosFazenda(env, a, fid, url.searchParams.get('safra'));
    return d ? json(Object.assign({ ok: true }, d)) : json({ erro: 'fazenda não encontrada' }, 404);
  }

  // operador / encarregado marca (ou desfaz) a aplicação de talhões
  if (rota === '/api/portal/aplicar' && req.method === 'POST') {
    if (a.papel !== 'operador') return json({ erro: 'este acesso só acompanha; quem marca aplicação é o operador' }, 403);
    const b = await req.json().catch(() => ({}));
    const r = await env.DB.prepare('SELECT * FROM recomendacoes WHERE id = ? AND usuario_id = ?').bind(txt(b.rec_id, 60), a.dono_id).first();
    if (!r || !a.lista.includes(r.fazenda_id)) return json({ erro: 'aplicação não encontrada' }, 404);
    const d = lerJson(r.dados, {});
    const data = dia(b.data) || hojeMT();
    if (data > somaDias(hojeMT(), 1)) return json({ erro: 'a data da aplicação não pode ser no futuro' }, 400);
    d.feito = d.feito || {}; d.feitoPor = d.feitoPor || {}; d.feitoPorId = d.feitoPorId || {};
    const tal = (Array.isArray(b.talhoes) ? b.talhoes : []).map(String).filter((t) => (d.tal || []).includes(t));
    if (!tal.length) return json({ erro: 'escolha os talhões' }, 400);
    const quem = (a.nome || a.login) + ' (' + (a.papel === 'operador' ? 'operador' : 'fazenda') + ')';
    d.aplicReg = Array.isArray(d.aplicReg) ? d.aplicReg : [];
    // a mesma marcação reenviada (fila sem internet) não duplica
    const regId = txt(b.reg_id, 60);
    if (!b.desfazer && regId && d.aplicReg.some((g) => g.id === regId)) return json({ ok: true, repetido: true });
    const marcados = [];
    tal.forEach((t) => {
      if (b.desfazer) {
        // só desfaz o que o próprio acesso marcou
        if (String(d.feitoPorId[t] || '').split('|')[0] !== a.id) return;
        delete d.feito[t]; delete d.feitoPor[t]; delete d.feitoPorId[t];
      } else {
        if (d.feito[t] && !String(d.feitoPorId[t] || '').startsWith(a.id + '|')) return;   // já aplicado por outra pessoa
        d.feito[t] = data; d.feitoPor[t] = quem; d.feitoPorId[t] = a.id + '|' + Date.now().toString(36);
        marcados.push(t);
      }
    });
    if (b.desfazer) {
      // tira o talhão do registro; registro sem talhão some
      d.aplicReg = d.aplicReg.map((g) => Object.assign({}, g, { talhoes: (g.talhoes || []).filter((t) => d.feito[t]) })).filter((g) => g.talhoes.length);
    } else if (marcados.length) {
      const g = b.registro && typeof b.registro === 'object' ? b.registro : {};
      const hora = (v) => { const x = String(v || '').trim(); return /^\d{2}:\d{2}$/.test(x) ? x : ''; };
      const numero = (v, min, max) => { const n = Number(String(v == null ? '' : v).replace(',', '.')); return v === '' || v == null || !Number.isFinite(n) || n < min || n > max ? null : Math.round(n * 10) / 10; };
      d.aplicReg.push({
        id: regId || novoId('rg'), talhoes: marcados, data, inicio: hora(g.inicio), fim: hora(g.fim),
        vento: numero(g.vento, 0, 150), temp: numero(g.temp, -10, 60), umid: numero(g.umid, 0, 100),
        obs: txt(g.obs, 500), fotos: (Array.isArray(g.fotos) ? g.fotos : []).map((k) => txt(k, 200)).filter((k) => k.startsWith('aplic/' + a.dono_id + '/')).slice(0, 6),
        por: quem, porId: a.id, em: txt(b.em, 30) || new Date().toISOString()
      });
    }
    await env.DB.prepare("UPDATE recomendacoes SET dados = ?, atualizado_em = datetime('now') WHERE id = ?").bind(JSON.stringify(d), r.id).run();
    return json({ ok: true });
  }

  return json({ erro: 'rota não encontrada' }, 404);
}
