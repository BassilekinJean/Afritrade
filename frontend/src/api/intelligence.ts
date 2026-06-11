import { apiClient } from "../lib/apiClient";
import type { ClassifyResponse, IntelligenceResponse } from "../types";

export interface SourcePayload {
  id: string;
  type: string;
  label?: string;
  config: Record<string, unknown>;
}

export function classifySources(sources: SourcePayload[]): Promise<ClassifyResponse> {
  return apiClient.post<ClassifyResponse>("/etl/classify", { sources });
}

export function runIntelligence(payload: {
  sources: SourcePayload[];
  targetColumn: string;
  featureColumns?: string[];
  timeColumn?: string;
  joinColumn?: string;
  mode?: "causal" | "predict" | "forecast";
  horizon?: number;
}): Promise<IntelligenceResponse> {
  return apiClient.post<IntelligenceResponse>("/etl/intelligence", payload);
}
