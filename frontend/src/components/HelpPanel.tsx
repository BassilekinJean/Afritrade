import { useState } from "react";
import {
  COMMON_ERRORS,
  HELP_SECTIONS,
  NODE_HELP,
  PIPELINE_EXAMPLES,
  SYNTAX_REFERENCE,
  getNodeHelp,
  type HelpSectionId,
} from "../content/helpGuide";
import AIButton from "./AIButton";

interface Props {
  initialSection?: HelpSectionId;
  compact?: boolean;
  highlightNode?: string;
}

export default function HelpPanel({ initialSection = "overview", compact = false, highlightNode }: Props) {
  const [section, setSection] = useState<HelpSectionId>(
    highlightNode && NODE_HELP[highlightNode] ? "nodes" : initialSection,
  );
  const [nodeFilter, setNodeFilter] = useState(highlightNode ?? "");

  return (
    <div className={`flex ${compact ? "min-h-[480px]" : "min-h-[70vh]"} rounded-2xl border border-edge bg-surface shadow-sm overflow-hidden`}>
      <nav className="w-52 shrink-0 border-r border-edge bg-brand-cream/80 p-3 overflow-y-auto">
        <p className="brand-kicker mb-3 px-1">Centre d&apos;aide</p>
        {HELP_SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            className={`mb-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition ${
              section === s.id
                ? "bg-brand-blue text-white shadow-sm"
                : "text-slate-700 hover:bg-white/80"
            }`}
          >
            <span>{s.icon}</span>
            {s.title}
          </button>
        ))}
      </nav>

      <div className="min-w-0 flex-1 overflow-y-auto p-6 text-sm text-slate-800">
        {section === "overview" && <OverviewSection />}
        {section === "workflow" && <WorkflowSection />}
        {section === "features" && <FeaturesSection />}
        {section === "nodes" && (
          <NodesSection nodeFilter={nodeFilter} onFilter={setNodeFilter} />
        )}
        {section === "intelligence" && <IntelligenceSection />}
        {section === "syntax" && <SyntaxSection />}
        {section === "examples" && <ExamplesSection />}
        {section === "errors" && <ErrorsSection />}
      </div>
    </div>
  );
}

