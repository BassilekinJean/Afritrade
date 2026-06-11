/** Contenu du centre d'aide Aaprovidir DataPipe */

export type HelpSectionId =
  | "overview"
  | "workflow"
  | "features"
  | "nodes"
  | "intelligence"
  | "syntax"
  | "examples"
  | "errors";

export interface HelpSection {
  id: HelpSectionId;
  title: string;
  icon: string;
}

export const HELP_SECTIONS: HelpSection[] = [
  { id: "overview", title: "Idée de l'app", icon: "🌾" },
  { id: "workflow", title: "Parcours en 4 étapes", icon: "📋" },
  { id: "features", title: "Menus & fonctionnalités", icon: "⚙️" },
  { id: "nodes", title: "Nœuds du pipeline", icon: "🔗" },
  { id: "intelligence", title: "Intelligence agricole", icon: "🧠" },
  { id: "syntax", title: "Syntaxe & règles", icon: "📝" },
  { id: "examples", title: "Exemples complets", icon: "💡" },
  { id: "errors", title: "Erreurs fréquentes", icon: "⚠️" },
];

export interface NodeHelp {
  title: string;
  role: string;
  howTo: string[];
  config?: { field: string; tip: string }[];
  syntax?: string;
  example?: string;
  avoid?: string[];
}

export const NODE_HELP: Record<string, NodeHelp> = {
  source_file: {
    title: "Fichier source",
    role: "Point d'entrée : importe un CSV, Excel, JSON, PDF, etc.",
    howTo: [
      "Onglet Importer → glissez votre fichier ou cliquez pour parcourir.",
      "Séparateur CSV : laissez « Auto » (recommandé).",
      "Le nœud apparaît sur le canvas : reliez-le aux étapes suivantes.",
    ],
    config: [{ field: "Séparateur", tip: "Auto détecte ; ou ; pour fichiers français, , pour anglais." }],
    example: "analyse_prix_mais.csv → 643 lignes importées",
  },
  embed_text: {
    title: "Embedding sémantique",
    role: "Comprend le sens du texte et ajoute le domaine agricole (_agri_domain).",
    howTo: [
      "Placez-le juste après la source.",
      "Colonne texte : laissez vide pour analyser tout le jeu, ou indiquez « contenu » / « message ».",
      "Ne pas placer après Analyse causale (1 seule ligne).",
    ],
    example: "643 lignes → colonnes _agri_domain, _agri_confidence ajoutées",
  },
  agri_classify: {
    title: "Classification agricole",
    role: "Identifie le type de données : production, prix, météo, coopérative…",
    howTo: [
      "Mode annotate : garde toutes les lignes (obligatoire avant causal/prédiction).",
      "Mode summary : 1 ligne récap — uniquement pour rapport, pas pour la suite du pipeline.",
    ],
    config: [{ field: "Mode", tip: "Toujours « annotate » sauf export de résumé seul." }],
  },
  causal_analysis: {
    title: "Analyse causale",
    role: "Trouve quelles colonnes influencent une autre (corrélations).",
    howTo: [
      "Variable cible : ce que vous voulez expliquer (ex. evolution_marche_agricole).",
      "Variables explicatives : 1 à 3 colonnes DIFFÉRENTES de la cible.",
      "Colonne date : laissez vide sauf si vous avez une vraie colonne date.",
      "Texte et catégories acceptés (conversion automatique).",
    ],
    avoid: [
      "Ne pas mettre la même colonne en cible et en explicative.",
      "Ne pas mettre produits_echanges en colonne date.",
    ],
    example: "Cible: evolution_marche_agricole · Explicatives: entites_intervenantes, produits_echanges",
  },
  predict: {
    title: "Prédiction / prévision",
    role: "Estime une tendance ou une valeur future (régression ou prévision).",
    howTo: [
      "Branchez DIRECTEMENT sur la source CSV (643 lignes), pas après Analyse causale.",
      "Mode regression : cible + variables explicatives (≠ cible).",
      "Mode forecast : cible uniquement ; date optionnelle (auto si absente).",
      "Texte et catégories acceptés.",
    ],
    avoid: [
      "Après Analyse causale → erreur « pas assez de lignes ».",
      "Cible = explicative en régression → invalide.",
    ],
    example: "forecast · cible: message · horizon: 5 · date: vide",
  },
  filter: {
    title: "Filtrer des lignes",
    role: "Garde uniquement les lignes qui respectent une condition.",
    howTo: ["Cliquez le nœud → Paramètres → Expression."],
    syntax: "Syntaxe pandas query : region == 'Abidjan' and prix > 100",
    example: "culture == 'mais' and rendement > 2.0",
  },
  branch: {
    title: "Branchement IF",
    role: "Envoie les lignes vers deux chemins : Vrai ou Faux.",
    howTo: [
      "Définissez une condition comme pour Filtre.",
      "Connectez la sortie « vrai » ou « faux » (poignées du nœud) aux étapes suivantes.",
    ],
    syntax: "montant > 1000  ou  evolution == 'Négatif'",
  },
  join: {
    title: "Jointure",
    role: "Fusionne deux sources sur une colonne commune.",
    howTo: [
      "Connectez DEUX sources ou transformations au nœud.",
      "Indiquez la colonne commune (ex. date, region, id).",
    ],
    config: [
      { field: "how", tip: "inner = intersection · left = tout à gauche + correspondances" },
      { field: "on", tip: "Nom exact de la colonne présente dans les deux flux" },
    ],
  },
  validate: {
    title: "Validation métier",
    role: "Vérifie la qualité (null, regex, min, max, liste de valeurs).",
    howTo: ["Collez un tableau JSON de règles dans Paramètres."],
    syntax: `[{"column":"prix","rule":"min","value":0},{"column":"culture","rule":"in_list","value":["mais","riz"]}]`,
  },
  output: {
    title: "Résultat final",
    role: "Destination des données ; utilisé pour l'export (onglet Exporter).",
    howTo: ["Reliez la dernière transformation. Choisissez le format CSV, JSON, etc."],
  },
};

