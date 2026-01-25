import { Router } from 'express';
import { MarketController } from '../controllers/MarketController';

const router = Router();
const controller = new MarketController();

router.post('/', controller.create);
router.get('/', controller.getAll);
router.get('/:id', controller.getById);

export default router;
