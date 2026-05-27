import type { Request, Response } from 'express';
import { User } from '../models/User';
import { AppError } from '../utils/AppError';
import { signAccessToken } from '../utils/jwt';
import { asyncHandler } from '../utils/asyncHandler';
import type { RegisterInput, LoginInput, UpdateProfileInput } from '../validators/authSchemas';

export const register = asyncHandler<unknown, unknown, RegisterInput>(async (req, res) => {
  const { name, email, password } = req.body;

  const existing = await User.findOne({ email });
  if (existing) throw AppError.conflict('Email already registered');

  const user = await User.create({ name, email, password });
  const token = signAccessToken({ sub: String(user._id), role: user.role });

  res.status(201).json({
    success: true,
    token,
    user: { id: String(user._id), name: user.name, email: user.email, role: user.role },
  });
});

export const login = asyncHandler<unknown, unknown, LoginInput>(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw AppError.unauthorized('Invalid email or password');
  }

  const token = signAccessToken({ sub: String(user._id), role: user.role });
  res.json({
    success: true,
    token,
    user: { id: String(user._id), name: user.name, email: user.email, role: user.role },
  });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized();
  const user = await User.findById(req.user.sub);
  if (!user) throw AppError.notFound('User not found');
  res.json({ success: true, user: user.toJSON() });
});

export const updateProfile = asyncHandler<unknown, unknown, UpdateProfileInput>(
  async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const user = await User.findById(req.user.sub);
    if (!user) throw AppError.notFound('User not found');

    const { name, pantry, dietaryPreferences, allergies } = req.body;
    if (name !== undefined) user.name = name;
    if (pantry !== undefined) {
      user.pantry = pantry.map((p) => ({
        ingredient: p.ingredient,
        quantity: p.quantity,
        unit: p.unit,
        addedAt: new Date(),
      }));
    }
    if (dietaryPreferences !== undefined) user.dietaryPreferences = dietaryPreferences;
    if (allergies !== undefined) user.allergies = allergies;
    await user.save();

    res.json({ success: true, user: user.toJSON() });
  }
);
