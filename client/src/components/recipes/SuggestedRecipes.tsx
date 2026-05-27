import { useState } from 'react';
import { useRecommendations } from '@/hooks/useRecommendations';
import type { RecommendStrategy } from '@/hooks/useAiPlanner';
import { extractErrorMessage } from '@/lib/api';

const STRATEGIES: { value: RecommendStrategy; label: string; hint: string }[] = [
  { value: 'hybrid', label: 'Hybrid', hint: 'TF-IDF + LSA + collaborative (best)' },
  { value: 'tfidf', label: 'TF-IDF', hint: 'lexical overlap' },
  { value: 'lsa', label: 'LSA', hint: 'latent-semantic embedding' },
  { value: 'collab', label: 'Collab', hint: 'recipe co-occurrence' },
];

/**
 * "Suggested for you" panel — calls the AI microservice to get
 * recommendations from the user's pantry, dietary preferences and allergies.
 * Strategy can be switched between TF-IDF, LSA, collaborative filtering, or
 * the default hybrid weighted-blend recommender.
 */
export function SuggestedRecipes() {
  const [strategy, setStrategy] = useState<RecommendStrategy>('hybrid');
  const { data, isLoading, isError, error } = useRecommendations({ top_k: 6, strategy });

  if (isLoading) {
    return (
      <section aria-busy="true" className="rounded-lg border border-brand-100 bg-brand-50/40 p-4">
        <h2 className="mb-2 text-lg font-semibold text-brand-800">✨ Suggested for you</h2>
        <p className="text-sm text-brand-700">Looking through your pantry…</p>
      </section>
    );
  }

  if (isError) {
    const msg = extractErrorMessage(error, '');
    // Don't shout at the user when their pantry is empty — show a soft hint instead.
    const isEmptyPantry = msg.toLowerCase().includes('pantry');
    return (
      <section className="rounded-lg border border-brand-100 bg-brand-50/40 p-4">
        <h2 className="mb-2 text-lg font-semibold text-brand-800">✨ Suggested for you</h2>
        <p className="text-sm text-brand-700">
          {isEmptyPantry
            ? 'Add ingredients to your pantry to get personalised recipe suggestions.'
            : 'AI suggestions are temporarily unavailable.'}
        </p>
      </section>
    );
  }

  if (!data || data.results.length === 0) {
    return null;
  }

  return (
    <section className="rounded-lg border border-brand-100 bg-brand-50/40 p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h2 className="text-lg font-semibold text-brand-800">✨ Suggested for you</h2>
          <span
            className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-brand-800"
            title="Active recommender strategy"
          >
            {data.strategy}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-brand-700">Strategy</span>
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as RecommendStrategy)}
            className="rounded-md border border-brand-200 bg-white px-2 py-1 text-xs font-medium text-brand-800 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
            aria-label="Recommendation strategy"
          >
            {STRATEGIES.map((s) => (
              <option key={s.value} value={s.value} title={s.hint}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.results.map((r) => (
          <li
            key={r.recipe_id}
            className="rounded-md border border-brand-200 bg-white p-3 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium text-gray-900">{r.title}</h3>
              <span
                className="rounded bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-800"
                title="Match score"
              >
                {Math.round(r.score * 100)}%
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-600">{r.reason}</p>
            {r.matched_ingredients.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {r.matched_ingredients.slice(0, 5).map((ing) => (
                  <span
                    key={ing}
                    className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] text-brand-700"
                  >
                    {ing}
                  </span>
                ))}
              </div>
            )}
            {r.signals && r.signals.length > 0 && (
              <div
                className="mt-2 flex flex-wrap gap-1 border-t border-brand-100 pt-2 text-[10px] text-gray-500"
                title="How each ranking signal contributed"
              >
                {r.signals.map((s) => (
                  <span
                    key={s.name}
                    className="rounded bg-gray-50 px-1.5 py-0.5 ring-1 ring-gray-200"
                  >
                    {s.name} {Math.round(s.score * 100)}%
                  </span>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
