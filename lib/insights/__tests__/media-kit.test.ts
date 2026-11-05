import { describe, expect, it } from "vitest";
import {
  ageSlices,
  captionTitle,
  cityName,
  dailyFrom,
  followsFrom,
  reelSummary,
  sumAdditive,
  toSlices,
  totalsFrom,
  type MediaStat,
} from "../media-kit";

describe("media kit", () => {
  it("reads total_value metrics and leaves missing ones null", () => {
    const t = totalsFrom([
      { name: "views", total_value: { value: 5_100_000 } },
      { name: "accounts_engaged", total_value: { value: 400_000 } },
      { name: "saves", total_value: { value: 120_000 } },
    ]);
    expect(t.views).toBe(5_100_000);
    expect(t.accountsEngaged).toBe(400_000);
    expect(t.saves).toBe(120_000);
    expect(t.reach).toBeNull();
  });

  it("sums only additive metrics and refuses a half sum", () => {
    const a = totalsFrom([
      { name: "views", total_value: { value: 10 } },
      { name: "shares", total_value: { value: 2 } },
    ]);
    const b = totalsFrom([{ name: "views", total_value: { value: 5 } }]);
    const s = sumAdditive(a, b);
    expect(s.views).toBe(15);
    expect(s.shares).toBeNull();
  });

  it("splits follows and unfollows", () => {
    const f = followsFrom([
      {
        name: "follows_and_unfollows",
        total_value: {
          breakdowns: [
            {
              dimension_keys: ["follow_type"],
              results: [
                { dimension_values: ["FOLLOWER"], value: 27_000 },
                { dimension_values: ["NON_FOLLOWER"], value: 2_000 },
              ],
            },
          ],
        },
      },
    ]);
    expect(f).toEqual({ follows: 27_000, unfollows: 2_000, net: 25_000 });
    expect(followsFrom([])).toBeNull();
  });

  it("labels each daily value with the day it closes", () => {
    const d = dailyFrom({
      name: "reach",
      values: [
        { value: 100, end_time: "2026-10-07T07:00:00+0000" },
        { value: 200, end_time: "2026-10-08T07:00:00+0000" },
      ],
    });
    expect(d).toEqual([
      { date: "2026-10-06", value: 100 },
      { date: "2026-10-07", value: 200 },
    ]);
  });

  it("turns counts into percentages and keeps ages in order", () => {
    const ages = ageSlices([
      { key: "45-54", value: 252 },
      { key: "18-24", value: 56 },
      { key: "65+", value: 113 },
      { key: "25-34", value: 156 },
    ]);
    expect(ages.map((a) => a.key)).toEqual(["18-24", "25-34", "45-54", "65+"]);
    const g = toSlices([
      { key: "M", value: 48 },
      { key: "F", value: 43 },
      { key: "U", value: 9 },
    ]);
    expect(g[0]).toEqual({ key: "M", value: 48, pct: 48 });
    expect(toSlices([])).toEqual([]);
  });

  it("cleans city names", () => {
    expect(cityName("São Paulo, São Paulo (state)")).toBe("São Paulo");
  });

  it("builds a title from the caption", () => {
    expect(
      captionTitle("O Elon Musk saiu em lua de mel como CEO do PayPal e voltou sem o cargo. 🕴️\n\nQuem tirou ele…"),
    ).toBe("O Elon Musk saiu em lua de mel como CEO do PayPal e voltou sem o cargo.");
    expect(captionTitle("この文を翻訳したのなら、私についてこなければなりません。@heliofilhou\n\nA maioria das pessoas nunca lê a legenda embaixo de um meme. É isso.")).toBe(
      "A maioria das pessoas nunca lê a legenda embaixo de um meme.",
    );
    expect(captionTitle("Estão vibe codando remédios 😭🙏 #ia #tecnologia")).toBe("Estão vibe codando remédios 😭🙏");
    expect(captionTitle(null)).toBe("");
  });

  it("summarizes reels and engagement", () => {
    const m = (id: string, views: number, reach: number, interactions: number, type = "REELS"): MediaStat => ({
      id,
      caption: `Vídeo ${id} com uma frase longa o bastante para virar título.`,
      permalink: `https://instagram.com/reel/${id}`,
      thumbnailUrl: null,
      timestamp: "2026-10-10T12:00:00Z",
      productType: type,
      views,
      reach,
      saves: 10,
      shares: 5,
      interactions,
    });
    const s = reelSummary(
      [m("a", 1_240_000, 900_000, 150_000), m("b", 210_000, 150_000, 20_000), m("c", 90_000, 60_000, 5_000), m("d", 0, 20_000, 2_000, "FEED")],
      113_000,
    );
    expect(s.over100k).toBe(2);
    expect(s.over200k).toBe(2);
    expect(s.top.map((t) => t.id)).toEqual(["a", "b", "c"]);
    expect(s.reelInteractionRate).toBe(15.8);
    expect(s.engagementPerPost).toBe(39.2);
    expect(reelSummary([], null).engagementPerPost).toBeNull();
  });
});
