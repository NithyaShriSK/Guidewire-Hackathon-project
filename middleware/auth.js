const jwt = require('jsonwebtoken');
const { Worker, Admin } = require('../models');

// Generate JWT token
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

// Verify JWT token
const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

// Worker authentication middleware
const authenticateWorker = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access denied. No token provided.' 
      });
    }

    const decoded = verifyToken(token);
    const worker = await Worker.findById(decoded.id).select('-security.password');
    
    if (!worker) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token. Worker not found.' 
      });
    }

    if (worker.status.accountStatus !== 'active') {
      return res.status(401).json({ 
        success: false, 
        message: 'Account is not active.' 
      });
    }

    // Check if account is locked
    if (worker.security.lockUntil && worker.security.lockUntil > Date.now()) {
      return res.status(423).json({ 
        success: false, 
        message: 'Account is temporarily locked.' 
      });
    }

    req.worker = worker;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token.' 
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token expired.' 
      });
    }
    res.status(500).json({ 
      success: false, 
      message: 'Server error in authentication.' 
    });
  }
};

// Admin authentication middleware
const authenticateAdmin = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access denied. No token provided.' 
      });
    }

    const decoded = verifyToken(token);
    const admin = await Admin.findById(decoded.id).select('-security.password');
    
    if (!admin) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token. Admin not found.' 
      });
    }

    if (!admin.status.isActive) {
      return res.status(401).json({ 
        success: false, 
        message: 'Admin account is not active.' 
      });
    }

    // Check if admin is on leave
    if (admin.status.onLeaveUntil && admin.status.onLeaveUntil > Date.now()) {
      return res.status(401).json({ 
        success: false, 
        message: 'Admin is currently on leave.' 
      });
    }

    // Check if account is locked
    if (admin.security.lockUntil && admin.security.lockUntil > Date.now()) {
      return res.status(423).json({ 
        success: false, 
        message: 'Account is temporarily locked.' 
      });
    }

    req.admin = admin;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token.' 
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token expired.' 
      });
    }
    res.status(500).json({ 
      success: false, 
      message: 'Server error in authentication.' 
    });
  }
};

// Permission-based authorization middleware
const authorize = (permissions) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Admin authentication required.' 
      });
    }

    const hasPermission = permissions.every(permission => 
      req.admin.role.permissions.includes(permission)
    );

    if (!hasPermission) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Insufficient permissions.' 
      });
    }

    next();
  };
};

// Role-based authorization middleware
const authorizeRole = (roles) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Admin authentication required.' 
      });
    }

    if (!roles.includes(req.admin.role.type)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Insufficient role privileges.' 
      });
    }

    next();
  };
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      const decoded = verifyToken(token);
      
      // Try to find worker first
      let user = await Worker.findById(decoded.id).select('-security.password');
      if (user) {
        req.worker = user;
        req.userType = 'worker';
        return next();
      }
      
      // Try to find admin
      user = await Admin.findById(decoded.id).select('-security.password');
      if (user) {
        req.admin = user;
        req.userType = 'admin';
        return next();
      }
    }
    
    next();
  } catch (error) {
    // If token is invalid, just continue without authentication
    next();
  }
};

module.exports = {
  generateToken,
  verifyToken,
  authenticateWorker,
  authenticateAdmin,
  authorize,
  authorizeRole,
  optionalAuth
};
