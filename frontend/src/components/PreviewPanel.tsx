import type { TablePreview } from "../types";

export default function PreviewPanel({
  preview,
  title,
  loading,
}: {
  preview: TablePreview | null;
  title: string;
  loading: boolean;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-edge px-4 py-2">
        <div className="text-sm font-semibold text-slate-200">{title}</div>
        {preview && !preview.error && (
          <div className="text-xs text-slate-500">
            {preview.rowCount} ligne{preview.rowCount > 1 ? "s" : ""} · {preview.columns.length} colonnes
            {preview.truncated && " (aperçu 100 lignes)"}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            Exécution du pipeline…
          </div>
        ) : !preview ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-slate-500">
            Lancez le pipeline pour visualiser les données.
          </div>
        ) : preview.error ? (
          <div className="m-4 rounded-lg border border-bad/40 bg-bad/10 p-3 font-mono text-xs text-bad">
            {preview.error}
          </div>
        ) : preview.columns.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            Aucune donnée.
          </div>
        ) : (
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 bg-panel2">
              <tr>
                {preview.columns.map((col) => (
                  <th key={col} className="border-b border-edge px-3 py-2 font-semibold text-slate-300">
                    {col}
                    <span className="ml-1 font-normal text-slate-600">{preview.dtypes[col]}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((row, i) => (
                <tr key={i} className="odd:bg-panel/40 hover:bg-panel">
                  {preview.columns.map((col) => (
                    <td key={col} className="border-b border-edge/50 px-3 py-1.5 font-mono text-slate-300">
                      {formatCell(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function formatCell(value: any): string {
  if (value === null || value === undefined) return "∅";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
