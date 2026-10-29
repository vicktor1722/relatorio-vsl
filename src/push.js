/* ============================================================
   push.js — aviso no celular (tela de bloqueio) das próximas aplicações
   Web Push padrão: o app (instalado na tela de início) assina com a chave
   pública VAPID; todo dia de manhã o cron do Worker monta a lista de cada conta
   e manda uma notificação cifrada (aes128gcm, RFC 8291) para cada aparelho.
   As chaves VAPID são criadas sozinhas na primeira vez e ficam na tabela config.
   ============================================================ */

import { modulosDe } from './agro.js';
import { safraPadrao } from './safras.js';

const json = (o, status) => new Response(JSON.stringify(o), {
  status: status || 200,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
});

/* ---------------- base64url e bytes ---------------- */
function b64u(buf) {
  const b = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function deB64u(str) {
  const s = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '==='.slice((s.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function juntar(...partes) {
  const tot = partes.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(tot);
  let pos = 0;
  partes.forEach((p) => { out.set(p, pos); pos += p.length; });
  return out;
}
const utf8 = (s) => new TextEncoder().encode(s);

/* ---------------- tabela ---------------- */
let pronta = null;
function garantir(env) {
  if (!pronta) {
    pronta = env.DB.prepare(`CREATE TABLE IF NOT EXISTS push_assinaturas (
        endpoint    TEXT PRIMARY KEY,
        usuario_id  TEXT NOT NULL,
        p256dh      TEXT NOT NULL,
        auth        TEXT NOT NULL,
        criado_em   TEXT DEFAULT (datetime('now')),
        ultimo_envio TEXT DEFAULT ''
      )`).run().catch((e) => { pronta = null; throw e; });
  }
  return pronta;
}

/* ---------------- chaves VAPID ---------------- */
async function cfg(env, chave) {
  const r = await env.DB.prepare('SELECT valor FROM config WHERE chave = ?').bind(chave).first();
  return r ? r.valor : null;
}
let vapid = null;
async function chaves(env) {
  if (vapid) return vapid;
  let priv = await cfg(env, 'vapid_privada'), pub = await cfg(env, 'vapid_publica');
  if (!priv || !pub) {
    const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const jwk = JSON.stringify(await crypto.subtle.exportKey('jwk', par.privateKey));
    const raw = b64u(await crypto.subtle.exportKey('raw', par.publicKey));
    // dois pedidos ao mesmo tempo: fica o primeiro que gravou
    await env.DB.batch([
      env.DB.prepare("INSERT OR IGNORE INTO config (chave, valor) VALUES ('vapid_privada', ?)").bind(jwk),
      env.DB.prepare("INSERT OR IGNORE INTO config (chave, valor) VALUES ('vapid_publica', ?)").bind(raw)
    ]);
    priv = await cfg(env, 'vapid_privada'); pub = await cfg(env, 'vapid_publica');
  }
  const chave = await crypto.subtle.importKey('jwk', JSON.parse(priv), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  vapid = { publica: pub, privada: chave };
  return vapid;
}

async function cabecalhoVapid(env, endpoint) {
  const v = await chaves(env);
  const aud = new URL(endpoint).origin;
  const cab = b64u(utf8(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const corpo = b64u(utf8(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'mailto:contato@amvs.ia.br' })));
  const ass = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, v.privada, utf8(cab + '.' + corpo));
  return 'vapid t=' + cab + '.' + corpo + '.' + b64u(ass) + ', k=' + v.publica;
}

/* ---------------- cifra (RFC 8291, aes128gcm) ---------------- */
async function hkdf(sal, ikm, info, bytes) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: sal, info }, k, bytes * 8));
}
export async function cifrar(p256dh, auth, texto) {
  const uaPub = deB64u(p256dh), segredo = deB64u(auth);
  const efemera = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', efemera.publicKey));
  const uaChave = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaChave }, efemera.privateKey, 256));
  const ikm = await hkdf(segredo, ecdh, juntar(utf8('WebPush: info\0'), uaPub, asPub), 32);
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(sal, ikm, utf8('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(sal, ikm, utf8('Content-Encoding: nonce\0'), 12);
  const k = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, k, juntar(utf8(texto), new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]);   // 4096
  return juntar(sal, rs, new Uint8Array([asPub.length]), asPub, cifrado);
}

