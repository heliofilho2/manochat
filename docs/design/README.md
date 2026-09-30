# Handoff: Manochat — front-end completo

## Visão geral
Manochat é um app web (pt-BR) para criadores de conteúdo e pequenos negócios automatizarem o Instagram: quando alguém comenta uma palavra-chave num post, o app responde publicamente e envia o link por DM. Público: pessoas que **não programam** e nunca usaram ferramenta de automação. Mobile-first, funcionando bem no desktop. Inclui estados vazios, de carregamento e de erro em todas as telas de dados.

## Sobre os arquivos de design
Os arquivos em `prototipo/` são **referências de design feitas em HTML** — protótipos que mostram aparência e comportamento pretendidos, **não código de produção para copiar**. A tarefa é **recriar essas telas no ambiente do repositório** (React/Next.js, Vue, etc.) usando os padrões e bibliotecas já estabelecidos nele. Se o repo ainda não tiver front-end, recomendação: **Next.js (App Router) + TypeScript + Tailwind CSS**, com os tokens abaixo no `tailwind.config`.

Para abrir o protótipo: sirva a pasta `prototipo/` com qualquer servidor estático (`npx serve prototipo`) e abra `Manochat.dc.html`. Cada `*.dc.html` também abre sozinho. `support.js` é só o runtime do protótipo — **não** faz parte do produto. Em cada arquivo, a marcação está dentro de `<x-dc>` (template com `{{ holes }}`, `<sc-if>`, `<sc-for>`, `<dc-import>` = componente filho) e a lógica em `<script data-dc-script>` (`class Component` estilo componente de classe React, `renderVals()` = valores do template). `mc-data.js` contém os dados mock.

## Fidelidade
**Alta fidelidade (hi-fi).** Cores, tipografia, espaçamentos, raios, textos (copy) e interações são finais. Recriar pixel a pixel com as bibliotecas do repo. Toda a copy em pt-BR deve ser mantida literalmente.

---

## Design tokens

### Cores
| Token | Hex | Uso |
|---|---|---|
| `bg` | `#F8F5F0` | Fundo do app (creme) |
| `surface` | `#FFFFFF` | Cards, inputs, item ativo da nav |
| `ink` | `#2B2724` | Texto principal, botão primário |
| `ink-2` | `#4F4841` | Texto secundário forte |
| `muted` | `#7C756C` | Texto de apoio, legendas |
| `muted-2` | `#9A938A` | Ícones inativos da tab bar |
| `line` | `#ECE6DD` | Bordas de cards |
| `line-soft` | `#F3EEE7` | Divisórias internas |
| `line-strong` | `#DDD5CA` | Bordas de inputs/botões secundários, switch desligado |
| `line-dashed` | `#C9C0B3` | Botões tracejados "+ Adicionar" |
| `fill` | `#F2EDE6` | Segmented controls, skeletons, chips neutros |
| `accent` | `#F08C6E` | Coral — CTA secundário, destaques, badge |
| `accent-hover` | `#F4A184` | Hover do accent |
| `accent-soft` | `#FDEEE7` | Fundo de chips/itens ativos, KPI destaque |
| `accent-line` | `#F6CDBE` | Borda de itens ativos (filtros, passos) |
| `accent-ink` | `#B25A3E` | Links, números de passo, texto sobre accent-soft |
| `accent-ink-2` | `#8E4128` | Texto em itens ativos |
| `success` | `#3F8F64` / bg `#E7F4EC` / texto forte `#2D5A40` | Ativa, enviado, switch ligado |
| `warning` | `#8A6420` / bg `#FBF2DC` / texto `#6F5222` | Pausada, pendente |
| `danger` | `#C0503F` / bg `#FCEDE9` / borda `#F4D5CD` / texto `#7A3326` | Erros, falhou, sair |

### Tipografia
- Família única: **Plus Jakarta Sans** (Google Fonts, pesos 400/500/600/700). Sem fonte mono; números usam `font-variant-numeric: tabular-nums`.
- H1 de página: 700, `clamp(30px, 4.5vw, 42px)`, line-height 1.02–1.2, letter-spacing −0.025em.
- H1 landing: 700, `clamp(40px, 6.4vw, 68px)`, lh 1.05.
- H2 de seção/card: 700, 20–24px, lh 1.15, ls −0.02em.
- Corpo: 400, 15–17px, lh 1.5–1.55. Labels: 500, 13–14px. Botões: 600, 13–17px.
- Eyebrows/rótulos técnicos (ex. "PRIMEIROS PASSOS · 2 DE 3", cabeçalhos de tabela): 500–600, 11–13px, letter-spacing 0.03–0.06em, caixa alta.
- Use `text-wrap: pretty` em parágrafos e `balance` em títulos grandes.

