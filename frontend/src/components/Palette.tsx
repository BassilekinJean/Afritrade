import { NODE_SPECS } from "../nodeCatalog";

const CATEGORIES: { id: "source" | "transform" | "output"; label: string }[] = [
  { id: "source", label: "Sources" },
  { id: "transform", label: "Transformations" },
  { id: "output", label: "Sortie" },
];

export default function Palette({ onAdd }: { onAdd: (kind: string) => void }) {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-3">
      {CATEGORIES.map((cat) => (
        <div key={cat.id}>
          <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {cat.label}
          </div>
          <div className="flex flex-col gap-1.5">
            {NODE_SPECS.filter((s) => s.category === cat.id).map((spec) => (
              <button
                key={spec.kind}
                onClick={() => onAdd(spec.kind)}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("application/datapipe", spec.kind)}
                className="group flex items-center gap-2 rounded-lg border border-edge bg-panel2 px-2.5 py-2 text-left transition hover:border-accent/60 hover:bg-panel"
              >
                <span
                  className="rounded-md px-1.5 py-0.5 text-[10px] font-bold text-ink"
                  style={{ background: spec.color }}
                >
                  {spec.icon}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-200">{spec.label}</div>
                  <div className="truncate text-[11px] text-slate-500">{spec.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
