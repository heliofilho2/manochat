import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { Logo } from "@/components/logo";
import { LoginButton } from "@/components/login-button";

export const dynamic = "force-dynamic";

export default async function Landing({ searchParams }: PageProps<"/">) {
  if (await getSession()) redirect("/painel");
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen flex-col bg-bg text-ink">
      <header className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-4 px-[clamp(16px,4vw,40px)] py-5">
        <Logo />
        <a
          href="/api/auth/instagram"
          className="flex h-10 items-center rounded-[11px] border border-ink bg-transparent px-4 text-sm font-semibold whitespace-nowrap"
        >
          Entrar
        </a>
      </header>

      <section className="mx-auto grid w-full max-w-[1200px] grid-cols-[repeat(auto-fit,minmax(min(100%,440px),1fr))] items-center gap-[clamp(40px,6vw,72px)] px-[clamp(16px,4vw,40px)] pt-[clamp(24px,6vw,72px)] pb-[clamp(40px,6vw,80px)]">
        <div className="flex flex-col gap-6">
          <span className="animate-up flex h-[30px] items-center gap-2 self-start rounded-full bg-accent-soft px-3 text-[13px] font-semibold text-accent-ink-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Automação de Instagram sem programar
          </span>
          <h1 className="animate-up m-0 text-[clamp(40px,6.4vw,68px)] leading-[1.05] font-bold tracking-[-0.025em] [animation-delay:.06s]">
            Comentou a palavra, recebeu o link na DM.
          </h1>
          <p className="animate-up m-0 max-w-[520px] text-[clamp(17px,1.6vw,19px)] leading-[1.55] text-ink-2 [animation-delay:.12s]">
            O Oslinke responde os comentários dos seus posts e manda seu link por mensagem direta — sozinho, a
            qualquer hora. Você configura em 5 minutos, sem código e sem planilha.
          </p>
          <div className="animate-up flex flex-col items-start gap-3 [animation-delay:.18s]">
            <LoginButton hasError={Boolean(error)} />
            <span className="text-[13px] text-muted">
              Grátis para começar · Usa a conexão oficial da Meta · Precisa de conta Profissional
            </span>
          </div>
          {error ? (
            <div
              role="alert"
              className="animate-up-fast flex max-w-[520px] gap-3 rounded-[14px] bg-danger-bg px-4 py-3.5 text-danger-ink"
            >
              <span className="mt-px shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4" />
                  <path d="M12 16h.01" />
                </svg>
              </span>
              <div className="flex flex-col gap-1 text-sm leading-normal">
                <strong className="font-semibold">O Instagram não autorizou a conexão.</strong>
                <span>
                  Confira se sua conta é Profissional (Criador ou Empresa) e se você marcou todas as
                  permissões. Depois é só tentar de novo.
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="relative flex justify-center">
          <div className="animate-up flex w-full max-w-[420px] flex-col gap-3.5 [animation-delay:.25s] [animation-duration:.8s]">
            <div className="animate-float flex flex-col gap-3.5">
              <div className="flex -rotate-[1.5deg] flex-col gap-3.5 rounded-[22px] border border-line bg-white p-[18px] shadow-[0_20px_50px_rgba(27,23,18,.06)]">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[#D8D0C0] text-[13px] font-bold">
                    JM
                  </span>
                  <div className="flex flex-1 flex-col gap-0.5">
                    <span className="text-sm font-semibold">
                      julia.m <span className="font-normal text-muted">comentou</span>
                    </span>
                    <span className="text-base font-medium">RECEITA 🙏</span>
                  </div>
                  <span className="text-[11px] font-medium text-muted">agora</span>
                </div>
                <div className="ml-4 flex items-center gap-2.5 border-l-2 border-line-soft pl-[22px]">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E9C9B4] text-[11px] font-bold">
                    AR
                  </span>
                  <span className="text-sm">
                    <strong className="font-semibold">ana.cozinha</strong> Te mandei na DM! 💌
                  </span>
                </div>
              </div>
              <div className="ml-[clamp(0px,4vw,32px)] flex rotate-1 flex-col gap-2.5 rounded-[22px] border border-line bg-white p-[18px] shadow-float">
                <span className="text-xs tracking-[0.04em] text-muted">MENSAGEM DIRETA</span>
                <div className="max-w-[85%] self-start rounded-[18px_18px_18px_4px] bg-fill px-3.5 py-[11px] text-[15px] leading-[1.45]">
                  Oi, Julia! Toca aqui embaixo que eu te mando o guia 🍋
                </div>
                <div className="flex h-10 items-center self-start rounded-xl border border-line-strong bg-white px-[18px] text-sm font-semibold">
                  Quero o guia
                </div>
                <div className="max-w-[85%] self-end rounded-[18px_18px_4px_18px] bg-accent px-3.5 py-[11px] text-[15px] leading-[1.45] font-medium">
                  Quero o guia
                </div>
                <div className="max-w-[85%] self-start rounded-[18px_18px_18px_4px] bg-fill px-3.5 py-[11px] text-[15px] leading-[1.45]">
                  Aqui está: <span className="text-accent-ink underline">anaribeiro.com.br/guia</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-white">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-10 px-[clamp(16px,4vw,40px)] py-[clamp(48px,7vw,88px)]">
          <h2 className="m-0 max-w-[640px] text-[clamp(30px,4vw,44px)] leading-[1.05] font-bold tracking-[-0.025em]">
            Como funciona, em 3 passos
          </h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-[clamp(24px,3vw,40px)]">
            {[
              ["01", "Conecte seu Instagram", "Um clique no botão acima. Você autoriza pelo próprio Instagram — a gente nunca vê sua senha.", false],
              ["02", "Escolha a palavra e o post", "Ex.: quem comentar RECEITA no seu Reel recebe o link. Você escreve as mensagens e vê a conversa antes de ativar.", false],
              ["03", "Pronto, é com a gente", "O Oslinke responde o comentário, manda a DM e entrega o link. Você acompanha tudo pelo painel.", true],
            ].map(([n, t, d, last]) => (
              <div
                key={n as string}
                className="flex flex-col gap-3 border-t-2 pt-5 transition-transform duration-[350ms] ease-brand hover:-translate-y-0.5"
                style={{ borderTopColor: last ? "var(--color-accent)" : "var(--color-ink)" }}
              >
                <span className="text-sm font-semibold text-accent-ink">{n}</span>
                <h3 className="m-0 text-[23px] leading-[1.15] font-bold tracking-[-0.02em]">{t}</h3>
                <p className="m-0 text-base leading-[1.55] text-ink-2">{d}</p>
              </div>
            ))}
          </div>
          <div>
            <a
              href="/api/auth/instagram"
              className="inline-flex h-[52px] items-center rounded-[14px] bg-accent px-[22px] text-base font-semibold whitespace-nowrap hover:bg-accent-hover"
            >
              Começar agora — é grátis
            </a>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-[clamp(16px,4vw,40px)] py-7 text-sm text-muted">
        <span>© 2026 Oslinke</span>
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
