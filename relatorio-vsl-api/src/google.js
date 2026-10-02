/* ============================================================
   google.js — OAuth + Google Drive (escopo drive.file)
   O refresh token da conta VSL fica na tabela config do D1.
   ============================================================ */

export const ESCOPO = 'https://www.googleapis.com/auth/drive.file';

let cacheToken = { valor: null, expira: 0 };   // cache por isolate

export async function cfgGet(env, chave) {
  const r = await env.DB.prepare('SELECT valor FROM config WHERE chave = ?').bind(chave).first();
  return r ? r.valor : null;
}

export async function cfgSet(env, chave, valor) {
  await env.DB.prepare(
    'INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor'
  ).bind(chave, String(valor)).run();
}

/* ---------- fluxo de autorização (uma vez, pelo navegador) ---------- */

export function urlAutorizacao(env, redirectUri, state) {
  const p = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: ESCOPO,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: state || ''
  });
  return 'https://accounts.google.com/o/oauth2/v2/auth?' + p.toString();
}

export async function trocarCodigo(env, code, redirectUri) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    })
  });
  const j = await r.json();
  if (!r.ok) throw new Error('OAuth: ' + (j.error_description || j.error || r.status));
  return j; // { access_token, refresh_token, expires_in }
}

export async function accessToken(env) {
  const agora = Date.now();
  if (cacheToken.valor && cacheToken.expira > agora + 60000) return cacheToken.valor;

  const refresh = await cfgGet(env, 'google_refresh_token');
  if (!refresh) throw new Error('Conta Google ainda não autorizada. Abra /oauth/start?key=SUA_ADMIN_KEY');

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refresh,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token'
    })
  });
  const j = await r.json();
  if (!r.ok) throw new Error('Refresh: ' + (j.error_description || j.error || r.status));
  cacheToken = { valor: j.access_token, expira: agora + (j.expires_in || 3600) * 1000 };
  return j.access_token;
}

/* ---------- pasta raiz ---------- */

export async function pastaRaiz(env) {
  let id = await cfgGet(env, 'pasta_raiz');
  if (id) return id;
  const token = await accessToken(env);
  const r = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Relatórios VSL', mimeType: 'application/vnd.google-apps.folder' })
  });
  const j = await r.json();
  if (!r.ok) throw new Error('Criar pasta: ' + JSON.stringify(j).slice(0, 200));
  await cfgSet(env, 'pasta_raiz', j.id);
  return j.id;
}

/* ---------- upload (multipart) ---------- */

export async function enviarArquivo(env, { nome, mime, dados, pastaId }) {
  const token = await accessToken(env);
  const limite = '-------vsl' + Math.random().toString(36).slice(2);
  const meta = JSON.stringify({ name: nome, parents: [pastaId || (await pastaRaiz(env))] });

  const cabecalho = new TextEncoder().encode(
    `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
    `--${limite}\r\nContent-Type: ${mime}\r\n\r\n`
  );
  const rodape = new TextEncoder().encode(`\r\n--${limite}--\r\n`);
  const corpo = new Uint8Array(cabecalho.length + dados.byteLength + rodape.length);
  corpo.set(cabecalho, 0);
  corpo.set(new Uint8Array(dados), cabecalho.length);
  corpo.set(rodape, cabecalho.length + dados.byteLength);

  const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,size', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': `multipart/related; boundary=${limite}` },
    body: corpo
  });
  const j = await r.json();
  if (!r.ok) throw new Error('Upload Drive: ' + JSON.stringify(j).slice(0, 250));
  return j; // { id, size }
}

export async function baixarArquivo(env, fileId) {
  const token = await accessToken(env);
  return fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(fileId) + '?alt=media', {
    headers: { Authorization: 'Bearer ' + token }
  });
}

export async function espacoUsado(env) {
  const token = await accessToken(env);
  const r = await fetch('https://www.googleapis.com/drive/v3/about?fields=storageQuota,user', {
    headers: { Authorization: 'Bearer ' + token }
  });
  if (!r.ok) throw new Error('about: ' + r.status);
  return r.json();
}
