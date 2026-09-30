import { describe, expect, it } from "vitest";
import {
  addKeywords,
  BLANK_DRAFT,
  BLANK_STORY_DRAFT,
  fromRow,
  toRowFields,
  validate,
} from "../draft";

const valid = {
  ...BLANK_DRAFT,
  name: "Guia",
  keywords: ["GUIA"],
  postIds: ["p1"],
  url: "https://site.com.br/guia",
};

const validStory = {
  ...BLANK_STORY_DRAFT,
  name: "Story",
  url: "https://site.com.br/guia",
};

describe("comment draft", () => {
  it("accepts a complete draft", () => {
    expect(validate(valid)).toEqual({});
  });

  it("reports each problem with the step it belongs to", () => {
    const e = validate({ ...BLANK_DRAFT });
    expect(e.name?.[0]).toBe("name");
    expect(e.keywords?.[0]).toBe("words");
    expect(e.postIds?.[0]).toBe("posts");
    expect(e.url?.[0]).toBe("link");
  });

  it("needs {link} in the delivery message unless a link button is on", () => {
    expect(validate({ ...valid, dmFollower: "Oi", linkButton: false }).dmFollower?.[0]).toBe("messages");
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
      kind: "comment",
      matchMode: "exact_word",
      scope: "specific_posts",
      dmText: "Aqui está: {link}",
      openerText: valid.dmInitial,
      linkButtonLabel: "Abrir link",
      reactHeart: false,
    });
    const back = fromRow({ id: "x", status: "live", ...fields, dmLink: fields.dmLink });
    expect(back).toMatchObject({ status: "active", match: "exact", target: "specific", linkButton: true });
  });

  it("clears the link button label when the button is off", () => {
    expect(toRowFields({ ...valid, linkButton: false }).linkButtonLabel).toBeNull();
  });
});

describe("story draft", () => {
  it("accepts any reply with a link and no keywords", () => {
    expect(validate(validStory)).toEqual({});
  });

  it("asks for words only when not answering any reply", () => {
    expect(validate({ ...validStory, anyWords: false }).keywords?.[0]).toBe("words");
    expect(validate({ ...validStory, anyWords: false, keywords: ["QUERO"] })).toEqual({});
  });

  it("needs a story when the scope is specific", () => {
    expect(validate({ ...validStory, target: "specific" }).postIds?.[0]).toBe("story");
  });

  it("needs the not-follower message only with the follow gate", () => {
    expect(validate({ ...validStory, requireFollow: true, dmNonFollower: "" }).dmNonFollower?.[0]).toBe("extras");
    expect(validate({ ...validStory, requireFollow: false, dmNonFollower: "" })).toEqual({});
  });

  it("stores story specifics: no keywords for any-reply, no opener, no public reply", () => {
    const f = toRowFields({ ...validStory, collectEmail: true, target: "specific", postIds: ["s1"] });
    expect(f).toMatchObject({
      kind: "story",
      keywords: [],
      scope: "specific_posts",
      postIds: ["s1"],
      openerText: null,
      replyEnabled: false,
      reactHeart: true,
      collectEmail: true,
    });
    const back = fromRow({ id: "x", status: "draft", ...f });
    expect(back).toMatchObject({ kind: "story", anyWords: true, collectEmail: true });
  });
});
