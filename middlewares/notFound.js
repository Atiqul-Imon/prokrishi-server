import logger from '../services/logger.js';

/**
 * 404 Not Found middleware
 * Handles requests to non-existent routes
 */
export const notFoundHandler = (req, res, next) => {
  const error = {
    message: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
  };

  // Log the 404 error
  logger.warn('404 Not Found', error);

  // Set appropriate headers
  res.status(404);
  res.set({
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });

  // Return structured error response
  res.json({
    success: false,
    error: true,
    message: 'The requested resource was not found',
    details: {
      path: req.originalUrl,
      method: req.method,
      timestamp: new Date().toISOString(),
      requestId: req.id || 'unknown'
    },
    suggestions: {
      checkUrl: 'Verify the URL is correct',
      checkMethod: 'Ensure you are using the correct HTTP method',
      documentation: 'Refer to API documentation for available endpoints',
      support: 'Contact support if you believe this is an error'
    },
    availableEndpoints: {
      products: '/api/product',
      categories: '/api/category',
      users: '/api/user',
      orders: '/api/order',
      cart: '/api/cart',
      dashboard: '/api/dashboard',
      health: '/health'
    }
  });
};

/**
 * API-specific 404 handler for better API responses
 */
export const apiNotFoundHandler = (req, res) => {
  const error = {
    message: 'API endpoint not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
  };

  // Log the API 404 error
  logger.warn('API 404 Not Found', error);

  // Set appropriate headers
  res.status(404);
  res.set({
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });

  // Return API-specific error response
  res.json({
    success: false,
    error: true,
    message: 'API endpoint not found',
    code: 'ENDPOINT_NOT_FOUND',
    details: {
      path: req.originalUrl,
      method: req.method,
      timestamp: new Date().toISOString(),
      requestId: req.id || 'unknown'
    },
    availableEndpoints: {
      products: {
        list: 'GET /api/product',
        create: 'POST /api/product',
        get: 'GET /api/product/:id',
        update: 'PUT /api/product/:id',
        delete: 'DELETE /api/product/:id'
      },
      categories: {
        list: 'GET /api/category',
        create: 'POST /api/category',
        get: 'GET /api/category/:id',
        update: 'PUT /api/category/:id',
        delete: 'DELETE /api/category/:id'
      },
      users: {
        profile: 'GET /api/user/profile',
        update: 'PUT /api/user/profile',
        login: 'POST /api/user/login',
        register: 'POST /api/user/register'
      },
      orders: {
        list: 'GET /api/order',
        create: 'POST /api/order',
        get: 'GET /api/order/:id',
        update: 'PUT /api/order/:id'
      },
      cart: {
        get: 'GET /api/cart',
        add: 'POST /api/cart',
        update: 'PUT /api/cart/:id',
        delete: 'DELETE /api/cart/:id'
      },
      dashboard: {
        stats: 'GET /api/dashboard/stats',
        products: 'GET /api/dashboard/products',
        orders: 'GET /api/dashboard/orders'
      }
    },
    documentation: {
      baseUrl: process.env.API_BASE_URL || 'http://localhost:3500',
      version: '1.0.0',
      contact: 'support@prokrishi.com'
    }
  });
};

/**
 * Resource-specific 404 handler
 */
export const resourceNotFoundHandler = (resource, id) => {
  return (req, res) => {
    const error = {
      message: `${resource} not found`,
      resource,
      id: req.params.id,
      path: req.originalUrl,
      method: req.method,
      timestamp: new Date().toISOString(),
      ip: req.ip || req.connection.remoteAddress,
    };

    // Log the resource not found error
    logger.warn(`${resource} not found`, error);

    // Set appropriate headers
    res.status(404);
    res.set({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    // Return resource-specific error response
    res.json({
      success: false,
      error: true,
      message: `${resource} not found`,
      code: 'RESOURCE_NOT_FOUND',
      details: {
        resource,
        id: req.params.id,
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString(),
        requestId: req.id || 'unknown'
      },
      suggestions: {
        checkId: 'Verify the ID is correct and exists',
        checkPermissions: 'Ensure you have access to this resource',
        listResources: `Use GET /api/${resource.toLowerCase()} to list available resources`,
        contactSupport: 'Contact support if you believe this is an error'
      }
    });
  };
};
