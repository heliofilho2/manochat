import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, gt, sql } from "drizzle-orm";
import { automation, commentEvent, contact, contactTag, db, linkClick, tag } from "@/db";
import { accessTokenFor, getAccountById } from "@/lib/account";
import { refresh } from "@/lib/bio/data";
import { isStale } from "@/lib/bio/links";
import { fmt, formatFollowers } from "@/lib/format";
import { fetchMediaMetrics } from "@/lib/insights/fetch";
import { computeInsights, type Insights } from "@/lib/insights/insights";
import { bestCombo, rankings } from "@/lib/insights/labels";
import { getHealth } from "@/lib/health-server";
import { getSession } from "@/lib/session";
import { nowMs } from "@/lib/time";
import { IconChart, IconLock } from "@/components/icons";
import { RankingCard } from "./ranking-card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Painel — Oslinke" };

const PERIODS = [7, 30, 90] as const;

function Kpi({
  label,
  value,
  hint,
  highlight,
  delay,
}: {
  label: string;
  value: string;
  hint: string;
  highlight?: boolean;
  delay: string;
}) {
  return (
    <div
      className="animate-up flex min-h-32 flex-col gap-2.5 rounded-[18px] border p-[18px] transition-[transform,box-shadow] duration-[350ms] ease-brand hover:-translate-y-[3px] hover:shadow-hover"
      style={{
        animationDelay: delay,
        background: highlight ? "var(--color-accent-soft)" : "#fff",
        borderColor: highlight ? "var(--color-accent-line)" : "var(--color-line)",
      }}
    >
      <span className="text-sm font-medium opacity-80">{label}</span>
      <span className="text-[34px] leading-none font-bold tracking-[-0.02em] tabular-nums">{value}</span>
      <span className="mt-auto text-xs leading-[1.4] opacity-75">{hint}</span>
    </div>
  );
}

