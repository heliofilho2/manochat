import { and, desc, eq, gte, isNotNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db, igPost } from "@/db";
import { getAccount } from "@/lib/account";
import { isAuthorizedPublicApi } from "@/lib/cron-auth";
import { refresh } from "@/lib/bio/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Cache no mesmo espírito do post picker: reusa se recente, busca se velho. */
const FRESH_MS = 30 * 60 * 1000;

/**
 * Único consumidor: a home de heliofilho.dev, pra manter Reels recentes e
 * contagem de seguidores sempre atualizados sem edição manual no admin.
 * Somente leitura, protegido por PUBLIC_API_SECRET (ver lib/cron-auth.ts).
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedPublicApi(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const acct = await getAccount();
  if (!acct) return NextResponse.json({ followers: null, reels: [] });

  const lastSync = acct.followersSyncedAt?.getTime() ?? 0;
  if (Date.now() - lastSync > FRESH_MS) {
    await refresh(acct);
  }

  // sort=top&days=14 -> mais virais dentro da janela, pro media kit (numero que impressiona
  // marca). Sem isso: os mais recentes, pro teaser da home (o que ta saindo agora).
  const params = request.nextUrl.searchParams;
  const top = params.get("sort") === "top";
  const days = Number(params.get("days") ?? "0");
  const limit = Math.min(Number(params.get("limit") ?? "4"), 12);

  const conditions = [eq(igPost.accountId, acct.id), eq(igPost.mediaProductType, "REELS"), isNotNull(igPost.permalink)];
  if (top) conditions.push(isNotNull(igPost.viewsCount));
  if (days > 0) conditions.push(gte(igPost.timestamp, new Date(Date.now() - days * 24 * 60 * 60 * 1000)));

  const rows = await db
    .select()
    .from(igPost)
    .where(and(...conditions))
    .orderBy(top ? desc(igPost.viewsCount) : desc(igPost.timestamp))
    .limit(limit);

  return NextResponse.json({
    followers: acct.followersCount,
    reels: rows.map((r) => ({
      id: r.id,
      caption: r.caption,
      thumbnailUrl: r.thumbnailUrl,
      permalink: r.permalink,
      views: r.viewsCount,
      timestamp: r.timestamp,
    })),
  });
}
