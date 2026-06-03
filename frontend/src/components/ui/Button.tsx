import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-accent to-accent2 text-ink hover:opacity-90 disabled:opacity-40",
  secondary:
    "bg-panel2 text-slate-100 border border-edge hover:bg-edge disabled:opacity-40",
  ghost: "bg-transparent text-slate-300 hover:bg-panel2 disabled:opacity-40",
  danger: "bg-bad text-ink hover:opacity-90 disabled:opacity-40",
};

export default function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={`rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    />
  );
}
