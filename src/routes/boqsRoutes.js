import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { getSettings, updateSettings } from '../controllers/settingsController.js';
import {
  listBoqs, createBoq, getBoq, updateBoq, deleteBoq, exportBoq,
} from '../controllers/boqsController.js';
import {
  listSections, createSection, updateSection, deleteSection,
} from '../controllers/boqSectionsController.js';
import {
  listItems, createItem, updateItem, deleteItem,
} from '../controllers/boqItemsController.js';
import {
  listVersions, getVersion, submitForApproval, decideVersion, listApprovals,
} from '../controllers/boqVersionsController.js';

const router = express.Router();

router.use(authenticateToken);

// CRUD BOQ (0..N per project)
router.get('/settings', getSettings);
router.put('/settings', requireAdmin, updateSettings);
router.get('/', listBoqs);
router.post('/', createBoq);
router.get('/:id', getBoq);
router.put('/:id', updateBoq);
router.delete('/:id', deleteBoq);
router.get('/:id/export', exportBoq);

// Sections
router.get('/:boqId/sections', listSections);
router.post('/:boqId/sections', createSection);
router.put('/sections/:id', updateSection);
router.delete('/sections/:id', deleteSection);

// Items
router.get('/:boqId/items', listItems);
router.post('/:boqId/items', createItem);
router.put('/items/:id', updateItem);
router.delete('/items/:id', deleteItem);

// Version + approval
router.get('/:boqId/versions', listVersions);
router.post('/:boqId/submit', submitForApproval);
router.get('/versions/:id', getVersion);
router.post('/versions/:id/approve', requireAdmin, decideVersion('approve'));
router.post('/versions/:id/reject', requireAdmin, decideVersion('reject'));
router.get('/:boqId/approvals', listApprovals);

export default router;
