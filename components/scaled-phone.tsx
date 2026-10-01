/**
 * Renders children at a real phone width (390px) and shrinks the whole thing to
 * fit a smaller frame. Text wraps and spacing is exactly what a visitor sees on
 * their phone, only smaller. `zoom` (unlike transform) also scales the layout
 * box, so scrolling works without blank space.
 */
export const PHONE_WIDTH = 390;

export function ScaledPhone({
  innerWidth,
  innerHeight,
  children,
}: {
  /** Pixels available inside the frame. */
  innerWidth: number;
  /** CSS length available inside the frame, e.g. "588px" or "min(720px, 100vh - 80px)". */
  innerHeight: string;
  children: React.ReactNode;
}) {
  const zoom = innerWidth / PHONE_WIDTH;
  return (
    <div
      className="flex flex-col"
      style={{ width: PHONE_WIDTH, zoom, minHeight: `calc((${innerHeight}) / ${zoom})` }}
    >
      {children}
    </div>
  );
}
