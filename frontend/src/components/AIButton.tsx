import { SparklesIcon } from "@heroicons/react/24/outline";
import { useAI } from "../ai";

type Variant = "primary" | "ghost" | "chip" | "icon";

interface Props {
  prompt?: string;
  mode?: "pandas" | "sql";
  label?: string;
  variant?: Variant;
  className?: string;
  title?: string;
}

export default function AIButton({
  prompt = "",
  mode = "pandas",
  label = "Assistant IA",
  variant = "ghost",
  className = "",
  title,
}: Props) {
  const { open } = useAI();

  const base =
    variant === "primary"
      ? "inline-flex items-center gap-1.5 rounded-brand bg-brand-blue px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-blue/90"
      : variant === "chip"
        ? "inline-flex items-center gap-1 rounded-full border border-brand-blue/25 bg-brand-blue/5 px-2.5 py-1 text-[11px] font-medium text-brand-blue transition hover:bg-brand-blue/10"
        : variant === "icon"
          ? "inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-blue text-white shadow-md transition hover:bg-brand-blue/90 hover:shadow-lg"
          : "inline-flex items-center gap-1.5 rounded-brand border border-brand-blue/25 bg-white px-2.5 py-1.5 text-xs font-medium text-brand-blue transition hover:bg-brand-blue/5";

  return (
    <button
      type="button"
      title={title ?? label}
      onClick={() => open({ mode, prompt })}
      className={`${base} ${className}`}
    >
      <SparklesIcon className={variant === "icon" ? "h-5 w-5" : "h-3.5 w-3.5 shrink-0"} />
      {variant !== "icon" && <span>{label}</span>}
    </button>
  );
}
