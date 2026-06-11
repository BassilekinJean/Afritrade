# Mise à jour Backend — DataPipe / Afritrade

> Document de suivi des évolutions du backend : **ce qui a été retiré**, **ce qui a été ajouté**, et **comment l'ensemble s'articule** aujourd'hui.
>
> Dernière mise à jour : **11 juin 2026** (IA, conducteur pipeline, intelligence agricole, export)
>
> **Voir aussi :** [RAPPORT_PROJET.md](./RAPPORT_PROJET.md) — rapport complet équipe (Talend/n8n, design Aaprovidir, installation).

---

## 1. Contexte et objectif du changement

Le backend initial était conçu pour s'appuyer sur **Supabase** (Auth + Postgres + Storage) avec une API FastAPI centrée sur l'ETL. Pour le hackathon et le contexte **traitement 100 % local** (faible bande passante, pas de dépendance cloud), nous avons :

1. **Supprimé toute dépendance à Supabase** côté backend.
2. **Ajouté une authentification maison** (SQLite + bcrypt + JWT).
3. **Refactorisé le moteur ETL** en package structuré avec bases tampon (modèle Medallion).
4. **Ajouté l'administration des comptes**, le journal d'activité et le **suivi de présence** en temps réel.

Le front continue d'appeler les mêmes routes ETL principales ; les routes auth/projets ont été réécrites.

---

## 2. Ce qui a été retiré

### 2.1 Intégration Supabase (backend)

| Élément retiré | Rôle avant | Raison |
|---|---|---|
| `supabase_api.py` (module supprimé) | Client Python vers l'API Supabase (Auth, PostgREST, Storage) | Remplacé par SQLite local |
| Authentification via **Supabase Auth** | Login/signup, sessions gérées par Supabase | Auth locale JWT |
| Persistance **Postgres** (via Supabase) | Table `projects`, éventuellement `users` | SQLite `datapipe.sqlite` |
| **Supabase Storage** | Fichiers sources uploadés dans le cloud | Stockage local `.data/uploads/` |
| Dépendances Python Supabase / PostgREST | Connexion distante | Plus nécessaires |
| Inscription publique (`signup`) | Création de compte libre | Seul l'admin crée les comptes |
| Connexion par **email** | Identifiant principal | Connexion par **username** uniquement |

> Le dossier `supabase/schema.sql` existe encore à la racine du dépôt comme **référence historique** ; il n'est **plus utilisé** par le backend en cours d'exécution.

### 2.2 Architecture ETL monolithique (ancienne)

| Élément retiré / remplacé | Détail |
|---|---|
| Structure `app/engine/`, `app/api/` (cahier des charges initial) | Non implémentée telle quelle ; remplacée par `backend/etl/` |
| Moteur pipeline monolithique unique | Refactorisé en phases EXTRACT → STANDARDIZE → TRANSFORM → LOAD |
| Cache mémoire seul pour les fichiers | Remplacé par `DatasetStore` (mémoire + disque) |

### 2.3 Endpoints / comportements supprimés

| Route / comportement | Statut |
|---|---|
| Toute route passant par Supabase Auth | Supprimée |
| Upload sans authentification | Supprimé — `POST /api/sources/upload` exige un JWT |
| Exécution pipeline sans authentification | Supprimé — `POST /api/pipeline/run` exige un JWT |
| `POST /api/upload` (ancien nom) | Remplacé par `POST /api/sources/upload` |
| `POST /api/run` (ancien nom) | Remplacé par `POST /api/pipeline/run` |
| `POST /api/export` | **Implémenté** — CSV, JSON, JSONL, SQLite, Parquet |

---

## 3. Ce qui a été ajouté

### 3.1 Nouveaux fichiers et modules

