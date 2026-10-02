/* ============================================================
   auth.js — login simples (separa os dados por usuário)
   Senha com PBKDF2, token assinado com HMAC-SHA256.
   ============================================================ */

const te = new TextEncoder();

function b64url(buf) {
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function deB64url(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ---------- senha ---------- */

export async function hashSenha(senha, saltB64) {
  const salt = saltB64 ? deB64url(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const chave = await crypto.subtle.importKey('raw', te.encode(senha), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, chave, 256);
  return b64url(salt) + '$' + b64url(bits);
}

export async function conferirSenha(senha, guardado) {
  if (!guardado || !guardado.includes('$')) return false;
  const [salt] = guardado.split('$');
  const calculado = await hashSenha(senha, salt);
  // comparação de tempo constante
  if (calculado.length !== guardado.length) return false;
  let dif = 0;
  for (let i = 0; i < calculado.length; i++) dif |= calculado.charCodeAt(i) ^ guardado.charCodeAt(i);
  return dif === 0;
}

/* ---------- token ---------- */

async function chaveHmac(segredo) {
  return crypto.subtle.importKey('raw', te.encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function criarToken(env, usuario, dias) {
  const payload = {
    id: usuario.id,
    email: usuario.email,
    nome: usuario.nome || '',
    exp: Date.now() + (dias || 90) * 86400000
  };
  const corpo = b64url(te.encode(JSON.stringify(payload)));
  const assinatura = await crypto.subtle.sign('HMAC', await chaveHmac(env.SEGREDO), te.encode(corpo));
  return corpo + '.' + b64url(assinatura);
}

export async function lerToken(env, token) {
  if (!token || !token.includes('.')) return null;
  const [corpo, assinatura] = token.split('.');
  let ok = false;
  try {
    ok = await crypto.subtle.verify('HMAC', await chaveHmac(env.SEGREDO), deB64url(assinatura), te.encode(corpo));
  } catch (e) { return null; }
  if (!ok) return null;
  let payload;
  try { payload = JSON.parse(new TextDecoder().decode(deB64url(corpo))); } catch (e) { return null; }
  if (!payload.exp || payload.exp < Date.now()) return null;
  return payload;
}

/* ---------- quem está chamando ---------- */

export async function usuarioDaRequisicao(req, env) {
  const cab = req.headers.get('Authorization') || '';
  const token = cab.startsWith('Bearer ') ? cab.slice(7) : new URL(req.url).searchParams.get('t');
  return lerToken(env, token);
}

export function novoId(prefixo) {
  return (prefixo || '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
