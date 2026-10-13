import { Router } from 'express';
import { createReview, getUserReviews } from '../controllers/reviewController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.get('/user/:userId', getUserReviews);
router.post('/', requireAuth, createReview);

export default router;
