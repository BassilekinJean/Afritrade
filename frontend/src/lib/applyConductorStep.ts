import { addEdge, type Edge, type Node } from "reactflow";
import { SPEC_BY_KIND } from "../nodeCatalog";
import type { ConductorStep, NodeKind, PipeNodeData } from "../types";

let idCounter = 1;
export function resetConductorIdCounter(nodes: Node[]) {
  let max = 0;
  for (const n of nodes) {
    const m = /^n(\d+)$/.exec(n.id);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  idCounter = max + 1;
}

function newId() {
  return `n${idCounter++}`;
}

function makeNode(
  kind: NodeKind,
  position: { x: number; y: number },
  config?: Record<string, unknown>,
): Node<PipeNodeData> {
  const spec = SPEC_BY_KIND[kind];
  return {
    id: newId(),
    type: "pipe",
    position,
    data: {
      label: spec.label,
      kind,
      config: config ?? { ...spec.defaultConfig },
    },
  };
}

export type ChainState = {
  lastNodeId: string | null;
  sourceIds: string[];
  depth: number;
};

export function initChain(nodes: Node<PipeNodeData>[], sourceNodeId?: string | null): ChainState {
  const sourceIds = sourceNodeId
    ? [sourceNodeId]
    : nodes.filter((n) => n.data.kind.startsWith("source_")).map((n) => n.id);
  const transforms = nodes.filter(
    (n) => !n.data.kind.startsWith("source_") && n.data.kind !== "output",
  );
  const last = transforms[transforms.length - 1]?.id ?? sourceIds[sourceIds.length - 1] ?? null;
  return { lastNodeId: last, sourceIds, depth: nodes.length };
}

export function applyConductorStep(
  step: ConductorStep,
  nodes: Node<PipeNodeData>[],
  edges: Edge[],
  chain: ChainState,
): { nodes: Node<PipeNodeData>[]; edges: Edge[]; chain: ChainState; tab?: string } {
  if (step.action === "quality_check") {
    return { nodes, edges, chain, tab: step.tab ?? "quality" };
  }

  if (step.action !== "add_node" || !step.nodeKind) {
    return { nodes, edges, chain };
  }

  const x = 280 + chain.depth * 200;
  const y = 160 + (chain.depth % 2) * 80;
  const node = makeNode(step.nodeKind, { x, y }, step.config as Record<string, unknown>);
  const newNodes = [...nodes, node];
  let newEdges = [...edges];

  const connectFrom =
    step.connectTo === "source"
      ? chain.sourceIds[chain.sourceIds.length - 1]
      : chain.lastNodeId ?? chain.sourceIds[0];

  if (connectFrom) {
    newEdges = addEdge(
      { id: `e${Date.now()}`, source: connectFrom, target: node.id },
      newEdges,
    );
  }

  return {
    nodes: newNodes,
    edges: newEdges,
    chain: {
      lastNodeId: node.id,
      sourceIds: chain.sourceIds,
      depth: chain.depth + 1,
    },
  };
}
