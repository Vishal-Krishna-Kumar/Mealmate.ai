# MealMate — Research-grade design notes

> Companion technical document for the CS628 paper. Pairs with the engineering
> README. Captures the design decisions, datasets, algorithms, evaluation
> protocol and quantitative results that distinguish MealMate from a classroom
> CRUD assignment.

**Team:** Sumit K C · Thao Bui · Vishal Krishna Kumar
**Instructor:** Prof. Sivakumar Visweswaran · City University of Seattle
**Course:** CS628 — Software Engineering for the Cloud

---

## 1. System architecture

MealMate is a **3-tier polyglot system** with an additional realtime fan-out
channel. Every external surface is observable.

```
                          ┌──────────────────────────┐
                          │     Browser SPA (PWA)    │
                          │  React 18 · Vite · TQ    │
                          └────────────┬─────────────┘
                                       │ HTTPS + Socket.IO (/api/realtime)
                                       ▼
            ┌──────────────────────────────────────────────┐
            │            Express API (Node 20)             │
            │  Auth (JWT) · Zod validation · Mongoose      │
            │  /metrics  (prom-client)  · /api/docs        │
            │  Correlation-ID middleware                   │
            └──────┬─────────────────────────────┬─────────┘
                   │                             │
               ┌───▼────┐                   ┌────▼────────────┐
               │MongoDB │                   │ FastAPI (Py 3.14)│
               │ (Atlas │                   │ scikit-learn ML  │
               │ /docker│                   │ Gemini API       │
               └────────┘                   │ /metrics         │
                                            └──────────────────┘
```

The three services are independently deployable and independently testable.
The Python service has **no Mongo dependency** — it operates over a static
recipe corpus plus an in-memory interaction matrix — which keeps the ML layer
free to scale horizontally.

### 1.1 Why three services?

| Concern | Lives in | Reason |
|---|---|---|
| Auth + persistence + business rules | Node | Single canonical writer for Mongo; familiar stack for the team. |
| ML / LLM | Python | scikit-learn + Gemini SDK + numpy are first-class in Python. Isolating them avoids dragging heavy native deps into the Node image and lets the model warm-load once at process start. |
| UI | Browser SPA | Decoupled deployment, CDN-friendly, PWA cache. |

---

## 2. Recommender — hybrid weighted blend

The recommender ([`ai-service/app/recommender.py`](../ai-service/app/recommender.py))
ranks recipes for a given pantry + dietary context using **three complementary signals**:

1. **TF-IDF cosine** over the document `title ⊕ ingredients ⊕ tags ⊕ cuisine`
   ([`ai-service/app/recommender.py`](../ai-service/app/recommender.py) +
   [`_text.py`](../ai-service/app/_text.py)). Captures *lexical overlap* — fast,
   sparse, robust on small corpora.
2. **Latent-Semantic (LSA) cosine** via `TruncatedSVD(n_components=64)` over
   the TF-IDF matrix ([`embeddings.py`](../ai-service/app/embeddings.py)).
   Captures *latent topical similarity* — e.g. the model learns that *pasta*
   and *linguine* live in the same subspace even when ingredients do not
   literally overlap.
3. **Collaborative co-occurrence** ([`collab.py`](../ai-service/app/collab.py)).
   A `CountVectorizer` over `tags + cuisine` produces a recipe-profile matrix.
   Cosine similarity on this matrix yields an item-item neighbourhood. The
   `add_interactions(recipe_ids)` API uplifts pair-wise scores using observed
   co-occurrence in a single planning session.

The three raw cosines live on different scales (TF-IDF is sparse [0, 1]; LSA
cosine can be [-1, 1] and is generally denser; collab is [0, 1] sparse).
**Per-query min-max normalisation** is therefore applied before the weighted
sum:

$$
\mathrm{score}(r \mid q) = w_\text{tfidf}\,\tilde{s}_\text{tfidf} +
                          w_\text{lsa}\,\tilde{s}_\text{lsa} +
                          w_\text{collab}\,\tilde{s}_\text{collab}
