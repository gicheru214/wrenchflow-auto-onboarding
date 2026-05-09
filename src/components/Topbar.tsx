interface Props {
  stepLabel: string;
  stepCount: string;
}

export default function Topbar({ stepLabel, stepCount }: Props) {
  return (
    <header className="sticky top-0 z-30 bg-bg/95 backdrop-blur border-b border-line">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src="/wrenchflow-logo.png"
            alt="WrenchFlow"
            className="h-9 w-9 rounded-xl ring-1 ring-line"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold tracking-tight text-blue">
                WrenchFlow
              </span>
              <span className="rounded-md bg-gold/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-gold">
                AUTO
              </span>
            </div>
            <div className="truncate text-[11px] uppercase tracking-[0.18em] text-sub">
              Shop Hidden Money Finder
            </div>
          </div>
        </div>
        <div className="hidden sm:block text-xs text-sub">
          Step <span className="font-bold text-ink">{stepLabel}</span>{" "}
          <span className="mx-1 text-line">·</span>{" "}
          <span className="font-bold text-ink">{stepCount}</span>
        </div>
      </div>
    </header>
  );
}
