import express, { Router } from 'express';
import {
  getInvoicePDF,
  getInvoiceHTML,
  downloadInvoice,
} from '../controllers/invoice.controller.js';
import { optionalAuthenticate } from '../middlewares/auth.js';

const router: Router = express.Router();

// Invoice routes - authentication is optional (handled in controller for guest orders)
router.route('/:orderId').get(optionalAuthenticate, getInvoicePDF);
router.route('/:orderId/html').get(optionalAuthenticate, getInvoiceHTML);
router.route('/:orderId/download').get(optionalAuthenticate, downloadInvoice);

export default router;

