import { Router } from 'express';
import { listTasks, getTask, createTask, bulkCreateTasks, updateTask, reviewTask, deleteTask } from '../controllers/tasks.controller.js';
import requireRole from '../middleware/requireRole.js';
import { listComments, createComment } from '../controllers/comments.controller.js';
import { listTaskActivity } from '../controllers/activity.controller.js';

const router = Router();

router.get('/', listTasks);
router.post('/', createTask);
router.post('/bulk', bulkCreateTasks);
router.get('/:id', getTask);
router.put('/:id', updateTask);
router.post('/:id/review', requireRole('org:admin'), reviewTask);
router.delete('/:id', deleteTask);

router.get('/:id/comments', listComments);
router.post('/:id/comments', createComment);
router.get('/:id/activity', listTaskActivity);

export default router;
