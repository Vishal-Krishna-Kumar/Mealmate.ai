"""Lightweight item-based collaborative filter for recipes.

Real meal-planning collaborative filtering needs production interaction logs
(user-recipe ratings, weekly-plan picks, completion events). In an academic
setting we bootstrap the collab signal from two readily-available proxies:

1. **Tag co-occurrence** — recipes that share the same tags or cuisine tend
   to be picked by the same users in real datasets (Food.com, RecipeQA).
2. **In-app interactions** — once the server starts recording meal-plan picks
   it can call :py:meth:`CollabFilter.add_interactions` to incrementally
   update the user-item matrix.

The fitted state is a per-recipe-pair cosine similarity table that the
hybrid recommender combines with the TF-IDF and LSA signals.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field

import numpy as np
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from ._text import Recipe, normalize


def _tag_token(tag: str) -> str:
    return normalize(tag).replace(" ", "_")


@dataclass
class CollabFilter:
    """Item-item collaborative recommender.

    Internally maintains a ``(n_recipes, n_recipes)`` similarity matrix that
    is the cosine similarity of each recipe's *tag profile* PLUS any
    aggregated user-interaction signal recorded at runtime.
    """

    interaction_weight: float = 1.5
    _recipe_ids: list[str] = field(default_factory=list)
    _id_to_idx: dict[str, int] = field(default_factory=dict)
    _base_similarity: np.ndarray | None = None
    _interaction_counts: dict[tuple[int, int], float] = field(default_factory=dict)

    def fit(self, recipes: list[Recipe]) -> None:
        self._recipe_ids = [r.recipe_id for r in recipes]
        self._id_to_idx = {rid: i for i, rid in enumerate(self._recipe_ids)}
        if not recipes:
            self._base_similarity = np.zeros((0, 0))
            return
        # Profile each recipe by tokenised tags + cuisine.
        profiles: list[str] = []
        for r in recipes:
            toks = [_tag_token(t) for t in r.tags if t]
            if r.cuisine:
                toks.append(_tag_token(f"cuisine_{r.cuisine}"))
            profiles.append(" ".join(toks) or "untagged")
        vec = CountVectorizer(token_pattern=r"[a-z0-9_]+", binary=True)
        m = vec.fit_transform(profiles)
        sim = cosine_similarity(m)
        np.fill_diagonal(sim, 0.0)
        self._base_similarity = sim
        self._interaction_counts.clear()

    def add_interactions(self, recipe_ids: list[str]) -> int:
        """Boost similarity between every pair of recipes co-occurring in a session.

        A "session" is typically one user's weekly meal plan — recipes a user
        picked in the same week are likely to be liked together by other
        similar users (the canonical user-item-CF assumption).

        Returns the number of distinct pairs that were recorded.
        """
        idxs = [self._id_to_idx[rid] for rid in recipe_ids if rid in self._id_to_idx]
        pairs = 0
        for i, a in enumerate(idxs):
            for b in idxs[i + 1 :]:
                key = (min(a, b), max(a, b))
                self._interaction_counts[key] = self._interaction_counts.get(key, 0.0) + 1.0
                pairs += 1
        return pairs

    def similarity_to(self, recipe_id: str) -> np.ndarray:
        """Return the similarity vector of ``recipe_id`` against every other recipe."""
        if self._base_similarity is None or not self.is_fitted:
            raise RuntimeError("CollabFilter must be fit() first")
        n = len(self._recipe_ids)
        target = self._id_to_idx.get(recipe_id)
        if target is None:
            return np.zeros(n)
        sims = self._base_similarity[target].copy()
        # Layer in any recorded interactions.
        if self._interaction_counts:
            # Normalise the running interaction counts to keep them on the
            # same scale as the cosine [0,1] base.
            max_count = max(self._interaction_counts.values())
            for (a, b), count in self._interaction_counts.items():
                norm = count / max_count
                if a == target:
                    sims[b] = min(1.0, sims[b] + self.interaction_weight * norm)
                elif b == target:
                    sims[a] = min(1.0, sims[a] + self.interaction_weight * norm)
        return sims

    def score_query(self, query_recipe_ids: list[str]) -> np.ndarray:
        """Score every recipe relative to a *set* of "liked" recipe ids.

        Used by the hybrid recommender to mix collab into the query-time
        ranking: when the user has interacted with R recipes, every other
        recipe gets the average similarity to those R.
        """
        if self._base_similarity is None or not self.is_fitted:
            return np.zeros(len(self._recipe_ids))
        idxs = [self._id_to_idx[r] for r in query_recipe_ids if r in self._id_to_idx]
        if not idxs:
            return np.zeros(len(self._recipe_ids))
        sims = np.mean(
            np.stack([self.similarity_to(self._recipe_ids[i]) for i in idxs]),
            axis=0,
        )
        return sims

    @property
    def is_fitted(self) -> bool:
        return self._base_similarity is not None and len(self._recipe_ids) > 0
