import express from 'express';
import {
  getProjectBoq,
  addProjectItem,
  updateProjectItem,
  deleteProjectItem,
} from '../controllers/boqController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Ambil semua kategori + item dalam 1 proyek
router.get('/projects/:projectId', getProjectBoq);

// Tambahkan item ke proyek
router.post('/projects/:projectId/items', addProjectItem);

// Update item tertentu
router.put('/items/:id', updateProjectItem);

// Hapus item tertentu
router.delete('/items/:id', deleteProjectItem);

export default router;
