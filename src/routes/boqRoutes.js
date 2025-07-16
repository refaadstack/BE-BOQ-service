import express from 'express';
import { getProjectBoq,
    addProjectItem,
    
 } from '../controllers/boqController.js';

const router = express.Router();

router.get('/projects/:projectId', getProjectBoq);
router.post('/projects/:projectId/items', addProjectItem);

export default router;
