import { describe, expect, it } from "vitest";
import { addKeywords, BLANK_DRAFT, fromRow, toRowFields, validate } from "../draft";

const valid = {
  ...BLANK_DRAFT,
  name: "Guia",
  keywords: ["GUIA"],
  postIds: ["p1"],
  url: "https://site.com.br/guia",
};

describe("automation draft", () => {
  it("accepts a complete draft", () => {
    expect(validate(valid)).toEqual({});
  });

  it("reports each problem with the step it belongs to", () => {
    const e = validate({ ...BLANK_DRAFT });
    expect(e.name?.[0]).toBe(0);
    expect(e.keywords?.[0]).toBe(1);
    expect(e.postIds?.[0]).toBe(2);
    expect(e.url?.[0]).toBe(5);
  });

  it("needs {link} in the delivery message unless a link button is on", () => {
    expect(validate({ ...valid, dmFollower: "Oi", linkButton: false }).dmFollower?.[0]).toBe(4);
    expect(validate({ ...valid, dmFollower: "Oi", linkButton: true }).dmFollower).toBeUndefined();
  });

  it("does not require the not-follower message when the gate is off", () => {
    expect(validate({ ...valid, requireFollow: false, dmNonFollower: "" })).toEqual({});
  });

  it("normalises keywords", () => {
    expect(addKeywords(["A"], " #guia, a, Receita ")).toEqual(["A", "GUIA", "RECEITA"]);
  });

  it("round-trips through the row shape", () => {
    const fields = toRowFields(valid);
    expect(fields).toMatchObject({
      matchMode: "exact_word",
      scope: "specific_posts",
      dmText: "Aqui está: {link}",
      openerText: valid.dmInitial,
      linkButtonLabel: "Abrir link",
    });
    const back = fromRow({ id: "x", status: "live", ...fields, dmLink: fields.dmLink });
    expect(back).toMatchObject({ status: "active", match: "exact", target: "specific", linkButton: true });
  });

  it("clears the link button label when the button is off", () => {
    expect(toRowFields({ ...valid, linkButton: false }).linkButtonLabel).toBeNull();
  });
});
