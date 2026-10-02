import { describe, expect, it } from "vitest";
import { classifyDevice, classifySource, fillDays, isBot, percent } from "../analytics";

const IG_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605 Mobile/15E148 Instagram 320.0";
const CHROME_DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const CHROME_ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36";

describe("classifySource", () => {
  it("trusts the in-app browser over a missing referrer", () => {
    expect(classifySource("", IG_UA)).toBe("instagram");
    expect(classifySource("", "Mozilla/5.0 musical_ly_30.0")).toBe("tiktok");
  });

  it("reads the referrer for regular browsers", () => {
    expect(classifySource("https://l.instagram.com/?u=x", CHROME_DESKTOP)).toBe("instagram");
    expect(classifySource("https://www.youtube.com/watch", CHROME_DESKTOP)).toBe("youtube");
    expect(classifySource("https://t.co/abc", CHROME_DESKTOP)).toBe("x");
    expect(classifySource("https://wa.me/55", CHROME_ANDROID)).toBe("whatsapp");
    expect(classifySource("https://blog.example.com/post", CHROME_DESKTOP)).toBe("outros");
  });

  it("calls a visit with no referrer direct", () => {
    expect(classifySource("", CHROME_DESKTOP)).toBe("direto");
    expect(classifySource("not a url", CHROME_DESKTOP)).toBe("direto");
  });
});

describe("classifyDevice", () => {
  it("separates phones, tablets and desktops", () => {
    expect(classifyDevice(IG_UA)).toBe("celular");
    expect(classifyDevice(CHROME_ANDROID)).toBe("celular");
    expect(classifyDevice("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe("tablet");
    expect(classifyDevice("Mozilla/5.0 (Linux; Android 13; SM-X700) Chrome/120 Safari")).toBe("tablet");
    expect(classifyDevice(CHROME_DESKTOP)).toBe("desktop");
  });
});

describe("isBot", () => {
  it("flags crawlers and link previews, not people", () => {
    expect(isBot("")).toBe(true);
    expect(isBot("facebookexternalhit/1.1")).toBe(true);
    expect(isBot("WhatsApp/2.23.20 A")).toBe(true);
    expect(isBot("Googlebot/2.1")).toBe(true);
    expect(isBot(IG_UA)).toBe(false);
    expect(isBot(CHROME_ANDROID)).toBe(false);
  });
});

describe("fillDays / percent", () => {
  it("returns every day, oldest first, with zeros for the gaps", () => {
    const now = Date.UTC(2026, 9, 2, 15, 0, 0);
    const out = fillDays([{ day: "2026-10-02", n: 4 }, { day: "2026-09-30", n: 1 }], 4, now);
    expect(out.map((d) => d.day)).toEqual(["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
    expect(out.map((d) => d.n)).toEqual([0, 1, 0, 4]);
  });

  it("computes shares safely", () => {
    expect(percent(1, 3)).toBe(33.3);
    expect(percent(0, 0)).toBeNull();
  });
});
