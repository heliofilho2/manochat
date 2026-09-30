"use client";

import { useState } from "react";
import { IconInstagram } from "./icons";

export function LoginButton({ hasError }: { hasError: boolean }) {
  const [loading, setLoading] = useState(false);

  const label = loading
    ? "Conectando ao Instagram…"
    : hasError
      ? "Tentar de novo"
      : "Continuar com Instagram";

  return (
    <a
      href="/api/auth/instagram"
      onClick={() => setLoading(true)}
      aria-disabled={loading}
      className="flex h-[58px] min-w-[min(100%,320px)] cursor-pointer items-center justify-center gap-3 rounded-2xl bg-ink px-[26px] text-[17px] font-semibold whitespace-nowrap text-white transition-colors hover:bg-ink-2"
    >
      {loading ? (
        <span className="block h-[18px] w-[18px] rounded-full border-[2.5px] border-[rgba(255,252,247,0.3)] border-t-accent animate-spin-brand" />
      ) : (
        <IconInstagram size={20} />
      )}
      {label}
    </a>
  );
}
