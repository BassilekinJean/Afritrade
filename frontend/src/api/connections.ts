import { apiClient } from "../lib/apiClient";
import type { Connection } from "../types";

export function listConnections(): Promise<Connection[]> {
  return apiClient.get<Connection[]>("/connections");
}

export function createConnection(data: {
  name: string;
  conn_type?: "database" | "http";
  connection_url: string;
  description?: string;
}): Promise<Connection> {
  return apiClient.post<Connection>("/connections", data);
}

export function updateConnection(
  id: string,
  data: Partial<{ name: string; conn_type: string; connection_url: string; description: string }>,
): Promise<Connection> {
  return apiClient.patch<Connection>(`/connections/${id}`, data);
}

export function deleteConnection(id: string): Promise<void> {
  return apiClient.delete<void>(`/connections/${id}`);
}

export function testConnection(id: string): Promise<{ status: string; message: string }> {
  return apiClient.post<{ status: string; message: string }>(`/connections/${id}/test`, {});
}
