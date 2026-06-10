import { getSupabaseClient } from "../auth-service/config/supabaseClient";

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8000").replace(/\/$/, "");
const BASE = `${BACKEND_URL}/api`;

/** Jeton d'accès courant fourni par la session Supabase (ou null si déconnecté). */
async function getAccessToken(): Promise<string | null> {
  try {
    const supabase = getSupabaseClient();

    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session) return null;

    return session.access_token;
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type Options = {
  method?: string;
  body?: unknown;
  formData?: FormData;
  auth?: boolean;
};

async function request<T>(path: string, opts: Options = {}): Promise<T> {
  const { method = "GET", body, formData, auth = true } = opts;
  const headers: Record<string, string> = {};

  if (auth) {
    const token = await getAccessToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let payload: BodyInit | undefined;
  if (formData) {
    payload = formData;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, "Impossible de joindre le serveur. Vérifie qu'il est démarré.");
  }

  // NB : on ne déconnecte PAS la session Supabase sur un 401 du backend. La
  // session est gérée par Supabase côté front ; un 401 backend signifie
  // seulement que l'API n'a pas (encore) validé le jeton, et ne doit pas
  // renvoyer l'utilisateur vers le landing.

  if (!res.ok) {
    let detail = `Erreur ${res.status}`;
    try {
      const data = await res.json();
      detail = data.detail || detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const apiClient = {
  get: <T>(path: string, auth = true) => request<T>(path, { method: "GET", auth }),
  post: <T>(path: string, body?: unknown, auth = true) =>
    request<T>(path, { method: "POST", body, auth }),
  patch: <T>(path: string, body?: unknown, auth = true) =>
    request<T>(path, { method: "PATCH", body, auth }),
  delete: <T>(path: string, auth = true) => request<T>(path, { method: "DELETE", auth }),
  upload: <T>(path: string, formData: FormData, auth = true) =>
    request<T>(path, { method: "POST", formData, auth }),
};
