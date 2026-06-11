export type NodeKind =
  | "trigger_manual"
  | "trigger_webhook"
  | "trigger_schedule"
  | "source_file"
  | "source_url"
  | "source_database"
  | "source_csv"
  | "source_json"
  | "source_sql_file"
  | "source_txt"
  | "source_excel"
  | "source_pdf"
  | "source_word"
  | "http_request"
  | "filter"
  | "select"
  | "rename"
  | "sort"
  | "aggregate"
  | "dedupe"
  | "join"
  | "lookup"
  | "union"
  | "cast"
  | "split"
  | "pivot"
  | "validate"
  | "branch"
  | "embed_text"
  | "agri_classify"
  | "causal_analysis"
  | "predict"
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
  runId?: string;
  etl?: {
    levels: Array<{ level: number; nodes: string[]; parallel: number }>;
    maxParallel: number;
    phases: Record<string, number>;
    durationMs: number;
    staging?: Record<string, unknown>;
  };
}

export interface ColumnProfile {
  name: string;
  normalizedName: string;
  inferredType: string;
  nullCount: number;
  nullPercent: number;
  uniqueCount: number;
  sampleValues: string[];
  issues: string[];
}

export interface DataProfile {
  label: string;
  sourceKind: string;
  datasetKind: string;
  rowCount: number;
  columnCount: number;
  completenessPercent: number;
  qualityScore: number;
  qualityScoreAfter?: number;
  columns: ColumnProfile[];
  issues: string[];
  recommendations: string[];
  documentMeta: Record<string, unknown>;
  agriDomain?: string;
  agriDomainLabel?: string;
  agriConfidence?: number;
  agriScores?: Record<string, number>;
  agriKeywords?: string[];
}

export interface AgriClassification {
  domain: string;
  domainLabel: string;
  confidence: number;
  scores: Record<string, number>;
  topMatches?: Array<{ domain: string; score: number }>;
  embeddingMethod?: string;
  dimensions?: number;
  agriKeywords?: string[];
}

export interface CrossSourceLink {
  sourceA: string;
  sourceB: string;
  domainA: string;
  domainB: string;
  commonColumns: string[];
  semanticSimilarity: number;
  causalHypothesis?: string | null;
  joinSuggestion?: string | null;
}

export interface ClassifyResponse {
  sources: Array<{
    id: string;
    label: string;
    type: string;
    classification?: AgriClassification;
    columns?: string[];
    rowCount?: number;
    error?: string;
  }>;
  summary: {
    total: number;
    classified: number;
    domains: Record<string, number>;
  };
  crossSourceLinks: CrossSourceLink[];
  fusionSuggestions: Array<{
    goal: string;
    sources: string[];
    method: string;
    targetDomain: string;
  }>;
  errors: string[];
  theme: string;
}

export interface CausalLink {
  feature: string;
  target: string;
  correlation: number;
  absCorrelation: number;
  direction: string;
  causalScore: number;
  lagHint?: string | null;
  grangerNote?: string | null;
  interpretation: string;
}

export interface IntelligenceResponse {
  targetColumn?: string;
  causalLinks?: CausalLink[];
  topDrivers?: CausalLink[];
  mode?: string;
  metrics?: Record<string, number>;
  trend?: string;
  preview?: TablePreview;
  mergedSources?: string[];
  theme?: string;
}

export interface NormalizeOptions {
  dropEmptyRows: boolean;
  dropNullColumnPct: number;
  fillNumericNulls: "none" | "zero" | "median";
  dropDuplicates: boolean;
}

export interface AnalyzeResponse {
  sources: SourceAnalyzeResult[];
  summary: {
    total: number;
    success: number;
    failed: number;
    avgQuality: number;
    agriDomains?: Record<string, number>;
  };
  errors: string[];
  normalized: boolean;
}

