import { Router } from 'express';
import { listNotifications, markRead, markAllRead } from '../controllers/notifications.controller.js';

const router = Router();

router.get('/', listNotifications);
router.post('/read-all', markAllRead);
router.post('/:id/read', markRead);

export default router;
