import { ReactFlowProvider } from "reactflow";
import type { Edge, Node } from "reactflow";
import { PipelineEditor } from "./ProjectEditor";
import { SAMPLE_CSV } from "../sampleData";
import type { NodeKind, PipeNodeData } from "../types";
import { SPEC_BY_KIND } from "../nodeCatalog";

let idCounter = 1;
const newId = () => `n${idCounter++}`;

function makeNode(kind: NodeKind, position: { x: number; y: number }, config?: Record<string, unknown>): Node<PipeNodeData> {
  const spec = SPEC_BY_KIND[kind];
  return {
    id: newId(),
    type: "pipe",
    position,
    data: { label: spec.label, kind, config: config ?? { ...spec.defaultConfig } },
  };
}

const initialNodes: Node<PipeNodeData>[] = [
  makeNode("source_csv", { x: 80, y: 160 }, { delimiter: ",", content: SAMPLE_CSV }),
  makeNode("filter", { x: 360, y: 160 }, { expression: "montant > 1000" }),
  makeNode("sort", { x: 640, y: 160 }, { by: "montant", ascending: false }),
  makeNode("output", { x: 920, y: 160 }, {}),
];

const initialEdges: Edge[] = [
  { id: "e1", source: initialNodes[0].id, target: initialNodes[1].id },
  { id: "e2", source: initialNodes[1].id, target: initialNodes[2].id },
  { id: "e3", source: initialNodes[2].id, target: initialNodes[3].id },
];

/** Éditeur ETL autonome, utilisable sans compte Supabase (hackathon / démo locale). */
export default function DemoEditor() {
  return (
    <ReactFlowProvider>
      <PipelineEditor
        demo
        projectId="demo"
        initialTitle="DataPipe — Démo ETL"
        initialNodes={initialNodes}
        initialEdges={initialEdges}
      />
    </ReactFlowProvider>
  );
}
