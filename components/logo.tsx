export function LogoMark({ size = 26 }: { size?: number }) {
  const r = Math.round(size * 0.35);
  return (
    <span
      className="block bg-accent"
      style={{
        width: size,
        height: size,
        borderRadius: `${r}px ${r}px ${r}px ${size >= 26 ? 3 : 2}px`,
        boxShadow: size >= 26 ? "inset 0 -3px 0 rgba(0,0,0,.08)" : undefined,
      }}
    />
  );
}

export function Logo({ size = 26, text = 22 }: { size?: number; text?: number }) {
  return (
    <span className="flex items-center gap-[9px]">
      <LogoMark size={size} />
      <span className="leading-none font-bold tracking-[-0.02em]" style={{ fontSize: text }}>
        oslinke
      </span>
    </span>
  );
}
