import { useEffect, useState } from "react";
import { getAIStatus } from "../api/ai";
import { generateCode } from "../api/pipeline";
import type { AIResponse, AIStatus } from "../types";

interface Props {
  upstreamColumns: string[];
  aiStatus?: AIStatus | null;
  initialMode?: "pandas" | "sql";
  initialPrompt?: string;
  standalone?: boolean;
  selectedNodeKind?: string | null;
  onApply?: (kind: "custom" | "sql", code: string, target: "new" | "inject") => void;
}

const EXAMPLES: { text: string; mode?: "pandas" | "sql" }[] = [
  { text: "Filtrer uniquement le maïs et supprimer les lignes vides" },
  { text: "Somme des prix par région" },
  { text: "Garder les évolutions de marché négatives" },
  { text: "Supprimer les doublons et trier par rendement décroissant" },
  { text: "Masquer les noms de coopératives pour anonymiser", mode: "pandas" },
  { text: "Moyenne des prix par culture", mode: "sql" },
];

export default function AIAssistant({
  upstreamColumns,
  aiStatus: aiStatusProp,
  initialMode = "pandas",
  initialPrompt = "",
  standalone = false,
  selectedNodeKind,
  onApply,
}: Props) {
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<"pandas" | "sql">(initialMode);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(aiStatusProp ?? null);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (initialPrompt) setDescription(initialPrompt);
  }, [initialPrompt]);

  useEffect(() => {
    if (aiStatusProp) {
      setAiStatus(aiStatusProp);
      return;
    }
    getAIStatus()
      .then(setAiStatus)
      .catch(() =>
        setAiStatus({
          enabled: true,
          provider: "heuristic",
          model: "local",
          hasKey: false,
          mode: "local",
          hint: "Mode local — ajoutez OPENAI_API_KEY dans backend/.env pour le cloud.",
        }),
      );
  }, [aiStatusProp]);

  const resultKind = result?.mode === "sql" ? "sql" : "custom";
  const canInject =
    !standalone &&
    !!selectedNodeKind &&
    !!onApply &&
    ((resultKind === "sql" && selectedNodeKind === "sql") ||
      (resultKind === "custom" && selectedNodeKind === "custom"));

  const run = async () => {
    if (!description.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await generateCode(description, upstreamColumns, mode);
      setResult(res);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Échec de la génération";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const providerLabel =
    aiStatus?.mode === "cloud"
      ? `${aiStatus.provider} · ${aiStatus.model}`
      : "Heuristiques agricoles (local)";

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="border-b border-edge px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-brand-blue/10 px-2 py-0.5 text-[10px] font-semibold text-brand-blue ring-1 ring-brand-blue/20">
            Assistant IA
          </span>
          <span className="text-sm font-semibold text-slate-800">Transformation de données</span>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">{aiStatus?.hint ?? "Chargement…"}</p>
        <div className="mt-2 flex items-center gap-2 text-[10px]">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
              aiStatus?.mode === "cloud"
                ? "bg-good/10 text-good ring-1 ring-good/20"
                : "bg-muted text-slate-600 ring-1 ring-edge"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${aiStatus?.mode === "cloud" ? "bg-good" : "bg-slate-400"}`}
            />
            {providerLabel}
          </span>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        <div className="flex gap-1 rounded-lg border border-edge bg-brand-cream/50 p-1 text-xs">
          {(["pandas", "sql"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 rounded-md px-2 py-1.5 font-medium transition ${
                mode === m
                  ? "bg-brand-blue text-white shadow-sm"
                  : "text-slate-600 hover:bg-white/80"
              }`}
            >
              {m === "pandas" ? "Python / pandas" : "SQL"}
            </button>
          ))}
        </div>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void run();
            }
          }}
          placeholder="Ex : filtrer le riz, sommer les prix par région, détecter les rendements aberrants…"
          rows={4}
          className="w-full rounded-lg border border-edge bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
        />
        <p className="text-[10px] text-slate-400">Ctrl+Entrée pour générer</p>

        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.filter((ex) => !ex.mode || ex.mode === mode).map((ex) => (
            <button
              key={ex.text}
              type="button"
              onClick={() => setDescription(ex.text)}
              className="rounded-full border border-edge bg-white px-2.5 py-1 text-[11px] text-slate-600 transition hover:border-brand-blue/40 hover:text-brand-blue"
            >
              {ex.text}
            </button>
          ))}
        </div>

        {upstreamColumns.length > 0 ? (
          <div className="rounded-lg border border-edge bg-muted/40 px-3 py-2 text-[11px] text-slate-600">
            <span className="font-medium text-slate-700">Colonnes disponibles : </span>
            <span className="font-mono text-slate-600">{upstreamColumns.join(", ")}</span>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-edge bg-muted/20 px-3 py-2 text-[11px] text-slate-500">
            {standalone
              ? "Sans projet ouvert — décrivez la transformation ; ouvrez un projet pour utiliser les colonnes du pipeline."
              : "Importez une source ou exécutez le pipeline pour détecter les colonnes automatiquement."}
          </div>
        )}

        <button
          type="button"
          onClick={() => void run()}
          disabled={loading || !description.trim()}
          className="w-full rounded-lg bg-accent px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-hover disabled:opacity-40"
        >
          {loading ? "Génération en cours…" : "Générer le code"}
        </button>

        {error && (
          <div className="rounded-lg border border-bad/30 bg-bad/10 p-3 text-xs text-bad">{error}</div>
        )}

        {result && (
          <div className="space-y-2">
            <div className="rounded-lg border border-edge bg-brand-cream/60 p-3 text-[11px] text-slate-700">
              {result.explanation}
              {result.source && <span className="ml-1 text-slate-500">· {result.source}</span>}
            </div>
            <pre className="max-h-64 overflow-auto rounded-lg border border-edge bg-slate-900 p-3 font-mono text-[12px] leading-relaxed text-emerald-300">
              {result.code}
            </pre>
            <div className="flex flex-col gap-2 sm:flex-row">
              {!standalone && onApply && (
                <>
                  <button
                    type="button"
                    onClick={() => onApply(resultKind, result.code, "new")}
                    className="flex-1 rounded-lg bg-brand-blue px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-blue/90"
                  >
                    + Créer un nœud
                  </button>
                  {canInject && (
                    <button
                      type="button"
                      onClick={() => onApply(resultKind, result.code, "inject")}
                      className="flex-1 rounded-lg border border-brand-blue bg-white px-3 py-2 text-sm font-semibold text-brand-blue transition hover:bg-brand-blue/5"
                    >
                      Injecter dans le nœud sélectionné
                    </button>
                  )}
                </>
              )}
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText(result.code)}
                className={`rounded-lg border border-edge bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-muted ${
                  standalone ? "w-full" : ""
                }`}
              >
                Copier le code
              </button>
            </div>
            {standalone && (
              <p className="text-center text-[11px] text-slate-500">
                Ouvrez un projet ETL pour appliquer le code directement sur le canvas.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
