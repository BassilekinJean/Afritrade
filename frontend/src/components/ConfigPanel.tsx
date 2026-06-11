import { useState, useEffect } from "react";
import { SPEC_BY_KIND, type FieldSpec } from "../nodeCatalog";
import { NodeIcon } from "./icons/Icons";
import AIButton from "./AIButton";
import { fetchUrlSource, previewDatabase, uploadSource } from "../api/pipeline";
import { listConnections } from "../api/connections";
import type { Node } from "reactflow";
import type { Connection, PipeNodeData, TablePreview } from "../types";

interface Props {
  node: Node<PipeNodeData> | null;
  upstreamColumns: string[];
  onChange: (config: Record<string, any>) => void;
  onRename: (label: string) => void;
  onDelete: () => void;
  onOpenImport?: () => void;
}

export default function ConfigPanel({ node, upstreamColumns, onChange, onRename, onDelete, onOpenImport }: Props) {
  if (!node) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-slate-500">Sélectionnez une étape sur le parcours pour modifier ses paramètres.</p>
        {onOpenImport && (
          <button
            type="button"
            onClick={onOpenImport}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover"
          >
            📥 Importer des données
          </button>
        )}
      </div>
    );
  }

  const spec = SPEC_BY_KIND[node.data.kind];
  const config = node.data.config || {};
  const colsHint = upstreamColumns.length ? upstreamColumns.join(", ") : "colonnes du pipeline";
  const aiPrompts: Partial<Record<string, { prompt: string; mode: "pandas" | "sql" }>> = {
    custom: { prompt: `Transformation pandas sur colonnes : ${colsHint}`, mode: "pandas" },
    sql: { prompt: `Requête SQL sur table input, colonnes : ${colsHint}`, mode: "sql" },
    filter: { prompt: `Filtrer les lignes agricoles (${colsHint})`, mode: "pandas" },
    map: { prompt: `Mapper / transformer colonnes (${colsHint})`, mode: "pandas" },
  };
  const aiHint = aiPrompts[node.data.kind];

  const set = (key: string, value: any) => onChange({ ...config, [key]: value });
  const setMany = (updates: Record<string, any>) => onChange({ ...config, ...updates });

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="border-b border-edge px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-brand"
            style={{ background: `${spec?.color}18`, color: spec?.color }}
          >
            <NodeIcon kind={node.data.kind} size={16} />
          </span>
          <input
            value={node.data.label}
            onChange={(e) => onRename(e.target.value)}
            className="flex-1 rounded-lg bg-muted px-2 py-1 text-sm font-semibold text-ink outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            onClick={onDelete}
            className="rounded-lg px-2 py-1 text-xs text-bad hover:bg-bad/10"
            title="Supprimer cette étape"
          >
            Retirer
          </button>
        </div>
        <div className="mt-1 text-[11px] text-slate-500">{spec?.description}</div>
        {aiHint && (
          <div className="mt-2">
            <AIButton
              variant="chip"
              label="Générer avec l'IA"
              mode={aiHint.mode}
              prompt={aiHint.prompt}
            />
          </div>
        )}
      </div>

        {(node.data.kind === "causal_analysis" || node.data.kind === "predict") &&
          !config.targetColumn && (
          <div className="mx-4 mb-2 rounded-lg border border-warn/30 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Sélectionnez une <strong>colonne cible</strong> ci-dessous, ou ouvrez l&apos;onglet <strong>Aide</strong> pour un guide pas à pas.
          </div>
        )}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {spec?.fields.length === 0 && (
          <p className="text-xs text-slate-500">
            Rien à configurer ici — reliez une étape en amont.
          </p>
        )}
        {spec?.fields.map((field) => (
          <Field
            key={field.key}
            field={field}
            value={config[field.key]}
            config={config}
            upstreamColumns={upstreamColumns}
            onChange={set}
            onChangeMany={setMany}
          />
        ))}
      </div>
    </div>
  );
}

