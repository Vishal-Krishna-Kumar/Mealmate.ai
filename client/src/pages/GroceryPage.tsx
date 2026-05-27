import { Link } from 'react-router-dom';
import { useGroceryLists } from '@/hooks/useGrocery';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

export function GroceryPage() {
  const { data, isLoading } = useGroceryLists();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-gray-900">Grocery lists</h1>
        <p className="text-sm text-gray-600">Generated from your meal plans.</p>
      </header>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon="🛒"
          title="No grocery lists yet"
          description="Open the planner, fill some slots, and tap “Generate grocery list”."
          action={
            <Link
              to="/planner"
              className="inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Go to planner
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((list) => {
            const total = list.items.length;
            const done = list.items.filter((i) => i.checked).length;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            return (
              <Link
                key={list.id}
                to={`/grocery/${list.id}`}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-brand-300 hover:shadow"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">
                      {list.createdAt
                        ? new Date(list.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : ''}
                    </p>
                    <h3 className="mt-0.5 font-semibold text-gray-900">
                      {total} item{total === 1 ? '' : 's'}
                    </h3>
                  </div>
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
                    {pct}%
                  </span>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full bg-brand-500 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {done} of {total} purchased
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
