import { describe, expect, it } from "vitest";
import { formatFollowers } from "../../format";
import { destinationFor, isStale, withUtm } from "../links";

describe("bio links", () => {
  it("appends the fixed UTM set and keeps existing params", () => {
    const u = new URL(withUtm("https://www.instagram.com/p/abc/?x=1"));
    expect(u.searchParams.get("x")).toBe("1");
    expect(u.searchParams.get("utm_source")).toBe("ig");
    expect(u.searchParams.get("utm_medium")).toBe("social");
    expect(u.searchParams.get("utm_content")).toBe("link_in_bio");
  });

  it("points to the post when scoped to exactly one, else the profile", () => {
    const perma = new Map([["m1", "https://www.instagram.com/reel/xyz/"]]);
    expect(
      destinationFor({ scope: "specific_posts", postIds: ["m1"] }, perma, "ana"),
    ).toBe("https://www.instagram.com/reel/xyz/");
    expect(destinationFor({ scope: "all_posts", postIds: [] }, perma, "ana")).toBe(
      "https://www.instagram.com/ana/",
    );
  });

  it("detects stale caches and formats follower counts", () => {
    expect(isStale(null)).toBe(true);
    expect(isStale(new Date())).toBe(false);
    expect(formatFollowers(950)).toBe("950");
    expect(formatFollowers(1250)).toBe("1,3 mil");
    expect(formatFollowers(48200)).toBe("48,2 mil");
    expect(formatFollowers(3_000_000)).toBe("3 mi");
  });
});
