import { apiClient } from "../lib/apiClient";
import type { PipelineGraph, Project, ProjectSummary } from "../types";

export function listProjects(): Promise<ProjectSummary[]> {
  return apiClient.get<ProjectSummary[]>("/projects");
}

export function createProject(title: string): Promise<Project> {
  return apiClient.post<Project>("/projects", { title });
}

export function getProject(id: string): Promise<Project> {
  return apiClient.get<Project>(`/projects/${id}`);
}

export function updateProject(
  id: string,
  data: { title?: string; graph?: PipelineGraph }
): Promise<Project> {
  return apiClient.patch<Project>(`/projects/${id}`, data);
}

export function deleteProject(id: string): Promise<void> {
  return apiClient.delete<void>(`/projects/${id}`);
}