### Raios
8–9px (chips pequenos), 10–12px (botões/inputs), 14px (listas), 16–18px (cards), 20–22px (seções grandes), 26px (painel de prévia), 999px (pílulas, switches). **Motivo da marca:** balão de fala com um canto menos arredondado (ex. `border-radius: 9px 9px 9px 3px`) — usado no logo, ícones de estado vazio e bolhas de chat (`18px 18px 18px 4px` recebida / `18px 18px 4px 18px` enviada).

### Sombras
- Item ativo da nav: `0 1px 2px rgba(27,23,18,.06), 0 4px 14px rgba(27,23,18,.05)`
- Hover de card: `0 14px 30px rgba(27,23,18,.07)` + `translateY(-2px/-3px)`
- Cards flutuantes (landing, prévia): `0 20px 50px rgba(27,23,18,.07)`
- Popover/toast: `0 18px 50px rgba(27,23,18,.18)`
- Moldura de celular: `0 30px 60px rgba(27,23,18,.22)`

### Espaçamento
Base 4px. Gaps comuns: 6, 8, 10, 12, 14, 16, 20, 22, 24, 28, 32, 40. Padding de conteúdo: `clamp(20px,4vw,40px)` vertical × `clamp(16px,4vw,40px)` horizontal. Largura máx. do conteúdo: 1200px. Alvos de toque ≥ 44px.

### Movimento
- Easing padrão: `cubic-bezier(.2,.7,.2,1)`.
- Entrada de tela: `fadeUp` (opacity 0→1, translateY 10px→0) 0.6s.
- Listas: mesma animação com **stagger** de 45–60ms por item.
- Botões: transição de cor/borda/sombra 0.25s; `:active` scale(.98).
- Cards: hover sobe 2–3px em 0.35s.
- Barras do funil: `scaleX(0→1)` 1s; barras de ranking: transição de width 0.6s.
- Landing: cartão de conversa flutua (`translateY 0 → −8px`) em loop de 7s.
- Skeletons: pulse de opacidade 1.3s. Spinner: 0.8s linear.
- Respeitar `prefers-reduced-motion` (desligar loops e staggers).

### Ícones
Traço 1.8px, estilo Lucide (grid, zap, inbox, link, alerta, cadeado, balão). Usar `lucide-react` (LayoutGrid/LayoutDashboard, Zap, Inbox, Link, AlertTriangle, Lock, MessageCircle, Play, Copy).

---

## Navegação / shell
- **Desktop (≥ 820px):** sidebar fixa de 248px à esquerda (fundo `bg`, borda direita `line`): logo; nav com **Painel, Automações, Caixa de entrada (badge coral com contagem), Minha página de bio**; cartão "Primeiros passos" com barra de progresso de 3 segmentos; botão da conta (avatar, nome, @) que abre um popover.
- **Mobile (< 820px):** topbar sticky de 60px (logo + avatar) e tab bar fixa inferior de 68px com 4 abas (ícone + label de 11px; ativa = texto `ink` e barra superior coral de 2px). Lembrar de `env(safe-area-inset-bottom)`.
- **Menu da conta (popover 272px):** nome, "@ana.cozinha · Conta de criador", status da conexão (ponto verde "Conectada" / vermelho "Conexão expirada"); Reconectar Instagram; Ver minha página pública; Primeiros passos; Política de Privacidade; Exclusão de dados; **Sair** (vermelho).
- **Banner de token expirado** (topo do conteúdo, fundo `danger-bg`): "Sua conexão com o Instagram expirou. As automações estão pausadas até você reconectar — leva uns 20 segundos." + botão "Reconectar agora". O avatar ganha um ponto vermelho.
- **Overlay de reconexão:** tela translúcida com blur, spinner e "Reconectando ao Instagram… / Na janela do Instagram, deixe todas as permissões marcadas." Ao terminar: toast "Instagram reconectado. Tudo funcionando!".
- **Toast:** pílula escura inferior central, some após 2.6s.

Rotas sugeridas: `/` (landing), `/primeiros-passos`, `/painel`, `/automacoes`, `/automacoes/nova`, `/automacoes/[id]`, `/entrada`, `/bio` (editor), `/u/[usuario]` (pública), `/privacidade`, `/exclusao-de-dados`.

---

## Telas