export default async function DashboardPage({ searchParams }: PageProps<"/painel">) {
  const session = await getSession();
  if (!session) redirect("/");
  const accountId = session.accountId;

  const { dias } = await searchParams;
  const days = PERIODS.find((p) => String(p) === dias) ?? 30;
  const since = new Date(nowMs() - days * 86_400_000);

  const acct = await getAccountById(accountId);
  if (!acct) redirect("/");
  // Follower count is cached; top it up here too so it is never blank.
  if (isStale(acct.followersSyncedAt)) await refresh(acct);

  const [[totals], [autos], tagRows, convRows, [dmStats], [clicks], healthIssues] = await Promise.all([
    db
      .select({
        contacts: sql<number>`count(*)::int`,
        inWindow: sql<number>`count(*) filter (where ${contact.messagingWindowExpiresAt} > now())::int`,
      })
      .from(contact)
      .where(eq(contact.accountId, accountId)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(automation)
      .where(eq(automation.accountId, accountId)),
    db
      .select({ name: tag.name, n: sql<number>`count(${contactTag.contactId})::int` })
      .from(tag)
      .leftJoin(contactTag, eq(contactTag.tagId, tag.id))
      .where(eq(tag.accountId, accountId))
      .groupBy(tag.id)
      .orderBy(sql`count(${contactTag.contactId}) desc`)
      .limit(12),
    db
      .select({ mediaId: commentEvent.mediaId, n: sql<number>`count(*)::int` })
      .from(commentEvent)
      .where(and(eq(commentEvent.accountId, accountId), eq(commentEvent.dmStatus, "sent")))
      .groupBy(commentEvent.mediaId),
    db
      .select({
        sent: sql<number>`count(*) filter (where ${commentEvent.dmStatus} = 'sent')::int`,
        failed: sql<number>`count(*) filter (where ${commentEvent.dmStatus} = 'failed')::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(commentEvent)
      .where(and(eq(commentEvent.accountId, accountId), gt(commentEvent.createdAt, since))),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(linkClick)
      .where(and(eq(linkClick.accountId, accountId), gt(linkClick.createdAt, since))),
    getHealth(acct.igUserId).catch(() => []),
  ]);

  const conversions = new Map<string, number>();
  for (const r of convRows) if (r.mediaId) conversions.set(r.mediaId, r.n);

  let insights: Insights | null = null;
  let reach = 0;
  let metricsError = false;
  try {
    const rows = await fetchMediaMetrics(accountId, accessTokenFor(acct), 90);
    insights = computeInsights(rows, conversions);
    reach = rows
      .filter((r) => r.timestamp && Date.parse(r.timestamp) >= since.getTime())
      .reduce((sum, r) => sum + Number(r.reach ?? 0), 0);
  } catch (e) {
    console.error("[painel] insights failed", e);
    metricsError = true;
  }

  const sent = dmStats?.sent ?? 0;
  const failed = dmStats?.failed ?? 0;
  const clickCount = clicks?.n ?? 0;
  const empty = (autos?.n ?? 0) === 0 && (dmStats?.total ?? 0) === 0;

  const tagMax = Math.max(1, ...tagRows.map((t) => t.n));
  const ranks = insights ? rankings(insights) : { hora: [], dia: [], formato: [], tema: [] };

  const kpis = [
    { label: "Contatos", value: fmt(totals?.contacts ?? 0), hint: "Pessoas que já conversaram com você" },
    {
      label: "Seguidores",
      value: metricsError || acct.followersCount === null ? "—" : formatFollowers(acct.followersCount),
      hint: metricsError ? "Sem permissão de métricas" : "Atualizado a cada poucas horas",
    },
    {
      label: "Janelas de 24h abertas",
      value: fmt(totals?.inWindow ?? 0),
      hint: "Pessoas com quem você pode conversar agora",
    },
    {
      label: "DMs enviadas",
      value: fmt(sent),
      hint: `${fmt(failed)} falharam · veja na caixa de entrada`,
    },
    {
      label: "Cliques no link da bio",
      value: fmt(clickCount),
      hint: `Na sua página /u/${acct.username}`,
    },
  ];

  const funnel = [
    { label: "Alcance dos posts", value: fmt(reach), rate: "", w: 100, color: "var(--color-line-strong)" },
    {
      label: "DMs enviadas",
      value: fmt(sent),
      rate: reach > 0 ? `${((sent / reach) * 100).toFixed(1).replace(".", ",")}% do alcance` : "",
      w: reach > 0 ? Math.max(6, Math.min(100, (sent / reach) * 100)) : 6,
      color: "var(--color-accent-hover)",
    },
    {
      label: "Cliques no link da bio",
      value: fmt(clickCount),
      rate: sent > 0 ? `${((clickCount / sent) * 100).toFixed(1).replace(".", ",")}% das DMs` : "",
      w: reach > 0 ? Math.max(4, Math.min(100, (clickCount / reach) * 100)) : 4,
      color: "var(--color-accent)",
    },
  ];

  return (
    <div className="animate-up flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 text-[clamp(30px,4.5vw,42px)] leading-[1.02] font-bold tracking-[-0.025em]">Painel</h1>
          <span className="text-[15px] text-muted">
            Como suas automações estão indo.{" "}
            <Link
              href={`/painel/automacoes?dias=${days}`}
              className="font-semibold text-ink underline underline-offset-[3px]"
            >
              Ver por automação →
            </Link>
          </span>
        </div>
        <div role="tablist" className="flex gap-0.5 rounded-xl bg-fill p-1">
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={`/painel?dias=${p}`}
              className="flex h-9 items-center rounded-[9px] px-3.5 text-sm font-medium whitespace-nowrap"
              style={{
                background: days === p ? "#fff" : "transparent",
                boxShadow: days === p ? "0 1px 3px rgba(27,23,18,.12)" : "none",
              }}
            >
              {p} dias
            </Link>
          ))}
        </div>
      </div>

      {healthIssues.length > 0 ? (
        <div role="alert" className="flex flex-col gap-2 rounded-[18px] bg-danger-bg p-[18px] text-danger-ink">
          <strong className="text-base font-bold">Atenção: a integração precisa de cuidado</strong>
          {healthIssues.map((i) => (
            <div key={i.key} className="flex flex-col gap-0.5 text-sm leading-normal">
              <span className="font-semibold">{i.title}</span>
              <span className="opacity-85">{i.detail}</span>
            </div>
          ))}
        </div>
      ) : null}

      {empty ? (
        <div className="flex flex-col items-start gap-3.5 rounded-[22px] border border-dashed border-line-strong bg-white p-[clamp(24px,5vw,48px)]">
          <span className="flex h-[52px] w-[52px] items-center justify-center rounded-[16px_16px_16px_4px] bg-accent-soft text-accent-ink">
            <IconChart size={24} />
          </span>
          <h2 className="m-0 text-[26px] leading-[1.1] font-bold tracking-[-0.02em]">Seus números aparecem aqui</h2>
          <p className="m-0 max-w-[460px] text-base leading-[1.55] text-ink-2">
            Assim que sua primeira automação responder alguém, você vê DMs enviadas, cliques e o que mais
            funciona no seu perfil.
          </p>
          <Link
            href="/automacoes/nova"
            className="flex h-[46px] items-center rounded-xl bg-ink px-5 text-[15px] font-semibold whitespace-nowrap text-white"
          >
            Criar primeira automação
          </Link>
        </div>
      ) : (
        <>
          {metricsError ? (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-[20px] bg-danger-bg p-[22px] text-danger-ink"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white text-danger">
                <IconLock size={22} />
              </span>
              <div className="flex min-w-[240px] flex-1 flex-col gap-1">
                <strong className="text-[19px] leading-[1.2] font-bold">Falta a permissão de métricas</strong>
                <span className="text-sm leading-[1.55]">
                  Para mostrar alcance, seguidores e o que mais converte, o Oslinke precisa da permissão
                  &quot;Insights do Instagram&quot;. Ela provavelmente foi desmarcada na hora de conectar.
                </span>
              </div>
              <a
                href="/api/auth/instagram"
                className="flex h-[46px] items-center rounded-xl bg-ink px-5 text-[15px] font-semibold whitespace-nowrap text-white"
              >
                Reconectar e permitir
              </a>
            </div>
          ) : null}

          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,190px),1fr))] gap-3">
            {kpis.map((k, i) => (
              <Kpi key={k.label} {...k} highlight={i === 3} delay={`${i * 60}ms`} />
            ))}
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,440px),1fr))] items-start gap-4">
            <RankingCard
              rankings={ranks}
              combo={insights ? bestCombo(insights) : null}
              metricsError={metricsError}
            />

            <div className="flex flex-col gap-4">
              <section className="flex flex-col gap-[18px] rounded-[20px] border border-line bg-white p-[22px]">
                <div className="flex flex-col gap-1">
                  <h2 className="m-0 text-[22px] leading-[1.15] font-bold tracking-[-0.02em]">Funil</h2>
                  <span className="text-[13px] text-muted">De quem viu seus posts até quem clicou no link</span>
                </div>
                {metricsError ? (
                  <div className="rounded-[14px] bg-fill px-4 py-5 text-sm leading-normal text-muted">
                    O alcance depende da permissão de métricas. DMs enviadas:{" "}
                    <strong className="text-ink">{fmt(sent)}</strong>.
                  </div>
                ) : (
                  <div className="flex flex-col gap-3.5">
                    {funnel.map((f) => (
                      <div key={f.label} className="flex flex-col gap-[7px]">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-sm font-medium text-muted">{f.label}</span>
                          <span className="flex items-baseline gap-2.5">
                            <span className="text-xs font-medium whitespace-nowrap text-accent-ink">{f.rate}</span>
                            <span className="text-[22px] font-bold tabular-nums">{f.value}</span>
                          </span>
                        </div>
                        <span className="block h-3 overflow-hidden rounded-md bg-fill">
                          <span
                            className="animate-grow block h-full rounded-[5px]"
                            style={{ width: `${f.w}%`, background: f.color }}
                          />
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="flex flex-col gap-3.5 rounded-[20px] border border-line bg-white p-[22px]">
                <div className="flex flex-col gap-1">
                  <h2 className="m-0 text-[22px] leading-[1.15] font-bold tracking-[-0.02em]">Tags dos contatos</h2>
                  <span className="text-[13px] text-muted">Aplicadas automaticamente a cada conversa</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {tagRows.length === 0 ? (
                    <span className="text-sm text-muted">Nenhuma tag ainda.</span>
                  ) : (
                    tagRows.map((t, i) => (
                      <span
                        key={t.name}
                        className="flex items-center gap-2 rounded-full px-3 py-1.5 font-medium whitespace-nowrap"
                        style={{
                          fontSize: 13 + Math.round((t.n / tagMax) * 7),
                          background: i < 4 ? "var(--color-accent-soft)" : "var(--color-bg)",
                          color: i < 4 ? "var(--color-accent-ink-2)" : "var(--color-ink-2)",
                        }}
                      >
                        #{t.name}
                        <span className="text-xs font-medium opacity-70">{fmt(t.n)}</span>
                      </span>
                    ))
                  )}
                </div>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
