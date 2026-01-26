import { Router } from 'express';
import { getNonce, login } from '../controllers/AuthController';

const router = Router();

router.get('/nonce/:address', getNonce);
router.post('/login', login);

export default router;
