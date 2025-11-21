# Prokrishi Backend API

Modern e-commerce backend API built with Node.js, Express, and MongoDB.

> **Deployment:** Automated deployment via GitHub Actions to Digital Ocean droplet.  
> **Last Updated:** $(date +%Y-%m-%d)

## 🚀 Quick Start

### Local Development

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Set Up Environment Variables**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

4. **Access API**
   - API Root: `http://localhost:3500`
   - Health Check: `http://localhost:3500/health`
   - API Endpoints: `http://localhost:3500/api/*`

### Production Deployment

**Deploy to Render**: See [RENDER_DEPLOYMENT.md](./RENDER_DEPLOYMENT.md) for detailed instructions.

Quick deploy:
1. Push code to GitHub
2. Connect to Render
3. Set environment variables
4. Deploy!

## 📚 Documentation

- **[Render Deployment Guide](./RENDER_DEPLOYMENT.md)** - Complete Render deployment instructions
- **[Main Deployment Guide](../DEPLOYMENT_GUIDE.md)** - Full deployment guide (Backend + Frontend)
- **[Environment Variables](./env.production.example)** - Production environment template

## 🔧 Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB (with Mongoose)
- **Authentication**: JWT (Access + Refresh tokens)
- **File Upload**: Cloudinary
- **Payment**: SSL Commerz
- **Caching**: Redis (optional)
- **Logging**: Winston
- **Security**: Helmet, Rate limiting

## 📁 Project Structure

```
backend/
├── config/           # Database and configuration
├── controllers/      # Route controllers
├── middlewares/      # Auth, validation, security
├── models/          # Mongoose models
├── routes/          # API routes
├── services/        # Business logic (cache, logger)
├── utils/           # Helper functions
├── index.js         # Entry point
└── package.json     # Dependencies
```

## 🔑 Environment Variables

### Required

```bash
NODE_ENV=production
PORT=10000
MONGODB_URI=<your-mongodb-connection-string>
JWT_SECRET=<32-character-random-string>
JWT_REFRESH_SECRET=<32-character-random-string>
COOKIE_SECRET=<32-character-random-string>
CLOUDINARY_CLOUD_NAME=<your-cloud-name>
CLOUDINARY_API_KEY=<your-api-key>
CLOUDINARY_API_SECRET=<your-api-secret>
CORS_ORIGIN=<your-frontend-url>
FRONTEND_URL=<your-frontend-url>
BACKEND_URL=<your-backend-url>
```

### Optional

```bash
SSL_STORE_ID=<ssl-commerz-store-id>
SSL_STORE_PASSWORD=<ssl-commerz-password>
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=<your-email>
EMAIL_PASS=<your-email-password>
REDIS_URL=<redis-connection-string>
```

See [env.production.example](./env.production.example) for complete list.

## 🛠️ API Endpoints

### User Management
- `POST /api/user/register` - Register new user
- `POST /api/user/login` - User login
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update profile
- `POST /api/user/logout` - User logout
- `POST /api/user/forgot-password` - Request password reset
- `POST /api/user/reset-password` - Reset password

### Products
- `GET /api/product` - List all products (with pagination)
- `GET /api/product/:id` - Get single product
- `POST /api/product` - Create product (admin)
- `PUT /api/product/:id` - Update product (admin)
- `DELETE /api/product/:id` - Delete product (admin)
- `GET /api/product/search` - Search products

### Categories
- `GET /api/category` - List all categories
- `GET /api/category/:id` - Get single category
- `POST /api/category` - Create category (admin)
- `PUT /api/category/:id` - Update category (admin)
- `DELETE /api/category/:id` - Delete category (admin)

### Cart
- `GET /api/cart` - Get user cart
- `POST /api/cart` - Add item to cart
- `PUT /api/cart/:id` - Update cart item
- `DELETE /api/cart/:id` - Remove cart item
- `DELETE /api/cart/clear` - Clear cart

### Orders
- `GET /api/order` - List user orders
- `GET /api/order/:id` - Get order details
- `POST /api/order` - Create new order
- `PUT /api/order/:id` - Update order status (admin)
- `GET /api/order/admin/all` - List all orders (admin)

### Payment
- `POST /api/payment/init` - Initialize payment
- `POST /api/payment/success` - Payment success callback
- `POST /api/payment/fail` - Payment failure callback
- `POST /api/payment/cancel` - Payment cancellation callback

### Dashboard (Admin)
- `GET /api/dashboard/stats` - Get dashboard statistics
- `GET /api/dashboard/revenue` - Get revenue data
- `GET /api/dashboard/recent-orders` - Get recent orders
- `GET /api/dashboard/top-products` - Get top selling products

## 🔒 Security Features

- **Rate Limiting**: Prevents brute force attacks
- **Helmet**: Security headers
- **CORS**: Restricted to frontend domain
- **Input Sanitization**: XSS protection
- **JWT Authentication**: Secure token-based auth
- **Password Hashing**: bcrypt encryption
- **Request Logging**: All requests logged

## 📊 Performance Features

- **Compression**: gzip compression enabled
- **Database Indexing**: Optimized queries
- **Redis Caching**: Optional caching layer
- **Connection Pooling**: MongoDB connection management
- **Query Optimization**: Lean queries and projections

## 🧪 Testing

```bash
# Test health endpoint
curl http://localhost:3500/health

# Test API endpoint
curl http://localhost:3500/api/product

# Test with authentication
curl -H "Authorization: Bearer <token>" http://localhost:3500/api/user/profile
```

## 📝 Scripts

```bash
# Development with hot reload
npm run dev

# Production start
npm start

# Check dependencies
npm list

# Update dependencies
npm update
```

## 🐛 Debugging

### View Logs

Logs are stored in `logs/` directory:
- `combined.log` - All logs
- `error.log` - Error logs only

### Common Issues

**Database connection failed**
- Check MongoDB connection string
- Verify database credentials
- Ensure IP whitelist includes your IP

**Image upload fails**
- Verify Cloudinary credentials
- Check image size (max 10MB)
- Ensure Cloudinary storage not full

**CORS errors**
- Verify `CORS_ORIGIN` matches frontend URL
- Ensure no trailing slashes in URLs
- Check frontend credentials setting

## 🚨 Production Checklist

- [ ] Environment variables set correctly
- [ ] MongoDB Atlas configured
- [ ] Cloudinary configured
- [ ] JWT secrets are strong (32+ characters)
- [ ] CORS origin matches frontend URL
- [ ] SSL certificate enabled (automatic on Render)
- [ ] Rate limiting configured
- [ ] Error logging enabled
- [ ] Health check endpoint working

## 📖 Additional Resources

- [Express.js Documentation](https://expressjs.com/)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [Mongoose Documentation](https://mongoosejs.com/)
- [JWT Best Practices](https://jwt.io/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## 📄 License

ISC License

## 🆘 Support

For deployment issues, see:
- [RENDER_DEPLOYMENT.md](./RENDER_DEPLOYMENT.md)
- [Main Deployment Guide](../DEPLOYMENT_GUIDE.md)

For technical issues, check the logs or create an issue.

---

**Ready to deploy?** Follow the [Render Deployment Guide](./RENDER_DEPLOYMENT.md) to get started!