### 1. Landing / Login (`Landing.dc.html`)
- Header: logo + botão "Entrar" (contorno).
- Hero em grid `repeat(auto-fit, minmax(min(100%,440px),1fr))`:
  - Esquerda: pílula "Automação de Instagram sem programar"; H1 **"Comentou a palavra, recebeu o link na DM."**; parágrafo "O Manochat responde os comentários dos seus posts e manda seu link por mensagem direta — sozinho, a qualquer hora. Você configura em 5 minutos, sem código e sem planilha."; botão primário 58px **"Continuar com Instagram"** (ícone do Instagram); nota "Grátis para começar · Usa a conexão oficial da Meta · Precisa de conta Profissional". Entrada com stagger.
  - Direita: ilustração feita de UI (sem imagem): card de comentário (julia.m comentou "RECEITA 🙏" → resposta "ana.cozinha Te mandei na DM! 💌", rotação −1.5°) e card de DM (bolhas + botão "Quero o guia" + link, rotação +1°), flutuando.
- Estados do login: carregando (spinner + "Conectando ao Instagram…"), erro (alerta: "O Instagram não autorizou a conexão." + "Confira se sua conta é Profissional (Criador ou Empresa) e se você marcou todas as permissões. Depois é só tentar de novo." e o botão vira "Tentar de novo").
- "Como funciona, em 3 passos" (fundo branco): 01 Conecte seu Instagram / 02 Escolha a palavra e o post / 03 Pronto, é com a gente — cada um com borda superior de 2px (a última coral) e o CTA "Começar agora — é grátis".
- Rodapé: "© 2026 Manochat", links Política de Privacidade e Exclusão de dados.

### 2. Primeiros passos (`Onboarding.dc.html`)
- Eyebrow "PRIMEIROS PASSOS · N DE 3"; título "Bem-vinda, Ana! Falta só um passo." (ou "Tudo pronto por aqui." quando já tem automação); barra de 3 segmentos.
- Se o token expirou: card de alerta "Precisamos reconectar sua conta / Por segurança, o Instagram encerra a conexão a cada 60 dias. Enquanto isso, nenhuma automação responde." + "Reconectar Instagram".
- Checklist (cards com círculo ✓/!/3 e pílula de status):
  1. Conta do Instagram conectada — "@ana.cozinha · Conta de criador · 48,2 mil seguidores" (ou "Expirou").
  2. Recebimento de comentários ativo (webhook) — "Estamos recebendo os comentários dos seus posts em tempo real." (ou "Parado").
  3. Criar sua primeira automação — botões "Criar automação" e "Ir para o painel".
- Nota explicando o que é o "recebimento de comentários", em linguagem leiga.

### 3. Painel (`Dashboard.dc.html`)
- Cabeçalho + segmented 7 / 30 / 90 dias (escala os números).
- **KPIs** (grid auto-fit mín. 190px, cards de 128px): Contatos, Seguidores (+ ganho no período), Janelas de 24h abertas ("Pessoas com quem você pode conversar agora"), **DMs enviadas** (card destacado `accent-soft`; "N falharam · veja na caixa de entrada"), Cliques no link da bio.
- **O que mais converte (últimos 90 dias):** frase-resumo em destaque ("Sua melhor combinação: Reels de #receitafacil, às quintas, entre 19h e 21h."), abas Melhor horário / Dia da semana / Formato / Tema (1ª hashtag), tabela com colunas # · rótulo + barra · CONV. · % ALC. · POSTS (1º lugar em coral).
- **Funil:** Alcance → DMs enviadas (% do alcance) → Cliques no link da bio (% das DMs), barras horizontais.
- **Tags dos contatos:** pílulas `#tag` + contagem, tamanho da fonte proporcional (13–20px).
- Estados: skeleton (carregando), vazio ("Seus números aparecem aqui" + "Criar primeira automação"), **erro de permissão** (alerta "Falta a permissão de métricas" + "Reconectar e permitir"; KPIs dependentes mostram "—", o ranking e o funil mostram um aviso).

### 4. Automações (`Automations.dc.html`)
- Cabeçalho + "+ Nova automação". Filtros em pílula com contagem: Todas / Ativas / Pausadas / Rascunhos.
- Card por automação (clicável → editar): miniaturas empilhadas dos posts (ou um tile "∗ Todos" / "→ Novos posts"); nome + badge de status (Ativa verde, Pausada âmbar, Rascunho neutro); chips das palavras-chave; meta "Palavra exata · 2 posts"; nº de DMs enviadas; **switch ativar/pausar** (o clique não abre a edição; mostra toast). O rascunho mostra o botão "Continuar" no lugar do switch.
- Estados: skeleton; vazio ("Nenhuma automação ainda" + dica do QUERO); filtro vazio; erro com "Tentar de novo".

