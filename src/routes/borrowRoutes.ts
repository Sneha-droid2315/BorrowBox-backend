import { Router } from 'express';
import {
  createBorrowRequest,
  respondToBorrowRequest,
  confirmHandover,
  confirmReturn,
  cancelBorrowRequest,
  getMyBorrowRequests,
  getIncomingRequests,
  getStudentDashboard,
} from '../controllers/borrowController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.use(requireAuth);

router.get('/dashboard', getStudentDashboard);
router.get('/my-requests', getMyBorrowRequests);
router.get('/incoming', getIncomingRequests);
router.post('/', createBorrowRequest);
router.patch('/:id/respond', respondToBorrowRequest);
router.patch('/:id/handover', confirmHandover);
router.patch('/:id/return', confirmReturn);
router.patch('/:id/cancel', cancelBorrowRequest);

export default router;
