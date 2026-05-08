import { useEffect, useState } from "react";

interface Props {
  total: number;
}

export default function MoneyLine({ total }: Props) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = display;
    const delta = total - start;
    if (delta === 0) return;
    const t0 = performance.now();
    const dur = 700;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      setDisplay(Math.round(start + delta * eased));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  return (
    <div className="rounded-2xl border border-line bg-gradient-to-b from-[#0d2417] to-card p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-money/80">
          Money Line · Live
        </div>
        <div className="text-3xl sm:text-4xl font-black text-money tabular-nums">
          ${display.toLocaleString()}
        </div>
      </div>
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-gradient-to-r from-gold to-money transition-all duration-700"
          style={{ width: `${Math.min(100, (display / 600000) * 100)}%` }}
        />
      </div>
      <div className="mt-2 text-xs text-sub">
        Extra revenue Auto could be capturing for your shop this year, based on
        your answers so far.
      </div>
    </div>
  );
}
