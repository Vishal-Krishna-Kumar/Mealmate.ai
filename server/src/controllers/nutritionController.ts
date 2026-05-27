import { MealPlan, DAYS_OF_WEEK, type DayOfWeek } from '../models/MealPlan';
import type { IRecipe, INutrition } from '../models/Recipe';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';

const NUTRIENT_KEYS: Array<keyof INutrition> = [
  'calories',
  'protein',
  'carbs',
  'fat',
  'fiber',
  'sugar',
  'sodium',
];

function emptyNutrition(): Required<INutrition> {
  return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 };
}

function addNutrition(target: Required<INutrition>, source: INutrition | undefined): void {
  if (!source) return;
  for (const k of NUTRIENT_KEYS) {
    target[k] += source[k] ?? 0;
  }
}

function round(n: Required<INutrition>): Required<INutrition> {
  return Object.fromEntries(
    NUTRIENT_KEYS.map((k) => [k, Math.round(n[k] * 10) / 10])
  ) as Required<INutrition>;
}

export const getWeeklyNutrition = asyncHandler<{ id: string }>(async (req, res) => {
  if (!req.user) throw AppError.unauthorized();

  const plan = await MealPlan.findOne({ _id: req.params.id, user: req.user.sub }).populate(
    'days.breakfast days.lunch days.dinner days.snacks',
    'title nutrition'
  );
  if (!plan) throw AppError.notFound('Meal plan not found');

  const perDay: Record<DayOfWeek, Required<INutrition>> = Object.fromEntries(
    DAYS_OF_WEEK.map((d) => [d, emptyNutrition()])
  ) as Record<DayOfWeek, Required<INutrition>>;

  const total = emptyNutrition();

  for (const dayPlan of plan.days) {
    const dayBucket = perDay[dayPlan.day];
    const recipes = [
      dayPlan.breakfast as unknown as IRecipe | undefined,
      dayPlan.lunch as unknown as IRecipe | undefined,
      dayPlan.dinner as unknown as IRecipe | undefined,
      ...((dayPlan.snacks ?? []) as unknown as IRecipe[]),
    ].filter(Boolean) as IRecipe[];

    for (const r of recipes) {
      addNutrition(dayBucket, r.nutrition);
      addNutrition(total, r.nutrition);
    }
  }

  const days = DAYS_OF_WEEK.map((d) => ({ day: d, nutrition: round(perDay[d]) }));
  res.json({
    success: true,
    mealPlanId: plan._id,
    weekStartDate: plan.weekStartDate,
    total: round(total),
    average: round(
      Object.fromEntries(
        NUTRIENT_KEYS.map((k) => [k, total[k] / 7])
      ) as Required<INutrition>
    ),
    days,
  });
});
