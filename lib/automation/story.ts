/**
 * Story-reply automations: matching and the small lead-question flow.
 * Pure and dependency-free (like matcher.ts / flow.ts) so the rules that
 * decide who gets what are unit-tested.
 */

import { matchKeyword, type MatchMode } from "./matcher";

export interface StoryRule {
  id: string;
  kind: string;
  status: string;
  keywords: string[];
  matchMode: string;
  scope: string;
  postIds: string[];
  collectEmail: boolean;
  collectPhone: boolean;
}

/**
 * The first live story automation whose story scope and words fit the reply.
 * No keywords means "any reply or reaction". Rules are given newest first.
 */
export function matchStoryReply(
  rules: StoryRule[],
  reply: { text: string; storyId: string | null },
): { rule: StoryRule; trigger: string } | null {
  for (const rule of rules) {
    if (rule.kind !== "story" || rule.status !== "live") continue;
    if (rule.scope === "specific_posts") {
      if (!reply.storyId || !rule.postIds.includes(reply.storyId)) continue;
    }
    if (rule.keywords.length === 0) {
      return { rule, trigger: reply.text.trim().slice(0, 60) };
    }
    const hit = matchKeyword(reply.text, rule.keywords, rule.matchMode as MatchMode);
    if (hit) return { rule, trigger: hit };
  }
  return null;
}

export type LeadStep = "email" | "phone" | "done";

/** The first question to ask after the link, or "done" when nothing is collected. */
export function firstStep(rule: Pick<StoryRule, "collectEmail" | "collectPhone">): LeadStep {
  if (rule.collectEmail) return "email";
  if (rule.collectPhone) return "phone";
  return "done";
}

/** The question after `after` has been answered. */
export function stepAfter(
  after: "email" | "phone",
  rule: Pick<StoryRule, "collectPhone">,
): LeadStep {
  return after === "email" && rule.collectPhone ? "phone" : "done";
}

export const DEFAULT_EMAIL_PROMPT = "Pra eu te mandar novidades, qual é o seu melhor e-mail? 📩";
export const DEFAULT_PHONE_PROMPT = "E qual seu WhatsApp (com DDD)? 📱";
export const DEFAULT_THANKS = "Anotado! Obrigado 🙌";
export const RETRY_EMAIL = "Não consegui entender esse e-mail 😅 Pode mandar de novo? (ex.: nome@email.com)";
export const RETRY_PHONE = "Não consegui entender esse número 😅 Manda com DDD, por favor (ex.: 31 99999-8888)";

export function parseEmail(text: string): string | null {
  const m = text.trim().match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/);
  return m ? m[0].toLowerCase() : null;
}

/** Brazilian-friendly: 10-13 digits (DDD + number, optional +55). Returns digits only. */
export function parsePhone(text: string): string | null {
  const digits = text.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) return null;
  return digits;
}
