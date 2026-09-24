import { Router } from 'express';
import requireRole from '../middleware/requireRole.js';
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  addProjectMember,
  removeProjectMember,
} from '../controllers/projects.controller.js';

const router = Router();
const requireOwner = requireRole('org:admin');

router.get('/', listProjects);
router.get('/:id', getProject);
router.post('/', requireOwner, createProject);
router.put('/:id', requireOwner, updateProject);
router.delete('/:id', requireOwner, deleteProject);
router.post('/:id/members', requireOwner, addProjectMember);
router.delete('/:id/members/:userId', requireOwner, removeProjectMember);

export default router;
