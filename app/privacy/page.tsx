export const metadata = { title: "Política de Privacidade — Manochat" };

/**
 * Required by Meta for App Review. DRAFT TEXT: have it reviewed (LGPD) and
 * fill in the controller's legal name/contact before submitting.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-sm leading-relaxed">
      <h1 className="text-xl font-semibold tracking-tight">Política de Privacidade</h1>
      <p className="mt-2 text-muted">Última atualização: [preencher]</p>

      <h2 className="mt-8 font-semibold">Quem somos</h2>
      <p className="mt-2">
        O Manochat é uma ferramenta de automação de respostas no Instagram operada por
        [razão social / nome], contato: [e-mail].
      </p>

      <h2 className="mt-8 font-semibold">Dados que coletamos</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>Da conta profissional conectada: ID, nome de usuário e token de acesso (criptografado).</li>
        <li>
          De quem interage com a conta: ID do Instagram, nome de usuário, texto do comentário
          ou da mensagem, se segue a conta e data da última interação.
        </li>
      </ul>

      <h2 className="mt-8 font-semibold">Para que usamos</h2>
      <p className="mt-2">
        Exclusivamente para responder comentários, enviar as mensagens configuradas pelo
        titular da conta e exibir métricas de desempenho. Não vendemos dados nem os usamos
        para publicidade.
      </p>

      <h2 className="mt-8 font-semibold">Retenção e exclusão</h2>
      <p className="mt-2">
        Os dados ficam armazenados enquanto a conta estiver conectada. Para excluí-los,
        veja <a className="underline" href="/data-deletion">Exclusão de dados</a>.
      </p>

      <h2 className="mt-8 font-semibold">Seus direitos (LGPD)</h2>
      <p className="mt-2">
        Você pode solicitar acesso, correção ou exclusão dos seus dados pelo e-mail acima.
      </p>
    </main>
  );
}
