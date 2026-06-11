import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as authApi from "../api/auth";
import { getToken, setToken } from "../lib/apiClient";
import type { Role, User } from "../types";

interface AuthResult {
  error: string | null;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (credentials: { username: string; password: string; asRole?: Role }) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Au démarrage : si un jeton existe, on récupère le profil courant.
  useEffect(() => {
    let active = true;
    if (!getToken()) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then((u) => active && setUser(u))
      .catch(() => {
        setToken(null);
        if (active) setUser(null);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  // Heartbeat : tant qu'un utilisateur est connecté, on ping /me régulièrement
  // pour maintenir la présence « en ligne » côté serveur (last_seen_at).
  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => {
      authApi.me().catch(() => {
        /* en cas d'échec (jeton expiré), le 401 purge déjà la session */
      });
    }, 30000);
    return () => clearInterval(id);
  }, [user]);

  const signIn = useCallback(
    async ({ username, password, asRole }: { username: string; password: string; asRole?: Role }): Promise<AuthResult> => {
      try {
        const res = await authApi.login(username, password, asRole);
        setToken(res.token);
        setUser(res.user);
        return { error: null };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Échec de la connexion." };
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* on déconnecte localement quoi qu'il arrive */
    }
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, isAdmin: user?.role === "admin", signIn, signOut }),
    [user, loading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans un <AuthProvider>.");
  return ctx;
}
