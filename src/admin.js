/* ============================================================
   admin.js — painel do administrador
   /admin                → a página
   /api/admin/resumo     → contas, relatórios e pontos das visitas
   /api/admin/usuario    → cria uma conta nova
   /api/admin/promover   → liga/desliga o acesso de administrador
   ============================================================ */

import { hashSenha, novoId } from './auth.js';
import { contagemAcessos } from './acessos.js';
import { espaco } from './midia.js';
import { TERMOS_VERSAO, garantirTermos } from './termos.js';
import { AGRO_ABAS, AGRO_CSS, AGRO_JS, AGRO_PAINEIS } from './agroadmin.js';
import { equipeDe, garantirEquipe, contasDoAdmin, definirAdm } from './equipe.js';

const esc = (s) => String(s == null ? '' : s)
  .replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/* ---------------- quem é admin ---------------- */

// semCodigo: só a marcação da conta (ex.: limite de responsáveis); sem ela, administrador só vale
// na sessão do painel que entrou com o código de confirmação
export async function ehAdmin(env, me, semCodigo) {
  if (!me || (!me.cf && !semCodigo)) return false;
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
  const porId = new Map(contas.map((c) => [c.id, c]));
  contas.forEach((c) => {
    // usuário comum de uma equipe: o prazo é o da conta do Adm (só o administrador geral define prazo)
    const tit = c.equipe_id && porId.get(c.equipe_id);
    if (c.equipe_id) {
      c.dias_conta = null; c.prazo_dias = null; c.prazo_proprio = false; c.restam = null; c.vence_em = null;
      c.equipe_nome = tit ? (tit.nome || tit.email) : '';
      return;
    }
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

/* ---------------- pagamentos: renovação do acesso (PicPay) ---------------- */

// A PicPay gera links de pagamento avulsos (Pix ou cartão) e avisa por webhook quando o cliente paga.
// Fluxo: o administrador gera o link de uma conta → envia ao cliente → ao pagar, o prazo da conta é estendido sozinho.
// Segredos (wrangler secret put): PICPAY_CLIENT_ID, PICPAY_CLIENT_SECRET (credenciais da integração "Link de Pagamento")
// e PICPAY_WEBHOOK_KEY (a chave que o painel da PicPay gera ao ativar a URL de notificação).
const PICPAY_BASE = 'https://ecommerce-api.svc.picpay.com';
let pagtoPronto = null;

function garantirPagamentos(env) {
  if (!pagtoPronto) {
    pagtoPronto = env.DB.batch([
      env.DB.prepare('CREATE TABLE IF NOT EXISTS config_pagto (chave TEXT PRIMARY KEY, valor TEXT)'),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS cobrancas (
        id             TEXT PRIMARY KEY,
        usuario_id     TEXT,
        email          TEXT,
        valor_centavos INTEGER NOT NULL,
        dias           INTEGER NOT NULL,
        status         TEXT NOT NULL DEFAULT 'aberta',
        origem         TEXT NOT NULL DEFAULT 'picpay',
        link           TEXT,
        picpay_id      TEXT,
        transacao_id   TEXT UNIQUE,
        metodo         TEXT,
        obs            TEXT,
        prazo_aplicado INTEGER NOT NULL DEFAULT 0,
        expira_em      TEXT,
        criado_em      TEXT DEFAULT (datetime('now')),
        pago_em        TEXT
      )`),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS cobrancas_usuario ON cobrancas (usuario_id)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS cobrancas_picpay ON cobrancas (picpay_id)')
    ]).catch((e) => { pagtoPronto = null; throw e; });
  }
  return pagtoPronto;
}

function reaisParaCentavos(v) {
  let t = String(v == null ? '' : v).trim().replace(/[R$\s]/g, '');
  if (t.indexOf(',') >= 0) t = t.replace(/\./g, '').replace(',', '.');
  const n = Math.round(Number(t) * 100);
  if (!Number.isFinite(n) || n < 100 || n > 5000000) throw new Error('informe um valor entre R$ 1,00 e R$ 50.000,00');
  return n;
}

function diasCiclo(v, padrao) {
  if (v === undefined || v === null || String(v).trim() === '') return padrao;
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < 1 || n > 3650) throw new Error('o período deve ser de 1 a 3650 dias');
  return n;
}

async function lerConfigPagto(env) {
  await garantirPagamentos(env);
  const { results } = await env.DB.prepare('SELECT chave, valor FROM config_pagto').all();
  const m = {};
  (results || []).forEach((r) => { m[r.chave] = r.valor; });
  return { valor_centavos: Number(m.valor_centavos) || 0, dias_ciclo: Number(m.dias_ciclo) || 30 };
}

export async function salvarConfigPagto(env, b) {
  const valor = reaisParaCentavos(b.valor);
  const dias = diasCiclo(b.dias, 30);
  await garantirPagamentos(env);
  await env.DB.batch([
    env.DB.prepare('INSERT INTO config_pagto (chave, valor) VALUES (?,?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor').bind('valor_centavos', String(valor)),
    env.DB.prepare('INSERT INTO config_pagto (chave, valor) VALUES (?,?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor').bind('dias_ciclo', String(dias))
  ]);
  return { ok: true, valor_centavos: valor, dias_ciclo: dias };
}

function sqlAgora(d) { return (d || new Date()).toISOString().replace('T', ' ').slice(0, 19); }

// como cada conta paga (Pix Automático no app do C6, ou link PicPay), valor mensal e dia do débito
let assinPronta = null;
function garantirAssinaturas(env) {
  if (!assinPronta) {
    assinPronta = env.DB.prepare(`CREATE TABLE IF NOT EXISTS assinatura_conta (
      usuario_id     TEXT PRIMARY KEY,
      forma          TEXT NOT NULL,
      valor_centavos INTEGER NOT NULL,
      dia            INTEGER NOT NULL,
      obs            TEXT,
      atualizado_em  TEXT DEFAULT (datetime('now'))
    )`).run().catch((e) => { assinPronta = null; throw e; });
  }
  return assinPronta;
}

export async function salvarAssinatura(env, b) {
  const u = await env.DB.prepare('SELECT id FROM usuarios WHERE id = ?').bind(b.id).first();
  if (!u) throw new Error('conta não encontrada');
  await garantirAssinaturas(env);
  const forma = String(b.forma || '');
  if (!forma) {
    await env.DB.prepare('DELETE FROM assinatura_conta WHERE usuario_id = ?').bind(u.id).run();
    return { ok: true, removida: true };
  }
  if (forma !== 'pix_automatico' && forma !== 'link') throw new Error('forma de cobrança inválida');
  const valor = reaisParaCentavos(b.valor);
  const dia = Math.floor(Number(b.dia));
  if (!Number.isFinite(dia) || dia < 1 || dia > 31) throw new Error('o dia do débito deve ser de 1 a 31');
  await env.DB.prepare(`INSERT INTO assinatura_conta (usuario_id, forma, valor_centavos, dia, obs, atualizado_em) VALUES (?,?,?,?,?,datetime('now'))
    ON CONFLICT(usuario_id) DO UPDATE SET forma = excluded.forma, valor_centavos = excluded.valor_centavos, dia = excluded.dia,
      obs = excluded.obs, atualizado_em = datetime('now')`).bind(u.id, forma, valor, dia, String(b.obs || '').trim().slice(0, 200)).run();
  return { ok: true };
}

export async function listarPagamentos(env, origem) {
  const config = await lerConfigPagto(env);
  const { results } = await env.DB.prepare(`SELECT id, usuario_id, email, valor_centavos, dias, status, origem, link, metodo, obs,
      criado_em, pago_em, expira_em FROM cobrancas ORDER BY criado_em DESC, rowid DESC LIMIT 100`).all();
  const hoje = new Date().toISOString().slice(0, 10);
  const cobrancas = (results || []).map((c) => {
    if (c.status === 'aberta' && c.expira_em && c.expira_em < hoje) c.status = 'expirada';
    return c;
  });
  return {
    ok: true,
    config: Object.assign(config, {
      picpay_credenciais: !!(env.PICPAY_CLIENT_ID && env.PICPAY_CLIENT_SECRET),
      picpay_webhook: !!env.PICPAY_WEBHOOK_KEY,
      webhook_url: origem + '/api/pagamentos/picpay'
    }),
    cobrancas
  };
}

// resumo por conta: quantos pagamentos, o último, e o link em aberto (se houver)
async function aplicarPagamentos(env, contas) {
  const vazio = () => ({ n: 0, ultimo: null, total_centavos: 0, aberta: null });
  contas.forEach((c) => { c.pagto = vazio(); c.assin = null; });
  try {
    await garantirPagamentos(env);
    const mapa = new Map(contas.map((c) => [c.id, c]));
    const pagos = await env.DB.prepare(`SELECT usuario_id, COUNT(*) AS n, MAX(pago_em) AS ultimo, COALESCE(SUM(valor_centavos),0) AS total
      FROM cobrancas WHERE status = 'paga' GROUP BY usuario_id`).all();
    (pagos.results || []).forEach((r) => {
      const c = mapa.get(r.usuario_id);
      if (c) { c.pagto.n = Number(r.n); c.pagto.ultimo = r.ultimo; c.pagto.total_centavos = Number(r.total); }
    });
    await garantirAssinaturas(env);
    const ass = await env.DB.prepare('SELECT usuario_id, forma, valor_centavos, dia, obs FROM assinatura_conta').all();
    (ass.results || []).forEach((r) => {
      const c = mapa.get(r.usuario_id);
      if (c) c.assin = { forma: r.forma, valor_centavos: r.valor_centavos, dia: r.dia, obs: r.obs || '' };
    });
    const hoje = new Date().toISOString().slice(0, 10);
    const abertas = await env.DB.prepare(`SELECT id, usuario_id, link, valor_centavos, criado_em, expira_em FROM cobrancas
      WHERE status = 'aberta' ORDER BY criado_em ASC, rowid ASC`).all();
    (abertas.results || []).forEach((r) => {
      const c = mapa.get(r.usuario_id);
      if (c && r.link && !(r.expira_em && r.expira_em < hoje)) c.pagto.aberta = { id: r.id, link: r.link, valor_centavos: r.valor_centavos, criado_em: r.criado_em };
    });
  } catch (e) { /* sem a tabela ainda: segue sem dados de pagamento */ }
}

/* ---- estender o prazo da conta ---- */

// novo prazo (em dias desde a criação da conta) depois de somar `dias` a partir do vencimento atual
// (ou de hoje, se já venceu). Devolve null para conta sem prazo.
async function prazoRenovado(env, usuarioId, dias) {
  await garantirPrazos(env);
  const u = await env.DB.prepare('SELECT criado_em, COALESCE(admin,0) AS admin FROM usuarios WHERE id = ?').bind(usuarioId).first();
  if (!u) return null;
  const p = await env.DB.prepare('SELECT dias FROM prazos_conta WHERE usuario_id = ?').bind(usuarioId).first();
  const atual = p ? Number(p.dias) : (Number(u.admin) === 1 ? 0 : PRAZO_PADRAO);
  if (!(atual > 0)) return null;
  const criado = criadoEm(u.criado_em);
  if (isNaN(criado)) return null;
  const base = Math.max(criado + atual * 86400000, Date.now());
  return Math.ceil((base + dias * 86400000 - criado) / 86400000);
}

// aplica o prazo de uma cobrança paga; só uma vez (prazo_aplicado)
async function aplicarPrazoDaCobranca(env, cob) {
  const jaFoi = await env.DB.prepare('SELECT prazo_aplicado FROM cobrancas WHERE id = ?').bind(cob.id).first();
  if (!jaFoi || Number(jaFoi.prazo_aplicado) === 1) return false;
  const novo = cob.usuario_id ? await prazoRenovado(env, cob.usuario_id, Number(cob.dias)) : null;
  const marca = env.DB.prepare('UPDATE cobrancas SET prazo_aplicado = 1 WHERE id = ? AND prazo_aplicado = 0').bind(cob.id);
  if (novo == null) { await marca.run(); return false; }
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO prazos_conta (usuario_id, dias, atualizado_em) VALUES (?,?,datetime('now'))
      ON CONFLICT(usuario_id) DO UPDATE SET dias = excluded.dias, atualizado_em = datetime('now')`).bind(cob.usuario_id, novo),
    marca
  ]);
  return true;
}

/* ---- PicPay ---- */

let tokenPicPay = { v: '', exp: 0 };

function trecho(txt) { return String(txt || '').replace(/\s+/g, ' ').slice(0, 220); }

async function picpayToken(env) {
  if (!env.PICPAY_CLIENT_ID || !env.PICPAY_CLIENT_SECRET) {
    throw new Error('A PicPay ainda não está ligada: faltam os segredos PICPAY_CLIENT_ID e PICPAY_CLIENT_SECRET no Worker.');
  }
  if (tokenPicPay.v && Date.now() < tokenPicPay.exp) return tokenPicPay.v;
  const r = await fetch((env.PICPAY_BASE || PICPAY_BASE) + '/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', client_id: env.PICPAY_CLIENT_ID, client_secret: env.PICPAY_CLIENT_SECRET })
  });
  const txt = await r.text();
  let j = {}; try { j = JSON.parse(txt); } catch (e) { /* resposta não é JSON */ }
  const tk = j.access_token || j.token;
  if (!r.ok || !tk) throw new Error('A PicPay não aceitou o login (' + r.status + '). Confira PICPAY_CLIENT_ID e PICPAY_CLIENT_SECRET.');
  const vida = Math.min(Number(j.expires_in) || 300, 300);
  tokenPicPay = { v: tk, exp: Date.now() + Math.max(30, vida - 30) * 1000 };
  return tk;
}

function idDoLink(link) {
  const m = String(link || '').match(/\/p\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : '';
}

async function picpayCriarLink(env, origem, cob, nome, descricao, expira) {
  const token = await picpayToken(env);
  const corpo = {
    charge: {
      name: nome,
      description: descricao,
      order_number: cob.id,
      redirect_url: origem + '/',
      payment: { methods: ['BRCODE', 'CREDIT_CARD'], brcode_arrangements: ['PICPAY', 'PIX'] },
      amounts: { product: cob.valor_centavos, delivery: 0 }
    },
    options: { allow_create_pix_key: false, card_max_installment_number: 1, expired_at: expira }
  };
  const r = await fetch((env.PICPAY_BASE || PICPAY_BASE) + '/v1/paymentlink/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(corpo)
  });
  const txt = await r.text();
  let j = {}; try { j = JSON.parse(txt); } catch (e) { /* resposta não é JSON */ }
  const d = (j && j.data && typeof j.data === 'object') ? j.data : j;
  const link = d.link || d.checkoutLink || d.checkout_link || '';
  if (!r.ok || !link) throw new Error('A PicPay recusou a cobrança (' + r.status + '): ' + trecho(txt));
  const id = String(d.id || d.paymentLinkId || d.payment_link_id || idDoLink(link) || '');
  return { link, id };
}

export async function criarCobranca(env, origem, b) {
  const u = await env.DB.prepare('SELECT id, email, nome FROM usuarios WHERE id = ?').bind(b.id).first();
  if (!u) throw new Error('conta não encontrada');
  const cfg = await lerConfigPagto(env);
  const valor = (b.valor !== undefined && b.valor !== null && String(b.valor).trim() !== '') ? reaisParaCentavos(b.valor) : cfg.valor_centavos;
  if (!valor) throw new Error('defina o valor do plano antes de gerar o link');
  const dias = diasCiclo(b.dias, cfg.dias_ciclo);
  const id = novoId('c');
  const expira = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  await env.DB.prepare(`INSERT INTO cobrancas (id, usuario_id, email, valor_centavos, dias, status, origem, expira_em)
    VALUES (?,?,?,?,?,'aberta','picpay',?)`).bind(id, u.id, u.email, valor, dias, expira).run();
  try {
    const nome = 'Relatório de Campo — renovação de ' + dias + ' dias';
    const { link, id: pid } = await picpayCriarLink(env, origem, { id, valor_centavos: valor }, nome,
      'Acesso ao AMVS Relatório · ' + (u.nome || u.email), expira);
    await env.DB.prepare('UPDATE cobrancas SET link = ?, picpay_id = ? WHERE id = ?').bind(link, pid, id).run();
    return { ok: true, id, link, valor_centavos: valor, dias, expira_em: expira };
  } catch (e) {
    await env.DB.prepare('DELETE FROM cobrancas WHERE id = ?').bind(id).run();
    throw e;
  }
}

export async function cancelarCobranca(env, cid) {
  await garantirPagamentos(env);
  const c = await env.DB.prepare('SELECT id, status, picpay_id FROM cobrancas WHERE id = ?').bind(cid).first();
  if (!c) throw new Error('cobrança não encontrada');
  if (c.status !== 'aberta') throw new Error('só dá para cancelar um link que ainda está em aberto');
  await env.DB.prepare("UPDATE cobrancas SET status = 'cancelada' WHERE id = ? AND status = 'aberta'").bind(cid).run();
  if (c.picpay_id) { // melhor esforço: desativa o link na PicPay; se falhar, o cancelamento local vale
    try {
      const token = await picpayToken(env);
      await fetch((env.PICPAY_BASE || PICPAY_BASE) + '/v1/paymentlink/' + encodeURIComponent(c.picpay_id) + '/inactive', {
        method: 'POST', headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' }
      });
    } catch (e) { /* segue */ }
  }
  return { ok: true };
}

// pagamento recebido fora da PicPay (Pix direto, dinheiro…): o administrador registra e o prazo é estendido
export async function pagamentoManual(env, b) {
  const u = await env.DB.prepare('SELECT id, email FROM usuarios WHERE id = ?').bind(b.id).first();
  if (!u) throw new Error('conta não encontrada');
  await garantirPagamentos(env);
  const cfg = await lerConfigPagto(env);
  const dias = diasCiclo(b.dias, cfg.dias_ciclo);
  const temValor = b.valor !== undefined && b.valor !== null && String(b.valor).trim() !== '';
  const valor = temValor ? reaisParaCentavos(b.valor) : (cfg.valor_centavos || 100);
  const id = novoId('c');
  await env.DB.prepare(`INSERT INTO cobrancas (id, usuario_id, email, valor_centavos, dias, status, origem, obs, pago_em)
    VALUES (?,?,?,?,?,'paga','manual',?,datetime('now'))`)
    .bind(id, u.id, u.email, valor, dias, String(b.obs || '').trim().slice(0, 200)).run();
  const mudou = await aplicarPrazoDaCobranca(env, { id, usuario_id: u.id, dias });
  return { ok: true, id, prazo_estendido: mudou };
}

/* ---- webhook da PicPay (rota pública; protegida pela chave) ---- */

async function iguais(a, b) {
  const te = new TextEncoder();
  const [x, y] = await Promise.all([crypto.subtle.digest('SHA-256', te.encode(String(a))), crypto.subtle.digest('SHA-256', te.encode(String(b)))]);
  const u = new Uint8Array(x), v = new Uint8Array(y);
  let dif = 0;
  for (let i = 0; i < u.length; i++) dif |= u[i] ^ v[i];
  return dif === 0;
}

