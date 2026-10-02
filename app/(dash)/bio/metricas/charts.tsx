import { fmt } from "@/lib/format";
import { percent } from "@/lib/bio/analytics";

const shortDay = (iso: string) => iso.slice(8) + "/" + iso.slice(5, 7);

/** A column per day. Height is relative to the busiest day of this series. */
export function DayChart({
  title,
  series,
  color,
}: {
  title: string;
  series: { day: string; n: number }[];
  color: string;
}) {
  const max = Math.max(1, ...series.map((d) => d.n));
  const total = series.reduce((s, d) => s + d.n, 0);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-muted">{title}</span>
        <span className="text-sm font-bold tabular-nums">{fmt(total)}</span>
      </div>
      <div className="flex h-24 items-end gap-[2px] rounded-[14px] bg-bg px-2.5 pt-2.5" role="img" aria-label={title}>
        {series.map((d) => (
          <span
            key={d.day}
            title={`${shortDay(d.day)}: ${d.n}`}
            className="min-w-[2px] flex-1 rounded-t-[3px]"
            style={{ height: `${Math.max(d.n > 0 ? 6 : 2, (d.n / max) * 100)}%`, background: d.n > 0 ? color : "var(--color-fill)" }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[11px] text-muted">
        <span>{shortDay(series[0]?.day ?? "")}</span>
        <span>{shortDay(series[series.length - 1]?.day ?? "")}</span>
      </div>
    </div>
  );
}

/** Ranked rows with a bar sized by the share of `total`. */
export function BarList({
  rows,
  total,
  empty,
  unit,
}: {
  rows: { id: string; label: string; hint?: string; value: number }[];
  total: number;
  empty: string;
  unit: string;
}) {
  if (rows.length === 0) {
    return <div className="rounded-[14px] bg-fill px-4 py-5 text-sm leading-normal text-muted">{empty}</div>;
  }
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="flex flex-col gap-3.5">
      {rows.map((r) => {
        const share = percent(r.value, total);
        return (
          <div key={r.id} className="flex flex-col gap-[7px]">
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-semibold">{r.label}</span>
                {r.hint ? <span className="truncate text-xs text-muted">{r.hint}</span> : null}
              </span>
              <span className="flex shrink-0 items-baseline gap-2.5">
                {share !== null ? (
                  <span className="text-xs font-medium whitespace-nowrap text-accent-ink">
                    {String(share).replace(".", ",")}%
                  </span>
                ) : null}
                <span className="text-[17px] font-bold tabular-nums" title={unit}>
                  {fmt(r.value)}
                </span>
              </span>
            </div>
            <span className="block h-2.5 overflow-hidden rounded-md bg-fill">
              <span
                className="block h-full rounded-[5px] bg-accent"
                style={{ width: `${r.value > 0 ? Math.max(3, (r.value / max) * 100) : 0}%` }}
              />
            </span>
          </div>
        );
      })}
    </div>
  );
}
