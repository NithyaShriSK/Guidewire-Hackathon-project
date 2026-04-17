const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const app = express();

const defaultAllowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'https://yourdomain.com'
];

const configuredOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
  : defaultAllowedOrigins;

// Configure trust proxy so rate limiting can correctly read client IP behind Docker/reverse proxies.
const trustProxyValue = process.env.TRUST_PROXY;
if (trustProxyValue !== undefined) {
  if (trustProxyValue === 'true') {
    app.set('trust proxy', true);
  } else if (trustProxyValue === 'false') {
    app.set('trust proxy', false);
  } else {
    const numericTrustProxy = Number(trustProxyValue);
    app.set('trust proxy', Number.isNaN(numericTrustProxy) ? trustProxyValue : numericTrustProxy);
  }
} else if (process.env.NODE_ENV === 'development') {
  app.set('trust proxy', 1);
}

// Security middleware
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests without an Origin header.
    if (!origin) {
      return callback(null, true);
    }

    if (configuredOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files from client build
app.use(express.static(path.join(__dirname, 'client/build')));

// Database connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Import routes
const authRoutes = require('./routes/auth');
const workerRoutes = require('./routes/workers');
const policyRoutes = require('./routes/policies');
const claimRoutes = require('./routes/claims');
const monitoringRoutes = require('./routes/monitoring');
const adminRoutes = require('./routes/admin');
const simulationRoutes = require('./routes/simulation');
const autonomousEngineService = require('./services/autonomousEngineService');

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/policies', policyRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/simulation', simulationRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!', 
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  autonomousEngineService.start().catch((error) => {
    console.error('Failed to start autonomous engine:', error);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  autonomousEngineService.stop();
  server.close(() => {
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});

module.exports = app;
