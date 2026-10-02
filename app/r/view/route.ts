import { NextResponse } from "next/server";
import { z } from "zod";
import { bioView, db } from "@/db";
import { classifyDevice, classifySource, isBot } from "@/lib/bio/analytics";

// A static segment, so it wins over /r/[id]. It lives under /r/ so the
// bio-only domain (which redirects everything else to "/") lets it through.
const body = z.object({ a: z.string().uuid(), ref: z.string().max(500).optional() });

/**
 * Counts one visit to the public bio page. Called by a tiny beacon from the
 * browser (the page itself is cached, so the server never sees each visit).
 * Stores only the source and device class: no IP, no cookie.
 */
export async function POST(req: Request) {
  const ua = req.headers.get("user-agent") ?? "";
  if (isBot(ua)) return new NextResponse(null, { status: 204 });

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new NextResponse(null, { status: 400 });

  try {
    await db.insert(bioView).values({
      accountId: parsed.data.a,
      source: classifySource(parsed.data.ref ?? "", ua),
      device: classifyDevice(ua),
    });
  } catch {
    // Unknown account (foreign key) or a database hiccup: a lost view is not worth an error.
  }
  return new NextResponse(null, { status: 204 });
}
