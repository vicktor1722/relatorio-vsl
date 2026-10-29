/* ============================================================
   termos.js — Termos de Uso e Política de Privacidade
   Uma fonte só: a página pública /termos e a tela de aceite do app usam este texto.
   Mudou o texto de forma relevante? Suba TERMOS_VERSAO: todo mundo aceita de novo
   no próximo acesso. O aceite fica guardado com data, IP e aparelho (prova do consentimento).
   ============================================================ */

export const TERMOS_VERSAO = '2026-10-29';
const VIGENCIA = '29 de outubro de 2026';

const json = (o, status) => new Response(JSON.stringify(o), {
  status: status || 200,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
});

let pronta = null;
export function garantirTermos(env) {
  if (!pronta) {
    pronta = env.DB.prepare(`CREATE TABLE IF NOT EXISTS termos_aceite (
        usuario_id  TEXT NOT NULL,
        versao      TEXT NOT NULL,
        aceito_em   TEXT DEFAULT (datetime('now')),
        ip          TEXT DEFAULT '',
        aparelho    TEXT DEFAULT '',
        avisos      INTEGER DEFAULT 0,
        PRIMARY KEY (usuario_id, versao)
      )`).run().catch((e) => { pronta = null; throw e; });
  }
  return pronta;
}

// texto dos termos (HTML simples, sem estilos próprios: quem mostra decide a aparência)
export const TERMOS_HTML = `
<p class="vig">Versão de ${VIGENCIA}</p>

<h2>1. Quem somos</h2>
<p>O aplicativo <b>AMVS Relatório</b> (app de campo, relatório do cliente e painel de gestão) é oferecido pela
<b>VSL Consultoria e Treinamento na Agricultura Ltda.</b> (marca AMVS), com sede em Pontes e Lacerda – MT.
Contato: <a href="mailto:amvsdiretoria@gmail.com">amvsdiretoria@gmail.com</a> · WhatsApp (65) 99918-9847.</p>

<h2>2. Resumo das atividades do app</h2>
<ul>
  <li><b>Relatório de visita:</b> fotos, vídeos, áudios e observações registrados em uma conversa por fazenda, com data, hora, GPS e talhão.</li>
  <li><b>Envio ao cliente:</b> link do relatório, PDF e apresentação (PowerPoint), com mapas por satélite dos pontos visitados.</li>
  <li><b>Cadastro:</b> produtores, fazendas, talhões (KML), safras e responsáveis.</li>
  <li><b>Plantio:</b> cultura, variedade, datas, sementes e evolução do plantio por talhão.</li>
  <li><b>Recomendações:</b> produtos, doses, calda, ordem de campo, calendário e controle do que foi aplicado.</li>
  <li><b>Estoque e custos:</b> entradas de produtos por fazenda, baixa automática pelas aplicações e custo médio.</li>
  <li><b>Colheita e comparativo:</b> produtividade por talhão e comparação entre gasto e produção no painel.</li>
  <li><b>Avisos no celular:</b> notificação das aplicações dos próximos dias, se você permitir.</li>
</ul>

<h2>3. Conta e acesso</h2>
<p>As contas são criadas pela administração da AMVS. O acesso é pessoal: guarde sua senha e não a compartilhe.
Você responde pelo que for feito com a sua conta. Se suspeitar de uso indevido, troque a senha e avise a AMVS.
O acesso segue o plano ou prazo contratado e pode ser suspenso por falta de pagamento ou por uso em desacordo com estes termos.</p>

<h2>4. Uso permitido</h2>
<p>Use o app para registrar e comunicar o trabalho técnico de campo. Não é permitido: enviar conteúdo ilegal, ofensivo
ou de terceiros sem autorização; tentar acessar dados de outras contas; copiar, revender ou desmontar o sistema;
nem sobrecarregar o serviço de propósito.</p>

<h2>5. Seu conteúdo e o relatório do cliente</h2>
<p>As fotos, vídeos, áudios, textos e dados que você lança continuam sendo seus (ou do seu cliente). Você autoriza a
AMVS a guardá-los, processá-los e exibi-los apenas para fazer o app funcionar. <b>O relatório publicado pode ser aberto
por qualquer pessoa que tiver o link</b>: envie só para quem deve ver. Você declara ter autorização do produtor para
registrar e compartilhar as informações da propriedade.</p>

<h2>6. Dados pessoais (LGPD)</h2>
<p><b>O que coletamos:</b> nome, e-mail e senha (guardada cifrada); localização (GPS) no momento de cada registro;
fotos, vídeos e áudios; dados de produtores, fazendas e talhões que você cadastra; dados técnicos de uso
(aparelho, data e hora de acesso, aberturas do relatório pelo cliente).</p>
<p><b>Para quê:</b> prestar o serviço (registrar, organizar, gerar e enviar relatórios e recomendações), dar suporte,
manter a segurança e cobrar o plano. As bases legais são a execução do contrato, o legítimo interesse e,
para os avisos no celular, o seu consentimento.</p>
<p><b>Com quem compartilhamos:</b> somente com prestadores necessários ao funcionamento — hospedagem e armazenamento
(Cloudflare), serviços de notificação do celular (Apple/Google), imagens de mapa por satélite e, se você conectar,
o Google Drive. Não vendemos seus dados.</p>
<p><b>Por quanto tempo:</b> enquanto a conta estiver ativa ou for necessário para cumprir obrigações legais. Pedida a
exclusão da conta, os dados são apagados ou anonimizados, salvo o que a lei obrigar a manter.</p>
<p><b>Seus direitos:</b> confirmar o tratamento, acessar, corrigir, levar para outro serviço, pedir a exclusão e revogar
o consentimento, pelo contato do item 1.</p>
<p><b>Segurança:</b> conexão cifrada (HTTPS), senha com hash e acesso separado por conta. Nenhum sistema é 100% imune;
havendo incidente relevante, os afetados serão avisados.</p>

<h2>7. Permissões do celular</h2>
<p><b>Câmera e microfone</b> para fotos, vídeos e áudios; <b>localização</b> para marcar onde cada registro foi feito;
<b>notificações</b> para avisar das aplicações próximas. O app só usa essas permissões quando você registra algo ou para
os avisos. Você pode desligá-las a qualquer momento nos ajustes do celular (algumas funções deixam de funcionar).</p>

<h2>8. Recomendações agronômicas</h2>
<p>O app é uma ferramenta de registro e organização. Produtos, doses, datas e misturas são definidos pelo profissional
responsável, que deve seguir a bula, o receituário agronômico e a legislação. A AMVS não responde pelo resultado das
aplicações, por perdas de produção nem por decisões tomadas com base nas informações lançadas. Estoque, custos e
produtividade são calculados a partir do que o usuário informa e servem como apoio à gestão.</p>

<h2>9. Funcionamento e disponibilidade</h2>
<p>O app funciona sem internet e envia os registros quando a conexão volta. O que ainda não foi enviado fica só no
aparelho: apagar o app ou os dados do navegador antes do envio pode causar perda. Fazemos o possível para manter o
serviço no ar, mas podem ocorrer interrupções para manutenção ou por falhas de terceiros.</p>

<h2>10. Encerramento</h2>
<p>Você pode pedir o encerramento da conta a qualquer momento. A AMVS pode encerrar ou suspender contas que violem
estes termos. Antes do encerramento, você pode pedir a cópia dos seus relatórios.</p>

<h2>11. Mudanças nestes termos</h2>
<p>Quando houver mudança relevante, o app mostrará a nova versão e pedirá um novo aceite no próximo acesso.</p>

<h2>12. Lei e foro</h2>
<p>Valem as leis do Brasil. Fica eleito o foro da comarca de Pontes e Lacerda – MT, salvo regra legal diferente
para o consumidor.</p>
`;

