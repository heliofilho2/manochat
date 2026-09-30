import { LegalP, LegalSection, LegalShell, PRIVACY_EMAIL } from "@/components/legal-shell";

export const metadata = { title: "Política de Privacidade — Manochat" };

export default function PrivacyPage() {
  return (
    <LegalShell>
      <div className="flex flex-col gap-2.5">
        <span className="text-[13px] font-medium text-muted">Atualizada em 30 de setembro de 2026</span>
        <h1 className="m-0 text-[clamp(34px,5vw,52px)] leading-[1.02] font-bold tracking-[-0.025em]">
          Política de Privacidade
        </h1>
        <p className="m-0 text-lg leading-[1.6] text-ink-2">
          Em linguagem simples: o que o Manochat coleta, por quê, e como você controla seus dados, conforme a
          Lei Geral de Proteção de Dados (LGPD).
        </p>
      </div>
      <LegalSection title="1. O que coletamos">
        <LegalP>
          Quando você conecta sua conta pela integração oficial da Meta, recebemos: nome de usuário, nome, foto
          de perfil, número de seguidores, seus posts (miniaturas e legendas), os comentários feitos nos seus
          posts e as mensagens diretas trocadas pelas automações. Também guardamos as automações e textos que
          você cria. Nunca recebemos sua senha.
        </LegalP>
      </LegalSection>
      <LegalSection title="2. Para que usamos">
        <LegalP>
          Só para fazer o app funcionar: identificar comentários com suas palavras-chave, responder, enviar as
          DMs, mostrar métricas no painel e montar sua página de link na bio. Não vendemos dados e não usamos
          suas conversas para publicidade.
        </LegalP>
      </LegalSection>
      <LegalSection title="3. Com quem compartilhamos">
        <LegalP>
          Com a Meta, para enviar respostas e mensagens em seu nome, e com provedores de hospedagem que
          armazenam os dados com criptografia. Nenhum outro terceiro tem acesso.
        </LegalP>
      </LegalSection>
      <LegalSection title="4. Por quanto tempo">
        <LegalP>
          Enquanto sua conta estiver ativa. Histórico de comentários e DMs é apagado automaticamente após 12
          meses. Se você excluir a conta, apagamos tudo em até 30 dias.
        </LegalP>
      </LegalSection>
      <LegalSection title="5. Seus direitos">
        <LegalP>
          Você pode pedir acesso, correção, cópia ou exclusão dos seus dados a qualquer momento, e revogar a
          conexão com o Instagram. Escreva para{" "}
          <a className="text-accent-ink underline underline-offset-[3px] hover:text-ink" href={`mailto:${PRIVACY_EMAIL}`}>
            {PRIVACY_EMAIL}
          </a>{" "}
          — respondemos em até 15 dias.
        </LegalP>
      </LegalSection>
    </LegalShell>
  );
}
