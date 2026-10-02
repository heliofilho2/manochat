import { LegalP, LegalSection, LegalShell, PRIVACY_EMAIL } from "@/components/legal-shell";
import { DeletionForm } from "./deletion-form";

export const metadata = { title: "Exclusão de dados — Oslinke" };

/** Data Deletion Instructions URL required by Meta. */
export default function DataDeletionPage() {
  return (
    <LegalShell>
      <div className="flex flex-col gap-2.5">
        <span className="text-[13px] font-medium text-muted">Atualizada em 30 de setembro de 2026</span>
        <h1 className="m-0 text-[clamp(34px,5vw,52px)] leading-[1.02] font-bold tracking-[-0.025em]">
          Exclusão de dados
        </h1>
        <p className="m-0 text-lg leading-[1.6] text-ink-2">
          Você pode apagar todos os seus dados do Oslinke quando quiser. Escolha o jeito mais fácil pra você.
        </p>
      </div>
      <LegalSection title="Pelo Instagram">
        <LegalP>
          No Instagram, vá em Configurações → Apps e sites → Oslinke → Remover. Recebemos o aviso da Meta e
          apagamos seus dados automaticamente em até 30 dias.
        </LegalP>
      </LegalSection>
      <section className="flex flex-col gap-4 border-t border-line pt-6">
        <h2 className="m-0 text-[22px] leading-[1.2] font-bold">Por aqui</h2>
        <DeletionForm />
      </section>
      <LegalSection title="Por e-mail">
        <LegalP>
          Mande &quot;Excluir meus dados&quot; com seu @ para{" "}
          <a className="text-accent-ink underline underline-offset-[3px] hover:text-ink" href={`mailto:${PRIVACY_EMAIL}`}>
            {PRIVACY_EMAIL}
          </a>
          .
        </LegalP>
      </LegalSection>
    </LegalShell>
  );
}
