import { useEffect, useRef, useState } from "react";
import type { Node } from "reactflow";
import AIButton from "./AIButton";
import { fetchUrlSource, getDbHint, previewDatabase, uploadSource } from "../api/pipeline";
import type { NodeKind, PipeNodeData, TablePreview } from "../types";

const FILE_ACCEPT =
  ".csv,.txt,.tsv,.json,.xlsx,.xls,.xlsm,.pdf,.docx,.doc,.sql,.sqlite,.sqlite3,.db,.xml,.html,.htm";

const URL_EXAMPLES = [
  { label: "Article Wikipedia", url: "https://fr.wikipedia.org/wiki/Agriculture" },
  { label: "CSV public (data.gouv)", url: "https://www.data.gouv.fr/fr/rows.csv" },
];

export interface SourceImportResult {
  kind: NodeKind;
  label: string;
  config: Record<string, unknown>;
}

interface Props {
  onImported: (result: SourceImportResult) => void;
  sources?: Node<PipeNodeData>[];
}

type ImportMode = "file" | "url" | "database";

const MODES: { id: ImportMode; icon: string; label: string; hint: string }[] = [
  { id: "file", icon: "📄", label: "Fichier", hint: "CSV, Excel, PDF, Word, JSON…" },
  { id: "url", icon: "🌐", label: "Lien web", hint: "Page, article, API en ligne" },
  { id: "database", icon: "🗄️", label: "Base de données", hint: "SQLite, PostgreSQL, MySQL" },
];

