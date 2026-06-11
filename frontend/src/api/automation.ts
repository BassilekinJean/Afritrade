import { apiClient } from "../lib/apiClient";
import type { Schedule, Webhook } from "../types";

export function listSchedules(projectId?: string): Promise<Schedule[]> {
  const q = projectId ? `?project_id=${projectId}` : "";
  return apiClient.get<Schedule[]>(`/automation/schedules${q}`);
}

export function createSchedule(projectId: string, cronExpression: string): Promise<Schedule> {
  return apiClient.post<Schedule>("/automation/schedules", {
    project_id: projectId,
    cron_expression: cronExpression,
  });
}

export function updateSchedule(
  id: string,
  data: { cron_expression?: string; enabled?: boolean },
): Promise<Schedule> {
  return apiClient.patch<Schedule>(`/automation/schedules/${id}`, data);
}

export function deleteSchedule(id: string): Promise<void> {
  return apiClient.delete<void>(`/automation/schedules/${id}`);
}

export function listWebhooks(projectId?: string): Promise<Webhook[]> {
  const q = projectId ? `?project_id=${projectId}` : "";
  return apiClient.get<Webhook[]>(`/automation/webhooks${q}`);
}

export function createWebhook(projectId: string): Promise<Webhook> {
  return apiClient.post<Webhook>("/automation/webhooks", { project_id: projectId });
}

export function deleteWebhook(id: string): Promise<void> {
  return apiClient.delete<void>(`/automation/webhooks/${id}`);
}

export function toggleWebhook(id: string, enabled: boolean): Promise<Webhook> {
  return apiClient.patch<Webhook>(`/automation/webhooks/${id}`, { enabled });
}
