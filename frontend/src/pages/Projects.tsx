import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import {
  createProject,
  deleteProject,
  listProjects,
  updateProject,
} from "../api/projects";
import type { ProjectSummary } from "../types";
import ProjectCard from "../components/ProjectCard";
import CreateProjectModal from "../components/CreateProjectModal";
import RenameProjectModal from "../components/RenameProjectModal";
import ConfirmDeleteDialog from "../components/ConfirmDeleteDialog";
import ContextMenu from "../components/ui/ContextMenu";
import Button from "../components/ui/Button";
import Spinner from "../components/ui/Spinner";

interface MenuState {
  project: ProjectSummary;
  x: number;
  y: number;
}

export default function Projects() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [renaming, setRenaming] = useState<ProjectSummary | null>(null);
  const [deleting, setDeleting] = useState<ProjectSummary | null>(null);
  const [userMenu, setUserMenu] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setProjects(await listProjects());
    } catch (e: any) {
      setError(e.message || "Impossible de charger les projets.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (title: string) => {
    const project = await createProject(title);
    navigate(`/projets/${project.id}`);
  };

  const handleRename = async (title: string) => {
    if (!renaming) return;
    await updateProject(renaming.id, { title });
    setProjects((ps) =>
      ps.map((p) => (p.id === renaming.id ? { ...p, title, updated_at: new Date().toISOString() } : p))
    );
  };

  const handleDelete = async () => {
    if (!deleting) return;
    await deleteProject(deleting.id);
    setProjects((ps) => ps.filter((p) => p.id !== deleting.id));
  };

  return (
    <div className="min-h-screen bg-ink text-slate-100">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-edge bg-panel px-6 py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent2 text-lg font-black text-ink">
            ⇄
          </div>
          <span className="text-base font-bold">DataPipe</span>
        </div>
        <div className="relative">
          <button
            onClick={() => setUserMenu((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-panel2 text-sm font-bold text-accent ring-1 ring-edge transition hover:ring-accent"
            aria-label="Menu utilisateur"
          >
            {user?.email?.[0]?.toUpperCase() ?? "?"}
          </button>
          {userMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setUserMenu(false)} />
              <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-lg border border-edge bg-panel py-1 shadow-2xl">
                <div className="truncate border-b border-edge px-3 py-2 text-xs text-slate-400">
                  {user?.email}
                </div>
                <button
                  onClick={logout}
                  className="w-full px-3 py-2 text-left text-sm text-bad transition hover:bg-panel2"
                >
                  Se déconnecter
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Mes projets</h1>
            <p className="text-sm text-slate-500">
              {projects.length} projet{projects.length > 1 ? "s" : ""}
            </p>
          </div>
          <Button onClick={() => setCreating(true)}>+ Nouveau projet</Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-bad/30 bg-bad/10 px-4 py-3 text-sm text-bad">
            {error}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-edge py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-panel2 text-2xl">
              ⇄
            </div>
            <div>
              <p className="font-semibold text-slate-200">Aucun projet pour l'instant</p>
              <p className="text-sm text-slate-500">Crée ton premier pipeline pour commencer.</p>
            </div>
            <Button onClick={() => setCreating(true)}>+ Nouveau projet</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {projects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onOpen={() => navigate(`/projets/${p.id}`)}
                onMenu={(x, y) => setMenu({ project: p, x, y })}
              />
            ))}
          </div>
        )}
      </main>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            {
              label: "Ouvrir",
              onClick: () => navigate(`/projets/${menu.project.id}`),
            },
            {
              label: "Renommer",
              onClick: () => setRenaming(menu.project),
            },
            {
              label: "Supprimer",
              danger: true,
              onClick: () => setDeleting(menu.project),
            },
          ]}
        />
      )}

      <CreateProjectModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={handleCreate}
      />

      <RenameProjectModal
        open={!!renaming}
        currentTitle={renaming?.title ?? ""}
        onClose={() => setRenaming(null)}
        onRename={handleRename}
      />

      <ConfirmDeleteDialog
        open={!!deleting}
        projectTitle={deleting?.title ?? ""}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
