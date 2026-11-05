import { NextRequest, NextResponse } from "next/server";
import { getAccount } from "@/lib/account";
import { isAuthorizedPublicApi } from "@/lib/cron-auth";
import { getMediaKit } from "@/lib/insights/media-kit-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Na primeira chamada de cada janela de cache são ~15 consultas de conta + uma por post de 60 dias.
export const maxDuration = 60;

/**
 * Números do mídia kit de heliofilho.dev: visualizações, interações, público, reels que
 * mais performaram e o que o Oslinke entregou por DM. Somente leitura, mesmo segredo do
 * /api/public/reels (PUBLIC_API_SECRET).
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedPublicApi(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const acct = await getAccount();
  if (!acct) return NextResponse.json(null);

  return NextResponse.json(await getMediaKit(acct));
}
