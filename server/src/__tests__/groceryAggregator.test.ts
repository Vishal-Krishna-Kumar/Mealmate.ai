import { aggregateGroceryItems, categorize } from '../utils/groceryAggregator';

describe('groceryAggregator', () => {
  it('categorizes ingredients correctly', () => {
    expect(categorize('Chicken breast')).toBe('meat');
    expect(categorize('Whole milk')).toBe('dairy');
    expect(categorize('Cherry tomato')).toBe('produce');
    expect(categorize('Spaghetti')).toBe('pantry');
    expect(categorize('Salmon fillet')).toBe('seafood');
    expect(categorize('Some weird thing')).toBe('other');
  });

  it('merges duplicate ingredients with compatible units', () => {
    const recipes = [
      { ingredients: [{ name: 'Tomato', quantity: 2, unit: 'cup' }] },
      { ingredients: [{ name: 'tomato', quantity: 1, unit: 'cup' }] },
    ];
    const out = aggregateGroceryItems(recipes);
    const tomato = out.find((i) => i.ingredient === 'tomato');
    expect(tomato).toBeDefined();
    // 2 cups + 1 cup -> normalized to ml: 3*240 = 720
    expect(tomato?.quantity).toBe(720);
    expect(tomato?.unit).toBe('ml');
  });

  it('keeps mismatched units as separate entries', () => {
    const recipes = [
      { ingredients: [{ name: 'Onion', quantity: 1, unit: 'piece' }] },
      { ingredients: [{ name: 'Onion', quantity: 100, unit: 'g' }] },
    ];
    const out = aggregateGroceryItems(recipes);
    const onions = out.filter((i) => i.ingredient === 'onion');
    expect(onions).toHaveLength(2);
  });

  it('subtracts pantry items', () => {
    const recipes = [
      { ingredients: [{ name: 'Salt', quantity: 5, unit: 'g' }, { name: 'Garlic', quantity: 2 }] },
    ];
    const out = aggregateGroceryItems(recipes, { pantry: [{ ingredient: 'salt' }] });
    expect(out.find((i) => i.ingredient === 'salt')).toBeUndefined();
    expect(out.find((i) => i.ingredient === 'garlic')).toBeDefined();
  });

  it('sorts by category then alphabetical', () => {
    const recipes = [
      {
        ingredients: [
          { name: 'Onion' }, // produce
          { name: 'Chicken' }, // meat
          { name: 'Apple' }, // produce
        ],
      },
    ];
    const out = aggregateGroceryItems(recipes);
    expect(out.map((i) => i.ingredient)).toEqual(['chicken', 'apple', 'onion']);
  });
});
