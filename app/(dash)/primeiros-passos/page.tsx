import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { automation, db } from "@/db";
import { getAccountById } from "@/lib/account";
import { formatFollowers } from "@/lib/format";
import { getSession } from "@/lib/session";
import { nowMs } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Primeiros passos — Oslinke" };

type Mark = { bg: string; fg: string; mark: string; pillBg: string; pillFg: string };
const OK: Mark = {
  bg: "var(--color-ink)",
  fg: "#fff",
  mark: "✓",
  pillBg: "var(--color-success-bg)",
  pillFg: "var(--color-success)",
};
const BAD: Mark = {
  bg: "var(--color-danger-bg)",
  fg: "var(--color-danger)",
  mark: "!",
  pillBg: "var(--color-danger-bg)",
  pillFg: "var(--color-danger)",
};

function Step({
  mark,
  pill,
  title,
  text,
  delay,
}: {
  mark: Mark;
  pill: string;
  title: string;
  text: string;
  delay: string;
}) {
  return (
    <li
      className="animate-up flex gap-4 rounded-[18px] border border-line bg-white p-5"
      style={{ animationDelay: delay }}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
        style={{ background: mark.bg, color: mark.fg }}
      >
        {mark.mark}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <strong className="text-[17px] font-semibold">{title}</strong>
        <span className="text-sm leading-normal text-muted">{text}</span>
      </div>
      <span
        className="h-[26px] self-start rounded-full px-2.5 text-xs leading-[26px] font-semibold whitespace-nowrap"
        style={{ background: mark.pillBg, color: mark.pillFg }}
      >
        {pill}
      </span>
    </li>
  );
}

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/");
  const acct = await getAccountById(session.accountId);
  if (!acct) redirect("/");

  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(automation)
    .where(eq(automation.accountId, acct.id));

  const expired = acct.tokenExpiresAt.getTime() < nowMs();
  const has = n > 0;
  const webhookOk = acct.webhookSubscribed && !expired;
  const done = (expired ? 0 : 1) + (webhookOk ? 1 : 0) + (has ? 1 : 0);
  const bar = (on: boolean) => (on ? "var(--color-ink)" : "var(--color-line)");

  const followers = acct.followersCount !== null ? ` · ${formatFollowers(acct.followersCount)} seguidores` : "";
  const s1 = expired
    ? { mark: BAD, pill: "Expirou", text: `@${acct.username} · a conexão expirou e precisa ser renovada.` }
    : { mark: OK, pill: "Conectada", text: `@${acct.username} · Conta profissional${followers}` };
  const s2 = webhookOk
    ? { mark: OK, pill: "Ativo", text: "Estamos recebendo os comentários dos seus posts em tempo real." }
    : {
        mark: BAD,
        pill: "Parado",
        text: expired
          ? "Volta a funcionar assim que você reconectar a conta."
          : "Ainda não conseguimos ativar o recebimento. Reconecte a conta para tentar de novo.",
      };

  return (
    <div className="animate-up flex max-w-[820px] flex-col gap-7">
      <div className="flex flex-col gap-2.5">
        <span className="text-[13px] font-medium tracking-[0.04em] text-muted">
          PRIMEIROS PASSOS · {done} DE 3
        </span>
        <h1 className="m-0 text-[clamp(32px,5vw,48px)] leading-[1.02] font-bold tracking-[-0.025em]">
          {has ? "Tudo pronto por aqui." : "Boas-vindas! Falta só um passo."}
        </h1>
        <p className="m-0 max-w-[560px] text-[17px] leading-[1.55] text-ink-2">
          {has
            ? "Sua conta está conectada e suas automações estão rodando. Você pode criar outras quando quiser."
            : "Sua conta já está conectada. Agora crie a primeira automação — leva uns 5 minutos."}
        </p>
      </div>

      <div className="flex gap-1.5">
        <span className="h-1.5 flex-1 rounded-[9px] transition-[background] duration-[600ms]" style={{ background: bar(!expired) }} />
        <span className="h-1.5 flex-1 rounded-[9px] transition-[background] duration-[600ms]" style={{ background: bar(webhookOk) }} />
        <span className="h-1.5 flex-1 rounded-[9px] transition-[background] duration-[600ms]" style={{ background: bar(has) }} />
      </div>

      {expired ? (
        <div className="flex flex-wrap items-center gap-4 rounded-[18px] border border-danger-line bg-white px-5 py-[18px]">
          <div className="flex min-w-[220px] flex-1 flex-col gap-1">
            <strong className="text-lg font-bold">Precisamos reconectar sua conta</strong>
            <span className="text-sm leading-normal text-muted">
              Por segurança, o Instagram encerra a conexão a cada 60 dias. Enquanto isso, nenhuma automação
              responde.
            </span>
          </div>
          <a
            href="/api/auth/instagram"
            className="flex h-[46px] items-center rounded-xl bg-accent px-5 text-[15px] font-semibold whitespace-nowrap"
          >
            Reconectar Instagram
          </a>
        </div>
      ) : null}

      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        <Step mark={s1.mark} pill={s1.pill} title="Conta do Instagram conectada" text={s1.text} delay=".10s" />
        <Step mark={s2.mark} pill={s2.pill} title="Recebimento de comentários ativo" text={s2.text} delay=".18s" />
        <li
          className="animate-up flex gap-4 rounded-[18px] border bg-white p-5 [animation-delay:.26s]"
          style={{ borderColor: has ? "var(--color-line)" : "var(--color-ink)" }}
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
            style={has ? { background: "var(--color-ink)", color: "#fff" } : { background: "var(--color-accent)", color: "var(--color-ink)" }}
          >
            {has ? "✓" : "3"}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-col gap-1">
              <strong className="text-[17px] font-semibold">Criar sua primeira automação</strong>
              <span className="text-sm leading-normal text-muted">
                Escolha uma palavra (tipo RECEITA), o post, e o que a pessoa recebe na DM. Você vê a conversa
                antes de ativar.
              </span>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Link
                href="/automacoes/nova"
                className="flex h-[46px] items-center rounded-xl bg-ink px-5 text-[15px] font-semibold whitespace-nowrap text-white hover:bg-ink-2"
              >
                Criar automação
              </Link>
              <Link
                href="/painel"
                className="flex h-[46px] items-center rounded-xl px-4 text-[15px] font-medium whitespace-nowrap text-ink-2 underline underline-offset-[3px]"
              >
                Ir para o painel
              </Link>
            </div>
          </div>
        </li>
      </ol>

      <p className="m-0 text-sm leading-[1.6] text-muted">
        O &quot;recebimento de comentários&quot; é o canal pelo qual o Instagram avisa o Oslinke, na hora, que
        alguém comentou. Você não precisa configurar nada.
      </p>
    </div>
  );
}
