import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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

import Palette from "../components/Palette";
import ConfigPanel from "../components/ConfigPanel";
import PreviewPanel from "../components/PreviewPanel";
import AIAssistant from "../components/AIAssistant";
import PipeNode from "../components/PipeNode";
import Spinner from "../components/ui/Spinner";
import { SPEC_BY_KIND } from "../nodeCatalog";
import { health, runPipeline } from "../api/pipeline";
import { getProject, updateProject } from "../api/projects";
import { ApiError } from "../lib/apiClient";
import type { NodeKind, PipeNodeData, RunResult, TablePreview } from "../types";

const nodeTypes = { pipe: PipeNode };

let idCounter = 1;
const newId = () => `n${idCounter++}`;

function resetIdCounter(nodes: Node[]) {
  let max = 0;
  for (const n of nodes) {
    const m = /^n(\d+)$/.exec(n.id);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  idCounter = max + 1;
}

function makeNode(kind: NodeKind, position: { x: number; y: number }, config?: any): Node<PipeNodeData> {
  const spec = SPEC_BY_KIND[kind];
  return {
    id: newId(),
    type: "pipe",
    position,
    data: { label: spec.label, kind, config: config ?? { ...spec.defaultConfig } },
  };
}

type Tab = "config" | "preview" | "ai";
type SaveState = "idle" | "saving" | "saved" | "error";

interface EditorProps {
  projectId: string;
  initialTitle: string;
  initialNodes: Node<PipeNodeData>[];
  initialEdges: Edge[];
}

function Editor({ projectId, initialTitle, initialNodes, initialEdges }: EditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [title, setTitle] = useState(initialTitle);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, TablePreview>>({});
  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState<Tab>("config");
  const [aiKey, setAiKey] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [contextMenu, setContextMenu] = useState<{
    type: "node" | "edge";
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const rfRef = useRef<ReactFlowInstance | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const dirtyRef = useRef(false);

  useEffect(() => {
    health().then((h) => setAiKey(h.aiKey)).catch(() => setAiKey(false));
  }, []);

  // Autosave debounce : sauvegarde le graphe + titre après modification.
  useEffect(() => {
    if (!dirtyRef.current) return;
    setSaveState("saving");
    const handle = setTimeout(async () => {
      try {
        const cleanNodes = nodes.map((n) => {
          const { status: _status, ...data } = n.data as PipeNodeData & { status?: unknown };
          return { ...n, data };
        });
        await updateProject(projectId, {
          title: title.trim() || "Sans titre",
          graph: { nodes: cleanNodes, edges },
        });
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 800);
    return () => clearTimeout(handle);
  }, [nodes, edges, title, projectId]);

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
  }, []);

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

  const upstreamColumns = useMemo(() => {
    if (!selectedNode) return [];
    const parents = edges.filter((e) => e.target === selectedNode.id).map((e) => e.source);
    for (const p of parents) {
      const pv = previews[p];
      if (pv && pv.columns?.length) return pv.columns;
    }
    const own = previews[selectedNode.id];
    return own?.columns ?? [];
  }, [selectedNode, edges, previews]);

  const onConnect = useCallback(
    (conn: Connection) => {
      markDirty();
      setEdges((eds) => addEdge({ ...conn, id: `e${Date.now()}` }, eds));
    },
    [setEdges, markDirty]
  );

  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      if (!deleted.length) return;
      markDirty();
      const ids = new Set(deleted.map((e) => e.id));
      setEdges((eds) => eds.filter((e) => !ids.has(e.id)));
    },
    [setEdges, markDirty]
  );

  const addNodeAt = useCallback(
    (kind: NodeKind, position?: { x: number; y: number }) => {
      markDirty();
      const pos = position ?? { x: 200 + Math.random() * 200, y: 120 + Math.random() * 200 };
      const node = makeNode(kind, pos);
      setNodes((nds) => [...nds, node]);
      setSelectedId(node.id);
      setTab("config");
    },
    [setNodes, markDirty]
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
      markDirty();
      setNodes((nds) =>
        nds.map((n) => (n.id === selectedId ? { ...n, data: { ...n.data, config } } : n))
      );
    },
    [selectedId, setNodes, markDirty]
  );

  const renameNode = useCallback(
    (label: string) => {
      if (!selectedId) return;
      markDirty();
      setNodes((nds) =>
        nds.map((n) => (n.id === selectedId ? { ...n, data: { ...n.data, label } } : n))
      );
    },
    [selectedId, setNodes, markDirty]
  );

  const deleteNodeById = useCallback(
    (id: string) => {
      markDirty();
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
      setSelectedId((cur) => (cur === id ? null : cur));
    },
    [setNodes, setEdges, markDirty]
  );

  const deleteNode = useCallback(() => {
    if (!selectedId) return;
    deleteNodeById(selectedId);
  }, [selectedId, deleteNodeById]);

  const deleteEdgeById = useCallback(
    (id: string) => {
      markDirty();
      setEdges((eds) => eds.filter((e) => e.id !== id));
    },
    [setEdges, markDirty]
  );

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
      markDirty();
      const node = makeNode(kind, { x: 400 + Math.random() * 150, y: 360 }, { [kind === "sql" ? "query" : "code"]: code });
      setNodes((nds) => [...nds, node]);
      setSelectedId(node.id);
      setTab("config");
    },
    [setNodes, markDirty]
  );

  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      if (changes.some((c) => c.type === "position" || c.type === "remove" || c.type === "add")) {
        markDirty();
      }
      onNodesChange(changes);
    },
    [onNodesChange, markDirty]
  );

  const run = useCallback(async () => {
    setRunning(true);
    setRunError(null);
    try {
      const res = await runPipeline(nodes, edges);
      setResult(res);
      setPreviews(res.previews);
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

  const saveLabel = {
    idle: "",
    saving: "Enregistrement…",
    saved: "Enregistré",
    error: "Échec de l'enregistrement",
  }[saveState];

  return (
    <div className="flex h-screen flex-col bg-ink">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-edge bg-panel px-5 py-3">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-panel2 text-slate-300 transition hover:bg-edge hover:text-slate-100"
            aria-label="Retour aux projets"
          >
            ←
          </Link>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent2 text-lg font-black text-ink">
            ⇄
          </div>
          <input
            value={title}
            onChange={(e) => {
              markDirty();
              setTitle(e.target.value);
            }}
            className="w-64 truncate rounded-md border border-transparent bg-transparent px-2 py-1 text-base font-bold text-slate-100 outline-none transition hover:border-edge focus:border-accent focus:bg-ink"
            aria-label="Titre du projet"
          />
          <span
            className={`text-[11px] ${saveState === "error" ? "text-bad" : "text-slate-500"}`}
          >
            {saveLabel}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] ${
              aiKey ? "bg-good/15 text-good" : "bg-warn/15 text-warn"
            }`}
          >
            ● IA {aiKey ? "OpenAI" : "locale"}
          </span>
          {runError && <span className="text-xs text-bad">{runError}</span>}
          <button
            onClick={run}
            disabled={running}
            className="rounded-lg bg-gradient-to-r from-accent to-accent2 px-4 py-2 text-sm font-bold text-ink transition hover:opacity-90 disabled:opacity-40"
          >
            {running ? "Exécution…" : "▶ Exécuter le pipeline"}
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
            onNodesChange={handleNodesChange}
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
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#243049" />
            <Controls />
            <MiniMap
              nodeColor={(n) => SPEC_BY_KIND[(n.data as PipeNodeData).kind]?.color ?? "#38bdf8"}
              maskColor="rgba(11,17,32,0.7)"
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
                🗑 Supprimer
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
                {t === "config" ? "Configuration" : t === "preview" ? "Aperçu" : "✨ Assistant IA"}
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

export default function ProjectEditor() {
  const { idProjet } = useParams<{ idProjet: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<EditorProps | null>(null);

  useEffect(() => {
    if (!idProjet) return;
    let active = true;
    setLoading(true);
    setError(null);
    getProject(idProjet)
      .then((project) => {
        if (!active) return;
        const graphNodes = (project.graph?.nodes ?? []) as Node<PipeNodeData>[];
        const graphEdges = (project.graph?.edges ?? []) as Edge[];
        resetIdCounter(graphNodes);
        setData({
          projectId: project.id,
          initialTitle: project.title,
          initialNodes: graphNodes,
          initialEdges: graphEdges,
        });
      })
      .catch((e: unknown) => {
        if (!active) return;
        if (e instanceof ApiError && e.status === 404) {
          navigate("/", { replace: true });
          return;
        }
        setError(e instanceof Error ? e.message : "Impossible de charger le projet.");
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [idProjet, navigate]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-ink">
        <Spinner />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-ink text-center">
        <p className="text-sm text-bad">{error ?? "Projet introuvable."}</p>
        <Link to="/" className="text-sm font-semibold text-accent hover:underline">
          Retour aux projets
        </Link>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <Editor key={data.projectId} {...data} />
    </ReactFlowProvider>
  );
}
