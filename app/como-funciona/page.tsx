import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { DemoBio, DemoConversation } from "./demo-client";
import { DemoLeads, DemoPainel } from "./demo-server";

export const metadata: Metadata = {
  title: "Como o Oslinke funciona",
  description:
    "Automação gratuita de Instagram: comentou a palavra ou respondeu o story, recebeu o link na DM. Veja em detalhes como vai funcionar.",
};

const CONTACT = "https://instagram.com/heliofilhou";

const wrap = "mx-auto w-full max-w-[1100px] px-[clamp(16px,4vw,40px)]";

/** Wraps a real platform screen (made-up data) with a caption. */
function Mock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <figure className="m-0 flex w-full max-w-[420px] flex-col gap-2">
      {children}
      <figcaption className="text-xs text-muted">{label}</figcaption>
    </figure>
  );
}

function Feature({
  tag,
  title,
  children,
  mock,
  flip = false,
}: {
  tag: string;
  title: string;
  children: React.ReactNode;
  mock: React.ReactNode;
  flip?: boolean;
}) {
  return (
    <section className="border-t border-line py-[clamp(40px,6vw,72px)]">
      <div
        className={`${wrap} grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-center gap-[clamp(28px,5vw,64px)]`}
      >
        <div className={`flex flex-col gap-4 ${flip ? "md:order-2" : ""}`}>
          <span className="self-start rounded-full bg-accent-soft px-3 py-1 text-[13px] font-semibold text-accent-ink-2">
            {tag}
          </span>
          <h2 className="m-0 text-[clamp(26px,3.6vw,38px)] leading-[1.1] font-bold tracking-[-0.025em]">{title}</h2>
          <div className="flex flex-col gap-3 text-base leading-[1.65] text-ink-2">{children}</div>
        </div>
        <div className={`flex justify-center ${flip ? "md:order-1" : ""}`}>{mock}</div>
      </div>
    </section>
  );
}

const FAQ: [string, string][] = [
  [
    "É gratuito mesmo?",
    "Sim. A ideia é que o Oslinke seja gratuito para o criador. Sem cobrança por DM enviada e sem plano escondido.",
  ],
  [
    "Já posso usar?",
    "Ainda não está aberto ao público. Está em fase de testes e libero o acesso aos poucos. Quem pedir acesso antecipado entra na frente da fila.",
  ],
  [
    "É seguro? Vocês pedem minha senha?",
    "Nunca. A conexão é feita pelo login oficial do Instagram (API oficial da Meta), você escolhe as permissões e pode revogar quando quiser nas configurações do Instagram. Não uso robôs, nem scraping, nem senha.",
  ],
  [
    "Preciso de que tipo de conta?",
    "Conta profissional do Instagram (Criador ou Empresa). Dá para trocar nas configurações do app em poucos toques, é grátis.",
  ],
  [
    "Como funciona a checagem de quem segue?",
    "Você pode exigir que a pessoa siga o perfil antes de receber o link. Ela toca em “Já sigo ✅”, o Oslinke confere com a Meta e, se ela ainda não seguir, recebe um lembrete gentil para tentar de novo.",
  ],
  [
    "Existe limite de mensagens?",
    "Sim, os limites são da própria Meta: a DM inicial é a resposta a um comentário (até 7 dias depois) e as demais precisam acontecer em até 24 horas da última interação da pessoa. O Oslinke respeita essas regras para não arriscar sua conta.",
  ],
  [
    "Vou perder minhas conversas normais?",
    "Não. Suas conversas continuam no Instagram como sempre. O Oslinke só responde às palavras-chave que você configurar e ainda mostra uma caixa de entrada com o que foi enviado.",
  ],
  [
    "E os dados dos leads?",
    "Ficam na sua conta, dá para exportar em CSV a qualquer momento, e você pode pedir a exclusão dos seus dados quando quiser. Veja a Política de Privacidade.",
  ],
];

