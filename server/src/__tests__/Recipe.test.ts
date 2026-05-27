import { connectInMemoryDB, clearDB, disconnectInMemoryDB } from '../test/db';
import { Recipe } from '../models/Recipe';

beforeAll(async () => {
  await connectInMemoryDB();
});
afterEach(async () => {
  await clearDB();
});
afterAll(async () => {
  await disconnectInMemoryDB();
});

const baseRecipe = {
  title: 'Chicken Tikka',
  ingredients: [{ name: 'Chicken', quantity: 500, unit: 'g' }],
  instructions: ['Marinate', 'Grill', 'Serve'],
  prepTime: 20,
  cookTime: 25,
  servings: 4,
};

describe('Recipe model', () => {
  it('auto-generates a slug from title', async () => {
    const r = await Recipe.create(baseRecipe);
    expect(r.slug).toMatch(/^chicken-tikka-/);
  });

  it('computes virtual totalTime', async () => {
    const r = await Recipe.create(baseRecipe);
    expect(r.get('totalTime')).toBe(45);
  });

  it('rejects recipe with no ingredients', async () => {
    await expect(
      Recipe.create({ ...baseRecipe, ingredients: [] })
    ).rejects.toThrow();
  });

  it('rejects recipe with no instructions', async () => {
    await expect(
      Recipe.create({ ...baseRecipe, instructions: [] })
    ).rejects.toThrow();
  });

  it('rejects negative prepTime', async () => {
    await expect(
      Recipe.create({ ...baseRecipe, prepTime: -5 })
    ).rejects.toThrow();
  });

  it('lowercases ingredient names', async () => {
    const r = await Recipe.create({
      ...baseRecipe,
      ingredients: [{ name: 'TOMATO', quantity: 2 }],
    });
    expect(r.ingredients[0]?.name).toBe('tomato');
  });
});
