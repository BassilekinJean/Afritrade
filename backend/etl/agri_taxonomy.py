"""Taxonomie des domaines agricoles pour la classification par embeddings."""

from __future__ import annotations

from typing import Dict, List

# Catégories métier Aaprovidir — chaîne de valeur agricole africaine.
AGRI_DOMAINS: Dict[str, Dict[str, str]] = {
    "production": {
        "label": "Production agricole",
        "description": (
            "rendement récolte culture plantation hectare parcelle ferme exploitation agricole "
            "semis récolte tonnage production agricole maïs riz manioc cacao café coton arachide "
            "banane igname sorgho mil légume fruitier élevage bétail volaille apiculture"
        ),
    },
    "prix_marche": {
        "label": "Prix & marchés",
        "description": (
            "prix marché cotation bourse commodity tarif vente achat FAO commodity prix producteur "
            "prix gros détail marché local prix export import valeur commerciale"
        ),
    },
    "meteo_climat": {
        "label": "Météo & climat",
        "description": (
            "pluie précipitation température sécheresse humidité climat saison mousson "
            "évapotranspiration bulletin météo prévision météorologique aléas climatiques"
        ),
    },
    "intrants_logistique": {
        "label": "Intrants & logistique",
        "description": (
            "engrais semence pesticide intrant fertilisant stock entrepôt transport logistique "
            "approvisionnement chaîne logistique distribution entrepôt silo stockage"
        ),
    },
    "cooperative_commerce": {
        "label": "Coopératives & commerce",
        "description": (
            "coopérative producteur association groupement exportateur importateur commerce "
            "contrat commercial vente collective acheteur transformateur agro-industrie"
        ),
    },
    "nutrition_securite": {
        "label": "Nutrition & sécurité alimentaire",
        "description": (
            "nutrition sécurité alimentaire faim sous-alimentation ration alimentaire "
            "disponibilité alimentaire accès nourriture malnutrition insécurité alimentaire"
        ),
    },
    "sante_sols": {
        "label": "Sols, eau & santé des cultures",
        "description": (
            "sol fertilité ph irrigation eau ressource hydrique salinité érosion "
            "maladie parasite ravageur fongicide traitement phytosanitaire santé végétale"
        ),
    },
    "politique_subventions": {
        "label": "Politiques & subventions",
        "description": (
            "subvention politique agricole réglementation loi cadre programme gouvernement "
            "aide publique financement crédit agricole politique publique PAC"
        ),
    },
}


def domain_labels() -> Dict[str, str]:
    return {k: v["label"] for k, v in AGRI_DOMAINS.items()}


def taxonomy_corpus() -> List[tuple[str, str]]:
    """(domain_id, texte) pour entraîner les centroïdes."""
    return [(did, f"{meta['label']} {meta['description']}") for did, meta in AGRI_DOMAINS.items()]
