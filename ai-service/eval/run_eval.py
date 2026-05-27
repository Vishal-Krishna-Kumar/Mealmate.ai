"""Offline evaluation harness for the MealMate recipe recommender.

Methodology (leave-one-out / pantry-completion proxy)
-----------------------------------------------------
Because the bundled corpus has no real user interaction log, we use a synthetic
held-out evaluation proxy that is standard in cold-start recommender research:

1. For each recipe ``r`` in the corpus we sample a fraction ``QUERY_FRAC``
   (default 30 %) of its ingredients as the "user pantry" query.
2. We then ask each recommender strategy for its top-K predictions.
3. We record whether the held-out recipe ``r`` appears in the top-K — this is
   our positive signal — and at which rank.
4. We aggregate Recall@5, Recall@10, MRR and NDCG@10 per strategy.

The collaborative-filter strategy additionally receives 1-2 "liked" recipes
drawn from the recipes that share the most tags with ``r`` (a stand-in for
"users who liked X also liked Y" without real interaction data).

The harness is fully deterministic (seeded RNG) and runs in seconds on a
laptop. Results are written to ``reports/eval_results.json`` and a
Markdown summary to ``reports/eval_report.md``.
"""

from __future__ import annotations

import json
import math
import random
import statistics
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

# Allow running this file directly (python eval/run_eval.py) by making the
# project root importable.
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app._text import Recipe  # noqa: E402
from app.recommender import RecommenderService  # noqa: E402
from app.schemas import Strategy  # noqa: E402

QUERY_FRAC = 0.3
SEED = 42
TOP_K = 10
STRATEGIES: tuple[Strategy, ...] = ("tfidf", "lsa", "collab", "hybrid")


@dataclass
class StrategyMetrics:
    recall_at_5: float
    recall_at_10: float
    mrr: float
    ndcg_at_10: float
    median_latency_ms: float
    queries: int

    def to_dict(self) -> dict[str, float]:
        return {
            "recall@5": round(self.recall_at_5, 4),
            "recall@10": round(self.recall_at_10, 4),
            "mrr": round(self.mrr, 4),
            "ndcg@10": round(self.ndcg_at_10, 4),
            "median_latency_ms": round(self.median_latency_ms, 2),
            "queries": float(self.queries),
        }


def _sample_pantry(recipe: Recipe, rng: random.Random) -> list[str]:
    n = max(1, math.ceil(len(recipe.ingredients) * QUERY_FRAC))
    return rng.sample(list(recipe.ingredients), min(n, len(recipe.ingredients)))


def _pick_likes(target: Recipe, all_recipes: list[Recipe], rng: random.Random) -> list[str]:
    """Pick 1-2 recipes that share at least one tag with the target."""
    target_tags = set(target.tags)
    candidates = [
        r for r in all_recipes
        if r.recipe_id != target.recipe_id and (set(r.tags) & target_tags)
    ]
    if not candidates:
        return []
    return [rng.choice(candidates).recipe_id]


def _dcg(rank: int) -> float:
    # 1-based rank, single relevant doc with relevance 1
    if rank <= 0:
        return 0.0
    return 1.0 / math.log2(rank + 1)


def _evaluate_one(
    rec: RecommenderService,
    target: Recipe,
    strategy: Strategy,
    rng: random.Random,
) -> tuple[int, float]:
    """Run a single held-out query.

    Returns ``(rank, latency_ms)`` where ``rank`` is the 1-based rank of the
    held-out recipe in the top-K (or 0 if not found).
    """
    pantry = _sample_pantry(target, rng)
    likes: list[str] = []
    if strategy == "collab":
        likes = _pick_likes(target, rec.recipes, rng)
        if not likes:
            return 0, 0.0
    t0 = time.perf_counter()
    results = rec.recommend(
        ingredients=pantry,
        dietary_preferences=[],
        top_k=TOP_K,
        allergies=[],
        strategy=strategy,
        liked_recipe_ids=likes,
    )
    latency_ms = (time.perf_counter() - t0) * 1000
    for i, hit in enumerate(results, start=1):
        if hit.recipe_id == target.recipe_id:
            return i, latency_ms
    return 0, latency_ms


