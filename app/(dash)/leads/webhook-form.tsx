"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import { saveLeadsWebhook, sendTestLead } from "./actions";

export function WebhookForm({ initial }: { initial: string }) {
  const toast = useToast();
  const [url, setUrl] = useState(initial);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  return (
    <section className="flex flex-col gap-3.5 rounded-[20px] border border-line bg-white p-[22px]">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-[22px] leading-[1.15] font-bold tracking-[-0.02em]">Enviar para o meu site</h2>
        <span className="text-[13px] leading-normal text-muted">
          A cada lead novo (ou quando a pessoa deixa e-mail/WhatsApp), o Manochat manda um POST em JSON para
          este endereço. Deixe vazio para não enviar.
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setErr("");
          }}
          placeholder="https://seusite.com/api/leads"
          inputMode="url"
          maxLength={500}
          className="h-[46px] min-w-[220px] flex-1 rounded-xl border-[1.5px] border-line bg-white px-3.5 text-[15px] text-ink outline-accent"
        />
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await saveLeadsWebhook(url);
              if (!r.ok) setErr(r.error ?? "Não deu pra salvar.");
              else toast(url.trim() ? "Endereço salvo" : "Envio desligado");
            })
          }
          className="h-[46px] cursor-pointer rounded-xl border-none bg-ink px-[18px] text-sm font-semibold whitespace-nowrap text-white disabled:opacity-60"
        >
          Salvar
        </button>
        <button
          type="button"
          disabled={pending || !initial}
          onClick={() =>
            start(async () => {
              const r = await sendTestLead();
              toast(r.ok ? "Teste enviado. Confira no seu site." : (r.error ?? "Falhou."));
            })
          }
          className="h-[46px] cursor-pointer rounded-xl border border-line-strong bg-white px-4 text-sm font-semibold whitespace-nowrap disabled:opacity-50"
          title={initial ? "" : "Salve o endereço primeiro"}
        >
          Enviar teste
        </button>
      </div>
      {err ? <span className="text-[13px] font-medium text-danger">{err}</span> : null}
    </section>
  );
}
