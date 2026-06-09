import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Recipe } from '@/types';
import { cn } from '@/lib/cn';

interface RecipeCardProps {
  recipe: Recipe;
  className?: string;
}

const difficultyColors: Record<string, string> = {
  easy: 'bg-green-100 text-green-800',
  medium: 'bg-amber-100 text-amber-800',
  hard: 'bg-red-100 text-red-800',
};

export function RecipeCard({ recipe, className }: RecipeCardProps) {
  const total = (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0);
  // Track whether the image successfully loaded so we can fall back to the
  // emoji placeholder if the URL 404s, gets blocked by a network policy, or
  // is returned but isn't actually an image (Wikipedia/Pollinations edge cases).
  const [imageOk, setImageOk] = useState(true);
  const showImage = Boolean(recipe.imageUrl) && imageOk;
  const isAiGenerated = recipe.source === 'ai-generated';
  return (
    <Link
      to={`/recipes/${recipe.id}`}
      className={cn(
        'group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm',
        'transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md',
        className
      )}
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-brand-50 to-emerald-100">
        {showImage ? (
          <img
            src={recipe.imageUrl}
            alt={recipe.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
            onError={() => setImageOk(false)}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-5xl">🍽️</div>
        )}
        {isAiGenerated && (
          <span
            className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-brand-600 to-emerald-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm"
            title="Drafted by MealMate AI — fully editable"
          >
            ✨ AI-generated
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 font-semibold text-gray-900 group-hover:text-brand-700">
            {recipe.title}
          </h3>
          <span
            className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize',
              difficultyColors[recipe.difficulty] ?? 'bg-gray-100 text-gray-700'
            )}
          >
            {recipe.difficulty}
          </span>
        </div>
        {recipe.description && (
          <p className="line-clamp-2 text-sm text-gray-600">{recipe.description}</p>
        )}
        <div className="mt-auto flex items-center gap-3 pt-2 text-xs text-gray-500">
          <span>⏱️ {total} min</span>
          <span>🍽️ {recipe.servings} serv</span>
          {recipe.cuisine && <span className="capitalize">🌍 {recipe.cuisine}</span>}
        </div>
        {recipe.tags && recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {recipe.tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-700"
              >
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
