import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { LoanController } from '../controllers/LoanController';

const router = Router();
const controller = new LoanController();

router.post('/', requireAuth, controller.create);
router.get('/', controller.getAll);
router.get('/:id', controller.getById);

export default router;
