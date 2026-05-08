import { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export default function AutoBubble({ children }: Props) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-line bg-card/80 p-3.5 sm:p-4 animate-fade-in">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-auto-grad text-base">
        🔧
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold tracking-widest text-blue">
            AUTO
          </span>
          <span className="rounded-md bg-money/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-money">
            online
          </span>
        </div>
        <div className="mt-1 text-[15px] leading-snug text-ink">{children}</div>
      </div>
    </div>
  );
}
