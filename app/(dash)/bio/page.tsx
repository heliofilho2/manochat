import { redirect } from "next/navigation";
import { getAccountById } from "@/lib/account";
import { env } from "@/lib/env";
import { initialsOf } from "@/lib/format";
import { loadActiveAutomations, loadBioSettings, loadRecentPosts } from "@/lib/bio/data";
import { getSession } from "@/lib/session";
import { BioEditor } from "./bio-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Minha página de bio — Manochat" };

export default async function BioEditorPage() {
  const session = await getSession();
  if (!session) redirect("/");
  const acct = await getAccountById(session.accountId);
  if (!acct) redirect("/");

  const [settings, autos, posts] = await Promise.all([
    loadBioSettings(acct.id),
    loadActiveAutomations(acct.id),
    loadRecentPosts(acct.id, 30),
  ]);

  const publicUrl = `${env.appUrl}/u/${acct.username}`;
  return (
    <BioEditor
      initial={settings}
      autos={autos}
      posts={posts}
      username={acct.username}
      initials={initialsOf(acct.username)}
      profilePicture={acct.profilePictureUrl}
      followers={acct.followersCount}
      publicUrl={publicUrl}
      displayUrl={publicUrl.replace(/^https?:\/\//, "")}
    />
  );
}
