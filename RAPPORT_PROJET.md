# Rapport projet — Aaprovidir DataPipe

> **Document de référence pour l'équipe** — état du projet, fonctionnalités, charte graphique, installation et pistes de travail.
>
> Dernière mise à jour : **11 juin 2026** (conducteur IA, accueil à la connexion, intelligence agricole)

---

## 1. Vue d'ensemble

**Aaprovidir DataPipe** est une plateforme **ETL visuelle** orientée **données agricoles** : import multi-sources, pipeline par glisser-déposer, qualité des données, export et automation (webhooks, cron).

| Élément | Détail |
|---------|--------|
| **Marque** | Aaprovidir — *« Nourrir un Avenir Radieux »* |
| **Domaine métier** | Agriculture, chaînes de valeur agricoles africaines (plus de référence bancaire côté UI) |
| **Stack** | FastAPI + SQLite (backend) · React + Vite + React Flow (frontend) |
| **Auth** | 100 % locale (JWT + bcrypt), pas de Supabase |
| **Inspiration produit** | Talend (ETL enterprise) + n8n (automation / webhooks / cron) |

---

## 2. Démarrage rapide (équipe)

### Prérequis

- Python 3.11+
- Node.js 18+ et npm

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Nouvelle dépendance** (planification cron) : `APScheduler==3.10.4` (déjà dans `requirements.txt`).

### Frontend

```bash
cd frontend
npm install
cp .env.example .env   # optionnel en dev
npm run dev
```

### Accès

| Service | URL |
|---------|-----|
| Interface | http://localhost:5173 |
| API | http://localhost:8000 |
| Docs API | http://localhost:8000/docs |

### Compte par défaut (1er démarrage)