export interface SourceAnalyzeResult {
  id: string;
  type: string;
  label: string;
  profile?: DataProfile;
  agriClassification?: AgriClassification;
  normalized?: { rowCount: number; columns: string[]; standardization: Record<string, unknown> };
  error?: string;
}

export interface AIResponse {
  code: string;
  explanation: string;
  mode: string;
  source?: string;
}

export interface AIStatus {
  enabled: boolean;
  provider: string;
  model: string;
  hasKey: boolean;
  mode: "cloud" | "local";
  hint: string;
}

export interface ConductorMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ConductorStep {
  id: string;
  order: number;
  title: string;
  description: string;
  action: "quality_check" | "add_node";
  nodeKind?: NodeKind | null;
  config?: Record<string, unknown>;
  connectTo?: "chain" | "source";
  codePrompt?: string;
  tab?: string;
  generatedExplanation?: string;
  generationError?: string;
}

export interface ConductorPlan {
  summary: string;
  steps: ConductorStep[];
}

export interface ConductorState {
  sessionId: string;
  phase: "awaiting_intent" | "plan_proposed" | "step_pending" | "completed";
  messages: ConductorMessage[];
  intent: string;
  plan: ConductorPlan | null;
  currentStep: ConductorStep | null;
  currentStepIndex: number;
  totalSteps: number;
  acceptedSteps: ConductorStep[];
  columns: string[];
  sourceLabel: string;
  projectId?: string | null;
  sourceNodeId?: string | null;
}

export interface WelcomePayload {
  greeting: string;
  summary: string;
  suggestedAction: string;
  lastProject: {
    id: string;
    title: string;
    updatedAt?: string;
    nodeCount: number;
    sourceCount: number;
  } | null;
  continueUrl: string | null;
  projectCount: number;
}

export type Role = "admin" | "user";

export interface User {
  id: string;
  username: string;
  email?: string | null;
  full_name?: string | null;
  role: Role;
  is_active: boolean;
  /** Connecté en ce moment (calculé côté serveur). */
  is_online?: boolean;
  created_at: string;
  updated_at: string;
  last_login_at?: string | null;
  last_seen_at?: string | null;
}

export interface OnlineUser {
  id: string;
  username: string;
  full_name?: string | null;
  role: Role;
  last_seen_at?: string | null;
}

export interface PresenceSnapshot {
  online_count: number;
  online_users: OnlineUser[];
  users: User[];
  activity: ActivityEntry[];
  window_seconds: number;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ActivityEntry {
  id: string;
  userId?: string | null;
  email?: string | null;
  action: string;
  detail?: string | null;
  ip?: string | null;
  createdAt: string;
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
  owner_username?: string | null;
  owner_name?: string | null;
  status?: string;
  node_count?: number;
}

export interface Project extends ProjectSummary {
  graph: PipelineGraph;
}

export interface Connection {
  id: string;
  user_id: string;
  name: string;
  conn_type: "database" | "http";
  connection_url: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PipelineRun {
  id: string;
  project_id?: string | null;
  project_title?: string | null;
  user_id?: string | null;
  status: "running" | "success" | "failed";
  trigger_type: string;
  node_count: number;
  duration_ms?: number | null;
  error_message?: string | null;
  result_summary?: Record<string, unknown> | null;
  created_at: string;
  finished_at?: string | null;
  node_logs?: NodeRunLog[];
}

export interface NodeRunLog {
  id: string;
  run_id: string;
  node_id: string;
  node_type?: string | null;
  phase?: string | null;
  status: string;
  duration_ms?: number | null;
  row_count?: number | null;
  error?: string | null;
}

export interface Schedule {
  id: string;
  project_id: string;
  user_id: string;
  cron_expression: string;
  enabled: boolean;
  last_run_at?: string | null;
  next_run_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Webhook {
  id: string;
  project_id: string;
  user_id: string;
  token: string;
  enabled: boolean;
  created_at: string;
  webhook_url?: string | null;
}
