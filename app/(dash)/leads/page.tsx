import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { automation, db, lead } from "@/db";
import { getAccountById } from "@/lib/account";
import { fmt, initialsOf, timeAgo } from "@/lib/format";
import { toneFor } from "@/lib/posts-view";
import { getSession } from "@/lib/session";
import { IconUsers } from "@/components/icons";
import { WebhookForm } from "./webhook-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leads — Manochat" };

export default async function LeadsPage() {
  const session = await getSession();
  if (!session) redirect("/");
  const acct = await getAccountById(session.accountId);
  if (!acct) redirect("/");

  const [rows, [totals]] = await Promise.all([
    db
      .select({ l: lead, automation: automation.name })
      .from(lead)
      .leftJoin(automation, eq(automation.id, lead.automationId))
      .where(eq(lead.accountId, acct.id))
      .orderBy(desc(lead.createdAt))
      .limit(200),
    db
      .select({
        total: sql<number>`count(*)::int`,
        emails: sql<number>`count(${lead.email})::int`,
        phones: sql<number>`count(${lead.phone})::int`,
      })
      .from(lead)
      .where(eq(lead.accountId, acct.id)),
  ]);

  return (
    <div className="animate-up flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 text-[clamp(30px,4.5vw,42px)] leading-[1.02] font-bold tracking-[-0.025em]">Leads</h1>
          <span className="text-[15px] text-muted">
            Pessoas que responderam aos seus stories e deixaram contato.
          </span>
        </div>
        {rows.length > 0 ? (
          <a
            href="/api/leads/export"
            className="flex h-[46px] items-center rounded-xl border border-line-strong bg-white px-[18px] text-[15px] font-semibold whitespace-nowrap"
          >
            Baixar CSV
          </a>
        ) : null}
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,190px),1fr))] gap-3">
        {[
          ["Leads", totals?.total ?? 0, "Todas as pessoas capturadas"],
          ["Com e-mail", totals?.emails ?? 0, "Responderam a pergunta do e-mail"],
          ["Com WhatsApp", totals?.phones ?? 0, "Deixaram o número"],
        ].map(([label, value, hint]) => (
          <div key={label as string} className="flex min-h-32 flex-col gap-2.5 rounded-[18px] border border-line bg-white p-[18px]">
            <span className="text-sm font-medium opacity-80">{label}</span>
            <span className="text-[34px] leading-none font-bold tracking-[-0.02em] tabular-nums">{fmt(value as number)}</span>
            <span className="mt-auto text-xs opacity-75">{hint}</span>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-[22px] border border-dashed border-line-strong bg-white p-[clamp(24px,5vw,48px)]">
          <span className="flex h-[52px] w-[52px] items-center justify-center rounded-[16px_16px_16px_4px] bg-accent-soft text-accent-ink">
            <IconUsers size={24} strokeWidth={2} />
          </span>
          <h2 className="m-0 text-[26px] leading-[1.1] font-bold tracking-[-0.02em]">Nenhum lead ainda</h2>
          <p className="m-0 max-w-[480px] text-base leading-[1.55] text-ink-2">
            Crie uma automação de <strong>resposta a story</strong>, ligue &quot;Pedir e-mail&quot; ou &quot;Pedir
            WhatsApp&quot; e poste o story. Quem responder aparece aqui.
          </p>
        </div>
      ) : (
        <div className="flex flex-col overflow-hidden rounded-[20px] border border-line bg-white">
          {rows.map(({ l, automation: name }, ix) => {
            const user = l.username ?? "sem-nome";
            return (
              <div
                key={l.id}
                className="animate-up flex gap-3.5 border-b border-line-soft p-4"
                style={{ animationDelay: `${Math.min(ix, 12) * 40}ms` }}
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
                  style={{ background: toneFor(user) }}
                >
                  {initialsOf(user)}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                    <strong className="text-[15px] font-semibold">{l.username ? `@${l.username}` : "Perfil do Instagram"}</strong>
                    <span className="text-[13px] text-muted">
                      {timeAgo(l.createdAt)} · {name ?? "automação excluída"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className={l.email ? "" : "text-muted"}>{l.email ?? "sem e-mail"}</span>
                    {l.phone ? (
                      <a
                        href={`https://wa.me/${l.phone.length <= 11 ? `55${l.phone}` : l.phone}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent-ink underline underline-offset-[3px]"
                      >
                        {l.phone}
                      </a>
                    ) : (
                      <span className="text-muted">sem WhatsApp</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {l.trigger ? (
                      <span className="h-6 rounded-md border border-line bg-bg px-2 text-[11px] leading-6 font-semibold tracking-[0.03em]">
                        {l.trigger.toUpperCase()}
                      </span>
                    ) : null}
                    {l.step !== "done" ? (
                      <span className="flex h-6 items-center rounded-full bg-warning-bg px-[9px] text-xs font-semibold text-warning">
                        Aguardando {l.step === "email" ? "e-mail" : "WhatsApp"}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <WebhookForm initial={acct.leadsWebhookUrl ?? ""} />
    </div>
  );
}
