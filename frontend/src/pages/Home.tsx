import { useAuth } from "../auth-service";
import Landing from "./Landing";
import Projects from "./Projects";
import Spinner from "../components/ui/Spinner";

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-ink">
        <Spinner />
      </div>
    );
  }

  return user ? <Projects /> : <Landing />;
}
