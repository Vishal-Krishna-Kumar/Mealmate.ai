import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  useDeleteGroceryList,
  useGroceryList,
  useUpdateGroceryItem,
} from '@/hooks/useGrocery';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { ExportGroceryPdfButton } from '@/components/grocery/ExportGroceryPdfButton';
import { extractErrorMessage } from '@/lib/api';
import type { GroceryCategory, GroceryItem } from '@/types';
import { cn } from '@/lib/cn';

const CATEGORY_LABELS: Record<GroceryCategory, { label: string; icon: string }> = {
  produce: { label: 'Produce', icon: '🥦' },
  dairy: { label: 'Dairy', icon: '🥛' },
  meat: { label: 'Meat', icon: '🥩' },
  seafood: { label: 'Seafood', icon: '🐟' },
  bakery: { label: 'Bakery', icon: '🥖' },
  pantry: { label: 'Pantry', icon: '🥫' },
  frozen: { label: 'Frozen', icon: '🧊' },
  beverages: { label: 'Beverages', icon: '🥤' },
  snacks: { label: 'Snacks', icon: '🍿' },
  spices: { label: 'Spices', icon: '🧂' },
  other: { label: 'Other', icon: '🛍️' },
};

const CATEGORY_ORDER: GroceryCategory[] = [
  'produce',
  'meat',
  'seafood',
  'dairy',
  'bakery',
  'pantry',
  'frozen',
  'beverages',
  'snacks',
  'spices',
  'other',
];

export function GroceryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: list, isLoading, isError, error } = useGroceryList(id);
  const update = useUpdateGroceryItem();
  const del = useDeleteGroceryList();
  const [hideChecked, setHideChecked] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<GroceryCategory, GroceryItem[]>();
    if (list) {
      for (const item of list.items) {
        const existing = map.get(item.category) ?? [];
        existing.push(item);
        map.set(item.category, existing);
      }
    }
    return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({
      category: c,
      items: map.get(c) ?? [],
    }));
  }, [list]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-1/2" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (isError || !list || !id) {
    return (
      <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
        {extractErrorMessage(error, 'Grocery list not found')}
        <div className="mt-2">
          <Link to="/grocery" className="font-medium text-red-800 underline">
            ← Back to grocery lists
          </Link>
        </div>
      </div>
    );
  }

  const total = list.items.length;
  const done = list.items.filter((it) => it.checked).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  function toggle(item: GroceryItem) {
    if (!id) return;
    update.mutate({ listId: id, itemId: item._id, patch: { checked: !item.checked } });
  }

  async function handleDelete() {
    if (!list) return;
    if (!confirm('Delete this grocery list?')) return;
    try {
      await del.mutateAsync(list.id);
      navigate('/grocery', { replace: true });
    } catch (err) {
      alert(extractErrorMessage(err, 'Could not delete list'));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/grocery" className="text-sm text-brand-700 hover:underline">
          ← All grocery lists
        </Link>
      </div>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Grocery list</h1>
          <p className="text-sm text-gray-600">
            {done} of {total} items purchased ({pct}%)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={hideChecked}
              onChange={(e) => setHideChecked(e.target.checked)}
              className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            Hide checked
          </label>
          <ExportGroceryPdfButton items={list?.items ?? []} title="Grocery list" />
          <Button variant="danger" size="sm" loading={del.isPending} onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </header>

      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div className="h-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
      </div>

      {grouped.length === 0 ? (
        <p className="rounded-md bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
          This list is empty.
        </p>
      ) : (
        <div className="space-y-5">
          {grouped.map(({ category, items }) => {
            const visible = hideChecked ? items.filter((i) => !i.checked) : items;
            if (visible.length === 0) return null;
            const meta = CATEGORY_LABELS[category];
            return (
              <section
                key={category}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
              >
                <header className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-2">
                  <h2 className="text-sm font-semibold text-gray-700">
                    <span aria-hidden className="mr-1">
                      {meta.icon}
                    </span>
                    {meta.label}
                  </h2>
                  <span className="text-xs text-gray-500">
                    {items.filter((i) => i.checked).length}/{items.length}
                  </span>
                </header>
                <ul>
                  {visible.map((item) => (
                    <li
                      key={item._id}
                      className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-2 last:border-b-0"
                    >
                      <label className="flex flex-1 items-start gap-3">
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={() => toggle(item)}
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                        />
                        <span className="flex flex-1 flex-col">
                          <span
                            className={cn(
                              'capitalize transition',
                              item.checked && 'text-gray-400 line-through'
                            )}
                          >
                            {item.ingredient}
                          </span>
                          {item.sources && item.sources.length > 0 && (
                            <span
                              className={cn(
                                'mt-0.5 text-[11px] text-gray-500',
                                item.checked && 'text-gray-300 line-through'
                              )}
                              title={item.sources
                                .map((s) =>
                                  s.quantity && s.unit
                                    ? `${s.title} (${Math.round(s.quantity * 10) / 10} ${s.unit})`
                                    : s.title
                                )
                                .join(', ')}
                            >
                              for {item.sources.map((s) => s.title).join(' · ')}
                            </span>
                          )}
                        </span>
                      </label>
                      <span className="shrink-0 pt-0.5 text-sm text-gray-500">
                        {item.quantity ?? ''}
                        {item.unit ? ` ${item.unit}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
