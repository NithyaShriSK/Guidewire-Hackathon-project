const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  personalInfo: {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    phone: { type: String, required: true },
    employeeId: { type: String, required: true, unique: true }
  },
  
  role: {
    type: { type: String, enum: ['super_admin', 'claims_manager', 'risk_analyst', 'support_agent', 'auditor'], required: true },
    permissions: [{
      type: String,
      enum: [
        'view_workers', 'edit_workers', 'delete_workers',
        'view_policies', 'edit_policies', 'delete_policies',
        'view_claims', 'approve_claims', 'reject_claims', 'investigate_claims',
        'view_analytics', 'export_reports', 'manage_system',
        'view_admins', 'edit_admins', 'delete_admins'
      ]
    }],
    department: { type: String, enum: ['operations', 'risk', 'finance', 'technology', 'compliance'] }
  },
  
  security: {
    password: { type: String, required: true },
    lastLogin: { type: Date },
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String },
    deviceFingerprints: [{ type: String }],
    ipWhitelist: [{ type: String }],
    sessionTimeout: { type: Number, default: 30 } // minutes
  },
  
  activity: {
    lastActivity: { type: Date, default: Date.now },
    totalLogins: { type: Number, default: 0 },
    actionsPerformed: [{
      action: { type: String, required: true },
      resource: { type: String, required: true },
      resourceId: { type: mongoose.Schema.Types.ObjectId },
      timestamp: { type: Date, default: Date.now },
      ipAddress: { type: String },
      userAgent: { type: String },
      details: { type: mongoose.Schema.Types.Mixed }
    }],
    notifications: [{
      type: { type: String, enum: ['info', 'warning', 'error', 'success'], required: true },
      title: { type: String, required: true },
      message: { type: String, required: true },
      read: { type: Boolean, default: false },
      timestamp: { type: Date, default: Date.now },
      actionRequired: { type: Boolean, default: false }
    }]
  },
  
  preferences: {
    dashboardLayout: { type: String, enum: ['compact', 'standard', 'detailed'], default: 'standard' },
    timezone: { type: String, default: 'Asia/Kolkata' },
    language: { type: String, default: 'en' },
    emailNotifications: { type: Boolean, default: true },
    smsNotifications: { type: Boolean, default: false },
    theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'light' }
  },
  
  status: {
    isActive: { type: Boolean, default: true },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
    onLeaveUntil: { type: Date },
    joinedAt: { type: Date, default: Date.now }
  },
  
  metadata: {
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
adminSchema.index({ 'personalInfo.email': 1 });
adminSchema.index({ 'personalInfo.employeeId': 1 });
adminSchema.index({ 'role.type': 1 });
adminSchema.index({ 'status.isActive': 1 });
adminSchema.index({ 'activity.lastActivity': -1 });
adminSchema.index({ 'metadata.createdAt': -1 });

// Virtual for full name
adminSchema.virtual('personalInfo.fullName').get(function() {
  return `${this.personalInfo.firstName} ${this.personalInfo.lastName}`;
});

// Virtual for isLocked
adminSchema.virtual('security.isLocked').get(function() {
  return !!(this.security.lockUntil && this.security.lockUntil > Date.now());
});

// Virtual for unread notifications count
adminSchema.virtual('activity.unreadNotificationsCount').get(function() {
  return this.activity.notifications.filter(n => !n.read).length;
});

// Pre-save middleware
adminSchema.pre('save', function(next) {
  this.metadata.updatedAt = new Date();
  this.activity.lastActivity = new Date();
  next();
});

// Static method to find by email
adminSchema.statics.findByEmail = function(email) {
  return this.findOne({ 'personalInfo.email': email.toLowerCase() });
};

// Static method to find active admins
adminSchema.statics.findActive = function() {
  return this.find({ 
    'status.isActive': true,
    'status.onLeaveUntil': { $lte: new Date() }
  });
};

// Static method to find admins by role
adminSchema.statics.findByRole = function(roleType) {
  return this.find({ 
    'role.type': roleType,
    'status.isActive': true
  });
};

module.exports = mongoose.model('Admin', adminSchema);
