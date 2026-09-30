import { describe, expect, it } from "vitest";
import {
  firstStep,
  matchStoryReply,
  parseEmail,
  parsePhone,
  stepAfter,
  type StoryRule,
} from "../story";

const base: StoryRule = {
  id: "s1",
  kind: "story",
  status: "live",
  keywords: [],
  matchMode: "exact_word",
  scope: "all_posts",
  postIds: [],
  collectEmail: false,
  collectPhone: false,
};

describe("story matching", () => {
  it("any reply matches a rule without keywords", () => {
    expect(matchStoryReply([base], { text: "🔥🔥", storyId: "x" })?.trigger).toBe("🔥🔥");
  });

  it("keywords are matched like comments", () => {
    const rule = { ...base, keywords: ["quero"] };
    expect(matchStoryReply([rule], { text: "Quero!!", storyId: null })?.trigger).toBe("quero");
    expect(matchStoryReply([rule], { text: "talvez", storyId: null })).toBeNull();
  });

  it("a specific-story rule needs that story", () => {
    const rule = { ...base, scope: "specific_posts", postIds: ["st1"] };
    expect(matchStoryReply([rule], { text: "oi", storyId: "st1" })).not.toBeNull();
    expect(matchStoryReply([rule], { text: "oi", storyId: "st2" })).toBeNull();
    expect(matchStoryReply([rule], { text: "oi", storyId: null })).toBeNull();
  });

  it("ignores comment rules and paused rules", () => {
    expect(matchStoryReply([{ ...base, kind: "comment" }], { text: "oi", storyId: null })).toBeNull();
    expect(matchStoryReply([{ ...base, status: "paused" }], { text: "oi", storyId: null })).toBeNull();
  });
});

describe("lead questions", () => {
  it("walks email then phone, or skips what is off", () => {
    expect(firstStep({ collectEmail: true, collectPhone: true })).toBe("email");
    expect(firstStep({ collectEmail: false, collectPhone: true })).toBe("phone");
    expect(firstStep({ collectEmail: false, collectPhone: false })).toBe("done");
    expect(stepAfter("email", { collectPhone: true })).toBe("phone");
    expect(stepAfter("email", { collectPhone: false })).toBe("done");
    expect(stepAfter("phone", { collectPhone: true })).toBe("done");
  });

  it("parses e-mail and phone answers", () => {
    expect(parseEmail("meu email é Ana@Site.com.br, valeu")).toBe("ana@site.com.br");
    expect(parseEmail("sem arroba")).toBeNull();
    expect(parsePhone("(31) 99999-8888")).toBe("31999998888");
    expect(parsePhone("+55 31 99999-8888")).toBe("5531999998888");
    expect(parsePhone("123")).toBeNull();
  });
});
