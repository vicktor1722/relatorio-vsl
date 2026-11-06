/* Carga única: estoque da Fazenda Santa Paula (Geraldo Perri), safra 2026/27.
   Fonte: planilha "Geraldo Perri_2 _COMPARATIVO.xlsx" (Drive · Santa Paula · SAFRA_2026_27 · PLANEJAMENTO),
   preço a prazo do Grupo de Compra VSL; produtos em dólar convertidos a R$ 5,50 (06/11/2026).
   Sintronela = CT Green (planilha de planejamento: 980 L a R$ 46,00); Kant pHós 219 L a R$ 54,00 (Vieira Junior).
   Versão 2 (07/11): Climur 135 kg (era 45) e entra o Kant pHós; edições feitas no app não são mexidas.
   Roda uma vez (marca em config); o nome de cada produto segue o usado nas recomendações da fazenda,
   para a baixa automática das aplicações casar com a entrada. */
import { baseUnidade } from './agro.js';

const CHAVE = 'carga:estoque_sp2627';
const VERSAO = 2;
const DOLAR = 5.5;

// [produto, fornecedor, moeda ('US' ou 'R'), quantidade, unidade, preço a prazo, preço à vista, entrega, vencimento, outros nomes]
const ITENS = [
  ['IHAROL GOLD', 'AMAGGI', 'US', 2200, 'L', 4.00, 3.60, '2026-09-01', '2027-09-30', ['Óleo', 'Óleo Mineral', 'Iharol']],
  ['Azotrop', 'BIOTROP', 'R', 292, 'L', 2.99, 2.99, '2026-10-15', '2027-05-30', []],
  ['Rhizotrop 2', 'BIOTROP', 'R', 438, 'L', 0.91, 0.91, '2026-10-15', '2027-05-30', ['Rhizotrop']],
  ['CLOROTALONIL', 'AMAGGI', 'US', 4380, 'L', 5.06, 4.56, '2026-10-15', '2027-09-30', ['Bravonil 720', 'Bravonil', 'Clorotalonil 720']],
  ['Mancozeb 800g WP', 'AMAGGI', 'US', 2190, 'kg', 6.33, 5.70, '2026-10-15', '2027-09-30', ['UNIZEB GOLD', 'Unizeb', 'Mancozeb', 'Mancozebe']],
  ['VESSARYA', 'CORTEVA', 'US', 876, 'L', 18.50, 16.82, '2026-10-15', '2027-09-01', []],
  ['EVOLUTION', 'Origeo (UPL)', 'US', 2920, 'kg', 9.11, 8.78, '2026-10-15', '2027-09-01', []],
  ['TEBURAZ', 'OURO FINO', 'US', 730, 'L', 6.45, 5.80, '2026-10-15', '2027-09-20', ['TEBURAZ (Azimut)', 'Azimut']],
  ['ELATUS', 'SYNGENTA', 'US', 292, 'kg', 53.14, 47.29, '2026-10-15', '2027-09-05', []],
  ['MITRION', 'SYNGENTA', 'US', 657, 'L', 29.28, 26.06, '2026-10-15', '2027-09-05', []],
  ['SCORE FLEXI', 'SYNGENTA', 'US', 219, 'L', 30.37, 27.02, '2026-10-15', '2027-09-05', []],
  ['2,4-D', 'AMAGGI', 'US', 1460, 'L', 3.68, 3.32, '2026-09-01', '2027-09-30', ['2,4D', '2,4 D', '24D']],
  ['ROUNDUP WG', 'BAYER', 'US', 6570, 'kg', 5.00, 4.65, '2026-09-01', '2027-09-30', ['Zapp 720', 'Zapp', 'Roundup', 'Glifosato']],
  ['CLIMUR', 'RAINBOW', 'US', 135, 'kg', 9.80, 9.45, '2026-09-01', '2027-05-20', ['Clorim 750', 'Clorim', 'Clorimurom', 'Clorimuron']],
  ['GLUFOSINATO 850 WG', 'Origeo (UPL)', 'US', 2920, 'kg', 8.45, 8.14, '2026-09-01', '2027-09-01', ['Glufosinato']],
  ['KENNOX', 'Origeo (UPL)', 'US', 400, 'L', 13.00, 12.53, '2026-09-01', '2027-09-01', []],
  ['ZETHAMAXX EVO', 'SUMITOMO', 'US', 2920, 'L', 10.00, 10.00, '2026-09-01', '2027-09-20', ['Zethamaxx']],
  ['ATRIVO', 'TECNOMYL', 'US', 1460, 'L', 3.70, 3.60, '2026-09-01', '2027-05-20', ['Reglone', 'Diquat', 'Diquate']],
  ['PERITO', 'Origeo (UPL)', 'US', 1460, 'kg', 8.30, 8.00, '2026-10-15', '2027-09-01', ['Perito (Acefato)', 'Acefato']],
  ['Clofenapir 240g', 'AMAGGI', 'US', 1170, 'L', 8.21, 7.40, '2026-10-15', '2027-09-30', ['Clofenapir', 'Clorfenapir']],
  ['BELT', 'BAYER', 'US', 120, 'L', 53.55, 49.80, '2026-10-15', '2027-09-30', []],
  ['EXPEDITION', 'CORTEVA', 'US', 440, 'L', 19.58, 17.80, '2026-10-15', '2027-09-01', []],
  ['METOMY', 'RAINBOW', 'US', 1460, 'kg', 12.50, 12.06, '2026-10-15', '2027-05-20', ['Metomil 212', 'Metomil']],
  ['EPINGLE', 'SUMITOMO', 'US', 315, 'L', 5.50, 5.50, '2026-10-15', '2027-09-20', ['PIRIPROXIFEM', 'Piriproxifen']],
  ['ELESTAL NEO', 'SYNGENTA', 'US', 290, 'kg', 86.76, 77.90, '2026-10-15', '2027-09-05', ['Elestal']],
  ['INSTIVO', 'SYNGENTA', 'US', 300, 'L', 24.95, 22.20, '2026-10-15', '2027-09-05', []],
  ['KARATE ZEON', 'SYNGENTA', 'US', 300, 'L', 11.06, 9.84, '2026-10-15', '2027-09-05', ['Karate']],
  ['VERDAVIS', 'SYNGENTA', 'US', 370, 'L', 78.09, 69.50, '2026-10-15', '2027-09-05', []],
  ['VERTIMEC 84', 'SYNGENTA', 'US', 365, 'L', 12.58, 11.19, '2026-10-15', '2027-09-05', ['Abamectina', 'Vertimec']],
  ['ETHIPROLE 200 SC', 'TECNOMYL', 'US', 1460, 'L', 9.20, 8.97, '2026-10-15', '2027-05-20', ['ETIPROLE', 'Ethiprole', 'ETHIPROLE 200 SC YONON']],
  ['SALLVARE COMPLEX', 'GRAN7', 'R', 300, 'L', 75.19, 64.78, '2026-10-15', '2027-05-30', ['Sallvare']],
  ['POLYAMINE MN COMPLEX', 'GRAN7', 'R', 730, 'L', 29.00, 23.78, '2026-10-15', '2027-05-30', ['Polyamine']],
  ['BORO 10', 'GRAN7', 'R', 1898, 'L', 16.91, 16.91, '2026-10-15', '2027-05-30', ['Boro 10%', 'Boro']],
  ['BRAVE MAX UP', 'GRAN7', 'R', 2482, 'L', 15.99, 15.99, '2026-10-15', '2027-05-30', ['Brave Max']],
  ['BRAVE K', 'GRAN7', 'R', 2190, 'L', 15.99, 15.99, '2026-10-15', '2027-05-30', []],
  ['MAGMILL COMPLEX', 'GRAN7', 'R', 880, 'L', 22.00, 17.22, '2026-10-15', '2027-05-30', ['Magmill']],
  ['MAX RAIZ', 'GRAN7', 'R', 220, 'L', 178.00, 135.94, '2026-10-15', '2027-05-30', []],
  ['Kant pHós', 'VIEIRA JUNIOR', 'R', 219, 'L', 54.00, 54.00, '2026-09-01', '', ['Kant Phos', 'Kant pHos', 'Kant']],
  ['Sintronela', 'CT GREEN', 'R', 980, 'L', 46.00, 46.00, '2026-10-15', '', ['CT Green', 'CT-Green', 'Citronela']]
];

