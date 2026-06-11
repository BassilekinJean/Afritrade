import { useState } from "react";
import type { Edge, Node } from "reactflow";
import { exportPipeline } from "../api/pipeline";
import type { PipeNodeData } from "../types";

const FORMATS = [
  { id: "csv", label: "CSV", hint: "Tableur Excel, LibreOffice (;)" },
  { id: "json", label: "JSON", hint: "API, applications web" },
  { id: "jsonl", label: "JSON Lines", hint: "Flux, big data" },
  { id: "sqlite", label: "SQLite", hint: "Base locale embarquée" },
  { id: "parquet", label: "Parquet", hint: "Data science, Spark" },
];

interface Props {
  nodes: Node<PipeNodeData>[];
  edges: Edge[];
  hasOutput: boolean;
}

export default function ExportPanel({ nodes, edges, hasOutput }: Props) {
  const [format, setFormat] = useState("csv");
  const [filename, setFilename] = useState("resultat");
  const [tableName, setTableName] = useState("dataset");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const download = async () => {
    setBusy(true);
    setErr(null);
    try {
      await exportPipeline(
        nodes.map((n) => ({ id: n.id, type: n.data.kind, data: { config: n.data.config } })),
        edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
        { format, filename, tableName, csvDelimiter: ";" },
      );
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Export impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-edge bg-muted/30 px-4 py-4">
        <h2 className="text-base font-bold text-ink">Stockage final</h2>
        <p className="mt-0.5 text-xs text-slate-600">
          Choisissez le format dans lequel vos données normalisées et transformées seront exportées.
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {!hasOutput && (
          <div className="rounded-xl border border-warn/30 bg-warn/10 px-3 py-3 text-xs text-slate-700">
            Ajoutez un nœud <strong>Résultat final</strong> sur le parcours et connectez-le à la dernière
            transformation, puis lancez le traitement avant d'exporter.
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFormat(f.id)}
              className={`rounded-xl border px-3 py-3 text-left transition ${
                format === f.id
                  ? "border-primary bg-primary-light shadow-sm"
                  : "border-edge bg-surface hover:border-primary/40"
              }`}
            >
              <p className="text-sm font-semibold text-ink">{f.label}</p>
              <p className="text-[10px] text-slate-500">{f.hint}</p>
            </button>
          ))}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Nom du fichier</label>
          <input
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            className="w-full rounded-lg border border-edge px-3 py-2 text-sm"
          />
        </div>
        {format === "sqlite" && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Nom de la table SQLite</label>
            <input
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              className="w-full rounded-lg border border-edge px-3 py-2 text-sm"
            />
          </div>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={download}
          className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {busy ? "Export en cours…" : `Télécharger en ${format.toUpperCase()}`}
        </button>
        {err && <p className="text-xs text-bad">{err}</p>}
      </div>
    </div>
  );
}
