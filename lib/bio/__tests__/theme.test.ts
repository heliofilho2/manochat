import { describe, expect, it } from "vitest";
import { buildItems, DEFAULT_BIO, safeUrl } from "../theme";

const autos = [
  { id: "a1", name: "Guia", keywords: ["guia"], scope: "specific_posts", postIds: ["p1"] },
  { id: "a2", name: "Sem palavra", keywords: [], scope: "all_posts", postIds: [] },
  { id: "a3", name: "Curso", keywords: ["curso"], scope: "all_posts", postIds: [] },
];

describe("bio items", () => {
  it("keeps automations off the page unless the owner turns them on", () => {
    const manual = [{ id: "m1", label: "Loja", url: "https://loja.com" }];
    expect(buildItems({ ...DEFAULT_BIO, manual }, autos).map((i) => i.id)).toEqual(["m1"]);
  });

  it("lists automations with a keyword plus manual links, honouring order and hidden", () => {
    const items = buildItems(
      {
        ...DEFAULT_BIO,
        style: { ...DEFAULT_BIO.style, showAutomations: true },
        manual: [{ id: "m1", label: "Loja", url: "https://loja.com" }],
        order: ["m1", "a3"],
        hidden: ["a3"],
      },
      autos,
    );
    expect(items.map((i) => i.id)).toEqual(["m1", "a3", "a1"]);
    expect(items.find((i) => i.id === "a3")?.hidden).toBe(true);
    expect(items.find((i) => i.id === "a1")).toMatchObject({ keyword: "GUIA", postId: "p1" });
  });

  it("only allows http(s) URLs", () => {
    expect(safeUrl("https://a.com/x")).toBe("https://a.com/x");
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("nope")).toBeNull();
  });

  it("reads a link typed without the scheme as https", () => {
    expect(safeUrl("www.heliofilho.dev/cofre/x")).toBe("https://www.heliofilho.dev/cofre/x");
    expect(safeUrl("site.com")).toBe("https://site.com/");
  });
});
