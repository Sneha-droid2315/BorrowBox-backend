import { Router } from 'express';
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
} from '../controllers/wishlistController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.use(requireAuth);

router.get('/', getWishlist);
router.post('/:itemId', addToWishlist);
router.delete('/:itemId', removeFromWishlist);

export default router;
