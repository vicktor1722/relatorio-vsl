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
import { baseUnidade, comparativo, garantir as garantirAgro, modulosDe, regraCiclo, variedadePadrao } from './agro.js';
import { CATALOGO, chaveCult, cicloMaterial } from './cultivares.js';
import { dividirTalhao, haAplicada, haPlantada, lerLanc, parciaisDe, partesDe, plantioPorDia } from './plantiodia.js';
import { cicloDaConta, juntarPrevisao, previsaoTalhao } from './previsao.js';
import { climaDe, localDaFazenda, mercadoDaFazenda } from './mercado.js';
import { chuvaDaFazenda } from './chuva.js';
import { safraPadrao } from './safras.js';
import { chavePublica, enviarParaConta, garantirPush } from './push.js';
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
    const d = r.dados, parte = d.parte || {};
    (d.tal || []).forEach((t) => {
      const tot = areas[t] || 0, p = Number(parte[t]), ha = p > 0 && p < tot ? p : tot, hf = haAplicada(d, t, ha);
      (d.prods || []).forEach((pr) => {
        if (!pr || !pr[0]) return;
        const [un, f] = baseUnidade(pr[2]), x = item(pr[0], un), dose = (Number(pr[1]) || 0) * f;
        x.apl += dose * hf; x.prev += dose * (ha - hf);
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

// ciclo de cada material plantado: informado pelo consultor ou calculado pelo GMR (catálogo de cultivares)
async function ciclosDoPlantio(env, dono, plantio, linhas) {
  const regra = await regraCiclo(env, dono), vistos = {}, out = [];
  // cada variedade plantada (talhão em partes: as variedades de todas as partes)
  plantio.forEach((p) => partesDe(p, 0).map((x) => x.variedade).concat(p.variedade || []).forEach((v) => {
    const k = chaveCult(v);
    if (!k || vistos[k]) return; vistos[k] = 1;
    const linha = linhas.filter((l) => chaveCult(l.variedade) === k)[0];
    const c = cicloMaterial(v, p.cultura, linha, regra);
    if (c) out.push({ variedade: v, cultura: p.cultura, dias: c.dias, gmr: c.gmr || 0, fonte: c.fonte });
  }));
  return out;
}

// notificação para o consultor: "✔ Aplicação lançada · FAZENDA — Herbicida pós · TH-05 (20 de 50 ha) · por …"
async function avisarConsultor(env, dono, r, d, talhoes, parcial, quem, data, regId) {
  await garantirPush(env);
  const f = await env.DB.prepare('SELECT nome, talhoes FROM fazendas WHERE id = ?').bind(r.fazenda_id).first();
  const areas = areasDe(f && f.talhoes), parte = d.parte || {};
  const haTal = (t) => { const tot = areas[t] || 0, p = Number(parte[t]); return p > 0 && p < tot ? p : tot; };
  const n1 = (v) => (Math.round(v * 10) / 10).toString().replace('.', ',');
  const tal = parcial
    ? parcial.t + ' (' + n1(parcial.ha) + ' de ' + n1(haTal(parcial.t)) + ' ha · parcial)'
    : talhoes.join(', ') + ' · ' + n1(talhoes.reduce((s, t) => s + haTal(t), 0)) + ' ha';
  const op = Number(d.rep) > 0 ? ordTxt(r.operacao, Number(d.num) || 1) : r.operacao;
  const dm = String(data).split('-');
  return enviarParaConta(env, dono, {
    title: (parcial ? '◐ Aplicação parcial lançada · ' : '✔ Aplicação lançada · ') + ((f && f.nome) || 'fazenda'),
    body: op + ' · ' + tal + '\npor ' + quem + ' · ' + dm[2] + '/' + dm[1],
    url: '/?abrir=recs',
    tag: 'aplic-' + (regId || r.id + '-' + Date.now().toString(36))   // um aviso por lançamento (não substitui o anterior)
  });
}

// todas as fazendas do acesso juntas: talhões com o nome da fazenda na frente ("SANTA PAULA · TH-05"),
// evolução do plantio somando todas as áreas e as aplicações de cada fazenda em sequência
async function dadosTodas(env, acesso, safraPedida) {
  let safra = safraPadrao(safraPedida || '');
  let lista = [];
  for (const fid of acesso.lista) { const d = await dadosFazenda(env, acesso, fid, safra); if (d) lista.push(d); }
  const safras = [...new Set(lista.flatMap((d) => d.safras || []))].sort().reverse();
  if (!safra) {
    safra = safras[0] || '';
    if (lista.some((d) => d.safra !== safra)) {   // cada fazenda escolheu a sua safra mais nova: refaz com a mesma
      lista = [];
      for (const fid of acesso.lista) { const d = await dadosFazenda(env, acesso, fid, safra); if (d) lista.push(d); }
    }
  }
  lista.sort((x, y) => x.fazenda.nome.localeCompare(y.fazenda.nome, 'pt-BR'));
  const pre = (d) => d.fazenda.nome + ' · ';
  const html = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const feats = [];
  lista.forEach((d) => ((d.mapa && d.mapa.features) || []).forEach((f) => feats.push(Object.assign({}, f, {
    properties: Object.assign({}, f.properties, { nome: pre(d) + ((f.properties || {}).nome || '') })
  }))));
  const mapa = feats.length ? { type: 'FeatureCollection', features: feats } : null;
  // evolução do plantio de todas as áreas (linhas do banco, com o plantio por dia)
  const nomeFaz = {}; lista.forEach((d) => { nomeFaz[d.fazenda.id] = d.fazenda.nome; });
  const ids = Object.keys(nomeFaz);
  const brutos = ids.length ? ((await env.DB.prepare('SELECT * FROM plantio WHERE usuario_id = ? AND fazenda_id IN (' + ids.map(() => '?').join(',') + ')')
    .bind(acesso.dono_id, ...ids).all()).results || []) : [];
  const daSafra = (p) => !safra || !p.safra || safraPadrao(p.safra) === safra;
  const plantioBruto = brutos.filter(daSafra).map((p) => Object.assign({}, p, { talhao: nomeFaz[p.fazenda_id] + ' · ' + p.talhao }));
  const bl = blocosAgro({ plantio: plantioBruto, recs: [], mapa }) || {};
  // estoque: soma por produto e unidade
  const est = {};
  lista.forEach((d) => (d.estoque || []).forEach((x) => {
    const k = x.produto.toLowerCase() + '|' + x.unidade, e = est[k] || (est[k] = { produto: x.produto, unidade: x.unidade, entradas: 0, aplicado: 0, a_aplicar: 0, saldo: 0, sobra: 0, valor_saldo: 0, gasto: 0, _q: 0, _v: 0 });
    ['entradas', 'aplicado', 'a_aplicar', 'saldo', 'sobra', 'valor_saldo', 'gasto'].forEach((c) => { e[c] += Number(x[c]) || 0; });
    if (x.custo_unit) { e._q += Number(x.entradas) || 0; e._v += (Number(x.entradas) || 0) * x.custo_unit; }
  }));
  const r2 = (v) => Math.round(v * 100) / 100;
  const estoque = Object.values(est).map((e) => ({ produto: e.produto, unidade: e.unidade, entradas: r2(e.entradas), aplicado: r2(e.aplicado), a_aplicar: r2(e.a_aplicar),
    saldo: r2(e.saldo), sobra: r2(e.sobra), custo_unit: e._q ? r2(e._v / e._q) : 0, valor_saldo: r2(e.valor_saldo), gasto: r2(e.gasto) }))
    .sort((x, y) => x.produto.localeCompare(y.produto, 'pt-BR'));
  const custos = lista.filter((d) => d.custo && d.custo.talhoes);
  const ciclos = {}; lista.forEach((d) => (d.ciclos || []).forEach((c) => { ciclos[chaveCult(c.variedade)] = c; }));
  return {
    todas: true,
    fazenda: { id: '*', nome: 'Todas as fazendas', produtor: [...new Set(lista.map((d) => d.fazenda.produtor).filter(Boolean))].join(', ') },
    safra, safras, mapa,
    plantio: lista.flatMap((d) => (d.plantio || []).map((p) => Object.assign({}, p, { talhao: pre(d) + p.talhao }))),
    aplicacoes: lista.flatMap((d) => (d.aplicacoes || []).map((x) => Object.assign({}, x, {
      fazenda: d.fazenda.nome,
      tal: (x.tal || []).map((t) => Object.assign({}, t, { chave: pre(d) + t.nome }))
    }))).sort((x, y) => (x.data < y.data ? -1 : x.data > y.data ? 1 : 0)),
    blocos: acesso.papel === 'operador' ? {} : {
      evolucao: bl.evolucao || '', mapaVar: bl.mapaVar || '',
      proximas: lista.map((d) => {
        const b = d.blocos || {}, corpo = (b.proximas || '') + (b.aplicacoes || '');
        return corpo ? '<h2 class="talhao fz-tit">🌾 ' + html(d.fazenda.nome) + '</h2>' + corpo : '';
      }).join(''),
      aplicacoes: ''
    },
    estoque,
    custo: custos.length ? { talhoes: custos.flatMap((d) => d.custo.talhoes.map((t) => Object.assign({}, t, { nome: pre(d) + t.nome }))),
      sem_preco: [...new Set(custos.flatMap((d) => d.custo.sem_preco || []))] } : null,
    colheita: lista.flatMap((d) => (d.colheita || []).map((c) => Object.assign({}, c, { talhao: pre(d) + c.talhao }))),
    mapaPartes: lista.flatMap((d) => (d.mapaPartes || []).map((x) => Object.assign({}, x, { properties: Object.assign({}, x.properties, { talhao: pre(d) + x.properties.talhao }) }))),
    ciclos: Object.values(ciclos),
    graf: (() => {   // todas as fazendas juntas: soma as áreas e os dias
      const lin = {};
      lista.forEach((d) => ((d.graf && d.graf.linha) || []).forEach((x) => { lin[x.d] = (lin[x.d] || 0) + x.ha; }));
      return { total_ha: Math.round(lista.reduce((s, d) => s + ((d.graf && d.graf.total_ha) || 0), 0) * 10) / 10,
        linha: Object.keys(lin).sort().map((d) => ({ d, ha: Math.round(lin[d] * 100) / 100 })),
        prev: juntarPrevisao(lista.flatMap((d) => (d.graf && d.graf.prev) || [])) };
    })()
  };
}

// talhões com mais de uma variedade: o desenho dividido em faixas proporcionais à área de cada uma
function partesDoMapa(mapa, plantio, areas) {
  const out = [];
  ((mapa && mapa.features) || []).forEach((f) => {
    const nome = (f.properties || {}).nome, p = plantio.filter((x) => x.talhao === nome)[0];
    if (!p) return;
    const pts = partesDe(p, areas[nome] || 0).filter((x) => x.variedade);
    if (pts.length < 2) return;
    dividirTalhao(f.geometry, pts).forEach((x) => out.push({ type: 'Feature', properties: { talhao: nome, variedade: x.variedade, ha: x.ha },
      geometry: { type: 'MultiPolygon', coordinates: x.aneis.map((r) => [r]) } }));
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
    env.DB.prepare('SELECT * FROM ciclos WHERE usuario_id = ?').bind(dono).all().catch(() => ({ results: [] }))
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
    plantio: plantio.map((p) => ({ talhao: p.talhao, cultura: p.cultura, variedade: p.variedade, data_plantio: p.data_plantio, data_emerg: p.data_emerg,
      partes: (() => { const l = partesDe(p, areas[p.talhao] || 0); return l.length > 1 || (l[0] && l[0].ha < (areas[p.talhao] || 0) - 0.05) ? l : []; })(),
      lanc: lerLanc(p), ha_plantada: Math.round(haPlantada(p, areas[p.talhao] || 0) * 100) / 100 })) };

  // aplicações em formato de lista (as duas visões usam)
  const hoje = hojeMT();
  const aplicacoes = recs.filter(daSafra).filter((r) => acesso.papel === 'operador' || r.mostrar).map((r) => {
    const d = r.dados, num = Number(d.num) || 1, datas = datasTal(r, porTal), feito = d.feito || {};
    const tal = (d.tal || []).map((t) => {
      const tot = areas[t] || 0, p = Number((d.parte || {})[t]), ha = p > 0 && p < tot ? p : tot;
      const parc = feito[t] ? [] : parciaisDe(d, t).map((x) => ({ id: x.id, d: x.d, ha: x.ha, por: x.por || '', meu: x.porId === acesso.id }));
      return { nome: t, ha: Math.round(ha * 100) / 100, data: datas[t] || '', feito: feito[t] || '', por: (d.feitoPor || {})[t] || '', parc,
        feitoHa: Math.round(haAplicada(d, t, ha) * 100) / 100,
        meu: String((d.feitoPorId || {})[t] || '').split('|')[0] === acesso.id };
    });
    const pend = tal.filter((t) => !t.feito);
    const prox = pend.map((t) => t.data).filter(Boolean).sort()[0] || '';
    const registros = (d.aplicReg || []).map((g) => Object.assign({}, g, { porId: undefined,
      fotos: (g.fotos || []).map((k) => '/img/' + encodeURIComponent(k)) }));
    return { id: r.id, titulo: Number(d.rep) > 0 ? ordTxt(r.operacao, num) : r.operacao, safra: r.safra, data: prox || r.data_prevista, registros,
      prods: (d.prods || []).filter((p) => p && p[0]).map((p) => ({ nome: p[0], dose: Number(p[1]) || 0, unidade: p[2] || 'L/ha' })),
      calda: Number(d.calda) || 0, tanque: Number(d.tanque) || 0, obs: d.obs || '', resp: d.resp || '', tal,
      status: !pend.length ? 'aplicada' : pend.length < tal.length || tal.some((t) => t.feitoHa > 0) ? 'andamento' : 'pendente', atrasada: !!(prox && prox < hoje) };
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
    mapaPartes: partesDoMapa(mapa, plantio, areas),
    ciclos: await ciclosDoPlantio(env, dono, plantio, ci.results || []),
    graf: await grafPlantio(env, dono, plantio, areas, (co.results || []).filter(daSafra), ci.results || [])
  });
}

// dados dos gráficos (evolução do plantio ⇄ previsão de colheita), iguais aos do painel
async function grafPlantio(env, dono, plantio, areas, colheita, linhasCiclo) {
  const fora = { pastagem: 1, pousio: 1 }, naoPl = {}, lin = {}, colhido = {};
  plantio.forEach((p) => { if (fora[p.cultura]) naoPl[p.talhao] = 1; });
  colheita.forEach((c) => { if (Number(c.sc_ha) > 0) colhido[c.talhao] = 1; });
  const total = Object.keys(areas).filter((t) => !naoPl[t]).reduce((s, t) => s + areas[t], 0);
  const cicloDe = cicloDaConta(linhasCiclo, await regraCiclo(env, dono));
  const prev = [];
  plantio.forEach((p) => {
    if (!p.cultura || fora[p.cultura]) return;
    const ha = areas[p.talhao] || 0;
    plantioPorDia(p, ha).forEach((x) => { lin[x.d] = (lin[x.d] || 0) + x.ha; });
    prev.push(...previsaoTalhao(p, ha, cicloDe, colhido[p.talhao]));
  });
  return { total_ha: Math.round(total * 10) / 10, linha: Object.keys(lin).sort().map((d) => ({ d, ha: Math.round(lin[d] * 100) / 100 })), prev: juntarPrevisao(prev) };
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

export async function rotasPortal(env, req, rota, url, ctx) {
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
    // "Todas as fazendas": acesso da fazenda com mais de uma fazenda vê tudo junto
    if (fid === '*' && a.lista.length > 1) return json(Object.assign({ ok: true }, await dadosTodas(env, a, url.searchParams.get('safra'))));
    if (!a.lista.includes(fid)) return json({ erro: 'fazenda não liberada para este acesso' }, 403);
    const d = await dadosFazenda(env, a, fid, url.searchParams.get('safra'));
    return d ? json(Object.assign({ ok: true }, d)) : json({ erro: 'fazenda não encontrada' }, 404);
  }

  // tela Início: tempo na fazenda e mercado (praça mais próxima); com "Todas", a fazenda escolhida em loc
  if (rota === '/api/portal/inicio') {
    let fid = txt(url.searchParams.get('loc') || url.searchParams.get('id'), 80);
    if (!a.lista.includes(fid)) fid = a.lista[0];
    if (!fid) return json({ erro: 'nenhuma fazenda liberada' }, 404);
    const f = await env.DB.prepare('SELECT id, nome, talhoes, municipio, uf FROM fazendas WHERE id = ?').bind(fid).first();
    if (!f) return json({ erro: 'fazenda não encontrada' }, 404);
    const local = await localDaFazenda(f);
    let frete = null;
    try { const r = await env.DB.prepare('SELECT valor FROM config WHERE chave = ?').bind('frete:' + fid).first(); frete = r ? JSON.parse(r.valor) : null; } catch (e) { frete = null; }
    const [clima, mercado] = await Promise.all([
      local ? climaDe(local.lat, local.lon).catch((e) => ({ erro: 'previsão do tempo indisponível agora' })) : null,
      a.papel === 'operador' ? null : mercadoDaFazenda(env, local, frete).catch(() => null)
    ]);
    return new Response(JSON.stringify({ ok: true, fazenda: { id: f.id, nome: f.nome, municipio: f.municipio || '', uf: f.uf || '' }, local, clima, mercado }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  }

  // chuva dos próximos 30 dias e mapa da chuva (só dono/gerente); atualiza no domingo à noite
  if (rota === '/api/portal/chuva') {
    if (a.papel === 'operador') return json({ erro: 'disponível para o acesso da fazenda' }, 403);
    let fid = txt(url.searchParams.get('loc') || url.searchParams.get('id'), 80);
    if (!a.lista.includes(fid)) fid = a.lista[0];
    const f = fid ? await env.DB.prepare('SELECT id, nome, talhoes, municipio, uf FROM fazendas WHERE id = ?').bind(fid).first() : null;
    if (!f) return json({ erro: 'fazenda não encontrada' }, 404);
    return json(Object.assign({ ok: true, fazenda: { id: f.id, nome: f.nome } }, await chuvaDaFazenda(env, f)));
  }

  // frete da fazenda até o porto (R$/t), usado na formação do preço da soja; rt vazio = volta ao estimado
  if (rota === '/api/portal/frete' && req.method === 'POST') {
    if (a.papel === 'operador') return json({ erro: 'só o acesso da fazenda informa o frete' }, 403);
    const b = await req.json().catch(() => ({}));
    const fid = txt(b.id, 80);
    if (!a.lista.includes(fid)) return json({ erro: 'fazenda não liberada para este acesso' }, 403);
    const rt = Math.round(Number(String(b.rt == null ? '' : b.rt).replace(',', '.')) * 100) / 100;
    const porto = ['Paranaguá', 'Rio Grande', 'Santos'].includes(b.porto) ? b.porto : '';
    if (b.rt !== '' && b.rt != null && !(rt > 0 && rt < 2000)) return json({ erro: 'frete inválido (R$ por tonelada)' }, 400);
    const v = JSON.stringify({ rt: rt > 0 ? rt : 0, porto, em: hojeMT(), por: a.nome || a.login });
    await env.DB.prepare('INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor').bind('frete:' + fid, v).run();
    return json({ ok: true });
  }

  // gerente da fazenda lança a área plantada no dia (ou apaga um lançamento)
  if (rota === '/api/portal/plantio' && req.method === 'POST') {
    if (a.papel === 'operador') return json({ erro: 'o plantio por dia é lançado pelo acesso da fazenda' }, 403);
    const b = await req.json().catch(() => ({}));
    const fid = txt(b.fazenda, 80);
    if (!a.lista.includes(fid)) return json({ erro: 'fazenda não liberada para este acesso' }, 403);
    const f = await env.DB.prepare('SELECT talhoes FROM fazendas WHERE id = ? AND usuario_id = ?').bind(fid, a.dono_id).first();
    if (!f) return json({ erro: 'fazenda não encontrada' }, 404);
    const areas = areasDe(f.talhoes), talhao = txt(b.talhao, 80), data = dia(b.data);
    if (!(talhao in areas)) return json({ erro: 'talhão não encontrado no mapa da fazenda' }, 400);
    if (!data) return json({ erro: 'informe a data' }, 400);
    if (data > somaDias(hojeMT(), 1)) return json({ erro: 'a data não pode ser no futuro' }, 400);
    await garantirAgro(env);
    const safra = safraPadrao(txt(b.safra, 40));
    const ant = await env.DB.prepare('SELECT * FROM plantio WHERE fazenda_id = ? AND safra = ? AND talhao = ? AND usuario_id = ?')
      .bind(fid, safra, talhao, a.dono_id).first();
    const area = areas[talhao] || 0;
    let ha = Math.round(Number(String(b.ha || '').replace(',', '.')) * 100) / 100;
    if (!(ha > 0) && !b.apagar) return json({ erro: 'informe os hectares plantados' }, 400);
    // um lançamento por dia: lançar de novo no mesmo dia corrige o valor
    let l = lerLanc(ant).filter((x) => x.d !== data);
    if (!b.apagar) {
      const outros = l.reduce((s, x) => s + x.ha, 0);
      if (area && outros + ha > area + 0.05) return json({ erro: 'passa da área do talhão: faltam ' + (Math.round((area - outros) * 10) / 10).toString().replace('.', ',') + ' ha' }, 400);
      l.push({ d: data, ha, por: (a.nome || a.login) + ' (fazenda)' });
    }
    l.sort((x, y) => (x.d < y.d ? -1 : 1));
    const cultura = txt(b.cultura, 20) || (ant && ant.cultura) || 'soja';
    const variedade = variedadePadrao(txt(b.variedade, 80) || (ant && ant.variedade) || '', cultura);
    // data de plantio do talhão = primeiro dia lançado (é dela que sai a previsão de colheita)
    const dp = l.length ? l[0].d : (ant ? ant.data_plantio || '' : '');
    await env.DB.prepare(`INSERT INTO plantio (fazenda_id, safra, talhao, usuario_id, cultura, variedade, data_plantio, lanc, atualizado_em)
        VALUES (?,?,?,?,?,?,?,?,datetime('now'))
        ON CONFLICT(fazenda_id, safra, talhao) DO UPDATE SET cultura = excluded.cultura, variedade = excluded.variedade,
          data_plantio = excluded.data_plantio, lanc = excluded.lanc, atualizado_em = datetime('now')
        WHERE plantio.usuario_id = excluded.usuario_id`)
      .bind(fid, safra, talhao, a.dono_id, cultura, variedade, dp, JSON.stringify(l)).run();
    return json({ ok: true });
  }

  // lista de cultivares de soja (para o gerente escolher a variedade ao lançar o plantio)
  if (rota === '/api/portal/cultivares') {
    return new Response(JSON.stringify({ ok: true, catalogo: CATALOGO.map((e) => [e[0], e[2].map((x) => x[0])]) }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, max-age=86400' } });
  }

  // operador ou gerente da fazenda marca (ou desfaz) a aplicação de talhões
  if (rota === '/api/portal/aplicar' && req.method === 'POST') {
    const b = await req.json().catch(() => ({}));
    const r = await env.DB.prepare('SELECT * FROM recomendacoes WHERE id = ? AND usuario_id = ?').bind(txt(b.rec_id, 60), a.dono_id).first();
    if (!r || !a.lista.includes(r.fazenda_id)) return json({ erro: 'aplicação não encontrada' }, 404);
    const d = lerJson(r.dados, {});
    const data = dia(b.data) || hojeMT();
    if (data > somaDias(hojeMT(), 1)) return json({ erro: 'a data da aplicação não pode ser no futuro' }, 400);
    d.feito = d.feito || {}; d.feitoPor = d.feitoPor || {}; d.feitoPorId = d.feitoPorId || {};
    d.parcial = d.parcial && typeof d.parcial === 'object' ? d.parcial : {};
    const tal = (Array.isArray(b.talhoes) ? b.talhoes : []).map(String).filter((t) => (d.tal || []).includes(t));
    if (!tal.length) return json({ erro: 'escolha os talhões' }, 400);
    const quem = (a.nome || a.login) + ' (' + (a.papel === 'operador' ? 'operador' : 'fazenda') + ')';
    d.aplicReg = Array.isArray(d.aplicReg) ? d.aplicReg : [];
    // a mesma marcação reenviada (fila sem internet) não duplica
    const regId = txt(b.reg_id, 60);
    if (!b.desfazer && regId && d.aplicReg.some((g) => g.id === regId)) return json({ ok: true, repetido: true });
    const temParc = (t) => parciaisDe(d, t).length > 0;
    const salvar = async () => {
      await env.DB.prepare("UPDATE recomendacoes SET dados = ?, atualizado_em = datetime('now') WHERE id = ?").bind(JSON.stringify(d), r.id).run();
      return json({ ok: true });
    };
    // desfaz uma parte lançada (só a do próprio acesso) e o registro de campo dela
    if (b.desfazer && b.parc_id) {
      const t = tal[0], x = parciaisDe(d, t).filter((y) => y.id === txt(b.parc_id, 60))[0];
      if (!x || x.porId !== a.id) return json({ erro: 'só dá para desfazer o que você lançou' }, 403);
      d.parcial[t] = parciaisDe(d, t).filter((y) => y.id !== x.id);
      if (!d.parcial[t].length) delete d.parcial[t];
      d.aplicReg = d.aplicReg.filter((g) => g.id !== x.id);
      return salvar();
    }
    // parte do talhão (um talhão só): soma às partes já lançadas; completou a área → talhão aplicado
    let haParc = Math.round(Number(String(b.ha == null ? '' : b.ha).replace(',', '.')) * 100) / 100;
    if (!b.desfazer && haParc > 0) {
      if (tal.length !== 1) return json({ erro: 'aplicação parcial é lançada um talhão por vez' }, 400);
      const t = tal[0];
      if (d.feito[t]) return json({ erro: 'este talhão já está marcado como aplicado' }, 400);
      const f = await env.DB.prepare('SELECT talhoes FROM fazendas WHERE id = ?').bind(r.fazenda_id).first();
      const tot = areasDe(f && f.talhoes)[t] || 0, p = Number((d.parte || {})[t]), haTal = p > 0 && p < tot ? p : tot;
      const ja = haAplicada(d, t, haTal);
      if (haTal && ja + haParc < haTal - 0.05) {
        const id = regId || novoId('rg');
        (d.parcial[t] = parciaisDe(d, t)).push({ id, d: data, ha: haParc, por: quem, porId: a.id });
        b.reg_id = id; b._parcial = { t, ha: haParc };
      } else haParc = 0;   // fechou o talhão: marca aplicado normalmente
    }
    const marcados = [];
    if (b._parcial) marcados.push(b._parcial.t);
    else tal.forEach((t) => {
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
      d.aplicReg = d.aplicReg.map((g) => Object.assign({}, g, { talhoes: (g.talhoes || []).filter((t) => d.feito[t] || (g.parc && temParc(t))) })).filter((g) => g.talhoes.length);
    } else if (marcados.length) {
      const g = b.registro && typeof b.registro === 'object' ? b.registro : {};
      const hora = (v) => { const x = String(v || '').trim(); return /^\d{2}:\d{2}$/.test(x) ? x : ''; };
      const numero = (v, min, max) => { const n = Number(String(v == null ? '' : v).replace(',', '.')); return v === '' || v == null || !Number.isFinite(n) || n < min || n > max ? null : Math.round(n * 10) / 10; };
      d.aplicReg.push({
        id: txt(b.reg_id, 60) || novoId('rg'), talhoes: marcados, data, parc: b._parcial ? b._parcial.ha : undefined, inicio: hora(g.inicio), fim: hora(g.fim),
        vento: numero(g.vento, 0, 150), temp: numero(g.temp, -10, 60), umid: numero(g.umid, 0, 100),
        obs: txt(g.obs, 500), fotos: (Array.isArray(g.fotos) ? g.fotos : []).map((k) => txt(k, 200)).filter((k) => k.startsWith('aplic/' + a.dono_id + '/')).slice(0, 6),
        por: quem, porId: a.id, em: txt(b.em, 30) || new Date().toISOString()
      });
    }
    const resp = await salvar();
    // avisa no celular do consultor (dono da fazenda) que o operador lançou a aplicação
    if (!b.desfazer && marcados.length) {
      const aviso = avisarConsultor(env, a.dono_id, r, d, marcados, b._parcial, quem, data, txt(b.reg_id, 60)).catch(() => {});
      if (ctx && ctx.waitUntil) ctx.waitUntil(aviso); else await aviso;
    }
    return resp;
  }

  return json({ erro: 'rota não encontrada' }, 404);
}
