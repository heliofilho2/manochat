/**
 * Turns a flow's blocks into what Instagram's Send API accepts, and
 * encodes/decodes the ids that bring a tap or a link click back to the exact
 * run and block it came from.
 *
 * Pure, like graph.ts, so the wire formats are unit-testable.
 */

import type { Button, GenericElement, OutboundMessage } from "@/lib/instagram/types";
import { safeUrl } from "@/lib/bio/theme";
import { renderText, type FlowNode, type MessageButton, type TextContext } from "./graph";

export const FLOW_PREFIX = "flow:";
/** Template text is capped at 640 chars by Meta; titles at 20; card texts at 80. */
const TEXT_MAX = 640;
const TITLE_MAX = 20;
const CARD_MAX = 80;

export interface FlowTap {
  runId: string;
  nodeId: string;
  buttonId: string;
}

export function buildFlowPayload(tap: FlowTap): string {
  return `${FLOW_PREFIX}${tap.runId}:${tap.nodeId}:${tap.buttonId}`;
}

/** Null when the payload is not ours (e.g. the older "unlock:" buttons). */
export function parseFlowPayload(payload: string): FlowTap | null {
  if (!payload.startsWith(FLOW_PREFIX)) return null;
  const [runId, nodeId, buttonId, ...rest] = payload.slice(FLOW_PREFIX.length).split(":");
  if (!runId || !nodeId || !buttonId || rest.length > 0) return null;
  return { runId, nodeId, buttonId };
}

/** Path segment of the click tracker (/r/<id>) for a link button sent in a run. */
export function trackedLinkId(tap: FlowTap): string {
  return `f-${tap.runId}.${tap.nodeId}.${tap.buttonId}`;
}

export function parseTrackedLinkId(id: string): FlowTap | null {
  if (!id.startsWith("f-")) return null;
  const [runId, nodeId, buttonId, ...rest] = id.slice(2).split(".");
  if (!runId || !nodeId || !buttonId || rest.length > 0) return null;
  return { runId, nodeId, buttonId };
}

/** The per-flow key clicks are counted under (runs come and go, the button stays). */
export function clickKey(flowId: string, nodeId: string, buttonId: string): string {
  return `f-${flowId}.${nodeId}.${buttonId}`;
}

export interface BuildOptions {
  /** Base of the click tracker, e.g. https://app.oslinke.com. Null sends the raw link. */
  baseUrl: string | null;
  /** Placeholders ({usuario}, {nome}, {campo:x}…); a bare string is the username. */
  text?: TextContext;
  /** @deprecated use `text` */
  username?: string | null;
}

function link(url: string, runId: string, nodeId: string, buttonId: string, baseUrl: string | null): string | null {
  const safe = safeUrl(url);
  if (!safe) return null;
  return baseUrl ? `${baseUrl}/r/${trackedLinkId({ runId, nodeId, buttonId })}` : safe;
}

function toButtons(buttons: MessageButton[], runId: string, nodeId: string, baseUrl: string | null): Button[] {
  const out: Button[] = [];
  for (const b of buttons) {
    const title = b.label.slice(0, TITLE_MAX);
    if (b.url !== undefined) {
      const url = link(b.url, runId, nodeId, b.id, baseUrl);
      if (url) out.push({ type: "web_url", title, url });
    } else {
      out.push({ type: "postback", title, payload: buildFlowPayload({ runId, nodeId, buttonId: b.id }) });
    }
  }
  return out;
}

export function buildFlowMessage(
  node: Extract<FlowNode, { type: "message" }>,
  runId: string,
  opts: BuildOptions = { baseUrl: null },
): OutboundMessage {
  const ctx = opts.text ?? { username: opts.username ?? null };
  const text = renderText(node.data.text, ctx).slice(0, TEXT_MAX);

  const quick = node.data.quickReplies ?? [];
  if (quick.length > 0 && node.data.buttons.length === 0) {
    return {
      text,
      quick_replies: quick.map((q) => ({
        content_type: "text" as const,
        title: q.label.slice(0, TITLE_MAX),
        payload: buildFlowPayload({ runId, nodeId: node.id, buttonId: q.id }),
      })),
    };
  }

  const buttons = toButtons(node.data.buttons, runId, node.id, opts.baseUrl);
  if (buttons.length === 0) return { text };
  return { attachment: { type: "template", payload: { template_type: "button", text, buttons } } };
}

/** A carousel of cards (Meta's generic template). */
export function buildCardsMessage(
  node: Extract<FlowNode, { type: "cards" }>,
  runId: string,
  opts: BuildOptions = { baseUrl: null },
): OutboundMessage {
  const ctx = opts.text ?? { username: opts.username ?? null };
  const elements: GenericElement[] = node.data.cards.map((c) => {
    const el: GenericElement = { title: renderText(c.title, ctx).slice(0, CARD_MAX) || "…" };
    const subtitle = renderText(c.subtitle, ctx).slice(0, CARD_MAX);
    if (subtitle) el.subtitle = subtitle;
    const image = c.imageUrl ? safeUrl(c.imageUrl) : null;
    if (image) el.image_url = image;
    const open = c.url ? link(c.url, runId, node.id, c.id, opts.baseUrl) : null;
    if (open) el.default_action = { type: "web_url", url: open };
    const buttons = toButtons(c.buttons, runId, node.id, opts.baseUrl);
    if (buttons.length) el.buttons = buttons;
    return el;
  });
  return { attachment: { type: "template", payload: { template_type: "generic", elements } } };
}

/** An image, video or audio by link. */
export function buildMediaMessage(node: Extract<FlowNode, { type: "media" }>): OutboundMessage | null {
  const url = safeUrl(node.data.url);
  return url ? { attachment: { type: node.data.kind, payload: { url } } } : null;
}

/** The image that goes before a message's text, when it has one. */
export function buildImageMessage(node: Extract<FlowNode, { type: "message" }>): OutboundMessage | null {
  const url = node.data.imageUrl ? safeUrl(node.data.imageUrl) : null;
  return url ? { attachment: { type: "image", payload: { url } } } : null;
}

/** Where a tracked click goes: a link button (message or card) or a card's own link. */
export function linkTarget(node: FlowNode, buttonId: string): string | null {
  if (node.type === "message") {
    const b = node.data.buttons.find((x) => x.id === buttonId && x.url !== undefined);
    return b?.url ? safeUrl(b.url) : null;
  }
  if (node.type === "cards") {
    for (const c of node.data.cards) {
      if (c.id === buttonId && c.url) return safeUrl(c.url);
      const b = c.buttons.find((x) => x.id === buttonId && x.url !== undefined);
      if (b?.url) return safeUrl(b.url);
    }
  }
  return null;
}

/** The tag a person gets when an A/B draw sends them down a branch. */
export function branchTagName(flowName: string, branchLabel: string): string {
  return `ab:${flowName}:${branchLabel}`.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 80);
}
