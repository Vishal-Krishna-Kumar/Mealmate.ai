import { Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

const features = [
  {
    eyebrow: 'Plan',
    title: 'A planner that thinks with you',
    body: 'Drag recipes across breakfast, lunch and dinner — or let the assistant draft an entire week tuned to your pantry, dietary preferences, and goals.',
  },
  {
    eyebrow: 'Shop',
    title: 'Grocery lists, deduplicated',
    body: 'Ingredients are aggregated, unit-normalised, and grouped by aisle. Pantry items you already own quietly disappear from the list.',
  },
  {
    eyebrow: 'Nourish',
    title: 'Nutrition and sustainability, side by side',
    body: 'See daily and weekly macros next to the carbon footprint and cost of every plan — powered by a hybrid TF-IDF + LSA recommender served from a FastAPI microservice.',
  },
];

const stats = [
  { value: '4', label: 'recommendation strategies' },
  { value: '0.94', label: 'NDCG@10 on the eval set' },
  { value: '128', label: 'tests, all green' },
];

export function HomePage() {
  const isAuthed = useAuthStore((s) => Boolean(s.token));

  return (
    <div className="mx-auto max-w-5xl">
      {/* ──────── Hero ──────── */}
      <section className="pt-10 pb-16 md:pt-16 md:pb-24">
        <p className="mm-eyebrow">A masters-level meal-planning study</p>
        <h1 className="mt-6 font-serif text-5xl leading-[1.05] tracking-tight text-ink md:text-7xl">
          Plan smarter.{' '}
          <span className="italic text-brand-700">Eat&nbsp;better.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft md:text-xl">
          MealMate is a full-stack research prototype that pairs a hybrid recommender
          and a multi-objective weekly planner with sustainability scoring, pantry
          vision, and a calm, editorial interface — so cooking at home feels less
          like logistics and more like an evening pleasure.
        </p>

        <div className="mt-9 flex flex-wrap gap-3">
          {isAuthed ? (
            <Link
              to="/planner"
              className="rounded-full bg-ink px-6 py-3 text-base font-semibold text-canvas shadow-soft transition hover:bg-brand-700"
            >
              Open the planner →
            </Link>
          ) : (
            <>
              <Link
                to="/register"
                className="rounded-full bg-ink px-6 py-3 text-base font-semibold text-canvas shadow-soft transition hover:bg-brand-700"
              >
                Get started — it's free
              </Link>
              <Link
                to="/login"
                className="rounded-full border border-line-strong bg-card px-6 py-3 text-base font-semibold text-ink transition hover:border-ink-soft"
              >
                Sign in
              </Link>
            </>
          )}
        </div>

        {/* Stats row */}
        <dl className="mt-12 grid grid-cols-3 gap-6 border-t border-line pt-8 md:max-w-xl">
          {stats.map((s) => (
            <div key={s.label}>
              <dt className="font-serif text-3xl font-semibold text-ink md:text-4xl">
                {s.value}
              </dt>
              <dd className="mt-1 text-xs uppercase tracking-wider text-ink-mute">
                {s.label}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ──────── Features ──────── */}
      <section className="grid gap-6 border-t border-line pt-12 md:grid-cols-3">
        {features.map((f) => (
          <article
            key={f.title}
            className="mm-card flex flex-col p-6 transition hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(42,39,35,0.06),0_16px_40px_rgba(42,39,35,0.08)]"
          >
            <p className="mm-eyebrow">{f.eyebrow}</p>
            <h3 className="mt-3 font-serif text-xl font-semibold text-ink">
              {f.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{f.body}</p>
          </article>
        ))}
      </section>

      {/* ──────── Quote / pull ──────── */}
      <section className="mt-20 mb-10 border-y border-line py-12 text-center">
        <blockquote className="mx-auto max-w-3xl font-serif text-2xl italic leading-snug text-ink md:text-3xl">
          “Built as a CS628 masters project — a study in how AI can quietly help us
          eat more thoughtfully, waste less, and enjoy the kitchen again.”
        </blockquote>
        <p className="mt-4 text-xs uppercase tracking-[0.18em] text-ink-mute">
          Team T03 · City University of Seattle
        </p>
      </section>
    </div>
  );
}
