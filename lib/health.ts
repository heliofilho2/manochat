/**
 * What counts as "something is wrong" with an install. Pure, so the rules can
 * be unit-tested; the queries live in health-server.ts.
 */

export type Severity = "error" | "warn";

export interface Issue {
  /** Stable id, also the cooldown key for alerts. */
  key: string;
  severity: Severity;
  title: string;
  detail: string;
}

export interface HealthInput {
  now: number;
  /** Events that ended `dead` or `failed` in the last 24h. */
  dead: { error: string | null }[];
  /** Events still pending/failed well after they should have been swept. */
  stuck: { count: number; oldestAt: number | null };
  tokens: { username: string; expiresAt: number }[];
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * Failures that are part of normal life, not a bug: the person deleted the
 * comment or the chat, the 7-day window passed, or Meta's dashboard test event.
 */
const EXPECTED = [
  /archived or deleted/i,
  /window \(7 days\)/i,
  /no connected account/i,
  /already.*private reply/i,
  /comment.*(deleted|not found)/i,
];

/** Meta says this when the token expired, was revoked or the password changed. */
const TOKEN_INVALID = /validating access token|session has been invalidated|access token.*(expired|invalid)/i;

export function isExpectedFailure(message: string | null): boolean {
  return message !== null && EXPECTED.some((r) => r.test(message));
}

export function evaluateHealth(i: HealthInput): Issue[] {
  const issues: Issue[] = [];

  const tokenErrors = i.dead.filter((d) => d.error !== null && TOKEN_INVALID.test(d.error));
  if (tokenErrors.length > 0) {
    issues.push({
      key: "token-invalid",
      severity: "error",
      title: `O Instagram invalidou a conexão: ${tokenErrors.length} evento(s) não foram enviados`,
      detail:
        "Entre no painel e reconecte o Instagram (Entrar com Instagram). Depois disso os envios pendentes voltam a ser tentados.",
    });
  }

  const real = i.dead.filter((d) => !isExpectedFailure(d.error) && !tokenErrors.includes(d));
  if (real.length > 0) {
    const sample = real.find((d) => d.error)?.error ?? "sem detalhe";
    issues.push({
      key: "dead",
      severity: "error",
      title: `${real.length} evento(s) falharam de vez nas últimas 24h`,
      detail: `Exemplo: ${sample.slice(0, 200)}`,
    });
  }

  if (i.stuck.count > 0 && i.stuck.oldestAt !== null) {
    const mins = Math.round((i.now - i.stuck.oldestAt) / 60_000);
    issues.push({
      key: "stuck",
      severity: "error",
      title: `${i.stuck.count} evento(s) esperando há ${mins} min`,
      detail: "O cron de reprocessamento pode ter parado. Confira o cron-job.org ou o GitHub Actions.",
    });
  }

  for (const t of i.tokens) {
    const left = t.expiresAt - i.now;
    if (left <= 0) {
      issues.push({
        key: `token:${t.username}`,
        severity: "error",
        title: `O token de @${t.username} venceu`,
        detail: "As automações dessa conta pararam. Entre no painel e reconecte o Instagram.",
      });
    } else if (left <= 7 * DAY) {
      const days = Math.ceil(left / DAY);
      issues.push({
        key: `token:${t.username}`,
        severity: left <= 2 * DAY ? "error" : "warn",
        title: `O token de @${t.username} vence em ${days} dia(s)`,
        detail: "A renovação automática deveria ter rodado. Confira o cron refresh-token.",
      });
    }
  }

  return issues;
}

/** How long to stay quiet after alerting about the same issue. */
export function cooldownMs(severity: Severity): number {
  return severity === "error" ? 3 * 60 * 60 * 1000 : DAY;
}
