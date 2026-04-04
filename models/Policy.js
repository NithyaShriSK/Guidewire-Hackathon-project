const mongoose = require('mongoose');

const policySchema = new mongoose.Schema({
  workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
  policyNumber: { type: String, required: true, unique: true },
  policyType: { type: String, enum: ['weekly', 'monthly', 'annual'], default: 'weekly' },
  
  coverage: {
    coveredRisks: [{
      type: { type: String, enum: ['extreme_weather', 'high_pollution', 'traffic_congestion', 'civil_unrest'], required: true },
      isActive: { type: Boolean, default: true },
      thresholds: {
        weather: {
          rainfall: { type: Number, default: 15 }, // mm/hr
          windSpeed: { type: Number, default: 50 }, // km/hr
          temperature: { type: Number, default: 45 } // °C
        },
        pollution: {
          aqi: { type: Number, default: 400 },
          pm25: { type: Number, default: 250 }
        },
        traffic: {
          congestionLevel: { type: Number, default: 8 }, // 1-10 scale
          averageSpeed: { type: Number, default: 5 } // km/hr
        },
        civilUnrest: {
          severity: { type: Number, default: 7 } // 1-10 scale
        }
      }
    }],
    maxPayoutPerClaim: { type: Number, required: true },
    maxPayoutPerWeek: { type: Number, required: true },
    deductible: { type: Number, default: 0 },
    coverageHours: {
      start: { type: String, required: true }, // "09:00"
      end: { type: String, required: true }     // "18:00"
    },
    coverageZones: [{
      name: { type: String, required: true },
      coordinates: {
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true },
        radius: { type: Number, required: true } // km
      }
    }]
  },
  
  premium: {
    baseAmount: { type: Number, required: true },
    riskAdjustedAmount: { type: Number, required: true },
    finalAmount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    paymentFrequency: { type: String, enum: ['weekly', 'monthly'], default: 'weekly' },
    nextPaymentDue: { type: Date, required: true },
    gracePeriodDays: { type: Number, default: 3 },
    discounts: [{
      type: { type: String, enum: ['no_claims', 'loyalty', 'referral', 'promotional'] },
      percentage: { type: Number },
      validUntil: { type: Date }
    }]
  },
  
  status: {
    current: { type: String, enum: ['active', 'inactive', 'expired', 'suspended', 'pending'], default: 'pending' },
    activatedAt: { type: Date },
    expiresAt: { type: Date },
    lastPaymentAt: { type: Date },
    renewalCount: { type: Number, default: 0 }
  },
  
  claims: {
    totalClaims: { type: Number, default: 0 },
    approvedClaims: { type: Number, default: 0 },
    rejectedClaims: { type: Number, default: 0 },
    pendingClaims: { type: Number, default: 0 },
    totalPayoutAmount: { type: Number, default: 0 },
    lastClaimDate: { type: Date }
  },
  
  monitoring: {
    isActive: { type: Boolean, default: true },
    lastMonitoredAt: { type: Date },
    monitoringZones: [{
      coordinates: { latitude: Number, longitude: Number },
      radius: Number,
      priority: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' }
    }],
    apiEndpoints: {
      weather: { type: String, default: 'openweather' },
      pollution: { type: String, default: 'openaq' },
      traffic: { type: String, default: 'google' }
    }
  },
  
  fraudDetection: {
    riskScore: { type: Number, default: 0 }, // 0-1 scale
    lastAssessment: { type: Date },
    flags: [{
      type: { type: String, enum: ['gps_spoofing', 'multiple_claims', 'unusual_pattern', 'api_mismatch'] },
      severity: { type: String, enum: ['low', 'medium', 'high'] },
      description: { type: String },
      timestamp: { type: Date, default: Date.now },
      resolved: { type: Boolean, default: false }
    }],
    manualReviewRequired: { type: Boolean, default: false }
  },
  
  metadata: {
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    version: { type: Number, default: 1 },
    termsAcceptedAt: { type: Date },
    ipAddress: { type: String },
    deviceFingerprint: { type: String }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
policySchema.index({ workerId: 1 });
policySchema.index({ policyNumber: 1 });
policySchema.index({ 'status.current': 1 });
policySchema.index({ 'premium.nextPaymentDue': 1 });
policySchema.index({ 'fraudDetection.riskScore': 1 });
policySchema.index({ 'metadata.createdAt': -1 });

// Virtual for days until expiry
policySchema.virtual('daysUntilExpiry').get(function() {
  if (!this.status.expiresAt) return null;
  const today = new Date();
  const expiryDate = new Date(this.status.expiresAt);
  const diffTime = expiryDate - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for isExpired
policySchema.virtual('isExpired').get(function() {
  return this.status.expiresAt && new Date() > this.status.expiresAt;
});

// Pre-save middleware
policySchema.pre('save', function(next) {
  this.metadata.updatedAt = new Date();
  
  // Update policy number if not set
  if (!this.policyNumber) {
    this.policyNumber = `GS-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  }
  
  next();
});

// Static method to find active policies
policySchema.statics.findActive = function(workerId) {
  return this.find({
    workerId: workerId,
    'status.current': 'active',
    'status.expiresAt': { $gt: new Date() }
  });
};

// Static method to find policies due for payment
policySchema.statics.findDueForPayment = function() {
  const today = new Date();
  const gracePeriodEnd = new Date(today.getTime() + (3 * 24 * 60 * 60 * 1000)); // 3 days grace period
  
  return this.find({
    'premium.nextPaymentDue': { $lte: gracePeriodEnd },
    'status.current': { $in: ['active', 'pending'] }
  });
};

module.exports = mongoose.model('Policy', policySchema);
