import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { useDeleteRecipe, useRecipe } from '@/hooks/useRecipes';
import { useAuthStore } from '@/stores/authStore';
import { extractErrorMessage } from '@/lib/api';
import { Skeleton } from '@/components/ui/Skeleton';
import { SimilarRecipes } from '@/components/recipes/SimilarRecipes';

export function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { data: recipe, isLoading, isError, error } = useRecipe(id);
  const del = useDeleteRecipe();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="aspect-[16/9] w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (isError || !recipe) {
    return (
      <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
        {extractErrorMessage(error, 'Recipe not found')}
        <div className="mt-2">
          <Link to="/recipes" className="font-medium text-red-800 underline">
            ← Back to recipes
          </Link>
        </div>
      </div>
    );
  }

  const isOwner =
    user && recipe.createdBy && (String(recipe.createdBy) === user.id || user.role === 'admin');
  const total = (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0);

  async function handleDelete() {
    if (!recipe) return;
    if (!confirm(`Delete "${recipe.title}"? This cannot be undone.`)) return;
    try {
      await del.mutateAsync(recipe.id);
      navigate('/recipes', { replace: true });
    } catch (err) {
      alert(extractErrorMessage(err, 'Could not delete recipe'));
    }
  }

  return (
    <article className="space-y-6">
      <div>
        <Link to="/recipes" className="text-sm text-brand-700 hover:underline">
          ← All recipes
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{recipe.title}</h1>
          {recipe.description && <p className="mt-2 text-gray-600">{recipe.description}</p>}
        </div>
        {isOwner && (
          <div className="flex gap-2">
            <Link to={`/recipes/${recipe.id}/edit`}>
              <Button variant="secondary" size="sm">
                Edit
              </Button>
            </Link>
            <Button variant="danger" size="sm" loading={del.isPending} onClick={handleDelete}>
              Delete
            </Button>
          </div>
        )}
      </header>

      <div className="flex flex-wrap gap-3 text-sm text-gray-600">
        <span className="rounded-md bg-gray-100 px-3 py-1">⏱️ Prep {recipe.prepTime} min</span>
        <span className="rounded-md bg-gray-100 px-3 py-1">🔥 Cook {recipe.cookTime} min</span>
        <span className="rounded-md bg-gray-100 px-3 py-1">⏰ Total {total} min</span>
        <span className="rounded-md bg-gray-100 px-3 py-1">🍽️ {recipe.servings} servings</span>
        <span className="rounded-md bg-gray-100 px-3 py-1 capitalize">📊 {recipe.difficulty}</span>
        {recipe.cuisine && (
          <span className="rounded-md bg-gray-100 px-3 py-1 capitalize">🌍 {recipe.cuisine}</span>
        )}
      </div>

      {recipe.tags && recipe.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {recipe.tags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700"
            >
              #{t}
            </span>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[2fr,3fr]">
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Ingredients</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {recipe.ingredients.map((ing, i) => (
              <li key={i} className="flex justify-between gap-2 border-b border-gray-100 py-1">
                <span className="text-gray-900">{ing.name}</span>
                <span className="text-gray-500">
                  {ing.quantity ?? ''}
                  {ing.unit ? ` ${ing.unit}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Instructions</h2>
          <ol className="mt-3 space-y-3 text-sm">
            {recipe.instructions.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                  {i + 1}
                </span>
                <p className="leading-relaxed text-gray-700">{step}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {recipe.nutrition && (
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Nutrition (per serving)</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {Object.entries(recipe.nutrition).map(([k, v]) =>
              v == null ? null : (
                <div key={k} className="rounded-md bg-gray-50 p-3">
                  <dt className="text-xs uppercase text-gray-500">{k}</dt>
                  <dd className="text-base font-semibold text-gray-900">{v}</dd>
                </div>
              )
            )}
          </dl>
        </section>
      )}

      {recipe.slug && <SimilarRecipes slug={recipe.slug} />}
    </article>
  );
}
