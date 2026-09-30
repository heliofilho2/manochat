# Meta App Review — checklist

O App Review é o item com prazo fora do nosso controle. Só ele libera **Advanced Access**,
sem o qual o app só funciona com contas de teste (README, passo 4d/4e).

## Pré-requisitos (fazer em paralelo ao código)
- [ ] **Business Verification** do Business Manager (documentos da empresa/MEI) — costuma ser o gargalo.
- [ ] App implantado com URL HTTPS pública (passo 7 do README).
- [ ] Privacy Policy URL → `https://<APP_URL>/privacy` (preencher os campos `[...]` e revisar).
- [ ] Data Deletion URL → `https://<APP_URL>/data-deletion`.
- [ ] Terms of Service URL (ainda não existe — criar `/terms`).
- [ ] Ícone do app 1024x1024 e categoria.
- [ ] Conta de teste (Instagram Tester) para o revisor.

## Permissões a solicitar (Advanced Access)
| Permissão | Justificativa (curta, em inglês — o revisor lê inglês) |
|---|---|
| `instagram_business_basic` | Read the connected professional account's profile and media list so the user can pick which posts an automation applies to. |
| `instagram_business_manage_comments` | Read comments on the user's posts to detect the configured keyword, and post a public reply. |
| `instagram_business_manage_messages` | Send a private reply to a commenter, and send the follow-up message (link) after the user taps the button, within the 24h window. |
| `instagram_business_manage_insights` | Read reach and views of the user's own posts to rank best posting time, format and theme on their dashboard. Data is shown only to the account owner. |

Webhooks usados: `comments`, `messages`, `messaging_postbacks`.

## Screencast (obrigatório, por permissão)
1. Login com Instagram → tela de consentimento.
2. Criar automação (post, palavra-chave, resposta, botão).
3. Comentar a palavra de outra conta → resposta pública + DM com botão.
4. Tocar no botão → (não segue) pedido para seguir → seguir → tocar → link.
5. Mostrar o Inbox/atividade registrando tudo.

## Depois de aprovado
- Trocar o app para **Live mode**.
- Só então abrir o cadastro para outras contas (hoje o app é single-tenant — ver README).
