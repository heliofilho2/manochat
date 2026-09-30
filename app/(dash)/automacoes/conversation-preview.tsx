"use client";

import { PostThumb } from "@/components/post-thumb";
import type { AutomationDraft } from "@/lib/automation/draft";
import type { PostView } from "@/lib/posts-view";

export interface ConvoItem {
  kind: "bot" | "user" | "note";
  text: string;
  btn?: string;
  linkBtn?: string;
  host?: string;
}

/** The DM thread the person would see, built from the current draft. */
export function buildConvo(d: AutomationDraft, follows: boolean): ConvoItem[] {
  const url = d.url || "seulink.com.br";
  const fill = (t: string) => (t || "").replace(/\{link\}/g, url);
  let host = url;
  try {
    host = new URL(d.url).host;
  } catch {
    /* keep the raw text while the URL is still being typed */
  }
  const btn = d.btnLabel || "Botão";
  const delivery = (): ConvoItem => ({
    kind: "bot",
    text: fill(d.dmFollower),
    linkBtn: d.linkButton ? d.linkLabel || "Abrir link" : undefined,
    host,
  });

  const convo: ConvoItem[] = [
    { kind: "bot", text: d.dmInitial || "…", btn },
    { kind: "user", text: btn },
  ];
  if (d.requireFollow && !follows) {
    convo.push(
      { kind: "bot", text: d.dmNonFollower || "…", btn },
      { kind: "note", text: "Depois que a pessoa seguir e tocar de novo" },
      { kind: "user", text: btn },
      delivery(),
    );
  } else {
    convo.push(delivery());
  }
  return convo;
}

export function ConversationPreview({
  d,
  post,
  username,
  reply,
  onShuffle,
  follows,
  onFollows,
  mobile,
  onClose,
}: {
  d: AutomationDraft;
  post: PostView | undefined;
  username: string;
  reply: string;
  onShuffle: () => void;
  follows: boolean;
  onFollows: (v: boolean) => void;
  mobile?: boolean;
  onClose?: () => void;
}) {
  const convo = buildConvo(d, follows);
  const keyword = d.keywords[0] || "PALAVRA";
  const seg = (on: boolean) => ({
    background: on ? "#fff" : "transparent",
    color: on ? "var(--color-ink)" : "var(--color-muted)",
  });

  const toggle = d.requireFollow ? (
    <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
      {mobile ? null : "Já segue?"}
      <div className="flex rounded-lg bg-fill p-0.5">
        <button
          type="button"
          onClick={() => onFollows(true)}
          className="cursor-pointer rounded-md border-none px-2.5 text-xs font-semibold whitespace-nowrap"
          style={{ ...seg(follows), height: mobile ? 32 : 26 }}
        >
          {mobile ? "Segue" : "Sim"}
        </button>
        <button
          type="button"
          onClick={() => onFollows(false)}
          className="cursor-pointer rounded-md border-none px-2.5 text-xs font-semibold whitespace-nowrap"
          style={{ ...seg(!follows), height: mobile ? 32 : 26 }}
        >
          {mobile ? "Não segue" : "Não"}
        </button>
      </div>
    </div>
  ) : null;

  const thread = (
    <>
      <div className="flex flex-col gap-2.5 rounded-2xl bg-bg p-3 text-ink">
        {post && !mobile ? (
          <div className="flex items-center gap-2 text-xs font-medium text-muted">
            <div className="relative h-9 w-[30px] shrink-0 overflow-hidden rounded-md">
              <PostThumb post={post} caption={false} />
            </div>
            <span className="min-w-0 truncate">Comentários em &quot;{post.caption || "post"}&quot;</span>
          </div>
        ) : null}
        <div className="flex items-start gap-2">
          {mobile ? null : (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#D8D0C0] text-[10px] font-bold">
              JM
            </span>
          )}
          <span className="text-sm leading-[1.4]">
            <strong className="font-semibold">julia.m</strong> {keyword}
          </span>
        </div>
        {d.publicReply ? (
          <div className="flex items-start gap-2" style={{ marginLeft: mobile ? 16 : 34 }}>
            {mobile ? null : (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#E9C9B4] text-[9px] font-bold">
                {username.slice(0, 2).toUpperCase()}
              </span>
            )}
            <span className="flex-1 text-sm leading-[1.4]">
              <strong className="font-semibold">{username}</strong> {reply}
            </span>
            {mobile ? null : (
              <button
                type="button"
                title="Sortear outra variação"
                onClick={onShuffle}
                className="h-6 shrink-0 cursor-pointer rounded-md border-none bg-bg px-1.5 text-[11px] font-medium whitespace-nowrap text-muted"
              >
                ↻ sortear
              </button>
            )}
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-2 text-[11px] font-medium tracking-[0.04em] text-muted">
        <span className="h-px flex-1 bg-fill" />
        DIRECT
        <span className="h-px flex-1 bg-fill" />
      </div>
      {convo.map((c, i) =>
        c.kind === "note" ? (
          <span
            key={i}
            className="self-center rounded-full bg-fill px-2.5 py-1 text-center text-[11px] font-medium text-muted"
          >
            {c.text}
          </span>
        ) : c.kind === "bot" ? (
          <div
            key={i}
            className="animate-up-fast flex max-w-[88%] flex-col items-start gap-1.5"
          >
            <div
              className="rounded-[18px_18px_18px_4px] bg-fill px-[13px] py-2.5 leading-[1.45] break-words whitespace-pre-wrap"
              style={{ fontSize: mobile ? 15 : 14 }}
            >
              {c.text}
            </div>
            {c.btn ? (
              <span
                className="flex items-center rounded-[11px] border border-line-strong bg-white px-4 font-semibold"
                style={{ height: mobile ? 38 : 36, fontSize: mobile ? 14 : 13 }}
              >
                {c.btn}
              </span>
            ) : null}
            {c.linkBtn ? (
              <span className="flex min-w-[180px] flex-col gap-0.5 rounded-xl bg-accent px-3.5 py-2.5">
                <span className="text-sm font-semibold">{c.linkBtn} ↗</span>
                {mobile ? null : <span className="text-[11px] break-all opacity-75">{c.host}</span>}
              </span>
            ) : null}
          </div>
        ) : (
          <div
            key={i}
            className="max-w-[80%] self-end rounded-[18px_18px_4px_18px] bg-accent px-[13px] py-2.5 font-medium leading-[1.45]"
            style={{ fontSize: mobile ? 15 : 14 }}
          >
            {c.text}
          </div>
        ),
      )}
    </>
  );

  if (mobile) {
    return (
      <div className="animate-up-fast fixed inset-0 z-50 flex flex-col bg-white text-ink">
        <div className="flex items-center justify-between gap-2.5 border-b border-fill py-2.5 pr-3 pl-4">
          <span className="text-xs font-semibold tracking-[0.05em] text-muted">PRÉ-VISUALIZAÇÃO</span>
          <div className="flex items-center gap-2">
            {toggle}
            <button
              type="button"
              aria-label="Fechar"
              onClick={onClose}
              className="h-11 w-11 cursor-pointer border-none bg-transparent text-[26px] text-ink"
            >
              ×
            </button>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">{thread}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-[26px] border border-line bg-white text-ink shadow-float">
      <div className="flex items-center justify-between gap-2.5 border-b border-fill px-4 py-3.5">
        <span className="text-xs font-semibold tracking-[0.05em] text-muted">PRÉ-VISUALIZAÇÃO</span>
        {toggle}
      </div>
      <div className="flex max-h-[calc(100vh-140px)] flex-col gap-3 overflow-y-auto p-4">{thread}</div>
    </div>
  );
}
