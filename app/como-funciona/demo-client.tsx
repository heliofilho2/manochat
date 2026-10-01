"use client";

/**
 * Interactive demos for the public "como funciona" page. They render the REAL
 * platform components (conversation preview, bio page) with made-up data, so
 * what visitors see is exactly what the product looks like.
 */
import { useState } from "react";
import { BioPage } from "@/components/bio-page";
import { ScaledPhone } from "@/components/scaled-phone";
import { ConversationPreview } from "@/app/(dash)/automacoes/conversation-preview";
import { BLANK_DRAFT, BLANK_STORY_DRAFT, type AutomationDraft } from "@/lib/automation/draft";
import { DEFAULT_EMAIL_PROMPT, DEFAULT_PHONE_PROMPT, DEFAULT_THANKS } from "@/lib/automation/story";
import { DEFAULT_BIO, mergeStyle, type BioItem, type BioSettings } from "@/lib/bio/theme";

const URL = "https://seusite.com/material";

const DRAFTS: Record<"comment" | "follow" | "story", AutomationDraft> = {
  comment: {
    ...BLANK_DRAFT,
    name: "Material grátis",
    keywords: ["QUERO"],
    requireFollow: false,
    url: URL,
  },
  follow: {
    ...BLANK_DRAFT,
    name: "Material grátis",
    keywords: ["QUERO"],
    requireFollow: true,
    url: URL,
  },
  story: {
    ...BLANK_STORY_DRAFT,
    name: "Story do guia",
    anyWords: true,
    requireFollow: false,
    url: URL,
    collectEmail: true,
    collectPhone: true,
    emailPrompt: DEFAULT_EMAIL_PROMPT,
    phonePrompt: DEFAULT_PHONE_PROMPT,
    thanksText: DEFAULT_THANKS,
  },
};

export function DemoConversation({ kind }: { kind: keyof typeof DRAFTS }) {
  const [follows, setFollows] = useState(kind !== "follow");
  const d = DRAFTS[kind];
  return (
    <ConversationPreview
      d={d}
      post={undefined}
      username="seu.perfil"
      reply={d.replies[0] ?? ""}
      onShuffle={() => {}}
      follows={follows}
      onFollows={setFollows}
    />
  );
}

const ITEMS: BioItem[] = [
  { id: "a1", kind: "auto", label: "Material grátis", keyword: "QUERO", postId: null, url: "", hidden: false },
  { id: "h1", kind: "heading", label: "Comece aqui", keyword: "", postId: null, url: "", hidden: false },
  { id: "m1", kind: "manual", label: "Meu curso", keyword: "", postId: null, url: "https://seusite.com/curso", hidden: false },
  { id: "m2", kind: "manual", label: "Newsletter da semana", keyword: "", postId: null, url: "https://seusite.com/news", hidden: false },
];

const BIO: BioSettings = {
  ...DEFAULT_BIO,
  theme: "lilas",
  bio: "Criadora de conteúdo. Receitas simples e links úteis.",
  showPosts: false,
  style: mergeStyle({
    wallpaper: { type: "gradient", color: "#E8E3FF", color2: "#CFC6FF", angle: 160 },
    button: { style: "glass" },
    socials: [{ type: "tiktok", url: "seu.perfil" }],
  }),
};

export function DemoBio() {
  return (
    <div className="h-[600px] w-full max-w-[340px] overflow-hidden rounded-[32px] border-[6px] border-ink shadow-float">
      <div className="h-full overflow-y-auto overflow-x-hidden">
        {/* Frame: 340px wide, 6px border, 600px tall. */}
        <ScaledPhone innerWidth={328} innerHeight="588px">
          <BioPage
            username="seu.perfil"
            initials="SP"
            profilePicture={null}
            followers={12400}
            settings={BIO}
            items={ITEMS}
            posts={[]}
            accountId={null}
            framed
          />
        </ScaledPhone>
      </div>
    </div>
  );
}
