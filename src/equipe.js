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
import { acessosDe } from './acessos.js';
import { excluirConta } from './admin.js';   // import circular só de função: usado em tempo de execução

let pronto = false;
export async function garantirEquipe(env) {
  if (pronto) return;
  for (const sql of ['ALTER TABLE usuarios ADD COLUMN papel TEXT', 'ALTER TABLE usuarios ADD COLUMN cota INTEGER', 'ALTER TABLE usuarios ADD COLUMN equipe_id TEXT',
    'ALTER TABLE usuarios ADD COLUMN admin_ve INTEGER', 'ALTER TABLE usuarios ADD COLUMN leitor_de TEXT']) {
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

// contas cujas fazendas (e o que foi lançado nelas: plantio, colheita, recomendações, estoque) esta conta usa:
// o Adm de equipe vê as dele e as dos usuários comuns; o usuário comum vê as dele e as do Adm; os demais, só as próprias.
// O que é lançado numa fazenda fica gravado em nome do dono da fazenda (assim o portal e o painel do dono veem tudo).
export async function donosDe(env, uid) {
  try {
    const eq = await equipeDe(env, uid);
    if (eq.papel === 'adm') return eq.ids;
    if (eq.papel === 'comum' && eq.adm_id) return [...new Set([uid, eq.adm_id])];
  } catch (e) { /* sem equipe */ }
  return [uid];
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

// usuário comum que pertence à equipe deste Adm (nunca o próprio Adm, nem conta de outra equipe)
async function membroDaEquipe(env, me, id) {
  const eq = await equipeDe(env, me.id);
  if (eq.papel !== 'adm') throw new Error('só o Adm da equipe gerencia os usuários');
  const u = await env.DB.prepare('SELECT id, nome, email FROM usuarios WHERE id = ? AND equipe_id = ?').bind(String(id || '').slice(0, 60), me.id).first();
  if (!u) throw new Error('usuário não encontrado na sua equipe');
  return u;
}

// Adm corrige nome e e-mail (o e-mail é o login) de um usuário comum da equipe dele
export async function editarComum(env, me, b) {
  const u = await membroDaEquipe(env, me, b.id);
  const nome = String(b.nome || '').trim().slice(0, 80), email = String(b.email || '').trim().toLowerCase();
  if (!nome) throw new Error('informe o nome');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('informe um e-mail válido');
  if (await env.DB.prepare('SELECT id FROM usuarios WHERE email = ? AND id <> ?').bind(email, u.id).first()) throw new Error('já existe uma conta com esse e-mail');
  await env.DB.prepare('UPDATE usuarios SET nome = ?, email = ? WHERE id = ? AND equipe_id = ?').bind(nome, email, u.id, me.id).run();
  return { ok: true, id: u.id, nome, email, email_mudou: email !== String(u.email).toLowerCase() };
}

// Adm exclui um usuário comum da equipe dele (libera a vaga na cota). Os relatórios dele também são apagados,
// por isso o e-mail digitado precisa conferir; a mesma limpeza da exclusão feita pelo administrador geral.
export async function excluirComum(env, me, b) {
  const u = await membroDaEquipe(env, me, b.id);
  if (String(b.email || '').trim().toLowerCase() !== String(u.email).toLowerCase()) throw new Error('o e-mail digitado não confere com o do usuário');
  await garantirSocial(env);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM tl_curtida WHERE usuario_id = ?').bind(u.id),
    env.DB.prepare('DELETE FROM tl_comentario WHERE usuario_id = ?').bind(u.id),
    env.DB.prepare('DELETE FROM tl_notif WHERE para_id = ? OR de_id = ?').bind(u.id, u.id)
  ]);
  return await excluirConta(env, me, u.id, u.email);
}

/* ---------- privacidade do administrador geral ----------
   O administrador geral só vê os DADOS (relatórios, timeline, pontos no mapa, lavoura) da própria conta, da equipe
   dela e das contas que ele criou marcando "visualizar dados" (usuarios.admin_ve = 1), mais a equipe dessas contas.
   Das demais ele vê só os números (quantidade de relatórios etc.) na lista de contas. */
export async function contasDoAdmin(env, me) {
  await garantirEquipe(env);
  const { results } = await env.DB.prepare('SELECT id FROM usuarios WHERE admin_ve = 1').all();
  const base = new Set([me.id].concat((results || []).map((r) => r.id)));
  (await equipeDe(env, me.id)).ids.forEach((x) => base.add(x));
  const lista = [...base];
  if (lista.length) {
    const { results: eqs } = await env.DB.prepare('SELECT id FROM usuarios WHERE equipe_id IN (' + lista.map(() => '?').join(',') + ')').bind(...lista).all();
    (eqs || []).forEach((r) => base.add(r.id));
  }
  return [...base];
}

/* ---------- acesso só à Timeline (leitor) ----------
   Login próprio (e-mail e senha da pessoa) que só vê a Timeline da conta que o criou e da equipe dela:
   curte, comenta e compartilha. Não usa o app de campo nem vê Visão geral, Campo, mapa, contas ou cadastros.
   usuarios.leitor_de = id da conta dona. Quem cria: o administrador geral (para a própria conta) e o Adm de equipe. */
const MAX_LEITORES = 30;
export async function leitorDe(env, uid) {
  await garantirEquipe(env);
  const u = await env.DB.prepare('SELECT leitor_de FROM usuarios WHERE id = ?').bind(uid).first();
  return (u && u.leitor_de) || null;
}
async function podeTerLeitores(env, me, adm) {
  if (adm) return true;
  return (await equipeDe(env, me.id)).papel === 'adm';
}
export async function listarLeitores(env, me, adm) {
  if (!(await podeTerLeitores(env, me, adm))) return { ok: true, pode: false, leitores: [] };
  const { results } = await env.DB.prepare('SELECT id, nome, email, criado_em FROM usuarios WHERE leitor_de = ? ORDER BY criado_em').bind(me.id).all();
  return { ok: true, pode: true, max: MAX_LEITORES, leitores: results || [] };
}
export async function criarLeitor(env, me, adm, b) {
  if (!(await podeTerLeitores(env, me, adm))) throw new Error('só o administrador e o Adm de equipe criam acessos à Timeline');
  const n = (await env.DB.prepare('SELECT COUNT(*) AS n FROM usuarios WHERE leitor_de = ?').bind(me.id).first()).n;
  if (n >= MAX_LEITORES) throw new Error('limite de ' + MAX_LEITORES + ' acessos à Timeline');
  const email = String(b.email || '').trim().toLowerCase(), senha = String(b.senha || ''), nome = String(b.nome || '').trim().slice(0, 80);
  if (!nome) throw new Error('informe o nome');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('informe um e-mail válido');
  if (senha.length < 6) throw new Error('a senha precisa de pelo menos 6 caracteres');
  if (await env.DB.prepare('SELECT id FROM usuarios WHERE email = ?').bind(email).first()) throw new Error('já existe uma conta com esse e-mail');
  const id = novoId('u');
  await env.DB.prepare('INSERT INTO usuarios (id,email,senha_hash,nome,admin,leitor_de) VALUES (?,?,?,?,0,?)')
    .bind(id, email, await hashSenha(senha), nome, me.id).run();
  return { ok: true, id, email, nome };
}
export async function apagarLeitor(env, me, id) {
  const u = await env.DB.prepare('SELECT id FROM usuarios WHERE id = ? AND leitor_de = ?').bind(String(id || ''), me.id).first();
  if (!u) throw new Error('acesso não encontrado');
  await garantirSocial(env);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM tl_curtida WHERE usuario_id = ?').bind(u.id),
    env.DB.prepare('DELETE FROM tl_comentario WHERE usuario_id = ?').bind(u.id),
    env.DB.prepare('DELETE FROM tl_notif WHERE para_id = ?').bind(u.id),
    env.DB.prepare('DELETE FROM usuarios WHERE id = ? AND leitor_de = ?').bind(u.id, me.id)
  ]);
  return { ok: true };
}
export async function trocarSenhaLeitor(env, me, id, senha) {
  if (String(senha || '').length < 6) throw new Error('a senha precisa de pelo menos 6 caracteres');
  const u = await env.DB.prepare('SELECT id FROM usuarios WHERE id = ? AND leitor_de = ?').bind(String(id || ''), me.id).first();
  if (!u) throw new Error('acesso não encontrado');
  await env.DB.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?').bind(await hashSenha(String(senha)), u.id).run();
  return { ok: true };
}

