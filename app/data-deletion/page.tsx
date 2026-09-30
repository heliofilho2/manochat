export const metadata = { title: "Exclusão de dados — Manochat" };

/** Data Deletion Instructions URL required by Meta. DRAFT: fill in the contact. */
export default function DataDeletionPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-sm leading-relaxed">
      <h1 className="text-xl font-semibold tracking-tight">Exclusão de dados</h1>

      <h2 className="mt-8 font-semibold">Se você conectou sua conta</h2>
      <p className="mt-2">
        Remova o Manochat em Instagram → Configurações → Apps e sites. Depois, envie um
        e-mail para [e-mail] pedindo a exclusão; apagamos sua conta, contatos, tags e
        histórico em até 30 dias.
      </p>

      <h2 className="mt-8 font-semibold">Se você apenas interagiu com uma conta que usa o Manochat</h2>
      <p className="mt-2">
        Envie um e-mail para [e-mail] informando seu @usuário do Instagram. Apagamos seu
        registro de contato e as mensagens associadas em até 30 dias.
      </p>
    </main>
  );
}
