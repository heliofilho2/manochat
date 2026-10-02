"use client";

import { useEffect, useRef, useState } from "react";
import { BioPage } from "@/components/bio-page";
import { FONT_LABELS } from "@/components/bio-fonts";
import { ScaledPhone } from "@/components/scaled-phone";
import { SocialIcon } from "@/components/social-icons";
import { Switch } from "@/components/switch";
import { useToast } from "@/components/toast";
import { resolveStyle } from "@/lib/bio/style";
import {
  BUTTON_STYLES,
  buildItems,
  FONTS,
  FRAMES,
  HEADER_LAYOUTS,
  PATTERNS,
  PRESET_STYLE,
  SOCIAL_LABELS,
  SOCIAL_TYPES,
  THEMES,
  THEME_LIST,
  WALLPAPERS,
  type BioSettings,
  type BioStyle,
  type SocialType,
} from "@/lib/bio/theme";
import type { PostView } from "@/lib/posts-view";
import { saveBioSettings } from "./actions";

interface AutoLite {
  id: string;
  name: string;
  keywords: string[];
  scope: string;
  postIds: string[];
}

const SHAPE_LIST: [string, string, string][] = [
  ["quadrado", "Quadrado", "0px"],
  ["reto", "Reto", "3px"],
  ["arredondado", "Suave", "6px"],
  ["pilula", "Pílula", "999px"],
];
const LAYOUT_LIST: [string, string, string, string[]][] = [
  ["grid3", "Grade 3", "1fr 1fr 1fr", ["22px", "22px", "22px", "22px", "22px", "22px"]],
  ["grid2", "Grade 2", "1fr 1fr", ["48px", "48px"]],
  ["carrossel", "Carrossel", "1.6fr 1fr", ["48px", "48px"]],
  ["lista", "Lista", "1fr", ["13px", "13px", "13px"]],
];
const HEADER_LABELS: Record<string, string> = {
  classic: "Clássico",
  hero: "Destaque",
  banner: "Faixa",
  side: "Lateral",
};
const WALLPAPER_LABELS: Record<string, string> = {
  solid: "Cor",
  gradient: "Degradê",
  blur: "Foto desfocada",
  pattern: "Padrão",
  image: "Imagem",
};
const FRAME_LABELS: Record<string, string> = { none: "Sem moldura", card: "Painel", outline: "Painel com contorno" };
const PATTERN_LABELS: Record<string, string> = { dots: "Pontos", grid: "Grade", lines: "Linhas" };
const BUTTON_LABELS: Record<string, string> = {
  fill: "Preenchido",
  outline: "Contorno",
  soft: "Suave",
  glass: "Vidro",
  hard: "Sombra dura",
};

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3.5 rounded-[20px] border border-line bg-white p-5">{children}</section>
  );
}
const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="m-0 text-xl leading-[1.2] font-bold tracking-[-0.02em]">{children}</h2>
);

/** A collapsible group, so the Design tab isn't one endless page. */
function Group({
  title,
  summary,
  children,
  defaultOpen = false,
}: {
  title: string;
  summary?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-[20px] border border-line bg-white [&_summary::-webkit-details-marker]:hidden"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4">
        <span className="flex-1 text-base font-bold tracking-[-0.01em]">{title}</span>
        {summary ? <span className="text-sm text-muted">{summary}</span> : null}
        <span className="text-muted transition-transform group-open:rotate-90">›</span>
      </summary>
      <div className="flex flex-col gap-4 border-t border-line-soft px-5 pt-4 pb-5">{children}</div>
    </details>
  );
}

function Chips<T extends string>({
  value,
  options,
  onPick,
  labels,
}: {
  value: T;
  options: readonly T[];
  onPick: (v: T) => void;
  labels: Record<string, string>;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = o === value;
        return (
          <button
            key={o}
            type="button"
            onClick={() => onPick(o)}
            className="h-9 cursor-pointer rounded-full border px-3.5 text-sm font-medium whitespace-nowrap"
            style={{
              borderColor: on ? "var(--color-accent-line)" : "var(--color-line)",
              background: on ? "var(--color-accent-soft)" : "#fff",
              color: on ? "var(--color-accent-ink-2)" : "var(--color-ink-2)",
            }}
          >
            {labels[o] ?? o}
          </button>
        );
      })}
    </div>
  );
}

