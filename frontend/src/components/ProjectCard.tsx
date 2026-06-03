import { formatRelative } from "../lib/format";
import type { ProjectSummary } from "../types";

interface ProjectCardProps {
  project: ProjectSummary;
  onOpen: () => void;
  onMenu: (x: number, y: number) => void;
}

export default function ProjectCard({ project, onOpen, onMenu }: ProjectCardProps) {
  const openMenuFromButton = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    onMenu(rect.right, rect.bottom + 4);
  };

  return (
    <div
      onClick={onOpen}
      onContextMenu={(e) => {
        e.preventDefault();
        onMenu(e.clientX, e.clientY);
      }}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-xl border border-edge bg-panel transition hover:border-accent/60 hover:shadow-lg hover:shadow-accent/5"
    >
      {/* Vignette */}
      <div className="relative flex h-36 items-center justify-center bg-gradient-to-br from-panel2 to-ink">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent2 text-2xl font-black text-ink">
          ⇄
        </div>
        <button
          onClick={openMenuFromButton}
          aria-label="Options du projet"
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-md bg-ink/70 text-slate-300 opacity-0 transition hover:bg-ink hover:text-slate-100 group-hover:opacity-100"
        >
          ⋯
        </button>
      </div>
      {/* Infos */}
      <div className="flex flex-col gap-0.5 border-t border-edge px-3.5 py-3">
        <h3 className="truncate text-sm font-semibold text-slate-100">{project.title}</h3>
        <p className="text-[11px] text-slate-500">Modifié {formatRelative(project.updated_at)}</p>
      </div>
    </div>
  );
}
