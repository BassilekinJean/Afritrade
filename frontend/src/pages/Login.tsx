import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || "Connexion impossible.");
    } finally {
      setBusy(false);
    }
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
          <h1 className="mb-1 text-xl font-bold text-slate-100">Connexion</h1>
          <p className="mb-5 text-sm text-slate-500">Accède à tes projets DataPipe.</p>

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
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className="text-xs text-bad">{error}</p>}
            <Button type="submit" disabled={busy} className="mt-1 w-full">
              {busy ? "Connexion…" : "Se connecter"}
            </Button>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-slate-500">
          Pas encore de compte ?{" "}
          <Link to="/signup" className="font-semibold text-accent hover:underline">
            S'inscrire
          </Link>
        </p>
      </div>
    </div>
  );
}
