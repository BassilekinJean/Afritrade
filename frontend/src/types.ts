export type NodeKind =
  | "source_csv"
  | "source_json"
  | "source_sql"
  | "source_sql_file"
  | "filter"
  | "select"
  | "rename"
  | "sort"
  | "aggregate"
  | "dedupe"
  | "sql"
  | "custom"
  | "output";

export interface NodeConfig {
  [key: string]: any;
}

export interface PipeNodeData {
  label: string;
  kind: NodeKind;
  config: NodeConfig;
}

export interface TablePreview {
  columns: string[];
  rows: Record<string, any>[];
  rowCount: number;
  truncated: boolean;
  dtypes: Record<string, string>;
  error?: string;
}

export interface RunResult {
  previews: Record<string, TablePreview>;
  finalNodeId: string | null;
  final: TablePreview | null;
}

export interface AIResponse {
  code: string;
  explanation: string;
  mode: string;
  source?: string;
}

export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface PipelineGraph {
  nodes: any[];
  edges: any[];
}

export interface ProjectSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Project extends ProjectSummary {
  graph: PipelineGraph;
}
