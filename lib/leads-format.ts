/** Pure helpers for leads: CSV export and webhook URL safety. */

/** Endpoints we will call from the server: https, a real hostname, not local. */
export function isPublicHttpsUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return false;
  // Bare IPs (v4/v6) are almost always internal targets.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(":")) return false;
  return h.includes(".");
}

/** Spreadsheet apps run cells that start with = + - @ as formulas. */
function cell(v: string | null | undefined): string {
  let s = (v ?? "").replace(/\r?\n/g, " ");
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export interface CsvLead {
  createdAt: Date;
  username: string | null;
  email: string | null;
  phone: string | null;
  trigger: string | null;
  source: string;
  automation: string | null;
}

/** UTF-8 with BOM so Excel opens accents correctly. */
export function leadsToCsv(rows: CsvLead[]): string {
  const head = ["data", "instagram", "email", "whatsapp", "gatilho", "origem", "automacao"];
  const lines = rows.map((r) =>
    [
      r.createdAt.toISOString(),
      r.username ? `@${r.username}` : "",
      r.email,
      r.phone,
      r.trigger,
      r.source === "story" ? "story" : "comentário",
      r.automation,
    ]
      .map((v) => cell(v))
      .join(","),
  );
  return `﻿${[head.join(","), ...lines].join("\r\n")}\r\n`;
}
