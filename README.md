# Oslinke

**Automação de Instagram gratuita e de código aberto para criadores e pequenos negócios.**
Comentou a palavra ou respondeu o story? O link chega na DM, sozinho. Com checagem de
quem segue, captura de leads e uma página de links (link na bio) personalizável.

Usa **apenas as APIs oficiais da Meta** (Login do Instagram + Graph API). Sem senha, sem
robô, sem scraping. Roda na **Vercel + Neon** e você pode hospedar a sua própria cópia.

> Veja como ele funciona, com as telas reais: **https://manochat.vercel.app/como-funciona**

## Telas

<table>
  <tr>
    <td width="50%"><img src="docs/prints-readme/lista-automacoes.png" alt="Lista de automações"><br><sub><b>Automações</b>: ativar, pausar e reenviar o link</sub></td>
    <td width="50%"><img src="docs/prints-readme/escolher-gatilho.png" alt="Escolher o gatilho"><br><sub><b>Gatilho</b>: comentário em post ou resposta a story</sub></td>
  </tr>
  <tr>
    <td><img src="docs/prints-readme/editor-automacao.png" alt="Editor de automação de comentário"><br><sub><b>Comentário</b>: palavras, posts e mensagens, com a conversa ao lado</sub></td>
    <td><img src="docs/prints-readme/editor-story.png" alt="Editor de automação de story"><br><sub><b>Story</b>: qualquer story ou um específico, e captura de leads</sub></td>
  </tr>
  <tr>
    <td><img src="docs/prints-readme/conversa.png" alt="Pré-visualização da conversa" width="320"><br><sub><b>Pré-visualização</b> da DM, com o botão "Já sigo"</sub></td>
    <td><img src="docs/prints-readme/bio-editor.png" alt="Editor da página de bio"><br><sub><b>Link na bio</b>: temas, fundos, botões e fontes</sub></td>
  </tr>
  <tr>
    <td colspan="2" align="center"><img src="docs/prints-readme/bio-publica.png" alt="Página de bio publicada" width="420"><br><sub><b>Página pública</b> em <code>/u/seu-usuario</code></sub></td>
  </tr>
</table>

---

## Sumário

