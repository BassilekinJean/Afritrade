import { useEffect, useState } from "react";
import { getProject, listProjects } from "../api/projects";
import AIButton from "./AIButton";
import { classifySources, runIntelligence } from "../api/intelligence";
import type { ClassifyResponse, IntelligenceResponse, Project, ProjectSummary } from "../types";

const DOMAIN_COLORS: Record<string, string> = {
  production: "bg-green-100 text-green-800",
  prix_marche: "bg-amber-100 text-amber-800",
  meteo_climat: "bg-sky-100 text-sky-800",
  intrants_logistique: "bg-orange-100 text-orange-800",
  cooperative_commerce: "bg-indigo-100 text-indigo-800",
  nutrition_securite: "bg-rose-100 text-rose-800",
  sante_sols: "bg-emerald-100 text-emerald-800",
  politique_subventions: "bg-violet-100 text-violet-800",
};

export default function AnalyticsPanel() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectId, setProjectId] = useState("");
  const [project, setProject] = useState<Project | null>(null);
  const [targetColumn, setTargetColumn] = useState("");
  const [timeColumn, setTimeColumn] = useState("");
  const [joinColumn, setJoinColumn] = useState("");
  const [mode, setMode] = useState<"causal" | "predict" | "forecast">("causal");
  const [classifyReport, setClassifyReport] = useState<ClassifyResponse | null>(null);
  const [intelReport, setIntelReport] = useState<IntelligenceResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    listProjects().then((ps) => {
      setProjects(ps);
      if (ps.length) setProjectId(ps[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!projectId) return;
    getProject(projectId).then(setProject).catch(() => setProject(null));
  }, [projectId]);

  const sourceNodes = (project?.graph?.nodes || []).filter((n: { data?: { kind?: string } }) =>
    String(n.data?.kind || "").startsWith("source_"),
  );

  const sourcesPayload = sourceNodes.map((n: { id: string; data: { kind: string; label?: string; config?: Record<string, unknown> } }) => ({
    id: n.id,
    type: n.data.kind,
    label: n.data.label,
    config: n.data.config || {},
  }));

  const runClassify = async () => {
    if (!sourcesPayload.length) {
      setErr("Ouvrez un projet avec au moins une source importée.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      setClassifyReport(await classifySources(sourcesPayload));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Classification impossible.");
    } finally {
      setBusy(false);
    }
  };

  const runIntel = async () => {
    if (!sourcesPayload.length) {
      setErr("Au moins une source requise.");
      return;
    }
    if (!targetColumn.trim()) {
      setErr("Indiquez la colonne cible (ex : rendement, prix).");
      return;
    }
    if (mode === "forecast" && !timeColumn.trim()) {
      setErr("Mode prévision : indiquez la colonne date.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      setIntelReport(
        await runIntelligence({
          sources: sourcesPayload,
          targetColumn: targetColumn.trim(),
          timeColumn: timeColumn.trim() || undefined,
          joinColumn: joinColumn.trim() || undefined,
          mode,
        }),
      );
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Analyse impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-edge bg-surface shadow-sm">
      <div className="border-b border-edge px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-brand-blue">Analyse causale &amp; prédiction</h2>
            <p className="mt-1 text-sm text-slate-600">
              Classification sémantique agricole (embeddings TF-IDF) et analyse multi-sources pour
              identifier causes et tendances.
            </p>
          </div>
          <AIButton
            variant="primary"
            label="Générer transformation"
            prompt="Analyser corrélation entre prix et rendement agricole par région, préparer données pour analyse causale"
          />
        </div>
      </div>

      <div className="grid gap-6 p-6 lg:grid-cols-2">
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-ink">1. Projet &amp; sources</h3>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full rounded-lg border border-edge px-3 py-2 text-sm"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
          <p className="text-xs text-slate-500">
            {sourceNodes.length} source{sourceNodes.length !== 1 ? "s" : ""} détectée{sourceNodes.length !== 1 ? "s" : ""} dans le graphe.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={runClassify}
            className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "…" : "Classifier les sources (embeddings)"}
          </button>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-ink">2. Analyse &amp; prédiction</h3>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as typeof mode)}
            className="w-full rounded-lg border border-edge px-3 py-2 text-sm"
          >
            <option value="causal">Analyse causale (corrélations)</option>
            <option value="predict">Prédiction (régression)</option>
            <option value="forecast">Prévision (série temporelle)</option>
          </select>
          <input
            value={targetColumn}
            onChange={(e) => setTargetColumn(e.target.value)}
            placeholder="Colonne cible (ex : rendement, prix_kg)"
            className="w-full rounded-lg border border-edge px-3 py-2 text-sm"
          />
          {mode === "forecast" && (
            <input
              value={timeColumn}
              onChange={(e) => setTimeColumn(e.target.value)}
              placeholder="Colonne date (ex : date, mois)"
              className="w-full rounded-lg border border-edge px-3 py-2 text-sm"
            />
          )}
          {sourceNodes.length > 1 && (
            <input
              value={joinColumn}
              onChange={(e) => setJoinColumn(e.target.value)}
              placeholder="Colonne de jointure (optionnel)"
              className="w-full rounded-lg border border-edge px-3 py-2 text-sm"
            />
          )}
          <button
            type="button"
            disabled={busy}
            onClick={runIntel}
            className="w-full rounded-xl bg-brand-blue py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "…" : "Lancer l'analyse"}
          </button>
        </section>
      </div>

      {err && (
        <div className="mx-6 mb-4 rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">{err}</div>
      )}

      {classifyReport && (
        <div className="border-t border-edge px-6 py-5">
          <h3 className="mb-3 text-sm font-semibold text-ink">Classification agricole</h3>
          <div className="mb-4 flex flex-wrap gap-2">
            {Object.entries(classifyReport.summary.domains).map(([d, n]) => (
              <span key={d} className={`rounded-full px-2 py-1 text-xs font-medium ${DOMAIN_COLORS[d] || "bg-muted text-slate-700"}`}>
                {d} ({n})
              </span>
            ))}
          </div>
          <div className="space-y-3">
            {classifyReport.sources.map((s) => (
              <div key={s.id} className="rounded-xl border border-edge p-3 text-sm">
                <p className="font-semibold text-ink">{s.label}</p>
                {s.classification ? (
                  <p className="mt-1 text-slate-600">
                    {s.classification.domainLabel} — confiance {(s.classification.confidence * 100).toFixed(0)}%
                    {s.classification.agriKeywords?.length ? (
                      <span className="ml-2 text-xs text-accent">({s.classification.agriKeywords.join(", ")})</span>
                    ) : null}
                  </p>
                ) : (
                  <p className="text-bad text-xs">{s.error}</p>
                )}
              </div>
            ))}
          </div>
          {classifyReport.crossSourceLinks.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-semibold text-slate-700">Liens inter-sources</h4>
              <ul className="mt-2 space-y-2">
                {classifyReport.crossSourceLinks.map((l, i) => (
                  <li key={i} className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-slate-700">
                    <strong>{l.sourceA}</strong> ↔ <strong>{l.sourceB}</strong>
                    {l.causalHypothesis && <p className="mt-1 text-accent">{l.causalHypothesis}</p>}
                    {l.commonColumns.length > 0 && (
                      <p className="text-slate-500">Colonnes communes : {l.commonColumns.join(", ")}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {classifyReport.fusionSuggestions.length > 0 && (
            <div className="mt-4 rounded-xl border border-dashed border-accent/40 bg-accent/5 p-3">
              <h4 className="text-xs font-semibold text-accent">Pipelines suggérés</h4>
              {classifyReport.fusionSuggestions.map((f, i) => (
                <p key={i} className="mt-1 text-xs text-slate-700">
                  {f.goal} — {f.sources.join(" + ")} ({f.method})
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {intelReport && (
        <div className="border-t border-edge px-6 py-5">
          <h3 className="mb-3 text-sm font-semibold text-ink">Résultats {intelReport.mode || mode}</h3>
          {intelReport.topDrivers && intelReport.topDrivers.length > 0 && (
            <div className="space-y-2">
              {intelReport.topDrivers.map((l, i) => (
                <div key={i} className="rounded-lg border border-edge px-3 py-2 text-xs">
                  <span className="font-semibold">{l.feature}</span> → {l.target}
                  <span className="ml-2 text-accent">r={l.correlation}</span>
                  <p className="mt-1 text-slate-600">{l.interpretation}</p>
                </div>
              ))}
            </div>
          )}
          {intelReport.metrics && (
            <p className="mt-2 text-xs text-slate-600">
              MAE entraînement : {intelReport.metrics.trainMae}
              {intelReport.metrics.testMae != null && ` · MAE test : ${intelReport.metrics.testMae}`}
            </p>
          )}
          {intelReport.trend && (
            <p className="mt-2 text-xs text-accent">Tendance prévision : {intelReport.trend}</p>
          )}
          {intelReport.preview && intelReport.preview.rows.length > 0 && (
            <p className="mt-2 text-xs text-slate-500">
              {intelReport.preview.rowCount} lignes · colonnes : {intelReport.preview.columns.slice(0, 6).join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
