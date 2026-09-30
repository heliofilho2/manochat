export default function Loading() {
  return (
    <div className="flex flex-col gap-[22px]">
      <div className="flex flex-col gap-1.5">
        <h1 className="m-0 text-[clamp(30px,4.5vw,42px)] leading-[1.02] font-bold tracking-[-0.025em]">
          Automações
        </h1>
        <span className="text-[15px] text-muted">
          Cada automação responde uma palavra-chave nos posts que você escolher.
        </span>
      </div>
      <div className="flex flex-col gap-2.5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse-soft h-[104px] rounded-[18px] bg-fill" />
        ))}
      </div>
    </div>
  );
}
