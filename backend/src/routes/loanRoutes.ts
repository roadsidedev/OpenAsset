import { Router } from 'express';
import { LoanController } from '../controllers/LoanController';

const router = Router();
const controller = new LoanController();

router.post('/', controller.create);
router.get('/', controller.getAll);
router.get('/:id', controller.getById);

export default router;
