import { describe, expect, it } from "vitest";
import { branchTagName, buildFlowMessage, buildFlowPayload, parseFlowPayload } from "../message";

const node = (buttons: { id: string; label: string; url?: string }[], text = "Oi!") => ({
  id: "m1",
  type: "message" as const,
  data: { text, buttons },
});

describe("flow messages", () => {
  it("round-trips a tap payload", () => {
    const tap = { runId: "r-1", nodeId: "m1", buttonId: "b1" };
    expect(parseFlowPayload(buildFlowPayload(tap))).toEqual(tap);
  });

  it("ignores payloads that are not flow taps", () => {
    expect(parseFlowPayload("unlock:abc")).toBeNull();
    expect(parseFlowPayload("flow:only-two:parts")).toBeNull();
    expect(parseFlowPayload("flow:a:b:c:d")).toBeNull();
  });

  it("sends plain text when there are no buttons", () => {
    expect(buildFlowMessage(node([]), "r1")).toEqual({ text: "Oi!" });
  });

  it("builds a button template with postback and link buttons", () => {
    const msg = buildFlowMessage(
      node([
        { id: "b1", label: "Quero" },
        { id: "b2", label: "Site", url: "www.a.com/x" },
      ]),
      "r1",
    );
    expect(msg).toEqual({
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: "Oi!",
          buttons: [
            { type: "postback", title: "Quero", payload: "flow:r1:m1:b1" },
            { type: "web_url", title: "Site", url: "https://www.a.com/x" },
          ],
        },
      },
    });
  });

  it("drops a link button whose URL is unusable, and falls back to text if none remain", () => {
    expect(buildFlowMessage(node([{ id: "b", label: "X", url: "javascript:alert(1)" }]), "r")).toEqual({ text: "Oi!" });
  });

  it("clips long text and titles to Meta's limits", () => {
    const msg = buildFlowMessage(node([{ id: "b", label: "a".repeat(30) }], "x".repeat(700)), "r");
    if (!("attachment" in msg)) throw new Error("expected template");
    expect(msg.attachment.payload.text).toHaveLength(640);
    expect(msg.attachment.payload.buttons[0].title).toHaveLength(20);
  });

  it("names branch tags predictably", () => {
    expect(branchTagName("Teste  Book", "R$7,90")).toBe("ab:teste book:r$7,90");
  });
});
