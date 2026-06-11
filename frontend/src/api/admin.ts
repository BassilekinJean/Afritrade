import { apiClient } from "../lib/apiClient";
import type { ActivityEntry, PresenceSnapshot, ProjectSummary, Role, User } from "../types";

export interface CreateUserPayload {
  username: string;
  password: string;
  role: Role;
  email?: string;
  full_name?: string;
}

export interface UpdateUserPayload {
  username?: string;
  password?: string;
  role?: Role;
  email?: string;
  full_name?: string;
  is_active?: boolean;
}

export function listUsers(): Promise<User[]> {
  return apiClient.get<User[]>("/admin/users");
}

export function createUser(payload: CreateUserPayload): Promise<User> {
  return apiClient.post<User>("/admin/users", payload);
}

export function updateUser(id: string, payload: UpdateUserPayload): Promise<User> {
  return apiClient.patch<User>(`/admin/users/${id}`, payload);
}

export function deleteUser(id: string): Promise<void> {
  return apiClient.delete<void>(`/admin/users/${id}`);
}

export function getActivity(limit = 100): Promise<ActivityEntry[]> {
  return apiClient.get<ActivityEntry[]>(`/admin/activity?limit=${limit}`);
}

/** Présence + comptes + journal en un seul appel (polling temps réel). */
export function getPresence(): Promise<PresenceSnapshot> {
  return apiClient.get<PresenceSnapshot>("/admin/presence");
}

export function getAllProjects(): Promise<ProjectSummary[]> {
  return apiClient.get<ProjectSummary[]>("/admin/projects");
}

export function deleteAnyProject(projectId: string): Promise<void> {
  return apiClient.delete<void>(`/admin/projects/${projectId}`);
}
