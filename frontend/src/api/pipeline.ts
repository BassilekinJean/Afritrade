import { apiClient } from "../lib/apiClient";
import type { AIResponse, RunResult } from "../types";

export async function uploadSource(file: File): Promise<{
  datasetId: string;
  filename: string;
  kind: string;
  size: number;
  preview: string;
}> {
  const form = new FormData();
  form.append("file", file);
  return apiClient.upload("/sources/upload", form);
}

export function runPipeline(nodes: any[], edges: any[]): Promise<RunResult> {
  return apiClient.post<RunResult>("/pipeline/run", {
    nodes: nodes.map((n) => ({ id: n.id, type: n.data.kind, data: { config: n.data.config } })),
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
  });
}

export function generateCode(
  description: string,
  columns: string[],
  mode: "pandas" | "sql"
): Promise<AIResponse> {
  return apiClient.post<AIResponse>("/ai/generate", { description, columns, mode });
}

export function health(): Promise<{ status: string; aiKey: boolean }> {
  return apiClient.get<{ status: string; aiKey: boolean }>("/health", false);
}
