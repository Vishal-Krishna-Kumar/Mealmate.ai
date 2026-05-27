import { Router } from 'express';
import {
  listGroceryLists,
  getGroceryList,
  generateFromPlan,
  updateGroceryItem,
  deleteGroceryList,
} from '../controllers/groceryController';
import { protect } from '../middleware/authMiddleware';
import { validate } from '../middleware/validate';
import {
  generateFromPlanSchema,
  updateGroceryItemSchema,
  idParamSchema,
} from '../validators/grocerySchemas';

const router = Router();
router.use(protect);

router.get('/', listGroceryLists);
router.post('/generate', validate({ body: generateFromPlanSchema }), generateFromPlan);
router.get('/:id', validate({ params: idParamSchema }), getGroceryList);
router.patch(
  '/:id/items',
  validate({ params: idParamSchema, body: updateGroceryItemSchema }),
  updateGroceryItem
);
router.delete('/:id', validate({ params: idParamSchema }), deleteGroceryList);

export default router;