export default function ComoFunciona() {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className={`${wrap} flex items-center justify-between gap-4 py-5`}>
        <Logo />
        <a
          href={CONTACT}
          target="_blank"
          rel="noreferrer"
          className="flex h-10 items-center rounded-[11px] border border-ink px-4 text-sm font-semibold whitespace-nowrap"
        >
          Pedir acesso
        </a>
      </header>

      {/* Hero */}
      <section className={`${wrap} flex flex-col gap-6 pt-[clamp(24px,6vw,72px)] pb-[clamp(40px,6vw,72px)]`}>
        <span className="flex h-[30px] items-center gap-2 self-start rounded-full bg-accent-soft px-3 text-[13px] font-semibold text-accent-ink-2">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Gratuito · em fase de testes
        </span>
        <h1 className="m-0 max-w-[820px] text-[clamp(38px,6vw,64px)] leading-[1.05] font-bold tracking-[-0.025em]">
          Sua audiência comenta ou responde o story. O link chega na DM, sozinho.
        </h1>
        <p className="m-0 max-w-[640px] text-[clamp(17px,1.6vw,19px)] leading-[1.6] text-ink-2">
          O Oslinke é uma ferramenta gratuita para criadores e pequenos negócios que querem entregar links, materiais e
          ofertas pelo Instagram sem ficar respondendo um por um, e ainda saber quem se interessou.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={CONTACT}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-[52px] items-center rounded-[14px] bg-accent px-[22px] text-base font-semibold whitespace-nowrap hover:bg-accent-hover"
          >
            Quero acesso antecipado
          </a>
          <a href="#como" className="text-base font-semibold underline underline-offset-4">
            Ver como funciona ↓
          </a>
        </div>
        <span className="text-[13px] text-muted">
          Usa a conexão oficial da Meta · Nunca pedimos sua senha · Precisa de conta profissional do Instagram
        </span>
      </section>

      {/* Overview */}
      <section id="como" className="border-y border-line bg-white py-[clamp(40px,6vw,72px)]">
        <div className={`${wrap} flex flex-col gap-8`}>
          <h2 className="m-0 text-[clamp(28px,4vw,42px)] leading-[1.05] font-bold tracking-[-0.025em]">
            Em 3 passos
          </h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-[clamp(24px,3vw,40px)]">
            {[
              ["01", "Conecte seu Instagram", "Um toque, pelo login oficial. Você escolhe as permissões."],
              ["02", "Monte a automação", "Escolha a palavra (ou o story), escreva as mensagens e veja a conversa antes de ligar."],
              ["03", "Acompanhe", "Veja o que foi enviado, quem virou lead e quantos cliques o link teve."],
            ].map(([n, t, d], i) => (
              <div
                key={n}
                className="flex flex-col gap-3 border-t-2 pt-5"
                style={{ borderTopColor: i === 2 ? "var(--color-accent)" : "var(--color-ink)" }}
              >
                <span className="text-sm font-semibold text-accent-ink">{n}</span>
                <h3 className="m-0 text-[22px] leading-[1.15] font-bold tracking-[-0.02em]">{t}</h3>
                <p className="m-0 text-base leading-[1.55] text-ink-2">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Feature
        tag="Comentários"
        title="Comentou a palavra, recebeu o link"
        mock={
          <Mock label="Exemplo real da pré-visualização da conversa">
            <DemoConversation kind="comment" />
          </Mock>
        }
      >
        <p className="m-0">
          Você escolhe uma ou mais palavras-chave, os posts onde valem (um Reel específico, todos ou só os próximos) e
          o que enviar. Quem comentar recebe uma resposta pública curta e a mensagem com o link na DM.
        </p>
        <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5">
          <li>Palavra exata ou “contém”, com várias palavras por automação.</li>
          <li>Variações da resposta pública, para não parecer robótico.</li>
          <li>Botão de link, texto livre e prévia da conversa antes de ativar.</li>
        </ul>
      </Feature>

      <Feature
        flip
        tag="Seguir antes"
        title="Peça para seguir e confira de verdade"
        mock={
          <Mock label="Exemplo real: teste alternando “Já segue?” Sim/Não">
            <DemoConversation kind="follow" />
          </Mock>
        }
      >
        <p className="m-0">
          Se você quiser, o link só é liberado para quem segue o perfil. Ao tocar em “Já sigo ✅”, o Oslinke pergunta
          à Meta se a pessoa segue de fato. Não é só confiar no clique.
        </p>
        <p className="m-0">
          Quem ainda não segue recebe um lembrete e pode tentar de novo. Como a Meta às vezes demora alguns segundos
          para refletir um follow novo, o Oslinke confere uma segunda vez antes de negar.
        </p>
      </Feature>

      <Feature
        tag="Stories"
        title="Respondeu o story? Vira lead"
        mock={
          <Mock label="Exemplo real: resposta a story + captura de contato">
            <DemoConversation kind="story" />
          </Mock>
        }
      >
        <p className="m-0">
          Quem responde ao seu story com a palavra combinada (ou com qualquer resposta) recebe o link e, se você quiser,
          antes disso informa e-mail e WhatsApp. Ótimo para captar interessados e para tráfego pago no story.
        </p>
        <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5">
          <li>Vale para qualquer story ou para um story específico.</li>
          <li>Reage com um coração à resposta, se ativado.</li>
          <li>Mensagens de pedido de e-mail/WhatsApp e de agradecimento editáveis.</li>
        </ul>
        <p className="m-0 text-sm text-muted">
          Essa parte está em testes: pode ter ajustes antes da abertura.
        </p>
      </Feature>

      <Feature
        flip
        tag="Leads"
        title="Uma lista de quem se interessou"
        mock={
          <Mock label="Tela de Leads (dados fictícios)">
            <DemoLeads />
          </Mock>
        }
      >
        <p className="m-0">
          Tudo que for coletado vai para a página de Leads: usuário, e-mail, WhatsApp, de onde veio e quando.
        </p>
        <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5">
          <li>Exportação em CSV, pronta para abrir no Excel ou Google Sheets.</li>
          <li>Webhook opcional: cada lead novo pode ser enviado direto para o seu site ou CRM.</li>
          <li>Contatos com etiquetas, como “seguidor”, para segmentar depois.</li>
        </ul>
      </Feature>

      <Feature
        tag="Link na bio"
        title="Uma página de links bonita, do seu jeito"
        mock={
          <Mock label="Página de links (dados fictícios)">
            <DemoBio />
          </Mock>
        }
      >
        <p className="m-0">
          Cada conta ganha uma página pública (no endereço /u/seu-usuario) com os seus links e, se quiser, as automações ativas
          e os últimos posts. E dá para personalizar bastante.
        </p>
        <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5">
          <li>10 temas prontos, 4 estilos de cabeçalho, fundos em cor, degradê, padrão ou imagem.</li>
          <li>5 estilos de botão, 6 fontes, cores próprias e uma moldura em forma de painel.</li>
          <li>Redes sociais, títulos de seção e contagem de cliques em cada link.</li>
          <li>Feita para abrir rápido e bem no celular.</li>
        </ul>
      </Feature>

      <Feature
        flip
        tag="Painel"
        title="Veja o que está funcionando"
        mock={
          <Mock label="Painel (números fictícios)">
            <DemoPainel />
          </Mock>
        }
      >
        <p className="m-0">
          Uma caixa de entrada com tudo que foi enviado e recebido, números por automação e o desempenho dos posts
          direto da API oficial do Instagram.
        </p>
      </Feature>

      {/* Safety */}
      <section className="border-y border-line bg-white py-[clamp(40px,6vw,72px)]">
        <div className={`${wrap} flex flex-col gap-6`}>
          <h2 className="m-0 text-[clamp(26px,3.6vw,38px)] leading-[1.1] font-bold tracking-[-0.025em]">
            Feito para não arriscar sua conta
          </h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-5">
            {[
              ["API oficial", "Login e envio pelas ferramentas oficiais da Meta. Sem senha, sem robô, sem “gambiarra”."],
              ["Regras da Meta respeitadas", "Uma resposta por comentário, janela de 24h e nada de spam para quem não interagiu."],
              ["Você no controle", "Pause ou apague qualquer automação, revogue o acesso no Instagram e peça a exclusão dos dados."],
              ["Sem cobrança", "Sem cartão, sem plano por volume e sem taxa por mensagem."],
            ].map(([t, d]) => (
              <div key={t} className="flex flex-col gap-2 rounded-[18px] border border-line bg-bg p-5">
                <h3 className="m-0 text-lg font-bold">{t}</h3>
                <p className="m-0 text-[15px] leading-[1.55] text-ink-2">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className={`${wrap} flex flex-col gap-6 py-[clamp(40px,6vw,72px)]`}>
        <h2 className="m-0 text-[clamp(26px,3.6vw,38px)] leading-[1.1] font-bold tracking-[-0.025em]">
          Perguntas frequentes
        </h2>
        <div className="flex max-w-[820px] flex-col gap-2.5">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group rounded-[16px] border border-line bg-white">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 text-base font-semibold [&::-webkit-details-marker]:hidden">
                <span className="flex-1">{q}</span>
                <span className="text-muted transition-transform group-open:rotate-90">›</span>
              </summary>
              <p className="m-0 border-t border-line-soft px-5 pt-4 pb-5 text-[15px] leading-[1.65] text-ink-2">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-ink text-white">
        <div className={`${wrap} flex flex-col items-start gap-5 py-[clamp(40px,6vw,72px)]`}>
          <h2 className="m-0 max-w-[640px] text-[clamp(28px,4vw,42px)] leading-[1.08] font-bold tracking-[-0.025em]">
            Quer testar antes de abrir para todo mundo?
          </h2>
          <p className="m-0 max-w-[560px] text-base leading-[1.6] text-white/75">
            Me chame no Instagram e diga que tipo de conteúdo você faz. Vou liberando o acesso aos poucos, começando por
            quem responder o story.
          </p>
          <a
            href={CONTACT}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-[52px] items-center rounded-[14px] bg-accent px-[22px] text-base font-semibold whitespace-nowrap text-ink hover:bg-accent-hover"
          >
            Falar no Instagram
          </a>
        </div>
      </section>

      <footer className={`${wrap} flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-7 text-sm text-muted`}>
        <span>© 2026 Oslinke · Telas com dados fictícios</span>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/privacidade" className="text-ink-2 underline underline-offset-[3px] hover:text-ink">
            Política de Privacidade
          </Link>
          <Link href="/exclusao-de-dados" className="text-ink-2 underline underline-offset-[3px] hover:text-ink">
            Exclusão de dados
          </Link>
        </div>
      </footer>
    </div>
  );
}
