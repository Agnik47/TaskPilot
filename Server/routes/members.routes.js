import { Router } from 'express';
import { listMembers } from '../controllers/members.controller.js';

const router = Router();

router.get('/', listMembers);

export default router;
