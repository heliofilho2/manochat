import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccountById } from "@/lib/account";
import { BLANK_DRAFT, BLANK_STORY_DRAFT } from "@/lib/automation/draft";
import { getSession } from "@/lib/session";
import { IconBolt, IconChat } from "@/components/icons";
import { AutomationEditor } from "../automation-editor";
import { listPosts, listStories } from "../posts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nova automação — Manochat" };

export default async function NewAutomationPage({ searchParams }: PageProps<"/automacoes/nova">) {
  const session = await getSession();
  if (!session) redirect("/");
  const { tipo } = await searchParams;

  if (tipo !== "comentario" && tipo !== "story") {
    return (
      <div className="animate-up flex max-w-[820px] flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <Link href="/automacoes" className="flex h-8 items-center self-start text-sm font-medium text-muted">
            ← Automações
          </Link>
          <h1 className="m-0 text-[clamp(30px,4.5vw,42px)] leading-[1.02] font-bold tracking-[-0.025em]">
            O que dispara a automação?
          </h1>
          <span className="text-[15px] text-muted">Você pode criar as duas e usar quando quiser.</span>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-3">
          {[
            {
              href: "/automacoes/nova?tipo=comentario",
              Icon: IconBolt,
              title: "Comentário em um post",
              text: "Alguém comenta uma palavra no seu post ou Reel e recebe a resposta pública e o link na DM.",
            },
            {
              href: "/automacoes/nova?tipo=story",
              Icon: IconChat,
              title: "Resposta a um story",
              text: "Alguém responde ao seu story e recebe o link na DM. Dá pra pedir e-mail e WhatsApp e guardar como lead.",
            },
          ].map(({ href, Icon, title, text }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col gap-3 rounded-[20px] border border-line bg-white p-5 transition-[transform,box-shadow] duration-[350ms] ease-brand hover:-translate-y-0.5 hover:shadow-hover"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-[14px_14px_14px_4px] bg-accent-soft text-accent-ink">
                <Icon size={22} />
              </span>
              <strong className="text-xl font-bold tracking-[-0.02em]">{title}</strong>
              <span className="text-sm leading-normal text-ink-2">{text}</span>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const acct = await getAccountById(session.accountId);
  if (!acct) redirect("/");
  const isStory = tipo === "story";
  const items = isStory ? await listStories(session.accountId) : await listPosts(session.accountId);

  return (
    <AutomationEditor
      initial={isStory ? BLANK_STORY_DRAFT : BLANK_DRAFT}
      posts={items}
      username={acct.username}
    />
  );
}