// nome comparável: sem acento, sem espaço/pontuação, minúsculo
const solto = (n) => String(n || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const br2 = (v) => v.toFixed(2).replace('.', ',');
const brData = (iso) => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '';

async function marcar(env, v) {
  await env.DB.prepare('INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor').bind(CHAVE, JSON.stringify(v)).run();
}

// fazenda Santa Paula do Geraldo Perri (com mais de uma "Santa Paula", fica a do Perri; sem certeza, não lança)
async function acharFazenda(env) {
  const { results } = await env.DB.prepare(`SELECT f.id, f.usuario_id, f.nome, p.nome AS produtor FROM fazendas f
      LEFT JOIN produtores p ON p.id = f.produtor_id WHERE UPPER(f.nome) LIKE '%SANTA PAULA%'`).all();
  let l = results || [];
  if (l.length > 1) { const perri = l.filter((f) => /perri/i.test(f.produtor || '') || /perri/i.test(f.nome || '')); if (perri.length) l = perri; }
  if (l.length > 1) {   // ainda mais de uma: a que já tem recomendação ou plantio na safra 2026/27
    const com = [];
    for (const f of l) {
      const r = await env.DB.prepare(`SELECT 1 FROM recomendacoes WHERE fazenda_id = ? AND safra LIKE '%2026%27%' UNION ALL
          SELECT 1 FROM plantio WHERE fazenda_id = ? AND safra LIKE '%2026%27%' LIMIT 1`).bind(f.id, f.id).first().catch(() => null);
      if (r) com.push(f);
    }
    if (com.length) l = com;
  }
  return l.length === 1 ? l[0] : null;
}

// nomes (e unidade) já usados para essa fazenda: recomendações primeiro, depois o catálogo da conta
async function nomesUsados(env, f) {
  const usados = [];
  const [recs, cat] = await Promise.all([
    env.DB.prepare('SELECT dados FROM recomendacoes WHERE fazenda_id = ?').bind(f.id).all().catch(() => ({ results: [] })),
    env.DB.prepare('SELECT nome, unidade FROM produtos_agro WHERE usuario_id = ?').bind(f.usuario_id).all().catch(() => ({ results: [] }))
  ]);
  (recs.results || []).forEach((r) => {
    let d = {}; try { d = JSON.parse(r.dados || '{}'); } catch (e) { d = {}; }
    (d.prods || []).forEach((p) => { if (p && p[0]) usados.push({ nome: String(p[0]).trim(), un: baseUnidade(p[2])[0] }); });
  });
  (cat.results || []).forEach((p) => { if (p.nome) usados.push({ nome: String(p.nome).trim(), un: baseUnidade(p.unidade)[0] }); });
  return usados;
}

export async function cargaEstoqueSantaPaula(env) {
  const feito = await env.DB.prepare('SELECT valor FROM config WHERE chave = ?').bind(CHAVE).first().catch(() => null);
  const antes = feito ? JSON.parse(feito.valor) : null;
  if (antes && (antes.v || 1) >= VERSAO) return antes;
  // já carregada antes (versão 1): mesma fazenda; senão procura
  const f = antes && antes.fazenda ? await env.DB.prepare('SELECT id, usuario_id, nome FROM fazendas WHERE id = ?').bind(antes.fazenda).first() : await acharFazenda(env);
  if (!f) { console.log('carga do estoque Santa Paula: fazenda não encontrada (ou mais de uma)'); return null; }
  const usados = await nomesUsados(env, f);
  const lista = [];
  for (const [prod, forn, moeda, qtd, unPadrao, prazo, vista, entrega, venc, outros] of ITENS) {
    const nomes = [prod].concat(outros).map(solto);
    const achou = usados.find((u) => nomes.indexOf(solto(u.nome)) >= 0);
    const nome = achou ? achou.nome : prod, un = achou ? achou.un : unPadrao;
    const pu = moeda === 'US' ? prazo * DOLAR : prazo;
    const obs = ('Compra safra 26/27 · ' + forn + (achou && solto(achou.nome) !== solto(prod) ? ' · ' + prod : '') + ' · ' +
      (moeda === 'US' ? 'US$ ' + br2(prazo) + '/' + un + ' a prazo × dólar ' + br2(DOLAR) : 'R$ ' + br2(prazo) + '/' + un + (prazo !== vista ? ' a prazo' : '')) +
      (venc ? ' · venc. ' + brData(venc) : '')).slice(0, 200);
    lista.push({ id: 'es-sp2627-' + solto(prod).slice(0, 30), nome, un, qtd, valor: Math.round(qtd * pu * 100) / 100, data: entrega, obs });
  }
  const st = env.DB.prepare(`INSERT OR IGNORE INTO estoque_agro (id, usuario_id, fazenda_id, produto, unidade, qtd, valor, data, obs)
      VALUES (?,?,?,?,?,?,?,?,?)`);
  const cmds = lista.map((x) => st.bind(x.id, f.usuario_id, f.id, x.nome, x.un, x.qtd, x.valor, x.data, x.obs));
  // versão 1 lançou o Climur com 45 kg: corrige para 135 kg (só se ninguém mexeu na quantidade)
  const cl = lista.find((x) => x.id === 'es-sp2627-climur');
  cmds.push(env.DB.prepare('UPDATE estoque_agro SET qtd = ?, valor = ? WHERE id = ? AND fazenda_id = ? AND qtd = 45').bind(cl.qtd, cl.valor, cl.id, f.id));
  await env.DB.batch(cmds);
  const res = { ok: true, v: VERSAO, fazenda: f.id, itens: lista.length, total: Math.round(lista.reduce((s, x) => s + x.valor, 0) * 100) / 100, em: new Date().toISOString() };
  await marcar(env, res);
  console.log('carga do estoque Santa Paula:', JSON.stringify(res));
  return res;
}

/* Troca única (07/11): nas recomendações da Santa Paula, "Glifosato 720" vira "ROUNDUP WG" (720 g/kg, mesma dose;
   L/ha → kg/ha), para casar com o estoque. O lançamento do estoque também fica como ROUNDUP WG em kg. */
const CHAVE_RU = 'carga:sp_roundup';
const UN_KG = { 'L/ha': 'kg/ha', 'mL/ha': 'g/ha', 'L/100L': 'kg/100L', 'mL/100L': 'g/100L' };

export async function trocarGlifosatoSantaPaula(env, chaveTroca, prefixos) {
  chaveTroca = chaveTroca || CHAVE_RU; prefixos = prefixos || ['glifosato720'];
  const feito = await env.DB.prepare('SELECT valor FROM config WHERE chave = ?').bind(chaveTroca).first().catch(() => null);
  if (feito) return JSON.parse(feito.valor);
  const c = await env.DB.prepare('SELECT valor FROM config WHERE chave = ?').bind(CHAVE).first().catch(() => null);
  const fid = c && JSON.parse(c.valor).fazenda;
  if (!fid) return null;   // a carga do estoque ainda não achou a fazenda
  const f = await env.DB.prepare('SELECT id, usuario_id FROM fazendas WHERE id = ?').bind(fid).first();
  if (!f) return null;
  const { results } = await env.DB.prepare('SELECT id, dados FROM recomendacoes WHERE fazenda_id = ?').bind(fid).all();
  const cmds = [];
  let recs = 0, linhas = 0;
  (results || []).forEach((r) => {
    let d; try { d = JSON.parse(r.dados || '{}'); } catch (e) { return; }
    let mudou = false;
    (d.prods || []).forEach((p) => {
      if (p && p[0] && prefixos.some((k) => solto(p[0]).startsWith(k))) { p[0] = 'ROUNDUP WG'; p[2] = UN_KG[p[2]] || p[2]; mudou = true; linhas++; }
    });
    if (mudou) { recs++; cmds.push(env.DB.prepare("UPDATE recomendacoes SET dados = ?, atualizado_em = datetime('now') WHERE id = ?").bind(JSON.stringify(d), r.id)); }
  });
  // estoque: o Roundup WG fica com o nome e a unidade dele
  cmds.push(env.DB.prepare(`UPDATE estoque_agro SET produto = 'ROUNDUP WG', unidade = 'kg',
      obs = 'Compra safra 26/27 · BAYER · US$ 5,00/kg a prazo × dólar 5,50 · venc. 30/09/2027' WHERE id = 'es-sp2627-roundupwg' AND fazenda_id = ?`).bind(fid));
  // catálogo da conta: cadastra o Roundup WG se ainda não existe (o Glifosato 720 continua lá para as outras fazendas)
  const tem = await env.DB.prepare("SELECT 1 FROM produtos_agro WHERE usuario_id = ? AND REPLACE(LOWER(nome), ' ', '') = 'roundupwg'").bind(f.usuario_id).first();
  if (!tem) cmds.push(env.DB.prepare(`INSERT OR IGNORE INTO produtos_agro (id, usuario_id, nome, tipo, ingrediente, dose, unidade, intervalo_dias)
      VALUES (?, ?, 'ROUNDUP WG', 'Herbicida', 'Glifosato 720 g/kg (equivalente ácido)', 0, 'kg/ha', 0)`).bind('pd-roundupwg-' + f.usuario_id.slice(-8), f.usuario_id));
  await env.DB.batch(cmds);
  const res = { ok: true, fazenda: fid, recomendacoes: recs, linhas, em: new Date().toISOString() };
  await env.DB.prepare('INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor').bind(chaveTroca, JSON.stringify(res)).run();
  console.log('troca ' + prefixos.join('/') + ' → ROUNDUP WG:', JSON.stringify(res));
  return res;
}

// 07/11: o Zapp 720 das recomendações da Santa Paula também passa a ser o glifosato comprado (ROUNDUP WG)
export function trocarZappSantaPaula(env) { return trocarGlifosatoSantaPaula(env, 'carga:sp_zapp', ['zapp']); }

/* 07/11: o Karate Zeon foi comprado, mas o que chegou na fazenda foi o Lasting.
   O lançamento do estoque passa a se chamar Lasting (mesmo volume e valor) e as recomendações ficam com Lasting.
   Desfaz a troca Lasting → Karate Zeon feita pouco antes (só nas recomendações mexidas por ela). */
const CHAVE_KZ = 'carga:sp_karate';      // troca anterior (Lasting → Karate Zeon), já feita em produção
const CHAVE_LA = 'carga:sp_lasting';
const iso2sql = (iso) => iso.replace('T', ' ').slice(0, 19);

export async function voltarLastingSantaPaula(env) {
  const feito = await env.DB.prepare('SELECT valor FROM config WHERE chave = ?').bind(CHAVE_LA).first().catch(() => null);
  if (feito) return JSON.parse(feito.valor);
  const c = await env.DB.prepare('SELECT valor FROM config WHERE chave = ?').bind(CHAVE).first().catch(() => null);
  const fid = c && JSON.parse(c.valor).fazenda;
  if (!fid) return null;
  const f = await env.DB.prepare('SELECT id, usuario_id FROM fazendas WHERE id = ?').bind(fid).first();
  if (!f) return null;
  const cmds = [];
  let recs = 0, linhas = 0;
  const kz = await env.DB.prepare('SELECT valor FROM config WHERE chave = ?').bind(CHAVE_KZ).first().catch(() => null);
  const ant = kz ? JSON.parse(kz.valor) : null;
  if (ant && ant.em && ant.nome) {
    // recomendações gravadas pela troca anterior (mesmo instante, ±10 min)
    const t = new Date(ant.em).getTime(), de = iso2sql(new Date(t - 6e5).toISOString()), ate = iso2sql(new Date(t + 6e5).toISOString());
    const { results } = await env.DB.prepare('SELECT id, dados FROM recomendacoes WHERE fazenda_id = ? AND atualizado_em BETWEEN ? AND ?').bind(fid, de, ate).all();
    (results || []).forEach((r) => {
      let d; try { d = JSON.parse(r.dados || '{}'); } catch (e) { return; }
      let mudou = false;
      (d.prods || []).forEach((p) => { if (p && p[0] === ant.nome) { p[0] = 'Lasting'; mudou = true; linhas++; } });
      if (mudou) { recs++; cmds.push(env.DB.prepare("UPDATE recomendacoes SET dados = ?, atualizado_em = datetime('now') WHERE id = ?").bind(JSON.stringify(d), r.id)); }
    });
    // o Karate Zeon que a troca anterior cadastrou no catálogo sai
    cmds.push(env.DB.prepare('DELETE FROM produtos_agro WHERE id = ? AND usuario_id = ?').bind('pd-karatezeon-' + f.usuario_id.slice(-8), f.usuario_id));
  }
  // estoque: o volume comprado como Karate Zeon fica como Lasting
  cmds.push(env.DB.prepare(`UPDATE estoque_agro SET produto = 'Lasting', unidade = 'L',
      obs = 'Compra safra 26/27 · SYNGENTA · comprado como KARATE ZEON, entregue Lasting · US$ 11,06/L a prazo × dólar 5,50 · venc. 05/09/2027'
      WHERE id = 'es-sp2627-karatezeon' AND fazenda_id = ?`).bind(fid));
  await env.DB.batch(cmds);
  // recomendações da fazenda que ainda citam Karate Zeon (não mexidas aqui)
  const { results: todas } = await env.DB.prepare('SELECT dados FROM recomendacoes WHERE fazenda_id = ?').bind(fid).all();
  const karate = (todas || []).reduce((n, r) => n + ((/"karate\s*zeon"/i.test(r.dados || '')) ? 1 : 0), 0);
  const res = { ok: true, fazenda: fid, recomendacoes: recs, linhas, karate_restante: karate, em: new Date().toISOString() };
  await env.DB.prepare('INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor').bind(CHAVE_LA, JSON.stringify(res)).run();
  console.log('volta para Lasting:', JSON.stringify(res));
  return res;
}

/* 07/11: tipo certo no catálogo (é ele que separa o estoque por categoria). Corrige os que já existem
   na conta da Santa Paula e cadastra os que só estão no estoque. */
const CHAVE_TP = 'carga:sp_tipos';
const TIPOS_CERTOS = [
  [['abamectina'], 'Inseticida'],
  [['clorim'], 'Herbicida'],
  [['ctgreen', 'ctgren'], 'Adjuvante'],
  [['etiprole', 'etiplore', 'ethiprole'], 'Inseticida']
];

export async function tiposSantaPaula(env) {
  const feito = await env.DB.prepare('SELECT valor FROM config WHERE chave = ?').bind(CHAVE_TP).first().catch(() => null);
  if (feito) return JSON.parse(feito.valor);
  const c = await env.DB.prepare('SELECT valor FROM config WHERE chave = ?').bind(CHAVE).first().catch(() => null);
  const fid = c && JSON.parse(c.valor).fazenda;
  if (!fid) return null;
  const f = await env.DB.prepare('SELECT id, usuario_id FROM fazendas WHERE id = ?').bind(fid).first();
  if (!f) return null;
  const tipoDe = (nome) => { const s = solto(nome); const r = TIPOS_CERTOS.find(([l]) => l.some((k) => s.startsWith(k))); return r ? r[1] : null; };
  const [cat, est] = await Promise.all([
    env.DB.prepare('SELECT id, nome, tipo FROM produtos_agro WHERE usuario_id = ?').bind(f.usuario_id).all(),
    env.DB.prepare('SELECT DISTINCT produto FROM estoque_agro WHERE fazenda_id = ?').bind(fid).all()
  ]);
  const cmds = [], noCat = {};
  let corrigidos = 0, novos = 0;
  (cat.results || []).forEach((p) => {
    const t = tipoDe(p.nome);
    if (!t) return;
    noCat[solto(p.nome)] = 1;
    if (p.tipo !== t) { corrigidos++; cmds.push(env.DB.prepare('UPDATE produtos_agro SET tipo = ? WHERE id = ?').bind(t, p.id)); }
  });
  (est.results || []).forEach((e) => {
    const t = tipoDe(e.produto);
    if (!t || noCat[solto(e.produto)]) return;
    novos++; noCat[solto(e.produto)] = 1;
    cmds.push(env.DB.prepare(`INSERT OR IGNORE INTO produtos_agro (id, usuario_id, nome, tipo, ingrediente, dose, unidade, intervalo_dias)
        VALUES (?, ?, ?, ?, '', 0, 'L/ha', 0)`).bind('pd-' + solto(e.produto).slice(0, 20) + '-' + f.usuario_id.slice(-8), f.usuario_id, e.produto, t));
  });
  if (cmds.length) await env.DB.batch(cmds);
  const res = { ok: true, corrigidos, novos, em: new Date().toISOString() };
  await env.DB.prepare('INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor').bind(CHAVE_TP, JSON.stringify(res)).run();
  console.log('tipos no catálogo:', JSON.stringify(res));
  return res;
}
