/**
 * O que a Central do Criador lê do Oslinke (GET /api/public/central).
 *
 * Puro, sem banco e sem `server-only`, como o matcher: a rota lê as linhas e
 * este arquivo monta o JSON. Nunca sai e-mail nem telefone: os textos passam
 * por redactContacts e as respostas às perguntas de lead/fluxo ficam de fora.
 *
 * Contrato versão 1. Quem lê é lib/oslinke.ts na Central; mudou aqui, mude lá
 * no mesmo dia (o teste das duas pontas usa o mesmo exemplo).
 */
import { matchKeyword, normalize, type MatchMode } from "@/lib/automation/matcher";

export const CENTRAL_CONTRACT_VERSION = 1;
export const CENTRAL_DEFAULT_DAYS = 3;
export const CENTRAL_MAX_DAYS = 31;
export const CENTRAL_MESSAGE_LIMIT = 1000;
export const CENTRAL_TEXT_MAX = 1000;
export const CENTRAL_TIME_ZONE = "America/Sao_Paulo";

const dayFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: CENTRAL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "2026-10-16": o dia em Brasília. */
export function dayOf(d: Date): string {
  return dayFmt.format(d);
}

function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** ?days=N entre 1 e CENTRAL_MAX_DAYS; inválido ou ausente vira o padrão. */
export function parseCentralDays(raw: string | null): number {
  const n = Number(raw);
  if (!raw || !Number.isInteger(n) || n < 1) return CENTRAL_DEFAULT_DAYS;
  return Math.min(n, CENTRAL_MAX_DAYS);
}

/** Os N dias que terminam hoje (Brasília), do mais antigo ao mais novo. */
export function dayRange(now: Date, days: number): string[] {
  const today = dayOf(now);
  return Array.from({ length: days }, (_, i) => addDays(today, i - days + 1));
}