export async function webhookPicPay(env, req) {
  if (!env.PICPAY_WEBHOOK_KEY) return { status: 503, corpo: { erro: 'webhook não configurado' } };
  const cab = (req.headers.get('authorization') || '').trim();
  const chave = String(env.PICPAY_WEBHOOK_KEY);
  const ok = (await iguais(cab, chave)) || (await iguais(cab.replace(/^Bearer\s+/i, ''), chave));
  if (!ok) return { status: 401, corpo: { erro: 'não autorizado' } };

  let ev = null;
  try { ev = await req.json(); } catch (e) { return { status: 400, corpo: { erro: 'corpo inválido' } }; }
  const dado = (ev && ev.data) || {};
  const tx = dado.transaction || {};
  const ch = dado.charge || {};
  await garantirPagamentos(env);

  const pid = String(ch.paymentLinkId || idDoLink(ch.checkoutLink) || '');
  const transacao = String(tx.id || '');

  if (ev.type === 'REFUND') {
    const orig = String(tx.originalTransactionId || '');
    if (orig) await env.DB.prepare("UPDATE cobrancas SET status = 'estornada' WHERE transacao_id = ?").bind(orig).run();
    return { status: 200, corpo: { ok: true, evento: 'estorno' } };
  }
  if (ev.type !== 'PAYMENT' || tx.status !== 'PAYED' || !transacao) return { status: 200, corpo: { ok: true, ignorado: true } };

  // a mesma notificação pode chegar mais de uma vez
  const repetida = await env.DB.prepare('SELECT * FROM cobrancas WHERE transacao_id = ?').bind(transacao).first();
  if (repetida) {
    await aplicarPrazoDaCobranca(env, repetida);
    return { status: 200, corpo: { ok: true, repetido: true } };
  }

  const cob = pid ? await env.DB.prepare('SELECT * FROM cobrancas WHERE picpay_id = ? ORDER BY criado_em DESC, rowid DESC LIMIT 1').bind(pid).first() : null;
  if (!cob) return { status: 200, corpo: { ok: true, ignorado: 'cobrança desconhecida' } };

  const metodo = String(tx.paymentType || '').toLowerCase();
  const recebido = Number(tx.amount != null ? tx.amount : ch.amount);
  if (Number.isFinite(recebido) && recebido < Number(cob.valor_centavos)) {
    await env.DB.prepare("UPDATE cobrancas SET status = 'divergente', transacao_id = ?, metodo = ?, obs = ? WHERE id = ? AND status = 'aberta'")
      .bind(transacao, metodo, 'valor recebido menor: ' + recebido + ' centavos', cob.id).run();
    return { status: 200, corpo: { ok: true, divergente: true } };
  }

  try {
    let alvo = cob;
    const r = await env.DB.prepare(`UPDATE cobrancas SET status = 'paga', transacao_id = ?, metodo = ?, pago_em = datetime('now')
      WHERE id = ? AND status IN ('aberta','cancelada')`).bind(transacao, metodo, cob.id).run();
    if (!(r.meta && r.meta.changes > 0)) {
      // link já pago antes (ou fechado): o dinheiro entrou de novo, então vira um novo pagamento
      const id = novoId('c');
      await env.DB.prepare(`INSERT INTO cobrancas (id, usuario_id, email, valor_centavos, dias, status, origem, link, picpay_id, transacao_id, metodo, pago_em)
        VALUES (?,?,?,?,?,'paga','picpay',?,?,?,?,datetime('now'))`)
        .bind(id, cob.usuario_id, cob.email, cob.valor_centavos, cob.dias, cob.link, cob.picpay_id, transacao, metodo).run();
      alvo = { id, usuario_id: cob.usuario_id, dias: cob.dias };
    }
    await aplicarPrazoDaCobranca(env, alvo);
  } catch (e) {
    // transação repetida em paralelo (chave única): já foi tratada
    const ja = await env.DB.prepare('SELECT * FROM cobrancas WHERE transacao_id = ?').bind(transacao).first();
    if (ja) { await aplicarPrazoDaCobranca(env, ja); return { status: 200, corpo: { ok: true, repetido: true } }; }
    return { status: 500, corpo: { erro: 'falha ao registrar' } };
  }
  return { status: 200, corpo: { ok: true } };
}

// acesso só à Timeline: o painel recebe só quem é a pessoa e de quem é a Timeline (nenhum dado de relatório ou conta)
export async function resumoLeitor(env, me, dono) {
  const d = await env.DB.prepare('SELECT nome, email FROM usuarios WHERE id = ?').bind(dono).first();
  return {
    ok: true,
    eu: { admin: false, leitor: true, id: me.id, nome: me.nome || '', email: me.email || '', papel: null, equipe: 0, dono: d ? (d.nome || d.email) : '' },
    contas: [], relatorios: [], pontos: [], pontosOutros: [], visitasDia: null,
    totais: { contas: 0, relatorios: 0, registros: 0, bytes: 0, porTipo: {}, limite: 0 }
  };
}

export async function resumoAdmin(env, me, adm) {
  // conta comum: enxerga o que é dela e da equipe (Adm e colegas); administrador enxerga tudo
  await garantirEquipe(env).catch(() => {});
  // administrador geral: os dados só da conta dele, da equipe e das contas criadas com "visualizar dados";
  // das demais, só os números (quantidade de relatórios) na lista de contas
  const eq = adm ? null : await equipeDe(env, me.id).catch(() => ({ ids: [me.id], papel: null }));
  const ids = adm ? await contasDoAdmin(env, me).catch(() => [me.id]) : eq.ids;
  const meu = ' AND r.usuario_id IN (' + ids.map(() => '?').join(',') + ')';
  const arg = ids;
  await garantirTermos(env).catch(() => {});
  const contas = await env.DB.prepare(`
    SELECT u.id, u.email, u.nome, u.criado_em, COALESCE(u.admin,0) AS admin, u.papel, u.cota, u.equipe_id, COALESCE(u.admin_ve,0) AS admin_ve, u.documento,
           (SELECT t.aceito_em FROM termos_aceite t WHERE t.usuario_id = u.id AND t.versao = '${TERMOS_VERSAO}') AS termos_em,
           (SELECT COUNT(*) FROM relatorios r WHERE r.usuario_id = u.id) AS relatorios,
           (SELECT COUNT(*) FROM relatorios r WHERE r.usuario_id = u.id AND r.status='publicado') AS publicados,
           (SELECT COUNT(*) FROM produtores p WHERE p.usuario_id = u.id) AS produtores,
           (SELECT COUNT(*) FROM fazendas f WHERE f.usuario_id = u.id) AS fazendas,
           (SELECT MAX(r.atualizado_em) FROM relatorios r WHERE r.usuario_id = u.id) AS ultima_atividade
      FROM usuarios u
     WHERE ${adm ? 'u.leitor_de IS NULL' : 'u.id = ?'}
     ORDER BY u.criado_em DESC
  `).bind(...(adm ? [] : [me.id])).all();

  if (adm) { await aplicarPrazos(env, contas.results || []); await aplicarPagamentos(env, contas.results || []); }
  // responsáveis cadastrados em cada conta (nomes que aparecem para escolher no relatório)
  try {
    const rs = (await env.DB.prepare('SELECT usuario_id, nome FROM responsaveis ORDER BY criado_em').all()).results || [];
    const por = {}; rs.forEach((x) => { (por[x.usuario_id] = por[x.usuario_id] || []).push(x.nome); });
    (contas.results || []).forEach((c) => { c.responsaveis = por[c.id] || []; });
  } catch (e) { /* tabela ainda não criada */ }

  const relatorios = await env.DB.prepare(`
    SELECT r.id, r.usuario_id, r.fazenda, r.produtor, r.safra, r.servico, r.responsavel,
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

  // administrador geral: as visitas das outras contas entram no mapa só como ponto (local aproximado, data e situação),
  // sem fazenda, produtor, conta nem link do relatório
  let pontosOutros = [];
  if (adm) {
    try {
      const { results } = await env.DB.prepare(`
        SELECT ROUND(AVG(i.lat), 3) AS lat, ROUND(AVG(i.lon), 3) AS lon, r.status, substr(COALESCE(r.data_inicio, r.criado_em), 1, 10) AS data
          FROM itens i JOIN relatorios r ON r.id = i.relatorio_id
         WHERE i.lat IS NOT NULL AND i.lon IS NOT NULL AND r.usuario_id NOT IN (${ids.map(() => '?').join(',')})
         GROUP BY i.relatorio_id
         LIMIT 2000`).bind(...ids).all();
      pontosOutros = results || [];
    } catch (e) { /* o mapa segue com os pontos liberados */ }
  }

  const acessos = await contagemAcessos(env);
  // corrigir textos: o autor, o Adm da equipe e o administrador geral
  (relatorios.results || []).forEach((r) => { r.meu = r.usuario_id === me.id; r.pode_corrigir = !!(adm || r.meu || (eq && eq.papel === 'adm')); });
  (relatorios.results || []).forEach((r) => {
    const a = acessos[r.id] || {};
    r.acessos = Number(a.total || 0);
    r.visitantes = Number(a.visitantes || 0);
    r.ultimo_acesso = a.ultimo || null;
  });

  // espaço ocupado é número (não mostra conteúdo): o administrador continua vendo o total e o de cada conta
  const tudo = adm ? '' : meu, argT = adm ? [] : arg;
  const itens = adm
    ? await env.DB.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(bytes),0) AS bytes FROM itens').first()
    : await env.DB.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(i.bytes),0) AS bytes FROM itens i
        JOIN relatorios r ON r.id = i.relatorio_id WHERE 1=1${meu}`).bind(...arg).first();

  // espaço de cada conta, separado por tipo (foto, vídeo, áudio)
  const usoTipo = await env.DB.prepare(`
    SELECT r.usuario_id AS uid, i.tipo, COUNT(*) AS n, COALESCE(SUM(i.bytes),0) AS bytes
      FROM itens i JOIN relatorios r ON r.id = i.relatorio_id
     WHERE i.tipo != 'texto'${tudo}
     GROUP BY r.usuario_id, i.tipo
  `).bind(...argT).all();
  const porTipo = {};
  const contaPor = new Map((contas.results || []).map((c) => [c.id, c]));
  (usoTipo.results || []).forEach((u) => {
    const t = porTipo[u.tipo] || (porTipo[u.tipo] = { n: 0, bytes: 0 });
    t.n += Number(u.n || 0); t.bytes += Number(u.bytes || 0);
    const c = contaPor.get(u.uid);
    if (c) {
      c.espaco = c.espaco || { bytes: 0 };
      c.espaco[u.tipo] = { n: Number(u.n || 0), bytes: Number(u.bytes || 0) };
      c.espaco.bytes += Number(u.bytes || 0);
    }
  });
  const lim = adm ? await espaco(env).catch(() => ({})) : {};
  // visitas por dia de TODAS as contas (só a quantidade) para o gráfico do administrador geral
  const visitasDia = adm ? ((await env.DB.prepare(`SELECT substr(COALESCE(data_inicio, criado_em), 1, 10) AS d, COUNT(*) AS n
      FROM relatorios WHERE COALESCE(data_inicio, criado_em) IS NOT NULL GROUP BY d ORDER BY d DESC LIMIT 30`).all().catch(() => ({}))).results || null) : null;

  return {
    ok: true,
    eu: { admin: !!adm, id: me.id, nome: me.nome || '', email: me.email || '', papel: eq ? eq.papel : null, equipe: eq && eq.papel ? eq.ids.length : 0 },
    contas: contas.results || [],
    relatorios: relatorios.results || [],
    pontos: pontos.results || [],
    pontosOutros,
    visitasDia,
    totais: {
      contas: (contas.results || []).length,
      // administrador: a quantidade de todas as contas (só o número); a lista acima traz só os relatórios liberados
      relatorios: adm ? (contas.results || []).reduce((a, c) => a + Number(c.relatorios || 0), 0) : (relatorios.results || []).length,
      publicados: adm ? (contas.results || []).reduce((a, c) => a + Number(c.publicados || 0), 0) : null,
      registros: Number(itens && itens.n || 0),
      bytes: Number(itens && itens.bytes || 0),
      porTipo,
      limite: Number(lim.limite || 0)
    }
  };
}

// áreas (talhões do KML importado) das fazendas, para desenhar no mapa do painel.
// conta comum vê só as dela; administrador vê todas. As coordenadas vão com 5 casas (~1 m) para pesar menos.
export async function areasAdmin(env, me, adm) {
  const ids = adm ? await contasDoAdmin(env, me).catch(() => [me.id]) : [me.id];   // admin: só as contas liberadas
  const { results } = await env.DB.prepare(`
    SELECT f.id, f.nome, f.area_ha, f.talhoes, u.email AS conta, p.nome AS produtor
      FROM fazendas f
      LEFT JOIN usuarios u ON u.id = f.usuario_id
      LEFT JOIN produtores p ON p.id = f.produtor_id
     WHERE f.talhoes IS NOT NULL AND f.talhoes != '' AND f.usuario_id IN (${ids.map(() => '?').join(',')})
     LIMIT 400
  `).bind(...ids).all();
  const arred = (c) => Array.isArray(c)
    ? (typeof c[0] === 'number' ? c.slice(0, 2).map((v) => Math.round(v * 1e5) / 1e5) : c.map(arred))
    : c;
  const areas = [];
  (results || []).forEach((r) => {
    let gj = null;
    try { gj = JSON.parse(r.talhoes); } catch (e) { return; }
    const feats = ((gj && gj.features) || [])
      .filter((f) => f && f.geometry && f.geometry.coordinates)
      .map((f) => ({
        type: 'Feature',
        properties: { nome: (f.properties || {}).nome || '', area_ha: (f.properties || {}).area_ha || null },
        geometry: { type: f.geometry.type, coordinates: arred(f.geometry.coordinates) }
      }));
    if (feats.length) areas.push({ id: r.id, fazenda: r.nome, produtor: r.produtor || '', conta: r.conta || '', area_ha: r.area_ha, features: feats });
  });
  return { ok: true, areas };
}

export async function criarConta(env, corpo) {
  const email = String(corpo.email || '').trim().toLowerCase();
  const senha = String(corpo.senha || '');
  if (!email.includes('@')) throw new Error('informe um e-mail válido');
  if (senha.length < 6) throw new Error('a senha precisa de pelo menos 6 caracteres');
  const existe = await env.DB.prepare('SELECT id FROM usuarios WHERE email = ?').bind(email).first();
  if (existe) throw new Error('já existe uma conta com esse e-mail');
  const prazo = lerPrazo(corpo.prazo_dias, corpo.admin ? 0 : PRAZO_PADRAO);
  // Adm de equipe: confere a quantidade de usuários comuns antes de criar a conta
  const cota = Math.floor(Number(corpo.cota));
  if (corpo.equipe_adm && !(cota >= 0 && cota <= 500)) throw new Error('informe quantos usuários comuns o Adm pode criar (0 a 500)');
  const doc = lerDocumento(corpo.documento);
  const id = novoId('u');
  await env.DB.prepare('INSERT INTO usuarios (id,email,senha_hash,nome,admin) VALUES (?,?,?,?,?)')
    .bind(id, email, await hashSenha(senha), String(corpo.nome || '').trim(), corpo.admin ? 1 : 0).run();
  // "visualizar dados": o administrador geral passa a ver os relatórios desta conta (as antigas ficam só com os números)
  if (corpo.equipe_adm && !corpo.admin) { try { await definirAdm(env, id, true, cota); } catch (e) { /* a conta já existe; o Adm pode ser marcado depois em Contas */ } }
  if (corpo.ver_dados) { try { await garantirEquipe(env); await env.DB.prepare('UPDATE usuarios SET admin_ve = 1 WHERE id = ?').bind(id).run(); } catch (e) {} }
  if (doc) { try { await garantirEquipe(env); await env.DB.prepare('UPDATE usuarios SET documento = ? WHERE id = ?').bind(doc, id).run(); } catch (e) { /* pode ser preenchido depois em Contas */ } }
  try { await definirPrazo(env, id, prazo); } catch (e) { /* a conta já existe; o prazo pode ser ajustado depois */ }
  return { ok: true, id, email, prazo_dias: prazo };
}

// CPF (11 dígitos) ou CNPJ (14 dígitos), guardado só com os números; vazio = sem documento
function lerDocumento(v) {
  const d = String(v || '').replace(/[^0-9]/g, '');
  if (!d) return '';
  if (d.length !== 11 && d.length !== 14) throw new Error('CPF tem 11 números e CNPJ tem 14: confira o documento');
  return d;
}
// editar a conta pelo painel: nome e CPF/CNPJ
export async function salvarDadosConta(env, id, corpo) {
  const nome = String(corpo.nome || '').trim().slice(0, 120);
  if (!nome) throw new Error('informe o nome');
  const doc = lerDocumento(corpo.documento);
  await garantirEquipe(env);
  const r = await env.DB.prepare('UPDATE usuarios SET nome = ?, documento = ? WHERE id = ?').bind(nome, doc || null, String(id || '')).run();
  if (!r.meta || !r.meta.changes) throw new Error('conta não encontrada');
  return { ok: true, nome, documento: doc };
}
export async function salvarDocumento(env, id, valor) {
  const doc = lerDocumento(valor);
  await garantirEquipe(env);
  const r = await env.DB.prepare('UPDATE usuarios SET documento = ? WHERE id = ?').bind(doc || null, String(id || '')).run();
  if (!r.meta || !r.meta.changes) throw new Error('conta não encontrada');
  return { ok: true, documento: doc };
}

export async function promover(env, id, valor) {
  await env.DB.prepare('UPDATE usuarios SET admin = ? WHERE id = ?').bind(valor ? 1 : 0, id).run();
  return { ok: true };
}

