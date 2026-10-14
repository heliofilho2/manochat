"use client";

import { useEffect, useState } from "react";
import { LogoMark } from "./logo";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "oslinke:install-dismissed";

function wasDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    return Date.now() - at < 14 * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

/**
 * Registers the service worker and, on phones, offers to install the app:
 * Android/Chrome gets the native prompt; iPhone gets the two-tap instructions
 * (Safari has no install prompt).
 */
export function PwaSetup() {
  const [android, setAndroid] = useState<InstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    }

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const phone = window.matchMedia("(max-width: 819px)").matches;
    if (standalone || !phone || wasDismissed()) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setAndroid(e as InstallPromptEvent);
      setOpen(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const iphone = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
    let t: ReturnType<typeof setTimeout> | undefined;
    if (iphone) {
      t = setTimeout(() => {
        setIos(true);
        setOpen(true);
      }, 2500);
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      if (t) clearTimeout(t);
    };
  }, []);

  const dismiss = () => {
    setOpen(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Private mode: the banner simply comes back next time.
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-x-3 bottom-[calc(84px+env(safe-area-inset-bottom))] z-[35] flex animate-up-fast flex-col gap-3 rounded-[20px] border border-line bg-white p-4 shadow-[0_16px_40px_rgba(27,23,18,.18)] min-[820px]:hidden">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-bg">
          <LogoMark size={26} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[15px] font-bold">Instale o Oslinke</span>
          <span className="text-[13px] leading-snug text-muted">Abre como app, em tela cheia, direto da tela inicial.</span>
        </div>
        <button type="button" aria-label="Agora não" onClick={dismiss} className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] border-none bg-fill text-lg">
          ×
        </button>
      </div>
      {android ? (
        <button
          type="button"
          onClick={async () => {
            await android.prompt();
            await android.userChoice.catch(() => null);
            setOpen(false);
            setAndroid(null);
          }}
          className="h-12 cursor-pointer rounded-[14px] border-none bg-ink text-[15px] font-semibold text-white"
        >
          Instalar app
        </button>
      ) : ios ? (
        <div className="flex flex-col gap-1.5 rounded-[14px] bg-bg px-3.5 py-3 text-[14px] leading-snug text-ink-2">
          <span>
            1. Toque em <b>Compartilhar</b>{" "}
            <svg className="inline-block align-[-3px]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
            </svg>{" "}
            na barra do Safari
          </span>
          <span>
            2. Escolha <b>Adicionar à Tela de Início</b>
          </span>
        </div>
      ) : null}
    </div>
  );
}
