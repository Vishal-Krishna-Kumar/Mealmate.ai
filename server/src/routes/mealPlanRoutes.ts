import { Router } from 'express';
import {
  listMealPlans,
  getMealPlan,
  createMealPlan,
  updateMealPlan,
  assignSlot,
  deleteMealPlan,
} from '../controllers/mealPlanController';
import { protect } from '../middleware/authMiddleware';
import { validate } from '../middleware/validate';
import {
  createMealPlanSchema,
  updateMealPlanSchema,
  assignSlotSchema,
  idParamSchema,
} from '../validators/mealPlanSchemas';

const router = Router();
router.use(protect);

router.get('/', listMealPlans);
router.post('/', validate({ body: createMealPlanSchema }), createMealPlan);
router.get('/:id', validate({ params: idParamSchema }), getMealPlan);
router.patch(
  '/:id',
  validate({ params: idParamSchema, body: updateMealPlanSchema }),
  updateMealPlan
);
router.post(
  '/:id/assign',
  validate({ params: idParamSchema, body: assignSlotSchema }),
  assignSlot
);
router.delete('/:id', validate({ params: idParamSchema }), deleteMealPlan);

export default router;
