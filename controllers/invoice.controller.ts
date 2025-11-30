import { Response } from 'express';
import { generateInvoicePDF, generateInvoiceHTML } from '../services/invoice.service.js';
import Order from '../models/order.model.js';
import FishOrder from '../models/fishOrder.model.js';
import { AuthRequest } from '../types/index.js';
import logger from '../services/logger.js';

/**
 * Generate and return invoice PDF
 * GET /api/invoice/:orderId
 */
export const getInvoicePDF = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const { type = 'regular' } = req.query;

    if (!orderId) {
      res.status(400).json({
        success: false,
        message: 'Order ID is required',
      });
      return;
    }

    // Verify order exists and user has access
    let order: any;
    if (type === 'fish') {
      order = await FishOrder.findById(orderId);
    } else {
      order = await Order.findById(orderId);
    }

    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found',
      });
      return;
    }

    // Check authorization
    // Guest orders can be accessed without authentication (by order ID)
    // User orders require authentication and ownership
    // Admins can access all orders
    if (order.user && !order.isGuestOrder) {
      // This is a user order, require authentication
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }
      
      const isOwner = order.user.toString() === req.user._id.toString();
      const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
      
      if (!isOwner && !isAdmin) {
        res.status(403).json({
          success: false,
          message: 'Unauthorized to access this invoice',
        });
        return;
      }
    }
    // Guest orders can be accessed without authentication (anyone with order ID)

    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(orderId, type as 'regular' | 'fish');

    // Set response headers
    const invoiceNumber = order.invoiceNumber || order.orderNumber || orderId;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${invoiceNumber}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    // Send PDF
    res.send(pdfBuffer);
  } catch (error: any) {
    logger.error('Get invoice PDF error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate invoice',
      error: error.message,
    });
  }
};

/**
 * Generate and return invoice HTML (for preview)
 * GET /api/invoice/:orderId/html
 */
export const getInvoiceHTML = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const { type = 'regular' } = req.query;

    if (!orderId) {
      res.status(400).json({
        success: false,
        message: 'Order ID is required',
      });
      return;
    }

    // Verify order exists and user has access
    let order: any;
    if (type === 'fish') {
      order = await FishOrder.findById(orderId);
    } else {
      order = await Order.findById(orderId);
    }

    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found',
      });
      return;
    }

    // Check authorization (same logic as PDF)
    if (order.user && !order.isGuestOrder) {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }
      
      const isOwner = order.user.toString() === req.user._id.toString();
      const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
      
      if (!isOwner && !isAdmin) {
        res.status(403).json({
          success: false,
          message: 'Unauthorized to access this invoice',
        });
        return;
      }
    }

    // Generate HTML
    const html = await generateInvoiceHTML(orderId, type as 'regular' | 'fish');

    // Set response headers
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error: any) {
    logger.error('Get invoice HTML error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate invoice HTML',
      error: error.message,
    });
  }
};

/**
 * Download invoice PDF
 * GET /api/invoice/:orderId/download
 */
export const downloadInvoice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const { type = 'regular' } = req.query;

    if (!orderId) {
      res.status(400).json({
        success: false,
        message: 'Order ID is required',
      });
      return;
    }

    // Verify order exists and user has access
    let order: any;
    if (type === 'fish') {
      order = await FishOrder.findById(orderId);
    } else {
      order = await Order.findById(orderId);
    }

    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found',
      });
      return;
    }

    // Check authorization
    if (req.user) {
      const isOwner = order.user && order.user.toString() === req.user._id.toString();
      const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
      
      if (!isOwner && !isAdmin) {
        res.status(403).json({
          success: false,
          message: 'Unauthorized to download this invoice',
        });
        return;
      }
    } else if (order.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(orderId, type as 'regular' | 'fish');

    // Set response headers for download
    const invoiceNumber = order.invoiceNumber || order.orderNumber || orderId;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoiceNumber}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    // Send PDF
    res.send(pdfBuffer);
  } catch (error: any) {
    logger.error('Download invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download invoice',
      error: error.message,
    });
  }
};

