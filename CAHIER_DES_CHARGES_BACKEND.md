# Cahier des Charges — Backend DataPipe

> **API & Moteur d'exécution ETL** pour l'interface nodale DataPipe.
> Document technique d'implémentation : *quoi* construire et *comment* le construire.

| Champ | Valeur |
|---|---|
| **Composant** | Backend (API REST + moteur d'exécution) |
| **Langage** | Python 3.11+ |
| **Framework** | FastAPI |
| **Moteur de données** | pandas |
| **Base (démo SQL)** | SQLite + SQLAlchemy |
| **Serveur** | Uvicorn |
| **Format d'échange** | JSON (REST) |

---

## 1. Rôle du backend

Le backend est le **cerveau d'exécution** de DataPipe. Le front (React Flow) ne fait que dessiner un graphe ; **toute la logique de données vit ici** :

1. **Recevoir** les fichiers sources (CSV / JSON) et les enregistrer.
2. **Recevoir** une description de pipeline (graphe de nœuds + liens en JSON).
3. **Exécuter** ce graphe : ordonner les nœuds, appliquer chaque transformation avec pandas, propager les données.
4. **Renvoyer** un aperçu des résultats et permettre l'**export**.
5. **(Bonus)** Générer du code de transformation via un **LLM** à partir de langage naturel.

Principe directeur : **un nœud du graphe = une fonction Python pure** qui prend un (ou deux) `DataFrame` en entrée et renvoie un `DataFrame`.

---

## 2. Architecture du backend

```
backend/
├── main.py                  # Point d'entrée FastAPI, montage des routes, CORS
├── requirements.txt
├── app/
│   ├── config.py            # Variables d'environnement, dossiers, clés API
│   ├── models/
│   │   └── schemas.py       # Modèles Pydantic (Pipeline, Node, Edge, requêtes/réponses)
│   ├── api/
│   │   ├── upload.py        # POST /api/upload
│   │   ├── sources.py       # GET /api/sources, /api/sources/{id}/schema
│   │   ├── pipeline.py      # POST /api/run, POST /api/preview-node
│   │   ├── export.py        # POST /api/export
│   │   └── ai.py            # POST /api/ai/generate  (bonus)
│   ├── engine/
│   │   ├── executor.py      # Tri topologique + exécution du graphe
│   │   ├── registry.py      # Table : type de nœud -> fonction
│   │   └── nodes/
│   │       ├── sources.py   # source_csv, source_json, source_sql
│   │       ├── transforms.py# filter, select, aggregate, join, custom
│   │       └── outputs.py    # output (aperçu / export)
│   ├── services/
│   │   ├── storage.py       # Lecture/écriture fichiers, cache des DataFrames
│   │   ├── sql_service.py   # Connexion SQLAlchemy (démo SQLite)
│   │   └── ai_service.py    # Appel LLM + garde-fous (bonus)
│   └── utils/
│       ├── csv_utils.py     # Détection séparateur/encodage, parsing FCFA/dates
│       └── errors.py        # Exceptions métier + handlers
├── data/
│   ├── uploads/             # Fichiers téléversés
│   └── samples/             # Jeux de données d'exemple bancaires
└── tests/
    └── test_engine.py
```

### Flux d'une requête d'exécution

```
Front  ──POST /api/run {nodes, edges}──▶  pipeline.py
                                              │
                                              ▼
                                        executor.py
                                   (tri topologique du graphe)
                                              │
                       pour chaque nœud, dans l'ordre :
                                              ▼
                              registry.py → fonction du nœud
                              (sources.py / transforms.py / outputs.py)
                                              │
                                   DataFrame propagé au(x) nœud(s) suivant(s)
                                              │
                                              ▼
                              Réponse JSON : {colonnes, lignes (aperçu), stats, erreurs}
```

---

## 3. Modèles de données (Pydantic)

Le backend valide tout via **Pydantic**. C'est le contrat partagé avec le front.

```python
# app/models/schemas.py
from pydantic import BaseModel
from typing import Any, Literal

class Node(BaseModel):
    id: str
    type: str                      # "source_csv", "filter", "aggregate", ...
    config: dict[str, Any] = {}    # paramètres propres au nœud

class Edge(BaseModel):
    source: str                    # id du nœud amont
    target: str                    # id du nœud aval
    target_input: int = 0          # 0 = entrée gauche, 1 = entrée droite (jointure)

class Pipeline(BaseModel):
    nodes: list[Node]
    edges: list[Edge]

class RunResponse(BaseModel):
    columns: list[str]
    rows: list[dict[str, Any]]     # aperçu (ex. 100 lignes)
    total_rows: int
    node_status: dict[str, str]    # id -> "ok" | "error" | "skipped"
    errors: dict[str, str] = {}    # id -> message d'erreur
```

---

## 4. Fonctionnalités à implémenter (et comment)

> Ordre d'implémentation recommandé pour le hackathon : **B1 → B2 → B3 → B4 → B5 → (B6) → (B7)**.

### B1. Téléversement de fichiers — `POST /api/upload`

**Quoi** : recevoir un CSV ou JSON, le stocker, renvoyer un `source_id` et le schéma détecté.

**Comment** :

- Endpoint multipart `UploadFile`.
- Écriture dans `data/uploads/{uuid}.{ext}`.
- Lecture via pandas pour inférer le schéma.
- Pour le CSV : détection auto du séparateur (`,` vs `;`) et de l'encodage.

```python
# app/api/upload.py
@router.post("/api/upload")
async def upload(file: UploadFile):
    source_id = str(uuid4())
    path = save_upload(file, source_id)           # storage.py
    df = read_any(path)                            # csv_utils / json
    storage.cache_df(source_id, df)                # garde le DataFrame en mémoire
    return {
        "source_id": source_id,
        "filename": file.filename,
        "columns": list(df.columns),
        "dtypes": {c: str(t) for c, t in df.dtypes.items()},
        "preview": df.head(10).to_dict(orient="records"),
        "row_count": len(df),
    }
```

**Détection CSV (csv_utils.py)** :

```python
def read_csv_smart(path: str) -> pd.DataFrame:
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        sample = f.read(4096)
    sep = ";" if sample.count(";") > sample.count(",") else ","
    return pd.read_csv(path, sep=sep, encoding="utf-8",
                       dtype_backend="numpy_nullable")
```

---

### B2. Moteur d'exécution du graphe — `app/engine/executor.py`

**Quoi** : transformer un graphe `{nodes, edges}` en exécution ordonnée et propager les DataFrames.

**Comment** :

1. **Construire** un dictionnaire des entrées de chaque nœud (depuis `edges`).
2. **Tri topologique** (Kahn) : détecte les cycles, donne l'ordre d'exécution.
3. Pour chaque nœud, appeler la fonction associée via le **registry** en lui passant ses DataFrames d'entrée et sa `config`.
4. Stocker la sortie dans un cache `node_id -> DataFrame`.
5. Capturer les erreurs **par nœud** (un nœud en erreur n'arrête pas le diagnostic global).

```python
# app/engine/executor.py
def execute(pipeline: Pipeline) -> dict:
    order = topological_sort(pipeline.nodes, pipeline.edges)  # lève si cycle
    inputs_map = build_inputs_map(pipeline.edges)             # target -> [sources ordonnées]
    results: dict[str, pd.DataFrame] = {}
    status, errors = {}, {}

    for node in order:
        try:
            in_dfs = [results[s] for s in inputs_map.get(node.id, [])]
            fn = REGISTRY[node.type]                # registry.py
            results[node.id] = fn(in_dfs, node.config)
            status[node.id] = "ok"
        except Exception as e:
            status[node.id] = "error"
            errors[node.id] = str(e)
            break                                    # arrêt à la première erreur

    return build_run_response(results, order, status, errors)
```

**Tri topologique (Kahn)** :

```python
def topological_sort(nodes, edges):
    indeg = {n.id: 0 for n in nodes}
    adj = {n.id: [] for n in nodes}
    for e in edges:
        adj[e.source].append(e.target)
        indeg[e.target] += 1
    queue = [nid for nid, d in indeg.items() if d == 0]
    order = []
    while queue:
        nid = queue.pop(0)
        order.append(nid)
        for nxt in adj[nid]:
            indeg[nxt] -= 1
            if indeg[nxt] == 0:
                queue.append(nxt)
    if len(order) != len(nodes):
        raise PipelineError("Cycle détecté dans le pipeline.")
    return [by_id[nid] for nid in order]
```

---

### B3. Registry des nœuds — `app/engine/registry.py`

**Quoi** : associer un `type` de nœud à sa fonction d'exécution. Rend le système **extensible** (ajouter un nœud = ajouter une fonction + une ligne).

```python
# app/engine/registry.py
from app.engine.nodes import sources, transforms, outputs

REGISTRY = {
    "source_csv":  sources.source_csv,
    "source_json": sources.source_json,
    "source_sql":  sources.source_sql,
    "filter":      transforms.filter_rows,
    "select":      transforms.select_columns,
    "aggregate":   transforms.aggregate,
    "join":        transforms.join,
    "custom":      transforms.custom_code,   # bonus IA
    "output":      outputs.output,
}
```

Chaque fonction a la **même signature** : `fn(inputs: list[DataFrame], config: dict) -> DataFrame`.

---

### B4. Nœuds Source — `app/engine/nodes/sources.py`

**Quoi** : charger les données depuis un fichier déjà téléversé (via `source_id`) ou une base SQL.

```python
def source_csv(inputs, config):
    return storage.get_df(config["source_id"]).copy()

def source_json(inputs, config):
    return storage.get_df(config["source_id"]).copy()

def source_sql(inputs, config):           # "Could" — démo SQLite
    return sql_service.read_table(config["table"], limit=config.get("limit", 10000))
```

---

### B5. Nœuds Transformation — `app/engine/nodes/transforms.py`

**Quoi** : le cœur ETL. Chaque transformation est une opération pandas isolée et testable.

**Filtre** (F4) :

```python
OPS = {
    "=":  lambda s, v: s == v,
    "!=": lambda s, v: s != v,
    ">":  lambda s, v: s.astype(float) > float(v),
    "<":  lambda s, v: s.astype(float) < float(v),
    ">=": lambda s, v: s.astype(float) >= float(v),
    "<=": lambda s, v: s.astype(float) <= float(v),
    "contient": lambda s, v: s.astype(str).str.contains(str(v), case=False, na=False),
}

def filter_rows(inputs, config):
    df = inputs[0]
    mask = pd.Series(True, index=df.index)
    for cond in config["conditions"]:          # ET logique entre conditions
        col, op, val = cond["col"], cond["op"], cond["val"]
        mask &= OPS[op](df[col], val)
    return df[mask]
```

**Sélection / renommage** (F5) :

```python
def select_columns(inputs, config):
    df = inputs[0]
    cols = config["columns"]                   # ex: ["agence", "montant"]
    df = df[cols]
    if config.get("rename"):                   # ex: {"montant": "montant_fcfa"}
        df = df.rename(columns=config["rename"])
    return df
```

**Agrégation** (F6) :

```python
def aggregate(inputs, config):
    df = inputs[0]
    group_by = config["group_by"]              # ex: ["agence"]
    aggs = {a["col"]: a["fn"] for a in config["aggs"]}  # {"montant": "sum"}
    out = df.groupby(group_by, as_index=False).agg(aggs)
    return out
```

**Jointure** (F7) — deux entrées :

```python
def join(inputs, config):
    left, right = inputs[0], inputs[1]
    return left.merge(
        right,
        how=config.get("how", "inner"),        # inner | left | right | outer
        left_on=config["left_on"],
        right_on=config["right_on"],
    )
```

---

### B6. Nœud Sortie & Export — `outputs.py` + `POST /api/export`

**Quoi** : produire l'aperçu et permettre le téléchargement CSV/JSON.

```python
# outputs.py — passthrough : la sortie EST le DataFrame final
def output(inputs, config):
    return inputs[0]
```

```python
# app/api/export.py
@router.post("/api/export")
def export(pipeline: Pipeline, fmt: Literal["csv", "json"] = "csv"):
    result_df = execute_and_get_final_df(pipeline)
    if fmt == "csv":
        buf = io.StringIO()
        result_df.to_csv(buf, index=False, sep=";")   # séparateur francophone
        return StreamingResponse(iter([buf.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=resultat.csv"})
    return JSONResponse(result_df.to_dict(orient="records"))
```

---

### B7. Assistant IA (Bonus) — `POST /api/ai/generate`

**Quoi** : transformer une phrase en français + le schéma des colonnes en **code SQL ou pandas** sûr.

**Comment** :

- Construire un **prompt système** strict.
- Envoyer le schéma (colonnes + types) en contexte.
- **Garde-fous** : interdire `DROP`, `DELETE`, `UPDATE`, `INSERT`, `ALTER` ; exécution en lecture seule.

```python
# app/services/ai_service.py
SYSTEM = """Tu es un assistant ETL bancaire (contexte Cameroun, FCFA).
Génère UNIQUEMENT du code {lang} en lecture seule, à partir du schéma fourni.
Aucune instruction destructrice. Réponds en JSON: {code, explication}."""

FORBIDDEN = ("drop", "delete", "update", "insert", "alter", "truncate")

def generate(description: str, schema: dict, lang: str = "pandas") -> dict:
    prompt = build_prompt(description, schema, lang)
    raw = call_llm(SYSTEM.format(lang=lang), prompt)   # OpenAI/Anthropic
    result = parse_json(raw)
    if any(k in result["code"].lower() for k in FORBIDDEN):
        raise AISafetyError("Code potentiellement destructeur refusé.")
    return result                                       # {code, explication}
```

**Nœud `custom`** (exécution du code généré) — sandbox minimal :

```python
def custom_code(inputs, config):
    df = inputs[0]
    code = config["code"]                  # doit définir result à partir de df
    safe_globals = {"pd": pd, "df": df}
    exec(code, safe_globals)               # MVP hackathon ; à durcir en prod
    return safe_globals["result"]
```

> ⚠️ `exec` est acceptable pour une démo hackathon contrôlée, **jamais en production** sans véritable sandbox (RestrictedPython, conteneur isolé).

---

## 5. Liste des endpoints (résumé)

| Méthode | Route | Rôle | Priorité |
|---|---|---|---|
| `POST` | `/api/upload` | Téléverser CSV/JSON, renvoyer schéma + aperçu | **Must** |
| `GET` | `/api/sources` | Lister les sources chargées | Should |
| `GET` | `/api/sources/{id}/schema` | Schéma d'une source (pour l'IA et le front) | Should |
| `POST` | `/api/run` | Exécuter le pipeline, renvoyer aperçu + statuts | **Must** |
| `POST` | `/api/preview-node` | Exécuter jusqu'à un nœud donné (debug) | Could |
| `POST` | `/api/export` | Exporter le résultat (CSV/JSON) | **Must** |
| `POST` | `/api/ai/generate` | Générer code de transformation (LLM) | **Bonus** |
| `GET` | `/api/health` | Vérification de disponibilité | Must |

---

## 6. Gestion des erreurs

**Quoi** : ne jamais renvoyer une stack trace brute ; toujours un message clair en français.

```python
# app/utils/errors.py
class PipelineError(Exception): ...
class NodeConfigError(Exception): ...
class AISafetyError(Exception): ...

@app.exception_handler(PipelineError)
def handle_pipeline_error(request, exc):
    return JSONResponse(status_code=400, content={"error": str(exc)})
```

| Cas | Message renvoyé | Code |
|---|---|---|
| Colonne inexistante dans un filtre | `La colonne 'X' n'existe pas dans les données.` | 400 |
| Cycle dans le graphe | `Cycle détecté dans le pipeline.` | 400 |
| Fichier illisible | `Fichier illisible ou format non supporté.` | 422 |
| Type de nœud inconnu | `Type de nœud non supporté : 'X'.` | 400 |
| Code IA destructeur | `Code potentiellement destructeur refusé.` | 403 |

---

## 7. Exigences non-fonctionnelles (backend)

| Catégorie | Exigence |
|---|---|
| **Performance** | Exécuter un pipeline sur 100 000 lignes en < 3 s ; aperçu limité à 100 lignes renvoyées. |
| **Mémoire** | Cache des DataFrames en mémoire (dict) pour la démo ; libération sur reset. |
| **CORS** | Autoriser l'origine du front (Vite : `http://localhost:5173`). |
| **Sécurité** | Validation Pydantic stricte ; garde-fous IA ; pas d'exécution SQL en écriture. |
| **Localisation** | Séparateur `;`, dates `JJ/MM/AAAA`, montants FCFA non décimaux. |
| **Observabilité** | Logs par nœud (type, durée, lignes en entrée/sortie). |
| **Portabilité** | `uvicorn main:app --reload` ; aucune dépendance système lourde. |

---

## 8. Dépendances — `requirements.txt`

```
fastapi==0.115.*
uvicorn[standard]==0.32.*
pandas==2.2.*
python-multipart==0.0.*      # upload de fichiers
pydantic==2.*
sqlalchemy==2.*              # démo SQL (Could)
openai==1.*                  # bonus IA (ou anthropic)
python-dotenv==1.*
pytest==8.*                  # tests
```

---

## 9. Plan d'implémentation backend (binôme back, ~7h)

| Bloc | Tâche | Estimation |
|---|---|---|
| Setup | Squelette FastAPI, CORS, `/api/health`, arborescence | 30 min |
| B1 | `/api/upload` + détection CSV + cache DataFrame | 45 min |
| B2 + B3 | Moteur (tri topologique) + registry | 60 min |
| B4 + B5 | Nœuds source + filtre/select/aggregate | 90 min |
| B6 | Sortie + `/api/run` + `/api/export` | 60 min |
| B5+ | Jointure (F7) + gestion d'erreurs robuste | 45 min |
| B7 | Assistant IA + nœud custom (bonus) | 60 min |
| Tests | `test_engine.py` sur les transformations clés | 30 min |

---

## 10. Tests minimaux — `tests/test_engine.py`

**Quoi** : sécuriser le moteur et les transformations critiques avant la démo.

```python
def test_topological_sort_detecte_cycle(): ...
def test_filter_montant_superieur(): ...
def test_aggregate_somme_par_agence(): ...
def test_join_momo_comptes(): ...
def test_run_pipeline_bout_en_bout(): ...
def test_ai_refuse_code_destructeur(): ...
```

**Scénario de référence (réconciliation MoMo)** à valider :
`source_csv(momo)` + `source_json(comptes)` → `join` (sur `id_transaction`) → `filter` (`montant > 500000`) → `aggregate` (group by `agence`, sum `montant`) → `output`.

---

## 11. Critères d'acceptation backend

- [ ] `/api/upload` accepte CSV (`,` et `;`) et JSON et renvoie le bon schéma.
- [ ] `/api/run` exécute un graphe de ≥ 3 nœuds et renvoie un aperçu correct.
- [ ] Détection de cycle et erreurs par nœud fonctionnelles.
- [ ] Filtre, sélection, agrégation et jointure donnent des résultats exacts.
- [ ] `/api/export` produit un CSV (`;`) et un JSON téléchargeables.
- [ ] (Bonus) `/api/ai/generate` renvoie du code valide et refuse le code destructeur.
- [ ] Tests `pytest` au vert sur le scénario de réconciliation.
