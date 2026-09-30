"use client";

import { useEffect, useRef, useState } from "react";
import { BioPage } from "@/components/bio-page";
import { Switch } from "@/components/switch";
import { useToast } from "@/components/toast";
import { buildItems, THEMES, THEME_LIST, type BioSettings } from "@/lib/bio/theme";
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
  ["arredondado", "Suave", "4px"],
  ["pilula", "Pílula", "999px"],
  ["reto", "Reto", "1px"],
];
const LAYOUT_LIST: [string, string, string, string[]][] = [
  ["grid3", "Grade 3", "1fr 1fr 1fr", ["22px", "22px", "22px", "22px", "22px", "22px"]],
  ["grid2", "Grade 2", "1fr 1fr", ["48px", "48px"]],
  ["carrossel", "Carrossel", "1.6fr 1fr", ["48px", "48px"]],
  ["lista", "Lista", "1fr", ["13px", "13px", "13px"]],
];

function Section({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3.5 rounded-[20px] border border-line bg-white p-5">{children}</section>
  );
}
const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="m-0 text-xl leading-[1.2] font-bold tracking-[-0.02em]">{children}</h2>
);

/** Center-crops the picked image to a 240px square JPEG data URL. */
function cropToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onerror = () => reject(new Error("read"));
    rd.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode"));
      img.onload = () => {
        const n = 240;
        const cv = document.createElement("canvas");
        cv.width = cv.height = n;
        const s = Math.min(img.width, img.height);
        cv.getContext("2d")!.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, n, n);
        resolve(cv.toDataURL("image/jpeg", 0.82));
      };
      img.src = rd.result as string;
    };
    rd.readAsDataURL(file);
  });
}

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
  const [tab, setTab] = useState<"edit" | "pv">("edit");
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
  const items = buildItems(s, autos);
  const ids = items.map((i) => i.id);
  const visible = items.filter((i) => !i.hidden);

  const move = (i: number, d: number) => {
    const o = [...ids];
    const j = i + d;
    if (j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j], o[i]];
    ch({ order: o });
  };
  const setManual = (id: string, p: Partial<{ label: string; url: string }>) =>
    ch({ manual: s.manual.map((m) => (m.id === id ? { ...m, ...p } : m)) });

  const preview = (
    <aside className="sticky top-6 mx-auto flex shrink-0 flex-col items-center gap-2.5">
      <div className="relative h-[min(720px,calc(100vh-80px))] w-[340px] max-w-[calc(100vw-32px)] overflow-hidden rounded-[48px] border-[11px] border-ink bg-ink shadow-phone">
        <span className="absolute top-2 left-1/2 z-[3] h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-ink" />
        <div className="scrollbar-none absolute inset-0 overflow-x-hidden overflow-y-auto rounded-[37px]">
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
        </div>
      </div>
      <span className="text-xs text-muted">Como aparece no navegador do Instagram</span>
    </aside>
  );

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
            onClick={() => setTab(k)}
            className="h-10 cursor-pointer rounded-[9px] border-none text-sm font-semibold"
            style={{ background: tab === k ? "#fff" : "transparent" }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-start gap-8">
        <div className={`min-w-0 flex-1 flex-col gap-3.5 min-[820px]:flex ${tab === "edit" ? "flex" : "hidden"}`}>
          <Section>
            <H2>Tema</H2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2.5">
              {THEME_LIST.map(([k, label]) => {
                const t = THEMES[k];
                const sel = s.theme === k;
                return (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={sel}
                    onClick={() => ch({ theme: k })}
                    className="flex cursor-pointer flex-col gap-2 rounded-2xl border-2 bg-white px-1.5 pt-1.5 pb-2.5 text-ink transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_10px_22px_rgba(27,23,18,.07)]"
                    style={{ borderColor: sel ? "var(--color-accent)" : "var(--color-line)" }}
                  >
                    <span
                      className="flex h-[84px] flex-col items-center justify-center gap-[5px] rounded-[11px] border p-2"
                      style={{ background: t.bg, borderColor: t.line }}
                    >
                      <span
                        className="h-[18px] w-[18px] rounded-full"
                        style={{ background: k === "noite" ? "#4F4841" : "#E9C9B4" }}
                      />
                      <span
                        className="h-[9px] w-4/5 rounded border"
                        style={{ background: t.btnBg, borderColor: t.btnLine }}
                      />
                      <span
                        className="h-[9px] w-4/5 rounded border"
                        style={{ background: t.card, borderColor: t.line }}
                      />
                    </span>
                    <span className="text-[13px] font-semibold">{label}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <span className="text-sm font-medium">Formato dos botões</span>
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
          </Section>

          <Section>
            <H2>Foto e bio</H2>
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
                      ch({ photo: await cropToDataUrl(f) });
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
          </Section>

          <Section>
            <div className="flex flex-col gap-1">
              <H2>Botões e links</H2>
              <span className="text-[13px] leading-normal text-muted">
                Os botões automáticos vêm das suas automações ativas. Pause uma automação e o botão some
                sozinho.
              </span>
            </div>
            {items.length === 0 ? (
              <div className="rounded-[14px] bg-bg p-5 text-center text-sm text-muted">
                Nenhum botão ainda. Ative uma automação ou adicione um link.
              </div>
            ) : null}
            {items.map((it, i) => {
              const manual = it.kind === "manual";
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
                        {manual ? it.label || "Link sem título" : `Comente ${it.keyword} · ${it.label}`}
                      </span>
                      <span
                        className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.03em]"
                        style={{ color: manual ? "var(--color-muted)" : "var(--color-accent-ink)" }}
                      >
                        {manual ? "LINK MANUAL" : "⚡ AUTOMÁTICO"}
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
                    {manual ? (
                      <button
                        type="button"
                        aria-label="Excluir link"
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
                  {manual ? (
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-2">
                      <input
                        value={m?.label ?? ""}
                        onChange={(e) => setManual(it.id, { label: e.target.value })}
                        placeholder="Texto do botão"
                        maxLength={80}
                        className="h-[42px] rounded-[10px] border-[1.5px] border-line bg-white px-3 text-sm font-medium text-ink outline-accent"
                      />
                      <input
                        value={m?.url ?? ""}
                        onChange={(e) => setManual(it.id, { url: e.target.value })}
                        placeholder="https://…"
                        maxLength={500}
                        className="h-[42px] rounded-[10px] border-[1.5px] border-line bg-white px-3 text-[13px] text-ink outline-accent"
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => {
                const id = `m${Date.now()}`;
                ch({ manual: [...s.manual, { id, label: "", url: "" }], order: [...ids, id] });
              }}
              className="h-[42px] cursor-pointer self-start rounded-[11px] border border-dashed border-line-dashed bg-transparent px-4 text-sm font-semibold whitespace-nowrap"
            >
              + Adicionar link
            </button>
          </Section>

          <Section>
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
          </Section>
        </div>

        <div className={`min-[820px]:block ${tab === "pv" ? "block w-full" : "hidden"}`}>{preview}</div>
      </div>
    </div>
  );
}
