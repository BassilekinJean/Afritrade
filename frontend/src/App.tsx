import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth, ProtectedRoute } from "./auth-service";
import Spinner from "./components/ui/Spinner";

const RouteSpinner = (
  <div className="flex h-screen items-center justify-center bg-ink">
    <Spinner />
  </div>
);
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ProjectEditor from "./pages/ProjectEditor";
import NotFound from "./pages/NotFound";

function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-ink">
        <Spinner />
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <Login />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicOnlyRoute>
            <Signup />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/projets/:idProjet"
        element={
          <ProtectedRoute redirectTo="/login" fallback={RouteSpinner}>
            <ProjectEditor />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
