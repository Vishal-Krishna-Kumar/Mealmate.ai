import { z } from 'zod';
import { GROCERY_CATEGORIES } from '../models/GroceryList';

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid ObjectId');

export const generateFromPlanSchema = z.object({
  mealPlanId: objectId,
  name: z.string().trim().max(100).optional(),
  excludePantry: z.boolean().default(true),
});

export const updateGroceryItemSchema = z.object({
  itemId: objectId,
  checked: z.boolean().optional(),
  quantity: z.number().nonnegative().optional(),
  unit: z.string().trim().max(20).optional(),
  category: z.enum(GROCERY_CATEGORIES).optional(),
});

export const idParamSchema = z.object({ id: objectId });

export type GenerateFromPlanInput = z.infer<typeof generateFromPlanSchema>;
export type UpdateGroceryItemInput = z.infer<typeof updateGroceryItemSchema>;
