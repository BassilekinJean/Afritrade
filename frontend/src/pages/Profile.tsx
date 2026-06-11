import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { changePassword } from "../api/auth";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import AIButton from "../components/AIButton";
import { BrandHeader } from "../components/brand/Logo";

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

export default function Profile() {
  const { user } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (next.length < 6) {
      setMsg({ type: "err", text: "Le nouveau mot de passe doit faire au moins 6 caractères." });
      return;
    }
    if (next !== confirm) {
      setMsg({ type: "err", text: "La confirmation ne correspond pas." });
      return;
    }
    setBusy(true);
    try {
      await changePassword(current, next);
      setMsg({ type: "ok", text: "Mot de passe modifié avec succès." });
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Échec de la modification." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="flex items-center justify-between border-b border-edge bg-surface px-6 py-3 shadow-sm">
        <BrandHeader />
        <div className="flex items-center gap-2">
          <AIButton variant="ghost" label="Assistant IA" prompt="Comment utiliser Aaprovidir DataPipe pour mes données agricoles ?" />
          <Link
            to="/"
            className="rounded-brand border border-edge px-3 py-2 text-sm text-ink/70 transition hover:bg-muted"
          >
            ← Retour
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-8">
        <section className="mb-6 brand-panel p-5">
          <h2 className="mb-4 text-sm font-bold text-brand-blue">Informations</h2>
          <dl className="grid grid-cols-2 gap-y-3 text-sm">
            <dt className="text-ink/50">Nom</dt>
            <dd>{user?.full_name || "—"}</dd>
            <dt className="text-ink/50">Nom d'utilisateur</dt>
            <dd>@{user?.username}</dd>
            <dt className="text-ink/50">Rôle</dt>
            <dd>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${user?.role === "admin" ? "bg-brand-cyan-pale text-accent" : "bg-muted text-ink/70"}`}>
                {user?.role}
              </span>
            </dd>
            <dt className="text-ink/50">Dernière connexion</dt>
            <dd>{formatDate(user?.last_login_at)}</dd>
          </dl>
        </section>

        <section className="brand-panel p-5">
          <h2 className="mb-4 text-sm font-bold text-brand-blue">Changer mon mot de passe</h2>
          <form onSubmit={submit} className="flex max-w-sm flex-col gap-3">
            <Input label="Mot de passe actuel" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
            <Input label="Nouveau mot de passe" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
            <Input label="Confirmer le nouveau mot de passe" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            {msg && (
              <p className={`text-xs ${msg.type === "ok" ? "text-good" : "text-bad"}`}>{msg.text}</p>
            )}
            <Button type="submit" disabled={busy || !current || !next} className="mt-1">
              {busy ? "Modification…" : "Modifier le mot de passe"}
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
