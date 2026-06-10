# Cahier des Charges — AAPROVIDIR

> **ETL Visuel pour Pipelines Bancaires**
> Interface web nodale de conception de flux d'ingestion et de transformation de données, augmentée par un assistant IA.

| Champ | Valeur |
|---|---|
| **Nom du projet** | AAPROVIDIR |
| **Type** | Application web (éditeur nodal d'ETL) |
| **Contexte** | Secteur bancaire et financier camerounais / africain |
| **Durée de réalisation** | 7 heures (hackathon) |
| **Équipe** | 4 personnes |
| **Outil de développement** | Cursor (IA) |
| **Langue de l'interface** | Français, Anglais |
| **Devise de référence** | FCFA (XAF) |

---

## 1. Contexte et problématique

### 1.1 Contexte africain / camerounais

Les institutions financières d'Afrique centrale et de l'Ouest (banques commerciales, microfinances/EMF, opérateurs de **Mobile Money** comme MTN MoMo et Orange Money, fintechs) manipulent quotidiennement de **gros volumes de données hétérogènes** :

- Relevés de transactions exportés en **CSV** (parfois avec séparateur `;` et virgule décimale, héritage Excel francophone).
- Flux **JSON** issus d'API de paiement mobile et d'agrégateurs (GIMAC, switches monétiques).
- Bases **SQL** des core banking systems et des systèmes de reporting.

Ces données doivent être **nettoyées, normalisées et consolidées** pour :

- le **reporting réglementaire** (COBAC / BEAC, déclarations ANIF pour la lutte anti-blanchiment) ;
- la **réconciliation** Mobile Money ↔ comptes bancaires ;
- la détection de fraude et le scoring de crédit.

### 1.2 Problème

Aujourd'hui, ces transformations sont faites **manuellement dans Excel** ou via des **scripts SQL/Python éparpillés**, écrits par quelques rares profils techniques. Résultat : lenteur, erreurs humaines, absence de traçabilité, et dépendance forte à l'expert qui connaît les scripts.

### 1.3 Solution proposée

**AAPROVIDIR** : une interface web **visuelle et nodale** (type « glisser-déposer ») permettant à un analyste — **sans écrire de code** — de :

1. **Connecter des sources** de données (CSV, JSON, base SQL).
2. **Chaîner des transformations** (filtres, jointures, nettoyage, agrégations) sous forme de graphe de nœuds.
3. **Prévisualiser** le résultat à chaque étape.
4. **Exporter** le résultat (CSV/JSON) ou le matérialiser.

### 1.4 Bonus IA

Un **assistant IA** qui génère le code de transformation complexe (**requête SQL** ou **script de nettoyage Python/pandas**) à partir d'une **description en langage naturel** (en français, anglais), par exemple :
> « Garde uniquement les transactions MoMo supérieures à 500 000 FCFA des 30 derniers jours et regroupe-les par agence. »

---

## 2. Objectifs

### 2.1 Objectif principal (MVP — obligatoire en 7h)

Livrer une application web fonctionnelle permettant de **construire visuellement un pipeline** Source → Transformation → Sortie, de **l'exécuter sur des données réelles d'exemple**, et de **visualiser le résultat**.

### 2.2 Objectifs secondaires (Bonus si le temps le permet)

- Assistant IA de génération de transformations en langage naturel.
- Sauvegarde / rechargement d'un pipeline.
- Plusieurs types de transformations avancées.

### 2.3 Indicateurs de réussite (démo)

- [ ] Importer un CSV et un JSON d'exemple bancaires.
- [ ] Construire visuellement un pipeline d'au moins 3 nœuds.
- [ ] Exécuter et afficher un tableau de résultats correct.
- [ ] Exporter le résultat.
- [ ] (Bonus) Générer une transformation via une phrase en français et anglais.

---

## 3. Périmètre fonctionnel

### 3.1 Dans le périmètre (MVP)

| # | Fonctionnalité | Priorité |
|---|---|---|
| F1 | Canevas nodal : créer, déplacer, relier et supprimer des nœuds | **Must** |
| F2 | Nœud **Source** : import de fichier CSV (gestion séparateur `,`/`;`) | **Must** |
| F3 | Nœud **Source** : import de fichier JSON | **Must** |
| F4 | Nœud **Transformation** : filtre (conditions sur colonnes) | **Must** |
| F5 | Nœud **Transformation** : sélection/renommage de colonnes | **Must** |
| F6 | Nœud **Transformation** : agrégation (group by + somme/moyenne/compte) | **Should** |
| F7 | Nœud **Transformation** : jointure de deux sources | **Should** |
| F8 | Nœud **Sortie** : aperçu en tableau (pagination simple) | **Must** |
| F9 | Nœud **Sortie** : export CSV / JSON | **Must** |
| F10 | Exécution du pipeline (parcours du graphe dans l'ordre) | **Must** |
| F11 | Connexion à une base **SQL** (lecture d'une table / requête) | **Could** |

### 3.2 Bonus IA

| # | Fonctionnalité | Priorité |
|---|---|---|
| IA1 | Champ de saisie en langage naturel → génération de **SQL** | **Bonus** |
| IA2 | Génération de **script pandas** de nettoyage | **Bonus** |
| IA3 | Insertion du code généré comme nœud « Transformation personnalisée » | **Bonus** |
| IA4 | Explication en français ou anglais du code généré | **Bonus** |

### 3.3 Hors périmètre (explicitement exclu pour la version 7h)

- Authentification / gestion multi-utilisateurs avancée.
- Ordonnancement / planification (cron) des pipelines.
- Connecteurs temps réel (Kafka, streaming).
- Déploiement production, haute disponibilité, scalabilité horizontale.
- Gestion fine des droits et conformité réglementaire complète.

---

## 4. Acteurs et cas d'usage

### 4.1 Acteurs

| Acteur | Description |
|---|---|
| **Analyste de données / Data steward** | Utilisateur principal. Construit et exécute les pipelines sans coder. |
| **Responsable conformité (COBAC/ANIF)** | Consomme les jeux de données nettoyés pour le reporting. |
| **Développeur / IT** | Configure les connexions SQL, supervise. |

### 4.2 Cas d'usage clés

1. **Réconciliation Mobile Money** : importer un export MoMo (CSV) + un extrait des écritures bancaires (JSON/SQL), les joindre sur l'identifiant de transaction, filtrer les écarts.
2. **Reporting réglementaire** : agréger les transactions par agence et par tranche de montant pour une déclaration BEAC.
3. **Détection d'anomalies AML** : filtrer les transactions > seuil suspect (ex. 5 000 000 FCFA) sur une période.

### 4.3 Exemple de scénario (parcours utilisateur)

> L'analyste glisse un nœud **Source CSV**, charge `transactions_momo.csv`. Il ajoute un nœud **Filtre** (`montant > 500000`), le relie à la source, puis un nœud **Agrégation** (group by `agence`, somme `montant`). Il connecte un nœud **Sortie**, clique sur **Exécuter**, visualise le tableau, puis exporte en CSV.

---

## 5. Exigences fonctionnelles détaillées

### 5.1 Éditeur nodal (canevas)

- Palette de nœuds par catégorie : **Sources**, **Transformations**, **Sorties**.
- Glisser-déposer d'un nœud sur le canevas.
- Connexions par liens entre la sortie d'un nœud et l'entrée d'un autre.
- Validation : empêcher les cycles ; signaler un nœud non connecté.
- Sélection d'un nœud → panneau de configuration latéral.

### 5.2 Nœuds Source

- **CSV** : upload du fichier, détection/choix du séparateur et de l'encodage (UTF-8 par défaut), aperçu des 10 premières lignes, inférence des types (texte, nombre, date).
- **JSON** : upload, aplatissement (flatten) des objets imbriqués simples.
- **SQL** (Could) : chaîne de connexion + nom de table ou requête `SELECT`.

### 5.3 Nœuds Transformation

- **Filtre** : 1..n conditions (`colonne` `opérateur` `valeur`), opérateurs `=, ≠, >, <, ≥, ≤, contient`.
- **Sélection de colonnes** : choisir/renommer/réordonner.
- **Agrégation** : `group by` + fonctions `somme, moyenne, min, max, compte`.
- **Jointure** : type (`inner`, `left`), clé(s) de jointure entre deux entrées.
- **Transformation personnalisée (Bonus IA)** : code SQL/pandas exécuté sur le flux.

### 5.4 Nœud Sortie

- Aperçu en tableau paginé.
- Export **CSV** (séparateur configurable) et **JSON**.
- Affichage du nombre de lignes et colonnes résultantes.

### 5.5 Exécution

- Bouton **Exécuter** : tri topologique du graphe, exécution séquentielle, propagation des DataFrames.
- Affichage des erreurs par nœud (ex. colonne inexistante).
- Indicateur d'état par nœud (en attente / OK / erreur).

### 5.6 Assistant IA (Bonus)

- Zone de texte : description en français ou anglais + schéma des colonnes disponibles envoyé en contexte.
- Sortie : code (SQL ou pandas) + courte explication.
- Bouton « Insérer comme nœud » et « Copier ».
- Garde-fous : exécution en lecture seule, pas d'instructions destructrices (`DROP`, `DELETE`, `UPDATE` bloquées).

---

## 6. Exigences non-fonctionnelles

| Catégorie | Exigence |
|---|---|
| **Performance** | Traiter des fichiers jusqu'à ~100 000 lignes / 50 Mo en local sans bloquer l'UI. |
| **Contexte réseau** | Pensé pour une **bande passante faible/instable** : traitement majoritairement côté serveur local, pas de dépendance lourde. |
| **Localisation** | Interface 100 % en français ou anglais ; formats FCFA, dates `JJ/MM/AAAA`, séparateurs francophones. |
| **Utilisabilité** | Utilisable par un analyste non-développeur ; 3 clics max pour un pipeline simple. |
| **Robustesse** | Aucun crash sur fichier malformé : message d'erreur clair. |
| **Sécurité (données sensibles)** | Données traitées localement, pas de fuite vers des services tiers (sauf appel IA explicite et anonymisé). |
| **Portabilité** | Lançable en local via une commande simple ; navigateur Chrome/Firefox récent. |

---

## 7. Architecture et stack technique

> Stack pragmatique optimisée pour livrer en 7h avec Cursor.

```
┌──────────────────────────────────────────────────────┐
│                    NAVIGATEUR (Front)                  │
│  React + React Flow (canevas nodal) + Tailwind CSS     │
│  - Palette, canevas, panneau de config, tableau résult.│
└───────────────┬───────────────────────────────────────┘
                │  REST (JSON)
                ▼
┌──────────────────────────────────────────────────────┐
│              BACKEND (API)  — FastAPI (Python)          │
│  - /upload (CSV/JSON)   - /run (exécute le graphe)      │
│  - /ai/generate (assistant IA)                          │
│  Moteur d'exécution : pandas (DataFrames)               │
│  Connexion SQL : SQLAlchemy (optionnel)                 │
└───────────────┬───────────────────────────────────────┘
                │
                ▼
        Données d'exemple (CSV/JSON bancaires) + SQLite
```

### 7.1 Front-end

- **React** (Vite) + **React Flow** pour le graphe nodal.
- **Tailwind CSS** pour un rendu rapide et propre.
- Tableau de résultats léger (composant maison ou TanStack Table).

### 7.2 Back-end

- **FastAPI** (Python) — rapide à écrire, async, docs auto.
- **pandas** comme moteur de transformation (un nœud = une opération pandas).
- **SQLAlchemy** + **SQLite** pour la démo SQL.

### 7.3 IA (Bonus)

- Appel à un LLM (API OpenAI/Anthropic ou modèle local) via l'endpoint `/ai/generate`.
- Prompt système : « Tu es un assistant ETL bancaire. Génère du SQL/pandas sûr, en lecture seule, à partir du schéma fourni. »

### 7.4 Représentation d'un pipeline (modèle de données)

```json
{
  "nodes": [
    { "id": "n1", "type": "source_csv", "config": { "file": "momo.csv", "sep": ";" } },
    { "id": "n2", "type": "filter", "config": { "conditions": [{ "col": "montant", "op": ">", "val": 500000 }] } },
    { "id": "n3", "type": "aggregate", "config": { "group_by": ["agence"], "aggs": [{ "col": "montant", "fn": "sum" }] } },
    { "id": "n4", "type": "output", "config": { "format": "csv" } }
  ],
  "edges": [
    { "source": "n1", "target": "n2" },
    { "source": "n2", "target": "n3" },
    { "source": "n3", "target": "n4" }
  ]
}
```

---

## 8. Jeux de données d'exemple (à préparer)

| Fichier | Format | Description |
|---|---|---|
| `transactions_momo.csv` | CSV (`;`) | Transactions Mobile Money : `id, date, montant_fcfa, type, agence, telephone` |
| `comptes_bancaires.json` | JSON | Écritures bancaires : `id_transaction, compte, montant, devise` |
| `agences.csv` | CSV | Référentiel agences : `agence, ville, region` |
| `core_banking.sqlite` | SQLite | Table `transactions` pour la démo SQL |

> Les numéros de téléphone et identifiants doivent être **fictifs/anonymisés**.

---

## 9. Organisation de l'équipe et planning (7 heures)

### 9.1 Répartition des rôles (4 personnes)

| Rôle | Personne | Responsabilité |
|---|---|---|
| **Lead Front / Canevas** | Dev 1 | React Flow, palette, connexions, panneau de config |
| **Front / UI & Résultats** | Dev 2 | Tableau de résultats, export, intégration API, design Tailwind |
| **Lead Back / Moteur** | Dev 3 | FastAPI, moteur d'exécution pandas, endpoints upload/run |
| **Back / IA & Données** | Dev 4 | Assistant IA, connexion SQL, jeux de données, tests |

### 9.2 Planning horaire

| Heure | Objectif | Tous / Par binôme |
|---|---|---|
| **H0 – H0:30** | Cadrage : valider le périmètre MVP, contrat d'API, modèle JSON du pipeline | Toute l'équipe |
| **H0:30 – H1** | Setup repo (Cursor), squelette React+Vite, squelette FastAPI, données d'exemple | Tous en parallèle |
| **H1 – H3** | **Cœur MVP** : canevas nodal (F1) + endpoints upload/run + nœuds Source CSV/JSON (F2,F3) | Front 1+2 / Back 3+4 |
| **H3 – H4:30** | Transformations Filtre/Sélection/Agrégation (F4,F5,F6) + tableau résultats (F8) | Binômes |
| **H4:30 – H5:30** | Export (F9), jointure (F7), gestion d'erreurs ; **début Bonus IA** | Back 4 sur IA |
| **H5:30 – H6:15** | Intégration complète bout-en-bout + finalisation Bonus IA (IA1/IA2) | Tous |
| **H6:15 – H6:45** | Tests sur scénarios, correction de bugs, jeu de démo figé | Tous |
| **H6:45 – H7** | Préparation du pitch + répétition de la démo | Tous |

### 9.3 Stratégie anti-blocage

- **MVP d'abord, IA ensuite** : ne jamais sacrifier le pipeline visuel pour l'IA.
- **Contrat d'API figé à H0:30** pour que front et back avancent en parallèle.
- **Données de démo figées tôt** pour fiabiliser la présentation.
- Branche `main` toujours fonctionnelle ; merges fréquents.

---

## 10. Livrables

- [ ] Code source (front + back) sur le dépôt Git.
- [ ] `README.md` : installation, lancement, captures d'écran.
- [ ] Jeux de données d'exemple bancaires anonymisés.
- [ ] Application lançable en local (commandes documentées).
- [ ] (Bonus) Endpoint et UI de l'assistant IA.
- [ ] Support de pitch (3–5 min) + scénario de démo.

---

## 11. Critères d'acceptation

| Critère | Validation |
|---|---|
| Construction visuelle d'un pipeline ≥ 3 nœuds | Démo en direct |
| Import CSV **et** JSON fonctionnels | Démo |
| Au moins 3 transformations opérationnelles (filtre, sélection, agrégation) | Démo |
| Exécution correcte et résultat affiché en tableau | Vérification des chiffres |
| Export CSV/JSON téléchargeable | Fichier ouvert et vérifié |
| Gestion d'erreur sur fichier/colonne invalide | Test négatif |
| (Bonus) Génération d'une transformation via texte FR | Démo |

---

## 12. Risques et mitigations

| Risque | Impact | Mitigation |
|---|---|---|
| React Flow mal maîtrisé | Élevé | Prototype canevas dès H0:30 ; tutoriel prêt |
| Trop de temps sur l'IA | Élevé | IA strictement en bonus, après le MVP |
| Formats CSV francophones (`;`, virgule décimale) | Moyen | Détection auto + option manuelle |
| Intégration front/back tardive | Moyen | Contrat d'API tôt, mocks côté front |
| Connexion SQL chronophage | Faible | SQLite local pré-rempli, fonctionnalité « Could » |
| Données sensibles réelles | Légal | Uniquement des données fictives/anonymisées |

---

## 13. Évolutions futures (post-hackathon)

- Authentification et espaces de travail par équipe.
- Planification et exécution récurrente des pipelines.
- Connecteurs supplémentaires (PostgreSQL, API MoMo/Orange Money réelles, GIMAC).
- Versionnage et historique des pipelines.
- Traçabilité (audit log) pour conformité COBAC/ANIF.
- Traitement de gros volumes (passage à Polars / Spark).
- Bibliothèque de modèles de pipelines bancaires prêts à l'emploi.

---

## 14. Glossaire

| Terme | Définition |
|---|---|
| **ETL** | Extract, Transform, Load — extraction, transformation et chargement de données. |
| **Nœud** | Bloc visuel représentant une opération (source, transformation, sortie). |
| **Pipeline** | Enchaînement de nœuds décrivant un flux de données. |
| **Mobile Money** | Service de paiement via mobile (MTN MoMo, Orange Money). |
| **COBAC** | Commission Bancaire de l'Afrique Centrale (régulateur). |
| **BEAC** | Banque des États de l'Afrique Centrale. |
| **ANIF** | Agence Nationale d'Investigation Financière (anti-blanchiment, Cameroun). |
| **GIMAC** | Groupement Interbancaire Monétique de l'Afrique Centrale. |
| **EMF** | Établissement de Microfinance. |
| **FCFA (XAF)** | Franc CFA d'Afrique centrale. |
| **AML** | Anti-Money Laundering (lutte anti-blanchiment). |
