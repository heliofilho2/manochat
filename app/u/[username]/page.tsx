import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadBio } from "@/lib/bio/data";
import { formatFollowers } from "@/lib/bio/links";

// Bio traffic can spike; a 5-minute cache keeps Neon and the Graph API calm.
export const revalidate = 300;

export async function generateMetadata(props: PageProps<"/u/[username]">): Promise<Metadata> {
  const { username } = await props.params;
  return { title: `@${username}`, description: `Links de @${username}` };
}

const thumb = (p: { thumbnailUrl: string | null; mediaUrl: string | null }) =>
  p.thumbnailUrl ?? p.mediaUrl;

export default async function BioPage(props: PageProps<"/u/[username]">) {
  const { username } = await props.params;
  const bio = await loadBio(username);
  if (!bio) notFound();

  return (
    <main className="min-h-dvh bg-[#f4efe6] px-4 py-10 text-[#1d1a16]">
      <div className="mx-auto w-full max-w-md">
        <header className="flex flex-col items-center text-center">
          {bio.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bio.avatar}
              alt=""
              className="h-24 w-24 rounded-full border-2 border-[#1d1a16] object-cover"
            />
          ) : (
            <div className="h-24 w-24 rounded-full border-2 border-[#1d1a16] bg-[#e4572e]" />
          )}
          <h1 className="mt-4 text-xl font-bold tracking-tight">@{bio.username}</h1>
          {bio.followers !== null && (
            <p className="mt-1 text-sm text-[#6b6357]">
              {formatFollowers(bio.followers)} seguidores
            </p>
          )}
        </header>

        {bio.links.length > 0 && (
          <nav className="mt-8 space-y-3" aria-label="Links">
            {bio.links.map((l) => (
              <a
                key={l.id}
                href={`/r/${l.id}`}
                className="block rounded-2xl border-2 border-[#1d1a16] bg-white px-5 py-4 shadow-[4px_4px_0_#1d1a16] transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#1d1a16]"
              >
                <span className="block font-semibold">{l.title}</span>
                <span className="mt-0.5 block text-xs text-[#6b6357]">{l.hint}</span>
              </a>
            ))}
          </nav>
        )}

        {bio.posts.length > 0 && (
          <section className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#6b6357]">
              Últimos posts
            </h2>
            <ul className="mt-3 grid grid-cols-3 gap-2">
              {bio.posts.map((p) => (
                <li key={p.id}>
                  <a
                    href={`/r/p-${p.id}`}
                    className="block aspect-square overflow-hidden rounded-xl border-2 border-[#1d1a16] bg-[#e4dccd]"
                  >
                    {thumb(p) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumb(p)!}
                        alt={p.caption?.slice(0, 80) ?? "Post"}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="mt-12 text-center text-xs text-[#6b6357]">
          feito com Manochat
        </footer>
      </div>
    </main>
  );
}
