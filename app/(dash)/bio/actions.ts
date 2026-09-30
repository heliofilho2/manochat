"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { bioConfig, db } from "@/db";
import {
  BUTTON_LAYOUTS,
  BUTTON_STYLES,
  FONTS,
  HEADER_LAYOUTS,
  PATTERNS,
  POST_LAYOUTS,
  SHAPES,
  SOCIAL_TYPES,
  THEMES,
  WALLPAPERS,
} from "@/lib/bio/theme";
import { getSession } from "@/lib/session";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
// Small JPEG data URLs produced by the editor; the caps stop anything oversized.
const jpeg = (max: number) => z.string().max(max).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/);

const styleSchema = z.object({
  header: z.enum(HEADER_LAYOUTS),
  title: z.string().max(60),
  wallpaper: z.object({
    type: z.enum(WALLPAPERS),
    color: hex.nullable(),
    color2: hex.nullable(),
    angle: z.number().min(0).max(360),
    pattern: z.enum(PATTERNS),
    image: jpeg(300_000).nullable(),
  }),
  button: z.object({
    style: z.enum(BUTTON_STYLES),
    layout: z.enum(BUTTON_LAYOUTS),
    color: hex.nullable(),
    text: hex.nullable(),
    lift: z.boolean(),
  }),
  font: z.enum(FONTS),
  textColor: hex.nullable(),
  socials: z
    .array(z.object({ type: z.enum(SOCIAL_TYPES), url: z.string().max(300) }))
    .max(8),
  showBranding: z.boolean(),
});

const schema = z.object({
  theme: z.string().refine((t) => t in THEMES),
  shape: z.string().refine((s) => s in SHAPES),
  bio: z.string().max(150),
  photo: jpeg(150_000).nullable(),
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
        type: z.enum(["link", "heading"]).optional(),
      }),
    )
    .max(40),
  style: styleSchema,
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
