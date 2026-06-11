import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { SparklesIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useAI } from "../ai";
import AIAssistant from "./AIAssistant";

const HIDDEN_PATHS = ["/login"];

export default function AIGlobalShell() {
  const { pathname } = useLocation();
  const { isOpen, close, toggle, mode, prompt, aiStatus, editorBridge } = useAI();

  const hidden = HIDDEN_PATHS.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (hidden) close();
  }, [hidden, close]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "i") {
        e.preventDefault();
        toggle();
      }
      if (e.key === "Escape" && isOpen) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, close, isOpen]);

  if (hidden) return null;

  const standalone = !editorBridge?.onApply;
  const columns = editorBridge?.columns ?? [];

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={() => toggle()}
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-blue text-white shadow-xl ring-4 ring-brand-blue/20 transition hover:scale-105 hover:bg-brand-blue/90 hover:shadow-2xl"
          title="Assistant IA (Ctrl+Shift+I)"
          aria-label="Ouvrir l'assistant IA"
        >
          <SparklesIcon className="h-7 w-7" />
          <span
            className={`absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-white ${
              aiStatus?.mode === "cloud" ? "bg-good" : "bg-slate-400"
            }`}
          />
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-[1px]"
            onClick={close}
            aria-label="Fermer l'assistant IA"
          />
          <aside className="relative flex h-full w-full max-w-md flex-col border-l border-edge bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-edge px-4 py-2.5">
              <p className="text-xs text-slate-500">
                Raccourci <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">Ctrl+Shift+I</kbd>
              </p>
              <button
                type="button"
                onClick={close}
                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-muted hover:text-slate-800"
                aria-label="Fermer"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <AIAssistant
                upstreamColumns={columns}
                aiStatus={aiStatus}
                initialMode={mode}
                initialPrompt={prompt}
                standalone={standalone}
                selectedNodeKind={editorBridge?.selectedNodeKind ?? null}
                onApply={editorBridge?.onApply}
              />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
