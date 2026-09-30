import { describe, expect, it } from "vitest";
import {
  buildLinkMessage,
  buildNotFollower,
  buildOpener,
  decideUnlock,
  isWindowOpen,
  parseUnlockPayload,
  unlockPayload,
  type FlowRule,
} from "../flow";

const rule: FlowRule = {
  id: "auto-1",
  dmText: "Aqui: {link}",
  dmLink: "https://exemplo.com",
  requireFollow: false,
  openerText: null,
  followButtonLabel: "Já sigo ✅",
  notFollowerText: null,
  linkButtonLabel: null,
};

describe("flow messages", () => {
  it("plain rule sends text with the link substituted", () => {
    expect(buildOpener(rule)).toEqual({ text: "Aqui: https://exemplo.com" });
  });

  it("an opener text adds the button even without the follow gate", () => {
    const msg = buildOpener({ ...rule, openerText: "Toca aqui" });
    const json = JSON.stringify(msg);
    expect(json).toContain(unlockPayload("auto-1"));
    expect(json).not.toContain("exemplo.com");
    // ...and the tap releases the link with no follow check.
    expect(decideUnlock(false, false)).toBe("send_link");
    expect(decideUnlock(false, true)).toBe("ask_follow");
  });

  it("follow gate opener has only a postback button and never leaks the link", () => {
    const msg = buildOpener({ ...rule, requireFollow: true });
    const json = JSON.stringify(msg);
    expect(json).toContain(unlockPayload("auto-1"));
    expect(json).not.toContain("exemplo.com");
  });

  it("link button moves the URL onto a web_url button", () => {
    const msg = buildLinkMessage({ ...rule, linkButtonLabel: "Acessar" });
    const json = JSON.stringify(msg);
    expect(json).toContain('"type":"web_url"');
    expect(json).toContain('"url":"https://exemplo.com"');
    expect(json).not.toContain("{link}");
  });

  it("clips button titles to Meta's 20-char limit", () => {
    const msg = buildNotFollower({ ...rule, followButtonLabel: "x".repeat(40) });
    const title = (msg as { attachment: { payload: { buttons: { title: string }[] } } })
      .attachment.payload.buttons[0].title;
    expect(title).toHaveLength(20);
  });

  it("round-trips the unlock payload and rejects foreign ones", () => {
    expect(parseUnlockPayload(unlockPayload("abc"))).toBe("abc");
    expect(parseUnlockPayload("other:abc")).toBeNull();
    expect(parseUnlockPayload(undefined)).toBeNull();
  });

  it("only followers get the link", () => {
    expect(decideUnlock(true)).toBe("send_link");
    expect(decideUnlock(false)).toBe("ask_follow");
  });

  it("enforces the 24h window", () => {
    const now = new Date("2026-01-02T00:00:00Z");
    expect(isWindowOpen(new Date("2026-01-02T01:00:00Z"), now)).toBe(true);
    expect(isWindowOpen(new Date("2026-01-01T23:00:00Z"), now)).toBe(false);
    expect(isWindowOpen(null, now)).toBe(false);
  });
});
