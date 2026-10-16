import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as ctrl from '../controllers/authController.js';
import { requireLogin } from '../middleware/authMiddleware.js';

const router = Router();

// Slows down password guessing (per IP).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});

router.post('/login', authLimiter, ctrl.login);
router.post('/refresh', ctrl.refresh);
router.post('/logout', requireLogin, ctrl.logout);
router.get('/me', requireLogin, ctrl.me);
router.post('/change-password', requireLogin, authLimiter, ctrl.changePassword);

export default router;