```
backend/
├── main.py                 # Point d'entrée FastAPI v2.0 (auth + ETL + IA)
├── ai.py                   # Génération code IA (pandas/SQL)
├── ai/conductor.py         # Conducteur pipeline guidé + accueil
├── database.py             # Couche SQLite : users, projects, activity_log
├── security.py             # bcrypt + JWT (HS256)
├── auth.py                 # Dépendances FastAPI get_current_user / get_current_admin
├── schemas.py              # Modèles Pydantic (auth, admin, projets, conducteur…)
├── storage.py              # DatasetStore : cache mémoire + disque local
├── pipeline.py             # Shim de compatibilité → package etl/
├── pipeline_service.py     # Exécution tracée (runs, logs)
├── scheduler.py            # Planification cron
├── routers/                # auth, admin, projects, connections, executions, automation
└── etl/                    # extract, transform, analyze, agri_*, causal, predict…
```

### 3.2 Authentification locale (SQLite + JWT)

| Composant | Description |
|---|---|
| `database.py` | Table `users` : `username` (unique), `password_hash`, `role`, `is_active`, `last_login_at`, `last_seen_at` |
| `security.py` | Hachage **bcrypt** ; jetons **JWT** signés HS256, durée configurable (`JWT_EXPIRE_HOURS`) |
| `auth.py` | `get_current_user` : valide le JWT, vérifie que le compte est actif, met à jour la présence (`touch_last_seen`) |
| `routers/auth.py` | Routes publiques/protégées (voir § 4) |
| Seed admin | Au premier démarrage, création auto du compte `ADMIN_USERNAME` / `ADMIN_PASSWORD` (défaut : `aaprovidir`) |

**Règles métier ajoutées :**

- Pas d'inscription publique : seul un **admin** crée les comptes via `POST /api/admin/users`.
- Connexion par **nom d'utilisateur** (l'email est optionnel, stocké mais non utilisé pour se connecter).
- Paramètre `as_role` au login : si l'onglet « Administrateur » est choisi, le serveur refuse les comptes non-admin (`login_denied` journalisé).
- Changement de mot de passe utilisateur : `POST /api/auth/change-password`.

### 3.3 Administration et journal d'activité

| Fonctionnalité | Implémentation |
|---|---|
| CRUD comptes | `GET/POST/PATCH/DELETE /api/admin/users` |
| Vue projets organisation | `GET/DELETE /api/admin/projects` (+ lecture par id) |
| Journal temps réel | Table `activity_log` + `GET /api/admin/activity` |
| Actions journalisées | `login`, `logout`, `login_failed`, `login_blocked`, `login_denied`, `password_changed`, `user_created`, `user_updated`, `user_deleted`, `project_created`, `project_deleted`, `pipeline_run`, `export`, **`conductor_plan`**, **`conductor_step`** |

Fonction **`list_user_activity(user_id, limit)`** : activité filtrée par utilisateur (accueil IA).

Chaque entrée du journal enregistre : auteur (`user_id`, `email` = username), action, détail, IP client, horodatage UTC.

### 3.4 Suivi de présence (sessions actives)

Distinction volontaire entre **compte activé** (`is_active`) et **connecté en ce moment** (`is_online`).

| Mécanisme | Fichier / route |
|---|---|
| Heartbeat | Chaque appel authentifié via `get_current_user` → `touch_last_seen()` (throttle 20 s) |
| Ping front | `GET /api/auth/me` toutes les 30 s tant que l'onglet est ouvert |
| Logout immédiat | `POST /api/auth/logout` → `mark_offline()` + action `logout` dans le journal |
| Calcul « en ligne » | `database.is_user_online()` : compte actif + `last_seen_at` < 90 s + dernière action session = `login` |
| Endpoint admin unifié | `GET /api/admin/presence` → `{ online_count, online_users, users[], activity[], window_seconds }` |

### 3.5 Gestion des projets (SQLite)

| Table | Colonnes clés |
|---|---|
| `projects` | `id`, `user_id`, `title`, `graph` (JSON), `created_at`, `updated_at` |

