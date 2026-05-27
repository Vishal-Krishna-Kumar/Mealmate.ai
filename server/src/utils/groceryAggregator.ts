/**
 * Grocery aggregator — merges duplicate ingredients across many recipes
 * into a single shopping list, with simple unit normalization and
 * heuristic category assignment.
 */
import type { IRecipe, IRecipeIngredient } from '../models/Recipe';
import type { IGroceryItem, GroceryCategory } from '../models/GroceryList';
import type { Types } from 'mongoose';

interface RecipeWithServings {
  ingredients: IRecipeIngredient[];
  servings?: number;
  /** Mongo ObjectId of the source recipe — used to attribute grocery items. */
  _id?: Types.ObjectId | string;
  /** Display title of the source recipe — shown beneath each grocery line. */
  title?: string;
}

interface AggregateOptions {
  /** Pantry items to subtract (by ingredient name). */
  pantry?: { ingredient: string }[];
}

const VOLUME_TO_ML: Record<string, number> = {
  ml: 1,
  l: 1000,
  liter: 1000,
  litre: 1000,
  cup: 240,
  cups: 240,
  tbsp: 15,
  tablespoon: 15,
  tsp: 5,
  teaspoon: 5,
};

const WEIGHT_TO_G: Record<string, number> = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kilogram: 1000,
  oz: 28.3495,
  ounce: 28.3495,
  lb: 453.592,
  pound: 453.592,
};

const CATEGORY_KEYWORDS: Array<{ category: GroceryCategory; words: string[] }> = [
  { category: 'produce', words: ['tomato', 'onion', 'garlic', 'lettuce', 'spinach', 'carrot', 'pepper', 'cucumber', 'apple', 'banana', 'lemon', 'lime', 'broccoli', 'potato', 'celery', 'mushroom', 'avocado', 'kale', 'cilantro', 'parsley', 'basil'] },
  { category: 'dairy', words: ['milk', 'cheese', 'butter', 'yogurt', 'cream', 'mozzarella', 'parmesan', 'feta', 'cheddar', 'sour cream'] },
  { category: 'meat', words: ['chicken', 'beef', 'pork', 'lamb', 'bacon', 'sausage', 'turkey', 'ham', 'steak', 'ground beef'] },
  { category: 'seafood', words: ['salmon', 'tuna', 'shrimp', 'fish', 'cod', 'tilapia', 'crab', 'lobster'] },
  { category: 'bakery', words: ['bread', 'tortilla', 'bagel', 'bun', 'baguette', 'pita', 'naan'] },
  { category: 'pantry', words: ['flour', 'sugar', 'salt', 'rice', 'pasta', 'oil', 'vinegar', 'soy sauce', 'broth', 'bean', 'lentil', 'oats', 'cereal', 'honey', 'syrup', 'spaghetti', 'noodle'] },
  { category: 'frozen', words: ['frozen', 'ice cream', 'pizza'] },
  { category: 'beverages', words: ['water', 'juice', 'coffee', 'tea', 'wine', 'beer', 'soda'] },
  { category: 'snacks', words: ['chips', 'cracker', 'cookie', 'nut', 'almond', 'cashew', 'peanut'] },
  { category: 'spices', words: ['pepper', 'cumin', 'paprika', 'oregano', 'thyme', 'cinnamon', 'turmeric', 'coriander', 'chili', 'cayenne', 'nutmeg', 'rosemary'] },
];

export function categorize(ingredient: string): GroceryCategory {
  const name = ingredient.toLowerCase();
  for (const { category, words } of CATEGORY_KEYWORDS) {
    if (words.some((w) => name.includes(w))) return category;
  }
  return 'other';
}

interface NormalizedQty {
  quantity: number;
  unit: string;
}

function normalizeUnit(qty: number | undefined, unit: string | undefined): NormalizedQty | null {
  if (qty === undefined || qty <= 0) return null;
  const u = (unit ?? '').toLowerCase().trim();
  if (!u) return { quantity: qty, unit: '' };

  const volMul = VOLUME_TO_ML[u];
  if (volMul !== undefined) return { quantity: qty * volMul, unit: 'ml' };

  const wMul = WEIGHT_TO_G[u];
  if (wMul !== undefined) return { quantity: qty * wMul, unit: 'g' };

  return { quantity: qty, unit: u };
}

/**
 * Aggregate ingredients from multiple recipes into a deduplicated grocery list.
 * Items with compatible units are summed; mismatched-unit duplicates remain separate entries.
 */
export function aggregateGroceryItems(
  recipes: RecipeWithServings[],
  options: AggregateOptions = {}
): IGroceryItem[] {
  const bucket = new Map<string, IGroceryItem>();
  const pantrySet = new Set(
    (options.pantry ?? []).map((p) => p.ingredient.toLowerCase().trim())
  );

  for (const recipe of recipes) {
    const recipeTitle = (recipe.title ?? '').toString().trim();
    const recipeId = recipe._id != null ? recipe._id.toString() : undefined;

    for (const ing of recipe.ingredients) {
      const name = ing.name.toLowerCase().trim();
      if (!name) continue;
      if (pantrySet.has(name)) continue; // already at home

      const normalized = normalizeUnit(ing.quantity, ing.unit);
      const unitKey = normalized?.unit ?? '';
      const key = `${name}::${unitKey}`;

      // Source contribution for this recipe — only attached when we know
      // which recipe the ingredient came from (callers may pass anonymous
      // recipe-shaped objects in tests).
      const sourceEntry = recipeTitle
        ? {
            recipe: recipeId as unknown as Types.ObjectId | undefined,
            title: recipeTitle,
            quantity: normalized?.quantity,
            unit: unitKey || undefined,
          }
        : null;

      const existing = bucket.get(key);
      if (existing) {
        if (existing.quantity !== undefined && normalized) {
          existing.quantity += normalized.quantity;
        }
        if (sourceEntry) {
          existing.sources = existing.sources ?? [];
          // Merge contributions from the same recipe instead of listing it
          // twice (e.g. when an ingredient appears in both lunch and dinner
          // of the same dish — rare but possible).
          const prior = existing.sources.find(
            (s) => s.title.toLowerCase() === sourceEntry.title.toLowerCase()
          );
          if (prior) {
            if (prior.quantity !== undefined && sourceEntry.quantity !== undefined) {
              prior.quantity += sourceEntry.quantity;
            }
          } else {
            existing.sources.push(sourceEntry);
          }
        }
      } else {
        bucket.set(key, {
          ingredient: name,
          quantity: normalized?.quantity,
          unit: unitKey || undefined,
          category: categorize(name),
          checked: false,
          sources: sourceEntry ? [sourceEntry] : undefined,
        });
      }
    }
  }

  return Array.from(bucket.values()).sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.ingredient.localeCompare(b.ingredient);
  });
}

/** Convenience adapter that accepts populated MealPlan day docs. */
export function collectRecipesFromPlan(
  days: Array<{
    breakfast?: IRecipe | null;
    lunch?: IRecipe | null;
    dinner?: IRecipe | null;
    snacks?: Array<IRecipe | null>;
  }>
): RecipeWithServings[] {
  const out: RecipeWithServings[] = [];
  for (const d of days) {
    if (d.breakfast) out.push(d.breakfast);
    if (d.lunch) out.push(d.lunch);
    if (d.dinner) out.push(d.dinner);
    for (const s of d.snacks ?? []) if (s) out.push(s);
  }
  return out;
}
