"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { account, db } from "@/db";
import { isPublicHttpsUrl } from "@/lib/leads-format";
import { getSession } from "@/lib/session";

async function accountId() {
  const session = await getSession();
  if (!session) redirect("/");
  return session.accountId;
}

/** Empty string clears the endpoint. */
export async function saveLeadsWebhook(url: string): Promise<{ ok: boolean; error?: string }> {
  const id = await accountId();
  const clean = url.trim();
  if (clean && !isPublicHttpsUrl(clean)) {
    return { ok: false, error: "Use um endereço https:// público (ex.: https://seusite.com/api/leads)." };
  }
  await db.update(account).set({ leadsWebhookUrl: clean || null }).where(eq(account.id, id));
  revalidatePath("/leads");
  return { ok: true };
}

/** Sends a sample lead so the person can check their endpoint. */
export async function sendTestLead(): Promise<{ ok: boolean; error?: string }> {
  const id = await accountId();
  const [acct] = await db.select().from(account).where(eq(account.id, id)).limit(1);
  if (!acct?.leadsWebhookUrl) return { ok: false, error: "Salve o endereço primeiro." };

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (process.env.LEADS_WEBHOOK_SECRET) {
      headers.Authorization = `Bearer ${process.env.LEADS_WEBHOOK_SECRET}`;
    }
    const res = await fetch(acct.leadsWebhookUrl, {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        event: "lead.test",
        account: acct.username,
        lead: {
          id: "test",
          instagram: "exemplo",
          instagramId: "0",
          source: "story",
          trigger: "QUERO",
          email: "exemplo@email.com",
          phone: "31999998888",
          complete: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }),
    });
    return res.ok ? { ok: true } : { ok: false, error: `O seu site respondeu ${res.status}.` };
  } catch {
    return { ok: false, error: "Não consegui falar com esse endereço. Confira se está no ar." };
  }
}
