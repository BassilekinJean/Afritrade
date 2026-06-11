import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { getWelcome } from "../api/conductor";
import type { WelcomePayload } from "../types";
import Spinner from "./ui/Spinner";

export default function WelcomeModal() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [data, setData] = useState<WelcomePayload | null>(null);
  const welcomedUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      welcomedUserRef.current = null;
      setOpen(false);
      setData(null);
      return;
    }

    // Déjà accueilli pour cette session connectée (même user.id)
    if (welcomedUserRef.current === user.id) return;

    welcomedUserRef.current = user.id;
    setOpen(true);
    setFetching(true);
    setData(null);

    let cancelled = false;
    getWelcome()
      .then((w) => {
        if (cancelled) return;
        setData(w);
      })
      .catch(() => {
        if (cancelled) return;
        setData({
          greeting: `Bonjour **${user.full_name || user.username}** !`,
          summary: "Bienvenue sur Aaprovidir DataPipe.",
          suggestedAction: "Importez une source de données — le conducteur IA construira votre pipeline avec vous.",
          lastProject: null,
          continueUrl: null,
          projectCount: 0,
        });
      })
      .finally(() => {
        if (!cancelled) setFetching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-blue/30 backdrop-blur-sm" aria-hidden />
      <div
        className="relative w-full max-w-lg rounded-2xl border border-edge bg-surface p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">Assistant Aaprovidir</p>

        {fetching || !data ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <Spinner />
            <p className="text-sm text-slate-600">Préparation de votre accueil…</p>
          </div>
        ) : (
          <>
            <h2
              id="welcome-title"
              className="mt-2 text-xl font-bold text-slate-900"
              dangerouslySetInnerHTML={{
                __html: data.greeting.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"),
              }}
            />

            <div className="mt-4 max-h-48 overflow-y-auto rounded-xl bg-muted/50 p-4 text-sm text-slate-700 whitespace-pre-line">
              {data.summary}
            </div>

            <div className="mt-4 rounded-xl border border-brand-blue/20 bg-brand-blue/5 p-4">
              <p className="text-xs font-semibold text-brand-blue">Pour continuer</p>
              <p className="mt-1 text-sm text-slate-700">{data.suggestedAction}</p>
            </div>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              {data.continueUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    navigate(data.continueUrl!);
                  }}
                  className="flex-1 rounded-lg bg-brand-blue py-2.5 text-sm font-semibold text-white hover:bg-brand-blue/90"
                >
                  Reprendre mon projet
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-lg border border-edge py-2.5 text-sm font-medium text-slate-700 hover:bg-muted"
              >
                Explorer le tableau de bord
              </button>
            </div>

            {data.projectCount === 0 && (
              <p className="mt-3 text-center text-xs text-slate-500">
                Créez un projet, importez une source CSV — le conducteur IA construira le pipeline avec vous.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
