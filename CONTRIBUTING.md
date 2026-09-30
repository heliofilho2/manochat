# Contribuindo

Obrigado por querer ajudar! O processo é leve. Para montar o ambiente (contas, `.env.local`, app na
Meta), siga primeiro o [README](README.md).

## Antes de começar
- Garanta que `pnpm lint`, `pnpm typecheck` e `pnpm test` passam na `main`. Se não passam, abra uma
  *issue* em vez de construir em cima.
- Para algo maior que uma correção pequena, abra uma *issue* ou um PR em rascunho descrevendo a ideia
  antes de escrever muito código.

## Fluxo
1. Faça um fork (ou crie uma branch, se tiver acesso de escrita) a partir da `main`, com nome que
   diga o que faz: `fix/retry-do-webhook`, `feat/nova-funcionalidade`.
2. Faça a mudança e **adicione ou atualize testes** para tudo em `lib/`.
3. Rode antes de enviar:
   ```bash
   pnpm lint && pnpm typecheck && pnpm test
   ```
4. Commit com assunto curto e no imperativo ("Corrige corrida no reprocessamento"). Não misture
   mudanças não relacionadas.
5. Abra o PR contra a `main` explicando **o que mudou e por quê**, **como testou** (inclua se testou
   com um webhook real do Instagram quando mexer em `app/api/webhooks/` ou `lib/automation/processor.ts`)
   e destaque qualquer mudança de esquema do banco.

## Onde ficam as coisas
| Se você vai mudar… | Está em |
|---|---|
| Regra de casamento de palavras | `lib/automation/matcher.ts` (funções puras) |
| Fluxo do botão, seguir antes, mensagens | `lib/automation/flow.ts` |
| O que acontece quando chega um evento | `lib/automation/processor.ts` |
| Automação de story e leads | `lib/automation/story.ts` |
| Chamadas à Graph API | `lib/instagram/client.ts` |
| Login e renovação do token | `lib/instagram/oauth.ts` |
| Verificação da assinatura do webhook | `lib/instagram/webhook-verify.ts` |
| Tema e estilo da página de bio | `lib/bio/` |
| Esquema do banco | `db/schema.ts` |

## Convenções
- Regras de negócio em **módulos puros e testáveis**; efeitos (banco, rede) em `processor`/`client`.
- Textos de interface em **português do Brasil**.
- Mudou `db/schema.ts`? Gere a migration com `pnpm db:generate`, revise o SQL e inclua no PR.
- Nunca inclua segredos, tokens ou dados reais de usuários em código, testes ou *issues*.

## Segurança
Se achar uma falha de segurança, não publique os detalhes em uma *issue* pública: fale diretamente
com o mantenedor.
