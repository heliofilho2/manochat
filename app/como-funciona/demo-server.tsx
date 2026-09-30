/**
 * Static copies of the Leads and Painel layouts with made-up numbers. The markup
 * mirrors app/(dash)/leads/page.tsx and app/(dash)/painel/page.tsx: keep them in
 * sync when those screens change.
 */
import { fmt, initialsOf } from "@/lib/format";
import { toneFor } from "@/lib/posts-view";

const LEADS = [
  { user: "julia.m", when: "há 3 min", email: "julia@email.com", phone: "31999990000", trigger: "guia", step: "done" },
  { user: "carlos.dev", when: "há 21 min", email: "carlos@email.com", phone: "11988881111", trigger: "guia", step: "done" },
  { user: "mari.ok", when: "há 1 h", email: "mari@email.com", phone: null, trigger: "guia", step: "phone" },
] as const;

function Stat({ label, value, hint, highlight = false }: { label: string; value: string; hint: string; highlight?: boolean }) {
  return (
    <div
      className="flex min-h-32 flex-col gap-2.5 rounded-[18px] border p-[18px]"
      style={{
        background: highlight ? "var(--color-accent-soft)" : "#fff",
        borderColor: highlight ? "var(--color-accent-line)" : "var(--color-line)",
      }}
    >
      <span className="text-sm font-medium opacity-80">{label}</span>
      <span className="text-[34px] leading-none font-bold tracking-[-0.02em] tabular-nums">{value}</span>
      <span className="mt-auto text-xs leading-[1.4] opacity-75">{hint}</span>
    </div>
  );
}

export function DemoLeads() {
  return (
    <div className="flex w-full flex-col gap-4 text-ink">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Leads" value="318" hint="Todas as pessoas capturadas" />
        <Stat label="Com e-mail" value="291" hint="Responderam o e-mail" />
        <Stat label="Com WhatsApp" value="204" hint="Deixaram o número" />
      </div>
      <div className="flex flex-col overflow-hidden rounded-[20px] border border-line bg-white">
        {LEADS.map((l) => (
          <div key={l.user} className="flex gap-3.5 border-b border-line-soft p-4 last:border-b-0">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
              style={{ background: toneFor(l.user) }}
            >
              {initialsOf(l.user)}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <strong className="text-[15px] font-semibold">@{l.user}</strong>
                <span className="text-[13px] text-muted">{l.when} · Story do guia</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span>{l.email}</span>
                {l.phone ? (
                  <span className="text-accent-ink underline underline-offset-[3px]">{l.phone}</span>
                ) : (
                  <span className="text-muted">sem WhatsApp</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="h-6 rounded-md border border-line bg-bg px-2 text-[11px] leading-6 font-semibold tracking-[0.03em]">
                  {l.trigger.toUpperCase()}
                </span>
                {l.step !== "done" ? (
                  <span className="flex h-6 items-center rounded-full bg-warning-bg px-[9px] text-xs font-semibold text-warning">
                    Aguardando WhatsApp
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const FUNNEL = [
  { label: "Alcance dos posts", value: fmt(48200), rate: "", w: 100, color: "var(--color-line-strong)" },
  { label: "DMs enviadas", value: fmt(1240), rate: "2,6% do alcance", w: 34, color: "var(--color-accent-hover)" },
  { label: "Cliques no link da bio", value: fmt(412), rate: "33,2% das DMs", w: 14, color: "var(--color-accent)" },
];

export function DemoPainel() {
  return (
    <div className="flex w-full flex-col gap-4 text-ink">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Contatos" value={fmt(1876)} hint="Pessoas que já conversaram com você" />
        <Stat label="DMs enviadas" value={fmt(1240)} hint="12 falharam · veja na caixa de entrada" highlight />
      </div>
      <section className="flex flex-col gap-[18px] rounded-[20px] border border-line bg-white p-[22px]">
        <div className="flex flex-col gap-1">
          <h3 className="m-0 text-[22px] leading-[1.15] font-bold tracking-[-0.02em]">Funil</h3>
          <span className="text-[13px] text-muted">De quem viu seus posts até quem clicou no link</span>
        </div>
        <div className="flex flex-col gap-3.5">
          {FUNNEL.map((f) => (
            <div key={f.label} className="flex flex-col gap-[7px]">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-muted">{f.label}</span>
                <span className="flex items-baseline gap-2.5">
                  <span className="text-xs font-medium whitespace-nowrap text-accent-ink">{f.rate}</span>
                  <span className="text-[22px] font-bold tabular-nums">{f.value}</span>
                </span>
              </div>
              <span className="block h-3 overflow-hidden rounded-md bg-fill">
                <span className="block h-full rounded-[5px]" style={{ width: `${f.w}%`, background: f.color }} />
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