/** Começo do dia em Brasília (sem horário de verão desde 2019: sempre -03:00). */
export function dayStart(day: string): Date {
  return new Date(`${day}T00:00:00-03:00`);
}

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu;
// Sequência de dígitos com espaço, ponto, traço ou parênteses no meio. Só vira [telefone] com 8+
// dígitos: "python 3.12" e "10.000 seguidores" ficam como estão; CPF também some (é dado pessoal).
const DIGITS = /\+?\(?\d[\d\s().-]{5,}\d/g;

/** Tira e-mail e telefone do texto antes de sair do Oslinke. */
export function redactContacts(text: string): string {
  return text
    .replace(EMAIL, "[e-mail]")
    .replace(DIGITS, (m) => (m.replace(/\D/g, "").length >= 8 ? "[telefone]" : m));
}

const QUESTION_START =
  /^(como|qual|quais|quando|onde|por que|porque|pq|o que|oque|quanto|quantos|quantas|quem|cade)\b/;

/** Palpite simples de "isso é uma pergunta" (o Claude refina na Central). */
export function looksLikeQuestion(text: string): boolean {
  if (text.includes("?")) return true;
  return QUESTION_START.test(normalize(text));
}

function clip(text: string): string {
  const t = redactContacts(text.trim());
  return t.length > CENTRAL_TEXT_MAX ? `${t.slice(0, CENTRAL_TEXT_MAX - 1)}…` : t;
}

/* ── Entrada: linhas já lidas pela rota ─────────────────────────────────── */

/** comment_event. Resposta de story vem com commentId "story:<mid>". */
export interface CommentEventRow {
  commentId: string;
  automationId: string | null;
  mediaId: string | null;
  text: string;
  matchedKeyword: string | null;
  fromIgId: string | null;
  dmStatus: string;
  at: Date;
}

/** flow_run. triggerRef = id do comentário, "story:<mid>", "mention:<mid>", "dm:<mid>" ou "jump:...". */
export interface FlowRunRow {
  flowId: string;
  igId: string;
  triggerRef: string;
  commentId: string | null;
  status: string;
  privateReplyUsed: boolean;
  at: Date;
}

/** Texto do comentário que abriu um fluxo (o flow_run não guarda), lido do webhook_event. */
export interface WebhookComment {
  id: string;
  text: string | null;
  mediaId: string | null;
}

export interface FlowInfo {
  id: string;
  keywords: string[];
  matchMode: string;
}

export interface AutomationInfo {
  id: string;
  /** Comentário com botão no primeiro DM: o link sai no toque (tap_event link_sent). */
  gated: boolean;
}

export interface TapRow {
  automationId: string | null;
  igId: string;
  outcome: string;
  at: Date;
}

/**
 * message recebida (is_from_account = false), de todas as conversas da conta.
 * Prefixos: "pb:" toque em botão, "lead:" e "flowreply:" cópia da resposta a uma pergunta.
 */
export interface MessageRow {
  id: string;
  fromIgId: string | null;
  text: string | null;
  attachmentSummary: string | null;
  at: Date;
}

/** O que só o webhook cru diz sobre a mensagem (reply_to.story, quick_reply, story_mention). */
export interface MessageFlag {
  mid: string;
  storyReply: boolean;
  storyId: string | null;
  quickReply: boolean;
  mention: boolean;
}

export interface LeadRow {
  source: string;
  trigger: string | null;
  at: Date;
}

export interface DayCount {
  day: string;
  n: number;
}

export interface CentralInput {
  now: Date;
  days: number;
  comments: CommentEventRow[];
  flowRuns: FlowRunRow[];
  flowComments: WebhookComment[];
  flows: FlowInfo[];
  automations: AutomationInfo[];
  taps: TapRow[];
  messages: MessageRow[];
  flags: MessageFlag[];
  leads: LeadRow[];
  /** Comentários recebidos por dia (todos, não só os com palavra), contados no SQL. */
  commentsReceived: DayCount[];
  bioViews: DayCount[];
  bioClicks: DayCount[];
  messageLimit?: number;
  /** Palavras das automações e fluxos no ar (status live), cruas. A Central confere a palavra de um reel de teste. */
  activeKeywords?: string[];
}

/* ── Saída: o contrato ──────────────────────────────────────────────────── */

export interface CentralDay {
  day: string;
  linksDelivered: number;
  dmsSent: number;
  dmsFailed: number;
  commentsReceived: number;
  keywordComments: number;
  inboundDms: number;
  dmQuestions: number;
  storyReplies: number;
  storyMentions: number;
  leads: number;
  bioViews: number;
  bioClicks: number;
  leadsBySource: Record<string, number>;
  leadsByTrigger: Record<string, number>;
}

export interface CentralKeyword {
  day: string;
  /** Grafia como está cadastrada na automação ou no fluxo. */
  keyword: string;
  /** normalize() do matcher. A Central usa a mesma função. */
  keywordNormalized: string;
  comments: number;
  people: number;
  dmsSent: number;
  dmsFailed: number;
  linksDelivered: number;
  /** O link da DM não passa pelo /r: o Oslinke não mede o clique por palavra. */
  linkClicks: number | null;
}

export type CentralMessageKind = "comment" | "dm" | "story_reply";

export interface CentralMessage {
  kind: CentralMessageKind;
  /** comment: id do comentário. dm e story_reply: mid da mensagem. */
  id: string;
  text: string;
  at: string;
  /** Id do Instagram de quem mandou. A Central só guarda o HMAC dele, nunca o id. */
  authorIgId: string | null;
  /** comment: id do post. story_reply: id do story. */
  mediaId: string | null;
  keyword: string | null;
  /** O comentário é só a palavra ("BANCO"): fica fora dos temas na Central. */
  keywordOnly: boolean;
}

export interface CentralExport {
  version: number;
  generatedAt: string;
  timeZone: string;
  range: { from: string; to: string; days: number };
  daily: CentralDay[];
  keywords: CentralKeyword[];
  messages: CentralMessage[];
  /** true quando havia mais mensagens que o limite (as mais novas vão primeiro). */
  truncated: boolean;
  /** Palavras das automações e fluxos no ar (status live), normalizadas e sem repetição. */
  activeKeywords: string[];
}

const LEAD_TRIGGERS_MAX = 20;

function emptyDay(day: string): CentralDay {
  return {
    day,
    linksDelivered: 0,
    dmsSent: 0,
    dmsFailed: 0,
    commentsReceived: 0,
    keywordComments: 0,
    inboundDms: 0,
    dmQuestions: 0,
    storyReplies: 0,
    storyMentions: 0,
    leads: 0,
    bioViews: 0,
    bioClicks: 0,
    leadsBySource: {},
    leadsByTrigger: {},
  };
}

const bump = (m: Record<string, number>, k: string, n = 1) => {
  m[k] = (m[k] ?? 0) + n;
};

/** Comentário com palavra, já com a decisão de DM e de link entregue. */
interface KeywordHit {
  id: string;
  day: string;
  at: Date;
  keyword: string | null;
  text: string | null;
  igId: string | null;
  mediaId: string | null;
  sent: boolean;
  failed: boolean;
  delivered: boolean;
}

export function buildCentralExport(input: CentralInput): CentralExport {
  const range = dayRange(input.now, input.days);
  const from = range[0];
  const to = range[range.length - 1];
  const inRange = (d: string) => d >= from && d <= to;
  const daily = new Map(range.map((d) => [d, emptyDay(d)]));
  const dayRow = (d: string) => daily.get(d);

  const gated = new Set(input.automations.filter((a) => a.gated).map((a) => a.id));
  // Toques que liberaram o link, por automação e pessoa.
  const linkTaps = new Map<string, number[]>();
  for (const t of input.taps) {
    if (t.outcome !== "link_sent" || !t.automationId) continue;
    const k = `${t.automationId}|${t.igId}`;
    linkTaps.set(k, [...(linkTaps.get(k) ?? []), t.at.getTime()]);
  }

  // Respostas de story: pelo webhook, pelas automações de story e pelos fluxos de story.
  const storyMids = new Map<string, { storyId: string | null; keyword: string | null; text: string | null; at: Date | null }>();
  const quickMids = new Set<string>();
  const mentionMids = new Set<string>();
  for (const f of input.flags) {
    if (f.storyReply) storyMids.set(f.mid, { storyId: f.storyId, keyword: null, text: null, at: null });
    if (f.quickReply) quickMids.add(f.mid);
    if (f.mention) mentionMids.add(f.mid);
  }

  const hits: KeywordHit[] = [];
  for (const c of input.comments) {
    if (c.commentId.startsWith("story:")) {
      const mid = c.commentId.slice("story:".length);
      const prev = storyMids.get(mid);
      const text = c.text && c.text !== "(reação ao story)" ? c.text : null;
      storyMids.set(mid, {
        storyId: prev?.storyId ?? c.mediaId,
        keyword: c.matchedKeyword,
        text: prev?.text ?? text,
        at: c.at,
      });
      continue;
    }
    const delivered = gated.has(c.automationId ?? "")
      ? (linkTaps.get(`${c.automationId}|${c.fromIgId}`) ?? []).some((t) => t >= c.at.getTime())
      : c.dmStatus === "sent";
    hits.push({
      id: c.commentId,
      day: dayOf(c.at),
      at: c.at,
      keyword: c.matchedKeyword,
      text: c.text,
      igId: c.fromIgId,
      mediaId: c.mediaId,
      sent: c.dmStatus === "sent",
      failed: c.dmStatus === "failed",
      delivered,
    });
  }

  const flowById = new Map(input.flows.map((f) => [f.id, f]));
  const flowComment = new Map(input.flowComments.map((c) => [c.id, c]));
  for (const r of input.flowRuns) {
    if (r.triggerRef.startsWith("story:")) {
      const mid = r.triggerRef.slice("story:".length);
      if (!storyMids.has(mid)) storyMids.set(mid, { storyId: null, keyword: null, text: null, at: r.at });
      continue;
    }
    if (r.triggerRef.startsWith("mention:")) {
      mentionMids.add(r.triggerRef.slice("mention:".length));
      continue;
    }
    // Só o fluxo aberto pelo comentário (os "jump:" levam o mesmo comentId, mas não são um comentário novo).
    if (!r.commentId || r.triggerRef !== r.commentId) continue;
    const wc = flowComment.get(r.commentId);
    const flow = flowById.get(r.flowId);
    const keyword = wc?.text && flow ? matchKeyword(wc.text, flow.keywords, flow.matchMode as MatchMode) : null;
    hits.push({
      id: r.commentId,
      day: dayOf(r.at),
      at: r.at,
      keyword,
      text: wc?.text ?? null,
      igId: r.igId,
      mediaId: wc?.mediaId ?? null,
      sent: r.privateReplyUsed,
      failed: !r.privateReplyUsed && r.status === "failed",
      // O link do fluxo vai num bloco qualquer: entregue não é medido.
      delivered: false,
    });
  }

  // Um comentário é uma linha só (a mesma webhook pode ter sido processada duas vezes).
  const seenHit = new Set<string>();
  const uniqueHits = hits.filter((h) => !seenHit.has(h.id) && seenHit.add(h.id));

  const keywordMap = new Map<string, CentralKeyword & { igIds: Set<string>; anon: number }>();
  for (const h of uniqueHits) {
    const d = dayRow(h.day);
    if (!d) continue;
    d.keywordComments++;
    if (h.sent) d.dmsSent++;
    if (h.failed) d.dmsFailed++;
    if (h.delivered) d.linksDelivered++;
    const norm = h.keyword ? normalize(h.keyword) : "";
    if (!norm) continue;
    const k = `${h.day}|${norm}`;
    const row =
      keywordMap.get(k) ??
      Object.assign(
        {
          day: h.day,
          keyword: h.keyword!,
          keywordNormalized: norm,
          comments: 0,
          people: 0,
          dmsSent: 0,
          dmsFailed: 0,
          linksDelivered: 0,
          linkClicks: null,
        },
        { igIds: new Set<string>(), anon: 0 },
      );
    row.comments++;
    if (h.igId) row.igIds.add(h.igId);
    else row.anon++;
    if (h.sent) row.dmsSent++;
    if (h.failed) row.dmsFailed++;
    if (h.delivered) row.linksDelivered++;
    keywordMap.set(k, row);
  }

  // Story: DM e resposta de story contam no dia da mensagem.
  const answerMids = new Set<string>();
  const inbound: MessageRow[] = [];
  for (const m of input.messages) {
    if (m.id.startsWith("lead:")) answerMids.add(m.id.slice("lead:".length));
    else if (m.id.startsWith("flowreply:")) answerMids.add(m.id.slice("flowreply:".length));
    else if (!m.id.startsWith("pb:") && !m.id.includes(":")) inbound.push(m);
  }

  const messages: CentralMessage[] = [];
  const seenMid = new Set<string>();
  for (const m of inbound) {
    if (seenMid.has(m.id)) continue;
    seenMid.add(m.id);
    const d = dayRow(dayOf(m.at));
    const mention = mentionMids.has(m.id) || (m.attachmentSummary ?? "").includes("story_mention");
    const story = storyMids.get(m.id);
    if (mention && !story) {
      if (d) d.storyMentions++;
      continue;
    }
    if (story) {
      story.at = m.at;
      if (!story.text && m.text) story.text = m.text;
      continue;
    }
    if (quickMids.has(m.id)) continue;
    if (d) d.inboundDms++;
    const text = m.text?.trim();
    if (!text) continue;
    if (d && looksLikeQuestion(text)) d.dmQuestions++;
    if (answerMids.has(m.id) || !d) continue;
    messages.push({
      kind: "dm",
      id: m.id,
      text: clip(text),
      at: m.at.toISOString(),
      authorIgId: m.fromIgId,
      mediaId: null,
      keyword: null,
      keywordOnly: false,
    });
  }

  const authorOf = new Map(inbound.map((m) => [m.id, m.fromIgId]));
  for (const c of input.comments) {
    if (c.commentId.startsWith("story:")) authorOf.set(c.commentId.slice(6), c.fromIgId);
  }
  for (const [mid, s] of storyMids) {
    if (!s.at) continue;
    const d = dayRow(dayOf(s.at));
    if (!d) continue;
    d.storyReplies++;
    const text = s.text?.trim();
    if (!text || answerMids.has(mid)) continue;
    messages.push({
      kind: "story_reply",
      id: mid,
      text: clip(text),
      at: s.at.toISOString(),
      authorIgId: authorOf.get(mid) ?? null,
      mediaId: s.storyId,
      keyword: s.keyword,
      keywordOnly: false,
    });
  }

  for (const h of uniqueHits) {
    const text = h.text?.trim();
    if (!text || !inRange(h.day)) continue;
    messages.push({
      kind: "comment",
      id: h.id,
      text: clip(text),
      at: h.at.toISOString(),
      authorIgId: h.igId,
      mediaId: h.mediaId,
      keyword: h.keyword,
      keywordOnly: !!h.keyword && normalize(text) === normalize(h.keyword),
    });
  }

  for (const l of input.leads) {
    const d = dayRow(dayOf(l.at));
    if (!d) continue;
    d.leads++;
    bump(d.leadsBySource, l.source || "outro");
    const trigger = l.trigger ? normalize(l.trigger) || l.trigger.trim() : "";
    if (trigger) bump(d.leadsByTrigger, trigger);
  }
  for (const d of daily.values()) {
    const top = Object.entries(d.leadsByTrigger)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, LEAD_TRIGGERS_MAX);
    d.leadsByTrigger = Object.fromEntries(top);
  }

  const put = (list: DayCount[], field: "commentsReceived" | "bioViews" | "bioClicks") => {
    for (const c of list) {
      const d = dayRow(c.day);
      if (d) d[field] += c.n;
    }
  };
  put(input.commentsReceived, "commentsReceived");
  put(input.bioViews, "bioViews");
  put(input.bioClicks, "bioClicks");

  const limit = input.messageLimit ?? CENTRAL_MESSAGE_LIMIT;
  messages.sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));

  return {
    version: CENTRAL_CONTRACT_VERSION,
    generatedAt: input.now.toISOString(),
    timeZone: CENTRAL_TIME_ZONE,
    range: { from, to, days: range.length },
    daily: [...daily.values()],
    keywords: [...keywordMap.values()]
      .map(({ igIds, anon, ...k }) => ({ ...k, people: igIds.size + anon }))
      .sort((a, b) => a.day.localeCompare(b.day) || b.comments - a.comments || a.keywordNormalized.localeCompare(b.keywordNormalized)),
    messages: messages.slice(0, limit),
    truncated: messages.length > limit,
    activeKeywords: [...new Set((input.activeKeywords ?? []).map((k) => normalize(k)).filter(Boolean))].sort(),
  };
}
