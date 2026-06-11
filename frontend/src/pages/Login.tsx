import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import type { Role } from "../types";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import { BrandHeader } from "../components/brand/Logo";
import { tagline } from "../lib/brand";

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Role>("user");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await signIn({ username: username.trim(), password, asRole: mode });
    setBusy(false);
    if (error) {
      setError(error);
      return;
    }
    navigate(mode === "admin" ? "/admin" : "/", { replace: true });
  };

  return (
    <div className="flex min-h-screen">
      {/* Panneau marque */}
      <aside className="relative hidden overflow-hidden lg:flex lg:w-[44%] flex-col justify-between bg-brand-blue p-10 text-white">
        {/* Fond : dégradés palette + logo Aaprovidir en filigrane */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute -left-16 top-1/4 h-72 w-72 rounded-full bg-brand-cyan/15 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-brand-yellow/10 blur-3xl" />
          <div className="absolute inset-0 bg-gradient-to-br from-brand-blue via-brand-blue to-[#0a2344]" />
          <img
            src="/brand/logo-icon-white.png"
            alt=""
            className="absolute left-1/2 top-1/2 h-[min(85vw,480px)] w-[min(85vw,480px)] max-w-none -translate-x-1/2 -translate-y-1/2 select-none opacity-[0.09]"
          />
        </div>

        <div className="relative z-10">
          <BrandHeader dark />
        </div>
        <div className="relative z-10 max-w-md space-y-6">
          <p className="brand-kicker text-brand-cyan-pale">{tagline}</p>
          <h2 className="text-3xl font-bold leading-tight text-white">
            L'intelligence au service de la terre.
          </h2>
          <p className="text-sm leading-relaxed text-white/75">
            Préparez, transformez et fiabilisez vos données agricoles avec un
            pipeline visuel professionnel — traçabilité, qualité et export en un seul parcours.
          </p>
          <ul className="space-y-3 text-sm text-white/80">
            <li className="flex gap-2"><span className="text-brand-yellow">●</span> ETL visuel multi-sources</li>
            <li className="flex gap-2"><span className="text-brand-cyan">●</span> Qualité & validation métier</li>
            <li className="flex gap-2"><span className="text-brand-green-pale">●</span> Webhooks & planification</li>
          </ul>
        </div>
        <p className="relative z-10 text-xs text-white/40">© Aaprovidir — Usage interne et partenaires agréés</p>
      </aside>

      {/* Formulaire */}
      <main className="flex flex-1 items-center justify-center bg-canvas px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <BrandHeader />
          </div>

          <div className="brand-panel p-6 sm:p-8">
            <div className="mb-6 grid grid-cols-2 gap-1 rounded-brand bg-muted p-1">
              {(["user", "admin"] as Role[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => { setMode(r); setError(null); }}
                  className={`rounded-brand px-3 py-2.5 text-sm font-semibold transition ${
                    mode === r
                      ? "bg-surface text-brand-blue shadow-sm ring-1 ring-edge"
                      : "text-ink/60 hover:text-ink"
                  }`}
                >
                  {r === "admin" ? "Administrateur" : "Utilisateur"}
                </button>
              ))}
            </div>

            <p className="brand-kicker mb-1">Connexion sécurisée</p>
            <h1 className="brand-heading mb-1 text-xl">
              {mode === "admin" ? "Espace administration" : "Accéder à DataPipe"}
            </h1>
            <p className="mb-6 text-sm text-ink/70">
              {mode === "admin"
                ? "Supervisez les comptes et l'activité de la plateforme."
                : "Retrouvez vos projets de traitement de données."}
            </p>

            <form onSubmit={submit} className="flex flex-col gap-4">
              <Input
                label="Nom d'utilisateur"
                type="text"
                name="username"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
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
              {error && (
                <p className="rounded-brand border border-bad/20 bg-red-50 px-3 py-2 text-xs text-bad">{error}</p>
              )}
              <Button type="submit" disabled={busy} className="mt-1 w-full">
                {busy ? "Connexion…" : "Se connecter"}
              </Button>
            </form>
          </div>

          <p className="mt-5 text-center text-xs text-ink/50">
            Pas encore de compte ? Demandez un accès à votre administrateur.
          </p>
        </div>
      </main>
    </div>
  );
}
