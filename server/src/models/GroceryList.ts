import mongoose, { Schema, Model, HydratedDocument, Types } from 'mongoose';

export const GROCERY_CATEGORIES = [
  'produce',
  'dairy',
  'meat',
  'seafood',
  'bakery',
  'pantry',
  'frozen',
  'beverages',
  'snacks',
  'spices',
  'other',
] as const;
export type GroceryCategory = (typeof GROCERY_CATEGORIES)[number];

/**
 * Per-item provenance — which recipe(s) contributed this ingredient and
 * how much from each. Populated by the aggregator so the grocery list UI
 * can show "for Beef Bulgogi · Chicken Biryani" under each line.
 */
export interface IGroceryItemSource {
  recipe?: Types.ObjectId;
  title: string;
  quantity?: number;
  unit?: string;
}

export interface IGroceryItem {
  ingredient: string;
  quantity?: number;
  unit?: string;
  category: GroceryCategory;
  checked: boolean;
  estimatedPrice?: number;
  sources?: IGroceryItemSource[];
}

export interface IGroceryList {
  user: Types.ObjectId;
  mealPlan?: Types.ObjectId;
  name?: string;
  items: IGroceryItem[];
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type GroceryListDocument = HydratedDocument<IGroceryList>;
export type GroceryListModel = Model<IGroceryList>;

const GroceryItemSourceSchema = new Schema<IGroceryItemSource>(
  {
    recipe: { type: Schema.Types.ObjectId, ref: 'Recipe' },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    quantity: { type: Number, min: 0 },
    unit: { type: String, trim: true, lowercase: true, maxlength: 20 },
  },
  { _id: false }
);

const GroceryItemSchema = new Schema<IGroceryItem>(
  {
    ingredient: { type: String, required: true, trim: true, lowercase: true, maxlength: 100 },
    quantity: { type: Number, min: 0 },
    unit: { type: String, trim: true, lowercase: true, maxlength: 20 },
    category: { type: String, enum: GROCERY_CATEGORIES, default: 'other' },
    checked: { type: Boolean, default: false },
    estimatedPrice: { type: Number, min: 0 },
    sources: { type: [GroceryItemSourceSchema], default: undefined },
  },
  { _id: true }
);

const GroceryListSchema = new Schema<IGroceryList, GroceryListModel>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    mealPlan: { type: Schema.Types.ObjectId, ref: 'MealPlan', index: true },
    name: { type: String, trim: true, maxlength: 100 },
    items: { type: [GroceryItemSchema], default: [] },
    generatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

GroceryListSchema.index({ user: 1, createdAt: -1 });

export const GroceryList =
  (mongoose.models.GroceryList as GroceryListModel) ||
  mongoose.model<IGroceryList, GroceryListModel>('GroceryList', GroceryListSchema);

export default GroceryList;
