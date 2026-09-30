"use client";

export function Switch({
  checked,
  onChange,
  label,
  size = "md",
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  size?: "md" | "lg";
  disabled?: boolean;
}) {
  const dims = size === "lg" ? { w: 56, h: 32, knob: 26, x: 24 } : { w: 52, h: 30, knob: 24, x: 22 };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className="flex h-11 shrink-0 cursor-pointer items-center border-none bg-transparent p-0 disabled:opacity-60"
      style={{ width: dims.w }}
    >
      <span
        className="relative block rounded-full transition-colors duration-200"
        style={{
          width: dims.w,
          height: dims.h,
          background: checked ? "var(--color-success)" : "var(--color-line-strong)",
        }}
      >
        <span
          className="absolute top-[3px] left-[3px] rounded-full bg-white shadow-[0_1px_3px_rgba(27,23,18,.3)] transition-transform duration-200"
          style={{
            width: dims.knob,
            height: dims.knob,
            transform: `translateX(${checked ? dims.x : 0}px)`,
          }}
        />
      </span>
    </button>
  );
}
