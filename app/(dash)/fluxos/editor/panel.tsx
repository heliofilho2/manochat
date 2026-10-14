"use client";

import { useRef, useState } from "react";
import { Switch } from "@/components/switch";
import {
  fieldKey,
  MAX_BUTTONS,
  MAX_CARDS,
  MAX_QUICK_REPLIES,
  type ActionData,
  type Card,
  type FlowNode,
  type MessageButton,
  type ReplyExpect,
  type Rule,
} from "@/lib/flow/graph";
import type { PostView } from "@/lib/posts-view";
import { META, TRIGGERS, uid, type Meta } from "./catalog";
import { areaCls, Choice, DurationInput, Field, ghostBtn, inputCls, RemoveBtn, Segmented, smallBtn, WordsInput } from "./ui";

type Of<T extends FlowNode["type"]> = Extract<FlowNode, { type: T }>;

export function Panel({
  node,
  meta,
  setMeta,
  posts,
  stories,
  flows,
  issues,
  onChange,
  onRemove,
  onDuplicate,
  onClose,
}: {
  node: FlowNode;
  meta: Meta;
  setMeta: (m: Meta) => void;
  posts: PostView[];
  stories: PostView[];
  flows: { id: string; name: string; status: string }[];
  issues: string[];
  onChange: (n: FlowNode) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onClose: () => void;
}) {
  const m = META[node.type];
  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-0 z-[1] -mx-5 -mt-5 flex items-center gap-2.5 border-b border-line-soft bg-white px-5 pt-4 pb-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] text-lg" style={{ background: `${m.color}1A` }}>
          {m.icon}
        </span>
        <h2 className="m-0 flex-1 text-lg font-bold tracking-[-0.01em]">{node.type === "trigger" ? "O que começa o fluxo" : m.label}</h2>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 cursor-pointer items-center justify-center rounded-[11px] border-none bg-ink px-4 text-[13px] font-semibold text-white"
        >
          Pronto
        </button>
      </div>

      {issues.length > 0 ? (
        <ul className="m-0 flex list-disc flex-col gap-1 rounded-xl bg-[#FDF1F1] py-2.5 pr-3 pl-7 text-[13px] leading-normal text-[#8A1F1F]">
          {issues.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      ) : null}

      {node.type === "trigger" ? <TriggerForm meta={meta} setMeta={setMeta} posts={posts} stories={stories} /> : null}
      {node.type === "message" ? <MessageForm node={node} onChange={onChange} /> : null}
      {node.type === "media" ? <MediaForm node={node} onChange={onChange} /> : null}
      {node.type === "cards" ? <CardsForm node={node} onChange={onChange} /> : null}
      {node.type === "reply" ? <ReplyForm node={node} onChange={onChange} /> : null}
      {node.type === "delay" ? <DelayForm node={node} onChange={onChange} /> : null}
      {node.type === "condition" ? <ConditionForm node={node} onChange={onChange} /> : null}
      {node.type === "random" ? <RandomForm node={node} onChange={onChange} /> : null}
      {node.type === "action" ? <ActionForm node={node} onChange={onChange} flows={flows} /> : null}

      {node.type !== "trigger" ? (
        <div className="mt-2 flex gap-2 border-t border-line-soft pt-4">
          <button type="button" onClick={onDuplicate} className={smallBtn}>
            Duplicar
          </button>
          <button type="button" onClick={onRemove} className="h-9 cursor-pointer rounded-[10px] border-none bg-transparent px-2 text-[13px] font-semibold text-danger">
            Remover bloco
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* ─── trigger ───────────────────────────────────────────────────────────── */

function TriggerForm({ meta, setMeta, posts, stories }: { meta: Meta; setMeta: (m: Meta) => void; posts: PostView[]; stories: PostView[] }) {
  const [more, setMore] = useState(false);
  const list = meta.triggerKind === "story" ? stories : posts;
  const shown = more ? list : list.slice(0, 8);
  const what = meta.triggerKind === "story" ? "stories" : "posts";
  const hasScope = meta.triggerKind === "comment" || meta.triggerKind === "story";
  const hasWords = meta.triggerKind !== "mention";

  return (
    <>
      <div className="flex flex-col gap-1.5">
        {TRIGGERS.map((t) => (
          <Choice
            key={t.kind}
            on={meta.triggerKind === t.kind}
            onClick={() => setMeta({ ...meta, triggerKind: t.kind, scope: "all_posts", postIds: [] })}
            icon={t.icon}
            title={t.label}
            hint={t.hint}
          />
        ))}
      </div>

      {hasWords ? (
        <Field
          label={meta.triggerKind === "comment" ? "Palavras-chave" : "Palavras (opcional)"}
          hint={
            meta.triggerKind === "story"
              ? "Sem palavras, qualquer resposta ou reação ao story começa o fluxo."
              : meta.triggerKind === "dm"
                ? "Sem palavras, este fluxo vira a resposta padrão: responde qualquer mensagem que nenhum outro fluxo pegou."
                : "Digite e aperte Enter. Maiúsculas, acentos e emojis em volta não atrapalham."
          }
        >
          <WordsInput values={meta.keywords} onChange={(keywords) => setMeta({ ...meta, keywords })} placeholder="ex.: QUERO" />
          {meta.keywords.length > 0 ? (
            <Segmented
              value={meta.matchMode}
              onPick={(matchMode) => setMeta({ ...meta, matchMode })}
              options={[
                ["exact_word", "Palavra exata"],
                ["contains", "Contém o texto"],
              ]}
            />
          ) : null}
        </Field>
      ) : null}

      {hasScope ? (
        <Field label={`Em quais ${what}`}>
          <Segmented
            value={meta.scope}
            onPick={(scope) => setMeta({ ...meta, scope })}
            options={[
              ["all_posts", `Todos os ${what}`],
              ["specific_posts", "Escolher"],
            ]}
          />
          {meta.scope === "specific_posts" ? (
            <div className="flex flex-col gap-1.5">
              {list.length === 0 ? (
                <span className="text-[13px] text-muted">
                  {meta.triggerKind === "story" ? "Nenhum story no ar agora (stories somem em 24h)." : "Nenhum post encontrado."}
                </span>
              ) : null}
              {shown.map((p) => {
                const on = meta.postIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setMeta({ ...meta, postIds: on ? meta.postIds.filter((x) => x !== p.id) : [...meta.postIds, p.id] })}
                    className="flex cursor-pointer items-center gap-2.5 rounded-xl border-2 bg-white p-2 text-left text-ink"
                    style={{ borderColor: on ? "var(--color-accent)" : "var(--color-line)" }}
                  >
                    <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg" style={{ background: p.tone }}>
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{p.caption || p.type}</span>
                    <span className="text-xs text-muted">{on ? "✓" : p.date}</span>
                  </button>
                );
              })}
              {list.length > 8 && !more ? (
                <button type="button" onClick={() => setMore(true)} className={`${smallBtn} self-start`}>
                  Ver mais
                </button>
              ) : null}
            </div>
          ) : null}
        </Field>
      ) : null}

      <Field label="A mesma pessoa pode passar de novo?" hint="Evita mandar o fluxo inteiro de novo para quem comenta várias vezes.">
        <Segmented
          full
          value={meta.rerun}
          onPick={(rerun) => setMeta({ ...meta, rerun })}
          options={[
            ["always", "Sempre"],
            ["daily", "1× por dia"],
            ["once", "Só 1 vez"],
          ]}
        />
      </Field>

      {meta.triggerKind === "comment" ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold">Responder o comentário em público</span>
            <Switch checked={meta.replyEnabled} onChange={() => setMeta({ ...meta, replyEnabled: !meta.replyEnabled })} label="Responder o comentário em público" />
          </div>
          {meta.replyEnabled ? (
            <Field label="Respostas (uma por linha)" hint="Uma é sorteada a cada comentário. Variar evita parecer spam para o Instagram.">
              <textarea
                value={meta.replyVariants.join("\n")}
                onChange={(e) => setMeta({ ...meta, replyVariants: e.target.value.split("\n").slice(0, 10) })}
                rows={4}
                placeholder={"Te mandei no direct! 📩\nConfere sua caixa de mensagens 😉"}
                className={areaCls}
              />
            </Field>
          ) : null}
        </>
      ) : null}
    </>
  );
}

