import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

const pantryItemSchema = z.object({
  ingredient: z.string().trim().toLowerCase().min(1).max(100),
  quantity: z.string().trim().max(20).optional(),
  unit: z.string().trim().toLowerCase().max(20).optional(),
});

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    pantry: z.array(pantryItemSchema).max(500).optional(),
    dietaryPreferences: z.array(z.string().trim().max(40)).max(50).optional(),
    allergies: z.array(z.string().trim().max(40)).max(50).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
