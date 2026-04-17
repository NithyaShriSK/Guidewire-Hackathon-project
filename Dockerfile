# Use Node.js 20 LTS with Python support for ML inference
FROM node:20-bullseye-slim

# Install Python for the ML model scripts used by the backend
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip \
  && rm -rf /var/lib/apt/lists/*

# Install Python ML dependencies used by fraud and risk model scripts
RUN python3 -m pip install --no-cache-dir scikit-learn pandas joblib numpy

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install backend production dependencies.
# Use npm install instead of npm ci because lockfiles are not fully in sync.
RUN npm install --omit=dev --no-audit --no-fund

# Copy backend source code
COPY . .

# Create client directory and copy client package files
RUN mkdir -p client
COPY client/package*.json ./client/

# Install client dependencies needed for production build.
WORKDIR /app/client
RUN npm install --omit=dev --no-audit --no-fund

# Copy client source code
COPY . .

# Build the React app
RUN npm run build

# Go back to root directory
WORKDIR /app

# Create a non-root user
RUN groupadd -g 1001 nodejs
RUN useradd -m -u 1001 -g nodejs -s /usr/sbin/nologin gigshield

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
