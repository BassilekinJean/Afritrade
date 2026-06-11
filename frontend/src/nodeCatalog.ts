import type { NodeKind, NodeConfig } from "./types";

export type FieldType =
  | "text"
  | "textarea"
  | "code"
  | "number"
  | "boolean"
  | "select"
  | "keyvalue"
  | "file"
  | "columns"
  | "column"
  | "url"
  | "database"
  | "connection"
  | "rules";

export interface FieldSpec {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  help?: string;
  options?: string[];
  accept?: string;
}

export interface NodeSpec {
  kind: NodeKind;
  label: string;
  category: "trigger" | "source" | "transform" | "intelligence" | "output";
  icon: string;
  color: string;
  description: string;
  defaultConfig: NodeConfig;
  fields: FieldSpec[];
  /** Masqué de la palette (compatibilité anciens projets). */
  hidden?: boolean;
}

const FILE_ACCEPT =
  ".csv,.txt,.tsv,.json,.xlsx,.xls,.xlsm,.pdf,.docx,.doc,.sql,.sqlite,.sqlite3,.db,.xml,.html,.htm";

export const NODE_SPECS: NodeSpec[] = [
  // --- Déclencheurs (n8n) ---
  {
    kind: "trigger_manual",
    label: "Déclenchement manuel",
    category: "trigger",
    icon: "▶️",
    color: "#059669",
    description: "Lance le workflow à la demande (bouton Exécuter)",
    defaultConfig: {},
    fields: [],
  },
  {
    kind: "trigger_webhook",
    label: "Webhook",
    category: "trigger",
    icon: "🔗",
    color: "#059669",
    description: "Déclenche le pipeline via une URL HTTP (POST)",
    defaultConfig: {},
    fields: [
      {
        key: "_hint",
        label: "Configuration",
        type: "text",
        help: "Créez le webhook dans l'onglet Automation du projet pour obtenir l'URL.",
      },
    ],
  },
  {
    kind: "trigger_schedule",
    label: "Planification cron",
    category: "trigger",
    icon: "⏰",
    color: "#059669",
    description: "Exécution automatique selon une expression cron",
    defaultConfig: { cron: "0 8 * * *" },
    fields: [
      {
        key: "cron",
        label: "Expression cron",
        type: "text",
        placeholder: "0 8 * * *",
        help: "Ex. 0 8 * * * = tous les jours à 8h. Configurez aussi dans Automation.",
      },
    ],
  },
  {
    kind: "source_file",
    label: "Importer un fichier",
    category: "source",
    icon: "📄",
    color: "#0d9488",
    description: "Tableur, document, base locale… tous formats acceptés",
    defaultConfig: { delimiter: "auto" },
    fields: [
      {
        key: "file",
        label: "Choisissez votre fichier",
        type: "file",
        accept: FILE_ACCEPT,
        help: "CSV, Excel, JSON, PDF, Word, SQL, SQLite, texte…",
      },
      { key: "delimiter", label: "Séparateur (CSV)", type: "text", placeholder: "," },
      { key: "table", label: "Table (fichier SQL)", type: "text", placeholder: "Nom de la table" },
      { key: "sheet", label: "Feuille Excel", type: "text", placeholder: "Feuille1 ou 0" },
    ],
  },
  {
    kind: "source_url",
    label: "Lien ou page web",
    category: "source",
    icon: "🌐",
    color: "#2563eb",
    description: "Article, page HTML, CSV ou JSON en ligne",
    defaultConfig: { url: "" },
    fields: [
      {
        key: "url",
        label: "Adresse web",
        type: "url",
        placeholder: "https://exemple.com/donnees.csv",
        help: "Collez un lien vers une page, un fichier ou une API.",
      },
    ],
  },
  {
    kind: "source_database",
    label: "Base de données",
    category: "source",
    icon: "🗄️",
    color: "#7c3aed",
    description: "Se connecter à SQLite, PostgreSQL ou MySQL",
    defaultConfig: { connectionUrl: "", table: "", query: "" },
    fields: [
      {
        key: "database",
        label: "Connexion",
        type: "database",
        help: "Ex. sqlite:///./ma_base.db — ou choisissez une connexion enregistrée",
      },
      {
        key: "connectionId",
        label: "Connexion enregistrée",
        type: "connection",
        help: "Référentiel Talend — prioritaire sur l'URL saisie",
      },
    ],
  },
  {
    kind: "http_request",
    label: "Requête HTTP",
    category: "transform",
    icon: "🌍",
    color: "#0ea5e9",
    description: "Appel API REST sortant (style n8n)",
    defaultConfig: { method: "GET", url: "", headers: {} },
    fields: [
      { key: "method", label: "Méthode", type: "select", options: ["GET", "POST", "PUT", "PATCH", "DELETE"] },
      { key: "url", label: "URL", type: "url", placeholder: "https://api.exemple.com/data" },
      { key: "headers", label: "En-têtes", type: "keyvalue" },
      { key: "body", label: "Corps (JSON)", type: "textarea", placeholder: '{"key": "value"}' },
      { key: "timeout", label: "Timeout (s)", type: "number" },
    ],
  },
  // --- Anciens types (projets existants) ---
  {
    kind: "source_csv",
    label: "Fichier CSV",
    category: "source",
    icon: "CSV",
    color: "#0d9488",
    description: "Tableur séparé par virgules ou point-virgules",
    defaultConfig: { delimiter: "auto" },
    hidden: true,
    fields: [
      { key: "file", label: "Fichier", type: "file", accept: ".csv,.txt,.tsv" },
      { key: "delimiter", label: "Séparateur", type: "text", placeholder: "," },
      { key: "content", label: "Ou collez vos données", type: "textarea" },
    ],
  },
  {
    kind: "source_json",
    label: "Fichier JSON",
    category: "source",
    icon: "JSON",
    color: "#0d9488",
    description: "Données structurées JSON",
    defaultConfig: {},
    hidden: true,
    fields: [
      { key: "file", label: "Fichier", type: "file", accept: ".json" },
      { key: "content", label: "Ou collez le JSON", type: "textarea" },
    ],
  },
  {
    kind: "source_sql_file",
    label: "Fichier SQL",
    category: "source",
    icon: "SQL",
    color: "#0d9488",
    description: "Export SQL ou base SQLite",
    defaultConfig: {},
    hidden: true,
    fields: [
      { key: "file", label: "Fichier", type: "file", accept: ".sql,.sqlite,.sqlite3,.db" },
      { key: "table", label: "Table", type: "text" },
    ],
  },
  {
    kind: "filter",
    label: "Garder certaines lignes",
    category: "transform",
    icon: "🔍",
    color: "#3b82f6",
    description: "Ne conserver que les lignes qui vous intéressent",
    defaultConfig: { expression: "" },
    fields: [
      {
        key: "expression",
        label: "Condition",
        type: "text",
        placeholder: "montant > 1000",
        help: "Exemple : agence == 'Douala' and montant > 50000",
      },
    ],
  },
  {
    kind: "select",
    label: "Choisir des colonnes",
    category: "transform",
    icon: "📋",
    color: "#3b82f6",
    description: "Ne garder que les colonnes utiles",
    defaultConfig: { columns: [] },
    fields: [{ key: "columns", label: "Colonnes à conserver", type: "columns" }],
  },
  {
    kind: "rename",
    label: "Renommer des colonnes",
    category: "transform",
    icon: "✏️",
    color: "#3b82f6",
    description: "Donner des noms plus clairs à vos colonnes",
    defaultConfig: { mapping: {} },
    fields: [{ key: "mapping", label: "Ancien nom → Nouveau nom", type: "keyvalue" }],
  },
  {
    kind: "sort",
    label: "Trier",
    category: "transform",
    icon: "↕️",
    color: "#3b82f6",
    description: "Classer les lignes par ordre croissant ou décroissant",
    defaultConfig: { by: "", ascending: true },
    fields: [
      { key: "by", label: "Colonne de tri", type: "text", placeholder: "date" },
      { key: "ascending", label: "Ordre croissant", type: "boolean" },
    ],
  },
  {
    kind: "aggregate",
    label: "Résumer par groupe",
    category: "transform",
    icon: "📊",
    color: "#3b82f6",
    description: "Calculer des totaux, moyennes… par catégorie",
    defaultConfig: { groupBy: [], aggregations: {} },
    fields: [
      { key: "groupBy", label: "Regrouper par", type: "columns" },
      {
        key: "aggregations",
        label: "Calculs (colonne → fonction)",
        type: "keyvalue",
        help: "Fonctions : sum, mean, count, min, max…",
      },
    ],
  },
  {
    kind: "dedupe",
    label: "Supprimer les doublons",
    category: "transform",
    icon: "🧹",
    color: "#3b82f6",
    description: "Éliminer les lignes en double",
    defaultConfig: { columns: [] },
    fields: [{ key: "columns", label: "Colonnes clés (vide = toutes)", type: "columns" }],
  },
  {
    kind: "join",
    label: "Fusionner deux tableaux",
    category: "transform",
    icon: "🔗",
    color: "#6366f1",
    description: "Relier deux sources sur une colonne commune",
    defaultConfig: { how: "inner", on: "" },
    fields: [
      { key: "how", label: "Type de fusion", type: "select", options: ["inner", "left", "right", "outer"] },
      { key: "on", label: "Colonne commune", type: "text", placeholder: "id_client" },
    ],
  },
  {
    kind: "lookup",
    label: "Lookup / enrichissement",
    category: "transform",
    icon: "🔎",
    color: "#6366f1",
    description: "Enrichir avec une table de référence (Talend)",
    defaultConfig: { how: "left", on: "" },
    fields: [
      { key: "on", label: "Colonne clé", type: "text", placeholder: "code_pays" },
      { key: "how", label: "Type", type: "select", options: ["left", "inner"] },
    ],
  },
  {
    kind: "union",
    label: "Union / empiler",
    category: "transform",
    icon: "📚",
    color: "#6366f1",
    description: "Concaténer plusieurs flux (2+ entrées)",
    defaultConfig: { ignoreIndex: true },
    fields: [
      { key: "ignoreIndex", label: "Réindexer les lignes", type: "boolean" },
    ],
  },
  {
    kind: "cast",
    label: "Conversion de types",
    category: "transform",
    icon: "🔢",
    color: "#3b82f6",
    description: "Caster colonnes (int, float, date, texte…)",
    defaultConfig: { casts: {} },
    fields: [
      {
        key: "casts",
        label: "Colonne → type",
        type: "keyvalue",
        help: "Types : int, float, str, bool, date",
      },
    ],
  },
  {
    kind: "split",
    label: "Découper une colonne",
    category: "transform",
    icon: "✂️",
    color: "#3b82f6",
    description: "Séparer une colonne texte en plusieurs",
    defaultConfig: { column: "", delimiter: ",", maxColumns: 5 },
    fields: [
      { key: "column", label: "Colonne source", type: "text" },
      { key: "delimiter", label: "Séparateur", type: "text", placeholder: "," },
      { key: "maxColumns", label: "Nb max colonnes", type: "number" },
    ],
  },
  {
    kind: "pivot",
    label: "Table croisée",
    category: "transform",
    icon: "📈",
    color: "#3b82f6",
    description: "Pivoter lignes en colonnes (Talend)",
    defaultConfig: { index: "", columns: "", values: "", aggfunc: "sum" },
    fields: [
      { key: "index", label: "Index (lignes)", type: "text" },
      { key: "columns", label: "Colonnes pivot", type: "text" },
      { key: "values", label: "Valeurs", type: "text" },
      { key: "aggfunc", label: "Agrégation", type: "select", options: ["sum", "mean", "count", "min", "max"] },
    ],
  },
  {
    kind: "validate",
    label: "Règles de validation",
    category: "transform",
    icon: "✅",
    color: "#16a34a",
    description: "Contrôles qualité métier (Talend DQ)",
    defaultConfig: { mode: "reject", rules: [] },
    fields: [
      { key: "mode", label: "Mode", type: "select", options: ["reject", "warn", "flag"] },
      {
        key: "rules",
        label: "Règles JSON",
        type: "rules",
        help: '[{"column":"montant","rule":"min","value":0},{"column":"email","rule":"regex","value":".+@.+"}]',
      },
    ],
  },
  {
    kind: "branch",
    label: "Branchement IF",
    category: "transform",
    icon: "🔀",
    color: "#8b5cf6",
    description: "Route les lignes vers Vrai ou Faux (n8n)",
    defaultConfig: { expression: "" },
    fields: [
      {
        key: "expression",
        label: "Condition",
        type: "text",
        placeholder: "montant > 1000",
        help: "Connectez la sortie « vrai » ou « faux » aux étapes suivantes.",
      },
    ],
  },
  {
    kind: "sql",
    label: "Requête SQL",
    category: "transform",
    icon: "💬",
    color: "#6366f1",
    description: "Interroger vos données en langage SQL",
    defaultConfig: { query: "SELECT * FROM input" },
    fields: [
      {
        key: "query",
        label: "Votre requête",
        type: "code",
        placeholder: "SELECT * FROM input WHERE montant > 1000",
      },
    ],
  },
  {
    kind: "custom",
    label: "Transformation avancée",
    category: "transform",
    icon: "⚙️",
    color: "#6366f1",
    description: "Personnaliser avec du code Python",
    defaultConfig: { code: "" },
    fields: [
      {
        key: "code",
        label: "Instructions",
        type: "code",
        placeholder: "df = df[df['rendement'] > 1000]",
        help: "Les données arrivent dans la variable `df`.",
      },
    ],
  },
  // --- Intelligence agricole (embeddings, causal, prédiction) ---
  {
    kind: "embed_text",
    label: "Embedding sémantique",
    category: "intelligence",
    icon: "🧬",
    color: "#2A9D8F",
    description: "Vectorise le sens du texte et étiquette le domaine agricole. À placer juste après la source.",
    defaultConfig: { textColumn: "", dimensions: 6, label: "source" },
    fields: [
      { key: "textColumn", label: "Colonne texte (optionnel)", type: "text", placeholder: "contenu" },
      { key: "label", label: "Libellé source", type: "text", placeholder: "Prix maïs Abidjan" },
      { key: "dimensions", label: "Dimensions embedding", type: "number" },
    ],
  },
  {
    kind: "agri_classify",
    label: "Classification agricole",
    category: "intelligence",
    icon: "🌾",
    color: "#388E3C",
    description: "Étiquette le type de données (prix, production…). Mode « annotate » obligatoire avant causal.",
    defaultConfig: { mode: "annotate", label: "source" },
    fields: [
      {
        key: "mode",
        label: "Mode",
        type: "select",
        options: ["annotate", "summary"],
        help: "annotate : conserve toutes les lignes (requis avant Analyse causale / Prédiction). summary : une seule ligne récap.",
      },
      { key: "label", label: "Libellé source", type: "text" },
    ],
  },
  {
    kind: "causal_analysis",
    label: "Analyse causale",
    category: "intelligence",
    icon: "🔀",
    color: "#0D2C54",
    description: "Quelles colonnes influencent la cible ? Cible ≠ explicatives. Date laissée vide si absent.",
    defaultConfig: { targetColumn: "", timeColumn: "", maxLag: 3 },
    fields: [
      { key: "targetColumn", label: "Variable cible", type: "column", placeholder: "rendement", help: "Ce que vous voulez expliquer (ex. evolution_marche_agricole). Texte accepté — converti automatiquement." },
      { key: "featureColumns", label: "Variables explicatives", type: "columns", help: "Causes possibles — choisissez 1 à 3 colonnes DIFFÉRENTES de la cible (ex. entites_intervenantes, region)." },
      { key: "timeColumn", label: "Colonne date (optionnel)", type: "column", placeholder: "date", help: "Laissez vide si vous n'avez pas de dates. Ne mettez pas une colonne texte ici." },
      { key: "maxLag", label: "Retard max (séries)", type: "number" },
    ],
  },
  {
    kind: "predict",
    label: "Prédiction / prévision",
    category: "intelligence",
    icon: "📈",
    color: "#E9C46A",
    description: "Branchez sur la source CSV (pas après causal). Texte et catégories OK.",
    defaultConfig: { mode: "regression", targetColumn: "", horizon: 5 },
    fields: [
      {
        key: "mode",
        label: "Mode",
        type: "select",
        options: ["regression", "forecast"],
        help: "régression : prédire une colonne à partir d'autres · prévision : tendance future (date auto si absente)",
      },
      {
        key: "targetColumn",
        label: "Colonne cible",
        type: "column",
        placeholder: "message",
        help: "Texte, catégories ou nombres acceptés (encodage automatique).",
      },
      {
        key: "featureColumns",
        label: "Variables explicatives",
        type: "columns",
        help: "Régression uniquement — colonnes différentes de la cible (texte OK).",
      },
      {
        key: "timeColumn",
        label: "Colonne date (prévision)",
        type: "column",
        placeholder: "date",
        help: "Optionnel : détectée auto, sinon prévision par numéro de ligne.",
      },
      { key: "horizon", label: "Horizon prévision", type: "number" },
    ],
  },
  {
    kind: "output",
    label: "Résultat final",
    category: "output",
    icon: "✅",
    color: "#d97706",
    description: "Destination des données prêtes à l'emploi",
    defaultConfig: { format: "csv", filename: "resultat", tableName: "dataset" },
    fields: [
      {
        key: "format",
        label: "Format de stockage",
        type: "select",
        options: ["csv", "json", "jsonl", "sqlite", "parquet"],
        help: "Format utilisé lors du téléchargement (onglet Exporter).",
      },
      { key: "filename", label: "Nom du fichier", type: "text", placeholder: "resultat" },
      { key: "tableName", label: "Table (SQLite)", type: "text", placeholder: "dataset" },
    ],
  },
];

export const SPEC_BY_KIND: Record<string, NodeSpec> = Object.fromEntries(
  NODE_SPECS.map((s) => [s.kind, s])
);

export const PALETTE_SPECS = NODE_SPECS.filter((s) => !s.hidden);
