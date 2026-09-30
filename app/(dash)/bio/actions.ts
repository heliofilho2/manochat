"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { bioConfig, db } from "@/db";
import { POST_LAYOUTS, SHAPES, THEMES } from "@/lib/bio/theme";
import { getSession } from "@/lib/session";

const schema = z.object({
  theme: z.string().refine((t) => t in THEMES),
  shape: z.string().refine((s) => s in SHAPES),
  bio: z.string().max(150),
  // 240px JPEG produced by the editor; the cap stops anything oversized.
  photo: z
    .string()
    .max(150_000)
    .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/)
    .nullable(),
  showFollowers: z.boolean(),
  showPosts: z.boolean(),
  postLayout: z.enum(POST_LAYOUTS),
  order: z.array(z.string().max(80)).max(100),
  hidden: z.array(z.string().max(80)).max(100),
  manual: z
    .array(
      z.object({
        id: z.string().regex(/^m\d{1,20}$/),
        label: z.string().max(80),
        url: z.string().max(500),
      }),
    )
    .max(30),
});

/** Auto-saved by the bio editor (debounced). Replaces the whole row. */
export async function saveBioSettings(input: unknown): Promise<{ ok: boolean }> {
  const session = await getSession();
  if (!session) redirect("/");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false };

  const values = { ...parsed.data, updatedAt: new Date() };
  await db
    .insert(bioConfig)
    .values({ accountId: session.accountId, ...values })
    .onConflictDoUpdate({ target: bioConfig.accountId, set: values });
  return { ok: true };
}
