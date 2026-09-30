"use client";

import { ErrorCard } from "@/components/error-card";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorCard
      title="Não conseguimos carregar suas automações"
      text="Pode ser sua internet ou uma instabilidade nossa. Suas automações continuam funcionando normalmente."
      error={error}
      reset={reset}
    />
  );
}
