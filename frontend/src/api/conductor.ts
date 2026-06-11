import { apiClient } from "../lib/apiClient";
import type { ConductorState, WelcomePayload } from "../types";

export function getWelcome(): Promise<WelcomePayload> {
  return apiClient.get<WelcomePayload>("/ai/welcome");
}

export function startConductor(payload: {
  columns: string[];
  sourceLabel: string;
  projectId?: string;
  sourceNodeId?: string;
}): Promise<ConductorState> {
  return apiClient.post<ConductorState>("/ai/conductor/start", payload);
}

export function submitConductorIntent(sessionId: string, intent: string): Promise<ConductorState> {
  return apiClient.post<ConductorState>("/ai/conductor/intent", { sessionId, intent });
}

export function respondConductorPlan(
  sessionId: string,
  action: "accept" | "revise",
  feedback?: string,
): Promise<ConductorState> {
  return apiClient.post<ConductorState>("/ai/conductor/plan", { sessionId, action, feedback });
}

export function respondConductorStep(
  sessionId: string,
  action: "accept" | "reject" | "revise",
  feedback?: string,
): Promise<ConductorState> {
  return apiClient.post<ConductorState>("/ai/conductor/step", { sessionId, action, feedback });
}

export function getConductorSession(sessionId: string): Promise<ConductorState> {
  return apiClient.get<ConductorState>(`/ai/conductor/${sessionId}`);
}
