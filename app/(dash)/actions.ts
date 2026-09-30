"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { automation, db } from "@/db";
import { toRowFields, validate, type DraftStatus } from "@/lib/automation/draft";
import { getSession } from "@/lib/session";

const draftSchema = z.object({
  id: z.string().nullable(),
  kind: z.enum(["comment", "story"]),
  name: z.string().max(60),
  keywords: z.array(z.string().max(60)).max(30),
  anyWords: z.boolean(),
  match: z.enum(["exact", "contains"]),
  target: z.enum(["specific", "all", "future"]),
  postIds: z.array(z.string().max(100)).max(200),
  status: z.enum(["draft", "active", "paused"]),
  publicReply: z.boolean(),
  replies: z.array(z.string().max(300)).max(5),
  dmInitial: z.string().max(1000),
  btnLabel: z.string().max(20),
  dmFollower: z.string().max(1000),
  dmNonFollower: z.string().max(1000),
  requireFollow: z.boolean(),
  url: z.string().max(2000),
  linkButton: z.boolean(),
  linkLabel: z.string().max(20),
  reactHeart: z.boolean(),
  collectEmail: z.boolean(),
  collectPhone: z.boolean(),
  emailPrompt: z.string().max(300),
  phonePrompt: z.string().max(300),
  thanksText: z.string().max(300),
});

export type SaveResult =
  | { ok: true; id: string; status: DraftStatus }
  | { ok: false; error: string };

async function requireAccountId(): Promise<string> {
  const session = await getSession();
  if (!session) redirect("/");
  return session.accountId;
}

const DB_STATUS = { draft: "draft", active: "live", paused: "paused" } as const;

/**
 * Creates or updates an automation from the editor. Only `status: "active"`
 * is validated as a whole: a draft may be half-finished, a live rule may not
 * (that is what prevents DMing people an empty link).
 */
export async function saveAutomation(input: unknown, status: DraftStatus): Promise<SaveResult> {
  const accountId = await requireAccountId();
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Algo no formulário está fora do formato esperado." };
  const draft = parsed.data;

  if (status === "active") {
    const errors = Object.values(validate(draft));
    if (errors.length) return { ok: false, error: errors[0]![1] };
  }

  let existing: typeof automation.$inferSelect | undefined;
  if (draft.id) {
    [existing] = await db
      .select()
      .from(automation)
      .where(and(eq(automation.id, draft.id), eq(automation.accountId, accountId)))
      .limit(1);
    if (!existing) return { ok: false, error: "Automação não encontrada." };
  }

  const fields = toRowFields(draft);
  const publishing = status === "active";
  // `from_now_on` means "from the moment it first went live"; editing a
  // running rule must not silently move that cutoff forward.
  const appliesFrom =
    fields.scope === "from_now_on" ? (existing?.appliesFrom ?? (publishing ? new Date() : null)) : null;

  let id = existing?.id;
  if (existing) {
    await db
      .update(automation)
      .set({ ...fields, status: DB_STATUS[status], appliesFrom, updatedAt: new Date() })
      .where(eq(automation.id, existing.id));
  } else {
    const [row] = await db
      .insert(automation)
      .values({ accountId, ...fields, status: DB_STATUS[status], appliesFrom })
      .returning({ id: automation.id });
    id = row.id;
  }

  revalidatePath("/automacoes");
  revalidatePath(`/automacoes/${id}`);
  revalidatePath("/painel");
  return { ok: true, id: id!, status };
}

/** The list-page switch. Drafts have no switch, so this only flips live ↔ paused. */
export async function setAutomationStatus(id: string, status: "live" | "paused") {
  const accountId = await requireAccountId();

  const [existing] = await db
    .select()
    .from(automation)
    .where(and(eq(automation.id, id), eq(automation.accountId, accountId)))
    .limit(1);
  if (!existing || existing.status === "draft") return { ok: false as const };

  await db
    .update(automation)
    .set({
      status,
      appliesFrom:
        existing.scope === "from_now_on" && status === "live"
          ? (existing.appliesFrom ?? new Date())
          : existing.appliesFrom,
      updatedAt: new Date(),
    })
    .where(eq(automation.id, id));

  revalidatePath("/automacoes");
  revalidatePath(`/automacoes/${id}`);
  return { ok: true as const };
}

export async function deleteAutomation(id: string) {
  const accountId = await requireAccountId();
  await db
    .delete(automation)
    .where(and(eq(automation.id, id), eq(automation.accountId, accountId)));
  revalidatePath("/automacoes");
  redirect("/automacoes");
}
