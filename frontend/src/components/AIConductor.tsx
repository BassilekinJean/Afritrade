import { useCallback, useEffect, useRef, useState } from "react";
import {
  respondConductorPlan,
  respondConductorStep,
  startConductor,
  submitConductorIntent,
} from "../api/conductor";
import type { ConductorState, ConductorStep } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  columns: string[];
  sourceLabel: string;
  projectId?: string;
  sourceNodeId?: string;
  onStepAccepted: (step: ConductorStep) => void;
  onCompleted?: () => void;
}

function renderMarkdownLite(text: string) {
  return text.split("\n").map((line, i) => {
    const html = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    return <p key={i} className="mb-1 last:mb-0" dangerouslySetInnerHTML={{ __html: html }} />;
  });
}

export default function AIConductor({
  open,
  onClose,
  columns,
  sourceLabel,
  projectId,
  sourceNodeId,
  onStepAccepted,
  onCompleted,
}: Props) {
  const [state, setState] = useState<ConductorState | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviseMode, setReviseMode] = useState<"plan" | "step" | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastAcceptedRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    setBusy(true);
    setError(null);
    lastAcceptedRef.current = 0;
    startConductor({ columns, sourceLabel, projectId, sourceNodeId })
      .then(setState)
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  }, [open, columns, sourceLabel, projectId, sourceNodeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [state?.messages.length]);

  useEffect(() => {
    if (!state?.acceptedSteps.length) return;
    if (state.acceptedSteps.length <= lastAcceptedRef.current) return;
    const step = state.acceptedSteps[state.acceptedSteps.length - 1];
    lastAcceptedRef.current = state.acceptedSteps.length;
    onStepAccepted(step);
  }, [state?.acceptedSteps, onStepAccepted]);

  const run = useCallback(async (fn: () => Promise<ConductorState>) => {
    setBusy(true);
    setError(null);
    try {
      const next = await fn();
      setState(next);
      setInput("");
      setReviseMode(null);
      if (next.phase === "completed") onCompleted?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }, [onCompleted]);

  if (!open) return null;

  const phase = state?.phase;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} aria-label="Fermer" />
      <div className="relative flex h-[min(720px,90vh)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-edge bg-surface shadow-2xl">
        <header className="flex items-center justify-between border-b border-edge bg-brand-blue px-5 py-4 text-white">
          <div>
            <p className="text-xs font-medium text-white/70">Conducteur IA · Pipeline guidé</p>
            <h2 className="text-lg font-bold">{sourceLabel}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-sm text-white/80 hover:bg-white/10">
            Fermer
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-brand-cream/30 p-4">
          {busy && !state && <p className="text-sm text-slate-500">Initialisation…</p>}
          {state?.messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm ${
                m.role === "user"
                  ? "ml-auto bg-brand-blue text-white"
                  : "bg-white text-slate-800 shadow-sm ring-1 ring-edge"
              }`}
            >
              {renderMarkdownLite(m.content)}
            </div>
          ))}
          {state?.plan && phase === "plan_proposed" && (
            <div className="rounded-xl border border-edge bg-white p-3 text-xs text-slate-600">
              <p className="font-semibold text-brand-blue">{state.plan.summary}</p>
              <ol className="mt-2 list-decimal space-y-1 pl-4">
                {state.plan.steps.map((s) => (
                  <li key={s.id}>{s.title}</li>
                ))}
              </ol>
            </div>
          )}
          {error && <p className="rounded-lg bg-bad/10 px-3 py-2 text-xs text-bad">{error}</p>}
        </div>

        <footer className="border-t border-edge bg-surface p-4">
          {phase === "awaiting_intent" && (
            <>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={3}
                placeholder="Ex : filtrer le maïs, sommer les prix par région, analyser les corrélations…"
                className="mb-2 w-full rounded-lg border border-edge px-3 py-2 text-sm outline-none focus:border-brand-blue"
              />
              <button
                type="button"
                disabled={busy || input.trim().length < 3}
                onClick={() => state && void run(() => submitConductorIntent(state.sessionId, input.trim()))}
                className="w-full rounded-lg bg-brand-blue py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                Envoyer mon objectif
              </button>
            </>
          )}

          {phase === "plan_proposed" && !reviseMode && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => state && void run(() => respondConductorPlan(state.sessionId, "accept"))}
                className="flex-1 rounded-lg bg-good py-2 text-sm font-semibold text-white"
              >
                J&apos;accepte le plan
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setReviseMode("plan")}
                className="flex-1 rounded-lg border border-brand-blue py-2 text-sm font-semibold text-brand-blue"
              >
                Ajuster la démarche
              </button>
            </div>
          )}

          {phase === "step_pending" && state?.currentStep && !reviseMode && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">
                Étape {state.currentStepIndex + 1}/{state.totalSteps} — {state.currentStep.title}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => state && void run(() => respondConductorStep(state.sessionId, "accept"))}
                  className="flex-1 rounded-lg bg-good py-2 text-sm font-semibold text-white"
                >
                  Valider
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => state && void run(() => respondConductorStep(state.sessionId, "reject"))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600"
                >
                  Ignorer
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setReviseMode("step")}
                  className="flex-1 rounded-lg border border-brand-blue py-2 text-sm font-semibold text-brand-blue"
                >
                  Ajuster
                </button>
              </div>
            </div>
          )}

          {reviseMode && (
            <>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={2}
                placeholder="Décrivez les ajustements souhaités…"
                className="mb-2 w-full rounded-lg border border-edge px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={busy || !input.trim()}
                onClick={() => {
                  if (!state) return;
                  if (reviseMode === "plan") {
                    void run(() => respondConductorPlan(state.sessionId, "revise", input.trim()));
                  } else {
                    void run(() => respondConductorStep(state.sessionId, "revise", input.trim()));
                  }
                }}
                className="w-full rounded-lg bg-brand-blue py-2 text-sm font-semibold text-white"
              >
                Envoyer l&apos;ajustement
              </button>
            </>
          )}

          {phase === "completed" && (
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white"
            >
              Terminer — voir le pipeline
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
