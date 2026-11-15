/* ============================================================
   equipe.js — Adm de equipe, usuários comuns, timeline e correção de textos do relatório
   - O administrador geral marca uma conta como "Adm" e define quantos usuários comuns ela pode criar (cota).
   - O Adm cria só usuários comuns, dentro da cota. Eles ficam na equipe dele (usuarios.equipe_id = id do Adm),
     seguem o prazo e os módulos da conta do Adm (o prazo é definido só pelo administrador geral).
   - Na timeline e no Campo do painel: o Adm vê os relatórios dele e da equipe; o usuário comum vê os dele e
     os dos colegas da equipe. Corrigir legendas e observações gerais: o autor do relatório e o Adm da equipe
     (e o administrador geral).
   ============================================================ */
import { hashSenha, novoId } from './auth.js';

let pronto = false;
export async function garantirEquipe(env) {
  if (pronto) return;
  for (const sql of ['ALTER TABLE usuarios ADD COLUMN papel TEXT', 'ALTER TABLE usuarios ADD COLUMN cota INTEGER', 'ALTER TABLE usuarios ADD COLUMN equipe_id TEXT']) {
    try { await env.DB.prepare(sql).run(); } catch (e) { /* já existe */ }
  }
  try { await env.DB.prepare('CREATE INDEX IF NOT EXISTS usuarios_equipe ON usuarios (equipe_id)').run(); } catch (e) {}
  pronto = true;
}

// quem é a pessoa na equipe: { papel: 'adm' | 'comum' | null, adm_id, ids: contas cujos relatórios ela vê }
export async function equipeDe(env, uid) {
  await garantirEquipe(env);
  const u = await env.DB.prepare('SELECT id, papel, cota, equipe_id, COALESCE(admin,0) AS admin FROM usuarios WHERE id = ?').bind(uid).first();
  if (!u) return { papel: null, adm_id: null, ids: [uid] };
  const admId = u.papel === 'adm' ? u.id : u.equipe_id || null;
  if (!admId) return { papel: null, adm_id: null, ids: [uid], cota: 0 };
  const { results } = await env.DB.prepare('SELECT id FROM usuarios WHERE id = ? OR equipe_id = ?').bind(admId, admId).all();
  const ids = [...new Set([admId, uid].concat((results || []).map((r) => r.id)))];
  return { papel: u.papel === 'adm' ? 'adm' : 'comum', adm_id: admId, ids, cota: u.papel === 'adm' ? Number(u.cota) || 0 : 0 };
}

// conta cujo prazo e módulos valem para esta (o Adm da equipe, para o usuário comum)
export async function contaTitular(env, uid) {
  try {
    await garantirEquipe(env);
    const u = await env.DB.prepare('SELECT equipe_id FROM usuarios WHERE id = ?').bind(uid).first();
    return (u && u.equipe_id) || uid;
  } catch (e) { return uid; }
}

/* ---------- administrador geral: marca/desmarca Adm e a cota ---------- */
export async function definirAdm(env, id, adm, cota) {
  await garantirEquipe(env);
  const u = await env.DB.prepare('SELECT id, equipe_id FROM usuarios WHERE id = ?').bind(id).first();
  if (!u) throw new Error('conta não encontrada');
  if (u.equipe_id) throw new Error('esta conta é usuário comum de uma equipe; não pode ser Adm');
  if (!adm) {
    const n = (await env.DB.prepare('SELECT COUNT(*) AS n FROM usuarios WHERE equipe_id = ?').bind(id).first()).n;
    if (n) throw new Error('esta conta tem ' + n + ' usuário(s) na equipe; mude a cota em vez de tirar o Adm');
    await env.DB.prepare('UPDATE usuarios SET papel = NULL, cota = NULL WHERE id = ?').bind(id).run();
    return { ok: true, id, adm: false };
  }
  const c = Math.floor(Number(cota));
  if (!(c >= 0 && c <= 500)) throw new Error('informe quantos usuários ele pode criar (0 a 500)');
  await env.DB.prepare("UPDATE usuarios SET papel = 'adm', cota = ? WHERE id = ?").bind(c, id).run();
  return { ok: true, id, adm: true, cota: c };
}

