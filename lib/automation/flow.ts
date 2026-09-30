/**
 * Message construction and gating rules for one automation.
 *
 * Pure and dependency-free (like matcher.ts) so every rule that decides
 * "what does a stranger receive, and when" is unit-testable.
 *
 * Flow when the opener has a button (`requireFollow`, or an opener text):
 *   comment → opener DM with a postback button
 *   button tapped → if `requireFollow`, is_user_follow_business check
 *     follower (or no gate) → link message (optionally with a URL button)
 *     not follower          → "follow me first" message, same button again
 */

import { renderDm } from "./matcher";
import type { Button, OutboundMessage } from "@/lib/instagram/types";

export const UNLOCK_PREFIX = "unlock:";
/** Meta's standard messaging window after the user's last interaction. */
export const MESSAGING_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Button titles are capped at 20 chars by Meta; template text at 640. */
const TITLE_MAX = 20;
const TEXT_MAX = 640;

export interface FlowRule {
  id: string;
  dmText: string;
  dmLink: string | null;
  requireFollow: boolean;
  openerText: string | null;
  followButtonLabel: string;
  notFollowerText: string | null;
  linkButtonLabel: string | null;
}

export const DEFAULT_OPENER = "Oi! Toque no botão abaixo para receber o link 👇";
export const DEFAULT_NOT_FOLLOWER =
  "Ainda não vi você por aqui 👀 Siga o perfil e toque no botão de novo para receber o link!";

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s);

export function unlockPayload(automationId: string): string {
  return `${UNLOCK_PREFIX}${automationId}`;
}

export function parseUnlockPayload(payload: string | undefined): string | null {
  if (!payload?.startsWith(UNLOCK_PREFIX)) return null;
  return payload.slice(UNLOCK_PREFIX.length) || null;
}

function withButtons(text: string, buttons: Button[]): OutboundMessage {
  return {
    attachment: {
      type: "template",
      payload: {
        template_type: "button",
        text: clip(text, TEXT_MAX),
        buttons,
      },
    },
  };
}

function followButton(rule: FlowRule): Button {
  return {
    type: "postback",
    title: clip(rule.followButtonLabel || "Já sigo ✅", TITLE_MAX),
    payload: unlockPayload(rule.id),
  };
}

/** The message that carries the link itself. */
export function buildLinkMessage(rule: FlowRule): OutboundMessage {
  if (rule.linkButtonLabel && rule.dmLink) {
    // With a URL button the link lives on the button, not in the body.
    const body = renderDm(rule.dmText, "").replace(/[ \t]+\n/g, "\n").trim();
    return withButtons(body || "Aqui está 👇", [
      { type: "web_url", url: rule.dmLink, title: clip(rule.linkButtonLabel, TITLE_MAX) },
    ]);
  }
  return { text: renderDm(rule.dmText, rule.dmLink) };
}

/**
 * Whether the first DM carries a button. The follow gate needs one; so does
 * any automation that has an opener text (the editor always writes one), in
 * which case the tap simply releases the link without a follow check.
 */
export function usesOpenerButton(rule: FlowRule): boolean {
  return rule.requireFollow || Boolean(rule.openerText);
}

/** The first DM, sent as the private reply to the comment. */
export function buildOpener(rule: FlowRule): OutboundMessage {
  if (usesOpenerButton(rule)) {
    return withButtons(rule.openerText || DEFAULT_OPENER, [followButton(rule)]);
  }
  return buildLinkMessage(rule);
}

export function buildNotFollower(rule: FlowRule): OutboundMessage {
  return withButtons(rule.notFollowerText || DEFAULT_NOT_FOLLOWER, [followButton(rule)]);
}

export type UnlockDecision = "send_link" | "ask_follow";

export function decideUnlock(isFollower: boolean, requireFollow = true): UnlockDecision {
  return !requireFollow || isFollower ? "send_link" : "ask_follow";
}

/** Whether a free-form (non private-reply) DM is allowed right now. */
export function isWindowOpen(expiresAt: Date | null, now = new Date()): boolean {
  return expiresAt !== null && expiresAt.getTime() > now.getTime();
}
