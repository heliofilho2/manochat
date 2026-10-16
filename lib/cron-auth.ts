import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { env } from "./env";

/**
 * Guards the cron routes. Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`;
 * without this check the endpoints would be publicly triggerable.
 */
export function isAuthorizedCron(request: NextRequest): boolean {
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${env.cronSecret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Guards the small public read-only API (heliofilho.dev pulls reels/followers
 * from here). Same shape as isAuthorizedCron, different secret - a leak of one
 * must not grant access to the other.
 */
export function isAuthorizedPublicApi(request: NextRequest): boolean {
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${env.publicApiSecret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Guards GET /api/public/central (a Central do Criador lê DMs e palavras daqui).
 * Segredo próprio: o da home de heliofilho.dev não abre as mensagens.
 */
export function isAuthorizedCentralApi(request: NextRequest): boolean {
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${env.centralApiSecret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
