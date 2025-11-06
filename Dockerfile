# Dockerfile for Prokrishi Backend
# Optional: Use if you want to containerize the application

FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies first (for better caching)
COPY package*.json ./
RUN npm ci --production && npm cache clean --force

# Copy application files
COPY . .

# Create logs directory
RUN mkdir -p logs

# Expose port
EXPOSE 3500

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3500/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "index.js"]

