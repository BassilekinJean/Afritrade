import { useState } from "react";
import { SPEC_BY_KIND, type FieldSpec } from "../nodeCatalog";
import { uploadSource } from "../api";
import type { Node } from "reactflow";
import type { PipeNodeData, TablePreview } from "../types";

interface Props {
  node: Node<PipeNodeData> | null;
  upstreamColumns: string[];
  onChange: (config: Record<string, any>) => void;
  onRename: (label: string) => void;
  onDelete: () => void;
}

export default function ConfigPanel({ node, upstreamColumns, onChange, onRename, onDelete }: Props) {
  if (!node) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-500">
        Sélectionnez un node pour le configurer.
      </div>
    );
  }

  const spec = SPEC_BY_KIND[node.data.kind];
  const config = node.data.config || {};

  const set = (key: string, value: any) => onChange({ ...config, [key]: value });

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-edge px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <span
            className="rounded-md px-1.5 py-0.5 text-[10px] font-bold text-ink"
            style={{ background: spec?.color }}
          >
            {spec?.icon}
          </span>
          <input
            value={node.data.label}
            onChange={(e) => onRename(e.target.value)}
            className="flex-1 rounded bg-transparent px-1 text-sm font-semibold text-slate-100 outline-none focus:bg-panel"
          />
          <button
            onClick={onDelete}
            className="rounded px-2 py-1 text-xs text-bad hover:bg-bad/10"
            title="Supprimer le node"
          >
            Suppr.
          </button>
        </div>
        <div className="mt-1 text-[11px] text-slate-500">{spec?.description}</div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {spec?.fields.length === 0 && (
          <p className="text-xs text-slate-500">
            Ce node n'a pas de configuration. Connectez une transformation en amont.
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
}: {
  field: FieldSpec;
  value: any;
  config: Record<string, any>;
  upstreamColumns: string[];
  onChange: (key: string, value: any) => void;
}) {
  const label = (
    <label className="mb-1 block text-xs font-medium text-slate-300">{field.label}</label>
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
            className="w-full rounded-lg border border-edge bg-panel px-3 py-2 text-sm text-slate-100 outline-none focus:border-accent"
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
            className="w-full rounded-lg border border-edge bg-panel px-3 py-2 text-sm text-slate-100 outline-none focus:border-accent"
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
            className={`w-full rounded-lg border border-edge bg-panel px-3 py-2 text-sm text-slate-100 outline-none focus:border-accent ${
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
          <span className="text-sm text-slate-200">{field.label}</span>
        </label>
      );
    case "columns":
      return (
        <ColumnsField field={field} value={value} upstreamColumns={upstreamColumns} onChange={onChange} />
      );
    case "keyvalue":
      return <KeyValueField field={field} value={value} onChange={onChange} />;
    case "file":
      return <FileField field={field} config={config} onChange={onChange} />;
    default:
      return null;
  }
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
  onChange: (key: string, value: any) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<TablePreview | null>(null);

  const handle = async (file: File) => {
    setBusy(true);
    setErr(null);
    setPreview(null);
    try {
      const res = await uploadSource(file, { delimiter: config.delimiter, table: config.table });
      onChange("datasetId", res.datasetId);
      onChange("__filename", res.filename);
      onChange("__columns", res.columns ?? []);
      onChange("__rowCount", res.rowCount ?? 0);
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
      <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-edge bg-panel px-3 py-4 text-sm text-slate-400 transition hover:border-accent/60">
        <input
          type="file"
          className="hidden"
          accept={field.accept ?? ".csv,.json,.txt"}
          onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])}
        />
        {busy ? "Import en cours…" : config.__filename ? `✓ ${config.__filename}` : "Cliquez pour importer"}
      </label>
      {err && <p className="mt-1 text-[11px] text-bad">{err}</p>}
      {field.help && <p className="mt-1 text-[11px] text-slate-500">{field.help}</p>}
      {preview && <ImportPreview preview={preview} />}
    </div>
  );
}

function ImportPreview({ preview }: { preview: TablePreview }) {
  const rows = preview.rows.slice(0, 5);
  return (
    <div className="mt-2 rounded-lg border border-edge bg-panel">
      <div className="flex items-center justify-between border-b border-edge px-2.5 py-1.5 text-[11px] text-slate-400">
        <span className="font-medium text-good">✓ Importé &amp; standardisé</span>
        <span>
          {preview.rowCount} ligne{preview.rowCount > 1 ? "s" : ""} · {preview.columns.length} colonnes
        </span>
      </div>
      <div className="max-h-44 overflow-auto">
        <table className="w-full border-collapse text-left text-[11px]">
          <thead className="sticky top-0 bg-panel2">
            <tr>
              {preview.columns.map((col) => (
                <th key={col} className="whitespace-nowrap border-b border-edge px-2 py-1 font-semibold text-slate-300">
                  {col}
                  <span className="ml-1 font-normal text-slate-600">{preview.dtypes[col]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="odd:bg-panel/40">
                {preview.columns.map((col) => (
                  <td key={col} className="whitespace-nowrap border-b border-edge/50 px-2 py-1 font-mono text-slate-400">
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
