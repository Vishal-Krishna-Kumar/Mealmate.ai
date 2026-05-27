import { GroceryList } from '../models/GroceryList';
import type { IGroceryItem } from '../models/GroceryList';
import { Types } from 'mongoose';
import { MealPlan } from '../models/MealPlan';
import { User } from '../models/User';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { aggregateGroceryItems, collectRecipesFromPlan } from '../utils/groceryAggregator';
import type {
  GenerateFromPlanInput,
  UpdateGroceryItemInput,
} from '../validators/grocerySchemas';

export const listGroceryLists = asyncHandler(async (req, res) => {
  if (!req.user) throw AppError.unauthorized();
  const lists = await GroceryList.find({ user: req.user.sub }).sort({ createdAt: -1 });
  res.json({ success: true, items: lists });
});

export const getGroceryList = asyncHandler<{ id: string }>(async (req, res) => {
  if (!req.user) throw AppError.unauthorized();
  const list = await GroceryList.findOne({ _id: req.params.id, user: req.user.sub });
  if (!list) throw AppError.notFound('Grocery list not found');
  res.json({ success: true, list });
});

export const generateFromPlan = asyncHandler<unknown, unknown, GenerateFromPlanInput>(
  async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const { mealPlanId, name, excludePantry } = req.body;

    const plan = await MealPlan.findOne({ _id: mealPlanId, user: req.user.sub }).populate(
      'days.breakfast days.lunch days.dinner days.snacks',
      'ingredients servings title'
    );
    if (!plan) throw AppError.notFound('Meal plan not found');

    const user = excludePantry ? await User.findById(req.user.sub) : null;
    const pantry = user?.pantry?.map((p) => ({ ingredient: p.ingredient })) ?? [];

    const recipes = collectRecipesFromPlan(
      plan.days as unknown as Parameters<typeof collectRecipesFromPlan>[0]
    );
    const items = aggregateGroceryItems(recipes, { pantry });

    const list = await GroceryList.create({
      user: req.user.sub,
      mealPlan: plan._id,
      name: name ?? `Groceries for week of ${plan.weekStartDate.toISOString().slice(0, 10)}`,
      items,
    });

    res.status(201).json({ success: true, list });
  }
);

export const updateGroceryItem = asyncHandler<{ id: string }, unknown, UpdateGroceryItemInput>(
  async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const { itemId, ...patch } = req.body;

    const list = await GroceryList.findOne({ _id: req.params.id, user: req.user.sub });
    if (!list) throw AppError.notFound('Grocery list not found');

    const itemsArray = list.items as unknown as Types.DocumentArray<
      IGroceryItem & { _id: Types.ObjectId }
    >;
    const item = itemsArray.id(itemId);
    if (!item) throw AppError.notFound('Item not found in list');

    Object.assign(item, patch);
    await list.save();
    res.json({ success: true, list });
  }
);

export const deleteGroceryList = asyncHandler<{ id: string }>(async (req, res) => {
  if (!req.user) throw AppError.unauthorized();
  const result = await GroceryList.deleteOne({ _id: req.params.id, user: req.user.sub });
  if (result.deletedCount === 0) throw AppError.notFound('Grocery list not found');
  res.json({ success: true, message: 'Grocery list deleted' });
});
