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
