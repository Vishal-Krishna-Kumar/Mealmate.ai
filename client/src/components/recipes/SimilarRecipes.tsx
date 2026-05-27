import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSimilarRecipes } from '@/hooks/useAiPlanner';

interface Props {
  slug: string;
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.25 } },
};

/**
 * "You might also like" panel — calls the AI service for nearest-neighbour
 * recipes in TF-IDF space. Hidden when the current recipe isn't in the AI
 * dataset (i.e. it was user-created and not part of the seed).
 */
export function SimilarRecipes({ slug }: Props) {
  const { data, isLoading, isError } = useSimilarRecipes(slug, 4);

  if (isLoading) {
    return (
      <section aria-busy="true" className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">You might also like</h2>
        <p className="mt-2 text-sm text-gray-500">Finding similar dishes…</p>
      </section>
    );
  }

  if (isError || !data || data.results.length === 0) {
    return null;
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">You might also like</h2>
      <p className="mt-1 text-xs text-gray-500">
        Nearest neighbours in our recipe space — picked by an ML model trained on every recipe in
        MealMate.
      </p>
      <motion.ul
        className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {data.results.map((r) => {
          const href = r._id ? `/recipes/${r._id}` : undefined;
          const inner = (
            <motion.div
              whileHover={{ y: -4, boxShadow: '0 12px 24px -10px rgba(0,0,0,0.12)' }}
              className="h-full rounded-md border border-gray-200 bg-white p-3 transition hover:border-brand-300"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-medium text-gray-900">{r.title}</h3>
                <span className="rounded bg-brand-100 px-2 py-0.5 text-[11px] font-medium text-brand-800">
                  {Math.round(r.score * 100)}%
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-600">{r.reason}</p>
            </motion.div>
          );
          return (
            <motion.li key={r.recipe_id} variants={item}>
              {href ? (
                <Link to={href} className="block h-full">
                  {inner}
                </Link>
              ) : (
                inner
              )}
            </motion.li>
          );
        })}
      </motion.ul>
    </section>
  );
}