// devolve o status HTTP do serviço de push (201 = entregue; 404/410 = assinatura morta)
export async function enviarPush(env, sub, msg) {
  const corpo = await cifrar(sub.p256dh, sub.auth, JSON.stringify(msg));
  const r = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await cabecalhoVapid(env, sub.endpoint),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
      Urgency: 'high'
    },
    body: corpo
  });
  return r.status;
}

/* ---------------- próximas aplicações de uma conta ---------------- */
const FEM = /^(Dessecação|Adubação|Outra)/;
const ordTxt = (op, n) => n + (FEM.test(op) ? 'ª ' : 'º ') + op;
function hojeMT() { return new Date(Date.now() - 4 * 3600 * 1000).toISOString().slice(0, 10); }
function somaDias(iso, n) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function difDias(a, b) { return Math.round((new Date(a + 'T12:00:00Z') - new Date(b + 'T12:00:00Z')) / 864e5); }
function lerDados(s) { try { const o = JSON.parse(s || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } }

// Mesma regra do app: aplicação prevista ainda não feita e a próxima de uma sequência (aplicada + intervalo).
// Entra o que vence dentro do aviso da recomendação (padrão 3 dias) ou que atrasou até 7 dias.
export async function proximas(env, uid, hoje) {
  hoje = hoje || hojeMT();
  const [recs, pla, faz] = await Promise.all([
    env.DB.prepare('SELECT fazenda_id, safra, operacao, data_prevista, dados FROM recomendacoes WHERE usuario_id = ?').bind(uid).all(),
    env.DB.prepare('SELECT fazenda_id, safra, talhao, data_plantio, data_emerg FROM plantio WHERE usuario_id = ?').bind(uid).all(),
    env.DB.prepare('SELECT id, nome FROM fazendas WHERE usuario_id = ?').bind(uid).all()
  ]).catch(() => [{}, {}, {}]);
  const nomeFaz = {}; (faz.results || []).forEach((f) => { nomeFaz[f.id] = f.nome; });
  const plantio = {};
  (pla.results || []).forEach((p) => { plantio[p.fazenda_id + '|' + safraPadrao(p.safra) + '|' + p.talhao] = p; });
  const out = {};
  const anota = (r, data, t, txt, aviso) => {
    if (!data) return;
    const n = difDias(data, hoje);
    if (n > aviso || n < -7) return;
    const k = r.fazenda_id + '|' + txt + '|' + data;
    (out[k] = out[k] || { fazenda: nomeFaz[r.fazenda_id] || '', op: txt, data, dias: n, tal: [] }).tal.push(t);
  };
  (recs.results || []).forEach((r) => {
    const d = lerDados(r.dados), feito = d.feito || {}, prox = d.prox || {}, dae = Number(d.dae) || 0;
    const aviso = d.aviso == null ? 3 : Math.max(0, Number(d.aviso) || 0);
    const num = Number(d.num) || 1, rep = Number(d.rep) || 0, total = Number(d.total) || 1;
    (d.tal || []).forEach((t) => {
      if (!feito[t]) {
        let data = (d.datas && d.datas[t]) || r.data_prevista || '';
        if (dae > 0) {
          const p = plantio[r.fazenda_id + '|' + safraPadrao(r.safra) + '|' + t];
          const base = p ? (p.data_emerg || (p.data_plantio ? somaDias(p.data_plantio, 5) : '')) : '';
          if (base) data = somaDias(base, dae);
        }
        anota(r, data, t, rep > 0 ? ordTxt(r.operacao, num) : r.operacao, aviso);
      } else if (rep > 0 && num < total && !prox[t]) {
        anota(r, somaDias(feito[t], rep), t, ordTxt(r.operacao, num + 1), aviso);
      }
    });
  });
  return Object.values(out).sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : a.fazenda.localeCompare(b.fazenda)));
}

