import { describe, expect, it } from "vitest";
import { computeInsights, localParts, themeOf } from "../insights";

describe("windsor insights", () => {
  it("converts UTC to São Paulo hour/weekday", () => {
    // 2026-03-02 (Mon) 21:00 UTC = 18:00 Mon in BRT (UTC-3)
    expect(localParts("2026-03-02T21:00:00Z")).toEqual({ hour: 18, weekday: 1 });
  });

  it("extracts the first hashtag as theme", () => {
    expect(themeOf("Novo post #Automação #ig")).toBe("#automação");
    expect(themeOf("sem hashtag")).toBeNull();
  });

  it("ranks by conversions per reach", () => {
    const rows = [
      { media_id: "a", media_type: "IMAGE", timestamp: "2026-03-02T21:00:00Z", media_reach: 1000 },
      { media_id: "b", media_type: "VIDEO", media_product_type: "REELS", timestamp: "2026-03-03T13:00:00Z", media_reach: 1000 },
    ];
    const r = computeInsights(rows, new Map([["a", 5], ["b", 20]]));
    expect(r.byFormat[0].key).toBe("REEL");
    expect(r.byHour[0].key).toBe("10h");
  });
});
