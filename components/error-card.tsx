"use client";

import { useEffect } from "react";

export function ErrorCard({
  title,
  text,
  error,
  reset,
}: {
  title: string;
  text: string;
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-4 rounded-[20px] bg-danger-bg p-[22px] text-danger-ink"
    >
      <div className="flex min-w-[220px] flex-1 flex-col gap-1">
        <strong className="text-[19px] font-bold">{title}</strong>
        <span className="text-sm leading-normal">{text}</span>
      </div>
      <button
        type="button"
        onClick={reset}
        className="h-11 cursor-pointer rounded-xl border-none bg-ink px-[18px] text-sm font-semibold whitespace-nowrap text-white"
      >
        Tentar de novo
      </button>
    </div>
  );
}