function quando(n) {
  if (n < 0) return 'Atrasada ' + (-n) + (n === -1 ? ' dia' : ' dias');
  if (n === 0) return 'Hoje';
  if (n === 1) return 'Amanhã';
  return 'Em ' + n + ' dias';
}
export function mensagem(lista) {
  if (!lista.length) return null;
  const linhas = lista.slice(0, 4).map((x) => quando(x.dias) + ' · ' + x.fazenda + ': ' + x.op + ' (' + x.tal.join(', ') + ')');
  if (lista.length > 4) linhas.push('+ ' + (lista.length - 4) + ' outra(s)');
  const hoje = lista.filter((x) => x.dias <= 0).length;
  return {
    title: lista.length === 1 ? '📋 Aplicação próxima' : '📋 ' + lista.length + ' aplicações próximas' + (hoje ? ' · ' + hoje + ' para hoje' : ''),
    body: linhas.join('\n'),
    url: '/?abrir=recs',
    tag: 'aplicacoes'
  };
}

async function enviarParaConta(env, uid, msg) {
  const { results } = await env.DB.prepare('SELECT endpoint, p256dh, auth FROM push_assinaturas WHERE usuario_id = ?').bind(uid).all();
  let ok = 0;
  for (const s of results || []) {
    let st = 0;
    try { st = await enviarPush(env, s, msg); } catch (e) { st = 0; }
    if (st === 404 || st === 410) await env.DB.prepare('DELETE FROM push_assinaturas WHERE endpoint = ?').bind(s.endpoint).run();
    else if (st >= 200 && st < 300) {
      ok++;
      await env.DB.prepare('UPDATE push_assinaturas SET ultimo_envio = ? WHERE endpoint = ?').bind(new Date().toISOString(), s.endpoint).run();
    }
  }
  return ok;
}

// cron da manhã: uma notificação por conta, só se houver aplicação perto
export async function avisarAplicacoes(env) {
  await garantir(env);
  const { results } = await env.DB.prepare('SELECT DISTINCT usuario_id FROM push_assinaturas').all();
  let contas = 0;
  for (const { usuario_id: uid } of results || []) {
    try {
      const mod = await modulosDe(env, uid);
      if (!mod.recomendacoes) continue;
      const msg = mensagem(await proximas(env, uid));
      if (msg && (await enviarParaConta(env, uid, msg))) contas++;
    } catch (e) { /* uma conta com problema não segura as outras */ }
  }
  return contas;
}

/* ---------------- rotas /api/push/* ---------------- */
export async function rotasPush(env, req, me, rota) {
  await garantir(env);
  if (rota === '/api/push/chave') return json({ ok: true, chave: (await chaves(env)).publica });

  if (rota === '/api/push/assinar' && req.method === 'POST') {
    const b = await req.json();
    const s = b.assinatura || {};
    const endpoint = String(s.endpoint || ''), k = s.keys || {};
    if (!/^https:\/\//.test(endpoint) || !k.p256dh || !k.auth) return json({ erro: 'assinatura inválida' }, 400);
    await env.DB.prepare(`INSERT INTO push_assinaturas (endpoint, usuario_id, p256dh, auth) VALUES (?,?,?,?)
        ON CONFLICT(endpoint) DO UPDATE SET usuario_id = excluded.usuario_id, p256dh = excluded.p256dh, auth = excluded.auth`)
      .bind(endpoint.slice(0, 1000), me.id, String(k.p256dh).slice(0, 200), String(k.auth).slice(0, 100)).run();
    return json({ ok: true });
  }

  if (rota === '/api/push/sair' && req.method === 'POST') {
    const b = await req.json();
    await env.DB.prepare('DELETE FROM push_assinaturas WHERE endpoint = ? AND usuario_id = ?').bind(String(b.endpoint || ''), me.id).run();
    return json({ ok: true });
  }

  // logo depois de ligar: confirma que chega e já mostra o que está perto
  if (rota === '/api/push/teste' && req.method === 'POST') {
    const lista = await proximas(env, me.id);
    const msg = mensagem(lista) || { title: '🔔 Avisos de aplicação ligados', body: 'Nenhuma aplicação perto agora. Todo dia de manhã você recebe aqui as aplicações dos próximos dias.', url: '/?abrir=recs', tag: 'aplicacoes' };
    const ok = await enviarParaConta(env, me.id, msg);
    return json({ ok: true, enviados: ok, proximas: lista.length });
  }

  return json({ erro: 'rota não encontrada' }, 404);
}
