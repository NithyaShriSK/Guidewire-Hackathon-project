const mongoose = require('mongoose');

const fraudLogSchema = new mongoose.Schema({
  claimId: { type: mongoose.Schema.Types.ObjectId, ref: 'Claim', required: true },
  workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
  riskScore: { type: Number, required: true },
  status: { type: String, enum: ['flagged', 'blocked', 'reviewed'], default: 'flagged' },
  reason: { type: String, required: true },
  flags: [{
    type: { type: String },
    severity: { type: String },
    description: { type: String },
    score: { type: Number }
  }],
  metadata: {
    detectedAt: { type: Date, default: Date.now },
    engine: { type: String, default: 'fraud_detection_service_v1' }
  }
}, {
  timestamps: true
});

fraudLogSchema.index({ workerId: 1, createdAt: -1 });
fraudLogSchema.index({ claimId: 1 });
fraudLogSchema.index({ riskScore: -1 });

module.exports = mongoose.model('FraudLog', fraudLogSchema);
