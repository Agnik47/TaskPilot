import { Router } from 'express';
import { listTasks, getTask, createTask, updateTask, deleteTask } from '../controllers/tasks.controller.js';
import { listComments, createComment } from '../controllers/comments.controller.js';
import { listTaskActivity } from '../controllers/activity.controller.js';

const router = Router();

router.get('/', listTasks);
router.post('/', createTask);
router.get('/:id', getTask);
router.put('/:id', updateTask);
router.delete('/:id', deleteTask);

router.get('/:id/comments', listComments);
router.post('/:id/comments', createComment);
router.get('/:id/activity', listTaskActivity);

export default router;
