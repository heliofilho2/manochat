import { describe, expect, it } from "vitest";
import {
  buildCentralExport,
  dayRange,
  dayStart,
  looksLikeQuestion,
  parseCentralDays,
  redactContacts,
  type CentralInput,
} from "../export";

const at = (iso: string) => new Date(iso);

// Mesmo cenário do teste da Central (tests/publico-oslinke.test.ts, OSLINKE_FIXTURE): se mudar aqui,
// copie o JSON esperado para lá.
const input: CentralInput = {
  now: at("2026-10-16T12:00:00Z"),
  days: 2,
  automations: [
    { id: "a1", gated: false },
    { id: "a2", gated: true },
  ],
  comments: [
    { commentId: "c0", automationId: "a1", mediaId: "m1", text: "BANCO", matchedKeyword: "BANCO", fromIgId: "u9", dmStatus: "sent", at: at("2026-10-14T12:00:00Z") },
    { commentId: "c1", automationId: "a1", mediaId: "m1", text: "BANCO", matchedKeyword: "BANCO", fromIgId: "u1", dmStatus: "sent", at: at("2026-10-15T15:00:00Z") },
    {
      commentId: "c2",
      automationId: "a1",
      mediaId: "m1",
      text: "banco, me manda o link? meu zap 11 98765-4321",
      matchedKeyword: "BANCO",
      fromIgId: "u2",
      dmStatus: "failed",
      at: at("2026-10-15T16:00:00Z"),
    },
    { commentId: "c3", automationId: "a2", mediaId: "m2", text: "Quero o PDF", matchedKeyword: "pdf", fromIgId: "u1", dmStatus: "sent", at: at("2026-10-16T10:00:00Z") },
    { commentId: "story:mid-s1", automationId: "a3", mediaId: "st1", text: "eu quero", matchedKeyword: "eu quero", fromIgId: "u3", dmStatus: "sent", at: at("2026-10-16T11:00:00Z") },
  ],
  taps: [{ automationId: "a2", igId: "u1", outcome: "link_sent", at: at("2026-10-16T10:05:00Z") }],
  flows: [{ id: "f1", keywords: ["CURSO"], matchMode: "exact_word" }],
  flowRuns: [
    { flowId: "f1", igId: "u4", triggerRef: "c4", commentId: "c4", status: "done", privateReplyUsed: true, at: at("2026-10-16T09:00:00Z") },
    { flowId: "f1", igId: "u4", triggerRef: "jump:r1:n1", commentId: "c4", status: "done", privateReplyUsed: true, at: at("2026-10-16T09:01:00Z") },
  ],
  flowComments: [{ id: "c4", text: "curso!!", mediaId: "m3" }],
  messages: [
    { id: "mid-d1", fromIgId: "u5", text: "qual câmera você usa", attachmentSummary: null, at: at("2026-10-15T20:00:00Z") },
    { id: "mid-d2", fromIgId: "u6", text: "meu email é ana@exemplo.com", attachmentSummary: null, at: at("2026-10-16T08:00:00Z") },
    { id: "mid-d3", fromIgId: "u6", text: "ana@exemplo.com", attachmentSummary: null, at: at("2026-10-16T08:30:00Z") },
    { id: "lead:mid-d3", fromIgId: "u6", text: "ana@exemplo.com", attachmentSummary: null, at: at("2026-10-16T08:30:00Z") },
    { id: "pb:mid-p1", fromIgId: "u1", text: "Já sigo ✅", attachmentSummary: null, at: at("2026-10-16T10:04:00Z") },
    { id: "mid-s1", fromIgId: "u3", text: "eu quero", attachmentSummary: null, at: at("2026-10-16T11:00:00Z") },
    { id: "mid-s2", fromIgId: "u7", text: "que legal esse bastidor", attachmentSummary: null, at: at("2026-10-15T22:00:00Z") },
    { id: "mid-m1", fromIgId: "u8", text: null, attachmentSummary: "story_mention", at: at("2026-10-16T07:00:00Z") },
    { id: "mid-q1", fromIgId: "u5", text: "Sim", attachmentSummary: null, at: at("2026-10-16T09:30:00Z") },
  ],
  flags: [
    { mid: "mid-s2", storyReply: true, storyId: "st0", quickReply: false, mention: false },
    { mid: "mid-q1", storyReply: false, storyId: null, quickReply: true, mention: false },
  ],
  leads: [
    { source: "story", trigger: "Eu quero", at: at("2026-10-16T11:01:00Z") },
    { source: "story", trigger: "🔥", at: at("2026-10-15T13:00:00Z") },
  ],
  commentsReceived: [
    { day: "2026-10-14", n: 99 },
    { day: "2026-10-15", n: 120 },
    { day: "2026-10-16", n: 45 },
  ],
  bioViews: [{ day: "2026-10-16", n: 30 }],
  bioClicks: [{ day: "2026-10-16", n: 7 }],
};

