type Variant = "name-blue" | "name-white" | "icon-dark" | "icon-white";

const src: Record<Variant, string> = {
  "name-blue": "/brand/logo-name-blue.png",
  "name-white": "/brand/logo-name-white.png",
  "icon-dark": "/brand/logo-icon-dark.png",
  "icon-white": "/brand/logo-icon-white.png",
};

interface Props {
  variant?: Variant;
  className?: string;
  alt?: string;
}

export function Logo({ variant = "name-blue", className = "h-8 w-auto", alt = "Aaprovidir" }: Props) {
  return <img src={src[variant]} alt={alt} className={className} />;
}

export function LogoMark({ variant = "icon-dark", className = "h-9 w-9", alt = "Aaprovidir" }: Props) {
  return <img src={src[variant]} alt={alt} className={`object-contain ${className}`} />;
}

export function BrandHeader({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <LogoMark variant={dark ? "icon-white" : "icon-dark"} className="h-10 w-10" />
      <div className="min-w-0">
        <Logo variant={dark ? "name-white" : "name-blue"} className="h-6 w-auto max-w-[140px]" />
        <p className={`text-[10px] font-medium tracking-wide ${dark ? "text-white/60" : "text-brand-gray-dark/70"}`}>
          DataPipe · ETL visuel
        </p>
      </div>
    </div>
  );
}
