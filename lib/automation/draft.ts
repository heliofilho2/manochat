/**
 * The automation as the editor sees it, plus the mapping to/from the
 * database row and the publish-time validation. Pure and shared by the
 * client editor and the server action, so both apply the same rules.
 */

export type DraftStatus = "draft" | "active" | "paused";

export interface AutomationDraft {
  id: string | null;
  name: string;
  keywords: string[];
  match: "exact" | "contains";
  target: "specific" | "all" | "future";
  postIds: string[];
  status: DraftStatus;
  publicReply: boolean;
  replies: string[];
  dmInitial: string;
  btnLabel: string;
  dmFollower: string;
  dmNonFollower: string;
  requireFollow: boolean;
  url: string;
  linkButton: boolean;
  linkLabel: string;
}

export const BLANK_DRAFT: AutomationDraft = {
  id: null,
  name: "",
  keywords: [],
  match: "exact",
  target: "specific",
  postIds: [],
  status: "draft",
  publicReply: true,
  replies: ["Te mandei na DM! 💌"],
  dmInitial: "Oi! 👋 Toca no botão aqui embaixo que eu te mando o link.",
  btnLabel: "Quero o link",
  dmFollower: "Aqui está: {link}",
  dmNonFollower: "Quase lá! Me segue e toca no botão de novo que eu libero o link 💛",
  requireFollow: true,
  url: "",
  linkButton: true,
  linkLabel: "Abrir link",
};

/** The fields of the `automation` table that the editor reads and writes. */
export interface AutomationRowFields {
  id: string;
  name: string;
  status: string;
  keywords: string[];
  matchMode: string;
  scope: string;
  postIds: string[];
  replyEnabled: boolean;
  replyVariants: string[];
  dmText: string;
  dmLink: string | null;
  requireFollow: boolean;
  openerText: string | null;
  followButtonLabel: string;
  notFollowerText: string | null;
  linkButtonLabel: string | null;
}

export function fromRow(r: AutomationRowFields): AutomationDraft {
  return {
    id: r.id,
    name: r.name,
    keywords: r.keywords.map((k) => k.toUpperCase()),
    match: r.matchMode === "contains" ? "contains" : "exact",
    target: r.scope === "specific_posts" ? "specific" : r.scope === "from_now_on" ? "future" : "all",
    postIds: r.postIds,
    status: r.status === "live" ? "active" : r.status === "paused" ? "paused" : "draft",
    publicReply: r.replyEnabled,
    replies: r.replyVariants.length ? r.replyVariants : [""],
    dmInitial: r.openerText ?? BLANK_DRAFT.dmInitial,
    btnLabel: r.followButtonLabel,
    dmFollower: r.dmText,
    dmNonFollower: r.notFollowerText ?? BLANK_DRAFT.dmNonFollower,
    requireFollow: r.requireFollow,
    url: r.dmLink ?? "",
    linkButton: Boolean(r.linkButtonLabel),
    linkLabel: r.linkButtonLabel ?? BLANK_DRAFT.linkLabel,
  };
}

export function toRowFields(d: AutomationDraft) {
  return {
    name: d.name.trim() || "Automação sem nome",
    keywords: d.keywords,
    matchMode: d.match === "contains" ? ("contains" as const) : ("exact_word" as const),
    scope:
      d.target === "specific"
        ? ("specific_posts" as const)
        : d.target === "future"
          ? ("from_now_on" as const)
          : ("all_posts" as const),
    postIds: d.target === "specific" ? d.postIds : [],
    replyEnabled: d.publicReply,
    replyVariants: d.replies.map((r) => r.trim()).filter(Boolean),
    dmText: d.dmFollower.trim(),
    dmLink: d.url.trim() || null,
    requireFollow: d.requireFollow,
    openerText: d.dmInitial.trim() || null,
    followButtonLabel: d.btnLabel.trim() || "Quero o link",
    notFollowerText: d.dmNonFollower.trim() || null,
    linkButtonLabel: d.linkButton ? d.linkLabel.trim() || "Abrir link" : null,
  };
}

/** step index (0-5) the error belongs to, and the message shown to the user. */
export type DraftErrors = Partial<Record<string, [number, string]>>;

export function validate(d: AutomationDraft): DraftErrors {
  const e: DraftErrors = {};
  if (!d.name.trim()) e.name = [0, "Dê um nome pra automação"];
  if (!d.keywords.length) e.keywords = [1, "Adicione pelo menos uma palavra-chave"];
  if (d.target === "specific" && !d.postIds.length) e.postIds = [2, "Escolha pelo menos um post"];
  if (d.publicReply && !d.replies.some((r) => r.trim())) e.replies = [3, "Escreva ao menos uma resposta"];
  if (!d.dmInitial.trim()) e.dmInitial = [4, "A DM inicial está vazia"];
  if (!d.btnLabel.trim()) e.btnLabel = [4, "Falta o texto do botão"];
  if (!d.dmFollower.includes("{link}") && !d.linkButton) {
    e.dmFollower = [4, "Inclua {link} na mensagem de entrega"];
  } else if (!d.dmFollower.trim()) {
    e.dmFollower = [4, "A mensagem de entrega está vazia"];
  }
  if (d.requireFollow && !d.dmNonFollower.trim()) {
    e.dmNonFollower = [4, "Escreva a mensagem para quem não segue"];
  }
  if (!/^https?:\/\/\S+\.\S+/.test(d.url)) {
    e.url = [5, d.url ? "Esse link não parece válido — comece com https://" : "Informe a URL do link"];
  }
  return e;
}

/** "RECEITA, #guia" → ["RECEITA","GUIA"]: uppercase, no "#", no duplicates. */
export function addKeywords(current: string[], raw: string): string[] {
  const out = [...current];
  for (const w of raw.split(",").map((x) => x.trim().replace(/^#/, "").toUpperCase())) {
    if (w && !out.includes(w)) out.push(w);
  }
  return out;
}