export function paginaTermos() {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Termos de Uso e Privacidade · AMVS Relatório</title>
<style>
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#F3F5F4;color:#1C2B23;line-height:1.55}
header{background:#1B7A43;color:#fff;padding:22px 18px}
header h1{margin:0;font-size:21px}header p{margin:4px 0 0;opacity:.85;font-size:14px}
main{max-width:760px;margin:0 auto;padding:8px 18px 40px;background:#fff}
h2{font-size:16.5px;color:#146034;margin:22px 0 6px}
p,li{font-size:15px}ul{padding-left:20px}a{color:#1B7A43}
.vig{color:#667781;font-size:13px;margin:14px 0 0}
</style></head><body>
<header><h1>Termos de Uso e Política de Privacidade</h1><p>AMVS Relatório</p></header>
<main id="termos">${TERMOS_HTML}</main>
</body></html>`;
}

/* ---------------- rotas ---------------- */
export async function rotasTermos(env, req, me, rota) {
  await garantirTermos(env);
  if (rota === '/api/termos' && req.method === 'GET') {
    const r = await env.DB.prepare('SELECT aceito_em FROM termos_aceite WHERE usuario_id = ? AND versao = ?').bind(me.id, TERMOS_VERSAO).first();
    return json({ ok: true, versao: TERMOS_VERSAO, aceito: !!r, aceito_em: r ? r.aceito_em : null });
  }
  if (rota === '/api/termos/aceitar' && req.method === 'POST') {
    const b = await req.json().catch(() => ({}));
    if (String(b.versao || '') !== TERMOS_VERSAO) return json({ erro: 'os termos foram atualizados: abra o app de novo para ler a versão nova' }, 409);
    await env.DB.prepare(`INSERT INTO termos_aceite (usuario_id, versao, aceito_em, ip, aparelho, avisos) VALUES (?,?,?,?,?,?)
        ON CONFLICT(usuario_id, versao) DO NOTHING`)
      .bind(me.id, TERMOS_VERSAO, String(b.em || new Date().toISOString()).slice(0, 30),
        req.headers.get('CF-Connecting-IP') || '', String(req.headers.get('User-Agent') || '').slice(0, 300), b.avisos ? 1 : 0).run();
    return json({ ok: true, versao: TERMOS_VERSAO });
  }
  return json({ erro: 'rota não encontrada' }, 404);
}
