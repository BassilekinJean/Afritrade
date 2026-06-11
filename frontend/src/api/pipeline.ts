import { apiClient } from "../lib/apiClient";
import type { AIResponse, AnalyzeResponse, NormalizeOptions, RunResult, TablePreview } from "../types";

export interface UploadResult {
  datasetId: string;
  filename: string;
  kind: string;
  sourceKind?: string;
  size: number;
  delimiter?: string | null;
  table?: string | null;
  sheet?: string | null;
  rowCount?: number;
  columns?: string[];
  preview?: TablePreview;
}

export interface UploadOptions {
  delimiter?: string;
  table?: string;
  sheet?: string;
}

export async function uploadSource(file: File, opts: UploadOptions = {}): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  if (opts.delimiter) form.append("delimiter", opts.delimiter);
  if (opts.table) form.append("table", opts.table);
  if (opts.sheet) form.append("sheet", opts.sheet);
  return apiClient.upload<UploadResult>("/sources/upload", form);
}

export interface FetchUrlResult {
  datasetId: string;
  filename: string;
  kind: string;
  sourceKind?: string;
  url: string;
  columns?: string[];
  rowCount?: number;
  preview?: TablePreview;
}

export async function fetchUrlSource(url: string): Promise<FetchUrlResult> {
  return apiClient.post<FetchUrlResult>("/sources/fetch-url", { url });
}

export interface DatabasePreviewResult {
  preview?: TablePreview;
  columns?: string[];
  rowCount?: number;
  connectionUrl: string;
}

export async function previewDatabase(payload: {
  connectionUrl: string;
  table?: string;
  query?: string;
  limit?: number;
}): Promise<DatabasePreviewResult> {
  return apiClient.post<DatabasePreviewResult>("/sources/database", payload);
}

export function runPipeline(nodes: any[], edges: any[], projectId?: string): Promise<RunResult> {
  return apiClient.post<RunResult>("/pipeline/run", {
    project_id: projectId,
    nodes: nodes.map((n) => ({ id: n.id, type: n.data.kind, data: { config: n.data.config } })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
    })),
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

export function getDbHint(): Promise<{ sqliteUrl: string; hint: string }> {
  return apiClient.get<{ sqliteUrl: string; hint: string }>("/sources/db-hint");
}

export function analyzeSources(
  sources: Array<{ id: string; type: string; label?: string; config: Record<string, unknown> }>,
  applyNormalize = false,
  normalizeOptions?: NormalizeOptions,
): Promise<AnalyzeResponse> {
  return apiClient.post<AnalyzeResponse>("/etl/analyze", {
    sources,
    applyNormalize,
    normalizeOptions,
  });
}

export async function exportPipeline(
  nodes: unknown[],
  edges: unknown[],
  opts: { format: string; filename?: string; tableName?: string; csvDelimiter?: string },
): Promise<void> {
  const { blob, filename } = await apiClient.download("/export", {
    nodes,
    edges,
    format: opts.format,
    filename: opts.filename,
    tableName: opts.tableName,
    csvDelimiter: opts.csvDelimiter,
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
