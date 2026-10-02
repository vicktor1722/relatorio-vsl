/* ============================================================
   midia.js — onde as fotos e vídeos ficam guardados
   Escolhe sozinho o que estiver configurado, nesta ordem:
     1. R2      (binding MIDIA)        — 10 GB grátis
     2. KV      (binding MIDIA_KV)     — 1 GB grátis, sem cartão
     3. Google Drive (conta autorizada) — 15 GB da conta da VSL
   Trocar de um para outro não muda mais nada no app.
   ============================================================ */
import { baixarArquivo, cfgGet, enviarArquivo } from './google.js';

export function onde(env) {
  if (env.MIDIA) return 'r2';
  if (env.MIDIA_KV) return 'kv';
  return 'drive';
}

export async function salvar(env, { chave, mime, dados }) {
  const modo = onde(env);

  if (modo === 'r2') {
    await env.MIDIA.put(chave, dados, { httpMetadata: { contentType: mime } });
    return { chave, bytes: dados.byteLength };
  }

  if (modo === 'kv') {
    if (dados.byteLength > 25 * 1024 * 1024) throw new Error('arquivo maior que 25 MB (limite do KV)');
    await env.MIDIA_KV.put(chave, dados, { metadata: { mime } });
    return { chave, bytes: dados.byteLength };
  }

  const arq = await enviarArquivo(env, { nome: chave.replace(/\//g, '_'), mime, dados });
  return { chave: 'drive:' + arq.id, bytes: Number(arq.size || dados.byteLength) };
}

export async function ler(env, chave) {
  if (chave.startsWith('drive:')) {
    const r = await baixarArquivo(env, chave.slice(6));
    if (!r.ok) return null;
    return { corpo: r.body, mime: r.headers.get('Content-Type') || 'application/octet-stream' };
  }

  if (env.MIDIA) {
    const obj = await env.MIDIA.get(chave);
    if (!obj) return null;
    return { corpo: obj.body, mime: (obj.httpMetadata && obj.httpMetadata.contentType) || 'application/octet-stream' };
  }

  if (env.MIDIA_KV) {
    const r = await env.MIDIA_KV.getWithMetadata(chave, { type: 'stream' });
    if (!r || !r.value) return null;
    return { corpo: r.value, mime: (r.metadata && r.metadata.mime) || 'application/octet-stream' };
  }

  return null;
}

export async function espaco(env) {
  const modo = onde(env);
  const limites = { r2: 10 * 1024 ** 3, kv: 1024 ** 3, drive: 15 * 1024 ** 3 };
  const soma = await env.DB.prepare('SELECT COALESCE(SUM(bytes),0) AS t FROM itens').first();
  const usado = Number((soma && soma.t) || 0);

  if (modo === 'drive') {
    try {
      const refresh = await cfgGet(env, 'google_refresh_token');
      if (!refresh) return { modo, usado, limite: limites.drive, conectado: false };
    } catch (e) { /* ignora */ }
  }
  return { modo, usado, limite: limites[modo], conectado: true };
}