/* ─── buttons (messages and cards) ──────────────────────────────────────── */

function ButtonsEditor({ buttons, onChange, max = MAX_BUTTONS }: { buttons: MessageButton[]; onChange: (b: MessageButton[]) => void; max?: number }) {
  const set = (i: number, b: MessageButton) => onChange(buttons.map((x, j) => (j === i ? b : x)));
  return (
    <div className="flex flex-col gap-2">
      {buttons.map((b, i) => (
        <div key={b.id} className="flex flex-col gap-2 rounded-xl border border-line bg-white p-3">
          <div className="flex items-center gap-2">
            <input value={b.label} maxLength={20} placeholder="Texto do botão" onChange={(e) => set(i, { ...b, label: e.target.value })} className={inputCls} />
            <RemoveBtn label="Remover botão" onClick={() => onChange(buttons.filter((_, j) => j !== i))} />
          </div>
          <Segmented
            full
            value={b.url === undefined ? "tap" : "link"}
            onPick={(v) => set(i, v === "tap" ? { id: b.id, label: b.label } : { ...b, url: b.url ?? "" })}
            options={[
              ["link", "🔗 Abre link"],
              ["tap", "➡️ Continua o fluxo"],
            ]}
          />
          {b.url !== undefined ? (
            <input value={b.url} maxLength={500} inputMode="url" placeholder="https://…" onChange={(e) => set(i, { ...b, url: e.target.value })} className={inputCls} />
          ) : (
            <span className="text-xs leading-normal text-muted">Abre um caminho próprio no fluxo (ex.: “Quero”, “Sim”, “Não”).</span>
          )}
        </div>
      ))}
      {buttons.length < max ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onChange([...buttons, { id: uid("b"), label: "", url: "" }])} className={ghostBtn}>
            + Botão de link
          </button>
          <button type="button" onClick={() => onChange([...buttons, { id: uid("b"), label: "" }])} className={ghostBtn}>
            + Botão que continua
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* ─── message ───────────────────────────────────────────────────────────── */

const PLACEHOLDERS: [string, string][] = [
  ["{nome}", "nome"],
  ["{usuario}", "@usuário"],
  ["{resposta}", "última resposta"],
];

function MessageForm({ node, onChange }: { node: Of<"message">; onChange: (n: FlowNode) => void }) {
  const area = useRef<HTMLTextAreaElement>(null);
  const set = (data: Partial<Of<"message">["data"]>) => onChange({ ...node, data: { ...node.data, ...data } });
  const [showImage, setShowImage] = useState(node.data.imageUrl !== undefined);
  const qr = node.data.quickReplies ?? [];
  const mode: "none" | "buttons" | "quick" = qr.length > 0 ? "quick" : node.data.buttons.length > 0 ? "buttons" : "none";
  const [answerMode, setAnswerMode] = useState(mode);

  const insert = (token: string) => {
    const at = area.current?.selectionStart ?? node.data.text.length;
    set({ text: `${node.data.text.slice(0, at)}${token}${node.data.text.slice(at)}` });
  };

  return (
    <>
      <Field label="Texto">
        <textarea
          ref={area}
          value={node.data.text}
          onChange={(e) => set({ text: e.target.value })}
          rows={5}
          maxLength={640}
          placeholder="Oi {nome}! Aqui está o que você pediu…"
          className={areaCls}
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {PLACEHOLDERS.map(([token, label]) => (
            <button key={token} type="button" onClick={() => insert(token)} className="h-8 cursor-pointer rounded-lg border border-line bg-white px-2.5 text-xs font-semibold">
              + {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              const name = prompt("Nome do campo (ex.: cidade)");
              if (name && fieldKey(name)) insert(`{campo:${fieldKey(name)}}`);
            }}
            className="h-8 cursor-pointer rounded-lg border border-line bg-white px-2.5 text-xs font-semibold"
          >
            + campo
          </button>
          <span className="ml-auto text-xs text-muted">{node.data.text.length}/640</span>
        </div>
      </Field>

      {showImage ? (
        <Field label="Imagem antes do texto (link)" hint="Cole o link de uma imagem pública (.jpg, .png, .gif).">
          <div className="flex gap-2">
            <input value={node.data.imageUrl ?? ""} inputMode="url" placeholder="https://…/imagem.jpg" onChange={(e) => set({ imageUrl: e.target.value })} className={inputCls} />
            <RemoveBtn
              label="Tirar imagem"
              onClick={() => {
                const { imageUrl: _i, ...rest } = node.data;
                void _i;
                onChange({ ...node, data: rest });
                setShowImage(false);
              }}
            />
          </div>
          {node.data.imageUrl && /^https?:\/\//.test(node.data.imageUrl) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={node.data.imageUrl} alt="" className="max-h-40 self-start rounded-xl border border-line object-contain" />
          ) : null}
        </Field>
      ) : (
        <button
          type="button"
          onClick={() => {
            setShowImage(true);
            set({ imageUrl: "" });
          }}
          className={`${smallBtn} self-start`}
        >
          🖼️ Adicionar imagem
        </button>
      )}

      <Field label="“Digitando…” antes de enviar" hint="Deixa a conversa mais natural. Só funciona depois que a pessoa já falou com você.">
        <Segmented
          value={node.data.typing ?? 0}
          onPick={(typing) => set({ typing })}
          options={[
            [0, "Não"],
            [1, "1s"],
            [2, "2s"],
            [3, "3s"],
            [5, "5s"],
          ]}
        />
      </Field>

      <Field
        label="Como a pessoa responde"
        hint={
          answerMode === "quick"
            ? "Respostas rápidas aparecem como bolhas acima do teclado e somem depois do toque. Cada uma abre um caminho."
            : answerMode === "buttons"
              ? `Até ${MAX_BUTTONS} botões presos à mensagem: de link ou que continuam o fluxo.`
              : "Sem botões, o fluxo segue direto para o próximo passo."
        }
      >
        <Segmented
          full
          value={answerMode}
          onPick={(v) => {
            setAnswerMode(v);
            if (v === "none") set({ buttons: [], quickReplies: [] });
            if (v === "buttons") set({ quickReplies: [] });
            if (v === "quick") set({ buttons: [] });
          }}
          options={[
            ["none", "Nada"],
            ["buttons", "Botões"],
            ["quick", "Respostas rápidas"],
          ]}
        />
      </Field>
      {answerMode === "buttons" ? <ButtonsEditor buttons={node.data.buttons} onChange={(buttons) => set({ buttons })} /> : null}
      {answerMode === "quick" ? (
        <div className="flex flex-col gap-2">
          {qr.map((q, i) => (
            <div key={q.id} className="flex items-center gap-2">
              <input
                value={q.label}
                maxLength={20}
                placeholder={`Opção ${i + 1}`}
                onChange={(e) => set({ quickReplies: qr.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })}
                className={inputCls}
              />
              <RemoveBtn label="Remover opção" onClick={() => set({ quickReplies: qr.filter((_, j) => j !== i) })} />
            </div>
          ))}
          {qr.length < MAX_QUICK_REPLIES ? (
            <button type="button" onClick={() => set({ quickReplies: [...qr, { id: uid("q"), label: "" }] })} className={`${ghostBtn} self-start`}>
              + Opção
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

/* ─── media ─────────────────────────────────────────────────────────────── */

function MediaForm({ node, onChange }: { node: Of<"media">; onChange: (n: FlowNode) => void }) {
  const set = (data: Partial<Of<"media">["data"]>) => onChange({ ...node, data: { ...node.data, ...data } });
  const ok = /^https?:\/\//.test(node.data.url);
  return (
    <>
      <Segmented
        full
        value={node.data.kind}
        onPick={(kind) => set({ kind })}
        options={[
          ["image", "🖼️ Imagem"],
          ["video", "🎬 Vídeo"],
          ["audio", "🎧 Áudio"],
        ]}
      />
      <Field
        label="Link do arquivo"
        hint="O arquivo precisa estar público na internet (ex.: link direto do Google Drive, Dropbox ou do seu site). Vídeos até 25 MB; áudios em mp3/m4a."
      >
        <input value={node.data.url} inputMode="url" placeholder="https://…" onChange={(e) => set({ url: e.target.value })} className={inputCls} />
      </Field>
      {ok && node.data.kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={node.data.url} alt="" className="max-h-48 self-start rounded-xl border border-line object-contain" />
      ) : null}
      {ok && node.data.kind === "video" ? <video src={node.data.url} controls className="max-h-56 rounded-xl border border-line" /> : null}
      {ok && node.data.kind === "audio" ? <audio src={node.data.url} controls className="w-full" /> : null}
    </>
  );
}

/* ─── cards ─────────────────────────────────────────────────────────────── */

function CardsForm({ node, onChange }: { node: Of<"cards">; onChange: (n: FlowNode) => void }) {
  const cards = node.data.cards;
  const [open, setOpen] = useState(cards[0]?.id ?? "");
  const setCard = (i: number, c: Card) => onChange({ ...node, data: { cards: cards.map((x, j) => (j === i ? c : x)) } });
  return (
    <>
      <span className="text-[13px] leading-normal text-muted">
        Uma galeria que a pessoa arrasta para o lado, como uma vitrine. Cada cartão tem foto, título, subtítulo e até {MAX_BUTTONS} botões.
      </span>
      {cards.map((c, i) => (
        <div key={c.id} className="flex flex-col gap-3 rounded-[14px] border border-line bg-white p-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen(open === c.id ? "" : c.id)}
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 border-none bg-transparent p-0 text-left"
            >
              <span className="h-9 w-9 shrink-0 rounded-lg bg-fill bg-cover bg-center" style={c.imageUrl ? { backgroundImage: `url("${c.imageUrl}")` } : undefined} />
              <span className="truncate text-sm font-semibold">{c.title || `Cartão ${i + 1}`}</span>
              <span className="ml-auto text-muted">{open === c.id ? "▴" : "▾"}</span>
            </button>
            {cards.length > 1 ? <RemoveBtn label="Remover cartão" onClick={() => onChange({ ...node, data: { cards: cards.filter((_, j) => j !== i) } })} /> : null}
          </div>
          {open === c.id ? (
            <>
              <input value={c.title} maxLength={80} placeholder="Título (ex.: Ebook Finanças)" onChange={(e) => setCard(i, { ...c, title: e.target.value })} className={inputCls} />
              <input value={c.subtitle} maxLength={80} placeholder="Subtítulo (ex.: R$ 29,90)" onChange={(e) => setCard(i, { ...c, subtitle: e.target.value })} className={inputCls} />
              <input value={c.imageUrl} inputMode="url" placeholder="Link da foto (https://…)" onChange={(e) => setCard(i, { ...c, imageUrl: e.target.value })} className={inputCls} />
              <input
                value={c.url ?? ""}
                inputMode="url"
                placeholder="Link ao tocar no cartão (opcional)"
                onChange={(e) => setCard(i, e.target.value ? { ...c, url: e.target.value } : { ...c, url: undefined })}
                className={inputCls}
              />
              <ButtonsEditor buttons={c.buttons} onChange={(buttons) => setCard(i, { ...c, buttons })} />
            </>
          ) : null}
        </div>
      ))}
      {cards.length < MAX_CARDS ? (
        <button
          type="button"
          onClick={() => {
            const card: Card = { id: uid("k"), title: "", subtitle: "", imageUrl: "", buttons: [] };
            onChange({ ...node, data: { cards: [...cards, card] } });
            setOpen(card.id);
          }}
          className={`${ghostBtn} self-start`}
        >
          + Cartão
        </button>
      ) : null}
    </>
  );
}

/* ─── reply ─────────────────────────────────────────────────────────────── */

function ReplyForm({ node, onChange }: { node: Of<"reply">; onChange: (n: FlowNode) => void }) {
  const set = (data: Partial<Of<"reply">["data"]>) => onChange({ ...node, data: { ...node.data, ...data } });
  return (
    <>
      <span className="rounded-xl bg-bg px-3 py-2.5 text-[13px] leading-normal text-ink-2">
        O fluxo para aqui até a pessoa escrever no direct. Pedir uma resposta é o que libera mais mensagens depois de um comentário: o
        Instagram só deixa continuar quando a pessoa fala.
      </span>
      <Field label="O que você espera">
        <div className="grid grid-cols-2 gap-1.5">
          {(
            [
              ["keyword", "🔑", "Uma palavra"],
              ["any", "💬", "Qualquer texto"],
              ["email", "📧", "E-mail"],
              ["phone", "📱", "WhatsApp"],
            ] as [ReplyExpect, string, string][]
          ).map(([k, icon, label]) => (
            <Choice key={k} on={node.data.expect === k} onClick={() => set({ expect: k })} icon={icon} title={label} />
          ))}
        </div>
      </Field>
      {node.data.expect === "keyword" ? (
        <Field label="Palavra que libera" hint="Vale se a resposta contiver a palavra, sem ligar para maiúsculas e acentos.">
          <WordsInput values={node.data.keywords} onChange={(keywords) => set({ keywords })} placeholder="ex.: MATERIAL" />
        </Field>
      ) : null}
      {node.data.expect === "email" || node.data.expect === "phone" ? (
        <span className="rounded-xl bg-success-bg px-3 py-2.5 text-[13px] leading-normal text-success-ink">
          Respostas válidas viram um lead em <b>Leads</b> (e vão para o seu webhook de leads, se tiver).
        </span>
      ) : null}
      <Field label="Guardar a resposta no campo (opcional)" hint="Depois use {campo:nome} nas mensagens ou numa Condição.">
        <input
          value={node.data.saveTo ?? ""}
          maxLength={30}
          placeholder="ex.: cidade"
          onChange={(e) => set({ saveTo: e.target.value })}
          onBlur={(e) => set({ saveTo: fieldKey(e.target.value) })}
          className={inputCls}
        />
      </Field>
      {node.data.expect !== "any" ? (
        <Field label="Se responder outra coisa" hint="Com a saída “Outra resposta” livre, o fluxo manda este texto e continua esperando (até 3 vezes).">
          <textarea
            value={node.data.retryText}
            onChange={(e) => set({ retryText: e.target.value })}
            rows={2}
            maxLength={640}
            placeholder={node.data.expect === "keyword" ? "Quase! É só responder com a palavra 😉" : "Não entendi 😅 Pode mandar de novo?"}
            className={areaCls}
          />
        </Field>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">Prazo para responder</span>
        <Switch checked={node.data.timeoutMinutes !== null} onChange={() => set({ timeoutMinutes: node.data.timeoutMinutes === null ? 720 : null })} label="Prazo para responder" />
      </div>
      {node.data.timeoutMinutes !== null ? (
        <Field label="Se não responder em" hint="Abre a saída “Não respondeu”, para mandar um lembrete, por exemplo.">
          <DurationInput minutes={node.data.timeoutMinutes} onChange={(m) => set({ timeoutMinutes: m })} />
        </Field>
      ) : null}
    </>
  );
}

/* ─── delay ─────────────────────────────────────────────────────────────── */

function DelayForm({ node, onChange }: { node: Of<"delay">; onChange: (n: FlowNode) => void }) {
  const until = node.data.until ?? null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <>
      <Segmented
        full
        value={until ? "until" : "for"}
        onPick={(v) => onChange({ ...node, data: { ...node.data, until: v === "until" ? { hour: 9, minute: 0 } : null } })}
        options={[
          ["for", "Por um tempo"],
          ["until", "Até um horário"],
        ]}
      />
      {until ? (
        <Field label="Continuar às (horário de Brasília)" hint="Se já passou desse horário hoje, continua amanhã.">
          <input
            type="time"
            value={`${pad(until.hour)}:${pad(until.minute)}`}
            onChange={(e) => {
              const [h, m] = e.target.value.split(":").map(Number);
              if (Number.isFinite(h) && Number.isFinite(m)) onChange({ ...node, data: { ...node.data, until: { hour: h, minute: m } } });
            }}
            className={`${inputCls} !w-40`}
          />
        </Field>
      ) : (
        <Field label="Quanto tempo esperar" hint="Depois desse tempo o fluxo segue sozinho. Passando de 24h, a Meta pode recusar a mensagem seguinte.">
          <DurationInput minutes={node.data.minutes} onChange={(minutes) => onChange({ ...node, data: { ...node.data, minutes } })} />
        </Field>
      )}
    </>
  );
}

/* ─── condition ─────────────────────────────────────────────────────────── */

const RULE_KINDS: [Rule["kind"], string][] = [
  ["clicked", "🔗 Abriu link"],
  ["tag", "🏷️ Tag"],
  ["field", "📝 Campo"],
  ["answer", "💬 Resposta"],
  ["follower", "👤 Segue o perfil"],
  ["hours", "🕘 Horário"],
  ["weekdays", "📅 Dia da semana"],
];

function blankRule(kind: Rule["kind"]): Rule {
  switch (kind) {
    case "tag":
      return { kind, tag: "" };
    case "field":
      return { kind, name: "", op: "filled", value: "" };
    case "answer":
      return { kind, value: "" };
    case "hours":
      return { kind, from: 9, to: 18 };
    case "weekdays":
      return { kind, days: [1, 2, 3, 4, 5] };
    default:
      return { kind } as Rule;
  }
}

function ConditionForm({ node, onChange }: { node: Of<"condition">; onChange: (n: FlowNode) => void }) {
  const rules = node.data.rules ?? [];
  const set = (r: Rule[]) => onChange({ ...node, data: { match: node.data.match ?? "all", rules: r } });
  const setRule = (i: number, r: Rule) => set(rules.map((x, j) => (j === i ? r : x)));
  return (
    <>
      <span className="text-[13px] leading-normal text-muted">A pessoa segue pelo caminho “Sim” quando as regras batem, senão pelo “Não”.</span>
      {rules.length > 1 ? (
        <Segmented
          full
          value={node.data.match ?? "all"}
          onPick={(match) => onChange({ ...node, data: { match, rules } })}
          options={[
            ["all", "Todas as regras"],
            ["any", "Qualquer uma"],
          ]}
        />
      ) : null}
      {rules.map((r, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-[14px] border border-line bg-white p-3">
          <div className="flex items-center gap-2">
            <select value={r.kind} onChange={(e) => setRule(i, blankRule(e.target.value as Rule["kind"]))} className={inputCls}>
              {RULE_KINDS.map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            {rules.length > 1 ? <RemoveBtn label="Remover regra" onClick={() => set(rules.filter((_, j) => j !== i))} /> : null}
          </div>
          {r.kind === "clicked" || r.kind === "follower" || r.kind === "tag" ? (
            <Segmented
              value={r.not ? "not" : "yes"}
              onPick={(v) => setRule(i, { ...r, not: v === "not" })}
              options={
                r.kind === "clicked"
                  ? [
                      ["yes", "Abriu algum link"],
                      ["not", "Não abriu"],
                    ]
                  : r.kind === "follower"
                    ? [
                        ["yes", "Segue"],
                        ["not", "Não segue"],
                      ]
                    : [
                        ["yes", "Tem a tag"],
                        ["not", "Não tem"],
                      ]
              }
            />
          ) : null}
          {r.kind === "tag" ? <input value={r.tag} maxLength={60} placeholder="ex.: comprou" onChange={(e) => setRule(i, { ...r, tag: e.target.value })} className={inputCls} /> : null}
          {r.kind === "field" ? (
            <>
              <input value={r.name} maxLength={30} placeholder="Nome do campo (ex.: cidade)" onChange={(e) => setRule(i, { ...r, name: e.target.value })} className={inputCls} />
              <select value={r.op} onChange={(e) => setRule(i, { ...r, op: e.target.value as typeof r.op })} className={inputCls}>
                <option value="filled">está preenchido</option>
                <option value="empty">está vazio</option>
                <option value="equals">é igual a</option>
                <option value="contains">contém</option>
              </select>
              {r.op === "equals" || r.op === "contains" ? (
                <input value={r.value} maxLength={200} placeholder="valor" onChange={(e) => setRule(i, { ...r, value: e.target.value })} className={inputCls} />
              ) : null}
            </>
          ) : null}
          {r.kind === "answer" ? (
            <input value={r.value} maxLength={100} placeholder="A última resposta contém… (ex.: sim)" onChange={(e) => setRule(i, { ...r, value: e.target.value })} className={inputCls} />
          ) : null}
          {r.kind === "hours" ? (
            <div className="flex items-center gap-2 text-sm">
              Entre
              <select value={r.from} onChange={(e) => setRule(i, { ...r, from: Number(e.target.value) })} className={`${inputCls} !w-24`}>
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}h
                  </option>
                ))}
              </select>
              e
              <select value={r.to} onChange={(e) => setRule(i, { ...r, to: Number(e.target.value) })} className={`${inputCls} !w-24`}>
                {Array.from({ length: 24 }, (_, h) => h + 1).map((h) => (
                  <option key={h} value={h}>
                    {String(h % 24).padStart(2, "0")}h
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {r.kind === "weekdays" ? (
            <div className="flex flex-wrap gap-1">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d, di) => {
                const on = r.days.includes(di);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setRule(i, { ...r, days: on ? r.days.filter((x) => x !== di) : [...r.days, di].sort() })}
                    className="h-9 w-12 cursor-pointer rounded-[9px] border-[1.5px] text-[13px] font-semibold"
                    style={{
                      borderColor: on ? "var(--color-accent)" : "var(--color-line)",
                      background: on ? "var(--color-accent-soft)" : "#fff",
                      color: "var(--color-ink)",
                    }}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ))}
      {rules.length < 10 ? (
        <button type="button" onClick={() => set([...rules, blankRule("tag")])} className={`${ghostBtn} self-start`}>
          + Regra
        </button>
      ) : null}
    </>
  );
}

/* ─── random ────────────────────────────────────────────────────────────── */

function RandomForm({ node, onChange }: { node: Of<"random">; onChange: (n: FlowNode) => void }) {
  const branches = node.data.branches;
  const total = branches.reduce((s, x) => s + Math.max(0, x.weight), 0) || 1;
  const set = (b: typeof branches) => onChange({ ...node, data: { branches: b } });
  return (
    <>
      <span className="text-[13px] leading-normal text-muted">
        Cada pessoa cai num caminho ao acaso, na proporção abaixo. Em Resultados você compara quantos abriram o link em cada caminho.
      </span>
      {branches.map((b, i) => (
        <div key={b.id} className="flex flex-col gap-2 rounded-[14px] border border-line bg-white p-3">
          <div className="flex items-center gap-2">
            <input value={b.label} maxLength={40} aria-label="Nome do caminho" onChange={(e) => set(branches.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className={inputCls} />
            {branches.length > 2 ? <RemoveBtn label="Remover caminho" onClick={() => set(branches.filter((_, j) => j !== i))} /> : null}
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              value={b.weight}
              aria-label="Chance"
              onChange={(e) => set(branches.map((x, j) => (j === i ? { ...x, weight: Number(e.target.value) } : x)))}
              className="flex-1 accent-accent"
            />
            <span className="w-12 text-right text-sm font-bold">{Math.round((Math.max(0, b.weight) / total) * 100)}%</span>
          </div>
        </div>
      ))}
      {branches.length < 6 ? (
        <button
          type="button"
          onClick={() => set([...branches, { id: uid("c"), label: `Caminho ${String.fromCharCode(65 + branches.length)}`, weight: 50 }])}
          className={`${ghostBtn} self-start`}
        >
          + Caminho
        </button>
      ) : null}
    </>
  );
}

/* ─── action ────────────────────────────────────────────────────────────── */

const ACTIONS: [ActionData["op"], string, string][] = [
  ["add_tag", "🏷️", "Adicionar tag"],
  ["remove_tag", "🧹", "Remover tag"],
  ["set_field", "📝", "Salvar em um campo"],
  ["clear_field", "🗑️", "Apagar um campo"],
  ["notify", "🔔", "Me avisar"],
  ["human", "🙋", "Atendimento humano"],
  ["start_flow", "↪️", "Iniciar outro fluxo"],
  ["webhook", "🔌", "Enviar para webhook"],
];

function blankAction(op: ActionData["op"]): ActionData {
  switch (op) {
    case "add_tag":
    case "remove_tag":
      return { op, tag: "" };
    case "set_field":
      return { op, field: "", value: "" };
    case "clear_field":
      return { op, field: "" };
    case "notify":
      return { op, text: "{usuario} chegou neste passo 👀" };
    case "webhook":
      return { op, url: "" };
    case "start_flow":
      return { op, flowId: "" };
    case "human":
      return { op, hours: 24 };
  }
}

function ActionForm({ node, onChange, flows }: { node: Of<"action">; onChange: (n: FlowNode) => void; flows: { id: string; name: string; status: string }[] }) {
  const a = node.data;
  const set = (data: ActionData) => onChange({ ...node, data });
  return (
    <>
      <div className="grid grid-cols-2 gap-1.5">
        {ACTIONS.map(([op, icon, label]) => (
          <Choice key={op} on={a.op === op} onClick={() => a.op !== op && set(blankAction(op))} icon={icon} title={label} />
        ))}
      </div>

      {a.op === "add_tag" || a.op === "remove_tag" ? (
        <Field label="Tag" hint="Use tags para separar quem comprou, quem teve dúvida etc. Uma Condição pode olhar para elas depois.">
          <input value={a.tag} maxLength={60} placeholder="ex.: quer-ebook" onChange={(e) => set({ ...a, tag: e.target.value })} className={inputCls} />
        </Field>
      ) : null}

      {a.op === "set_field" ? (
        <>
          <Field label="Campo">
            <input value={a.field} maxLength={30} placeholder="ex.: interesse" onChange={(e) => set({ ...a, field: e.target.value })} onBlur={(e) => set({ ...a, field: fieldKey(e.target.value) })} className={inputCls} />
          </Field>
          <Field label="Valor" hint="Pode usar {resposta}, {nome}, {usuario} e {campo:outro}.">
            <input value={a.value} maxLength={500} placeholder="ex.: ebook" onChange={(e) => set({ ...a, value: e.target.value })} className={inputCls} />
          </Field>
        </>
      ) : null}

      {a.op === "clear_field" ? (
        <Field label="Campo">
          <input value={a.field} maxLength={30} placeholder="ex.: cidade" onChange={(e) => set({ ...a, field: e.target.value })} onBlur={(e) => set({ ...a, field: fieldKey(e.target.value) })} className={inputCls} />
        </Field>
      ) : null}

      {a.op === "notify" ? (
        <Field label="Aviso" hint="Chega no canal de alertas configurado (ALERT_WEBHOOK_URL: Discord, Slack, ntfy…).">
          <textarea value={a.text} rows={3} maxLength={500} onChange={(e) => set({ ...a, text: e.target.value })} className={areaCls} />
        </Field>
      ) : null}

      {a.op === "human" ? (
        <Field label="Deixar o robô quieto por" hint="Nenhuma automação responde essa pessoa nesse tempo, e você recebe um aviso para responder pela Caixa de entrada.">
          <Segmented
            full
            value={a.hours}
            onPick={(hours) => set({ ...a, hours })}
            options={[
              [2, "2h"],
              [12, "12h"],
              [24, "24h"],
              [72, "3 dias"],
              [168, "7 dias"],
            ]}
          />
        </Field>
      ) : null}

      {a.op === "start_flow" ? (
        <Field label="Qual fluxo" hint="Este fluxo termina e o outro começa do início para a mesma pessoa. O outro precisa estar no ar.">
          <select value={a.flowId} onChange={(e) => set({ ...a, flowId: e.target.value })} className={inputCls}>
            <option value="">Escolha…</option>
            {flows.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
                {f.status === "live" ? "" : " (fora do ar)"}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      {a.op === "webhook" ? (
        <Field label="Link do webhook (https)" hint="Envia @, nome, tags, campos e respostas em JSON (Zapier, Make, n8n, planilha…).">
          <input value={a.url} inputMode="url" maxLength={500} placeholder="https://hooks.zapier.com/…" onChange={(e) => set({ ...a, url: e.target.value })} className={inputCls} />
        </Field>
      ) : null}
    </>
  );
}
