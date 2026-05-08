import { useEffect, useState } from "react";

export type ToastKind = "ok" | "err";

interface Props {
  msg: string | null;
  kind?: ToastKind;
  onDone?: () => void;
}

export default function Toast({ msg, kind = "ok", onDone }: Props) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!msg) return;
    setVisible(true);
    const t = setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, 2800);
    return () => clearTimeout(t);
  }, [msg, onDone]);

  if (!msg) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed left-1/2 bottom-6 z-50 -translate-x-1/2 rounded-xl border px-4 py-3 text-sm font-semibold shadow-2xl transition-all duration-200 ${
        kind === "err"
          ? "border-red-500/50 bg-card text-red-300"
          : "border-money/50 bg-card text-money"
      } ${visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}
    >
      {msg}
    </div>
  );
}
