"use client";

import { useRouter } from "next/navigation";
import { Logo } from "./logo";

export function LegalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="mx-auto flex max-w-[760px] items-center justify-between gap-3 px-[clamp(16px,4vw,32px)] py-5">
        <Logo size={24} text={20} />
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
          className="h-10 cursor-pointer rounded-[11px] border border-line bg-white px-3.5 text-sm font-medium whitespace-nowrap"
        >
          ← Voltar
        </button>
      </header>
      <article className="mx-auto flex max-w-[760px] flex-col gap-7 px-[clamp(16px,4vw,32px)] pt-[clamp(16px,4vw,40px)] pb-20">
        {children}
      </article>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 border-t border-line pt-6">
      <h2 className="m-0 text-[22px] leading-[1.2] font-bold">{title}</h2>
      {children}
    </section>
  );
}

export function LegalP({ children }: { children: React.ReactNode }) {
  return <p className="m-0 text-base leading-[1.7] text-ink-2">{children}</p>;
}

export const PRIVACY_EMAIL = process.env.NEXT_PUBLIC_PRIVACY_EMAIL ?? "privacidade@manochat.app";
