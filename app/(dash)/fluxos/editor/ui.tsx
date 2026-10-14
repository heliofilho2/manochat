"use client";

import { useState } from "react";

export const inputCls =
  "h-[46px] w-full min-w-0 rounded-[12px] border-[1.5px] border-line bg-white px-3 text-[16px] text-ink outline-accent min-[700px]:h-[44px] min-[700px]:text-[15px]";
export const areaCls =
  "w-full resize-y rounded-xl border-[1.5px] border-line bg-white px-3.5 py-3 text-[16px] leading-normal text-ink outline-accent min-[700px]:text-[15px]";
export const ghostBtn =
  "flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-[11px] border-[1.5px] border-dashed border-line-dashed bg-transparent px-3.5 text-[13px] font-semibold text-ink-2";
export const smallBtn = "flex h-9 cursor-pointer items-center rounded-[10px] border border-line bg-white px-3 text-[13px] font-semibold text-ink";

export function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold">{label}</span>
      {children}
      {hint ? <span className="text-[13px] leading-normal text-muted">{hint}</span> : null}
    </div>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onPick,
  full,
}: {
  value: T;
  options: readonly (readonly [T, string])[];
  onPick: (v: T) => void;
  full?: boolean;
}) {
  return (
    <div className={`flex gap-0.5 rounded-xl bg-fill p-1 ${full ? "w-full" : "self-start"} flex-wrap`}>
      {options.map(([k, label]) => (
        <button
          key={String(k)}
          type="button"
          onClick={() => onPick(k)}
          className={`h-9 cursor-pointer rounded-[9px] border-none px-3 text-[13px] font-semibold whitespace-nowrap ${full ? "flex-1" : ""}`}
          style={{
            background: value === k ? "#fff" : "transparent",
            color: value === k ? "var(--color-ink)" : "var(--color-muted)",
            boxShadow: value === k ? "0 1px 3px rgba(27,23,18,.08)" : undefined,
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** A big choice tile (icon + title + hint). */
export function Choice({ on, onClick, icon, title, hint }: { on: boolean; onClick: () => void; icon: string; title: string; hint?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="flex w-full cursor-pointer items-center gap-3 rounded-[14px] border-2 bg-white px-3 py-2.5 text-left text-ink"
      style={{ borderColor: on ? "var(--color-accent)" : "var(--color-line)", background: on ? "var(--color-accent-soft)" : "#fff" }}
    >
      <span className="text-xl">{icon}</span>
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-semibold">{title}</span>
        {hint ? <span className="text-xs leading-snug text-muted">{hint}</span> : null}
      </span>
    </button>
  );
}

/** Words as chips: type and press Enter or comma. */
export function WordsInput({ values, onChange, placeholder }: { values: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");
  const commit = (raw: string) => {
    const words = raw.split(",").map((w) => w.trim()).filter(Boolean);
    if (words.length === 0) return;
    onChange([...new Set([...values, ...words.map((w) => w.toUpperCase())])].slice(0, 20));
    setDraft("");
  };
  return (
    <div className="flex min-h-[46px] flex-wrap items-center gap-1.5 rounded-[12px] border-[1.5px] border-line bg-white px-2 py-1.5">
      {values.map((w) => (
        <span key={w} className="flex items-center gap-1 rounded-lg bg-accent-soft py-1 pr-1 pl-2.5 text-[13px] font-bold text-accent-ink-2">
          {w}
          <button
            type="button"
            aria-label={`Remover ${w}`}
            onClick={() => onChange(values.filter((x) => x !== w))}
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-base text-accent-ink-2"
          >
            ×
          </button>
        </span>
      ))}
      <input
        value={draft}
        placeholder={values.length ? "+ outra" : placeholder}
        enterKeyHint="done"
        onChange={(e) => (e.target.value.includes(",") ? commit(e.target.value) : setDraft(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(draft);
          } else if (e.key === "Backspace" && !draft && values.length) {
            onChange(values.slice(0, -1));
          }
        }}
        onBlur={() => commit(draft)}
        className="h-8 min-w-[110px] flex-1 border-none bg-transparent px-1 text-[16px] text-ink outline-none min-[700px]:text-[15px]"
      />
    </div>
  );
}

export function DurationInput({ minutes, onChange }: { minutes: number; onChange: (m: number) => void }) {
  const guess = minutes >= 1440 && minutes % 1440 === 0 ? 1440 : minutes >= 60 && minutes % 60 === 0 ? 60 : 1;
  const [unit, setUnit] = useState(guess);
  const amount = Math.max(1, Math.round(minutes / unit));
  return (
    <div className="flex gap-2">
      <input
        type="number"
        inputMode="numeric"
        min={1}
        value={amount}
        onChange={(e) => onChange(Math.max(1, Number(e.target.value) || 1) * unit)}
        className={`${inputCls} !w-24`}
      />
      <select
        value={unit}
        onChange={(e) => {
          const next = Number(e.target.value);
          setUnit(next);
          onChange(amount * next);
        }}
        className={inputCls}
      >
        <option value={1}>minutos</option>
        <option value={60}>horas</option>
        <option value={1440}>dias</option>
      </select>
    </div>
  );
}

export function RemoveBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-[10px] border-none bg-transparent text-xl text-danger hover:bg-danger-bg"
    >
      ×
    </button>
  );
}
