import { useEffect, useRef, useState } from "react";

interface Props {
  total: number;
}

// Sized for sub-$10K/mo profit shops — full bar fills around the
// realistic ceiling for the diagnostic ($120K/yr in recoverable
// revenue across all 18 questions at worst-case answers).
const BAR_FULL = 120000;

export default function MoneyLine({ total }: Props) {
  const [display, setDisplay] = useState(0);
  const [delta, setDelta] = useState<{ amount: number; nonce: number } | null>(
    null,
  );
  const rafRef = useRef<number | null>(null);
  const deltaTimerRef = useRef<number | null>(null);

  useEffect(() => {
    // Cancel any in-flight animation; the new target supersedes it.
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (deltaTimerRef.current !== null)
      window.clearTimeout(deltaTimerRef.current);

    setDisplay((current) => {
      const change = total - current;
      if (change > 0) {
        // Fire the green delta flash (keyed on nonce so each pick
        // restarts the animation even if amount repeats).
        setDelta({ amount: change, nonce: Date.now() });
        deltaTimerRef.current = window.setTimeout(
          () => setDelta(null),
          1400,
        );
        const start = current;
        const t0 = performance.now();
        const dur = 900;
        const tick = (t: number) => {
          const k = Math.min(1, (t - t0) / dur);
          const eased = 1 - Math.pow(1 - k, 3);
          setDisplay(Math.round(start + change * eased));
          if (k < 1) rafRef.current = requestAnimationFrame(tick);
          else rafRef.current = null;
        };
        rafRef.current = requestAnimationFrame(tick);
        return current; // start at current; tick will advance it
      }
      // Going down (back-nav) or no change: snap.
      return total;
    });

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (deltaTimerRef.current !== null)
        window.clearTimeout(deltaTimerRef.current);
    };
  }, [total]);

  return (
    <div className="relative rounded-xl border border-line bg-gradient-to-b from-[#0d2417] to-card px-3.5 py-2.5 overflow-hidden">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-money/80">
          Money Line · Live
        </div>
        <div className="flex items-baseline gap-2">
          {delta && delta.amount > 0 && (
            <span
              key={delta.nonce}
              className="text-xs font-extrabold text-money tabular-nums money-delta-pop"
            >
              +${delta.amount.toLocaleString()}
            </span>
          )}
          <div className="text-2xl sm:text-3xl font-black text-money tabular-nums">
            ${display.toLocaleString()}
          </div>
        </div>
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-gradient-to-r from-gold to-money transition-all duration-700"
          style={{ width: `${Math.min(100, (display / BAR_FULL) * 100)}%` }}
        />
      </div>
      <style>{`
        @keyframes wf-money-delta {
          0%   { opacity: 0; transform: translateY(6px) scale(0.9); }
          15%  { opacity: 1; transform: translateY(-2px) scale(1.08); }
          70%  { opacity: 1; transform: translateY(-2px) scale(1); }
          100% { opacity: 0; transform: translateY(-10px) scale(0.95); }
        }
        .money-delta-pop {
          animation: wf-money-delta 1.4s ease-out both;
          text-shadow: 0 0 14px rgba(74, 222, 128, 0.55);
        }
      `}</style>
    </div>
  );
}