/** Encart compact pour le panneau Paramètres d'un nœud */
export function NodeHelpBanner({ kind }: { kind: string }) {
  const help = getNodeHelp(kind);
  if (!help) return null;
  return (
    <div className="mx-4 mt-3 rounded-xl border border-accent/25 bg-accent/5 px-3 py-3 text-xs text-slate-800">
      <p className="font-bold text-brand-blue">{help.title}</p>
      <p className="mt-1 text-slate-600">{help.role}</p>
      <ol className="mt-2 list-decimal space-y-1 pl-4 text-slate-700">
        {help.howTo.slice(0, 3).map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
      {help.avoid && help.avoid.length > 0 && (
        <p className="mt-2 text-warn">
          <strong>À éviter :</strong> {help.avoid[0]}
        </p>
      )}
    </div>
  );
}

function OverviewSection() {
  return (
    <article className="prose prose-sm max-w-none">
      <h2 className="text-xl font-bold text-brand-blue">Aaprovidir DataPipe — Idée générale</h2>
      <p>
        Plateforme <strong>ETL visuelle</strong> pour la chaîne de valeur agricole africaine :
        importer des données hétérogènes (CSV, web, bases), les transformer par glisser-déposer,
        analyser leur qualité, détecter des <strong>liens causaux</strong> et produire des{" "}
        <strong>prévisions</strong>.
      </p>
      <h3 className="mt-6 font-semibold text-brand-blue">Public visé</h3>
      <ul className="list-disc pl-5 space-y-1">
        <li>Analystes agricoles, coopératives, ONG, équipes data Aaprovidir</li>
        <li>Pas besoin de coder : pipeline = blocs reliés sur un canvas</li>
      </ul>
      <h3 className="mt-6 font-semibold text-brand-blue">Inspirations</h3>
      <p>
        <strong>Talend</strong> (ETL enterprise, jointures, qualité) + <strong>n8n</strong>{" "}
        (webhooks, cron, automation).
      </p>
      <h3 className="mt-6 font-semibold text-brand-blue">Thème scientifique</h3>
      <p>
        Système d&apos;<strong>analyse causale et de prédiction</strong> à partir de sources
        multiples : prix, météo, production, géopolitique agricole…
      </p>
      <div className="mt-6 not-prose">
        <AIButton
          variant="primary"
          label="Ouvrir l'assistant IA"
          prompt="Guide-moi pour construire mon premier pipeline agricole sur Aaprovidir DataPipe"
        />
      </div>
    </article>
  );
}

function WorkflowSection() {
  const steps = [
    {
      n: 1,
      title: "Importer",
      desc: "Fichier, URL ou base de données. Séparateur CSV = Auto. Les sources apparaissent sur le canvas.",
      tip: "Minimum 1 source avant d'exécuter.",
    },
    {
      n: 2,
      title: "Qualité",
      desc: "Analyse automatique + domaine agricole (embeddings). Normalisation optionnelle.",
      tip: "Badge vert = domaine détecté (prix, production…).",
    },
    {
      n: 3,
      title: "Canvas — Pipeline",
      desc: "Glissez des nœuds depuis la palette gauche. Reliez source → transformations → Résultat final.",
      tip: "Cliquez un nœud → Paramètres à droite pour le configurer.",
    },
    {
      n: 4,
      title: "Exécuter & Exporter",
      desc: "Bouton Exécuter (header). Aperçu des données par nœud. Onglet Exporter pour télécharger.",
      tip: "Rouge = lire le message et corriger l'étape indiquée.",
    },
  ];
  return (
    <div>
      <h2 className="text-xl font-bold text-brand-blue">Parcours en 4 étapes</h2>
      <div className="mt-4 space-y-4">
        {steps.map((s) => (
          <div key={s.n} className="rounded-xl border border-edge bg-brand-cream/40 p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-blue text-sm font-bold text-white">
                {s.n}
              </span>
              <h3 className="font-semibold text-ink">{s.title}</h3>
            </div>
            <p className="mt-2 text-slate-700">{s.desc}</p>
            <p className="mt-2 text-xs text-accent">
              <strong>Astuce :</strong> {s.tip}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeaturesSection() {
  const items = [
    {
      title: "Projets",
      role: "Créer / ouvrir un pipeline ETL sauvegardé.",
    },
    {
      title: "Exécutions",
      role: "Historique des runs, durée, logs par nœud.",
    },
    {
      title: "Connexions",
      role: "Bases réutilisables (SQLite, PostgreSQL…) — style Talend.",
    },
    {
      title: "Analytiques",
      role: "Classification multi-sources + analyse causale / prédiction globale.",
    },
    {
      title: "Automation (dans l'éditeur)",
      role: "Webhooks POST publics et planification cron.",
    },
    {
      title: "Assistant IA",
      role: "Génère du code pandas ou SQL pour le nœud Transformation avancée.",
    },
  ];
  return (
    <div>
      <h2 className="text-xl font-bold text-brand-blue">Menus & fonctionnalités</h2>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item.title} className="rounded-lg border border-edge px-4 py-3">
            <strong className="text-brand-blue">{item.title}</strong>
            <p className="mt-1 text-slate-600">{item.role}</p>
            {item.title === "Assistant IA" && (
              <div className="mt-2">
                <AIButton variant="chip" label="Essayer maintenant" prompt="Générer une transformation pandas pour données agricoles" />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function NodesSection({
  nodeFilter,
  onFilter,
}: {
  nodeFilter: string;
  onFilter: (v: string) => void;
}) {
  const entries = Object.entries(NODE_HELP);
  const filtered = nodeFilter
    ? entries.filter(([k]) => k === nodeFilter || NODE_HELP[k]?.title.toLowerCase().includes(nodeFilter.toLowerCase()))
    : entries;

  return (
    <div>
      <h2 className="text-xl font-bold text-brand-blue">Nœuds du pipeline</h2>
      <input
        value={nodeFilter}
        onChange={(e) => onFilter(e.target.value)}
        placeholder="Rechercher un nœud…"
        className="mt-3 w-full max-w-md rounded-lg border border-edge px-3 py-2 text-sm"
      />
      <div className="mt-4 space-y-4">
        {filtered.map(([kind, h]) => (
          <NodeHelpCard key={kind} kind={kind} help={h} />
        ))}
      </div>
    </div>
  );
}

function NodeHelpCard({ kind, help }: { kind: string; help: ReturnType<typeof getNodeHelp> }) {
  if (!help) return null;
  return (
    <div className="rounded-xl border border-edge p-4">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{kind}</p>
      <h3 className="font-bold text-brand-blue">{help.title}</h3>
      <p className="mt-1 text-slate-600">{help.role}</p>
      <p className="mt-2 text-xs font-semibold text-slate-700">Comment faire :</p>
      <ol className="mt-1 list-decimal space-y-1 pl-4 text-sm text-slate-700">
        {help.howTo.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      {help.syntax && (
        <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 px-3 py-2 text-xs text-green-300">
          {help.syntax}
        </pre>
      )}
      {help.example && (
        <p className="mt-2 text-xs text-accent">
          <strong>Exemple :</strong> {help.example}
        </p>
      )}
      {help.avoid && (
        <ul className="mt-2 list-disc pl-4 text-xs text-warn">
          {help.avoid.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function IntelligenceSection() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-brand-blue">Intelligence agricole</h2>

      <section className="rounded-xl border border-edge p-4">
        <h3 className="font-semibold">Schéma de branchement recommandé</h3>
        <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs leading-relaxed">
{`CSV (643 lignes)
 ├── Embedding → Classification (annotate) → Analyse causale → Résultat
 └── Prédiction (forecast ou regression) → Résultat

⚠️ Ne pas : Analyse causale → Prédiction (il ne reste qu'1 ligne)`}
        </pre>
      </section>

      <section className="rounded-xl border border-accent/20 bg-accent/5 p-4">
        <h3 className="font-semibold text-brand-blue">Analyse causale</h3>
        <table className="mt-2 w-full text-xs">
          <tbody>
            <tr><td className="py-1 font-medium">Variable cible</td><td>Ce qu&apos;on explique</td></tr>
            <tr><td className="py-1 font-medium">Explicatives</td><td>1–3 colonnes ≠ cible</td></tr>
            <tr><td className="py-1 font-medium">Date</td><td>Vide sauf vraie colonne date</td></tr>
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border border-edge p-4">
        <h3 className="font-semibold">Prédiction</h3>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
          <li><strong>regression</strong> : prédire cible à partir d&apos;autres colonnes</li>
          <li><strong>forecast</strong> : tendance future (date auto ou numéro de ligne)</li>
          <li>Texte OK : colonne <code>message</code>, catégories, nombres</li>
        </ul>
      </section>
    </div>
  );
}

function SyntaxSection() {
  return (
    <div>
      <h2 className="text-xl font-bold text-brand-blue">Syntaxe & règles</h2>
      <div className="mt-4 space-y-4">
        {SYNTAX_REFERENCE.map((block) => (
          <div key={block.title} className="rounded-xl border border-edge p-4">
            <h3 className="font-semibold">{block.title}</h3>
            <ul className="mt-2 space-y-1 font-mono text-xs text-slate-700">
              {block.items.map((line, i) => (
                <li key={i} className="rounded bg-muted/50 px-2 py-1">{line}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExamplesSection() {
  return (
    <div>
      <h2 className="text-xl font-bold text-brand-blue">Exemples de pipelines</h2>
      <div className="mt-4 space-y-4">
        {PIPELINE_EXAMPLES.map((ex) => (
          <div key={ex.title} className="rounded-xl border border-edge p-4">
            <h3 className="font-semibold text-brand-blue">{ex.title}</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-slate-700">
              {ex.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorsSection() {
  return (
    <div>
      <h2 className="text-xl font-bold text-brand-blue">Erreurs fréquentes</h2>
      <div className="mt-4 space-y-3">
        {COMMON_ERRORS.map((e, i) => (
          <div key={i} className="rounded-xl border border-bad/20 bg-red-50/50 p-4">
            <p className="text-sm font-semibold text-bad">{e.message}</p>
            <p className="mt-1 text-xs text-slate-600">
              <strong>Cause :</strong> {e.cause}
            </p>
            <p className="mt-1 text-xs text-good">
              <strong>Solution :</strong> {e.fix}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HelpLinkButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-brand border border-edge px-3 py-2 text-xs font-semibold text-brand-blue hover:bg-muted"
      title="Centre d'aide"
    >
      <span aria-hidden>?</span>
      Aide
    </button>
  );
}
