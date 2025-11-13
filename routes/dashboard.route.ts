import express, { Router } from 'express';
import { getDashboardStats } from '../controllers/dashboard.controller.js';
import { authenticate, authorizeAdmin } from '../middlewares/auth.js';

const router: Router = express.Router();

router.get('/stats', authenticate, authorizeAdmin, getDashboardStats);

export default router;