### 5. Criar/editar automação (`AutomationEditor.dc.html`) — coração do produto
- Cabeçalho: "← Automações", título, badge de status; ações **Salvar rascunho** / **Pausar** (se ativa) / **Ativar automação** (ou "Publicar alterações").
- Stepper em pílulas roláveis (6 passos): Nome · Palavras · Posts · Resposta pública · Mensagens · Link e regras. Um passo com erro mostra "!" vermelho.
- **Nome:** input "Nome interno" (máx. 60).
- **Palavras:** input de chips (Enter ou vírgula adiciona; Backspace remove; caixa alta automática; remove "#"; sem duplicatas). Modo em 2 cards de rádio com exemplos ✓/✗: *Palavra exata* e *Contém a palavra*.
- **Posts:** 3 cards de rádio (Posts específicos / Todos os posts / A partir de agora). Nos específicos, uma grade `auto-fill minmax(96px,1fr)` de miniaturas 4:5 com check coral e contador "N selecionados".
- **Resposta pública:** switch; até 5 variações (uma é sorteada por comentário), cada uma com barra de emojis; "+ Adicionar variação".
- **Mensagens:** 3 blocos (A) DM inicial + "Texto do botão" (máx. 20); (B) Para quem já segue (entrega o link); (C) Para quem não segue (pede para seguir e repete o botão; fica esmaecido se "Exigir que siga" estiver desligado). Cada bloco tem textarea (máx. 1000, contador), emojis 😊🙌💛🔥✨👇📩🎁 e o chip "+ {link}".
- **Link e regras:** URL (validar `https?://`), switch "Exigir que siga antes de liberar o link", switch "Mostrar o link como botão" + "Texto do botão de link".
- **Prévia ao vivo** (coluna sticky de 380px em telas ≥ 1180px; abaixo disso, o botão flutuante "Ver conversa" abre a prévia em tela cheia): trecho do post com o comentário (julia.m + palavra) → resposta pública (com "↻ sortear") → divisória DIRECT → DM inicial + botão → toque do usuário → (se exige seguir e "Já segue? Não": mensagem C + botão → nota "Depois que a pessoa seguir e tocar de novo" → toque) → mensagem B com `{link}` substituído + card do botão de link (rótulo + domínio).
- **Validação ao ativar** (o rascunho só exige o nome; usa "Automação sem nome" como padrão): nome; ≥ 1 palavra; ≥ 1 post se específicos; ≥ 1 variação se a resposta estiver ligada; DM inicial; texto do botão; a mensagem B precisa de `{link}` ou do botão de link ligado; a mensagem C se exige seguir; URL válida. Mostra um alerta com um chip clicável por erro (leva ao passo) e pula para o primeiro passo com erro.

### 6. Caixa de entrada (`Inbox.dc.html`)
- Abas: Comentários (contagem) / Conversas ("N novas").
- **Comentários:** filtros Todos / Enviados / Pendentes / Falharam. Linha: avatar de iniciais, @usuário, tempo · automação, texto do comentário, chip da palavra que bateu, pílulas "Resposta: enviada/pendente/falhou" e "DM: …". Um bloco de motivo aparece quando falhou/pendente (ex.: "A pessoa só aceita mensagens de contas que ela segue…", "O Instagram limitou os envios por alguns minutos…", "O comentário foi apagado antes da resposta pública…", "Sua conexão com o Instagram estava expirada nesse momento…") com "Tentar de novo" (→ pendente → enviado). O botão "→" abre a conversa.
- **Conversas:** lista (320px) + thread. O item mostra o último texto, o tempo, "Janela aberta · Nh restantes" / "Janela de 24h fechada" e um ponto de não lida. A thread tem cabeçalho com as tags e o tempo da janela, bolhas (enviadas escuras; meta "14:21 · automático · link clicado"), botões de DM e um composer (Enter envia). Com a janela fechada, o composer é substituído pelo aviso "A janela de 24h fechou. O Instagram só deixa você responder quando a pessoa mandar uma nova mensagem." No mobile, a lista ou a thread aparece com "←".
- Estados: skeleton, vazio, erro.