function ColorField({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  value: string | null;
  fallback: string;
  onChange: (v: string | null) => void;
}) {
  const shown = /^#[0-9a-f]{6}$/i.test(value ?? "") ? value! : /^#[0-9a-f]{6}$/i.test(fallback) ? fallback : "#000000";
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2">
        {value ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="h-8 cursor-pointer border-none bg-transparent px-1 text-xs text-muted underline underline-offset-2"
          >
            Padrão do tema
          </button>
        ) : null}
        <input
          type="color"
          value={shown}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="h-9 w-12 cursor-pointer rounded-lg border border-line bg-white p-0.5"
        />
      </div>
    </div>
  );
}

/** Center-crops to a square JPEG data URL of `size` px. */
function cropSquare(file: File, size: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onerror = () => reject(new Error("read"));
    rd.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode"));
      img.onload = () => {
        const cv = document.createElement("canvas");
        cv.width = cv.height = size;
        const s = Math.min(img.width, img.height);
        const out = Math.min(size, s);
        cv.width = cv.height = out;
        const ctx = cv.getContext("2d")!;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, out, out);
        resolve(cv.toDataURL("image/jpeg", quality));
      };
      img.src = rd.result as string;
    };
    rd.readAsDataURL(file);
  });
}

/** Scales to a portrait-friendly wallpaper (max 540px wide) as a small JPEG. */
function toWallpaper(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onerror = () => reject(new Error("read"));
    rd.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode"));
      img.onload = () => {
        const w = Math.min(800, img.width);
        const h = Math.round((img.height * w) / img.width);
        const cv = document.createElement("canvas");
        cv.width = w;
        cv.height = h;
        const ctx = cv.getContext("2d")!;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, w, h);
        resolve(cv.toDataURL("image/jpeg", 0.8));
      };
      img.src = rd.result as string;
    };
    rd.readAsDataURL(file);
  });
}

type Tab = "content" | "header" | "design";

