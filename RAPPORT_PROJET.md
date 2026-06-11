# Rapport projet — Aaprovidir DataPipe

> **Document de référence pour l'équipe** — état du projet, fonctionnalités, charte graphique, installation et pistes de travail.
>
> Dernière mise à jour : **11 juin 2026**

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
```

---

## 4. Refonte design — Charte Aaprovidir

### 4.1 Identité visuelle

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

### 4.2 Assets logo

| Fichier source | Copie utilisée par l'app |
|----------------|-------------------------|
| ` couleurs _caractere /Logo Aaprovidir name.png` | `frontend/public/brand/logo-name-blue.png` |
| ` couleurs _caractere /Logo Aaprovidir white name.png` | `frontend/public/brand/logo-name-white.png` |
| ` couleurs _caractere /Logo Aaprovidir A white.png` | `frontend/public/brand/logo-icon-white.png` |
| ` couleurs _caractere /Logo Aaprovidir A-09.png` | `frontend/public/brand/logo-icon-dark.png` |

### 4.3 Fichiers design frontend

| Fichier | Rôle |
|---------|------|
| `frontend/tailwind.config.js` | Tokens couleurs Tailwind |
| `frontend/src/index.css` | Styles globaux, React Flow, classes `.brand-*` |
| `frontend/src/lib/brand.ts` | Constantes marque |
| `frontend/src/components/brand/Logo.tsx` | `Logo`, `LogoMark`, `BrandHeader` |
| `frontend/src/components/icons/Icons.tsx` | Icônes SVG ligne (remplace les emojis) |

### 4.4 Écrans refondus

- **Login** : split-screen bleu corporate + formulaire ; **filigrane logo A** en arrière-plan ; texte agricole
- **Projets** : sidebar bleu `#0D2C54`, logo Aaprovidir, navigation Exécutions / Connexions
- **Éditeur pipeline** : header brandé, palette par catégories, icônes SVG sur les nœuds
- **Admin / Profil** : thème clair cohérent avec la charte

### 4.5 Règles pour la suite du design

- Ne pas dépasser **40 %** de surface en Bleu Corporate sur un écran
- Jaune Action : **accents uniquement** (CTA secondaires, badges)
- Texte corps : `#424242` (Gris Foncé), pas de noir pur `#000`
- Pas d'emojis dans l'UI — utiliser `Icon` / `NodeIcon` depuis `components/icons/Icons.tsx`

---

## 5. Architecture applicative

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (React + React Flow) — localhost:5173             │
│  Login · Projets · Éditeur · Admin · Exécutions · Connexions│
└───────────────────────────┬─────────────────────────────────┘
                            │ JWT Bearer /api/*
┌───────────────────────────▼─────────────────────────────────┐
│  Backend FastAPI v2.0 — localhost:8000                      │
│  auth · admin · projects · connections · executions         │
│  automation · pipeline · export · etl/analyze · ai            │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  SQLite datapipe.sqlite + staging (raw / clean / warehouse)   │
│  Fichiers importés : backend/.data/uploads/                   │
└─────────────────────────────────────────────────────────────┘
```

### Parcours utilisateur type

1. **Login** → liste projets
2. **Créer / ouvrir un projet** → éditeur ETL
3. **Importer** (fichier, URL, BDD) → **Qualité** → canvas → **Exécuter**
4. **Automation** : webhook ou cron (optionnel)
5. **Exécutions** : consulter l'historique et les logs par nœud
6. **Connexions** : enregistrer une URL BDD réutilisable

---

## 6. Structure des dossiers (repères)

```
Afritrade/
├── RAPPORT_PROJET.md          ← ce document
├── MISE_A_JOUR_BACKEND.md     ← détail backend (auth, ETL, Supabase retiré)
├── CAHIER_DES_CHARGES.md      ← spec initiale (partiellement obsolète)
├──  couleurs _caractere /     ← charte graphique + logos source
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── pipeline_service.py
│   ├── scheduler.py
│   ├── routers/
│   └── etl/
└── frontend/
    ├── public/brand/          ← logos servis par l'app
    └── src/
        ├── pages/             ← Login, Projects, ProjectEditor, Admin…
        ├── components/        ← Palette, PipeNode, panels…
        ├── api/               ← clients REST
        └── nodeCatalog.ts     ← catalogue des nœuds ETL
```

---

## 7. Fonctionnalités déjà en place (rappel)

- Auth locale JWT, admin, présence temps réel, journal d'activité
- CRUD projets (graphe JSON persisté)
- ETL Medallion (RAW → CLEAN → WAREHOUSE)
- Import : CSV, Excel, PDF, Word, JSON, SQL, SQLite, URL, BDD
- Transformations : filter, select, rename, sort, aggregate, join, sql, custom…
- Qualité descriptive (`DataQualityPanel`) + validation exécutable (`validate`)
- Export : CSV, JSON, JSONL, SQLite, Parquet
- Assistant IA (OpenAI si clé, sinon heuristiques locales)
- Mode démo : `/demo` (sans connexion)

---

## 8. Limites connues / non implémenté

| Élément | Statut |
|---------|--------|
| Exécution asynchrone / file de jobs | Non |
| Switch multi-branches (> 2 sorties) | Non |
| Chiffrement des credentials connexions | Non (URL en clair en SQLite) |
| Onglet sidebar **Analytiques** | Placeholder |
| Polices Gotham / VAG Rounded (charte) | Non chargées (licences) — Plus Jakarta Sans utilisée |
| Credentials webhook signés (HMAC) | Token URL uniquement |

---

## 9. Pistes de travail pour l'équipe

### Priorité haute

- [ ] Harmoniser les panneaux **Exécutions**, **Connexions**, **Automation** au niveau de finition du Login / Projets
- [ ] Tests manuels webhooks + cron sur un projet réel
- [ ] Documenter des **exemples de pipelines agricoles** (prix marché, stocks coopérative…)

### Priorité moyenne

- [ ] Onglet **Analytiques** (stats runs, taux d'échec)
- [ ] Chiffrement des `connection_url` en base
- [ ] Aligner `CAHIER_DES_CHARGES.md` et `MISE_A_JOUR_BACKEND.md` avec l'état actuel (export, automation)

### Design

- [ ] Déclinaison mobile complète (sidebar projets)
- [ ] Favicon optimisé (version icône simplifiée < 32px selon charte)
- [ ] Templates de pipelines agricoles pré-configurés

---

## 10. Commandes utiles

```bash
# Build frontend production
cd frontend && npm run build

# Vérifier les routes API
curl http://localhost:8000/api/health

# Déclencher un webhook (exemple)
curl -X POST http://localhost:8000/api/hooks/VOTRE_TOKEN \
  -H "Content-Type: application/json" \
  -d '{"source": "test"}'
```

---

## 11. Contacts & conventions

- **Langue UI** : français
- **Commits** : messages clairs, en français ou anglais selon habitude de l'équipe
- **Branche** : travailler sur des branches feature, PR vers `main`
- **Ne pas committer** : `.env`, fichiers SQLite de dev avec données sensibles (vérifier `.gitignore`)

---

*Document maintenu par l'équipe Aaprovidir / hackathon DataPipe. Mettre à jour ce fichier à chaque jalon significatif.*
