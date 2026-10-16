import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { automation, db } from "@/db";
import { getAccount } from "@/lib/account";
import { isAuthorizedCentralApi } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lista as automações (palavra, link, situação) para a Central conferir os links das DMs.
// POST corrige link que aponta para o painel do site (/admin/cofre/<slug>, que pede senha) trocando pela
// página pública (https://www.heliofilho.dev/cofre/<slug>). Mesmo segredo da leitura (CENTRAL_API_SECRET).
const ADMIN_COFRE = /^https?:\/\/(?:www\.)?heliofilho\.dev\/admin\/cofre\/([^/?#]+)/i;

async function list() {
  const acct = await getAccount();
  if (!acct) return [];
  return db
    .select({ id: automation.id, name: automation.name, status: automation.status, keywords: automation.keywords, link: automation.dmLink, kind: automation.kind })
    .from(automation)
    .where(eq(automation.accountId, acct.id));
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCentralApi(request)) return new NextResponse("Unauthorized", { status: 401 });
  return NextResponse.json({ automations: await list() });
}

// Corpo opcional {"links": {"PS5": "https://www.heliofilho.dev/cofre/emulador-ps5"}}: troca só o link da DM
// dessas palavras (o texto e o resto da automação ficam como estão).
export async function POST(request: NextRequest) {
  if (!isAuthorizedCentralApi(request)) return new NextResponse("Unauthorized", { status: 401 });
  let wanted: Record<string, string> = {};
  try {
    const body = (await request.json()) as { links?: Record<string, string> };
    for (const [k, v] of Object.entries(body.links ?? {})) {
      if (typeof v === "string" && /^https:\/\/\S+$/.test(v)) wanted[k.trim().replace(/^#/, "").toUpperCase()] = v;
    }
  } catch {
    wanted = {};
  }
  const fixed: { name: string; from: string; to: string }[] = [];
  for (const a of await list()) {
    const byWord = a.keywords.map((k) => wanted[k.toUpperCase()]).find(Boolean);
    const m = a.link ? ADMIN_COFRE.exec(a.link) : null;
    if (!byWord && !m) continue;
    const to = byWord ?? `https://www.heliofilho.dev/cofre/${m![1]}`;
    if (to === a.link) continue;
    await db.update(automation).set({ dmLink: to, updatedAt: new Date() }).where(eq(automation.id, a.id));
    fixed.push({ name: a.name, from: a.link ?? "", to });
  }
  if (fixed.length) revalidatePath("/automacoes");
  return NextResponse.json({ fixed, automations: await list() });
}
