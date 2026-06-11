import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth, ProtectedRoute } from "./auth";
import Login from "./pages/Login";
import Projects from "./pages/Projects";
import Profile from "./pages/Profile";
import AdminDashboard from "./pages/AdminDashboard";
import DemoEditor from "./pages/DemoEditor";
import ProjectEditor from "./pages/ProjectEditor";
import NotFound from "./pages/NotFound";
import Spinner from "./components/ui/Spinner";

function LoginRoute() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-brand-blue">
        <Spinner />
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;
  return <Login />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/demo" element={<DemoEditor />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Projects />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profil"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute requireAdmin>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projets/:idProjet"
        element={
          <ProtectedRoute>
            <ProjectEditor />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
