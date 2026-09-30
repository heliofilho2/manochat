import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { account, automation, db, igPost, linkClick } from "@/db";
import { destinationFor, withUtm } from "@/lib/bio/links";

/**
 * Click tracker for the link-in-bio page: records the click, then redirects.
 * The destination is derived from our own rows, never from the request.
 *   /r/a-<automationId>  → the automation's post (or the profile)
 *   /r/p-<mediaId>       → a recent post's permalink
 */
export async function GET(_req: Request, ctx: RouteContext<"/r/[id]">) {
  const { id } = await ctx.params;
  const kind = id.slice(0, 2);
  const ref = id.slice(2);
  let accountId: string | null = null;
  let dest: string | null = null;

  if (kind === "a-" && /^[0-9a-f-]{36}$/i.test(ref)) {
    const [a] = await db.select().from(automation).where(eq(automation.id, ref)).limit(1);
    if (a) {
      const [acct] = await db.select().from(account).where(eq(account.id, a.accountId)).limit(1);
      const posts = a.postIds.length
        ? await db.select().from(igPost).where(eq(igPost.accountId, a.accountId))
        : [];
      accountId = a.accountId;
      dest = destinationFor(
        a,
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
  }

  if (!accountId || !dest) return new NextResponse("Not found", { status: 404 });

  await db.insert(linkClick).values({ accountId, linkId: id });
  return NextResponse.redirect(withUtm(dest), 302);
}
