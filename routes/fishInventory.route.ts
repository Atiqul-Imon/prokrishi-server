import express from 'express';
import {
  getAllFishInventory,
  getFishInventoryStats,
  addFishToInventory,
  bulkAddFishToInventory,
  updateFishInventory,
  deleteFishInventory,
} from '../controllers/fishInventory.controller.js';
import { authenticate, authorizeAdmin } from '../middlewares/auth.js';

const router = express.Router();

// All routes require authentication and admin authorization
router.get('/', authenticate, authorizeAdmin, getAllFishInventory);
router.get('/stats', authenticate, authorizeAdmin, getFishInventoryStats);
router.post('/', authenticate, authorizeAdmin, addFishToInventory);
router.post('/bulk', authenticate, authorizeAdmin, bulkAddFishToInventory);
router.put('/:id', authenticate, authorizeAdmin, updateFishInventory);
router.delete('/:id', authenticate, authorizeAdmin, deleteFishInventory);

export default router;

