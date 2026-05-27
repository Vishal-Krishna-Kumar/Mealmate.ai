import type { FilterQuery, SortOrder } from 'mongoose';
import { Recipe, type IRecipe } from '../models/Recipe';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import type {
  CreateRecipeInput,
  UpdateRecipeInput,
  ListRecipesQuery,
} from '../validators/recipeSchemas';

export const listRecipes = asyncHandler(async (req, res) => {
    const { q, cuisine, tag, maxPrepTime, difficulty, page, limit, sort } =
      req.query as unknown as ListRecipesQuery;

    const filter: FilterQuery<IRecipe> = {};
    if (cuisine) filter.cuisine = cuisine;
    if (tag) filter.tags = tag;
    if (typeof maxPrepTime === 'number') filter.prepTime = { $lte: maxPrepTime };
    if (difficulty) filter.difficulty = difficulty;

    let sortSpec: Record<string, SortOrder> | { score: { $meta: 'textScore' } } = { createdAt: -1 };
    let projection: Record<string, unknown> | undefined;

    if (q) {
      filter.$text = { $search: q };
      // Default to relevance ranking whenever the user supplied a query
      if (sort === 'relevance' || sort === 'recent') {
        projection = { score: { $meta: 'textScore' } };
        sortSpec = { score: { $meta: 'textScore' } };
      }
    }

    if (sort === 'fastest') sortSpec = { prepTime: 1, cookTime: 1 };

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Recipe.find(filter, projection).sort(sortSpec as never).skip(skip).limit(limit).lean(),
      Recipe.countDocuments(filter),
    ]);

    res.json({
      success: true,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
      items,
    });
  });

export const getRecipe = asyncHandler<{ id: string }>(async (req, res) => {
  const recipe = await Recipe.findById(req.params.id);
  if (!recipe) throw AppError.notFound('Recipe not found');
  res.json({ success: true, recipe });
});

export const createRecipe = asyncHandler<unknown, unknown, CreateRecipeInput>(
  async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const recipe = await Recipe.create({ ...req.body, createdBy: req.user.sub });
    res.status(201).json({ success: true, recipe });
  }
);

export const updateRecipe = asyncHandler<{ id: string }, unknown, UpdateRecipeInput>(
  async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) throw AppError.notFound('Recipe not found');

    if (
      recipe.createdBy &&
      String(recipe.createdBy) !== req.user.sub &&
      req.user.role !== 'admin'
    ) {
      throw AppError.forbidden('You may only edit your own recipes');
    }

    Object.assign(recipe, req.body);
    await recipe.save();
    res.json({ success: true, recipe });
  }
);

export const deleteRecipe = asyncHandler<{ id: string }>(async (req, res) => {
  if (!req.user) throw AppError.unauthorized();
  const recipe = await Recipe.findById(req.params.id);
  if (!recipe) throw AppError.notFound('Recipe not found');

  if (
    recipe.createdBy &&
    String(recipe.createdBy) !== req.user.sub &&
    req.user.role !== 'admin'
  ) {
    throw AppError.forbidden('You may only delete your own recipes');
  }

  await recipe.deleteOne();
  res.json({ success: true, message: 'Recipe deleted' });
});
