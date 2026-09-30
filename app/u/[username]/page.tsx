import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BioPage } from "@/components/bio-page";
import { initialsOf } from "@/lib/format";
import { loadPublicBio } from "@/lib/bio/data";

// Bio traffic can spike; a 5-minute cache keeps Neon and the Graph API calm.
export const revalidate = 300;

export async function generateMetadata(props: PageProps<"/u/[username]">): Promise<Metadata> {
  const { username } = await props.params;
  return { title: `@${username}`, description: `Links de @${username}` };
}

export default async function PublicBioPage(props: PageProps<"/u/[username]">) {
  const { username } = await props.params;
  const bio = await loadPublicBio(username);
  if (!bio) notFound();

  return (
    <BioPage
      username={bio.acct.username}
      initials={initialsOf(bio.acct.username)}
      profilePicture={bio.acct.profilePictureUrl}
      followers={bio.acct.followersCount}
      settings={bio.settings}
      items={bio.items}
      posts={bio.posts}
      accountId={bio.acct.id}
    />
  );
}
