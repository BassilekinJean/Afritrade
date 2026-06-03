import type { NodeKind, NodeConfig } from "./types";

export type FieldType = "text" | "textarea" | "code" | "number" | "boolean" | "select" | "keyvalue" | "file" | "columns";

export interface FieldSpec {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  help?: string;
  options?: string[];
}

export interface NodeSpec {
  kind: NodeKind;
  label: string;
  category: "source" | "transform" | "output";
  icon: string;
  color: string;
  description: string;
  defaultConfig: NodeConfig;
  fields: FieldSpec[];
}

export const NODE_SPECS: NodeSpec[] = [
  {
    kind: "source_csv",
    label: "Source CSV",
    category: "source",
    icon: "CSV",
    color: "#34d399",
    description: "Importer un fichier CSV",
    defaultConfig: { delimiter: "," },
    fields: [
      { key: "file", label: "Fichier CSV", type: "file", help: "Importez un .csv depuis votre poste." },
      { key: "delimiter", label: "Délimiteur", type: "text", placeholder: "," },
      { key: "content", label: "Ou collez le CSV", type: "textarea", placeholder: "id,montant\n1,1200" },
    ],
  },
  {
    kind: "source_json",
    label: "Source JSON",
    category: "source",
    icon: "JSON",
    color: "#34d399",
    description: "Importer un fichier JSON",
    defaultConfig: {},
    fields: [
      { key: "file", label: "Fichier JSON", type: "file", help: "Importez un .json (tableau d'objets)." },
      { key: "content", label: "Ou collez le JSON", type: "textarea", placeholder: '[{"id":1,"montant":1200}]' },
    ],
  },
  {
    kind: "source_sql",
    label: "Source SQL",
    category: "source",
    icon: "SQL",
    color: "#34d399",
    description: "Lire une base via SQLAlchemy",
    defaultConfig: { connectionString: "", query: "" },
    fields: [
      {
        key: "connectionString",
        label: "Chaîne de connexion",
        type: "text",
        placeholder: "sqlite:////chemin/base.db ou postgresql://user:pwd@host/db",
        help: "Format SQLAlchemy.",
      },
      { key: "query", label: "Requête SQL", type: "code", placeholder: "SELECT * FROM transactions" },
    ],
  },
  {
    kind: "filter",
    label: "Filtrer",
    category: "transform",
    icon: "WHERE",
    color: "#38bdf8",
    description: "Filtrer les lignes (df.query)",
    defaultConfig: { expression: "" },
    fields: [
      {
        key: "expression",
        label: "Expression",
        type: "text",
        placeholder: "montant > 1000 and pays == 'FR'",
        help: "Syntaxe pandas query.",
      },
    ],
  },
  {
    kind: "select",
    label: "Sélectionner colonnes",
    category: "transform",
    icon: "COLS",
    color: "#38bdf8",
    description: "Conserver certaines colonnes",
    defaultConfig: { columns: [] },
    fields: [{ key: "columns", label: "Colonnes à garder", type: "columns" }],
  },
  {
    kind: "rename",
    label: "Renommer",
    category: "transform",
    icon: "A→B",
    color: "#38bdf8",
    description: "Renommer des colonnes",
    defaultConfig: { mapping: {} },
    fields: [{ key: "mapping", label: "Ancien → Nouveau", type: "keyvalue" }],
  },
  {
    kind: "sort",
    label: "Trier",
    category: "transform",
    icon: "SORT",
    color: "#38bdf8",
    description: "Trier par colonne",
    defaultConfig: { by: "", ascending: true },
    fields: [
      { key: "by", label: "Colonne", type: "text", placeholder: "montant" },
      { key: "ascending", label: "Ordre croissant", type: "boolean" },
    ],
  },
  {
    kind: "aggregate",
    label: "Agréger",
    category: "transform",
    icon: "Σ",
    color: "#38bdf8",
    description: "Regrouper et agréger",
    defaultConfig: { groupBy: [], aggregations: {} },
    fields: [
      { key: "groupBy", label: "Regrouper par", type: "columns" },
      {
        key: "aggregations",
        label: "Agrégations (colonne → fonction)",
        type: "keyvalue",
        help: "Fonctions : sum, mean, count, min, max, std...",
      },
    ],
  },
  {
    kind: "dedupe",
    label: "Dédoublonner",
    category: "transform",
    icon: "UNIQ",
    color: "#38bdf8",
    description: "Supprimer les doublons",
    defaultConfig: { columns: [] },
    fields: [{ key: "columns", label: "Clés (vide = toutes)", type: "columns" }],
  },
  {
    kind: "sql",
    label: "Transformation SQL",
    category: "transform",
    icon: "SQL",
    color: "#a78bfa",
    description: "Requête SQL sur l'entrée (table « input »)",
    defaultConfig: { query: "SELECT * FROM input" },
    fields: [{ key: "query", label: "Requête SQL", type: "code", placeholder: "SELECT * FROM input WHERE montant > 1000" }],
  },
  {
    kind: "custom",
    label: "Code Python",
    category: "transform",
    icon: "PY",
    color: "#a78bfa",
    description: "Transformation pandas personnalisée",
    defaultConfig: { code: "" },
    fields: [
      {
        key: "code",
        label: "Code (variable df)",
        type: "code",
        placeholder: "df = df[df['montant'] > 1000]",
        help: "Le DataFrame d'entrée est `df`. Réassignez `df`.",
      },
    ],
  },
  {
    kind: "output",
    label: "Sortie",
    category: "output",
    icon: "OUT",
    color: "#fbbf24",
    description: "Résultat final du pipeline",
    defaultConfig: {},
    fields: [],
  },
];

export const SPEC_BY_KIND: Record<string, NodeSpec> = Object.fromEntries(
  NODE_SPECS.map((s) => [s.kind, s])
);
