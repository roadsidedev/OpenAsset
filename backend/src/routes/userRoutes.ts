import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  getUser,
  updateUser,
  requestEmailVerification,
  confirmEmailVerification,
  requestSmsVerification,
  confirmSmsVerification,
} from '../controllers/UserController';
import { getNonce } from '../controllers/AuthController';

const router = Router();

router.get('/:address/nonce', getNonce);
router.get('/:address', getUser);
router.put('/:address', requireAuth, updateUser);

router.post('/:address/verify-email', requireAuth, requestEmailVerification);
router.post('/:address/verify-email-confirm', requireAuth, confirmEmailVerification);

router.post('/:address/verify-sms', requireAuth, requestSmsVerification);
router.post('/:address/verify-sms-confirm', requireAuth, confirmSmsVerification);

export default router;
