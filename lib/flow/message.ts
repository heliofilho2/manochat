/**
 * Turns a flow's message block into what Instagram's Send API accepts, and
 * encodes/decodes the ids that bring a button tap or a link click back to the
 * exact run and block it came from.
 *
 * Pure, like graph.ts, so the wire formats are unit-testable.
 */

import type { Button, OutboundMessage } from "@/lib/instagram/types";
import { safeUrl } from "@/lib/bio/theme";
import { renderText, type FlowNode } from "./graph";

export const FLOW_PREFIX = "flow:";
/** Template text is capped at 640 chars by Meta; titles at 20. */
const TEXT_MAX = 640;
const TITLE_MAX = 20;

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
  username: string | null;
}

export function buildFlowMessage(
  node: Extract<FlowNode, { type: "message" }>,
  runId: string,
  opts: BuildOptions = { baseUrl: null, username: null },
): OutboundMessage {
  const text = renderText(node.data.text, opts.username).slice(0, TEXT_MAX);
  const buttons: Button[] = [];
  for (const b of node.data.buttons) {
    const title = b.label.slice(0, TITLE_MAX);
    if (b.url !== undefined) {
      const url = safeUrl(b.url);
      if (!url) continue;
      const tap = { runId, nodeId: node.id, buttonId: b.id };
      buttons.push({ type: "web_url", title, url: opts.baseUrl ? `${opts.baseUrl}/r/${trackedLinkId(tap)}` : url });
    } else {
      buttons.push({ type: "postback", title, payload: buildFlowPayload({ runId, nodeId: node.id, buttonId: b.id }) });
    }
  }
  if (buttons.length === 0) return { text };
  return {
    attachment: { type: "template", payload: { template_type: "button", text, buttons } },
  };
}

/** The image that goes before the text, when the block has one. */
export function buildImageMessage(node: Extract<FlowNode, { type: "message" }>): OutboundMessage | null {
  const url = node.data.imageUrl ? safeUrl(node.data.imageUrl) : null;
  return url ? { attachment: { type: "image", payload: { url } } } : null;
}

/** The tag a person gets when an A/B draw sends them down a branch. */
export function branchTagName(flowName: string, branchLabel: string): string {
  return `ab:${flowName}:${branchLabel}`.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 80);
}
