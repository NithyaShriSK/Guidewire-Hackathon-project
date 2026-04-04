const mongoose = require('mongoose');

const workerSchema = new mongoose.Schema({
  personalInfo: {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    phone: { type: String, required: true, unique: true },
    dateOfBirth: { type: Date, required: true },
    aadhaarNumber: { type: String, required: true, unique: true },
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
      coordinates: {
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true }
      }
    }
  },
  workInfo: {
    platforms: [{
      name: { type: String, enum: ['Amazon Flex', 'Swiggy', 'Zomato', 'Uber Eats', 'Dunzo'], required: true },
      workerId: { type: String, required: true },
      startDate: { type: Date, required: true },
      averageDailyEarnings: { type: Number, required: true },
      averageWeeklyHours: { type: Number, required: true }
    }],
    preferredWorkingZones: [{
      name: { type: String, required: true },
      coordinates: {
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true },
        radius: { type: Number, default: 5 } // km
      }
    }],
    typicalWorkingHours: {
      start: { type: String, required: true }, // "09:00"
      end: { type: String, required: true }   // "18:00"
    }
  },
  financialInfo: {
    upiId: { type: String, required: true },
    bankAccount: {
      accountNumber: { type: String, required: true },
      ifscCode: { type: String, required: true },
      accountHolderName: { type: String, required: true }
    },
    weeklyIncomeRange: {
      min: { type: Number, required: true },
      max: { type: Number, required: true }
    }
  },
  riskProfile: {
    baseRiskScore: { type: Number, default: 0.5 }, // 0-1 scale
    locationRiskFactors: {
      floodRisk: { type: Number, default: 0 },
      pollutionRisk: { type: Number, default: 0 },
      trafficRisk: { type: Number, default: 0 },
      civilUnrestRisk: { type: Number, default: 0 }
    },
    historicalClaims: {
      totalClaims: { type: Number, default: 0 },
      approvedClaims: { type: Number, default: 0 },
      rejectedClaims: { type: Number, default: 0 },
      totalPayoutAmount: { type: Number, default: 0 }
    },
    fraudIndicators: {
      suspiciousActivityCount: { type: Number, default: 0 },
      lastFlaggedDate: { type: Date },
      riskLevel: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Low' }
    }
  },
  verification: {
    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },
    isAadhaarVerified: { type: Boolean, default: false },
    isBankVerified: { type: Boolean, default: false },
    verificationDocuments: [{
      type: { type: String, enum: ['aadhaar', 'pan', 'bank', 'address'] },
      url: { type: String },
      uploadedAt: { type: Date, default: Date.now },
      status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
    }]
  },
  security: {
    password: { type: String, required: true },
    lastLogin: { type: Date },
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
    deviceFingerprints: [{ type: String }],
    ipAddresses: [{ type: String }]
  },
  status: {
    accountStatus: { type: String, enum: ['active', 'inactive', 'suspended', 'pending'], default: 'pending' },
    subscriptionStatus: { type: String, enum: ['active', 'inactive', 'expired'], default: 'inactive' },
    onboardingStep: { type: String, enum: ['personal', 'work', 'financial', 'verification', 'completed'], default: 'personal' }
  },
  metadata: {
    registeredAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    lastActiveAt: { type: Date, default: Date.now },
    lastActivityTime: { type: Date, default: Date.now },
    referralCode: { type: String, unique: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker' }
  },
  
  locationTracking: {
    currentLocation: {
      latitude: { type: Number },
      longitude: { type: Number },
      address: { type: String },
      city: { type: String },
      state: { type: String },
      lastUpdated: { type: Date }
    },
    workingRegion: { type: String }, // Current working region/zone
    isActive: { type: Boolean, default: false } // Active in work right now
  },
  
  premium: {
    planType: { type: String, enum: ['basic', 'medium', 'high'], default: 'basic' },
    weeklyAmount: { type: Number, default: 0 },
    weeklyCoverageLimit: { type: Number, default: 2000 },
    termsAcceptedAt: { type: Date },
    paymentHistory: [{
      weekNumber: { type: String }, // "2026-W14" (ISO week format)
      planType: { type: String, enum: ['basic', 'medium', 'high'] },
      amount: { type: Number },
      paymentDate: { type: Date },
      status: { type: String, enum: ['paid', 'pending', 'due', 'overdue'], default: 'pending' },
      paymentMethod: { type: String, enum: ['upi', 'bank_transfer', 'card', 'wallet'] },
      transactionId: { type: String },
      termsAcceptedAt: { type: Date }
    }],
    currentWeekPaid: { type: Boolean, default: false },
    nextPaymentDue: { type: Date },
    lastPaymentDate: { type: Date },
    totalPaid: { type: Number, default: 0 },
    missedPayments: { type: Number, default: 0 }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
workerSchema.index({ 'personalInfo.email': 1 });
workerSchema.index({ 'personalInfo.phone': 1 });
workerSchema.index({ 'workInfo.platforms.name': 1 });
workerSchema.index({ 'riskProfile.baseRiskScore': 1 });
workerSchema.index({ 'status.accountStatus': 1 });
workerSchema.index({ 'metadata.registeredAt': -1 });
workerSchema.index({ 'locationTracking.currentLocation': '2dsphere' }); // Geospatial
workerSchema.index({ 'locationTracking.isActive': 1 });
workerSchema.index({ 'premium.currentWeekPaid': 1 });
workerSchema.index({ 'metadata.lastActivityTime': -1 });

// Virtual for full name
workerSchema.virtual('personalInfo.fullName').get(function() {
  return `${this.personalInfo.firstName} ${this.personalInfo.lastName}`;
});

// Virtual for age
workerSchema.virtual('personalInfo.age').get(function() {
  const today = new Date();
  const birthDate = new Date(this.personalInfo.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
});

// Pre-save middleware
workerSchema.pre('save', function(next) {
  this.metadata.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Worker', workerSchema);