/* ---------- Adm: a equipe e os usuários comuns ---------- */
export async function listarEquipe(env, me) {
  const eq = await equipeDe(env, me.id);
  if (!eq.adm_id) return { ok: true, papel: null, membros: [] };
  const { results } = await env.DB.prepare(`SELECT u.id, u.nome, u.email, u.papel, u.criado_em,
      (SELECT COUNT(*) FROM relatorios r WHERE r.usuario_id = u.id) AS relatorios,
      (SELECT MAX(r.atualizado_em) FROM relatorios r WHERE r.usuario_id = u.id) AS ultima
    FROM usuarios u WHERE u.id = ? OR u.equipe_id = ? ORDER BY (u.papel = 'adm') DESC, u.criado_em`).bind(eq.adm_id, eq.adm_id).all();
  const membros = (results || []).map((m) => Object.assign(m, { papel: m.id === eq.adm_id ? 'adm' : 'comum', eu: m.id === me.id }));
  const adm = membros.filter((m) => m.papel === 'adm')[0];
  return { ok: true, papel: eq.papel, adm: adm ? { id: adm.id, nome: adm.nome || adm.email } : null,
    cota: eq.papel === 'adm' ? eq.cota : null, usados: membros.filter((m) => m.papel === 'comum').length, membros };
}

export async function criarComum(env, me, b) {
  const eq = await equipeDe(env, me.id);
  if (eq.papel !== 'adm') throw new Error('só o Adm da equipe cria usuários');
  const usados = (await env.DB.prepare('SELECT COUNT(*) AS n FROM usuarios WHERE equipe_id = ?').bind(me.id).first()).n;
  if (usados >= eq.cota) throw new Error(eq.cota ? 'a equipe já tem ' + usados + ' de ' + eq.cota + ' usuários. Para mais, fale com o administrador do AMVS.' : 'sua conta ainda não pode criar usuários. Fale com o administrador do AMVS.');
  const email = String(b.email || '').trim().toLowerCase(), senha = String(b.senha || ''), nome = String(b.nome || '').trim().slice(0, 80);
  if (!nome) throw new Error('informe o nome');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('informe um e-mail válido');
  if (senha.length < 6) throw new Error('a senha precisa de pelo menos 6 caracteres');
  if (await env.DB.prepare('SELECT id FROM usuarios WHERE email = ?').bind(email).first()) throw new Error('já existe uma conta com esse e-mail');
  const id = novoId('u');
  // usuário comum: nunca admin nem Adm; o prazo e os módulos são os do Adm (não grava prazo próprio)
  await env.DB.prepare('INSERT INTO usuarios (id,email,senha_hash,nome,admin,equipe_id) VALUES (?,?,?,?,0,?)')
    .bind(id, email, await hashSenha(senha), nome, me.id).run();
  return { ok: true, id, email, nome };
}

/* ---------- quem vê e quem corrige ---------- */
async function contasVisiveis(env, me, adm) {
  if (adm) return null;   // administrador geral: todas
  return (await equipeDe(env, me.id)).ids;
}
async function podeCorrigir(env, me, adm, dono) {
  if (adm || dono === me.id) return true;
  const eq = await equipeDe(env, me.id);
  return eq.papel === 'adm' && eq.ids.includes(dono);
}
const marcas = (ids) => ids.map(() => '?').join(',');