// apaga a conta e tudo que é dela: relatórios, fotos/vídeos (R2), cadastros, responsáveis, prazo.
// Só o administrador chama; não apaga a si mesmo nem outra conta de administrador, e exige o e-mail digitado para confirmar.
export async function excluirConta(env, me, id, emailConfirma) {
  const u = await env.DB.prepare('SELECT id, email, COALESCE(admin,0) AS admin FROM usuarios WHERE id = ?').bind(id).first();
  if (!u) throw new Error('conta não encontrada');
  if (u.id === me.id) throw new Error('não dá para excluir a sua própria conta');
  if (Number(u.admin) === 1) throw new Error('essa conta é de administrador: tire o acesso de admin antes de excluir');
  if (String(emailConfirma || '').trim().toLowerCase() !== String(u.email).toLowerCase()) {
    throw new Error('o e-mail digitado não confere com o da conta');
  }

  const { results: itens } = await env.DB.prepare(
    'SELECT i.midia, i.thumb FROM itens i JOIN relatorios r ON r.id = i.relatorio_id WHERE r.usuario_id = ?').bind(id).all();
  const chaves = new Set();
  (itens || []).forEach((i) => [i.midia, i.thumb].forEach((k) => {
    if (k && typeof k === 'string' && !k.startsWith('drive:') && !k.startsWith('data:') && !/^https?:/.test(k)) chaves.add(k);
  }));
  const nRel = await env.DB.prepare('SELECT COUNT(*) AS n FROM relatorios WHERE usuario_id = ?').bind(id).first();

  // tabelas criadas sozinhas (podem ainda não existir): erro aqui não impede a exclusão
  const opcionais = [
    'DELETE FROM acessos WHERE relatorio_id IN (SELECT id FROM relatorios WHERE usuario_id = ?)',
    'DELETE FROM responsaveis WHERE usuario_id = ?',
    'DELETE FROM prazos_conta WHERE usuario_id = ?'
  ];
  for (const q of opcionais) { try { await env.DB.prepare(q).bind(id).run(); } catch (e) { /* tabela ainda não existe */ } }

  await env.DB.batch([
    env.DB.prepare('DELETE FROM itens WHERE relatorio_id IN (SELECT id FROM relatorios WHERE usuario_id = ?)').bind(id),
    env.DB.prepare('DELETE FROM relatorios WHERE usuario_id = ?').bind(id),
    env.DB.prepare('DELETE FROM fazendas WHERE usuario_id = ?').bind(id),
    env.DB.prepare('DELETE FROM produtores WHERE usuario_id = ?').bind(id),
    env.DB.prepare('DELETE FROM safras WHERE usuario_id = ?').bind(id),
    env.DB.prepare('DELETE FROM perfis WHERE usuario_id = ?').bind(id),
    env.DB.prepare('DELETE FROM usuarios WHERE id = ?').bind(id)
  ]);

  let midias = 0;
  if (env.MIDIA && chaves.size) {
    const lista = [...chaves];
    for (let i = 0; i < lista.length; i += 500) {
      try { await env.MIDIA.delete(lista.slice(i, i + 500)); midias += Math.min(500, lista.length - i); } catch (e) { /* sobra no armazenamento, sem prejuízo */ }
    }
  }
  return { ok: true, email: u.email, relatorios: Number(nRel && nRel.n || 0), midias };
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
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="ADM Relatório">
<link rel="apple-touch-icon" href="/api/icone/adm.png">
<link rel="manifest" href="/admin.webmanifest">
<title>Painel · ${esc(empresa || 'AMVS Relatório')}</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css">
<style>
:root{--verde:#1B7A43;--verde-escuro:#146034;--verde-claro:#E8F4EC;--texto:#1B2B22;
 --fraco:#6B7B72;--linha:#E4E9E6;--erro:#D93025;--altura:100dvh}
*{box-sizing:border-box}
body{margin:0;background:#F2F4F2;color:var(--texto);font-size:15px;line-height:1.5;
 font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
header.topo{background:var(--verde);color:#fff;padding:14px 18px;display:flex;align-items:center;gap:12px}
header.topo h1{margin:0;font-size:17px;flex:1;min-width:0}
header.topo .topo-id{flex:1;display:flex;align-items:center;gap:12px;min-width:0}
header.topo .topo-logo{flex:none;background:#fff;border-radius:10px;height:46px;max-width:120px;padding:4px 7px;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.18)}
header.topo .topo-logo[hidden]{display:none}
header.topo .topo-logo img{max-height:38px;max-width:106px;object-fit:contain;display:block}
@media (max-width:420px){header.topo{gap:8px;padding:12px 14px}header.topo .topo-id{gap:10px}header.topo .topo-logo{height:40px;max-width:84px;padding:3px 5px}header.topo .topo-logo img{max-height:33px;max-width:74px}
  header.topo #btnAtualizar{font-size:0;padding:7px 10px}header.topo #btnAtualizar::before{content:'↻';font-size:18px;line-height:1}}
header.topo small{opacity:.85;font-size:12px;display:block;font-weight:400}
header.topo button{background:rgba(255,255,255,.18);color:#fff;border:none;border-radius:8px;padding:7px 12px;font-size:13px}
.abas{display:flex;gap:8px;overflow-x:auto;padding:12px 16px 0;max-width:1100px;margin:0 auto;scrollbar-width:none}
.abas.uma{display:none}
.abas button{flex:none;background:#fff;border:1px solid var(--linha);border-radius:999px;padding:7px 16px;font-size:14px;
 color:var(--texto);font-weight:600;white-space:nowrap;cursor:pointer}
.abas button.on{background:var(--verde);color:#fff;border-color:var(--verde)}
.abas button.fora{display:none}
main{padding:16px;max-width:1100px;margin:0 auto}
.painel{display:none}.painel.on{display:block}
.oculto{display:none!important}
.cartoes{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:18px}
.kpis-box{margin-bottom:16px}.kpis-box .kpi-cartoes{display:none;margin:10px 0 0}.kpis-box.aberto .kpi-cartoes{display:grid}
.kpi-cab{display:flex;align-items:center;gap:12px;width:100%;background:#fff;border:1px solid var(--linha);border-radius:14px;padding:10px 14px;text-align:left;cursor:pointer;font:inherit;color:inherit}
.kpi-txt{flex:1;min-width:0}.kpi-txt b{display:block;font-size:19px;color:var(--verde-escuro)}.kpi-txt b small{font-size:13px;font-weight:500;color:var(--fraco)}.kpi-txt>small{font-size:12.5px;color:var(--fraco)}
.kpi-cab i{font-style:normal;color:var(--verde);font-size:15px}
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
.senha-box{position:relative}.senha-box input{padding-right:84px}
.ver-senha{position:absolute;right:4px;top:50%;transform:translateY(-50%);border:0;background:none;color:var(--verde);font-weight:600;font-size:14px;padding:8px 10px;cursor:pointer}
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
.resp-linha{display:grid;grid-template-columns:minmax(90px,170px) 1fr auto;gap:10px;align-items:center;padding:6px 0;font-size:13px}
.resp-linha .nome{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.resp-linha .nome small{display:block;font-weight:400;color:var(--fraco);font-size:11px;overflow:hidden;text-overflow:ellipsis}
.resp-linha .trilho{height:14px;background:#eef3ef;border-radius:7px;overflow:hidden}
.resp-linha .trilho i{display:block;height:100%;background:var(--verde);border-radius:7px}
.resp-linha .num{text-align:right;white-space:nowrap}
.cab-caixa{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px}
.cab-caixa h2{margin:0}
.prz-cab{display:flex;width:100%;justify-content:space-between;align-items:center;gap:10px;text-align:left;font:inherit;font-size:14px;background:var(--fundo,#F4F7F5);border:1px solid #E1E7E3;border-radius:12px;padding:12px 14px;cursor:pointer;color:inherit}
.prz-cab span{line-height:1.5}.prz-cab i{font-style:normal;font-size:13px;color:#1B7A43;font-weight:700;white-space:nowrap}
.prz-v{color:#C62828}.prz-p{color:#8A5A00}
#przLista{margin-top:12px}
.btn-mini{border:1px solid var(--linha);background:#fff;color:var(--verde-escuro);border-radius:8px;padding:5px 10px;font-size:12.5px;cursor:pointer;white-space:nowrap}
.btn-mini:hover{background:#f1f6f2}
.caixa.cheia{position:fixed;top:0;left:0;right:0;bottom:0;z-index:2000;margin:0;border-radius:0;display:flex;flex-direction:column;padding:12px}
.caixa.cheia #mapa{flex:1;height:auto;min-height:0}
body.sem-rolagem{overflow:hidden}
.resp-linha.clic{cursor:pointer;border-radius:8px;margin:0 -6px;padding:6px}
.resp-linha.clic:hover{background:#f1f6f2}
.resp-linha.clic .nome{text-decoration:underline;text-decoration-color:#b9d3c0;text-underline-offset:3px}
.chip-filtro{display:inline-flex;align-items:center;gap:8px;background:#e8f3ec;color:var(--verde-escuro);border-radius:999px;padding:5px 6px 5px 12px;font-size:13px;margin:0 0 12px}
.chip-filtro button{border:none;background:#fff;color:var(--verde-escuro);border-radius:999px;padding:3px 10px;font-size:12px;cursor:pointer}
.resp-linha .num span{display:block;color:var(--fraco);font-size:11px}
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
/* ---------- timeline (estilo Instagram), equipe e correção de textos ---------- */
#feed{max-width:520px;margin:0 auto}
.post{background:#fff;border:1px solid var(--linha);border-radius:14px;margin-bottom:14px;overflow:hidden}
.post .ph{display:flex;align-items:center;gap:10px;padding:10px 12px}
.post .av{width:38px;height:38px;border-radius:50%;flex:none;display:grid;place-items:center;color:#fff;font-weight:800;font-size:14px;background:linear-gradient(135deg,#1B7A43,#7BC24A);box-shadow:0 0 0 2px #fff,0 0 0 4px #1B7A43}
.post .ph b{display:block;font-size:14.5px}.post .ph small{font-size:12px;color:var(--fraco)}
.post .ph .ac{margin-left:auto;display:flex;gap:6px}
.post .car{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;background:#111}
.post .car::-webkit-scrollbar{display:none}
.post .sl{flex:0 0 100%;scroll-snap-align:start;position:relative}
.post .sl img,.post .sl video{display:block;width:100%;aspect-ratio:4/5;object-fit:cover;background:#111}
.post .sl .n{position:absolute;top:8px;right:8px;background:rgba(0,0,0,.55);color:#fff;font-size:11.5px;border-radius:10px;padding:2px 8px}
.post .lg{padding:9px 12px 12px;font-size:14px;line-height:1.4}
.post .lg .tal{display:inline-block;font-size:11.5px;background:#E8F4EC;color:#146034;border-radius:999px;padding:2px 8px;margin:0 6px 4px 0;font-weight:600}
.post .lg .obs{margin-top:8px;padding-top:8px;border-top:1px solid #EEF2EF;color:#3E4F45;font-size:13px;white-space:pre-wrap}
.post .lg a{color:var(--verde);font-weight:700;text-decoration:none}
.feedvz{background:#fff;border:1px dashed var(--linha);border-radius:12px;padding:22px;text-align:center;color:var(--fraco)}
.eq-cota{display:flex;align-items:center;gap:10px;margin:2px 0 12px;font-size:13px;color:var(--fraco)}
.eq-cota .bar{flex:1;height:8px;border-radius:5px;background:#E3EAE5;overflow:hidden}.eq-cota .bar i{display:block;height:100%;background:var(--verde)}
.eq-u{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:9px 0;border-top:1px solid #EEF2EF}.eq-ac{display:flex;gap:6px;flex:none}.btn-mini.ruim{color:#8A1C12;border-color:#E9B8B2}.btn-mini.ruim:hover{background:#FDECEA}.eq-form{flex-basis:100%;padding:6px 0 4px 46px}.eq-u:first-child{border-top:0}
.eq-u .av{width:36px;height:36px;border-radius:50%;background:#DDEFE3;color:#146034;display:grid;place-items:center;font-weight:800;flex:none;font-size:13px}
.eq-u .t{flex:1;min-width:0}.eq-u .t b{display:block;font-size:14px}.eq-u .t small{color:var(--fraco);font-size:12px}
.modal.corr{max-width:620px;max-height:92vh;overflow-y:auto}
.corr-it{display:flex;gap:10px;padding:10px 0;border-top:1px solid #EEF2EF}.corr-it img{width:70px;height:70px;border-radius:10px;object-fit:cover;flex:none;background:#eee}
.corr-it .vd{width:70px;height:70px;border-radius:10px;background:#222;color:#fff;display:grid;place-items:center;flex:none;font-size:22px}
.corr-it textarea,.corr textarea{width:100%;font:inherit;font-size:14px;border:1px solid #CFD8D3;border-radius:10px;padding:8px;resize:vertical;min-height:58px}
.corr-it small{display:block;color:var(--fraco);font-size:11.5px;margin-bottom:3px}
.sino{position:relative;font-size:19px;line-height:1;padding:6px 10px !important}
.sino b{position:absolute;top:-4px;right:-4px;background:#E53935;color:#fff;font-size:11px;border-radius:10px;padding:1px 6px;font-weight:800;line-height:16px}
.post .vis{padding:9px 12px 8px;font-size:13.5px;color:#1B7A43;border-top:1px solid #EEF2EF}.post .vis b{font-weight:700}
.post .vis button{border:0;background:none;padding:0;font:inherit;font-weight:600;color:#1B7A43;cursor:pointer}
.post .visd{margin-top:6px;font-size:12.5px;color:#56655C;line-height:1.5}
.post .vis + .acs{border-top:0}
.post .acs{display:flex;gap:4px;padding:6px 6px 0;border-top:1px solid #EEF2EF}
.post .acs button{flex:1;border:0;background:none;padding:9px 2px;border-radius:9px;font:inherit;font-size:13.5px;font-weight:600;color:#33443A;cursor:pointer;white-space:nowrap}
.post .acs button:active{background:#F1F4F2}.post .acs button.on{color:#E53935}.post .acs button[disabled]{opacity:.45}
.post .cur{padding:2px 12px 0;font-size:13px;color:#3E4F45}
.post .coms{padding:4px 12px 0}.post .cm{font-size:13.5px;padding:3px 0;line-height:1.35}.post .cm b{margin-right:5px}.post .cm small{color:var(--fraco);margin-left:4px;font-size:11.5px}
.post .cm button{border:0;background:none;color:var(--fraco);font-size:11.5px;cursor:pointer;padding:0 0 0 6px;text-decoration:underline}
.post .ncm{display:flex;gap:8px;align-items:center;padding:8px 12px 12px}
.post .ncm input{flex:1;font:inherit;font-size:14px;border:1px solid #D5DED9;border-radius:999px;padding:8px 12px;min-width:0}
.post .ncm button{border:0;background:none;color:var(--verde);font-weight:700;font-size:14px;cursor:pointer}
.nts{margin:-6px -6px 0}.nt{display:flex;gap:10px;padding:10px 8px;border-bottom:1px solid #EEF2EF;align-items:center;cursor:pointer;border-radius:10px}
.nt.nova{background:#F1F8F3}.nt .t p{margin:3px 0 0;font-size:13px;color:#3E4F45;line-height:1.45;white-space:pre-line}
.nt-fil{display:flex;gap:6px;margin:0 0 10px;overflow:auto}.nt-fil button{background:#fff;border:1px solid #D5DED9;border-radius:999px;padding:6px 12px;font:inherit;font-size:13px;white-space:nowrap;color:#33443A;cursor:pointer}
.nt-fil button.on{background:#1B7A43;color:#fff;border-color:#1B7A43}
.nt-push{display:flex;gap:10px;align-items:center;background:#E8F4EC;border-radius:12px;padding:10px 12px;margin:0 0 12px;font-size:13px}.nt-push button{flex:none}
.nt-dia{font-size:12px;font-weight:700;color:var(--fraco);text-transform:uppercase;letter-spacing:.04em;margin:12px 0 4px}.nt .ic{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;font-size:16px;flex:none}
.nt .t{flex:1;font-size:13.5px;min-width:0}.nt .t small{display:block;color:var(--fraco);font-size:12px;margin-top:2px}
.nt img{width:44px;height:44px;border-radius:8px;object-fit:cover;flex:none;background:#eee}
.marcar{display:flex;align-items:center;gap:9px;font-size:13.5px;margin:2px 0 12px}
.marcar input{width:18px;height:18px;accent-color:var(--verde)}
@media(max-width:560px){ .linha2{grid-template-columns:1fr} #mapa{height:300px} }
.caixa{border-radius:16px;padding:16px}
.cartao{border-radius:14px}
.cartao b{font-size:28px}
header.topo{background:linear-gradient(135deg,#1B7A43,#146034)}
.lado,.baixo{display:none}
.lado h2{margin:0 12px 8px;font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--fraco);font-weight:600}
.lado button,.baixo button{background:none;border:0;cursor:pointer;color:var(--fraco);font-size:15px;position:relative}
.lado button{display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:11px 12px;border-radius:10px;color:var(--texto);margin-bottom:2px}
.lado button svg{flex:none;color:var(--fraco)}
.lado button[aria-current="page"]{background:var(--verde-claro);color:var(--verde-escuro);font-weight:700}
.lado button[aria-current="page"] svg,.baixo button[aria-current="page"] svg{color:var(--verde)}
.n{background:#D93025;color:#fff;font-size:11px;font-weight:700;border-radius:999px;padding:0 6px;line-height:17px;min-width:17px;text-align:center}
.lado .n{margin-left:auto}
.baixo button{display:flex;flex-direction:column;align-items:center;gap:3px;padding:9px 4px 8px;font-size:12px;min-width:0}
.baixo button[aria-current="page"]{color:var(--verde-escuro);font-weight:700}
.baixo .n{position:absolute;top:4px;left:calc(50% + 8px)}
@media(max-width:899px){
  body{padding-bottom:calc(78px + env(safe-area-inset-bottom,0px))}
  .baixo{display:grid;grid-template-columns:repeat(var(--n,4),1fr);position:fixed;left:0;right:0;bottom:0;z-index:30;
    background:#fff;border-top:1px solid var(--linha);padding-bottom:env(safe-area-inset-bottom,0px)}
}
@media(min-width:900px){
  #telaPainel{display:grid;grid-template-columns:230px minmax(0,1fr);grid-template-rows:auto auto 1fr;align-items:start}
  #telaPainel header.topo{grid-column:1/-1}
  .lado{display:block;grid-column:1;grid-row:2/4;padding:18px 10px;position:sticky;top:0}
  #telaPainel .abas{grid-column:2;grid-row:2;width:100%;margin:0}
  #telaPainel main{grid-column:2;grid-row:3;width:100%;margin:0}
}
.pg-linha{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:6px}
.pg-link{width:100%;padding:10px 12px;border:1px solid var(--linha);border-radius:9px;font-size:13px;background:#f7faf8;margin:8px 0}
.pg-passos{font-size:12.5px;color:var(--fraco);margin:8px 0 12px;padding-left:18px}
.pg-passos li{margin-bottom:4px}
.pg-item{display:flex;justify-content:space-between;gap:10px;font-size:13.5px;padding:6px 0;border-bottom:1px solid var(--linha)}
.modal.larga{max-width:480px;max-height:92dvh;overflow-y:auto}
${AGRO_CSS}
</style>
</head><body>

<div id="telaEntrar" class="entrar">
  <h1>Painel de relatórios</h1>
  <p>${esc(empresa || 'AMVS Relatório')}</p>
  <div class="campo"><label>E-mail</label><input id="eMail" type="email" autocomplete="username"></div>
  <div class="campo"><label>Senha</label><div class="senha-box"><input id="eSenha" type="password" autocomplete="current-password"><button type="button" class="ver-senha" id="btnVerSenha" aria-pressed="false">Mostrar</button></div></div>
  <div class="campo oculto" id="eCodigoBox"><label>Código de confirmação (administrador)</label><input id="eCodigo" type="password" autocomplete="one-time-code"></div>
  <button class="btn" id="btnEntrar">Entrar</button>
  <div id="eMsg"></div>
</div>

<div id="telaPainel" style="display:none">
  <header class="topo">
    <div class="topo-id"><span id="topoLogo" class="topo-logo" hidden><img alt=""></span><h1 id="titulo">Administração<small id="quem"></small></h1></div>
    <button id="btnSino" class="sino" aria-label="Notificações" title="Notificações">🔔<b id="sinoN" style="display:none"></b></button>
    <button id="btnAtualizar" aria-label="Atualizar" title="Atualizar">Atualizar</button>
    <button id="btnSair">Sair</button>
  </header>
  <nav class="lado" id="lado" aria-label="Áreas do painel"></nav>
  <div class="abas" id="subabas">
    <button class="on" data-aba="dash">Visão geral</button>
    <button data-aba="contas" id="abaContas">Contas</button>
    <button data-aba="rels">Relatórios</button>
    <button data-aba="timeline">Timeline</button>
    <button data-aba="equipe" id="abaEquipe" style="display:none">Equipe</button>
    ${AGRO_ABAS}
  </div>
  <main>
    <section class="painel on" id="pDash">
      <div class="cartoes" id="kpis"></div>
      <div class="caixa">
        <h2>Visitas por dia</h2>
        <div id="barrasNota" style="font-size:12px;color:var(--fraco);margin:-6px 0 6px"></div>
        <div class="barras" id="barras"></div>
        <div class="legenda-barras"></div>
      </div>
      <div class="caixa">
        <div class="cab-caixa"><h2>Relatórios por responsável</h2><button class="btn-mini" id="btnResp" aria-expanded="true">▾ Recolher</button></div>
        <div id="porResp"></div>
      </div>
      <div class="caixa" id="caixaMapa">
        <div class="cab-caixa"><h2>Onde foram as visitas</h2><button class="btn-mini" id="btnTelaCheia">⛶ Tela cheia</button></div>
        <div id="mapa"></div>
        <div style="font-size:11.5px;color:var(--fraco);margin-top:8px">
          🟢 visita enviada · 🟠 ainda em aberto · cada ponto é a média das fotos daquela visita · área verde = KML importado da fazenda<span id="legOutros"></span>
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
        <div class="campo"><label>CPF ou CNPJ <span style="font-weight:400;color:var(--fraco)">(opcional)</span></label><input id="nDoc" inputmode="numeric" maxlength="18" placeholder="000.000.000-00 ou 00.000.000/0000-00" autocomplete="off"></div>
        <div class="linha2">
          <div class="campo"><label>Senha</label><input id="nSenha" type="text" placeholder="mínimo 6 caracteres"></div>
          <div class="campo"><label>Acesso</label>
            <select id="nAdmin"><option value="0">Usuário comum</option><option value="adm">Adm de equipe</option><option value="1">Administrador</option></select>
          </div>
        </div>
        <div class="campo" id="nCotaBox" hidden><label>Quantos usuários comuns este Adm pode criar</label>
          <input id="nCota" type="number" min="0" max="500" value="3" inputmode="numeric">
          <div style="font-size:12px;color:var(--fraco);margin-top:6px">O Adm de equipe só cria usuários comuns, dentro desse limite. Eles seguem o prazo e os módulos dele.</div>
        </div>
        <div class="campo"><label>Período de uso, em dias (365 = 1 ano · 0 = sem prazo)</label>
          <input id="nPrazo" type="number" min="0" max="3650" value="365" inputmode="numeric">
        </div>
        <div style="font-size:12px;color:var(--fraco);margin:-4px 0 12px">
          Quando a conta completar esse período, ela aparece em "Prazos e renovações", aqui nesta aba. O acesso dela não é bloqueado.
        </div>
        <label style="display:flex;gap:10px;align-items:flex-start;margin:0 0 14px;font-size:14px;cursor:pointer">
          <input id="nVer" type="checkbox" style="width:20px;height:20px;margin:1px 0 0;flex:none">
          <span><b>Quero visualizar os dados desta conta</b><br><span style="font-size:12px;color:var(--fraco)">Relatórios, timeline e mapa dela aparecem no seu painel. Sem marcar, você vê só a quantidade de relatórios.</span></span>
        </label>
        <button class="btn" id="btnCriar">Criar conta</button>
        <div id="nMsg"></div>
      </div>
      <div class="caixa">
        <div class="cab-caixa"><h2>Prazos e renovações</h2><button class="btn-mini" id="btnPlano">Plano e cobrança</button></div>
        <div id="avisoPrazos"></div>
      </div>
      <div class="caixa">
        <div class="cab-caixa"><h2>Pix Automático: conferir pagamentos</h2></div>
        <div id="listaAssin"></div>
      </div>
      <div class="caixa">
        <h2>Contas ativas</h2>
        <div class="rolagem"><table id="tContas"></table></div>
      </div>
      <div class="caixa">
        <h2>Cobranças e pagamentos</h2>
        <div class="rolagem" id="listaCobr"></div>
      </div>
    </section>

    <section class="painel" id="pRels">
      <div class="caixa">
        <h2 id="hRels">Todos os relatórios</h2>
        <div class="campo"><input id="filtro" placeholder="filtrar por fazenda, produtor ou safra"></div>
        <div id="chipResp"></div>
        <div class="rolagem"><table id="tRels"></table></div>
      </div>
    </section>
    <section class="painel" id="pTimeline">
      <div id="ltBarra" style="display:none;max-width:620px;margin:0 auto 10px;text-align:right"><button class="btn-mini" id="btnLeitores">👥 Acessos à Timeline</button></div>
      <div id="feed"></div>
      <div style="text-align:center;margin:6px 0 20px"><button class="btn-mini" id="feedMais" style="display:none">Carregar mais</button></div>
    </section>
    <section class="painel" id="pEquipe">
      <div class="caixa" style="max-width:620px">
        <h2 id="hEquipe">Sua equipe</h2>
        <div id="eqCorpo"></div>
      </div>
    </section>
    ${AGRO_PAINEIS}
  </main>
  <nav class="baixo" id="baixo" aria-label="Áreas do painel"></nav>
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
  var dados = null, mapa = null, camada = null, camadaAreas = null;

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
    if (!r.ok) { var er = new Error((j && j.erro) || ('HTTP ' + r.status)); er.precisaCodigo = !!(j && j.precisaCodigo); throw er; }
    return j;
  }

  /* ---------- entrar ---------- */
  $('#btnEntrar').onclick = async function () {
    var msg = $('#eMsg');
    aviso(msg, 'Entrando…');
    try {
      var cod = $('#eCodigoBox').classList.contains('oculto') ? '' : $('#eCodigo').value.trim();
      var r = await api('/api/entrar', { email: $('#eMail').value.trim(), senha: $('#eSenha').value, codigo: cod || undefined, painel: true });
      token = r.token; $('#eCodigo').value = '';
      try { localStorage.setItem(CHAVE, token); } catch (e) {}
      aviso(msg, '');
      await abrirPainel();
    } catch (e) {
      aviso(msg, e.message, true);
      if (e.precisaCodigo) { $('#eCodigoBox').classList.remove('oculto'); $('#eCodigo').focus(); }
    }
  };
  $('#eCodigo').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('#btnEntrar').click(); });
  $('#eSenha').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('#btnEntrar').click(); });
  $('#btnVerSenha').onclick = function () {
    var i = $('#eSenha'), mostrar = i.type === 'password';
    i.type = mostrar ? 'text' : 'password';
    this.textContent = mostrar ? 'Ocultar' : 'Mostrar';
    this.setAttribute('aria-pressed', mostrar ? 'true' : 'false');
    i.focus();
  };

  $('#btnSair').onclick = function () {
    token = ''; try { localStorage.removeItem(CHAVE); } catch (e) {}
    $('#telaPainel').style.display = 'none';
    $('#telaEntrar').style.display = '';
  };
  $('#btnAtualizar').onclick = function () { abrirPainel(); };
  $('#btnPlano').onclick = function () { abrirPlano(); };

  /* ---------- áreas do painel (menu lateral no computador, barra de baixo no celular) ---------- */
  var SVG = function (d) { return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; };
  var ICONES = {
    visao: SVG('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
    timeline: SVG('<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1" fill="currentColor"/>'),
    campo: SVG('<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
    lavoura: SVG('<path d="M12 21V11"/><path d="M12 11c0-4 2.5-6 7-6 0 4-2.5 6-7 6z"/><path d="M12 14c0-3-2-5-6-5 0 3.2 2 5 6 5z"/>'),
    gestao: SVG('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2 .6 3.2 2.3 3.5 5.2"/>')
  };
  var AREAS = [
    { id: 'visao', nome: 'Visão geral', abas: ['dash'] },
    { id: 'timeline', nome: 'Timeline', abas: ['timeline'] },
    { id: 'campo', nome: 'Campo', abas: ['rels', 'agenda'] },
    { id: 'lavoura', nome: 'Lavoura', abas: ['plantio', 'recs', 'custo', 'acessos'] },
    { id: 'gestao', nome: 'Gestão', abas: ['contas', 'modulos', 'equipe'] }
  ];
  var gestaoN = 0, ultimaAba = {};
  function abaOk(k) { var b = document.querySelector('#subabas button[data-aba="' + k + '"]'); return !!b && b.style.display !== 'none'; }
  function areaDe(k) { for (var i = 0; i < AREAS.length; i++) if (AREAS[i].abas.indexOf(k) >= 0) return AREAS[i]; return AREAS[0]; }
  function abaAtiva() { var b = document.querySelector('#subabas button.on'); return b ? b.dataset.aba : 'dash'; }
  function montarNav() {
    var area = areaDe(abaAtiva());
    var vis = AREAS.filter(function (a) { return a.abas.some(abaOk); });
    var item = function (a) {
      return '<button data-area="' + a.id + '"' + (a.id === area.id ? ' aria-current="page"' : '') + '>' + ICONES[a.id] + '<span>' + a.nome + '</span>' +
        (a.id === 'gestao' && gestaoN ? '<span class="n" title="contas com prazo vencido ou perto de vencer">' + gestaoN + '</span>' : '') + '</button>';
    };
    $('#lado').innerHTML = '<h2>Painel</h2>' + vis.map(item).join('');
    $('#baixo').innerHTML = vis.map(item).join('');
    $('#baixo').style.setProperty('--n', vis.length || 1);
    document.querySelectorAll('[data-area]').forEach(function (b) {
      b.onclick = function () {
        var a = AREAS.filter(function (x) { return x.id === b.dataset.area; })[0];
        var k = (ultimaAba[a.id] && abaOk(ultimaAba[a.id])) ? ultimaAba[a.id] : a.abas.filter(abaOk)[0];
        var bt = k && document.querySelector('#subabas button[data-aba="' + k + '"]');
        if (bt) bt.click();
        window.scrollTo(0, 0);
      };
    });
    var cont = 0;
    document.querySelectorAll('#subabas button').forEach(function (b) {
      var dentro = area.abas.indexOf(b.dataset.aba) >= 0;
      b.classList.toggle('fora', !dentro);
      if (dentro && b.style.display !== 'none') cont++;
    });
    $('#subabas').classList.toggle('uma', cont < 2);
  }
  // o módulo de lavoura liga/desliga abas pelo style: refaz o menu quando isso acontecer
  try { new MutationObserver(montarNav).observe($('#subabas'), { attributes: true, attributeFilter: ['style'], subtree: true }); } catch (e) {}

  /* ---------- abas ---------- */
  document.querySelectorAll('.abas button').forEach(function (b) {
    b.onclick = function () {
      document.querySelectorAll('.abas button').forEach(function (x) { x.classList.remove('on'); });
      document.querySelectorAll('.painel').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      $('#p' + b.dataset.aba.charAt(0).toUpperCase() + b.dataset.aba.slice(1)).classList.add('on');
      ultimaAba[areaDe(b.dataset.aba).id] = b.dataset.aba;
      montarNav();
      if (b.dataset.aba === 'dash' && mapa) setTimeout(function () { mapa.invalidateSize(); }, 60);
      if (b.dataset.aba === 'timeline' && !FEED.carregado) carregarFeed(true);
      if (b.dataset.aba === 'equipe') carregarEquipe();
    };
  });

  /* ---------- painel ---------- */
  // logo da empresa de quem entrou, no canto do cabeçalho (guardado no aparelho para aparecer na hora)
  function mostrarLogo(src) {
    var bx = $('#topoLogo'); if (!bx) return;
    if (!src) { bx.hidden = true; return; }
    bx.querySelector('img').src = src; bx.hidden = false;
  }
  function carregarLogo() {
    var chave = 'vsl-logo-' + ((dados && dados.eu && dados.eu.id) || '');
    try { var c = localStorage.getItem(chave); if (c) mostrarLogo(c); } catch (e) {}
    api('/api/admin/logo').then(function (r) {
      mostrarLogo(r.logo || '');
      try { if (r.logo) localStorage.setItem(chave, r.logo); else localStorage.removeItem(chave); } catch (e) {}
    }).catch(function () {});
  }
  async function abrirPainel() {
    try {
      dados = await api('/api/admin/resumo');
    } catch (e) {
      aviso($('#eMsg'), e.message, true);
      if (e.precisaCodigo) $('#eCodigoBox').classList.remove('oculto');
      token = ''; try { localStorage.removeItem(CHAVE); } catch (er) {}
      $('#telaEntrar').style.display = '';
      $('#telaPainel').style.display = 'none';
      return;
    }
    $('#telaEntrar').style.display = 'none';
    $('#telaPainel').style.display = '';
    carregarLogo();
    // acesso só à Timeline: esconde todo o resto do painel (nada mais é carregado)
    if (dados.eu && dados.eu.leitor) {
      document.body.classList.add('so-timeline');
      $('#titulo').firstChild.nodeValue = 'Timeline';
      $('#quem').textContent = (dados.eu.nome || dados.eu.email) + (dados.eu.dono ? ' · equipe de ' + dados.eu.dono : '');
      document.querySelectorAll('#subabas button[data-aba]').forEach(function (b) { b.style.display = b.dataset.aba === 'timeline' ? '' : 'none'; });
      var bt = document.querySelector('#subabas button[data-aba="timeline"]');
      FEED.carregado = false;
      if (bt && !$('#pTimeline').classList.contains('on')) bt.click(); else carregarFeed(true);
      contarSino();
      montarNav();
      return;
    }
    var adm = !!(dados.eu && dados.eu.admin);
    var temEquipe = !adm && dados.eu && dados.eu.papel;
    $('#ltBarra').style.display = adm || (dados.eu && dados.eu.papel === 'adm') ? '' : 'none';
    $('#titulo').firstChild.nodeValue = adm ? 'Administração' : temEquipe ? 'Relatórios da equipe' : 'Meus relatórios';
    $('#quem').textContent = adm
      ? dados.totais.contas + ' contas · ' + dados.totais.relatorios + ' relatórios'
      : (dados.eu.nome || dados.eu.email) + ' · ' + dados.totais.relatorios + ' relatórios';
    $('#abaContas').style.display = adm ? '' : 'none';
    $('#abaEquipe').style.display = dados.eu && dados.eu.papel === 'adm' ? '' : 'none';
    FEED.carregado = false;
    if ($('#pTimeline').classList.contains('on')) carregarFeed(true);
    contarSino();
    if (/[?&]avisos=1/.test(location.search)) { try { history.replaceState(null, '', '/admin'); } catch (e) {} setTimeout(abrirSino, 300); }   // tocou na notificação do celular
    $('#hRels').textContent = adm ? 'Todos os relatórios' : temEquipe ? 'Relatórios da equipe' : 'Meus relatórios';
    if (!adm && $('#pContas').classList.contains('on')) document.querySelector('.abas button[data-aba="dash"]').click();
    pg = null;
    if (adm) { try { pg = await api('/api/admin/pagamentos'); } catch (e) { pg = null; } }
    desenharKpis();
    desenharPrazos();
    desenharContas();
    desenharCobrancas();
    desenharAssin();
    desenharRelatorios();
    desenharBarras();
    desenharResp();
    desenharMapa();
    agroAposPainel(adm);
    montarNav();
  }

  function desenharKpis() {
    var t = dados.totais;
    var pub = t.publicados != null ? t.publicados : dados.relatorios.filter(function (r) { return r.status === 'publicado'; }).length;
    var adm = !!(dados.eu && dados.eu.admin);
    // recolhido: só o círculo do armazenamento; tocando abre os números
    var pc = t.limite ? Math.min(100, t.bytes / t.limite * 100) : 0, aberto = false;
    try { aberto = localStorage.getItem('vsl-kpis') === '1'; } catch (e) {}
    var cor = pc >= 90 ? '#C62828' : pc >= 75 ? '#E08A00' : '#1B7A43';
    var anel = '<svg width="54" height="54" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15.9" fill="none" stroke="#E1E7E3" stroke-width="3.6"/>' +
      '<circle cx="18" cy="18" r="15.9" fill="none" stroke="' + cor + '" stroke-width="3.6" stroke-linecap="round" stroke-dasharray="' + pc.toFixed(1) + ' 100" transform="rotate(-90 18 18)"/>' +
      '<text x="18" y="21" text-anchor="middle" font-size="8" font-weight="700" fill="' + cor + '">' + (t.limite ? Math.round(pc) + '%' : '—') + '</text></svg>';
    $('#kpis').className = 'kpis-box' + (aberto ? ' aberto' : '');
    $('#kpis').innerHTML = '<button class="kpi-cab" id="kpiAbre" aria-expanded="' + aberto + '">' + anel +
      '<span class="kpi-txt"><b>' + bytesFmt(t.bytes) + (t.limite ? ' <small>de ' + bytesFmt(t.limite) + '</small>' : '') + '</b><small>armazenamento usado' +
      (adm ? ' · ' + t.contas + ' contas' : '') + ' · ' + t.relatorios + ' relatórios</small></span><i>' + (aberto ? '▴' : '▾') + '</i></button>' +
      '<div class="cartoes kpi-cartoes">' +
      (adm ? cartao(t.contas, 'contas') : '') +
      cartao(t.relatorios, 'relatórios') +
      cartao(pub, 'já enviados ao cliente') +
      cartao(t.registros, 'fotos, vídeos e notas') +
      cartao(bytesFmt(t.bytes), 'de mídia guardada' + (t.limite ? ' de ' + bytesFmt(t.limite) + ' (' + Math.round(t.bytes / t.limite * 100) + '%)' : '')) +
      cartao(tiposTxt(t.porTipo) || '—', 'fotos · vídeos · áudios') + '</div>';
    $('#kpiAbre').onclick = function () {
      var ab = !$('#kpis').classList.contains('aberto');
      try { localStorage.setItem('vsl-kpis', ab ? '1' : '0'); } catch (e) {}
      desenharKpis();
    };
  }
  // "📷 312 MB · 🎥 480 MB · 🎤 12 MB"
  function tiposTxt(pt) {
    pt = pt || {};
    return [['foto', '📷'], ['video', '🎥'], ['audio', '🎤']].filter(function (x) { return pt[x[0]] && pt[x[0]].bytes; })
      .map(function (x) { return x[1] + ' ' + bytesFmt(pt[x[0]].bytes); }).join(' · ');
  }
  function espacoCel(c) {
    var e = c.espaco;
    if (!e || !e.bytes) return '<span class="peq">—</span>';
    var tot = dados.totais.bytes || 0;
    return '<b>' + bytesFmt(e.bytes) + '</b>' + (tot ? ' <span class="peq">(' + Math.round(e.bytes / tot * 100) + '%)</span>' : '') +
      '<br><span class="peq">' + [['foto', '📷', 'fotos'], ['video', '🎥', 'vídeos'], ['audio', '🎤', 'áudios']]
        .filter(function (x) { return e[x[0]] && e[x[0]].n; })
        .map(function (x) { return x[1] + ' ' + e[x[0]].n + ' · ' + bytesFmt(e[x[0]].bytes); }).join('<br>') + '</span>';
  }
  function cartao(v, t) { return '<div class="cartao"><b>' + esc(v) + '</b><span>' + esc(t) + '</span></div>'; }

  function desenharContas() {
    var linhas = dados.contas.map(function (c) {
      return '<tr><td><b>' + esc(c.nome || '—') + '</b><br><span style="color:var(--fraco);font-size:12px">' + esc(c.email) + '</span>' +
        (c.documento ? '<br><span class="peq">' + (String(c.documento).length === 14 ? 'CNPJ ' : 'CPF ') + esc(fmtDoc(c.documento)) + '</span>' : '') +
        (Number(c.admin) === 1 ? ' <span class="selo adm">admin</span>' : '') +
        (c.papel === 'adm' ? ' <span class="selo pub">Adm · até ' + (Number(c.cota) || 0) + ' usuário' + (Number(c.cota) === 1 ? '' : 's') + '</span>' : '') +
        (c.equipe_id ? ' <span class="selo">equipe de ' + esc(c.equipe_nome || '') + '</span>' : '') +
        (Number(c.admin_ve) === 1 ? ' <span class="selo">👁 dados visíveis</span>' : '') +
        '<br>' + (c.termos_em ? '<span class="peq">✔ termos aceitos em ' + dataBR(c.termos_em) + '</span>' : '<span class="selo perto">termos pendentes</span>') +
        ((c.responsaveis || []).length ? '<br><span class="peq">👥 ' + c.responsaveis.length + (c.responsaveis.length > 1 ? ' responsáveis: ' : ' responsável: ') + esc(c.responsaveis.join(', ')) + '</span>' : '') + '</td>' +
        '<td>' + c.relatorios + '<br><span style="color:var(--fraco);font-size:11.5px">' + c.publicados + ' enviados</span></td>' +
        '<td>' + c.produtores + ' / ' + c.fazendas + '</td>' +
        '<td>' + espacoCel(c) + '</td>' +
        '<td>' + usoCel(c) + '</td>' +
        '<td>' + pagCel(c) + '</td>' +
        '<td>' + dataBR(c.ultima_atividade) + '</td>' +
        '<td class="acoes">' +
          '<button class="selo" data-pago="' + esc(c.id) + '">marcar pago</button> ' +
          (c.equipe_id ? '' : '<button class="selo" data-prazo="' + esc(c.id) + '">prazo</button> ') +
          (c.equipe_id ? '' : '<button class="selo" data-adm="' + esc(c.id) + '">' + (c.papel === 'adm' ? 'Adm: usuários' : 'tornar Adm') + '</button> ') +
          '<button class="selo" data-edt="' + esc(c.id) + '">✎ editar</button> ' +
          '<button class="selo" data-senha="' + esc(c.id) + '" data-email="' + esc(c.email) + '">trocar senha</button> ' +
          '<button class="selo" data-kml="' + esc(c.id) + '" data-nome="' + esc(c.nome || c.email) + '">📐 mapa KML</button> ' +
          '<button class="selo" data-prom="' + esc(c.id) + '" data-v="' + (Number(c.admin) === 1 ? 0 : 1) + '">' +
          (Number(c.admin) === 1 ? 'tirar admin' : 'tornar admin') + '</button>' +
          (Number(c.admin) === 1 || (dados.eu && c.id === dados.eu.id) ? '' :
            ' <button class="selo venc" data-excluir="' + esc(c.id) + '" data-email="' + esc(c.email) + '" data-rel="' + c.relatorios + '">excluir conta</button>') +
        '</td></tr>';
    }).join('');
    $('#tContas').innerHTML =
      '<tr><th>Conta</th><th>Relatórios</th><th>Prod./Faz.</th><th>Espaço</th><th>Tempo de uso</th><th>Pagamento</th><th>Última atividade</th><th></th></tr>' + linhas;
    document.querySelectorAll('[data-adm]').forEach(function (b) { b.onclick = function () { abrirAdm(b.dataset.adm); }; });
    document.querySelectorAll('[data-edt]').forEach(function (b) { b.onclick = function () { abrirEditar(b.dataset.edt); }; });
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
    document.querySelectorAll('[data-kml]').forEach(function (b) {
      b.onclick = function () { abrirKml(b.dataset.kml, b.dataset.nome); };
    });
    document.querySelectorAll('[data-excluir]').forEach(function (b) {
      b.onclick = function () { abrirExcluir(b.dataset.excluir, b.dataset.email, b.dataset.rel); };
    });
    ligarPrazos();
    ligarPagto();
  }

  /* ---------- mapa (KML) na fazenda de uma conta ---------- */
  // KMZ = zip com o KML dentro: abre o primeiro .kml (sem biblioteca, com o DecompressionStream do navegador)
  async function kmlDoKmz(buf) {
    var dv = new DataView(buf), by = new Uint8Array(buf), fim = -1;
    for (var i = by.length - 22; i >= 0 && i > by.length - 66000; i--) { if (dv.getUint32(i, true) === 0x06054b50) { fim = i; break; } }
    if (fim < 0) throw new Error('KMZ inválido');
    var qtd = dv.getUint16(fim + 10, true), p = dv.getUint32(fim + 16, true);
    for (var k = 0; k < qtd; k++) {
      var met = dv.getUint16(p + 10, true), tam = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), loc = dv.getUint32(p + 42, true);
      var nome = new TextDecoder().decode(by.subarray(p + 46, p + 46 + nl)).toLowerCase();
      p += 46 + nl + el + cl;
      if (nome.slice(-4) !== '.kml') continue;
      var ini = loc + 30 + dv.getUint16(loc + 26, true) + dv.getUint16(loc + 28, true), cru = by.subarray(ini, ini + tam);
      if (met === 0) return new TextDecoder().decode(cru);
      var ds = new Blob([cru]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return await new Response(ds).text();
    }
    throw new Error('o KMZ não tem um arquivo KML dentro');
  }
  async function abrirKml(uid, nomeConta) {
    var veu = document.createElement('div'); veu.className = 'veu';
    var cx = document.createElement('div'); cx.className = 'modal';
    cx.innerHTML = '<h2 style="margin:0 0 4px">Mapa (KML) na fazenda</h2><p style="margin:0 0 10px;font-size:13px">Conta: <b>' + esc(nomeConta) + '</b></p><div id="kmCorpo">Carregando fazendas…</div>';
    veu.appendChild(cx); document.body.appendChild(veu);
    var sair = function () { veu.remove(); };
    veu.onclick = function (e) { if (e.target === veu) sair(); };
    var d;
    try { d = await api('/api/admin/fazendas?uid=' + encodeURIComponent(uid)); }
    catch (e) { cx.querySelector('#kmCorpo').innerHTML = '<div class="aviso ruim">' + esc(e.message) + '</div>'; return; }
    var nb = function (v) { return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); };
    cx.querySelector('#kmCorpo').innerHTML =
      '<div class="campo"><label>Fazenda</label><select id="kmFaz">' + d.fazendas.map(function (f) {
        return '<option value="' + esc(f.id) + '">' + esc(f.nome) + (f.produtor ? ' · ' + esc(f.produtor) : '') + (f.n_talhoes ? ' · ' + f.n_talhoes + ' talhões' : ' · sem mapa') + '</option>'; }).join('') +
        '<option value="">＋ Nova fazenda…</option></select></div>' +
      '<div id="kmNova" style="display:none"><div class="campo"><label>Nome da fazenda nova</label><input id="kmNome" type="text"></div>' +
        '<div class="campo"><label>Produtor</label><select id="kmProd"><option value="">— sem produtor —</option>' + d.produtores.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.nome) + '</option>'; }).join('') + '</select></div></div>' +
      '<div class="campo"><label>Arquivo KML ou KMZ</label><input id="kmArq" type="file" accept=".kml,.kmz"></div>' +
      '<div id="kmPrev"></div><div id="kmMsg"></div>' +
      '<button class="btn" id="kmOk" disabled>Gravar mapa na fazenda</button><button class="btn sec" id="kmCancel" style="margin-top:8px">Cancelar</button>';
    var sel = cx.querySelector('#kmFaz'), kml = '';
    var mostrarNova = function () { cx.querySelector('#kmNova').style.display = sel.value ? 'none' : ''; };
    if (!d.fazendas.length) sel.value = '';
    mostrarNova(); sel.onchange = function () { mostrarNova(); avisoTroca(); };
    var avisoTroca = function () {
      var f = d.fazendas.filter(function (x) { return x.id === sel.value; })[0];
      var p = cx.querySelector('#kmPrev .troca'); if (p) p.style.display = f && f.n_talhoes ? '' : 'none';
    };
    cx.querySelector('#kmCancel').onclick = sair;
    cx.querySelector('#kmArq').onchange = async function () {
      var arq = this.files && this.files[0], msg = cx.querySelector('#kmMsg'), prev = cx.querySelector('#kmPrev');
      kml = ''; cx.querySelector('#kmOk').disabled = true; prev.innerHTML = '';
      if (!arq) return;
      aviso(msg, 'Lendo o arquivo…');
      try {
        kml = arq.name.toLowerCase().slice(-4) === '.kmz' ? await kmlDoKmz(await arq.arrayBuffer()) : await arq.text();
        var r = await api('/api/admin/fazenda-kml', { uid: uid, kml: kml, previa: true });
        prev.innerHTML = '<div class="aviso" style="margin:0 0 10px"><b>' + r.n_talhoes + ' talhões · ' + nb(r.area_ha) + ' ha</b><br><span style="font-size:12.5px">' +
          r.talhoes.map(function (t) { return esc(t.nome) + ' ' + nb(t.ha) + ' ha'; }).join(' · ') + '</span></div>' +
          '<div class="aviso ruim troca" style="margin:0 0 10px;display:none">Esta fazenda já tem mapa: os talhões serão trocados por estes. O plantio e as aplicações ficam ligados pelo nome do talhão.</div>';
        avisoTroca(); aviso(msg, ''); cx.querySelector('#kmOk').disabled = false;
      } catch (e) { aviso(msg, e.message, true); }
    };
    cx.querySelector('#kmOk').onclick = async function () {
      var msg = cx.querySelector('#kmMsg');
      if (!kml) return;
      if (!sel.value && !cx.querySelector('#kmNome').value.trim()) { aviso(msg, 'Informe o nome da fazenda nova.', true); return; }
      this.disabled = true; aviso(msg, 'Gravando…');
      try {
        var r = await api('/api/admin/fazenda-kml', { uid: uid, kml: kml, fazenda_id: sel.value, nome: cx.querySelector('#kmNome').value.trim(), produtor_id: cx.querySelector('#kmProd').value });
        sair(); await abrirPainel();
        alert('Mapa gravado: ' + r.n_talhoes + ' talhões · ' + nb(r.area_ha) + ' ha. No app da conta ele aparece ao abrir Produtores e fazendas (ou ao voltar para o app).');
      } catch (e) { aviso(msg, e.message, true); this.disabled = false; }
    };
  }

  /* ---------- excluir uma conta (definitivo) ---------- */
  function abrirExcluir(id, email, nRel) {
    var veu = document.createElement('div'); veu.className = 'veu';
    var cx = document.createElement('div'); cx.className = 'modal';
    cx.innerHTML =
      '<h2 style="margin:0 0 4px">Excluir conta</h2>' +
      '<p style="margin:0 0 10px;font-size:13px"><b>' + esc(email) + '</b></p>' +
      '<div class="aviso ruim" style="margin:0 0 12px">Isso apaga para sempre a conta, ' + esc(nRel) +
        ' relatório(s), fotos, vídeos, cadastros e responsáveis dela. Não tem como desfazer, e os links que o cliente recebeu deixam de abrir.</div>' +
      '<div class="campo"><label>Para confirmar, digite o e-mail da conta</label>' +
      '<input id="exEmail" type="text" autocomplete="off" autocapitalize="off" placeholder="' + esc(email) + '"></div>' +
      '<div id="exMsg"></div>' +
      '<button class="btn" id="exOk" style="background:#b3261e">Excluir definitivamente</button>' +
      '<button class="btn sec" id="exCancel" style="margin-top:8px">Cancelar</button>';
    veu.appendChild(cx); document.body.appendChild(veu);
    var sair = function () { veu.remove(); };
    veu.onclick = function (e) { if (e.target === veu) sair(); };
    cx.querySelector('#exCancel').onclick = sair;
    cx.querySelector('#exOk').onclick = async function () {
      var msg = cx.querySelector('#exMsg');
      var digitado = cx.querySelector('#exEmail').value.trim().toLowerCase();
      if (digitado !== String(email).toLowerCase()) { aviso(msg, 'Digite o e-mail exatamente como aparece acima.', true); return; }
      aviso(msg, 'Excluindo…');
      this.disabled = true;
      try {
        var r = await api('/api/admin/excluir', { id: id, email: digitado });
        sair();
        await abrirPainel();
        alert('Conta excluída: ' + r.email + ' (' + r.relatorios + ' relatório(s) apagado(s)).');
      } catch (e) { aviso(msg, e.message, true); this.disabled = false; }
    };
    setTimeout(function () { cx.querySelector('#exEmail').focus(); }, 120);
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

  /* ---------- prazos e pagamentos (aba Contas) ---------- */
  var pg = null;   // { config, cobrancas } de /api/admin/pagamentos
  function reais(c) {
    return 'R$ ' + (Number(c || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function contaPorId(id) { return (dados.contas || []).filter(function (x) { return x.id === id; })[0]; }
  function copiar(txt, btn) {
    var feito = function () {
      if (!btn) return;
      var t = btn.textContent; btn.textContent = 'Copiado ✓';
      setTimeout(function () { btn.textContent = t; }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(feito, function () { window.prompt('Copie:', txt); });
    else window.prompt('Copie:', txt);
  }
  function modalBase(larga) {
    var veu = document.createElement('div'); veu.className = 'veu';
    var cx = document.createElement('div'); cx.className = 'modal' + (larga ? ' larga' : '');
    veu.appendChild(cx); document.body.appendChild(veu);
    var sair = function () { veu.remove(); };
    veu.onclick = function (e) { if (e.target === veu) sair(); };
    return { cx: cx, sair: sair };
  }

  // situação de pagamento da conta (coluna "Pagamento")
  function pagCel(c) {
    var p = c.pagto || {}, h;
    if (c.prazo_dias == null && !p.n) h = '<span class="selo">sem prazo</span>';
    else if (c.restam != null && c.restam < 0) h = '<span class="selo venc">Vencida</span>';
    else if (p.n) h = '<span class="selo pub">Em dia</span>';
    else h = '<span class="selo">Em teste</span>';
    if (p.n) h += '<br><span class="peq">' + p.n + (p.n === 1 ? ' pagamento' : ' pagamentos') + ' · ' + reais(p.total_centavos) +
      '<br>último em ' + dataBR(p.ultimo) + '</span>';
    if (c.assin) h += '<br><span class="peq">' + (c.assin.forma === 'pix_automatico' ? 'Pix Automático' : 'Link PicPay') + ' · ' + reais(c.assin.valor_centavos) + ' · dia ' + c.assin.dia + '</span>';
    if (p.aberta) h += '<br><span class="peq">🔗 link em aberto · ' + reais(p.aberta.valor_centavos) + '</span>';
    return h;
  }

  // contas que completaram o prazo ou estão a 30 dias de completar (só aparece na aba Contas)
  function desenharPrazos() {
    var el = $('#avisoPrazos');
    var adm = !!(dados.eu && dados.eu.admin);
    if (!adm) { el.innerHTML = ''; gestaoN = 0; return; }
    var lista = (dados.contas || []).filter(function (c) { return c.prazo_dias != null && c.restam != null && c.restam <= 30; })
      .sort(function (a, b) { return a.restam - b.restam; });
    gestaoN = lista.length;
    if (!lista.length) {
      el.innerHTML = '<div style="color:var(--fraco);font-size:13px">Nenhuma conta com prazo vencido ou para vencer nos próximos 30 dias.</div>';
      return;
    }
    // recolhido por padrão: só o resumo; tocando abre a lista (lembra a escolha neste aparelho)
    var venc = lista.filter(function (c) { return c.restam <= 0; }).length, perto = lista.length - venc, abertoP = false;
    try { abertoP = localStorage.getItem('vsl-prazos') === '1'; } catch (e) {}
    var resumoP = '<button class="prz-cab" id="przAbre" aria-expanded="' + abertoP + '"><span>' +
      (venc ? '<b class="prz-v">⚠️ ' + venc + (venc === 1 ? ' vencido' : ' vencidos') + '</b>' : '') +
      (venc && perto ? ' · ' : '') +
      (perto ? '<b class="prz-p">⏳ ' + perto + ' para vencer em 30 dias</b>' : '') +
      '</span><i>' + (abertoP ? 'recolher ▴' : 'ver lista ▾') + '</i></button>';
    el.innerHTML = resumoP + '<div id="przLista"' + (abertoP ? '' : ' hidden') + '>' + lista.map(function (c) {
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
      var p = c.pagto || {};
      return '<div class="aviso' + cls + '">' + txt +
        '<div class="pg-linha"><button class="selo" data-gerar="' + esc(c.id) + '">' + (p.aberta ? 'ver link de renovação' : 'gerar link de renovação') + '</button>' +
        '<button class="selo" data-prazo="' + esc(c.id) + '">ajustar prazo</button></div></div>';
    }).join('') + '</div>';
    $('#przAbre').onclick = function () {
      var l = $('#przLista'), abre = l.hidden;
      l.hidden = !abre;
      this.setAttribute('aria-expanded', abre);
      this.querySelector('i').textContent = abre ? 'recolher ▴' : 'ver lista ▾';
      try { localStorage.setItem('vsl-prazos', abre ? '1' : '0'); } catch (e) {}
    };
    ligarPrazos();
    ligarPagto();
  }

  var ROT_COBR = { aberta: 'link aberto', paga: 'pago', cancelada: 'cancelado', expirada: 'link expirado', estornada: 'estornado', divergente: 'valor menor que o devido' };
  function desenharCobrancas() {
    var el = $('#listaCobr');
    if (!el) return;
    var adm = !!(dados.eu && dados.eu.admin);
    if (!adm) { el.innerHTML = ''; return; }
    var l = (pg && pg.cobrancas) || [];
    if (!pg) { el.innerHTML = '<div style="color:var(--fraco);font-size:13px">Não consegui carregar os pagamentos agora. Toque em Atualizar.</div>'; return; }
    if (!l.length) {
      el.innerHTML = '<div style="color:var(--fraco);font-size:13px">Nenhuma cobrança ainda. Use "gerar link" numa conta, ou "marcar pago" para registrar um pagamento recebido por fora.</div>';
      return;
    }
    el.innerHTML = '<table><tr><th>Data</th><th>Conta</th><th>Valor</th><th>Renova</th><th>Situação</th><th></th></tr>' + l.map(function (c) {
      var cls = c.status === 'paga' ? 'selo pub' : (c.status === 'aberta' ? 'selo perto' : (c.status === 'cancelada' || c.status === 'expirada' ? 'selo' : 'selo venc'));
      var acoes = '';
      if (c.status === 'aberta' && c.link) {
        acoes = '<button class="selo" data-copiar="' + esc(c.link) + '">copiar link</button> ' +
          '<button class="selo venc" data-cancelar="' + esc(c.id) + '">cancelar</button>';
      }
      return '<tr><td>' + dataBR(c.status === 'paga' ? c.pago_em : c.criado_em) + '</td>' +
        '<td>' + esc(c.email || '—') + '</td>' +
        '<td><b>' + reais(c.valor_centavos) + '</b></td>' +
        '<td>' + diasTxt(c.dias) + '</td>' +
        '<td><span class="' + cls + '">' + esc(ROT_COBR[c.status] || c.status) + '</span>' +
          '<br><span class="peq">' + (c.origem === 'manual' ? 'registrado por você' + (c.obs ? ' · ' + esc(c.obs) : '') : 'PicPay' + (c.metodo ? ' · ' + esc(c.metodo) : '')) + '</span></td>' +
        '<td class="acoes">' + acoes + '</td></tr>';
    }).join('') + '</table>';
    ligarPagto();
  }

  function ligarPagto() {
    document.querySelectorAll('[data-gerar]').forEach(function (b) { b.onclick = function () { abrirLink(b.dataset.gerar); }; });
    document.querySelectorAll('[data-pago]').forEach(function (b) { b.onclick = function () { abrirManual(b.dataset.pago); }; });
    document.querySelectorAll('[data-cobr]').forEach(function (b) { b.onclick = function () { abrirCobranca(b.dataset.cobr); }; });
    document.querySelectorAll('[data-copiar]').forEach(function (b) { b.onclick = function () { copiar(b.dataset.copiar, b); }; });
    document.querySelectorAll('[data-cancelar]').forEach(function (b) {
      b.onclick = async function () {
        if (!window.confirm('Cancelar este link de pagamento? Quem receber o link não vai conseguir pagar por ele.')) return;
        b.disabled = true;
        try { await api('/api/admin/cobranca/cancelar', { id: b.dataset.cancelar }); await abrirPainel(); }
        catch (e) { window.alert(e.message); b.disabled = false; }
      };
    });
  }

  // gera o link de renovação (PicPay) de uma conta
  function abrirLink(id) {
    var c = contaPorId(id);
    if (!c) return;
    var cfg = (pg && pg.config) || {};
    var m = modalBase(false), cx = m.cx, gerou = false;
    var p = c.pagto || {};
    var fechar = function () { m.sair(); if (gerou) abrirPainel(); };
    cx.innerHTML =
      '<h2 style="margin:0 0 4px">Link de renovação</h2>' +
      '<p style="margin:0 0 12px;font-size:13px;color:var(--fraco)">' + esc(c.nome || c.email) + '</p>' +
      (cfg.picpay_credenciais ? '' : '<div class="aviso ruim" style="margin:0 0 12px">A PicPay ainda não está ligada. Toque em "Plano e cobrança" para ver o que falta.</div>') +
      (p.aberta ? '<div class="aviso perto" style="margin:0 0 12px">Já existe um link em aberto (' + reais(p.aberta.valor_centavos) + '). ' +
        '<a href="' + esc(p.aberta.link) + '" target="_blank" rel="noopener">abrir</a> · Gerar outro cria um link novo.</div>' : '') +
      '<div class="linha2"><div class="campo"><label>Valor (R$)</label><input id="lkValor" inputmode="decimal" placeholder="ex.: 49,90" value="' +
        (cfg.valor_centavos ? (cfg.valor_centavos / 100).toFixed(2).replace('.', ',') : '') + '"></div>' +
      '<div class="campo"><label>Renova por (dias)</label><input id="lkDias" type="number" min="1" max="3650" inputmode="numeric" value="' + (cfg.dias_ciclo || 30) + '"></div></div>' +
      '<div id="lkMsg"></div><div id="lkRes"></div>' +
      '<button class="btn" id="lkOk"' + (cfg.picpay_credenciais ? '' : ' disabled') + '>Gerar link</button>' +
      '<button class="btn sec" id="lkFechar" style="margin-top:8px">Fechar</button>';
    cx.querySelector('#lkFechar').onclick = fechar;
    m.sair = (function (orig) { return function () { orig(); }; })(m.sair);
    cx.querySelector('#lkOk').onclick = async function () {
      var msg = cx.querySelector('#lkMsg');
      var btn = this;
      aviso(msg, 'Gerando o link na PicPay…');
      btn.disabled = true;
      try {
        var r = await api('/api/admin/cobranca', { id: id, valor: cx.querySelector('#lkValor').value, dias: cx.querySelector('#lkDias').value });
        gerou = true;
        aviso(msg, '');
        var zap = 'Olá! Segue o link para renovar o seu acesso ao Relatório de Campo por ' + r.dias + ' dias (' + reais(r.valor_centavos) + '): ' + r.link;
        cx.querySelector('#lkRes').innerHTML =
          '<div class="aviso">Link criado. Vale até ' + dataBR(r.expira_em) + '. Quando o cliente pagar, o prazo da conta é estendido sozinho.</div>' +
          '<input class="pg-link" id="lkLink" readonly value="' + esc(r.link) + '">' +
          '<div class="pg-linha"><button class="btn-mini" id="lkCopiar">Copiar link</button>' +
          '<a class="btn-mini" style="text-decoration:none" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(zap) + '">Enviar pelo WhatsApp</a></div>';
        cx.querySelector('#lkCopiar').onclick = function () { copiar(r.link, this); };
        btn.textContent = 'Gerar outro link';
        btn.disabled = false;
      } catch (e) { aviso(msg, e.message, true); btn.disabled = false; }
    };
    cx.querySelector('#lkFechar').onclick = fechar;
    var veu = cx.parentNode;
    veu.onclick = function (e) { if (e.target === veu) fechar(); };
  }

  // contas no Pix Automático: quem já pagou no mês e quem falta conferir no app do C6
  function desenharAssin() {
    var el = $('#listaAssin');
    if (!el) return;
    var adm = !!(dados.eu && dados.eu.admin);
    if (!adm) { el.innerHTML = ''; return; }
    var lista = (dados.contas || []).filter(function (c) { return c.assin && c.assin.forma === 'pix_automatico'; });
    if (!lista.length) {
      el.innerHTML = '<div style="color:var(--fraco);font-size:13px">Nenhuma conta no Pix Automático ainda. Cadastre o cliente no app do C6 Empresas e, aqui, registre o valor e o dia do débito na conta.</div>';
      return;
    }
    var agora = new Date(), ano = agora.getFullYear(), mes = agora.getMonth();
    var hoje0 = new Date(ano, mes, agora.getDate()).getTime();
    var itens = lista.map(function (c) {
      var a = c.assin, p = c.pagto || {};
      var venc = new Date(ano, mes, Math.min(a.dia, new Date(ano, mes + 1, 0).getDate())).getTime();
      var ult = p.ultimo ? new Date(String(p.ultimo).replace(' ', 'T') + 'Z').getTime() : NaN;
      var pago = !isNaN(ult) && ult >= venc - 5 * 86400000;
      var atraso = Math.floor((hoje0 - venc) / 86400000);
      var ordem, sel;
      if (pago) { ordem = 3; sel = '<span class="selo pub">pago em ' + dataBR(p.ultimo) + '</span>'; }
      else if (atraso < 0) { ordem = 2; sel = '<span class="selo">débito dia ' + a.dia + ' (em ' + diasTxt(-atraso) + ')</span>'; }
      else if (atraso < 3) { ordem = 1; sel = '<span class="selo perto">confira no app do C6 (débito dia ' + a.dia + ')</span>'; }
      else { ordem = 0; sel = '<span class="selo venc">sem confirmação há ' + diasTxt(atraso) + '</span>'; }
      return { ordem: ordem, c: c, sel: sel, pago: pago };
    }).sort(function (x, y) { return x.ordem - y.ordem; });
    el.innerHTML = '<table><tr><th>Conta</th><th>Valor</th><th>Situação neste mês</th><th></th></tr>' + itens.map(function (i) {
      return '<tr><td><b>' + esc(i.c.nome || i.c.email) + '</b></td><td>' + reais(i.c.assin.valor_centavos) + '</td><td>' + i.sel + '</td>' +
        '<td class="acoes">' + (i.pago ? '' : '<button class="selo" data-pago="' + esc(i.c.id) + '">marcar pago</button>') + '</td></tr>';
    }).join('') + '</table>';
    ligarPagto();
  }

  // como a conta paga: Pix Automático (C6), link PicPay ou nada
  function abrirCobranca(id) {
    var c = contaPorId(id);
    if (!c) return;
    var cfg = (pg && pg.config) || {};
    var a = c.assin || { forma: 'pix_automatico', valor_centavos: cfg.valor_centavos || 0, dia: new Date().getDate(), obs: '' };
    var m = modalBase(false), cx = m.cx;
    cx.innerHTML =
      '<h2 style="margin:0 0 4px">Cobrança mensal</h2>' +
      '<p style="margin:0 0 12px;font-size:13px;color:var(--fraco)">' + esc(c.nome || c.email) + '</p>' +
      '<div class="campo"><label>Como esta conta paga</label><select id="cbForma">' +
        '<option value="pix_automatico">Pix Automático (app C6 Empresas)</option>' +
        '<option value="link">Link de pagamento (PicPay)</option>' +
        '<option value="">Nenhuma (tirar da lista)</option></select></div>' +
      '<div class="linha2"><div class="campo"><label>Valor mensal (R$)</label><input id="cbValor" inputmode="decimal" placeholder="ex.: 99,00" value="' +
        (a.valor_centavos ? (a.valor_centavos / 100).toFixed(2).replace('.', ',') : '') + '"></div>' +
      '<div class="campo"><label>Dia do débito</label><input id="cbDia" type="number" min="1" max="31" inputmode="numeric" value="' + a.dia + '"></div></div>' +
      '<div class="campo"><label>Observação (opcional)</label><input id="cbObs" placeholder="ex.: autorizou no app do C6 em 10/11" value="' + esc(a.obs || '') + '"></div>' +
      '<div id="cbMsg"></div>' +
      '<button class="btn" id="cbOk">Salvar</button>' +
      '<button class="btn sec" id="cbCancel" style="margin-top:8px">Cancelar</button>';
    cx.querySelector('#cbForma').value = c.assin ? a.forma : 'pix_automatico';
    cx.querySelector('#cbCancel').onclick = m.sair;
    cx.querySelector('#cbOk').onclick = async function () {
      var msg = cx.querySelector('#cbMsg');
      aviso(msg, 'Salvando…');
      this.disabled = true;
      try {
        await api('/api/admin/assinatura', { id: id, forma: cx.querySelector('#cbForma').value, valor: cx.querySelector('#cbValor').value,
          dia: cx.querySelector('#cbDia').value, obs: cx.querySelector('#cbObs').value });
        m.sair();
        await abrirPainel();
      } catch (e) { aviso(msg, e.message, true); this.disabled = false; }
    };
  }

  // pagamento recebido fora da PicPay: registra e estende o prazo
  function abrirManual(id) {
    var c = contaPorId(id);
    if (!c) return;
    var cfg = (pg && pg.config) || {};
    var m = modalBase(false), cx = m.cx;
    cx.innerHTML =
      '<h2 style="margin:0 0 4px">Marcar como pago</h2>' +
      '<p style="margin:0 0 12px;font-size:13px;color:var(--fraco)">' + esc(c.nome || c.email) + ' · para pagamento recebido por fora (Pix direto, dinheiro…). O prazo da conta é estendido na hora.</p>' +
      '<div class="linha2"><div class="campo"><label>Valor recebido (R$)</label><input id="mnValor" inputmode="decimal" placeholder="ex.: 49,90" value="' +
        (cfg.valor_centavos ? (cfg.valor_centavos / 100).toFixed(2).replace('.', ',') : '') + '"></div>' +
      '<div class="campo"><label>Estender por (dias)</label><input id="mnDias" type="number" min="1" max="3650" inputmode="numeric" value="' + (cfg.dias_ciclo || 30) + '"></div></div>' +
      '<div class="campo"><label>Observação (opcional)</label><input id="mnObs" placeholder="ex.: Pix direto na conta"></div>' +
      '<div id="mnMsg"></div>' +
      '<button class="btn" id="mnOk">Registrar pagamento</button>' +
      '<button class="btn sec" id="mnCancel" style="margin-top:8px">Cancelar</button>';
    cx.querySelector('#mnCancel').onclick = m.sair;
    if (c.assin && c.assin.valor_centavos) {
      cx.querySelector('#mnValor').value = (c.assin.valor_centavos / 100).toFixed(2).replace('.', ',');
      cx.querySelector('#mnDias').value = 31;
    }
    cx.querySelector('#mnOk').onclick = async function () {
      var msg = cx.querySelector('#mnMsg');
      aviso(msg, 'Registrando…');
      this.disabled = true;
      try {
        await api('/api/admin/pagamento-manual', { id: id, valor: cx.querySelector('#mnValor').value, dias: cx.querySelector('#mnDias').value, obs: cx.querySelector('#mnObs').value });
        m.sair();
        await abrirPainel();
      } catch (e) { aviso(msg, e.message, true); this.disabled = false; }
    };
  }

  // valor do plano e situação da ligação com a PicPay
  function abrirPlano() {
    var cfg = (pg && pg.config) || {};
    var m = modalBase(true), cx = m.cx;
    var st = function (ok) { return ok ? '<span class="selo pub">pronto</span>' : '<span class="selo venc">falta</span>'; };
    cx.innerHTML =
      '<h2 style="margin:0 0 4px">Plano e cobrança</h2>' +
      '<p style="margin:0 0 12px;font-size:13px;color:var(--fraco)">Valor e período que já vêm preenchidos ao gerar um link. Dá para trocar em cada link.</p>' +
      '<div class="linha2"><div class="campo"><label>Valor do plano (R$)</label><input id="plValor" inputmode="decimal" placeholder="ex.: 49,90" value="' +
        (cfg.valor_centavos ? (cfg.valor_centavos / 100).toFixed(2).replace('.', ',') : '') + '"></div>' +
      '<div class="campo"><label>Período (dias)</label><input id="plDias" type="number" min="1" max="3650" inputmode="numeric" value="' + (cfg.dias_ciclo || 30) + '"></div></div>' +
      '<div id="plMsg"></div>' +
      '<button class="btn" id="plOk">Salvar plano</button>' +
      '<h3 style="margin:18px 0 6px;font-size:14px;color:var(--verde-escuro)">Ligação com a PicPay</h3>' +
      '<div class="pg-item"><span>Credenciais (PICPAY_CLIENT_ID e PICPAY_CLIENT_SECRET)</span>' + st(cfg.picpay_credenciais) + '</div>' +
      '<div class="pg-item"><span>Chave do aviso de pagamento (PICPAY_WEBHOOK_KEY)</span>' + st(cfg.picpay_webhook) + '</div>' +
      '<div class="campo" style="margin-top:10px"><label>Endereço do aviso de pagamento (cole na PicPay)</label>' +
        '<input class="pg-link" style="margin:0" id="plUrl" readonly value="' + esc(cfg.webhook_url || '') + '"></div>' +
      '<div class="pg-linha"><button class="btn-mini" id="plCopiar">Copiar endereço</button></div>' +
      '<ol class="pg-passos">' +
        '<li>No painel PicPay Empresas, em Integrações, gere o token do "Link de Pagamento" e guarde o client_id e o client_secret (o secret aparece uma vez só).</li>' +
        '<li>Em Configurações, "Meu Checkout", ative a URL de notificação com o endereço acima. A PicPay gera uma API Key: guarde.</li>' +
        '<li>No Cloudflare, em Workers, relatorio-vsl, Configurações, Variáveis e segredos, crie três segredos: PICPAY_CLIENT_ID, PICPAY_CLIENT_SECRET e PICPAY_WEBHOOK_KEY (a API Key do passo 2).</li>' +
        '<li>Volte aqui e toque em Atualizar: os três itens acima devem ficar "pronto".</li>' +
      '</ol>' +
      '<div class="aviso perto" style="margin:0 0 12px">A PicPay não oferece cobrança recorrente automática por Pix: cada renovação é um link novo, que você envia ao cliente. Se ele pagar, o prazo estende sozinho. Se o pagamento for estornado, ajuste o prazo à mão.</div>' +
      '<button class="btn sec" id="plFechar">Fechar</button>';
    cx.querySelector('#plFechar').onclick = m.sair;
    cx.querySelector('#plCopiar').onclick = function () { copiar(cfg.webhook_url || '', this); };
    cx.querySelector('#plOk').onclick = async function () {
      var msg = cx.querySelector('#plMsg');
      aviso(msg, 'Salvando…');
      try {
        await api('/api/admin/pagamentos/config', { valor: cx.querySelector('#plValor').value, dias: cx.querySelector('#plDias').value });
        m.sair();
        await abrirPainel();
      } catch (e) { aviso(msg, e.message, true); }
    };
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

  // filtro vindo do quadro "Relatórios por responsável": { nome, conta } ou null
  var filtroResp = null;
  function nomeResp(r) { return String(r.responsavel || '').trim().replace(/ +/g, ' ').toLowerCase(); }

  /* ---------- CPF/CNPJ da conta ---------- */
  function fmtDoc(v) {
    var d = String(v || '').replace(/[^0-9]/g, '').slice(0, 14);
    if (d.length <= 11) {
      return d.slice(0, 3) + (d.length > 3 ? '.' + d.slice(3, 6) : '') + (d.length > 6 ? '.' + d.slice(6, 9) : '') + (d.length > 9 ? '-' + d.slice(9, 11) : '');
    }
    return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5, 8) + '/' + d.slice(8, 12) + (d.length > 12 ? '-' + d.slice(12, 14) : '');
  }
  function abrirEditar(id) {
    var c = (dados.contas || []).filter(function (x) { return x.id === id; })[0]; if (!c) return;
    var m = modalBase();
    m.cx.innerHTML = '<h2 style="margin:0 0 4px">Editar conta</h2>' +
      '<p style="margin:0 0 14px;font-size:13px;color:var(--fraco)">' + esc(c.email) + '</p>' +
      '<div class="campo"><label>Nome</label><input id="edNome" maxlength="120" value="' + esc(c.nome || '') + '"></div>' +
      '<div class="campo"><label>CPF ou CNPJ (opcional)</label><input id="docV" inputmode="numeric" maxlength="18" placeholder="000.000.000-00 ou 00.000.000/0000-00" value="' + esc(fmtDoc(c.documento || '')) + '"></div>' +
      '<div id="docMsg"></div><button class="btn" id="docOk">Salvar</button>' +
      '<button class="btn sec" id="docNao" style="margin-top:8px">Cancelar</button>';
    var campo = m.cx.querySelector('#docV'), nome = m.cx.querySelector('#edNome'), msg = m.cx.querySelector('#docMsg');
    campo.oninput = function () { campo.value = fmtDoc(campo.value); };
    m.cx.querySelector('#docNao').onclick = m.sair;
    m.cx.querySelector('#docOk').onclick = async function () {
      try { await api('/api/admin/conta-dados', { id: id, nome: nome.value, documento: campo.value }); m.sair(); await abrirPainel(); }
      catch (e) { aviso(msg, e.message, true); }
    };
    setTimeout(function () { nome.focus(); }, 100);
  }

  /* ---------- Adm de equipe (administrador geral define e dá a cota) ---------- */
  function abrirAdm(id) {
    var c = (dados.contas || []).filter(function (x) { return x.id === id; })[0]; if (!c) return;
    var n = (dados.contas || []).filter(function (x) { return x.equipe_id === id; }).length;
    var m = modalBase();
    m.cx.innerHTML = '<h2 style="margin:0 0 4px">Adm de equipe</h2>' +
      '<p style="margin:0 0 14px;font-size:13px;color:var(--fraco)">' + esc(c.nome || c.email) + (c.papel === 'adm' ? ' · já tem ' + n + ' usuário' + (n === 1 ? '' : 's') + ' na equipe' : '') + '</p>' +
      '<div class="campo"><label>Quantos usuários comuns ele pode criar</label><input id="admCota" type="number" min="0" max="500" inputmode="numeric" value="' + (c.papel === 'adm' ? (Number(c.cota) || 0) : 3) + '"></div>' +
      '<p style="margin:0 0 12px;font-size:12.5px;color:var(--fraco)">O Adm cria só usuários comuns. Eles seguem o prazo e os módulos desta conta; o prazo continua sendo só seu.</p>' +
      '<div id="admMsg"></div><button class="btn" id="admOk">' + (c.papel === 'adm' ? 'Salvar' : 'Tornar Adm') + '</button>' +
      (c.papel === 'adm' ? '<button class="btn sec" id="admTira" style="margin-top:8px">Tirar o Adm</button>' : '') +
      '<button class="btn sec" id="admNao" style="margin-top:8px">Cancelar</button>';
    var msg = m.cx.querySelector('#admMsg');
    m.cx.querySelector('#admNao').onclick = m.sair;
    m.cx.querySelector('#admOk').onclick = async function () {
      try { await api('/api/admin/adm', { id: id, adm: true, cota: m.cx.querySelector('#admCota').value }); m.sair(); await abrirPainel(); }
      catch (e) { aviso(msg, e.message, true); }
    };
    var tira = m.cx.querySelector('#admTira');
    if (tira) tira.onclick = async function () {
      try { await api('/api/admin/adm', { id: id, adm: false }); m.sair(); await abrirPainel(); }
      catch (e) { aviso(msg, e.message, true); }
    };
  }

  /* ---------- Acessos só à Timeline (login próprio para os responsáveis) ---------- */
  $('#btnLeitores').onclick = function () { abrirLeitores(); };
  async function abrirLeitores() {
    var m = modalBase();
    m.cx.innerHTML = '<div class="peq">Carregando…</div>';
    var R;
    try { R = await api('/api/admin/leitores'); } catch (e) { m.cx.innerHTML = '<div class="peq">' + esc(e.message) + '</div>'; return; }
    var lista = R.leitores || [];
    m.cx.innerHTML = '<h2 style="margin:0 0 4px">Acessos à Timeline</h2>' +
      '<p style="margin:0 0 14px;font-size:13px;color:var(--fraco)">Cada pessoa entra em <b>amvs.ia.br/admin</b> com o próprio e-mail e senha e vê só a Timeline da sua equipe: fotos, legendas, curtidas e comentários. Não vê Visão geral, Campo, mapa, contas, prazos nem cadastros, e não usa o app de campo.</p>' +
      (lista.length ? lista.map(function (u) {
        return '<div class="eq-u"><div class="av">' + esc(iniciais(u.nome || u.email)) + '</div><div class="t"><b>' + esc(u.nome || u.email) + '</b><small>' + esc(u.email) + '</small></div>' +
          '<button class="selo" data-ltsenha="' + esc(u.id) + '">senha</button> <button class="selo" data-ltapaga="' + esc(u.id) + '" data-nome="' + esc(u.nome || u.email) + '">remover</button></div>';
      }).join('') : '<div class="peq" style="margin-bottom:6px">Nenhum acesso criado ainda.</div>') +
      '<h2 style="margin:18px 0 8px;font-size:15px">Novo acesso</h2>' +
      '<div class="campo"><label>Nome</label><input id="ltNome" autocomplete="off" placeholder="Nome do responsável"></div>' +
      '<div class="campo"><label>E-mail (é o login)</label><input id="ltEmail" type="email" autocomplete="off" placeholder="pessoa@exemplo.com"></div>' +
      '<div class="campo"><label>Senha</label><input id="ltSenha" type="text" autocomplete="off" placeholder="mínimo 6 caracteres"></div>' +
      '<div id="ltMsg"></div><button class="btn" id="ltCriar">Criar acesso</button>' +
      '<button class="btn sec" id="ltFecha" style="margin-top:8px">Fechar</button>';
    var msg = m.cx.querySelector('#ltMsg');
    m.cx.querySelector('#ltFecha').onclick = m.sair;
    m.cx.querySelector('#ltCriar').onclick = async function () {
      aviso(msg, 'Criando…');
      try {
        await api('/api/admin/leitores', { nome: m.cx.querySelector('#ltNome').value.trim(), email: m.cx.querySelector('#ltEmail').value.trim(), senha: m.cx.querySelector('#ltSenha').value });
        m.sair(); abrirLeitores();
      } catch (e) { aviso(msg, e.message, true); }
    };
    m.cx.querySelectorAll('[data-ltapaga]').forEach(function (b) { b.onclick = async function () {
      if (!confirm('Remover o acesso de ' + b.dataset.nome + '? Ele deixa de entrar na Timeline.')) return;
      try { await api('/api/admin/leitores/apagar', { id: b.dataset.ltapaga }); m.sair(); abrirLeitores(); } catch (e) { aviso(msg, e.message, true); }
    }; });
    m.cx.querySelectorAll('[data-ltsenha]').forEach(function (b) { b.onclick = async function () {
      var nova = prompt('Nova senha (mínimo 6 caracteres):');
      if (!nova) return;
      try { await api('/api/admin/leitores/senha', { id: b.dataset.ltsenha, senha: nova }); aviso(msg, 'Senha trocada.'); } catch (e) { aviso(msg, e.message, true); }
    }; });
  }

  /* ---------- Equipe (o Adm cria usuários comuns dentro da cota) ---------- */
  function iniciais(t) { var p = String(t || '?').trim().split(' ').filter(Boolean); return ((p[0] || '?').charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : '')).toUpperCase(); }
  async function carregarEquipe() {
    var box = $('#eqCorpo'); box.innerHTML = '<div class="peq">Carregando…</div>';
    var E;
    try { E = await api('/api/admin/equipe'); } catch (e) { box.innerHTML = '<div class="peq">' + esc(e.message) + '</div>'; return; }
    if (E.papel !== 'adm') { box.innerHTML = '<div class="peq">Esta conta não é Adm de equipe.</div>'; return; }
    var pc = E.cota ? Math.min(100, E.usados / E.cota * 100) : 100, sobra = Math.max(0, (E.cota || 0) - E.usados);
    box.innerHTML = '<div class="eq-cota"><div class="bar"><i style="width:' + pc.toFixed(0) + '%"></i></div><span><b>' + E.usados + ' de ' + (E.cota || 0) + '</b> usuários</span></div>' +
      E.membros.map(function (u) {
        return '<div class="eq-u"><div class="av">' + esc(iniciais(u.nome || u.email)) + '</div><div class="t"><b>' + esc(u.nome || u.email) + '</b><small>' +
          (u.eu ? 'você · ' : '') + esc(u.email) + ' · ' + (u.relatorios || 0) + ' relatório' + (u.relatorios === 1 ? '' : 's') + '</small></div>' +
          '<span class="selo' + (u.papel === 'adm' ? ' pub' : '') + '">' + (u.papel === 'adm' ? 'Adm' : 'comum') + '</span>' +
          (u.papel === 'adm' ? '' : '<div class="eq-ac"><button class="btn-mini" data-eqed="' + esc(u.id) + '">✏️ Editar</button><button class="btn-mini ruim" data-eqex="' + esc(u.id) + '">🗑 Excluir</button></div>') +
          '<div class="eq-form" id="eqf-' + esc(u.id) + '" style="display:none"></div></div>';
      }).join('') +
      (sobra ? '<h2 style="margin:18px 0 8px;font-size:15px">Novo usuário (comum)</h2>' +
        '<div class="campo"><label>Nome</label><input id="eqNome" autocomplete="off"></div>' +
        '<div class="campo"><label>E-mail (é o login no app)</label><input id="eqEmail" type="email" autocomplete="off"></div>' +
        '<div class="campo"><label>Senha (6 ou mais caracteres)</label><input id="eqSenha" type="text" autocomplete="off"></div>' +
        '<div id="eqMsg"></div><button class="btn" id="eqOk">Criar usuário</button>' +
        '<p class="peq" style="margin-top:8px">Você pode criar mais ' + sobra + '. O limite é definido pelo administrador do AMVS. O usuário entra no app com esse e-mail e senha e vê os relatórios dele e da equipe.</p>'
        : '<p class="peq" style="margin-top:12px">A equipe chegou ao limite de ' + (E.cota || 0) + ' usuários. Para mais, fale com o administrador do AMVS.</p>');
    var porId = {}; E.membros.forEach(function (m) { porId[m.id] = m; });
    function formEq(id, html) { var f = document.getElementById('eqf-' + id); f.innerHTML = html; f.style.display = html ? '' : 'none'; return f; }
    box.querySelectorAll('[data-eqed]').forEach(function (b) { b.onclick = function () {
      var u = porId[b.dataset.eqed];
      var f = formEq(u.id, '<div class="campo"><label>Nome</label><input data-n value="' + esc(u.nome || '') + '" autocomplete="off"></div>' +
        '<div class="campo"><label>E-mail (é o login no app)</label><input data-e type="email" value="' + esc(u.email) + '" autocomplete="off"></div>' +
        '<div data-m></div><button class="btn-mini" data-salvar>Salvar</button> <button class="btn-mini" data-cancelar>Cancelar</button>');
      f.querySelector('[data-cancelar]').onclick = function () { formEq(u.id, ''); };
      f.querySelector('[data-salvar]').onclick = async function (ev) {
        var bt = ev.target; bt.disabled = true;
        try {
          var r = await api('/api/admin/equipe/usuario/editar', { id: u.id, nome: f.querySelector('[data-n]').value, email: f.querySelector('[data-e]').value });
          await carregarEquipe();
          aviso($('#eqMsg') || $('#eqCorpo'), r.email_mudou ? 'Dados salvos. O novo e-mail já é o login do usuário (a senha continua a mesma).' : 'Dados salvos.', false);
        } catch (e) { aviso(f.querySelector('[data-m]'), e.message, true); bt.disabled = false; }
      };
    }; });
    box.querySelectorAll('[data-eqex]').forEach(function (b) { b.onclick = function () {
      var u = porId[b.dataset.eqex], n = u.relatorios || 0;
      var f = formEq(u.id, '<div class="aviso ruim">Excluir <b>' + esc(u.nome || u.email) + '</b>? ' +
        (n ? 'Os <b>' + n + ' relatório' + (n === 1 ? '' : 's') + '</b> e as fotos dele serão apagados e não dá para desfazer. ' : 'Ele não tem relatórios. ') +
        'A vaga volta para a cota da equipe.</div>' +
        '<div class="campo"><label>Para confirmar, digite o e-mail dele: <b>' + esc(u.email) + '</b></label><input data-c type="email" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="digite o e-mail aqui"></div>' +
        '<div data-m></div><button class="btn-mini ruim" data-confirma>Excluir definitivamente</button> <button class="btn-mini" data-cancelar>Cancelar</button>');
      f.querySelector('[data-cancelar]').onclick = function () { formEq(u.id, ''); };
      f.querySelector('[data-confirma]').onclick = async function (ev) {
        var bt = ev.target; bt.disabled = true;
        try {
          var dig = f.querySelector('[data-c]').value.trim();
          if (!dig) { aviso(f.querySelector('[data-m]'), 'Digite o e-mail do usuário no campo acima para confirmar.', true); bt.disabled = false; return; }
          await api('/api/admin/equipe/usuario/excluir', { id: u.id, email: dig });
          await carregarEquipe(); aviso($('#eqMsg') || $('#eqCorpo'), 'Usuário excluído. A vaga foi liberada.', false);
        } catch (e) { aviso(f.querySelector('[data-m]'), e.message, true); bt.disabled = false; }
      };
    }; });
    var ok = $('#eqOk');
    if (ok) ok.onclick = async function () {
      ok.disabled = true;
      try {
        await api('/api/admin/equipe/usuario', { nome: $('#eqNome').value, email: $('#eqEmail').value, senha: $('#eqSenha').value });
        await carregarEquipe(); aviso($('#eqCorpo').querySelector('#eqMsg') || $('#eqCorpo'), 'Usuário criado. Passe o e-mail e a senha para ele entrar no app.', false);
      } catch (e) { aviso($('#eqMsg'), e.message, true); ok.disabled = false; }
    };
  }

  /* ---------- Timeline: um post por relatório (fazenda como perfil, fotos e vídeos com as legendas) ---------- */
  var FEED = { carregado: false, mais: null, carregando: false };
  async function carregarFeed(reset) {
    if (FEED.carregando) return;
    FEED.carregando = true;
    var box = $('#feed'), btn = $('#feedMais');
    if (reset) { box.innerHTML = '<div class="feedvz">Carregando…</div>'; FEED.mais = null; }
    try {
      var r = await api('/api/admin/timeline' + (!reset && FEED.mais ? '?antes=' + encodeURIComponent(FEED.mais) : ''));
      if (reset) box.innerHTML = '';
      if (!r.posts.length && reset) box.innerHTML = '<div class="feedvz">Ainda não há fotos nem vídeos sincronizados nos relatórios.</div>';
      box.insertAdjacentHTML('beforeend', r.posts.map(postHtml).join(''));
      FEED.mais = r.mais; FEED.carregado = true;
      btn.style.display = r.mais ? '' : 'none';
      ligarPosts();
    } catch (e) { if (reset) box.innerHTML = '<div class="feedvz">' + esc(e.message) + '</div>'; }
    FEED.carregando = false;
  }
  function postHtml(p) {
    var n = p.midias.length;
    var slides = p.midias.map(function (m, i) {
      return '<div class="sl" data-i="' + i + '">' + (m.tipo === 'video'
        ? '<video src="' + esc(m.src) + '" controls playsinline preload="metadata"></video>'
        : '<img src="' + esc(m.src) + '?capa=1" loading="lazy" alt="">') + (n > 1 ? '<span class="n">' + (i + 1) + '/' + n + '</span>' : '') + '</div>';
    }).join('');
    var m0 = p.midias[0] || {};
    POSTS[p.id] = p;
    return '<article class="post" data-post="' + esc(p.id) + '">' +
      // perfil do post: quem fez (responsável da visita ou o usuário); a fazenda e a data embaixo
      '<div class="ph"><div class="av">' + esc(iniciais(p.responsavel || p.autor || p.fazenda)) + '</div><div><b>' + esc(p.responsavel || p.autor || p.fazenda) + '</b><small>' + esc(p.fazenda) + ' · ' + dataBR(p.data) + (p.servico ? ' · ' + esc(p.servico) : '') + '</small></div>' +
        '<div class="ac">' + (p.pode_corrigir ? '<button class="selo" data-corr="' + esc(p.id) + '" style="cursor:pointer">✏️ corrigir</button>' : '') + '</div></div>' +
      '<div class="car">' + slides + '</div>' +
      visHtml(p) +
      '<div class="acs"><button data-curtir="' + esc(p.id) + '" class="' + (p.eu_curti ? 'on' : '') + '">' + (p.eu_curti ? '❤️' : '🤍') + ' Curtir</button>' +
        '<button data-comentar="' + esc(p.id) + '">💬 Comentar</button>' +
        '<button data-compart="' + esc(p.id) + '"' + (p.link ? '' : ' disabled title="O relatório ainda não foi publicado"') + '>↗️ Compartilhar</button></div>' +
      '<div class="cur" data-cur="' + esc(p.id) + '">' + curtidasTxt(p) + '</div>' +
      '<div class="lg"><span class="lgtxt">' + legendaHtml(m0) + '</span>' +
        (p.obs.length ? '<div class="obs"><b>Observações gerais</b><br>' + esc(p.obs.join(' · ')).slice(0, 600) + '</div>' : '') +
        (p.link ? '<div style="margin-top:6px"><a href="' + esc(p.link) + '?sc=1" target="_blank">Ver relatório completo ›</a></div>' : '<div class="peq" style="margin-top:6px">relatório ainda em aberto</div>') + '</div>' +
      '<div class="coms" data-coms="' + esc(p.id) + '">' + (p.comentarios || []).map(comentarioHtml).join('') + '</div>' +
      '<div class="ncm"><input data-ncm="' + esc(p.id) + '" placeholder="Escreva um comentário…" maxlength="1000"><button data-enviar="' + esc(p.id) + '">Enviar</button></div>' +
      '<script type="application/json" class="pdados">' + JSON.stringify(p.midias.map(function (m) { return { l: m.legenda, t: m.talhao }; })).split('<').join('&lt;') + '<' + '/script></article>';
  }
  // visualizações do link do relatório, como no Instagram ("88,1 mil · Ver insights")
  function numCurto(n) {
    if (n >= 1000000) return (Math.round(n / 100000) / 10).toLocaleString('pt-BR') + ' mi';
    if (n >= 10000) return (Math.round(n / 100) / 10).toLocaleString('pt-BR') + ' mil';
    return Number(n || 0).toLocaleString('pt-BR');
  }
  function quandoMT(s) {
    try { return new Date(String(s).replace(' ', 'T') + 'Z').toLocaleString('pt-BR', { timeZone: 'America/Cuiaba', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' às'); }
    catch (e) { return ''; }
  }
  function visHtml(p) {
    if (!p.link) return '';
    var v = p.vis || { total: 0, pessoas: 0 };
    var det = v.total
      ? '<b>' + v.total.toLocaleString('pt-BR') + '</b> ' + (v.total === 1 ? 'visualização' : 'visualizações') + ' de <b>' + v.pessoas.toLocaleString('pt-BR') + '</b> ' + (v.pessoas === 1 ? 'pessoa' : 'pessoas diferentes') +
        (v.ultimo ? '<br>Última visualização: ' + esc(quandoMT(v.ultimo)) : '')
      : 'Ninguém abriu o link do relatório ainda.';
    return '<div class="vis"><span>👁 <b>' + numCurto(v.total) + '</b> ' + (v.total === 1 ? 'visualização' : 'visualizações') + '</span> · <button data-vis="' + esc(p.id) + '">Ver detalhes</button>' +
      '<div class="visd" hidden>' + det + '<br><span style="font-size:11.5px">Conta cada vez que alguém abre o link. Quando você abre pelo painel, não conta.</span></div></div>';
  }
  function curtidasTxt(p) {
    var n = p.curtidas || 0; if (!n) return '';
    var nomes = (p.curtiu || []).slice(-1);
    return 'Curtido por <b>' + esc(nomes[0] || '') + '</b>' + (n > 1 ? ' e <b>mais ' + (n - 1) + '</b>' : '');
  }
  function quandoTxt(iso) {
    var d = new Date(iso), s = (Date.now() - d.getTime()) / 1000;
    if (isNaN(s)) return ''; if (s < 60) return 'agora'; if (s < 3600) return Math.floor(s / 60) + ' min'; if (s < 86400) return Math.floor(s / 3600) + ' h';
    if (s < 172800) return 'ontem'; return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }
  function comentarioHtml(c) { return '<div class="cm" data-cm="' + esc(c.id) + '"><b>' + esc(c.autor || '') + '</b>' + esc(c.texto) + '<small>' + quandoTxt(c.criado_em) + '</small>' + (c.meu ? '<button data-apcm="' + esc(c.id) + '">apagar</button>' : '') + '</div>'; }
  var POSTS = {};
  function legendaHtml(m) { return (m.talhao || m.t ? '<span class="tal">📍 ' + esc(m.talhao || m.t) + '</span>' : '') + esc(m.legenda != null ? m.legenda : (m.l || '')); }
  function ligarPosts() {
    document.querySelectorAll('#feed .post').forEach(function (el) {
      if (el.dataset.ligado) return; el.dataset.ligado = '1';
      var bv = el.querySelector('[data-vis]');
      if (bv) bv.onclick = function () { var d = el.querySelector('.visd'); d.hidden = !d.hidden; bv.textContent = d.hidden ? 'Ver detalhes' : 'Fechar'; };
      var car = el.querySelector('.car'), leg = el.querySelector('.lgtxt'), dd = [];
      try { dd = JSON.parse(el.querySelector('.pdados').textContent.split('&lt;').join('<')); } catch (e) { dd = []; }
      car.addEventListener('scroll', function () {
        var i = Math.round(car.scrollLeft / Math.max(1, car.clientWidth));
        if (dd[i]) leg.innerHTML = legendaHtml(dd[i]);
      }, { passive: true });
    });
    document.querySelectorAll('#feed [data-corr]').forEach(function (b) { b.onclick = function () { abrirCorrecao(b.dataset.corr); }; });
    document.querySelectorAll('#feed [data-curtir]').forEach(function (b) { b.onclick = async function () {
      var p = POSTS[b.dataset.curtir]; if (!p || b.disabled) return; b.disabled = true;
      try {
        var r = await api('/api/admin/curtir', { id: p.id });
        var eu = (dados.eu && (dados.eu.nome || dados.eu.email)) || 'você';
        p.eu_curti = r.curtiu; p.curtidas = r.curtidas;
        p.curtiu = (p.curtiu || []).filter(function (x) { return x !== eu; }); if (r.curtiu) p.curtiu.push(eu);
        b.classList.toggle('on', r.curtiu); b.textContent = (r.curtiu ? '❤️' : '🤍') + ' Curtir';
        var c = document.querySelector('[data-cur="' + p.id + '"]'); if (c) c.innerHTML = curtidasTxt(p);
      } catch (e) { alert(e.message); }
      b.disabled = false;
    }; });
    document.querySelectorAll('#feed [data-comentar]').forEach(function (b) { b.onclick = function () { var i = document.querySelector('[data-ncm="' + b.dataset.comentar + '"]'); if (i) i.focus(); }; });
    document.querySelectorAll('#feed [data-enviar]').forEach(function (b) {
      var id = b.dataset.enviar, inp = document.querySelector('[data-ncm="' + id + '"]');
      var enviar = async function () {
        var t = (inp.value || '').trim(); if (!t || b.disabled) return; b.disabled = true;
        try {
          var r = await api('/api/admin/comentar', { id: id, texto: t });
          inp.value = ''; var box = document.querySelector('[data-coms="' + id + '"]');
          if (box) { box.insertAdjacentHTML('beforeend', comentarioHtml(r.comentario)); ligarApagarComentarios(); }
        } catch (e) { alert(e.message); }
        b.disabled = false;
      };
      b.onclick = enviar;
      inp.onkeydown = function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); enviar(); } };
    });
    document.querySelectorAll('#feed [data-compart]').forEach(function (b) { b.onclick = async function () {
      var p = POSTS[b.dataset.compart]; if (!p || !p.link) return;
      var url = location.origin + p.link, titulo = 'Relatório de visita — ' + p.fazenda;
      try {
        if (navigator.share) await navigator.share({ title: titulo, text: titulo, url: url });
        else { await navigator.clipboard.writeText(url); alert('Link do relatório copiado.'); }
      } catch (e) { if (e && e.name === 'AbortError') return; }
      api('/api/admin/compartilhou', { id: p.id }).catch(function () {});
    }; });
    ligarApagarComentarios();
  }
  function ligarApagarComentarios() {
    document.querySelectorAll('#feed [data-apcm]').forEach(function (b) { b.onclick = async function () {
      if (!confirm('Apagar este comentário?')) return;
      try { await api('/api/admin/comentario/apagar', { id: b.dataset.apcm }); var el = document.querySelector('[data-cm="' + b.dataset.apcm + '"]'); if (el) el.remove(); }
      catch (e) { alert(e.message); }
    }; });
  }

  /* ---------- sininho: quem curtiu, comentou e compartilhou os relatórios ---------- */
  function sinoN(n) { var b = $('#sinoN'); b.textContent = n > 99 ? '99+' : String(n || ''); b.style.display = n ? '' : 'none'; }
  async function contarSino() { try { var r = await api('/api/admin/notificacoes?so=n'); sinoN(r.nao_lidas); } catch (e) {} }
  setInterval(function () { if (token && $('#telaPainel').style.display !== 'none' && !document.hidden) contarSino(); }, 60000);
  // avisos no celular (app do painel instalado): service worker do painel + assinatura
  var PUSH_OK = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (PUSH_OK) {
    navigator.serviceWorker.register('/admin-sw.js', { scope: '/admin' }).catch(function () {});
    navigator.serviceWorker.addEventListener('message', function (ev) { if (ev.data && ev.data.abrir === 'avisos' && token) abrirSino(); });
  }
  function chaveBytes(b) { var x = String(b).split('-').join('+').split('_').join('/'), bin = atob(x + '==='.slice((x.length + 3) % 4)), o = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i); return o; }
  async function pushAtivo() {
    if (!PUSH_OK || Notification.permission !== 'granted') return false;
    try { var reg = await navigator.serviceWorker.getRegistration('/admin'); var sub = reg && await reg.pushManager.getSubscription(); return !!sub; } catch (e) { return false; }
  }
  async function ativarPush() {
    if (!PUSH_OK) throw new Error('Este navegador não recebe avisos. No iPhone, adicione o painel à Tela de Início (Compartilhar → Adicionar à Tela de Início), abra por ele e toque aqui de novo.');
    var perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('Os avisos ficaram bloqueados. Libere nas configurações do celular (Notificações) e tente de novo.');
    await navigator.serviceWorker.register('/admin-sw.js', { scope: '/admin' });
    var reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
    if (!sub) { var k = await api('/api/admin/push/chave'); sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveBytes(k.chave) }); }
    await api('/api/admin/push/assinar', { assinatura: sub.toJSON() });
  }
  var NTF = 'todas';
  var NT_IC = { curtiu: ['❤️', '#FDE7E7'], comentou: ['💬', '#E7F0FD'], compartilhou: ['↗️', '#E8F4EC'], soja: ['📊', '#E8F4EC'], aplicacao: ['✔️', '#E7F0FD'], alerta: ['⚠️', '#FDECEA'], chuva: ['🌧️', '#E6F3FB'] };
  function diaNt(iso) {
    var k = function (x) { return x.toLocaleDateString('pt-BR', { timeZone: 'America/Cuiaba' }); }, d = new Date(iso);
    return k(d) === k(new Date()) ? 'Hoje' : k(d) === k(new Date(Date.now() - 86400e3)) ? 'Ontem' : d.toLocaleDateString('pt-BR', { timeZone: 'America/Cuiaba', weekday: 'short', day: '2-digit', month: '2-digit' });
  }
  async function abrirSino() {
    var m = modalBase(true);
    m.cx.innerHTML = '<h2 style="margin:0 0 10px">🔔 Notificações</h2><p class="peq">Carregando…</p>';
    var N;
    try { N = await api('/api/admin/notificacoes'); } catch (e) { m.cx.innerHTML = '<p>' + esc(e.message) + '</p>'; return; }
    var temAv = !!N.pode_avisos, ativo = temAv ? await pushAtivo() : true;
    var txt = function (x) {
      return '<b>' + esc(x.de_nome || 'Alguém') + '</b> ' + (x.tipo === 'curtiu' ? 'curtiu o relatório da <b>' + esc(x.fazenda) + '</b>'
        : x.tipo === 'comentou' ? 'comentou: “' + esc(x.texto || '') + '”' : 'compartilhou o relatório da <b>' + esc(x.fazenda) + '</b>');
    };
    function pintarNt() {
      var fil = temAv ? [['todas', 'Todas'], ['soja', '📈 Soja e mercado'], ['timeline', '❤️ Timeline'], ['aplicacao', '🚜 Aplicações'], ['chuva', '🌧️ Chuva']] : [];
      var l = N.lista.filter(function (x) { return NTF === 'todas' || x.cat === NTF; }), ult = '';
      var h = '<h2 style="margin:0 0 10px">🔔 Notificações</h2>' +
        (temAv && !ativo ? '<div class="nt-push"><span style="flex:1">📲 Receba o fechamento da soja e os alertas de alta no celular.</span><button class="btn-mini" id="ntAtivar">Ativar avisos</button></div><div id="ntMsg"></div>' : '') +
        (fil.length ? '<div class="nt-fil">' + fil.map(function (f) { return '<button data-ntf="' + f[0] + '"' + (NTF === f[0] ? ' class="on"' : '') + '>' + f[1] + '</button>'; }).join('') + '</div>' : '');
      if (!l.length) h += '<p class="peq">' + (N.lista.length ? 'Nenhuma notificação deste tipo.' : 'Nenhuma notificação ainda. Curtidas, comentários e compartilhamentos dos relatórios' + (temAv ? ', o fechamento da soja, as aplicações e as chuvas lançadas' : '') + ' aparecem aqui.') + '</p>';
      else h += '<div class="nts">' + l.map(function (x) {
        var d = diaNt(x.criado_em), cab = ''; if (d !== ult) { cab = '<div class="nt-dia">' + esc(d) + '</div>'; ult = d; }
        if (x.tipo === 'aviso') {
          var ic = NT_IC[x.cat] || ['🔔', '#eee'], tit = String(x.titulo || '');
          if (x.cat === 'soja' && tit.indexOf('alta') >= 0) ic = ['📈', '#E8F4EC'];
          if (x.cat === 'aplicacao' && tit.indexOf('parcial') >= 0) ic = ['◐', '#E7F0FD'];
          tit = tit.replace(/^[^A-Za-zÀ-ÿ0-9]+/, '');
          return cab + '<div class="nt' + (x.lida ? '' : ' nova') + '" style="align-items:flex-start;cursor:default"><div class="ic" style="background:' + ic[1] + '">' + ic[0] + '</div>' +
            '<div class="t"><b>' + esc(tit) + '</b>' + (x.corpo ? '<p>' + esc(x.corpo) + '</p>' : '') + '<small>' + quandoTxt(x.criado_em) + '</small></div></div>';
        }
        var i = NT_IC[x.tipo] || ['🔔', '#eee'];
        return cab + '<div class="nt' + (x.lida ? '' : ' nova') + '" data-nt="' + esc(x.relatorio_id || '') + '"><div class="ic" style="background:' + i[1] + '">' + i[0] + '</div>' +
          '<div class="t">' + txt(x) + '<small>' + quandoTxt(x.criado_em) + (x.tipo === 'comentou' ? ' · ' + esc(x.fazenda) : '') + '</small></div>' + (x.foto ? '<img src="' + esc(x.foto) + '?capa=1" alt="">' : '') + '</div>';
      }).join('') + '</div>';
      h += '<button class="btn sec" id="ntFecha" style="margin-top:12px">Fechar</button>';
      m.cx.innerHTML = h;
      m.cx.querySelector('#ntFecha').onclick = m.sair;
      m.cx.querySelectorAll('[data-ntf]').forEach(function (b) { b.onclick = function () { NTF = b.dataset.ntf; pintarNt(); }; });
      var at = m.cx.querySelector('#ntAtivar');
      if (at) at.onclick = async function () {
        at.disabled = true;
        try { await ativarPush(); ativo = true; pintarNt(); aviso(m.cx.querySelector('#ntMsg') || m.cx, 'Avisos ligados neste celular.', false); }
        catch (e) { at.disabled = false; aviso(m.cx.querySelector('#ntMsg'), e.message, true); }
      };
      m.cx.querySelectorAll('[data-nt]').forEach(function (el) { el.onclick = function () {
        m.sair(); var id = el.dataset.nt, bt = document.querySelector('#subabas button[data-aba="timeline"]');
        if (bt) bt.click();
        var achar = function (n) { var post = document.querySelector('#feed [data-post="' + id + '"]'); if (post) post.scrollIntoView({ behavior: 'smooth', block: 'start' }); else if (n > 0) setTimeout(function () { achar(n - 1); }, 500); };
        achar(8);
      }; });
    }
    pintarNt();
    if (N.nao_lidas) { api('/api/admin/notificacoes/lidas', {}).catch(function () {}); sinoN(0); }
  }
  $('#btnSino').onclick = function () { abrirSino(); };
  $('#feedMais').onclick = function () { carregarFeed(false); };

  /* ---------- Corrigir legendas e observações gerais (autor, Adm da equipe e administrador) ---------- */
  async function abrirCorrecao(id) {
    var m = modalBase(true); m.cx.classList.add('corr');
    m.cx.innerHTML = '<p class="peq">Carregando…</p>';
    var C;
    try { C = await api('/api/admin/corrigir?id=' + encodeURIComponent(id)); } catch (e) { m.cx.innerHTML = '<p>' + esc(e.message) + '</p><button class="btn sec" id="crNao">Fechar</button>'; m.cx.querySelector('#crNao').onclick = m.sair; return; }
    var R = C.relatorio, textos = C.itens.filter(function (i) { return i.tipo === 'texto'; }), midias = C.itens.filter(function (i) { return i.tipo !== 'texto'; });
    var hora = function (h) { var d = new Date(h); return isNaN(d) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); };
    m.cx.innerHTML = '<h2 style="margin:0 0 2px">✏️ Corrigir relatório · ' + esc(R.fazenda || '') + '</h2>' +
      '<p class="peq" style="margin:0 0 10px">' + dataBR(R.data) + ' · ' + esc(R.autor || '') + ' · ' + (R.status === 'publicado' ? 'publicado' : 'em aberto') + '</p>' +
      '<div class="aviso-box" style="background:#FFF7E0;border:1px solid #F1D98A;color:#6B5200;border-radius:10px;padding:8px 10px;font-size:12.5px;margin-bottom:10px">As correções aparecem no link do cliente na hora. Fotos e vídeos não mudam, só os textos. No celular de quem fez o relatório a conversa continua com o texto antigo.</div>' +
      ((R.observacoes || textos.length) ? '<h3 style="margin:10px 0 6px;font-size:15px">Observações gerais</h3>' : '') +
      (R.observacoes ? '<textarea data-obs="1" rows="3">' + esc(R.observacoes) + '</textarea>' : '') +
      textos.map(function (t) { return '<div style="margin-top:8px"><small class="peq">' + hora(t.hora) + '</small><textarea data-it="' + esc(t.id) + '" rows="4">' + esc(t.legenda) + '</textarea></div>'; }).join('') +
      (midias.length ? '<h3 style="margin:16px 0 4px;font-size:15px">Legendas das fotos e vídeos</h3>' : '') +
      midias.map(function (i) {
        return '<div class="corr-it">' + (i.tipo === 'foto' && i.src ? '<img src="' + esc(i.src) + '?capa=1" loading="lazy" alt="">' : '<div class="vd">' + (i.tipo === 'video' ? '▶' : '🎤') + '</div>') +
          '<div style="flex:1;min-width:0"><small>' + esc(i.talhao || 'sem talhão') + ' · ' + hora(i.hora) + '</small><textarea data-it="' + esc(i.id) + '" rows="2">' + esc(i.legenda) + '</textarea></div></div>';
      }).join('') +
      '<div id="crMsg" style="margin-top:8px"></div><button class="btn" id="crOk" style="margin-top:6px">Salvar correções</button><button class="btn sec" id="crNao" style="margin-top:8px">Cancelar</button>';
    m.cx.querySelector('#crNao').onclick = m.sair;
    m.cx.querySelector('#crOk').onclick = async function () {
      var b = this, corpo = { id: R.id, itens: [] }, obs = m.cx.querySelector('[data-obs]');
      if (obs) corpo.observacoes = obs.value;
      m.cx.querySelectorAll('[data-it]').forEach(function (t) {
        var orig = C.itens.filter(function (i) { return i.id === t.dataset.it; })[0];
        if (orig && orig.legenda !== t.value) corpo.itens.push({ id: t.dataset.it, legenda: t.value });
      });
      b.disabled = true;
      try {
        await api('/api/admin/corrigir', corpo); m.sair();
        if (FEED.carregado) carregarFeed(true);
        alert('Correções salvas.');
      } catch (e) { aviso(m.cx.querySelector('#crMsg'), e.message, true); b.disabled = false; }
    };
  }

  function desenharRelatorios() {
    var termo = ($('#filtro').value || '').toLowerCase();
    var chip = $('#chipResp');
    if (filtroResp) {
      chip.innerHTML = '<span class="chip-filtro">Responsável: <b>' + (filtroResp.nome ? esc(filtroResp.nome) : 'sem responsável') + '</b>' +
        (filtroResp.conta ? ' · ' + esc(filtroResp.conta) : '') + '<button id="limparResp">limpar ✕</button></span>';
      $('#limparResp').onclick = function () { filtroResp = null; desenharRelatorios(); };
    } else { chip.innerHTML = ''; }
    var lista = dados.relatorios.filter(function (r) {
      if (filtroResp) {
        if (nomeResp(r) !== filtroResp.nome.toLowerCase()) return false;
        if (filtroResp.conta && String(r.conta || '') !== filtroResp.conta) return false;
      }
      if (!termo) return true;
      return [r.fazenda, r.produtor, r.conta, r.safra, r.servico, r.responsavel].join(' ').toLowerCase().indexOf(termo) >= 0;
    });
    var linhas = lista.map(function (r) {
      var sel = r.status === 'publicado'
        ? '<span class="selo pub">enviado</span>'
        : '<span class="selo">' + esc(r.status || 'rascunho') + '</span>';
      return '<tr><td>' + dataBR(r.data_inicio || r.criado_em) + '</td>' +
        '<td><b>' + esc(r.fazenda || '—') + '</b><br><span style="color:var(--fraco);font-size:12px">' + esc(r.produtor || '') + '</span></td>' +
        '<td>' + esc(r.safra || '—') + '</td>' +
        '<td>' + (r.responsavel ? esc(r.responsavel) : '<span style="color:var(--fraco)">—</span>') + '</td>' +
        '<td>' + r.registros + '<br><span style="color:var(--fraco);font-size:11.5px">' + r.fotos + ' fotos · ' + r.videos + ' vídeos</span></td>' +
        '<td>' + esc(r.conta_nome || r.conta || '—') + (r.meu === false && !(dados.eu && dados.eu.admin) ? '<br><span class="peq">equipe</span>' : '') + '</td>' +
        '<td>' + sel + '</td>' +
        '<td>' + acessosCel(r) + '</td>' +
        '<td style="white-space:nowrap">' + (r.status === 'publicado' ? '<a href="/r/' + esc(r.id) + '?sc=1" target="_blank">abrir</a>' : '—') +
          (r.pode_corrigir ? '<br><button class="selo" data-corr="' + esc(r.id) + '" style="cursor:pointer;margin-top:4px">✏️ corrigir</button>' : '') + '</td></tr>';
    }).join('');
    $('#tRels').innerHTML =
      '<tr><th>Data</th><th>Fazenda</th><th>Safra</th><th>Responsável</th><th>Registros</th><th>Conta</th><th>Status</th><th>Acessos</th><th></th></tr>' +
      (linhas || '<tr><td colspan="9" style="color:var(--fraco)">Nada encontrado.</td></tr>');
    document.querySelectorAll('[data-corr]').forEach(function (b) { b.onclick = function () { abrirCorrecao(b.dataset.corr); }; });
  }
  $('#filtro').addEventListener('input', function () { if (dados) desenharRelatorios(); });

  // quantos relatórios cada responsável fez (o administrador vê também de qual conta é cada um)
  function desenharResp() {
    var adm = !!(dados.eu && dados.eu.admin);
    var grupos = {};
    dados.relatorios.forEach(function (r) {
      var nome = String(r.responsavel || '').trim().replace(/ +/g, ' ');
      var chave = (adm ? String(r.conta || '') : '') + '|' + nome.toLowerCase();
      var g = grupos[chave] || (grupos[chave] = { chave: chave, nome: nome, conta: r.conta || '', total: 0, enviados: 0 });
      g.total++;
      if (r.status === 'publicado') g.enviados++;
    });
    var lista = Object.keys(grupos).map(function (k) { return grupos[k]; })
      .sort(function (a, b) {
        if (!a.nome !== !b.nome) return a.nome ? -1 : 1;
        return b.total - a.total || a.nome.localeCompare(b.nome);
      });
    var el = $('#porResp');
    if (!lista.length) { el.innerHTML = '<div style="color:var(--fraco);font-size:13px">Nenhum relatório ainda.</div>'; return; }
    var max = Math.max.apply(null, lista.map(function (g) { return g.total; }));
    el.innerHTML = lista.map(function (g) {
      var larg = Math.max(4, Math.round(g.total / max * 100));
      return '<div class="resp-linha clic" data-k="' + esc(g.chave) + '" title="Ver os relatórios deste responsável"><div class="nome">' + (g.nome ? esc(g.nome) : '<span style="color:var(--fraco);font-weight:400">Sem responsável</span>') +
        (adm && g.conta ? '<small>' + esc(g.conta) + '</small>' : '') + '</div>' +
        '<div class="trilho"><i style="width:' + larg + '%"></i></div>' +
        '<div class="num"><b>' + g.total + '</b><span>' + g.enviados + ' enviado' + (g.enviados === 1 ? '' : 's') + '</span></div></div>';
    }).join('');
    // clicar no responsável abre a aba Relatórios já filtrada por ele
    el.querySelectorAll('.resp-linha').forEach(function (linha) {
      linha.onclick = function () {
        var g = grupos[linha.getAttribute('data-k')];
        if (!g) return;
        filtroResp = { nome: g.nome, conta: adm ? g.conta : '' };
        $('#filtro').value = '';
        document.querySelector('.abas button[data-aba="rels"]').click();
        desenharRelatorios();
        window.scrollTo(0, 0);
      };
    });
  }

  function desenharBarras() {
    var porDia = {};
    if (dados.visitasDia) {
      // administrador geral: a quantidade de todas as contas (vem pronta do servidor)
      dados.visitasDia.forEach(function (x) { if (x.d) porDia[x.d] = Number(x.n) || 0; });
    } else {
      dados.relatorios.forEach(function (r) {
        var d = String(r.data_inicio || r.criado_em || '').slice(0, 10);
        if (d) porDia[d] = (porDia[d] || 0) + 1;
      });
    }
    var leg = $('#barrasNota');
    if (leg) leg.textContent = dados.visitasDia ? 'Todas as contas · só a quantidade de visitas' : '';
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
      // fundo de satélite (Esri, sem chave) com nomes de cidades e divisas por cima; o mapa comum fica como opção
      var esri = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
      var satelite = L.layerGroup([
        L.tileLayer(esri + 'World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19, maxNativeZoom: 18, attribution: 'Imagens © Esri, Maxar, Earthstar Geographics'
        }),
        L.tileLayer(esri + 'Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19, maxNativeZoom: 18
        })
      ]).addTo(mapa);
      var comum = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '© OpenStreetMap'
      });
      L.control.layers({ 'Satélite': satelite, 'Mapa': comum }, null, { position: 'topright' }).addTo(mapa);
      mapa.setView([-15.2, -59.3], 7);
      mapa.createPane('areas').style.zIndex = 350;   // as áreas ficam por baixo dos pontos
    }
    if (camada) mapa.removeLayer(camada);
    if (camadaAreas) { mapa.removeLayer(camadaAreas); camadaAreas = null; }
    carregarAreas(pts);
    // visitas das outras contas (administrador geral): só o ponto, sem nome e sem abrir o relatório
    var outros = (dados.pontosOutros || []).filter(function (p) { return p.lat != null && p.lon != null; });
    var marcasOutros = outros.map(function (p) {
      return L.circleMarker([p.lat, p.lon], {
        radius: 7, color: '#fff', weight: 2, fillColor: p.status === 'publicado' ? '#1B7A43' : '#F0A202', fillOpacity: .55
      }).bindPopup('<b>Visita de outro usuário</b><br>' + dataBR(p.data) +
        '<br><span style="color:#6B7B72;font-size:11px">só a localização · relatório não liberado</span>');
    });
    var lo = $('#legOutros'); if (lo) lo.textContent = outros.length ? ' · ponto mais claro = visita de outro usuário (só a localização)' : '';
    var todosPts = pts.concat(outros);
    if (!todosPts.length) return;
    camada = L.layerGroup(marcasOutros.concat(pts.map(function (p) {
      var cor = p.status === 'publicado' ? '#1B7A43' : '#F0A202';
      return L.circleMarker([p.lat, p.lon], {
        radius: 8, color: '#fff', weight: 2, fillColor: cor, fillOpacity: .9
      }).bindPopup(
        '<b>' + esc(p.fazenda || '—') + '</b><br>' + esc(p.produtor || '') +
        '<br>' + dataBR(p.data) + ' · ' + p.n + ' registro(s)' +
        '<br><span style="color:#6B7B72;font-size:11px">' + esc(p.conta || '') + '</span>' +
        (p.status === 'publicado' ? '<br><a href="/r/' + esc(p.id) + '?sc=1" target="_blank">abrir relatório</a>' : '')
      );
    }))).addTo(mapa);
    mapa.fitBounds(L.latLngBounds(todosPts.map(function (p) { return [p.lat, p.lon]; })).pad(0.25));
  }

  // desenha no mapa os talhões dos KMLs importados (buscados à parte, porque pesam mais)
  function carregarAreas(pts) {
    api('/api/admin/areas').then(function (r) {
      if (!mapa) return;
      if (camadaAreas) { mapa.removeLayer(camadaAreas); camadaAreas = null; }
      var grupo = L.featureGroup();
      (r.areas || []).forEach(function (a) {
        L.geoJSON({ type: 'FeatureCollection', features: a.features }, {
          pane: 'areas',
          style: { color: '#B9F5CC', weight: 2, fillColor: '#2FA05A', fillOpacity: 0.22 },
          onEachFeature: function (f, camadaF) {
            var p = f.properties || {};
            camadaF.bindPopup('<b>' + esc(a.fazenda || '—') + '</b>' + (a.produtor ? '<br>' + esc(a.produtor) : '') +
              (p.nome ? '<br>Talhão: ' + esc(p.nome) : '') +
              (p.area_ha ? '<br>' + Number(p.area_ha).toFixed(1).replace('.', ',') + ' ha' : '') +
              '<br><span style="color:#6B7B72;font-size:11px">' + esc(a.conta || '') + '</span>');
          }
        }).addTo(grupo);
      });
      camadaAreas = grupo.addTo(mapa);
      // sem nenhuma visita com GPS ainda, enquadra nas áreas
      if (!pts.length && grupo.getLayers().length) mapa.fitBounds(grupo.getBounds().pad(0.1));
    }).catch(function () { /* sem as áreas o mapa continua mostrando as visitas */ });
  }

  // mapa em tela cheia (Esc sai)
  function telaCheia(ligar) {
    var cx = $('#caixaMapa');
    var on = typeof ligar === 'boolean' ? ligar : !cx.classList.contains('cheia');
    cx.classList.toggle('cheia', on);
    document.body.classList.toggle('sem-rolagem', on);
    $('#btnTelaCheia').textContent = on ? '✕ Sair da tela cheia' : '⛶ Tela cheia';
    if (mapa) setTimeout(function () { mapa.invalidateSize(); }, 60);
    if (!on) cx.scrollIntoView({ block: 'start' });
  }
  $('#btnTelaCheia').onclick = function () { telaCheia(); };
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && $('#caixaMapa').classList.contains('cheia')) telaCheia(false);
  });

  // quadro "Relatórios por responsável": recolher e expandir (lembra a escolha neste aparelho)
  var respAberto = true;
  try { respAberto = localStorage.getItem('vsl-resp-aberto') !== '0'; } catch (e) {}
  function aplicarResp() {
    $('#porResp').style.display = respAberto ? '' : 'none';
    $('#btnResp').textContent = respAberto ? '▾ Recolher' : '▸ Expandir';
    $('#btnResp').setAttribute('aria-expanded', respAberto ? 'true' : 'false');
  }
  $('#btnResp').onclick = function () {
    respAberto = !respAberto;
    try { localStorage.setItem('vsl-resp-aberto', respAberto ? '1' : '0'); } catch (e) {}
    aplicarResp();
  };
  aplicarResp();

  /* ---------- criar conta ---------- */
  $('#nAdmin').onchange = function () { $('#nCotaBox').hidden = this.value !== 'adm'; };
  $('#nDoc').oninput = function () { this.value = fmtDoc(this.value); };
  $('#btnCriar').onclick = async function () {
    var msg = $('#nMsg');
    aviso(msg, 'Criando…');
    try {
      await api('/api/admin/usuario', {
        nome: $('#nNome').value.trim(),
        email: $('#nEmail').value.trim(),
        documento: $('#nDoc').value.trim(),
        senha: $('#nSenha').value,
        admin: $('#nAdmin').value === '1',
        equipe_adm: $('#nAdmin').value === 'adm',
        cota: $('#nCota').value,
        prazo_dias: $('#nPrazo').value,
        ver_dados: $('#nVer').checked
      });
      $('#nNome').value = ''; $('#nEmail').value = ''; $('#nDoc').value = ''; $('#nSenha').value = ''; $('#nPrazo').value = '365'; $('#nVer').checked = false; $('#nAdmin').value = '0'; $('#nCota').value = '3'; $('#nCotaBox').hidden = true;
      aviso(msg, 'Conta criada.');
      await abrirPainel();
      document.querySelector('.abas button[data-aba="contas"]').click();
    } catch (e) { aviso(msg, e.message, true); }
  };

  ${AGRO_JS}

  if (token) abrirPainel();
})();
</script>
</body></html>`;
}
