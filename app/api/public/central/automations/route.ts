import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { automation, db } from "@/db";
import { getAccount } from "@/lib/account";
import { BLANK_DRAFT, BLANK_STORY_DRAFT, toRowFields, validate, type AutomationDraft } from "@/lib/automation/draft";
import { isAuthorizedCentralApi } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cria ou atualiza a automação de uma palavra: de comentário ("comenta CORDA", padrão) ou de resposta de
 * story ("responde BANDA", kind: "story"). As duas são automações separadas no Oslinke: a de comentário não
 * dispara quando alguém responde o story, então story com palavra precisa da sua própria.
 * Único consumidor: a esteira da Central do Criador (ponte no PC do Helio), quando um vídeo novo pede
 * palavra na legenda. Mesmo segredo da leitura (CENTRAL_API_SECRET, lib/cron-auth.ts).
 *
 * Uma automação por palavra. Se a palavra já está numa automação com OUTRO link, devolve 409 e não mexe:
 * trocar o link ali mudaria a DM de quem comenta num post antigo. Para trocar mesmo, mande replace: true.
 */
const bodySchema = z.object({
  keyword: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(120),
  link: z.string().trim().url().max(500),
  dm_text: z.string().trim().min(1).max(1000).optional(),
  opener_text: z.string().trim().min(1).max(640).optional(),
  reply_variants: z.array(z.string().trim().min(1).max(300)).max(10).optional(),
  require_follow: z.boolean().optional(),
  link_label: z.string().trim().min(1).max(20).optional(),
  /** comment (padrão) = "comenta PALAVRA" num post; story = "responde PALAVRA" num story. */
  kind: z.enum(["comment", "story"]).optional(),
  /** future = só posts publicados depois de entrar no ar (padrão); all = todos os posts. Story vale para todos. */
  scope: z.enum(["future", "all"]).optional(),
  status: z.enum(["active", "draft"]).optional(),
  replace: z.boolean().optional(),
});

const normalize = (w: string) => w.trim().replace(/^#/, "").toUpperCase();

export async function POST(request: NextRequest) {
  if (!isAuthorizedCentralApi(request)) return new NextResponse("Unauthorized", { status: 401 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "corpo não é JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "fora do esquema", issues: parsed.error.issues }, { status: 422 });
  const b = parsed.data;
  const keyword = normalize(b.keyword);
  const kind = b.kind ?? "comment";
  const story = kind === "story";
  const base = story ? BLANK_STORY_DRAFT : BLANK_DRAFT;

  const acct = await getAccount();
  if (!acct) return NextResponse.json({ error: "nenhuma conta do Instagram conectada no Oslinke" }, { status: 409 });

  const rows = await db
    .select()
    .from(automation)
    .where(and(eq(automation.accountId, acct.id), eq(automation.kind, kind)));
  const existing = rows.find((r) => r.keywords.some((k) => normalize(k) === keyword));
  if (existing && existing.dmLink !== b.link && !b.replace) {
    return NextResponse.json(
      {
        error: `a palavra ${keyword} já está na automação "${existing.name}" com outro link`,
        existing: { id: existing.id, name: existing.name, link: existing.dmLink, status: existing.status },
      },
      { status: 409 },
    );
  }

  const draft: AutomationDraft = {
    ...base,
    id: existing?.id ?? null,
    name: b.name,
    keywords: existing ? [...new Set([...existing.keywords.map(normalize), keyword])] : [keyword],
    // Story: só as palavras (nunca "qualquer resposta"), em todos os stories.
    anyWords: false,
    target: story ? "all" : b.scope === "all" ? "all" : "future",
    status: b.status ?? "active",
    replies: story ? base.replies : b.reply_variants?.length ? b.reply_variants : base.replies,
    dmInitial: b.opener_text ?? base.dmInitial,
    dmFollower: b.dm_text ?? base.dmFollower,
    requireFollow: b.require_follow ?? base.requireFollow,
    url: b.link,
    linkButton: true,
    linkLabel: b.link_label ?? base.linkLabel,
  };
  const status = draft.status === "active" ? "live" : "draft";
  if (status === "live") {
    const errors = Object.values(validate(draft));
    if (errors.length) return NextResponse.json({ error: errors[0]![1] }, { status: 422 });
  }

  const fields = toRowFields(draft);
  // from_now_on vale a partir da primeira vez que entrou no ar; atualizar não empurra o corte.
  const appliesFrom =
    fields.scope === "from_now_on" ? (existing?.appliesFrom ?? (status === "live" ? new Date() : null)) : null;

  let id: string;
  if (existing) {
    await db
      .update(automation)
      .set({ ...fields, status, appliesFrom, updatedAt: new Date() })
      .where(eq(automation.id, existing.id));
    id = existing.id;
  } else {
    const [row] = await db
      .insert(automation)
      .values({ accountId: acct.id, ...fields, status, appliesFrom })
      .returning({ id: automation.id });
    id = row.id;
  }

  revalidatePath("/automacoes");
  revalidatePath(`/automacoes/${id}`);
  revalidatePath("/painel");
  return NextResponse.json({ id, keyword, kind, status, link: b.link, created: !existing }, { status: existing ? 200 : 201 });
}
