import { Router } from 'express';
import * as ctrl from '../controllers/userController.js';
import { requireLogin, requireStaff, requireSelfOrStaff } from '../middleware/authMiddleware.js';

const router = Router();
router.use(requireLogin);

router.post('/staff', requireStaff, ctrl.createStaff);
router.post('/customers', requireStaff, ctrl.registerCustomer);
router.get('/', requireStaff, ctrl.list);

router.get('/:id', requireSelfOrStaff(), ctrl.getById);
router.get('/:id/profile', requireSelfOrStaff(), ctrl.profile);
router.patch('/:id', requireSelfOrStaff(), ctrl.update);
router.post('/:id/reset-password', requireStaff, ctrl.resetPassword);

export default router;
