import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  useCreateRecipe,
  useRecipe,
  useUpdateRecipe,
  type RecipeInput,
} from '@/hooks/useRecipes';
import { extractErrorMessage } from '@/lib/api';
import type { Difficulty } from '@/types';

interface IngredientRow {
  name: string;
  quantity: string;
  unit: string;
}

const emptyIngredient: IngredientRow = { name: '', quantity: '', unit: '' };

interface FormState {
  title: string;
  description: string;
  cuisine: string;
  tags: string;
  difficulty: Difficulty;
  prepTime: string;
  cookTime: string;
  servings: string;
  imageUrl: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  ingredients: IngredientRow[];
  instructions: string[];
}

const initialState: FormState = {
  title: '',
  description: '',
  cuisine: '',
  tags: '',
  difficulty: 'medium',
  prepTime: '10',
  cookTime: '20',
  servings: '2',
  imageUrl: '',
  calories: '',
  protein: '',
  carbs: '',
  fat: '',
  ingredients: [{ ...emptyIngredient }],
  instructions: [''],
};

function toNum(v: string): number | undefined {
  if (v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

interface RecipeFormPageProps {
  mode: 'create' | 'edit';
}

export function RecipeFormPage({ mode }: RecipeFormPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = mode === 'edit';

  const { data: existing, isLoading: loadingExisting } = useRecipe(isEdit ? id : undefined);
  const create = useCreateRecipe();
  const update = useUpdateRecipe(id ?? '');

  const [form, setForm] = useState<FormState>(initialState);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isEdit && existing) {
      setForm({
        title: existing.title,
        description: existing.description ?? '',
        cuisine: existing.cuisine ?? '',
        tags: (existing.tags ?? []).join(', '),
        difficulty: existing.difficulty,
        prepTime: String(existing.prepTime),
        cookTime: String(existing.cookTime),
        servings: String(existing.servings),
        imageUrl: existing.imageUrl ?? '',
        calories: existing.nutrition?.calories?.toString() ?? '',
        protein: existing.nutrition?.protein?.toString() ?? '',
        carbs: existing.nutrition?.carbs?.toString() ?? '',
        fat: existing.nutrition?.fat?.toString() ?? '',
        ingredients: existing.ingredients.map((i) => ({
          name: i.name,
          quantity: i.quantity?.toString() ?? '',
          unit: i.unit ?? '',
        })),
        instructions: existing.instructions.length ? existing.instructions : [''],
      });
    }
  }, [isEdit, existing]);

  function update_<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setIngredient(idx: number, patch: Partial<IngredientRow>) {
    setForm((f) => ({
      ...f,
      ingredients: f.ingredients.map((row, i) => (i === idx ? { ...row, ...patch } : row)),
    }));
  }
  function addIngredient() {
    setForm((f) => ({ ...f, ingredients: [...f.ingredients, { ...emptyIngredient }] }));
  }
  function removeIngredient(idx: number) {
    setForm((f) => ({
      ...f,
      ingredients: f.ingredients.length === 1 ? f.ingredients : f.ingredients.filter((_, i) => i !== idx),
    }));
  }

  function setInstruction(idx: number, value: string) {
    setForm((f) => ({
      ...f,
      instructions: f.instructions.map((s, i) => (i === idx ? value : s)),
    }));
  }
  function addInstruction() {
    setForm((f) => ({ ...f, instructions: [...f.instructions, ''] }));
  }
  function removeInstruction(idx: number) {
    setForm((f) => ({
      ...f,
      instructions: f.instructions.length === 1 ? f.instructions : f.instructions.filter((_, i) => i !== idx),
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const ingredients = form.ingredients
      .filter((i) => i.name.trim().length > 0)
      .map((i) => ({
        name: i.name.trim(),
        quantity: toNum(i.quantity),
        unit: i.unit.trim() || undefined,
      }));
    const instructions = form.instructions.map((s) => s.trim()).filter(Boolean);

    if (!form.title.trim() || form.title.trim().length < 2) {
      setError('Title must be at least 2 characters');
      return;
    }
    if (ingredients.length === 0) {
      setError('Add at least one ingredient');
      return;
    }
    if (instructions.length === 0) {
      setError('Add at least one instruction step');
      return;
    }

    const nutrition = {
      calories: toNum(form.calories),
      protein: toNum(form.protein),
      carbs: toNum(form.carbs),
      fat: toNum(form.fat),
    };
    const hasNutrition = Object.values(nutrition).some((v) => v !== undefined);

    const payload: RecipeInput = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      cuisine: form.cuisine.trim() || undefined,
      tags: form.tags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
      difficulty: form.difficulty,
      prepTime: toNum(form.prepTime) ?? 0,
      cookTime: toNum(form.cookTime) ?? 0,
      servings: toNum(form.servings) ?? 1,
      imageUrl: form.imageUrl.trim() || undefined,
      ingredients,
      instructions,
      nutrition: hasNutrition ? nutrition : undefined,
    };

    try {
      if (isEdit) {
        const recipe = await update.mutateAsync(payload);
        navigate(`/recipes/${recipe.id}`);
      } else {
        const recipe = await create.mutateAsync(payload);
        navigate(`/recipes/${recipe.id}`);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not save recipe'));
    }
  }

  if (isEdit && loadingExisting) {
    return <p className="text-gray-600">Loading recipe…</p>;
  }

  const submitting = create.isPending || update.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <div>
        <Link to={isEdit && id ? `/recipes/${id}` : '/recipes'} className="text-sm text-brand-700 hover:underline">
          ← Cancel
        </Link>
        <h1 className="mt-1 text-3xl font-bold text-gray-900">
          {isEdit ? 'Edit recipe' : 'New recipe'}
        </h1>
      </div>

      <section className="grid gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:grid-cols-2">
        <Input
          label="Title"
          required
          value={form.title}
          onChange={(e) => update_('title', e.target.value)}
        />
        <Input
          label="Cuisine"
          value={form.cuisine}
          onChange={(e) => update_('cuisine', e.target.value)}
          placeholder="italian, asian, mexican…"
        />
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => update_('description', e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </div>
        <Input
          label="Tags (comma-separated)"
          value={form.tags}
          onChange={(e) => update_('tags', e.target.value)}
          placeholder="vegetarian, quick, gluten-free"
        />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Difficulty</label>
          <select
            value={form.difficulty}
            onChange={(e) => update_('difficulty', e.target.value as Difficulty)}
            className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
        <Input
          type="number"
          min={0}
          label="Prep time (min)"
          value={form.prepTime}
          onChange={(e) => update_('prepTime', e.target.value)}
        />
        <Input
          type="number"
          min={0}
          label="Cook time (min)"
          value={form.cookTime}
          onChange={(e) => update_('cookTime', e.target.value)}
        />
        <Input
          type="number"
          min={1}
          label="Servings"
          value={form.servings}
          onChange={(e) => update_('servings', e.target.value)}
        />
        <Input
          label="Image URL"
          value={form.imageUrl}
          onChange={(e) => update_('imageUrl', e.target.value)}
          placeholder="https://…"
        />
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Ingredients</h2>
          <Button type="button" variant="secondary" size="sm" onClick={addIngredient}>
            + Add
          </Button>
        </div>
        <div className="space-y-2">
          {form.ingredients.map((ing, idx) => (
            <div key={idx} className="grid grid-cols-[1fr,90px,90px,auto] gap-2">
              <Input
                aria-label={`Ingredient ${idx + 1} name`}
                placeholder="e.g. chicken"
                value={ing.name}
                onChange={(e) => setIngredient(idx, { name: e.target.value })}
              />
              <Input
                aria-label={`Ingredient ${idx + 1} quantity`}
                placeholder="qty"
                type="number"
                value={ing.quantity}
                onChange={(e) => setIngredient(idx, { quantity: e.target.value })}
              />
              <Input
                aria-label={`Ingredient ${idx + 1} unit`}
                placeholder="g / cup"
                value={ing.unit}
                onChange={(e) => setIngredient(idx, { unit: e.target.value })}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeIngredient(idx)}
                aria-label={`Remove ingredient ${idx + 1}`}
              >
                ✕
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Instructions</h2>
          <Button type="button" variant="secondary" size="sm" onClick={addInstruction}>
            + Add step
          </Button>
        </div>
        <div className="space-y-2">
          {form.instructions.map((step, idx) => (
            <div key={idx} className="flex gap-2">
              <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                {idx + 1}
              </span>
              <textarea
                rows={2}
                value={step}
                onChange={(e) => setInstruction(idx, e.target.value)}
                aria-label={`Step ${idx + 1}`}
                placeholder={`Step ${idx + 1}`}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeInstruction(idx)}
                aria-label={`Remove step ${idx + 1}`}
              >
                ✕
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:grid-cols-4">
        <h2 className="text-lg font-semibold text-gray-900 sm:col-span-4">
          Nutrition <span className="text-sm font-normal text-gray-500">(per serving — optional)</span>
        </h2>
        <Input
          type="number"
          min={0}
          label="Calories"
          value={form.calories}
          onChange={(e) => update_('calories', e.target.value)}
        />
        <Input
          type="number"
          min={0}
          label="Protein (g)"
          value={form.protein}
          onChange={(e) => update_('protein', e.target.value)}
        />
        <Input
          type="number"
          min={0}
          label="Carbs (g)"
          value={form.carbs}
          onChange={(e) => update_('carbs', e.target.value)}
        />
        <Input
          type="number"
          min={0}
          label="Fat (g)"
          value={form.fat}
          onChange={(e) => update_('fat', e.target.value)}
        />
      </section>

      {error && (
        <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Link to={isEdit && id ? `/recipes/${id}` : '/recipes'}>
          <Button type="button" variant="secondary">
            Cancel
          </Button>
        </Link>
        <Button type="submit" loading={submitting}>
          {isEdit ? 'Save changes' : 'Create recipe'}
        </Button>
      </div>
    </form>
  );
}
