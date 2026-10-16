import { Router } from 'express';
import * as ctrl from '../controllers/visitorController.js';
import { requireLogin, requireStaff } from '../middleware/authMiddleware.js';

const router = Router();
router.use(requireLogin, requireStaff); // visitors are staff-only

router.get('/', ctrl.list);
router.get('/search', ctrl.search); // must stay above '/:id'
router.post('/', ctrl.create);
router.get('/:id', ctrl.get);
router.patch('/:id', ctrl.update);

export default router;
