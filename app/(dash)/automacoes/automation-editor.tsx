"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PostThumb } from "@/components/post-thumb";
import { Switch } from "@/components/switch";
import { useToast } from "@/components/toast";
import {
  addKeywords,
  STEP_IDS,
  STEP_LABELS,
  validate,
  type AutomationDraft,
  type DraftStatus,
} from "@/lib/automation/draft";
import type { PostView } from "@/lib/posts-view";
import { deleteAutomation, saveAutomation } from "../actions";
import { ConversationPreview } from "./conversation-preview";

const EMOJIS = ["😊", "🙌", "💛", "🔥", "✨", "👇", "📩", "🎁"];
const STATUS_BADGE = {
  active: ["Ativa", "var(--color-success-bg)", "var(--color-success)"],
  paused: ["Pausada", "var(--color-warning-bg)", "var(--color-warning)"],
  draft: ["Rascunho", "var(--color-fill)", "var(--color-ink-2)"],
} as const;

const inputBase =
  "rounded-xl border-[1.5px] bg-white text-ink outline-accent";

function StepHeader({ title, help }: { title: string; help?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h2 className="m-0 text-2xl leading-[1.15] font-bold tracking-[-0.02em]">{title}</h2>
      {help ? <p className="m-0 text-[15px] leading-normal text-muted">{help}</p> : null}
    </div>
  );
}

function RadioCard({
  selected,
  onPick,
  label,
  children,
}: {
  selected: boolean;
  onPick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex cursor-pointer flex-col gap-2 rounded-2xl border-2 bg-white p-4 text-left text-ink"
      style={{ borderColor: selected ? "var(--color-ink)" : "var(--color-line)" }}
    >
      <span className="flex items-center gap-2.5 text-base font-semibold">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-ink">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: selected ? "var(--color-accent)" : "transparent" }}
          />
        </span>
        {label}
      </span>
      {children}
    </button>
  );
}

