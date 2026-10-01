import { describe, expect, it } from "vitest";
import { buildAutomationFunnel, type FunnelAuto } from "../insights/automation-funnel";

const gatedComment: FunnelAuto = { id: "a", name: "Guia", kind: "comment", gated: true };
const openComment: FunnelAuto = { id: "b", name: "Direto", kind: "comment", gated: false };
const story: FunnelAuto = { id: "s", name: "Story", kind: "story", gated: true };

describe("buildAutomationFunnel", () => {
  it("counts delivery on the tap for comment automations with a button", () => {
    const [row] = buildAutomationFunnel(
      [gatedComment],
      [{ automationId: "a", entries: 10, sent: 9 }],
      [{ automationId: "a", taps: 6, linkSent: 4 }],
    );
    expect(row).toMatchObject({ entries: 10, dms: 9, taps: 6, delivered: 4 });
    expect(row.rate).toBe(40);
  });

  it("delivers with the first DM when there is no button step", () => {
    const [row] = buildAutomationFunnel([openComment], [{ automationId: "b", entries: 4, sent: 4 }], []);
    expect(row).toMatchObject({ taps: null, delivered: 4 });
    expect(row.rate).toBe(100);
  });

  it("treats story replies as delivered with the DM", () => {
    const [row] = buildAutomationFunnel([story], [{ automationId: "s", entries: 5, sent: 3 }], [
      { automationId: "s", taps: 1, linkSent: 1 },
    ]);
    expect(row).toMatchObject({ taps: null, delivered: 3 });
  });

  it("hides idle automations and sorts by entries", () => {
    const rows = buildAutomationFunnel(
      [gatedComment, openComment, story],
      [
        { automationId: "a", entries: 2, sent: 2 },
        { automationId: "b", entries: 9, sent: 9 },
      ],
      [],
    );
    expect(rows.map((r) => r.id)).toEqual(["b", "a"]);
  });
});
