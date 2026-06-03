import { useState } from "react";
import { generateCode } from "../api";
import type { AIResponse } from "../types";

interface Props {
  upstreamColumns: string[];
  aiKey: boolean;
  onApply: (kind: "custom" | "sql", code: string) => void;
}

const EXAMPLES = [
  "Garder uniquement les transactions de montant supérieur à 10000",
  "Masquer les numéros de compte pour le RGPD",
  "Marquer les montants suspects (détection de fraude)",
  "Calculer le total des montants par compte",
  "Supprimer les doublons et les lignes vides",
];

export default function AIAssistant({ upstreamColumns, aiKey, onApply }: Props) {
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<"pandas" | "sql">("pandas");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!description.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await generateCode(description, upstreamColumns, mode);
      setResult(res);
    } catch (e: any) {
      setError(e.message || "Échec de la génération");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-edge px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-gradient-to-r from-accent to-accent2 px-2 py-0.5 text-[10px] font-bold text-ink">
            IA
          </span>
          <span className="text-sm font-semibold text-slate-100">Assistant de transformation</span>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          {aiKey
            ? "Connecté à OpenAI. Décrivez la transformation souhaitée."
            : "Mode heuristique local (sans clé API). Décrivez la transformation souhaitée."}
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        <div className="flex gap-1 rounded-lg border border-edge bg-panel p-1 text-xs">
          {(["pandas", "sql"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 rounded-md px-2 py-1.5 font-medium transition ${
                mode === m ? "bg-accent text-ink" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {m === "pandas" ? "Python / pandas" : "SQL"}
            </button>
          ))}
        </div>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ex : conserver les virements de plus de 5000 € et masquer les IBAN"
          rows={3}
          className="w-full rounded-lg border border-edge bg-panel px-3 py-2 text-sm text-slate-100 outline-none focus:border-accent"
        />

        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => setDescription(ex)}
              className="rounded-full border border-edge bg-panel px-2 py-1 text-[11px] text-slate-400 transition hover:border-accent/50 hover:text-slate-200"
            >
              {ex}
            </button>
          ))}
        </div>

        {upstreamColumns.length > 0 && (
          <div className="text-[11px] text-slate-500">
            Colonnes connues : <span className="font-mono text-slate-400">{upstreamColumns.join(", ")}</span>
          </div>
        )}

        <button
          onClick={run}
          disabled={loading || !description.trim()}
          className="w-full rounded-lg bg-gradient-to-r from-accent to-accent2 px-3 py-2 text-sm font-semibold text-ink transition hover:opacity-90 disabled:opacity-40"
        >
          {loading ? "Génération…" : "Générer le code"}
        </button>

        {error && (
          <div className="rounded-lg border border-bad/40 bg-bad/10 p-2 text-xs text-bad">{error}</div>
        )}

        {result && (
          <div className="space-y-2">
            <div className="rounded-lg border border-edge bg-panel p-2 text-[11px] text-slate-400">
              {result.explanation}
              {result.source && (
                <span className="ml-1 text-slate-600">· {result.source}</span>
              )}
            </div>
            <pre className="max-h-64 overflow-auto rounded-lg border border-edge bg-ink p-3 font-mono text-[12px] leading-relaxed text-accent2">
              {result.code}
            </pre>
            <div className="flex gap-2">
              <button
                onClick={() => onApply(result.mode === "sql" ? "sql" : "custom", result.code)}
                className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-ink transition hover:opacity-90"
              >
                + Créer un node avec ce code
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(result.code)}
                className="rounded-lg border border-edge px-3 py-2 text-sm text-slate-300 transition hover:bg-panel"
              >
                Copier
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
