import { describe, expect, it } from "vitest";
import { cooldownMs, evaluateHealth, isExpectedFailure, type HealthInput } from "../health";

const NOW = Date.UTC(2026, 9, 1, 12, 0, 0);
const DAY = 86_400_000;
const base: HealthInput = { now: NOW, dead: [], stuck: { count: 0, oldestAt: null }, tokens: [] };

describe("isExpectedFailure", () => {
  it("treats user-side and test failures as normal", () => {
    expect(isExpectedFailure("The thread owner has archived or deleted this conversation")).toBe(true);
    expect(isExpectedFailure("Private reply window (7 days) expired.")).toBe(true);
    expect(isExpectedFailure("No connected account for Instagram id 0")).toBe(true);
  });
  it("treats everything else as real", () => {
    expect(isExpectedFailure("Invalid OAuth access token")).toBe(false);
    expect(isExpectedFailure(null)).toBe(false);
  });
});

describe("evaluateHealth", () => {
  it("is quiet when all is well", () => {
    expect(evaluateHealth({ ...base, tokens: [{ username: "a", expiresAt: NOW + 40 * DAY }] })).toEqual([]);
  });

  it("ignores expected dead events but flags real ones", () => {
    const quiet = evaluateHealth({ ...base, dead: [{ error: "archived or deleted" }] });
    expect(quiet).toEqual([]);
    const loud = evaluateHealth({ ...base, dead: [{ error: "archived or deleted" }, { error: "Invalid OAuth access token" }] });
    expect(loud).toHaveLength(1);
    expect(loud[0]).toMatchObject({ key: "dead", severity: "error" });
    expect(loud[0].title).toContain("1 evento");
    expect(loud[0].detail).toContain("Invalid OAuth");
  });

  it("flags events stuck for a long time", () => {
    const out = evaluateHealth({ ...base, stuck: { count: 3, oldestAt: NOW - 45 * 60_000 } });
    expect(out[0]).toMatchObject({ key: "stuck", severity: "error" });
    expect(out[0].title).toContain("45 min");
  });

  it("escalates token expiry", () => {
    const warn = evaluateHealth({ ...base, tokens: [{ username: "a", expiresAt: NOW + 5 * DAY }] });
    expect(warn[0]).toMatchObject({ key: "token:a", severity: "warn" });
    const err = evaluateHealth({ ...base, tokens: [{ username: "a", expiresAt: NOW + 1 * DAY }] });
    expect(err[0].severity).toBe("error");
    const expired = evaluateHealth({ ...base, tokens: [{ username: "a", expiresAt: NOW - 1000 }] });
    expect(expired[0].title).toContain("venceu");
  });

  it("alerts errors more often than warnings", () => {
    expect(cooldownMs("error")).toBeLessThan(cooldownMs("warn"));
  });
});
