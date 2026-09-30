export default function Loading() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h1 className="m-0 text-[clamp(30px,4.5vw,42px)] leading-[1.02] font-bold tracking-[-0.025em]">
          Caixa de entrada
        </h1>
        <span className="text-[15px] text-muted">Tudo o que o Manochat respondeu e enviou por você.</span>
      </div>
      <div className="flex flex-col gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="animate-pulse-soft h-[92px] rounded-2xl bg-fill" />
        ))}
      </div>
    </div>
  );
}
