# Cole isto no Claude Code (na raiz do repositório)

Leia `design_handoff_manochat/README.md` inteiro e abra os protótipos em `design_handoff_manochat/prototipo/` (sirva a pasta com `npx serve design_handoff_manochat/prototipo` e abra `Manochat.dc.html`).

Recrie o front-end completo do Manochat neste repositório, com alta fidelidade:
1. Examine a stack atual do repo e use-a. Se não houver front-end, crie um com Next.js (App Router) + TypeScript + Tailwind + lucide-react.
2. Configure primeiro os design tokens do README (cores, fonte Plus Jakarta Sans, raios, sombras, easing `cubic-bezier(.2,.7,.2,1)` e as animações fadeUp/stagger, respeitando `prefers-reduced-motion`).
3. Implemente o shell (sidebar no desktop ≥ 820px, topbar + tab bar no mobile, menu da conta, banner de token expirado, toast) e as rotas listadas.
4. Implemente as 9 telas na ordem do README, mantendo **toda a copy em pt-BR exatamente igual**, com os estados de carregamento, vazio e erro.
5. Use os dados mock de `prototipo/mc-data.js` atrás de uma camada de serviço (`lib/api`) fácil de trocar pela Instagram Graph API depois.
6. O editor de automação precisa da validação e da prévia ao vivo exatamente como descritas. A página `/u/[usuario]` deve ser leve e mobile-first.
7. Ao terminar cada tela, compare lado a lado com o protótipo e ajuste espaçamentos e cores.

Não copie `support.js` nem a sintaxe `<x-dc>`/`{{ }}` — os arquivos `.dc.html` são só referência visual e de comportamento.
