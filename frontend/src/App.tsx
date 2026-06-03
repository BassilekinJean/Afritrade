import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import ReactFlow, {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from "reactflow";
import "reactflow/dist/style.css";

import Palette from "./components/Palette";
import ConfigPanel from "./components/ConfigPanel";
import PreviewPanel from "./components/PreviewPanel";
import AIAssistant from "./components/AIAssistant";
import PipeNode from "./components/PipeNode";
import { SPEC_BY_KIND } from "./nodeCatalog";
import { health, runPipeline } from "./api";
import type { NodeKind, PipeNodeData, RunResult, TablePreview } from "./types";
import { SAMPLE_CSV } from "./sampleData";

const nodeTypes = { pipe: PipeNode };

let idCounter = 1;
const newId = () => `n${idCounter++}`;

function makeNode(kind: NodeKind, position: { x: number; y: number }, config?: any): Node<PipeNodeData> {
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

type Tab = "config" | "preview" | "ai";

function Flow() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedId, setSelectedId] = useState<string | null>(initialNodes[1].id);
  const [previews, setPreviews] = useState<Record<string, TablePreview>>({});
  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState<Tab>("config");
  const [aiKey, setAiKey] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    type: "node" | "edge";
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const rfRef = useRef<ReactFlowInstance | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    health().then((h) => setAiKey(h.aiKey)).catch(() => setAiKey(false));
  }, []);

  // Ferme le menu contextuel sur clic extérieur ou touche Échap.
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [contextMenu]);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId]
  );

  // Colonnes disponibles en amont du node sélectionné.
  // On privilégie l'aperçu du dernier run, puis les colonnes détectées à
  // l'import d'une source en amont (clé __columns), afin que les sélecteurs de
  // colonnes soient utilisables immédiatement, avant même d'exécuter le pipeline.
  const upstreamColumns = useMemo(() => {
    if (!selectedNode) return [];
    const parents = edges.filter((e) => e.target === selectedNode.id).map((e) => e.source);
    for (const p of parents) {
      const pv = previews[p];
      if (pv && pv.columns?.length) return pv.columns;
      const pnode = nodes.find((n) => n.id === p);
      const cols = pnode?.data.config?.__columns;
      if (Array.isArray(cols) && cols.length) return cols;
    }
    const own = previews[selectedNode.id];
    if (own?.columns?.length) return own.columns;
    const ownCols = selectedNode.data.config?.__columns;
    return Array.isArray(ownCols) ? ownCols : [];
  }, [selectedNode, edges, previews, nodes]);

  const onConnect = useCallback(
    (conn: Connection) => setEdges((eds) => addEdge({ ...conn, id: `e${Date.now()}` }, eds)),
    [setEdges]
  );

  // Supprime le lien (edge) actuellement sélectionné au clavier.
  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      if (!deleted.length) return;
      const ids = new Set(deleted.map((e) => e.id));
      setEdges((eds) => eds.filter((e) => !ids.has(e.id)));
    },
    [setEdges]
  );

  const addNodeAt = useCallback(
    (kind: NodeKind, position?: { x: number; y: number }) => {
      const pos = position ?? { x: 200 + Math.random() * 200, y: 120 + Math.random() * 200 };
      const node = makeNode(kind, pos);
      setNodes((nds) => [...nds, node]);
      setSelectedId(node.id);
      setTab("config");
    },
    [setNodes]
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const kind = event.dataTransfer.getData("application/datapipe") as NodeKind;
      if (!kind || !rfRef.current) return;
      const position = rfRef.current.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addNodeAt(kind, position);
    },
    [addNodeAt]
  );

  const updateConfig = useCallback(
    (config: Record<string, any>) => {
      if (!selectedId) return;
      setNodes((nds) =>
        nds.map((n) => (n.id === selectedId ? { ...n, data: { ...n.data, config } } : n))
      );
    },
    [selectedId, setNodes]
  );

  const renameNode = useCallback(
    (label: string) => {
      if (!selectedId) return;
      setNodes((nds) =>
        nds.map((n) => (n.id === selectedId ? { ...n, data: { ...n.data, label } } : n))
      );
    },
    [selectedId, setNodes]
  );

  const deleteNodeById = useCallback(
    (id: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
      setSelectedId((cur) => (cur === id ? null : cur));
    },
    [setNodes, setEdges]
  );

  const deleteNode = useCallback(() => {
    if (!selectedId) return;
    deleteNodeById(selectedId);
  }, [selectedId, deleteNodeById]);

  const deleteEdgeById = useCallback(
    (id: string) => setEdges((eds) => eds.filter((e) => e.id !== id)),
    [setEdges]
  );

  // Affiche le menu contextuel sur clic droit, positionné dans le canvas.
  const openContextMenu = useCallback(
    (event: React.MouseEvent, type: "node" | "edge", id: string) => {
      event.preventDefault();
      const rect = wrapperRef.current?.getBoundingClientRect();
      setContextMenu({
        type,
        id,
        x: event.clientX - (rect?.left ?? 0),
        y: event.clientY - (rect?.top ?? 0),
      });
      if (type === "node") setSelectedId(id);
    },
    []
  );

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const deleteFromContextMenu = useCallback(() => {
    if (!contextMenu) return;
    if (contextMenu.type === "node") deleteNodeById(contextMenu.id);
    else deleteEdgeById(contextMenu.id);
    setContextMenu(null);
  }, [contextMenu, deleteNodeById, deleteEdgeById]);

  const applyAICode = useCallback(
    (kind: "custom" | "sql", code: string) => {
      const node = makeNode(kind, { x: 400 + Math.random() * 150, y: 360 }, { [kind === "sql" ? "query" : "code"]: code });
      setNodes((nds) => [...nds, node]);
      setSelectedId(node.id);
      setTab("config");
    },
    [setNodes]
  );

  const run = useCallback(async () => {
    setRunning(true);
    setRunError(null);
    try {
      const res = await runPipeline(nodes, edges);
      setResult(res);
      setPreviews(res.previews);
      // Injecte le statut dans chaque node.
      setNodes((nds) =>
        nds.map((n) => {
          const pv = res.previews[n.id];
          const status = pv ? (pv.error ? { error: pv.error } : { rowCount: pv.rowCount }) : undefined;
          return { ...n, data: { ...n.data, status } };
        })
      );
      setTab("preview");
    } catch (e: any) {
      setRunError(e.message || "Échec de l'exécution");
    } finally {
      setRunning(false);
    }
  }, [nodes, edges, setNodes]);

  const activePreview = useMemo(() => {
    if (selectedId && previews[selectedId]) return previews[selectedId];
    return result?.final ?? null;
  }, [selectedId, previews, result]);

  const previewTitle = useMemo(() => {
    if (selectedId && previews[selectedId]) return `Aperçu · ${selectedNode?.data.label ?? ""}`;
    return "Aperçu · résultat final";
  }, [selectedId, previews, selectedNode]);

  return (
    <div className="flex h-screen flex-col bg-ink">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-edge bg-panel px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent ring-1 ring-accent/30">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="5" cy="6" r="2.2" />
              <circle cx="5" cy="18" r="2.2" />
              <circle cx="19" cy="12" r="2.2" />
              <path d="M7 6.9 16.8 11M7 17.1 16.8 13" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight tracking-tight text-slate-100">
              DataPipe
            </h1>
            <p className="text-[11px] text-slate-500">Plateforme ETL pour données bancaires</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {runError && (
            <span className="max-w-[280px] truncate rounded-md border border-bad/30 bg-bad/10 px-2.5 py-1 text-xs text-bad">
              {runError}
            </span>
          )}
          <span
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium ${
              aiKey
                ? "border-good/30 bg-good/10 text-good"
                : "border-edge bg-panel2 text-slate-400"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${aiKey ? "bg-good" : "bg-slate-500"}`} />
            Assistant {aiKey ? "OpenAI" : "local"}
          </span>
          <button
            onClick={run}
            disabled={running}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent2 disabled:opacity-40"
          >
            {running ? (
              "Exécution…"
            ) : (
              <>
                <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Exécuter le pipeline
              </>
            )}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Palette */}
        <aside className="w-60 shrink-0 border-r border-edge bg-panel">
          <Palette onAdd={(k) => addNodeAt(k as NodeKind)} />
        </aside>

        {/* Canvas */}
        <main className="relative min-w-0 flex-1" ref={wrapperRef}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onEdgesDelete={onEdgesDelete}
            deleteKeyCode={["Backspace", "Delete"]}
            edgesFocusable
            elementsSelectable
            onInit={(inst) => (rfRef.current = inst)}
            onDrop={onDrop}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onNodeClick={(_, node) => {
              setSelectedId(node.id);
              setContextMenu(null);
              if (tab === "ai") return;
              setTab(previews[node.id] ? "preview" : "config");
            }}
            onNodeContextMenu={(e, node) => openContextMenu(e, "node", node.id)}
            onEdgeContextMenu={(e, edge) => openContextMenu(e, "edge", edge.id)}
            onPaneClick={() => {
              setSelectedId(null);
              setContextMenu(null);
            }}
            onMove={closeContextMenu}
            nodeTypes={nodeTypes}
            fitView
            defaultEdgeOptions={{ animated: true }}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#1f2a44" />
            <Controls />
            <MiniMap
              nodeColor={(n) => SPEC_BY_KIND[(n.data as PipeNodeData).kind]?.color ?? "#3b82f6"}
              maskColor="rgba(10,15,28,0.75)"
              className="!bg-panel2"
            />
          </ReactFlow>
          <div className="pointer-events-none absolute bottom-3 right-3 rounded-md border border-edge bg-panel/80 px-2.5 py-1 text-[11px] text-slate-400 backdrop-blur">
            Clic droit ou <kbd className="rounded bg-panel2 px-1 text-slate-200">Suppr</kbd> pour supprimer un lien / nœud
          </div>

          {contextMenu && (
            <div
              className="absolute z-50 min-w-[150px] overflow-hidden rounded-lg border border-edge bg-panel shadow-xl"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b border-edge px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {contextMenu.type === "edge" ? "Lien" : "Nœud"}
              </div>
              <button
                onClick={deleteFromContextMenu}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-bad transition hover:bg-bad/10"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
                </svg>
                Supprimer
              </button>
            </div>
          )}
        </main>

        {/* Right panel */}
        <aside className="flex w-[380px] shrink-0 flex-col border-l border-edge bg-panel">
          <div className="flex border-b border-edge">
            {(["config", "preview", "ai"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 px-3 py-2.5 text-xs font-semibold transition ${
                  tab === t
                    ? "border-b-2 border-accent text-accent"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {t === "config" ? "Configuration" : t === "preview" ? "Aperçu" : "Assistant"}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1">
            {tab === "config" && (
              <ConfigPanel
                node={selectedNode}
                upstreamColumns={upstreamColumns}
                onChange={updateConfig}
                onRename={renameNode}
                onDelete={deleteNode}
              />
            )}
            {tab === "preview" && (
              <PreviewPanel preview={activePreview} title={previewTitle} loading={running} />
            )}
            {tab === "ai" && (
              <AIAssistant upstreamColumns={upstreamColumns} aiKey={aiKey} onApply={applyAICode} />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  );
}
