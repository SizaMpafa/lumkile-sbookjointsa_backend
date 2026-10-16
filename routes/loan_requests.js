import { Router } from 'express';
import * as ctrl from '../controllers/loanRequestController.js';
import { requireLogin, requireStaff, requireCustomer } from '../middleware/authMiddleware.js';

const router = Router();
router.use(requireLogin);

router.post('/', requireCustomer, ctrl.create);
router.get('/mine', requireCustomer, ctrl.mine); // must stay above '/:id'
router.get('/', requireStaff, ctrl.list);
router.get('/:id', ctrl.get);

router.patch('/:id/approve', requireStaff, ctrl.approve);
router.patch('/:id/decline', requireStaff, ctrl.decline);
router.patch('/:id/return', requireStaff, ctrl.markReturned);

export default router;
