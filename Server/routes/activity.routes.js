import { Router } from 'express';
import { listWorkspaceActivity } from '../controllers/activity.controller.js';

const router = Router();

router.get('/', listWorkspaceActivity);

export default router;
