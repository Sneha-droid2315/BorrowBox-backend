import { Router } from 'express';
import {
  getAdminDashboardStats,
  getAdminUsers,
  toggleUserStatus,
  getAdminItems,
  getAdminReports,
  updateReportStatus,
} from '../controllers/adminController';
import { deleteItem } from '../controllers/itemController';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware';

const router = Router();

router.use(requireAuth, requireAdmin);

router.get('/stats', getAdminDashboardStats);
router.get('/users', getAdminUsers);
router.patch('/users/:id/status', toggleUserStatus);
router.get('/items', getAdminItems);
router.delete('/items/:id', deleteItem);
router.get('/reports', getAdminReports);
router.patch('/reports/:id', updateReportStatus);

export default router;
