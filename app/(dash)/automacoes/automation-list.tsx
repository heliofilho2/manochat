"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PostThumb } from "@/components/post-thumb";
import { Switch } from "@/components/switch";
import { useToast } from "@/components/toast";
import { IconBolt } from "@/components/icons";
import type { PostView } from "@/lib/posts-view";
import { setAutomationStatus } from "../actions";
import { resendMissedLinks } from "./resend";

export interface ListItem {
  id: string;
  kind: "comment" | "story";
  name: string;
  status: "active" | "paused" | "draft";
  keywords: string[];
  match: "exact" | "contains";
  target: "specific" | "all" | "future";
  postCount: number;
  thumbs: PostView[];
  dms: number;
}

const ST = {
  active: ["Ativa", "var(--color-success-bg)", "var(--color-success)"],
  paused: ["Pausada", "var(--color-warning-bg)", "var(--color-warning)"],
  draft: ["Rascunho", "var(--color-fill)", "var(--color-ink-2)"],
} as const;

const LABELS = { all: "Todas", active: "Ativas", paused: "Pausadas", draft: "Rascunhos" } as const;
type Filter = keyof typeof LABELS;

function NewButton() {
  return (
    <Link
      href="/automacoes/nova"
      className="flex h-[46px] items-center gap-2 rounded-xl bg-ink px-[18px] text-[15px] font-semibold whitespace-nowrap text-white hover:bg-ink-2"
    >
      <span className="-mt-0.5 text-xl leading-none">+</span>Nova automação
    </Link>
  );
}