/* ---------- quem vê e quem corrige ---------- */
async function contasVisiveis(env, me, adm) {
  if (me.lt) { const dono = await leitorDe(env, me.id); return dono ? (await equipeDe(env, dono)).ids : []; }   // leitor: a equipe de quem o criou
  if (adm) return await contasDoAdmin(env, me);   // administrador geral: a dele e as liberadas
  return (await equipeDe(env, me.id)).ids;
}
async function podeCorrigir(env, me, adm, dono) {
  if (dono === me.id) return true;
  if (adm) return (await contasDoAdmin(env, me)).includes(dono);
  const eq = await equipeDe(env, me.id);
  return eq.papel === 'adm' && eq.ids.includes(dono);
}
const marcas = (ids) => ids.map(() => '?').join(',');

/* ---------- timeline: um post por relatório, com as fotos e vídeos e as legendas ---------- */
export async function timeline(env, me, adm, antes) {
  const ids = await contasVisiveis(env, me, adm);
  if (!ids.length) return { ok: true, posts: [], mais: null };
  const filtro = ' AND r.usuario_id IN (' + marcas(ids) + ')';
  const corte = /^\d{4}-\d{2}-\d{2}/.test(String(antes || '')) ? String(antes) : '9999';
  const { results: rels } = await env.DB.prepare(`SELECT r.id, r.usuario_id, r.fazenda, r.produtor, r.servico, r.responsavel, r.status, r.data_inicio, r.observacoes,
        COALESCE(r.publicado_em, r.atualizado_em, r.criado_em) AS quando, u.nome AS autor, u.email AS autor_email
      FROM relatorios r LEFT JOIN usuarios u ON u.id = r.usuario_id
     WHERE COALESCE(r.publicado_em, r.atualizado_em, r.criado_em) < ?${filtro}
       AND EXISTS (SELECT 1 FROM itens i WHERE i.relatorio_id = r.id AND i.tipo IN ('foto','video') AND i.midia IS NOT NULL)
     ORDER BY quando DESC LIMIT 8`).bind(corte, ...ids).all();
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
      responsavel: String(r.responsavel || '').trim(),
      link: r.status === 'publicado' ? '/r/' + r.id : null,
      pode_corrigir: !!(adm || r.usuario_id === me.id || (eq && eq.papel === 'adm' && eq.ids.includes(r.usuario_id))),   // adm: ids já são só as contas liberadas
      obs: [r.observacoes].concat(l.filter((i) => i.tipo === 'texto').map((i) => i.legenda)).map((t) => String(t || '').trim()).filter(Boolean),
      midias: l.filter((i) => i.tipo !== 'texto').slice(0, 30).map((i) => ({ tipo: i.tipo, src: '/img/' + encodeURIComponent(i.midia), legenda: i.legenda || '', talhao: i.talhao || '', hora: i.capturado_em }))
    };
  });
  const soc = await socialDosPosts(env, me, posts.map((p) => p.id)).catch(() => ({}));
  posts.forEach((p) => Object.assign(p, soc[p.id] || { curtidas: 0, eu_curti: false, curtiu: [], comentarios: [] }));
  // visualizações do link do relatório (quantas vezes foi aberto, por quantas pessoas e quando por último)
  const vis = await acessosDe(env, posts.map((p) => p.id)).catch(() => ({}));
  posts.forEach((p) => { const a = vis[p.id] || {}; p.vis = { total: Number(a.total || 0), pessoas: Number(a.visitantes || 0), ultimo: a.ultimo || null }; });
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

