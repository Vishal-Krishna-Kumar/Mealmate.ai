import mongoose, { Schema, Model, HydratedDocument, Types } from 'mongoose';

export const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

export interface IDayPlan {
  day: DayOfWeek;
  breakfast?: Types.ObjectId;
  lunch?: Types.ObjectId;
  dinner?: Types.ObjectId;
  snacks: Types.ObjectId[];
}

export interface IMealPlan {
  user: Types.ObjectId;
  name?: string;
  weekStartDate: Date;
  days: IDayPlan[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type MealPlanDocument = HydratedDocument<IMealPlan>;
export type MealPlanModel = Model<IMealPlan>;

const DayPlanSchema = new Schema<IDayPlan>(
  {
    day: { type: String, enum: DAYS_OF_WEEK, required: true },
    breakfast: { type: Schema.Types.ObjectId, ref: 'Recipe' },
    lunch: { type: Schema.Types.ObjectId, ref: 'Recipe' },
    dinner: { type: Schema.Types.ObjectId, ref: 'Recipe' },
    snacks: { type: [{ type: Schema.Types.ObjectId, ref: 'Recipe' }], default: [] },
  },
  { _id: false }
);

const MealPlanSchema = new Schema<IMealPlan, MealPlanModel>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, trim: true, maxlength: 100 },
    weekStartDate: { type: Date, required: true },
    days: {
      type: [DayPlanSchema],
      default: () => DAYS_OF_WEEK.map((d) => ({ day: d, snacks: [] })),
      validate: {
        validator: (arr: IDayPlan[]) => arr.length <= 7,
        message: 'A meal plan can have at most 7 days',
      },
    },
    notes: { type: String, trim: true, maxlength: 1000 },
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

// One meal plan per (user, week) — prevents duplicates
MealPlanSchema.index({ user: 1, weekStartDate: 1 }, { unique: true });

export const MealPlan =
  (mongoose.models.MealPlan as MealPlanModel) ||
  mongoose.model<IMealPlan, MealPlanModel>('MealPlan', MealPlanSchema);

export default MealPlan;
