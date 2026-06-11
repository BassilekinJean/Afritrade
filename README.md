# Aaprovidir DataPipe

Plateforme **ETL visuelle** pour les données agricoles — import, transformation, qualité, export et automation (webhooks, cron).

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

## Documentation équipe

| Document | Contenu |
|----------|---------|
| **[RAPPORT_PROJET.md](./RAPPORT_PROJET.md)** | **Rapport complet** — fonctionnalités, charte graphique, API, installation, pistes de travail |
| [MISE_A_JOUR_BACKEND.md](./MISE_A_JOUR_BACKEND.md) | Détail backend (auth, ETL, migration Supabase) |
| [CAHIER_DES_CHARGES.md](./CAHIER_DES_CHARGES.md) | Spécification initiale (partiellement obsolète) |

## Charte graphique

Logos et charte : dossier ` couleurs _caractere /`  
Assets web : `frontend/public/brand/`