- **Utilisateur / mot de passe** : `aaprovidir` / `aaprovidir` (configurable dans `backend/.env`)
- Seul un **administrateur** peut créer des comptes (pas d'inscription publique)

---

## 3. Fonctionnalités Talend / n8n (ajout récent)

### 3.1 Automation (style n8n)

| Fonctionnalité | Description | UI / API |
|----------------|-------------|----------|
| **Déclenchement manuel** | Bouton « Exécuter » dans l'éditeur | Nœud `trigger_manual` |
| **Webhooks** | `POST /api/hooks/{token}` (sans JWT) | Onglet **Automation** du projet |
| **Planification cron** | APScheduler embarqué au démarrage API | `POST /api/automation/schedules` |
| **Requête HTTP sortante** | Appel API REST → DataFrame | Nœud `http_request` |
| **Branchement IF** | Sorties **Vrai** / **Faux** sur le canvas | Nœud `branch` + `sourceHandle` sur les arêtes |

### 3.2 Intégration data (style Talend)

| Fonctionnalité | Description | UI / API |
|----------------|-------------|----------|
| **Connexions réutilisables** | Référentiel BDD (SQLite, PostgreSQL, MySQL…) | Sidebar **Connexions** · `/api/connections` |
| **Validation métier** | Règles `not_null`, `regex`, `min`, `max`, `in_list`, `unique` | Nœud `validate` |
| **Transforms avancés** | `lookup`, `union`, `cast`, `split`, `pivot` | Palette éditeur |
| **Historique d'exécution** | Runs + logs par nœud | Sidebar **Exécutions** · `/api/executions` |

### 3.3 Nouveaux types de nœuds pipeline

**Déclencheurs :** `trigger_manual`, `trigger_webhook`, `trigger_schedule`

**Transformations :** `http_request`, `lookup`, `union`, `cast`, `split`, `pivot`, `validate`, `branch`

*(Les nœuds historiques restent disponibles : filter, join, sql, custom, output, sources…)*

### 3.4 Nouvelles tables SQLite

Créées automatiquement au démarrage (`database.init_db()`) :

| Table | Rôle |
|-------|------|
| `connections` | Connexions BDD réutilisables par utilisateur |
| `pipeline_runs` | Historique des exécutions (statut, durée, trigger) |
| `node_run_logs` | Log par nœud pour chaque run |
| `schedules` | Planifications cron liées à un projet |
| `webhooks` | Tokens webhook par projet |

### 3.5 Nouveaux modules backend

```
backend/
├── pipeline_service.py    # Exécution tracée (runId, logs)
├── scheduler.py           # Cron APScheduler
├── routers/
│   ├── connections.py
│   ├── executions.py
│   └── automation.py      # schedules, webhooks + hooks_router public
└── etl/
    ├── validate.py        # Règles qualité métier
    └── http_action.py     # Requêtes HTTP sortantes
```

### 3.6 Nouveaux endpoints API

| Préfixe | Routes principales |
|---------|-------------------|
| `/api/connections` | CRUD + `POST /{id}/test` |
| `/api/executions` | `GET /`, `GET /{run_id}` |
| `/api/automation/schedules` | CRUD planifications |
| `/api/automation/webhooks` | CRUD webhooks |
| `/api/hooks/{token}` | **Public** — déclenche un pipeline |

`POST /api/pipeline/run` accepte désormais `project_id` (optionnel) pour lier l'exécution au projet.

### 3.7 Variables d'environnement

```env
# backend/.env
PUBLIC_API_URL=http://localhost:8000   # URL complète des webhooks affichée dans l'UI
OPENAI_API_KEY=sk-...                  # optionnel — assistant cloud (sinon heuristiques locales)
OPENAI_MODEL=gpt-4o-mini
# OPENAI_BASE_URL=https://api.groq.com/openai/v1   # Groq, OpenRouter…
```

---

## 4. Assistant IA & conducteur de pipeline (ajout juin 2026)

### 4.1 Vue d'ensemble

L'IA est **omniprésente** dans l'application et guide l'utilisateur de bout en bout :

| Brique | Description |
|--------|-------------|
| **Accueil à la connexion** | Modal `WelcomeModal` : salutation, résumé de la dernière activité, proposition pour continuer |
| **Assistant global** | Bouton flottant ✨ + raccourci `Ctrl+Shift+I` (`AIGlobalShell`) sur toutes les pages |
| **Boutons contextuels** | Composant `AIButton` dans Import, Qualité, Export, Analytiques, Connexions, Aide… |
| **Onglet IA (éditeur)** | Génération code pandas/SQL, création ou injection dans nœud sélectionné |
| **Conducteur IA** | Workflow guidé après import : intention → plan → validation étape par étape |

### 4.2 Accueil à la connexion

- Déclenché **automatiquement** dès que l'utilisateur est authentifié (`GET /api/ai/welcome`)
- Contenu : message personnalisé, **dernières actions** (`activity_log`), **dernier projet** modifié, bouton « Reprendre mon projet »
- Fichiers : `frontend/src/components/WelcomeModal.tsx`, `backend/ai/conductor.py` (`build_welcome`)

### 4.3 Assistant IA (génération de code)

| Mode | Comportement |
|------|-------------|
| **Cloud** | Si `OPENAI_API_KEY` est défini (OpenAI, Groq, OpenRouter via `OPENAI_BASE_URL`) |
| **Local** | Heuristiques agricoles : filtrage culture (maïs, riz…), agrégation prix/région, qualité, SQL |

| Route | Rôle |
|-------|------|
| `GET /api/ai/status` | Provider, modèle, mode cloud/local |
| `GET /api/health` | Inclut `aiKey`, `aiProvider`, `aiModel`, `aiMode` |
| `POST /api/ai/generate` | `{ description, columns?, mode: pandas\|sql }` → code validé |

Frontend : `AIAssistant.tsx`, `AIContext.tsx`, `AIGlobalShell.tsx`, `AIButton.tsx`, `api/ai.ts`

### 4.4 Conducteur IA — pipeline guidé

Parcours conversationnel après **import d'une source** :

```
Import CSV → « Que voulez-vous faire ? » → Plan proposé
    → Accep / Ajuster le plan
    → Pour chaque étape : Valider / Ignorer / Ajuster
    → Nœuds ajoutés automatiquement sur le canvas
```

| Route | Rôle |
|-------|------|
| `POST /api/ai/conductor/start` | Démarre une session (`columns`, `sourceLabel`, `projectId`, `sourceNodeId`) |
| `POST /api/ai/conductor/intent` | Objectif utilisateur en langage naturel |
| `POST /api/ai/conductor/plan` | `accept` ou `revise` (+ feedback) |
| `POST /api/ai/conductor/step` | `accept`, `reject` ou `revise` par étape |
| `GET /api/ai/conductor/{sessionId}` | État de la session |

Backend : `backend/ai/conductor.py` — plans heuristiques agricoles (+ enrichissement OpenAI si clé API).

Frontend : `AIConductor.tsx`, `lib/applyConductorStep.ts` — ouverture auto après import, bouton « Conducteur IA » dans l'éditeur.

**Journal d'activité** : actions `conductor_plan`, `conductor_step` ; helper `list_user_activity()` pour l'accueil.

### 4.5 Intelligence agricole (embeddings & analyse)

| Fonctionnalité | Backend | UI |
|----------------|---------|-----|
| **Taxonomie agricole** | `etl/agri_taxonomy.py` | Badges domaine dans Qualité |
| **Embeddings TF-IDF** (hors-ligne) | `etl/embeddings.py` | — |
| **Classification sources** | `etl/agri_classify.py` | Nœud `agri_classify` |
| **Analyse causale** | `etl/causal.py` | Nœud `causal_analysis` |
| **Prédiction / régression** | `etl/predict.py` | Nœud `predict` |
| **Profilage multi-sources** | `etl/analyze.py` | Panneau **Qualité** |
| **Analytiques globales** | `POST /api/etl/classify`, `POST /api/etl/intelligence` | Sidebar **Analytiques** |

Nœuds palette section **Intelligence agricole** : `embed_text`, `agri_classify`, `causal_analysis`, `predict`.

### 4.6 Centre d'aide intégré

- `HelpPanel.tsx` + `content/helpGuide.ts` — 8 sections (parcours, nœuds, syntaxe, erreurs courantes…)
- Accessible : sidebar **Documentation / Support**, onglet **Aide** éditeur, bannière contextuelle par nœud
- Bouton « Ouvrir l'assistant IA » dans l'aperçu et la section Assistant

### 4.7 Modules backend IA (répertoire)

```
backend/
├── ai.py                    # Génération code pandas/SQL + validation AST
└── ai/
    ├── conductor.py         # Accueil, sessions, plans, validation étapes
    └── __init__.py
```

---

## 5. Refonte design — Charte Aaprovidir

### 5.1 Identité visuelle

Charte source : dossier ` couleurs _caractere /` (logos PNG + `Aaprovidir_Charte_Graphique_Editoriale_v1.docx`).

**Palette « Terre d'Avenir »** (intégrée dans `frontend/tailwind.config.js`) :

| Token | HEX | Usage |
|-------|-----|--------|
| Bleu Corporate | `#0D2C54` | Sidebar, titres, CTA principal |
| Cyan Innovation | `#2A9D8F` | Accents, bouton Exécuter, liens |
| Vert Gardien | `#388E3C` | Succès, nœuds sortie |
| Jaune Action | `#E9C46A` | Badges, accents (avec parcimonie) |
| Blanc Cassé | `#F8F7F4` | Fond général |

**Typographie :** Plus Jakarta Sans (Google Fonts) — police UI principale recommandée par la charte.

**Slogan marque :** *Nourrir un Avenir Radieux*

**Positionnement UI :** données **agricoles** uniquement (terme « bancaire » retiré des textes visibles).

### 5.2 Assets logo

| Fichier source | Copie utilisée par l'app |
|----------------|-------------------------|
| ` couleurs _caractere /Logo Aaprovidir name.png` | `frontend/public/brand/logo-name-blue.png` |
| ` couleurs _caractere /Logo Aaprovidir white name.png` | `frontend/public/brand/logo-name-white.png` |
| ` couleurs _caractere /Logo Aaprovidir A white.png` | `frontend/public/brand/logo-icon-white.png` |
| ` couleurs _caractere /Logo Aaprovidir A-09.png` | `frontend/public/brand/logo-icon-dark.png` |

### 5.3 Fichiers design frontend

| Fichier | Rôle |
|---------|------|
| `frontend/tailwind.config.js` | Tokens couleurs Tailwind |
| `frontend/src/index.css` | Styles globaux, React Flow, classes `.brand-*` |
| `frontend/src/lib/brand.ts` | Constantes marque |
| `frontend/src/components/brand/Logo.tsx` | `Logo`, `LogoMark`, `BrandHeader` |
| `frontend/src/components/icons/Icons.tsx` | Icônes SVG ligne (remplace les emojis) |

### 5.4 Écrans refondus

- **Login** : split-screen bleu corporate + formulaire ; **filigrane logo A** ; accueil IA après connexion
- **Projets** : sidebar bleu `#0D2C54`, **Analytiques**, **Assistant IA** (SQL / Pandas), Documentation
- **Éditeur pipeline** : conducteur IA post-import, onglets Import / Qualité / Export / IA / Aide
- **Admin / Profil** : thème clair + bouton Assistant IA

### 5.5 Règles pour la suite du design

- Ne pas dépasser **40 %** de surface en Bleu Corporate sur un écran
- Jaune Action : **accents uniquement** (CTA secondaires, badges)
- Texte corps : `#424242` (Gris Foncé), pas de noir pur `#000`
- Pas d'emojis dans l'UI — utiliser `Icon` / `NodeIcon` depuis `components/icons/Icons.tsx`

---

## 6. Architecture applicative

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (React + React Flow) — localhost:5173             │
│  Login · Projets · Éditeur · Admin · IA (global + conducteur)│
│  Analytiques · Exécutions · Connexions · Centre d'aide      │
└───────────────────────────┬─────────────────────────────────┘
                            │ JWT Bearer /api/*
┌───────────────────────────▼─────────────────────────────────┐
│  Backend FastAPI v2.0 — localhost:8000                      │
│  auth · admin · projects · pipeline · export               │
│  etl/analyze · classify · intelligence · ai · conductor   │
│  automation · connections · executions                    │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  SQLite datapipe.sqlite + staging (raw / clean / warehouse)   │
│  Fichiers importés : backend/.data/uploads/                   │
└─────────────────────────────────────────────────────────────┘
```

### Parcours utilisateur type

1. **Login** → **accueil IA** (résumé activité + suggestion)
2. **Créer / ouvrir un projet** → éditeur ETL
3. **Importer** une source → **conducteur IA** (objectif → plan → validation étape par étape)
4. **Qualité** (profilage + domaine agricole) → canvas enrichi automatiquement
5. **Exécuter** → **Aperçu** → **Exporter**
6. **Assistant IA** (`Ctrl+Shift+I`) à tout moment pour générer du code pandas/SQL
7. **Analytiques** : classification multi-projets, causal / prédiction globale
8. **Automation** : webhook ou cron (optionnel)

---

## 7. Structure des dossiers (repères)

```
Afritrade/
├── RAPPORT_PROJET.md          ← ce document
├── MISE_A_JOUR_BACKEND.md     ← détail backend (auth, ETL, IA, conducteur)
├── CAHIER_DES_CHARGES.md      ← spec initiale (partiellement obsolète)
├── couleurs _caractere /     ← charte graphique + logos source
├── backend/
│   ├── main.py
│   ├── ai.py
│   ├── ai/conductor.py
│   ├── database.py
│   ├── pipeline_service.py
│   ├── scheduler.py
│   ├── routers/
│   └── etl/                 # analyze, agri_*, causal, predict, embeddings…
└── frontend/
    ├── public/brand/
    └── src/
        ├── ai/              # AIContext (provider global)
        ├── api/             # ai.ts, conductor.ts, intelligence.ts…
        ├── content/         # helpGuide.ts
        ├── pages/
        └── components/      # AIConductor, WelcomeModal, AIGlobalShell, HelpPanel…
```

---

## 8. Fonctionnalités déjà en place (rappel)

- Auth locale JWT, admin, présence temps réel, journal d'activité
- CRUD projets (graphe JSON persisté)
- ETL Medallion (RAW → CLEAN → WAREHOUSE)
- Import : CSV (robuste auto `;`), Excel, PDF, Word, JSON, SQL, SQLite, URL, BDD
- Transformations : filter, select, rename, sort, aggregate, join, sql, custom…
- **Intelligence agricole** : classification, causal, prédiction (embeddings TF-IDF hors-ligne)
- Qualité descriptive (`DataQualityPanel`) + validation exécutable (`validate`)
- Export : CSV, JSON, JSONL, SQLite, Parquet
- **Assistant IA global** + **conducteur pipeline guidé** + **accueil à la connexion**
- **Centre d'aide** intégré (8 sections, aide par nœud)
- Automation n8n : webhooks, cron, historique exécutions
- Mode démo : `/demo` (sans connexion)

---

## 9. Limites connues / non implémenté

| Élément | Statut |
|---------|--------|
| Sessions conducteur persistées en BDD | Non (mémoire serveur — MVP) |
| Conducteur sur mode démo sans JWT | Partiel (nécessite connexion pour l'API) |
| Exécution asynchrone / file de jobs | Non |
| Switch multi-branches (> 2 sorties) | Non |
| Chiffrement des credentials connexions | Non (URL en clair en SQLite) |
| Polices Gotham / VAG Rounded (charte) | Non chargées — Plus Jakarta Sans utilisée |
| Credentials webhook signés (HMAC) | Token URL uniquement |

---

## 10. Pistes de travail pour l'équipe

### Priorité haute

- [ ] Tests E2E conducteur IA (import → plan → canvas)
- [ ] Persistance sessions conducteur (reprise après reload)
- [ ] Documenter des **exemples de pipelines agricoles** complets (prix marché, rendements…)

### Priorité moyenne

- [ ] Chiffrement des `connection_url` en base
- [ ] Durcissement sandbox `custom` (RestrictedPython)
- [ ] Templates de pipelines agricoles pré-configurés (1 clic)

### Design

- [ ] Déclinaison mobile complète (sidebar projets)
- [ ] Favicon optimisé (version icône simplifiée < 32px selon charte)

---

## 11. Commandes utiles

```bash
# Build frontend production
cd frontend && npm run build

# Vérifier les routes API
curl http://localhost:8000/api/health

# Accueil IA (avec JWT)
curl -H "Authorization: Bearer VOTRE_JWT" http://localhost:8000/api/ai/welcome

# Déclencher un webhook (exemple)
curl -X POST http://localhost:8000/api/hooks/VOTRE_TOKEN \
  -H "Content-Type: application/json" \
  -d '{"source": "test"}'
```

---

## 12. Contacts & conventions

- **Langue UI** : français
- **Commits** : messages clairs, en français ou anglais selon habitude de l'équipe
- **Branche** : travailler sur des branches feature, PR vers `main`
- **Ne pas committer** : `.env`, fichiers SQLite de dev avec données sensibles (vérifier `.gitignore`)

---

*Document maintenu par l'équipe Aaprovidir / hackathon DataPipe. Mettre à jour ce fichier à chaque jalon significatif.*
