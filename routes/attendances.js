import { Router } from 'express';
import * as ctrl from '../controllers/attendanceController.js';
import { requireLogin, requireStaff, requireCustomer } from '../middleware/authMiddleware.js';

const router = Router();
router.use(requireLogin);

router.post('/', requireStaff, ctrl.recordForPerson);
router.get('/', requireStaff, ctrl.listByDate);
router.get('/person/:personId', requireStaff, ctrl.listForPerson);

router.get('/me', requireCustomer, ctrl.listMine);
router.post('/me', requireCustomer, ctrl.recordMine);

export default router;
