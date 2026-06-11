import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import * as adminApi from "../api/admin";
import type { ActivityEntry, OnlineUser, ProjectSummary, Role, User } from "../types";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Modal from "../components/ui/Modal";
import AIButton from "../components/AIButton";
import { BrandHeader } from "../components/brand/Logo";

const PRESENCE_POLL_MS = 4000;

const ACTION_LABELS: Record<string, string> = {
  login: "Connexion",
  logout: "Déconnexion",
  login_failed: "Échec connexion",
  login_blocked: "Connexion bloquée",
  login_denied: "Accès admin refusé",
  user_created: "Compte créé",
  user_updated: "Compte modifié",
  user_deleted: "Compte supprimé",
  project_created: "Projet créé",
  project_deleted: "Projet supprimé",
  pipeline_run: "Pipeline exécuté",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "medium" });
}

export default function AdminDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [presenceWindowSec, setPresenceWindowSec] = useState(90);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);

  const loadPresence = useCallback(async () => {
    try {
      const snap = await adminApi.getPresence();
      setUsers(snap.users);
      setOnlineUsers(snap.online_users);
      setActivity(snap.activity);
      setPresenceWindowSec(snap.window_seconds);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement de la présence.");
    }
  }, []);

  const loadProjects = useCallback(async () => {
    try {
      setProjects(await adminApi.getAllProjects());
    } catch {
      /* silencieux */
    }
  }, []);

  useEffect(() => {
    Promise.all([loadPresence(), loadProjects()]).finally(() => setLoading(false));
  }, [loadPresence, loadProjects]);

  // Temps réel : présence + journal en un seul appel.
  useEffect(() => {
    const id = setInterval(loadPresence, PRESENCE_POLL_MS);
    return () => clearInterval(id);
  }, [loadPresence]);

  const removeProject = async (id: string, title: string) => {
    if (!confirm(`Supprimer le projet « ${title} » ?`)) return;
    try {
      await adminApi.deleteAnyProject(id);
      loadProjects();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de la suppression du projet.");
    }
  };

  const onlineCount = onlineUsers.length;

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="flex items-center justify-between border-b border-edge bg-surface px-6 py-3 shadow-sm">
        <div className="flex items-center gap-4">
          <BrandHeader />
          <span className="hidden rounded-full bg-brand-blue-pale px-2.5 py-0.5 text-[11px] font-semibold text-brand-blue sm:inline">
            Administration · {user?.username}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <AIButton variant="ghost" label="Assistant IA" prompt="Aide admin : résumer l'activité des pipelines agricoles" />
          <Link
            to="/"
            className="rounded-brand border border-edge px-3 py-2 text-sm text-ink/70 transition hover:bg-muted"
          >
            Mon espace
          </Link>
          <button
            onClick={() => signOut()}
            className="rounded-brand border border-bad/30 px-3 py-2 text-sm text-bad transition hover:bg-red-50"
          >
            Déconnexion
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-6">
        {error && (
          <div className="mb-4 rounded-lg border border-bad/40 bg-bad/10 px-4 py-2 text-sm text-bad">
            {error}
          </div>
        )}

        {/* Indicateurs */}
        <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Comptes" value={users.length} />
          <StatCard label="Administrateurs" value={users.filter((u) => u.role === "admin").length} />
          <StatCard label="Projets (org.)" value={projects.length} />
          <StatCard label="Connectés maintenant" value={onlineCount} accent />
        </div>

        <div className="mb-6 rounded-xl border border-edge bg-panel px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">Sessions actives</h2>
            <span className="text-[10px] text-slate-500">
              heartbeat {presenceWindowSec}s · maj. toutes les {PRESENCE_POLL_MS / 1000}s
            </span>
          </div>
          {onlineUsers.length === 0 ? (
            <p className="text-sm text-slate-500">Personne n'est connecté pour le moment.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {onlineUsers.map((u) => (
                <span
                  key={u.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-good/30 bg-good/10 px-3 py-1 text-[12px] text-good"
                >
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-good" />
                  {u.full_name || u.username}
                  <span className="text-[10px] text-good/70">@{u.username}</span>
                </span>
              ))}
            </div>
          )}
          <p className="mt-2 text-[11px] text-slate-500">
            <strong className="font-semibold text-slate-400">Compte</strong> = activé ou désactivé par l'admin.
            {" "}
            <strong className="font-semibold text-slate-400">Connexion</strong> = session ouverte en ce moment
            (heartbeat + dernière action login).
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Comptes */}
          <section className="lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-100">Comptes utilisateurs</h2>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                + Nouveau compte
              </Button>
            </div>
            <div className="overflow-hidden rounded-xl border border-edge">
              <table className="w-full text-left text-sm">
                <thead className="bg-panel2 text-xs text-slate-400">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Utilisateur</th>
                    <th className="px-4 py-2.5 font-semibold">Connexion</th>
                    <th className="px-4 py-2.5 font-semibold">Rôle</th>
                    <th className="px-4 py-2.5 font-semibold">Compte</th>
                    <th className="px-4 py-2.5 font-semibold">Dernière connexion</th>
                    <th className="px-4 py-2.5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                        Chargement…
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id} className="border-t border-edge/60">
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-slate-100">{u.full_name || u.username}</div>
                          <div className="text-[11px] text-slate-500">@{u.username}</div>
                        </td>
                        <td className="px-4 py-2.5">
                          {u.is_online ? (
                            <span className="flex items-center gap-1.5 text-[12px] text-good">
                              <span className="h-2 w-2 animate-pulse rounded-full bg-good" /> Connecté
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-[12px] text-slate-500">
                              <span className="h-2 w-2 rounded-full bg-slate-600" /> Déconnecté
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              u.role === "admin"
                                ? "bg-accent/15 text-accent"
                                : "bg-slate-500/15 text-slate-300"
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={u.is_active ? "text-slate-300" : "text-bad"}>
                            {u.is_active ? "Activé" : "Désactivé"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-[12px] text-slate-400">
                          {u.last_login_at ? formatDate(u.last_login_at) : "Jamais"}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => setEditUser(u)}
                            className="rounded px-2 py-1 text-xs text-accent transition hover:bg-accent/10"
                          >
                            Gérer
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Journal temps réel */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-100">Activité en temps réel</h2>
              <span className="flex items-center gap-1.5 text-[11px] text-good">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-good" /> live
              </span>
            </div>
            <div className="max-h-[60vh] overflow-auto rounded-xl border border-edge bg-panel">
              {activity.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-slate-500">Aucune activité.</p>
              ) : (
                <ul className="divide-y divide-edge/60">
                  {activity.map((a) => (
                    <li key={a.id} className="px-4 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-200">
                          {ACTION_LABELS[a.action] ?? a.action}
                        </span>
                        <span className="text-[10px] text-slate-500">{formatDate(a.createdAt)}</span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {a.email ?? "—"}
                        {a.detail ? ` · ${a.detail}` : ""}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        {/* Tous les projets de l'organisation */}
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-bold text-slate-100">Projets de l'organisation</h2>
          <div className="overflow-hidden rounded-xl border border-edge">
            <table className="w-full text-left text-sm">
              <thead className="bg-panel2 text-xs text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Projet</th>
                  <th className="px-4 py-2.5 font-semibold">Propriétaire</th>
                  <th className="px-4 py-2.5 font-semibold">Modifié le</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                      Aucun projet pour le moment.
                    </td>
                  </tr>
                ) : (
                  projects.map((p) => (
                    <tr key={p.id} className="border-t border-edge/60">
                      <td className="px-4 py-2.5 font-medium text-slate-100">{p.title}</td>
                      <td className="px-4 py-2.5 text-slate-300">
                        {p.owner_name || p.owner_username}
                        <span className="ml-1 text-[11px] text-slate-500">@{p.owner_username}</span>
                      </td>
                      <td className="px-4 py-2.5 text-[12px] text-slate-400">{formatDate(p.updated_at)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => navigate(`/projets/${p.id}`)}
                          className="rounded px-2 py-1 text-xs text-accent transition hover:bg-accent/10"
                        >
                          Ouvrir
                        </button>
                        <button
                          onClick={() => removeProject(p.id, p.title)}
                          className="rounded px-2 py-1 text-xs text-bad transition hover:bg-bad/10"
                        >
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {createOpen && (
        <CreateUserModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            loadPresence();
          }}
        />
      )}
      {editUser && (
        <EditUserModal
          target={editUser}
          selfId={user?.id ?? ""}
          onClose={() => setEditUser(null)}
          onChanged={() => {
            setEditUser(null);
            loadPresence();
          }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-edge bg-panel px-4 py-3">
      <div className={`text-2xl font-black ${accent ? "text-accent" : "text-slate-100"}`}>{value}</div>
      <div className="text-[11px] text-slate-500">{label}</div>
    </div>
  );
}

function CreateUserModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({ username: "", password: "", full_name: "", role: "user" as Role });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      await adminApi.createUser({
        username: form.username.trim(),
        password: form.password,
        role: form.role,
        full_name: form.full_name.trim() || undefined,
      });
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Échec de la création.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Créer un compte"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Annuler
          </Button>
          <Button size="sm" onClick={submit} disabled={busy || form.username.trim().length < 3 || form.password.length < 6}>
            {busy ? "Création…" : "Créer"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Input label="Nom d'utilisateur (min. 3)" type="text" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        <Input label="Nom complet" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        <Input label="Mot de passe (min. 6)" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-400">Rôle</label>
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
            className="rounded-lg border border-edge bg-ink px-3 py-2 text-sm text-slate-100 outline-none focus:border-accent"
          >
            <option value="user">Utilisateur</option>
            <option value="admin">Administrateur</option>
          </select>
        </div>
        {err && <p className="text-xs text-bad">{err}</p>}
      </div>
    </Modal>
  );
}

function EditUserModal({
  target,
  selfId,
  onClose,
  onChanged,
}: {
  target: User;
  selfId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [form, setForm] = useState({
    username: target.username,
    full_name: target.full_name ?? "",
    role: target.role,
    password: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const isSelf = target.id === selfId;

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await adminApi.updateUser(target.id, {
        username: form.username.trim() !== target.username ? form.username.trim() : undefined,
        full_name: form.full_name.trim(),
        role: form.role,
        password: form.password ? form.password : undefined,
      });
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Échec de la mise à jour.");
      setBusy(false);
    }
  };

  const toggleActive = async () => {
    setBusy(true);
    setErr(null);
    try {
      await adminApi.updateUser(target.id, { is_active: !target.is_active });
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Échec.");
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Supprimer définitivement le compte ${target.username} ?`)) return;
    setBusy(true);
    setErr(null);
    try {
      await adminApi.deleteUser(target.id);
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Échec de la suppression.");
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Gérer @${target.username}`}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Fermer
          </Button>
          <Button size="sm" onClick={save} disabled={busy}>
            {busy ? "…" : "Enregistrer"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Input label="Nom d'utilisateur" type="text" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        <Input label="Nom complet" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        <Input
          label="Réinitialiser le mot de passe (laisser vide pour ne pas changer)"
          type="text"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-400">Rôle</label>
          <select
            value={form.role}
            disabled={isSelf}
            onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
            className="rounded-lg border border-edge bg-ink px-3 py-2 text-sm text-slate-100 outline-none focus:border-accent disabled:opacity-50"
          >
            <option value="user">Utilisateur</option>
            <option value="admin">Administrateur</option>
          </select>
        </div>

        {err && <p className="text-xs text-bad">{err}</p>}

        {!isSelf && (
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-edge pt-3">
            <Button variant="secondary" size="sm" onClick={toggleActive} disabled={busy}>
              {target.is_active ? "Désactiver" : "Activer"}
            </Button>
            <Button variant="danger" size="sm" onClick={remove} disabled={busy}>
              Supprimer
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
