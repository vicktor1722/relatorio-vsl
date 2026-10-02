# Relatório de Campo VSL

App de visita técnica: foto e vídeo com GPS e talhão automático pelo KML,
conversa por fazenda, relatório pronto para enviar ao produtor.

## Como funciona o deploy

Ao enviar um arquivo para este repositório, a Cloudflare compila e publica
sozinha (Workers → relatorio-vsl → Configurações → Compilações).

- `npm run build` junta `public/` num `site/index.html` de arquivo único
- o Worker (`src/`) serve a API, a página pública do relatório e o painel
- tudo no mesmo endereço

## Pastas

| Pasta | O que tem |
|---|---|
| `public/` | o app de campo, em arquivos separados para editar |
| `src/` | o servidor (API, página do relatório, painel de administração) |
| `construir.js` | junta o app num arquivo único |
| `schema.sql` | as tabelas do banco D1 |

## Endereços

- App e API: https://relatorio-vsl.vicktorlima17.workers.dev
- Painel: /admin  (só para contas marcadas como administradoras)
- Relatório do cliente: /r/<id>

## Contas

Contas novas são criadas apenas pelo painel de administração.
Para marcar alguém como administrador pela primeira vez, no console do D1:

    UPDATE usuarios SET admin = 1 WHERE email = 'seu@email.com';
