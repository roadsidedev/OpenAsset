import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { MarketController } from '../controllers/MarketController';

const router = Router();
const controller = new MarketController();

router.post('/', requireAuth, controller.create);
router.get('/', controller.getAll);
router.get('/:id', controller.getById);

export default router;
