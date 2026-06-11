import { useEffect, useState, type FormEvent } from "react";
import {
  createConnection,
  deleteConnection,
  listConnections,
  testConnection,
} from "../api/connections";
import type { Connection } from "../types";
import AIButton from "./AIButton";
import Button from "./ui/Button";
import Input from "./ui/Input";
import Spinner from "./ui/Spinner";

export default function ConnectionsPanel() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("sqlite:///./.data/datapipe.sqlite");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = () =>
    listConnections()
      .then(setConnections)
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await createConnection({ name: name.trim(), connection_url: url.trim(), conn_type: "database" });
      setName("");
      setMsg("Connexion créée.");
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer cette connexion ?")) return;
    await deleteConnection(id);
    load();
  };

  const test = async (id: string) => {
    try {
      const res = await testConnection(id);
      setMsg(res.message);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Test échoué");
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Connexions réutilisables</h2>
          <p className="text-sm text-slate-500">Référentiel de connexions bases de données (Talend Connection Repository)</p>
        </div>
        <AIButton variant="chip" label="Requête SQL" mode="sql" prompt="Requête SQL pour lire une table agricole depuis input" />
      </div>

      <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 max-w-lg">
        <Input label="Nom" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input
          label="URL de connexion"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="postgresql://user:pass@host/db"
          required
        />
        <Button type="submit" disabled={busy}>
          {busy ? "…" : "Ajouter"}
        </Button>
        {msg && <p className="text-sm text-slate-600">{msg}</p>}
      </form>

      {connections.length === 0 ? (
        <p className="text-sm text-slate-500">Aucune connexion enregistrée.</p>
      ) : (
        <ul className="space-y-2">
          {connections.map((c) => (
            <li key={c.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="min-w-0">
                <p className="font-semibold text-slate-800">{c.name}</p>
                <p className="truncate text-xs text-slate-500">{c.connection_url}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button type="button" onClick={() => test(c.id)} className="text-xs text-primary hover:underline">
                  Tester
                </button>
                <button type="button" onClick={() => remove(c.id)} className="text-xs text-red-600 hover:underline">
                  Supprimer
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
