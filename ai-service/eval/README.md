# Recommender evaluation

Run the offline harness:

```powershell
cd mealmate/ai-service
.\.venv\Scripts\python.exe eval/run_eval.py
```

Outputs:

- `reports/eval_results.json` — raw metrics per strategy
- `reports/eval_report.md` — paper-ready Markdown table

## What it measures

We use a leave-one-out pantry-completion proxy: for each recipe in the corpus
we sample 30 % of its ingredients as the user pantry, ask each strategy
(`tfidf` / `lsa` / `collab` / `hybrid`) for its top-10 predictions, and check
whether the held-out recipe re-appears.

The collaborative strategy additionally receives one synthetic "liked" recipe
drawn from a tag-matched neighbour, simulating a user with at least one
previous like.

Metrics: **Recall@5**, **Recall@10**, **Mean Reciprocal Rank (MRR)**,
**NDCG@10**, and **median request latency**.

## Limitations

This is an offline proxy — the synthetic pantry comes from the held-out
recipe itself, which biases the lexical signal upward. The intended use of
the harness is to track *relative* improvement from adding the LSA and
collaborative signals to the TF-IDF baseline, and to set a sanity-check
baseline before any online A/B test.
