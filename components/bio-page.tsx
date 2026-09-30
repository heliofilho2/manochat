"use client";

import { useState } from "react";
import { PostThumb } from "@/components/post-thumb";
import { IconChat } from "@/components/icons";
import { formatFollowers } from "@/lib/format";
import { SHAPES, THEMES, type BioItem, type BioSettings } from "@/lib/bio/theme";
import type { PostView } from "@/lib/posts-view";

/**
 * The public link-in-bio page. Also rendered inside the phone frame of the
 * editor (`framed`), where links are inert.
 */
export function BioPage({
  username,
  initials,
  profilePicture,
  followers,
  settings,
  items,
  posts,
  accountId,
  framed = false,
}: {
  username: string;
  initials: string;
  profilePicture: string | null;
  followers: number | null;
  settings: BioSettings;
  items: BioItem[];
  posts: PostView[];
  /** null in the editor preview, so nothing is tracked or navigated. */
  accountId: string | null;
  framed?: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const t = THEMES[settings.theme] ?? THEMES.papel;
  const radius = SHAPES[settings.shape] ?? SHAPES.arredondado;
  const photo = settings.photo || profilePicture;
  const layout = settings.postLayout;
  const byId = new Map(posts.map((p) => [p.id, p]));
  const inert = (e: React.MouseEvent) => {
    if (!accountId) e.preventDefault();
  };
  const href = (path: string) => (accountId ? path : "#");

  return (
    <div
      className="transition-[background,color] duration-[250ms]"
      style={{ minHeight: framed ? "100%" : "100vh", background: t.bg, color: t.ink }}
    >
      <div
        className="mx-auto flex max-w-[480px] flex-col gap-[22px]"
        style={{ padding: framed ? "36px 20px 24px" : "48px 20px 28px" }}
      >
        <div className="flex flex-col items-center gap-2.5 text-center">
          <div
            className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-[3px]"
            style={{
              background: "#E9C9B4",
              borderColor: t.card,
              boxShadow: `0 0 0 1.5px ${t.line}`,
            }}
          >
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="Foto de perfil" className="h-full w-full object-cover" />
            ) : (
              <span className="text-[32px] font-bold text-[#2B2724]">{initials}</span>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-2xl leading-[1.1] tracking-[-0.02em]" style={{ fontWeight: t.dispWeight }}>
              @{username}
            </span>
            {settings.showFollowers && followers !== null ? (
              <span className="text-sm font-medium" style={{ color: t.muted }}>
                {formatFollowers(followers)} seguidores
              </span>
            ) : null}
          </div>
          {settings.bio ? (
            <p className="m-0 max-w-[360px] text-[15px] leading-normal whitespace-pre-wrap" style={{ color: t.ink }}>
              {settings.bio}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2.5">
          {items.map((it, i) =>
            it.kind === "auto" ? (
              <div
                key={it.id}
                className="animate-up flex flex-col overflow-hidden border-[1.5px]"
                style={{
                  animationDelay: `${80 + i * 60}ms`,
                  borderRadius: radius,
                  background: t.btnBg,
                  color: t.btnFg,
                  borderColor: t.btnLine,
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpen(open === it.id ? null : it.id)}
                  className="flex min-h-[60px] w-full cursor-pointer items-center gap-3 border-none bg-transparent px-4 py-3 text-left text-inherit"
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px_11px_11px_3px]"
                    style={{ background: t.accent, color: t.accentFg }}
                  >
                    <IconChat size={18} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[15px] leading-[1.3] font-semibold">
                      Comente <span className="tracking-[0.03em]">{it.keyword}</span> no vídeo e receba na DM
                    </span>
                    <span className="text-[13px] leading-[1.3] opacity-75">{it.label}</span>
                  </span>
                  <span
                    className="text-lg opacity-70 transition-transform duration-200"
                    style={{ transform: `rotate(${open === it.id ? 45 : 0}deg)` }}
                  >
                    +
                  </span>
                </button>
                {open === it.id ? (
                  <div className="animate-up-fast flex gap-3 px-4 pb-4">
                    {it.postId && byId.get(it.postId) ? (
                      <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-[10px]">
                        <PostThumb post={byId.get(it.postId)!} caption={false} />
                      </div>
                    ) : null}
                    <div className="flex flex-1 flex-col gap-2 text-[13px] leading-[1.45]">
                      <span>
                        1. Abra o post · 2. Comente <strong>{it.keyword}</strong> · 3. Confira sua DM
                      </span>
                      <a
                        href={href(`/r/a-${it.id}`)}
                        onClick={inert}
                        className="flex h-9 items-center self-start rounded-[10px] px-3.5 text-[13px] font-semibold no-underline"
                        style={{ background: t.accent, color: t.accentFg }}
                      >
                        Abrir post no Instagram ↗
                      </a>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <a
                key={it.id}
                href={href(`/r/m-${accountId}.${it.id}`)}
                onClick={inert}
                className="animate-up relative flex min-h-14 items-center justify-center gap-2.5 border-[1.5px] px-11 py-3 text-center text-[15px] font-semibold no-underline transition-transform duration-300 ease-brand hover:-translate-y-0.5"
                style={{
                  animationDelay: `${80 + i * 60}ms`,
                  borderRadius: radius,
                  background: t.card,
                  color: t.ink,
                  borderColor: t.line,
                }}
              >
                {it.label || "Link sem título"}
                <span className="absolute right-4 opacity-50">↗</span>
              </a>
            ),
          )}
        </div>

        {settings.showPosts && posts.length > 0 ? (
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold tracking-[0.06em]" style={{ color: t.muted }}>
              ÚLTIMOS POSTS
            </span>
            {layout === "grid3" ? (
              <div className="grid grid-cols-3 gap-[3px] overflow-hidden rounded-[14px]">
                {posts.slice(0, 9).map((p) => (
                  <a
                    key={p.id}
                    href={href(`/r/p-${p.id}`)}
                    onClick={inert}
                    className="relative block aspect-[4/5]"
                  >
                    <PostThumb post={p} caption={false} />
                  </a>
                ))}
              </div>
            ) : null}
            {layout === "grid2" ? (
              <div className="grid grid-cols-2 gap-2">
                {posts.slice(0, 6).map((p) => (
                  <a
                    key={p.id}
                    href={href(`/r/p-${p.id}`)}
                    onClick={inert}
                    className="relative block aspect-[4/5] overflow-hidden rounded-[14px]"
                  >
                    <PostThumb post={p} />
                  </a>
                ))}
              </div>
            ) : null}
            {layout === "carrossel" ? (
              <div className="scrollbar-none -mx-5 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-5 pb-1.5">
                {posts.slice(0, 9).map((p) => (
                  <a
                    key={p.id}
                    href={href(`/r/p-${p.id}`)}
                    onClick={inert}
                    className="relative block aspect-[4/5] flex-[0_0_62%] snap-start overflow-hidden rounded-2xl"
                  >
                    <PostThumb post={p} />
                  </a>
                ))}
              </div>
            ) : null}
            {layout === "lista" ? (
              <div className="flex flex-col gap-2">
                {posts.slice(0, 5).map((p) => (
                  <a
                    key={p.id}
                    href={href(`/r/p-${p.id}`)}
                    onClick={inert}
                    className="flex items-center gap-3 rounded-[14px] border p-2 no-underline"
                    style={{ background: t.card, borderColor: t.line, color: t.ink }}
                  >
                    <div className="relative h-16 w-[52px] shrink-0 overflow-hidden rounded-[9px]">
                      <PostThumb post={p} caption={false} />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                      <span className="truncate text-sm font-semibold">{p.caption || "Post"}</span>
                      <span className="text-xs" style={{ color: t.muted }}>
                        {p.type} · {p.date}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex justify-center pt-2 pb-1">
          <span className="flex items-center gap-1.5 text-xs font-medium opacity-80" style={{ color: t.muted }}>
            <span className="h-2.5 w-2.5 rounded-[3px_3px_3px_1px]" style={{ background: t.muted }} />
            feito com Manochat
          </span>
        </div>
      </div>
    </div>
  );
}