def evaluate(rec: RecommenderService, strategies: Iterable[Strategy] = STRATEGIES) -> dict[Strategy, StrategyMetrics]:
    rng = random.Random(SEED)
    out: dict[Strategy, StrategyMetrics] = {}
    for strat in strategies:
        # Re-seed per strategy so each gets the same held-out queries.
        rng_per = random.Random(SEED)
        hits_5 = 0
        hits_10 = 0
        rr_sum = 0.0
        dcg_sum = 0.0
        latencies: list[float] = []
        n_queries = 0
        for target in rec.recipes:
            rank, latency_ms = _evaluate_one(rec, target, strat, rng_per)
            if latency_ms == 0.0 and rank == 0 and strat == "collab":
                # No suitable like candidate — skip this query for collab.
                continue
            n_queries += 1
            latencies.append(latency_ms)
            if 1 <= rank <= 5:
                hits_5 += 1
            if 1 <= rank <= 10:
                hits_10 += 1
            if 1 <= rank <= 10:
                rr_sum += 1.0 / rank
                dcg_sum += _dcg(rank)  # ideal DCG for single relevant doc at rank 1 is 1.0
        if n_queries == 0:
            out[strat] = StrategyMetrics(0.0, 0.0, 0.0, 0.0, 0.0, 0)
            continue
        out[strat] = StrategyMetrics(
            recall_at_5=hits_5 / n_queries,
            recall_at_10=hits_10 / n_queries,
            mrr=rr_sum / n_queries,
            ndcg_at_10=dcg_sum / n_queries,
            median_latency_ms=statistics.median(latencies) if latencies else 0.0,
            queries=n_queries,
        )
    return out


def render_markdown(results: dict[Strategy, StrategyMetrics], rec: RecommenderService) -> str:
    lines: list[str] = []
    lines.append("# MealMate Recommender Evaluation\n")
    lines.append(
        f"_Corpus: **{rec.recipe_count} recipes** · Pantry sample: **{int(QUERY_FRAC*100)} %** of "
        f"each recipe's ingredients · Top-K: **{TOP_K}** · Seed: **{SEED}**_\n"
    )
    lines.append("\n## Held-out pantry-completion proxy\n")
    lines.append(
        "For each recipe we sample 30 % of its ingredients as the user query, "
        "then check whether the held-out recipe re-appears in each strategy's "
        "top-K. The collaborative strategy additionally receives one synthetic "
        "'liked' recipe drawn from a tag-matched neighbour.\n"
    )
    lines.append("\n| Strategy | Recall@5 | Recall@10 | MRR | NDCG@10 | Median latency (ms) | Queries |\n")
    lines.append("|---|---:|---:|---:|---:|---:|---:|\n")
    for strat, m in results.items():
        lines.append(
            f"| `{strat}` | {m.recall_at_5:.3f} | {m.recall_at_10:.3f} | {m.mrr:.3f} "
            f"| {m.ndcg_at_10:.3f} | {m.median_latency_ms:.2f} | {m.queries} |\n"
        )
    best = max(results.items(), key=lambda kv: kv[1].ndcg_at_10)
    lines.append(
        f"\n**Best NDCG@10:** `{best[0]}` with NDCG@10 = {best[1].ndcg_at_10:.3f} "
        f"({best[1].recall_at_10*100:.1f} % recall@10).\n"
    )
    lines.append(
        "\n_Limitations:_ this is an offline proxy; the synthetic pantry comes "
        "from the held-out recipe itself, which biases the lexical signal. "
        "The intended use is to track *relative* improvement from adding the "
        "LSA and collaborative signals to TF-IDF and to set a baseline before "
        "deploying online A/B tests.\n"
    )
    return "".join(lines)


def main() -> None:
    rec = RecommenderService()
    rec.load()
    results = evaluate(rec)

    out_dir = Path(__file__).resolve().parent / "reports"
    out_dir.mkdir(parents=True, exist_ok=True)

    json_payload = {
        "corpus_size": rec.recipe_count,
        "top_k": TOP_K,
        "query_fraction": QUERY_FRAC,
        "seed": SEED,
        "results": {strat: m.to_dict() for strat, m in results.items()},
    }
    (out_dir / "eval_results.json").write_text(
        json.dumps(json_payload, indent=2), encoding="utf-8"
    )
    (out_dir / "eval_report.md").write_text(
        render_markdown(results, rec), encoding="utf-8"
    )
    print(json.dumps(json_payload, indent=2))


if __name__ == "__main__":
    main()