| Comportement | Détail |
|---|---|
| Utilisateur standard | CRUD limité à **ses** projets |
| Administrateur | Accès lecture/écriture/suppression sur **tous** les projets (`get_project_any`, `list_all_projects`) |

Routes : `GET/POST /api/projects`, `GET/PATCH/DELETE /api/projects/{id}`.

### 3.6 Moteur ETL refactorisé (`backend/etl/`)

Architecture **Medallion** avec trois bases tampon SQLite gérées par `staging.py` :

| Couche | Phase | Rôle |
|---|---|---|
| **RAW** | EXTRACT | Données brutes telles qu'importées |
| **CLEAN** | STANDARDIZE + TRANSFORM | Formats harmonisés + transformations du graphe |
| **WAREHOUSE** | LOAD | Résultat final matérialisé (nœud `output`) |

**Sources supportées** (`extract.py`) :

- CSV (détection séparateur `,` / `;`)
- JSON
- Fichier SQL (exécution lecture seule)
- SQLite binaire (encodé base64 avec préfixe dédié)

**Transformations supportées** (`transform.py`) :

| Type nœud | Opération |
|---|---|
| `filter` | Filtrage via expression pandas `query` |
| `select` | Sélection de colonnes |
| `rename` | Renommage |
| `sort` | Tri |
| `aggregate` | Group by + agrégations |
| `dedupe` | Déduplication |
| `sql` | Requête SQL sur table virtuelle `input` |
| `custom` | Code pandas sandboxé |
| `join` | Jointure inner/left/right/outer (2 entrées) |

**Orchestration** (`engine.py`) :

- Tri topologique (détection de cycles).
- Exécution **parallèle par niveaux** : tous les nœuds indépendants d'un même niveau tournent en thread pool.
- Réponse API enrichie : `{ previews, finalNodeId, final, etl }` (bloc `etl` = traçabilité des phases).

**Routes ETL associées :**

| Route | Rôle |
|---|---|
| `POST /api/sources/upload` | Import fichier + aperçu immédiat |
| `POST /api/pipeline/run` | Exécution du graphe nodal |
| `GET /api/etl/staging` | Résumé des bases tampon |
| `POST /api/etl/reset` | Réinitialisation des tampons |
| `POST /api/etl/analyze` | Profilage multi-sources |
| `POST /api/etl/classify` | Classification agricole |
| `POST /api/etl/intelligence` | Causal / prédiction |
| `POST /api/export` | Export pipeline |
| `POST /api/ai/generate` | Code pandas/SQL |
| `GET /api/ai/welcome` | Accueil utilisateur |
| `POST /api/ai/conductor/*` | Pipeline guidé |

### 3.7 Assistant IA & conducteur

- **`ai.py`** : heuristiques agricoles + OpenAI/Groq/OpenRouter, validation code
- **`ai/conductor.py`** : sessions, plans, validation plan/étapes, `build_welcome()`
- **`list_user_activity()`** dans `database.py` pour l'accueil
- Sessions conducteur en **mémoire** (MVP, non persistées)

### 3.8 Stockage local des fichiers sources

`storage.py` — classe `DatasetStore` :

- Cache **mémoire** pour les accès rapides pendant l'exécution.
- Persistance **disque** dans `backend/.data/uploads/` (survit au reload Uvicorn).
- Identifiant logique : `sources/{uuid}.{ext}`.

### 3.9 Variables d'environnement (`.env.example`)

Nouvelles variables par rapport à l'ère Supabase :

```env
JWT_SECRET=...
JWT_EXPIRE_HOURS=12
ADMIN_USERNAME=aaprovidir
ADMIN_PASSWORD=aaprovidir
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
DATAPIPE_DATA_DIR=...          # optionnel
OPENAI_API_KEY=...             # optionnel — assistant cloud
OPENAI_MODEL=gpt-4o-mini
# OPENAI_BASE_URL=...         # Groq, OpenRouter…
PUBLIC_API_URL=...           # URL base webhooks
```