/* ============================================================
   curtir, comentar e compartilhar na timeline + notificações (sininho do painel)
   Quem pode: quem vê o relatório (a própria equipe; o administrador geral vê todos).
   Quem recebe a notificação: o autor do relatório e o Adm da equipe dele, menos quem fez a ação.
   ============================================================ */
let socialPronto = false;
async function garantirSocial(env) {
  if (socialPronto) return;
  await env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS tl_curtida (relatorio_id TEXT NOT NULL, usuario_id TEXT NOT NULL, criado_em TEXT, PRIMARY KEY (relatorio_id, usuario_id))'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS tl_comentario (id TEXT PRIMARY KEY, relatorio_id TEXT NOT NULL, usuario_id TEXT NOT NULL, texto TEXT NOT NULL, criado_em TEXT)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS tl_com_rel ON tl_comentario (relatorio_id, criado_em)'),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS tl_notif (id TEXT PRIMARY KEY, para_id TEXT NOT NULL, de_id TEXT, de_nome TEXT, tipo TEXT NOT NULL,
      relatorio_id TEXT, fazenda TEXT, texto TEXT, criado_em TEXT, lida INTEGER DEFAULT 0)`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS tl_notif_para ON tl_notif (para_id, criado_em)')
  ]);
  socialPronto = true;
}
// relatório que esta conta pode ver (para curtir/comentar/compartilhar)
async function relVisivel(env, me, adm, id) {
  const r = await env.DB.prepare('SELECT id, usuario_id, fazenda, status FROM relatorios WHERE id = ?').bind(String(id || '').slice(0, 60)).first();
  if (!r) throw new Error('relatório não encontrado');
  if (!(await contasVisiveis(env, me, adm)).includes(r.usuario_id)) throw new Error('este relatório não é da sua equipe');
  return r;
}
async function nomeDe(env, id) { const u = await env.DB.prepare('SELECT nome, email FROM usuarios WHERE id = ?').bind(id).first(); return u ? (u.nome || String(u.email).split('@')[0]) : ''; }
async function notificar(env, me, r, tipo, texto) {
  const dono = await equipeDe(env, r.usuario_id);
  const para = [...new Set([r.usuario_id, dono.adm_id].filter(Boolean))].filter((x) => x !== me.id);
  if (!para.length) return;
  const nome = await nomeDe(env, me.id), em = new Date().toISOString();
  await env.DB.batch(para.map((p) => env.DB.prepare('INSERT INTO tl_notif (id, para_id, de_id, de_nome, tipo, relatorio_id, fazenda, texto, criado_em, lida) VALUES (?,?,?,?,?,?,?,?,?,0)')
    .bind(novoId('n'), p, me.id, nome, tipo, r.id, r.fazenda || '', texto || null, em)));
}

export async function curtir(env, me, adm, id) {
  await garantirSocial(env);
  const r = await relVisivel(env, me, adm, id);
  const ja = await env.DB.prepare('SELECT 1 FROM tl_curtida WHERE relatorio_id = ? AND usuario_id = ?').bind(r.id, me.id).first();
  if (ja) await env.DB.prepare('DELETE FROM tl_curtida WHERE relatorio_id = ? AND usuario_id = ?').bind(r.id, me.id).run();
  else {
    await env.DB.prepare('INSERT INTO tl_curtida (relatorio_id, usuario_id, criado_em) VALUES (?,?,?)').bind(r.id, me.id, new Date().toISOString()).run();
    // curtiu, descurtiu e curtiu de novo: não repete a notificação ainda não lida
    const rep = await env.DB.prepare("SELECT 1 FROM tl_notif WHERE de_id = ? AND relatorio_id = ? AND tipo = 'curtiu' AND lida = 0").bind(me.id, r.id).first();
    if (!rep) await notificar(env, me, r, 'curtiu');
  }
  const n = (await env.DB.prepare('SELECT COUNT(*) AS n FROM tl_curtida WHERE relatorio_id = ?').bind(r.id).first()).n;
  return { ok: true, curtiu: !ja, curtidas: n };
}

export async function comentar(env, me, adm, id, texto) {
  await garantirSocial(env);
  const r = await relVisivel(env, me, adm, id);
  const t = String(texto || '').trim().slice(0, 1000);
  if (!t) throw new Error('escreva o comentário');
  const c = { id: novoId('c'), texto: t, criado_em: new Date().toISOString(), autor: await nomeDe(env, me.id), meu: true };
  await env.DB.prepare('INSERT INTO tl_comentario (id, relatorio_id, usuario_id, texto, criado_em) VALUES (?,?,?,?,?)').bind(c.id, r.id, me.id, t, c.criado_em).run();
  await notificar(env, me, r, 'comentou', t.slice(0, 140));
  return { ok: true, comentario: c };
}

export async function apagarComentario(env, me, adm, cid) {
  await garantirSocial(env);
  const c = await env.DB.prepare('SELECT id, usuario_id FROM tl_comentario WHERE id = ?').bind(String(cid || '').slice(0, 60)).first();
  if (!c) throw new Error('comentário não encontrado');
  if (!adm && c.usuario_id !== me.id) throw new Error('só dá para apagar o próprio comentário');
  await env.DB.prepare('DELETE FROM tl_comentario WHERE id = ?').bind(c.id).run();
  return { ok: true };
}

export async function compartilhou(env, me, adm, id) {
  await garantirSocial(env);
  const r = await relVisivel(env, me, adm, id);
  await notificar(env, me, r, 'compartilhou');
  return { ok: true };
}

export async function notificacoes(env, me) {
  await garantirSocial(env);
  const { results } = await env.DB.prepare('SELECT id, de_nome, tipo, relatorio_id, fazenda, texto, criado_em, lida FROM tl_notif WHERE para_id = ? ORDER BY criado_em DESC LIMIT 60').bind(me.id).all();
  const n = (await env.DB.prepare('SELECT COUNT(*) AS n FROM tl_notif WHERE para_id = ? AND lida = 0').bind(me.id).first()).n;
  // foto do relatório para a miniatura
  const ids = [...new Set((results || []).map((x) => x.relatorio_id).filter(Boolean))];
  const fotos = {};
  if (ids.length) {
    const { results: fs } = await env.DB.prepare(`SELECT relatorio_id, midia FROM itens WHERE tipo = 'foto' AND midia IS NOT NULL AND relatorio_id IN (${ids.map(() => '?').join(',')}) ORDER BY capturado_em`).bind(...ids).all();
    (fs || []).forEach((f) => { if (!fotos[f.relatorio_id]) fotos[f.relatorio_id] = '/img/' + encodeURIComponent(f.midia); });
  }
  return { ok: true, nao_lidas: n, lista: (results || []).map((x) => Object.assign(x, { foto: fotos[x.relatorio_id] || '' })) };
}
export async function contarNaoLidas(env, me) {
  await garantirSocial(env);
  return { ok: true, nao_lidas: (await env.DB.prepare('SELECT COUNT(*) AS n FROM tl_notif WHERE para_id = ? AND lida = 0').bind(me.id).first()).n };
}
export async function marcarLidas(env, me) {
  await garantirSocial(env);
  await env.DB.prepare('UPDATE tl_notif SET lida = 1 WHERE para_id = ? AND lida = 0').bind(me.id).run();
  return { ok: true };
}

// curtidas e comentários dos posts da timeline
export async function socialDosPosts(env, me, ids) {
  await garantirSocial(env);
  if (!ids.length) return {};
  const q = ids.map(() => '?').join(',');
  const [cu, co] = await Promise.all([
    env.DB.prepare(`SELECT c.relatorio_id, c.usuario_id, u.nome, u.email FROM tl_curtida c LEFT JOIN usuarios u ON u.id = c.usuario_id WHERE c.relatorio_id IN (${q}) ORDER BY c.criado_em`).bind(...ids).all(),
    env.DB.prepare(`SELECT c.id, c.relatorio_id, c.usuario_id, c.texto, c.criado_em, u.nome, u.email FROM tl_comentario c LEFT JOIN usuarios u ON u.id = c.usuario_id WHERE c.relatorio_id IN (${q}) ORDER BY c.criado_em`).bind(...ids).all()
  ]);
  const out = {};
  ids.forEach((id) => { out[id] = { curtidas: 0, eu_curti: false, curtiu: [], comentarios: [] }; });
  (cu.results || []).forEach((c) => { const o = out[c.relatorio_id]; o.curtidas++; if (c.usuario_id === me.id) o.eu_curti = true; o.curtiu.push(c.nome || String(c.email || '').split('@')[0]); });
  (co.results || []).forEach((c) => { out[c.relatorio_id].comentarios.push({ id: c.id, texto: c.texto, criado_em: c.criado_em, autor: c.nome || String(c.email || '').split('@')[0], meu: c.usuario_id === me.id }); });
  return out;
}
