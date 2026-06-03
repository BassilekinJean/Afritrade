import { Handle, Position, type NodeProps } from "reactflow";
import { SPEC_BY_KIND } from "../nodeCatalog";
import type { PipeNodeData } from "../types";

type Status = { rowCount?: number; error?: string } | undefined;

export default function PipeNode({ data, selected }: NodeProps<PipeNodeData & { status?: Status }>) {
  const spec = SPEC_BY_KIND[data.kind];
  const isSource = spec?.category === "source";
  const isOutput = spec?.category === "output";
  const status = data.status;

  return (
    <div
      className={`min-w-[184px] rounded-xl border bg-panel2 shadow-node transition ${
        selected ? "border-accent ring-2 ring-accent/40" : "border-edge"
      }`}
    >
      {!isSource && (
        <Handle type="target" position={Position.Left} className="!bg-accent" />
      )}

      <div
        className="flex items-center gap-2 rounded-t-xl px-3 py-2"
        style={{ background: `${spec?.color}22`, borderBottom: `1px solid ${spec?.color}55` }}
      >
        <span
          className="rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-ink"
          style={{ background: spec?.color }}
        >
          {spec?.icon}
        </span>
        <span className="text-sm font-semibold text-slate-100">{data.label}</span>
      </div>

      <div className="px-3 py-2 text-xs text-slate-400">
        <div className="truncate">{spec?.description}</div>
        {status?.error ? (
          <div className="mt-1 rounded bg-bad/15 px-2 py-1 font-mono text-[11px] text-bad">
            {status.error}
          </div>
        ) : status?.rowCount !== undefined ? (
          <div className="mt-1 inline-flex items-center gap-1.5 rounded bg-good/15 px-2 py-0.5 text-[11px] text-good">
            <span className="h-1.5 w-1.5 rounded-full bg-good" />
            {status.rowCount} ligne{status.rowCount > 1 ? "s" : ""}
          </div>
        ) : null}
      </div>

      {!isOutput && (
        <Handle type="source" position={Position.Right} className="!bg-accent" />
      )}
    </div>
  );
}
