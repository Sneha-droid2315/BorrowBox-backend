import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  register,
  login,
  logout,
  getMe,
  updateProfile,
  getPublicUserProfile,
} from '../controllers/authController';
import { requireAuth } from '../middleware/authMiddleware';
import { env } from '../config/env';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.NODE_ENV === 'test' ? 1000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP, please try again after 15 minutes.',
  },
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', logout);
router.get('/me', requireAuth, getMe);
router.put('/profile', requireAuth, updateProfile);
router.get('/users/:id', getPublicUserProfile);

export default router;
