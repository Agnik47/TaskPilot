import { Router } from 'express';
import requireRole from '../middleware/requireRole.js';
import { getSettings, updateSettings, deleteWorkspace } from '../controllers/workspace.controller.js';

const router = Router();
const requireOwner = requireRole('org:admin');

router.get('/settings', getSettings);
router.put('/settings', requireOwner, updateSettings);
router.delete('/', requireOwner, deleteWorkspace);

export default router;
