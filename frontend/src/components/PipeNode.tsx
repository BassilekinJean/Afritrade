import { Handle, Position, type NodeProps } from "reactflow";
import { SPEC_BY_KIND } from "../nodeCatalog";
import { NodeIcon } from "./icons/Icons";
import type { PipeNodeData } from "../types";

type Status = { rowCount?: number; error?: string } | undefined;

const CATEGORY_ACCENT: Record<string, string> = {
  trigger: "#0D2C54",
  source: "#2A9D8F",
  transform: "#0D2C54",
  output: "#388E3C",
};

export default function PipeNode({ data, selected }: NodeProps<PipeNodeData & { status?: Status }>) {
  const spec = SPEC_BY_KIND[data.kind];
  const isTrigger = spec?.category === "trigger";
  const isSource = spec?.category === "source";
  const isOutput = spec?.category === "output";
  const isBranch = data.kind === "branch";
  const status = data.status;
  const accent = CATEGORY_ACCENT[spec?.category ?? "transform"] ?? "#0D2C54";

  return (
    <div
      className={`min-w-[210px] rounded-brand border bg-surface shadow-node transition ${
        selected ? "border-accent ring-2 ring-accent/25" : "border-edge"
      }`}
    >
      {!isSource && !isTrigger && (
        <Handle type="target" position={Position.Left} className="!bg-accent !border-white" />
      )}

      <div
        className="flex items-center gap-2.5 rounded-t-brand border-b px-3 py-2.5"
        style={{ borderColor: `${accent}22`, background: `${accent}0A` }}
      >
        <span
          className="flex h-8 w-8 items-center justify-center rounded-brand"
          style={{ background: `${accent}14`, color: accent }}
        >
          <NodeIcon kind={data.kind} size={17} />
        </span>
        <span className="text-sm font-semibold text-brand-blue">{data.label}</span>
      </div>

      <div className="px-3 py-2 text-xs text-ink/60">
        <div className="line-clamp-2">{spec?.description}</div>
        {status?.error ? (
          <div className="mt-1.5 rounded-brand border border-bad/20 bg-red-50 px-2 py-1 text-[11px] text-bad">
            {status.error}
          </div>
        ) : status?.rowCount !== undefined ? (
          <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-brand-green-pale px-2 py-0.5 text-[11px] font-medium text-good">
            <span className="h-1.5 w-1.5 rounded-full bg-good" />
            {status.rowCount} ligne{status.rowCount > 1 ? "s" : ""}
          </div>
        ) : null}
      </div>

      {!isOutput && !isBranch && (
        <Handle type="source" position={Position.Right} className="!bg-accent !border-white" />
      )}
      {isBranch && (
        <>
          <Handle type="source" position={Position.Right} id="true" style={{ top: "35%" }} className="!bg-good" />
          <Handle type="source" position={Position.Right} id="false" style={{ top: "65%" }} className="!bg-bad" />
          <div className="flex gap-3 px-3 pb-2 text-[10px] font-medium">
            <span className="text-good">Vrai</span>
            <span className="text-bad">Faux</span>
          </div>
        </>
      )}
    </div>
  );
}
