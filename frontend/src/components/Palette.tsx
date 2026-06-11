import { PALETTE_SPECS } from "../nodeCatalog";
import { NodeIcon } from "./icons/Icons";

const PALETTE_ITEMS = PALETTE_SPECS.filter((s) => s.category !== "source");
const SECTIONS = [
  { key: "trigger", label: "Déclencheurs" },
  { key: "transform", label: "Transformations" },
  { key: "output", label: "Résultat" },
] as const;

export default function Palette({ onAdd }: { onAdd: (kind: string) => void }) {
  return (
    <div className="flex h-full flex-col overflow-y-auto p-3">
      <div className="mb-3 rounded-brand border border-brand-blue-pale bg-brand-blue-pale/40 px-3 py-3">
        <p className="text-xs font-bold text-brand-blue">Étapes du pipeline</p>
        <p className="mt-0.5 text-[10px] leading-relaxed text-ink/60">
          Glissez une étape sur le canvas après import des sources.
        </p>
      </div>

      {SECTIONS.map(({ key, label }) => {
        const items = PALETTE_ITEMS.filter((s) => s.category === key);
        if (!items.length) return null;
        return (
          <div key={key} className="mb-4">
            <p className="brand-kicker mb-2 px-1">{label}</p>
            <div className="flex flex-col gap-1.5">
              {items.map((spec) => (
                <PaletteButton key={spec.kind} spec={spec} onAdd={onAdd} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PaletteButton({
  spec,
  onAdd,
}: {
  spec: (typeof PALETTE_ITEMS)[number];
  onAdd: (kind: string) => void;
}) {
  const accent =
    spec.category === "trigger"
      ? "#0D2C54"
      : spec.category === "output"
        ? "#388E3C"
        : "#2A9D8F";

  return (
    <button
      onClick={() => onAdd(spec.kind)}
      draggable
      onDragStart={(e) => e.dataTransfer.setData("application/datapipe", spec.kind)}
      className="group flex items-center gap-2.5 rounded-brand border border-edge bg-surface px-3 py-2.5 text-left shadow-sm transition hover:border-accent/40 hover:shadow-md"
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-brand transition group-hover:scale-105"
        style={{ background: `${accent}12`, color: accent }}
      >
        <NodeIcon kind={spec.kind} size={17} />
      </span>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-brand-blue">{spec.label}</div>
        <div className="truncate text-[11px] text-ink/55">{spec.description}</div>
      </div>
    </button>
  );
}
