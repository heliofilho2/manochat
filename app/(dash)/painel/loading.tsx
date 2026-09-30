export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="m-0 text-[clamp(30px,4.5vw,42px)] leading-[1.02] font-bold tracking-[-0.025em]">Painel</h1>
        <span className="text-[15px] text-muted">Como suas automações estão indo.</span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,190px),1fr))] gap-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="animate-pulse-soft h-32 rounded-[18px] bg-fill" />
        ))}
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] gap-4">
        <div className="animate-pulse-soft h-80 rounded-[20px] bg-fill" />
        <div className="animate-pulse-soft h-80 rounded-[20px] bg-fill" />
      </div>
    </div>
  );
}
