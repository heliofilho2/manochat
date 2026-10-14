"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const MIN = 0.25;
const MAX = 1.6;
const clamp = (k: number) => Math.min(MAX, Math.max(MIN, k));

/** Fired whenever the view moves, so floating menus anchored to the canvas can close. */
export const CANVAS_MOVED = "flowcanvas:moved";

interface View {
  x: number;
  y: number;
  k: number;
}

/**
 * A pannable, zoomable surface for the flow tree.
 *   mouse: drag the background, or hold Ctrl / Space and drag anywhere;
 *          wheel scrolls, Ctrl + wheel (or trackpad pinch) zooms
 *   touch: drag with one finger, pinch with two
 */
export function Canvas({
  children,
  full,
  onToggleFull,
}: {
  children: React.ReactNode;
  full: boolean;
  onToggleFull: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ x: 0, y: 24, k: 1 });
  const viewRef = useRef(view);
  const [space, setSpace] = useState(false);
  const [dragging, setDragging] = useState(false);

  const move = useCallback((next: View) => {
    viewRef.current = next;
    setView(next);
    window.dispatchEvent(new Event(CANVAS_MOVED));
  }, []);

  const fit = useCallback(() => {
    const b = box.current?.getBoundingClientRect();
    const c = content.current;
    if (!b || !c) return;
    const w = c.offsetWidth;
    const h = c.offsetHeight;
    const k = clamp(Math.min((b.width - 32) / w, (b.height - 48) / h, 1));
    move({ k, x: (b.width - w * k) / 2, y: 24 });
  }, [move]);

  const zoomAt = useCallback(
    (px: number, py: number, factor: number) => {
      const v = viewRef.current;
      const k = clamp(v.k * factor);
      move({ k, x: px - (px - v.x) * (k / v.k), y: py - (py - v.y) * (k / v.k) });
    },
    [move],
  );

  const zoomCenter = (factor: number) => {
    const b = box.current?.getBoundingClientRect();
    if (b) zoomAt(b.width / 2, b.height / 3, factor);
  };

  // Start fitted (large flows) or at 100% centred (small ones).
  useLayoutEffect(() => {
    fit();
  }, [fit]);
  // Going in/out of full screen changes the box: fit again.
  useEffect(() => {
    const t = setTimeout(fit, 30);
    return () => clearTimeout(t);
  }, [full, fit]);

  // Wheel needs a non-passive listener to stop the page from scrolling.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0022));
      } else {
        const v = viewRef.current;
        move({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt, move]);

  // Space held = hand tool (ignored while typing).
  useEffect(() => {
    const typing = () => {
      const a = document.activeElement;
      return a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement || a instanceof HTMLSelectElement;
    };
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !typing()) {
        e.preventDefault();
        setSpace(true);
      }
      if (e.key === "Escape" && full) onToggleFull();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpace(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [full, onToggleFull]);

  // Pointer panning and two-finger pinch.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pan = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const pinch = useRef<{ dist: number; k: number; cx: number; cy: number; vx: number; vy: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    const onControl = target.closest("button, input, textarea, select, a, [data-nopan]");
    const hand = space || e.ctrlKey || e.metaKey || e.button === 1;
    if (e.pointerType === "mouse" && onControl && !hand) return;
    // A finger on a card may still become a pan once it moves: tracked below, captured only after a real drag.
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const r = box.current!.getBoundingClientRect();
    const v = viewRef.current;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        k: v.k,
        cx: (a.x + b.x) / 2 - r.left,
        cy: (a.y + b.y) / 2 - r.top,
        vx: v.x,
        vy: v.y,
      };
      pan.current = null;
    } else {
      pan.current = { x: e.clientX, y: e.clientY, vx: v.x, vy: v.y };
    }
    if (!onControl || hand) {
      box.current!.setPointerCapture(e.pointerId);
      setDragging(true);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const p = pinch.current;
      const k = clamp(p.k * (Math.hypot(a.x - b.x, a.y - b.y) / p.dist));
      move({ k, x: p.cx - (p.cx - p.vx) * (k / p.k), y: p.cy - (p.cy - p.vy) * (k / p.k) });
      return;
    }
    const p = pan.current;
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    // A finger that started on a card only pans after a real drag, so taps still open the card.
    if (!dragging && Math.hypot(dx, dy) < 6) return;
    if (!dragging) {
      box.current!.setPointerCapture(e.pointerId);
      setDragging(true);
    }
    move({ ...viewRef.current, x: p.vx + dx, y: p.vy + dy });
  };

  const end = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) {
      pan.current = null;
      setDragging(false);
    }
  };

  const ctrlBtn =
    "flex h-10 min-w-10 cursor-pointer items-center justify-center rounded-[10px] border-none bg-transparent px-2 text-[15px] font-semibold text-ink hover:bg-fill";

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[22px] border border-line bg-[#FBF8F3]">
      <div
        ref={box}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={end}
        // The canvas owns touch gestures; the page must not scroll or zoom under the finger.
        className="absolute inset-0 touch-none select-none"
        style={{
          cursor: dragging ? "grabbing" : space ? "grab" : "default",
          backgroundImage: "radial-gradient(circle, rgba(27,23,18,.13) 1px, transparent 1px)",
          backgroundSize: `${22 * view.k}px ${22 * view.k}px`,
          backgroundPosition: `${view.x}px ${view.y}px`,
        }}
      >
        <div
          ref={content}
          className="absolute top-0 left-0 w-max origin-top-left pb-24"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}
        >
          {children}
        </div>
      </div>

      <div className="pointer-events-none absolute right-3 bottom-3 left-3 flex items-end justify-between gap-2">
        <span className="hidden rounded-lg bg-white/85 px-2.5 py-1.5 text-[12px] text-muted shadow-sm backdrop-blur min-[900px]:block">
          Arraste o fundo para mover · Ctrl ou Espaço + arrastar · Ctrl + rolar para zoom
        </span>
        <span className="rounded-lg bg-white/85 px-2.5 py-1.5 text-[12px] text-muted shadow-sm backdrop-blur min-[900px]:hidden">
          Arraste para mover · pinça para zoom
        </span>
        <div
          data-nopan
          className="pointer-events-auto flex items-center gap-0.5 rounded-[14px] border border-line bg-white p-1 shadow-[0_6px_18px_rgba(27,23,18,.12)]"
        >
          <button type="button" aria-label="Diminuir zoom" onClick={() => zoomCenter(1 / 1.2)} className={ctrlBtn}>
            −
          </button>
          <button
            type="button"
            aria-label="Zoom 100%"
            title="Voltar para 100%"
            onClick={() => zoomCenter(1 / viewRef.current.k)}
            className={`${ctrlBtn} w-14 text-[13px] tabular-nums`}
          >
            {Math.round(view.k * 100)}%
          </button>
          <button type="button" aria-label="Aumentar zoom" onClick={() => zoomCenter(1.2)} className={ctrlBtn}>
            +
          </button>
          <span className="mx-0.5 h-6 w-px bg-line" />
          <button type="button" title="Ajustar à tela" aria-label="Ajustar à tela" onClick={fit} className={ctrlBtn}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            </svg>
          </button>
          <button
            type="button"
            title={full ? "Sair da tela cheia (Esc)" : "Tela cheia"}
            aria-label={full ? "Sair da tela cheia" : "Tela cheia"}
            onClick={onToggleFull}
            className={ctrlBtn}
          >
            {full ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
                <path d="M9 9l-5-5M15 9l5-5M9 15l-5 5M15 15l5 5" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
