import { useEffect, useState } from "react";
import {
  createSchedule,
  createWebhook,
  deleteSchedule,
  deleteWebhook,
  listSchedules,
  listWebhooks,
  toggleWebhook,
} from "../api/automation";
import { listProjects } from "../api/projects";
import type { ProjectSummary, Schedule, Webhook } from "../types";
import Button from "./ui/Button";
import Input from "./ui/Input";
import Spinner from "./ui/Spinner";

export default function AutomationPanel({ projectId }: { projectId?: string }) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [selectedProject, setSelectedProject] = useState(projectId || "");
  const [cron, setCron] = useState("0 8 * * *");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    const [ps, sc, wh] = await Promise.all([
      listProjects(),
      listSchedules(projectId),
      listWebhooks(projectId),
    ]);
    setProjects(ps);
    setSchedules(sc);
    setWebhooks(wh);
    if (!selectedProject && ps[0]) setSelectedProject(ps[0].id);
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [projectId]);

  const addSchedule = async () => {
    const pid = projectId || selectedProject;
    if (!pid) return;
    try {
      await createSchedule(pid, cron);
      setMsg("Planification créée.");
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erreur");
    }
  };

  const addWebhook = async () => {
    const pid = projectId || selectedProject;
    if (!pid) return;
    try {
      const wh = await createWebhook(pid);
      setMsg(`Webhook créé : ${wh.webhook_url}`);
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erreur");
    }
  };

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-sm">
      <div>
        <h3 className="font-bold text-ink">Automation (n8n)</h3>
        <p className="text-xs text-slate-500">Planification cron et webhooks entrants</p>
      </div>

      {!projectId && (
        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          className="w-full rounded-lg border border-edge px-3 py-2"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
      )}

      <div className="space-y-2 rounded-xl border border-edge bg-muted/30 p-3">
        <p className="font-semibold text-ink">Planification cron</p>
        <Input label="Expression" value={cron} onChange={(e) => setCron(e.target.value)} />
        <Button type="button" onClick={addSchedule}>Ajouter</Button>
        <ul className="space-y-1">
          {schedules.map((s) => (
            <li key={s.id} className="flex justify-between rounded bg-surface px-2 py-1">
              <span className="font-mono text-xs">{s.cron_expression}</span>
              <button type="button" className="text-bad text-xs" onClick={() => deleteSchedule(s.id).then(load)}>
                Supprimer
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2 rounded-xl border border-edge bg-muted/30 p-3">
        <p className="font-semibold text-ink">Webhooks</p>
        <Button type="button" onClick={addWebhook}>Générer un webhook</Button>
        <ul className="space-y-2">
          {webhooks.map((w) => (
            <li key={w.id} className="rounded bg-surface p-2">
              <p className="break-all font-mono text-[10px] text-slate-600">{w.webhook_url}</p>
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  className="text-xs text-primary"
                  onClick={() => toggleWebhook(w.id, !w.enabled).then(load)}
                >
                  {w.enabled ? "Désactiver" : "Activer"}
                </button>
                <button type="button" className="text-xs text-bad" onClick={() => deleteWebhook(w.id).then(load)}>
                  Supprimer
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {msg && <p className="text-xs text-slate-600">{msg}</p>}
    </div>
  );
}
