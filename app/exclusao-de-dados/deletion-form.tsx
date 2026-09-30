"use client";

import { useState, useTransition } from "react";
import { requestDeletion } from "./actions";

export function DeletionForm() {
  const [user, setUser] = useState("");
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [protocol, setProtocol] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (protocol) {
    return (
      <div className="flex flex-col gap-2 rounded-[18px] bg-success-bg p-5 text-success-ink">
        <strong className="text-xl font-bold">Pedido recebido</strong>
        <span className="text-[15px] leading-[1.6]">
          Protocolo <strong>{protocol}</strong>. Registramos seu pedido para {email}. Seus dados serão apagados
          em até 30 dias.
        </span>
      </div>
    );
  }

  const inputCls =
    "h-12 rounded-xl border border-line-strong bg-white px-3.5 text-base font-normal text-ink outline-accent";

  return (
    <div className="flex flex-col gap-3.5 rounded-[18px] border border-line bg-white p-5">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Seu @ do Instagram
        <input
          value={user}
          onChange={(e) => {
            setUser(e.target.value);
            setErr("");
          }}
          placeholder="@seuusuario"
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        E-mail para confirmação
        <input
          value={email}
          type="email"
          onChange={(e) => {
            setEmail(e.target.value);
            setErr("");
          }}
          placeholder="voce@email.com"
          className={inputCls}
        />
      </label>
      {err ? <span className="text-sm font-medium text-danger">{err}</span> : null}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await requestDeletion(user, email);
            if (r.ok) setProtocol(r.protocol);
            else setErr(r.error);
          })
        }
        className="h-12 cursor-pointer self-start rounded-xl border-none bg-danger px-5 text-[15px] font-semibold text-white disabled:opacity-70"
      >
        {pending ? "Enviando…" : "Pedir exclusão dos meus dados"}
      </button>
      <span className="text-[13px] leading-normal text-muted">
        Isso apaga automações, histórico, contatos e sua página de bio. Não dá pra desfazer.
      </span>
    </div>
  );
}