Variables Supabase retirées : `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, etc.

### 3.10 Dépendances Python ajoutées

```
bcrypt==4.2.1      # hachage mots de passe
PyJWT==2.10.1      # jetons de session
```

Dépendances conservées : `fastapi`, `uvicorn`, `pandas`, `sqlalchemy`, `pydantic`, `python-multipart`, `python-dotenv`.

---

## 4. Tableau des endpoints (état actuel)

### Authentification — `/api/auth`

| Méthode | Route | Auth | Description |
|---|---|---|---|
| `POST` | `/login` | Non | Connexion (username + password + `as_role` optionnel) |
| `POST` | `/logout` | Oui | Déconnexion + hors ligne immédiat |
| `GET` | `/me` | Oui | Profil courant (+ heartbeat présence) |
| `POST` | `/change-password` | Oui | Changement mot de passe |

### Administration — `/api/admin` (admin uniquement)

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/users` | Liste des comptes |
| `POST` | `/users` | Création de compte |
| `PATCH` | `/users/{id}` | Modification / reset mot de passe / activer-désactiver |
| `DELETE` | `/users/{id}` | Suppression |
| `GET` | `/projects` | Tous les projets (avec propriétaire) |
| `GET` | `/projects/{id}` | Détail d'un projet |
| `DELETE` | `/projects/{id}` | Suppression (admin) |
| `GET` | `/presence` | Présence + comptes enrichis + journal (polling temps réel) |
| `GET` | `/activity` | Journal seul (`?limit=N`) |

### Projets — `/api/projects` (utilisateur connecté)

