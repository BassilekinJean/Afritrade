import { Link } from "react-router-dom";
import Button from "../components/ui/Button";

export default function Landing() {
  return (
    <div className="flex min-h-screen flex-col bg-ink text-slate-100">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent2 text-lg font-black text-ink">
            ⇄
          </div>
          <span className="text-lg font-bold">DataPipe</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/login">
            <Button variant="ghost">Se connecter</Button>
          </Link>
          <Link to="/signup">
            <Button>S'inscrire</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <span className="mb-4 rounded-full border border-edge bg-panel px-3 py-1 text-xs text-accent">
          ETL visuel pour pipelines bancaires
        </span>
        <h1 className="max-w-3xl text-4xl font-black leading-tight sm:text-5xl">
          Construis tes pipelines de données{" "}
          <span className="bg-gradient-to-r from-accent to-accent2 bg-clip-text text-transparent">
            sans écrire de code
          </span>
        </h1>
        <p className="mt-5 max-w-xl text-base text-slate-400">
          Connecte tes sources CSV, JSON et SQL, enchaîne des transformations visuelles et
          prévisualise chaque étape. Augmenté par un assistant IA.
        </p>
        <div className="mt-8 flex items-center gap-3">
          <Link to="/signup">
            <Button className="px-6 py-3 text-base">Commencer gratuitement</Button>
          </Link>
          <Link to="/login">
            <Button variant="secondary" className="px-6 py-3 text-base">
              J'ai déjà un compte
            </Button>
          </Link>
        </div>
      </main>

      <footer className="px-6 py-5 text-center text-xs text-slate-600">
        DataPipe — ETL visuel pour le secteur financier africain
      </footer>
    </div>
  );
}
