import { useState } from 'react';
import { useRecipes } from '@/hooks/useRecipes';
import { useDebounce } from '@/hooks/useDebounce';
import { Input } from '@/components/ui/Input';
import { DraggableRecipe } from './DraggableRecipe';
import { Skeleton } from '@/components/ui/Skeleton';

export function RecipeDrawer() {
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 300);
  const { data, isLoading } = useRecipes({ q: debounced || undefined, limit: 25, page: 1 });

  return (
    <aside className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        Recipe library
      </h2>
      <p className="mt-0.5 text-xs text-gray-400">Drag a recipe into a slot →</p>

      <div className="mt-3">
        <Input
          aria-label="Search recipes"
          placeholder="Search recipes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
        ) : data && data.items.length > 0 ? (
          data.items.map((r) => <DraggableRecipe key={r.id} recipe={r} />)
        ) : (
          <p className="rounded-md bg-gray-50 p-3 text-center text-xs text-gray-500">
            No recipes match your search.
          </p>
        )}
      </div>
    </aside>
  );
}
