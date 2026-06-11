import type { SVGProps } from "react";

export type IconName =
  | "trigger"
  | "webhook"
  | "schedule"
  | "file"
  | "url"
  | "database"
  | "http"
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
  | "sql"
  | "custom"
  | "output"
  | "folder"
  | "play"
  | "link"
  | "chart"
  | "sparkles"
  | "leaf"
  | "trend"
  | "settings"
  | "user"
  | "logout"
  | "plus"
  | "search"
  | "grid"
  | "list"
  | "admin"
  | "import"
  | "export"
  | "quality"
  | "automation"
  | "pipeline";

type Props = SVGProps<SVGSVGElement> & { name: IconName; size?: number };

const paths: Record<IconName, JSX.Element> = {
  trigger: (
    <>
      <polygon points="8,5 19,12 8,19" fill="currentColor" stroke="none" />
    </>
  ),
  webhook: (
    <>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </>
  ),
  schedule: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </>
  ),
  url: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a15 15 0 0 1 0 18" />
      <path d="M12 3a15 15 0 0 0 0 18" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="6" rx="8" ry="3" />
      <path d="M4 6v12c0 1.66 3.58 3 8 3s8-1.34 8-3V6" />
      <path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" />
    </>
  ),
  http: (
    <>
      <path d="M4 7h16v10H4z" />
      <path d="M8 11h8M8 14h5" />
      <path d="M7 7V5M17 7V5" />
    </>
  ),
  filter: (
    <>
      <path d="M4 5h16l-6 7v6l-4 2v-8z" />
    </>
  ),
  select: (
    <>
      <rect x="4" y="5" width="5" height="14" rx="1" />
      <rect x="11" y="5" width="5" height="14" rx="1" />
      <rect x="18" y="5" width="2" height="14" rx="1" />
    </>
  ),
  rename: (
    <>
      <path d="M4 20h4l10-10-4-4L4 16v4z" />
      <path d="M14 6l4 4" />
    </>
  ),
  sort: (
    <>
      <path d="M8 9l4-4 4 4" />
      <path d="M12 5v14" />
      <path d="M16 15l-4 4-4-4" />
    </>
  ),
  aggregate: (
    <>
      <path d="M4 19V9" />
      <path d="M10 19V5" />
      <path d="M16 19v-7" />
      <path d="M22 19V3" />
    </>
  ),
  dedupe: (
    <>
      <rect x="5" y="5" width="10" height="10" rx="2" />
      <rect x="9" y="9" width="10" height="10" rx="2" />
    </>
  ),
  join: (
    <>
      <circle cx="8" cy="12" r="4" />
      <circle cx="16" cy="12" r="4" />
    </>
  ),
  lookup: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M16 16l4 4" />
      <path d="M11 8v6M8 11h6" />
    </>
  ),
  union: (
    <>
      <path d="M8 6h12v5H8z" />
      <path d="M4 13h12v5H4z" />
    </>
  ),
  cast: (
    <>
      <path d="M7 4h10v6H7z" />
      <path d="M5 14h14v6H5z" />
      <path d="M10 10v4M14 10v4" />
    </>
  ),
  split: (
    <>
      <path d="M12 4v16" />
      <path d="M6 8h12M6 16h12" />
    </>
  ),
  pivot: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 10h16M10 4v16" />
    </>
  ),
  validate: (
    <>
      <path d="M12 3l8 4v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V7z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  branch: (
    <>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="M8 6h8M18 8.5V15.5M8.5 8.5L16 16" />
    </>
  ),
  sql: (
    <>
      <path d="M8 9l-4 3 4 3" />
      <path d="M16 9l4 3-4 3" />
      <path d="M13 6l-2 12" />
    </>
  ),
  custom: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </>
  ),
  output: (
    <>
      <path d="M12 3v10" />
      <path d="M8 9l4 4 4-4" />
      <path d="M5 17h14v4H5z" />
    </>
  ),
  folder: <path d="M3 7a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  play: <polygon points="8,5 19,12 8,19" fill="currentColor" stroke="none" />,
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </>
  ),
  chart: (
    <>
      <path d="M4 19V9" />
      <path d="M10 19V5" />
      <path d="M16 19v-7" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3l1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2z" />
      <path d="M5 14l.8 2.5L8 17l-2.2.7L5 20l-.8-2.3L2 17l2.2-.7z" />
    </>
  ),
  leaf: (
    <>
      <path d="M11 20C6 16 4 10 4 6c4 0 8 2 11 6-1 4-2 6-4 8z" />
      <path d="M11 20c4-4 6-8 7-14-4 1-7 3-10 7" />
    </>
  ),
  trend: (
    <>
      <path d="M4 18h16" />
      <path d="M6 16l4-6 3 3 5-8" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M5 20c0-4 3.5-6 7-6s7 2 7 6" />
    </>
  ),
  logout: (
    <>
      <path d="M10 17l-5-5 5-5" />
      <path d="M5 12h11" />
      <path d="M19 5v14" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M16 16l4 4" />
    </>
  ),
  grid: (
    <>
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
    </>
  ),
  list: (
    <>
      <path d="M8 6h12M8 12h12M8 18h12" />
      <circle cx="5" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="5" cy="18" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  admin: (
    <>
      <path d="M12 3l7 4v6c0 4.5-3 7.5-7 8-4-.5-7-3.5-7-8V7z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  import: (
    <>
      <path d="M12 4v10" />
      <path d="M8 10l4 4 4-4" />
      <path d="M5 18h14" />
    </>
  ),
  export: (
    <>
      <path d="M12 20V10" />
      <path d="M8 14l4-4 4 4" />
      <path d="M5 6h14" />
    </>
  ),
  quality: (
    <>
      <path d="M12 3l8 4v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V7z" />
      <path d="M12 11v3" />
      <circle cx="12" cy="8.5" r="0.5" fill="currentColor" stroke="none" />
    </>
  ),
  automation: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M9 9h6M9 12h6M9 15h4" />
    </>
  ),
  pipeline: (
    <>
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="12" cy="6" r="2.5" />
      <circle cx="18" cy="12" r="2.5" />
      <path d="M8.2 10.8L10.5 7.8M13.5 7.8l2.3 3M15.5 12H8.5" />
    </>
  ),
};

export default function Icon({ name, size = 20, className = "", ...props }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      {...props}
    >
      {paths[name]}
    </svg>
  );
}

/** Mapping kind de nœud → icône pipeline */
export const NODE_ICON: Record<string, IconName> = {
  trigger_manual: "trigger",
  trigger_webhook: "webhook",
  trigger_schedule: "schedule",
  source_file: "file",
  source_url: "url",
  source_database: "database",
  source_csv: "file",
  source_json: "file",
  source_sql_file: "database",
  http_request: "http",
  filter: "filter",
  select: "select",
  rename: "rename",
  sort: "sort",
  aggregate: "aggregate",
  dedupe: "dedupe",
  join: "join",
  lookup: "lookup",
  union: "union",
  cast: "cast",
  split: "split",
  pivot: "pivot",
  validate: "validate",
  branch: "branch",
  embed_text: "sparkles",
  agri_classify: "leaf",
  causal_analysis: "chart",
  predict: "trend",
  sql: "sql",
  custom: "custom",
  output: "output",
};

export function NodeIcon({ kind, size = 18, className = "" }: { kind: string; size?: number; className?: string }) {
  return <Icon name={NODE_ICON[kind] ?? "custom"} size={size} className={className} />;
}
