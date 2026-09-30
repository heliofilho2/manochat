import { describe, expect, it } from "vitest";
import { findMissedTappers } from "./missed";

const LINK = "https://example.com/x?a=1";
const tap = (id: string, ts: number, auto = "A1") => ({
  entry: [{ id: "biz", messaging: [{ sender: { id }, timestamp: ts, postback: { payload: `unlock:${auto}` } }] }],
});
const echo = (to: string, ts: number, body: unknown) => ({
  entry: [{ id: "biz", messaging: [{ sender: { id: "biz" }, recipient: { id: to }, timestamp: ts, message: { is_echo: true, ...(body as object) } }] }],
});

describe("findMissedTappers", () => {
  it("flags a tapper who only got the follow prompt", () => {
    const out = findMissedTappers([tap("u1", 1000), echo("u1", 1500, { text: "Siga primeiro" })], "A1", LINK);
    expect(out).toEqual([{ igsid: "u1", lastTapAt: 1000 }]);
  });

  it("does not flag someone whose echo carries the link (text or button)", () => {
    const withText = findMissedTappers([tap("u1", 1000), echo("u1", 1500, { text: `veja ${LINK}` })], "A1", LINK);
    const withButton = findMissedTappers(
      [tap("u2", 1000), echo("u2", 1600, { attachments: [{ payload: { buttons: [{ url: LINK }] } }] })],
      "A1",
      LINK,
    );
    expect(withText).toEqual([]);
    expect(withButton).toEqual([]);
  });

  it("ignores other automations and links that were sent before the first tap", () => {
    expect(findMissedTappers([tap("u1", 1000, "OTHER")], "A1", LINK)).toEqual([]);
    const early = findMissedTappers([echo("u1", 100, { text: LINK }), tap("u1", 90000)], "A1", LINK);
    expect(early).toHaveLength(1);
  });

  it("uses the latest tap and orders newest first", () => {
    const out = findMissedTappers([tap("u1", 1000), tap("u1", 5000), tap("u2", 3000)], "A1", LINK);
    expect(out.map((o) => [o.igsid, o.lastTapAt])).toEqual([["u1", 5000], ["u2", 3000]]);
  });
});