const expected = {
  version: 1,
  generatedAt: "2026-10-16T12:00:00.000Z",
  timeZone: "America/Sao_Paulo",
  range: { from: "2026-10-15", to: "2026-10-16", days: 2 },
  daily: [
    {
      day: "2026-10-15",
      linksDelivered: 1,
      dmsSent: 1,
      dmsFailed: 1,
      commentsReceived: 120,
      keywordComments: 2,
      inboundDms: 1,
      dmQuestions: 1,
      storyReplies: 1,
      storyMentions: 0,
      leads: 1,
      bioViews: 0,
      bioClicks: 0,
      leadsBySource: { story: 1 },
      leadsByTrigger: { "🔥": 1 },
    },
    {
      day: "2026-10-16",
      linksDelivered: 1,
      dmsSent: 2,
      dmsFailed: 0,
      commentsReceived: 45,
      keywordComments: 2,
      inboundDms: 2,
      dmQuestions: 0,
      storyReplies: 1,
      storyMentions: 1,
      leads: 1,
      bioViews: 30,
      bioClicks: 7,
      leadsBySource: { story: 1 },
      leadsByTrigger: { "eu quero": 1 },
    },
  ],
  keywords: [
    { day: "2026-10-15", keyword: "BANCO", keywordNormalized: "banco", comments: 2, people: 2, dmsSent: 1, dmsFailed: 1, linksDelivered: 1, linkClicks: null },
    { day: "2026-10-16", keyword: "CURSO", keywordNormalized: "curso", comments: 1, people: 1, dmsSent: 1, dmsFailed: 0, linksDelivered: 0, linkClicks: null },
    { day: "2026-10-16", keyword: "pdf", keywordNormalized: "pdf", comments: 1, people: 1, dmsSent: 1, dmsFailed: 0, linksDelivered: 1, linkClicks: null },
  ],
  messages: [
    { kind: "story_reply", id: "mid-s1", text: "eu quero", at: "2026-10-16T11:00:00.000Z", authorIgId: "u3", mediaId: "st1", keyword: "eu quero", keywordOnly: false },
    { kind: "comment", id: "c3", text: "Quero o PDF", at: "2026-10-16T10:00:00.000Z", authorIgId: "u1", mediaId: "m2", keyword: "pdf", keywordOnly: false },
    { kind: "comment", id: "c4", text: "curso!!", at: "2026-10-16T09:00:00.000Z", authorIgId: "u4", mediaId: "m3", keyword: "CURSO", keywordOnly: true },
    { kind: "dm", id: "mid-d2", text: "meu email é [e-mail]", at: "2026-10-16T08:00:00.000Z", authorIgId: "u6", mediaId: null, keyword: null, keywordOnly: false },
    { kind: "story_reply", id: "mid-s2", text: "que legal esse bastidor", at: "2026-10-15T22:00:00.000Z", authorIgId: "u7", mediaId: "st0", keyword: null, keywordOnly: false },
    { kind: "dm", id: "mid-d1", text: "qual câmera você usa", at: "2026-10-15T20:00:00.000Z", authorIgId: "u5", mediaId: null, keyword: null, keywordOnly: false },
    {
      kind: "comment",
      id: "c2",
      text: "banco, me manda o link? meu zap [telefone]",
      at: "2026-10-15T16:00:00.000Z",
      authorIgId: "u2",
      mediaId: "m1",
      keyword: "BANCO",
      keywordOnly: false,
    },
    { kind: "comment", id: "c1", text: "BANCO", at: "2026-10-15T15:00:00.000Z", authorIgId: "u1", mediaId: "m1", keyword: "BANCO", keywordOnly: true },
  ],
  truncated: false,
  activeKeywords: [],
};