export default function SourceImportPanel({ onImported, sources = [] }: Props) {
  const [mode, setMode] = useState<ImportMode>("file");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [preview, setPreview] = useState<TablePreview | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [delimiter, setDelimiter] = useState("auto");
  const [table, setTable] = useState("");
  const [sheet, setSheet] = useState("");
  const [lastFilename, setLastFilename] = useState<string | null>(null);

  const [url, setUrl] = useState("");

  const [connectionUrl, setConnectionUrl] = useState("");
  const [dbTable, setDbTable] = useState("users");
  const [dbQuery, setDbQuery] = useState("");
  const [dbHint, setDbHint] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode !== "database") return;
    getDbHint()
      .then((h) => {
        setDbHint(h.hint);
        setConnectionUrl((prev) => prev || h.sqliteUrl);
      })
      .catch(() => setDbHint(null));
  }, [mode]);

  const resetStatus = () => {
    setErr(null);
    setWarn(null);
    setPreview(null);
    setSuccess(null);
  };

  const finishImport = (result: SourceImportResult) => {
    onImported(result);
    setSuccess(`✓ « ${result.label} » ajouté au parcours (visible sur le canvas)`);
  };

  const handlePreviewResult = (p?: TablePreview) => {
    if (!p) return;
    if (p.error) {
      setWarn(`Aperçu partiel : ${p.error}. La source est quand même enregistrée.`);
      return;
    }
    setPreview(p);
  };

  const handleFile = async (file: File) => {
    resetStatus();
    setBusy(true);
    try {
      const res = await uploadSource(file, { delimiter, table: table || undefined, sheet: sheet || undefined });
      if (!res.datasetId) {
        setErr("Import échoué : aucun identifiant de jeu de données.");
        return;
      }
      setLastFilename(res.filename);
      handlePreviewResult(res.preview);
      finishImport({
        kind: "source_file",
        label: res.filename || "Mon fichier",
        config: {
          datasetId: res.datasetId,
          sourceKind: res.sourceKind ?? res.kind,
          __kind: res.kind,
          __filename: res.filename,
          __columns: res.columns ?? [],
          __rowCount: res.rowCount ?? 0,
          delimiter: delimiter === "auto" ? undefined : delimiter,
          table: table || undefined,
          sheet: sheet || undefined,
        },
      });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Échec de l'import du fichier.");
    } finally {
      setBusy(false);
    }
  };

  const handleUrl = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setErr("Collez une adresse web (http:// ou https://).");
      return;
    }
    resetStatus();
    setBusy(true);
    try {
      const res = await fetchUrlSource(trimmed);
      if (!res.datasetId) {
        setErr("Récupération échouée : contenu non enregistré.");
        return;
      }
      handlePreviewResult(res.preview);
      const short = trimmed.length > 40 ? `${trimmed.slice(0, 40)}…` : trimmed;
      finishImport({
        kind: "source_url",
        label: short,
        config: {
          url: trimmed,
          datasetId: res.datasetId,
          sourceKind: res.sourceKind ?? res.kind,
          __filename: res.url,
          __columns: res.columns ?? [],
          __rowCount: res.rowCount ?? 0,
        },
      });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Impossible de récupérer cette page.");
    } finally {
      setBusy(false);
    }
  };

  const handleDatabase = async () => {
    const conn = connectionUrl.trim();
    if (!conn) {
      setErr("Indiquez l'adresse de connexion à la base.");
      return;
    }
    if (!dbTable.trim() && !dbQuery.trim()) {
      setErr("Indiquez un nom de table ou une requête SELECT.");
      return;
    }
    resetStatus();
    setBusy(true);
    try {
      const res = await previewDatabase({
        connectionUrl: conn,
        table: dbTable || undefined,
        query: dbQuery || undefined,
      });
      handlePreviewResult(res.preview);
      const label = dbTable || "Ma base de données";
      finishImport({
        kind: "source_database",
        label,
        config: {
          connectionUrl: conn,
          table: dbTable || undefined,
          query: dbQuery || undefined,
          __columns: res.columns ?? [],
          __rowCount: res.rowCount ?? 0,
        },
      });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Connexion impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-edge bg-primary-light/40 px-4 py-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-ink">Étape 1 — Importer vos données</h2>
            <p className="mt-0.5 text-xs text-slate-600">
              CSV : séparateur <strong>Auto</strong>. Chaque source apparaît sur le canvas → puis <strong>2. Qualité</strong>.
            </p>
          </div>
          <AIButton
            variant="chip"
            label="Transformer après import"
            prompt="Après import CSV agricole (prix, culture, région), filtrer le maïs et sommer les prix par région"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 border-b border-edge p-3">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              setMode(m.id);
              resetStatus();
            }}
            className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-center transition ${
              mode === m.id
                ? "border-primary bg-primary-light shadow-sm"
                : "border-edge bg-surface hover:border-primary/40 hover:bg-muted/50"
            }`}
          >
            <span className="text-xl">{m.icon}</span>
            <span className="text-xs font-semibold text-ink">{m.label}</span>
            <span className="text-[10px] leading-tight text-slate-500">{m.hint}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {mode === "file" && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept={FILE_ACCEPT}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-primary-light/20 px-6 py-10 text-center transition hover:border-primary hover:bg-primary-light/40"
            >
              <span className="text-4xl">📁</span>
              <p className="text-sm font-semibold text-ink">
                {busy ? "Import en cours…" : lastFilename ? `Dernier : ${lastFilename}` : "Glissez un fichier ici"}
              </p>
              <p className="text-xs text-slate-500">ou cliquez pour parcourir</p>
              <p className="mt-1 max-w-xs text-[10px] text-slate-400">
                CSV · Excel · JSON · PDF · Word · TXT · SQL · SQLite
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-600">Séparateur CSV</label>
                <select
                  value={delimiter}
                  onChange={(e) => setDelimiter(e.target.value)}
                  className="w-full rounded-lg border border-edge px-2 py-1.5 text-sm"
                >
                  <option value="auto">Auto (recommandé)</option>
                  <option value=";">Point-virgule ;</option>
                  <option value=",">Virgule ,</option>
                  <option value="\t">Tabulation</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-600">Table SQL</label>
                <input
                  value={table}
                  onChange={(e) => setTable(e.target.value)}
                  placeholder="optionnel"
                  className="w-full rounded-lg border border-edge px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-600">Feuille Excel</label>
                <input
                  value={sheet}
                  onChange={(e) => setSheet(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-edge px-2 py-1.5 text-sm"
                />
              </div>
            </div>
          </>
        )}

        {mode === "url" && (
          <>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Adresse de la page ou du fichier</label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://exemple.com/donnees.csv"
                className="w-full rounded-lg border border-edge bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {URL_EXAMPLES.map((ex) => (
                <button
                  key={ex.url}
                  type="button"
                  onClick={() => setUrl(ex.url)}
                  className="rounded-lg border border-edge bg-muted/50 px-2 py-1 text-[10px] text-slate-600 hover:border-primary/40"
                >
                  {ex.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleUrl}
              disabled={busy}
              className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {busy ? "Récupération…" : "Récupérer les données"}
            </button>
            <p className="text-[11px] text-slate-500">
              Pages web (Wikipedia, articles), fichiers CSV/JSON/PDF accessibles en ligne.
            </p>
          </>
        )}

        {mode === "database" && (
          <>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Adresse de connexion</label>
              <input
                value={connectionUrl}
                onChange={(e) => setConnectionUrl(e.target.value)}
                placeholder="sqlite:///chemin/vers/base.db"
                className="w-full rounded-lg border border-edge bg-surface px-3 py-2.5 text-sm font-mono text-ink outline-none focus:border-primary"
              />
              {dbHint && (
                <p className="mt-1 text-[10px] text-primary">
                  Base locale suggérée · {dbHint}
                </p>
              )}
              <p className="mt-1 text-[10px] text-slate-400">
                Ex. postgresql://user:pass@localhost/db · mysql+pymysql://user:pass@host/db
              </p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Nom de la table</label>
              <input
                value={dbTable}
                onChange={(e) => setDbTable(e.target.value)}
                placeholder="users"
                className="w-full rounded-lg border border-edge px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Ou requête SELECT</label>
              <textarea
                value={dbQuery}
                onChange={(e) => setDbQuery(e.target.value)}
                placeholder="SELECT * FROM users LIMIT 100"
                rows={3}
                className="w-full rounded-lg border border-edge px-3 py-2 font-mono text-[12px]"
              />
            </div>
            <button
              type="button"
              onClick={handleDatabase}
              disabled={busy}
              className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {busy ? "Connexion…" : "Se connecter et importer"}
            </button>
          </>
        )}

        {err && (
          <div className="rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-xs text-bad">{err}</div>
        )}
        {warn && (
          <div className="rounded-lg border border-amber-300/50 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {warn}
          </div>
        )}
        {success && (
          <div className="rounded-lg border border-good/30 bg-good/10 px-3 py-2 text-xs text-good">{success}</div>
        )}
        {preview && <ImportPreview preview={preview} />}

        {sources.length > 0 && (
          <div className="mt-4 border-t border-edge pt-4">
            <p className="mb-2 text-xs font-semibold text-slate-700">
              Catalogue ({sources.length} source{sources.length > 1 ? "s" : ""}) — affichées sur le canvas
            </p>
            <ul className="space-y-1.5">
              {sources.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border border-edge bg-surface px-3 py-2 text-xs"
                >
                  <span className="font-medium text-ink">{s.data.label}</span>
                  <span className="text-slate-500">
                    {s.data.config?.__rowCount != null ? `${s.data.config.__rowCount} lignes` : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function ImportPreview({ preview }: { preview: TablePreview }) {
  const rows = preview.rows.slice(0, 5);
  return (
    <div className="rounded-xl border border-edge bg-muted/30">
      <div className="flex items-center justify-between border-b border-edge px-3 py-2 text-[11px] text-slate-500">
        <span className="font-medium text-good">Aperçu des données</span>
        <span>
          {preview.rowCount} ligne{preview.rowCount > 1 ? "s" : ""} · {preview.columns.length} colonnes
        </span>
      </div>
      <div className="max-h-48 overflow-auto">
        <table className="w-full border-collapse text-left text-[11px]">
          <thead className="sticky top-0 bg-surface">
            <tr>
              {preview.columns.map((col) => (
                <th key={col} className="whitespace-nowrap border-b border-edge px-2 py-1 font-semibold text-slate-600">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="odd:bg-surface/60">
                {preview.columns.map((col) => (
                  <td key={col} className="whitespace-nowrap border-b border-edge/50 px-2 py-1 text-slate-600">
                    {row[col] == null ? "—" : String(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
