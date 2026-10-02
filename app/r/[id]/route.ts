import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { account, automation, bioConfig, db, igPost, linkClick } from "@/db";
import { classifyDevice, isBot } from "@/lib/bio/analytics";
import { destinationFor, withUtm } from "@/lib/bio/links";
import { safeUrl } from "@/lib/bio/theme";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Click tracker for the link-in-bio page: records the click, then redirects.
 * The destination is derived from our own rows, never from the request.
 *   /r/a-<automationId>            → the automation's post (or the profile)
 *   /r/p-<mediaId>                 → a recent post's permalink
 *   /r/m-<accountId>.<manualId>    → a manual link from the bio settings
 */
export async function GET(req: Request, ctx: RouteContext<"/r/[id]">) {
  const { id } = await ctx.params;
  const kind = id.slice(0, 2);
  const ref = id.slice(2);
  let accountId: string | null = null;
  let dest: string | null = null;

  if (kind === "a-" && UUID.test(ref)) {
    const [a] = await db.select().from(automation).where(eq(automation.id, ref)).limit(1);
    if (a) {
      const [acct] = await db.select().from(account).where(eq(account.id, a.accountId)).limit(1);
      const posts = a.postIds.length
        ? await db.select().from(igPost).where(eq(igPost.accountId, a.accountId))
        : [];
      accountId = a.accountId;
      dest = destinationFor(
        { scope: a.scope, postIds: a.postIds },
        new Map(posts.map((p) => [p.id, p.permalink])),
        acct?.username ?? "",
      );
    }
  } else if (kind === "p-") {
    const [p] = await db.select().from(igPost).where(eq(igPost.id, ref)).limit(1);
    if (p?.permalink) {
      accountId = p.accountId;
      dest = p.permalink;
    }
  } else if (kind === "m-") {
    const [acctId, manualId] = ref.split(".");
    if (acctId && manualId && UUID.test(acctId)) {
      const [cfg] = await db
        .select()
        .from(bioConfig)
        .where(and(eq(bioConfig.accountId, acctId)))
        .limit(1);
      const link = cfg?.manual.find((m) => m.id === manualId);
      const url = link ? safeUrl(link.url) : null;
      if (url) {
        accountId = acctId;
        dest = url;
      }
    }
  }

  if (!accountId || !dest) return new NextResponse("Not found", { status: 404 });

  // Link-preview bots and crawlers follow links too; they are not visitors.
  const ua = req.headers.get("user-agent") ?? "";
  if (!isBot(ua)) await db.insert(linkClick).values({ accountId, linkId: id, device: classifyDevice(ua) });
  return NextResponse.redirect(withUtm(dest), 302);
}