describe("leitura da Central (GET /api/public/central)", () => {
  it("monta o contrato v1 com totais do dia, palavras e mensagens", () => {
    expect(buildCentralExport(input)).toEqual(expected);
  });

  it("manda as palavras no ar normalizadas, sem repetir e em ordem (a Central confere o reel de teste)", () => {
    const out = buildCentralExport({ ...input, activeKeywords: ["GitHub", "github", "AÇÃO", " ", "curso"] });
    expect(out.activeKeywords).toEqual(["acao", "curso", "github"]);
  });

  it("nunca deixa sair e-mail ou telefone, nem a resposta a uma pergunta de lead", () => {
    const out = JSON.stringify(buildCentralExport(input));
    expect(out).not.toContain("ana@exemplo.com");
    expect(out).not.toContain("98765");
    expect(out).not.toContain("mid-d3");
  });

  it("corta pelo limite e avisa, com as mais novas primeiro", () => {
    const out = buildCentralExport({ ...input, messageLimit: 2 });
    expect(out.messages.map((m) => m.id)).toEqual(["mid-s1", "c3"]);
    expect(out.truncated).toBe(true);
  });

  it("dia sem nada sai com zeros (a Central regrava o dia inteiro)", () => {
    const empty = buildCentralExport({
      ...input,
      comments: [],
      flowRuns: [],
      messages: [],
      leads: [],
      commentsReceived: [],
      bioViews: [],
      bioClicks: [],
    });
    expect(empty.daily.map((d) => [d.day, d.keywordComments, d.inboundDms])).toEqual([
      ["2026-10-15", 0, 0],
      ["2026-10-16", 0, 0],
    ]);
    expect(empty.keywords).toEqual([]);
  });
});

describe("regras pequenas", () => {
  it("days entre 1 e 31, padrão 3", () => {
    expect(parseCentralDays(null)).toBe(3);
    expect(parseCentralDays("abc")).toBe(3);
    expect(parseCentralDays("0")).toBe(3);
    expect(parseCentralDays("7")).toBe(7);
    expect(parseCentralDays("400")).toBe(31);
  });

  it("dias em Brasília, terminando hoje", () => {
    // 01:00 UTC do dia 16 ainda é dia 15 em Brasília.
    expect(dayRange(at("2026-10-16T01:00:00Z"), 2)).toEqual(["2026-10-14", "2026-10-15"]);
    expect(dayStart("2026-10-15").toISOString()).toBe("2026-10-15T03:00:00.000Z");
  });

  it("apaga e-mail e telefone, mas deixa número curto", () => {
    expect(redactContacts("me chama no +55 (11) 91234-5678 ou joao.silva@gmail.com")).toBe(
      "me chama no [telefone] ou [e-mail]",
    );
    expect(redactContacts("python 3.12 ou 10.000 seguidores")).toBe("python 3.12 ou 10.000 seguidores");
  });

  it("palpite de pergunta", () => {
    expect(looksLikeQuestion("tem curso grátis?")).toBe(true);
    expect(looksLikeQuestion("Qual IA você usa")).toBe(true);
    expect(looksLikeQuestion("Por que isso acontece")).toBe(true);
    expect(looksLikeQuestion("amei o vídeo")).toBe(false);
  });
});
