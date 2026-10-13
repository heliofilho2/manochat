/**
 * Turns a flow's message block into what Instagram's Send API accepts, and
 * encodes/decodes the postback payload that brings a button tap back to the
 * exact run and block it came from.
 *
 * Pure, like graph.ts, so the wire formats are unit-testable.
 */

import type { Button, OutboundMessage } from "@/lib/instagram/types";
import { safeUrl } from "@/lib/bio/theme";
import type { FlowNode } from "./graph";

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

/** `{nome}`-style placeholders are not supported yet; the text is sent as written. */
export function buildFlowMessage(
  node: Extract<FlowNode, { type: "message" }>,
  runId: string,
): OutboundMessage {
  const text = node.data.text.slice(0, TEXT_MAX);
  const buttons: Button[] = [];
  for (const b of node.data.buttons) {
    const title = b.label.slice(0, TITLE_MAX);
    if (b.url) {
      const url = safeUrl(b.url);
      if (url) buttons.push({ type: "web_url", title, url });
    } else {
      buttons.push({ type: "postback", title, payload: buildFlowPayload({ runId, nodeId: node.id, buttonId: b.id }) });
    }
  }
  if (buttons.length === 0) return { text };
  return {
    attachment: { type: "template", payload: { template_type: "button", text, buttons } },
  };
}

/** The tag a person gets when an A/B draw sends them down a branch. */
export function branchTagName(flowName: string, branchLabel: string): string {
  return `ab:${flowName}:${branchLabel}`.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 80);
}
