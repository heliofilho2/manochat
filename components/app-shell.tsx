"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { IconBolt, IconChart, IconChevrons, IconDashboard, IconInbox, IconLink, IconUsers, IconWarn } from "./icons";
import { Logo, LogoMark } from "./logo";
import { ToastProvider } from "./toast";

export interface ShellAccount {
  username: string;
  initials: string;
  avatarUrl: string | null;
  expired: boolean;
  hasAutomations: boolean;
  inboxBadge: number;
}

const NAV = [
  { href: "/painel", label: "Painel", tab: "Painel", Icon: IconDashboard },
  { href: "/automacoes", label: "Automações", tab: "Automações", Icon: IconBolt },
  { href: "/entrada", label: "Caixa de entrada", tab: "Entrada", Icon: IconInbox },
  { href: "/leads", label: "Leads", tab: "Leads", Icon: IconUsers },
  { href: "/bio", label: "Minha página de bio", tab: "Bio", Icon: IconLink },
  { href: "/bio/metricas", label: "Métricas da bio", tab: "Métricas", Icon: IconChart },
] as const;

function Avatar({ acct, size, ring }: { acct: ShellAccount; size: number; ring: string }) {
  return (
    <span
      className="relative flex items-center justify-center rounded-full bg-[#E9C9B4] font-bold"
      style={{ width: size, height: size, fontSize: 14 }}
    >
      {acct.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={acct.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
      ) : (
        acct.initials
      )}
      {acct.expired ? (
        <span
          className="absolute -top-px -right-px h-[11px] w-[11px] rounded-full border-2 bg-danger"
          style={{ borderColor: ring }}
        />
      ) : null}
    </span>
  );
}