$$

with defaults `(0.45, 0.40, 0.15)` chosen empirically against the eval set
(§ 5). Allergies are applied as a **hard filter** (any allergen ⇒ score 0),
dietary preferences as a **soft boost**.

Every result carries a `signals: SignalContribution[]` array with each raw
score and its weight, so the UI can render an explainability strip per card.

### 2.1 Strategy switch

The API accepts `strategy ∈ {tfidf, lsa, collab, hybrid}` and routes to the
corresponding branch. This lets the paper ablate each channel independently
and gives the client a UX dropdown for transparency.

---

## 3. Multi-objective meal planner

[`ai-service/app/planner.py`](../ai-service/app/planner.py) generates a 7-day ×
3-meal plan as a constrained scoring problem. Five candidate signals are
computed per recipe:

| Signal | Direction | Source |
|---|---|---|
| `similarity` | maximise | hybrid recommender score against the user's pantry |
| `eco`        | maximise | normalised eco-score from `sustainability.py` |
| `cost`       | maximise | normalised inverse of `cost_usd` |
| `pantry`     | maximise | ratio of recipe ingredients that overlap with the pantry |
| `variety`    | maximise | penalty against cuisines/tags already chosen in the same plan |

Each signal is min-max normalised per planning request. A **single
linear utility** then blends them:

$$
U(r) = \sum_i w_i \cdot \tilde{x}_i(r)
$$

Four presets are exposed in [`planner.OBJECTIVE_PRESETS`](../ai-service/app/planner.py):

| Objective | similarity | eco  | cost | pantry | variety |
|-----------|-----------:|-----:|-----:|-------:|--------:|
| balanced  | 0.40       | 0.20 | 0.15 | 0.15   | 0.10    |
| eco       | 0.20       | 0.55 | 0.05 | 0.10   | 0.10    |
| budget    | 0.20       | 0.05 | 0.55 | 0.10   | 0.10    |
| pantry    | 0.20       | 0.05 | 0.10 | 0.55   | 0.10    |

Weights can be overridden per-request and are renormalised to sum 1.0. The
output `MealPlanResponse.weights` field always reports the effective weights
back so the UI can show "this is what was optimised for".

### 3.1 LLM path

When `use_llm=true` and a Gemini key is present, the planner prepends the
objective + weights into the system prompt and post-hoc computes the
sustainability summary from the chosen recipes. The heuristic path remains
the deterministic fallback (and the test path).

---

## 4. Sustainability scoring

[`ai-service/app/sustainability.py`](../ai-service/app/sustainability.py) maps
each ingredient to a `(category, co2_kg_per_serving, cost_usd_per_serving)`
tuple. Categories are: produce, dairy, meat, seafood, grain, oil, spice,
sweetener, beverage, condiment.

Values are **order-of-magnitude** seeded from Poore & Nemecek, *Science* 2018
("Reducing food's environmental impacts through producers and consumers")
*per-serving estimates*. They are good enough to compare recipes against each
other (which is all the planner needs) but explicitly **not calibrated to
absolute lifecycle-assessment accuracy** — that's flagged in § 8 as future
work.

The recipe-level footprint exposes both the aggregate and the per-ingredient
breakdown via `GET /recipes/{recipe_id}/footprint`, which is what the client's
sustainability panel renders.

The `eco_score ∈ [0, 1]` is a linear rescaling of `co2_kg` between
`ECO_BEST_KG = 0.4` and `ECO_WORST_KG = 8.0`, clamped to the unit interval.

---

## 5. Evaluation protocol

The harness ([`ai-service/eval/run_eval.py`](../ai-service/eval/run_eval.py))
simulates a *pantry completion* task: for each recipe in the corpus,
30 % of its ingredients are randomly removed (seed = 42) and used as a query
pantry; the model must rank the held-out recipe near the top.

This is the standard **leave-one-out information-retrieval evaluation**
adapted to the pantry-recipe domain — it does not require user trials and
is fully reproducible (`python eval/run_eval.py`).

### 5.1 Metrics

