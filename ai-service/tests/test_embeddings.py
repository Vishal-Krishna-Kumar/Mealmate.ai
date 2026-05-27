"""Tests for the LSA dense-embedding component."""

from __future__ import annotations

import numpy as np

from app.embeddings import LsaEmbedder


CORPUS = [
    "tomato pasta basil italian",
    "spinach pasta lasagna italian",
    "chicken curry rice indian",
    "lentil curry indian",
    "beef taco mexican",
    "bean taco mexican vegetarian",
]


def test_lsa_fits_and_returns_dense_matrix() -> None:
    emb = LsaEmbedder()
    emb.fit(CORPUS)
    assert emb.is_fitted
    assert emb.matrix.shape[0] == len(CORPUS)
    # L2-normalised rows.
    norms = np.linalg.norm(emb.matrix, axis=1)
    assert np.allclose(norms, 1.0, atol=1e-6)


def test_lsa_similarity_prefers_thematic_neighbour() -> None:
    emb = LsaEmbedder()
    emb.fit(CORPUS)
    sims = emb.similarity("pasta italian")
    # Indices 0 and 1 are the italian-pasta docs; should dominate.
    assert sims.argmax() in (0, 1)
    assert sims[0] > sims[2]  # italian > indian


def test_lsa_empty_returns_zeros_when_unfitted() -> None:
    emb = LsaEmbedder()
    # Not fitted yet → similarity returns zeros.
    sims = emb.similarity("anything")
    assert sims.shape == (0,) or np.all(sims == 0)
