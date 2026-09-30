import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { commentEvent, contact, contactTag, db, linkClick, tag } from "@/db";
import { accessTokenFor, getAccountById } from "@/lib/account";
import { getSession } from "@/lib/session";
import { fetchMediaMetrics } from "@/lib/insights/fetch";
import { computeInsights, type Bucket } from "@/lib/insights/insights";

export const dynamic = "force-dynamic";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function Ranking({ title, rows }: { title: string; rows: Bucket[] }) {
  const top = rows.slice(0, 5);
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <h2 className="text-sm font-medium">{title}</h2>
      {top.length === 0 ? (
        <p className="mt-3 text-xs text-muted">Sem dados suficientes.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {top.map((b, i) => (
            <li key={b.key} className="flex items-center justify-between text-sm">
              <span className={i === 0 ? "font-medium" : "text-muted"}>{b.key}</span>
              <span className="text-xs text-muted">
                {b.conversions} conv · {(b.rate * 100).toFixed(2)}% do alcance ·{" "}
                {b.posts} posts
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const accountId = session.accountId;

  const [[totals], tagRows, convRows, [clicks]] = await Promise.all([
    db
      .select({
        contacts: sql<number>`count(*)::int`,
        followers: sql<number>`count(*) filter (where ${contact.isFollower})::int`,
        inWindow: sql<number>`count(*) filter (where ${contact.messagingWindowExpiresAt} > now())::int`,
        optedIn: sql<number>`count(*) filter (where ${contact.optedInRecurring})::int`,
      })
      .from(contact)
      .where(eq(contact.accountId, accountId)),
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
      .select({ n: sql<number>`count(*)::int` })
      .from(linkClick)
      .where(eq(linkClick.accountId, accountId)),
  ]);

  const conversions = new Map<string, number>();
  for (const r of convRows) if (r.mediaId) conversions.set(r.mediaId, r.n);

  // Insights come from the account's own token, so every tenant sees only itself.
  const acct = await getAccountById(accountId);
  let insights = null;
  let insightsError: string | null = null;
  if (acct) {
    try {
      insights = computeInsights(
        await fetchMediaMetrics(accountId, accessTokenFor(acct), 90),
        conversions,
      );
    } catch (e) {
      insightsError = e instanceof Error ? e.message : String(e);
    }
  }

  const totalConversions = [...conversions.values()].reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-0.5 text-sm text-muted">
          Contatos e conversão (DMs enviadas por comentário), cruzados com as
          métricas do próprio Instagram.
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        <Stat label="Contatos" value={totals?.contacts ?? 0} />
        <Stat label="Seguidores" value={totals?.followers ?? 0} />
        <Stat label="Janela 24h aberta" value={totals?.inWindow ?? 0} />
        <Stat label="Opt-in recorrente" value={totals?.optedIn ?? 0} />
        <Stat label="DMs enviadas" value={totalConversions} />
        <Stat label="Cliques no bio link" value={clicks?.n ?? 0} />
      </section>

      <section>
        <h2 className="text-sm font-medium">Tags</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {tagRows.length === 0 ? (
            <p className="text-xs text-muted">Nenhuma tag ainda.</p>
          ) : (
            tagRows.map((t) => (
              <span
                key={t.name}
                className="rounded-full border border-line bg-surface px-3 py-1 text-xs"
              >
                {t.name} <span className="text-muted">{t.n}</span>
              </span>
            ))
          )}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium">O que mais converte (últimos 90 dias)</h2>
        {insightsError ? (
          <p className="mt-3 rounded-xl bg-warn-soft p-4 text-sm text-warn">
            Não foi possível ler as métricas do Instagram: {insightsError}. Se a
            mensagem citar permissão, saia e entre de novo para autorizar o acesso
            às métricas.
          </p>
        ) : insights ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Ranking title="Melhor horário (Brasília)" rows={insights.byHour} />
            <Ranking title="Melhor dia da semana" rows={insights.byWeekday} />
            <Ranking title="Melhor formato" rows={insights.byFormat} />
            <Ranking title="Tema que mais converte (1ª hashtag)" rows={insights.byTheme} />
          </div>
        ) : null}
      </section>
    </div>
  );
}