export function AutomationList({ items: initial }: { items: ListItem[] }) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<Filter>("all");
  const [, start] = useTransition();
  const [resending, setResending] = useState<string | null>(null);

  const count = (k: Filter) => (k === "all" ? items.length : items.filter((a) => a.status === k).length);
  const shown = items.filter((a) => filter === "all" || a.status === filter);

  const toggle = (a: ListItem) => {
    const next = a.status === "active" ? "paused" : "active";
    // Optimistic: flip now, roll back if the server refuses.
    setItems((list) => list.map((x) => (x.id === a.id ? { ...x, status: next } : x)));
    start(async () => {
      const r = await setAutomationStatus(a.id, next === "active" ? "live" : "paused");
      if (!r.ok) {
        setItems((list) => list.map((x) => (x.id === a.id ? { ...x, status: a.status } : x)));
        toast("Não deu pra alterar agora. Tente de novo.");
        return;
      }
      toast(next === "active" ? `"${a.name}" está ativa` : `"${a.name}" foi pausada`);
      router.refresh();
    });
  };

  const resend = (a: ListItem) => {
    if (!window.confirm(`Reenviar o link de "${a.name}" para quem tocou no botão nas últimas 24h e não recebeu?`)) return;
    setResending(a.id);
    start(async () => {
      const r = await resendMissedLinks(a.id);
      setResending(null);
      if (!r.ok) {
        toast(r.error);
        return;
      }
      const parts = [`${r.sent} enviado${r.sent === 1 ? "" : "s"}`];
      if (r.notFollower) parts.push(`${r.notFollower} ainda não segue${r.notFollower === 1 ? "" : "m"}`);
      if (r.failed) parts.push(`${r.failed} com erro`);
      if (r.expired) parts.push(`${r.expired} fora da janela de 24h`);
      if (r.remaining) parts.push(`${r.remaining} restantes: clique de novo`);
      toast(parts.join(" · "));
      router.refresh();
    });
  };

  return (
    <div className="animate-up flex flex-col gap-[22px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 text-[clamp(30px,4.5vw,42px)] leading-[1.02] font-bold tracking-[-0.025em]">
            Automações
          </h1>
          <span className="text-[15px] text-muted">
            Cada automação responde uma palavra-chave nos posts que você escolher.
          </span>
        </div>
        <NewButton />
      </div>

      {items.length > 0 ? (
        <div className="scrollbar-none flex gap-1.5 overflow-x-auto pb-0.5">
          {(Object.keys(LABELS) as Filter[]).map((k) => {
            const on = filter === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className="flex h-[38px] cursor-pointer items-center gap-2 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap"
                style={{
                  borderColor: on ? "var(--color-accent-line)" : "var(--color-line)",
                  background: on ? "var(--color-accent-soft)" : "transparent",
                  color: on ? "var(--color-accent-ink-2)" : "var(--color-ink-2)",
                }}
              >
                {LABELS[k]}
                <span className="text-xs font-medium opacity-70">{count(k)}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="flex flex-col items-start gap-3.5 rounded-[22px] border border-dashed border-line-strong bg-white p-[clamp(24px,5vw,48px)]">
          <span className="flex h-[52px] w-[52px] items-center justify-center rounded-[16px_16px_16px_4px] bg-accent-soft text-accent-ink">
            <IconBolt size={24} strokeWidth={2} />
          </span>
          <h2 className="m-0 text-[26px] leading-[1.1] font-bold tracking-[-0.02em]">Nenhuma automação ainda</h2>
          <p className="m-0 max-w-[480px] text-base leading-[1.55] text-ink-2">
            Uma ideia pra começar: no seu próximo Reel, peça pra comentarem <strong>QUERO</strong> e mande o link
            por DM pra quem comentar.
          </p>
          <Link
            href="/automacoes/nova"
            className="flex h-[46px] items-center rounded-xl bg-ink px-5 text-[15px] font-semibold whitespace-nowrap text-white"
          >
            Criar minha primeira
          </Link>
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-[18px] border border-dashed border-line-strong bg-white px-5 py-9 text-center text-[15px] text-muted">
          Nenhuma automação em &quot;{LABELS[filter]}&quot;.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {shown.map((a, ix) => {
            const [label, bg, fg] = ST[a.status];
            const on = a.status === "active";
            const isStory = a.kind === "story";
            const specific = !isStory && a.target === "specific" && a.thumbs.length > 0;
            const tgt = isStory
              ? a.target === "specific"
                ? `${a.postCount} ${a.postCount === 1 ? "story" : "stories"}`
                : "qualquer story"
              : a.target === "all"
                ? "todos os posts"
                : a.target === "future"
                  ? "posts a partir de agora"
                  : `${a.postCount} ${a.postCount === 1 ? "post" : "posts"}`;
            return (
              <div
                key={a.id}
                onClick={() => router.push(`/automacoes/${a.id}`)}
                className="animate-up flex cursor-pointer flex-wrap items-center gap-x-[18px] gap-y-3.5 rounded-[18px] border border-line bg-white p-4 transition-[transform,box-shadow,border-color] duration-[350ms] ease-brand hover:-translate-y-0.5 hover:border-line-strong hover:shadow-hover"
                style={{ animationDelay: `${ix * 55}ms` }}
              >
                <div className="flex w-[92px] shrink-0 items-center">
                  {specific ? (
                    a.thumbs.map((p, i) => (
                      <div
                        key={p.id}
                        className="relative h-16 w-[52px] shrink-0 overflow-hidden rounded-[10px] border-2 border-white shadow-[0_1px_3px_rgba(27,23,18,.15)]"
                        style={{ marginLeft: i ? -26 : 0 }}
                      >
                        <PostThumb post={p} caption={false} />
                      </div>
                    ))
                  ) : (
                    <div className="flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-xl border border-line bg-bg text-center">
                      <span className="text-base leading-none font-bold">
                        {isStory ? "◐" : a.target === "future" ? "→" : "∗"}
                      </span>
                      <span className="text-[10px] leading-[1.1] font-medium text-muted">
                        {isStory ? "Story" : a.target === "future" ? "Novos posts" : "Todos"}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex min-w-[200px] flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-[17px] font-semibold">{a.name || "Sem nome"}</strong>
                    <span
                      className="flex h-6 items-center gap-1.5 rounded-full px-[9px] text-xs font-semibold"
                      style={{ background: bg, color: fg }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: fg }} />
                      {label}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(a.keywords.length ? a.keywords : [isStory ? "QUALQUER RESPOSTA" : "—"]).map((k) => (
                      <span
                        key={k}
                        className="h-[26px] rounded-[7px] border border-line bg-bg px-[9px] text-xs leading-[26px] font-semibold tracking-[0.03em]"
                      >
                        {k}
                      </span>
                    ))}
                    <span className="text-[13px] text-muted">
                      {a.keywords.length === 0 && isStory ? "" : `${a.match === "exact" ? "Palavra exata" : "Contém"} · `}
                      {tgt}
                    </span>
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-[18px]">
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-[22px] leading-none font-bold tabular-nums">
                      {a.dms.toLocaleString("pt-BR")}
                    </span>
                    <span className="text-xs whitespace-nowrap text-muted">DMs enviadas</span>
                  </div>
                  {a.status !== "draft" && !isStory ? (
                    <button
                      type="button"
                      disabled={resending === a.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        resend(a);
                      }}
                      title="Confere quem tocou no botão nas últimas 24h e não recebeu o link, e envia para quem já segue"
                      className="h-10 cursor-pointer rounded-[11px] border border-line bg-white px-3 text-[13px] font-semibold whitespace-nowrap disabled:opacity-60"
                    >
                      {resending === a.id ? "Reenviando…" : "Reenviar link"}
                    </button>
                  ) : null}
                  {a.status === "draft" ? (
                    <Link
                      href={`/automacoes/${a.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex h-10 items-center rounded-[11px] border border-ink px-3.5 text-[13px] font-semibold whitespace-nowrap"
                    >
                      Continuar
                    </Link>
                  ) : (
                    <Switch
                      checked={on}
                      onChange={() => toggle(a)}
                      label={on ? "Pausar automação" : "Ativar automação"}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
