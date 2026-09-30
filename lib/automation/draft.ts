/**
 * The automation as the editor sees it, plus the mapping to/from the
 * database row and the publish-time validation. Pure and shared by the
 * client editor and the server action, so both apply the same rules.
 *
 * Two kinds share one shape: `comment` (keyword on a post) and `story`
 * (a DM that replies to a story).
 */

export type DraftStatus = "draft" | "active" | "paused";
export type DraftKind = "comment" | "story";

export interface AutomationDraft {
  id: string | null;
  kind: DraftKind;
  name: string;
  keywords: string[];
  /** Story only: react to any reply/reaction instead of specific words. */
  anyWords: boolean;
  match: "exact" | "contains";
  target: "specific" | "all" | "future";
  /** Post ids (comment) or story ids (story). */
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
  /** Story extras */
  reactHeart: boolean;
  collectEmail: boolean;
  collectPhone: boolean;
  emailPrompt: string;
  phonePrompt: string;
  thanksText: string;
}

const EXTRAS = {
  anyWords: false,
  reactHeart: false,
  collectEmail: false,
  collectPhone: false,
  emailPrompt: "Pra eu te mandar novidades, qual é o seu melhor e-mail? 📩",
  phonePrompt: "E qual seu WhatsApp (com DDD)? 📱",
  thanksText: "Anotado! Obrigado 🙌",
};

export const BLANK_DRAFT: AutomationDraft = {
  id: null,
  kind: "comment",
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
  ...EXTRAS,
};

export const BLANK_STORY_DRAFT: AutomationDraft = {
  ...BLANK_DRAFT,
  kind: "story",
  target: "all",
  anyWords: true,
  publicReply: false,
  replies: [""],
  dmInitial: "",
  btnLabel: "Já sigo ✅",
  dmFollower: "Valeu por responder! Aqui está: {link}",
  dmNonFollower: "Ainda não vi você por aqui 👀 Me segue e toca no botão pra eu liberar o link!",
  requireFollow: false,
  linkButton: false,
  reactHeart: true,
};

/** The fields of the `automation` table that the editor reads and writes. */
export interface AutomationRowFields {
  id: string;
  kind: string;
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
  reactHeart: boolean;
  collectEmail: boolean;
  collectPhone: boolean;
  emailPrompt: string | null;
  phonePrompt: string | null;
  thanksText: string | null;
}

export function fromRow(r: AutomationRowFields): AutomationDraft {
  const kind: DraftKind = r.kind === "story" ? "story" : "comment";
  return {
    id: r.id,
    kind,
    name: r.name,
    keywords: r.keywords.map((k) => k.toUpperCase()),
    anyWords: kind === "story" && r.keywords.length === 0,
    match: r.matchMode === "contains" ? "contains" : "exact",
    target: r.scope === "specific_posts" ? "specific" : r.scope === "from_now_on" ? "future" : "all",
    postIds: r.postIds,
    status: r.status === "live" ? "active" : r.status === "paused" ? "paused" : "draft",
    publicReply: r.replyEnabled,
    replies: r.replyVariants.length ? r.replyVariants : [""],
    dmInitial: r.openerText ?? (kind === "story" ? "" : BLANK_DRAFT.dmInitial),
    btnLabel: r.followButtonLabel,
    dmFollower: r.dmText,
    dmNonFollower: r.notFollowerText ?? BLANK_DRAFT.dmNonFollower,
    requireFollow: r.requireFollow,
    url: r.dmLink ?? "",
    linkButton: Boolean(r.linkButtonLabel),
    linkLabel: r.linkButtonLabel ?? BLANK_DRAFT.linkLabel,
    reactHeart: r.reactHeart,
    collectEmail: r.collectEmail,
    collectPhone: r.collectPhone,
    emailPrompt: r.emailPrompt ?? EXTRAS.emailPrompt,
    phonePrompt: r.phonePrompt ?? EXTRAS.phonePrompt,
    thanksText: r.thanksText ?? EXTRAS.thanksText,
  };
}

