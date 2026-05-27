"""Latent Semantic Analysis (LSA) embedder for recipes.

Builds dense, length-normalised recipe embeddings by running ``TruncatedSVD``
on the existing TF-IDF matrix. The transform is fully sklearn, fully offline,
trains in milliseconds, and gives the hybrid recommender a *semantic* signal
to combine with the lexical TF-IDF signal — analogous to early dense-retrieval
baselines used in IR research.

Why LSA and not sentence-transformers?
--------------------------------------
sentence-transformers requires PyTorch (~1 GB) and prebuilt wheels for the
host Python version. By staying inside scikit-learn we keep the AI service
< 200 MB and importable on Python 3.10–3.14 without any toolchain. The hybrid
recommender API is identical to what a deep-embedding swap would expose, so
sentence-transformers can be dropped in later behind the same interface
without touching callers.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import normalize


@dataclass
class LsaEmbedder:
    """Wraps a TF-IDF vectorizer + TruncatedSVD into a single embedder."""

    n_components: int = 64
    _vectorizer: TfidfVectorizer | None = None
    _svd: TruncatedSVD | None = None
    _matrix: np.ndarray | None = None

    def fit(self, docs: list[str]) -> None:
        if not docs:
            raise ValueError("LsaEmbedder needs at least one document")
        # Allow few docs (tests) by capping components below vocab size.
        n_components = max(2, min(self.n_components, max(2, len(docs) - 1)))
        self._vectorizer = TfidfVectorizer(
            ngram_range=(1, 2),
            min_df=1,
            sublinear_tf=True,
            stop_words="english",
        )
        tfidf = self._vectorizer.fit_transform(docs)
        # SVD requires n_components < min(n_features, n_samples).
        n_components = min(n_components, max(2, tfidf.shape[1] - 1))
        self._svd = TruncatedSVD(n_components=n_components, random_state=42)
        dense = self._svd.fit_transform(tfidf)
        self._matrix = normalize(dense, norm="l2")

    def transform(self, docs: list[str]) -> np.ndarray:
        if self._vectorizer is None or self._svd is None:
            raise RuntimeError("LsaEmbedder must be fit() before transform()")
        tfidf = self._vectorizer.transform(docs)
        dense = self._svd.transform(tfidf)
        return normalize(dense, norm="l2")

    @property
    def matrix(self) -> np.ndarray:
        if self._matrix is None:
            raise RuntimeError("LsaEmbedder must be fit() first")
        return self._matrix

    def similarity(self, query_doc: str, *, corpus_indices: list[int] | None = None) -> np.ndarray:
        """Return cosine similarity between query and (a subset of) the corpus.

        When the embedder hasn't been fitted yet we return a zero-length array
        so callers can chain ``if sims.size`` checks without try/except.
        """
        if not self.is_fitted:
            return np.zeros(0)
        q = self.transform([query_doc])[0]
        m = self.matrix if corpus_indices is None else self.matrix[corpus_indices]
        return m @ q  # both are l2-normalised so dot product == cosine

    @property
    def is_fitted(self) -> bool:
        return self._matrix is not None
