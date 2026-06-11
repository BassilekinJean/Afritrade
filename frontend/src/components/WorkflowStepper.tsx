type Step = "import" | "quality" | "export";

const STEPS: { id: Step; num: number; label: string; desc: string }[] = [
  { id: "import", num: 1, label: "Importer", desc: "Fichiers, liens, bases" },
  { id: "quality", num: 2, label: "Qualité", desc: "Analyse & normalisation" },
  { id: "export", num: 3, label: "Exporter", desc: "Format final" },
];

interface Props {
  active: Step | string | null;
  onStep: (step: Step) => void;
  sourceCount: number;
}

export default function WorkflowStepper({ active, onStep, sourceCount }: Props) {
  return (
    <div className="border-b border-edge bg-brand-cream px-3 py-3">
      <p className="brand-kicker mb-2">
        Parcours données {sourceCount > 0 && `· ${sourceCount} source${sourceCount > 1 ? "s" : ""}`}
      </p>
      <div className="flex gap-1.5">
        {STEPS.map((s) => {
          const isActive = active === s.id;
          const done = s.id === "import" && sourceCount > 0;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onStep(s.id)}
              className={`flex flex-1 flex-col items-center rounded-brand border px-1 py-2 transition ${
                isActive
                  ? "border-brand-blue bg-surface shadow-sm ring-2 ring-brand-blue/15"
                  : done
                    ? "border-good/30 bg-brand-green-pale hover:bg-brand-green-pale/80"
                    : "border-edge bg-surface/90 hover:border-accent/30"
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  isActive
                    ? "bg-brand-blue text-white"
                    : done
                      ? "bg-good text-white"
                      : "bg-muted text-ink/50"
                }`}
              >
                {done && !isActive ? "✓" : s.num}
              </span>
              <span className="mt-1 text-[11px] font-semibold text-brand-blue">{s.label}</span>
              <span className="hidden text-[9px] text-ink/50 sm:block">{s.desc}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
