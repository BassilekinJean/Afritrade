/**
 * Client HTTP de DataPipe — authentification par JWT local (sans Supabase).
 *
 * Le jeton renvoyé par /api/auth/login est conservé en localStorage et envoyé
 * dans l'en-tête Authorization de chaque requête authentifiée.
 */

const TOKEN_KEY = "datapipe_token";

// En dev sans VITE_BACKEND_URL : on passe par le proxy Vite (/api → :8000).
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, "");
const BASE = BACKEND_URL ? `${BACKEND_URL}/api` : "/api";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function parseApiDetail(detail: unknown, fallback: string): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((x) => (typeof x === "object" && x && "msg" in x ? String((x as { msg: string }).msg) : ""))
      .filter(Boolean);
    if (msgs.length) return msgs.join(", ");
  }
  return fallback;
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
    const token = getToken();
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

  // Jeton invalide/expiré : on purge la session locale.
  if (res.status === 401) {
    setToken(null);
  }

  if (!res.ok) {
    let detail = `Erreur ${res.status}`;
    try {
      const data = await res.json();
      detail = parseApiDetail(data.detail, detail);
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

async function download(path: string, body: unknown, auth = true): Promise<{ blob: Blob; filename: string }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  if (res.status === 401) setToken(null);
  if (!res.ok) {
    let detail = `Erreur ${res.status}`;
    try {
      const data = await res.json();
      detail = parseApiDetail(data.detail, detail);
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail);
  }
  const disp = res.headers.get("Content-Disposition") || "";
  const match = /filename="?([^"]+)"?/.exec(disp);
  const filename = match?.[1] || "export.dat";
  return { blob: await res.blob(), filename };
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
  download,
};
