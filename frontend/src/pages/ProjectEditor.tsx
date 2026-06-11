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
import SourceImportPanel, { type SourceImportResult } from "../components/SourceImportPanel";
import DataQualityPanel from "../components/DataQualityPanel";
import ExportPanel from "../components/ExportPanel";
import AutomationPanel from "../components/AutomationPanel";
import { LogoMark } from "../components/brand/Logo";
import Icon from "../components/icons/Icons";
import WorkflowStepper from "../components/WorkflowStepper";
import type { NormalizeOptions } from "../types";
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

type Tab = "import" | "quality" | "config" | "preview" | "export" | "ai" | "automation";
type SaveState = "idle" | "saving" | "saved" | "error";

export interface EditorProps {
  projectId: string;
  initialTitle: string;
  initialNodes: Node<PipeNodeData>[];
  initialEdges: Edge[];
  /** Mode démo : pas de sauvegarde cloud, interface simplifiée. */
  demo?: boolean;
}

export function PipelineEditor({ projectId, initialTitle, initialNodes, initialEdges, demo = false }: EditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [title, setTitle] = useState(initialTitle);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, TablePreview>>({});
  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState<Tab>("import");
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
    if (demo || !dirtyRef.current) return;
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
  }, [demo, nodes, edges, title, projectId]);

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
    (kind: NodeKind, position?: { x: number; y: number }, config?: Record<string, unknown>) => {
      markDirty();
      const pos = position ?? { x: 200 + Math.random() * 200, y: 120 + Math.random() * 200 };
      const node = makeNode(kind, pos, config);
      setNodes((nds) => [...nds, node]);
      setSelectedId(node.id);
      setTab("config");
    },
    [setNodes, markDirty]
  );

  const sourceNodes = useMemo(
    () => nodes.filter((n) => n.data.kind.startsWith("source_")),
    [nodes],
  );

  const hasSourceNode = sourceNodes.length > 0;

  const hasOutputNode = useMemo(
    () => nodes.some((n) => n.data.kind === "output"),
    [nodes],
  );

  const handleSourceImported = useCallback(
    (result: SourceImportResult) => {
      markDirty();
      const sourceCount = sourceNodes.length;
      const pos = { x: 60 + sourceCount * 220, y: 80 + (sourceCount % 2) * 100 };
      const node = makeNode(result.kind, pos, result.config);
      node.data.label = result.label;
      setNodes((nds) => [...nds, node]);
      setSelectedId(node.id);
      setTab("quality");
    },
    [sourceNodes.length, setNodes, markDirty],
  );

  const handleApplyNormalize = useCallback(
    (options: NormalizeOptions) => {
      markDirty();
      setNodes((nds) =>
        nds.map((n) =>
          n.data.kind.startsWith("source_")
            ? {
                ...n,
                data: {
                  ...n.data,
                  config: { ...n.data.config, normalizeOptions: options, normalized: true },
                },
              }
            : n,
        ),
      );
    },
    [setNodes, markDirty],
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
      const res = await runPipeline(nodes, edges, demo ? undefined : projectId);
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
  }, [nodes, edges, setNodes, demo, projectId]);

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
    <div className="flex h-screen flex-col bg-canvas">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-edge bg-surface px-5 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          {!demo && (
            <Link
              to="/"
              className="flex h-9 w-9 items-center justify-center rounded-brand bg-muted text-ink/70 transition hover:bg-edge hover:text-brand-blue"
              aria-label="Retour aux projets"
            >
              ←
            </Link>
          )}
          <LogoMark className="h-9 w-9" />
          {demo ? (
            <div>
              <h1 className="text-base font-bold text-ink">{title}</h1>
              <p className="text-[11px] text-slate-500">Mode démo — sans compte</p>
            </div>
          ) : (
            <>
              <input
                value={title}
                onChange={(e) => {
                  markDirty();
                  setTitle(e.target.value);
                }}
                className="w-64 truncate rounded-brand border border-transparent bg-transparent px-2 py-1 text-base font-bold text-brand-blue outline-none transition hover:border-edge focus:border-accent focus:bg-muted"
                aria-label="Titre du projet"
              />
              <span
                className={`text-[11px] ${saveState === "error" ? "text-bad" : "text-slate-500"}`}
              >
                {saveLabel}
              </span>
            </>
          )}
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
                : "border-edge bg-muted text-slate-500"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${aiKey ? "bg-good" : "bg-slate-500"}`} />
            Assistant {aiKey ? "OpenAI" : "local"}
          </span>
          <button
            type="button"
            onClick={() => setTab("import")}
            className="flex items-center gap-2 rounded-brand border border-brand-blue-pale bg-brand-blue-pale/50 px-4 py-2 text-sm font-semibold text-brand-blue transition hover:bg-brand-blue-pale"
          >
            <Icon name="import" size={16} />
            Importer
          </button>
          <button
            onClick={run}
            disabled={running}
            className="flex items-center gap-2 rounded-brand bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-hover disabled:opacity-40"
          >
            {running ? (
              "Exécution…"
            ) : (
              <>
                <Icon name="play" size={14} className="text-white" />
                Exécuter
              </>
            )}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Palette */}
        <aside className="w-64 shrink-0 border-r border-edge bg-surface">
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
              if (tab === "ai" || tab === "import") return;
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
            <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#cbd5e1" />
            <Controls />
            <MiniMap
              nodeColor={(n) => SPEC_BY_KIND[(n.data as PipeNodeData).kind]?.color ?? "#3b82f6"}
              maskColor="rgba(248,250,252,0.75)"
              className="!bg-surface"
            />
          </ReactFlow>
          {!hasSourceNode && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
              <div className="max-w-md rounded-2xl border border-primary/20 bg-surface/95 px-8 py-10 text-center shadow-card backdrop-blur-sm">
                <p className="text-3xl">📊</p>
                <h2 className="mt-3 text-lg font-bold text-ink">Commencez par importer vos données</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Étape 1 : <strong className="text-primary">Importer</strong> vos sources · Étape 2 :{" "}
                  <strong className="text-primary">Qualité</strong> (analyse &amp; normalisation) · Étape 3 : parcours &amp;{" "}
                  <strong className="text-primary">Exporter</strong>
                </p>
              </div>
            </div>
          )}

          <div className="pointer-events-none absolute bottom-3 right-3 rounded-lg border border-edge bg-surface/90 px-2.5 py-1 text-[11px] text-slate-500 shadow-sm backdrop-blur">
            Clic droit ou <kbd className="rounded bg-muted px-1 text-ink">Suppr</kbd> pour retirer une étape
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
        <aside className="flex w-[420px] shrink-0 flex-col border-l border-edge bg-surface shadow-lg">
          <WorkflowStepper
            active={tab === "import" || tab === "quality" || tab === "export" ? tab : null}
            onStep={(step) => setTab(step)}
            sourceCount={sourceNodes.length}
          />
          <div className="flex border-b border-edge bg-muted/30">
            {(["config", "preview", "automation", "ai"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex-1 px-2 py-2 text-[10px] font-medium transition ${
                  tab === t ? "border-b-2 border-slate-400 text-ink" : "text-slate-500 hover:text-ink"
                }`}
              >
                {t === "config"
                  ? "Paramètres"
                  : t === "preview"
                    ? "Aperçu"
                    : t === "automation"
                      ? "Automation"
                      : "IA"}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1">
            {tab === "import" && (
              <SourceImportPanel onImported={handleSourceImported} sources={sourceNodes} />
            )}
            {tab === "quality" && (
              <DataQualityPanel sourceNodes={sourceNodes} onApplyNormalize={handleApplyNormalize} />
            )}
            {tab === "export" && (
              <ExportPanel nodes={nodes} edges={edges} hasOutput={hasOutputNode} />
            )}
            {tab === "config" && (
              <ConfigPanel
                node={selectedNode}
                upstreamColumns={upstreamColumns}
                onChange={updateConfig}
                onRename={renameNode}
                onDelete={deleteNode}
                onOpenImport={() => setTab("import")}
              />
            )}
            {tab === "preview" && (
              <>
                {result?.etl && (
                  <div className="border-b border-edge bg-muted/40 px-3 py-2 text-[11px] text-slate-600">
                    Durée {result.etl.durationMs} ms · {result.etl.maxParallel} nœud(s) en parallèle
                    {result.runId && <span className="ml-2 text-primary">Run {result.runId.slice(0, 8)}…</span>}
                  </div>
                )}
                <PreviewPanel preview={activePreview} title={previewTitle} loading={running} />
              </>
            )}
            {tab === "automation" && !demo && (
              <div className="overflow-y-auto p-3">
                <AutomationPanel projectId={projectId} />
              </div>
            )}
            {tab === "automation" && demo && (
              <p className="p-4 text-sm text-slate-500">Automation disponible dans un projet enregistré.</p>
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
      <PipelineEditor key={data.projectId} {...data} />
    </ReactFlowProvider>
  );
}
