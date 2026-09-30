"use client";

import { useState, useTransition } from "react";
import { sendInboxMessage } from "./actions";

export interface ThreadMessage {
  id: string;
  kind: "day" | "them" | "me";
  text: string;
  meta: string;
}

export interface ThreadItem {
  id: string;
  user: string;
  initials: string;
  tone: string;
  time: string;
  last: string;
  unread: boolean;
  hours: number;
  tags: string;
  messages: ThreadMessage[];
}

export function ConversationsPane({ threads, selected }: { threads: ThreadItem[]; selected: string | null }) {
  const [list, setList] = useState(threads);
  const [sel, setSel] = useState(selected && threads.some((t) => t.id === selected) ? selected : threads[0]?.id);
  const [mobileThread, setMobileThread] = useState(Boolean(selected));
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const cur = list.find((t) => t.id === sel) ?? list[0];
  if (!cur) return null;
  const open = cur.hours > 0;

  const send = () => {
    const text = draft.trim();
    if (!text || pending) return;
    setError("");
    start(async () => {
      const r = await sendInboxMessage(cur.id, text);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setDraft("");
      setList((all) =>
        all.map((t) =>
          t.id === cur.id
            ? {
                ...t,
                last: `Você: ${text}`,
                messages: [...t.messages, { id: r.id, kind: "me", text, meta: `${r.time} · você` }],
              }
            : t,
        ),
      );
    });
  };

  return (
    <div className="flex h-[calc(100vh-260px)] overflow-hidden rounded-[20px] border border-line bg-white min-[820px]:h-[min(680px,calc(100vh-200px))]">
      <div
        className={`w-full shrink-0 flex-col overflow-y-auto border-r border-line-soft min-[820px]:flex min-[820px]:w-80 ${
          mobileThread ? "hidden" : "flex"
        }`}
      >
        {list.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => {
              setSel(v.id);
              setMobileThread(true);
              setList((all) => all.map((t) => (t.id === v.id ? { ...t, unread: false } : t)));
            }}
            className={`flex cursor-pointer items-center gap-3 border-0 border-b border-line-soft px-4 py-3.5 text-left text-ink ${
              sel === v.id ? "min-[820px]:bg-bg" : ""
            } bg-white`}
          >
            <span
              className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
              style={{ background: v.tone }}
            >
              {v.initials}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <span className="flex justify-between gap-2">
                <strong className="text-sm font-semibold">@{v.user}</strong>
                <span className="shrink-0 text-xs text-muted">{v.time}</span>
              </span>
              <span
                className="truncate text-[13px] text-ink-2"
                style={{ fontWeight: v.unread ? 600 : 400 }}
              >
                {v.last}
              </span>
              <span
                className="text-[11px] font-medium"
                style={{ color: v.hours > 0 ? "var(--color-success)" : "var(--color-muted)" }}
              >
                {v.hours > 0 ? `Janela aberta · ${v.hours}h restantes` : "Janela de 24h fechada"}
              </span>
            </span>
            {v.unread ? <span className="h-[9px] w-[9px] shrink-0 rounded-full bg-accent" /> : null}
          </button>
        ))}
      </div>

      <div
        className={`animate-fade min-w-0 flex-1 flex-col min-[820px]:flex ${mobileThread ? "flex" : "hidden"}`}
      >
        <div className="flex min-h-16 items-center gap-2.5 border-b border-line-soft px-4 py-2.5">
          <button
            type="button"
            aria-label="Voltar"
            onClick={() => setMobileThread(false)}
            className="-ml-2 h-10 w-10 cursor-pointer border-none bg-transparent text-xl font-medium min-[820px]:hidden"
          >
            ←
          </button>
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold"
            style={{ background: cur.tone }}
          >
            {cur.initials}
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <strong className="text-[15px] font-semibold">@{cur.user}</strong>
            <span className="truncate text-xs text-muted">{cur.tags}</span>
          </div>
          <span
            className="h-[26px] rounded-full px-2.5 text-xs leading-[26px] font-semibold whitespace-nowrap"
            style={{
              background: open ? "var(--color-success-bg)" : "var(--color-fill)",
              color: open ? "var(--color-success)" : "var(--color-muted)",
            }}
          >
            {open ? `${cur.hours}h restantes` : "Janela fechada"}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto bg-[#FAF8F4] p-4">
          {cur.messages.map((m) =>
            m.kind === "day" ? (
              <span key={m.id} className="self-center text-[11px] font-medium tracking-[0.04em] text-muted">
                {m.text}
              </span>
            ) : m.kind === "them" ? (
              <div
                key={m.id}
                className="max-w-[78%] self-start rounded-[18px_18px_18px_4px] border border-line bg-white px-[13px] py-2.5 text-sm leading-[1.45] break-words"
              >
                {m.text}
              </div>
            ) : (
              <div key={m.id} className="flex max-w-[78%] flex-col items-end gap-[5px] self-end">
                <div className="rounded-[18px_18px_4px_18px] bg-ink px-[13px] py-2.5 text-sm leading-[1.45] break-words whitespace-pre-wrap text-white">
                  {m.text}
                </div>
                <span className="text-[11px] text-muted">{m.meta}</span>
              </div>
            ),
          )}
        </div>
        {open ? (
          <div className="flex flex-col gap-1.5 border-t border-line-soft p-3">
            {error ? <span className="px-1 text-[13px] font-medium text-danger">{error}</span> : null}
            <div className="flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") send();
                }}
                placeholder="Escreva uma mensagem…"
                className="h-[46px] min-w-0 flex-1 rounded-xl border-[1.5px] border-line bg-white px-3.5 text-[15px] text-ink outline-accent"
              />
              <button
                type="button"
                disabled={pending}
                onClick={send}
                className="h-[46px] cursor-pointer rounded-xl border-none bg-accent px-[18px] text-sm font-semibold whitespace-nowrap disabled:opacity-60"
              >
                {pending ? "Enviando…" : "Enviar"}
              </button>
            </div>
          </div>
        ) : (
          <div className="border-t border-line-soft px-4 py-3.5 text-[13px] leading-normal text-muted">
            A janela de 24h fechou. O Instagram só deixa você responder quando a pessoa mandar uma nova mensagem.
          </div>
        )}
      </div>
    </div>
  );
}
