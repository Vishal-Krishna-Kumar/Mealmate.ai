import { useEffect, useState } from 'react';
import { useRecipes } from '@/hooks/useRecipes';
import { useDebounce } from '@/hooks/useDebounce';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface RecipePickerModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  onPick: (recipeId: string) => void;
}

export function RecipePickerModal({ open, title, onClose, onPick }: RecipePickerModalProps) {
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 300);
  const { data, isLoading } = useRecipes({
    q: debounced || undefined,
    limit: 20,
    page: 1,
  });

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col rounded-xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-gray-500 hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        <div className="mt-3">
          <Input
            autoFocus
            aria-label="Search"
            placeholder="Search recipes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <ul className="mt-3 flex-1 space-y-1 overflow-y-auto">
          {isLoading && <li className="p-3 text-sm text-gray-500">Loading…</li>}
          {data?.items.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => onPick(r.id)}
                className="flex w-full items-center justify-between rounded-md p-2 text-left text-sm hover:bg-brand-50"
              >
                <span className="truncate font-medium text-gray-900">{r.title}</span>
                <span className="ml-2 shrink-0 text-xs text-gray-500">
                  {(r.prepTime ?? 0) + (r.cookTime ?? 0)} min
                </span>
              </button>
            </li>
          ))}
          {!isLoading && data && data.items.length === 0 && (
            <li className="p-3 text-sm text-gray-500">No matches.</li>
          )}
        </ul>

        <div className="mt-3 flex justify-end">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
