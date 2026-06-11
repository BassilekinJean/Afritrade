import { useState } from "react";
import type { Node } from "reactflow";
import { analyzeSources } from "../api/pipeline";
import type { AnalyzeResponse, NormalizeOptions, PipeNodeData } from "../types";

interface Props {
  sourceNodes: Node<PipeNodeData>[];
  onApplyNormalize: (options: NormalizeOptions) => void;
}

const DEFAULT_OPTS: NormalizeOptions = {
  dropEmptyRows: true,
  dropNullColumnPct: 0,
  fillNumericNulls: "none",
  dropDuplicates: false,
};

const DATASET_LABELS: Record<string, string> = {
  tabular: "Tableau structuré",
  document: "Document (PDF / Word)",
  article: "Article web",
  text: "Texte brut",
  empty: "Vide",
  unknown: "Non classé",
};

export default function DataQualityPanel({ sourceNodes, onApplyNormalize }: Props) {
  const [opts, setOpts] = useState<NormalizeOptions>(DEFAULT_OPTS);
  const [report, setReport] = useState<AnalyzeResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async (applyNormalize: boolean) => {
    if (sourceNodes.length === 0) {
      setErr("Importez au moins une source de données (onglet Importer).");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await analyzeSources(
        sourceNodes.map((n) => ({
          id: n.id,
          type: n.data.kind,
          label: n.data.label,
          config: n.data.config || {},
        })),
        applyNormalize,
        opts,
      );
      setReport(res);
      if (applyNormalize) onApplyNormalize(opts);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Analyse impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-edge bg-muted/30 px-4 py-4">
        <h2 className="text-base font-bold text-ink">Qualité &amp; normalisation</h2>
        <p className="mt-0.5 text-xs text-slate-600">
          Analyse intelligente de chaque jeu : colonnes, types, valeurs manquantes, titres (articles), structure (PDF).
        </p>
      </div>

      <div className="space-y-3 border-b border-edge p-4">
        <p className="text-xs font-semibold text-slate-700">Options de normalisation (niveau analyste)</p>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={opts.dropEmptyRows}
            onChange={(e) => setOpts({ ...opts, dropEmptyRows: e.target.checked })}
            className="accent-primary"
          />
          Supprimer les lignes entièrement vides
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={opts.dropDuplicates}
            onChange={(e) => setOpts({ ...opts, dropDuplicates: e.target.checked })}
            className="accent-primary"
          />
          Supprimer les doublons
        </label>
        <div>
          <label className="mb-1 block text-xs text-slate-600">
            Supprimer colonnes avec plus de X % de valeurs manquantes (0 = désactivé)
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={opts.dropNullColumnPct}
            onChange={(e) => setOpts({ ...opts, dropNullColumnPct: Number(e.target.value) })}
            className="w-full rounded-lg border border-edge px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-600">Valeurs manquantes (colonnes numériques)</label>
          <select
            value={opts.fillNumericNulls}
            onChange={(e) =>
              setOpts({ ...opts, fillNumericNulls: e.target.value as NormalizeOptions["fillNumericNulls"] })
            }
            className="w-full rounded-lg border border-edge px-3 py-2 text-sm"
          >
            <option value="none">Laisser vides (NA)</option>
            <option value="zero">Remplacer par 0</option>
            <option value="median">Remplacer par la médiane</option>
          </select>
        </div>
      </div>

      <div className="flex gap-2 border-b border-edge p-4">
        <button
          type="button"
          disabled={busy}
          onClick={() => run(false)}
          className="flex-1 rounded-xl border border-edge bg-surface py-2.5 text-sm font-semibold text-ink hover:bg-muted disabled:opacity-50"
        >
          {busy ? "…" : "Analyser"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => run(true)}
          className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {busy ? "…" : "Normaliser tout"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {sourceNodes.length === 0 && (
          <p className="text-center text-sm text-slate-500">
            Aucune source — ajoutez des fichiers, liens ou bases dans l'onglet <strong>1. Importer</strong>.
          </p>
        )}
        {sourceNodes.length > 0 && !report && !err && (
          <p className="text-center text-sm text-slate-500">
            {sourceNodes.length} source{sourceNodes.length > 1 ? "s" : ""} prête{sourceNodes.length > 1 ? "s" : ""}.
            Lancez l'analyse pour obtenir le profil de chaque jeu.
          </p>
        )}
        {err && <div className="mb-3 rounded-lg bg-bad/10 px-3 py-2 text-xs text-bad">{err}</div>}
        {report && (
          <>
            <div className="mb-4 rounded-xl border border-edge bg-primary-light/30 px-3 py-2 text-xs text-slate-700">
              <strong>{report.summary.success}/{report.summary.total}</strong> sources analysées · score moyen{" "}
              <strong>{report.summary.avgQuality}/100</strong>
              {report.normalized && " · normalisation appliquée"}
            </div>
            <div className="space-y-3">
              {report.sources.map((s) => (
                <SourceProfileCard key={s.id} entry={s} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SourceProfileCard({ entry }: { entry: AnalyzeResponse["sources"][number] }) {
  if (entry.error) {
    return (
      <div className="rounded-xl border border-bad/30 bg-bad/5 p-3">
        <p className="font-semibold text-ink">{entry.label}</p>
        <p className="text-xs text-bad">{entry.error}</p>
      </div>
    );
  }
  const p = entry.profile!;
  const kindLabel = DATASET_LABELS[p.datasetKind] || p.datasetKind;
  return (
    <div className="rounded-xl border border-edge bg-surface p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-ink">{entry.label}</p>
          <p className="text-[11px] text-slate-500">
            {kindLabel} · {p.rowCount} lignes · {p.columnCount} colonnes
          </p>
        </div>
        <QualityBadge score={p.qualityScoreAfter ?? p.qualityScore} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-slate-600">
          Complétude {p.completenessPercent}%
        </span>
        {typeof p.documentMeta?.title === "string" && p.documentMeta.title && (
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700">
            Titre : {p.documentMeta.title.slice(0, 40)}…
          </span>
        )}
      </div>
      {p.issues.length > 0 && (
        <ul className="mt-2 text-[11px] text-warn">
          {p.issues.map((i, idx) => (
            <li key={idx}>⚠ {i}</li>
          ))}
        </ul>
      )}
      {p.recommendations.length > 0 && (
        <p className="mt-1 text-[10px] text-slate-500">{p.recommendations[0]}</p>
      )}
      {p.columns.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[11px] font-medium text-primary">
            Colonnes détectées ({p.columns.length})
          </summary>
          <ul className="mt-1 max-h-32 space-y-1 overflow-y-auto text-[10px] text-slate-600">
            {p.columns.map((c) => (
              <li key={c.name} className="flex justify-between gap-2 border-b border-edge/50 py-0.5">
                <span>
                  <strong>{c.name}</strong> → {c.normalizedName} ({c.inferredType})
                </span>
                <span>{c.nullPercent}% NA</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {entry.normalized && (
        <p className="mt-2 text-[11px] text-good">
          ✓ Normalisé : {entry.normalized.rowCount} lignes, {entry.normalized.columns.length} colonnes
        </p>
      )}
    </div>
  );
}

function QualityBadge({ score }: { score: number }) {
  const color = score >= 70 ? "text-good bg-good/10" : score >= 40 ? "text-warn bg-warn/10" : "text-bad bg-bad/10";
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-bold ${color}`}>{score}</span>
  );
}
