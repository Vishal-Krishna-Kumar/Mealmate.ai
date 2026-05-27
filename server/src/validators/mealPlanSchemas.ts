import { z } from 'zod';
import { DAYS_OF_WEEK } from '../models/MealPlan';

const objectIdRegex = /^[a-fA-F0-9]{24}$/;
const objectId = z.string().regex(objectIdRegex, 'Invalid ObjectId');

const dayPlanSchema = z.object({
  day: z.enum(DAYS_OF_WEEK),
  breakfast: objectId.optional().nullable(),
  lunch: objectId.optional().nullable(),
  dinner: objectId.optional().nullable(),
  snacks: z.array(objectId).default([]),
});

export const createMealPlanSchema = z.object({
  name: z.string().trim().max(100).optional(),
  weekStartDate: z.coerce.date(),
  days: z.array(dayPlanSchema).max(7).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const updateMealPlanSchema = createMealPlanSchema.partial();

export const assignSlotSchema = z.object({
  day: z.enum(DAYS_OF_WEEK),
  slot: z.enum(['breakfast', 'lunch', 'dinner']),
  recipeId: objectId.nullable(), // null clears the slot
});

export const idParamSchema = z.object({
  id: objectId,
});

export type CreateMealPlanInput = z.infer<typeof createMealPlanSchema>;
export type UpdateMealPlanInput = z.infer<typeof updateMealPlanSchema>;
export type AssignSlotInput = z.infer<typeof assignSlotSchema>;