export function BioEditor({
  initial,
  autos,
  posts,
  username,
  initials,
  profilePicture,
  followers,
  publicUrl,
  displayUrl,
}: {
  initial: BioSettings;
  autos: AutoLite[];
  posts: PostView[];
  username: string;
  initials: string;
  profilePicture: string | null;
  followers: number | null;
  publicUrl: string;
  displayUrl: string;
}) {
  const toast = useToast();
  const [s, setS] = useState<BioSettings>(initial);
  const [tab, setTab] = useState<Tab>("content");
  const [view, setView] = useState<"edit" | "pv">("edit");
  const [copied, setCopied] = useState(false);

  // Debounced auto-save. The first render is the server state, so skip it.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(async () => {
      const r = await saveBioSettings(s);
      if (!r.ok) toast("Não deu pra salvar agora. Confira os campos e tente de novo.");
    }, 700);
    return () => clearTimeout(t);
  }, [s, toast]);

  const ch = (patch: Partial<BioSettings>) => setS((cur) => ({ ...cur, ...patch }));
  const chStyle = (patch: Partial<BioStyle>) => setS((cur) => ({ ...cur, style: { ...cur.style, ...patch } }));
  const chWall = (patch: Partial<BioStyle["wallpaper"]>) =>
    setS((cur) => ({ ...cur, style: { ...cur.style, wallpaper: { ...cur.style.wallpaper, ...patch } } }));
  const chBtn = (patch: Partial<BioStyle["button"]>) =>
    setS((cur) => ({ ...cur, style: { ...cur.style, button: { ...cur.style.button, ...patch } } }));

  const st = s.style;
  const theme = THEMES[s.theme] ?? THEMES.papel;
  const items = buildItems(s, autos);
  const ids = items.map((i) => i.id);
  const visible = items.filter((i) => !i.hidden);
  const resolved = resolveStyle(s);

  const pickTheme = (key: string) => {
    const p = PRESET_STYLE[key] ?? {};
    setS((cur) => ({
      ...cur,
      theme: key,
      style: {
        ...cur.style,
        font: p.font ?? "jakarta",
        textColor: null,
        wallpaper: {
          ...cur.style.wallpaper,
          type: "solid",
          color: null,
          color2: null,
          pattern: "dots",
          ...(p.wallpaper ?? {}),
        },
        button: { ...cur.style.button, color: null, text: null, style: "fill", ...(p.button ?? {}) },
      },
    }));
  };

  const move = (i: number, d: number) => {
    const o = [...ids];
    const j = i + d;
    if (j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j], o[i]];
    ch({ order: o });
  };
  const setManual = (id: string, p: Partial<BioSettings["manual"][number]>) =>
    ch({ manual: s.manual.map((m) => (m.id === id ? { ...m, ...p } : m)) });

  const preview = (
    <aside className="sticky top-6 mx-auto flex shrink-0 flex-col items-center gap-2.5">
      <div className="relative h-[min(720px,calc(100vh-80px))] w-[340px] max-w-[calc(100vw-32px)] overflow-hidden rounded-[48px] border-[11px] border-ink bg-ink shadow-phone">
        <span className="absolute top-2 left-1/2 z-[3] h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-ink" />
        <div className="scrollbar-none absolute inset-0 overflow-x-hidden overflow-y-auto rounded-[37px]">
          {/* Frame is 340px wide with an 11px border: 318px inside. */}
          <ScaledPhone innerWidth={318} innerHeight="min(720px, 100vh - 80px) - 22px">
            <BioPage
              username={username}
              initials={initials}
              profilePicture={profilePicture}
              followers={followers}
              settings={s}
              items={visible}
              posts={posts}
              accountId={null}
              framed
            />
          </ScaledPhone>
        </div>
      </div>
      <span className="text-xs text-muted">Como aparece no navegador do Instagram</span>
    </aside>
  );

  const TABS: [Tab, string][] = [
    ["content", "Conteúdo"],
    ["header", "Cabeçalho"],
    ["design", "Design"],
  ];

  return (
    <div className="animate-up flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 text-[clamp(30px,4.5vw,42px)] leading-[1.02] font-bold tracking-[-0.025em]">
            Minha página de bio
          </h1>
          <span className="flex items-center gap-2 text-[15px] text-muted">
            <span className="h-[7px] w-[7px] rounded-full bg-success" />
            Alterações salvas automaticamente
          </span>
        </div>
        <div className="flex max-w-full flex-wrap items-center gap-2 rounded-[14px] border border-line bg-white py-1.5 pr-1.5 pl-3.5">
          <span className="min-w-0 truncate text-sm font-medium">{displayUrl}</span>
          <button
            type="button"
            onClick={() => {
              try {
                void navigator.clipboard.writeText(publicUrl);
              } catch {
                /* clipboard can be blocked; the label still confirms the click */
              }
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            }}
            className="h-9 cursor-pointer rounded-[9px] border border-line bg-white px-3 text-[13px] font-semibold whitespace-nowrap"
          >
            {copied ? "Copiado ✓" : "Copiar"}
          </button>
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="flex h-9 items-center rounded-[9px] bg-ink px-3 text-[13px] font-semibold whitespace-nowrap text-white"
          >
            Abrir ↗
          </a>
        </div>
      </div>

      <div role="tablist" className="grid grid-cols-2 gap-0.5 rounded-xl bg-fill p-1 min-[820px]:hidden">
        {(
          [
            ["edit", "Editar"],
            ["pv", "Pré-visualizar"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setView(k)}
            className="h-10 cursor-pointer rounded-[9px] border-none text-sm font-semibold"
            style={{ background: view === k ? "#fff" : "transparent" }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-start gap-8">
        <div className={`min-w-0 flex-1 flex-col gap-3.5 min-[820px]:flex ${view === "edit" ? "flex" : "hidden"}`}>
          <div role="tablist" className="flex gap-0.5 self-start rounded-xl bg-fill p-1">
            {TABS.map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className="h-10 cursor-pointer rounded-[9px] border-none px-4 text-sm font-semibold whitespace-nowrap"
                style={{ background: tab === k ? "#fff" : "transparent" }}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "content" ? (
            <>
              <Card>
                <div className="flex flex-col gap-1">
                  <H2>Botões e links</H2>
                  <span className="text-[13px] leading-normal text-muted">
                    Seus links e títulos de seção. Quem chega pela bio já escolheu clicar; as automações de
                    comentário funcionam sem aparecer aqui.
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-[14px] bg-bg px-4 py-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">Mostrar automações na página</span>
                    <span className="text-xs leading-normal text-muted">
                      Lista um botão &quot;Comente PALAVRA…&quot; para cada automação ativa.
                    </span>
                  </div>
                  <Switch
                    checked={st.showAutomations}
                    onChange={() => chStyle({ showAutomations: !st.showAutomations })}
                    label="Mostrar automações na página"
                  />
                </div>
                {items.length === 0 ? (
                  <div className="rounded-[14px] bg-bg p-5 text-center text-sm text-muted">
                    Nenhum botão ainda. Ative uma automação ou adicione um link.
                  </div>
                ) : null}
                {items.map((it, i) => {
                  const isAuto = it.kind === "auto";
                  const isHeading = it.kind === "heading";
                  const m = s.manual.find((x) => x.id === it.id);
                  return (
                    <div
                      key={it.id}
                      className="flex flex-col gap-2.5 rounded-[14px] border border-line p-2.5"
                      style={{ background: it.hidden ? "var(--color-bg)" : "#fff", opacity: it.hidden ? 0.6 : 1 }}
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col">
                          <button
                            type="button"
                            aria-label="Mover para cima"
                            disabled={i === 0}
                            onClick={() => move(i, -1)}
                            className="h-[22px] w-8 cursor-pointer border-none bg-transparent text-xs font-semibold"
                            style={{ opacity: i === 0 ? 0.25 : 1 }}
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            aria-label="Mover para baixo"
                            disabled={i === items.length - 1}
                            onClick={() => move(i, 1)}
                            className="h-[22px] w-8 cursor-pointer border-none bg-transparent text-xs font-semibold"
                            style={{ opacity: i === items.length - 1 ? 0.25 : 1 }}
                          >
                            ▼
                          </button>
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                          <span className="truncate text-sm font-semibold">
                            {isAuto ? `Comente ${it.keyword} · ${it.label}` : it.label || (isHeading ? "Título sem texto" : "Link sem título")}
                          </span>
                          <span
                            className="text-[11px] font-medium tracking-[0.03em]"
                            style={{ color: isAuto ? "var(--color-accent-ink)" : "var(--color-muted)" }}
                          >
                            {isAuto ? "⚡ AUTOMÁTICO" : isHeading ? "TÍTULO DE SEÇÃO" : "LINK MANUAL"}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            ch({ hidden: it.hidden ? s.hidden.filter((x) => x !== it.id) : [...s.hidden, it.id] })
                          }
                          className="h-9 cursor-pointer rounded-[9px] border border-line bg-white px-2.5 text-xs font-medium whitespace-nowrap"
                        >
                          {it.hidden ? "Mostrar" : "Ocultar"}
                        </button>
                        {!isAuto ? (
                          <button
                            type="button"
                            aria-label="Excluir"
                            onClick={() =>
                              ch({
                                manual: s.manual.filter((x) => x.id !== it.id),
                                order: ids.filter((x) => x !== it.id),
                              })
                            }
                            className="h-9 w-9 cursor-pointer rounded-[9px] border-none bg-transparent text-lg text-danger"
                          >
                            ×
                          </button>
                        ) : null}
                      </div>
                      {!isAuto ? (
                        <div className={`grid gap-2 ${isHeading ? "" : "grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))]"}`}>
                          <input
                            value={m?.label ?? ""}
                            onChange={(e) => setManual(it.id, { label: e.target.value })}
                            placeholder={isHeading ? "Ex.: COMECE AQUI" : "Texto do botão"}
                            maxLength={80}
                            className="h-[42px] rounded-[10px] border-[1.5px] border-line bg-white px-3 text-sm font-medium text-ink outline-accent"
                          />
                          {!isHeading ? (
                            <input
                              value={m?.url ?? ""}
                              onChange={(e) => setManual(it.id, { url: e.target.value })}
                              placeholder="https://…"
                              maxLength={500}
                              className="h-[42px] rounded-[10px] border-[1.5px] border-line bg-white px-3 text-[13px] text-ink outline-accent"
                            />
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const id = `m${Date.now()}`;
                      ch({ manual: [...s.manual, { id, label: "", url: "", type: "link" }], order: [...ids, id] });
                    }}
                    className="h-[42px] cursor-pointer rounded-[11px] border border-dashed border-line-dashed bg-transparent px-4 text-sm font-semibold whitespace-nowrap"
                  >
                    + Adicionar link
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const id = `m${Date.now()}`;
                      ch({ manual: [...s.manual, { id, label: "", url: "", type: "heading" }], order: [...ids, id] });
                    }}
                    className="h-[42px] cursor-pointer rounded-[11px] border border-dashed border-line-dashed bg-transparent px-4 text-sm font-semibold whitespace-nowrap"
                  >
                    + Adicionar título de seção
                  </button>
                </div>
              </Card>

              <Card>
                <div className="flex items-center justify-between gap-3">
                  <H2>Posts</H2>
                  <Switch checked={s.showPosts} onChange={() => ch({ showPosts: !s.showPosts })} label="Mostrar posts" />
                </div>
                {s.showPosts ? (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2.5">
                    {LAYOUT_LIST.map(([k, label, cols, cells]) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => ch({ postLayout: k })}
                        className="flex cursor-pointer flex-col gap-2 rounded-[14px] border-2 bg-white px-2 pt-2 pb-2.5 text-ink"
                        style={{ borderColor: s.postLayout === k ? "var(--color-accent)" : "var(--color-line)" }}
                      >
                        <span
                          className="grid h-16 gap-[3px] overflow-hidden rounded-[9px] bg-bg p-[7px]"
                          style={{ gridTemplateColumns: cols }}
                        >
                          {cells.map((h, i) => (
                            <span key={i} className="rounded-[3px] bg-[#CFC4B2]" style={{ height: h }} />
                          ))}
                        </span>
                        <span className="text-[13px] font-semibold">{label}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </Card>
            </>
          ) : null}

          {tab === "header" ? (
            <>
              <Card>
                <H2>Layout do cabeçalho</H2>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2.5">
                  {HEADER_LAYOUTS.map((k) => {
                    const on = st.header === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        aria-pressed={on}
                        onClick={() => chStyle({ header: k })}
                        className="flex cursor-pointer flex-col gap-2 rounded-2xl border-2 bg-white px-1.5 pt-1.5 pb-2.5 text-ink"
                        style={{ borderColor: on ? "var(--color-accent)" : "var(--color-line)" }}
                      >
                        <span className="relative flex h-[92px] flex-col items-center justify-center gap-1 overflow-hidden rounded-[11px] bg-bg">
                          {k === "classic" ? (
                            <>
                              <span className="h-7 w-7 rounded-full bg-[#E9C9B4]" />
                              <span className="h-1.5 w-12 rounded bg-[#CFC4B2]" />
                              <span className="h-1.5 w-16 rounded bg-fill" />
                            </>
                          ) : null}
                          {k === "hero" ? (
                            <>
                              <span className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-[#E9C9B4] to-transparent" />
                              <span className="relative mt-9 h-1.5 w-12 rounded bg-[#CFC4B2]" />
                              <span className="relative h-1.5 w-16 rounded bg-fill" />
                            </>
                          ) : null}
                          {k === "banner" ? (
                            <>
                              <span className="absolute inset-x-0 top-0 h-9 bg-[#E9C9B4]" />
                              <span className="relative mt-4 h-7 w-7 rounded-full border-2 border-white bg-[#F08C6E]" />
                              <span className="h-1.5 w-12 rounded bg-[#CFC4B2]" />
                            </>
                          ) : null}
                          {k === "side" ? (
                            <span className="flex w-full items-center gap-2 px-3">
                              <span className="h-8 w-8 shrink-0 rounded-full bg-[#E9C9B4]" />
                              <span className="flex flex-1 flex-col gap-1">
                                <span className="h-1.5 w-full rounded bg-[#CFC4B2]" />
                                <span className="h-1.5 w-2/3 rounded bg-fill" />
                              </span>
                            </span>
                          ) : null}
                        </span>
                        <span className="text-[13px] font-semibold">{HEADER_LABELS[k]}</span>
                      </button>
                    );
                  })}
                </div>
              </Card>

              <Card>
                <H2>Foto, nome e bio</H2>
                <div className="flex flex-wrap items-center gap-3.5">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#E9C9B4]">
                    {s.photo || profilePicture ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={(s.photo || profilePicture)!} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[22px] font-bold">{initials}</span>
                    )}
                  </div>
                  <label className="flex h-10 cursor-pointer items-center rounded-[11px] border border-ink px-3.5 text-[13px] font-semibold">
                    Trocar foto
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        try {
                          ch({ photo: await cropSquare(f, 560, 0.86) });
                        } catch {
                          toast("Não consegui ler essa imagem. Tente outra.");
                        }
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {s.photo ? (
                    <button
                      type="button"
                      onClick={() => ch({ photo: null })}
                      className="h-10 cursor-pointer border-none bg-transparent px-3 text-[13px] font-medium whitespace-nowrap text-danger"
                    >
                      Usar foto do Instagram
                    </button>
                  ) : null}
                </div>
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  Título
                  <input
                    value={st.title}
                    onChange={(e) => chStyle({ title: e.target.value })}
                    placeholder={`@${username}`}
                    maxLength={60}
                    className="h-[46px] rounded-xl border-[1.5px] border-line bg-white px-3.5 text-[15px] font-normal text-ink outline-accent"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  Texto da bio
                  <textarea
                    value={s.bio}
                    onChange={(e) => ch({ bio: e.target.value })}
                    rows={3}
                    maxLength={150}
                    className="resize-y rounded-xl border-[1.5px] border-line bg-white px-3.5 py-3 text-[15px] leading-normal font-normal text-ink outline-accent"
                  />
                  <span className="self-end text-xs font-normal text-muted">{s.bio.length}/150</span>
                </label>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">Mostrar número de seguidores</span>
                  <Switch
                    checked={s.showFollowers}
                    onChange={() => ch({ showFollowers: !s.showFollowers })}
                    label="Mostrar número de seguidores"
                  />
                </div>
              </Card>

              <Card>
                <div className="flex flex-col gap-1">
                  <H2>Redes sociais</H2>
                  <span className="text-[13px] leading-normal text-muted">
                    O Instagram já aparece sozinho. Aceita @usuário, link, e-mail ou número de WhatsApp.
                  </span>
                </div>
                {st.socials.map((so, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[10px] bg-bg">
                      <SocialIcon type={so.type} size={20} />
                    </span>
                    <select
                      value={so.type}
                      onChange={(e) =>
                        chStyle({
                          socials: st.socials.map((x, j) => (j === i ? { ...x, type: e.target.value as SocialType } : x)),
                        })
                      }
                      className="h-[42px] rounded-[10px] border-[1.5px] border-line bg-white px-2 text-sm text-ink"
                    >
                      {SOCIAL_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {SOCIAL_LABELS[t]}
                        </option>
                      ))}
                    </select>
                    <input
                      value={so.url}
                      onChange={(e) =>
                        chStyle({ socials: st.socials.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })
                      }
                      placeholder="@usuario ou link"
                      maxLength={300}
                      className="h-[42px] min-w-0 flex-1 rounded-[10px] border-[1.5px] border-line bg-white px-3 text-sm text-ink outline-accent"
                    />
                    <button
                      type="button"
                      aria-label="Remover"
                      onClick={() => chStyle({ socials: st.socials.filter((_, j) => j !== i) })}
                      className="h-9 w-9 cursor-pointer rounded-[9px] border-none bg-transparent text-lg text-danger"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {st.socials.length < 8 ? (
                  <button
                    type="button"
                    onClick={() => chStyle({ socials: [...st.socials, { type: "tiktok", url: "" }] })}
                    className="h-[42px] cursor-pointer self-start rounded-[11px] border border-dashed border-line-dashed bg-transparent px-4 text-sm font-semibold whitespace-nowrap"
                  >
                    + Adicionar rede
                  </button>
                ) : null}
              </Card>
            </>
          ) : null}

          {tab === "design" ? (
            <>
              <Group title="Tema" summary={THEME_LIST.find(([k]) => k === s.theme)?.[1]} defaultOpen>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2.5">
                  {THEME_LIST.map(([k, label]) => {
                    const t = THEMES[k];
                    const sel = s.theme === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        aria-pressed={sel}
                        onClick={() => pickTheme(k)}
                        className="flex cursor-pointer flex-col gap-2 rounded-2xl border-2 bg-white px-1.5 pt-1.5 pb-2.5 text-ink transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_10px_22px_rgba(27,23,18,.07)]"
                        style={{ borderColor: sel ? "var(--color-accent)" : "var(--color-line)" }}
                      >
                        <span
                          className="flex h-[84px] flex-col items-center justify-center gap-[5px] rounded-[11px] border p-2"
                          style={{ background: t.bg, borderColor: t.line }}
                        >
                          <span
                            className="h-[18px] w-[18px] rounded-full"
                            style={{ background: t.bg === "#FFFFFF" ? "#DDD" : t.accent }}
                          />
                          <span className="h-[9px] w-4/5 rounded border" style={{ background: t.btnBg, borderColor: t.btnLine }} />
                          <span className="h-[9px] w-4/5 rounded border" style={{ background: t.card, borderColor: t.line }} />
                        </span>
                        <span className="text-[13px] font-semibold">{label}</span>
                      </button>
                    );
                  })}
                </div>
                <span className="text-xs text-muted">
                  Escolher um tema muda cores, fonte, fundo e botões de uma vez. Depois ajuste o que quiser abaixo.
                </span>
              </Group>

              <Group title="Moldura" summary={FRAME_LABELS[st.frame]}>
                <Chips
                  value={st.frame}
                  options={FRAMES}
                  labels={FRAME_LABELS}
                  onPick={(v) => chStyle({ frame: v })}
                />
                <span className="text-sm leading-normal text-muted">
                  Coloca seus links num painel retangular sobre o fundo, como no Linktree. No celular ele ocupa a
                  largura toda, com uma pequena margem.
                </span>
                {st.frame !== "none" ? (
                  <ColorField
                    label="Cor do painel"
                    value={st.frameColor}
                    fallback={theme.card}
                    onChange={(v) => chStyle({ frameColor: v })}
                  />
                ) : null}
              </Group>

              <Group title="Fundo" summary={WALLPAPER_LABELS[st.wallpaper.type]}>
                <Chips
                  value={st.wallpaper.type}
                  options={WALLPAPERS}
                  labels={WALLPAPER_LABELS}
                  onPick={(v) => chWall({ type: v })}
                />
                {st.wallpaper.type !== "blur" && st.wallpaper.type !== "image" ? (
                  <ColorField
                    label={st.wallpaper.type === "gradient" ? "Cor de cima" : "Cor de fundo"}
                    value={st.wallpaper.color}
                    fallback={theme.bg}
                    onChange={(v) => chWall({ color: v })}
                  />
                ) : null}
                {st.wallpaper.type === "gradient" ? (
                  <>
                    <ColorField
                      label="Cor de baixo"
                      value={st.wallpaper.color2}
                      fallback={theme.card}
                      onChange={(v) => chWall({ color2: v })}
                    />
                    <label className="flex flex-col gap-1.5 text-sm font-medium">
                      Direção ({st.wallpaper.angle}°)
                      <input
                        type="range"
                        min={0}
                        max={360}
                        step={5}
                        value={st.wallpaper.angle}
                        onChange={(e) => chWall({ angle: Number(e.target.value) })}
                        className="accent-accent"
                      />
                    </label>
                  </>
                ) : null}
                {st.wallpaper.type === "pattern" ? (
                  <Chips
                    value={st.wallpaper.pattern}
                    options={PATTERNS}
                    labels={PATTERN_LABELS}
                    onPick={(v) => chWall({ pattern: v })}
                  />
                ) : null}
                {st.wallpaper.type === "blur" ? (
                  <span className="text-sm leading-normal text-muted">
                    Usa a sua foto de perfil, bem desfocada, como fundo.
                  </span>
                ) : null}
                {st.wallpaper.type === "image" ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex h-10 cursor-pointer items-center rounded-[11px] border border-ink px-3.5 text-[13px] font-semibold">
                      {st.wallpaper.image ? "Trocar imagem" : "Escolher imagem"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          try {
                            const url = await toWallpaper(f);
                            if (url.length > 420_000) {
                              toast("Essa imagem ficou pesada. Tente uma menor ou mais simples.");
                            } else {
                              chWall({ image: url });
                            }
                          } catch {
                            toast("Não consegui ler essa imagem. Tente outra.");
                          }
                          e.target.value = "";
                        }}
                      />
                    </label>
                    {st.wallpaper.image ? (
                      <button
                        type="button"
                        onClick={() => chWall({ image: null })}
                        className="h-10 cursor-pointer border-none bg-transparent px-2 text-[13px] font-medium text-danger"
                      >
                        Remover
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </Group>

              <Group title="Botões" summary={BUTTON_LABELS[st.button.style]}>
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium">Estilo</span>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
                    {BUTTON_STYLES.map((k) => {
                      const on = st.button.style === k;
                      const preview = resolveStyle({
                        ...s,
                        style: { ...s.style, button: { ...s.style.button, style: k } },
                      });
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => chBtn({ style: k })}
                          className="flex cursor-pointer flex-col gap-2 rounded-2xl border-2 p-2 text-ink"
                          style={{
                            borderColor: on ? "var(--color-accent)" : "var(--color-line)",
                            background: resolved.text === theme.ink ? theme.bg : "var(--color-bg)",
                            ...(preview.wallpaper as React.CSSProperties),
                          }}
                        >
                          <span
                            className="flex h-9 items-center justify-center text-xs font-semibold"
                            style={{ ...(preview.button as React.CSSProperties), borderRadius: preview.radius }}
                          >
                            Exemplo
                          </span>
                          <span className="text-center text-xs font-semibold" style={{ color: preview.text }}>
                            {BUTTON_LABELS[k]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <span className="text-sm font-medium">Formato</span>
                  <div className="flex gap-0.5 rounded-xl bg-fill p-1">
                    {SHAPE_LIST.map(([k, label, r]) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => ch({ shape: k })}
                        className="flex h-9 cursor-pointer items-center gap-2 rounded-[9px] border-none px-3 text-[13px] font-medium whitespace-nowrap"
                        style={{ background: s.shape === k ? "#fff" : "transparent" }}
                      >
                        <span className="h-2.5 w-[18px] border-[1.5px] border-ink" style={{ borderRadius: r }} />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <span className="text-sm font-medium">Disposição</span>
                  <div className="flex gap-0.5 rounded-xl bg-fill p-1">
                    {(
                      [
                        ["list", "Lista"],
                        ["grid", "2 colunas"],
                      ] as const
                    ).map(([k, label]) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => chBtn({ layout: k })}
                        className="h-9 cursor-pointer rounded-[9px] border-none px-3 text-[13px] font-medium whitespace-nowrap"
                        style={{ background: st.button.layout === k ? "#fff" : "transparent" }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <ColorField label="Cor do botão" value={st.button.color} fallback={theme.btnBg} onChange={(v) => chBtn({ color: v })} />
                <ColorField label="Cor do texto do botão" value={st.button.text} fallback={theme.btnFg} onChange={(v) => chBtn({ text: v })} />
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">Botão sobe ao passar o dedo/mouse</span>
                  <Switch checked={st.button.lift} onChange={() => chBtn({ lift: !st.button.lift })} label="Efeito ao passar o mouse" />
                </div>
              </Group>

              <Group title="Texto" summary={FONT_LABELS[st.font]}>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2">
                  {FONTS.map((k) => {
                    const on = st.font === k;
                    const fv = resolveStyle({ ...s, style: { ...s.style, font: k } }).fontVar;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => chStyle({ font: k })}
                        className="flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 bg-white px-2 py-3 text-ink"
                        style={{ borderColor: on ? "var(--color-accent)" : "var(--color-line)" }}
                      >
                        <span className="text-2xl leading-none font-bold" style={{ fontFamily: `${fv}, system-ui, sans-serif` }}>
                          Aa
                        </span>
                        <span className="text-xs font-semibold">{FONT_LABELS[k]}</span>
                      </button>
                    );
                  })}
                </div>
                <ColorField label="Cor do texto" value={st.textColor} fallback={theme.ink} onChange={(v) => chStyle({ textColor: v })} />
              </Group>

              <Group title="Rodapé">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">Mostrar “feito com Oslinke”</span>
                  <Switch
                    checked={st.showBranding}
                    onChange={() => chStyle({ showBranding: !st.showBranding })}
                    label="Mostrar feito com Oslinke"
                  />
                </div>
              </Group>
            </>
          ) : null}
        </div>

        <div className={`min-[820px]:block ${view === "pv" ? "block w-full" : "hidden"}`}>{preview}</div>
      </div>
    </div>
  );
}