- **Recall@k** — fraction of queries where the gold recipe appears in the top-k.
- **MRR** — mean reciprocal rank of the gold recipe.
- **NDCG@10** — normalised discounted cumulative gain.
- **Median latency (ms)** — wall-clock per query, measured with `time.perf_counter`.

### 5.2 Results

Corpus = 64 seed recipes, query fraction = 0.3, top-k = 10, seed = 42,
single-process Python 3.14:

| Strategy | Recall@5 | Recall@10 | MRR    | NDCG@10 | Median latency |
|----------|---------:|----------:|-------:|--------:|---------------:|
| TF-IDF   | **1.000**| **1.000** | 0.9154 | 0.9372  | 1.54 ms |
| LSA      | **1.000**| **1.000** | 0.9076 | 0.9314  | 1.57 ms |
| Collab   | 0.1094   | 0.2500    | 0.0574 | 0.1006  | 1.65 ms |
| Hybrid   | **1.000**| **1.000** | 0.9154 | 0.9372  | 1.73 ms |

**Reading the table.** On the bundled 64-recipe corpus the lexical signal
saturates Recall (every gold recipe is recoverable from a 70 % ingredient
overlap), so TF-IDF and the hybrid are tied. The LSA channel trails by
< 1 NDCG point — useful insurance once the corpus grows large enough that
synonymy starts to matter (e.g. "linguine" vs "spaghetti"). The collaborative
channel is cold-start by construction: with no real user-interaction signal
the recipe-profile matrix only captures tag/cuisine clusters, which carry
weak ordering for an individual query but contribute meaningfully to the
hybrid's variety and serendipity in production. As soon as the API ingests
production telemetry via `POST /interactions/record`, the collaborative
column is expected to climb sharply — this is left as future work (§ 8).

The mean blend latency adds < 0.2 ms over TF-IDF alone — the per-query
LSA `transform` is the dominant non-TF-IDF cost (≈ 70 µs).

The full JSON output lives in
[`ai-service/eval/reports/eval_results.json`](../ai-service/eval/reports/eval_results.json)
and is regenerated on every run of `python eval/run_eval.py`.

---

## 6. Observability + reliability

### 6.1 Metrics

Both the Node API and the Python service expose **Prometheus-formatted
`/metrics`** endpoints:

- `http_requests_total{method,route,status}` and
  `http_request_duration_seconds` histograms on the API
  ([`server/src/middleware/metrics.ts`](../server/src/middleware/metrics.ts)).
- `ai_requests_total`, `ai_request_duration_seconds`, `llm_calls_total`,
  `recommender_calls_total`, `llm_cache_hits_total / misses_total` on the AI
  service ([`ai-service/app/metrics.py`](../ai-service/app/metrics.py) +
  [`cache.py`](../ai-service/app/cache.py)).

Sample (server boot, single `/recommend` call):

```
ai_requests_total{endpoint="/recommend",status="200"} 1.0
ai_request_duration_seconds_bucket{endpoint="/recommend",le="0.1"} 1.0
ai_request_duration_seconds_sum{endpoint="/recommend"} 0.061
```

### 6.2 Correlation IDs

Every API request flows through
[`correlationId`](../server/src/middleware/correlationId.ts), which reads
`X-Correlation-ID` (or `X-Request-ID`), generates a UUID if absent, attaches
it to `req.correlationId`, exposes it in the response headers, and logs it
on every line via the morgan format. The AI proxy forwards the ID downstream
so an end-to-end trace is reconstructible from logs alone — no APM agent
required for the academic deployment.

### 6.3 OpenAPI

A hand-authored OpenAPI 3.0.3 spec ([`server/src/utils/swagger.ts`](../server/src/utils/swagger.ts))
covers every public endpoint including the new `/ai/recipes/recommend?strategy=`,
`/ai/plan/week?objective=`, `/ai/pantry/vision`, `/ai/recipes/{slug}/footprint`,
`/ai/interactions/record`, `/metrics` surfaces. It is served at `/api/docs`
(UI) and `/api/docs.json` (raw spec).

