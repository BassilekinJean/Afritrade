import { useAuth } from "../auth-service";
import Landing from "./Landing";
import Projects from "./Projects";
import Spinner from "../components/ui/Spinner";

export default function Home() {
  const { user, loading } = useAuth();

  // État de chargement
  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-50 gap-4">
        <Spinner className="text-indigo-600 h-8 w-8" />
        <p className="text-sm text-slate-400 animate-pulse">Chargement de votre espace...</p>
      </div>
    );
  }

  // Utilisateur authentifié → Dashboard ETL
  if (user) {
    return <Projects />;
  }

  // Visiteur → Landing page publique
  return <Landing />;
}