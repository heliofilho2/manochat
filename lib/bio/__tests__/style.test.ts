import { describe, expect, it } from "vitest";
import { resolveStyle, readableOn } from "../style";
import { DEFAULT_BIO, mergeStyle, socialHref, type BioSettings } from "../theme";

const withStyle = (patch: Partial<BioSettings["style"]>, theme = "papel"): BioSettings => ({
  ...DEFAULT_BIO,
  theme,
  style: { ...DEFAULT_BIO.style, ...patch },
});

describe("bio style", () => {
  it("picks readable text colours", () => {
    expect(readableOn("#ffffff")).toBe("#111111");
    expect(readableOn("#0e2a47")).toBe("#FFFFFF");
    expect(readableOn("nope")).toBe("#111111");
  });

  it("builds wallpapers from the settings", () => {
    const solid = resolveStyle(withStyle({}));
    expect(solid.wallpaper.background).toBe("#F8F5F0");
    const grad = resolveStyle(
      withStyle({ wallpaper: { ...DEFAULT_BIO.style.wallpaper, type: "gradient", color: "#111", color2: "#333", angle: 90 } }),
    );
    expect(grad.wallpaper.background).toBe("linear-gradient(90deg, #111, #333)");
    const blur = resolveStyle(withStyle({ wallpaper: { ...DEFAULT_BIO.style.wallpaper, type: "blur" } }));
    expect(blur.blurPhoto).toBe(true);
    expect(blur.overlay).not.toBeNull();
  });

  it("styles buttons per variant and derives readable text from a custom colour", () => {
    const hard = resolveStyle(withStyle({ button: { ...DEFAULT_BIO.style.button, style: "hard" } }));
    expect(hard.button.boxShadow).toBe("4px 4px 0 #2B2724");
    const fill = resolveStyle(withStyle({ button: { ...DEFAULT_BIO.style.button, color: "#ffffff" } }));
    expect(fill.button.background).toBe("#ffffff");
    expect(fill.button.color).toBe("#111111");
    const glass = resolveStyle(withStyle({ button: { ...DEFAULT_BIO.style.button, style: "glass" } }));
    expect(glass.button.backdropFilter).toBe("blur(12px)");
  });

  it("uses the theme and shape by default and custom text colour when set", () => {
    const r = resolveStyle({ ...withStyle({ textColor: "#ff0000" }, "noite"), shape: "pilula" });
    expect(r.text).toBe("#ff0000");
    expect(r.radius).toBe("999px");
    expect(resolveStyle(withStyle({}, "noite")).text).toBe("#F8F5F0");
  });

  it("fills a partial stored style with the defaults", () => {
    const s = mergeStyle({ font: "serif", button: { style: "soft" } });
    expect(s.font).toBe("serif");
    expect(s.button).toMatchObject({ style: "soft", layout: "list", lift: true });
    expect(s.socials).toEqual([]);
    expect(mergeStyle(null)).toEqual(DEFAULT_BIO.style);
  });

  it("turns social handles into safe links", () => {
    expect(socialHref("instagram", "@ana")).toBe("https://instagram.com/ana");
    expect(socialHref("tiktok", "ana")).toBe("https://tiktok.com/@ana");
    expect(socialHref("email", "a@b.com")).toBe("mailto:a@b.com");
    expect(socialHref("whatsapp", "(31) 99999-8888")).toBe("https://wa.me/5531999998888");
    expect(socialHref("site", "https://x.com/a")).toBe("https://x.com/a");
    expect(socialHref("site", "javascript:alert(1)")).toBeNull();
    expect(socialHref("instagram", "a b<script>")).toBeNull();
  });
});
