import PDFDocument from 'pdfkit';
import Order from '../models/order.model.js';
import FishOrder from '../models/fishOrder.model.js';

interface CompanyInfo {
  name: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  website?: string;
}

interface InvoiceData {
  invoiceNumber: string;
  orderNumber: string;
  orderDate: Date;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  shippingAddress: {
    name: string;
    phone: string;
    address: string;
    division?: string;
    district?: string;
    upazila?: string;
    postalCode?: string;
  };
  items: Array<{
    name: string;
    sku?: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    total: number;
    variant?: string;
  }>;
  subtotal: number;
  shippingFee: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  shippingZone?: string;
  notes?: string;
}

// Company information - can be moved to environment variables
const getCompanyInfo = (): CompanyInfo => {
  return {
    name: process.env.COMPANY_NAME || 'Prokrishi Hub',
    address: process.env.COMPANY_ADDRESS || 'Dhaka, Bangladesh',
    city: process.env.COMPANY_CITY || 'Dhaka',
    phone: process.env.COMPANY_PHONE || '+880-XXX-XXXXXXX',
    email: process.env.COMPANY_EMAIL || 'info@prokrishihub.com',
    website: process.env.COMPANY_WEBSITE || 'www.prokrishihub.com',
  };
};

// Generate invoice number
export const generateInvoiceNumber = (): string => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `INV-${dateStr}-${randomPart}`;
};

// Prepare invoice data from Order
const prepareOrderInvoiceData = (order: any): InvoiceData => {
  const invoiceNumber = order.invoiceNumber || generateInvoiceNumber();
  const orderNumber = order._id.toString().slice(-8).toUpperCase();
  
  const customerName = order.isGuestOrder
    ? order.guestInfo?.name || order.shippingAddress?.name || 'Guest Customer'
    : ((order.user && typeof order.user === 'object' ? order.user.name : null) || order.shippingAddress?.name || 'Customer');
  
  const customerPhone = order.isGuestOrder
    ? order.guestInfo?.phone || order.shippingAddress?.phone || 'N/A'
    : ((order.user && typeof order.user === 'object' ? order.user.phone : null) || order.shippingAddress?.phone || 'N/A');
  
  const customerEmail = order.isGuestOrder
    ? order.guestInfo?.email
    : (order.user && typeof order.user === 'object' ? order.user.email : undefined);

  const items = order.orderItems.map((item: any) => {
    const variantLabel = item.variant?.label ? ` (${item.variant.label})` : '';
    return {
      name: `${item.name}${variantLabel}`,
      sku: item.variant?.sku || item.product?.sku,
      quantity: item.quantity,
      unit: item.variant?.unit || 'pcs',
      unitPrice: item.price,
      total: item.price * item.quantity,
      variant: item.variant?.label,
    };
  });

  return {
    invoiceNumber,
    orderNumber,
    orderDate: order.createdAt || new Date(),
    customerName,
    customerPhone,
    customerEmail,
    shippingAddress: order.shippingAddress,
    items,
    subtotal: order.totalPrice - (order.shippingFee || 0),
    shippingFee: order.shippingFee || 0,
    total: order.totalAmount || order.totalPrice,
    paymentMethod: order.paymentMethod || 'Cash on Delivery',
    paymentStatus: order.paymentStatus || 'pending',
    orderStatus: order.status || 'pending',
    shippingZone: order.shippingZone,
    notes: order.notes,
  };
};

