import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { BLANK_TEMPLATE, TEMPLATES } from "@/lib/flow/templates";
import { createFlow } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Novo fluxo — Oslinke" };

const TRIGGER_LABEL = { comment: "Comentário", story: "Story", dm: "Direct" } as const;

export default async function NewFlowPage() {
  const session = await getSession();
  if (!session) redirect("/");

  return (
    <div className="animate-up flex max-w-[980px] flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Link href="/fluxos" className="flex h-8 items-center self-start text-sm font-medium text-muted">
          ← Fluxos
        </Link>
        <h1 className="m-0 text-[clamp(30px,4.5vw,42px)] leading-[1.02] font-bold tracking-[-0.025em]">
          Por onde começar?
        </h1>
        <span className="text-[15px] text-muted">
          Escolha um modelo pronto e ajuste os textos e links. Tudo pode ser mudado depois.
        </span>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-3">
        {[...TEMPLATES, BLANK_TEMPLATE].map((t) => (
          <form key={t.id} action={createFlow.bind(null, t.id)} className="flex">
            <button
              type="submit"
              className="flex w-full cursor-pointer flex-col gap-3 rounded-[20px] border border-line bg-white p-5 text-left text-ink transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_10px_22px_rgba(27,23,18,.07)]"
            >
              <span className="flex items-center gap-2">
                <span className="flex-1 text-[17px] leading-tight font-bold tracking-[-0.01em]">{t.title}</span>
                {t.steps.length > 0 ? (
                  <span className="rounded-full bg-fill px-2.5 py-1 text-[11px] font-semibold text-muted">
                    {TRIGGER_LABEL[t.triggerKind]}
                  </span>
                ) : null}
              </span>
              <span className="text-sm leading-normal text-muted">{t.description}</span>
              {t.steps.length > 0 ? (
                <span className="flex flex-wrap items-center gap-1 text-xs font-medium text-ink-2">
                  {t.steps.map((step, i) => (
                    <span key={step} className="flex items-center gap-1">
                      {i > 0 ? <span className="text-muted">→</span> : null}
                      <span className="rounded-md bg-bg px-1.5 py-0.5">{step}</span>
                    </span>
                  ))}
                </span>
              ) : null}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
