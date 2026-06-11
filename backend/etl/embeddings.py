"""Service d'embeddings léger (TF-IDF numpy) pour classification sémantique agricole.

Fonctionne 100 % hors-ligne sans dépendance scikit-learn.
"""

from __future__ import annotations

import math
import re
from collections import Counter
from typing import Dict, List, Optional, Tuple

import numpy as np

from .agri_taxonomy import taxonomy_corpus

_vectorizer_vocab: Optional[List[str]] = None
_idf: Optional[np.ndarray] = None
_domain_ids: List[str] = []
_centroid_matrix: Optional[np.ndarray] = None


def _tokenize(text: str) -> List[str]:
    text = (text or "").lower()
    text = re.sub(r"[^\w\sàâäéèêëïîôùûüç-]", " ", text, flags=re.UNICODE)
    tokens = [t for t in text.split() if len(t) > 1]
    # bi-grams simples
    bigrams = [f"{tokens[i]}_{tokens[i+1]}" for i in range(len(tokens) - 1)]
    return tokens + bigrams


def _build_vocab(corpus_tokens: List[List[str]], max_features: int = 2048) -> List[str]:
    freq: Counter[str] = Counter()
    for doc in corpus_tokens:
        freq.update(set(doc))
    return [w for w, _ in freq.most_common(max_features)]


def _tfidf_vector(tokens: List[str], vocab: List[str], idf: np.ndarray) -> np.ndarray:
    idx = {w: i for i, w in enumerate(vocab)}
    tf = Counter(tokens)
    vec = np.zeros(len(vocab), dtype=float)
    if not tokens:
        return vec
    for term, count in tf.items():
        if term in idx:
            vec[idx[term]] = (1 + math.log(count)) * idf[idx[term]]
    norm = np.linalg.norm(vec)
    return vec / norm if norm > 0 else vec


def _ensure_model() -> None:
    global _vectorizer_vocab, _idf, _domain_ids, _centroid_matrix
    if _vectorizer_vocab is not None:
        return
    pairs = taxonomy_corpus()
    _domain_ids = [p[0] for p in pairs]
    corpus_tokens = [_tokenize(p[1]) for p in pairs]
    _vectorizer_vocab = _build_vocab(corpus_tokens)
    n_docs = len(corpus_tokens)
    df = np.zeros(len(_vectorizer_vocab))
    idx = {w: i for i, w in enumerate(_vectorizer_vocab)}
    for doc in corpus_tokens:
        seen = set()
        for t in doc:
            if t in idx and t not in seen:
                df[idx[t]] += 1
                seen.add(t)
    _idf = np.log((1 + n_docs) / (1 + df)) + 1
    centroids = []
    for doc in corpus_tokens:
        centroids.append(_tfidf_vector(doc, _vectorizer_vocab, _idf))
    _centroid_matrix = np.vstack(centroids)


def embed_text(text: str) -> np.ndarray:
    _ensure_model()
    assert _vectorizer_vocab is not None and _idf is not None
    return _tfidf_vector(_tokenize(text), _vectorizer_vocab, _idf)


def _cosine(a: np.ndarray, b: np.ndarray) -> float:
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(a, b) / (na * nb))


def classify_text(text: str, top_k: int = 3) -> Dict[str, object]:
    _ensure_model()
    assert _centroid_matrix is not None and _vectorizer_vocab is not None
    q = embed_text(text)
    sims = [_cosine(q, _centroid_matrix[i]) for i in range(len(_domain_ids))]
    ranked = sorted(zip(_domain_ids, sims), key=lambda x: x[1], reverse=True)
    top = ranked[0]
    scores = {did: round(float(sc), 4) for did, sc in ranked}
    return {
        "domain": top[0],
        "confidence": round(float(top[1]), 4),
        "scores": scores,
        "topMatches": [{"domain": d, "score": round(float(s), 4)} for d, s in ranked[:top_k]],
        "embeddingMethod": "tfidf-numpy",
        "dimensions": len(_vectorizer_vocab),
    }


def semantic_similarity(text_a: str, text_b: str) -> float:
    return _cosine(embed_text(text_a), embed_text(text_b))


def top_dimensions(text: str, n: int = 8) -> List[Tuple[str, float]]:
    _ensure_model()
    assert _vectorizer_vocab is not None
    vec = embed_text(text)
    idx = np.argsort(vec)[::-1][:n]
    return [(str(_vectorizer_vocab[i]), round(float(vec[i]), 4)) for i in idx if vec[i] > 0]