- [O que ele faz](#o-que-ele-faz)
- [Como funciona por dentro](#como-funciona-por-dentro)
- [Limites da Meta (e como o app lida com eles)](#limites-da-meta-e-como-o-app-lida-com-eles)
- [Instalação passo a passo](#instalação-passo-a-passo)
- [Usando](#usando)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Webhook de leads](#webhook-de-leads)
- [Solução de problemas](#solução-de-problemas)
- [Arquitetura](#arquitetura)
- [Comandos](#comandos)
- [Custos](#custos)
- [Segurança e privacidade](#segurança-e-privacidade)
- [Contribuindo e suporte](#contribuindo-e-suporte)
- [Créditos](#créditos)

---

## O que ele faz

### Automações de comentário
- Escolha **uma ou mais palavras-chave** (palavra exata ou "contém") e onde valem:
  **posts específicos**, **todos os posts** ou **só os próximos**.
- **Resposta pública** no comentário, com variações que se alternam para não parecer spam.
- **DM com o link** enviada como resposta privada ao comentário (não precisa de conversa anterior).
- **Seguir antes (opcional):** a primeira DM traz um botão "Já sigo ✅". Ao tocar, o app pergunta
  à Meta se a pessoa segue de verdade e só então libera o link. Quem ainda não segue recebe um
  lembrete e pode tentar de novo.
- Botão de link na DM, texto livre e **pré-visualização da conversa** antes de ativar.
- **Reenviar link:** botão na lista de automações que reenvia o link a quem tocou no botão nas
  últimas 24 h e não recebeu (por exemplo, por atraso da Meta ao registrar um novo seguidor).

### Automações de story
- Quem **responde ao seu story** (qualquer resposta, ou uma palavra específica) recebe o link na DM.
- Vale para **qualquer story** ou **stories específicos**. Dica: se você impulsiona stories
  (anúncios), use "qualquer story", porque o anúncio pode chegar com outro id de mídia.
- **Captura de leads**: pergunta e-mail e/ou WhatsApp, valida, agradece.
- Reação de coração na resposta (opcional).

### Leads
- Lista de quem respondeu, com e-mail, WhatsApp, origem e etapa.
- **Exportar CSV** e **webhook opcional** que envia cada lead novo ao seu site ou CRM
  ([detalhes](#webhook-de-leads)).

### Link na bio
- Página pública em `/u/<seu-usuario>` com os seus links, as automações ativas ("Comente
  PALAVRA…") e os últimos posts.
- **Personalização:** 10 temas, 4 estilos de cabeçalho, fundos (cor, degradê, foto desfocada,
  padrão, imagem), 5 estilos de botão, 6 fontes, cores próprias, moldura em painel, redes
  sociais e títulos de seção.
- **Cliques contados** por link e redirecionamento com suporte a UTM.

### Painel e caixa de entrada
- Contatos, janelas de 24 h abertas, DMs enviadas, cliques no link da bio, funil
  (alcance → DMs → cliques) e ranking do que mais funciona (hora, dia, formato, tema),
  direto da API de Insights do Instagram.
- **Caixa de entrada** com o histórico do que foi enviado e recebido, incluindo a decisão de cada
  toque no botão de seguir ("link enviado", "ainda não segue").
- **Tags** automáticas nos contatos.

### Multiusuário
Cada conta que se conecta tem suas automações, contatos, leads e página de bio isolados.

---

## Como funciona por dentro

```
Comentário / resposta de story / toque de botão
        │  webhook da Meta (campos: comments, messages, messaging_postbacks)
        ▼
POST /api/webhooks/instagram
        │  valida assinatura → grava o evento bruto → responde 200 na hora
        ▼  (depois de responder)
   processa: casa a automação → responde o comentário → envia a DM
        │
        ▼
Cron reprocessa o que ficou pendente ou falhou
```

O webhook responde **antes** de processar, porque a Meta estrangula e desativa endpoints lentos.
A durabilidade vem da tabela `webhook_event` e de um cron que reprocessa, e não de uma fila.

**Idempotência:** cada envio é protegido por chave única no banco (`comment_event.comment_id`,
`story:<mid>` e `pb:<mid>`), então uma entrega repetida do webhook nunca gera DM em duplicidade.

---

## Limites da Meta (e como o app lida com eles)

| Regra da Meta | Como o app trata |
|---|---|
| Uma resposta privada por comentário, para sempre | `comment_id` é `UNIQUE` |
| Resposta privada só até 7 dias depois do comentário | Eventos carregam `expires_at`; depois disso viram `dead` |
| DMs comuns só dentro de 24 h da última interação | O contato guarda `messaging_window_expires_at` e o envio é bloqueado fora dela |
| Conta precisa ser Profissional (Criador/Empresa) | Validado no próprio login do Instagram |
| ~2 chamadas de mensagem por segundo por conta | O cron de reprocessamento anda em ritmo de ~550 ms |
| App em modo **Desenvolvimento** não recebe webhooks de contas reais | Coloque o app em modo **Live** (Passo 4h) |
| Só contas de teste usam o app sem App Review | Para abrir a outras pessoas é preciso **Acesso Avançado** (App Review) |

---

## Instalação passo a passo

Reserve cerca de **1 hora**. A maior parte é no painel da Meta, não no código. A ordem importa:
a Meta exige uma URL HTTPS pública antes de aceitar o webhook, então o app é publicado **antes** de
terminar a configuração da Meta.

**Você vai precisar de:** uma conta do Instagram que você controla, uma conta Meta/Facebook,
uma conta na [Vercel](https://vercel.com), Node 20+ e [pnpm](https://pnpm.io).

### Passo 1 — Converta o Instagram para conta Profissional
No app do Instagram: **Configurações → Tipo de conta e ferramentas → Mudar para conta
profissional** (Criador ou Empresa). Contas pessoais não funcionam com esta API. Se o login der
um erro vago de permissão, quase sempre é isso.

### Passo 2 — Clone e instale
```bash
git clone https://github.com/heliofilho2/manochat.git
cd manochat
pnpm install
```

### Passo 3 — Crie o banco (Neon)
Crie o banco **pela Vercel** (liga tudo automaticamente ao seu projeto):

1. Entre em [vercel.com](https://vercel.com) → **Storage → Create Database → Neon**.
2. Crie e copie a string de conexão **pooled**:
   `postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require`

### Passo 4 — Crie o app na Meta
Tudo em [developers.facebook.com](https://developers.facebook.com), com a conta Facebook que será dona do app.

**4a. Criar o app.** *My Apps → Create App.* Na escolha de casos de uso, aba **All**, selecione
**Manage messaging and content on Instagram**.

**4b. Login do Instagram.** Em *Use cases → Customize* nesse caso de uso, abra **API setup with
Instagram login**. É este fluxo que o app usa, **não** o "com login do Facebook". Escolher o errado
gera tokens que o app não consegue usar.

**4c. ID e segredo.** Na mesma tela, em *Generate access tokens* / *Business login settings*:
- **Instagram app ID** → `INSTAGRAM_APP_ID`
- **Instagram app secret** (clique em *Show*) → `INSTAGRAM_APP_SECRET`

São os do **app do Instagram**, não os de *App settings → Basic*.

**4d. Permissões.** O login pede estas quatro:
- `instagram_business_basic`: perfil e mídia
- `instagram_business_manage_comments`: ler e responder comentários
- `instagram_business_manage_messages`: enviar DMs
- `instagram_business_manage_insights`: alcance e visualizações do painel

Com a sua própria conta de teste elas são concedidas na tela de consentimento, sem revisão.

**4e. Adicione-se como testador.** *App roles → Roles → Add people → Instagram Tester*, coloque o
seu @ e aceite o convite no Instagram em **Configurações → Apps e sites → Convites de testador**.

**4f. URLs de privacidade e exclusão.** A Meta pede *Privacy Policy URL* e *Data Deletion URL*.
O app já serve as duas páginas prontas: `/privacidade` e `/exclusao-de-dados`. Defina
`NEXT_PUBLIC_PRIVACY_EMAIL` com o seu e-mail para que apareçam corretamente.
Se a página *App settings → Basic* não carregar (bug conhecido da Meta), informe as URLs pelo fluxo
de **App Review** (*Requests → Request advanced access*).

**4g. Redirect URI e webhook** vêm depois, no Passo 8, porque dependem da URL publicada.

**4h. Modo Live.** Quando tudo estiver configurado (Passo 8), **publique o app (modo Live)**. Em
modo Desenvolvimento a Meta só entrega o webhook de teste do painel, não os eventos reais.

### Passo 5 — Variáveis de ambiente
```bash
cp .env.example .env.local
```
Preencha (veja a [tabela](#variáveis-de-ambiente)). Gere os três segredos com:
```bash
openssl rand -hex 32   # rode 3 vezes: TOKEN_ENC_KEY, SESSION_SECRET, CRON_SECRET
```
`APP_URL` nunca pode terminar com `/`: a Meta compara o redirect URI caractere a caractere.

### Passo 6 — Migrations
> `drizzle-kit` lê o `.env`, **não** o `.env.local`. Sem a cópia abaixo, o comando falha com
> `url: undefined`.

```bash
cp .env.local .env
pnpm db:migrate
```
Isso cria todas as tabelas (contas, automações, contatos, eventos, leads, bio, etc.).

### Passo 7 — Publique na Vercel
```bash
pnpm dlx vercel deploy --prod
```
Na primeira vez é interativo (login e vínculo do projeto). Depois, em **Settings → Environment
Variables**, cadastre **todas** as variáveis do `.env.local`, trocando `APP_URL` pela URL pública
(`https://seu-app.vercel.app`, sem barra final). Faça um novo deploy para valer.

Confirme que **Settings → Deployment Protection** está **desligada** em produção. Se estiver
ligada, a Vercel responde 401 para a Meta e para os crons, e tudo falha em silêncio.

### Passo 8 — Aponte a Meta para o seu app
**8a. Redirect URI.** *Instagram → API setup with Instagram login → Business login settings*:
`https://seu-app.vercel.app/api/auth/instagram/callback`
(igual ao `APP_URL`: mesmo esquema, domínio, sem barra final, sem `www` trocado).

**8b. Webhook.** Na mesma página (ou *Instagram → Webhooks*):
- **Callback URL:** `https://seu-app.vercel.app/api/webhooks/instagram`
- **Verify token:** o mesmo `WEBHOOK_VERIFY_TOKEN` do `.env`
- Clique em **Verify and save** e assine os campos **`comments`**, **`messages`** e
  **`messaging_postbacks`** (este último é o do botão "Já sigo").

O app chama `/me/subscribed_apps` no login, então a assinatura por conta é automática.

### Passo 9 — Crons (agendamentos)
O app precisa de três rotinas, todas chamadas com `Authorization: Bearer <CRON_SECRET>`:

| Quando | Rota | Para quê |
|---|---|---|
| a cada 2–5 min | `/api/cron/process-events` | Reprocessa envios que falharam dentro da janela de 7 dias |
| a cada 15 min | `/api/cron/sync-inbox` | Atualiza conversas e a lista de posts/stories |
| 1× por dia | `/api/cron/refresh-token` | Renova o token de 60 dias. **Se parar, tudo para em silêncio** |

**Como agendar (escolha uma):**
- **[cron-job.org](https://cron-job.org)** (grátis): crie um job para cada rota, método GET, com o
  cabeçalho `Authorization: Bearer <CRON_SECRET>`. É o mais confiável para intervalos curtos.
- **GitHub Actions** (já incluso em `.github/workflows/cron.yml`): crie os *secrets* `APP_URL` e
  `CRON_SECRET` no seu repositório. Execuções agendadas do GitHub podem atrasar vários minutos.
- **Vercel Pro:** basta adicionar as rotas em `vercel.json`. Na Hobby só o diário é permitido; por
  isso `refresh-token` já vem em `vercel.json`.

#### Alertas de falha
A cada execução do `process-events`, o app confere a saúde da instalação e avisa se houver:
- eventos que falharam de vez por motivo real (não conta conversa apagada nem janela de 7 dias vencida);
- eventos parados há mais de 30 minutos (sinal de que o cron parou);
- token do Instagram vencendo em até 7 dias (ou já vencido).

Defina `ALERT_WEBHOOK_URL` (Discord, Slack ou ntfy.sh) para receber a mensagem; cada problema avisa no
máximo a cada 3 h (erros) ou 24 h (avisos). Sem a variável, o aviso aparece só no **Painel**.
Ative também a notificação de falha do próprio cron-job.org, que cobre o caso de o cron inteiro parar.

### Passo 10 — Use
1. Abra `https://seu-app.vercel.app` e clique em **Entrar com Instagram**.
2. **Automações → Nova automação**: palavra-chave, posts, mensagens e link.
3. Ative e comente a palavra de **outra conta** (comentários da própria conta são ignorados de propósito).

---

## Usando

- **Primeiros passos** no menu guia a criação da primeira automação.
- **Automação de comentário:** defina palavras, posts, resposta pública, DM, botão e se exige seguir.
- **Automação de story:** escolha "qualquer story" ou um específico, o texto, e se quer pedir
  e-mail/WhatsApp. Precisa do campo `messages` do webhook ativo.
- **Link na bio:** em *Minha página de bio*, monte seus links e o visual. O endereço é
  `https://seu-app.vercel.app/u/<seu-usuario>`.
- **Reenviar link:** na lista de automações de comentário, o botão confere quem tocou no botão nas
  últimas 24 h e não recebeu, e envia para quem já segue (até 25 pessoas por clique).

---

## Variáveis de ambiente

| Variável | Obrigatória | Origem |
|---|---|---|
| `INSTAGRAM_APP_ID` | sim | Passo 4c |
| `INSTAGRAM_APP_SECRET` | sim | Passo 4c |
| `WEBHOOK_VERIFY_TOKEN` | sim | Texto qualquer; o mesmo valor vai na Meta (Passo 8b) |
| `TOKEN_ENC_KEY` | sim | `openssl rand -hex 32` (64 caracteres hex, chave AES-256 do token) |
| `SESSION_SECRET` | sim | `openssl rand -hex 32` |
| `CRON_SECRET` | sim | `openssl rand -hex 32` |
| `DATABASE_URL` | sim | Passo 3 (string *pooled* do Neon) |
| `APP_URL` | sim | `http://localhost:3000` localmente; sua URL pública em produção, sem `/` final |
| `NEXT_PUBLIC_PRIVACY_EMAIL` | não | E-mail exibido nas páginas de privacidade e exclusão de dados |
| `BIO_DOMAIN` + `BIO_USERNAME` | não | Domínio só da bio (ex.: `links.seusite.com`) que abre `/u/<usuario>` na raiz e redireciona o resto para `/`. Adicione o domínio ao projeto na Vercel e crie o CNAME no DNS |
| `ALERT_WEBHOOK_URL` | não | Webhook do Discord/Slack ou tópico do [ntfy.sh](https://ntfy.sh) que recebe [alertas de falha](#alertas-de-falha) |
| `LEADS_WEBHOOK_SECRET` | não | Se definido, é enviado como `Authorization: Bearer` ao seu webhook de leads |

---

## Webhook de leads

Em **Leads → Enviar para o meu site** você informa uma URL. A cada lead novo (e a cada atualização,
por exemplo quando chega o WhatsApp) o app faz um `POST` JSON, com timeout de 8 s. Falhas nunca
interrompem o fluxo da DM.

```json
{
  "event": "lead.created",
  "account": "seu.perfil",
  "lead": {
    "id": "…",
    "instagram": "usuario",
    "instagramId": "…",
    "source": "story",
    "trigger": "guia",
    "email": "a@b.com",
    "phone": "31999990000",
    "complete": true,
    "createdAt": "…",
    "updatedAt": "…"
  }
}
```
`event` é `lead.created` ou `lead.updated`. Com `LEADS_WEBHOOK_SECRET` definido, a requisição leva
`Authorization: Bearer <valor>` para você validar no seu servidor.

---

## Solução de problemas

| Sintoma | Causa provável |
|---|---|
| O login volta com erro | Redirect URI diferente do `APP_URL`, ou `APP_URL` com barra final (Passo 8a) |
| "Invalid platform app" no login | Foi configurado o login do Facebook em vez do login do Instagram (Passo 4b) |
| "Verify and save" do webhook falha | App não publicado, caminho errado (o correto é `/api/webhooks/instagram`), token diferente ou **Deployment Protection** ligada |
| Só o teste do painel chega, nenhum evento real | App em modo Desenvolvimento: publique em modo **Live** (Passo 4h) |
| Login ok, mas nada dispara | Campos do webhook não assinados (`comments`, `messages`, `messaging_postbacks`) ou a automação está em rascunho/pausada |
| A resposta pública sai, mas a DM não chega | Janela de 7 dias expirada, comentário já teve resposta privada, ou a pessoa apagou/arquivou a conversa |
| O botão "Já sigo" não libera o link | A Meta pode demorar a registrar o novo seguidor (o app confere duas vezes, com 4 s de intervalo). Use **Reenviar link** |
| Resposta ao story não dispara | A automação está em "um story específico" e a resposta veio de outro story ou de um anúncio. Use "qualquer story" |
| Tudo parou depois de ~2 meses | O cron `refresh-token` parou e o token de 60 dias venceu |
| `Missing environment variable X` | Falta cadastrar a variável na Vercel (o `.env.local` não é enviado) |
| `pnpm db:migrate` diz `url: undefined` | Só existe `.env.local`; o drizzle-kit lê `.env` (Passo 6) |
| Webhook ou cron responde 401 da Vercel | **Deployment Protection** ligada em produção |
| A página *Basic settings* da Meta não abre | Bug conhecido: informe as URLs pelo App Review (Passo 4f) |

---

## Arquitetura

**Stack:** Next.js (App Router) + React + Tailwind CSS v4 · TypeScript · Drizzle ORM + Neon
(Postgres) · zod · jose (sessão) · Vitest.

```
app/
  (dash)/…          Telas logadas: painel, automações, entrada, leads, bio, primeiros passos
  api/webhooks/     Recebe os eventos da Meta (rota crítica)
  api/cron/         process-events, sync-inbox, refresh-token
  api/auth/         Login do Instagram (OAuth) e logout
  u/[username]/     Página pública do link na bio
  r/[id]/           Redirecionamento com contagem de cliques
  como-funciona/    Página pública de apresentação
lib/
  automation/       Regras puras (matcher, flow, story, draft, missed) e o processor
  instagram/        Cliente da Graph API, OAuth, tipos
  bio/              Temas, estilo e dados da página de bio
  insights/         Métricas e rankings
db/schema.ts        Esquema do banco (Drizzle) · db/migrations/ migrations
```

Regras de negócio ficam em módulos **puros** e testados (`matcher`, `flow`, `story`, `draft`,
`missed`, `bio/style`, `inbox`…), separados dos efeitos (`processor`, `client`).

---

## Comandos

```bash
pnpm dev           # servidor de desenvolvimento
pnpm build         # build de produção
pnpm lint          # ESLint
pnpm typecheck     # tsc --noEmit
pnpm test          # testes unitários (Vitest)
pnpm db:generate   # gera migration após editar db/schema.ts
pnpm db:migrate    # aplica as migrations
pnpm db:studio     # navegador do banco
```

**Desenvolvimento local:** webhooks não chegam ao `localhost`. Use um deploy de preview da Vercel ou
um túnel (`pnpm dlx ngrok http 3000`, ajustando `APP_URL` e as URLs na Meta). A interface, o banco e
a lógica de matching funcionam localmente sem túnel.

---

## Custos

Com poucas contas, **praticamente zero**: a API do Instagram é gratuita e Vercel e Neon têm planos
grátis. Ao crescer ou ao usar comercialmente, considere:

- **Vercel Pro** (cerca de US$ 20/mês). O plano Hobby é para uso **pessoal e não comercial**.
- **Neon** pago (na faixa de US$ 19/mês) quando o plano grátis não bastar.
- Domínio próprio (algumas dezenas de reais por ano).
- Seu tempo: a API da Meta muda com frequência.

---

## Segurança e privacidade

- **Sem senha:** o acesso é pelo Login oficial do Instagram, com escopos explícitos, revogável em
  *Configurações → Apps e sites*.
- **Token do Instagram criptografado** no banco (AES-256, `TOKEN_ENC_KEY`).
- **Assinatura do webhook** (`X-Hub-Signature-256`) validada antes de processar.
- **Crons protegidos** por `Authorization: Bearer <CRON_SECRET>`.
- **Links seguros:** só URLs `http(s)` são aceitas nos links da bio e redirecionamentos.
- **LGPD:** páginas `/privacidade` e `/exclusao-de-dados` incluídas; o pedido de exclusão remove os
  dados da conta. Ajuste os textos e o e-mail de contato para o seu caso antes de operar para terceiros.
- Se você for disponibilizar o app a outras pessoas, leia o [guia de App Review](docs/app-review.md).

Encontrou uma falha de segurança? Abra uma *issue* privada ou fale diretamente com o mantenedor em vez
de publicar os detalhes.

---

## Contribuindo e suporte

Contribuições são bem-vindas: abra uma *issue* descrevendo o problema ou a ideia, ou um *pull
request* pequeno e focado. Antes de enviar, rode `pnpm lint`, `pnpm typecheck` e `pnpm test`.
Veja também o [CONTRIBUTING.md](CONTRIBUTING.md).

**Quer usar mas não quer configurar sozinho?** O mantenedor oferece ajuda com a instalação e a
configuração. Pedidos de acesso em [instagram.com/heliofilhou](https://instagram.com/heliofilhou).

---

## Licença

[MIT](LICENSE) © 2026 Helio Filho. Use, modifique e distribua à vontade, mantendo o aviso de copyright.

O Oslinke **não é afiliado** à Meta, ao Instagram nem à Manychat. "Instagram" e "Meta" são marcas de
seus respectivos donos.

## Créditos

O projeto partiu da base do [less-chat/less-chat](https://github.com/less-chat/less-chat), criado por
**Nelson**, e evoluiu para um produto próprio: suporte a várias contas, fluxo de seguir antes de
liberar o link, automações de story, captura de leads, link na bio, insights por conta, novo
front-end e a página pública.
