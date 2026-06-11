import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "accent" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export default function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center font-semibold rounded-brand transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50";

  const variants = {
    primary: "bg-brand-blue text-white hover:bg-brand-blue-hover focus:ring-brand-blue shadow-sm",
    accent: "bg-accent text-white hover:bg-accent-hover focus:ring-accent shadow-sm",
    secondary: "bg-surface text-ink border border-edge hover:bg-muted focus:ring-brand-blue",
    ghost: "bg-transparent text-ink/70 hover:bg-muted hover:text-ink focus:ring-edge",
    danger: "bg-bad text-white hover:bg-red-700 focus:ring-bad shadow-sm",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-5 py-2.5 text-sm",
    lg: "px-6 py-3 text-base",
  };

  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  );
}
