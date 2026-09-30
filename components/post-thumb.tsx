import type { PostView } from "@/lib/posts-view";

/**
 * Post tile: the real image when Instagram gave us one, otherwise a flat
 * colour block. Fills its (relatively positioned) parent.
 */
export function PostThumb({ post, caption = true }: { post: PostView; caption?: boolean }) {
  return (
    <div
      className="absolute inset-0 flex flex-col justify-end overflow-hidden text-ink"
      style={{ background: post.tone, borderRadius: "inherit" }}
    >
      {post.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.imageUrl}
          alt={post.caption ? post.caption.slice(0, 80) : "Post"}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
      <div className="absolute top-[7px] right-[7px] flex items-center justify-center text-ink opacity-85 drop-shadow-[0_0_2px_rgba(255,255,255,.6)]">
        {post.type === "Reel" ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
          </svg>
        ) : null}
        {post.type === "Carrossel" ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="7" width="13" height="14" rx="2" />
            <path d="M8 3h11a2 2 0 0 1 2 2v11" />
          </svg>
        ) : null}
      </div>
      {caption && !post.imageUrl ? (
        <span className="relative line-clamp-2 px-[9px] py-2 text-[11px] leading-[1.25] font-semibold">
          {post.caption}
        </span>
      ) : null}
    </div>
  );
}
