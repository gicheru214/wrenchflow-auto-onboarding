import { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export default function AutoBubble({ children }: Props) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-line bg-card/80 px-3 py-2.5 animate-fade-in">
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-auto-grad text-sm">
        🔧
      </div>
      <div className="min-w-0 flex-1 text-[13px] leading-snug text-ink">{children}</div>
    </div>
  );
}