/* ---------- timeline: um post por relatório, com as fotos e vídeos e as legendas ---------- */
export async function timeline(env, me, adm, antes) {
  const ids = await contasVisiveis(env, me, adm);
  const filtro = ids ? ' AND r.usuario_id IN (' + marcas(ids) + ')' : '';
  const corte = /^\d{4}-\d{2}-\d{2}/.test(String(antes || '')) ? String(antes) : '9999';
  const { results: rels } = await env.DB.prepare(`SELECT r.id, r.usuario_id, r.fazenda, r.produtor, r.servico, r.status, r.data_inicio, r.observacoes,
        COALESCE(r.publicado_em, r.atualizado_em, r.criado_em) AS quando, u.nome AS autor, u.email AS autor_email
      FROM relatorios r LEFT JOIN usuarios u ON u.id = r.usuario_id
     WHERE COALESCE(r.publicado_em, r.atualizado_em, r.criado_em) < ?${filtro}
       AND EXISTS (SELECT 1 FROM itens i WHERE i.relatorio_id = r.id AND i.tipo IN ('foto','video') AND i.midia IS NOT NULL)
     ORDER BY quando DESC LIMIT 8`).bind(corte, ...(ids || [])).all();
  const lista = rels || [];
  if (!lista.length) return { ok: true, posts: [], mais: null };
  const { results: its } = await env.DB.prepare(`SELECT id, relatorio_id, tipo, legenda, midia, talhao, capturado_em, pos FROM itens
     WHERE relatorio_id IN (${marcas(lista)}) AND ((tipo IN ('foto','video') AND midia IS NOT NULL) OR tipo = 'texto')`).bind(...lista.map((r) => r.id)).all();
  const ord = (x) => { const p = Number(x.pos); return p > 1e11 ? p : (Date.parse(x.capturado_em) || 0); };
  const porRel = {};
  (its || []).sort((a, b) => ord(a) - ord(b)).forEach((i) => { (porRel[i.relatorio_id] = porRel[i.relatorio_id] || []).push(i); });
  const eq = adm ? null : await equipeDe(env, me.id);
  const posts = lista.map((r) => {
    const l = porRel[r.id] || [];
    return {
      id: r.id, fazenda: r.fazenda || 'Relatório', produtor: r.produtor || '', servico: r.servico || '', status: r.status,
      data: r.data_inicio || String(r.quando || '').slice(0, 10), quando: r.quando, autor: r.autor || r.autor_email || '',
      link: r.status === 'publicado' ? '/r/' + r.id : null,
      pode_corrigir: !!(adm || r.usuario_id === me.id || (eq && eq.papel === 'adm' && eq.ids.includes(r.usuario_id))),
      obs: [r.observacoes].concat(l.filter((i) => i.tipo === 'texto').map((i) => i.legenda)).map((t) => String(t || '').trim()).filter(Boolean),
      midias: l.filter((i) => i.tipo !== 'texto').slice(0, 30).map((i) => ({ tipo: i.tipo, src: '/img/' + encodeURIComponent(i.midia), legenda: i.legenda || '', talhao: i.talhao || '', hora: i.capturado_em }))
    };
  });
  return { ok: true, posts, mais: lista.length === 8 ? lista[lista.length - 1].quando : null };
}

/* ---------- corrigir legendas e observações gerais (relatório já sincronizado) ---------- */
export async function lerCorrecao(env, me, adm, id) {
  const r = await env.DB.prepare('SELECT r.id, r.usuario_id, r.fazenda, r.servico, r.status, r.data_inicio, r.observacoes, u.nome AS autor, u.email AS autor_email FROM relatorios r LEFT JOIN usuarios u ON u.id = r.usuario_id WHERE r.id = ?').bind(id).first();
  if (!r) throw new Error('relatório não encontrado');
  if (!(await podeCorrigir(env, me, adm, r.usuario_id))) throw new Error('só o autor do relatório e o Adm da equipe podem corrigir');
  const { results } = await env.DB.prepare("SELECT id, tipo, legenda, midia, talhao, capturado_em, pos FROM itens WHERE relatorio_id = ? AND (tipo = 'texto' OR midia IS NOT NULL)").bind(id).all();
  const ord = (x) => { const p = Number(x.pos); return p > 1e11 ? p : (Date.parse(x.capturado_em) || 0); };
  const itens = (results || []).sort((a, b) => ord(a) - ord(b)).map((i) => ({ id: i.id, tipo: i.tipo, legenda: i.legenda || '', talhao: i.talhao || '', hora: i.capturado_em,
    src: i.midia && i.tipo !== 'audio' ? '/img/' + encodeURIComponent(i.midia) : '' }));
  return { ok: true, relatorio: { id: r.id, fazenda: r.fazenda, servico: r.servico, status: r.status, data: r.data_inicio, observacoes: r.observacoes || '', autor: r.autor || r.autor_email || '' }, itens };
}

export async function salvarCorrecao(env, me, adm, b) {
  const id = String(b.id || '').slice(0, 60);
  const r = await env.DB.prepare('SELECT id, usuario_id FROM relatorios WHERE id = ?').bind(id).first();
  if (!r) throw new Error('relatório não encontrado');
  if (!(await podeCorrigir(env, me, adm, r.usuario_id))) throw new Error('só o autor do relatório e o Adm da equipe podem corrigir');
  const cmds = [];
  if (typeof b.observacoes === 'string') cmds.push(env.DB.prepare("UPDATE relatorios SET observacoes = ?, atualizado_em = datetime('now') WHERE id = ?").bind(b.observacoes.slice(0, 20000), id));
  const lista = (Array.isArray(b.itens) ? b.itens : []).slice(0, 500);
  for (const i of lista) {
    const leg = String(i && i.legenda != null ? i.legenda : '').slice(0, 5000);
    cmds.push(env.DB.prepare('UPDATE itens SET legenda = ? WHERE id = ? AND relatorio_id = ?').bind(leg, String(i.id || '').slice(0, 60), id));
  }
  if (cmds.length) await env.DB.batch(cmds);
  return { ok: true, itens: lista.length };
}
