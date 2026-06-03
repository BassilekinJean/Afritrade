import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth-service";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";

export default function Signup() {
  const { signUp } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    const { error } = await signUp({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      setError(error);
      return;
    }
    // Si la confirmation d'email est désactivée, une session est ouverte et la
    // redirection vers "/" se fait automatiquement (PublicOnlyRoute). Sinon, on
    // invite l'utilisateur à confirmer son adresse.
    setSuccess("Inscription réussie. Vérifiez votre email pour activer votre compte.");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent2 text-lg font-black text-ink">
            ⇄
          </div>
          <span className="text-lg font-bold text-slate-100">DataPipe</span>
        </Link>

        <div className="rounded-xl border border-edge bg-panel p-6">
          <h1 className="mb-1 text-xl font-bold text-slate-100">Créer un compte</h1>
          <p className="mb-5 text-sm text-slate-500">Commence à construire tes pipelines.</p>

          <form onSubmit={submit} className="flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label="Mot de passe"
              type="password"
              name="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Input
              label="Confirmer le mot de passe"
              type="password"
              name="confirm"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {error && <p className="text-xs text-bad">{error}</p>}
            {success && <p className="text-xs text-good">{success}</p>}
            <Button type="submit" disabled={busy} className="mt-1 w-full">
              {busy ? "Création…" : "S'inscrire"}
            </Button>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-slate-500">
          Déjà un compte ?{" "}
          <Link to="/login" className="font-semibold text-accent hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