export function toRowFields(d: AutomationDraft) {
  const story = d.kind === "story";
  return {
    kind: d.kind,
    name: d.name.trim() || "Automação sem nome",
    keywords: story && d.anyWords ? [] : d.keywords,
    matchMode: d.match === "contains" ? ("contains" as const) : ("exact_word" as const),
    scope:
      d.target === "specific"
        ? ("specific_posts" as const)
        : d.target === "future" && !story
          ? ("from_now_on" as const)
          : ("all_posts" as const),
    postIds: d.target === "specific" ? d.postIds : [],
    replyEnabled: story ? false : d.publicReply,
    replyVariants: story ? [] : d.replies.map((r) => r.trim()).filter(Boolean),
    dmText: d.dmFollower.trim(),
    dmLink: d.url.trim() || null,
    requireFollow: d.requireFollow,
    // A story reply is already a conversation, so no tap-to-open button.
    openerText: story ? null : d.dmInitial.trim() || null,
    followButtonLabel: d.btnLabel.trim() || (story ? "Já sigo ✅" : "Quero o link"),
    notFollowerText: d.dmNonFollower.trim() || null,
    linkButtonLabel: d.linkButton ? d.linkLabel.trim() || "Abrir link" : null,
    reactHeart: story && d.reactHeart,
    collectEmail: story && d.collectEmail,
    collectPhone: story && d.collectPhone,
    emailPrompt: story ? d.emailPrompt.trim() || null : null,
    phonePrompt: story ? d.phonePrompt.trim() || null : null,
    thanksText: story ? d.thanksText.trim() || null : null,
  };
}

/** Editor steps, in order, per kind. Errors point at a step id. */
export const STEP_IDS = {
  comment: ["name", "words", "posts", "reply", "messages", "link"],
  story: ["name", "story", "words", "message", "extras"],
} as const;

export const STEP_LABELS: Record<string, string> = {
  name: "Nome",
  words: "Palavras",
  posts: "Posts",
  reply: "Resposta pública",
  messages: "Mensagens",
  link: "Link e regras",
  story: "Story",
  message: "Mensagem",
  extras: "Extras",
};

export type DraftErrors = Partial<Record<string, [stepId: string, message: string]>>;

const URL_OK = /^https?:\/\/\S+\.\S+/;

export function validate(d: AutomationDraft): DraftErrors {
  const e: DraftErrors = {};
  if (!d.name.trim()) e.name = ["name", "Dê um nome pra automação"];

  if (d.kind === "story") {
    if (d.target === "specific" && !d.postIds.length) e.postIds = ["story", "Escolha pelo menos um story"];
    if (!d.anyWords && !d.keywords.length) e.keywords = ["words", "Adicione pelo menos uma palavra ou escolha “qualquer resposta”"];
    if (!d.dmFollower.trim()) e.dmFollower = ["message", "A mensagem está vazia"];
    else if (!d.dmFollower.includes("{link}") && !d.linkButton) {
      e.dmFollower = ["message", "Inclua {link} na mensagem ou ligue o botão de link"];
    }
    if (!URL_OK.test(d.url)) {
      e.url = ["message", d.url ? "Esse link não parece válido — comece com https://" : "Informe a URL do link"];
    }
    if (d.requireFollow && !d.dmNonFollower.trim()) {
      e.dmNonFollower = ["extras", "Escreva a mensagem para quem não segue"];
    }
    if (d.requireFollow && !d.btnLabel.trim()) e.btnLabel = ["extras", "Falta o texto do botão"];
    return e;
  }

  if (!d.keywords.length) e.keywords = ["words", "Adicione pelo menos uma palavra-chave"];
  if (d.target === "specific" && !d.postIds.length) e.postIds = ["posts", "Escolha pelo menos um post"];
  if (d.publicReply && !d.replies.some((r) => r.trim())) e.replies = ["reply", "Escreva ao menos uma resposta"];
  if (!d.dmInitial.trim()) e.dmInitial = ["messages", "A DM inicial está vazia"];
  if (!d.btnLabel.trim()) e.btnLabel = ["messages", "Falta o texto do botão"];
  if (!d.dmFollower.includes("{link}") && !d.linkButton) {
    e.dmFollower = ["messages", "Inclua {link} na mensagem de entrega"];
  } else if (!d.dmFollower.trim()) {
    e.dmFollower = ["messages", "A mensagem de entrega está vazia"];
  }
  if (d.requireFollow && !d.dmNonFollower.trim()) {
    e.dmNonFollower = ["messages", "Escreva a mensagem para quem não segue"];
  }
  if (!URL_OK.test(d.url)) {
    e.url = ["link", d.url ? "Esse link não parece válido — comece com https://" : "Informe a URL do link"];
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
