import { useEffect, useState } from "react";
import { listExecutions, getExecution } from "../api/executions";
import type { PipelineRun } from "../types";
import Spinner from "./ui/Spinner";

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "medium" });
}

const TRIGGER_LABELS: Record<string, string> = {
  manual: "Manuel",
  webhook: "Webhook",
  schedule: "Planifié",
};

export default function ExecutionsPanel() {
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [selected, setSelected] = useState<PipelineRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listExecutions(80)
      .then(setRuns)
      .catch((e) => setError(e.message || "Erreur"))
      .finally(() => setLoading(false));
  }, []);

  const openRun = async (run: PipelineRun) => {
    try {
      setSelected(await getExecution(run.id));
    } catch {
      setSelected(run);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Historique d'exécution</h2>
        <p className="text-sm text-slate-500">Suivi des jobs pipeline (Talend Job Monitor / n8n Executions)</p>
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {runs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Aucune exécution enregistrée. Lancez un pipeline depuis l'éditeur.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Statut</th>
                  <th className="px-3 py-2">Projet</th>
                  <th className="px-3 py-2">Déclencheur</th>
                  <th className="px-3 py-2">Durée</th>
                  <th className="px-3 py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => openRun(r)}
                    className={`cursor-pointer border-b hover:bg-slate-50 ${selected?.id === r.id ? "bg-indigo-50" : ""}`}
                  >
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          r.status === "success"
                            ? "bg-emerald-100 text-emerald-800"
                            : r.status === "failed"
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 truncate max-w-[120px]">{r.project_title || "—"}</td>
                    <td className="px-3 py-2">{TRIGGER_LABELS[r.trigger_type] || r.trigger_type}</td>
                    <td className="px-3 py-2">{r.duration_ms != null ? `${Math.round(r.duration_ms)} ms` : "—"}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{formatDate(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selected && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="font-semibold text-slate-800">Détail — {selected.id.slice(0, 8)}…</h3>
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between"><dt className="text-slate-500">Statut</dt><dd>{selected.status}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Nœuds</dt><dd>{selected.node_count}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Lignes finales</dt><dd>{(selected.result_summary as any)?.rowCount ?? "—"}</dd></div>
                {selected.error_message && (
                  <p className="mt-2 rounded bg-red-50 p-2 text-xs text-red-700">{selected.error_message}</p>
                )}
              </dl>
              {selected.node_logs && selected.node_logs.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Logs par nœud</p>
                  <ul className="max-h-64 space-y-1 overflow-y-auto text-xs">
                    {selected.node_logs.map((log) => (
                      <li key={log.id} className="flex items-center justify-between rounded bg-slate-50 px-2 py-1">
                        <span className="font-mono">{log.node_id}</span>
                        <span className={log.status === "error" ? "text-red-600" : "text-emerald-600"}>
                          {log.status} · {log.row_count ?? 0} lignes
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
