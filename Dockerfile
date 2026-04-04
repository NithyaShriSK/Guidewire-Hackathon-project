# Use Node.js 18 LTS as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy backend source code
COPY . .

# Create client directory and copy client package files
RUN mkdir -p client
COPY client/package*.json ./client/

# Install client dependencies
WORKDIR /app/client
RUN npm ci --only=production

# Copy client source code
COPY . .

# Build the React app
RUN npm run build

# Go back to root directory
WORKDIR /app

# Create a non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S gigshield -u 1001

# Change ownership of the app directory
RUN chown -R gigshield:nodejs /app
USER gigshield

# Expose the port the app runs on
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Start the application
CMD ["npm", "start"]