### 6.4 LLM cache

[`ai-service/app/cache.py`](../ai-service/app/cache.py) is a **thread-safe
TTL-bounded LRU** keyed on the prompt content. Every Gemini call (chat,
planner, smart paste, vision) goes through it. Hit/miss counters are
exported to Prometheus. Defaults: TTL = 900 s, max entries = 512 — both
overridable via env.

### 6.5 Realtime fan-out

[`server/src/services/realtime.ts`](../server/src/services/realtime.ts)
wires Socket.IO at `/api/realtime`. Connections are authenticated with the
same JWT used for REST. The `mealPlanController` broadcasts `mealplan:updated`
on create / update / assign-slot and `mealplan:deleted` on delete, scoped to
a room keyed by the meal-plan id. The client's
[`useMealPlanRealtime`](../client/src/hooks/useMealPlanRealtime.ts) hook
subscribes per route and invalidates the relevant React-Query caches.

---

## 7. PWA + offline + PDF export

[`client/vite.config.ts`](../client/vite.config.ts) configures
`vite-plugin-pwa` to:

- Auto-update the service worker on every deploy.
- Install a web manifest with `theme_color` and three icon sizes.
- Cache `GET /api/recipes/*` and `/api/ai/capabilities` with a
  stale-while-revalidate policy (60-entry cap, 1-hour TTL).

[`client/src/lib/pdf.ts`](../client/src/lib/pdf.ts) exposes
`generateWeekPlanPdf(plan)` and `generateGroceryListPdf(items)`. Both run
**entirely in the browser** — jsPDF only — so the export works offline once
the SW has primed.

---

## 8. Limitations & future work

1. **Sustainability calibration.** The CO₂ and cost values are
   order-of-magnitude. Wiring `agribalyse-3.1.json` (CIQUAL, public-domain)
   into `sustainability.py` would lift the panel from indicative to
   citation-grade. The data interface (`compute_recipe_footprint` returning
   `RecipeFootprint`) is stable so the swap is local.
2. **Collaborative cold-start.** The collab channel needs production
   telemetry. `POST /interactions/record` is in place; deploying behind a
   small user trial would close the loop and unlock the third hybrid signal.
3. **LSA dimensionality.** `n_components=64` is conservative for a 64-recipe
   corpus. Once the corpus exceeds a few hundred recipes, the eval harness
   could re-sweep `n_components ∈ {32, 64, 128, 256}` to retune.
4. **End-to-end Gemini eval.** The LLM path is currently asserted only on
   schema conformance via mocks. A small live regression set with golden
   outputs (saved as JSON snapshots) would prevent silent prompt drift.
5. **Web push for realtime invitations.** The Socket.IO channel covers
   *connected* clients; a VAPID-signed Web Push channel would cover the
   "I shared my plan with my partner who has the app installed" path.

---

## 9. Reproducing the results

```bash
# 1. AI tests (55 passing)
cd mealmate/ai-service
.\.venv\Scripts\python.exe -m pytest -q

# 2. Recommender eval (regenerates the table in § 5.2)
.\.venv\Scripts\python.exe eval/run_eval.py
type eval/reports/eval_results.json

# 3. Server tests (48 passing — full ai-routes mock suite)
cd ..\server
npm test

# 4. Client tests (14 passing) + production build (PWA + SW)
cd ..\client
npm test
npm run build
```

Total CI green budget: 117 tests across three runtimes; build artefacts in
`client/build/` include the service worker and web manifest.

---

## 10. Bibliography

- Poore, J. & Nemecek, T. (2018). *Reducing food's environmental impacts
  through producers and consumers.* **Science**, 360(6392), 987–992.
- Sarwar, B. et al. (2001). *Item-based collaborative filtering recommendation
  algorithms.* WWW '01.
- Deerwester, S. et al. (1990). *Indexing by Latent Semantic Analysis.*
  JASIS 41(6).
- Burke, R. (2002). *Hybrid recommender systems: Survey and experiments.*
  UMUAI 12(4).
