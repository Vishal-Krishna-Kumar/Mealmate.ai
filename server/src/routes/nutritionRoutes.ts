import { Router } from 'express';
import { z } from 'zod';
import { getWeeklyNutrition } from '../controllers/nutritionController';
import { protect } from '../middleware/authMiddleware';
import { validate } from '../middleware/validate';

const router = Router();
router.use(protect);

const idSchema = z.object({ id: z.string().regex(/^[a-fA-F0-9]{24}$/) });
router.get('/mealplan/:id', validate({ params: idSchema }), getWeeklyNutrition);

export default router;
