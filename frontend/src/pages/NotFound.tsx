import { Link } from "react-router-dom";
import Button from "../components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink px-4 text-center">
      <p className="text-6xl font-black text-accent">404</p>
      <h1 className="text-xl font-bold text-slate-100">Page introuvable</h1>
      <p className="max-w-md text-sm text-slate-500">
        La page que tu cherches n'existe pas ou a été déplacée.
      </p>
      <Link to="/">
        <Button>Retour à l'accueil</Button>
      </Link>
    </div>
  );
}