export function AppShell({
  account,
  publicUrl,
  children,
}: {
  account: ShellAccount;
  publicUrl: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  // Most specific match wins, so /bio/metricas does not also light up /bio.
  const current = NAV.map((n) => n.href)
    .filter((h) => pathname === h || pathname.startsWith(`${h}/`))
    .sort((a, b) => b.length - a.length)[0];
  const isActive = (href: string) => href === current;

  // The overlay is only feedback; the anchor itself performs the OAuth hop.
  const onReconnect = () => {
    setMenu(false);
    setReconnecting(true);
  };

  const steps = account.hasAutomations ? "Tudo pronto · 3 de 3" : "2 de 3 concluídos";

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-bg">
        {/* Sidebar (desktop) */}
        <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col gap-7 border-r border-line bg-bg px-4 py-6 min-[820px]:flex">
          <Link href="/painel" className="flex items-center px-2 py-1">
            <Logo />
          </Link>
          <nav className="flex flex-col gap-1">
            {NAV.map(({ href, label, Icon }) => {
              const on = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium whitespace-nowrap ${
                    on ? "bg-white text-ink shadow-nav" : "text-ink-2"
                  }`}
                >
                  <Icon />
                  <span className="flex-1">{label}</span>
                  {href === "/entrada" && account.inboxBadge > 0 ? (
                    <span className="h-5 min-w-[22px] rounded-full bg-accent px-1.5 text-center text-[11px] leading-5 font-semibold text-ink">
                      {account.inboxBadge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
          <div className="flex-1" />
          <Link
            href="/primeiros-passos"
            className="flex flex-col gap-2 rounded-[14px] border border-line bg-white p-3.5 text-left"
          >
            <span className="text-[13px] font-semibold">Primeiros passos</span>
            <span className="flex w-full gap-1">
              <span className="h-[5px] flex-1 rounded-[9px] bg-ink" />
              <span className="h-[5px] flex-1 rounded-[9px] bg-ink" />
              <span
                className="h-[5px] flex-1 rounded-[9px]"
                style={{ background: account.hasAutomations ? "var(--color-ink)" : "var(--color-line)" }}
              />
            </span>
            <span className="text-xs text-muted">{steps}</span>
          </Link>
          <button
            type="button"
            onClick={() => setMenu((v) => !v)}
            className="flex cursor-pointer items-center gap-2.5 rounded-[14px] border-none bg-transparent p-2 text-left text-ink hover:bg-fill"
          >
            <Avatar acct={account} size={36} ring="var(--color-bg)" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-semibold">{account.username}</span>
              <span className="text-xs text-muted">@{account.username}</span>
            </span>
            <IconChevrons size={16} className="text-muted" />
          </button>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          {/* Topbar (mobile) */}
          <header className="sticky top-0 z-20 flex h-[60px] items-center justify-between border-b border-line bg-bg px-4 min-[820px]:hidden">
            <Link href="/painel" className="flex items-center gap-2">
              <LogoMark size={24} />
              <span className="text-xl leading-none font-bold tracking-[-0.02em]">oslinke</span>
            </Link>
            <button
              type="button"
              aria-label="Menu da conta"
              onClick={() => setMenu((v) => !v)}
              className="flex h-11 w-11 cursor-pointer items-center justify-center border-none bg-transparent p-0"
            >
              <Avatar acct={account} size={36} ring="var(--color-bg)" />
            </button>
          </header>

          {account.expired ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-danger-line bg-danger-bg px-[clamp(16px,4vw,40px)] py-3.5 text-danger-ink">
              <IconWarn size={20} />
              <div className="min-w-[220px] flex-1 text-sm leading-[1.45]">
                <strong className="font-semibold">Sua conexão com o Instagram expirou.</strong> As automações
                estão pausadas até você reconectar — leva uns 20 segundos.
              </div>
              <a
                href="/api/auth/instagram"
                onClick={onReconnect}
                className="flex h-10 items-center rounded-[11px] bg-ink px-4 text-sm font-semibold whitespace-nowrap text-white"
              >
                Reconectar agora
              </a>
            </div>
          ) : null}

          <div className="mx-auto w-full max-w-[1200px] flex-1 px-[clamp(16px,4vw,40px)] pt-[clamp(20px,4vw,40px)] pb-10">
            {children}
          </div>
          <div className="h-[76px] min-[820px]:hidden" />
        </main>
      </div>

      {/* Tab bar (mobile) */}
      <nav className="fixed right-0 bottom-0 left-0 z-30 grid h-[68px] grid-cols-6 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] min-[820px]:hidden">
        {NAV.map(({ href, tab, Icon }) => {
          const on = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center justify-center gap-1 border-t-2 text-[11px] font-medium"
              style={{
                color: on ? "var(--color-ink)" : "var(--color-muted-2)",
                borderTopColor: on ? "var(--color-accent)" : "transparent",
              }}
            >
              <Icon size={22} />
              {tab}
            </Link>
          );
        })}
      </nav>

      {menu ? (
        <>
          <div className="fixed inset-0 z-40 bg-[rgba(27,23,18,0.18)]" onClick={() => setMenu(false)} />
          <div className="fixed top-16 right-3 z-[41] flex w-[272px] animate-up-fast flex-col gap-0.5 rounded-[18px] border border-line bg-white p-2 shadow-pop min-[820px]:top-auto min-[820px]:right-auto min-[820px]:bottom-[76px] min-[820px]:left-4">
            <div className="mb-1 flex flex-col gap-1 border-b border-line-soft px-3 pt-2.5 pb-3">
              <span className="text-[15px] font-semibold">{account.username}</span>
              <span className="text-[13px] text-muted">@{account.username} · Conta profissional</span>
              <span
                className="flex items-center gap-1.5 text-xs font-medium"
                style={{ color: account.expired ? "var(--color-danger)" : "var(--color-success)" }}
              >
                <span
                  className="h-[7px] w-[7px] rounded-full"
                  style={{ background: account.expired ? "var(--color-danger)" : "var(--color-success)" }}
                />
                {account.expired ? "Conexão expirada" : "Conectada"}
              </span>
            </div>
            <a
              href="/api/auth/instagram"
              onClick={onReconnect}
              className="flex h-11 items-center rounded-[10px] px-3 text-sm font-medium whitespace-nowrap hover:bg-bg"
            >
              Reconectar Instagram
            </a>
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="flex h-11 items-center rounded-[10px] px-3 text-sm font-medium whitespace-nowrap hover:bg-bg"
            >
              Ver minha página pública
            </a>
            <Link
              href="/primeiros-passos"
              onClick={() => setMenu(false)}
              className="flex h-11 items-center rounded-[10px] px-3 text-sm font-medium whitespace-nowrap hover:bg-bg"
            >
              Primeiros passos
            </Link>
            <div className="my-1 h-px bg-line-soft" />
            <Link
              href="/privacidade"
              className="flex h-10 items-center rounded-[10px] px-3 text-[13px] whitespace-nowrap text-muted hover:bg-bg"
            >
              Política de Privacidade
            </Link>
            <Link
              href="/exclusao-de-dados"
              className="flex h-10 items-center rounded-[10px] px-3 text-[13px] whitespace-nowrap text-muted hover:bg-bg"
            >
              Exclusão de dados
            </Link>
            <div className="my-1 h-px bg-line-soft" />
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="h-11 w-full cursor-pointer rounded-[10px] border-none bg-transparent px-3 text-left text-sm font-semibold whitespace-nowrap text-danger hover:bg-danger-bg"
              >
                Sair
              </button>
            </form>
          </div>
        </>
      ) : null}

      {reconnecting ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(244,239,230,0.86)] p-6 backdrop-blur-[6px]">
          <div className="flex max-w-[340px] flex-col items-center gap-4 rounded-[22px] border border-line bg-white p-8 text-center">
            <span className="block h-[34px] w-[34px] rounded-full border-[3px] border-line border-t-accent animate-spin-brand" />
            <span className="text-xl leading-[1.2] font-bold tracking-[-0.02em]">Reconectando ao Instagram…</span>
            <span className="text-sm leading-normal text-muted">
              Na janela do Instagram, deixe todas as permissões marcadas.
            </span>
          </div>
        </div>
      ) : null}
    </ToastProvider>
  );
}
