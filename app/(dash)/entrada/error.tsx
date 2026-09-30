"use client";

import { ErrorCard } from "@/components/error-card";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorCard
      title="Não deu pra carregar a atividade"
      text="O Instagram demorou pra responder. Nenhuma mensagem foi perdida."
      error={error}
      reset={reset}
    />
  );
}