### 7. Página pública de bio `/u/usuario` (`BioPage.dc.html`)
- Coluna de no máx. 480px, centralizada, pensada para o navegador interno do Instagram. Avatar 96px (foto ou iniciais), @usuário, "48,2 mil seguidores" (opcional), texto da bio.
- **Botões automáticos** (um por automação ativa): "Comente **PALAVRA** no vídeo e receba na DM" + o nome da automação; tocar expande as instruções (miniatura do post, "1. Abra o post · 2. Comente PALAVRA · 3. Confira sua DM" e o botão "Abrir post no Instagram ↗").
- **Links manuais:** botão secundário com ↗.
- "ÚLTIMOS POSTS" em 4 layouts: Grade 3 (3 colunas, gap 3px), Grade 2 (2 colunas com legenda), Carrossel (scroll-snap horizontal, 62%), Lista (miniatura + legenda + tipo · data · curtidas).
- Rodapé discreto "feito com Manochat".
- Entrada com stagger dos botões.

### 8. Editor da página de bio (`BioEditor.dc.html`)
- Cabeçalho com "Alterações salvas automaticamente", URL `manochat.app/u/ana.cozinha` + "Copiar" (vira "Copiado ✓") + "Abrir ↗".
- Controles (esquerda) + **moldura de celular** sticky (direita, 340px, borda de 11px, raio 48px) com a BioPage ao vivo. No mobile: segmented "Editar / Pré-visualizar".
- Seções: **Tema** (6 temas: Papel, Noite, Laranja, Menta, Lilás, Mono — ver os valores em `BioPage.dc.html` → `THEMES`) + formato dos botões (Suave 16px / Pílula 999px / Reto 4px); **Foto e bio** (upload recortado em quadrado de 240px, "Usar foto do Instagram", textarea com máx. 150 e contador, switch de seguidores); **Botões e links** (ordenar com ▲▼, Ocultar/Mostrar, marcador "⚡ AUTOMÁTICO" vs "LINK MANUAL", editar texto e URL dos manuais, excluir, "+ Adicionar link"); **Posts** (switch + 4 layouts com mini-diagramas).

### 9. Páginas legais (`Legal.dc.html`)
- **Política de Privacidade** (LGPD) com 5 seções: O que coletamos, Para que usamos, Com quem compartilhamos, Por quanto tempo, Seus direitos (privacidade@manochat.app).
- **Exclusão de dados:** Pelo Instagram (Configurações → Apps e sites → Manochat → Remover), Por aqui (formulário com @ + e-mail; valida os dois; sucesso com o protocolo "MC-2026-0930-4821"), Por e-mail. A Meta exige uma URL pública de exclusão de dados — esta página atende a esse requisito.

---

## Estado e dados
- Entidades: `Profile {user, name, followers, initials, photo}`, `Post {id, type: Reel|Imagem|Carrossel, caption, thumbnailUrl, date, likes}`, `Automation` (campos em `mc-data.js`: name, keywords[], match: exact|contains, target: all|specific|future, postIds[], status: draft|active|paused, dms, publicReply, replies[], dmInitial, btnLabel, dmFollower, dmNonFollower, requireFollow, url, linkButton, linkLabel), `BioConfig {theme, shape, bio, photo, showFollowers, showPosts, postLayout, order[], hidden[], manual[{id,label,url}]}`, `Comment` (status da resposta e da DM + motivo), `Conversation` (mensagens, horas restantes da janela, tags).
- Itens da bio = automações **ativas** + links manuais, ordenados por `order` e filtrados por `hidden` (ver `MC.items()` em `mc-data.js`).
- Toda tela de dados precisa de loading / vazio / erro. No protótipo, o painel de Tweaks (`demoState`: normal/carregando/vazio/erro; `tokenExpired`) simula esses estados.
- API sugerida (a integrar): Instagram Graph API (login do Instagram com permissões de comentários, mensagens e insights), webhooks de `comments` e `messages`, e envio de DM via Private Replies + botões quick-reply / generic template.

## Assets
Não há imagens. As miniaturas de post são blocos de cor (`PostThumb.dc.html`) — substituir pelo `thumbnail_url`/`media_url` da API. Os ícones são SVGs simples em estilo Lucide.

## Arquivos (`prototipo/`)
- `Manochat.dc.html` — shell, rotas, nav, menu da conta, banner, toast, estado global
- `Landing.dc.html`, `Onboarding.dc.html`, `Dashboard.dc.html`, `Automations.dc.html`, `AutomationEditor.dc.html`, `Inbox.dc.html`, `BioPage.dc.html`, `BioEditor.dc.html`, `Legal.dc.html`
- `PostThumb.dc.html` — miniatura de post reutilizável
- `mc-data.js` — dados mock
- `support.js` — runtime do protótipo (não portar)
