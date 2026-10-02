import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, gt, sql } from "drizzle-orm";
import { automation, bioConfig, bioView, db, igPost, linkClick } from "@/db";
import { fillDays, percent, SOURCE_LABELS, type Source } from "@/lib/bio/analytics";
import { fmt } from "@/lib/format";
import { getSession } from "@/lib/session";
import { nowMs } from "@/lib/time";
import { BarList, DayChart } from "./charts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Métricas da bio — Oslinke" };

const PERIODS = [7, 30, 90] as const;
const DEVICE_LABELS: Record<string, string> = { celular: "Celular", tablet: "Tablet", desktop: "Computador" };

const day = (col: unknown) => sql<string>`to_char(${col} at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')`;

export default async function BioMetricsPage({ searchParams }: PageProps<"/bio/metricas">) {
  const session = await getSession();
  if (!session) redirect("/");
  const accountId = session.accountId;

  const { dias } = await searchParams;
  const days = PERIODS.find((p) => String(p) === dias) ?? 30;
  const now = nowMs();
  const since = new Date(now - days * 86_400_000);

  const viewWhere = and(eq(bioView.accountId, accountId), gt(bioView.createdAt, since));
  const clickWhere = and(eq(linkClick.accountId, accountId), gt(linkClick.createdAt, since));

  const [viewDays, clickDays, sources, devices, perLink, [cfg], autos, posts] = await Promise.all([
    db
      .select({ day: day(bioView.createdAt), n: sql<number>`count(*)::int` })
      .from(bioView)
      .where(viewWhere)
      .groupBy(sql`1`),
    db
      .select({ day: day(linkClick.createdAt), n: sql<number>`count(*)::int` })
      .from(linkClick)
      .where(clickWhere)
      .groupBy(sql`1`),
    db
      .select({ key: bioView.source, n: sql<number>`count(*)::int` })
      .from(bioView)
      .where(viewWhere)
      .groupBy(bioView.source),
    db
      .select({ key: bioView.device, n: sql<number>`count(*)::int` })
      .from(bioView)
      .where(viewWhere)
      .groupBy(bioView.device),
    db
      .select({ linkId: linkClick.linkId, n: sql<number>`count(*)::int` })
      .from(linkClick)
      .where(clickWhere)
      .groupBy(linkClick.linkId),
    db.select({ manual: bioConfig.manual }).from(bioConfig).where(eq(bioConfig.accountId, accountId)).limit(1),
    db
      .select({ id: automation.id, name: automation.name, keywords: automation.keywords })
      .from(automation)
      .where(eq(automation.accountId, accountId)),
    db.select({ id: igPost.id, caption: igPost.caption }).from(igPost).where(eq(igPost.accountId, accountId)),
  ]);

  const viewSeries = fillDays(viewDays, days, now);
  const clickSeries = fillDays(clickDays, days, now);
  const totalViews = viewSeries.reduce((s, d) => s + d.n, 0);
  const totalClicks = clickSeries.reduce((s, d) => s + d.n, 0);
  const ctr = percent(totalClicks, totalViews);

  // Name each clicked link; manual links with no click yet still show up at zero.
  const manual = cfg?.manual ?? [];
  const autoById = new Map(autos.map((a) => [a.id, a]));
  const postById = new Map(posts.map((p) => [p.id, p.caption]));
  const counts = new Map(perLink.map((r) => [r.linkId, r.n]));
  const ids = new Set(perLink.map((r) => r.linkId));
  for (const m of manual) if (m.type !== "heading") ids.add(`m-${accountId}.${m.id}`);

  const linkRows = [...ids]
    .map((id) => {
      let label = id;
      let hint = "";
      if (id.startsWith("m-")) {
        const m = manual.find((x) => x.id === id.split(".")[1]);
        label = m?.label || "Link removido";
        hint = "Link";
      } else if (id.startsWith("a-")) {
        const a = autoById.get(id.slice(2));
        label = a ? `Comente ${a.keywords[0]?.toUpperCase() ?? ""}`.trim() : "Automação removida";
        hint = a?.name ?? "Automação";
      } else if (id.startsWith("p-")) {
        label = postById.get(id.slice(2))?.split("\n")[0]?.slice(0, 60) || "Post";
        hint = "Post";
      }
      return { id, label, hint, value: counts.get(id) ?? 0 };
    })
    .sort((a, b) => b.value - a.value);

  const sourceRows = sources
    .map((s) => ({ id: s.key, label: SOURCE_LABELS[s.key as Source] ?? s.key, value: s.n }))
    .sort((a, b) => b.value - a.value);
  const deviceRows = devices
    .map((d) => ({ id: d.key, label: DEVICE_LABELS[d.key] ?? d.key, value: d.n }))
    .sort((a, b) => b.value - a.value);

  const kpis = [
    { label: "Visitas", value: fmt(totalViews), hint: "Pessoas que abriram sua página" },
    { label: "Cliques", value: fmt(totalClicks), hint: "Em qualquer link da página" },
    {
      label: "Taxa de cliques",
      value: ctr === null ? "—" : `${String(ctr).replace(".", ",")}%`,
      hint: "Cliques ÷ visitas",
    },
  ];

  return (
    <div className="animate-up flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <Link href="/bio" className="text-sm font-medium text-muted hover:text-ink">
            ← Minha página de bio
          </Link>
          <h1 className="m-0 text-[clamp(30px,4.5vw,42px)] leading-[1.02] font-bold tracking-[-0.025em]">
            Métricas da bio
          </h1>
          <span className="text-[15px] text-muted">Quem visita sua página e em que clica.</span>
        </div>
        <div role="tablist" className="flex gap-0.5 rounded-xl bg-fill p-1">
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={`/bio/metricas?dias=${p}`}
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

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,190px),1fr))] gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="flex min-h-32 flex-col gap-2.5 rounded-[18px] border border-line bg-white p-[18px]">
            <span className="text-sm font-medium opacity-80">{k.label}</span>
            <span className="text-[34px] leading-none font-bold tracking-[-0.02em] tabular-nums">{k.value}</span>
            <span className="mt-auto text-xs leading-[1.4] opacity-75">{k.hint}</span>
          </div>
        ))}
      </div>

      <section className="flex flex-col gap-4 rounded-[20px] border border-line bg-white p-[22px]">
        <div className="flex flex-col gap-1">
          <h2 className="m-0 text-[22px] leading-[1.15] font-bold tracking-[-0.02em]">Por dia</h2>
          <span className="text-[13px] text-muted">Visitas e cliques nos últimos {days} dias</span>
        </div>
        <DayChart title="Visitas" series={viewSeries} color="var(--color-line-strong)" />
        <DayChart title="Cliques" series={clickSeries} color="var(--color-accent)" />
      </section>

      <section className="flex flex-col gap-4 rounded-[20px] border border-line bg-white p-[22px]">
        <div className="flex flex-col gap-1">
          <h2 className="m-0 text-[22px] leading-[1.15] font-bold tracking-[-0.02em]">Links mais clicados</h2>
          <span className="text-[13px] text-muted">Para saber o que sua audiência mais procura</span>
        </div>
        <BarList rows={linkRows} total={totalClicks} empty="Nenhum link na página ainda." unit="cliques" />
      </section>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] items-start gap-4">
        <section className="flex flex-col gap-4 rounded-[20px] border border-line bg-white p-[22px]">
          <div className="flex flex-col gap-1">
            <h2 className="m-0 text-[22px] leading-[1.15] font-bold tracking-[-0.02em]">De onde vêm as visitas</h2>
            <span className="text-[13px] text-muted">Instagram, outros apps e acessos diretos</span>
          </div>
          <BarList rows={sourceRows} total={totalViews} empty="Ainda sem visitas no período." unit="visitas" />
        </section>
        <section className="flex flex-col gap-4 rounded-[20px] border border-line bg-white p-[22px]">
          <div className="flex flex-col gap-1">
            <h2 className="m-0 text-[22px] leading-[1.15] font-bold tracking-[-0.02em]">Dispositivos</h2>
            <span className="text-[13px] text-muted">Como as pessoas abrem a página</span>
          </div>
          <BarList rows={deviceRows} total={totalViews} empty="Ainda sem visitas no período." unit="visitas" />
        </section>
      </div>

      <span className="text-xs leading-normal text-muted">
        As visitas e a origem são contadas a partir de 02/10/2026; os cliques por link valem desde o início. Não
        guardamos IP nem usamos cookies: só a origem e o tipo de aparelho. Visitas de robôs e de pré-visualizações de
        links são descartadas.
      </span>
    </div>
  );
}
