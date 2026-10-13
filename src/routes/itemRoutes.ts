import { Router } from 'express';
import {
  getItems,
  getItemById,
  getMyListings,
  createItem,
  updateItem,
  toggleItemAvailability,
  deleteItem,
} from '../controllers/itemController';
import { requireAuth, optionalAuth } from '../middleware/authMiddleware';
import { uploadImages } from '../middleware/uploadMiddleware';

const router = Router();

router.get('/', getItems);
router.get('/my-listings', requireAuth, getMyListings);
router.get('/:id', optionalAuth, getItemById);
router.post('/', requireAuth, uploadImages.array('images', 5), createItem);
router.put('/:id', requireAuth, uploadImages.array('images', 5), updateItem);
router.patch('/:id/availability', requireAuth, toggleItemAvailability);
router.delete('/:id', requireAuth, deleteItem);

export default router;