function Field({
  field,
  value,
  config,
  upstreamColumns,
  onChange,
  onChangeMany,
}: {
  field: FieldSpec;
  value: any;
  config: Record<string, any>;
  upstreamColumns: string[];
  onChange: (key: string, value: any) => void;
  onChangeMany: (updates: Record<string, any>) => void;
}) {
  const label = (
    <label className="mb-1 block text-xs font-medium text-slate-600">{field.label}</label>
  );

  const help = field.help ? <p className="mt-1 text-[11px] text-slate-500">{field.help}</p> : null;

  switch (field.type) {
    case "text":
      return (
        <div>
          {label}
          <input
            value={value ?? ""}
            placeholder={field.placeholder}
            onChange={(e) => onChange(field.key, e.target.value)}
            className="w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          {help}
        </div>
      );
    case "number":
      return (
        <div>
          {label}
          <input
            type="number"
            value={value ?? ""}
            onChange={(e) => onChange(field.key, Number(e.target.value))}
            className="w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          {help}
        </div>
      );
    case "textarea":
    case "code":
      return (
        <div>
          {label}
          <textarea
            value={value ?? ""}
            placeholder={field.placeholder}
            spellCheck={false}
            onChange={(e) => onChange(field.key, e.target.value)}
            rows={field.type === "code" ? 8 : 5}
            className={`w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 ${
              field.type === "code" ? "font-mono text-[12px]" : ""
            }`}
          />
          {help}
        </div>
      );
    case "boolean":
      return (
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(field.key, e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
          <span className="text-sm text-ink">{field.label}</span>
        </label>
      );
    case "columns":
      return (
        <ColumnsField field={field} value={value} upstreamColumns={upstreamColumns} onChange={onChange} />
      );
    case "column":
      return (
        <ColumnPickField field={field} value={value} upstreamColumns={upstreamColumns} onChange={onChange} help={help} />
      );
    case "keyvalue":
      return <KeyValueField field={field} value={value} onChange={onChange} />;
    case "file":
      return <FileField field={field} config={config} onChange={onChangeMany} />;
    case "url":
      return <UrlField field={field} config={config} onChange={onChangeMany} />;
    case "database":
      return <DatabaseField config={config} onChange={onChangeMany} />;
    case "connection":
      return (
        <ConnectionField
          value={value}
          config={config}
          onChange={onChange}
          onChangeMany={onChangeMany}
        />
      );
    case "rules":
      return <RulesField field={field} value={value} onChange={onChange} />;
    case "select":
      return (
        <div>
          {label}
          <select
            value={value ?? field.options?.[0] ?? ""}
            onChange={(e) => onChange(field.key, e.target.value)}
            className="w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          >
            {(field.options ?? []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          {help}
        </div>
      );
    default:
      return null;
  }
}

function ColumnPickField({
  field,
  value,
  upstreamColumns,
  onChange,
  help,
}: {
  field: FieldSpec;
  value: string | undefined;
  upstreamColumns: string[];
  onChange: (key: string, value: any) => void;
  help?: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{field.label}</label>
      {upstreamColumns.length > 0 ? (
        <select
          value={value ?? ""}
          onChange={(e) => onChange(field.key, e.target.value)}
          className="w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        >
          <option value="">— Choisir une colonne —</option>
          {upstreamColumns.map((col) => (
            <option key={col} value={col}>
              {col}
            </option>
          ))}
        </select>
      ) : (
        <input
          value={value ?? ""}
          placeholder={field.placeholder ?? "nom_colonne"}
          onChange={(e) => onChange(field.key, e.target.value)}
          className="w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      )}
      {upstreamColumns.length === 0 && (
        <p className="mt-1 text-[11px] text-warn">
          Connectez une source et importez des données, ou exécutez une fois pour lister les colonnes.
        </p>
      )}
      {help}
    </div>
  );
}

function ColumnsField({
  field,
  value,
  upstreamColumns,
  onChange,
}: {
  field: FieldSpec;
  value: string[] | undefined;
  upstreamColumns: string[];
  onChange: (key: string, value: any) => void;
}) {
  const selected: string[] = Array.isArray(value) ? value : [];
  const toggle = (col: string) => {
    if (selected.includes(col)) onChange(field.key, selected.filter((c) => c !== col));
    else onChange(field.key, [...selected, col]);
  };
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-300">{field.label}</label>
      {upstreamColumns.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {upstreamColumns.map((col) => (
            <button
              key={col}
              onClick={() => toggle(col)}
              className={`rounded-full border px-2.5 py-1 text-xs transition ${
                selected.includes(col)
                  ? "border-accent bg-accent/20 text-accent"
                  : "border-edge bg-panel text-slate-400 hover:border-accent/50"
              }`}
            >
              {col}
            </button>
          ))}
        </div>
      ) : (
        <input
          value={selected.join(", ")}
          placeholder="colonne1, colonne2 (lancez le pipeline pour la liste)"
          onChange={(e) =>
            onChange(
              field.key,
              e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            )
          }
          className="w-full rounded-lg border border-edge bg-panel px-3 py-2 text-sm text-slate-100 outline-none focus:border-accent"
        />
      )}
    </div>
  );
}

function KeyValueField({
  field,
  value,
  onChange,
}: {
  field: FieldSpec;
  value: Record<string, string> | undefined;
  onChange: (key: string, value: any) => void;
}) {
  const entries = Object.entries(value || {});
  const update = (next: [string, string][]) => {
    const obj: Record<string, string> = {};
    next.forEach(([k, v]) => {
      if (k.trim()) obj[k.trim()] = v;
    });
    onChange(field.key, obj);
  };
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-300">{field.label}</label>
      <div className="space-y-1.5">
        {[...entries, ["", ""]].map(([k, v], i) => (
          <div key={i} className="flex items-center gap-1.5">
            <input
              value={k}
              placeholder="clé"
              onChange={(e) => {
                const next = [...entries];
                if (i < entries.length) next[i] = [e.target.value, v as string];
                else next.push([e.target.value, ""]);
                update(next);
              }}
              className="w-1/2 rounded-lg border border-edge bg-panel px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-accent"
            />
            <span className="text-slate-500">→</span>
            <input
              value={v as string}
              placeholder="valeur"
              onChange={(e) => {
                const next = [...entries];
                if (i < entries.length) next[i] = [k as string, e.target.value];
                else next.push(["", e.target.value]);
                update(next);
              }}
              className="w-1/2 rounded-lg border border-edge bg-panel px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-accent"
            />
          </div>
        ))}
      </div>
      {field.help && <p className="mt-1 text-[11px] text-slate-500">{field.help}</p>}
    </div>
  );
}

function FileField({
  field,
  config,
  onChange,
}: {
  field: FieldSpec;
  config: Record<string, any>;
  onChange: (updates: Record<string, any>) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<TablePreview | null>(null);

  const handle = async (file: File) => {
    setBusy(true);
    setErr(null);
    setPreview(null);
    try {
      const res = await uploadSource(file, {
        delimiter: config.delimiter,
        table: config.table,
        sheet: config.sheet,
      });
      onChange({
        datasetId: res.datasetId,
        sourceKind: res.sourceKind ?? res.kind,
        __kind: res.kind,
        __filename: res.filename,
        __columns: res.columns ?? [],
        __rowCount: res.rowCount ?? 0,
      });
      if (res.preview) {
        if (res.preview.error) setErr(res.preview.error);
        else setPreview(res.preview);
      }
    } catch (e: any) {
      setErr(e.message || "Échec de l'import");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-300">{field.label}</label>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-edge bg-muted/50 px-4 py-6 text-sm text-slate-500 transition hover:border-primary/50 hover:bg-primary-light/30">
        <input
          type="file"
          className="hidden"
          accept={field.accept ?? ".csv,.json,.txt,.xlsx,.pdf,.docx"}
          onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])}
        />
        <span className="text-2xl">📁</span>
        {busy ? "Chargement en cours…" : config.__filename ? `✓ ${config.__filename}` : "Glissez ou cliquez pour choisir"}
      </label>
      {err && <p className="mt-1 text-[11px] text-bad">{err}</p>}
      {field.help && <p className="mt-1 text-[11px] text-slate-500">{field.help}</p>}
      {preview && <ImportPreview preview={preview} />}
    </div>
  );
}

function UrlField({
  field,
  config,
  onChange,
}: {
  field: FieldSpec;
  config: Record<string, any>;
  onChange: (updates: Record<string, any>) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<TablePreview | null>(null);

  const fetch = async () => {
    const url = (config.url || "").trim();
    if (!url) {
      setErr("Indiquez une adresse web.");
      return;
    }
    setBusy(true);
    setErr(null);
    setPreview(null);
    try {
      const res = await fetchUrlSource(url);
      onChange({
        url,
        datasetId: res.datasetId,
        sourceKind: res.sourceKind ?? res.kind,
        __filename: res.url,
        __columns: res.columns ?? [],
        __rowCount: res.rowCount ?? 0,
      });
      if (res.preview) {
        if (res.preview.error) setErr(res.preview.error);
        else setPreview(res.preview);
      }
    } catch (e: any) {
      setErr(e.message || "Impossible de récupérer cette page.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{field.label}</label>
      <div className="flex gap-2">
        <input
          value={config.url ?? ""}
          placeholder={field.placeholder}
          onChange={(e) => onChange({ url: e.target.value })}
          className="flex-1 rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={fetch}
          disabled={busy}
          className="shrink-0 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {busy ? "…" : "Récupérer"}
        </button>
      </div>
      {err && <p className="mt-1 text-[11px] text-bad">{err}</p>}
      {field.help && <p className="mt-1 text-[11px] text-slate-500">{field.help}</p>}
      {preview && <ImportPreview preview={preview} />}
    </div>
  );
}

function ConnectionField({
  value,
  config,
  onChange,
  onChangeMany,
}: {
  value: string | undefined;
  config: Record<string, any>;
  onChange: (key: string, value: any) => void;
  onChangeMany: (updates: Record<string, any>) => void;
}) {
  const [connections, setConnections] = useState<Connection[]>([]);
  useEffect(() => {
    listConnections().then(setConnections).catch(() => setConnections([]));
  }, []);

  const selected = connections.find((c) => c.id === value);

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">Connexion enregistrée</label>
      <select
        value={value ?? ""}
        onChange={(e) => {
          const id = e.target.value || undefined;
          onChange("connectionId", id);
          const conn = connections.find((c) => c.id === id);
          if (conn) {
            onChangeMany({ connectionId: id, connectionUrl: conn.connection_url });
          }
        }}
        className="w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary"
      >
        <option value="">— Saisie manuelle —</option>
        {connections.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} ({c.conn_type})
          </option>
        ))}
      </select>
      {selected && (
        <p className="mt-1 text-[11px] text-slate-500 truncate">{selected.connection_url}</p>
      )}
      {!value && (
        <p className="mt-1 text-[11px] text-slate-500">
          Gérez vos connexions dans l'onglet Connexions.
        </p>
      )}
    </div>
  );
}