function PickGrid({
  items,
  selected,
  onToggle,
}: {
  items: PostView[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2">
      {items.map((p) => {
        const sel = selected.includes(p.id);
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={sel}
            onClick={() => onToggle(p.id)}
            className="relative aspect-[4/5] cursor-pointer overflow-hidden rounded-xl border-[3px] bg-transparent p-0"
            style={{ borderColor: sel ? "var(--color-accent)" : "transparent" }}
          >
            <div className="absolute inset-0 overflow-hidden rounded-[9px]">
              <PostThumb post={p} />
            </div>
            <span
              className="absolute top-1.5 left-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[13px] font-bold shadow-[0_1px_3px_rgba(0,0,0,.25)]"
              style={{ background: sel ? "var(--color-accent)" : "rgba(255,252,247,0.5)" }}
            >
              {sel ? "✓" : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ToggleRow({
  title,
  help,
  checked,
  onChange,
  children,
}: {
  title: string;
  help?: string;
  checked: boolean;
  onChange: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-bg p-4">
      <div className="flex items-start gap-4">
        <div className="flex flex-1 flex-col gap-1">
          <strong className="text-base font-semibold">{title}</strong>
          {help ? <span className="text-sm leading-normal text-ink-2">{help}</span> : null}
        </div>
        <Switch size="lg" checked={checked} onChange={onChange} label={title} />
      </div>
      {checked ? children : null}
    </div>
  );
}

function EmojiRow({ onPick, extra }: { onPick: (e: string) => void; extra?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-0.5">
      {EMOJIS.map((e) => (
        <button
          key={e}
          type="button"
          onClick={() => onPick(e)}
          className="h-[34px] w-[34px] cursor-pointer rounded-lg border-none bg-transparent text-[17px] hover:bg-fill"
        >
          {e}
        </button>
      ))}
      {extra}
    </div>
  );
}

export function AutomationEditor({
  initial,
  posts,
  username,
}: {
  initial: AutomationDraft;
  posts: PostView[];
  username: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startSave] = useTransition();

  const [d, setD] = useState<AutomationDraft>(initial);
  const [step, setStep] = useState(0);
  const [kwInput, setKwInput] = useState("");
  const [tried, setTried] = useState(false);
  const [follows, setFollows] = useState(false);
  const [ri, setRi] = useState(0);
  const [pv, setPv] = useState(false);

  const up = (patch: Partial<AutomationDraft>) => setD((cur) => ({ ...cur, ...patch }));
  const stepIds: readonly string[] = STEP_IDS[d.kind];
  const lastStep = stepIds.length - 1;
  const stepId: string = stepIds[Math.min(step, lastStep)];
  const story = d.kind === "story";

  const errs = validate(d);
  const show = tried ? errs : {};
  const er = (k: string) => show[k]?.[1] ?? "";
  const stepErr = new Set(Object.values(show).map((x) => x![0]));
  const borderOf = (k: string) => (er(k) ? "var(--color-danger)" : "var(--color-line)");

  const isActive = d.status === "active";
  const [badgeLabel, badgeBg, badgeFg] = STATUS_BADGE[d.status];

  const commit = (status: DraftStatus) => {
    if (status === "active") {
      const e = validate(d);
      const list = Object.values(e) as [string, string][];
      if (list.length) {
        setTried(true);
        setStep(Math.min(...list.map((x) => stepIds.indexOf(x[0]))));
        return;
      }
    }
    startSave(async () => {
      const r = await saveAutomation(d, status);
      if (!r.ok) {
        toast(r.error);
        return;
      }
      const name = d.name.trim() || "Automação sem nome";
      setD((cur) => ({ ...cur, id: r.id, status: r.status, name }));
      toast(
        status === "active"
          ? `"${name}" está ativa e respondendo`
          : status === "paused"
            ? `"${name}" foi pausada`
            : "Rascunho salvo",
      );
      if (status === "draft") {
        // Stay on the page; if it was new, make the URL point at the saved row.
        if (!d.id) window.history.replaceState(null, "", `/automacoes/${r.id}`);
        router.refresh();
      } else {
        router.push("/automacoes");
        router.refresh();
      }
    });
  };

  const saveDraft = () => commit(isActive ? "active" : d.status === "paused" ? "paused" : "draft");
  const activate = () => commit("active");
  const pause = () => commit("paused");

  const addKw = (raw: string) => {
    if (!raw.trim()) return;
    up({ keywords: addKeywords(d.keywords, raw) });
    setKwInput("");
  };

  const goStep = (i: number) => {
    setStep(i);
    window.scrollTo(0, 0);
  };

  const pvPost = posts.find((p) => p.id === d.postIds[0]) ?? posts[0];
  const reps = d.replies.filter((r) => r.trim());
  const pvReply = reps.length ? reps[ri % reps.length] : "…";
  const errorList = (Object.values(errs) as [string, string][]).map(([st, msg]) => ({ st, msg }));

  const previewProps = {
    d,
    post: pvPost,
    username,
    reply: pvReply,
    onShuffle: () => setRi((n) => n + 1),
    follows,
    onFollows: setFollows,
  };

  const msgBlocks = [
    {
      k: "dmInitial" as const,
      tag: "A",
      title: "DM inicial",
      help: "Primeira mensagem, enviada logo após o comentário. Vai com um botão.",
      hasButton: true,
    },
    {
      k: "dmFollower" as const,
      tag: "B",
      title: "Para quem já segue",
      help: "Entrega o link. Enviada quando a pessoa toca no botão.",
    },
    {
      k: "dmNonFollower" as const,
      tag: "C",
      title: "Para quem não segue",
      help: d.requireFollow
        ? "Pede pra seguir e repete o botão. Quando seguir e tocar de novo, recebe a mensagem B."
        : 'Desligado: "Exigir que siga" está desativado em Link e regras.',
    },
  ];

  const linkInsert = (k: "dmInitial" | "dmFollower" | "dmNonFollower") =>
    up({ [k]: d[k] + (d[k] && !/\s$/.test(d[k]) ? " " : "") + "{link}" });

  return (
    <div className="animate-up flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3.5">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Link
            href="/automacoes"
            className="flex h-8 items-center self-start text-sm font-medium whitespace-nowrap text-muted"
          >
            ← Automações
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="m-0 text-[clamp(26px,4vw,36px)] leading-[1.2] font-bold tracking-[-0.025em]">
              {d.id ? d.name || "Automação sem nome" : story ? "Nova automação de story" : "Nova automação"}
            </h1>
            <span
              className="flex h-[26px] items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold"
              style={{ background: badgeBg, color: badgeFg }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: badgeFg }} />
              {badgeLabel}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={saveDraft}
            className="h-11 cursor-pointer rounded-xl border border-line-strong bg-white px-4 text-sm font-semibold whitespace-nowrap disabled:opacity-60"
          >
            {isActive ? "Salvar alterações" : "Salvar rascunho"}
          </button>
          {isActive ? (
            <button
              type="button"
              disabled={pending}
              onClick={pause}
              className="h-11 cursor-pointer rounded-xl border border-line-strong bg-white px-4 text-sm font-semibold whitespace-nowrap text-warning disabled:opacity-60"
            >
              Pausar
            </button>
          ) : null}
          <button
            type="button"
            disabled={pending}
            onClick={activate}
            className="h-11 cursor-pointer rounded-xl border-none bg-accent px-[18px] text-sm font-semibold whitespace-nowrap hover:bg-accent-hover disabled:opacity-60"
          >
            {isActive ? "Publicar alterações" : "Ativar automação"}
          </button>
        </div>
      </div>

      {tried && errorList.length > 0 ? (
        <div
          role="alert"
          className="animate-up-fast flex flex-col gap-2 rounded-[14px] bg-danger-bg px-4 py-3.5 text-danger-ink"
        >
          <strong className="text-sm font-semibold">Antes de ativar, falta ajustar:</strong>
          <div className="flex flex-wrap gap-1.5">
            {errorList.map((e) => (
              <button
                key={e.msg}
                type="button"
                onClick={() => setStep(Math.max(0, stepIds.indexOf(e.st)))}
                className="h-8 cursor-pointer rounded-full border border-[#EFC2B8] bg-white px-3 text-[13px] font-medium whitespace-nowrap text-danger-ink"
              >
                {e.msg} →
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="scrollbar-none -mx-0.5 flex gap-1.5 overflow-x-auto pb-1">
        {stepIds.map((id, i) => {
          const a = i === step;
          const bad = stepErr.has(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => setStep(i)}
              className="flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full border py-0 pr-3.5 pl-1.5 text-sm font-medium whitespace-nowrap"
              style={{
                background: a ? "var(--color-accent-soft)" : "#fff",
                color: a ? "var(--color-accent-ink-2)" : "var(--color-ink)",
                borderColor: a ? "var(--color-accent-line)" : bad ? "var(--color-danger)" : "var(--color-line)",
              }}
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold"
                style={{
                  background: bad ? "var(--color-danger)" : a ? "#fff" : "var(--color-fill)",
                  color: bad ? "#fff" : "var(--color-ink)",
                }}
              >
                {bad ? "!" : i + 1}
              </span>
              {STEP_LABELS[id]}
            </button>
          );
        })}
      </div>

      <div className="flex items-start gap-7">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex flex-col gap-[22px] rounded-[22px] border border-line bg-white p-[clamp(18px,3vw,28px)]">
            {stepId === "name" ? (
              <div className="animate-up-fast flex flex-col gap-[22px]">
                <StepHeader
                  title="Dê um nome pra essa automação"
                  help="Só você vê. Use algo que lembre o que ela entrega."
                />
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Nome interno
                  <input
                    value={d.name}
                    onChange={(e) => up({ name: e.target.value })}
                    placeholder="Ex.: Guia de receitas grátis"
                    maxLength={60}
                    className={`${inputBase} h-[52px] px-4 text-[17px] font-medium`}
                    style={{ borderColor: borderOf("name") }}
                  />
                  {er("name") ? <span className="text-[13px] font-medium text-danger">{er("name")}</span> : null}
                </label>
              </div>
            ) : null}

            {stepId === "words" ? (
              <div className="animate-up-fast flex flex-col gap-[22px]">
                <StepHeader
                  title={story ? "E essa resposta contém" : "Qual palavra a pessoa comenta?"}
                  help={
                    story
                      ? "Escolha se qualquer resposta dispara, ou só palavras específicas."
                      : "Pode ter mais de uma. Maiúsculas e minúsculas não importam."
                  }
                />
                {story ? (
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-2.5">
                    <RadioCard
                      selected={!d.anyWords}
                      onPick={() => up({ anyWords: false })}
                      label="Palavras ou reações específicas"
                    >
                      <span className="text-sm leading-normal text-ink-2">
                        Só responde quando a pessoa escrever uma das palavras (ou emojis) que você escolher.
                      </span>
                    </RadioCard>
                    <RadioCard
                      selected={d.anyWords}
                      onPick={() => up({ anyWords: true })}
                      label="Qualquer palavra ou reação"
                    >
                      <span className="text-sm leading-normal text-ink-2">
                        Responde a toda resposta e reação nos seus stories.
                      </span>
                    </RadioCard>
                  </div>
                ) : null}
                <div className={`flex flex-col gap-2.5 ${story && d.anyWords ? "hidden" : ""}`}>
                  <div
                    className="flex min-h-14 flex-wrap items-center gap-2 rounded-[13px] border-[1.5px] bg-white p-2"
                    style={{ borderColor: borderOf("keywords") }}
                  >
                    {d.keywords.map((w) => (
                      <span
                        key={w}
                        className="flex h-9 items-center gap-1 rounded-[9px] border border-line bg-bg pr-1 pl-3 text-sm font-semibold tracking-[0.03em]"
                      >
                        {w}
                        <button
                          type="button"
                          aria-label="Remover palavra"
                          onClick={() => up({ keywords: d.keywords.filter((x) => x !== w) })}
                          className="h-7 w-7 cursor-pointer border-none bg-transparent text-lg leading-none text-muted"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <input
                      value={kwInput}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v.endsWith(",")) addKw(v);
                        else setKwInput(v);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addKw(kwInput);
                        } else if (e.key === "Backspace" && !kwInput && d.keywords.length) {
                          up({ keywords: d.keywords.slice(0, -1) });
                        }
                      }}
                      placeholder={d.keywords.length ? "Outra palavra…" : "Ex.: RECEITA"}
                      className="h-10 min-w-[140px] flex-1 border-none bg-transparent text-base font-medium text-ink uppercase outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => addKw(kwInput)}
                      className="h-9 cursor-pointer rounded-[9px] border-none bg-fill px-3 text-[13px] font-semibold whitespace-nowrap"
                    >
                      Adicionar
                    </button>
                  </div>
                  <span className="text-[13px] text-muted">Aperte Enter ou vírgula para adicionar.</span>
                  {er("keywords") ? (
                    <span className="text-[13px] font-medium text-danger">{er("keywords")}</span>
                  ) : null}
                </div>
                <div className={`flex flex-col gap-2.5 ${story && d.anyWords ? "hidden" : ""}`}>
                  <span className="text-[15px] font-semibold">
                    {story ? "Como comparar com a resposta" : "Como comparar com o comentário"}
                  </span>
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-2.5">
                    <RadioCard selected={d.match === "exact"} onPick={() => up({ match: "exact" })} label="Palavra exata">
                      <span className="text-sm leading-normal text-ink-2">
                        O comentário precisa ser só a palavra (emojis e pontuação são ignorados).
                      </span>
                      <span className="text-[13px] leading-normal font-medium text-success">
                        ✓ &quot;Receita!&quot; &quot;receita 🙏&quot;
                      </span>
                      <span className="text-[13px] leading-normal font-medium text-danger">
                        ✗ &quot;amei essa receita&quot;
                      </span>
                    </RadioCard>
                    <RadioCard
                      selected={d.match === "contains"}
                      onPick={() => up({ match: "contains" })}
                      label="Contém a palavra"
                    >
                      <span className="text-sm leading-normal text-ink-2">
                        Responde se a palavra aparecer em qualquer parte do comentário.
                      </span>
                      <span className="text-[13px] leading-normal font-medium text-success">
                        ✓ &quot;amei essa receita&quot;
                      </span>
                      <span className="text-[13px] leading-normal font-medium text-danger">
                        ✗ &quot;receitas&quot; (outra palavra)
                      </span>
                    </RadioCard>
                  </div>
                </div>
              </div>
            ) : null}

            {stepId === "posts" ? (
              <div className="animate-up-fast flex flex-col gap-[22px]">
                <StepHeader title="Em quais posts?" help="Onde o Manochat deve ficar de olho nos comentários." />
                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-2.5">
                  {(
                    [
                      ["specific", "Posts específicos", "Você escolhe os posts na grade abaixo."],
                      ["all", "Todos os posts", "Qualquer post, antigo ou novo."],
                      ["future", "A partir de agora", "Só posts publicados depois de ativar."],
                    ] as const
                  ).map(([k, label, desc]) => (
                    <RadioCard key={k} selected={d.target === k} onPick={() => up({ target: k })} label={label}>
                      <span className="text-[13px] leading-[1.45] text-ink-2">{desc}</span>
                    </RadioCard>
                  ))}
                </div>
                {d.target === "specific" ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[15px] font-semibold">Seus posts recentes</span>
                      <span
                        className="text-[13px] font-medium"
                        style={{ color: d.postIds.length ? "var(--color-success)" : "var(--color-muted)" }}
                      >
                        {d.postIds.length
                          ? `${d.postIds.length} selecionado${d.postIds.length > 1 ? "s" : ""}`
                          : "Nenhum selecionado"}
                      </span>
                    </div>
                    {posts.length === 0 ? (
                      <div className="rounded-[14px] bg-bg px-4 py-6 text-center text-sm text-muted">
                        Ainda não carregamos seus posts. Volte em instantes ou escolha &quot;Todos os posts&quot;.
                      </div>
                    ) : (
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2">
                        {posts.map((p) => {
                          const sel = d.postIds.includes(p.id);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              aria-pressed={sel}
                              onClick={() =>
                                up({
                                  postIds: sel ? d.postIds.filter((x) => x !== p.id) : [...d.postIds, p.id],
                                })
                              }
                              className="relative aspect-[4/5] cursor-pointer overflow-hidden rounded-xl border-[3px] bg-transparent p-0"
                              style={{ borderColor: sel ? "var(--color-accent)" : "transparent" }}
                            >
                              <div className="absolute inset-0 overflow-hidden rounded-[9px]">
                                <PostThumb post={p} />
                              </div>
                              <span
                                className="absolute top-1.5 left-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[13px] font-bold shadow-[0_1px_3px_rgba(0,0,0,.25)]"
                                style={{ background: sel ? "var(--color-accent)" : "rgba(255,252,247,0.5)" }}
                              >
                                {sel ? "✓" : ""}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {er("postIds") ? (
                      <span className="text-[13px] font-medium text-danger">{er("postIds")}</span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {stepId === "reply" ? (
              <div className="animate-up-fast flex flex-col gap-[22px]">
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <StepHeader
                      title="Responder no comentário?"
                      help="Uma resposta pública avisa que o link foi pra DM — e ajuda o post a aparecer mais."
                    />
                  </div>
                  <Switch
                    size="lg"
                    checked={d.publicReply}
                    onChange={() => up({ publicReply: !d.publicReply })}
                    label="Responder no comentário"
                  />
                </div>
                {d.publicReply ? (
                  <div className="flex flex-col gap-2.5">
                    <span className="text-sm leading-normal text-ink-2">
                      A cada comentário, sorteamos uma dessas variações — assim não parece robô.
                    </span>
                    {d.replies.map((text, i) => (
                      <div key={i} className="flex flex-col gap-1.5 rounded-[14px] bg-bg p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted">VARIAÇÃO {i + 1}</span>
                          {d.replies.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => up({ replies: d.replies.filter((_, j) => j !== i) })}
                              className="h-7 cursor-pointer border-none bg-transparent px-2 text-[13px] font-medium whitespace-nowrap text-danger"
                            >
                              Remover
                            </button>
                          ) : null}
                        </div>
                        <input
                          value={text}
                          onChange={(e) => up({ replies: d.replies.map((r, j) => (j === i ? e.target.value : r)) })}
                          placeholder="Ex.: Te mandei na DM! 💌"
                          maxLength={300}
                          className="h-[46px] rounded-[11px] border-[1.5px] border-line bg-white px-3.5 text-[15px] text-ink outline-accent"
                        />
                        <EmojiRow
                          onPick={(e) => up({ replies: d.replies.map((r, j) => (j === i ? r + e : r)) })}
                        />
                      </div>
                    ))}
                    {d.replies.length < 5 ? (
                      <button
                        type="button"
                        onClick={() => up({ replies: [...d.replies, ""] })}
                        className="h-10 cursor-pointer self-start rounded-[11px] border border-dashed border-line-dashed bg-transparent px-3.5 text-sm font-medium whitespace-nowrap"
                      >
                        + Adicionar variação
                      </button>
                    ) : null}
                    {er("replies") ? (
                      <span className="text-[13px] font-medium text-danger">{er("replies")}</span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {stepId === "messages" ? (
              <div className="animate-up-fast flex flex-col gap-[22px]">
                <StepHeader
                  title="O que vai na DM"
                  help={
                    <>
                      Use <strong className="text-accent-ink">{"{link}"}</strong> onde o link deve aparecer.
                      Toque nos emojis para inserir.
                    </>
                  }
                />
                {msgBlocks.map((m) => (
                  <div
                    key={m.k}
                    className="flex flex-col gap-2.5 rounded-2xl border border-line bg-white p-4"
                    style={{ opacity: m.k === "dmNonFollower" && !d.requireFollow ? 0.55 : 1 }}
                  >
                    <div className="flex items-baseline gap-2.5">
                      <span className="text-xs font-semibold text-accent-ink">{m.tag}</span>
                      <strong className="text-base font-semibold">{m.title}</strong>
                    </div>
                    <span className="-mt-1 text-[13px] leading-[1.45] text-muted">{m.help}</span>
                    <textarea
                      value={d[m.k]}
                      onChange={(e) => up({ [m.k]: e.target.value })}
                      rows={3}
                      maxLength={1000}
                      className="resize-y rounded-xl border-[1.5px] bg-white px-3.5 py-3 text-[15px] leading-normal text-ink outline-accent"
                      style={{ borderColor: borderOf(m.k) }}
                    />
                    <EmojiRow
                      onPick={(e) => up({ [m.k]: d[m.k] + e })}
                      extra={
                        <>
                          <button
                            type="button"
                            onClick={() => linkInsert(m.k)}
                            className="ml-1 h-[30px] cursor-pointer rounded-lg border border-accent-line bg-accent-soft px-2.5 text-xs font-semibold text-accent-ink-2"
                          >
                            + {"{link}"}
                          </button>
                          <span className="ml-auto text-xs text-muted">{d[m.k].length}/1000</span>
                        </>
                      }
                    />
                    {er(m.k) ? <span className="text-[13px] font-medium text-danger">{er(m.k)}</span> : null}
                    {m.hasButton ? (
                      <label className="flex flex-col gap-1.5 text-sm font-medium">
                        Texto do botão
                        <input
                          value={d.btnLabel}
                          onChange={(e) => up({ btnLabel: e.target.value })}
                          maxLength={20}
                          placeholder="Quero o link"
                          className="h-11 max-w-[280px] rounded-[11px] border-[1.5px] bg-white px-3.5 text-[15px] font-semibold text-ink outline-accent"
                          style={{ borderColor: borderOf("btnLabel") }}
                        />
                        <span className="text-xs font-normal text-muted">
                          Até 20 caracteres. Tocar nele é o que abre a janela de 24h para você mandar o link.
                        </span>
                        {er("btnLabel") ? (
                          <span className="text-[13px] font-medium text-danger">{er("btnLabel")}</span>
                        ) : null}
                      </label>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            {stepId === "link" ? (
              <div className="animate-up-fast flex flex-col gap-[22px]">
                <StepHeader title="Link e regras" help="Pra onde a pessoa vai e quem pode receber." />
                <label className="flex flex-col gap-2 text-sm font-medium">
                  URL do link
                  <input
                    value={d.url}
                    onChange={(e) => up({ url: e.target.value })}
                    type="url"
                    inputMode="url"
                    placeholder="https://seusite.com.br/pagina"
                    className={`${inputBase} h-[50px] px-3.5 text-base font-normal`}
                    style={{ borderColor: borderOf("url") }}
                  />
                  {er("url") ? <span className="text-[13px] font-medium text-danger">{er("url")}</span> : null}
                </label>
                <div className="flex items-start gap-4 rounded-2xl bg-bg p-4">
                  <div className="flex flex-1 flex-col gap-1">
                    <strong className="text-base font-semibold">Exigir que siga antes de liberar o link</strong>
                    <span className="text-sm leading-normal text-ink-2">
                      Quem não segue recebe a mensagem pedindo pra seguir. Ótimo pra ganhar seguidores.
                    </span>
                  </div>
                  <Switch
                    size="lg"
                    checked={d.requireFollow}
                    onChange={() => up({ requireFollow: !d.requireFollow })}
                    label="Exigir que siga"
                  />
                </div>
                <div className="flex flex-col gap-3 rounded-2xl bg-bg p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex flex-1 flex-col gap-1">
                      <strong className="text-base font-semibold">Mostrar o link como botão</strong>
                      <span className="text-sm leading-normal text-ink-2">
                        Além do texto, aparece um botão clicável abaixo da mensagem.
                      </span>
                    </div>
                    <Switch
                      size="lg"
                      checked={d.linkButton}
                      onChange={() => up({ linkButton: !d.linkButton })}
                      label="Mostrar o link como botão"
                    />
                  </div>
                  {d.linkButton ? (
                    <label className="flex flex-col gap-1.5 text-sm font-medium">
                      Texto do botão de link
                      <input
                        value={d.linkLabel}
                        onChange={(e) => up({ linkLabel: e.target.value })}
                        maxLength={20}
                        placeholder="Abrir link"
                        className="h-11 max-w-[280px] rounded-[11px] border-[1.5px] border-line bg-white px-3.5 text-[15px] font-semibold text-ink outline-accent"
                      />
                    </label>
                  ) : null}
                </div>
                {d.id ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Excluir esta automação? Não dá pra desfazer.")) void deleteAutomation(d.id!);
                    }}
                    className="h-10 cursor-pointer self-start border-none bg-transparent px-0 text-sm font-medium text-danger underline underline-offset-[3px]"
                  >
                    Excluir automação
                  </button>
                ) : null}
              </div>
            ) : null}

            {stepId === "story" ? (
              <div className="animate-up-fast flex flex-col gap-[22px]">
                <StepHeader
                  title="Quando alguém responder"
                  help="Escolha qual story dispara essa automação."
                />
                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-2.5">
                  <RadioCard selected={d.target === "all"} onPick={() => up({ target: "all" })} label="Qualquer story">
                    <span className="text-[13px] leading-[1.45] text-ink-2">
                      Vale para todos os seus stories, agora e nos próximos.
                    </span>
                  </RadioCard>
                  <RadioCard
                    selected={d.target === "specific"}
                    onPick={() => up({ target: "specific" })}
                    label="Um story específico"
                  >
                    <span className="text-[13px] leading-[1.45] text-ink-2">
                      Você escolhe entre os stories que estão no ar agora.
                    </span>
                  </RadioCard>
                </div>
                {d.target === "specific" ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[15px] font-semibold">Stories no ar agora</span>
                      <span
                        className="text-[13px] font-medium"
                        style={{ color: d.postIds.length ? "var(--color-success)" : "var(--color-muted)" }}
                      >
                        {d.postIds.length
                          ? `${d.postIds.length} selecionado${d.postIds.length > 1 ? "s" : ""}`
                          : "Nenhum selecionado"}
                      </span>
                    </div>
                    {posts.length === 0 ? (
                      <div className="rounded-[14px] bg-bg px-4 py-6 text-center text-sm leading-normal text-muted">
                        Você não tem stories no ar agora. Stories ficam disponíveis por 24h — publique um e
                        volte aqui, ou escolha &quot;Qualquer story&quot;.
                      </div>
                    ) : (
                      <PickGrid
                        items={posts}
                        selected={d.postIds}
                        onToggle={(id) =>
                          up({
                            postIds: d.postIds.includes(id)
                              ? d.postIds.filter((x) => x !== id)
                              : [...d.postIds, id],
                          })
                        }
                      />
                    )}
                    {er("postIds") ? (
                      <span className="text-[13px] font-medium text-danger">{er("postIds")}</span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {stepId === "message" ? (
              <div className="animate-up-fast flex flex-col gap-[22px]">
                <StepHeader
                  title="A DM com o link será enviada"
                  help={
                    <>
                      Use <strong className="text-accent-ink">{"{link}"}</strong> onde o link deve aparecer.
                    </>
                  }
                />
                <div className="flex flex-col gap-2.5 rounded-2xl border border-line bg-white p-4">
                  <textarea
                    value={d.dmFollower}
                    onChange={(e) => up({ dmFollower: e.target.value })}
                    rows={4}
                    maxLength={1000}
                    placeholder="Escreva uma mensagem…"
                    className="resize-y rounded-xl border-[1.5px] bg-white px-3.5 py-3 text-[15px] leading-normal text-ink outline-accent"
                    style={{ borderColor: borderOf("dmFollower") }}
                  />
                  <EmojiRow
                    onPick={(e) => up({ dmFollower: d.dmFollower + e })}
                    extra={
                      <>
                        <button
                          type="button"
                          onClick={() => linkInsert("dmFollower")}
                          className="ml-1 h-[30px] cursor-pointer rounded-lg border border-accent-line bg-accent-soft px-2.5 text-xs font-semibold text-accent-ink-2"
                        >
                          + {"{link}"}
                        </button>
                        <span className="ml-auto text-xs text-muted">{d.dmFollower.length}/1000</span>
                      </>
                    }
                  />
                  {er("dmFollower") ? (
                    <span className="text-[13px] font-medium text-danger">{er("dmFollower")}</span>
                  ) : null}
                </div>
                <label className="flex flex-col gap-2 text-sm font-medium">
                  URL do link
                  <input
                    value={d.url}
                    onChange={(e) => up({ url: e.target.value })}
                    type="url"
                    inputMode="url"
                    placeholder="https://seusite.com.br/pagina"
                    className={`${inputBase} h-[50px] px-3.5 text-base font-normal`}
                    style={{ borderColor: borderOf("url") }}
                  />
                  {er("url") ? <span className="text-[13px] font-medium text-danger">{er("url")}</span> : null}
                </label>
                <ToggleRow
                  title="Mostrar o link como botão"
                  help="Além do texto, aparece um botão clicável abaixo da mensagem."
                  checked={d.linkButton}
                  onChange={() => up({ linkButton: !d.linkButton })}
                >
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Texto do botão de link
                    <input
                      value={d.linkLabel}
                      onChange={(e) => up({ linkLabel: e.target.value })}
                      maxLength={20}
                      placeholder="Abrir link"
                      className="h-11 max-w-[280px] rounded-[11px] border-[1.5px] border-line bg-white px-3.5 text-[15px] font-semibold text-ink outline-accent"
                    />
                  </label>
                </ToggleRow>
              </div>
            ) : null}

            {stepId === "extras" ? (
              <div className="animate-up-fast flex flex-col gap-[22px]">
                <StepHeader
                  title="Outros recursos para automatizar"
                  help="Tudo opcional. Ligue só o que fizer sentido pra você."
                />
                <ToggleRow
                  title="Reagir com ♥ à resposta"
                  help="Quando alguém responder ao story, o Manochat curte a mensagem dela."
                  checked={d.reactHeart}
                  onChange={() => up({ reactHeart: !d.reactHeart })}
                />
                <ToggleRow
                  title="Pedir para seguir antes de enviar o link"
                  help="Quem não segue recebe um pedido pra seguir e um botão pra tentar de novo."
                  checked={d.requireFollow}
                  onChange={() => up({ requireFollow: !d.requireFollow })}
                >
                  <textarea
                    value={d.dmNonFollower}
                    onChange={(e) => up({ dmNonFollower: e.target.value })}
                    rows={3}
                    maxLength={1000}
                    className="resize-y rounded-xl border-[1.5px] bg-white px-3.5 py-3 text-[15px] leading-normal text-ink outline-accent"
                    style={{ borderColor: borderOf("dmNonFollower") }}
                  />
                  {er("dmNonFollower") ? (
                    <span className="text-[13px] font-medium text-danger">{er("dmNonFollower")}</span>
                  ) : null}
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Texto do botão
                    <input
                      value={d.btnLabel}
                      onChange={(e) => up({ btnLabel: e.target.value })}
                      maxLength={20}
                      placeholder="Já sigo ✅"
                      className="h-11 max-w-[280px] rounded-[11px] border-[1.5px] bg-white px-3.5 text-[15px] font-semibold text-ink outline-accent"
                      style={{ borderColor: borderOf("btnLabel") }}
                    />
                  </label>
                </ToggleRow>
                <ToggleRow
                  title="Pedir e-mail"
                  help="Depois do link, o Manochat pergunta o e-mail e guarda na aba Leads."
                  checked={d.collectEmail}
                  onChange={() => up({ collectEmail: !d.collectEmail })}
                >
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Pergunta
                    <input
                      value={d.emailPrompt}
                      onChange={(e) => up({ emailPrompt: e.target.value })}
                      maxLength={300}
                      className="h-11 rounded-[11px] border-[1.5px] border-line bg-white px-3.5 text-[15px] font-normal text-ink outline-accent"
                    />
                  </label>
                </ToggleRow>
                <ToggleRow
                  title="Pedir WhatsApp"
                  help="Pergunta o número (com DDD) e guarda na aba Leads."
                  checked={d.collectPhone}
                  onChange={() => up({ collectPhone: !d.collectPhone })}
                >
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Pergunta
                    <input
                      value={d.phonePrompt}
                      onChange={(e) => up({ phonePrompt: e.target.value })}
                      maxLength={300}
                      className="h-11 rounded-[11px] border-[1.5px] border-line bg-white px-3.5 text-[15px] font-normal text-ink outline-accent"
                    />
                  </label>
                </ToggleRow>
                {d.collectEmail || d.collectPhone ? (
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Mensagem de agradecimento
                    <input
                      value={d.thanksText}
                      onChange={(e) => up({ thanksText: e.target.value })}
                      maxLength={300}
                      className="h-11 rounded-[11px] border-[1.5px] border-line bg-white px-3.5 text-[15px] font-normal text-ink outline-accent"
                    />
                    <span className="text-xs font-normal text-muted">Enviada depois que a pessoa responder tudo.</span>
                  </label>
                ) : null}
                <div className="flex items-center gap-3 rounded-2xl border border-dashed border-line-dashed p-4">
                  <div className="flex flex-1 flex-col gap-1">
                    <strong className="text-base font-semibold text-muted">Acompanhamento para fortalecer o engajamento</strong>
                    <span className="text-sm leading-normal text-muted">Uma mensagem de lembrete depois de um tempo.</span>
                  </div>
                  <span className="h-6 rounded-full bg-fill px-2.5 text-xs leading-6 font-semibold text-muted">Em breve</span>
                </div>
                {d.id ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Excluir esta automação? Não dá pra desfazer.")) void deleteAutomation(d.id!);
                    }}
                    className="h-10 cursor-pointer self-start border-none bg-transparent px-0 text-sm font-medium text-danger underline underline-offset-[3px]"
                  >
                    Excluir automação
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex justify-between gap-2.5">
            <button
              type="button"
              disabled={step === 0}
              onClick={() => step > 0 && goStep(step - 1)}
              className="h-[46px] cursor-pointer rounded-xl border border-line-strong bg-transparent px-4 text-[15px] font-medium whitespace-nowrap"
              style={{ opacity: step === 0 ? 0.4 : 1 }}
            >
              ← Voltar
            </button>
            {step < lastStep ? (
              <button
                type="button"
                onClick={() => goStep(Math.min(lastStep, step + 1))}
                className="h-[46px] cursor-pointer rounded-xl border-none bg-ink px-[18px] text-[15px] font-semibold whitespace-nowrap text-white"
              >
                Próximo: {STEP_LABELS[stepIds[step + 1]]} →
              </button>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={activate}
                className="h-[46px] cursor-pointer rounded-xl border-none bg-accent px-[18px] text-[15px] font-semibold whitespace-nowrap disabled:opacity-60"
              >
                {isActive ? "Publicar alterações" : "Ativar automação"}
              </button>
            )}
          </div>
        </div>

        <aside className="sticky top-6 hidden w-[380px] shrink-0 min-[1180px]:block">
          <ConversationPreview {...previewProps} />
        </aside>
      </div>

      <div className="h-[84px] min-[1180px]:hidden" />
      <button
        type="button"
        onClick={() => setPv(true)}
        className="fixed right-4 bottom-[84px] z-[25] h-12 cursor-pointer rounded-full border-none bg-ink px-[18px] text-sm font-semibold whitespace-nowrap text-white shadow-[0_10px_26px_rgba(27,23,18,.3)] min-[820px]:bottom-6 min-[1180px]:hidden"
      >
        Ver conversa
      </button>
      {pv ? (
        <div className="min-[1180px]:hidden">
          <ConversationPreview {...previewProps} mobile onClose={() => setPv(false)} />
        </div>
      ) : null}
    </div>
  );
}