export function getNodeHelp(kind: string): NodeHelp | undefined {
  return NODE_HELP[kind];
}

export const COMMON_ERRORS = [
  {
    message: "Indiquez targetColumn / Pas assez de lignes valides",
    cause: "Analyse causale ou Prédiction mal configurée.",
    fix: "Choisissez une variable cible dans Paramètres. Explicatives ≠ cible. Colonne date vide si pas de dates.",
  },
  {
    message: "Entrée en amont en échec",
    cause: "L'étape précédente est en rouge.",
    fix: "Corrigez la première erreur en remontant la chaîne (souvent la source CSV ou Analyse causale).",
  },
  {
    message: "Lecture CSV impossible / Expected N fields",
    cause: "Mauvais séparateur ou lignes de titre avant les données.",
    fix: "Réimportez avec séparateur Auto. Ou ; pour CSV français.",
  },
  {
    message: "Ce nœud reçoit le résumé de l'analyse causale",
    cause: "Prédiction branchée après Analyse causale (1 ligne).",
    fix: "Branchez Prédiction sur la source ou Classification agricole.",
  },
  {
    message: "Indiquez au moins une colonne prédictive",
    cause: "Mode régression sans variables explicatives.",
    fix: "Sélectionnez 1–3 colonnes ≠ cible, ou passez en mode forecast.",
  },
];

export const PIPELINE_EXAMPLES = [
  {
    title: "Pipeline BI agricole (votre cas)",
    steps: [
      "CSV analyse_bi_….csv",
      "→ Embedding sémantique",
      "→ Classification agricole (annotate)",
      "→ Analyse causale → Résultat final",
      "Branche parallèle : CSV → Prédiction (forecast, cible message) → Résultat",
    ],
  },
  {
    title: "Prix + production multi-sources",
    steps: [
      "Source prix_marche.csv + Source production.csv",
      "→ Jointure (on: date)",
      "→ Analyse causale (cible: rendement, explicatives: pluie_mm, prix_kg)",
      "→ Résultat final",
    ],
  },
  {
    title: "Automatisation webhook",
    steps: [
      "Déclencheur Webhook → Source → Transformations → Sortie",
      "Onglet Automation : créer URL webhook → POST externe déclenche le pipeline.",
    ],
  },
];

export const SYNTAX_REFERENCE = [
  {
    title: "Filtre / Branchement (pandas query)",
    items: [
      "colonne == 'valeur'",
      "prix > 100 and region == 'Abidjan'",
      "culture in ['mais', 'riz']",
      "rendement.notnull()",
    ],
  },
  {
    title: "SQL (nœud Requête SQL)",
    items: [
      "SELECT * FROM input WHERE prix > 100",
      "SELECT region, AVG(prix) AS moy FROM input GROUP BY region",
      "Table d'entrée toujours nommée : input",
    ],
  },
  {
    title: "Cron (planification)",
    items: ["0 8 * * * = tous les jours à 8h", "0 */6 * * * = toutes les 6 heures", "0 0 * * 1 = chaque lundi minuit"],
  },
  {
    title: "Validation (JSON)",
    items: [
      'rule: not_null | regex | min | max | in_list | unique',
      '{"column":"prix","rule":"min","value":0}',
    ],
  },
];