// Prepare invoice data from FishOrder
const prepareFishOrderInvoiceData = (order: any): InvoiceData => {
  const invoiceNumber = order.invoiceNumber || generateInvoiceNumber();
  const orderNumber = order.orderNumber || order._id.toString().slice(-8).toUpperCase();
  
  const customerName = order.isGuestOrder
    ? order.guestInfo?.name || order.shippingAddress?.name || 'Guest Customer'
    : ((order.user && typeof order.user === 'object' ? order.user.name : null) || order.shippingAddress?.name || 'Customer');
  
  const customerPhone = order.isGuestOrder
    ? order.guestInfo?.phone || order.shippingAddress?.phone || 'N/A'
    : ((order.user && typeof order.user === 'object' ? order.user.phone : null) || order.shippingAddress?.phone || 'N/A');
  
  const customerEmail = order.isGuestOrder
    ? order.guestInfo?.email
    : (order.user && typeof order.user === 'object' ? order.user.email : undefined);

  const items = order.orderItems.map((item: any) => {
    return {
      name: `${item.fishProductName} (${item.sizeCategoryLabel})`,
      sku: undefined,
      quantity: item.requestedWeight,
      unit: 'kg',
      unitPrice: item.pricePerKg,
      total: item.totalPrice,
      variant: item.sizeCategoryLabel,
    };
  });

  return {
    invoiceNumber,
    orderNumber,
    orderDate: order.createdAt || new Date(),
    customerName,
    customerPhone,
    customerEmail,
    shippingAddress: order.shippingAddress,
    items,
    subtotal: order.totalPrice - (order.shippingFee || 0),
    shippingFee: order.shippingFee || 0,
    total: order.totalAmount || order.totalPrice,
    paymentMethod: order.paymentMethod || 'Cash on Delivery',
    paymentStatus: order.paymentStatus || 'pending',
    orderStatus: order.status || 'pending',
    shippingZone: order.shippingZone,
    notes: order.notes,
  };
};

// Format currency
const formatCurrency = (amount: number): string => {
  return `৳${amount.toFixed(2)}`;
};