| Méthode | Route | Description |
|---|---|---|
| `GET` | `` | Mes projets (admin : les siens uniquement sur cette route) |
| `POST` | `` | Créer un projet |
| `GET` | `/{id}` | Lire (admin : n'importe quel projet) |
| `PATCH` | `/{id}` | Modifier titre / graphe |
| `DELETE` | `/{id}` | Supprimer |

### ETL & divers

| Méthode | Route | Auth | Description |
|---|---|---|---|
| `GET` | `/api/health` | Non | Santé du service |
| `POST` | `/api/sources/upload` | Oui | Import source |
| `POST` | `/api/pipeline/run` | Oui | Exécuter le pipeline |
| `GET` | `/api/etl/staging` | Oui | État des tampons ETL |
| `POST` | `/api/etl/reset` | Oui | Reset tampons |
| `POST` | `/api/export` | Oui | Export pipeline (CSV, JSON, Parquet…) |
| `POST` | `/api/etl/analyze` | Oui | Profilage / normalisation |
| `POST` | `/api/etl/classify` | Oui | Classification agricole |
| `POST` | `/api/etl/intelligence` | Oui | Causal / prédiction |
| `GET` | `/api/ai/status` | Oui | État IA |
| `GET` | `/api/ai/welcome` | Oui | Accueil + résumé activité |
| `POST` | `/api/ai/generate` | Oui | Génération code IA |
| `POST` | `/api/ai/conductor/start` | Oui | Session conducteur |
| `POST` | `/api/ai/conductor/intent` | Oui | Intention → plan |
| `POST` | `/api/ai/conductor/plan` | Oui | Validation plan |
| `POST` | `/api/ai/conductor/step` | Oui | Validation étape |
| `GET` | `/api/ai/conductor/{id}` | Oui | État session |

---

## 5. Schéma de données SQLite

Fichier : `backend/.data/datapipe.sqlite` (créé au premier démarrage).

```
users
├── id, username (UNIQUE), email, full_name
├── password_hash, role (admin|user), is_active
├── created_at, updated_at
├── last_login_at, last_seen_at

projects
├── id, user_id → users.id (CASCADE)
├── title, graph (JSON text)
├── created_at, updated_at

activity_log
├── id, user_id, email (username), action, detail, ip
├── created_at
```

**Migration automatique** : si une ancienne base utilisait l'email comme identifiant obligatoire, la table `users` est recréée au démarrage (données de démo uniquement).

---

## 6. Comparaison avant / après (résumé)

| Aspect | Avant (Supabase) | Après (local) |
|---|---|---|
| Auth | Supabase Auth (email) | SQLite + bcrypt + JWT (username) |
| Base projets | Postgres Supabase | SQLite local |
| Fichiers sources | Supabase Storage | `.data/uploads/` |
| Comptes | Signup possible / Auth cloud | Admin crée les comptes |
| Sessions | Gérées par Supabase | JWT + heartbeat + journal |
| Présence | Non | `last_seen_at` + `is_online` + `/admin/presence` |
| ETL | Moteur simple | Package `etl/` Medallion + parallélisme |
| Déploiement | Nécessite Supabase | `uvicorn main:app` + SQLite, 100 % local |

---

## 7. Lancement

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # adapter JWT_SECRET en prod
uvicorn main:app --reload --port 8000
```

- API : http://localhost:8000
- Docs OpenAPI : http://localhost:8000/docs
- Admin par défaut : `aaprovidir` / `aaprovidir` (à changer après première connexion)

---

## 8. Extension Talend / n8n (juin 2026)

Ajouts majeurs documentés en détail dans **[RAPPORT_PROJET.md](./RAPPORT_PROJET.md)** :

| Module | Rôle |
|--------|------|
| `pipeline_service.py` | Exécution tracée avec `runId` et logs par nœud |
| `scheduler.py` | Planification cron (APScheduler) |
| `routers/connections.py` | Connexions BDD réutilisables |
| `routers/executions.py` | Historique des runs |
| `routers/automation.py` | Schedules, webhooks, route publique `/api/hooks/{token}` |
| `etl/validate.py` | Règles de validation métier |
| `etl/http_action.py` | Requêtes HTTP sortantes |

**Nouvelles tables SQLite :** `connections`, `pipeline_runs`, `node_run_logs`, `schedules`, `webhooks`

**Nouveaux nœuds ETL :** triggers, `http_request`, `lookup`, `union`, `cast`, `split`, `pivot`, `validate`, `branch`, **`agri_classify`**, **`causal_analysis`**, **`predict`**, **`embed_text`**

---

## 9. Extension IA & frontend (juin 2026)

| Composant frontend | Rôle |
|--------------------|------|
| `WelcomeModal.tsx` | Accueil automatique à la connexion |
| `AIGlobalShell.tsx` | Panneau flottant + `Ctrl+Shift+I` |
| `AIConductor.tsx` | Wizard pipeline guidé post-import |
| `AIAssistant.tsx` | Génération code pandas/SQL |
| `AIButton.tsx` | Déclencheurs IA contextuels |
| `HelpPanel.tsx` | Centre d'aide (8 sections) |
| `AnalyticsPanel.tsx` | Analytiques multi-projets |
| `ai/AIContext.tsx` | Provider global IA |

---

## 10. Reste à faire

- [ ] Persistance sessions conducteur en SQLite
- [ ] Tests automatisés `pytest` sur le moteur ETL et le conducteur IA
- [ ] Durcissement sandbox `custom` (RestrictedPython / conteneur)
- [ ] Chiffrement des credentials connexions en base
- [ ] Exécution pipeline asynchrone (file de jobs)
- [ ] Nettoyage dépendance `@supabase/supabase-js` côté **frontend** (si encore présente)

---

## 12. Fichiers de référence

| Document | Contenu |
|---|---|
| **[RAPPORT_PROJET.md](./RAPPORT_PROJET.md)** | **Rapport équipe complet** (design, API, installation) |
| `CAHIER_DES_CHARGES_BACKEND.md` | Spécification initiale (architecture cible `app/`) |
| `MISE_A_JOUR_BACKEND.md` | **Ce document** — delta backend |
| `supabase/schema.sql` | Ancien schéma Postgres (obsolète côté runtime) |
| `backend/.env.example` | Configuration locale |