function RulesField({
  field,
  value,
  onChange,
}: {
  field: FieldSpec;
  value: unknown;
  onChange: (key: string, value: any) => void;
}) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? [], null, 2);
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{field.label}</label>
      <textarea
        value={text}
        onChange={(e) => {
          try {
            onChange(field.key, JSON.parse(e.target.value || "[]"));
          } catch {
            onChange(field.key, e.target.value);
          }
        }}
        rows={6}
        className="w-full rounded-lg border border-edge bg-surface px-3 py-2 font-mono text-[12px] text-ink outline-none focus:border-primary"
        placeholder='[{"column":"montant","rule":"min","value":0}]'
      />
      {field.help && <p className="mt-1 text-[11px] text-slate-500">{field.help}</p>}
    </div>
  );
}

function DatabaseField({
  config,
  onChange,
}: {
  config: Record<string, any>;
  onChange: (updates: Record<string, any>) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<TablePreview | null>(null);

  const test = async () => {
    const connectionUrl = (config.connectionUrl || "").trim();
    if (!connectionUrl) {
      setErr("Indiquez l'adresse de connexion.");
      return;
    }
    setBusy(true);
    setErr(null);
    setPreview(null);
    try {
      const res = await previewDatabase({
        connectionUrl,
        table: config.table || undefined,
        query: config.query || undefined,
      });
      onChange({
        connectionUrl,
        __columns: res.columns ?? [],
        __rowCount: res.rowCount ?? 0,
      });
      if (res.preview) {
        if (res.preview.error) setErr(res.preview.error);
        else setPreview(res.preview);
      }
    } catch (e: any) {
      setErr(e.message || "Connexion impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Adresse de connexion</label>
        <input
          value={config.connectionUrl ?? ""}
          placeholder="sqlite:///./ma_base.db"
          onChange={(e) => onChange({ connectionUrl: e.target.value })}
          className="w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Table (optionnel)</label>
        <input
          value={config.table ?? ""}
          placeholder="transactions"
          onChange={(e) => onChange({ table: e.target.value })}
          className="w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Ou requête SELECT</label>
        <textarea
          value={config.query ?? ""}
          placeholder="SELECT * FROM transactions LIMIT 100"
          onChange={(e) => onChange({ query: e.target.value })}
          rows={3}
          className="w-full rounded-lg border border-edge bg-surface px-3 py-2 font-mono text-[12px] text-ink outline-none focus:border-primary"
        />
      </div>
      <button
        type="button"
        onClick={test}
        disabled={busy}
        className="w-full rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
      >
        {busy ? "Connexion en cours…" : "Tester la connexion"}
      </button>
      {err && <p className="text-[11px] text-bad">{err}</p>}
      {preview && <ImportPreview preview={preview} />}
    </div>
  );
}

function ImportPreview({ preview }: { preview: TablePreview }) {
  const rows = preview.rows.slice(0, 5);
  return (
    <div className="mt-2 rounded-xl border border-edge bg-muted/40">
      <div className="flex items-center justify-between border-b border-edge px-2.5 py-1.5 text-[11px] text-slate-500">
        <span className="font-medium text-good">✓ Données prêtes</span>
        <span>
          {preview.rowCount} ligne{preview.rowCount > 1 ? "s" : ""} · {preview.columns.length} colonnes
        </span>
      </div>
      <div className="max-h-44 overflow-auto">
        <table className="w-full border-collapse text-left text-[11px]">
          <thead className="sticky top-0 bg-surface">
            <tr>
              {preview.columns.map((col) => (
                <th key={col} className="whitespace-nowrap border-b border-edge px-2 py-1 font-semibold text-slate-600">
                  {col}
                  <span className="ml-1 font-normal text-slate-600">{preview.dtypes[col]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="odd:bg-surface/60">
                {preview.columns.map((col) => (
                  <td key={col} className="whitespace-nowrap border-b border-edge/50 px-2 py-1 font-mono text-slate-600">
                    {row[col] === null || row[col] === undefined ? "∅" : String(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {preview.rowCount > rows.length && (
        <div className="px-2.5 py-1 text-[10px] text-slate-500">Aperçu des {rows.length} premières lignes.</div>
      )}
    </div>
  );
}
