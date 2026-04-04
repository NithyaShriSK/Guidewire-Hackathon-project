const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema({
  claimNumber: { type: String, required: true, unique: true },
  policyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Policy', required: true },
  workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
  
  trigger: {
    type: { type: String, enum: ['extreme_weather', 'high_pollution', 'traffic_congestion', 'civil_unrest'], required: true },
    timestamp: { type: Date, required: true },
    location: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      address: { type: String }
    },
    detectedValues: {
      weather: {
        rainfall: Number, // mm/hr
        windSpeed: Number, // km/hr
        temperature: Number, // °C
        humidity: Number,
        visibility: Number
      },
      pollution: {
        aqi: Number,
        pm25: Number,
        pm10: Number,
        no2: Number,
        so2: Number,
        co: Number
      },
      traffic: {
        congestionLevel: Number, // 1-10 scale
        averageSpeed: Number, // km/hr
        incidentType: String,
        estimatedDelay: Number // minutes
      },
      civilUnrest: {
        severity: Number, // 1-10 scale
        type: String, // protest, strike, curfew, etc.
        affectedArea: String
      }
    },
    thresholds: {
      weather: {
        rainfall: Number,
        windSpeed: Number,
        temperature: Number
      },
      pollution: {
        aqi: Number,
        pm25: Number
      },
      traffic: {
        congestionLevel: Number,
        averageSpeed: Number
      },
      civilUnrest: {
        severity: Number
      }
    }
  },
  
  validation: {
    apiSources: [{
      name: { type: String, required: true }, // openweather, openaq, google, etc.
      data: { type: mongoose.Schema.Types.Mixed },
      timestamp: { type: Date, required: true },
      matchesTrigger: { type: Boolean, required: true },
      confidence: { type: Number, min: 0, max: 1 } // 0-1 confidence score
    }],
    consensusScore: { type: Number, min: 0, max: 1 }, // Agreement between APIs
    gpsValidation: {
      workerLocationAtTime: {
        latitude: Number,
        longitude: Number,
        timestamp: Date
      },
      isLocationValid: { type: Boolean },
      distanceFromTrigger: Number // meters
    },
    activityValidation: {
      platformActivity: [{
        platform: String,
        lastScanTime: Date,
        activeDeliveries: Number,
        isWorking: Boolean
      }],
      isActivityConsistent: { type: Boolean }
    }
  },
  
  financial: {
    estimatedLoss: {
      workingHoursLost: { type: Number, required: true }, // hours
      hourlyRate: { type: Number, required: true }, // INR per hour
      totalLoss: { type: Number, required: true } // INR
    },
    payoutAmount: { type: Number, required: true },
    payoutCurrency: { type: String, default: 'INR' },
    payoutMethod: { type: String, enum: ['upi', 'bank_transfer'], default: 'upi' },
    payoutStatus: { type: String, enum: ['pending', 'processing', 'completed', 'failed', 'rejected'], default: 'pending' },
    payoutTransactionId: { type: String },
    payoutProcessedAt: { type: Date },
    payoutFailureReason: { type: String }
  },
  
  status: {
    current: { type: String, enum: ['initiated', 'validating', 'approved', 'rejected', 'paid', 'under_review'], default: 'initiated' },
    initiatedAt: { type: Date, default: Date.now },
    validatedAt: { type: Date },
    approvedAt: { type: Date },
    rejectedAt: { type: Date },
    paidAt: { type: Date },
    processingTime: { type: Number } // milliseconds from initiation to completion
  },
  
  fraud: {
    riskScore: { type: Number, default: 0 }, // 0-1 scale
    flags: [{
      type: { type: String, enum: ['gps_spoofing', 'api_mismatch', 'unusual_pattern', 'multiple_claims', 'activity_inconsistency'] },
      severity: { type: String, enum: ['low', 'medium', 'high'] },
      description: { type: String },
      score: { type: Number }, // contribution to total risk score
      timestamp: { type: Date, default: Date.now }
    }],
    manualReviewRequired: { type: Boolean, default: false },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    reviewNotes: { type: String },
    reviewDecision: { type: String, enum: ['approve', 'reject', 'investigate'] }
  },
  
  audit: {
    ipAddress: { type: String },
    deviceFingerprint: { type: String },
    userAgent: { type: String },
    apiEndpointsCalled: [{
      endpoint: String,
      timestamp: Date,
      responseTime: Number,
      statusCode: Number
    }],
    decisionLogic: {
      triggeredBy: String, // which rule/condition triggered the claim
      confidenceLevel: Number,
      automatedDecision: String,
      humanOverride: Boolean
    }
  },
  
  metadata: {
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    version: { type: Number, default: 1 },
    source: { type: String, enum: ['automated', 'manual', 'api'], default: 'automated' }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
claimSchema.index({ claimNumber: 1 });
claimSchema.index({ policyId: 1 });
claimSchema.index({ workerId: 1 });
claimSchema.index({ 'status.current': 1 });
claimSchema.index({ 'trigger.timestamp': -1 });
claimSchema.index({ 'fraud.riskScore': 1 });
claimSchema.index({ 'payoutStatus': 1 });
claimSchema.index({ 'metadata.createdAt': -1 });

// Virtual for processing time in human readable format
claimSchema.virtual('processingTimeHuman').get(function() {
  if (!this.status.processingTime) return null;
  const seconds = Math.floor(this.status.processingTime / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
});

// Virtual for isHighRisk
claimSchema.virtual('isHighRisk').get(function() {
  return this.fraud.riskScore > 0.7;
});

// Pre-save middleware
claimSchema.pre('save', function(next) {
  this.metadata.updatedAt = new Date();
  
  // Generate claim number if not set
  if (!this.claimNumber) {
    this.claimNumber = `CLM-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  }
  
  // Calculate processing time if claim is completed
  if (this.status.paidAt && this.status.initiatedAt) {
    this.status.processingTime = this.status.paidAt.getTime() - this.status.initiatedAt.getTime();
  }
  
  next();
});

// Static method to find pending claims
claimSchema.statics.findPending = function() {
  return this.find({
    'status.current': { $in: ['initiated', 'validating'] }
  });
};

// Static method to find high-risk claims
claimSchema.statics.findHighRisk = function() {
  return this.find({
    'fraud.riskScore': { $gt: 0.7 },
    'status.current': { $in: ['initiated', 'validating'] }
  });
};

// Static method to get claims by date range
claimSchema.statics.findByDateRange = function(startDate, endDate) {
  return this.find({
    'trigger.timestamp': {
      $gte: startDate,
      $lte: endDate
    }
  });
};

module.exports = mongoose.model('Claim', claimSchema);
