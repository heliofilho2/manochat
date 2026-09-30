/** Pure helpers for the inbox screen (labels, reasons, time formatting). */

export type Step = "sent" | "pending" | "failed" | "off";

export function stepOf(status: string): Step {
  if (status === "sent") return "sent";
  if (status === "failed" || status === "dead") return "failed";
  if (status === "skipped") return "off";
  return "pending";
}

export type Overall = "sent" | "pending" | "failed";

export function overallOf(reply: Step, dm: Step): Overall {
  if (reply === "failed" || dm === "failed") return "failed";
  if (reply === "pending" || dm === "pending") return "pending";
  return "sent";
}

/**
 * Meta's raw error strings are meaningless to a creator. Map the ones we know
 * to a sentence; unknown errors fall through untouched so nothing is hidden.
 */
export function friendlyReason(
  reply: Step,
  dm: Step,
  replyError: string | null,
  dmError: string | null,
): string {
  const overall = overallOf(reply, dm);
  if (overall === "sent") return "";
  const raw = (dmError ?? replyError ?? "").trim();
  const t = raw.toLowerCase();

  if (t.includes("24h messaging window")) {
    return "A janela de 24h fechou antes do envio. O Instagram só deixa mandar quando a pessoa interage de novo.";
  }
  if (/access token|session has expired|oauthexception|\(#190\)|token.*expir/.test(t)) {
    return "Sua conexão com o Instagram estava expirada nesse momento. Reconecte e o envio volta.";
  }
  if (/does not exist|deleted|unsupported (get|post) request|cannot be found|not found/.test(t)) {
    return reply === "failed" && dm !== "failed"
      ? "O comentário foi apagado antes da resposta pública. A DM foi enviada normalmente."
      : "O comentário foi apagado antes do envio, então não deu pra responder.";
  }
  if (/rate limit|too many|limit reached|temporarily blocked|\(#4\)|\(#17\)|\(#32\)/.test(t)) {
    return "O Instagram limitou os envios por alguns minutos. Vamos tentar de novo sozinhos.";
  }
  if (/only|not allowed|cannot message|permission|follow/.test(t) && dm === "failed") {
    return "A pessoa só aceita mensagens de contas que ela segue. Ela ainda pode clicar no link da sua bio.";
  }
  if (!raw) return "Ainda estamos processando este comentário.";
  return raw;
}

const TZ = "America/Sao_Paulo";

export function clock(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
}

function ymd(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

/** "HOJE", "ONTEM" or "12 SET". */
export function dayLabel(d: Date, now = new Date()): string {
  if (ymd(d) === ymd(now)) return "HOJE";
  if (ymd(d) === ymd(new Date(now.getTime() - 86_400_000))) return "ONTEM";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "numeric", month: "short" })
    .format(d)
    .replace(" de ", " ")
    .replace(".", "")
    .toUpperCase();
}

export function hoursLeft(expires: Date | null, now = Date.now()): number {
  if (!expires || expires.getTime() <= now) return 0;
  return Math.ceil((expires.getTime() - now) / 3_600_000);
}
