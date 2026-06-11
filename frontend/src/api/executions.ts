import { apiClient } from "../lib/apiClient";
import type { PipelineRun } from "../types";

export function listExecutions(limit = 50, projectId?: string): Promise<PipelineRun[]> {
  const q = new URLSearchParams({ limit: String(limit) });
  if (projectId) q.set("project_id", projectId);
  return apiClient.get<PipelineRun[]>(`/executions?${q}`);
}

export function getExecution(runId: string): Promise<PipelineRun> {
  return apiClient.get<PipelineRun>(`/executions/${runId}`);
}
