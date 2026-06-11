import { apiClient } from "../lib/apiClient";
import type { AIStatus } from "../types";

export function getAIStatus(): Promise<AIStatus> {
  return apiClient.get<AIStatus>("/ai/status");
}
