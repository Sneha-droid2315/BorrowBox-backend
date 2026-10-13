import { Router } from 'express';
import { createReport, getMyReports } from '../controllers/reportController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.use(requireAuth);

router.get('/my-reports', getMyReports);
router.post('/', createReport);

export default router;
