"use client";

import { useState } from "react";
import { PostThumb } from "@/components/post-thumb";
import { IconChat } from "@/components/icons";
import { SocialIcon } from "@/components/social-icons";
import { formatFollowers } from "@/lib/format";
import { resolveStyle } from "@/lib/bio/style";
import { socialHref, type BioItem, type BioSettings } from "@/lib/bio/theme";
import type { PostView } from "@/lib/posts-view";

/**
 * The public link-in-bio page. Also rendered inside the phone frame of the
 * editor (`framed`), where links are inert. `framed` only changes how the height is
 * filled: sizes are identical, since the editor shows it at a real phone width.
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
  const r = resolveStyle(settings);
  const st = settings.style;
  const photo = settings.photo || profilePicture;
  const title = st.title.trim() || `@${username}`;
  const layout = settings.postLayout;
  const byId = new Map(posts.map((p) => [p.id, p]));
  const inert = (e: React.MouseEvent) => {
    if (!accountId) e.preventDefault();
  };
  const href = (path: string) => (accountId ? path : "#");

  // Instagram is always there; the owner adds the rest.
  const socials = [
    ...(st.socials.some((s) => s.type === "instagram")
      ? []
      : [{ type: "instagram" as const, url: username }]),
    ...st.socials,
  ]
    .map((s) => ({ ...s, link: socialHref(s.type, s.url) }))
    .filter((s) => s.link);

  const grid = st.button.layout === "grid";
  const pad = 20;

  const avatar = (size: number, ring = true) => (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full"
      style={{
        width: size,
        height: size,
        background: "#E9C9B4",
        border: ring ? `3px solid ${r.card}` : undefined,
        boxShadow: ring ? `0 0 0 1.5px ${r.line}` : undefined,
      }}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="Foto de perfil" className="h-full w-full object-cover" />
      ) : (
        <span className="font-bold text-[#2B2724]" style={{ fontSize: size / 3 }}>
          {initials}
        </span>
      )}
    </div>
  );

  const socialRow = socials.length > 0 && (
    <div className="flex flex-wrap items-center justify-center gap-3.5" style={{ color: r.text }}>
      {socials.map((s, i) => (
        <a
          key={`${s.type}-${i}`}
          href={accountId ? s.link! : "#"}
          onClick={inert}
          target="_blank"
          rel="noreferrer"
          aria-label={s.type}
          className="opacity-90 transition-opacity hover:opacity-100"
        >
          <SocialIcon type={s.type} size={24} />
        </a>
      ))}
    </div>
  );

  const nameBlock = (align: "center" | "left") => (
    <div className="flex flex-col gap-1" style={{ textAlign: align }}>
      <span className="text-2xl leading-[1.1] font-bold tracking-[-0.02em]">{title}</span>
      {settings.showFollowers && followers !== null ? (
        <span className="text-sm font-medium" style={{ color: r.muted }}>
          {formatFollowers(followers)} seguidores
        </span>
      ) : null}
    </div>
  );

  const bioText = settings.bio ? (
    <p className="m-0 max-w-[360px] text-[15px] leading-normal whitespace-pre-wrap">{settings.bio}</p>
  ) : null;

  let header: React.ReactNode;
  if (st.header === "hero") {
    header = (
      <div className="flex flex-col items-center">
        <div
          className="relative w-full overflow-hidden"
          style={{
            height: 400,
            background: "#E9C9B4",
            WebkitMaskImage: "linear-gradient(to bottom, black 62%, transparent)",
            maskImage: "linear-gradient(to bottom, black 62%, transparent)",
          }}
        >
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="Foto de perfil" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center text-6xl font-bold text-[#2B2724]">
              {initials}
            </span>
          )}
        </div>
        <div className="relative -mt-16 flex flex-col items-center gap-2.5 px-5 text-center">
          {nameBlock("center")}
          {bioText}
          {socialRow}
        </div>
      </div>
    );
  } else if (st.header === "banner") {
    header = (
      <div className="flex flex-col items-center">
        <div
          className="relative w-full overflow-hidden"
          style={{ height: 150, background: r.accent }}
        >
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt=""
              className="h-full w-full object-cover"
              style={{ objectPosition: "center 30%" }}
            />
          ) : null}
        </div>
        <div className="relative -mt-12 flex flex-col items-center gap-2.5 px-5 text-center">
          {avatar(96)}
          {nameBlock("center")}
          {bioText}
          {socialRow}
        </div>
      </div>
    );
  } else if (st.header === "side") {
    header = (
      <div className="flex flex-col gap-3.5 px-5" style={{ paddingTop: 44 }}>
        <div className="flex items-center gap-4">
          {avatar(76)}
          {nameBlock("left")}
        </div>
        {settings.bio ? (
          <p className="m-0 text-[15px] leading-normal whitespace-pre-wrap">{settings.bio}</p>
        ) : null}
        <div className="[&>div]:justify-start">{socialRow}</div>
      </div>
    );
  } else {
    header = (
      <div
        className="flex flex-col items-center gap-2.5 px-5 text-center"
        style={{ paddingTop: 48 }}
      >
        {avatar(96)}
        {nameBlock("center")}
        {bioText}
        {socialRow}
      </div>
    );
  }

  const buttonBase = {
    ...r.button,
    borderRadius: r.radius,
  } as React.CSSProperties;

  return (
    <div
      className={`relative overflow-hidden ${r.frame ? (framed ? "px-3 py-4" : "px-3 py-4 sm:py-10") : ""}`}
      style={{
        ...(framed ? { flexGrow: 1 } : { minHeight: "100dvh" }),
        color: r.text,
        fontFamily: `${r.fontVar}, system-ui, sans-serif`,
        ...(r.wallpaper as React.CSSProperties),
      }}
    >
      {r.blurPhoto && photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover blur-[40px]"
        />
      ) : null}
      {r.overlay ? (
        <div className="pointer-events-none absolute inset-0" style={{ background: r.overlay }} />
      ) : null}

      <div
        className={`relative mx-auto flex max-w-[480px] flex-col gap-[22px] ${r.frame ? "overflow-hidden" : ""}`}
        style={{ paddingBottom: 28, ...(r.frame as React.CSSProperties | null) }}
      >
        {header}

        <div
          className={`grid gap-2.5 ${grid ? "grid-cols-2" : "grid-cols-1"}`}
          style={{ paddingLeft: pad, paddingRight: pad }}
        >
          {items.map((it, i) => {
            const delay = `${80 + i * 60}ms`;
            if (it.kind === "heading") {
              return (
                <h2
                  key={it.id}
                  className="animate-up col-span-full m-0 mt-2 text-center text-[13px] font-bold tracking-[0.08em] uppercase"
                  style={{ animationDelay: delay }}
                >
                  {it.label}
                </h2>
              );
            }
            if (it.kind === "auto") {
              return (
                <div
                  key={it.id}
                  className="animate-up col-span-full flex flex-col"
                  style={{ animationDelay: delay, ...buttonBase }}
                >
                  <button
                    type="button"
                    onClick={() => setOpen(open === it.id ? null : it.id)}
                    className="flex min-h-[60px] w-full cursor-pointer items-center gap-3 border-none bg-transparent px-4 py-3 text-left text-inherit"
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px_11px_11px_3px]"
                      style={{ background: r.accent, color: r.accentFg }}
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
                          style={{ background: r.accent, color: r.accentFg }}
                        >
                          Abrir post no Instagram ↗
                        </a>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            }
            return (
              <a
                key={it.id}
                href={href(`/r/m-${accountId}.${it.id}`)}
                onClick={inert}
                className={`animate-up relative flex min-h-14 items-center justify-center gap-2.5 px-11 py-3 text-center text-[15px] font-semibold no-underline transition-transform duration-300 ease-brand ${
                  r.hover ? "hover:-translate-y-0.5" : ""
                }`}
                style={{ animationDelay: delay, ...buttonBase }}
              >
                {it.label || "Link sem título"}
                <span className="absolute right-4 opacity-50">↗</span>
              </a>
            );
          })}
        </div>

        {settings.showPosts && posts.length > 0 ? (
          <div className="flex flex-col gap-3" style={{ paddingLeft: pad, paddingRight: pad }}>
            <span className="text-xs font-semibold tracking-[0.06em]" style={{ color: r.muted }}>
              ÚLTIMOS POSTS
            </span>
            {layout === "grid3" ? (
              <div className="grid grid-cols-3 gap-[3px] overflow-hidden" style={{ borderRadius: r.radius === "999px" ? "20px" : r.radius }}>
                {posts.slice(0, 9).map((p) => (
                  <a key={p.id} href={href(`/r/p-${p.id}`)} onClick={inert} className="relative block aspect-[4/5]">
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
                    style={{ background: r.card, borderColor: r.line, color: r.text }}
                  >
                    <div className="relative h-16 w-[52px] shrink-0 overflow-hidden rounded-[9px]">
                      <PostThumb post={p} caption={false} />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                      <span className="truncate text-sm font-semibold">{p.caption || "Post"}</span>
                      <span className="text-xs" style={{ color: r.muted }}>
                        {p.type} · {p.date}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {st.showBranding ? (
          <div className="flex justify-center pt-2 pb-1">
            <span className="flex items-center gap-1.5 text-xs font-medium opacity-80" style={{ color: r.muted }}>
              <span className="h-2.5 w-2.5 rounded-[3px_3px_3px_1px]" style={{ background: r.muted }} />
              feito com Manochat
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
