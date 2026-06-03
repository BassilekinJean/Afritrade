import type { AIResponse, RunResult } from "./types";

const BASE = "/api";

async function jsonOrThrow(res: Response) {
  if (!res.ok) {
    let detail = `Erreur ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json();
}

export async function uploadSource(file: File): Promise<{
  datasetId: string;
  filename: string;
  kind: string;
  size: number;
  preview: string;
}> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/sources/upload`, {
    method: "POST",
    body: form,
  });
  return jsonOrThrow(res);
}

export async function runPipeline(nodes: any[], edges: any[]): Promise<RunResult> {
  const res = await fetch(`${BASE}/pipeline/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nodes: nodes.map((n) => ({ id: n.id, type: n.data.kind, data: { config: n.data.config } })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
    }),
  });
  return jsonOrThrow(res);
}

export async function generateCode(
  description: string,
  columns: string[],
  mode: "pandas" | "sql"
): Promise<AIResponse> {
  const res = await fetch(`${BASE}/ai/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description, columns, mode }),
  });
  return jsonOrThrow(res);
}

export async function health(): Promise<{ status: string; aiKey: boolean }> {
  const res = await fetch(`${BASE}/health`);
  return jsonOrThrow(res);
}
