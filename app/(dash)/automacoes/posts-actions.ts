"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import type { PostView } from "@/lib/posts-view";
import { listPosts } from "./posts";

/** "Atualizar lista": pulls the newest posts from Instagram right now. */
export async function refreshPostList(): Promise<PostView[]> {
  const session = await getSession();
  if (!session) redirect("/");
  return listPosts(session.accountId, 60, { force: true });
}