// Format date
const formatDate = (date: Date): string => {
  return new Date(date).toLocaleDateString('en-BD', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

// Generate PDF Invoice
export const generateInvoicePDF = async (
  orderId: string,
  orderType: 'regular' | 'fish' = 'regular'
): Promise<Buffer> => {
  return new Promise(async (resolve, reject) => {
    try {
      // Fetch order
      let order: any;
      if (orderType === 'fish') {
        order = await FishOrder.findById(orderId)
          .populate('user', 'name email phone')
          .populate('orderItems.fishProduct', 'name sku');
      } else {
        order = await Order.findById(orderId)
          .populate('user', 'name email phone')
          .populate('orderItems.product', 'name sku');
      }

      if (!order) {
        reject(new Error('Order not found'));
        return;
      }

      // Prepare invoice data
      const invoiceData = orderType === 'fish'
        ? prepareFishOrderInvoiceData(order)
        : prepareOrderInvoiceData(order);

      const company = getCompanyInfo();

      // Create PDF document
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
      });

      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);

      // Header Section
      doc.fontSize(24).font('Helvetica-Bold').text(company.name, 50, 50, { align: 'left' });
      doc.fontSize(10).font('Helvetica').text(company.address, 50, 80);
      doc.text(`${company.city}`, 50, 95);
      doc.text(`Phone: ${company.phone}`, 50, 110);
      doc.text(`Email: ${company.email}`, 50, 125);
      if (company.website) {
        doc.text(`Website: ${company.website}`, 50, 140);
      }

      // Invoice Title
      doc.fontSize(20).font('Helvetica-Bold').text('INVOICE', 400, 50, { align: 'right' });
      doc.fontSize(10).font('Helvetica');
      doc.text(`Invoice #: ${invoiceData.invoiceNumber}`, 400, 80, { align: 'right' });
      doc.text(`Order #: ${orderType === 'fish' ? `FISH-${invoiceData.orderNumber}` : invoiceData.orderNumber}`, 400, 95, { align: 'right' });
      doc.text(`Date: ${formatDate(invoiceData.orderDate)}`, 400, 110, { align: 'right' });

      // Customer Section
      let yPos = 180;
      doc.fontSize(12).font('Helvetica-Bold').text('Bill To:', 50, yPos);
      yPos += 20;
      doc.fontSize(10).font('Helvetica');
      doc.text(invoiceData.customerName, 50, yPos);
      yPos += 15;
      doc.text(`Phone: ${invoiceData.customerPhone}`, 50, yPos);
      if (invoiceData.customerEmail) {
        yPos += 15;
        doc.text(`Email: ${invoiceData.customerEmail}`, 50, yPos);
      }

      // Shipping Address
      yPos = 180;
      doc.fontSize(12).font('Helvetica-Bold').text('Ship To:', 300, yPos);
      yPos += 20;
      doc.fontSize(10).font('Helvetica');
      doc.text(invoiceData.shippingAddress.name || invoiceData.customerName, 300, yPos);
      yPos += 15;
      doc.text(invoiceData.shippingAddress.address, 300, yPos);
      if (invoiceData.shippingAddress.district) {
        yPos += 15;
        doc.text(`${invoiceData.shippingAddress.district}${invoiceData.shippingAddress.upazila ? `, ${invoiceData.shippingAddress.upazila}` : ''}`, 300, yPos);
      }
      if (invoiceData.shippingAddress.division) {
        yPos += 15;
        doc.text(invoiceData.shippingAddress.division, 300, yPos);
      }
      if (invoiceData.shippingAddress.postalCode) {
        yPos += 15;
        doc.text(`Postal Code: ${invoiceData.shippingAddress.postalCode}`, 300, yPos);
      }
      yPos += 15;
      doc.text(`Phone: ${invoiceData.shippingAddress.phone}`, 300, yPos);

      // Items Table Header
      yPos = Math.max(yPos, 320) + 30;
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Item', 50, yPos);
      doc.text('SKU', 200, yPos);
      doc.text('Qty', 280, yPos, { width: 50, align: 'right' });
      doc.text('Unit', 340, yPos, { width: 50, align: 'center' });
      doc.text('Unit Price', 400, yPos, { width: 70, align: 'right' });
      doc.text('Total', 480, yPos, { width: 70, align: 'right' });

      // Draw line under header
      yPos += 15;
      doc.moveTo(50, yPos).lineTo(550, yPos).stroke();

      // Items Table Rows
      yPos += 10;
      doc.fontSize(9).font('Helvetica');
      invoiceData.items.forEach((item) => {
        if (yPos > 700) {
          doc.addPage();
          yPos = 50;
        }

        // Item name (wrap if too long)
        const itemName = doc.heightOfString(item.name, { width: 140 });
        doc.text(item.name, 50, yPos, { width: 140 });
        
        // SKU
        doc.text(item.sku || 'N/A', 200, yPos, { width: 70 });
        
        // Quantity
        doc.text(item.quantity.toString(), 280, yPos, { width: 50, align: 'right' });
        
        // Unit
        doc.text(item.unit, 340, yPos, { width: 50, align: 'center' });
        
        // Unit Price
        doc.text(formatCurrency(item.unitPrice), 400, yPos, { width: 70, align: 'right' });
        
        // Total
        doc.text(formatCurrency(item.total), 480, yPos, { width: 70, align: 'right' });

        yPos += Math.max(itemName, 20);
      });

      // Summary Section
      yPos = Math.max(yPos, 600) + 20;
      const summaryX = 350;
      
      doc.fontSize(10).font('Helvetica');
      doc.text('Subtotal:', summaryX, yPos, { width: 100, align: 'right' });
      doc.text(formatCurrency(invoiceData.subtotal), 460, yPos, { width: 90, align: 'right' });
      
      yPos += 20;
      doc.text('Shipping Fee:', summaryX, yPos, { width: 100, align: 'right' });
      doc.text(formatCurrency(invoiceData.shippingFee), 460, yPos, { width: 90, align: 'right' });
      
      yPos += 20;
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('Total:', summaryX, yPos, { width: 100, align: 'right' });
      doc.text(formatCurrency(invoiceData.total), 460, yPos, { width: 90, align: 'right' });

      // Payment and Status Info
      yPos += 40;
      doc.fontSize(10).font('Helvetica');
      doc.text(`Payment Method: ${invoiceData.paymentMethod}`, 50, yPos);
      yPos += 15;
      doc.text(`Payment Status: ${invoiceData.paymentStatus.toUpperCase()}`, 50, yPos);
      yPos += 15;
      doc.text(`Order Status: ${invoiceData.orderStatus.toUpperCase()}`, 50, yPos);
      if (invoiceData.shippingZone) {
        yPos += 15;
        const zoneLabel = invoiceData.shippingZone === 'inside_dhaka' ? 'Inside Dhaka' : 'Outside Dhaka';
        doc.text(`Shipping Zone: ${zoneLabel}`, 50, yPos);
      }

      // Footer
      yPos = 750;
      doc.fontSize(8).font('Helvetica');
      doc.text('Thank you for your business!', 50, yPos, { align: 'center', width: 500 });
      yPos += 15;
      doc.text('For any queries, please contact us at the above address or email.', 50, yPos, { align: 'center', width: 500 });
      yPos += 15;
      doc.text('This is a computer-generated invoice and does not require a signature.', 50, yPos, { align: 'center', width: 500 });

      // Finalize PDF
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

// Generate HTML Invoice (for preview)
export const generateInvoiceHTML = async (
  orderId: string,
  orderType: 'regular' | 'fish' = 'regular'
): Promise<string> => {
  try {
    // Fetch order
    let order: any;
    if (orderType === 'fish') {
      order = await FishOrder.findById(orderId)
        .populate('user', 'name email phone')
        .populate('orderItems.fishProduct', 'name sku');
    } else {
      order = await Order.findById(orderId)
        .populate('user', 'name email phone')
        .populate('orderItems.product', 'name sku');
    }

    if (!order) {
      throw new Error('Order not found');
    }

    // Prepare invoice data
    const invoiceData = orderType === 'fish'
      ? prepareFishOrderInvoiceData(order)
      : prepareOrderInvoiceData(order);

    const company = getCompanyInfo();

    // Generate HTML
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${invoiceData.invoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Helvetica', Arial, sans-serif;
      color: #333;
      line-height: 1.6;
      padding: 40px;
      background: #f5f5f5;
    }
    .invoice-container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      box-shadow: 0 0 10px rgba(0,0,0,0.1);
    }
    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid #eee;
    }
    .company-info h1 {
      font-size: 24px;
      margin-bottom: 10px;
      color: #2c3e50;
    }
    .company-info p {
      font-size: 12px;
      color: #666;
      margin: 5px 0;
    }
    .invoice-info {
      text-align: right;
    }
    .invoice-info h2 {
      font-size: 20px;
      margin-bottom: 10px;
      color: #2c3e50;
    }
    .invoice-info p {
      font-size: 12px;
      color: #666;
      margin: 3px 0;
    }
    .customer-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
    }
    .customer-box, .shipping-box {
      flex: 1;
      margin-right: 20px;
    }
    .customer-box h3, .shipping-box h3 {
      font-size: 14px;
      margin-bottom: 10px;
      color: #2c3e50;
      border-bottom: 1px solid #eee;
      padding-bottom: 5px;
    }
    .customer-box p, .shipping-box p {
      font-size: 12px;
      color: #666;
      margin: 5px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    table th {
      background: #f8f9fa;
      padding: 12px;
      text-align: left;
      font-size: 12px;
      font-weight: bold;
      border-bottom: 2px solid #ddd;
    }
    table td {
      padding: 12px;
      font-size: 12px;
      border-bottom: 1px solid #eee;
    }
    table th:last-child, table td:last-child {
      text-align: right;
    }
    .summary {
      margin-left: auto;
      width: 300px;
      margin-top: 20px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      font-size: 12px;
    }
    .summary-row.total {
      font-size: 14px;
      font-weight: bold;
      border-top: 2px solid #ddd;
      padding-top: 10px;
      margin-top: 10px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #eee;
      text-align: center;
      font-size: 11px;
      color: #666;
    }
    .status-info {
      margin-top: 20px;
      font-size: 12px;
      color: #666;
    }
    .status-info p {
      margin: 5px 0;
    }
    @media print {
      body { background: white; padding: 0; }
      .invoice-container { box-shadow: none; padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="header">
      <div class="company-info">
        <h1>${company.name}</h1>
        <p>${company.address}</p>
        <p>${company.city}</p>
        <p>Phone: ${company.phone}</p>
        <p>Email: ${company.email}</p>
        ${company.website ? `<p>Website: ${company.website}</p>` : ''}
      </div>
      <div class="invoice-info">
        <h2>INVOICE</h2>
        <p><strong>Invoice #:</strong> ${invoiceData.invoiceNumber}</p>
        <p><strong>Order #:</strong> ${orderType === 'fish' ? `FISH-${invoiceData.orderNumber}` : invoiceData.orderNumber}</p>
        <p><strong>Date:</strong> ${formatDate(invoiceData.orderDate)}</p>
      </div>
    </div>

    <div class="customer-section">
      <div class="customer-box">
        <h3>Bill To:</h3>
        <p><strong>${invoiceData.customerName}</strong></p>
        <p>Phone: ${invoiceData.customerPhone}</p>
        ${invoiceData.customerEmail ? `<p>Email: ${invoiceData.customerEmail}</p>` : ''}
      </div>
      <div class="shipping-box">
        <h3>Ship To:</h3>
        <p><strong>${invoiceData.shippingAddress.name || invoiceData.customerName}</strong></p>
        <p>${invoiceData.shippingAddress.address}</p>
        ${invoiceData.shippingAddress.district ? `<p>${invoiceData.shippingAddress.district}${invoiceData.shippingAddress.upazila ? `, ${invoiceData.shippingAddress.upazila}` : ''}</p>` : ''}
        ${invoiceData.shippingAddress.division ? `<p>${invoiceData.shippingAddress.division}</p>` : ''}
        ${invoiceData.shippingAddress.postalCode ? `<p>Postal Code: ${invoiceData.shippingAddress.postalCode}</p>` : ''}
        <p>Phone: ${invoiceData.shippingAddress.phone}</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th>SKU</th>
          <th style="text-align: right;">Qty</th>
          <th style="text-align: center;">Unit</th>
          <th style="text-align: right;">Unit Price</th>
          <th style="text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${invoiceData.items.map(item => `
          <tr>
            <td>${item.name}</td>
            <td>${item.sku || 'N/A'}</td>
            <td style="text-align: right;">${item.quantity}</td>
            <td style="text-align: center;">${item.unit}</td>
            <td style="text-align: right;">${formatCurrency(item.unitPrice)}</td>
            <td style="text-align: right;">${formatCurrency(item.total)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="summary">
      <div class="summary-row">
        <span>Subtotal:</span>
        <span>${formatCurrency(invoiceData.subtotal)}</span>
      </div>
      <div class="summary-row">
        <span>Shipping Fee:</span>
        <span>${formatCurrency(invoiceData.shippingFee)}</span>
      </div>
      <div class="summary-row total">
        <span>Total:</span>
        <span>${formatCurrency(invoiceData.total)}</span>
      </div>
    </div>

    <div class="status-info">
      <p><strong>Payment Method:</strong> ${invoiceData.paymentMethod}</p>
      <p><strong>Payment Status:</strong> ${invoiceData.paymentStatus.toUpperCase()}</p>
      <p><strong>Order Status:</strong> ${invoiceData.orderStatus.toUpperCase()}</p>
      ${invoiceData.shippingZone ? `<p><strong>Shipping Zone:</strong> ${invoiceData.shippingZone === 'inside_dhaka' ? 'Inside Dhaka' : 'Outside Dhaka'}</p>` : ''}
    </div>

    <div class="footer">
      <p><strong>Thank you for your business!</strong></p>
      <p>For any queries, please contact us at the above address or email.</p>
      <p>This is a computer-generated invoice and does not require a signature.</p>
    </div>
  </div>
</body>
</html>
    `;

    return html;
  } catch (error) {
    throw error;
  }
};

