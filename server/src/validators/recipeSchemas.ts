import { z } from 'zod';

const ingredientSchema = z.object({
  name: z.string().trim().min(1).max(100),
  quantity: z.number().nonnegative().optional(),
  unit: z.string().trim().max(20).optional(),
});

const nutritionSchema = z
  .object({
    calories: z.number().nonnegative().optional(),
    protein: z.number().nonnegative().optional(),
    carbs: z.number().nonnegative().optional(),
    fat: z.number().nonnegative().optional(),
    fiber: z.number().nonnegative().optional(),
    sugar: z.number().nonnegative().optional(),
    sodium: z.number().nonnegative().optional(),
  })
  .optional();

export const createRecipeSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).optional(),
  ingredients: z.array(ingredientSchema).min(1),
  instructions: z.array(z.string().trim().min(1)).min(1),
  cuisine: z.string().trim().max(50).optional(),
  tags: z.array(z.string().trim().max(40)).default([]),
  prepTime: z.number().int().nonnegative().max(1440),
  cookTime: z.number().int().nonnegative().max(1440),
  servings: z.number().int().positive().max(100),
  nutrition: nutritionSchema,
  imageUrl: z.string().url().optional(),
  source: z.string().trim().max(200).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
});

export const updateRecipeSchema = createRecipeSchema.partial();

export const listRecipesQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  cuisine: z.string().trim().toLowerCase().optional(),
  tag: z.string().trim().toLowerCase().optional(),
  maxPrepTime: z.coerce.number().int().nonnegative().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sort: z.enum(['recent', 'fastest', 'relevance']).default('recent'),
});

export const recipeIdParamSchema = z.object({
  id: z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid recipe id'),
});

export type CreateRecipeInput = z.infer<typeof createRecipeSchema>;
export type UpdateRecipeInput = z.infer<typeof updateRecipeSchema>;
export type ListRecipesQuery = z.infer<typeof listRecipesQuerySchema>;
