import { describe, expect, it } from "vitest";
import { dayLabel, friendlyReason, hoursLeft, overallOf, stepOf } from "../inbox";

describe("inbox helpers", () => {
  it("maps stored statuses to steps and an overall state", () => {
    expect(stepOf("sent")).toBe("sent");
    expect(stepOf("dead")).toBe("failed");
    expect(stepOf("skipped")).toBe("off");
    expect(stepOf("pending")).toBe("pending");
    expect(overallOf("sent", "failed")).toBe("failed");
    expect(overallOf("off", "pending")).toBe("pending");
    expect(overallOf("off", "sent")).toBe("sent");
  });

  it("explains known errors in plain Portuguese and passes unknown ones through", () => {
    expect(friendlyReason("sent", "failed", null, "Error validating access token: Session has expired")).toMatch(
      /expirada/,
    );
    expect(friendlyReason("failed", "sent", "Object with ID '1' does not exist", null)).toMatch(/apagado/);
    expect(friendlyReason("sent", "pending", null, "(#4) Application request limit reached")).toMatch(/limitou/);
    expect(friendlyReason("sent", "failed", null, "Weird thing")).toBe("Weird thing");
    expect(friendlyReason("sent", "sent", null, null)).toBe("");
  });

  it("labels days relative to now", () => {
    const now = new Date("2026-09-30T15:00:00Z");
    expect(dayLabel(new Date("2026-09-30T13:00:00Z"), now)).toBe("HOJE");
    expect(dayLabel(new Date("2026-09-29T13:00:00Z"), now)).toBe("ONTEM");
  });

  it("rounds the messaging window up to whole hours", () => {
    const now = Date.parse("2026-09-30T12:00:00Z");
    expect(hoursLeft(new Date("2026-09-30T12:30:00Z"), now)).toBe(1);
    expect(hoursLeft(new Date("2026-09-30T11:00:00Z"), now)).toBe(0);
    expect(hoursLeft(null, now)).toBe(0);
  });
});
