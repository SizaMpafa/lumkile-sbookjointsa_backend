import { Router } from 'express';
import * as ctrl from '../controllers/bookController.js';
import { requireLogin, requireStaff } from '../middleware/authMiddleware.js';

const router = Router();
router.use(requireLogin); // customers and staff can both browse

router.get('/', ctrl.list);
router.get('/stats', ctrl.stats); // must stay above '/:id'
router.get('/:id', ctrl.get);

router.post('/', requireStaff, ctrl.create);
router.patch('/:id', requireStaff, ctrl.update);
router.patch('/:id/lendable', requireStaff, ctrl.setLendable);
router.delete('/:id', requireStaff, ctrl.remove);

export default router;
