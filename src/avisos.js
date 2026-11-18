/* ============================================================
   avisos.js — histórico de avisos (sininho) do portal da fazenda e do painel
   - para = 'portal:<id do acesso>' (dono/gerente; nunca o operador) ou 'painel:<id da conta>' (todas as contas do painel)
   - cat: 'soja' (fechamento e alta), 'aplicacao' (lançada pelo operador), 'alerta' (aplicação atrasada), 'chuva' (chuva lançada)
   - O aviso fica guardado mesmo sem a notificação ligada no celular; some depois de 60 dias.
   ============================================================ */
import { novoId } from './auth.js';
import { enviarParaConta, proximas } from './push.js';

const DIAS_GUARDA = 60;
let pronto = false;
export async function garantirAvisos(env) {
  if (pronto) return;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS avisos (id TEXT PRIMARY KEY, para TEXT NOT NULL, cat TEXT, titulo TEXT, corpo TEXT, url TEXT,
      criado_em TEXT, lida INTEGER DEFAULT 0)`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS avisos_para ON avisos (para, criado_em)')
  ]);
  pronto = true;
}

// guarda o aviso no histórico (msg = { title, body, url })
export async function guardarAviso(env, para, cat, msg) {
  try {
    await garantirAvisos(env);
    await env.DB.prepare('INSERT INTO avisos (id, para, cat, titulo, corpo, url, criado_em, lida) VALUES (?,?,?,?,?,?,?,0)')
      .bind(novoId('av'), para, cat, String(msg.title || '').slice(0, 200), String(msg.body || '').slice(0, 2000), msg.url || null, new Date().toISOString()).run();
    return true;
  } catch (e) { return false; }
}
// guarda e, se pedir, manda para o celular (só chega se a pessoa ligou os avisos)
export async function avisar(env, para, cat, msg, celular) {
  await guardarAviso(env, para, cat, msg);
  if (!celular) return false;
  try { return await enviarParaConta(env, para, msg); } catch (e) { return false; }
}

export async function listarAvisos(env, para, limite) {
  await garantirAvisos(env);
  const desde = new Date(Date.now() - DIAS_GUARDA * 86400e3).toISOString();
  const { results } = await env.DB.prepare('SELECT id, cat, titulo, corpo, url, criado_em, lida FROM avisos WHERE para = ? AND criado_em >= ? ORDER BY criado_em DESC LIMIT ?')
    .bind(para, desde, Math.min(200, limite || 100)).all();
  return results || [];
}
export async function contarAvisos(env, para) {
  await garantirAvisos(env);
  const desde = new Date(Date.now() - DIAS_GUARDA * 86400e3).toISOString();
  const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM avisos WHERE para = ? AND lida = 0 AND criado_em >= ?').bind(para, desde).first();
  return Number((r && r.n) || 0);
}
export async function lerAvisos(env, para) {
  await garantirAvisos(env);
  await env.DB.prepare('UPDATE avisos SET lida = 1 WHERE para = ? AND lida = 0').bind(para).run();
  return { ok: true };
}
export async function limparAvisos(env) {
  try {
    await garantirAvisos(env);
    await env.DB.prepare('DELETE FROM avisos WHERE criado_em < ?').bind(new Date(Date.now() - DIAS_GUARDA * 86400e3).toISOString()).run();
  } catch (e) { /* limpeza nunca derruba o cron */ }
}

// donos/gerentes (portal) que veem esta fazenda; sem o operador
export async function gerentesDaFazenda(env, fid) {
  try {
    const { results } = await env.DB.prepare("SELECT id, fazendas FROM acessos_fazenda WHERE COALESCE(ativo, 1) != 0 AND papel != 'operador' AND fazendas LIKE ?")
      .bind('%"' + String(fid).replace(/[%_"]/g, '') + '"%').all();
    return (results || []).filter((a) => { try { return JSON.parse(a.fazendas || '[]').includes(fid); } catch (e) { return false; } }).map((a) => a.id);
  } catch (e) { return []; }
}
// a conta recebe avisos no painel: todas as contas (administrador, Adm de equipe e usuário comum); o acesso só à Timeline não
export async function ehPainelAvisos(env, uid) {
  try {
    const u = await env.DB.prepare('SELECT id, leitor_de FROM usuarios WHERE id = ?').bind(uid).first();
    return !!(u && !u.leitor_de);
  } catch (e) {
    try { return !!(await env.DB.prepare('SELECT id FROM usuarios WHERE id = ?').bind(uid).first()); } catch (e2) { return false; }
  }
}

// aviso de uma fazenda para os donos/gerentes dela (portal) e para o painel do consultor dono (se for Adm)
export async function avisarFazenda(env, fid, dono, cat, msg, exceto) {
  for (const id of await gerentesDaFazenda(env, fid)) {
    if (exceto && id === exceto) continue;
    await guardarAviso(env, 'portal:' + id, cat, Object.assign({}, msg, { url: '/portal?avisos=1' }));
  }
  if (dono && (await ehPainelAvisos(env, dono))) await guardarAviso(env, 'painel:' + dono, cat, Object.assign({}, msg, { url: '/admin?avisos=1' }));
}

// de manhã: aplicações atrasadas das fazendas de cada dono/gerente vão para o histórico (sininho do portal)
export async function avisosDeAtraso(env) {
  let n = 0;
  try {
    await limparAvisos(env);
    const { results } = await env.DB.prepare("SELECT id, dono_id, fazendas FROM acessos_fazenda WHERE COALESCE(ativo, 1) != 0 AND papel != 'operador'").all();
    for (const a of results || []) {
      let fz = []; try { fz = JSON.parse(a.fazendas || '[]'); } catch (e) { fz = []; }
      if (!fz.length) continue;
      const atras = (await proximas(env, a.dono_id, null, { fazendas: fz }).catch(() => [])).filter((x) => x.dias < 0);
      if (!atras.length) continue;
      const pior = Math.max.apply(null, atras.map((x) => -x.dias));
      const linhas = atras.slice(0, 5).map((x) => x.fazenda + ': ' + x.op + ' (' + x.tal.join(', ') + ') · ' + (-x.dias) + (x.dias === -1 ? ' dia' : ' dias'));
      if (atras.length > 5) linhas.push('+ ' + (atras.length - 5) + ' outra(s)');
      await guardarAviso(env, 'portal:' + a.id, 'alerta', {
        title: atras.length === 1 ? '⚠️ Aplicação atrasada ' + pior + (pior === 1 ? ' dia' : ' dias') : '⚠️ ' + atras.length + ' aplicações atrasadas',
        body: linhas.join('\n'), url: '/portal?aba=aplicacoes'
      });
      n++;
    }
  } catch (e) { /* cron segue */ }
  return n;
}
