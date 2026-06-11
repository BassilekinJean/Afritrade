import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getAIStatus } from "../api/ai";
import type { AIStatus } from "../types";

export type AIOpenOptions = {
  mode?: "pandas" | "sql";
  prompt?: string;
};

export type AIEditorBridge = {
  columns: string[];
  selectedNodeKind: string | null;
  onApply?: (kind: "custom" | "sql", code: string, target: "new" | "inject") => void;
};

type AIContextValue = {
  isOpen: boolean;
  mode: "pandas" | "sql";
  prompt: string;
  aiStatus: AIStatus | null;
  editorBridge: AIEditorBridge | null;
  open: (opts?: AIOpenOptions) => void;
  close: () => void;
  toggle: () => void;
  setMode: (mode: "pandas" | "sql") => void;
  setEditorBridge: (bridge: AIEditorBridge | null) => void;
};

const AIContext = createContext<AIContextValue | null>(null);

export function AIProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"pandas" | "sql">("pandas");
  const [prompt, setPrompt] = useState("");
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  const [editorBridge, setEditorBridge] = useState<AIEditorBridge | null>(null);

  useEffect(() => {
    getAIStatus()
      .then(setAiStatus)
      .catch(() =>
        setAiStatus({
          enabled: true,
          provider: "heuristic",
          model: "local",
          hasKey: false,
          mode: "local",
          hint: "Mode local — ajoutez OPENAI_API_KEY dans backend/.env.",
        }),
      );
  }, []);

  const open = useCallback((opts?: AIOpenOptions) => {
    if (opts?.mode) setMode(opts.mode);
    if (opts?.prompt !== undefined) setPrompt(opts.prompt);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  const value = useMemo(
    () => ({
      isOpen,
      mode,
      prompt,
      aiStatus,
      editorBridge,
      open,
      close,
      toggle,
      setMode,
      setEditorBridge,
    }),
    [isOpen, mode, prompt, aiStatus, editorBridge, open, close, toggle],
  );

  return <AIContext.Provider value={value}>{children}</AIContext.Provider>;
}

export function useAI(): AIContextValue {
  const ctx = useContext(AIContext);
  if (!ctx) throw new Error("useAI doit être utilisé dans AIProvider");
  return ctx;
}

export function useAIOptional(): AIContextValue | null {
  return useContext(AIContext);
}
