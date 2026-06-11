# Aaprovidir DataPipe

Plateforme **ETL visuelle** pour les données agricoles — import, transformation, qualité, intelligence agricole, export et automation (webhooks, cron).

## Fonctionnalités clés

- **Conducteur IA** : après import, l'assistant guide l'utilisateur (objectif → plan → validation étape par étape) et construit le pipeline sur le canvas
- **Accueil à la connexion** : résumé de la dernière activité + suggestion pour continuer
- **Assistant IA global** : bouton flottant ✨, raccourci `Ctrl+Shift+I`, génération code pandas/SQL
- **Intelligence agricole** : embeddings TF-IDF, classification, analyse causale, prédiction
- **Centre d'aide** intégré + panneau **Analytiques**

## Démarrage rapide

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

- **App** : http://localhost:5173  
- **API** : http://localhost:8000  
- **Compte initial** : `aaprovidir` / `aaprovidir` (voir `backend/.env`)

### IA cloud (optionnel)

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

Sans clé API : mode **heuristique local** (transformations agricoles courantes).

## Documentation équipe

| Document | Contenu |
|----------|---------|
| **[RAPPORT_PROJET.md](./RAPPORT_PROJET.md)** | **Rapport complet** — IA, conducteur, Talend/n8n, design, API, installation |
| [MISE_A_JOUR_BACKEND.md](./MISE_A_JOUR_BACKEND.md) | Détail backend (auth, ETL, IA, conducteur, endpoints) |
| [CAHIER_DES_CHARGES.md](./CAHIER_DES_CHARGES.md) | Spécification initiale (partiellement obsolète) |

## Charte graphique

Logos et charte : dossier `couleurs _caractere /`  
Assets web : `frontend/public/brand/`
